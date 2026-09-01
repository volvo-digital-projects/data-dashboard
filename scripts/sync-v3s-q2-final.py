from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SHOWROOMS_PATH = ROOT / "app" / "data" / "showrooms.json"
REPORT_ROOT = ROOT / "public" / "reports"


def normalize_showroom(value: str) -> str:
    return re.sub(r"\s+", "", value.replace("볼보", "")).strip()


def rounded_average(values: list[float]) -> float:
    return round(sum(values) / len(values) + 1e-12, 1)


def parse_csv_scores(csv_path: Path, known_names: set[str]) -> dict[str, float]:
    with csv_path.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.reader(stream))

    current_showroom = ""
    scores: dict[str, float] = {}
    for row in rows[6:]:
        if len(row) < 31:
            continue
        if row[1].strip():
            current_showroom = row[1].strip()
        normalized = normalize_showroom(current_showroom)
        if row[3].strip() != "Q2" or not row[2].strip() or normalized not in known_names:
            continue
        if normalized in scores:
            raise ValueError(f"CSV에 Q2 전시장 값이 중복되었습니다: {current_showroom}")
        scores[normalized] = float(row[30])

    missing = sorted(known_names - set(scores))
    extra = sorted(set(scores) - known_names)
    if missing or extra:
        raise ValueError(f"CSV 전시장 매핑 실패: missing={missing}, extra={extra}")
    return scores


def extract_pdf_score(cdsid: str) -> float:
    pdf_path = REPORT_ROOT / cdsid / "v3s" / "2026-q2.pdf"
    if not pdf_path.exists():
        raise FileNotFoundError(f"Q2 PDF 없음: {pdf_path}")
    reader = PdfReader(pdf_path)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    matches = {
        float(value)
        for value in re.findall(r"최종\s*점수\s*([0-9]+(?:\.[0-9]+)?)\s*점", text)
    }
    if len(matches) != 1:
        raise ValueError(f"{cdsid} Q2 PDF 최종 점수를 하나로 확정할 수 없습니다: {sorted(matches)}")
    return matches.pop()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="V3S Q2 최종 CSV와 39개 전시장 PDF를 대조하고 대시보드 값을 동기화합니다.",
    )
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--write", action="store_true")
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="전시장별 표는 생략하고 불일치 요약만 출력",
    )
    parser.add_argument("--updated-at", default="2026.09.01")
    args = parser.parse_args()

    dashboard = json.loads(SHOWROOMS_PATH.read_text(encoding="utf-8"))
    showrooms = dashboard["showrooms"]
    by_name = {normalize_showroom(item["showroom"]): item for item in showrooms}
    if len(by_name) != 39 or len(showrooms) != 39:
        raise ValueError("대시보드 전시장 수가 39개가 아니거나 이름이 중복되었습니다.")

    csv_scores = parse_csv_scores(args.csv_path, set(by_name))
    rows: list[dict[str, object]] = []
    for normalized_name, showroom in by_name.items():
        csv_score = csv_scores[normalized_name]
        pdf_score = extract_pdf_score(showroom["cdsid"])
        rows.append(
            {
                "cdsid": showroom["cdsid"],
                "showroom": showroom["showroom"],
                "current": float(showroom["v3s"]),
                "csv": csv_score,
                "pdf": pdf_score,
            }
        )

    rows.sort(key=lambda item: str(item["showroom"]))
    pdf_mismatches = [item for item in rows if abs(float(item["csv"]) - float(item["pdf"])) >= 0.05]
    dashboard_mismatches = [
        item for item in rows if abs(float(item["current"]) - float(item["csv"])) >= 0.05
    ]

    if not args.summary_only:
        print("CDSID | 전시장 | 대시보드 | CSV | PDF | 판정")
        for item in rows:
            status = "수정 필요" if item in dashboard_mismatches else "일치"
            print(
                f"{item['cdsid']} | {item['showroom']} | {item['current']:.1f} | "
                f"{item['csv']:.1f} | {item['pdf']:.1f} | {status}"
            )
    print(
        f"요약: 39개소, 대시보드-CSV 불일치 {len(dashboard_mismatches)}개소, "
        f"CSV-PDF 불일치 {len(pdf_mismatches)}개소"
    )

    if pdf_mismatches:
        names = ", ".join(str(item["showroom"]) for item in pdf_mismatches)
        raise ValueError(f"CSV와 PDF가 일치하지 않아 쓰기를 중단합니다: {names}")

    if not args.write:
        return

    for item in showrooms:
        score = csv_scores[normalize_showroom(item["showroom"])]
        item["v3s"] = score
        item["combat"] = round(score + float(item["voc"]) + float(item["cx"]) + 1e-12, 1)

    dashboard["averages"]["v3s"] = rounded_average(
        [float(item["v3s"]) for item in showrooms]
    )
    dashboard["meta"]["combatAverage"] = rounded_average(
        [float(item["combat"]) for item in showrooms]
    )
    dashboard["meta"]["updatedAt"] = args.updated_at
    generated_from = [
        value
        for value in dashboard["meta"].get("generatedFrom", [])
        if "Q2" not in value
    ]
    generated_from.append(args.csv_path.name)
    dashboard["meta"]["generatedFrom"] = generated_from
    SHOWROOMS_PATH.write_text(
        json.dumps(dashboard, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"반영 완료: V3S 전국 평균 {dashboard['averages']['v3s']:.1f}, "
        f"통합 경쟁력 평균 {dashboard['meta']['combatAverage']:.1f}"
    )


if __name__ == "__main__":
    main()
