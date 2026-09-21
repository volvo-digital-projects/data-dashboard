"""Download Sales-DMS Actual Monthly Sales and refresh privacy-safe staff totals."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from collections import defaultdict
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
ROSTER_PATH = ROOT / "app" / "data" / "voc-staff-analysis.json"
OUTPUT_PATH = ROOT / "app" / "data" / "sales-activity-analysis.json"
LOGIN_URL = (
    os.environ.get("VOLVO_SALES_URL")
    or "https://sales.volvocars.kr/login/login.asp"
).strip()
TARGET_ROLES = {"영업직원", "영업팀장"}
MINIMUM_REPORT_ROWS = 5_000
MINIMUM_MATCHED_SALES = 1_000


class SpreadsheetHtmlParser(HTMLParser):
    """Read the HTML-table .xls format exported by the legacy DMS."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "tr":
            self._row = []
        elif tag.lower() in {"th", "td"} and self._row is not None:
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        normalized = tag.lower()
        if normalized in {"th", "td"} and self._row is not None and self._cell is not None:
            self._row.append(text("".join(self._cell)))
            self._cell = None
        elif normalized == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None


def text(value: Any) -> str:
    return " ".join(str(value or "").split())


def parse_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    normalized = text(value).replace(".", "-").replace("/", "-")[:10]
    try:
        return date.fromisoformat(normalized)
    except ValueError:
        return None


def visible(locator: Any) -> bool:
    try:
        return locator.is_visible()
    except Exception:
        return False


def click_visible_text(page: Any, label: str) -> None:
    # Sales-DMS decorates some menu labels with counters/arrows, so match the
    # stable label text instead of requiring the entire rendered string.
    pattern = re.compile(re.escape(label), re.IGNORECASE)
    for candidate_page in reversed(page.context.pages):
        for frame in candidate_page.frames:
            matches = frame.get_by_text(pattern)
            for index in range(matches.count()):
                match = matches.nth(index)
                if visible(match):
                    # Legacy menu links schedule frame navigations that can
                    # keep Playwright's implicit navigation wait open even
                    # after the click succeeded. The next step explicitly
                    # discovers and waits for the destination report frame.
                    match.click(timeout=20_000, no_wait_after=True)
                    candidate_page.wait_for_timeout(700)
                    return
    raise RuntimeError(f"Sales-DMS 메뉴를 찾지 못했습니다: {label}")


def sales_report_frame(page: Any) -> tuple[Any, Any] | None:
    for candidate_page in reversed(page.context.pages):
        for frame in candidate_page.frames:
            try:
                body = frame.locator("body").inner_text(timeout=3_000)
            except Exception:
                continue
            # The report title/menu and the query form are rendered in
            # different legacy frames. Identify the actionable Area Total
            # frame by its unique query controls; the downloaded workbook is
            # validated independently before any dashboard data is written.
            if "출고기간" in body and len(date_inputs(frame)) >= 2:
                # The two controls are legacy input elements whose values do
                # not appear in body.innerText.
                try:
                    visible_control(frame, "검색")
                    visible_control(frame, "다운로드")
                except RuntimeError:
                    continue
                return candidate_page, frame
    return None


def wait_for_sales_report(page: Any, timeout_ms: int = 45_000) -> tuple[Any, Any]:
    deadline = datetime.now().timestamp() + timeout_ms / 1_000
    while datetime.now().timestamp() < deadline:
        if found := sales_report_frame(page):
            return found
        page.wait_for_timeout(500)
    raise RuntimeError("Actual Monthly Sales - Area Total 화면을 찾지 못했습니다.")


def login(page: Any, user_id: str, password: str) -> None:
    page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=60_000)
    boxes = page.get_by_role("textbox")
    if boxes.count() != 2:
        raise RuntimeError("Sales-DMS 로그인 입력창 구조가 변경되었습니다.")
    boxes.nth(0).fill(user_id)
    boxes.nth(1).fill(password)
    page.get_by_role("button", name="Login", exact=True).click()
    page.wait_for_load_state("domcontentloaded", timeout=60_000)
    page.wait_for_timeout(3_000)
    if "/login/" in page.url.lower():
        raise RuntimeError("Sales-DMS 로그인에 실패했습니다. GitHub Secret을 확인해 주세요.")


def open_sales_report(page: Any) -> tuple[Any, Any]:
    if found := sales_report_frame(page):
        return found
    for label in (
        "Report Management",
        "리포트관리",
        "Actual Monthly Sales",
        "Area Total",
    ):
        print(f"Sales-DMS 메뉴 여는 중: {label}", flush=True)
        click_visible_text(page, label)
        if found := sales_report_frame(page):
            return found
    return wait_for_sales_report(page)


def date_inputs(frame: Any) -> list[Any]:
    result: list[Any] = []
    inputs = frame.locator("input:not([type='hidden'])")
    for index in range(inputs.count()):
        candidate = inputs.nth(index)
        if not visible(candidate):
            continue
        try:
            value = candidate.input_value()
        except Exception:
            continue
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            result.append(candidate)
    return result


def visible_control(frame: Any, label: str) -> Any:
    matches = frame.get_by_role("button", name=label, exact=True)
    for index in range(matches.count()):
        candidate = matches.nth(index)
        if visible(candidate):
            return candidate
    inputs = frame.locator(f"input[value='{label}']")
    for index in range(inputs.count()):
        candidate = inputs.nth(index)
        if visible(candidate):
            return candidate
    raise RuntimeError(f"Sales-DMS {label} 버튼을 찾지 못했습니다.")


def download_sales_report(user_id: str, password: str, as_of: date, destination: Path) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(accept_downloads=True)
        page.on("dialog", lambda dialog: dialog.accept())
        try:
            login(page, user_id, password)
            report_page, frame = open_sales_report(page)
            inputs = date_inputs(frame)
            if len(inputs) < 2:
                raise RuntimeError("Sales-DMS 출고기간 시작일·종료일 입력창을 찾지 못했습니다.")
            inputs[0].fill(f"{as_of.year}-01-01")
            inputs[1].fill(as_of.isoformat())
            visible_control(frame, "검색").click(timeout=20_000)
            report_page.wait_for_timeout(2_000)
            report_page, frame = wait_for_sales_report(page, timeout_ms=120_000)
            with report_page.expect_download(timeout=900_000) as download_info:
                visible_control(frame, "다운로드").click(timeout=20_000)
            download = download_info.value
            download.save_as(destination)
            signature = destination.read_bytes()[:8].hex()
            print(
                "Sales-DMS 다운로드 완료: "
                f"파일명={download.suggested_filename!r}, "
                f"크기={destination.stat().st_size}바이트, 형식={signature}",
                flush=True,
            )
        finally:
            browser.close()


def header_map(values: tuple[Any, ...]) -> dict[str, int]:
    return {
        text(value).replace("\n", ""): index
        for index, value in enumerate(values)
        if text(value)
    }


def load_sales_rows(report_path: Path) -> tuple[dict[str, int], list[list[Any]]]:
    signature = report_path.read_bytes()[:8]
    if signature.startswith(b"PK"):
        workbook = openpyxl.load_workbook(report_path, read_only=True, data_only=True)
        worksheet = workbook.active
        rows = [list(row) for row in worksheet.iter_rows(values_only=True)]
        workbook.close()
    else:
        payload = report_path.read_bytes()
        decoded: str | None = None
        for encoding in ("utf-8-sig", "cp949", "euc-kr"):
            try:
                decoded = payload.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        if decoded is None:
            raise RuntimeError("Sales-DMS 다운로드의 문자 인코딩을 확인할 수 없습니다.")
        parser = SpreadsheetHtmlParser()
        parser.feed(decoded)
        rows = parser.rows

    required = {"Delivery Date", "출고여부", "Dealer", "고객명", "영업직원"}
    for index, values in enumerate(rows):
        headers = header_map(tuple(values))
        if required <= set(headers):
            return headers, rows[index + 1 :]
    raise RuntimeError(f"Actual Monthly Sales 필수 열이 없습니다: {sorted(required)}")


def default_activity(name: str) -> dict[str, Any]:
    return {
        "name": name,
        "activityStatus": "missing",
        "lastActivityDate": None,
        "activityEvents": {"consultation": 0, "testDrive": 0, "contract": 0},
        "customers": {"consultation": 0, "testDrive": 0, "contract": 0},
        "transitions": {
            "consultationToTestDrive": 0,
            "testDriveToContract": 0,
            "contractToDelivered": 0,
        },
    }


def update_sales(report_path: Path, output_path: Path, as_of: date) -> dict[str, int]:
    roster_payload = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))
    output = json.loads(output_path.read_text(encoding="utf-8"))
    roster = {
        cdsid: [
            employee["name"]
            for employee in showroom["employees"]
            if employee["role"] in TARGET_ROLES
        ]
        for cdsid, showroom in roster_payload["showrooms"].items()
    }
    if set(roster) != set(output["showrooms"]):
        raise RuntimeError("Sales-DMS 재직 명단과 판매 집계의 39개 전시장 키가 다릅니다.")

    showroom_code_by_cdsid = {
        cdsid: text(output["showrooms"][cdsid].get("salesDealerCode"))
        for cdsid in roster
    }
    codes = list(showroom_code_by_cdsid.values())
    if any(not code for code in codes) or len(codes) != len(set(codes)):
        raise RuntimeError("39개 전시장 Sales-DMS Dealer 코드가 비어 있거나 중복됩니다.")

    month_count = as_of.month
    monthly_by_staff: dict[tuple[str, str], list[int]] = defaultdict(
        lambda: [0] * month_count
    )
    customers_by_staff: dict[tuple[str, str], set[str]] = defaultdict(set)
    headers, report_rows = load_sales_rows(report_path)
    raw_rows = len(report_rows)
    eligible_sales = 0
    report_codes: set[str] = set()
    last_required_index = max(
        headers[label]
        for label in ("Delivery Date", "출고여부", "Dealer", "고객명", "영업직원")
    )
    for values in report_rows:
        if len(values) <= last_required_index:
            continue
        delivery_date = parse_date(values[headers["Delivery Date"]])
        shipped = text(values[headers["출고여부"]])
        dealer_code = text(values[headers["Dealer"]])
        staff_name = text(values[headers["영업직원"]])
        if (
            delivery_date is None
            or delivery_date < date(as_of.year, 1, 1)
            or delivery_date > as_of
            or shipped != "출고"
            or not dealer_code
            or not staff_name
        ):
            continue
        eligible_sales += 1
        report_codes.add(dealer_code)
        key = (dealer_code, staff_name)
        monthly_by_staff[key][delivery_date.month - 1] += 1
        customer = text(values[headers["고객명"]]).casefold()
        if customer:
            customers_by_staff[key].add(customer)
    if raw_rows < MINIMUM_REPORT_ROWS or eligible_sales < MINIMUM_REPORT_ROWS // 2:
        raise RuntimeError(
            f"판매 원본이 비정상적으로 적어 중단했습니다: 원본 {raw_rows}행, 출고 {eligible_sales}건"
        )
    missing_codes = set(codes) - report_codes
    if missing_codes:
        raise RuntimeError(f"판매 원본에 현재 전시장 코드 {len(missing_codes)}개가 없습니다.")

    previous_total = sum(
        int(showroom["summary"].get("deliveredSales", 0))
        for showroom in output["showrooms"].values()
    )
    matched_total = 0
    for cdsid, names in roster.items():
        if len(names) != len(set(names)):
            raise RuntimeError(f"전시장 내부 직원명이 중복됩니다: {cdsid}")
        showroom = output["showrooms"][cdsid]
        dealer_code = showroom_code_by_cdsid[cdsid]
        previous_staff = {row["name"]: row for row in showroom.get("staff", [])}
        next_staff: list[dict[str, Any]] = []
        showroom_monthly = [0] * month_count
        for name in names:
            row = {
                key: value
                for key, value in previous_staff.get(name, default_activity(name)).items()
                if key not in {"deliveredSales", "deliveredCustomers", "monthlyDeliveredSales"}
            }
            monthly = monthly_by_staff[(dealer_code, name)]
            delivered_sales = sum(monthly)
            matched_total += delivered_sales
            showroom_monthly = [
                total + value for total, value in zip(showroom_monthly, monthly)
            ]
            row.update(
                {
                    "deliveredSales": delivered_sales,
                    "deliveredCustomers": len(customers_by_staff[(dealer_code, name)]),
                    "monthlyDeliveredSales": monthly,
                }
            )
            next_staff.append(row)
        showroom["staff"] = next_staff
        showroom["summary"].update(
            {
                "staffCount": len(next_staff),
                "activityStaffCount": sum(
                    row["activityStatus"] == "available" for row in next_staff
                ),
                "deliveredSales": sum(showroom_monthly),
                "monthlyDeliveredSales": showroom_monthly,
            }
        )

    if matched_total < MINIMUM_MATCHED_SALES:
        raise RuntimeError(f"현재 재직자 연결 판매가 비정상적으로 적습니다: {matched_total}대")
    previous_as_of = parse_date(output["source"].get("salesAsOf"))
    if previous_as_of and as_of >= previous_as_of and matched_total < previous_total * 0.85:
        raise RuntimeError(
            f"누적 판매가 15% 이상 감소해 중단했습니다: 기존 {previous_total}대, 신규 {matched_total}대"
        )

    output["source"].update(
        {
            "salesAsOf": as_of.isoformat(),
            "salesSyncedAt": datetime.now(ZoneInfo("Asia/Seoul")).isoformat(
                timespec="seconds"
            ),
            "salesPeriod": f"{as_of.year}-01-01~{as_of.isoformat()}",
            "privacy": "고객명은 연결 과정에서만 사용하고 결과에는 저장하지 않음",
            "salesJoin": "현재 Sales-DMS 재직자의 직원명과 판매 전시장 코드를 함께 연결",
            "salesUpdateSchedule": "유튜브 지표 갱신과 함께 매시간",
        }
    )
    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {
        "reportRows": raw_rows,
        "eligibleSales": eligible_sales,
        "matchedSales": matched_total,
        "staff": sum(len(names) for names in roster.values()),
        "showrooms": len(roster),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sales-report", type=Path)
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument(
        "--as-of",
        default=datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat(),
    )
    args = parser.parse_args()
    as_of = date.fromisoformat(args.as_of)
    if args.sales_report:
        summary = update_sales(args.sales_report, args.output, as_of)
    else:
        user_id = os.environ.get("VOLVO_SALES_ID", "").strip()
        password = os.environ.get("VOLVO_SALES_PASSWORD", "").strip()
        if not user_id or not password:
            raise RuntimeError("VOLVO_SALES_ID와 VOLVO_SALES_PASSWORD Secret이 필요합니다.")
        with tempfile.TemporaryDirectory(prefix="sales-dms-") as temporary:
            report_path = Path(temporary) / f"actual-monthly-sales-{as_of.isoformat()}.xlsx"
            download_sales_report(user_id, password, as_of, report_path)
            summary = update_sales(report_path, args.output, as_of)
    print(
        "Sales-DMS 판매 동기화 완료: "
        f"원본 {summary['reportRows']}행, 출고 {summary['eligibleSales']}건, "
        f"현재 재직자 {summary['staff']}명·{summary['showrooms']}개 전시장에 "
        f"{summary['matchedSales']}대 연결"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Sales-DMS 판매 동기화 실패: {error}", file=sys.stderr)
        raise SystemExit(1)
