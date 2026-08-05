# ONE VOICE hourly score sync

## Operating model

- The local Windows collector is the only component that opens Medallia. It uses a dedicated Chrome profile containing the user's SSO/2FA session.
- From 09:00 through 17:59 KST on weekdays, Windows Task Scheduler checks every 10 minutes. It opens Chrome only when the current hourly slot is missing.
- Korean weekends, statutory holidays, and substitute holidays are skipped before Chrome launches. Election or one-off holidays can be added through `ONE_VOICE_EXTRA_HOLIDAYS` as comma-separated ISO dates.
- If either ONE VOICE score is missing, the collector reloads the page up to three times and uploads the values only after both cards are read.
- Cloudflare D1 is the source of truth for captured snapshots and missing-slot records.
- GitHub Actions checks each slot at 23 minutes past the hour. It records and alerts on a missing slot, but cannot bypass Medallia SSO or recreate a past score without the local signed-in browser.

## Security

- The Medallia `alreftoken` query parameter is removed before configuration is saved.
- The Cloudflare ingest token is stored in Sites as a secret and on Windows as a DPAPI-encrypted value readable only by the current Windows user.
- No Medallia password, cookie, browser profile, or ingest token is committed to Git.

## First-time login

Run `scripts/one-voice/setup-session.ps1`, complete SSO and 2FA in the opened Chrome window, and keep the `Market - Admin` dashboard visible until the script confirms both score cards.

## GitHub activation

Add repository secret `ONE_VOICE_INGEST_TOKEN`. If a temporary/election holiday is announced, add repository variable `ONE_VOICE_EXTRA_HOLIDAYS`, for example `2026-06-03,2026-12-18`.
