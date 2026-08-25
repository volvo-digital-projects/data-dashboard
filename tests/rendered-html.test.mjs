import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

const staleLoginCookie =
  "volvo-dashboard-access=vck-manager-session-260825-b8f41d";
const loginCookie =
  "volvo-dashboard-access=vck-manager-session-260825-login-reset-f31a72";

async function render(
  pathname = "/",
  { authenticated = true, cookie = null } = {},
) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost/"), {
      headers: {
        accept: "text/html",
        host: "localhost",
        ...(cookie || authenticated ? { cookie: cookie ?? loginCookie } : {}),
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function login(cdsid) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `login-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost" },
      body: JSON.stringify({ cdsid }),
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function logout() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `logout-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/api/logout", {
      method: "POST",
      headers: { cookie: loginCookie, host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the CDSID login route", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Volvo Data/);
  assert.match(html, /Dashboard/);
  assert.match(html, /CDSID를 입력해 주세요/);
  assert.match(html, /Data Dashboard 시작/);
  assert.match(html, /접속 현황/);
  assert.match(html, /오늘/);
  assert.match(html, /86(?:<!-- -->)?명/);
  assert.match(html, /누적/);
  assert.match(html, /1,265(?:<!-- -->)?명/);
  assert.match(html, /UPDATE/);
  assert.match(html, /Since 260831/);

  const explicitLoginResponse = await render("/login");
  assert.equal(explicitLoginResponse.status, 200);
  const explicitLoginHtml = await explicitLoginResponse.text();
  assert.match(explicitLoginHtml, /Volvo Data/);
  assert.match(explicitLoginHtml, /CDSID를 입력해 주세요/);
});

test("remembers only the last successfully authenticated CDSID", async () => {
  const loginSource = await readFile(
    new URL("../app/LoginHome.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    loginSource,
    /const LAST_LOGIN_CDSID_KEY = "volvo-dashboard-last-cdsid"/,
  );
  assert.match(
    loginSource,
    /localStorage[\s\S]*?\.getItem\(LAST_LOGIN_CDSID_KEY\)[\s\S]*?setCdsid\(rememberedCdsid\)/,
  );
  assert.match(
    loginSource,
    /if \(!response\.ok \|\| !payload\.redirectPath\)[\s\S]*?return;[\s\S]*?localStorage\.setItem\(LAST_LOGIN_CDSID_KEY, normalizedCdsid\)[\s\S]*?window\.location\.assign/,
  );
  assert.match(
    loginSource,
    /timeZone: "Asia\/Seoul"[\s\S]*?setInterval\(refreshTimestamp, 60_000\)/,
  );
});

test("automatically detects, announces, and applies new dashboard releases", async () => {
  const [loginSource, dashboardSource, noticeSource, css, releaseAsset] =
    await Promise.all([
      readFile(new URL("../app/LoginHome.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/ReleaseUpdateNotice.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(
        new URL("../public/dashboard-release.json", import.meta.url),
        "utf8",
      ),
    ]);
  const release = JSON.parse(releaseAsset);

  assert.match(loginSource, /<ReleaseUpdateNotice \/>/);
  assert.match(dashboardSource, /<ReleaseUpdateNotice \/>/);
  assert.match(noticeSource, /\/dashboard-release\.json/);
  assert.match(noticeSource, /cache: "no-store"/);
  assert.match(noticeSource, /window\.setInterval\([\s\S]*?RELEASE_CHECK_INTERVAL/);
  assert.match(noticeSource, /window\.addEventListener\("pageshow"/);
  assert.match(noticeSource, /document\.addEventListener\("visibilitychange"/);
  assert.match(noticeSource, /currentId !== nextRelease\.id[\s\S]*?reloadForRelease/);
  assert.match(noticeSource, /window\.location\.reload\(\)/);
  assert.match(css, /\.release-update-notice\s*\{[\s\S]*?position: fixed/);
  assert.match(css, /bottom: max\(18px, env\(safe-area-inset-bottom\)\)/);
  assert.equal(release.title, "최신내용 업데이트");
  assert.equal(release.items.length, 13);
  assert.match(release.id, /^[a-f0-9]{16}$/);
});

test("protects dashboard routes behind the manager CDSID login", async () => {
  const response = await render("/dashboard/6KR6834", { authenticated: false });
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/");

  const staleSessionResponse = await render("/dashboard/6KR6834", {
    authenticated: false,
    cookie: staleLoginCookie,
  });
  assert.equal(staleSessionResponse.status, 307);
  assert.equal(staleSessionResponse.headers.get("location"), "http://localhost/");
});

test("ships the blue-row manager allowlist and VCK-ES90 account", async () => {
  const loginAccess = JSON.parse(
    await readFile(new URL("../app/data/login-access.json", import.meta.url), "utf8"),
  );
  assert.equal(loginAccess.accounts.length, 46);
  assert.equal(new Set(loginAccess.accounts.map((account) => account.cdsid)).size, 46);
  assert.deepEqual(
    loginAccess.accounts.find((account) => account.cdsid === "K-KIM16"),
    { cdsid: "K-KIM16", dashboardCdsid: "6KR6834" },
  );
  assert.deepEqual(
    loginAccess.accounts.find((account) => account.cdsid === "VCK-ES90"),
    { cdsid: "VCK-ES90", dashboardCdsid: "6KR6834" },
  );
});

test("accepts manager and VCK-ES90 logins while rejecting other CDSIDs", async () => {
  for (const cdsid of ["K-KIM16", "vck-es90"]) {
    const response = await login(cdsid);
    assert.equal(response.status, 200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /volvo-dashboard-access=/);
    assert.doesNotMatch(setCookie, /Max-Age=/i);
    assert.deepEqual(await response.json(), {
      redirectPath: "/dashboard/6KR6834",
    });
  }

  const denied = await login("6KR6834");
  assert.equal(denied.status, 401);
  assert.doesNotMatch(denied.headers.get("set-cookie") ?? "", /volvo-dashboard-access=/);
});

test("logs out to the login screen and clears the manager session", async () => {
  const response = await logout();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://localhost/");
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /volvo-dashboard-access=/);
  assert.match(setCookie, /Max-Age=0/i);
});

test("server-renders the selected CDSID dashboard", async () => {
  const response = await render("/dashboard/6KR6834");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Voice of Customer · 고객 의견 평가\(VCK\)/);
  assert.match(
    html,
    /class="(?:national|actual)-point-value"[^>]*>100<\/text>/,
  );
  assert.match(
    html,
    /class="(?:national|actual)-point-value"[^>]*>130<\/text>/,
  );
  assert.match(
    html,
    /class="(?:national|actual)-point-value"[^>]*>64<\/text>/,
  );
  assert.doesNotMatch(
    html,
    /class="(?:national|actual)-point-value"[^>]*>\d+\.0<\/text>/,
  );
  const visibleHtml = html.replaceAll("<!-- -->", "");
  const seoulToday = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
  })
    .format(new Date())
    .replaceAll("-", ".");
  assert.match(html, /DSC COMMAND/);
  assert.doesNotMatch(
    visibleHtml,
    /SHOWROOM POWER(?: INDEX)?|전시장 전투력|3대 핵심 지표/,
  );
  assert.doesNotMatch(html, /CORE SIGNALS/);
  assert.doesNotMatch(html, /class="topbar"/);
  assert.doesNotMatch(html, /class="identity-tools"|class="identity-tool"/);
  assert.match(
    html,
    /class="identity-title"><h1>볼보 강남대치(?:<!-- -->)? 현황<\/h1><div class="update-status">/,
  );
  assert.match(
    html,
    /class="identity-detail-rail"[\s\S]*?<\/dl><div class="identity-profile-menu"><button class="identity-profile"/,
  );
  assert.match(html, /identity-profile[\s\S]*?지점장[\s\S]*?김길성/);
  assert.match(html, /class="identity-profile-icon"/);
  assert.doesNotMatch(
    html,
    /전시장별 경쟁력 분석|CDSID 프로필 전환|데이터 점검을 위해 전시장을 선택하세요|편집 권한 계정은 전체 전시장을 점검할 수 있습니다/,
  );
  assert.doesNotMatch(html, /class="identity-meta-row"/);
  assert.match(html, /class="identity-detail-rail"/);
  assert.doesNotMatch(visibleHtml, /평가 기준 한눈에 보기/);
  assert.match(
    visibleHtml,
    new RegExp(`업데이트[\\s\\S]*?${seoulToday.replaceAll(".", "\\.")} 기준`),
  );
  assert.match(visibleHtml, /Q1, Q2 마감, 현재 Q3평가 진행중/);
  assert.match(
    visibleHtml,
    /Q1, Q2 마감, 현재 Q3평가 진행중[\s\S]*?class="dashboard-logout-form" action="\/api\/logout" method="post"[\s\S]*?로그아웃/,
  );
  const dashboardCss = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(
    dashboardCss,
    /\.dashboard-identity-header \.update-status\s*\{[\s\S]*?width: 100%/,
  );
  assert.match(
    dashboardCss,
    /\.dashboard-logout-form\s*\{[\s\S]*?margin: 0 0 0 auto/,
  );
  assert.doesNotMatch(visibleHtml, /Q2 원본 데이터 반영/);
  assert.match(html, /V3S/);
  assert.match(html, /VOC/);
  assert.match(
    visibleHtml,
    /class="signal-icon warning" aria-hidden="true">▼<\/span>위험 감지/,
  );
  assert.match(
    visibleHtml,
    /class="signal-icon caution" aria-hidden="true">▼<\/span>주의 필요/,
  );
  assert.match(html, /CX Index/);
  assert.match(visibleHtml, /VOC해피콜<\/span>만 교차검증 후 사후보정 가능/);
  assert.match(visibleHtml, /신차해피콜<\/span>만 교차검증 후 사후보정 가능/);
  assert.match(
    visibleHtml,
    /V3S 보정기간\(최초발표 후, 영업일 2일내\) 내 교차검증 진행/,
  );
  assert.match(
    visibleHtml,
    /class="appeal-badge-key">VOC해피콜<\/span>/,
  );
  assert.match(
    visibleHtml,
    /class="appeal-badge-key">신차해피콜<\/span>/,
  );
  assert.doesNotMatch(visibleHtml, /사후 보정 가능/);
  assert.doesNotMatch(visibleHtml, /일부 평가 불가/);
  assert.equal((visibleHtml.match(/<span>\/ 100점 만점<\/span>/g) ?? []).length, 2);
  assert.equal((visibleHtml.match(/<span>\/ 130점 만점<\/span>/g) ?? []).length, 1);
  assert.equal((visibleHtml.match(/<span>점 \/ (?:100|130)점 만점<\/span>/g) ?? []).length, 0);
  assert.equal((html.match(/class="metric-quarter-strip"/g) ?? []).length, 3);
  assert.equal(
    (html.match(/상세 영역으로 이동/g) ?? []).length,
    8,
  );
  assert.equal((html.match(/평가 미완료/g) ?? []).length, 4);
  const quarterStrips = [
    ...html.matchAll(/class="metric-quarter-strip"[^>]*>([\s\S]*?)<\/div>/g),
  ];
  assert.equal(quarterStrips.length, 3);
  quarterStrips.forEach(([, strip]) => assert.doesNotMatch(strip, /<strong/));
  assert.match(
    visibleHtml,
    /class="metric-benchmark"[\s\S]*?<strong class="negative caution">▼ \d+\.\d점<\/strong>/,
  );
  assert.doesNotMatch(
    visibleHtml,
    /class="metric-benchmark"[\s\S]*?<strong class="positive good">\+/,
  );
  const directionalResponse = await render("/dashboard/6KR6868");
  assert.equal(directionalResponse.status, 200);
  const directionalHtml = await directionalResponse.text();
  const directionalVisibleHtml = directionalHtml.replaceAll("<!-- -->", "");
  assert.match(
    directionalVisibleHtml,
    /class="metric-benchmark"[\s\S]*?<strong class="positive good">▲ 3\.1점<\/strong>/,
  );
  assert.match(
    directionalVisibleHtml,
    /class="metric-benchmark"[\s\S]*?<strong class="negative warning">▼ 18\.7점<\/strong>/,
  );
  assert.match(
    directionalVisibleHtml,
    /class="metric-benchmark"[\s\S]*?<strong class="positive good">▲ 8\.4점<\/strong>/,
  );
  assert.match(
    html,
    /aria-label="V3S 분기 평가점수"/,
  );
  assert.match(
    html,
    /aria-label="VOC 분기 평가점수"/,
  );
  assert.match(
    html,
    /aria-label="CX Index 분기 평가점수"/,
  );
  assert.match(html, /aria-pressed="true" aria-label="V3S Q2 상세 영역으로 이동"/);
  assert.match(html, /aria-pressed="true" aria-label="VOC Q3 상세 영역으로 이동"/);
  assert.match(html, /aria-pressed="true" aria-label="CX Index Q3 상세 영역으로 이동"/);
  assert.equal((html.match(/class="quarter-score-row/g) ?? []).length, 4);
  assert.equal((visibleHtml.match(/<small[^>]*>330점 만점<\/small>/g) ?? []).length, 2);
  assert.match(visibleHtml, /2026 누적 평균/);
  assert.doesNotMatch(visibleHtml, /상반기 누적 평균/);
  assert.match(visibleHtml, /Q1[\s\S]*302\.7/);
  assert.match(visibleHtml, /Q2[\s\S]*294\.9/);
  assert.match(visibleHtml, /Q3[\s\S]*Q4/);
  assert.doesNotMatch(visibleHtml, /Q2 종합 점수/);
  assert.match(visibleHtml, /누적 평균[\s\S]*298\.8/);
  assert.doesNotMatch(visibleHtml, /Q1·Q2 평가 기준/);
  assert.equal((html.match(/aria-label="Q[12] 지표 보기"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-label="Q3 평가 진행"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-label="Q4 평가 예정"/g) ?? []).length, 2);
  assert.match(visibleHtml, /Q2 전국 평균 <strong>305\.4/);
  assert.match(visibleHtml, /Q2 전국 평균 대비 <strong>-10\.5/);
  assert.match(visibleHtml, /전시장 경쟁력 전국 순위 <strong>32위 \/ 전체 39/);
  assert.doesNotMatch(visibleHtml, /<h2>[^<]*경쟁력<\/h2>/);
  assert.doesNotMatch(visibleHtml, /종합 전투력/);
  assert.doesNotMatch(visibleHtml, /볼보 전체 전시장|VOLVO KOREA/);
  assert.doesNotMatch(html, /class="group-context"/);
  assert.doesNotMatch(visibleHtml, /상위 83%/);
  assert.doesNotMatch(html, /class="combat-gauge"/);
  assert.doesNotMatch(visibleHtml, /WATCH|집중 관리 레벨|52-WEEK PULSE/);
  assert.doesNotMatch(visibleHtml, /카드를 선택하면 주간 흐름이 바뀝니다/);
  assert.match(html, /39(?:<!-- -->)?개점/);
  assert.match(html, /6KR6834/);
  assert.equal((html.match(/class="identity-icon /g) ?? []).length, 3);
  assert.match(html, /identity-icon--dealer/);
  assert.match(html, /identity-icon--region/);
  assert.match(html, /identity-icon--size/);
  assert.match(
    html,
    /href="\/dashboard\/6KR6834\/analysis\?view=dealer"/,
  );
  assert.match(
    html,
    /href="\/dashboard\/6KR6834\/analysis\?view=region"/,
  );
  assert.match(
    html,
    /href="\/dashboard\/6KR6834\/analysis\?view=size"/,
  );
  assert.doesNotMatch(visibleHtml, /⌂|◎|↔/);
  assert.doesNotMatch(html, /class="comparison-panel|class="comparison-table/);
  assert.match(visibleHtml, /권역별/);
  assert.match(visibleHtml, /<h1>볼보 강남대치 현황<\/h1>/);
  assert.match(visibleHtml, />볼보 강남대치<\/button>/);
  assert.match(visibleHtml, />주간 전국 평균<\/button>/);
  assert.doesNotMatch(
    visibleHtml,
    /실제값 · W26|입력 25주|직전 입력주 대비|미응답은 제외|공백은 응답 대기/,
  );
  assert.doesNotMatch(visibleHtml, /전국 주간 평균 · W26 91\.8점 · 평균 미달 11주/);
  assert.match(visibleHtml, /볼보 강남대치 스코어/);
  assert.doesNotMatch(visibleHtml, /52주 스코어 추이/);
  assert.doesNotMatch(visibleHtml, /주간 성과 흐름/);
  assert.doesNotMatch(html, /class="trend-selector"/);
  assert.doesNotMatch(html, /class="trend-selector-icon"/);
  assert.equal((html.match(/class="score-tier /g) ?? []).length, 3);
  assert.equal((html.match(/class="cx-component-chip"/g) ?? []).length, 5);
  assert.match(
    html,
    /aria-label="CX Index 평가 구성 항목"[\s\S]*?<b>01<\/b><span>신차출고 만족도<\/span>[\s\S]*?<b>02<\/b><span>시승 만족도<\/span>[\s\S]*?<b>03<\/b><span>긴급경보 처리여부<\/span>[\s\S]*?<b>04<\/b><span>조치 계획<\/span>[\s\S]*?<b>05<\/b><span>헤이볼보 앱 가입율<\/span>/,
  );
  assert.doesNotMatch(html, /<h3>분기 평가<\/h3>/);
  assert.doesNotMatch(visibleHtml, /분기 평가 흐름/);
  assert.match(visibleHtml, /5개년 추이/);
  assert.doesNotMatch(html, /class="v3s-history-delta/);
  assert.doesNotMatch(visibleHtml, /5년간 [+-]?\d/);
  assert.doesNotMatch(visibleHtml, /5개년 실력 추세/);
  assert.doesNotMatch(visibleHtml, /5개년 데이터 연결 예정/);
  assert.equal((html.match(/class="v3s-history-bar-fill"/g) ?? []).length, 5);
  assert.equal(
    (html.match(/class="v3s-history-national-bar-fill"/g) ?? []).length,
    5,
  );
  assert.match(
    visibleHtml,
    /2021년 전국 평균 94\.7점[\s\S]*?2022년 전국 평균 93\.9점[\s\S]*?2023년 전국 평균 95\.9점[\s\S]*?2024년 전국 평균 95\.6점[\s\S]*?2025년 전국 평균 95\.0점/,
  );
  assert.match(visibleHtml, /전국 평균[\s\S]*?볼보 강남대치/);
  assert.match(visibleHtml, /볼보 5개년 평균 95\.0/);
  assert.doesNotMatch(visibleHtml, /5개년 평균 94\.2/);
  assert.doesNotMatch(html, /class="v3s-history-summary"/);
  assert.match(visibleHtml, /Volvo Sales Skill Simulation 평가\(VCK\)/);
  assert.match(
    visibleHtml,
    /Customer Experience Index · 고객경험 종합지수\(글로벌\)/,
  );
  assert.doesNotMatch(visibleHtml, /Volvo Sales Standard/);
  assert.match(
    html,
    /id="score-v3s"[\s\S]*?id="score-voc"[\s\S]*?id="score-cx"/,
  );
  assert.match(html, /class="v3s-performance compact"/);
  assert.equal((html.match(/class="trend-wrap compact"/g) ?? []).length, 2);
  assert.equal((html.match(/class="weekly-score-layout"/g) ?? []).length, 2);
  assert.match(
    html,
    /aria-label="볼보 강남대치 상담 만족도 4개년 비교"[\s\S]*?상담 만족도 4개년 추이/,
  );
  assert.match(
    html,
    /class="voc-response-rate-line-layer"[\s\S]*?<polyline points="[^"]+"[\s\S]*?class="voc-response-rate-point/,
  );
  assert.doesNotMatch(html, /class="voc-response-rate-panel"/);
  assert.match(html, /aria-label="ONE VOICE 만족도"[\s\S]*?ONE VOICE/);
  const v3sStart = html.indexOf('id="score-v3s"');
  const vocStart = html.indexOf('id="score-voc"');
  assert.ok(v3sStart >= 0 && vocStart > v3sStart);
  const v3sHtml = html.slice(v3sStart, vocStart);
  assert.equal((v3sHtml.match(/class="v3s-quarter-column /g) ?? []).length, 4);
  assert.match(v3sHtml, />Q3<[\s\S]*?>Q4</);
  assert.doesNotMatch(v3sHtml, /Q3 평가진행/);
  assert.doesNotMatch(html, /show-values-toggle/);
  assert.doesNotMatch(visibleHtml, /모든 값 표시/);
  assert.doesNotMatch(html, /class="segmented"/);
  const cxStart = html.indexOf('id="score-cx"');
  assert.ok(vocStart >= 0 && cxStart > vocStart);
  const vocHtml = html.slice(vocStart, cxStart);
  assert.match(vocHtml, /W01–W13\(13주\)/);
  assert.match(vocHtml, /W14–W26\(13주\)/);
  assert.match(vocHtml, /W27–W39\(13주\)/);
  assert.match(vocHtml, /W40–W52\(13주\)/);
  for (let week = 1; week <= 52; week += 1) {
    assert.match(vocHtml, new RegExp(`W${String(week).padStart(2, "0")}`));
  }
  assert.match(vocHtml, /r="3.15" class="national-average-point"/);
  const actualMarkerWeeks = [
    ...vocHtml.matchAll(
      /width="6.3" height="6.3" data-week="(W\d{2})" class="actual-week-point"/g,
    ),
  ].map((match) => match[1]);
  assert.equal(actualMarkerWeeks.length, 29);
  assert.deepEqual(
    actualMarkerWeeks,
    Array.from({ length: 29 }, (_, index) =>
      `W${String(index + 1).padStart(2, "0")}`,
    ),
  );
  const actualLabelCount = (vocHtml.match(/class="actual-point-value"/g) ?? []).length;
  assert.equal(actualLabelCount, 29);
  assert.equal((vocHtml.match(/class="national-point-value"/g) ?? []).length, 29);
  assert.match(vocHtml, /aria-label="W01부터 시작하는 52주 성과 그래프"/);
  assert.match(vocHtml, /class="future-window"/);
  assert.match(visibleHtml, /Q3 평가 진행 중/);
  assert.match(vocHtml, /class="future-window future-window-upcoming"/);
  assert.match(visibleHtml, /Q4 평가 예정 중/);
  assert.match(visibleHtml, /데이터 집계 후 자동 반영됩니다\./);
  assert.doesNotMatch(vocHtml, /class="average-label"|class="point-value"/);
  assert.match(vocHtml, /class="coverage-line actual"/);
  assert.match(vocHtml, /class="coverage-line national"/);
  assert.doesNotMatch(vocHtml, /class="trend-line-base"/);
  assert.match(vocHtml, /class="trend-line"/);
  assert.doesNotMatch(html, /class="comparison-bar"|class="table-row/);
  assert.doesNotMatch(visibleHtml, /딜러 · 권역 · 사이즈|점수 차이/);
  assert.doesNotMatch(visibleHtml, /볼보 강남대치 경쟁력/);
  assert.doesNotMatch(visibleHtml, /COMPETITIVE POSITION/);
  assert.match(html, /aria-label="VOC 분기 평가점수"/);
  assert.match(html, /위험 감지: Q3 전국 평균 대비 5점 이상 미달/);
  assert.match(visibleHtml, /위험 감지/);
  assert.match(html, /주의 필요: Q2 전국 평균 미만, 5점 미만 차이/);
  assert.equal((visibleHtml.match(/>주의 필요<\/span>/g) ?? []).length, 2);
  assert.match(visibleHtml, /Q3 전국 평균 대비[\s\S]*?▼ 8\.7점/);
  assert.match(visibleHtml, /Q1/);
  assert.match(visibleHtml, /Q4/);
  assert.doesNotMatch(visibleHtml, /보정 검토 센터|ACTION CENTER|Outlook으로 보정 요청/);
  assert.doesNotMatch(visibleHtml, /전국 평균 미달 지표 [0-9]+개 감지|주간 흐름 확인/);
  assert.doesNotMatch(visibleHtml, /EDIT 권한|PRIVATE · 관리자 전용/);
  assert.doesNotMatch(visibleHtml, /MY SHOWROOM|전시장의 현재 위상/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("serves score criteria as a separate CDSID page", async () => {
  const response = await render("/dashboard/6KR6834/criteria");
  assert.equal(response.status, 200);

  const html = await response.text();
  const visibleHtml = html.replaceAll("<!-- -->", "");
  assert.doesNotMatch(visibleHtml, /DUAL METRIC POSITION/);
  assert.match(visibleHtml, /평가 기준 한눈에 보기/);
  assert.match(visibleHtml, /V3S · VOC · CX Index의 산정 구조/);
  assert.match(html, /href="\/dashboard\/6KR6834"/);
  assert.match(visibleHtml, /500점을 100점으로 환산/);
});

test("serves the dual-metric competitive analysis sample", async () => {
  const response = await render(
    "/dashboard/6KR6834/analysis?view=dealer",
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  const visibleHtml = html.replaceAll("<!-- -->", "");
  assert.match(
    visibleHtml,
    /<footer><span>에이치 평균<strong>93\.6<\/strong><\/span><span>볼보 강남대치 평균<strong>93\.8<\/strong><\/span><span class="analysis-average-delta delta-positive">평균 대비<strong>▲ 0\.2점<\/strong><\/span><\/footer>/,
  );
  assert.match(visibleHtml, /전국 39개소/);
  assert.match(visibleHtml, /수도권 19개소/);
  assert.match(visibleHtml, /U 7개소/);
  assert.doesNotMatch(html, /class="analysis-back|class="analysis-back-icon"/);
  const kolonResponse = await render(
    "/dashboard/6KR6861/analysis?view=dealer",
  );
  assert.equal(kolonResponse.status, 200);
  const kolonVisibleHtml = (await kolonResponse.text()).replaceAll(
    "<!-- -->",
    "",
  );
  assert.match(kolonVisibleHtml, /코오롱 9개소/);
  assert.match(
    visibleHtml,
    /<header class="dashboard-identity-header analysis-header"><div class="identity-title analysis-title"><h1>볼보 강남대치 분석<\/h1>/,
  );
  assert.match(
    visibleHtml,
    /href="\/dashboard\/6KR6834" class="analysis-context-item" aria-label="볼보 강남대치 현황으로 이동"/,
  );
  assert.doesNotMatch(visibleHtml, /볼보 강남대치 경쟁력 분석|<span>Q2<\/span>/);
  assert.match(visibleHtml, /소속 딜러사 내 분석/);
  assert.match(visibleHtml, /전국 전시장 내 분석/);
  assert.match(visibleHtml, /동일 권역별 내 분석/);
  assert.match(visibleHtml, /동일 사이즈 내 분석/);
  assert.match(
    html,
    /aria-pressed="true"[\s\S]*?소속 딜러사 내 분석/,
  );
  assert.match(visibleHtml, /종합 만족도 × 해피콜 이행/);
  assert.match(visibleHtml, /종합 만족도[\s\S]*87\.5/);
  assert.match(
    visibleHtml,
    /에이치 평균 93\.4점 대비 -5\.9점/,
  );
  assert.match(visibleHtml, /VOC \+ ONE Voice \/ 상담 및 출고 후 만족도 평가/);
  assert.doesNotMatch(visibleHtml, /VOC · 상담\/시승\/출고 경험/);
  assert.match(visibleHtml, /해피콜 이행[\s\S]*100\.0/);
  assert.match(
    visibleHtml,
    /에이치 평균 93\.8점 대비 \+6\.2점/,
  );
  assert.match(
    visibleHtml,
    /VOC \+ ONE Voice \/ 상담 및 출고 후 해피콜 시행여부/,
  );
  assert.doesNotMatch(visibleHtml, /상담\/출고 사후관리 실행력/);
  assert.match(visibleHtml, /균형 경쟁력[\s\S]*93\.8/);
  assert.match(visibleHtml, /종합 만족도와 해피콜 합산 평균/);
  assert.doesNotMatch(visibleHtml, /종합 만족도와 해피콜 단순 평균/);
  assert.match(visibleHtml, /만족도[\s\S]*해피콜[\s\S]*합산 평균/);
  assert.match(visibleHtml, /<h2>에이치 내 순위<\/h2>/);
  assert.match(html, /class="analysis-scatter"/);
  assert.equal((html.match(/class="scatter-zone /g) ?? []).length, 2);
  assert.match(
    html.replaceAll("<!-- -->", ""),
    /class="scatter-average-value vertical"><span>해피콜 이행<\/span><strong>평균 \d+\.\d점<\/strong>/,
  );
  assert.match(
    html.replaceAll("<!-- -->", ""),
    /class="scatter-average-value horizontal"><span>종합 만족도<\/span><strong>평균 \d+\.\d점<\/strong>/,
  );
  assert.equal((html.match(/class="scatter-point /g) ?? []).length, 7);
  assert.doesNotMatch(html, /scatter-callout-leader/);
  assert.match(html, /class="scatter-point selected\b/);
  const dealerTailValues = [
    ...html.matchAll(/--callout-tail-[xy]:(\d+(?:\.\d+)?)px/g),
  ].map((match) => Number(match[1]));
  assert.ok(dealerTailValues.length >= 14);
  assert.ok(dealerTailValues.every((value) => value >= 3 && value <= 14));
  assert.equal(
    (html.match(/class="scatter-label comparison"/g) ?? []).length,
    6,
  );
  assert.equal((html.match(/class="analysis-rank"/g) ?? []).length, 7);
  assert.match(visibleHtml, /볼보 분당/);
  assert.match(
    html,
    /href="\/dashboard\/6KR6834" class="analysis-context-item"/,
  );

  const regionResponse = await render(
    "/dashboard/6KR6834/analysis?view=region",
  );
  assert.equal(regionResponse.status, 200);
  const regionVisibleHtml = (await regionResponse.text()).replaceAll(
    "<!-- -->",
    "",
  );
  assert.match(
    regionVisibleHtml,
    /<article class="analysis-ranking-card"><header class="analysis-card-heading"><div><h2>/,
  );
  assert.match(regionVisibleHtml, /<h2>수도권 내 순위<\/h2>/);
  const analysisContextHtml = regionVisibleHtml.match(
    /<div class="analysis-context"[^>]*>([\s\S]*?)<\/div><\/header>/,
  )?.[1];
  assert.ok(analysisContextHtml);
  assert.equal(
    (analysisContextHtml.match(/class="analysis-context-item"/g) ?? []).length,
    4,
  );
  assert.match(
    regionVisibleHtml,
    /class="identity-title analysis-title"[\s\S]*?class="update-status"[\s\S]*?<time dateTime="\d{4}-\d{2}-\d{2}">업데이트 [\d.]+ 기준<\/time>[\s\S]*?Q1, Q2 마감, 현재 Q3평가 진행중/,
  );
  assert.match(analysisContextHtml, /identity-icon--dealer/);
  assert.match(analysisContextHtml, /identity-icon--region/);
  assert.match(analysisContextHtml, /identity-icon--size/);
  assert.match(analysisContextHtml, /identity-profile-icon/);
  assert.equal((analysisContextHtml.match(/<a\b/g) ?? []).length, 4);
  assert.doesNotMatch(analysisContextHtml, /<button\b|onclick=/i);
  assert.match(regionVisibleHtml, /<footer><span>동일 권역별 평균/);
  assert.match(regionVisibleHtml, /권역별 10위 \/ 전체 19/);
  assert.match(regionVisibleHtml, /볼보 강남신사/);
  assert.match(regionVisibleHtml, /볼보 분당판교/);
  assert.doesNotMatch(regionVisibleHtml, /볼보 강남 신사|볼보 분당 판교/);
  assert.doesNotMatch(
    regionVisibleHtml,
    /동일 권역 소재 전시장 안에서 현재 위치와 균형을 확인합니다/,
  );
  assert.match(regionVisibleHtml, /V3S 인센티브 수상기록/);
  assert.match(
    regionVisibleHtml,
    /상반기\(Q1, Q2 모두 97점 이상 시\) 하반기\(Q3, Q4 모두 97점 이상 시\) 지급/,
  );
  assert.doesNotMatch(
    regionVisibleHtml,
    /2021년 상반기부터 2026년 하반기까지의 반기별 수상 이력/,
  );
  assert.match(
    regionVisibleHtml,
    /누적기록<\/span><strong>강남대치 1회 수상<\/strong>/,
  );
  assert.match(
    regionVisibleHtml,
    /2021[\s\S]*?상반기[\s\S]*?수상 기록 없음[\s\S]*?하반기[\s\S]*?강남대치/,
  );
  assert.match(
    regionVisibleHtml,
    /2026[\s\S]*?상반기[\s\S]*?수상 기록 없음[\s\S]*?하반기[\s\S]*?수상 기록 없음/,
  );
  assert.doesNotMatch(
    regionVisibleHtml,
    /v3s-award-period awarded[\s\S]*?볼보 강남대치/,
  );

  const wonjuResponse = await render(
    "/dashboard/6KR6851/analysis?view=size",
  );
  assert.equal(wonjuResponse.status, 200);
  const wonjuHtml = (await wonjuResponse.text()).replaceAll("<!-- -->", "");
  assert.match(wonjuHtml, /누적기록<\/span><strong>원주 9회 수상<\/strong>/);
  assert.equal(
    (wonjuHtml.match(/class="v3s-award-period awarded"/g) ?? []).length,
    9,
  );
  assert.match(
    wonjuHtml,
    /2022[\s\S]*?상반기[\s\S]*?원주[\s\S]*?하반기[\s\S]*?원주/,
  );
  assert.match(
    wonjuHtml,
    /2026[\s\S]*?상반기[\s\S]*?원주[\s\S]*?하반기[\s\S]*?수상 기록 없음/,
  );

  const sizeResponse = await render(
    "/dashboard/6KR6842/analysis?view=size",
  );
  assert.equal(sizeResponse.status, 200);
  const sizeHtml = await sizeResponse.text();
  assert.match(
    sizeHtml.replaceAll("<!-- -->", ""),
    /<footer><span>동일 사이즈 평균/,
  );
  assert.match(sizeHtml, /scatter-point [^"]*dense/);
  assert.match(sizeHtml, /scatter-label comparison/);
  assert.match(sizeHtml, /style="opacity:1;visibility:visible"/);
  assert.match(sizeHtml, /볼보 해운대/);

  const gangnamSizeResponse = await render(
    "/dashboard/6KR6834/analysis?view=size",
  );
  assert.equal(gangnamSizeResponse.status, 200);
  const gangnamSizeHtml = await gangnamSizeResponse.text();
  assert.match(gangnamSizeHtml, /<h2>U 사이즈 내 순위<\/h2>/);

  const showroomResponse = await render(
    "/dashboard/6KR6834/analysis?view=showroom",
  );
  assert.equal(showroomResponse.status, 200);
  const showroomHtml = await showroomResponse.text();
  assert.match(
    showroomHtml.replaceAll("<!-- -->", ""),
    /<footer><span>전국 전시장 평균<strong>94\.6<\/strong><\/span><span>볼보 강남대치 평균<strong>93\.8<\/strong><\/span><span class="analysis-average-delta delta-negative">평균 대비<strong>▼ 0\.8점<\/strong><\/span><\/footer>/,
  );
  assert.match(
    showroomHtml.replaceAll("<!-- -->", ""),
    /class="analysis-ranking-head"[^>]*>[\s\S]*?종합 만족도[\s\S]*?해피콜 이행[\s\S]*?합산 평균/,
  );
  const showroomRankingHtml = showroomHtml.match(
    /class="analysis-ranking-list">([\s\S]*?)<\/div><footer>/,
  )?.[1];
  assert.ok(showroomRankingHtml);
  assert.match(showroomHtml, /<h2>전국 전시장 내 순위<\/h2>/);
  assert.deepEqual(
    [
      ...showroomRankingHtml.matchAll(
        /class="analysis-rank"><strong>(\d+)<\/strong>/g,
      ),
    ].map((match) => Number(match[1])),
    [22, 23, 24, 25, 26, 27, 28],
  );
  assert.match(
    showroomRankingHtml,
    /class="selected"[\s\S]*?class="analysis-rank"><strong>25<\/strong>[\s\S]*?볼보 강남대치/,
  );
  assert.equal(
    (showroomHtml.match(/class="scatter-label comparison"/g) ?? []).length,
    38,
  );
  assert.equal(
    (showroomHtml.match(/style="opacity:1;visibility:visible"/g) ?? []).length,
    39,
  );
  assert.doesNotMatch(showroomHtml, /scatter-callout-leader|--leader-angle/);
  assert.match(showroomHtml.replaceAll("<!-- -->", ""), /전시장 25위 \/ 전체 39/);
  assert.doesNotMatch(showroomHtml.replaceAll("<!-- -->", ""), /전국 전시장 25위 \/ 전체 39/);
  assert.match(
    showroomHtml.replaceAll("<!-- -->", ""),
    /전국 39개 전시장 평균 96\.2점 대비 -8\.7점/,
  );
  assert.match(
    showroomHtml.replaceAll("<!-- -->", ""),
    /전국 39개 전시장 평균 92\.9점 대비 \+7\.1점/,
  );
});

test("ships project metadata and removes the disposable starter", async () => {
  const [page, dashboardPage, criteriaPage, analysisPage, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/[cdsid]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/[cdsid]/criteria/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/[cdsid]/analysis/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /LoginHome/);
  assert.doesNotMatch(page, /knownCdsids/);
  assert.match(dashboardPage, /import Dashboard/);
  assert.match(dashboardPage, /isEditorEmail/);
  assert.match(criteriaPage, /CriteriaGuide/);
  assert.match(analysisPage, /CompetitiveAnalysis/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /볼보 관리자 전용/);
  assert.match(layout, /og\.png/);
  assert.match(layout, /lang="ko"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(
    access(new URL("../app/_sites-preview", templateRoot)),
  );
});

test("ships Google Sheet weekly VOC and calculated CX series", async () => {
  const [weeklyText, syncSource, dashboardSource] = await Promise.all([
    readFile(new URL("../app/data/weekly.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/sync-google-sheet-data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
  ]);
  const weekly = JSON.parse(weeklyText);

  assert.equal(weekly.meta.vocLatestWeek, 29);
  assert.equal(weekly.meta.cxLatestWeek, 30);
  assert.equal(weekly.meta.weekRanges.length, 52);
  assert.deepEqual(weekly.meta.weekRanges[0], {
    week: 1,
    start: "25.12.28",
    end: "26.01.03",
  });
  assert.deepEqual(weekly.meta.weekRanges[19], {
    week: 20,
    start: "26.05.10",
    end: "26.05.16",
  });
  assert.deepEqual(weekly.meta.weekRanges[51], {
    week: 52,
    start: "26.12.20",
    end: "26.12.26",
  });
  assert.equal(Object.keys(weekly.voc.byCdsid).length, 39);
  assert.equal(Object.keys(weekly.cx.byCdsid).length, 39);
  assert.equal(weekly.voc.byCdsid["6KR6834"][0], 0);
  assert.equal(weekly.voc.byCdsid["6KR6834"][1], 100);
  assert.equal(weekly.voc.byCdsid["6KR6834"][2], 94);
  assert.equal(weekly.voc.byCdsid["6KR6834"][3], 90);
  assert.equal(
    weekly.voc.byCdsid["6KR6834"]
      .slice(0, 29)
      .filter((value) => value !== null).length,
    29,
  );
  assert.equal(
    weekly.voc.byCdsid["6KR6834"]
      .slice(0, 29)
      .filter((value) => value === 0).length,
    15,
  );
  assert.equal(weekly.voc.byCdsid["6KR6834"][13], 64);
  assert.equal(weekly.voc.byCdsid["6KR6834"][16], 64);
  assert.equal(weekly.voc.byCdsid["6KR6834"][25], 100);
  assert.equal(weekly.voc.byCdsid["6KR6834"][26], 100);
  assert.equal(weekly.voc.byCdsid["6KR6834"][27], 96);
  assert.equal(weekly.voc.byCdsid["6KR6834"][28], 0);
  assert.equal(
    weekly.meta.rules.voc,
    "VOC(결과) 시트의 전시장별 원점수를 사용하며, 0.0도 실제 점수로 표시",
  );
  assert.match(
    syncSource,
    /const voc = weeklyResult\(loaded\.voc\);/,
  );
  assert.doesNotMatch(syncSource, /zeroUsesDealerAverage/);
  assert.match(
    dashboardSource,
    /const storeSegments = \[rawPoints\]/,
  );
  assert.equal(weekly.cx.byCdsid["6KR6834"][0], 80);
  assert.equal(weekly.cx.byCdsid["6KR6834"][29], 90);
  assert.equal(weekly.cx.byCdsid["6KR6834"][30], null);
});

test("aligns every quarter boundary to the same 52-week grid", async () => {
  const [dashboardSource, css] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    dashboardSource,
    /signal\.delta > 0[\s\S]*?"positive"[\s\S]*?signal\.delta < 0[\s\S]*?"negative"/,
  );
  assert.match(
    dashboardSource,
    /signal\.delta > 0 \? "▲" : signal\.delta < 0 \? "▼" : "―"/,
  );

  assert.match(
    dashboardSource,
    /const chartWidth = compact \? measuredChartWidth : 1360/,
  );
  assert.match(
    dashboardSource,
    /const resizeObserver = new ResizeObserver\(updateWidth\)/,
  );
  assert.match(dashboardSource, /const chartHeight = compact \? 150 : 210/);
  assert.match(
    css,
    /\.v3s-performance\.compact \.v3s-quarter-panel,[\s\S]*?min-height: 172px/,
  );
  assert.match(
    css,
    /\.v3s-history-panel\s*\{[^}]*position: relative;[^}]*overflow: hidden;[^}]*background: #ffffff;/,
  );
  assert.match(
    css,
    /\.v3s-history-panel::after\s*\{[^}]*content: none;/,
  );
  assert.match(
    css,
    /\.trend-wrap\.compact \.trend-chart\s*\{[^}]*height: 150px/,
  );
  assert.match(
    css,
    /\.weekly-score-layout > \.trend-wrap\s*\{[^}]*position: relative/,
  );
  assert.match(
    css,
    /\.score-tier-weekly \.trend-wrap\.compact \.data-coverage\s*\{[^}]*position: absolute[^}]*top: -31px[^}]*right: 0[^}]*border-top: 0/,
  );
  assert.match(
    css,
    /\.score-tier-weekly \.score-tier-heading\s*\{[^}]*padding-right: 230px/,
  );
  assert.match(
    css,
    /\.voc-component-tabs,\s*\.cx-component-tabs\s*\{[^}]*width: 100%[^}]*max-width: 556px[^}]*flex: 0 1 556px/,
  );
  assert.match(
    css,
    /\.voc-component-tabs\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    css,
    /\.cx-component-tabs\s*\{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    dashboardSource,
    /const plotLeft = \(28 \/ 1360\) \* chartWidth/,
  );
  assert.match(
    dashboardSource,
    /const plotRight = compact \? chartWidth : chartWidth - plotLeft/,
  );
  assert.match(
    dashboardSource,
    /plotLeft \+ \(\(week - 0\.5\) \/ 52\) \* plotWidth/,
  );
  assert.match(
    dashboardSource,
    /const quarterDividers = \[13, 26, 39\]/,
  );
  assert.match(
    dashboardSource,
    /const weekBoundaryX = \(completedWeeks: number\) =>[\s\S]*?plotLeft \+ \(completedWeeks \/ 52\) \* plotWidth/,
  );
  assert.match(
    dashboardSource,
    /const evaluationProgressWeek = Math\.max\(26, Math\.min\(latestWeek, 39\)\)/,
  );
  assert.match(dashboardSource, /const activeQuarterStart = weekBoundaryX\(26\)/);
  assert.match(dashboardSource, /const activeQuarterEnd = weekBoundaryX\(39\)/);
  assert.match(
    dashboardSource,
    /const highlightedQuarterStartWeek =\s*highlightQuarter === "q1" \? 0 : highlightQuarter === "q2" \? 13 : 26/,
  );
  assert.match(
    dashboardSource,
    /const highlightedQuarterEndWeek = highlightedQuarterStartWeek \+ 13/,
  );
  assert.match(
    dashboardSource,
    /x=\{weekBoundaryX\(highlightedQuarterStartWeek\)\}[\s\S]*?weekBoundaryX\(highlightedQuarterEndWeek\) -\s*weekBoundaryX\(highlightedQuarterStartWeek\)/,
  );
  assert.match(
    dashboardSource,
    /x1=\{weekBoundaryX\(completedWeeks\)\}[\s\S]*?data-week-boundary=\{completedWeeks\}/,
  );
  assert.match(dashboardSource, /preserveAspectRatio="none"/);
  assert.match(
    dashboardSource,
    /width=\{activeQuarterEnd - activeQuarterStart\}/,
  );
  assert.match(
    dashboardSource,
    /className="future-window"[\s\S]*?className="average-trend-line"[\s\S]*?className="trend-line"/,
  );
  assert.doesNotMatch(dashboardSource, /isMajorWeek/);
  assert.match(dashboardSource, /\{label\}\s*<\/span>/);
  assert.match(
    dashboardSource,
    /W\$\{String\(hoverWeek\)\.padStart\(2, "0"\)\}[\s\S]*?\$\{hoverWeekRange\.start\} ~ \$\{hoverWeekRange\.end\}/,
  );
  assert.match(
    dashboardSource,
    /<span>\{quarterLabel\} 전국 평균 대비<\/span>/,
  );
  assert.match(
    dashboardSource,
    /const \[selectedQuarter, setSelectedQuarter\] =\s*useState<QuarterKey>\("q2"\)/,
  );
  assert.match(
    dashboardSource,
    /Record<TrendMetricKey, QuarterKey>[\s\S]*?\{ v3s: "q2", voc: "q3", cx: "q3" \}/,
  );
  assert.match(
    dashboardSource,
    /setMetricQuarters\(\(current\) => \(\{ \.\.\.current, \[metric\]: quarter \}\)\);[\s\S]*?if \(metric === "v3s"\) return;[\s\S]*?window\.scrollTo\(\{[\s\S]*?behavior: "smooth"/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /document\.getElementById\(`score-\$\{metric\}`\)\?\.scrollIntoView/,
  );
  assert.match(
    dashboardSource,
    /className="section-heading score-stack-heading"/,
  );
  assert.match(
    css,
    /\.score-stack-heading\s*\{[^}]*position: sticky[^}]*top: var\(--dashboard-sticky-offset, 356px\)/,
  );
  assert.match(dashboardSource, /function V3SPerformance/);
  assert.doesNotMatch(
    dashboardSource,
    /label: "Q3"[\s\S]{0,180}?statusText: "Q3 평가진행"/,
  );
  assert.match(
    dashboardSource,
    /label: "Q3"[\s\S]{0,180}?statusText: "평가 진행"/,
  );
  assert.match(
    dashboardSource,
    /label: "Q3"[\s\S]{0,220}?state: "in-progress"/,
  );
  assert.match(
    dashboardSource,
    /label: "Q4"[\s\S]{0,180}?statusText: "평가 예정"/,
  );
  assert.match(
    dashboardSource,
    /label: "Q4"[\s\S]{0,220}?state: "upcoming"/,
  );
  assert.match(
    dashboardSource,
    /className="future-window"[\s\S]{0,500}?Q3 평가 진행 중/,
  );
  assert.match(
    dashboardSource,
    /className="future-window future-window-upcoming"[\s\S]{0,500}?Q4 평가 예정 중/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /className="v3s-quarter-label"[\s\S]{0,140}?<span>/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /className="v3s-quarter-label"[\s\S]{0,140}?<small>/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /className="v3s-quarter-label"[\s\S]{0,180}?`전국 \$\{displayNumber\(quarter\.average\)\}`/,
  );
  assert.match(
    dashboardSource,
    /className="v3s-upcoming-bar"[\s\S]*?<b>\{quarter\.statusText\}<\/b>/,
  );
  assert.match(dashboardSource, /const groupQuarterAverageOf/);
  assert.match(
    dashboardSource,
    /groupQuarterAverageOf\(showroom, "v3s", quarter, "dealer"\)/,
  );
  assert.match(
    dashboardSource,
    /groupQuarterAverageOf\(showroom, "v3s", quarter, "region"\)/,
  );
  assert.match(
    dashboardSource,
    /groupQuarterAverageOf\(showroom, "v3s", quarter, "size"\)/,
  );
  assert.match(dashboardSource, /className="v3s-bar-cluster"/);
  assert.match(dashboardSource, /className="v3s-peer-bar-group"/);
  assert.match(dashboardSource, /className=\{`v3s-peer-bar/);
  assert.match(
    dashboardSource,
    /benchmark\.value !== null[\s\S]*?<b>\{displayNumber\(benchmark\.value\)\}<\/b>/,
  );
  assert.match(
    dashboardSource,
    /className="v3s-bar-cluster"[\s\S]*?quarter\.benchmarks\.map[\s\S]*?className="v3s-bar-fill"/,
  );
  assert.match(dashboardSource, /className="v3s-peer-legend"/);
  assert.match(dashboardSource, /className=\{`legend-peer \$\{benchmark\.key\}`\}/);
  assert.match(
    dashboardSource,
    /className="v3s-quarter-legend"[\s\S]*?peerBenchmarks\("q2"\)\.map[\s\S]*?className=\{`legend-peer \$\{benchmark\.key\}`\}[\s\S]*?className="legend-bar"[\s\S]*?displayShowroomName\(showroom\.showroom\)/,
  );
  assert.match(
    dashboardSource,
    /id="score-v3s"[\s\S]*?id="score-voc"[\s\S]*?id="score-cx"/,
  );
  assert.match(
    dashboardSource,
    /<V3SPerformance[\s\S]*?showroom=\{selected\}[\s\S]*?compact[\s\S]*?highlightQuarter=/,
  );
  assert.doesNotMatch(dashboardSource, /analysis\?view=showroom/);
  assert.doesNotMatch(dashboardSource, /2026 PERFORMANCE/);
  assert.doesNotMatch(dashboardSource, /2021–2025 HISTORY/);
  assert.match(dashboardSource, /import v3sHistoryJson from "\.\/data\/v3s-history\.json"/);
  const v3sHistoryData = JSON.parse(
    await readFile(new URL("../app/data/v3s-history.json", import.meta.url), "utf8"),
  );
  assert.equal(Object.keys(v3sHistoryData).length, 39);
  assert.deepEqual(
    v3sHistoryData["6KR6834"].map((point) => point.value),
    [94.3, 94.3, 93.6, 94.3, 94.6],
  );
  assert.doesNotMatch(dashboardSource, /5개년 데이터 연결 예정/);
  assert.doesNotMatch(dashboardSource, /historyDelta|v3s-history-delta/);
  assert.doesNotMatch(dashboardSource, /const historyPath = history/);
  assert.doesNotMatch(dashboardSource, /v3s-history-summary/);
  assert.match(
    dashboardSource,
    /const historyScaleHeight[\s\S]*?v3s-history-average-marker[\s\S]*?v3s-history-bar-fill/,
  );
  assert.match(
    dashboardSource,
    /const nationalV3sFiveYearValues = nationalV3sQuarterAverages\.flatMap[\s\S]*?const nationalV3sFiveYearAverage =[\s\S]*?nationalV3sFiveYearValues\.reduce[\s\S]*?nationalV3sFiveYearValues\.length/,
  );
  assert.match(
    dashboardSource,
    /item\.cdsid\.padEnd\(showroomCodeWidth, "\\u2007"\)/,
  );
  assert.match(
    dashboardSource,
    /historicalV3s\?: HistoricalV3sPoint\[\]/,
  );
  assert.match(
    dashboardSource,
    /quarterValueOf\(selected, "v3s", metricQuarters\.v3s\)/,
  );
  assert.match(
    dashboardSource,
    /quarterAverageOf\("v3s", metricQuarters\.v3s\)/,
  );
  assert.match(
    dashboardSource,
    /key=\{`showroom-score-\$\{selected\.cdsid\}`\}/,
  );
  assert.match(
    dashboardSource,
    /key=\{`showroom-trend-\$\{selected\.cdsid\}`\}/,
  );
  assert.match(css, /\.quarter-band\s*\{[\s\S]*?margin: 0 2\.0588235%/);
  assert.match(css, /\.week-ruler\s*\{[\s\S]*?margin: -18px 2\.0588235% 8px/);
  assert.match(css, /\.week-grid\s*\{[\s\S]*?stroke-width: 0\.6/);
  assert.match(css, /\.average-trend-line\s*\{[\s\S]*?stroke-width: 1\.45/);
  assert.match(
    css,
    /\.average-trend-line\s*\{[\s\S]*?stroke-width: 1\.45[\s\S]*?stroke-dasharray: 3 3[\s\S]*?animation: none/,
  );
  assert.match(
    css,
    /\.coverage-line::after\s*\{[^}]*width: 6px[^}]*height: 6px[^}]*left: 50%[^}]*border: 1\.5px solid currentColor[^}]*background: white[^}]*translate\(-50%, -50%\)/,
  );
  assert.match(
    css,
    /\.coverage-line\.national::after\s*\{[^}]*border-radius: 50%/,
  );
  assert.match(
    css,
    /\.future-window\s*\{[\s\S]*?fill: #eef2f5[\s\S]*?opacity: 0\.9/,
  );
  assert.match(css, /\.future-window-label\s*\{[\s\S]*?fill: #596b80/);
  assert.match(css, /\.future-window-help\s*\{[\s\S]*?fill: #8795a7/);
  assert.match(
    css,
    /\.trend-line\s*\{[\s\S]*?stroke-width: 1\.8[\s\S]*?stroke-dasharray: none[\s\S]*?stroke-linecap: round[\s\S]*?stroke-linejoin: round[\s\S]*?opacity: 1/,
  );
  assert.match(
    dashboardSource,
    /className=\{`actual-series-wipe[\s\S]*?className="trend-line"[\s\S]*?className="actual-week-point"[\s\S]*?className="actual-point-value"/,
  );
  const actualTrendPolyline = dashboardSource.match(
    /<polyline\s+points=\{segment[\s\S]*?className="trend-line"\s*\/>/,
  )?.[0];
  assert.ok(actualTrendPolyline);
  assert.doesNotMatch(actualTrendPolyline, /pathLength=/);
  assert.doesNotMatch(dashboardSource, /pointAnimationDelay|chartAnimationStart/);
  assert.match(
    dashboardSource,
    /key=\{`\$\{selected\.cdsid\}-voc`\}[\s\S]*?metric="voc"[\s\S]*?compact/,
  );
  assert.match(
    dashboardSource,
    /key=\{`\$\{selected\.cdsid\}-cx`\}[\s\S]*?metric="cx"[\s\S]*?compact/,
  );
  assert.match(
    dashboardSource,
    /const markerSize = 6\.3;[\s\S]*?const markerRadius = markerSize \/ 2;/,
  );
  assert.match(
    dashboardSource,
    /width=\{markerSize\}[\s\S]*?height=\{markerSize\}/,
  );
  assert.equal((dashboardSource.match(/r=\{markerRadius\}/g) ?? []).length, 3);
  assert.match(
    css,
    /\.actual-series-wipe\s*\{[^}]*clip-path: inset\(0 100% 0 0\)[^}]*will-change: clip-path/,
  );
  assert.match(
    css,
    /\.actual-series-wipe\.is-visible\s*\{[^}]*animation: actual-series-wipe 1550ms cubic-bezier\(0\.16, 0\.72, 0\.2, 1\) 80ms both/,
  );
  assert.match(
    css,
    /@keyframes actual-series-wipe\s*\{[\s\S]*?clip-path: inset\(0 100% 0 0\)[\s\S]*?clip-path: inset\(0 0 0 0\)/,
  );
});

test("right-aligns the combat maximum label with the quarter scores", async () => {
  const [dashboardSource, css, combatSummaryCss] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/CombatSummary.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    css,
    /\.quarter-score-meta\s*\{[^}]*display: grid;[^}]*grid-template-columns: 28px minmax\(80px, 1fr\) 52px;[^}]*padding: 2px 4px;/,
  );
  assert.match(
    css,
    /\.quarter-score-meta small\s*\{[^}]*grid-column: 3;[^}]*justify-self: end;[^}]*text-align: right;[^}]*white-space: nowrap;/,
  );
  assert.match(
    dashboardSource,
    /<b>누적 평균<\/b>[\s\S]*?<small className=\{combatSummaryStyles\.maximum\}>[\s\S]*?\{dashboard\.meta\.combatMax\}점 만점/,
  );
  assert.doesNotMatch(dashboardSource, /Q1·Q2 평가 기준/);
  assert.match(
    css,
    /\.combat-summary-stack strong\s*\{[^}]*width: 100%;[^}]*text-align: right;/,
  );
  assert.match(
    combatSummaryCss,
    /\.summary > \.score\s*\{[^}]*justify-content: flex-end[^}]*font-size: clamp\(72px, 4\.8vw, 78px\)/,
  );
  assert.match(
    combatSummaryCss,
    /\.summary > \.heading \.maximum\s*\{[^}]*margin-left: auto[^}]*text-align: right/,
  );
});

test("restores the profile showroom switcher for all viewers", async () => {
  const [dashboardSource, css, showroomsJson] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/data/showrooms.json", import.meta.url), "utf8"),
  ]);
  const gimhae = JSON.parse(showroomsJson).showrooms.find(
    (showroom) => showroom.cdsid === "6KR6863",
  );

  assert.equal(gimhae.showroom, "볼보 김해");
  assert.equal(gimhae.manager, "김희종");
  assert.equal(gimhae.q1.manager, "김희종");

  assert.match(
    dashboardSource,
    /aria-label=\{`현재 전시장을 제외한 \$\{dashboard\.showrooms\.length - 1\}개 전시장`\}/,
  );
  assert.match(
    dashboardSource,
    /dashboard\.showrooms[\s\S]*?\.filter\(\(item\) => item\.cdsid !== selected\.cdsid\)[\s\S]*?\.map/,
  );
  assert.match(
    dashboardSource,
    /role="menu"[\s\S]*?className="profile-showroom-list"[\s\S]*?role="menuitem"/,
  );
  assert.match(
    dashboardSource,
    /className="identity-profile-menu"[\s\S]*?className="identity-profile"[\s\S]*?className="profile-popover"/,
  );
  assert.doesNotMatch(dashboardSource, /<select[\s\S]*?다른 전시장 선택/);
  assert.doesNotMatch(
    dashboardSource,
    /\{viewer\.isEditor \? \([\s\S]*?<select/,
  );
  assert.match(
    css,
    /\.profile-showroom-list\s*\{[^}]*max-height:[^}]*overflow-y: auto/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header\s*\{[^}]*position: relative;[^}]*z-index: 50;[^}]*isolation: isolate;[^}]*overflow: visible;/,
  );
  assert.match(
    css,
    /\.identity-profile-menu\s*\{[^}]*position: relative;[^}]*z-index: 200;/,
  );
  assert.match(
    css,
    /\.identity-profile-menu \.profile-popover\s*\{[^}]*top: calc\(100% \+ 8px\);[^}]*right: 0;[^}]*z-index: 1000;/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header \.identity-detail-rail,[\s\S]*?\.dashboard-identity-header \.analysis-context\s*\{[^}]*overflow: visible;/,
  );
});

test("limits header hover feedback to pointer devices", async () => {
  const [css, dashboardSource, analysisSource] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    css,
    /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.identity-analysis-entry:has\(\.identity-analysis-hit:hover\)/,
  );
  assert.match(
    css,
    /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.analysis-context-item:hover/,
  );
  assert.match(
    css,
    /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.identity-profile:hover/,
  );
  assert.match(
    css,
    /@media \(min-width: 761px\) and \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.dashboard-identity-header \.identity-analysis-entry:hover/,
  );
  assert.equal(
    (dashboardSource.match(/onClick=\{\(event\) => event\.currentTarget\.blur\(\)\}/g) ?? [])
      .length,
    3,
  );
  assert.equal(
    (analysisSource.match(/onClick=\{\(event\) => event\.currentTarget\.blur\(\)\}/g) ?? [])
      .length,
    4,
  );
});

test("keeps the four header context cells free of internal cross dividers", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(css, /\.analysis-context-item:nth-child\(even\)\s*\{[^}]*border-left/);
  assert.doesNotMatch(css, /\.analysis-context-item:nth-child\(n \+ 3\)\s*\{[^}]*border-top/);
  assert.doesNotMatch(
    css,
    /\.identity-strip dl div:nth-child\(even\),\s*\.identity-profile\s*\{[^}]*border-left/,
  );
  assert.doesNotMatch(
    css,
    /\.identity-strip dl div:nth-child\(n \+ 3\),\s*\.identity-profile\s*\{[^}]*border-top/,
  );
});

test("stretches the manager control across the same header grid column as the other context cells", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.dashboard-identity-header \.identity-profile-menu\s*\{[^}]*width: 100%;[^}]*min-width: 0;/,
  );
  assert.match(
    css,
    /\.identity-profile-menu \.identity-profile\s*\{[^}]*width: 100%;[^}]*min-width: 0;/,
  );
});

test("renders national score labels above the actual trend line", async () => {
  const dashboardSource = await readFile(
    new URL("../app/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const actualLayerIndex = dashboardSource.indexOf("className={`actual-series-wipe");
  const nationalLabelLayerIndex = dashboardSource.indexOf(
    'className="national-value-label-layer"',
  );

  assert.ok(actualLayerIndex >= 0);
  assert.ok(nationalLabelLayerIndex > actualLayerIndex);
  assert.match(
    dashboardSource,
    /className="national-value-label-layer"[\s\S]*?className="national-point-value"/,
  );
  assert.match(
    css,
    /\.actual-point-value,[\s\S]*?\.national-point-value\s*\{[^}]*stroke: white[^}]*stroke-width: 3px[^}]*paint-order: stroke/,
  );
});

test("shows VOC immediately and reserves scroll-synced animation for CX", async () => {
  const dashboardSource = await readFile(
    new URL("../app/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(dashboardSource, /\[actualSeriesInView, setActualSeriesInView\]/);
  assert.match(
    dashboardSource,
    /const actualSeriesVisible = synchronizedAnimationInView \?\? true;/,
  );
  assert.match(
    dashboardSource,
    /data-animation-trigger=\{[\s\S]*?\? "scroll"[\s\S]*?: "immediate"/,
  );
  assert.match(
    dashboardSource,
    /key=\{`\$\{selected\.cdsid\}-cx`\}[\s\S]*?metric="cx"[\s\S]*?synchronizedAnimationInView=\{oneVoiceInView\}/,
  );
  assert.match(
    css,
    /\.actual-series-wipe\.is-visible\s*\{[^}]*1550ms cubic-bezier\(0\.16, 0\.72, 0\.2, 1\) 80ms both/,
  );
  assert.match(
    css,
    /#score-cx\s*\{[^}]*--cx-one-voice-animation-duration: 1650ms[^}]*--cx-one-voice-animation-delay: 100ms/,
  );
  assert.match(
    css,
    /\.actual-series-wipe\.one-voice-sync\.is-visible\s*\{[^}]*cubic-bezier\(0\.16, 0\.72, 0\.2, 1\)/,
  );
});

test("marks both ONE VOICE gauge endpoints with an animated O", async () => {
  const dashboardSource = await readFile(
    new URL("../app/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.equal(
    (dashboardSource.match(/className="one-voice-gauge-endpoint"/g) ?? [])
      .length,
    2,
  );
  assert.match(
    css,
    /\.one-voice-gauge-endpoint\s*\{[^}]*--one-voice-progress: inherit;[^}]*inset: 4px[^}]*rotate\([\s\S]*?var\(--one-voice-progress\) \* 3\.6deg/,
  );
  assert.match(
    css,
    /\.one-voice-gauge-endpoint::after\s*\{[^}]*width: 8px[^}]*height: 8px[^}]*border: 2px solid #2fb867[^}]*border-radius: 50%[^}]*background: #ffffff/,
  );
});

test("shows the ONE VOICE capture date beside the title", async () => {
  const dashboardSource = await readFile(
    new URL("../app/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(dashboardSource, /carHandoverScore: 94\.0/);
  assert.match(dashboardSource, /testDriveScore: 88\.5/);
  assert.match(dashboardSource, /capturedAt: "2026-08-20T10:00:00\+09:00"/);
  assert.match(
    dashboardSource,
    /className="one-voice-reference-date"[\s\S]*?\{oneVoiceReferenceDate\} 기준/,
  );
  assert.match(
    css,
    /\.one-voice-title-row\s*\{[^}]*display: flex[^}]*align-items: baseline[^}]*gap: 6px/,
  );
});

test("renders the higher weekly score marker above the lower marker", async () => {
  const dashboardSource = await readFile(
    new URL("../app/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const actualLayerIndex = dashboardSource.indexOf("className={`actual-series-wipe");
  const priorityLayerIndex = dashboardSource.indexOf(
    'className="national-priority-marker-layer"',
  );

  assert.ok(actualLayerIndex >= 0);
  assert.ok(priorityLayerIndex > actualLayerIndex);
  assert.match(
    dashboardSource,
    /const actualValue = actualAt\(point\.week\);[\s\S]*?point\.value <= actualValue[\s\S]*?className="national-average-point national-average-point-priority"/,
  );
  assert.match(
    css,
    /\.national-priority-marker-layer\s*\{[^}]*pointer-events: none/,
  );
});

test("matches summary metric label tracking to the detailed score headings", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.metric-code\s*\{[^}]*font-family: var\(--font-latin\)[^}]*letter-spacing: -0\.01em/,
  );
  assert.match(
    css,
    /\.score-tier-heading strong\s*\{[^}]*font-family: var\(--font-latin\)[^}]*letter-spacing: -0\.01em/,
  );
});

test("locks dashboard and analysis sticky shells to the lower content edges", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /--dashboard-content-overhang: 10px/);
  for (const selector of ["dashboard", "analysis"]) {
    assert.match(
      css,
      new RegExp(
        `\\.${selector}-sticky-shell\\s*\\{[\\s\\S]*?right: max\\([\\s\\S]*?var\\(--dashboard-content-overhang\\)[\\s\\S]*?left: max\\([\\s\\S]*?var\\(--dashboard-content-overhang\\)`,
      ),
    );
  }
  assert.doesNotMatch(
    css,
    /\.dashboard-sticky-shell,[\s\S]*?\.analysis-sticky-shell\s*\{[^}]*margin-inline: -10px/,
  );
  assert.match(
    css,
    /@media \(min-width: 761px\)\s*\{[\s\S]*?\.dashboard-sticky-shell,[\s\S]*?\.analysis-sticky-shell\s*\{[^}]*padding: 0 0 10px/,
  );
  assert.match(
    css,
    /\.competitive-analysis-page\s*\{[^}]*gap: 8px[^}]*padding: 0 var\(--dashboard-page-gutter\) 32px/,
  );
  assert.match(
    css,
    /\.dashboard\s*\{[^}]*width: min\(var\(--dashboard-page-max\), 100%\)[^}]*padding: 0 var\(--dashboard-page-gutter\) 40px/,
  );
  assert.match(css, /\.content-grid\s*\{[^}]*margin-top: 8px[^}]*scroll-margin-top: 8px/);
  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.identity-insights\s*\{[^}]*margin-left: 0[\s\S]*?\.identity-detail-rail,[\s\S]*?\.analysis-context\s*\{[^}]*margin-right: 0/,
  );
  assert.match(
    css,
    /\.identity-insight-row span\s*\{[^}]*display: -webkit-box;[^}]*max-height: 2\.24em;[^}]*overflow: hidden;[^}]*font-size: clamp\(8\.5px, 0\.64vw, 10px\);[^}]*-webkit-line-clamp: 2;/,
  );
});

test("reserves the root scrollbar gutter across dashboard routes", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /html\s*\{[^}]*scrollbar-gutter: stable/);
});

test("keeps the shared header status and score units compact", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.update-status\s*\{[^}]*font-size: 11px/);
  assert.match(css, /\.metric-card-value span\s*\{[^}]*font-size: 11px/);
  assert.match(
    css,
    /\.analysis-summary-card > div > small\s*\{[^}]*font-size: 10px/,
  );
  assert.match(
    css,
    /\.analysis-summary-card > strong small\s*\{[^}]*font-size: 9px/,
  );
});

test("aligns both sticky shells themselves with their lower panels at every zoom", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const dashboardSource = await readFile(
    new URL("../app/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const analysisSource = await readFile(
    new URL("../app/CompetitiveAnalysis.tsx", import.meta.url),
    "utf8",
  );

  assert.match(css, /--dashboard-sticky-inner-gutter: 0px/);
  assert.match(css, /--dashboard-sticky-content-gutter: 21px/);
  assert.doesNotMatch(css, /100vw - var\(--dashboard-page-max\)/);
  assert.equal(
    (css.match(/100% - var\(--dashboard-page-max\)/g) ?? []).length,
    4,
  );
  for (const selector of ["dashboard", "analysis"]) {
    assert.match(
      css,
      new RegExp(
        `\\.${selector}-sticky-shell\\s*\\{[\\s\\S]*?right: max\\([\\s\\S]*?var\\(--dashboard-content-overhang\\) -[\\s\\S]*?var\\(--dashboard-sticky-inner-gutter\\)[\\s\\S]*?left: max\\([\\s\\S]*?var\\(--dashboard-content-overhang\\) -[\\s\\S]*?var\\(--dashboard-sticky-inner-gutter\\)`,
      ),
    );
  }
  assert.match(
    css,
    /@media \(min-width: 761px\)\s*\{[\s\S]*?\.dashboard-sticky-shell,[\s\S]*?\.analysis-sticky-shell\s*\{[^}]*padding: 0 0 10px/,
  );
  assert.match(
    css,
    /@media \(min-width: 761px\)\s*\{[\s\S]*?\.dashboard-sticky-shell,[\s\S]*?\.analysis-sticky-shell\s*\{[^}]*padding-inline: var\(--dashboard-sticky-content-gutter\)/,
  );
  assert.equal(
    (css.match(/calc\(24px - var\(--dashboard-sticky-inner-gutter\)\)/g) ?? [])
      .length,
    4,
  );
  for (const source of [dashboardSource, analysisSource]) {
    assert.match(source, /window\.visualViewport\?\.addEventListener\("resize", queueAnchorHeightSync\)/);
    assert.match(source, /document\.fonts\?\.ready\.then\(queueAnchorHeightSync\)/);
    assert.match(source, /new ResizeObserver\(queueAnchorHeightSync\)/);
  }
});

test("squares and tightens the desktop summary while matching its right rail", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /--dashboard-summary-gap: 8px/);
  assert.match(css, /--dashboard-combat-share: 35%/);
  assert.match(
    css,
    /\.hero-grid\s*\{[^}]*minmax\(380px, var\(--dashboard-combat-share\)\)[^}]*gap: var\(--dashboard-summary-gap\)/,
  );
  assert.match(
    css,
    /\.metric-grid\s*\{[^}]*gap: var\(--dashboard-summary-gap\)/,
  );
  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.identity-detail-rail,[\s\S]*?\.analysis-context\s*\{[^}]*width: calc\([\s\S]*?100% - var\(--dashboard-combat-share\) - 24px[\s\S]*?\/ 3/,
  );
  assert.match(
    css,
    /@media \(min-width: 761px\)\s*\{[\s\S]*?\.identity-strip,[\s\S]*?\.analysis-header\s*\{[^}]*padding-inline: 0[^}]*border: 0[^}]*border-radius: 0/,
  );
  assert.match(
    css,
    /\.dashboard-sticky-shell \.combat-card,[\s\S]*?\.analysis-sticky-shell \.analysis-summary-card\s*\{[^}]*border-radius: 0/,
  );
});

test("compacts the desktop dashboard summary vertically", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.dashboard-sticky-shell,[\s\S]*?\.analysis-sticky-shell\s*\{[^}]*gap: 8px[^}]*padding: 0 var\(--dashboard-sticky-content-gutter\) 8px/,
  );
  assert.match(
    css,
    /\.dashboard-sticky-shell \.combat-card,[\s\S]*?\.dashboard-sticky-shell \.metric-card\s*\{[^}]*min-height: 224px/,
  );
  assert.match(
    css,
    /\.dashboard-sticky-shell \.combat-card,[\s\S]*?\.dashboard-sticky-shell \.metric-card\s*\{[^}]*padding: 16px 18px/,
  );
  assert.match(
    css,
    /\.dashboard-sticky-shell \.metric-benchmark\s*\{[^}]*margin-top: 10px/,
  );
  assert.match(
    css,
    /\.dashboard-sticky-shell \.metric-quarter-strip > button\s*\{[^}]*min-height: 28px[^}]*padding: 4px 3px/,
  );
  assert.match(
    css,
    /\.combat-summary-stack strong,[\s\S]*?\.metric-card-value\s*\{[^}]*min-height: 58px/,
  );
});

test("matches every rectangular lower dashboard surface to the ES90 radius", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /--es90-surface-radius: 6px/);
  assert.match(
    css,
    /\.dashboard \.trend-panel,[\s\S]*?\.dashboard \.trend-panel \.score-tier,[\s\S]*?\.dashboard \.trend-panel \.v3s-quarter-panel,[\s\S]*?\.dashboard \.trend-panel \.v3s-history-panel,[\s\S]*?\.dashboard \.trend-panel \.v3s-bar-stage,[\s\S]*?\.dashboard \.trend-panel \.v3s-history-bar-stage,[\s\S]*?\.dashboard \.trend-panel \.trend-scroll,[\s\S]*?\.dashboard \.trend-panel \.weekly-score-placeholder,[\s\S]*?\.dashboard \.trend-panel \.one-voice-contribution\s*\{[^}]*border-radius: var\(--es90-surface-radius\)/,
  );
});

test("ships the premium neutral design system and Paperlogy typography", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(css, /\.score-tier\.active\s*\{/);
  assert.match(
    css,
    /\.weekly-score-layout\s*\{[^}]*grid-template-columns: minmax\(0, 3fr\) minmax\(0, 1fr\)[^}]*gap: 4px/,
  );
  assert.match(
    css,
    /\.v3s-performance\.compact\s*\{[^}]*grid-template-columns: minmax\(0, 3fr\) minmax\(0, 1fr\)[^}]*gap: 4px/,
  );
  assert.match(
    css,
    /\.v3s-performance\.compact \.v3s-history-bar-fill,[\s\S]*?\.v3s-performance\.compact \.v3s-history-national-bar-fill\s*\{[^}]*width: 21px/,
  );
  assert.match(
    css,
    /\.v3s-performance\.compact \.v3s-history-years > span\s*\{[^}]*translateX\(-12px\)/,
  );
  assert.match(
    css,
    /\.weekly-score-placeholder\s*\{[^}]*place-items: center[^}]*border: 1px dashed/,
  );
  assert.match(
    css,
    /\.weekly-score-layout \.trend-wrap\.compact \.actual-point-value,[\s\S]*?\.weekly-score-layout \.trend-wrap\.compact \.national-point-value\s*\{[^}]*font-size: 8px/,
  );
  assert.match(
    css,
    /\.weekly-score-layout \.trend-wrap\.compact \.quarter-band,[\s\S]*?\.weekly-score-layout \.trend-wrap\.compact \.week-ruler\s*\{[^}]*margin-right: 0/,
  );
  assert.match(
    css,
    /\.v3s-quarter-column\.in-progress \.v3s-upcoming-bar,\s*\.v3s-quarter-column\.upcoming \.v3s-upcoming-bar\s*\{[^}]*height: 90%/,
  );
  assert.doesNotMatch(css, /\.profile-analysis-link/);
  assert.match(
    css,
    /\.analysis-tabs button\s*\{[^}]*min-height: 42px[^}]*padding: 0 14px/,
  );
  assert.match(
    css,
    /\.analysis-tabs button\.active\s*\{[^}]*background: linear-gradient\(135deg, #4f7f99, #38657e\)[^}]*box-shadow:/,
  );
  assert.match(
    css,
    /\.analysis-context-item\s*\{[^}]*grid-template-rows: auto auto[^}]*align-content: center[^}]*justify-items: center/,
  );
  assert.match(
    css,
    /\.analysis-context-item > \.identity-icon,[\s\S]*?\.analysis-context-item > \.identity-profile-icon\s*\{[^}]*grid-row: 1 \/ span 2[^}]*align-self: center/,
  );
  const dashboardSource = await readFile(
    new URL("../app/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const analysisSource = await readFile(
    new URL("../app/CompetitiveAnalysis.tsx", import.meta.url),
    "utf8",
  );
  const sharedHeaderSource = await readFile(
    new URL("../app/DashboardHeaderLead.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    analysisSource,
    /const \[accessDate, setAccessDate\] = useState\(\(\) =>[\s\S]*?formatAnalysisDate\(new Date\(\)\)[\s\S]*?window\.setInterval\(syncAccessDate, 60_000\)/,
  );
  assert.match(
    analysisSource,
    /const \[hoveredCdsid, setHoveredCdsid\] = useState<string \| null>\(null\)[\s\S]*?isHovered \? "hovered" : ""[\s\S]*?onMouseEnter=\{\(\) => setHoveredCdsid\(item\.cdsid\)\}[\s\S]*?className=\{isSelected \? "selected" : isHovered \? "hovered" : ""\}/,
  );

  assert.match(
    dashboardSource,
    /const seoulDateFormatter = new Intl\.DateTimeFormat\("en-US", \{[\s\S]*?timeZone: "Asia\/Seoul"/,
  );
  assert.match(
    dashboardSource,
    /const \[accessDate, setAccessDate\] = useState\(\(\) =>[\s\S]*?formatSeoulDate\(new Date\(\)\)/,
  );
  assert.match(
    dashboardSource,
    /window\.setInterval\(syncAccessDate, 60_000\)/,
  );
  assert.match(
    sharedHeaderSource,
    /<time dateTime=\{accessDate\.replaceAll\("\."[,]? "-"\)\}>[\s\S]*?업데이트 \{accessDate\} 기준[\s\S]*?<\/time>/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /latestUpdate\.effectiveDate\.replaceAll\("-", "\."\)/,
  );

  assert.match(
    css,
    /font-family: "Paperlogy";[\s\S]*paperlogy-5-medium\.ttf[\s\S]*font-weight: 100 800/,
  );
  assert.match(
    css,
    /font-family: "Paperlogy";[\s\S]*paperlogy-9-black\.ttf[\s\S]*font-weight: 900/,
  );
  assert.match(
    css,
    /--font-korean:[\s\S]*"Paperlogy"[\s\S]*"Pretendard Variable"/,
  );
  assert.match(
    css,
    /--font-latin:[\s\S]*"Volvo Centum Web"[\s\S]*"Paperlogy"/,
  );
  assert.doesNotMatch(css, /--font-korean:\s*"Pretendard Variable"/);
  assert.doesNotMatch(css, /font-family:\s*"Paperlogy [59]"/);
  assert.match(css, /--paper: #f6f8fa/);
  assert.match(
    css,
    /\.scatter-zone\.balanced\s*\{[^}]*bottom: var\(--avg-y\)[^}]*left: var\(--avg-x\)[^}]*linear-gradient\(\s*to top right/,
  );
  assert.match(
    css,
    /\.scatter-zone\.improve\s*\{[^}]*width: var\(--avg-x\)[^}]*height: var\(--avg-y\)[^}]*linear-gradient\(\s*to bottom left/,
  );
  assert.match(css, /\.scatter-quadrant\.top-right\s*\{[^}]*color: #1d5877/);
  assert.match(css, /\.scatter-quadrant\.bottom-left\s*\{[^}]*color: #9d4a43/);
  assert.match(
    css,
    /\.profile-popover select\s*\{[^}]*font-family: "Cascadia Mono", Consolas,[^}]*font-variant-numeric: tabular-nums[^}]*font-feature-settings: "tnum" 1/,
  );
  assert.match(
    css,
    /\.profile-popover option\s*\{[^}]*font-family: inherit[^}]*font-variant-numeric: tabular-nums[^}]*font-feature-settings: "tnum" 1/,
  );
  assert.match(
    css,
    /\.v3s-quarter-label\s*\{[^}]*min-height: 19px[^}]*grid-template-columns: 1fr[^}]*align-items: center[^}]*justify-items: center[^}]*text-align: center/,
  );
  assert.match(css, /--white: #ffffff/);
  assert.match(css, /--line: #e5e9ee/);
  assert.match(css, /--es90-orange: #f15a24/);
  assert.match(
    css,
    /\.v3s-average-marker\s*\{[\s\S]*?background: repeating-linear-gradient\([\s\S]*?var\(--es90-orange\) 0 5px,[\s\S]*?transparent 5px 9px/,
  );
  assert.match(
    dashboardSource,
    /className="v3s-average-marker"[\s\S]*?v3sScaleHeight\([\s\S]*?quarter\.average \?\? v3sScaleMin[\s\S]*?<b>\{displayNumber\(quarter\.average\)\}<\/b>/,
  );
  assert.match(
    dashboardSource,
    /const v3sScaleMax = 100;[\s\S]*?const v3sScaleMin = quarterScaleValues\.length[\s\S]*?Math\.min\([\s\S]*?80,[\s\S]*?Math\.floor\(\(Math\.min\(\.\.\.quarterScaleValues\) - 5\) \/ 5\) \* 5/,
  );
  assert.match(
    dashboardSource,
    /const v3sScaleHeight = \(value: number\) =>[\s\S]*?\(\(value - v3sScaleMin\) \/ \(v3sScaleMax - v3sScaleMin\)\) \* 100/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /\{v3sScaleMin\}–\{v3sScaleMax\}점 확대 척도/,
  );
  assert.match(
    dashboardSource,
    /benchmark\.value === null[\s\S]*?"48%"[\s\S]*?v3sScaleHeight\(benchmark\.value\)/,
  );
  assert.match(
    dashboardSource,
    /className="v3s-bar-fill"[\s\S]*?height: `\$\{v3sScaleHeight\(quarter\.value\)\}%`/,
  );
  assert.match(
    css,
    /\.v3s-average-marker b\s*\{[^}]*top: 4px[^}]*right: 9px[^}]*left: auto[^}]*z-index: 3[^}]*color: var\(--es90-orange\)[^}]*font-size: 9px[^}]*white-space: nowrap/,
  );
  assert.match(
    css,
    /\.legend-average\s*\{[\s\S]*?background: var\(--es90-orange\)/,
  );
  assert.match(
    css,
    /\.trend-wrap\.compact \.trend-canvas\s*\{[^}]*width: 100%[^}]*min-width: 0/,
  );
  assert.match(
    css,
    /\.trend-wrap\.compact \.trend-scroll\s*\{[^}]*overflow-x: hidden[^}]*scrollbar-width: none/,
  );
  assert.match(
    css,
    /\.trend-wrap\.compact \.week-ruler span\s*\{[^}]*letter-spacing: 0/,
  );
  assert.match(
    css,
    /\.trend-wrap\.compact \.actual-point-value,[\s\S]*?\.trend-wrap\.compact \.national-point-value\s*\{[^}]*letter-spacing: 0/,
  );
  assert.match(css, /--ink: #111827/);
  assert.match(css, /--secondary: #667085/);
  assert.match(css, /--muted: #7b8796/);
  assert.match(css, /--navy: #102a43/);
  assert.match(css, /--blue: #2f6b8a/);
  assert.match(css, /--good: #1f8f6a/);
  assert.match(css, /--warning: #d14b41/);
  assert.match(css, /--status-danger: #b4232d/);
  assert.match(css, /--status-danger-soft: #fce8eb/);
  assert.match(css, /--status-caution: #c58a1b/);
  assert.match(css, /--status-caution-soft: #fbf2df/);
  assert.match(
    css,
    /\.signal-icon\.warning\s*\{[^}]*background: transparent[^}]*color: var\(--status-danger\)[^}]*font-size: 10px/,
  );
  assert.match(
    css,
    /\.signal-icon\.caution\s*\{[^}]*background: transparent[^}]*color: var\(--status-caution\)[^}]*font-size: 10px/,
  );
  assert.match(
    css,
    /\.metric-benchmark strong\.positive\s*\{\s*color: var\(--blue\) !important;/,
  );
  assert.match(
    css,
    /\.metric-benchmark strong\.negative\s*\{\s*color: var\(--status-danger\) !important;/,
  );
  assert.match(
    css,
    /\.metric-benchmark strong\.negative\.caution\s*\{\s*color: var\(--status-caution\) !important;/,
  );
  assert.match(
    css,
    /\.metric-benchmark strong\.negative\.warning\s*\{\s*color: var\(--status-danger\) !important;/,
  );
  assert.match(
    css,
    /\.analysis-summary-card > em\.positive\s*\{\s*color: var\(--blue\) !important;/,
  );
  assert.match(
    css,
    /\.analysis-summary-card > em\.negative\s*\{\s*color: var\(--warning\) !important;/,
  );
  assert.match(css, /\.positive\s*\{\s*color: var\(--blue\) !important;/);
  assert.match(css, /\.negative\s*\{\s*color: var\(--caution\) !important;/);
  assert.match(css, /--caution: #c58a1b/);
  assert.match(css, /--caution-soft: #fbf2df/);
  assert.match(
    css,
    /\.v3s-award-period\s*\{[^}]*min-height: 40px[^}]*gap: 3px[^}]*padding: 5px 6px/,
  );
  assert.doesNotMatch(
    css,
    /\.scatter-point\.dense:not\(\.selected\)\s*>\s*b\s*\{[^}]*opacity:\s*0\s*;/s,
  );
  assert.doesNotMatch(css, /\.scatter-callout-leader|--leader-length|--leader-angle/);
  assert.match(
    css,
    /\.scatter-point\.label-right-up > b::before,[\s\S]*?left: calc\(-1 \* var\(--callout-tail-x\)\)[\s\S]*?clip-path: polygon\(calc\(100% - 5px\) 0, 100% 0, 0 100%\)/,
  );
  assert.match(
    css,
    /\.scatter-point\.label-right-down > b::before,[\s\S]*?top: calc\(-1 \* var\(--callout-tail-y\)\)[\s\S]*?clip-path: polygon\(0 0, calc\(100% - 5px\) 100%, 100% 100%\)/,
  );
  assert.match(
    css,
    /\.scatter-average-value\.horizontal\s*\{[^}]*left: 0[^}]*display: flex[^}]*flex-direction: column/,
  );
  assert.match(
    css,
    /\.scatter-average-value\.vertical\s*\{[^}]*left: var\(--avg-x\)[^}]*bottom: 12px[^}]*display: flex[^}]*flex-direction: column/,
  );
  assert.match(analysisSource, /--callout-tail-x/);
  assert.match(
    analysisSource,
    /tailX: Math\.max\(3, Math\.abs\(anchorX\)\)[\s\S]*?tailY: Math\.max\(3, Math\.abs\(anchorY\)\)/,
  );
  assert.doesNotMatch(analysisSource, /overlapScale|pointRadius/);
  assert.match(analysisSource, /\[3, 5, 7\]\.forEach\(\(gap, gapIndex\) =>/);
  assert.match(analysisSource, /\[0, -4, 4, -7, 7\]\.forEach\(\(lane, laneIndex\) =>/);
  assert.match(
    css,
    /\.dashboard\s*\{[^}]*width: min\(var\(--dashboard-page-max\), 100%\)[^}]*padding: 0 var\(--dashboard-page-gutter\) 40px/,
  );
  assert.match(css, /--header-title-font-size: 32px/);
  assert.match(css, /--header-title-width: clamp\(270px, 19%, 288px\)/);
  assert.match(
    css,
    /\/\* ES90-inspired shared command banner preview \*\/[\s\S]*?\.dashboard-identity-header\s*\{[^}]*border-bottom: 0[^}]*linear-gradient\(104deg, #0b2b3d 0%, #123b53 62%, #245f7c 100%\)/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header::before\s*\{[^}]*inset: 0;[^}]*linear-gradient\(118deg, transparent 0%, transparent 56%, rgba\(152, 205, 228, 0\.025\) 68%, rgba\(152, 205, 228, 0\.085\) 100%\)[^}]*linear-gradient\(166deg, transparent 0%, transparent 70%, rgba\(3, 25, 39, 0\.14\) 100%\)/,
  );
  assert.doesNotMatch(
    css,
    /radial-gradient\(circle, transparent 0 47%, rgba\(139, 198, 224, 0\.12\)/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header \.identity-title h1::before\s*\{[^}]*color: #ff8b52[^}]*content: "DATA DASHBOARD STATUS"/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header\.analysis-header \.identity-title h1::before\s*\{[^}]*content: "DATA DASHBOARD ANALYSIS"/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header \.identity-title h1,[\s\S]*?\.dashboard-identity-header\.analysis-header h1\s*\{[^}]*font-family: "Pretendard Variable", var\(--font-korean\), sans-serif[^}]*font-weight: 760/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header \.identity-detail-rail,\s*\.dashboard-identity-header \.analysis-context\s*\{[^}]*border: 0;[^}]*background: rgba\(5, 28, 42, 0\.23\)/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header \.identity-profile\s*\{[^}]*border: 0;/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header \.update-status-line:first-child\s*\{[^}]*border-radius: 0[^}]*background: transparent[^}]*box-shadow: none/,
  );
  assert.match(
    css,
    /@media \(min-width: 1241px\)[\s\S]*?\.dashboard-identity-header > \.identity-detail-rail,[\s\S]*?height: 92px;[\s\S]*?grid-template-rows: repeat\(2, 45px\)/,
  );
  assert.match(
    css,
    /@media \(min-width: 1241px\)[\s\S]*?\.dashboard-identity-header\s*\{[^}]*gap: 12px;/,
  );
  assert.match(
    css,
    /\.identity-strip h1\s*\{[^}]*font-family: var\(--font-korean\)[^}]*font-size: var\(--header-title-font-size\)/,
  );
  assert.match(
    css,
    /\.identity-strip\s*\{[^}]*min-height: 82px[^}]*margin: -6px -10px 16px[^}]*border-bottom-color: rgba\(47, 107, 138, 0\.2\)/,
  );
  assert.match(
    css,
    /\.identity-strip\s*\{[^}]*linear-gradient\([^}]*rgba\(231, 240, 244, 0\.93\)[^}]*box-shadow:/,
  );
  assert.match(css, /\.identity-detail-rail\s*\{[\s\S]*?border-radius: 8px/);
  assert.match(
    css,
    /\.profile-popover\s*\{[\s\S]*?width: min\(390px, calc\(100vw - 28px\)\)[\s\S]*?padding: 10px[\s\S]*?border-radius: 10px/,
  );
  assert.match(
    css,
    /\.profile-popover select\s*\{[\s\S]*?height: 42px[\s\S]*?margin: 0[\s\S]*?border-radius: 8px[\s\S]*?cursor: pointer/,
  );
  assert.match(
    css,
    /\.identity-strip dt,\s*\.identity-strip dd,\s*\.identity-profile-role,\s*\.identity-profile strong\s*\{[^}]*line-height: 1\.1/,
  );
  assert.match(
    css,
    /@media \(min-width: 761px\)\s*\{[\s\S]*?\.dashboard-identity-header > \.identity-detail-rail,[\s\S]*?\.dashboard-identity-header > \.analysis-context\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[^}]*grid-template-rows: repeat\(2, 45px\)/,
  );
  assert.match(
    css,
    /@media \(min-width: 761px\)\s*\{[\s\S]*?\.identity-strip dl\s*\{[\s\S]*?display: contents/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header \.identity-analysis-entry,[\s\S]*?\.dashboard-identity-header \.identity-profile,[\s\S]*?\.dashboard-identity-header \.analysis-context-item\s*\{[^}]*width: 100%[^}]*min-width: 0[^}]*height: 45px/,
  );
  assert.match(
    css,
    /\.dashboard \.comparison-panel\s*\{[\s\S]*?padding: 18px 24px 16px/,
  );
  assert.match(
    css,
    /\.combat-main\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[^}]*align-items: stretch/,
  );
  assert.match(
    css,
    /\.combat-summary-stack strong\s*\{[^}]*font-size: clamp\(60px, 4\.2vw, 68px\)[^}]*white-space: nowrap/,
  );
  assert.match(
    dashboardSource,
    /const cumulativeScoreDigits = displayNumber\(cumulativeAverage\)[\s\S]*?character === "\."[\s\S]*?digits\[digits\.length - 1\] \+= character/,
  );
  assert.match(
    dashboardSource,
    /className="combat-score-digit"[\s\S]*?animationDelay: `\$\{180 \+ index \* 130\}ms`/,
  );
  assert.match(
    css,
    /\.combat-score-digit\s*\{[\s\S]*?animation: combat-score-drop 760ms cubic-bezier\(0\.16, 1, 0\.3, 1\) both/,
  );
  assert.match(
    css,
    /@keyframes combat-score-drop\s*\{[\s\S]*?translateY\(-24px\) scale\(0\.985\)[\s\S]*?translateY\(2px\) scale\(1\)[\s\S]*?translateY\(0\) scale\(1\)/,
  );
  assert.match(
    css,
    /\.scatter-y-title\s*\{[^}]*writing-mode: vertical-rl[^}]*text-orientation: upright/,
  );
  assert.doesNotMatch(
    css,
    /\.scatter-y-title\s*\{[^}]*transform: rotate\(180deg\)/,
  );
  assert.match(css, /\.table-row\s*\{[^}]*min-height: 48px/);
  assert.match(css, /\.comparison-head\s*\{[^}]*min-height: 24px/);
  assert.match(
    css,
    /\.identity-strip dt,[\s\S]*?\.identity-profile-role\s*\{[\s\S]*?width: 100%[\s\S]*?text-align: center/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header \.identity-profile\s*,[\s\S]*?\.dashboard-identity-header \.analysis-context-item\s*\{[^}]*width: 100%[^}]*min-width: 0/,
  );
  assert.match(
    css,
    /\.identity-icon\s*\{[\s\S]*?width: 22px[\s\S]*?height: 22px[\s\S]*?min-height: 22px[\s\S]*?aspect-ratio: 1/,
  );
  assert.match(
    css,
    /\.identity-profile-icon\s*\{[\s\S]*?width: 22px[\s\S]*?height: 22px[\s\S]*?min-height: 22px[\s\S]*?aspect-ratio: 1/,
  );
  assert.match(
    css,
    /\.identity-icon--dealer::before\s*\{[\s\S]*?border: 1px solid currentColor/,
  );
  assert.match(
    css,
    /\.identity-analysis-entry::after,[\s\S]*?\.identity-profile::after,[\s\S]*?\.analysis-context-item::after\s*\{[^}]*content: "→";[^}]*right: 6px;[^}]*bottom: 5px;/,
  );
  assert.match(css, /\.analysis-context-item::after\s*\{[^}]*content: "←";/);
  assert.match(
    css,
    /\.identity-icon--region::before\s*\{[\s\S]*?border-radius: 50% 50% 50% 2px/,
  );
  assert.match(
    css,
    /\.identity-icon--size::before\s*\{[\s\S]*?border-top: 1px solid currentColor/,
  );
  assert.match(
    css,
    /\.combat-card\s*\{[^}]*min-height: 252px;[^}]*padding: 20px;[^}]*background: #2f4d5c;/,
  );
  assert.match(
    css,
    /\.combat-card::after\s*\{[^}]*content: none;/,
  );
  assert.doesNotMatch(
    css,
    /radial-gradient\(circle at 74% 42%, rgba\(194, 222, 234, 0\.14\)/,
  );
  assert.match(css, /\.metric-card\s*\{[\s\S]*?min-height: 252px[\s\S]*?padding: 20px/);
  assert.doesNotMatch(css, /\.metric-card\s*\{[^}]*animation:/);
  assert.doesNotMatch(css, /@keyframes metric-enter/);
  assert.match(
    css,
    /\.metric-quarter-strip\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    css,
    /\.quarter-score-meta\s*\{[^}]*min-height: 22px[^}]*align-items: center[^}]*line-height: 1/,
  );
  assert.match(
    css,
    /\.combat-summary-stack > span\s*\{[^}]*min-height: 22px[^}]*display: flex[^}]*align-items: center/,
  );
  assert.match(
    css,
    /\.metric-card-topline\s*\{[^}]*min-height: 22px[^}]*align-items: center[^}]*line-height: 1/,
  );
  assert.match(css, /\.metric-card-value\s*\{[\s\S]*?font-size: clamp\(46px, 3\.25vw, 56px\)/);
  assert.match(
    css,
    /\.metric-card-value span\s*\{[\s\S]*?margin-left: 10px[\s\S]*?letter-spacing: -0\.015em[\s\S]*?word-spacing: -0\.02em/,
  );
  assert.match(css, /\.trend-selector\s*\{[\s\S]*?border-radius: 8px/);
  assert.match(css, /\.trend-selector button\s*\{[\s\S]*?height: 40px[\s\S]*?border-radius: 6px/);
  assert.match(
    css,
    /\.trend-selector button\.active\s*\{[\s\S]*?linear-gradient\(\s*135deg,[\s\S]*?var\(--navy\)[\s\S]*?inset 0 1px 0 rgba\(255, 255, 255, 0\.16\)[\s\S]*?translateY\(-1px\)/,
  );
  assert.match(
    css,
    /\.trend-selector button\.active:active\s*\{[\s\S]*?translateY\(0\) scale\(0\.985\)/,
  );
  assert.match(
    css,
    /\.v3s-performance\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1\.22fr\) minmax\(360px, 0\.78fr\)/,
  );
  assert.match(
    css,
    /\.v3s-bar-fill\s*\{[\s\S]*?linear-gradient\(180deg, #5c96b2 0%, #2f6b8a 52%, #173f5b 100%\)/,
  );
  assert.match(
    css,
    /\.v3s-peer-bar\s*\{[\s\S]*?width: 22px[\s\S]*?min-width: 22px[\s\S]*?animation: v3s-bar-rise 760ms/,
  );
  assert.match(
    css,
    /\.v3s-bar-cluster\s*\{[\s\S]*?width: min\(92%, 120px\)[\s\S]*?gap: 8px[\s\S]*?\.v3s-peer-bar-group\s*\{[\s\S]*?width: 74px[\s\S]*?flex: 0 0 74px[\s\S]*?gap: 4px/,
  );
  assert.match(
    css,
    /\.v3s-bar-fill\s*\{[\s\S]*?width: 28px[\s\S]*?min-width: 28px[\s\S]*?flex: 0 0 28px/,
  );
  assert.match(
    css,
    /\.v3s-quarter-bars\s*\{[\s\S]*?gap: 14px[\s\S]*?padding: 10px 18px 0/,
  );
  assert.match(
    css,
    /\.v3s-bar-fill b\s*\{[^}]*top: 50%[^}]*transform: translate\(-50%, -50%\)/,
  );
  assert.match(
    css,
    /\.v3s-history-bar-fill b,[\s\S]*?\.v3s-history-national-bar-fill b\s*\{[^}]*font-style: normal[^}]*transform: translate\(-50%, -50%\)/,
  );
  assert.match(
    css,
    /\.v3s-history-national-bar-fill\s*\{[^}]*width: 27px[\s\S]*?#e9a494[\s\S]*?#cf735f[\s\S]*?#9d463d/,
  );
  assert.match(
    css,
    /\.v3s-history-years\s*\{[^}]*grid-template-columns: repeat\(5, 1fr\)[^}]*column-gap: 14px[^}]*padding: 7px 18px 0/,
  );
  assert.match(
    css,
    /\.v3s-history-years > span\s*\{[^}]*transform: translateX\(-15\.5px\)/,
  );
  assert.match(
    css,
    /\.v3s-history-average-marker b\s*\{[^}]*bottom: 6px[^}]*right: 9px/,
  );
  assert.match(
    css,
    /\.v3s-peer-bar b\s*\{[^}]*top: 50%[^}]*font-size: 8px[^}]*transform: translate\(-50%, -50%\)/,
  );
  assert.match(css, /\.legend-peer\.dealer[\s\S]*?\.legend-peer\.region[\s\S]*?\.legend-peer\.size/);
  assert.match(
    css,
    /\.v3s-peer-bar\.dealer\s*\{[\s\S]*?#8395a2[\s\S]*?\.v3s-peer-bar\.region\s*\{[\s\S]*?#829c94[\s\S]*?\.v3s-peer-bar\.size\s*\{[\s\S]*?#9e9182/,
  );
  assert.match(
    css,
    /@keyframes v3s-bar-rise\s*\{[\s\S]*?scaleY\(0\)[\s\S]*?scaleY\(1\)/,
  );
  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.v3s-quarter-panel,[\s\S]*?min-height: 224px[\s\S]*?\.v3s-quarter-bars\s*\{[\s\S]*?height: 126px[\s\S]*?\.v3s-bar-stage\s*\{[\s\S]*?height: 86px/,
  );
  assert.match(
    css,
    /\.v3s-performance\.compact \.v3s-history-bar-stage\s*\{[^}]*height: 73px/,
  );
  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.combat-summary-stack strong,[\s\S]*?\.metric-card-value\s*\{[^}]*min-height: 58px[^}]*display: flex[^}]*align-items: flex-end[^}]*margin-top: 0/,
  );
  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.dashboard \.comparison-panel\s*\{[\s\S]*?margin-top: 16px[\s\S]*?padding: 14px 20px 12px[\s\S]*?\.table-row\s*\{[\s\S]*?min-height: 40px/,
  );
  assert.match(css, /\.v3s-history-empty-copy\s*\{/);
  assert.match(css, /\.trend-chart\s*\{[\s\S]*?height: 210px/);
  assert.match(
    css,
    /\.chart-tooltip\s*\{[\s\S]*?width: 206px[\s\S]*?gap: 6px[\s\S]*?padding: 11px 12px[\s\S]*?border-radius: 12px[\s\S]*?letter-spacing: -0\.015em/,
  );
  assert.match(css, /\.hover-guide\s*\{[\s\S]*?stroke-dasharray: 3 4/);
  assert.match(
    css,
    /\.quarter-score-row > i b\s*\{[\s\S]*?linear-gradient\(90deg, #688fa3 0%, #82aebf 66%, #a4c8d6 100%\)[\s\S]*?animation: progress-fill 1100ms cubic-bezier\(0\.16, 1, 0\.3, 1\) both/,
  );
  assert.match(
    css,
    /\.quarter-score-row\.current > i b\s*\{[\s\S]*?linear-gradient\(90deg, #84b6ca 0%, #abd1e0 68%, #d2e9f2 100%\)/,
  );
  assert.match(
    css,
    /\.metric-track span\s*\{[\s\S]*?linear-gradient\(90deg, #197557 0%, var\(--good\) 68%, #57b18f 100%\)[\s\S]*?animation: progress-fill 1100ms cubic-bezier\(0\.16, 1, 0\.3, 1\) 130ms both/,
  );
  assert.match(
    css,
    /\.metric-card\.warning \.metric-track span\s*\{[\s\S]*?linear-gradient\(90deg, #8f1721 0%, var\(--status-danger\) 68%, #d04c57 100%\)/,
  );
  assert.match(
    css,
    /\.metric-card\.caution \.metric-track span\s*\{[\s\S]*?linear-gradient\(90deg, #a66f13 0%, var\(--status-caution\) 68%, #dda848 100%\)/,
  );
  assert.match(css, /@keyframes progress-fill\s*\{[\s\S]*?transform: scaleX\(0\)[\s\S]*?transform: scaleX\(1\)/);
  assert.doesNotMatch(css, /\.metric-card:hover\s*\{[^}]*transform:/);
  assert.doesNotMatch(css, /\.metric-card\s*\{[^}]*transform\s+\d+ms/);
  assert.match(css, /\.comparison-controls select\s*\{[\s\S]*?height: 44px/);
  assert.match(css, /\.comparison-table\s*\{[\s\S]*?display: grid[\s\S]*?gap: 8px/);
  assert.match(
    css,
    /\.table-row\.selected\s*\{[\s\S]*?background: #eef5f8;[\s\S]*?0 12px 22px -16px rgba\(16, 42, 67, 0\.42\)/,
  );
  assert.match(
    css,
    /\.analysis-ranking-list > div\.selected\s*\{[^}]*background: linear-gradient\(135deg, #4f7f99 0%, #38657e 100%\)[^}]*inset 3px 0 0 #a8d4e6[^}]*0 14px 26px -16px rgba\(32, 78, 103, 0\.48\)/,
  );
  assert.match(
    css,
    /\.analysis-ranking-list > div\.selected \.analysis-rank > strong,[\s\S]*?\.analysis-ranking-list > div\.selected > strong\s*\{[^}]*color: white/,
  );
  assert.match(
    css,
    /\.analysis-ranking-list > div > b,[\s\S]*?\.analysis-ranking-list > div > strong\s*\{[^}]*font-size: 11px/,
  );
  assert.match(
    css,
    /\.analysis-ranking-list > div > strong\s*\{[^}]*font-size: 12px/,
  );
  assert.match(
    css,
    /\.analysis-ranking-list > div\.selected > b:first-of-type\s*\{[^}]*color: #c5ecfb[^}]*text-shadow:/,
  );
  assert.match(
    css,
    /\.analysis-ranking-list > div\.selected > b:last-of-type\s*\{[^}]*color: #baf4df[^}]*text-shadow:/,
  );
  assert.match(
    css,
    /\.voc-consultation-axis\.top\s*\{[^}]*top: 10px;[^}]*\}[\s\S]*?\.voc-consultation-axis\.middle\s*\{[^}]*top: 48px;[^}]*\}[\s\S]*?\.voc-consultation-axis\.base\s*\{[^}]*top: 86px;/,
  );
  assert.match(
    css,
    /\.voc-consultation-year\s*\{[^}]*height: 100%;[^}]*position: relative;/,
  );
  assert.match(
    css,
    /\.voc-consultation-pair\s*\{[^}]*width: 45px;[^}]*height: 100%;[^}]*position: absolute;[^}]*bottom: 0;[^}]*transform: translateX\(-50%\);/,
  );
  assert.match(
    css,
    /\.voc-consultation-year > small\s*\{[^}]*top: calc\(100% \+ 7px\);[^}]*color: var\(--muted\);[^}]*font-family: var\(--font-latin\);[^}]*font-size: 9px;[^}]*font-weight: 400;/,
  );
  assert.match(
    css,
    /\.voc-response-rate-line-layer\s*\{[^}]*position: absolute;[^}]*inset: 10px 2px 24px 22px;[^}]*pointer-events: none;/,
  );
  assert.match(
    css,
    /\.voc-response-rate-line-layer polyline\s*\{[^}]*stroke: var\(--es90-orange\);[^}]*stroke-width: 1\.8;[^}]*stroke-linecap: butt;[^}]*stroke-linejoin: miter;[^}]*stroke-miterlimit: 4;/,
  );
  assert.match(
    css,
    /\.voc-response-rate-point i\s*\{[^}]*width: 6px;[^}]*height: 6px;[^}]*border: 1\.5px solid var\(--es90-orange\);[^}]*transform: translate\(-50%, -50%\) rotate\(45deg\);/,
  );
  assert.doesNotMatch(css, /\.voc-response-rate-panel\s*\{/);
  assert.match(
    css,
    /\.analysis-ranking-list > div\.hovered:not\(\.selected\),[\s\S]*?\.analysis-ranking-list > div:not\(\.selected\):hover\s*\{[^}]*border-color: rgba\(74, 147, 143, 0\.32\)[^}]*background: #e8f4f3[^}]*inset 3px 0 0 #4a938f/,
  );
  assert.match(
    css,
    /\.scatter-point\.hovered:not\(\.selected\)\s*\{[^}]*--callout-color: #4a938f[^}]*--callout-fill: #e8f4f3[^}]*z-index: 5/,
  );
  assert.match(
    css,
    /\.analysis-overview-icon::after\s*\{[^}]*border-bottom: 1\.5px solid currentColor[^}]*border-left: 1\.5px solid currentColor[^}]*transform: rotate\(45deg\)/,
  );
  assert.match(
    css,
    /\.comparison-value small\s*\{[\s\S]*?display: flex[\s\S]*?white-space: nowrap/,
  );
  assert.match(
    css,
    /@media \(min-width: 761px\)\s*\{[\s\S]*?\.dashboard-sticky-shell,[\s\S]*?\.analysis-sticky-shell\s*\{[^}]*padding: 0 0 10px[^}]*border: 0[^}]*border-radius: 0/,
  );
  assert.match(css, /\.dashboard-sticky-shell\s*\{[^}]*position: fixed[^}]*top: 0/);
  assert.match(css, /\.analysis-sticky-shell\s*\{[^}]*position: fixed[^}]*top: 0/);
  assert.match(css, /--dashboard-content-overhang: 10px/);
  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.identity-detail-rail,[\s\S]*?\.analysis-context\s*\{[^}]*margin-right: 0/,
  );
  assert.match(
    css,
    /\.hero-grid,[\s\S]*?\.analysis-tabs,[\s\S]*?\.analysis-summary-grid\s*\{[^}]*margin-inline: 0/,
  );
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  await Promise.all([
    access(new URL("public/fonts/paperlogy-5-medium.ttf", templateRoot)),
    access(new URL("public/fonts/paperlogy-9-black.ttf", templateRoot)),
    access(new URL("public/fonts/pretendard-variable.ttf", templateRoot)),
  ]);
});

test("matches the requested dashboard headings to the ES90 performance-comparison title typography", async () => {
  const [dashboardSource, css] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const titleRule = css.match(
    /\/\* ES90 performance-comparison title typography for dashboard score headings \*\/[\s\S]*?\.score-stack-heading h2,[\s\S]*?\.v3s-performance\.compact \.v3s-subhead h3,[\s\S]*?\.voc-consultation-heading > div:first-child > strong\s*\{([^}]*)\}/,
  );

  assert.ok(titleRule);
  assert.match(titleRule[1], /color: #11283d;/);
  assert.match(titleRule[1], /font-family: var\(--font-korean\);/);
  assert.match(titleRule[1], /font-size: 14px;/);
  assert.match(titleRule[1], /font-weight: 600;/);
  assert.match(titleRule[1], /line-height: 1\.25;/);
  assert.match(titleRule[1], /letter-spacing: -0\.25px;/);

  assert.equal(
    (dashboardSource.match(/className="english-title"/g) ?? []).length,
    5,
  );
  assert.match(
    dashboardSource,
    /<span className="english-title">V3S<\/span> 5개년 추이/,
  );
  assert.match(
    css,
    /\/\* Shared Volvo English title typography \*\/[\s\S]*?\.v3s-subhead \.english-title,[\s\S]*?\.score-tier-heading \.english-title,[\s\S]*?\.one-voice-title-row > \.english-title\s*\{([^}]*)\}/,
  );
  const englishRule = css.match(
    /\/\* Shared Volvo English title typography \*\/[\s\S]*?\.one-voice-title-row > \.english-title\s*\{([^}]*)\}/,
  );
  assert.ok(englishRule);
  assert.match(englishRule[1], /font-family: var\(--font-latin\);/);
  assert.match(englishRule[1], /font-weight: 800;/);
  assert.match(englishRule[1], /letter-spacing: 0\.02em;/);
  assert.doesNotMatch(englishRule[1], /font-size:/);
});

test("matches analysis headings to the ES90 performance-comparison title at 70 percent size", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const titleRule = css.match(
    /\/\* ES90 performance-comparison title typography at 70% of the prior size \*\/[\s\S]*?\.analysis-card-heading h2,[\s\S]*?\.v3s-award-heading h2\s*\{([^}]*)\}/,
  );

  assert.ok(titleRule);
  assert.match(titleRule[1], /font-family: var\(--font-korean\);/);
  assert.match(titleRule[1], /font-size: 14px;/);
  assert.match(titleRule[1], /font-weight: 600;/);
  assert.match(titleRule[1], /letter-spacing: -0\.25px;/);
});

test("keeps the V3S cumulative average on one line and gives the bars the recovered height", async () => {
  const [dashboardSource, summaryCss] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/V3SQuarterSummary.module.css", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    dashboardSource,
    /aria-label=\{`2026 누적 평균 \$\{displayNumber\(cumulativeAverage\)\}점`\}/,
  );
  assert.match(
    dashboardSource,
    /<span>2026 누적 평균<\/span>[\s\S]*?className=\{v3sQuarterSummaryStyles\.value\}[\s\S]*?className=\{v3sQuarterSummaryStyles\.unit\}>점<\/small>/,
  );
  assert.match(
    summaryCss,
    /\.inlineCumulative\s*\{[^}]*display: inline-flex[^}]*white-space: nowrap/,
  );
  assert.match(
    summaryCss,
    /\.compactCumulative > \.value\s*\{[^}]*font-size: 16px !important/,
  );
  assert.match(summaryCss, /\.compactBars\s*\{[^}]*height: 98px !important/);
  assert.match(
    summaryCss,
    /\.compactBars \.compactStage\s*\{[^}]*height: 66px !important/,
  );
});

test("provides an accessible, privacy-safe V3S evidence gallery for the Gangnam Daechi Q2 photos", async () => {
  const [dashboardSource, gallerySource, galleryCss] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/V3SEvidenceGallery.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/V3SEvidenceGallery.module.css", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(dashboardSource, /getV3sEvidence\(selected\.cdsid, quarter\)/);
  assert.match(dashboardSource, /<V3SEvidenceGallery/);
  assert.match(gallerySource, /"6KR6834"[\s\S]*?q2:/);
  assert.match(
    gallerySource,
    /\/evidence\/6KR6834\/v3s\/2026-q2\/valet-name-tag-mosaic\.png/,
  );
  assert.match(
    gallerySource,
    /\/evidence\/6KR6834\/v3s\/2026-q2\/brand-manager-badge-mosaic\.png/,
  );
  assert.match(gallerySource, /aria-modal="true"/);
  assert.match(gallerySource, /aria-label="증빙사진 닫기"/);
  assert.match(gallerySource, /event\.key === "Escape"/);
  assert.doesNotMatch(gallerySource, /얼굴 익명화 완료/);
  assert.doesNotMatch(gallerySource, /X 버튼·바깥 영역·Esc 키/);
  assert.match(galleryCss, /grid-template-columns: repeat\(auto-fit,/);
  assert.match(galleryCss, /object-fit: contain/);

  await Promise.all([
    access(
      new URL(
        "../public/evidence/6KR6834/v3s/2026-q2/valet-name-tag-mosaic.png",
        import.meta.url,
      ),
    ),
    access(
      new URL(
        "../public/evidence/6KR6834/v3s/2026-q2/brand-manager-badge-mosaic.png",
        import.meta.url,
      ),
    ),
  ]);
});
