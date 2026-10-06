"""Prepare privacy-safe V3S Q3 evidence photos for the dashboard.

The source directory is supplied explicitly. Originals are never modified.
Face boxes were reviewed against the final Q3 evidence set; coordinates are
normalized so EXIF-corrected images can be processed deterministically.
"""

from __future__ import annotations

import argparse
import shutil
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = ROOT / "public" / "evidence"


@dataclass(frozen=True)
class EvidencePhoto:
    source_name: str
    cdsid: str
    output_name: str
    # Normalized left, top, right, bottom boxes.
    private_boxes: tuple[tuple[float, float, float, float], ...] = ()


PHOTOS = (
    EvidencePhoto(
        "고양Q3 근무 직원간 복장 착용 기준 상이(자켓 미착용, 셔츠 상이, 복장 기준 상이).jpg",
        "6KR6867",
        "uniform-differences-mosaic.jpg",
        (
            (0.060, 0.625, 0.145, 0.850),
            (0.415, 0.565, 0.500, 0.810),
            (0.425, 0.515, 0.530, 0.705),
            (0.640, 0.475, 0.735, 0.725),
        ),
    ),
    EvidencePhoto(
        "고양Q3 근무 직원간 복장 착용 기준 상이(자켓미착용, 셔츠 상이)2.jpg",
        "6KR6867",
        "uniform-differences-2.jpg",
    ),
    EvidencePhoto(
        "고양Q3 브랜드 매니저 핸드폰 사용.png",
        "6KR6867",
        "brand-manager-phone-use-mosaic.png",
        ((0.425, 0.180, 0.620, 0.440),),
    ),
    EvidencePhoto(
        "광주Q3 브랜드 매니저 네임택 미패용.jpg",
        "6KR6828",
        "brand-manager-name-tag-mosaic.jpg",
        ((0.445, 0.105, 0.830, 0.350),),
    ),
    EvidencePhoto(
        "광주Q3 전시차량 스펙 보드 비워진 채 방치.png",
        "6KR6828",
        "empty-vehicle-spec-board.png",
    ),
    EvidencePhoto(
        "구리Q3 근무 직원 간 복장 기준 상이 (영업 직원 하복, 브랜드 매니저 춘추복).png",
        "6KR6864",
        "uniform-season-mismatch-mosaic.png",
        ((0.200, 0.070, 0.580, 0.390),),
    ),
    EvidencePhoto(
        "구리Q3 브랜드 매니저 네임택 패용 위치 미흡(오른쪽 패용) & 복장 착용 기준 미준수 (규정 상의가 아님).jpg",
        "6KR6864",
        "brand-manager-name-tag-uniform-mosaic.jpg",
        ((0.500, 0.105, 0.790, 0.350),),
    ),
    EvidencePhoto(
        "군산Q3 상담 영업 직원 네임텍 미패용.png",
        "6KR6873",
        "sales-name-tag-mosaic.png",
        ((0.300, 0.000, 0.610, 0.245),),
    ),
    EvidencePhoto(
        "대구Q3 근무 직원간 복장 착용 기준 상이(영업 직원 베이지색 정장) (1).jpg",
        "6KR6829",
        "uniform-beige-suit-1-mosaic.jpg",
        (
            (0.075, 0.165, 0.285, 0.460),
            (0.420, 0.245, 0.535, 0.450),
            (0.555, 0.170, 0.675, 0.420),
            (0.650, 0.230, 0.790, 0.470),
        ),
    ),
    EvidencePhoto(
        "대구Q3 근무 직원간 복장 착용 기준 상이(영업 직원 베이지색 정장) (2).jpg",
        "6KR6829",
        "uniform-beige-suit-2-mosaic.jpg",
        (
            (0.420, 0.230, 0.625, 0.430),
            (0.545, 0.175, 0.755, 0.380),
        ),
    ),
    EvidencePhoto(
        "대구Q3 근무 직원간 복장 착용 기준 상이(영업 직원 베이지색 정장) (3).jpg",
        "6KR6829",
        "uniform-beige-suit-3-mosaic.jpg",
        (
            (0.220, 0.165, 0.445, 0.500),
            (0.555, 0.135, 0.765, 0.430),
        ),
    ),
    EvidencePhoto(
        "부천Q3 브랜드 매지너 의상 관리 미흡.jpg",
        "6KR6862",
        "brand-manager-attire.jpg",
    ),
    EvidencePhoto(
        "부천Q3 테이블 관리 미흡.jpg",
        "6KR6862",
        "table-maintenance.jpg",
    ),
    EvidencePhoto(
        "송파Q3 고객 시야에 쉽게 노출되는 공간에서 핸드폰 사용 직원.png",
        "6KR6847",
        "phone-use-employee.png",
    ),
    EvidencePhoto(
        "송파Q3 데스크 위 개인 컵 방치.png",
        "6KR6847",
        "personal-cup-on-desk.png",
    ),
    EvidencePhoto(
        "수원Q3 발레파커 네임택 미패용.jpg",
        "6KR6802",
        "valet-name-tag-mosaic.jpg",
        ((0.560, 0.270, 0.855, 0.650),),
    ),
    EvidencePhoto(
        "순천Q3 전시장 내 근무 직원 간 복장 착용 상이 및 복장 착용 미준수 직원 근무.png",
        "6KR6856",
        "uniform-noncompliance-mosaic.png",
        (
            (0.275, 0.000, 0.410, 0.195),
            (0.415, 0.000, 0.590, 0.175),
            (0.420, 0.080, 0.520, 0.220),
            (0.820, 0.000, 1.000, 0.190),
        ),
    ),
    EvidencePhoto(
        "순천Q3 전시장 주차장 출입구 주변 박스 방치.png",
        "6KR6856",
        "boxes-near-parking-entrance.png",
    ),
    EvidencePhoto(
        "용산Q3 발레파커 팔토시 착용, 흰색 내의 티셔츠 노출.jpg",
        "6KR6839",
        "valet-arm-sleeves-mosaic.jpg",
        ((0.315, 0.175, 0.500, 0.365),),
    ),
    EvidencePhoto(
        "울산Q3 근무 직원간 복장 착용 기준 상이(자켓미착용, 셔츠 상이) (1).jpg",
        "6KR6874",
        "uniform-season-mismatch-1-mosaic.jpg",
        ((0.615, 0.440, 0.795, 0.625),),
    ),
    EvidencePhoto(
        "울산Q3 근무 직원간 복장 착용 기준 상이(자켓미착용, 셔츠 상이) (2).jpg",
        "6KR6874",
        "uniform-season-mismatch-2.jpg",
    ),
    EvidencePhoto(
        "진주Q3 발레 파커 복장 착용 가이드 미준수 (규정 외 팔토시).png",
        "6KR6871",
        "valet-arm-sleeves-mosaic.png",
        ((0.360, 0.090, 0.820, 0.585),),
    ),
    EvidencePhoto(
        "진주Q3 복장 착용 미준수 영업 직원 근무.png",
        "6KR6871",
        "sales-uniform-noncompliance.png",
    ),
    EvidencePhoto(
        "진주Q3 브랜드 매니저 화려한 네일아트.png",
        "6KR6871",
        "brand-manager-nail-art.png",
    ),
    EvidencePhoto(
        "진주Q3 상담 영업 직원 구두 착화 주의 필요 (테슬 달린 구두, 점수 미차감).png",
        "6KR6871",
        "consultation-shoes.png",
    ),
    EvidencePhoto(
        "창원Q3 근무 직원간 복장 착용 기준 상이(영업 직원 셔츠) (1).jpg",
        "6KR6838",
        "uniform-shirt-1-mosaic.jpg",
        (
            (0.400, 0.120, 0.760, 0.400),
            # The business card contains a name, phone, email and QR code.
            (0.315, 0.665, 0.565, 0.850),
        ),
    ),
    EvidencePhoto(
        "창원Q3 근무 직원간 복장 착용 기준 상이(영업 직원 셔츠) (2).jpg",
        "6KR6838",
        "uniform-shirt-2-mosaic.jpg",
        ((0.370, 0.205, 0.755, 0.465),),
    ),
    EvidencePhoto(
        "하남Q3 브랜드 매니저 화려한 네일아트 및 손톱 길이 부적절.png",
        "6KR6861",
        "brand-manager-nail-art.png",
    ),
)


def mosaic_region(image: Image.Image, box: tuple[float, float, float, float]) -> None:
    width, height = image.size
    left = max(0, round(box[0] * width))
    top = max(0, round(box[1] * height))
    right = min(width, round(box[2] * width))
    bottom = min(height, round(box[3] * height))
    if right <= left or bottom <= top:
        raise ValueError(f"Invalid privacy box: {box}")

    region = image.crop((left, top, right, bottom))
    pixel_width = max(6, region.width // 18)
    pixel_height = max(6, region.height // 18)
    region = region.resize((pixel_width, pixel_height), Image.Resampling.BILINEAR)
    region = region.resize((right - left, bottom - top), Image.Resampling.NEAREST)
    image.paste(region, (left, top))


def save_image(image: Image.Image, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.suffix.lower() in {".jpg", ".jpeg"}:
        image.convert("RGB").save(
            destination,
            format="JPEG",
            quality=92,
            optimize=True,
            progressive=True,
        )
    else:
        image.save(destination, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--clean", action="store_true")
    args = parser.parse_args()

    if not args.source.is_dir():
        raise SystemExit(f"Source directory not found: {args.source}")

    expected = {photo.source_name for photo in PHOTOS}
    actual = {
        path.name
        for path in args.source.iterdir()
        if path.suffix.lower() in {".jpg", ".jpeg", ".png"}
    }
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise SystemExit(f"Q3 evidence set mismatch. missing={missing}, extra={extra}")

    if args.clean:
        for cdsid in {photo.cdsid for photo in PHOTOS}:
            destination = OUTPUT_ROOT / cdsid / "v3s" / "2026-q3"
            if destination.exists():
                shutil.rmtree(destination)

    for photo in PHOTOS:
        source = args.source / photo.source_name
        destination = (
            OUTPUT_ROOT / photo.cdsid / "v3s" / "2026-q3" / photo.output_name
        )
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
        for box in photo.private_boxes:
            mosaic_region(image, box)
        save_image(image, destination)
        print(destination.relative_to(ROOT).as_posix())

    print(f"Prepared {len(PHOTOS)} Q3 evidence photos for 14 showrooms.")


if __name__ == "__main__":
    main()
