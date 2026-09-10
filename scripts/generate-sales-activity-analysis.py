#!/usr/bin/env python3
"""Build privacy-safe staff sales/activity aggregates from the supplied reports."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import openpyxl


ACTIVITY_START = datetime(2026, 1, 1)
ACTIVITY_END = datetime(2026, 9, 7, 23, 59, 59)
SALES_START = datetime(2026, 1, 1)
SALES_END = datetime(2026, 9, 10, 23, 59, 59)
STAGES = ("상담", "시승", "계약")


def normalized_customer(value: object) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).casefold()


def iso_date(value: datetime | None) -> str | None:
    return value.strftime("%Y-%m-%d") if value else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("activity_report", type=Path)
    parser.add_argument("sales_report", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    staff_source = json.loads(
        (repo_root / "app/data/voc-staff-analysis.json").read_text(encoding="utf-8")
    )
    roster = {
        cdsid: [
            employee["name"]
            for employee in showroom["employees"]
            if employee["role"] in ("영업직원", "영업팀장")
        ]
        for cdsid, showroom in staff_source["showrooms"].items()
    }
    name_frequency = Counter(name for names in roster.values() for name in names)
    current_names = set(name_frequency)

    activity_customers = {
        name: {stage: set() for stage in STAGES} for name in current_names
    }
    activity_events = {name: Counter() for name in current_names}
    last_activity_date: dict[str, datetime] = {}

    activity_book = openpyxl.load_workbook(
        args.activity_report, read_only=True, data_only=True
    )
    activity_sheet = activity_book.active
    for row in activity_sheet.iter_rows(min_row=4, values_only=True):
        completed, customer, staff_name = row[1], row[2], row[4]
        activity_date, stage = row[7], row[10]
        if staff_name not in current_names or not isinstance(activity_date, datetime):
            continue
        previous = last_activity_date.get(staff_name)
        if previous is None or activity_date > previous:
            last_activity_date[staff_name] = activity_date
        if (
            name_frequency[staff_name] != 1
            or completed != "완료"
            or not (ACTIVITY_START <= activity_date <= ACTIVITY_END)
            or stage not in STAGES
        ):
            continue
        customer_key = normalized_customer(customer)
        if not customer_key:
            continue
        activity_customers[staff_name][stage].add(customer_key)
        activity_events[staff_name][stage] += 1
    activity_book.close()

    sales_rows: list[tuple[datetime, str, str, str]] = []
    showroom_code_evidence: dict[str, Counter[str]] = {
        cdsid: Counter() for cdsid in roster
    }
    sales_book = openpyxl.load_workbook(args.sales_report, read_only=True, data_only=True)
    sales_sheet = sales_book.active
    for row in sales_sheet.iter_rows(min_row=4, values_only=True):
        delivery_date, shipped = row[0], row[23]
        dealer_code, customer, staff_name = row[26], row[27], row[28]
        if (
            not isinstance(delivery_date, datetime)
            or not (SALES_START <= delivery_date <= SALES_END)
            or shipped != "출고"
            or not dealer_code
            or staff_name not in current_names
        ):
            continue
        dealer_code = str(dealer_code)
        sales_rows.append(
            (delivery_date, dealer_code, normalized_customer(customer), staff_name)
        )
        if name_frequency[staff_name] == 1:
            for cdsid, names in roster.items():
                if staff_name in names:
                    showroom_code_evidence[cdsid][dealer_code] += 1
                    break
    sales_book.close()

    showroom_codes: dict[str, str | None] = {}
    for cdsid, evidence in showroom_code_evidence.items():
        showroom_codes[cdsid] = evidence.most_common(1)[0][0] if evidence else None

    output_showrooms = {}
    for cdsid, names in roster.items():
        dealer_code = showroom_codes[cdsid]
        staff_rows = []
        showroom_monthly = [0] * 9
        for name in names:
            consultation = activity_customers[name]["상담"]
            test_drive = activity_customers[name]["시승"]
            contract = activity_customers[name]["계약"]
            monthly = [0] * 9
            delivered_customers: set[str] = set()
            for delivery_date, row_dealer_code, customer, staff_name in sales_rows:
                if dealer_code == row_dealer_code and staff_name == name:
                    monthly[delivery_date.month - 1] += 1
                    showroom_monthly[delivery_date.month - 1] += 1
                    if customer:
                        delivered_customers.add(customer)
            activity_is_ambiguous = name_frequency[name] != 1
            activity_total = sum(activity_events[name].values())
            staff_rows.append(
                {
                    "name": name,
                    "activityStatus": (
                        "ambiguous-name"
                        if activity_is_ambiguous
                        else "available" if activity_total else "missing"
                    ),
                    "lastActivityDate": iso_date(last_activity_date.get(name)),
                    "activityEvents": {
                        "consultation": activity_events[name]["상담"],
                        "testDrive": activity_events[name]["시승"],
                        "contract": activity_events[name]["계약"],
                    },
                    "customers": {
                        "consultation": len(consultation),
                        "testDrive": len(test_drive),
                        "contract": len(contract),
                    },
                    "transitions": {
                        "consultationToTestDrive": len(consultation & test_drive),
                        "testDriveToContract": len(test_drive & contract),
                        "contractToDelivered": len(contract & delivered_customers),
                    },
                    "deliveredSales": sum(monthly),
                    "deliveredCustomers": len(delivered_customers),
                    "monthlyDeliveredSales": monthly,
                }
            )

        unique_activity_staff = [
            row for row in staff_rows if row["activityStatus"] == "available"
        ]
        output_showrooms[cdsid] = {
            "salesDealerCode": dealer_code,
            "salesDealerCodeEvidence": sum(showroom_code_evidence[cdsid].values()),
            "staff": staff_rows,
            "summary": {
                "staffCount": len(staff_rows),
                "activityStaffCount": len(unique_activity_staff),
                "consultationCustomers": sum(
                    row["customers"]["consultation"] for row in unique_activity_staff
                ),
                "testDriveCustomers": sum(
                    row["customers"]["testDrive"] for row in unique_activity_staff
                ),
                "contractCustomers": sum(
                    row["customers"]["contract"] for row in unique_activity_staff
                ),
                "deliveredSales": sum(showroom_monthly),
                "monthlyDeliveredSales": showroom_monthly,
            },
        }

    output = {
        "source": {
            "activityAsOf": "2026-09-07",
            "activityPeriod": "2026-01-01~2026-09-07",
            "salesAsOf": "2026-09-10",
            "salesPeriod": "2026-01-01~2026-09-10",
            "privacy": "고객명은 연결 과정에서만 사용하고 결과에는 저장하지 않음",
            "activityJoin": "현재 직원명이 전국 재직자 명단에서 유일한 경우만 연결",
            "salesJoin": "직원명과 판매 전시장 코드로 연결",
        },
        "showrooms": output_showrooms,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
