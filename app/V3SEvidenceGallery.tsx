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
                {showroomName} V3S {quarterLabel} 증빙사진
              </h2>
              <span className={styles.count}>{photos.length}장</span>
            </div>
            <p>가로·세로 사진을 원본 비율로 표시하며 모든 얼굴은 익명화했습니다.</p>
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
