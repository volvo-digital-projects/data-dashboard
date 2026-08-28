from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

import openpyxl


STAFF_ROLES = {"영업직원", "영업팀장"}
YEARS = ("2023", "2024", "2025", "2026")
TARGET_DMS_SHOWROOM = "H Motors Gangnam Daechi"
TARGET_VOC_SHOWROOM = "강남대치"

STRENGTH_PATTERNS = (
    ("친절한 응대", ("친절", "젠틀")),
    ("상세한 설명", ("상세", "자세", "디테일", "세세")),
    ("전문지식", ("전문", "지식", "장단점")),
    ("신속한 회신", ("빠르게", "신속", "회신", "바로 해결")),
    ("신뢰 형성", ("신뢰", "솔직", "설득력")),
    ("적극적 상담", ("적극", "먼저")),
    ("이해하기 쉬운 안내", ("이해하기 쉽", "쉽게 이해", "쉬운 용어")),
)

IMPROVEMENT_PATTERNS = (
    ("진행상황 선제 안내", ("늦은 업데이트", "업데이트 늦", "회신 지연")),
    ("제품 강점 설명 확장", ("좀더", "다른 것도", "강점", "설명 범위")),
    ("서비스 품목 안내", ("서비스 용품 부족", "서비스 품목")),
)


def normalise_header(value: Any) -> str:
    return str(value or "").strip().replace("\n", "")


def header_map(row: tuple[Any, ...]) -> dict[str, int]:
    return {
        normalise_header(value): index
        for index, value in enumerate(row)
        if normalise_header(value)
    }


def full_months(start: date, end: date) -> int:
    months = (end.year - start.year) * 12 + end.month - start.month
    if end.day < start.day:
        months -= 1
    return max(0, months)


def tenure_bucket(months: int) -> tuple[str, str]:
    if months <= 3:
        return "under-3m", "3개월 이내"
    if months <= 12:
        return "under-1y", "1년 이내"
    if months <= 36:
        return "1-3y", "1~3년"
    if months <= 60:
        return "3-5y", "3~5년"
    if months <= 120:
        return "5-10y", "5~10년"
    return "over-10y", "10년 이상"


def metric() -> dict[str, float | int]:
    return {"responses": 0, "scoreSum": 0}


def add_metric(target: dict[str, float | int], score: float) -> None:
    target["responses"] = int(target["responses"]) + 1
    target["scoreSum"] = round(float(target["scoreSum"]) + score, 1)


def keyword_summary(
    entries: list[dict[str, Any]],
    patterns: tuple[tuple[str, tuple[str, ...]], ...],
    limit: int,
) -> list[dict[str, Any]]:
    counts: Counter[str] = Counter()
    for entry in entries:
        text = " ".join(entry["texts"]).lower()
        for label, tokens in patterns:
            if any(token.lower() in text for token in tokens):
                counts[label] += 1
    return [
        {"label": label, "mentions": count}
        for label, count in counts.most_common(limit)
    ]


def load_roster(path: Path, as_of: date) -> list[dict[str, Any]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook[workbook.sheetnames[0]]
    headers = header_map(next(worksheet.iter_rows(min_row=3, max_row=3, values_only=True)))
    roster: list[dict[str, Any]] = []
    for row in worksheet.iter_rows(min_row=4, values_only=True):
        role = row[headers["직원권한"]]
        status = row[headers["자동배정 여부"]]
        hire_value = row[headers["입사일자"]]
        if role not in STAFF_ROLES or status != "활성" or not isinstance(hire_value, datetime):
            continue
        hire_date = hire_value.date()
        months = full_months(hire_date, as_of)
        bucket_id, bucket_label = tenure_bucket(months)
        roster.append(
            {
                "dmsShowroom": row[headers["전시장명"]],
                "role": role,
                "name": row[headers["직원명"]],
                "hireDate": hire_date.isoformat(),
                "tenureMonths": months,
                "tenureBucket": bucket_id,
                "tenureBucketLabel": bucket_label,
            }
        )
    return roster


def load_voc(path: Path) -> tuple[
    dict[str, dict[str, float | int]],
    dict[tuple[str, str], dict[str, dict[str, float | int]]],
    dict[tuple[str, str], list[dict[str, Any]]],
]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    national = {year: metric() for year in YEARS}
    staff_metrics: dict[tuple[str, str], dict[str, dict[str, float | int]]] = defaultdict(
        lambda: {year: metric() for year in YEARS}
    )
    staff_comments: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)

    for year in YEARS:
        worksheet = workbook[year]
        headers = header_map(next(worksheet.iter_rows(min_row=2, max_row=2, values_only=True)))
        showroom_index = headers.get("방문 전시장", headers.get("방문"))
        name_index = headers["상담영업직원"]
        score_index = headers["상담 만족도"]
        reason_indexes = [
            index
            for label, index in headers.items()
            if label.startswith("해당 점수를 주신 이유는 무엇입니까?")
            or label == "불편사항"
        ]
        blank_rows = 0
        for row in worksheet.iter_rows(min_row=3, values_only=True):
            showroom = row[showroom_index] if showroom_index is not None else None
            name = row[name_index]
            score_value = row[score_index]
            if showroom is None and name is None and score_value is None:
                blank_rows += 1
                if blank_rows >= 250:
                    break
                continue
            blank_rows = 0
            if not isinstance(score_value, (int, float)):
                continue
            score = float(score_value)
            add_metric(national[year], score)
            if not showroom or not name:
                continue
            key = (str(showroom).strip(), str(name).strip())
            add_metric(staff_metrics[key][year], score)
            texts = [
                str(row[index]).strip()
                for index in reason_indexes
                if index < len(row) and isinstance(row[index], str) and row[index].strip()
            ]
            if texts:
                staff_comments[key].append({"year": year, "score": score, "texts": texts})

    return national, staff_metrics, staff_comments


def build_payload(voc_path: Path, roster_path: Path, as_of: date) -> dict[str, Any]:
    roster = load_roster(roster_path, as_of)
    national, staff_metrics, staff_comments = load_voc(voc_path)
    current_names = Counter(str(item["name"]) for item in roster)
    roster_by_unique_name = {
        str(item["name"]): item
        for item in roster
        if current_names[str(item["name"])] == 1
    }

    responding_by_year: dict[str, set[tuple[str, str]]] = {year: set() for year in YEARS}
    for key, by_year in staff_metrics.items():
        for year, values in by_year.items():
            if values["responses"]:
                responding_by_year[year].add(key)

    national_years: dict[str, Any] = {}
    for year in YEARS:
        responses = int(national[year]["responses"])
        score_sum = float(national[year]["scoreSum"])
        employee_count = len(responding_by_year[year])
        national_years[year] = {
            "responses": responses,
            "scoreSum": round(score_sum, 1),
            "average": round(score_sum / responses, 3) if responses else None,
            "respondingEmployees": employee_count,
            "averageResponsesPerEmployee": round(responses / employee_count, 1)
            if employee_count
            else None,
        }

    cohort_order = (
        ("under-3m", "3개월 이내"),
        ("under-1y", "1년 이내"),
        ("1-3y", "1~3년"),
        ("3-5y", "3~5년"),
        ("5-10y", "5~10년"),
        ("over-10y", "10년 이상"),
    )
    cohort_totals = {
        cohort_id: {
            "id": cohort_id,
            "label": label,
            "employeeCount": 0,
            "respondingEmployees": set(),
            "responses": 0,
            "scoreSum": 0.0,
        }
        for cohort_id, label in cohort_order
    }
    for person in roster:
        cohort_totals[str(person["tenureBucket"])]["employeeCount"] += 1
    for (showroom, name), by_year in staff_metrics.items():
        person = roster_by_unique_name.get(name)
        if not person:
            continue
        responses = sum(int(values["responses"]) for values in by_year.values())
        if not responses:
            continue
        score_sum = sum(float(values["scoreSum"]) for values in by_year.values())
        cohort = cohort_totals[str(person["tenureBucket"])]
        cohort["respondingEmployees"].add(name)
        cohort["responses"] += responses
        cohort["scoreSum"] += score_sum

    tenure_cohorts: list[dict[str, Any]] = []
    for cohort_id, _ in cohort_order:
        cohort = cohort_totals[cohort_id]
        responses = int(cohort["responses"])
        score_sum = round(float(cohort["scoreSum"]), 1)
        tenure_cohorts.append(
            {
                "id": cohort["id"],
                "label": cohort["label"],
                "employeeCount": cohort["employeeCount"],
                "respondingEmployees": len(cohort["respondingEmployees"]),
                "responses": responses,
                "scoreSum": score_sum,
                "average": round(score_sum / responses, 2) if responses else None,
            }
        )

    target_roster = [item for item in roster if item["dmsShowroom"] == TARGET_DMS_SHOWROOM]
    employees: list[dict[str, Any]] = []
    for person in target_roster:
        key = (TARGET_VOC_SHOWROOM, str(person["name"]))
        years = {
            year: values
            for year, values in staff_metrics.get(key, {}).items()
            if values["responses"]
        }
        comments = staff_comments.get(key, [])
        employees.append(
            {
                "name": person["name"],
                "role": person["role"],
                "hireDate": person["hireDate"],
                "tenureMonths": person["tenureMonths"],
                "tenureBucket": person["tenureBucket"],
                "tenureBucketLabel": person["tenureBucketLabel"],
                "years": years,
                "commentResponses": len(comments),
                "strengthKeywords": keyword_summary(comments, STRENGTH_PATTERNS, 5),
                "improvementKeywords": keyword_summary(comments, IMPROVEMENT_PATTERNS, 5),
            }
        )
    employees.sort(key=lambda item: (item["role"] != "영업직원", item["name"]))

    target_name_set = {str(item["name"]) for item in target_roster}
    excluded_counts: Counter[str] = Counter()
    for (showroom, name), by_year in staff_metrics.items():
        if showroom != TARGET_VOC_SHOWROOM or name in target_name_set:
            continue
        excluded_counts[name] += sum(int(values["responses"]) for values in by_year.values())

    return {
        "source": {
            "workbook": voc_path.name,
            "vocThrough": "2026-08-24",
            "rosterCheckedAt": as_of.isoformat(),
            "rosterSource": "Volvo Car Korea Sales DMS",
            "rosterRule": "현재 재직자 · 영업직원/영업팀장",
            "rosterUpdateSchedule": "매일 06:00 KST · 1일 1회",
            "historyRange": "2023-2026 YTD",
        },
        "nationalYears": national_years,
        "tenureCohorts": tenure_cohorts,
        "showrooms": {
            "6KR6834": {
                "showroom": "볼보 강남대치",
                "dealer": "에이치",
                "dmsShowroom": TARGET_DMS_SHOWROOM,
                "employees": employees,
                "excludedRawNames": [
                    {
                        "name": name,
                        "responses": responses,
                        "reason": "현재 DMS 재직 명단 미확인",
                    }
                    for name, responses in excluded_counts.most_common()
                ],
            }
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voc", required=True, type=Path)
    parser.add_argument("--roster", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--as-of", default=date.today().isoformat())
    args = parser.parse_args()
    payload = build_payload(args.voc, args.roster, date.fromisoformat(args.as_of))
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
