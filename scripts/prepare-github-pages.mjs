import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageRoot = path.join(projectRoot, "work", "github-pages-stage");
const gitReleaseId = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
  cwd: projectRoot,
  encoding: "utf8",
}).trim();
const releaseFile = path.join(projectRoot, "public", "dashboard-release.json");
let releaseId = gitReleaseId;
try {
  const release = JSON.parse(readFileSync(releaseFile, "utf8"));
  if (typeof release.id === "string" && release.id.trim()) {
    releaseId = release.id.trim();
  }
} catch {
  // A source-only checkout can still produce a stable Pages build.
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

writeFileSync(path.join(stageRoot, ".nojekyll"), "", "utf8");
writeFileSync(
  path.join(stageRoot, "index.html"),
  '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/data-dashboard/"><title>Volvo Data Dashboard</title></head><body><a href="/data-dashboard/">Volvo Data Dashboard 열기</a></body></html>',
  "utf8",
);
writeFileSync(
  path.join(stageRoot, "404.html"),
  '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/data-dashboard/"><title>Volvo Data Dashboard</title></head><body><a href="/data-dashboard/">Volvo Data Dashboard 열기</a></body></html>',
  "utf8",
);

console.log(`GitHub Pages stage ready: ${stageRoot}`);
