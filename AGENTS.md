# Data Dashboard: canonical development workspace

- Canonical checkout: D:/Codex Project/Data Dashboard 사이트_v1
- Canonical private origin: https://github.com/volvo-digital-projects/data-dashboard.git
- Implement future user-requested development here on D:, not in OneDrive or the preserved C: checkout. Verify origin before committing. Test relevant changes, commit only intended non-secret source files, push to this origin, and verify the remote SHA. Report push failures honestly. This is per-task agent behavior, not a filesystem auto-upload service.
- Preserve all original repositories, URLs and OneDrive files. Do not push to volvo-es90-matrix/volvo-data-dashboard.
- Do not use or recreate a ChatGPT Sites hosting binding for this project. The previous personal Site is retired and must never be used as a deployment target or shown as the dashboard address unless the user explicitly reverses this instruction.
- Preserve the official dashboard address at `https://volvo-digital-projects.github.io/data-dashboard/`. GitHub Pages deployment configuration may be restored only for this canonical repository and address. The user authorized the private Sales-DMS roster workflow for one run each day at 06:00 KST, but enable it only after `VOLVO_SALES_PASSWORD` is present and one manual run succeeds. Keep inherited or unrelated schedules disabled.
- Preserve CDSID entry and showroom/dealer role scopes. New backend authentication, runtime-data migration and a github.io frontend remain separate tasks, not completed by source cloning.
- Put build outputs/temporary packages outside OneDrive. Never commit credentials, private backup archives, runtime database dumps or raw unreviewed local files.
- Reference-only original: C:/Users/User/OneDrive/문서/Data Dashboard 사이트_v1
- Private local preservation copies: C:/Users/User/Projects/Volvo-Digital-Projects/local-only-archive/data-dashboard
- Do not delete original folders until a complete backup audit and explicit user cleanup approval.

## D-drive recovery safeguards

- C:/Users/User/Projects/Volvo-Digital-Projects/data-dashboard and the OneDrive originals are read-only preservation sources. Do not edit, reset, clean, or delete them.
- D:/Codex Project/data-dashboard-preservation-20261106 contains hash-verified pending work and separate C/D local database copies. Preserve it; never publish its private files.
- Keep the preserved original D folder until separate cleanup approval. Do not treat old deployment archives as disposable without review.
- Local verification uses local D1/R2 only, without production credentials. Never run remote migrations, collection jobs, or deploy as part of environment recovery.
- Use pnpm 11.25.0 and pnpm-lock.yaml locally. Existing npm-based CI remains supported. A recovery branch push must not target main or trigger deployment.

## Local preview lifecycle

- The Windows task Volvo-Data-Dashboard-Local maintains localhost:4187 independently of Codex command sessions. Do not replace it with a temporary exec-session server.
- When the user asks to load or open this project, check localhost readiness; if needed run scripts/local-dashboard.ps1 -Mode Start, then open the local browser panel. Use the Open mode or open-dashboard.cmd for a standalone browser.
- Do not stop the supervisor or its server at the end of routine work. An explicit Stop mode is available when the user requests shutdown.
- Status, runtime and logs live in ignored work/local-server. Never commit runtime executables, local DB state or logs.
