import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost/"), {
      headers: { accept: "text/html", host: "localhost" },
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

test("redirects the removed login route to the sample dashboard", async () => {
  const response = await render();
  assert.ok([307, 308].includes(response.status));
  assert.match(response.headers.get("location") ?? "", /\/dashboard\/6KR6834$/);
});

test("server-renders the selected CDSID dashboard", async () => {
  const response = await render("/dashboard/6KR6834");
  assert.equal(response.status, 200);

  const html = await response.text();
  const visibleHtml = html.replaceAll("<!-- -->", "");
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
    /class="identity-title"><h1>볼보 강남 대치<\/h1><div class="update-status">/,
  );
  assert.match(
    html,
    /class="identity-detail-rail"[\s\S]*?<\/dl><button class="identity-profile"/,
  );
  assert.match(html, /identity-profile[\s\S]*?지점장[\s\S]*?김길성/);
  assert.match(html, /class="identity-profile-icon"/);
  assert.doesNotMatch(html, /class="identity-meta-row"/);
  assert.match(html, /class="identity-detail-rail"/);
  assert.doesNotMatch(visibleHtml, /평가 기준 한눈에 보기/);
  assert.match(html, /최근 업데이트/);
  assert.match(visibleHtml, /현재 Q3평가 진행중/);
  assert.doesNotMatch(visibleHtml, /Q2 원본 데이터 반영/);
  assert.match(html, /V3S/);
  assert.match(html, /VOC/);
  assert.match(html, /CX Index/);
  assert.equal((visibleHtml.match(/점 \/ 100점 만점/g) ?? []).length, 2);
  assert.equal((visibleHtml.match(/점 \/ 130점 만점/g) ?? []).length, 1);
  assert.equal((html.match(/class="metric-quarter-strip"/g) ?? []).length, 3);
  assert.match(
    visibleHtml,
    /V3S 분기 평가점수[\s\S]*Q1[\s\S]*94\.9[\s\S]*Q2[\s\S]*93\.6[\s\S]*Q3[\s\S]*Q4/,
  );
  assert.match(
    visibleHtml,
    /VOC 분기 평가점수[\s\S]*Q1[\s\S]*93\.1[\s\S]*Q2[\s\S]*87\.5[\s\S]*Q3[\s\S]*Q4/,
  );
  assert.match(
    visibleHtml,
    /CX Index 분기 평가점수[\s\S]*Q1[\s\S]*114\.7[\s\S]*Q2[\s\S]*113\.8[\s\S]*Q3[\s\S]*Q4/,
  );
  assert.equal((html.match(/class="quarter-score-row/g) ?? []).length, 4);
  assert.match(visibleHtml, /330점 만점/);
  assert.match(visibleHtml, /Q1[\s\S]*302\.7/);
  assert.match(visibleHtml, /Q2[\s\S]*294\.9/);
  assert.match(visibleHtml, /Q3[\s\S]*Q4/);
  assert.match(visibleHtml, /Q2 종합 점수[\s\S]*294\.9/);
  assert.match(visibleHtml, /상반기 누적 평균 298\.8점/);
  assert.match(visibleHtml, /Q2 전국 평균 <strong>305\.4/);
  assert.match(visibleHtml, /Q2 전국 평균 대비 <strong>-10\.5/);
  assert.match(visibleHtml, /전시장 경쟁력 전국 순위 <strong>32위 \/ 전체 39/);
  assert.match(visibleHtml, /종합 경쟁력/);
  assert.doesNotMatch(visibleHtml, /종합 전투력/);
  assert.doesNotMatch(visibleHtml, /볼보 전체 전시장|VOLVO KOREA/);
  assert.doesNotMatch(html, /class="group-context"/);
  assert.doesNotMatch(visibleHtml, /상위 83%/);
  assert.doesNotMatch(html, /class="combat-gauge"/);
  assert.doesNotMatch(visibleHtml, /WATCH|집중 관리 레벨|52-WEEK PULSE/);
  assert.doesNotMatch(visibleHtml, /카드를 선택하면 주간 흐름이 바뀝니다/);
  assert.match(html, /전국 39개/);
  assert.match(html, /6KR6834/);
  assert.equal((html.match(/class="identity-icon /g) ?? []).length, 3);
  assert.match(html, /identity-icon--dealer/);
  assert.match(html, /identity-icon--region/);
  assert.match(html, /identity-icon--size/);
  assert.doesNotMatch(visibleHtml, /⌂|◎|↔/);
  assert.equal((html.match(/class="table-row/g) ?? []).length, 3);
  assert.match(html, /class="comparison-head table-row"/);
  assert.match(visibleHtml, /권역별/);
  assert.match(visibleHtml, /<h1>볼보 강남 대치<\/h1>/);
  assert.match(visibleHtml, /볼보 강남 대치 실제값 · W26 100\.0점 · 입력 25주/);
  assert.match(visibleHtml, /전국 주간 평균 · W26 91\.8점 · 평균 미달 11주/);
  assert.match(visibleHtml, /52주 스코어 추이/);
  assert.doesNotMatch(visibleHtml, /주간 성과 흐름/);
  assert.match(html, /class="trend-selector"/);
  assert.doesNotMatch(html, /class="trend-selector-icon"/);
  assert.doesNotMatch(html, /show-values-toggle/);
  assert.doesNotMatch(visibleHtml, /모든 값 표시/);
  assert.match(html, /aria-label="VOC 52주 추이 보기" aria-pressed="true"/);
  assert.doesNotMatch(html, /class="segmented"/);
  for (let week = 1; week <= 52; week += 1) {
    assert.match(html, new RegExp(`W${String(week).padStart(2, "0")}`));
  }
  assert.match(html, /r="4.5" class="national-average-point"/);
  const actualMarkerWeeks = [
    ...html.matchAll(
      /width="9" height="9" data-week="(W\d{2})" class="actual-week-point"/g,
    ),
  ].map((match) => match[1]);
  assert.equal(actualMarkerWeeks.length, 25);
  assert.deepEqual(
    actualMarkerWeeks,
    Array.from({ length: 26 }, (_, index) => `W${String(index + 1).padStart(2, "0")}`)
      .filter((week) => week !== "W22"),
  );
  const actualLabelCount = (html.match(/class="actual-point-value"/g) ?? []).length;
  assert.equal(actualLabelCount, 25);
  assert.equal((html.match(/class="national-point-value"/g) ?? []).length, 26);
  assert.match(html, /aria-label="W01부터 시작하는 52주 성과 그래프"/);
  assert.match(html, /class="future-window"/);
  assert.match(visibleHtml, /Q3 평가 진행 중/);
  assert.match(visibleHtml, /데이터 집계 후 자동 반영됩니다\./);
  assert.doesNotMatch(html, /class="average-label"|class="point-value"/);
  assert.match(html, /class="coverage-line actual"/);
  assert.match(html, /class="coverage-line national"/);
  assert.equal((html.match(/class="comparison-bar"/g) ?? []).length, 3);
  assert.equal((html.match(/<b aria-hidden="true" style="left:/g) ?? []).length, 3);
  assert.match(visibleHtml, /내 전시장/);
  assert.match(visibleHtml, /전국 39개점 기준/);
  assert.match(visibleHtml, /볼보 강남 대치 경쟁력/);
  assert.doesNotMatch(visibleHtml, /COMPETITIVE POSITION/);
  assert.match(html, /aria-label="VOC 분기 평가점수"/);
  assert.match(html, /경고: Q2 전국 평균 대비 5점 이상 미달/);
  assert.match(visibleHtml, /Q2 전국 평균 대비[\s\S]*?-7\.9점/);
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
  assert.match(visibleHtml, /평가 기준 한눈에 보기/);
  assert.match(visibleHtml, /V3S · VOC · CX Index의 산정 구조/);
  assert.match(html, /href="\/dashboard\/6KR6834"/);
  assert.match(visibleHtml, /500점을 100점으로 환산/);
});

test("ships project metadata and removes the disposable starter", async () => {
  const [page, dashboardPage, criteriaPage, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/[cdsid]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/[cdsid]/criteria/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /redirect\("\/dashboard\/6KR6834"\)/);
  assert.doesNotMatch(page, /LoginHome/);
  assert.match(dashboardPage, /import Dashboard/);
  assert.match(dashboardPage, /isEditorEmail/);
  assert.match(criteriaPage, /CriteriaGuide/);
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
  const weekly = JSON.parse(
    await readFile(new URL("../app/data/weekly.json", import.meta.url), "utf8"),
  );

  assert.equal(weekly.meta.vocLatestWeek, 26);
  assert.equal(weekly.meta.cxLatestWeek, 30);
  assert.equal(Object.keys(weekly.voc.byCdsid).length, 39);
  assert.equal(Object.keys(weekly.cx.byCdsid).length, 39);
  assert.equal(weekly.voc.byCdsid["6KR6834"][0], 100);
  assert.equal(
    weekly.voc.byCdsid["6KR6834"]
      .slice(0, 26)
      .filter((value) => value !== null).length,
    25,
  );
  assert.equal(weekly.voc.byCdsid["6KR6834"][13], 64);
  assert.equal(weekly.voc.byCdsid["6KR6834"][16], 64);
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
    /className=\{signal\.delta >= 0 \? "positive" : "negative"\}/,
  );

  assert.match(dashboardSource, /const plotLeft = 28/);
  assert.match(dashboardSource, /const plotRight = 1332/);
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
  assert.match(dashboardSource, /const activeQuarterStart = weekBoundaryX\(26\)/);
  assert.match(dashboardSource, /const activeQuarterEnd = weekBoundaryX\(39\)/);
  assert.match(
    dashboardSource,
    /x1=\{weekBoundaryX\(completedWeeks\)\}[\s\S]*?data-week-boundary=\{completedWeeks\}/,
  );
  assert.match(dashboardSource, /preserveAspectRatio="none"/);
  assert.match(
    dashboardSource,
    /width=\{activeQuarterEnd - activeQuarterStart\}/,
  );
  assert.doesNotMatch(dashboardSource, /isMajorWeek/);
  assert.match(dashboardSource, /\{label\}\s*<\/span>/);
  assert.match(dashboardSource, /<span>전국 평균 대비<\/span>/);
  assert.match(css, /\.quarter-band\s*\{[\s\S]*?margin: 0 2\.0588235%/);
  assert.match(css, /\.week-ruler\s*\{[\s\S]*?margin: -18px 2\.0588235% 8px/);
  assert.match(css, /\.week-grid\s*\{[\s\S]*?stroke-width: 0\.6/);
  assert.match(css, /\.average-trend-line\s*\{[\s\S]*?stroke-width: 1\.45/);
  assert.match(
    css,
    /\.average-trend-line\s*\{[\s\S]*?stroke-width: 1\.45[\s\S]*?animation: none/,
  );
  assert.match(
    css,
    /\.trend-line\s*\{[\s\S]*?stroke-width: 1\.8[\s\S]*?stroke-dasharray: 1[\s\S]*?animation: showroom-line-draw 520ms cubic-bezier\(0\.32, 0, 0\.2, 1\) 1420ms both/,
  );
  assert.match(dashboardSource, /pathLength="1"[\s\S]*?className="trend-line"/);
  assert.match(
    dashboardSource,
    /const chartAnimationStart = 1420[\s\S]*?const chartAnimationDuration = 520/,
  );
  assert.match(css, /@keyframes showroom-line-draw\s*\{[\s\S]*?stroke-dashoffset: 1[\s\S]*?stroke-dashoffset: 0/);
});

test("ships the premium neutral design system and Pretendard typography", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /font-family: "Pretendard Variable"/);
  assert.match(css, /--font-korean:[\s\S]*"Pretendard Variable"[\s\S]*"SUIT"/);
  assert.match(css, /--font-latin:[\s\S]*"Inter"/);
  assert.match(css, /--paper: #f6f8fa/);
  assert.match(css, /--white: #ffffff/);
  assert.match(css, /--line: #e5e9ee/);
  assert.match(css, /--ink: #111827/);
  assert.match(css, /--secondary: #667085/);
  assert.match(css, /--muted: #98a2b3/);
  assert.match(css, /--navy: #102a43/);
  assert.match(css, /--blue: #2f6b8a/);
  assert.match(css, /--good: #1f8f6a/);
  assert.match(css, /--warning: #d14b41/);
  assert.match(css, /\.positive\s*\{\s*color: var\(--blue\) !important;/);
  assert.match(css, /\.negative\s*\{\s*color: var\(--caution\) !important;/);
  assert.match(css, /--caution: #c58a1b/);
  assert.match(css, /\.dashboard\s*\{[\s\S]*?padding: 24px 32px 40px/);
  assert.match(
    css,
    /\.identity-strip h1\s*\{[\s\S]*?font-family: var\(--font-korean\)[\s\S]*?font-size: clamp\(40px, 3\.25vw, 44px\)/,
  );
  assert.match(
    css,
    /\.identity-strip\s*\{[\s\S]*?min-height: 76px[\s\S]*?margin-bottom: 12px/,
  );
  assert.match(css, /\.identity-detail-rail\s*\{[\s\S]*?border-radius: 8px/);
  assert.match(
    css,
    /\.identity-strip dl div\s*\{[\s\S]*?width: 126px[\s\S]*?min-width: 126px[\s\S]*?justify-items: center/,
  );
  assert.match(
    css,
    /\.identity-strip dt,[\s\S]*?\.identity-profile-role\s*\{[\s\S]*?width: 100%[\s\S]*?text-align: center/,
  );
  assert.match(
    css,
    /\.identity-profile\s*\{[\s\S]*?width: 126px[\s\S]*?min-width: 126px[\s\S]*?justify-items: center/,
  );
  assert.match(
    css,
    /\.identity-icon--dealer::before\s*\{[\s\S]*?border: 1\.4px solid currentColor/,
  );
  assert.match(
    css,
    /\.identity-icon--region::before\s*\{[\s\S]*?border-radius: 50% 50% 50% 2px/,
  );
  assert.match(
    css,
    /\.identity-icon--size::before\s*\{[\s\S]*?border-top: 1\.4px solid currentColor/,
  );
  assert.match(css, /\.combat-card\s*\{[\s\S]*?min-height: 286px[\s\S]*?padding: 24px/);
  assert.match(css, /\.metric-card\s*\{[\s\S]*?min-height: 286px[\s\S]*?padding: 24px/);
  assert.match(css, /\.metric-card-value\s*\{[\s\S]*?font-size: clamp\(46px, 3\.25vw, 56px\)/);
  assert.match(
    css,
    /\.metric-card-value span\s*\{[\s\S]*?margin-left: 10px[\s\S]*?letter-spacing: 0\.02em[\s\S]*?word-spacing: 0\.08em/,
  );
  assert.match(css, /\.trend-selector\s*\{[\s\S]*?border-radius: 8px/);
  assert.match(css, /\.trend-selector button\s*\{[\s\S]*?height: 40px[\s\S]*?border-radius: 6px/);
  assert.match(css, /\.trend-selector button\.active\s*\{[\s\S]*?background: var\(--navy\)/);
  assert.match(css, /\.trend-chart\s*\{[\s\S]*?height: 210px/);
  assert.match(css, /\.chart-tooltip\s*\{[\s\S]*?border-radius: 12px/);
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
    /\.metric-card\.warning \.metric-track span\s*\{[\s\S]*?linear-gradient\(90deg, #b83e37 0%, var\(--warning\) 68%, #df6c64 100%\)/,
  );
  assert.match(
    css,
    /\.metric-card\.caution \.metric-track span\s*\{[\s\S]*?linear-gradient\(90deg, #a66f13 0%, var\(--caution\) 68%, #dda848 100%\)/,
  );
  assert.match(css, /@keyframes progress-fill\s*\{[\s\S]*?transform: scaleX\(0\)[\s\S]*?transform: scaleX\(1\)/);
  assert.match(css, /\.comparison-controls select\s*\{[\s\S]*?height: 44px/);
  assert.match(css, /\.comparison-table\s*\{[\s\S]*?display: grid[\s\S]*?gap: 8px/);
  assert.match(css, /\.table-row\.selected\s*\{[\s\S]*?background: #eef5f8/);
  assert.match(
    css,
    /\.comparison-value small\s*\{[\s\S]*?display: flex[\s\S]*?white-space: nowrap/,
  );
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  await Promise.all([
    access(new URL("public/fonts/pretendard-variable.ttf", templateRoot)),
  ]);
});
