"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./DscGuideViewer.module.css";

const PAGE_COUNT = 13;
const PAGE_NUMBERS = Array.from({ length: PAGE_COUNT }, (_, index) => index + 1);

type DscGuideViewerProps = {
  onClose: () => void;
};

export default function DscGuideViewer({ onClose }: DscGuideViewerProps) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const goToPage = useCallback((pageNumber: number) => {
    const boundedPage = Math.min(PAGE_COUNT, Math.max(1, pageNumber));
    const page = pagesRef.current?.querySelector<HTMLElement>(
      `[data-guide-page="${boundedPage}"]`,
    );
    page?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    const pages = pagesRef.current;
    if (!pages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visiblePage = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visiblePage) {
          setCurrentPage(Number((visiblePage.target as HTMLElement).dataset.guidePage));
        }
      },
      { root: pages, threshold: [0.55, 0.75, 0.95] },
    );

    pages.querySelectorAll<HTMLElement>("[data-guide-page]").forEach((page) => {
      observer.observe(page);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        goToPage(currentPage + 1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        goToPage(currentPage - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        goToPage(1);
      } else if (event.key === "End") {
        event.preventDefault();
        goToPage(PAGE_COUNT);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, goToPage, onClose]);

  return (
    <div className={styles.backdrop}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="DSC 가이드 PDF"
      >
        <header className={styles.toolbar}>
          <div className={styles.guideIdentity}>
            <span className={styles.bookIcon} aria-hidden="true" />
            <strong>DSC 가이드</strong>
          </div>
          <span className={styles.pageCounter} aria-live="polite">
            {currentPage} / {PAGE_COUNT}
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            aria-label="DSC 가이드 닫기"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div ref={pagesRef} className={styles.pages} tabIndex={0}>
          {PAGE_NUMBERS.map((pageNumber) => (
            <figure
              key={pageNumber}
              className={styles.page}
              data-guide-page={pageNumber}
              aria-label={`${pageNumber}페이지`}
            >
              <img
                src={`/guides/dsc-competence-2026/pages/page-${String(pageNumber).padStart(2, "0")}.jpg`}
                alt={`2026 RTC DSC Competence Guide ${pageNumber}페이지`}
                width={2133}
                height={1200}
                loading={pageNumber === 1 ? "eager" : "lazy"}
                decoding="async"
              />
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
