# Local development on D:

Canonical folder: D:/Codex Project/Data Dashboard 사이트_v1
Origin: https://github.com/volvo-digital-projects/data-dashboard.git
Recovery source: 66c93c558f4ba3916cb49d99084c66d80e277454
Tested: Node 24.22.1, pnpm 11.25.0. CI still uses npm and Node 22.13.0.

Install with pnpm install --frozen-lockfile. Native build permission is limited to esbuild, sharp, unrs-resolver and workerd. The local pnpm store is outside the project on D:. Do not copy node_modules from OneDrive.

Run pnpm dev, pnpm test, or pnpm run build:github-pages. Local vinext listens on localhost; use localhost rather than assuming IPv4 127.0.0.1.

The build commands write local release manifests and generated output. They do not deploy. Do not invoke deployment, data collection, or remote database commands during recovery.

C and OneDrive originals remain unchanged. The old D folder is retained separately. Private pending edits, raw reports and C/D local DB snapshots are in the sibling preservation folder, with a SHA-256 manifest. They must not be committed or served. C's incomplete staff identifier UI, stale VOC evidence and generated release differences were retained there rather than replacing newer verified source.

The active local Wrangler state began as the C snapshot; D's distinct snapshot is separately preserved. Runtime verification may change the active local copy only. No production credentials are required.

## Persistent local preview on Windows

The current user's Windows task `Volvo-Data-Dashboard-Local` starts a hidden supervisor at sign-in, outside Codex command sessions. It checks port 4187 every five seconds and starts the local vinext server if it exits. It does not run collectors or deploy anything. A computer that is off or asleep cannot serve localhost.

Use the Codex `Dashboard` action or double-click `open-dashboard.cmd` to ensure the server is ready and open the browser. Selecting a Codex project is not itself a documented startup hook; the sign-in task keeps its saved localhost preview available independently.

Setup on this machine was installed using the same operations as `scripts/install-local-dashboard.ps1`. That installer preserves a local copy of the installed Node runtime in ignored `work/local-server/node.exe`, so Codex updates do not remove the executable underneath the running server. Logs and status are in `work/local-server/` and are never committed. The runtime is not updated automatically; rerun the installer deliberately when upgrading Node, after stopping the supervisor.

To inspect: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-dashboard.ps1 -Mode Status`. To stop intentionally use `-Mode Stop`; to resume use `-Mode Start` or the Dashboard action. A deliberate stop persists until resumed. There is one supervisor per Windows login session. If another program occupies port 4187 it is never killed automatically.
