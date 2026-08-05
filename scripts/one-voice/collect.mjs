import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { collectionWindow, hourlySlotKst } from "./korean-business-day.mjs";

const TITLES = {
  testDriveScore: "Test Drive - Overall Satisfaction (OSAT)",
  carHandoverScore: "Car Handover - Overall Satisfaction (OSAT)",
};
const setupMode = process.argv.includes("--setup");

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function safeMedalliaUrl(raw) {
  const url = new URL(raw);
  url.searchParams.delete("alreftoken");
  return url.toString();
}

function endpoint() {
  return `${required("ONE_VOICE_SITE_URL").replace(/\/$/, "")}/api/one-voice`;
}

function extraHolidays() {
  return (process.env.ONE_VOICE_EXTRA_HOLIDAYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function appendLog(message, details = {}) {
  const logDir = path.join(
    process.env.LOCALAPPDATA ?? os.tmpdir(),
    "VolvoDashboard",
    "logs",
  );
  await fs.mkdir(logDir, { recursive: true });
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
  }).format(new Date());
  const line = JSON.stringify({
    time: new Date().toISOString(),
    message,
    ...details,
  });
  await fs.appendFile(path.join(logDir, `one-voice-${date}.jsonl`), `${line}\n`);
}

async function cloudSnapshot() {
  const response = await fetch(endpoint(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Dashboard API GET failed: ${response.status}`);
  return response.json();
}

async function uploadSnapshot(snapshot) {
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("ONE_VOICE_INGEST_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kind: "snapshot", ...snapshot }),
  });
  if (!response.ok) {
    throw new Error(`Dashboard API POST failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function chromeExecutable() {
  const candidates = [
    process.env.ONE_VOICE_CHROME_PATH,
    process.env.PROGRAMFILES &&
      path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] &&
      path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);
  return candidates;
}

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue to the next known Chrome installation location.
    }
  }
  throw new Error("Google Chrome executable was not found");
}

async function cardScore(page, title) {
  const heading = page.getByText(title, { exact: true }).first();
  if (!(await heading.isVisible().catch(() => false))) return null;
  return heading.evaluate((element) => {
    let root = element;
    for (let depth = 0; depth < 7 && root.parentElement; depth += 1) {
      root = root.parentElement;
      const rect = root.getBoundingClientRect();
      if (rect.width >= 280 && rect.height >= 230) break;
    }
    const candidates = [...root.querySelectorAll("*")]
      .filter((node) => node.children.length === 0)
      .map((node) => {
        const text = (node.textContent ?? "").trim();
        const fontSize = Number.parseFloat(getComputedStyle(node).fontSize || "0");
        return { text, fontSize };
      })
      .filter(({ text, fontSize }) =>
        /^(?:100(?:\.0)?|\d{1,2}(?:\.\d)?)$/.test(text) && fontSize >= 20,
      )
      .sort((left, right) => right.fontSize - left.fontSize);
    return candidates.length ? Number(candidates[0].text) : null;
  });
}

async function bothScores(page) {
  const [testDriveScore, carHandoverScore] = await Promise.all([
    cardScore(page, TITLES.testDriveScore),
    cardScore(page, TITLES.carHandoverScore),
  ]);
  if (
    typeof testDriveScore !== "number" ||
    typeof carHandoverScore !== "number"
  ) {
    return null;
  }
  return { testDriveScore, carHandoverScore };
}

async function selectMarketAdmin(page) {
  const admin = page.getByText("Market - Admin", { exact: true });
  if (await admin.isVisible().catch(() => false)) {
    await admin.click();
    await page.waitForTimeout(2500);
    return true;
  }
  const roleTrigger = page
    .getByText(/Market\s*-\s*(?:with PII|Admin)|Retailer/, { exact: true })
    .first();
  if (await roleTrigger.isVisible().catch(() => false)) {
    await roleTrigger.click();
    await page.waitForTimeout(500);
    const menuItem = page.getByText("Market - Admin", { exact: true }).last();
    if (await menuItem.isVisible().catch(() => false)) {
      await menuItem.click();
      await page.waitForTimeout(3000);
      return true;
    }
  }
  return false;
}

async function collectFromBrowser() {
  const playwrightRoot = required("ONE_VOICE_PLAYWRIGHT_ROOT");
  const moduleUrl = pathToFileURL(path.join(playwrightRoot, "index.mjs")).href;
  const { chromium } = await import(moduleUrl);
  const executablePath = await firstExisting(chromeExecutable());
  const profileDir = required("ONE_VOICE_PROFILE_DIR");
  await fs.mkdir(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath,
    headless: !setupMode,
    viewport: { width: 1600, height: 1000 },
    args: ["--disable-background-timer-throttling"],
  });
  try {
    let page = context.pages()[0] ?? (await context.newPage());
    try {
      await page.goto(safeMedalliaUrl(required("ONE_VOICE_MEDALLIA_URL")), {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/ERR_ABORTED|frame was detached/i.test(message)) throw error;
      await appendLog("Medallia SSO redirected the login page; continuing", {
        navigationDetail: message,
      });
    }
    await delay(1500);
    const redirectedPages = context.pages().filter((candidate) => !candidate.isClosed());
    if (page.isClosed()) {
      page = redirectedPages.at(-1) ??
        (await context.waitForEvent("page", { timeout: 15_000 }));
    } else if (redirectedPages.length > 1) {
      page = redirectedPages.at(-1);
    }
    await delay(2500);

    if (setupMode) {
      await appendLog("Interactive ONE VOICE session setup started");
      const deadline = Date.now() + 10 * 60_000;
      while (Date.now() < deadline) {
        const scores = await bothScores(page);
        if (scores) {
          await appendLog("Interactive ONE VOICE session setup completed", scores);
          return scores;
        }
        await selectMarketAdmin(page).catch(() => false);
        await page.waitForTimeout(2000);
      }
      throw new Error("Login/setup timed out before the ONE VOICE cards appeared");
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const scores = await bothScores(page);
      if (scores) return scores;
      await selectMarketAdmin(page).catch(() => false);
      const afterRoleChange = await bothScores(page);
      if (afterRoleChange) return afterRoleChange;
      await appendLog("ONE VOICE values missing; refreshing page", { attempt });
      await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(4000);
    }
    throw new Error("ONE VOICE score cards stayed unavailable after automatic refreshes");
  } finally {
    await context.close();
  }
}

async function main() {
  const now = new Date();
  if (!setupMode) {
    const window = collectionWindow(now, extraHolidays());
    if (!window.allowed) {
      await appendLog("Collector skipped", { reason: window.reason });
      return;
    }

    const slotKst = hourlySlotKst(now);
    try {
      const current = await cloudSnapshot();
      if (current.snapshot?.slotKst === slotKst) {
        await appendLog("Hourly slot already stored", { slotKst });
        return;
      }
    } catch (error) {
      await appendLog("Cloud preflight failed; browser collection will continue", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const scores = await collectFromBrowser();
  if (setupMode) return;

  const snapshot = {
    slotKst: hourlySlotKst(now),
    capturedAt: new Date().toISOString(),
    ...scores,
  };
  await uploadSnapshot(snapshot);
  await appendLog("ONE VOICE snapshot stored", snapshot);
}

main().catch(async (error) => {
  await appendLog("ONE VOICE collector failed", {
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  }).catch(() => {});
  process.exitCode = 1;
});
