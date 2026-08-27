"use client";

import { useEffect, useRef } from "react";
import styles from "./V3SReportViewer.module.css";

export type ReportQuarter = "q1" | "q2" | "q3" | "q4";

const reportShowrooms = new Set([
  "6KR342",
  "6KR6802",
  "6KR6828",
  "6KR6829",
  "6KR6830",
  "6KR6833",
  "6KR6834",
  "6KR6836",
  "6KR6838",
  "6KR6839",
  "6KR6840",
  "6KR6841",
  "6KR6842",
  "6KR6845",
  "6KR6846",
  "6KR6847",
  "6KR6848",
  "6KR6849",
  "6KR6850",
  "6KR6851",
  "6KR6852",
  "6KR6854",
  "6KR6856",
  "6KR6857",
  "6KR6858",
  "6KR6859",
  "6KR6861",
  "6KR6862",
  "6KR6863",
  "6KR6864",
  "6KR6865",
  "6KR6867",
  "6KR6868",
  "6KR6869",
  "6KR6870",
  "6KR6871",
  "6KR6872",
  "6KR6873",
  "6KR6874",
]);

export const getV3sReport = (cdsid: string, quarter: ReportQuarter) => {
  if (!(["q1", "q2"] as ReportQuarter[]).includes(quarter)) return null;
  if (!reportShowrooms.has(cdsid)) return null;
  return `/reports/${encodeURIComponent(cdsid)}/v3s/2026-${quarter}.pdf`;
};

export function V3SReportViewer({
  cdsid,
  showroomName,
  quarter,
  onClose,
}: {
  cdsid: string;
  showroomName: string;
  quarter: ReportQuarter;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reportUrl = getV3sReport(cdsid, quarter);
  const quarterLabel = quarter.toUpperCase();

  useEffect(() => {
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousRootScrollbarGutter =
      document.documentElement.style.scrollbarGutter;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.scrollbarGutter = "auto";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    closeButtonRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.documentElement.style.overflow = previousRootOverflow;
      document.documentElement.style.scrollbarGutter =
        previousRootScrollbarGutter;
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  if (!reportUrl) return null;

  const viewerUrl = `${reportUrl}#view=FitH&toolbar=1&navpanes=0`;

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="v3s-report-title"
      >
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <h2 id="v3s-report-title">
              {showroomName} <span>V3S {quarterLabel}</span> 결과 보고서
            </h2>
            <p>가로형 보고서를 화면 너비에 맞춰 표시합니다.</p>
          </div>
          <div className={styles.actions}>
            <a href={reportUrl} target="_blank" rel="noreferrer">
              새 창
            </a>
            <button
              ref={closeButtonRef}
              className={styles.close}
              type="button"
              aria-label="V3S 결과 보고서 닫기"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>
        <div className={styles.frameStage}>
          <iframe
            className={styles.frame}
            src={viewerUrl}
            title={`${showroomName} V3S ${quarterLabel} 결과 보고서`}
          />
        </div>
      </section>
    </div>
  );
}
