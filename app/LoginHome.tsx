"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { LoginStats } from "./login-stats";

const LAST_LOGIN_CDSID_KEY = "volvo-dashboard-last-cdsid";
const VALID_CDSID_PATTERN = /^[A-Z0-9-]{4,16}$/;
const LOGIN_STATS_REFRESH_INTERVAL = 60_000;
const LOGIN_IDENTITY_MIN_MS = 700;
const LOGIN_SECURITY_SCAN_MS = 650;

type LoginPhase = "idle" | "checking-user" | "scanning-security";

const LOGIN_PHASE_LABELS: Record<LoginPhase, string> = {
  idle: "Data Dashboard 시작",
  "checking-user": "접속자 정보 확인 중",
  "scanning-security": "보안패치 프로그램 스캔 중",
};

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatReleaseTimestamp(value: string) {
  return value.replaceAll(".", "-");
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
  const [loginPhase, setLoginPhase] = useState<LoginPhase>("idle");
  const [loginStats, setLoginStats] = useState(initialStats);
  const cdsidInputRef = useRef<HTMLInputElement>(null);
  const recentCdsidOptionRef = useRef<HTMLButtonElement>(null);
  const isSubmitting = loginPhase !== "idle";

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

  function selectRememberedCdsid() {
    if (!rememberedCdsid) return;
    setCdsid(rememberedCdsid);
    setRecentCdsidOpen(false);
    cdsidInputRef.current?.blur();
    if (error) setError("");
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
    let mounted = true;

    const refreshTimestamp = async () => {
      try {
        const response = await fetch(`/dashboard-release.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const release = (await response.json()) as {
          items?: unknown;
          publishedAtKst?: unknown;
        };
        if (
          mounted &&
          Array.isArray(release.items) &&
          release.items.length > 0 &&
          typeof release.publishedAtKst === "string"
        ) {
          setUpdatedAt(formatReleaseTimestamp(release.publishedAtKst));
        }
      } catch {
        // Keep the last confirmed completion time when the release check fails.
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshTimestamp();
    };

    void refreshTimestamp();
    window.addEventListener("pageshow", refreshTimestamp);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      mounted = false;
      window.removeEventListener("pageshow", refreshTimestamp);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  async function openDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCdsid = cdsid.trim().toUpperCase();
    const phaseStartedAt = performance.now();

    setError("");
    setLoginPhase("checking-user");
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
        setLoginPhase("idle");
        return;
      }

      const identityRemaining = Math.max(
        0,
        LOGIN_IDENTITY_MIN_MS - (performance.now() - phaseStartedAt),
      );
      await wait(identityRemaining);
      setLoginPhase("scanning-security");
      await wait(LOGIN_SECURITY_SCAN_MS);

      try {
        window.localStorage.setItem(LAST_LOGIN_CDSID_KEY, normalizedCdsid);
      } catch {
        // A successful login must not be blocked by a storage restriction.
      }
      window.location.assign(payload.redirectPath);
    } catch {
      setError("로그인 연결을 확인한 뒤 다시 시도해 주세요.");
      setLoginPhase("idle");
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
          <div className="login-intro">
            <p className="login-audience">VOLVO SALES MANAGER ONLY</p>
            <h1 id="login-title">
              Volvo Data
              <br />
              Dashboard
            </h1>
            <span className="login-rule" aria-hidden="true" />
            <p className="login-description">
              정확한 인사이트로 더 나은 의사결정을 지원합니다.
            </p>
          </div>

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
                  ref={cdsidInputRef}
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
                  onPointerDown={(event) => {
                    if (!cdsid && rememberedCdsid && !recentCdsidOpen) {
                      event.preventDefault();
                      setRecentCdsidOpen(true);
                      cdsidInputRef.current?.blur();
                    }
                  }}
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
                    onPointerDown={(event) => {
                      event.preventDefault();
                      selectRememberedCdsid();
                    }}
                    onClick={selectRememberedCdsid}
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
              <strong aria-live="polite" aria-atomic="true">
                {LOGIN_PHASE_LABELS[loginPhase]}
              </strong>
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
          <span>Since 260901</span>
        </footer>
      </section>
    </main>
  );
}
