from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

import openpyxl


YEARS = {"2023", "2024", "2025", "2026"}


def normalise(value: Any) -> str:
    return str(value or "").strip().replace(" ", "")


def sent_year(value: Any) -> str | None:
    if isinstance(value, datetime):
        year = str(value.year)
    else:
        year = str(value or "").strip()[:4]
    return year if year in YEARS else None


def response_date(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sent", required=True, type=Path)
    parser.add_argument("--voc", required=True, type=Path)
    parser.add_argument("--analysis", required=True, type=Path)
    args = parser.parse_args()

    payload = json.loads(args.analysis.read_text(encoding="utf-8"))
    employee_index: dict[tuple[str, str], dict[str, Any]] = {}
    for showroom in payload["showrooms"].values():
        showroom_name = normalise(showroom["showroom"]).removeprefix("볼보")
        for employee in showroom["employees"]:
            employee_index[(showroom_name, normalise(employee["name"]))] = employee

    workbook = openpyxl.load_workbook(args.sent, read_only=True, data_only=True)
    worksheet = workbook["Raw Data"]
    headers = {
        str(value or "").strip(): index
        for index, value in enumerate(
            next(worksheet.iter_rows(min_row=2, max_row=2, values_only=True))
        )
        if value
    }
    date_index = headers["전시장 방문일시"]
    showroom_index = headers["소속 전시장명"]
    employee_index_column = headers["담당 영업직원"]

    counts: Counter[tuple[str, str, str]] = Counter()
    for row in worksheet.iter_rows(min_row=3, values_only=True):
        year = sent_year(row[date_index])
        showroom = normalise(row[showroom_index])
        employee = normalise(row[employee_index_column])
        if year and showroom and employee:
            counts[(showroom, employee, year)] += 1

    matched_rows = 0
    matched_employees: set[tuple[str, str]] = set()
    for (showroom, employee, year), sent in counts.items():
        target = employee_index.get((showroom, employee))
        if target is None:
            continue
        metric = target["years"].setdefault(year, {"responses": 0, "scoreSum": 0})
        metric["sent"] = sent
        matched_rows += sent
        matched_employees.add((showroom, employee))

    for employee in employee_index.values():
        for metric in employee["years"].values():
            metric.setdefault("sent", 0)

    voc_workbook = openpyxl.load_workbook(args.voc, read_only=True, data_only=True)
    latest_response: dict[tuple[str, str], datetime] = {}
    for year in sorted(YEARS):
        voc_sheet = voc_workbook[year]
        voc_headers = {
            str(value or "").strip().replace("\n", ""): index
            for index, value in enumerate(
                next(voc_sheet.iter_rows(min_row=2, max_row=2, values_only=True))
            )
            if value
        }
        visit_index = voc_headers["전시장 방문일"]
        voc_showroom_index = voc_headers.get("방문 전시장", voc_headers.get("방문"))
        voc_employee_index = voc_headers["상담영업직원"]
        for row in voc_sheet.iter_rows(min_row=3, values_only=True):
            visited_at = response_date(row[visit_index])
            showroom = normalise(row[voc_showroom_index]) if voc_showroom_index is not None else ""
            employee = normalise(row[voc_employee_index])
            key = (showroom, employee)
            if visited_at and key in employee_index and (
                key not in latest_response or visited_at > latest_response[key]
            ):
                latest_response[key] = visited_at

    for key, employee in employee_index.items():
        latest = latest_response.get(key)
        if latest:
            employee["latestResponseDate"] = latest.date().isoformat()
        else:
            employee.pop("latestResponseDate", None)

    payload["source"]["sentWorkbook"] = args.sent.name
    payload["source"]["sentThrough"] = "2026-08-24"
    payload["source"]["latestResponseThrough"] = payload["source"]["vocThrough"]
    args.analysis.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"matched {matched_rows:,} sent rows across "
        f"{len(matched_employees):,} current employees; "
        f"latest responses for {len(latest_response):,} employees"
    )


if __name__ == "__main__":
    main()
