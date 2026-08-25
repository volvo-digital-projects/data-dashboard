"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

const LAST_LOGIN_CDSID_KEY = "volvo-dashboard-last-cdsid";
const VALID_CDSID_PATTERN = /^[A-Z0-9-]{4,16}$/;

export default function LoginHome() {
  const [cdsid, setCdsid] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const rememberedCdsid = window.localStorage
        .getItem(LAST_LOGIN_CDSID_KEY)
        ?.trim()
        .toUpperCase();
      if (rememberedCdsid && VALID_CDSID_PATTERN.test(rememberedCdsid)) {
        setCdsid(rememberedCdsid);
      }
    } catch {
      // The login remains fully usable when browser storage is unavailable.
    }
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

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-copy">
          <h1 id="login-title">
            Volvo Data
            <br />
            Dashboard
          </h1>
          <span className="login-rule" aria-hidden="true" />
          <p className="login-description">
            데이터 분석을 통해
            <br />
            정확한 인사이트와 더 나은 의사결정을 지원합니다.
          </p>

          <form className="cdsid-form" onSubmit={openDashboard} noValidate>
            <label className="cdsid-field">
              <span className="cdsid-person-icon" aria-hidden="true">
                <i />
                <b />
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
                onChange={(event) => {
                  setCdsid(event.currentTarget.value.toUpperCase());
                  if (error) setError("");
                }}
                required
              />
            </label>

            {error ? (
              <p className="cdsid-error" id="cdsid-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={isSubmitting}>
              <span className="login-mouse-icon" aria-hidden="true">
                <i />
              </span>
              <strong>{isSubmitting ? "로그인 확인 중" : "Data Dashboard 시작"}</strong>
              <span aria-hidden="true" />
            </button>
          </form>
        </div>

        <footer>
          <span>Copyright (C) Volvo Car Korea. All rights reserved.</span>
          <span>Since 260801</span>
        </footer>
      </section>
    </main>
  );
}
