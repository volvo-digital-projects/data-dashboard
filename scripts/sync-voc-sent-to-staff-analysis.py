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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sent", required=True, type=Path)
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

    payload["source"]["sentWorkbook"] = args.sent.name
    payload["source"]["sentThrough"] = "2026-08-24"
    args.analysis.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"matched {matched_rows:,} sent rows across "
        f"{len(matched_employees):,} current employees"
    )


if __name__ == "__main__":
    main()
