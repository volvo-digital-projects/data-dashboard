"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./V3SReportViewer.module.css";

export type ReportQuarter = "q1" | "q2" | "q3" | "q4";

const reportPageCounts: Record<string, number> = {
  "6KR342:q1": 3,
  "6KR342:q2": 4,
  "6KR6802:q1": 4,
  "6KR6802:q2": 3,
  "6KR6828:q1": 3,
  "6KR6828:q2": 3,
  "6KR6829:q1": 3,
  "6KR6829:q2": 4,
  "6KR6830:q1": 14,
  "6KR6830:q2": 3,
  "6KR6833:q1": 3,
  "6KR6833:q2": 3,
  "6KR6834:q1": 3,
  "6KR6834:q2": 3,
  "6KR6836:q1": 4,
  "6KR6836:q2": 3,
  "6KR6838:q1": 3,
  "6KR6838:q2": 3,
  "6KR6839:q1": 3,
  "6KR6839:q2": 3,
  "6KR6840:q1": 3,
  "6KR6840:q2": 4,
  "6KR6841:q1": 3,
  "6KR6841:q2": 6,
  "6KR6842:q1": 3,
  "6KR6842:q2": 3,
  "6KR6845:q1": 5,
  "6KR6845:q2": 3,
  "6KR6846:q1": 3,
  "6KR6846:q2": 9,
  "6KR6847:q1": 4,
  "6KR6847:q2": 5,
  "6KR6848:q1": 3,
  "6KR6848:q2": 3,
  "6KR6849:q1": 5,
  "6KR6849:q2": 4,
  "6KR6850:q1": 3,
  "6KR6850:q2": 3,
  "6KR6851:q1": 3,
  "6KR6851:q2": 3,
  "6KR6852:q1": 3,
  "6KR6852:q2": 5,
  "6KR6854:q1": 3,
  "6KR6854:q2": 3,
  "6KR6856:q1": 3,
  "6KR6856:q2": 3,
  "6KR6857:q1": 4,
  "6KR6857:q2": 3,
  "6KR6858:q1": 4,
  "6KR6858:q2": 3,
  "6KR6859:q1": 7,
  "6KR6859:q2": 3,
  "6KR6861:q1": 3,
  "6KR6861:q2": 5,
  "6KR6862:q1": 4,
  "6KR6862:q2": 4,
  "6KR6863:q1": 5,
  "6KR6863:q2": 3,
  "6KR6864:q1": 3,
  "6KR6864:q2": 3,
  "6KR6865:q1": 3,
  "6KR6865:q2": 3,
  "6KR6867:q1": 3,
  "6KR6867:q2": 3,
  "6KR6868:q1": 3,
  "6KR6868:q2": 3,
  "6KR6869:q1": 3,
  "6KR6869:q2": 3,
  "6KR6870:q1": 3,
  "6KR6870:q2": 5,
  "6KR6871:q1": 3,
  "6KR6871:q2": 3,
  "6KR6872:q1": 3,
  "6KR6872:q2": 3,
  "6KR6873:q1": 3,
  "6KR6873:q2": 3,
  "6KR6874:q1": 4,
  "6KR6874:q2": 3,
};

export const getV3sReportPageCount = (
  cdsid: string,
  quarter: ReportQuarter,
) => reportPageCounts[`${cdsid}:${quarter}`] ?? 0;

export const getV3sReport = (cdsid: string, quarter: ReportQuarter) => {
  if (getV3sReportPageCount(cdsid, quarter) === 0) return null;
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
  const pagesRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const currentPageRef = useRef(1);
  const navigationLockedRef = useRef(false);
  const unlockTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const reportUrl = getV3sReport(cdsid, quarter);
  const pageCount = getV3sReportPageCount(cdsid, quarter);
  const quarterLabel = quarter.toUpperCase();
  const pageAssetRoot = reportUrl?.replace(/\.pdf$/, "") ?? "";

  const goToPage = useCallback(
    (requestedPage: number, behavior: ScrollBehavior = "smooth") => {
      const pages = pagesRef.current;
      if (!pages || pageCount === 0) return;

      const nextPage = Math.min(pageCount, Math.max(1, requestedPage));
      currentPageRef.current = nextPage;
      setCurrentPage(nextPage);
      pages.scrollTo({
        top: (nextPage - 1) * pages.clientHeight,
        behavior,
      });

      navigationLockedRef.current = true;
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
      unlockTimerRef.current = window.setTimeout(() => {
        navigationLockedRef.current = false;
      }, behavior === "smooth" ? 560 : 80);
    },
    [pageCount],
  );

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
    closeButtonRef.current?.focus({ preventScroll: true });

    const pages = pagesRef.current;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        goToPage(currentPageRef.current + 1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        goToPage(currentPageRef.current - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        goToPage(1);
      } else if (event.key === "End") {
        event.preventDefault();
        goToPage(pageCount);
      }
    };
    const moveOnePageOnWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (navigationLockedRef.current || Math.abs(event.deltaY) < 8) return;
      goToPage(currentPageRef.current + (event.deltaY > 0 ? 1 : -1));
    };
    const rememberTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };
    const preventNativeTouchScroll = (event: TouchEvent) => {
      event.preventDefault();
    };
    const moveOnePageOnTouch = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartYRef.current = null;
      if (
        startY === null ||
        endY === undefined ||
        navigationLockedRef.current ||
        Math.abs(startY - endY) < 34
      ) {
        return;
      }
      goToPage(currentPageRef.current + (startY > endY ? 1 : -1));
    };
    const keepCurrentPageFitted = () => {
      goToPage(currentPageRef.current, "auto");
    };

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", keepCurrentPageFitted);
    pages?.addEventListener("wheel", moveOnePageOnWheel, { passive: false });
    pages?.addEventListener("touchstart", rememberTouchStart, { passive: true });
    pages?.addEventListener("touchmove", preventNativeTouchScroll, {
      passive: false,
    });
    pages?.addEventListener("touchend", moveOnePageOnTouch, { passive: true });

    return () => {
      document.documentElement.style.overflow = previousRootOverflow;
      document.documentElement.style.scrollbarGutter =
        previousRootScrollbarGutter;
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", keepCurrentPageFitted);
      pages?.removeEventListener("wheel", moveOnePageOnWheel);
      pages?.removeEventListener("touchstart", rememberTouchStart);
      pages?.removeEventListener("touchmove", preventNativeTouchScroll);
      pages?.removeEventListener("touchend", moveOnePageOnTouch);
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
    };
  }, [goToPage, onClose, pageCount]);

  if (!reportUrl || pageCount === 0) return null;

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
          </div>
          <button
            ref={closeButtonRef}
            className={styles.close}
            type="button"
            aria-label="V3S 결과 보고서 닫기"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div
          ref={pagesRef}
          className={styles.pages}
          aria-label={`${showroomName} V3S ${quarterLabel} 결과 보고서`}
          tabIndex={0}
        >
          {Array.from({ length: pageCount }, (_, index) => {
            const pageNumber = index + 1;
            return (
              <figure
                key={pageNumber}
                className={styles.page}
                aria-label={`${pageNumber}페이지`}
              >
                <img
                  src={`${pageAssetRoot}/page-${String(pageNumber).padStart(2, "0")}.jpg`}
                  alt={`${showroomName} V3S ${quarterLabel} 결과 보고서 ${pageNumber}페이지`}
                  width={1871}
                  height={1323}
                  loading={pageNumber === 1 ? "eager" : "lazy"}
                  decoding="async"
                />
              </figure>
            );
          })}
        </div>

        <div className={styles.pageCounter} aria-live="polite">
          {currentPage} / {pageCount}
        </div>
      </section>
    </div>
  );
}
