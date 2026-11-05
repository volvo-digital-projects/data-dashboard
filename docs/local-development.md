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
