"use client";

import type { FormEvent } from "react";

export default function LoginHome() {
  function openDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const cdsid = String(formData.get("cdsid") ?? "").trim().toUpperCase();

    if (cdsid) {
      window.location.assign(`/dashboard/${encodeURIComponent(cdsid)}`);
    }
  }

  return (
    <main className="login-home">
      <div className="login-photo" aria-hidden="true" />

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-copy">
          <p className="login-kicker">2026 RETAIL PERFORMANCE INTELLIGENCE</p>
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

          <form
            className="cdsid-form"
            action="/dashboard"
            method="get"
            onSubmit={openDashboard}
          >
            <label className="cdsid-field">
              <span className="cdsid-icon" aria-hidden="true">
                ID
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
                required
                autoFocus
              />
            </label>

            <button type="submit">
              <span>Data Dashboard 시작</span>
              <b aria-hidden="true">→</b>
            </button>
          </form>
        </div>

        <footer>
          <span>Copyright © Volvo Car Korea. All rights reserved.</span>
          <span>Authorized managers only · 2026</span>
        </footer>
      </section>

    </main>
  );
}
