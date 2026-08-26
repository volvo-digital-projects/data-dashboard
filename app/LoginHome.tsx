"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import ReleaseUpdateNotice from "./ReleaseUpdateNotice";
import type { LoginStats } from "./login-stats";

const LAST_LOGIN_CDSID_KEY = "volvo-dashboard-last-cdsid";
const VALID_CDSID_PATTERN = /^[A-Z0-9-]{4,16}$/;
const LOGIN_STATS_REFRESH_INTERVAL = 60_000;

function formatSeoulTimestamp(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}`;
}

export default function LoginHome({
  initialStats = { today: 0, cumulative: 0 },
}: {
  initialStats?: LoginStats;
}) {
  const [cdsid, setCdsid] = useState("");
  const [rememberedCdsid, setRememberedCdsid] = useState("");
  const [recentCdsidOpen, setRecentCdsidOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginStats, setLoginStats] = useState(initialStats);
  const recentCdsidOptionRef = useRef<HTMLButtonElement>(null);

  function handleCdsidKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setRecentCdsidOpen(false);
      return;
    }
    if (
      event.key === "ArrowDown" &&
      recentCdsidOpen &&
      rememberedCdsid
    ) {
      event.preventDefault();
      recentCdsidOptionRef.current?.focus();
    }
  }

  useEffect(() => {
    try {
      const rememberedCdsid = window.localStorage
        .getItem(LAST_LOGIN_CDSID_KEY)
        ?.trim()
        .toUpperCase();
      if (rememberedCdsid && VALID_CDSID_PATTERN.test(rememberedCdsid)) {
        setRememberedCdsid(rememberedCdsid);
      }
    } catch {
      // The login remains fully usable when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const refreshLoginStats = async () => {
      try {
        const response = await fetch(`/api/login-stats?t=${Date.now()}`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const nextStats = (await response.json()) as Partial<LoginStats>;
        if (
          mounted &&
          Number.isFinite(nextStats.today) &&
          Number.isFinite(nextStats.cumulative)
        ) {
          setLoginStats({
            today: Math.max(0, Math.trunc(Number(nextStats.today))),
            cumulative: Math.max(0, Math.trunc(Number(nextStats.cumulative))),
          });
        }
      } catch {
        // Keep the last verified counts during a temporary network failure.
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshLoginStats();
    };

    void refreshLoginStats();
    const timer = window.setInterval(
      refreshLoginStats,
      LOGIN_STATS_REFRESH_INTERVAL,
    );
    window.addEventListener("pageshow", refreshLoginStats);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("pageshow", refreshLoginStats);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    const refreshTimestamp = () => setUpdatedAt(formatSeoulTimestamp(new Date()));
    refreshTimestamp();
    const timer = window.setInterval(refreshTimestamp, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function openDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCdsid = cdsid.trim().toUpperCase();

    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cdsid: normalizedCdsid }),
      });
      const payload = (await response.json()) as {
        message?: string;
        redirectPath?: string;
      };
      if (!response.ok || !payload.redirectPath) {
        setError(payload.message ?? "등록된 CDSID를 다시 확인해 주세요.");
        return;
      }

      try {
        window.localStorage.setItem(LAST_LOGIN_CDSID_KEY, normalizedCdsid);
      } catch {
        // A successful login must not be blocked by a storage restriction.
      }
      window.location.assign(payload.redirectPath);
    } catch {
      setError("로그인 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-home">
      <div className="login-photo" aria-hidden="true" />
      <div className="login-volvo-wordmark">
        <img src="/volvo-wordmark-white.png" alt="VOLVO" />
      </div>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-copy">
          <h1 id="login-title">
            Volvo Data
            <br />
            Dashboard
          </h1>
          <span className="login-rule" aria-hidden="true" />
          <p className="login-description">
            정확한 인사이트와 더 나은 의사결정을 지원합니다.
          </p>

          <form className="cdsid-form" onSubmit={openDashboard} noValidate>
            <div
              className="cdsid-entry"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setRecentCdsidOpen(false);
                }
              }}
            >
              <label className="cdsid-field">
                <span className="cdsid-person-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5.5 19c.7-3.2 3-5 6.5-5s5.8 1.8 6.5 5" />
                  </svg>
                </span>
                <span className="sr-only">CDSID</span>
                <input
                  name="cdsid"
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck="false"
                  minLength={4}
                  maxLength={16}
                  pattern="[A-Za-z0-9-]+"
                  placeholder="CDSID를 입력해 주세요"
                  value={cdsid}
                  aria-describedby={error ? "cdsid-error" : undefined}
                  aria-invalid={Boolean(error)}
                  aria-expanded={recentCdsidOpen && Boolean(rememberedCdsid)}
                  aria-controls={
                    rememberedCdsid ? "recent-cdsid-options" : undefined
                  }
                  aria-autocomplete="list"
                  onFocus={() => {
                    if (!cdsid && rememberedCdsid) setRecentCdsidOpen(true);
                  }}
                  onKeyDown={handleCdsidKeyDown}
                  onChange={(event) => {
                    const nextCdsid = event.currentTarget.value.toUpperCase();
                    setCdsid(nextCdsid);
                    setRecentCdsidOpen(!nextCdsid && Boolean(rememberedCdsid));
                    if (error) setError("");
                  }}
                  required
                />
              </label>

              {recentCdsidOpen && rememberedCdsid ? (
                <div
                  className="recent-cdsid-menu"
                  id="recent-cdsid-options"
                  role="listbox"
                  aria-label="최근 로그인 CDSID"
                >
                  <span>최근 로그인 CDSID</span>
                  <button
                    ref={recentCdsidOptionRef}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setRecentCdsidOpen(false);
                      }
                    }}
                    onClick={() => {
                      setCdsid(rememberedCdsid);
                      setRecentCdsidOpen(false);
                      if (error) setError("");
                    }}
                  >
                    <strong>{rememberedCdsid}</strong>
                    <small>선택</small>
                  </button>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="cdsid-error" id="cdsid-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={isSubmitting}>
              <span className="login-mouse-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="6.5" y="2.5" width="11" height="19" rx="5.5" />
                  <path d="M12 2.8V9" />
                  <path d="M6.8 10h10.4" />
                  <path d="M12 5.2v1.6" />
                </svg>
              </span>
              <strong>{isSubmitting ? "로그인 확인 중" : "Data Dashboard 시작"}</strong>
            </button>
          </form>

          <div className="login-session-meta" aria-label="최근 접속 및 업데이트 정보">
            <span className="login-access-stats">
              <small>접속 현황</small>
              <span>
                오늘 <strong>{loginStats.today.toLocaleString("ko-KR")}명</strong>
              </span>
              <span>
                누적 <strong>{loginStats.cumulative.toLocaleString("ko-KR")}명</strong>
              </span>
            </span>
            <time dateTime={updatedAt ? updatedAt.replace(" ", "T") : undefined}>
              <i aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 7.5V12l3.2 2" />
                </svg>
              </i>
              <b>UPDATE</b>
              <span>{updatedAt || "—"} 기준</span>
            </time>
          </div>
        </div>

        <footer>
          <span>Copyright (C) Volvo Car Korea. All rights reserved.</span>
          <span>Since 260831</span>
        </footer>
      </section>
      <ReleaseUpdateNotice />
    </main>
  );
}
