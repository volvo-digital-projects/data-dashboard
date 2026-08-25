"use client";

import { useEffect, useRef, useState } from "react";

const RELEASE_URL = "/dashboard-release.json";
const RELEASE_STORAGE_KEY = "volvo-dashboard-seen-release";
const RELEASE_CHECK_INTERVAL = 30_000;
const NOTICE_DURATION = 9_000;

type ReleaseInfo = {
  id: string;
  title: string;
  items: string[];
  publishedAt: string;
  publishedAtKst: string;
};

function isReleaseInfo(value: unknown): value is ReleaseInfo {
  if (!value || typeof value !== "object") return false;
  const release = value as Partial<ReleaseInfo>;
  return (
    typeof release.id === "string" &&
    typeof release.title === "string" &&
    Array.isArray(release.items) &&
    release.items.every((item) => typeof item === "string") &&
    typeof release.publishedAt === "string" &&
    typeof release.publishedAtKst === "string"
  );
}

export default function ReleaseUpdateNotice() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const activeReleaseId = useRef<string | null>(null);
  const dismissTimer = useRef<number | null>(null);
  const reloadTimer = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const clearDismissTimer = () => {
      if (dismissTimer.current !== null) {
        window.clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
    };

    const showCurrentRelease = (nextRelease: ReleaseInfo) => {
      clearDismissTimer();
      setRefreshing(false);
      setRelease(nextRelease);
      try {
        window.localStorage.setItem(RELEASE_STORAGE_KEY, nextRelease.id);
      } catch {
        // The update notice remains useful when storage is restricted.
      }
      dismissTimer.current = window.setTimeout(
        () => setRelease(null),
        NOTICE_DURATION,
      );
    };

    const reloadForRelease = (nextRelease: ReleaseInfo) => {
      clearDismissTimer();
      setRelease(nextRelease);
      setRefreshing(true);
      if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
      reloadTimer.current = window.setTimeout(() => {
        window.location.reload();
      }, 2_400);
    };

    const checkForRelease = async () => {
      try {
        const response = await fetch(`${RELEASE_URL}?t=${Date.now()}`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const nextRelease = (await response.json()) as unknown;
        if (!mounted || !isReleaseInfo(nextRelease)) return;

        const currentId = activeReleaseId.current;
        if (currentId && currentId !== nextRelease.id) {
          activeReleaseId.current = nextRelease.id;
          reloadForRelease(nextRelease);
          return;
        }

        if (!currentId) {
          activeReleaseId.current = nextRelease.id;
          let seenRelease = "";
          try {
            seenRelease =
              window.localStorage.getItem(RELEASE_STORAGE_KEY) ?? "";
          } catch {
            // Treat storage-restricted sessions as unseen.
          }
          if (seenRelease !== nextRelease.id) showCurrentRelease(nextRelease);
        }
      } catch {
        // A temporary version-check failure must never block the dashboard.
      }
    };

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkForRelease();
    };

    void checkForRelease();
    const interval = window.setInterval(
      checkForRelease,
      RELEASE_CHECK_INTERVAL,
    );
    window.addEventListener("pageshow", checkForRelease);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      clearDismissTimer();
      if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
      window.removeEventListener("pageshow", checkForRelease);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, []);

  if (!release) return null;

  return (
    <aside
      className={`release-update-notice${refreshing ? " is-refreshing" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="release-update-icon" aria-hidden="true">
        <i />
      </span>
      <div className="release-update-copy">
        <div className="release-update-heading">
          <strong>{refreshing ? "최신 버전 자동 반영 중" : release.title}</strong>
          <time dateTime={release.publishedAt}>{release.publishedAtKst}</time>
        </div>
        <ul>
          {release.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {refreshing ? <span className="release-update-progress" /> : null}
      </div>
      {!refreshing ? (
        <button
          type="button"
          aria-label="업데이트 안내 닫기"
          onClick={() => setRelease(null)}
        >
          ×
        </button>
      ) : null}
    </aside>
  );
}
