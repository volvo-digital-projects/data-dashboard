import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageRoot = path.join(projectRoot, "work", "github-pages-stage");
const pagesBasePath = "/data-dashboard/";
const releaseNote = JSON.parse(
  readFileSync(path.join(projectRoot, "app", "data", "release-note.json"), "utf8"),
);
const salesSource = JSON.parse(
  readFileSync(path.join(projectRoot, "app", "data", "sales-activity-analysis.json"), "utf8"),
).source;
const rosterSource = JSON.parse(
  readFileSync(path.join(projectRoot, "app", "data", "voc-staff-analysis.json"), "utf8"),
).source;
const youtube = JSON.parse(readFileSync(path.join(projectRoot, "app/data/youtube-creators.json"), "utf8"));
const comments = JSON.parse(readFileSync(path.join(projectRoot, "app/data/youtube-comments.json"), "utf8"));
const releaseSeed = `${JSON.stringify(releaseNote)}\n${salesSource?.salesAsOf ?? ""}\n${salesSource?.salesSyncedAt ?? ""}\n${rosterSource?.rosterCheckedAt ?? ""}\n${youtube.channels.map(channel => channel.checkedAt).join(",")}\n${comments.checkedAt ?? ""}`;
const releaseId = createHash("sha256")
  .update(releaseSeed)
  .digest("hex")
  .slice(0, 16);

function formatSeoulReleaseTime(date) {
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

rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(stageRoot, { recursive: true });

execFileSync(
  process.execPath,
  [
    path.join(projectRoot, "node_modules", "vite", "bin", "vite.js"),
    "build",
    "--config",
    "vite-pages.config.ts",
  ],
  {
    cwd: projectRoot,
    env: { ...process.env, DASHBOARD_RELEASE_ID: releaseId },
    stdio: "inherit",
  },
);

cpSync(path.join(projectRoot, "public"), stageRoot, {
  recursive: true,
  force: true,
});

const publicPathPrefixes = [
  "/dashboard-release.json",
  "/evidence/",
  "/favicon.svg",
  "/fonts/",
  "/guides/",
  "/og.png",
  "/reports/",
  "/staff-profiles/",
  "/volvo-dashboard-cover-clean.png",
  "/volvo-wordmark-white.png",
];

function rewritePagesPaths(directory) {
  for (const entry of readdirSync(directory)) {
    const target = path.join(directory, entry);
    if (statSync(target).isDirectory()) {
      rewritePagesPaths(target);
      continue;
    }
    if (!/\.(?:css|html|js)$/.test(entry)) continue;
    let content = readFileSync(target, "utf8");
    for (const prefix of publicPathPrefixes) {
      content = content.replaceAll(prefix, `${pagesBasePath}${prefix.slice(1)}`);
    }
    writeFileSync(target, content, "utf8");
  }
}

rewritePagesPaths(stageRoot);

const deployedAt = new Date();
writeFileSync(
  path.join(stageRoot, "dashboard-release.json"),
  `${JSON.stringify(
    {
      id: releaseId,
      title: releaseNote.title,
      items: releaseNote.items,
      publishedAt: deployedAt.toISOString(),
      publishedAtKst: formatSeoulReleaseTime(deployedAt),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const indexPath = path.join(stageRoot, "index.html");
const releaseBootstrap = `<script>(function(){try{var u=new URL(location.href);if(u.searchParams.get("release")!==${JSON.stringify(releaseId)}){u.searchParams.set("release",${JSON.stringify(releaseId)});history.replaceState(null,"",u.toString())}}catch(e){}})();</script>`;
writeFileSync(
  indexPath,
  readFileSync(indexPath, "utf8").replace("</head>", `${releaseBootstrap}</head>`),
  "utf8",
);

writeFileSync(path.join(stageRoot, ".nojekyll"), "", "utf8");
copyFileSync(indexPath, path.join(stageRoot, "404.html"));

console.log(`GitHub Pages stage ready: ${stageRoot}`);
