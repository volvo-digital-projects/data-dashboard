import { appendFileSync, readFileSync } from "node:fs";
import { setTimeout as wait } from "node:timers/promises";

const repository = process.env.GITHUB_REPOSITORY;
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const minute = 60_000;
const kstOffset = 9 * 60 * minute;
const scheduledHours = { "0 21 * * *": 6, "0 1 * * *": 10, "0 5 * * *": 14, "0 9 * * *": 18 };
const summary = [];

async function github(path, body) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: body && JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw Error(`GitHub API HTTP ${response.status} (${path})`);
      return await response.json();
    } catch (error) {
      if (body || attempt === 4) throw error;
      await wait(10_000);
    }
  }
}

async function slotStart() {
  const requested = process.env.DASHBOARD_SLOT;
  if (requested) {
    if (!/^\d{4}-\d{2}-\d{2}T(06|10|14|18):00:00\+09:00$/.test(requested) || !Number.isFinite(Date.parse(requested))) {
      throw Error("Invalid dashboard slot");
    }
    if (Date.parse(requested) > Date.now()) throw Error("Dashboard slot is in the future");
    return Date.parse(requested);
  }
  if (!event.schedule) return null;
  const hour = scheduledHours[event.schedule];
  if (hour === undefined) throw Error("Unknown dashboard schedule");
  const run = await github(`actions/runs/${process.env.GITHUB_RUN_ID}`);
  const created = Date.parse(run.created_at);
  const localDay = new Date(created + kstOffset);
  const slot = Date.UTC(localDay.getUTCFullYear(), localDay.getUTCMonth(), localDay.getUTCDate(), hour) - kstOffset;
  return slot > created ? slot - 24 * 60 * minute : slot;
}

async function complete(stage, deadline) {
  if (!stage.runId) {
    const result = await github(`actions/workflows/${stage.file}/dispatches`, {
      ref: "main",
      inputs: stage.inputs,
      return_run_details: true,
    });
    if (!Number.isInteger(result.workflow_run_id)) throw Error("GitHub did not return a run ID");
    stage.runId = result.workflow_run_id;
    stage.url = result.html_url;
    console.log(`${stage.label}: ${stage.url}`);
  }
  while (Date.now() < deadline) {
    const run = await github(`actions/runs/${stage.runId}`);
    if (run.status === "completed") {
      stage.runId = null;
      if (run.conclusion === "success") return;
      const { jobs } = await github(`actions/runs/${run.id}/jobs`);
      const failed = jobs.flatMap(job => job.steps ?? []).filter(step => step.conclusion === "failure");
      throw Error(`${run.conclusion}${failed.length ? " · " + failed.map(step => step.name).join(", ") : ""}`);
    }
    await wait(15_000);
  }
  throw Error("The update window ended before the run completed");
}

async function retry(stages, deadline) {
  let pending = stages;
  let retryDelay = 5 * minute;
  while (pending.length && Date.now() < deadline) {
    const remaining = [];
    for (const stage of pending) {
      let succeeded = false;
      // Try once more immediately on the first failure, then let other sources run.
      const attempts = stage.error ? 1 : 2;
      for (let attempt = 0; attempt < attempts && Date.now() < deadline; attempt++) {
        try {
          await complete(stage, deadline);
          summary.push(`- ${stage.label}: success · ${stage.url}`);
          succeeded = true;
          break;
        } catch (error) {
          stage.error = error.message;
          console.log(`${stage.label}: ${stage.error}`);
        }
      }
      if (!succeeded) remaining.push(stage);
    }
    pending = remaining;
    if (!pending.length || Date.now() + retryDelay >= deadline) break;
    await wait(retryDelay);
    retryDelay = Math.min(2 * retryDelay, 30 * minute);
  }
  if (pending.length) {
    for (const stage of pending) summary.push(`- ${stage.label}: incomplete · ${stage.error ?? "window ended"} · ${stage.url ?? ""}`);
    throw Error("Dashboard update window ended with unfinished stages");
  }
}

async function updateDashboard() {
  const slot = await slotStart();
  const deadline = (slot ?? Date.now()) + 4 * 60 * minute;
  const closing = slot !== null && new Date(slot + kstOffset).getUTCHours() === 18;
  summary.push(`## Dashboard update · ${slot === null ? "manual" : new Date(slot + kstOffset).toISOString().slice(0, 16) + " KST"}`);
  if (Date.now() >= deadline) throw Error("This scheduled slot is already expired");
  if (slot !== null) {
    const localSlot = new Date(slot + kstOffset);
    const name = localSlot.toISOString().slice(0, 19) + "+09:00";
    const schedule = Object.keys(scheduledHours).find(cron => scheduledHours[cron] === localSlot.getUTCHours());
    const { workflow_runs: runs } = await github("actions/workflows/update-dashboard.yml/runs?status=success&per_page=20");
    const completed = runs.find(run => Date.parse(run.created_at) >= slot && Date.parse(run.created_at) < deadline &&
      [`Dashboard batch ${name}`, `Dashboard batch ${schedule}`].includes(run.display_title));
    if (completed) {
      summary.push(`- This slot already published successfully · ${completed.html_url}`);
      return;
    }
  }
  const inputs = { defer_deploy: "true" };
  await retry([
    { label: "Sales-DMS roster", file: "sync-sales-dms-roster.yml", inputs },
    { label: "Google Sheets VOC/CX", file: "sync-weekly-dashboard.yml", inputs },
    { label: "YouTube, comments API and staff sales", file: "refresh-youtube.yml", inputs: { ...inputs, capture_daily_close: String(closing) } },
  ], deadline);
  await retry([{ label: "GitHub Pages", file: "deploy-pages.yml", inputs: {} }], deadline);
}

try {
  await updateDashboard();
} catch (error) {
  summary.push(`- ${error.message}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
}
