# YouTube creator snapshot

## Hourly public metrics

`refresh-youtube.yml` has staggered watchdog opportunities at minutes 7, 22, 37 and 52 because GitHub schedules may be delayed or dropped. The collector enforces a 55-minute minimum interval, so verified data is still published at most once per hour,
or via workflow_dispatch. It reads the existing 15-person roster / 14 unique channels,
collects complete public long/short catalogs, and rejects the entire refresh if any
channel identity or count is missing after three per-channel retries. The previous snapshot stays intact on failure.
Every channel uses the same Volvo-only scope: a title must identify Volvo or a Volvo
model, while food, travel, daily-life, other-brand and other non-automotive uploads are
excluded. Videos whose titles are ambiguous are included only through reviewed video-ID
overrides after the public description or existing presenter review confirms Volvo content.
This is especially important for channels that also contain historical MINI, BMW, food,
travel or lifestyle material. Unicode-normalized Korean titles and Volvo Cross Country
model names are recognized so decomposed text and Korean suffixes do not cause omissions.
It preserves reviewed comments and known presenter attribution; new shared videos
remain unassigned. The verified Sales-DMS staff-sales snapshot is refreshed and published
atomically with YouTube; VOC is not refreshed by this workflow.

After tests pass it commits only the metrics/release files to canonical main and
explicitly dispatches deploy-pages.yml (GITHUB_TOKEN pushes do not trigger push CI).
UPDATE in the heading is the last complete successful collection time in KST,
not the current clock or the workflow's scheduled time.

Run locally: `python scripts/refresh-youtube-metrics.py` (Python standard library).

The original roster workbook and raw public comment samples remain outside this repository.
The published artifact contains roster fields, channel metrics, explicit-text shared-video
attribution and manually reviewed comment paraphrases with source links. Never publish
raw author identities, phone numbers or inferred face/gender identities.

Manual refresh (Python requires openpyxl):

```sh
python scripts/collect-youtube-channels.py /path/to/roster.xlsx /temporary/channels.json
python scripts/collect-youtube-comments.py /temporary/channels.json /temporary/comments.json
node scripts/prepare-youtube-dashboard.mjs /temporary/comments.json
node --test tests/youtube-creators.test.mjs
```

To refresh channel metrics while retaining an already reviewed comment sample:

```sh
node scripts/prepare-youtube-dashboard.mjs /temporary/channels.json /temporary/comments.json
```

Public YouTube pages can change structure or fail intermittently. Inspect any collection
errors; the publishing step rejects incomplete catalogs or missing video view counts.
The public UI uses rounded view counts, so averages are approximate. About-page join
dates may predate the employee's Volvo activity. Subscribers and videos are aggregated
once per channel, not once per employee. Gender and dealer shares describe only the roster.

Review new comments in context before changing the evidence list. Exclude vehicle-only
complaints, appearance remarks, and complaints about other dealers. Do not convert
comment sentiment into a personnel score. Shared-video attribution requires explicit
presenter text in the title/description/self-introduction; matching a name in contact
boilerplate alone is not proof. Unknown videos remain unassigned.

Sales and VOC are joined at render time from the existing maintained datasets by name
and showroom CDSID. No VOC responses means unscored, never zero points. Monthly sales
includes the current partial month, and is not attributed to YouTube conversion.
