"use client";

import { useEffect, useRef } from "react";
import styles from "./V3SEvidenceGallery.module.css";

export type EvidenceQuarter = "q1" | "q2" | "q3" | "q4";

type EvidencePhoto = {
  src: string;
  alt: string;
  caption: string;
};

const evidenceByShowroom: Record<
  string,
  Partial<Record<EvidenceQuarter, EvidencePhoto[]>>
> = {
  "6KR6802": {
    q1: [
      {
        src: "/evidence/6KR6802/v3s/2026-q1/uniform-brand-manager-spring-fall.jpg",
        alt: "볼보 수원 Q1 근무 직원 복장 착용 기준 상이 증빙사진",
        caption: "근무 직원 간 복장 착용 기준 상이 (브랜드매니저 춘추복)",
      },
      {
        src: "/evidence/6KR6802/v3s/2026-q1/uniform-sales-winter-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 수원 Q1 근무 직원 복장 착용 기준 상이 증빙사진",
        caption: "근무 직원 간 복장 착용 기준 상이 (상담 영업 직원 동계복)",
      },
      {
        src: "/evidence/6KR6802/v3s/2026-q1/brand-manager-nails-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 수원 Q1 브랜드매니저 손톱 증빙사진",
        caption: "브랜드매니저 손톱 (길고 화려함)",
      },
    ],
  },
  "6KR6830": {
    q1: [
      {
        src: "/evidence/6KR6830/v3s/2026-q1/uniform-brand-manager-spring-fall-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 분당 Q1 근무 직원 복장 착용 기준 상이 증빙사진",
        caption: "근무 직원 간 복장 착용 기준 상이 (브랜드매니저 춘추복)",
      },
      {
        src: "/evidence/6KR6830/v3s/2026-q1/uniform-sales-winter-name-tag-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 분당 Q1 근무 직원 복장과 네임택 증빙사진",
        caption:
          "근무 직원 간 복장 착용 기준 상이 (상담 영업 직원 동계복) 및 네임택 미착용",
      },
      {
        src: "/evidence/6KR6830/v3s/2026-q1/valet-name-tag-white-shoes-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 분당 Q1 발레파커 네임택과 흰 운동화 증빙사진",
        caption: "발레파커 네임택 미착용·흰 운동화",
      },
      {
        src: "/evidence/6KR6830/v3s/2026-q1/valet-name-tag-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 분당 Q1 발레파커 네임택 미착용 증빙사진",
        caption: "발레파커 네임택 미착용",
      },
    ],
  },
  "6KR6833": {
    q1: [
      {
        src: "/evidence/6KR6833/v3s/2026-q1/valet-sports-shoes-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 대전 Q1 발레파커 스포츠 운동화 착용 증빙사진",
        caption: "발레파커 스포츠 운동화 착용",
      },
    ],
  },
  "6KR6834": {
    q2: [
      {
        src: "/evidence/6KR6834/v3s/2026-q2/valet-name-tag-mosaic.png",
        alt: "얼굴이 익명화된 강남대치 Q2 발레파커 네임택 미착용 증빙사진",
        caption: "발레파커 네임택 미착용",
      },
      {
        src: "/evidence/6KR6834/v3s/2026-q2/brand-manager-badge-mosaic.png",
        alt: "얼굴이 익명화된 강남대치 Q2 브랜드매니저 명찰과 배지 미착용 증빙사진",
        caption: "브랜드매니저 명찰과 배지 미착용",
      },
    ],
  },
  "6KR6838": {
    q1: [
      {
        src: "/evidence/6KR6838/v3s/2026-q1/uniform-brand-manager-spring-fall-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 창원 Q1 근무 직원 복장 착용 기준 상이 증빙사진",
        caption: "근무 직원 간 복장 착용 기준 상이 (브랜드매니저 춘추복)",
      },
      {
        src: "/evidence/6KR6838/v3s/2026-q1/uniform-sales-winter-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 창원 Q1 근무 직원 복장 착용 기준 상이 증빙사진",
        caption: "근무 직원 간 복장 착용 기준 상이 (상담 영업 직원 동계복)",
      },
    ],
  },
  "6KR6839": {
    q1: [
      {
        src: "/evidence/6KR6839/v3s/2026-q1/brand-manager-nails.jpg",
        alt: "볼보 용산 Q1 브랜드매니저 손톱 증빙사진",
        caption: "브랜드매니저 손톱 (길고 화려함)",
      },
    ],
  },
  "6KR6841": {
    q1: [
      {
        src: "/evidence/6KR6841/v3s/2026-q1/waiting-area-break-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 동대문 Q1 대기 영업 직원 휴식 증빙사진",
        caption:
          "대기 영업 직원 고객 시야 노출 공간 휴식 (테이크아웃 음료·휴대폰)",
      },
      {
        src: "/evidence/6KR6841/v3s/2026-q1/brand-manager-volvo-badge-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 동대문 Q1 브랜드매니저 볼보 배지 미착용 증빙사진",
        caption: "브랜드매니저 볼보 배지 미착용",
      },
      {
        src: "/evidence/6KR6841/v3s/2026-q1/sales-name-tag-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 동대문 Q1 영업 직원 네임택 미착용 증빙사진",
        caption: "영업 직원 네임택 미착용",
      },
      {
        src: "/evidence/6KR6841/v3s/2026-q1/info-desk-takeout-cup-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 동대문 Q1 인포데스크 불필요 물품 증빙사진",
        caption: "인포데스크 위 불필요 물품 (테이크아웃 음료컵)",
      },
    ],
    q2: [
      {
        src: "/evidence/6KR6841/v3s/2026-q2/uniform-season-mismatch-mosaic.png",
        alt: "얼굴이 익명화된 동대문 Q2 근무 직원 복장 착용 기준 상이 증빙사진",
        caption: "근무 직원 간 복장 착용 기준 상이 (하복·춘추복)",
      },
      {
        src: "/evidence/6KR6841/v3s/2026-q2/laptop-left-unattended-mosaic.png",
        alt: "얼굴이 익명화된 동대문 Q2 노트북 방치 증빙사진",
        caption: "노트북 방치",
      },
      {
        src: "/evidence/6KR6841/v3s/2026-q2/valet-black-round-shirt-mosaic.png",
        alt: "얼굴이 익명화된 동대문 Q2 발레파커 검정색 라운드 티 착용 증빙사진",
        caption: "발레파커 검정색 라운드 티 착용",
      },
      {
        src: "/evidence/6KR6841/v3s/2026-q2/unnecessary-items-left.jpg",
        alt: "동대문 Q2 불필요 물품 방치 증빙사진",
        caption: "불필요 물품 방치",
      },
      {
        src: "/evidence/6KR6841/v3s/2026-q2/consultation-shoes-mosaic.png",
        alt: "얼굴이 익명화된 동대문 Q2 상담 영업 직원 구두 착용 미흡 증빙사진",
        caption: "상담 영업 직원 구두 착용 미흡",
      },
      {
        src: "/evidence/6KR6841/v3s/2026-q2/uniform-guide-noncompliance-mosaic.png",
        alt: "얼굴이 익명화된 동대문 Q2 영업 직원 복장 착용 가이드 미준수 증빙사진",
        caption: "영업 직원 복장 착용 가이드 미준수",
      },
    ],
  },
  "6KR6845": {
    q1: [
      {
        src: "/evidence/6KR6845/v3s/2026-q1/brand-manager-phone-use-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 일산 Q1 브랜드매니저 핸드폰 사용 증빙사진",
        caption: "브랜드매니저 핸드폰 사용",
      },
    ],
  },
  "6KR6842": {
    q2: [
      {
        src: "/evidence/6KR6842/v3s/2026-q2/employee-name-tag-mosaic.png",
        alt: "얼굴이 익명화된 해운대 Q2 근무 직원 네임택 미착용 증빙사진",
        caption: "근무 직원 네임택 미착용",
      },
    ],
  },
  "6KR6846": {
    q2: [
      {
        src: "/evidence/6KR6846/v3s/2026-q2/uniform-season-mismatch-mosaic.png",
        alt: "얼굴이 익명화된 목동 Q2 근무 직원 복장 착용 기준 상이 증빙사진",
        caption: "근무 직원 간 복장 착용 기준 상이 (하복·춘추복)",
      },
      {
        src: "/evidence/6KR6846/v3s/2026-q2/brand-manager-name-tag-mosaic.png",
        alt: "얼굴이 익명화된 목동 Q2 브랜드매니저 네임택 미착용 증빙사진",
        caption: "브랜드매니저 네임택 미착용",
      },
    ],
  },
  "6KR6847": {
    q2: [
      {
        src: "/evidence/6KR6847/v3s/2026-q2/brand-manager-long-hair-phone-mosaic.png",
        alt: "얼굴이 익명화된 송파 Q2 브랜드매니저 긴 머리와 핸드폰 사용 증빙사진",
        caption: "브랜드매니저 긴 머리·핸드폰 사용",
      },
      {
        src: "/evidence/6KR6847/v3s/2026-q2/phone-use-mosaic.png",
        alt: "얼굴이 익명화된 송파 Q2 핸드폰 사용 증빙사진",
        caption: "핸드폰 사용",
      },
    ],
  },
  "6KR6852": {
    q1: [
      {
        src: "/evidence/6KR6852/v3s/2026-q1/vehicle-dust-debris.jpg",
        alt: "볼보 서초 Q1 전시 차량 인근 먼지와 이물질 증빙사진",
        caption: "전시 차량 인근 먼지와 이물질",
      },
    ],
    q2: [
      {
        src: "/evidence/6KR6852/v3s/2026-q2/valet-name-tag-mosaic.png",
        alt: "얼굴이 익명화된 서초 Q2 발레파커 네임택 미착용 증빙사진",
        caption: "발레파커 네임택 미착용",
      },
    ],
  },
  "6KR6851": {
    q1: [
      {
        src: "/evidence/6KR6851/v3s/2026-q1/vehicle-customer-trace-hair.jpg",
        alt: "볼보 원주 Q1 전시 차량 고객 체험 흔적 증빙사진",
        caption: "전시 차량 고객 체험 흔적 (머리카락)",
      },
    ],
  },
  "6KR6863": {
    q1: [
      {
        src: "/evidence/6KR6863/v3s/2026-q1/uniform-brand-manager-spring-fall-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 김해 Q1 근무 직원 복장 착용 기준 상이 증빙사진",
        caption: "근무 직원 간 복장 착용 기준 상이 (브랜드매니저 춘추복)",
      },
      {
        src: "/evidence/6KR6863/v3s/2026-q1/uniform-sales-winter-mosaic.jpg",
        alt: "얼굴이 익명화된 볼보 김해 Q1 근무 직원 복장 착용 기준 상이 증빙사진",
        caption: "근무 직원 간 복장 착용 기준 상이 (상담 영업 직원 동계복)",
      },
    ],
    q2: [
      {
        src: "/evidence/6KR6863/v3s/2026-q2/waiting-posture-1-mosaic.png",
        alt: "얼굴이 익명화된 김해 Q2 대기 영업 직원 부적절한 대기 자세 첫 번째 증빙사진",
        caption: "대기 영업 직원 부적절한 대기 자세 (팔짱) 1",
      },
      {
        src: "/evidence/6KR6863/v3s/2026-q2/waiting-posture-2.jpg",
        alt: "김해 Q2 대기 영업 직원 부적절한 대기 자세 두 번째 증빙사진",
        caption: "대기 영업 직원 부적절한 대기 자세 (팔짱) 2",
      },
      {
        src: "/evidence/6KR6863/v3s/2026-q2/info-desk-personal-cup.jpg",
        alt: "김해 Q2 인포데스크 내 개인 컵 방치 증빙사진",
        caption: "인포데스크 내 개인 컵 방치",
      },
      {
        src: "/evidence/6KR6863/v3s/2026-q2/podium-personal-tumbler.jpg",
        alt: "김해 Q2 포디움 내 개인 텀블러 방치 증빙사진",
        caption: "포디움 내 개인 텀블러 방치",
      },
    ],
  },
  "6KR6870": {
    q2: [
      {
        src: "/evidence/6KR6870/v3s/2026-q2/uniform-season-mismatch-mosaic.png",
        alt: "얼굴이 익명화된 서수원 Q2 근무 직원 복장 착용 기준 상이 증빙사진",
        caption: "근무 직원 간 복장 착용 기준 상이 (하복·춘추복)",
      },
      {
        src: "/evidence/6KR6870/v3s/2026-q2/specialist-bottoms-mosaic.png",
        alt: "얼굴이 익명화된 서수원 Q2 스페셜리스트 하의 착용 증빙사진",
        caption: "스페셜리스트 착용 하의",
      },
    ],
  },
  "6KR6874": {
    q2: [
      {
        src: "/evidence/6KR6874/v3s/2026-q2/brand-manager-volvo-badge-mosaic.png",
        alt: "얼굴이 익명화된 울산 Q2 브랜드매니저 볼보 배지 미착용 증빙사진",
        caption: "브랜드매니저 볼보 배지 미착용",
      },
    ],
  },
};

export const getV3sEvidence = (
  cdsid: string,
  quarter: EvidenceQuarter,
) => evidenceByShowroom[cdsid]?.[quarter] ?? [];

export function V3SEvidenceGallery({
  cdsid,
  showroomName,
  quarter,
  onClose,
}: {
  cdsid: string;
  showroomName: string;
  quarter: EvidenceQuarter;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const photos = getV3sEvidence(cdsid, quarter);
  const quarterLabel = quarter.toUpperCase();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  if (photos.length === 0) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="v3s-evidence-title"
      >
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={styles.titleRow}>
              <h2 id="v3s-evidence-title">
                {showroomName}{" "}
                <span className={styles.latinTitle}>V3S {quarterLabel}</span>{" "}
                증빙사진
              </h2>
              <span className={styles.count}>{photos.length}장</span>
            </div>
            <p>가로·세로 사진을 원본 비율로 표시하며 모든 얼굴은 모자이크 처리했습니다.</p>
          </div>
          <button
            ref={closeButtonRef}
            className={styles.close}
            type="button"
            aria-label="증빙사진 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.grid}>
            {photos.map((photo) => (
              <figure className={styles.figure} key={photo.src}>
                <div className={styles.imageStage}>
                  <img src={photo.src} alt={photo.alt} loading="eager" />
                </div>
                <figcaption className={styles.caption}>
                  <strong>{photo.caption}</strong>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
