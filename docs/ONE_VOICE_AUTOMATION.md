# ONE VOICE daily score sync

## Operating model

- The Chrome extension reads only an already-open `volvo.medallia.eu` tab. It never creates, activates, or navigates to a new browser window or tab.
- From 10:00 through 10:59 KST on weekdays, a Chrome alarm checks every 10 minutes. After that day's 10:00 slot is stored, it does nothing for the rest of the day.
- Korean weekends, statutory holidays, and substitute holidays are skipped before the existing tab is accessed. Election or one-off holidays can be added while preparing the extension as comma-separated ISO dates.
- If either ONE VOICE score is missing or the Medallia session-expired screen is visible, the extension reloads that same existing tab, waits for it to finish, and immediately retries both cards. It never opens another tab.
- Cloudflare D1 is the source of truth for captured snapshots and missing-slot records.
- GitHub Actions checks the daily 10:00 slot at 10:23 KST. It records and alerts on a missing slot, but cannot bypass Medallia SSO or recreate a past score without the local signed-in browser.

## Security

- The Medallia `alreftoken` query parameter is removed before configuration is saved.
- The Cloudflare ingest token is stored in Sites as a secret and in the locally generated unpacked extension directory. The generated directory is outside Git and readable by the current Windows user.
- No Medallia password, cookie, browser profile, or ingest token is committed to Git.

## Existing-tab extension setup

Run `scripts/one-voice/prepare-existing-tab-extension.ps1`, then load the printed directory once from `chrome://extensions` using **Load unpacked**. Keep the normal authenticated ONE VOICE tab open. The extension scans existing ONE VOICE tabs without bringing them to the foreground; it does nothing when none is open. The retired dedicated-profile Windows task remains disabled.

## GitHub activation

Add repository secret `ONE_VOICE_INGEST_TOKEN`. If a temporary/election holiday is announced, add repository variable `ONE_VOICE_EXTRA_HOLIDAYS`, for example `2026-06-03,2026-12-18`.
