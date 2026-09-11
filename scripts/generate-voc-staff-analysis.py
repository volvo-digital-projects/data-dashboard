from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

import openpyxl


STAFF_ROLES = {"영업직원", "영업팀장"}
YEARS = ("2023", "2024", "2025", "2026")

DMS_TO_VOC_SHOWROOM = {
    "AJU Autorium Anyang": "안양",
    "AJU Autorium Bucheon": "부천",
    "AJU Autorium Goyang": "고양",
    "AJU Autorium Ilsan": "일산",
    "AJU Autorium Mokdong": "목동",
    "Cheonha Auto Dongdaemun": "동대문",
    "Cheonha Auto Guri": "구리",
    "Cheonha Auto Uijeongbu": "의정부",
    "Cheonha Auto Yongsan": "용산",
    "H Motors Bundang Seohyeon": "분당",
    "H Motors Cheongju": "청주",
    "H Motors Daejeon": "대전",
    "H Motors Gangnam Daechi": "강남대치",
    "H Motors Gangnam Sinsa": "강남신사",
    "H Motors Incheon": "인천",
    "H Motors Suwon": "수원",
    "IVY Motors Gunsan": "군산",
    "IVY Motors Gwangju": "광주",
    "IVY Motors Jeju": "제주",
    "IVY Motors Suncheon": "순천",
    "IVY Motors Jeonju": "전주",
    "Iron Motors Changwon": "창원",
    "Iron Motors Gimhae": "김해",
    "Iron Motors Gwangan": "광안",
    "Iron Motors Haeundae": "해운대",
    "Iron Motors Jinju": "진주",
    "Iron Motors Ulsan": "울산",
    "Kolon Automotive Bundang Pangyo": "분당판교",
    "Kolon Automotive Cheonan": "천안",
    "Kolon Automotive Gangneung": "강릉",
    "Kolon Automotive Hanam": "하남",
    "Kolon Automotive Seosan": "서산",
    "Kolon Automotive Seocho": "서초",
    "Kolon Automotive Seosuwon": "서수원",
    "Kolon Automotive Songpa": "송파",
    "Kolon Automotive Wonju": "원주",
    "Taeyoung Motors Daegu": "대구",
    "Taeyoung Motors Pohang": "포항",
    "Taeyoung Motors Seodaegu": "서대구",
}

STRENGTH_PATTERNS = (
    ("친절·예의", (r"친절|친철|예의|정중|상냥|젠틀|밝은\s*미소",)),
    ("상세·꼼꼼한 설명", (r"상세|자세|꼼꼼|세심|디테일|하나하나|세세|충분한\s*설명",)),
    ("전문지식·정확성", (r"전문|해박|지식|정확|잘\s*알고|이해가\s*높",)),
    ("이해하기 쉬운 설명", (r"이해.{0,5}(쉽|잘)|쉽게|쉬운\s*용어|명확|간결",)),
    ("비교·장단점 안내", (r"비교|장단점|장점.{0,8}단점|타사|타\s*브랜드|타브랜드",)),
    ("적극·성실한 응대", (r"적극|성실|성심|열심|최선|먼저|질문.{0,8}(답|응)",)),
    ("니즈 맞춤 상담", (r"니즈|원하는\s*차|맞춤|상황에\s*맞|요구.{0,5}(반영|맞)",)),
    ("부담 없는 상담", (r"부담.{0,2}없|편안|강요.{0,2}없|자유롭게|충분한\s*시간",)),
    ("신속한 응답", (r"빠른|빠르게|신속|즉시|바로.{0,6}(답|해결|응)",)),
    ("신뢰·솔직한 상담", (r"신뢰|솔직|과장.{0,2}없이|믿음|설득력",)),
    ("구매결정 지원", (r"구매.{0,8}(도움|결정)|선택.{0,8}도움|계약.{0,6}(도움|진행)",)),
    ("시승·차량체험 지원", (r"시승|직접\s*시연|탑승|실차",)),
    ("지속적 후속관리", (r"지속적|대기\s*순번.{0,6}(공유|안내)|후속.{0,5}(관리|연락)|꾸준히\s*연락",)),
)

IMPROVEMENT_PATTERNS = (
    ("전문지식·정확성", (
        r"(전문|지식|정보|답변).{0,14}(부족|미흡|모르|틀|정확하지|확실하지|알기\s*어렵)",
        r"알고\s*계셨으면|답변.{0,8}(못|불가)|전문성이\s*다소\s*부족",
    )),
    ("설명 구체성·범위", (
        r"(설명|안내)(이|가|을|를)?\s*.{0,12}(부족|미흡|없었|해주지|듣지\s*못|아쉽|더\s*필요|자세했으면)",
        r"(구체적|자세한).{0,8}(설명|안내).{0,35}(원|필요|했으면|바라|알고\s*싶)",
        r"(좀\s*더|더).{0,10}(구체적|자세한).{0,35}(원|필요|했으면|바라|알고\s*싶)",
        r"궁금.{0,8}(남|해소되지)",
        r"(장점|강점|좋은\s*점).{0,10}(어필|설명).{0,10}(했으면|부족)",
    )),
    ("설명 간결성", (r"\btmi\b|너무\s*많은\s*이야기|설명.{0,10}(길|장황)|묻지\s*않",)),
    ("상담자료·도구 활용", (
        r"(브로셔|카탈로그|큰\s*모니터|모니터\s*화면|지면\s*종이|자료|태블릿).{0,45}(없|부족|불편|도움.{0,5}안|원|필요|아쉽)",
        r"(없|부족|원|필요).{0,30}(브로셔|카탈로그|모니터|자료|태블릿)",
    )),
    ("자율 관람·압박 완화", (
        r"계속.{0,8}(옆|지켜)|편하게.{0,8}(못|보지)|둘러볼\s*시간",
        r"부담(스러웠|스럽게|을\s*느|이\s*(됐|되|컸)|되)|강요|재촉|혼자.{0,8}(보|둘러)",
    )),
    ("전시·시승차 구성", (
        r"(전시(?:된|할|용)?\s*(?:차량|차|모델)|시승(?:용)?\s*(?:차량|차|모델)).{0,14}(적|없|부족|다양|원)",
        r"다양한\s*차종|다양한\s*전시|선택의\s*폭|외부에서\s*봤",
    )),
    ("대기·예약 운영", (
        r"대기.{0,8}(걸|길|오래)|기다.{0,8}(길|오래|불편)",
        r"예약.{0,10}(불필요|번거|강요|없어도|왜)",
    )),
    ("후속 연락·진행안내", (
        r"회신.{0,8}(늦|지연|없|안)|연락.{0,8}(늦|지연|없|안)",
        r"업데이트.{0,8}(늦|지연|없|안)|진행\s*상황.{0,10}(안내.{0,3}없|궁금)",
    )),
    ("가격·혜택 안내", (
        r"(가격|비용|견적|할인|혜택|프로모션).{0,12}(부담|높|비싸|부족|아쉽|명확하지)",
    )),
    ("시설·편의", (
        r"주차.{0,10}(불편|부족|좁|어렵)|서비스\s*센터.{0,12}(없|아쉽|부족)",
        r"(공간|시설|다과|화장실|접근성).{0,10}(불편|부족|좁|아쉽)|판매점만\s*남",
    )),
    ("응대 태도", (r"불친절|무성의|태도.{0,8}(아쉽|불만|별로)|응대.{0,8}(부족|미흡|아쉽)",)),
    ("제품·옵션·출고 안내", (
        r"(옵션|재고|출고|차량|모델).{0,12}(정보.{0,4}부족|안내.{0,4}부족|확실하지|알기\s*어렵)",
    )),
    ("시승 경험", (r"시승.{0,12}(짧|부족|못|불가|아쉽|원했)",)),
)

NEGATIVE_CONTEXT_PATTERN = re.compile(
    r"부족|미흡|아쉽|불편|불만|별로|늦|지연|오래|기다|못|어렵|문제|과도|"
    r"부담|원하|바라|했으면|좋겠|필요|tmi|강요|재촉|불친절|모르|없었|안\s*됐|되지\s*않",
    re.IGNORECASE,
)
NEGATIVE_CONTEXT_EXCEPTIONS = re.compile(
    r"불편한?\s*점.{0,4}없|불편.{0,3}없|문제.{0,3}없|부담스럽지\s*않|"
    r"부담.{0,3}없|강요.{0,3}없|강요하지\s*않|부족함?\s*없이|불친절하지|"
    r"불친절하다는.{0,15}그렇지\s*않|아쉽지\s*않",
    re.IGNORECASE,
)


def normalise_header(value: Any) -> str:
    return str(value or "").strip().replace("\n", "")


def normalise_showroom_name(value: Any) -> str:
    return str(value or "").strip().removeprefix("볼보 ").replace(" ", "")


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


def effective_job_title(role: Any, job_title: Any) -> str:
    """Use Sales-DMS authority when it identifies a sales team leader."""
    normalized_role = str(role or "").strip()
    normalized_title = str(job_title or "").strip()
    return "팀장" if normalized_role == "영업팀장" else normalized_title


def metric() -> dict[str, float | int]:
    return {"responses": 0, "scoreSum": 0}


def add_metric(target: dict[str, float | int], score: float) -> None:
    target["responses"] = int(target["responses"]) + 1
    target["scoreSum"] = round(float(target["scoreSum"]) + score, 1)


def normalise_comment_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def has_negative_context(text: str) -> bool:
    without_exceptions = NEGATIVE_CONTEXT_EXCEPTIONS.sub("", text)
    return bool(NEGATIVE_CONTEXT_PATTERN.search(without_exceptions))


def keyword_summary(
    entries: list[dict[str, Any]],
    patterns: tuple[tuple[str, tuple[str, ...]], ...],
    limit: int,
    *,
    exclude_negative_context: bool = False,
) -> list[dict[str, Any]]:
    counts: Counter[str] = Counter()
    for entry in entries:
        matched_labels: set[str] = set()
        for raw_text in entry["texts"]:
            text = normalise_comment_text(raw_text)
            if exclude_negative_context and has_negative_context(text):
                continue
            if not exclude_negative_context:
                text = NEGATIVE_CONTEXT_EXCEPTIONS.sub("", text)
            for label, expressions in patterns:
                if any(re.search(expression, text, re.IGNORECASE) for expression in expressions):
                    matched_labels.add(label)
        counts.update(matched_labels)
    return [
        {"label": label, "mentions": count}
        for label, count in counts.most_common(limit)
    ]


def load_roster(path: Path, as_of: date) -> list[dict[str, Any]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook[workbook.sheetnames[0]]
    headers = header_map(next(worksheet.iter_rows(min_row=3, max_row=3, values_only=True)))
    roster: list[dict[str, Any]] = []
    seen_rows: set[tuple[str, str, str, date]] = set()
    for row in worksheet.iter_rows(min_row=4, values_only=True):
        role = str(row[headers["직원권한"]] or "").strip()
        dms_showroom = str(row[headers["전시장명"]] or "").strip()
        name = str(row[headers["직원명"]] or "").strip()
        hire_value = row[headers["입사일자"]]
        departure_value = row[headers["퇴사일자"]]
        has_departed = departure_value is not None and str(departure_value).strip() != ""
        if (
            role not in STAFF_ROLES
            or dms_showroom == "Volvo Car Korea"
            or has_departed
            or not isinstance(hire_value, datetime)
        ):
            continue
        hire_date = hire_value.date()
        roster_key = (
            dms_showroom,
            role,
            name,
            hire_date,
        )
        if roster_key in seen_rows:
            continue
        seen_rows.add(roster_key)
        months = full_months(hire_date, as_of)
        bucket_id, bucket_label = tenure_bucket(months)
        roster.append(
            {
                "dmsShowroom": dms_showroom,
                "role": role,
                "jobTitle": effective_job_title(role, row[headers["직급"]]),
                "name": name,
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


def build_payload(
    voc_path: Path,
    roster_path: Path,
    showrooms_path: Path,
    as_of: date,
) -> dict[str, Any]:
    roster = load_roster(roster_path, as_of)
    national, staff_metrics, staff_comments = load_voc(voc_path)
    dashboard = json.loads(showrooms_path.read_text(encoding="utf-8"))
    dashboard_showrooms = dashboard["showrooms"]
    showroom_by_voc_name = {
        normalise_showroom_name(item["showroom"]): item
        for item in dashboard_showrooms
    }
    dms_showrooms = {str(item["dmsShowroom"]) for item in roster}
    voc_showrooms = {str(showroom) for showroom, _ in staff_metrics}
    dashboard_names = set(showroom_by_voc_name)
    mapped_dms = set(DMS_TO_VOC_SHOWROOM)
    mapped_voc = set(DMS_TO_VOC_SHOWROOM.values())
    mapped_dashboard_names = {normalise_showroom_name(name) for name in mapped_voc}
    validation_errors: list[str] = []
    if len(dashboard_showrooms) != 39:
        validation_errors.append(f"대시보드 전시장 {len(dashboard_showrooms)}개")
    if dms_showrooms != mapped_dms:
        validation_errors.append(
            f"DMS 매핑 불일치(누락={sorted(dms_showrooms - mapped_dms)}, 초과={sorted(mapped_dms - dms_showrooms)})"
        )
    if voc_showrooms != mapped_voc:
        validation_errors.append(
            f"VOC 매핑 불일치(누락={sorted(voc_showrooms - mapped_voc)}, 초과={sorted(mapped_voc - voc_showrooms)})"
        )
    if dashboard_names != mapped_dashboard_names:
        validation_errors.append(
            f"CDSID 매핑 불일치(누락={sorted(dashboard_names - mapped_dashboard_names)}, 초과={sorted(mapped_dashboard_names - dashboard_names)})"
        )
    if validation_errors:
        raise ValueError("; ".join(validation_errors))

    roster_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    duplicate_roster_keys: set[tuple[str, str]] = set()
    for person in roster:
        voc_showroom = DMS_TO_VOC_SHOWROOM[str(person["dmsShowroom"])]
        key = (voc_showroom, str(person["name"]))
        if key in roster_by_key:
            duplicate_roster_keys.add(key)
        roster_by_key[key] = person
    if duplicate_roster_keys:
        raise ValueError(f"DMS 전시장·이름 중복: {sorted(duplicate_roster_keys)}")

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
        person = roster_by_key.get((showroom, name))
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

    showrooms_payload: dict[str, Any] = {}
    for dms_showroom, voc_showroom in DMS_TO_VOC_SHOWROOM.items():
        dashboard_showroom = showroom_by_voc_name[normalise_showroom_name(voc_showroom)]
        target_roster = [
            item for item in roster if item["dmsShowroom"] == dms_showroom
        ]
        employees: list[dict[str, Any]] = []
        for person in target_roster:
            key = (voc_showroom, str(person["name"]))
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
                    "jobTitle": person["jobTitle"],
                    "hireDate": person["hireDate"],
                    "tenureMonths": person["tenureMonths"],
                    "tenureBucket": person["tenureBucket"],
                    "tenureBucketLabel": person["tenureBucketLabel"],
                    "years": years,
                    "commentResponses": len(comments),
                    "strengthKeywords": keyword_summary(
                        comments,
                        STRENGTH_PATTERNS,
                        6,
                        exclude_negative_context=True,
                    ),
                    "improvementKeywords": keyword_summary(
                        comments, IMPROVEMENT_PATTERNS, 6
                    ),
                }
            )
        employees.sort(
            key=lambda item: (item["role"] != "영업직원", item["name"])
        )

        target_name_set = {str(item["name"]) for item in target_roster}
        excluded_counts: Counter[str] = Counter()
        for (raw_showroom, name), by_year in staff_metrics.items():
            if raw_showroom != voc_showroom or name in target_name_set:
                continue
            excluded_counts[name] += sum(
                int(values["responses"]) for values in by_year.values()
            )

        showrooms_payload[str(dashboard_showroom["cdsid"])] = {
            "showroom": dashboard_showroom["showroom"],
            "dealer": dashboard_showroom["dealer"],
            "dmsShowroom": dms_showroom,
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

    return {
        "source": {
            "workbook": voc_path.name,
            "vocThrough": "2026-08-24",
            "rosterCheckedAt": as_of.isoformat(),
            "rosterSource": "Volvo Car Korea Sales DMS",
            "rosterRule": "퇴사일자 공란 재직자 · 39개 전시장 · 영업직원/영업팀장 · 직원권한 우선",
            "rosterUpdateSchedule": "매일 06:00 KST · 1일 1회",
            "historyRange": "2023-2026 YTD",
        },
        "nationalYears": national_years,
        "tenureCohorts": tenure_cohorts,
        "showrooms": showrooms_payload,
    }


def refresh_comment_analysis(payload: dict[str, Any], voc_path: Path) -> None:
    _, _, staff_comments = load_voc(voc_path)
    refreshed_employees = 0
    for showroom in payload.get("showrooms", {}).values():
        voc_showroom = normalise_showroom_name(showroom.get("showroom"))
        for employee in showroom.get("employees", []):
            comments = staff_comments.get((voc_showroom, str(employee.get("name", ""))), [])
            employee["commentResponses"] = len(comments)
            employee["strengthKeywords"] = keyword_summary(
                comments,
                STRENGTH_PATTERNS,
                6,
                exclude_negative_context=True,
            )
            employee["improvementKeywords"] = keyword_summary(
                comments,
                IMPROVEMENT_PATTERNS,
                6,
            )
            refreshed_employees += 1
    payload.setdefault("source", {})["commentAnalysis"] = (
        "2023-2026 YTD 원문 문장별 긍정·부정 맥락 분리 · 13개 강점/13개 보완 주제"
    )
    payload["source"]["commentAnalysisEmployees"] = refreshed_employees


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voc", required=True, type=Path)
    parser.add_argument("--roster", type=Path)
    parser.add_argument("--showrooms", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--as-of", default=date.today().isoformat())
    parser.add_argument("--comments-only", action="store_true")
    args = parser.parse_args()
    if args.comments_only:
        if not args.output.exists():
            parser.error("--comments-only requires an existing --output payload")
        payload = json.loads(args.output.read_text(encoding="utf-8"))
        refresh_comment_analysis(payload, args.voc)
        args.output.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return
    if args.roster is None or args.showrooms is None:
        parser.error("--roster and --showrooms are required unless --comments-only is used")
    previous_payload: dict[str, Any] = {}
    if args.output.exists():
        previous_payload = json.loads(args.output.read_text(encoding="utf-8"))
    payload = build_payload(
        args.voc,
        args.roster,
        args.showrooms,
        date.fromisoformat(args.as_of),
    )
    previous_showrooms = previous_payload.get("showrooms", {})
    for cdsid, showroom in payload["showrooms"].items():
        previous_showroom = previous_showrooms.get(cdsid, {})
        showroom["formerEmployees"] = previous_showroom.get("formerEmployees", [])
    for key in (
        "jobTitleSourceWorkbook",
        "jobTitleSourceSheet",
        "jobTitleSourceDate",
    ):
        if key in previous_payload.get("source", {}):
            payload["source"][key] = previous_payload["source"][key]
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
