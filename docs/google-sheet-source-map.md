# 2026 DSC KPI Dashboard — Google Sheets source map

Source workbook:
`https://docs.google.com/spreadsheets/d/1KZust31kwsHrv0VZEqyPhACza9R3rZibOdf467c6JXA/edit`

Reviewed: 2026-07-30

## Workbook conventions

- 27 worksheets in total.
- Circled-number sheets (`①`, `②`, `③`) are scored result sheets.
- Starred sheets (`☆`) are Raw/Back Data or intermediate calculation sheets.
- `RDM코드` is the stable showroom identifier used by the workbook. It maps to
  the site's `CDSID`.
- Weekly sheets use columns `F:BE` for `26W01:26W52`.
- The common weekly layout is:
  - row 10: aggregation status
  - row 11: week start date
  - row 12: week end date
  - row 13: identifiers and week labels
  - row 14: Volvo national total/average
  - rows 15–53: 39 showroom records
- Quarter result layouts use columns `F:I` for `Q1:Q4`.
- Formula errors such as `#DIV/0!` mean that a period has not closed. They must
  be treated as pending, not as zero.

## Result and control sheets

| Sheet | Role |
| --- | --- |
| `종합 경쟁력 지수` | Dealer, region, size, and showroom competitive-position view |
| `종합 대시보드(최종결과)` | Combined 39-showroom output and module freshness dates |
| `업데이트 일지` | Audit trail of methodology and data changes |
| `DSC조건` | Evaluation conditions/reference material |
| `DB_날짜(참고)` | Canonical W01–W52 and Q1–Q4 calendar |
| `①V3S(결과)` | V3S quarterly result |
| `②VOC(결과)` | VOC weekly result plus quarter summary |
| `③-1 신차출고 만족도(결과)` | Weekly car-handover satisfaction |
| `③-2시승 만족도(결과)` | Weekly test-drive satisfaction |
| `③-3긴급경보 처리여부(결과)` | Weekly Hot Alert compliance |
| `③-4조치 계획(결과)` | Quarterly Action Plan compliance |
| `③-5헤이볼보 앱 가입율(결과)` | Weekly Hej Volvo app signup rate |

## Raw/Back Data flow

```text
01☆VOC종합만족도(60%)
02☆VOC첫인사(20%)
03☆VOC태블릿(10%)
04☆VOC해피콜(10%)
        └──> ②VOC(결과)

05☆신차출고 회신건수 ──> ③-1 신차출고 만족도(결과)
06☆시승 회신건수 ─────> ③-2시승 만족도(결과)
07☆긴급경보 경과일수 ─> ③-3긴급경보 처리여부(결과)
08☆앱 가입고객수
09☆앱 전체고객 수 ────> ③-5헤이볼보 앱 가입율(결과)
11☆해피콜 총회신건수
12☆해피콜 총발행건수 ─> 10☆신차해피콜 이행율

③-1 + ③-2 + ③-3 + ③-4 + ③-5
        └──> ☆CX Index 분기별 점수

①V3S + ②VOC + ☆CX Index 분기별 점수
        └──> 종합 대시보드(최종결과)
        └──> 종합 경쟁력 지수
```

## Native data cadence

- V3S: quarterly. The latest completed period is Q2.
- VOC: weekly. The latest completed period in the workbook snapshot is 26W26.
- CX delivery, test drive, Hot Alert, and app components: weekly. Their latest
  commonly completed period is 26W30.
- CX Action Plan: quarterly.
- The official showroom power/combat score must use the latest mutually closed
  quarter. As of the review date that is Q2.
- Trend charts must follow each metric's native cadence. Do not fabricate weekly
  V3S points.

## Module freshness shown in the final dashboard

| Module | Workbook update stamp |
| --- | --- |
| V3S | 2026-06-25 09:27 |
| VOC | 2026-07-10 14:51 |
| CX Index total | 2026-07-28 14:41 |
| New-car handover satisfaction | 2026-07-28 16:03 |
| Test-drive satisfaction | 2026-07-28 17:52 |
| Hot Alert | 2026-06-29 14:13 |
| Action Plan | 2026-07-29 12:32 |
| Hej Volvo app | 2026-07-28 18:14 |
| New-car Happy Call | 2026-07-29 09:05 |

The site should show freshness per KPI/module instead of only one global update
date.

## Appeal/correction behavior

- V3S: appeal possible.
- VOC: partially appealable. Survey satisfaction, greeting, and tablet results
  are not editable; Happy Call can be appealed with objective call evidence.
- CX: partially appealable.
  - not appealable: handover satisfaction, test-drive satisfaction, app signup
  - appealable: Hot Alert, Action Plan, new-car Happy Call
- Workbook rows with no customer response have metric-specific fallback rules.
  In particular, some VOC/ONE Voice zero-result rows use the average of the
  other showrooms in the same dealer group. Zero must not be interpreted
  uniformly across all metrics.

## Site implementation rules

1. Keep the official combat score tied to the latest closed quarter.
2. Show VOC and CX weekly trends through their own latest completed week.
3. Display an individual freshness stamp on V3S, VOC, CX, and correction cards.
4. Use `RDM코드/CDSID` as the login-to-showroom join key.
5. Preserve the national average row separately from the 39 showroom rows.
6. Treat incomplete, blank, and formula-error periods as pending.
7. Keep the starred source sheets out of the manager UI; expose only audit
   evidence and correction eligibility.
8. Use `DB_날짜(참고)` as the single calendar source for week and quarter labels.

## Access note

At review time, the Google Sheet itself was set to "anyone with the link".
That is broader than the closed-manager-site requirement. Before production
data synchronization is enabled, prefer workspace-restricted Google access or a
server-side authenticated sync path.
