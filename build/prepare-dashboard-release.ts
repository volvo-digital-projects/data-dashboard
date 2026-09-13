import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ReleaseNote = {
  title: string;
  items: string[];
};

function formatSeoulReleaseTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}.${value.month}.${value.day} ${value.hour}:${value.minute}`;
}

async function writeDashboardRelease(
  id: string,
  note: ReleaseNote,
  completedAt: Date,
  outputPath: string,
) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        id,
        title: note.title,
        items: note.items,
        publishedAt: completedAt.toISOString(),
        publishedAtKst: formatSeoulReleaseTime(completedAt),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export async function prepareDashboardRelease() {
  const root = process.cwd();
  const notePath = path.join(root, "app", "data", "release-note.json");
  const publicDirectory = path.join(root, "public");
  const outputPath = path.join(publicDirectory, "dashboard-release.json");
  const note = JSON.parse(await readFile(notePath, "utf8")) as ReleaseNote;
  const sales = JSON.parse(
    await readFile(path.join(root, "app", "data", "sales-activity-analysis.json"), "utf8"),
  ) as { source?: { salesAsOf?: string } };
  const roster = JSON.parse(
    await readFile(path.join(root, "app", "data", "voc-staff-analysis.json"), "utf8"),
  ) as { source?: { rosterCheckedAt?: string } };
  const builtAt = new Date();
  // Every Vinext environment evaluates the Vite config independently. The
  // release id therefore has to depend only on shared, deterministic inputs;
  // using the current time here gives the client bundle and published JSON
  // different ids and can trap long-lived iPad tabs in a reload loop. Include
  // data as-of timestamps so unattended updates also refresh those clients.
  const seed = `${JSON.stringify(note)}\n${sales.source?.salesAsOf ?? ""}\n${roster.source?.rosterCheckedAt ?? ""}`;
  const id = createHash("sha256").update(seed).digest("hex").slice(0, 16);

  await writeDashboardRelease(id, note, builtAt, outputPath);

  return id;
}

export async function finalizeDashboardRelease(id: string) {
  const root = process.cwd();
  const note = JSON.parse(
    await readFile(path.join(root, "app", "data", "release-note.json"), "utf8"),
  ) as ReleaseNote;
  const completedAt = new Date();
  const outputPaths = [
    path.join(root, "public", "dashboard-release.json"),
    path.join(root, "dist", "client", "dashboard-release.json"),
  ];

  await Promise.all(
    outputPaths.map((outputPath) =>
      writeDashboardRelease(id, note, completedAt, outputPath),
    ),
  );
}
