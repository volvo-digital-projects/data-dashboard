# Data Dashboard: canonical development workspace

- Canonical checkout: C:/Users/User/Projects/Volvo-Digital-Projects/data-dashboard
- Canonical private origin: https://github.com/volvo-digital-projects/data-dashboard.git
- Implement future user-requested development here, not in OneDrive. Verify origin before committing. Test relevant changes, commit only intended non-secret source files, push to this origin, and verify the remote SHA. Report push failures honestly. This is per-task agent behavior, not a filesystem auto-upload service.
- Preserve all original repositories, URLs and OneDrive files. Do not push to volvo-es90-matrix/volvo-data-dashboard.
- Migration is development-only. The inherited .openai/hosting.json identifies the EXISTING LIVE SITE, not staging. Do not publish to it or change live DB/R2/authentication/configuration without explicit cutover approval. User explicitly requires existing production unchanged while the new environment is validated.
- Keep new repository Actions and Pages disabled until staging setup is authorized. Do not copy live deployment secrets or run collection/update schedules casually.
- Preserve CDSID entry and showroom/dealer role scopes. New backend authentication, runtime-data migration and a github.io frontend remain separate tasks, not completed by source cloning.
- Put build outputs/temporary packages outside OneDrive. Never commit credentials, private backup archives, runtime database dumps or raw unreviewed local files.
- Reference-only original: C:/Users/User/OneDrive/문서/Data Dashboard 사이트_v1
- Private local preservation copies: C:/Users/User/Projects/Volvo-Digital-Projects/local-only-archive/data-dashboard
- Do not delete original folders until a complete backup audit and explicit user cleanup approval.
