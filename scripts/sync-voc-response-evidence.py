"""Store only aggregate VOC response evidence; never persist raw sheet rows."""

import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def update_snapshot(previous, counts, through):
    total = sum(counts.values())
    if total < 300 or any(count < 0 for count in counts.values()):
        raise ValueError("VOC 회신 집계가 비정상적으로 적습니다.")
    if previous and previous["responsesByYear"] == counts and previous["through"] == through:
        return previous
    return {
        "responsesByYear": counts,
        "totalResponses": total,
        "previousTotalResponses": previous["totalResponses"] if previous else total,
        "through": through,
        "checkedAt": datetime.now(timezone.utc).isoformat(),
    }


def main():
    spec = importlib.util.spec_from_file_location("voc_source", Path(__file__).with_name("download-google-sheet-voc-raw.py"))
    source = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(source)
    # The source currently contains 2026; retain reviewed historical totals.
    analysis = json.loads((ROOT / "app/data/voc-staff-analysis.json").read_text(encoding="utf-8"))
    counts = {year: int(item["responses"]) for year, item in analysis["nationalYears"].items()}
    rows = source.fetch_rows("VOC회신건수", header_rows=2)
    columns = source.header_index(rows[0], {"전시장 방문일", "상담 만족도"})
    latest_counts = {}
    latest_date = None
    for row in rows[1:]:
        visited = source.parse_date(row[columns["전시장 방문일"]])
        score_text = source.clean(row[columns["상담 만족도"]])
        if visited is None or str(visited.year) not in counts or not score_text:
            continue
        try:
            score = float(score_text.replace(",", ""))
        except ValueError:
            continue
        if not 0 <= score <= 10:
            raise ValueError("VOC 상담 만족도 범위를 벗어난 값이 있습니다.")
        year = str(visited.year)
        latest_counts[year] = latest_counts.get(year, 0) + 1
        latest_date = max(latest_date or visited.date(), visited.date())
    if latest_counts.get("2026", 0) < 300 or latest_date is None:
        raise ValueError("최신 VOC 회신 시트를 확인할 수 없습니다.")
    counts.update(latest_counts)
    output = ROOT / "app/data/voc-response-evidence.json"
    previous = json.loads(output.read_text(encoding="utf-8")) if output.exists() else None
    snapshot = update_snapshot(previous, counts, latest_date.isoformat())
    output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"VOC response evidence: {snapshot['totalResponses']:,} responses; through {snapshot['through']}")


if __name__ == "__main__":
    main()
