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

export async function prepareDashboardRelease() {
  const root = process.cwd();
  const notePath = path.join(root, "app", "data", "release-note.json");
  const publicDirectory = path.join(root, "public");
  const outputPath = path.join(publicDirectory, "dashboard-release.json");
  const note = JSON.parse(await readFile(notePath, "utf8")) as ReleaseNote;
  const builtAt = new Date();
  const seed = `${JSON.stringify(note)}:${builtAt.toISOString()}`;
  const id = createHash("sha256").update(seed).digest("hex").slice(0, 16);

  await mkdir(publicDirectory, { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        id,
        title: note.title,
        items: note.items,
        publishedAt: builtAt.toISOString(),
        publishedAtKst: formatSeoulReleaseTime(builtAt),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return id;
}
