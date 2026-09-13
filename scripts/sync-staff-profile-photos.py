"""Sync public consultant portraits from the seven official Volvo dealer sites.

Only the public employee name, showroom, dealer and portrait are retained. Phone
numbers, email addresses, employee IDs and CDSIDs from the source pages are not
collected. Dashboard CDSIDs below are fixed routing keys from showrooms.json.
"""

from __future__ import annotations

import hashlib
import html
import io
import json
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import cv2
import numpy as np
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_JSON = ROOT / "app" / "data" / "staff-profile-photos.json"
PUBLIC_ROOT = ROOT / "public"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VolvoDataDashboard/1.0"
PORTRAIT_SIZE = (420, 440)
PORTRAIT_FACE_WIDTH_RATIO = 0.38
PORTRAIT_FACE_CENTER_Y_RATIO = 0.36
PORTRAIT_SAFE_MARGIN = 16
FACE_CLASSIFIER = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

SOURCES = [
    {
        "host": "https://kolon.volvocars.co.kr",
        "dealer": "코오롱오토모티브",
        "directory": "kolon",
        "branches": [
            ("6KR6847", "100001", "송파", "songpa"),
            ("6KR6852", "100004", "서초", "seocho"),
            ("6KR6848", "100002", "천안", "cheonan"),
            ("6KR6851", "100003", "원주", "wonju"),
            ("6KR6868", "100009", "강릉", "gangneung"),
            ("6KR6869", "100010", "서산", "seosan"),
            ("6KR6858", "100006", "분당 판교", "bundang-pangyo"),
            ("6KR6861", "100008", "하남", "hanam"),
            ("6KR6870", "100011", "서수원", "seosuwon"),
        ],
    },
    {
        "host": "https://aju.volvocars.co.kr",
        "dealer": "아주오토리움",
        "directory": "aju",
        "branches": [
            ("6KR6845", "100001", "일산", "ilsan"),
            ("6KR6867", "100005", "고양", "goyang"),
            ("6KR6846", "100002", "목동", "mokdong"),
            ("6KR6849", "100003", "안양", "anyang"),
            ("6KR6862", "100004", "부천", "bucheon"),
        ],
    },
    {
        "host": "https://iron.volvocars.co.kr",
        "dealer": "아이언모터스",
        "directory": "iron",
        "branches": [
            ("6KR6842", "100002", "해운대", "haeundae"),
            ("6KR6838", "100001", "창원", "changwon"),
            ("6KR6850", "100003", "광안", "gwangan"),
            ("6KR6863", "100004", "김해", "gimhae"),
            ("6KR6871", "100006", "진주", "jinju"),
            ("6KR6874", "100007", "울산", "ulsan"),
        ],
    },
    {
        "host": "https://ivy.volvocars.co.kr",
        "dealer": "아이비모터스",
        "directory": "ivy",
        "branches": [
            ("6KR6828", "100001", "광주", "gwangju"),
            ("6KR6840", "100002", "전주", "jeonju"),
            ("6KR6856", "100003", "순천", "suncheon"),
            ("6KR6859", "100004", "제주", "jeju"),
            ("6KR6873", "100005", "군산", "gunsan"),
        ],
    },
    {
        "host": "https://ch.volvocars.co.kr",
        "dealer": "천하자동차",
        "directory": "cheonha",
        "branches": [
            ("6KR6841", "100002", "동대문", "dongdaemun"),
            ("6KR6857", "100003", "의정부", "uijeongbu"),
            ("6KR6864", "100004", "구리", "guri"),
            ("6KR6839", "100005", "용산", "yongsan"),
        ],
    },
    {
        "host": "https://ty.volvocars.co.kr",
        "dealer": "태영모터스",
        "directory": "taeyoung",
        "branches": [
            ("6KR6829", "100001", "대구", "daegu"),
            ("6KR6865", "100004", "서대구", "seodaegu"),
            ("6KR6854", "100003", "포항", "pohang"),
        ],
    },
    {
        "host": "https://h.volvocars.co.kr",
        "dealer": "에이치모터스",
        "directory": "h-motors",
        "branches": [
            ("6KR342", "100002", "강남 신사", "gangnam-sinsa"),
            ("6KR6834", "100001", "강남대치", "gangnam-daechi"),
            ("6KR6830", "100004", "분당", "bundang"),
            ("6KR6802", "100005", "수원", "suwon"),
            ("6KR6836", "100003", "인천", "incheon"),
            ("6KR6833", "100006", "대전", "daejeon"),
            ("6KR6872", "100008", "청주", "cheongju"),
        ],
    },
]

PAIR_RE = re.compile(
    r'<div\s+class=["\']img_group["\'][^>]*>.*?'
    r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>.*?'
    r'<p\s+class=["\']name["\'][^>]*>\s*<strong>(.*?)</strong>',
    re.IGNORECASE | re.DOTALL,
)
TAG_RE = re.compile(r"<[^>]+>")


def fetch_bytes(url: str, referer: str | None = None, attempts: int = 4) -> bytes:
    parts = urlsplit(url)
    url = urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            quote(parts.path, safe="/%:$"),
            quote(parts.query, safe="=&%"),
            parts.fragment,
        )
    )
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if referer:
        headers["Referer"] = referer
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if curl:
        command = [
            curl,
            "--location",
            "--fail",
            "--silent",
            "--show-error",
            "--max-time",
            "35",
            "--retry",
            "3",
            "--retry-delay",
            "1",
            "--retry-all-errors",
            "--user-agent",
            USER_AGENT,
        ]
        if referer:
            command.extend(["--referer", referer])
        command.append(url)
        result = subprocess.run(command, capture_output=True, check=False)
        if result.returncode == 0:
            return result.stdout
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace").strip())
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = Request(url, headers=headers)
            with urlopen(request, timeout=45) as response:
                return response.read()
        except Exception as error:
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(1.5 * (attempt + 1))
    assert last_error is not None
    raise last_error


def decode_text(value: str) -> str:
    value = TAG_RE.sub("", value)
    return " ".join(html.unescape(value).replace("\xa0", " ").split())


def consultant_name(raw_name: str) -> str:
    text = decode_text(raw_name)
    text = re.sub(r"^.*?전시장\s*", "", text)
    # Official dealer pages occasionally insert a visual space inside a
    # Korean name (for example, "김 승"). DMS uses the canonical no-space name.
    return text.replace(" ", "").strip()


def existing_profile(cdsid: str, name: str) -> dict[str, str]:
    old_data = {}
    if OUTPUT_JSON.exists():
        old_data = json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))
    employees = (
        old_data.get("showrooms", {}).get(cdsid, {}).get("employees", {})
    )
    for old_name, profile in employees.items():
        if old_name.replace(" ", "") == name.replace(" ", ""):
            return dict(profile)
    return {}


def portrait_path(cdsid: str, dealer_dir: str, showroom_dir: str, name: str) -> Path:
    old_image = existing_profile(cdsid, name).get("image")
    if old_image:
        return PUBLIC_ROOT / old_image.lstrip("/")
    digest = hashlib.sha1(f"{cdsid}:{name}".encode("utf-8")).hexdigest()[:12]
    return PUBLIC_ROOT / "staff-profiles" / dealer_dir / showroom_dir / f"consultant-{digest}.jpg"


def normalized_portrait(image: Image.Image) -> Image.Image | None:
    source = np.asarray(image.convert("RGB"))
    gray = cv2.cvtColor(source, cv2.COLOR_RGB2GRAY)
    min_face = (max(18, image.width // 12), max(18, image.height // 12))
    faces = FACE_CLASSIFIER.detectMultiScale(
        gray,
        scaleFactor=1.08,
        minNeighbors=5,
        minSize=min_face,
    )
    if len(faces) == 0:
        return None

    face_x, face_y, face_width, face_height = max(
        faces,
        key=lambda box: int(box[2]) * int(box[3]),
    )
    face_center_x = face_x + face_width / 2
    face_center_y = face_y + face_height / 2
    target_width, target_height = PORTRAIT_SIZE
    target_face_width = target_width * PORTRAIT_FACE_WIDTH_RATIO
    face_scale = target_face_width / face_width

    # The dealer portraits have generous, inconsistent background margins. Keep
    # the person's head and both shoulders, but allow unused background and the
    # lower torso to leave the frame so faces can be shown at a consistent size.
    lab = cv2.cvtColor(source, cv2.COLOR_RGB2LAB).astype(np.int16)
    border = np.concatenate(
        (lab[:4].reshape(-1, 3), lab[-4:].reshape(-1, 3),
         lab[:, :4].reshape(-1, 3), lab[:, -4:].reshape(-1, 3))
    )
    background = np.median(border, axis=0)
    foreground = np.linalg.norm(lab - background, axis=2) > 14
    foreground = cv2.morphologyEx(
        foreground.astype(np.uint8),
        cv2.MORPH_CLOSE,
        np.ones((7, 7), np.uint8),
    ).astype(bool)

    protected_top_fallback = max(0, face_y - face_height * 0.8)
    protected_bottom = min(image.height, face_y + face_height * 2.45)
    band_top = max(0, round(protected_top_fallback))
    band_bottom = max(band_top + 1, round(protected_bottom))
    band_y, band_x = np.nonzero(foreground[band_top:band_bottom])
    band_y = band_y + band_top
    near_person = (
        (band_x >= face_center_x - face_width * 1.7)
        & (band_x <= face_center_x + face_width * 1.7)
    )
    band_x = band_x[near_person]
    band_y = band_y[near_person]

    if band_x.size >= 50:
        protected_left = min(face_x, float(np.quantile(band_x, 0.005)))
        protected_right = max(
            face_x + face_width,
            float(np.quantile(band_x, 0.995) + 1),
        )
        head_pixels = band_y[
            (band_x >= face_center_x - face_width * 1.15)
            & (band_x <= face_center_x + face_width * 1.15)
            & (band_y <= face_y + face_height * 0.35)
        ]
        protected_top = (
            float(np.quantile(head_pixels, 0.01))
            if head_pixels.size >= 10
            else protected_top_fallback
        )
    else:
        protected_left = max(0, face_center_x - face_width * 1.65)
        protected_right = min(image.width, face_center_x + face_width * 1.65)
        protected_top = protected_top_fallback

    protected_left = max(0, protected_left - face_width * 0.12)
    protected_right = min(image.width, protected_right + face_width * 0.12)
    protected_top = max(0, protected_top - face_height * 0.12)
    protected_bottom = min(image.height, protected_bottom)
    protected_width = max(1, protected_right - protected_left)
    protected_height = max(1, protected_bottom - protected_top)
    protected_scale = min(
        (target_width - PORTRAIT_SAFE_MARGIN * 2) / protected_width,
        (target_height - PORTRAIT_SAFE_MARGIN * 2) / protected_height,
    )
    scale = min(face_scale, protected_scale)
    resized_width = max(1, round(image.width * scale))
    resized_height = max(1, round(image.height * scale))
    resized = image.resize((resized_width, resized_height), Image.Resampling.LANCZOS)

    desired_left = round(target_width / 2 - face_center_x * scale)
    desired_top = round(
        target_height * PORTRAIT_FACE_CENTER_Y_RATIO - face_center_y * scale
    )
    left = round(max(
        PORTRAIT_SAFE_MARGIN - protected_left * scale,
        min(
            target_width - PORTRAIT_SAFE_MARGIN - protected_right * scale,
            desired_left,
        ),
    ))
    top = round(max(
        PORTRAIT_SAFE_MARGIN - protected_top * scale,
        min(
            target_height - PORTRAIT_SAFE_MARGIN - protected_bottom * scale,
            desired_top,
        ),
    ))
    canvas = Image.new("RGB", PORTRAIT_SIZE, (245, 248, 250))
    canvas.paste(resized, (left, top))
    return canvas


def save_portrait(content: bytes, destination: Path) -> bool:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(io.BytesIO(content)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((720, 960), Image.Resampling.LANCZOS)
        normalized = normalized_portrait(image)
        if normalized is None:
            return False
        normalized.save(destination, "JPEG", quality=88, optimize=True, progressive=True)
    return True


def normalize_portrait_file(portrait: Path) -> bool:
    with Image.open(portrait) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
    if image.size == PORTRAIT_SIZE:
        return True
    normalized = normalized_portrait(image)
    if normalized is None:
        return False
    normalized.save(portrait, "JPEG", quality=88, optimize=True, progressive=True)
    return True


def normalize_existing_portraits() -> int:
    normalized_count = 0
    skipped_count = 0
    for portrait in sorted((PUBLIC_ROOT / "staff-profiles").rglob("*.jpg")):
        with Image.open(portrait) as source:
            current_size = source.size
        if current_size == PORTRAIT_SIZE:
            continue
        if not normalize_portrait_file(portrait):
            skipped_count += 1
            print(f"얼굴 미검출, 기본 실루엣 적용 대상: {portrait.relative_to(ROOT)}")
            continue
        normalized_count += 1

    for silhouette_name in (
        "neutral-human-silhouette.png",
        "female-human-silhouette.png",
    ):
        silhouette_path = PUBLIC_ROOT / "staff-profiles" / silhouette_name
        with Image.open(silhouette_path) as source:
            silhouette = source.convert("RGBA")
        if silhouette.size == PORTRAIT_SIZE:
            continue
        crop_width = silhouette.width * 0.655
        crop_height = crop_width / (PORTRAIT_SIZE[0] / PORTRAIT_SIZE[1])
        crop_left = (silhouette.width - crop_width) / 2
        crop_top = min(30, silhouette.height - crop_height)
        normalized_silhouette = silhouette.crop(
            (
                round(crop_left),
                round(crop_top),
                round(crop_left + crop_width),
                round(crop_top + crop_height),
            )
        ).resize(PORTRAIT_SIZE, Image.Resampling.LANCZOS)
        normalized_silhouette.save(silhouette_path, "PNG", optimize=True)

    print(f"기존 프로필 정규화: {normalized_count}개, 얼굴 미검출: {skipped_count}개")
    return 0


def dashboard_showrooms() -> set[str]:
    data = json.loads((ROOT / "app" / "data" / "showrooms.json").read_text(encoding="utf-8"))
    return {item["cdsid"] for item in data["showrooms"]}


def main() -> int:
    refresh_portraits = "--refresh-portraits" in sys.argv
    expected_cdsids = dashboard_showrooms()
    configured_cdsids = {
        branch[0] for source in SOURCES for branch in source["branches"]
    }
    if configured_cdsids != expected_cdsids:
        missing = sorted(expected_cdsids - configured_cdsids)
        extra = sorted(configured_cdsids - expected_cdsids)
        raise RuntimeError(f"39개 전시장 설정 불일치: missing={missing}, extra={extra}")

    showrooms: dict[str, dict] = {}
    total_consultants = 0

    for source in SOURCES:
        for cdsid, branch_cd, showroom, showroom_dir in source["branches"]:
            page_url = f'{source["host"]}/sales/sales_consultant.asp?branchCd={branch_cd}'
            page_html = fetch_bytes(page_url).decode("utf-8", errors="replace")
            matches = PAIR_RE.findall(page_html)
            if not matches:
                raise RuntimeError(f"공식 프로필을 찾지 못했습니다: {showroom} ({page_url})")

            employees: dict[str, dict[str, str]] = {}
            for image_src, raw_name in matches:
                name = consultant_name(raw_name)
                if not name or name in employees:
                    raise RuntimeError(f"직원명 누락 또는 중복: {showroom} / {name!r}")
                image_url = urljoin(page_url, html.unescape(image_src))
                local_file = portrait_path(
                    cdsid,
                    source["directory"],
                    showroom_dir,
                    name,
                )
                portrait_available = False
                if (
                    not refresh_portraits
                    and local_file.exists()
                    and local_file.stat().st_size > 0
                ):
                    portrait_available = normalize_portrait_file(local_file)
                else:
                    portrait_available = save_portrait(
                        fetch_bytes(image_url, page_url),
                        local_file,
                    )
                if not portrait_available:
                    continue
                employees[name] = {
                    **existing_profile(cdsid, name),
                    "image": "/" + local_file.relative_to(PUBLIC_ROOT).as_posix(),
                }

            showrooms[cdsid] = {
                "dealer": source["dealer"],
                "showroom": showroom,
                "sourcePage": page_url,
                "employees": dict(sorted(employees.items())),
            }
            total_consultants += len(employees)
            print(f"{cdsid} {showroom}: {len(employees)}명")

    output = {
        "updatedAt": datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat(),
        "sourcePolicy": "7개 공식 딜러사 세일즈 컨설턴트 페이지의 전시장·이름 정확 일치",
        "showroomCount": len(showrooms),
        "consultantCount": total_consultants,
        "showrooms": dict(sorted(showrooms.items())),
    }
    OUTPUT_JSON.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"완료: {len(showrooms)}개 전시장, {total_consultants}명")
    return 0


if __name__ == "__main__":
    try:
        if "--normalize-existing" in sys.argv:
            raise SystemExit(normalize_existing_portraits())
        raise SystemExit(main())
    except Exception as error:
        print(f"사진 동기화 실패: {error}", file=sys.stderr)
        raise
