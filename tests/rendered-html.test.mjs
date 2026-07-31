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
    /class="identity-title"><h1>볼보 강남대치<\/h1><div class="update-status">/,
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
  assert.doesNotMatch(visibleHtml, /Q2 종합 점수/);
  assert.match(visibleHtml, /누적 평균[\s\S]*298\.8[\s\S]*Q1·Q2 평가 기준/);
  assert.equal((html.match(/aria-label="Q[12] 지표 보기"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-label="Q[34] 평가 예정"/g) ?? []).length, 2);
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
  assert.equal((html.match(/class="table-row/g) ?? []).length, 3);
  assert.match(html, /class="comparison-head table-row"/);
  assert.match(visibleHtml, /권역별/);
  assert.match(visibleHtml, /<h1>볼보 강남대치<\/h1>/);
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
  assert.match(html, /class="trend-selector"/);
  assert.doesNotMatch(html, /class="trend-selector-icon"/);
  assert.doesNotMatch(html, /show-values-toggle/);
  assert.doesNotMatch(visibleHtml, /모든 값 표시/);
  assert.match(html, /aria-label="VOC 52주 추이 보기" aria-pressed="true"/);
  assert.doesNotMatch(html, /class="segmented"/);
  for (let week = 1; week <= 52; week += 1) {
    assert.match(html, new RegExp(`W${String(week).padStart(2, "0")}`));
  }
  assert.match(html, /r="3.15" class="national-average-point"/);
  const actualMarkerWeeks = [
    ...html.matchAll(
      /width="6.3" height="6.3" data-week="(W\d{2})" class="actual-week-point"/g,
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
  assert.match(html, /class="future-window future-window-upcoming"/);
  assert.match(visibleHtml, /Q4 평가 예정 중/);
  assert.match(visibleHtml, /데이터 집계 후 자동 반영됩니다\./);
  assert.doesNotMatch(html, /class="average-label"|class="point-value"/);
  assert.match(html, /class="coverage-line actual"/);
  assert.match(html, /class="coverage-line national"/);
  assert.doesNotMatch(html, /class="trend-line-base"/);
  assert.match(html, /class="trend-line"/);
  assert.equal((html.match(/class="comparison-bar"/g) ?? []).length, 3);
  assert.equal((html.match(/<b aria-hidden="true" style="left:/g) ?? []).length, 3);
  assert.match(visibleHtml, /내 전시장/);
  assert.match(visibleHtml, /딜러 · 권역 · 사이즈/);
  assert.match(visibleHtml, /점수 차이/);
  assert.doesNotMatch(visibleHtml, /점수 · 평균 대비/);
  assert.match(visibleHtml, /class="dealer-region">[^<]+ · [^<]+ · [^<]+<\/span>/);
  assert.doesNotMatch(visibleHtml, /전국 39개점 기준/);
  assert.doesNotMatch(visibleHtml, />비교 그룹<|>비교 지표</);
  assert.match(visibleHtml, /볼보 강남대치 경쟁력/);
  assert.doesNotMatch(visibleHtml, /COMPETITIVE POSITION/);
  assert.match(html, /aria-label="VOC 분기 평가점수"/);
  assert.match(html, /위험 신호: Q2 전국 평균 대비 5점 이상 미달/);
  assert.match(visibleHtml, /위험 신호/);
  assert.match(html, /주의 필요: Q2 전국 평균 미만, 5점 미만 차이/);
  assert.equal((visibleHtml.match(/>주의 필요<\/span>/g) ?? []).length, 2);
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

test("serves the dual-metric competitive analysis sample", async () => {
  const response = await render(
    "/dashboard/6KR6834/analysis?view=dealer",
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  const visibleHtml = html.replaceAll("<!-- -->", "");
  assert.match(visibleHtml, /볼보 강남대치 경쟁력 분석/);
  assert.match(visibleHtml, /소속 딜러사 내 분석/);
  assert.match(visibleHtml, /전국 전시장 내 분석/);
  assert.match(visibleHtml, /동일 수도권 내 분석/);
  assert.match(visibleHtml, /동일 사이즈 내 분석/);
  assert.match(
    html,
    /aria-pressed="true"[\s\S]*?소속 딜러사 내 분석/,
  );
  assert.match(visibleHtml, /고객만족도 × 해피콜 이행/);
  assert.match(visibleHtml, /고객만족도[\s\S]*87\.5/);
  assert.match(visibleHtml, /VOC \+ ONE Voice \/ 상담 및 출고 후 만족도 평가/);
  assert.doesNotMatch(visibleHtml, /VOC · 상담\/시승\/출고 경험/);
  assert.match(visibleHtml, /해피콜 이행[\s\S]*100\.0/);
  assert.match(
    visibleHtml,
    /VOC \+ ONE Voice \/ 상담 및 출고 후 해피콜 시행여부/,
  );
  assert.doesNotMatch(visibleHtml, /상담\/출고 사후관리 실행력/);
  assert.match(visibleHtml, /균형 경쟁력[\s\S]*93\.8/);
  assert.match(visibleHtml, /고객만족도와 해피콜 합산 평균/);
  assert.doesNotMatch(visibleHtml, /고객만족도와 해피콜 단순 평균/);
  assert.match(visibleHtml, /만족도[\s\S]*해피콜[\s\S]*합산 평균/);
  assert.match(visibleHtml, /에이치 순위/);
  assert.match(html, /class="analysis-scatter"/);
  assert.match(visibleHtml, /해피콜 평균 \d+\.\d점/);
  assert.match(visibleHtml, /고객만족도 평균 \d+\.\d점/);
  assert.equal((html.match(/class="scatter-point /g) ?? []).length, 7);
  assert.match(html, /class="scatter-point selected\b/);
  assert.equal(
    (html.match(/class="scatter-label comparison"/g) ?? []).length,
    6,
  );
  assert.equal((html.match(/class="analysis-rank"/g) ?? []).length, 7);
  assert.match(visibleHtml, /볼보 분당/);
  assert.match(html, /href="\/dashboard\/6KR6834"/);

  const regionResponse = await render(
    "/dashboard/6KR6834/analysis?view=region",
  );
  assert.equal(regionResponse.status, 200);
  const regionVisibleHtml = (await regionResponse.text()).replaceAll(
    "<!-- -->",
    "",
  );
  assert.match(regionVisibleHtml, /수도권 10위 \/ 전체 19/);
  assert.match(regionVisibleHtml, /볼보 강남신사/);
  assert.match(regionVisibleHtml, /볼보 분당판교/);
  assert.doesNotMatch(regionVisibleHtml, /볼보 강남 신사|볼보 분당 판교/);

  const sizeResponse = await render(
    "/dashboard/6KR6842/analysis?view=size",
  );
  assert.equal(sizeResponse.status, 200);
  const sizeHtml = await sizeResponse.text();
  assert.match(sizeHtml, /scatter-point [^"]*dense/);
  assert.match(sizeHtml, /scatter-label comparison/);
  assert.match(sizeHtml, /style="opacity:1;visibility:visible"/);
  assert.match(sizeHtml, /볼보 해운대/);

  const showroomResponse = await render(
    "/dashboard/6KR6834/analysis?view=showroom",
  );
  assert.equal(showroomResponse.status, 200);
  const showroomHtml = await showroomResponse.text();
  assert.equal(
    (showroomHtml.match(/class="scatter-label comparison"/g) ?? []).length,
    38,
  );
  assert.equal(
    (showroomHtml.match(/style="opacity:1;visibility:visible"/g) ?? []).length,
    39,
  );
  assert.match(showroomHtml.replaceAll("<!-- -->", ""), /전시장 25위 \/ 전체 39/);
  assert.doesNotMatch(showroomHtml.replaceAll("<!-- -->", ""), /전국 전시장 25위 \/ 전체 39/);
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

  assert.match(page, /redirect\("\/dashboard\/6KR6834"\)/);
  assert.doesNotMatch(page, /LoginHome/);
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
  const weekly = JSON.parse(
    await readFile(new URL("../app/data/weekly.json", import.meta.url), "utf8"),
  );

  assert.equal(weekly.meta.vocLatestWeek, 26);
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
  assert.match(
    dashboardSource,
    /const evaluationProgressWeek = Math\.max\(26, Math\.min\(latestWeek, 39\)\)/,
  );
  assert.match(
    dashboardSource,
    /const activeQuarterStart = weekBoundaryX\(evaluationProgressWeek\)/,
  );
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
  assert.match(dashboardSource, /function V3SPerformance/);
  assert.match(
    dashboardSource,
    /label: "Q3"[\s\S]*?statusText: "Q3 평가진행"/,
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
  assert.match(dashboardSource, /trendMetric === "v3s"/);
  assert.match(dashboardSource, /analysis\?view=showroom/);
  assert.doesNotMatch(dashboardSource, /2026 PERFORMANCE/);
  assert.doesNotMatch(dashboardSource, /2021–2025 HISTORY/);
  assert.match(dashboardSource, /5개년 데이터 연결 예정/);
  assert.match(
    dashboardSource,
    /historicalV3s\?: HistoricalV3sPoint\[\]/,
  );
  assert.match(
    dashboardSource,
    /quarterValueOf\(selected, "v3s", selectedQuarter\)/,
  );
  assert.match(
    dashboardSource,
    /quarterAverageOf\("v3s", selectedQuarter\)/,
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
    /\.future-window\s*\{[\s\S]*?fill: #eef2f5[\s\S]*?opacity: 0\.9/,
  );
  assert.match(css, /\.future-window-label\s*\{[\s\S]*?fill: #596b80/);
  assert.match(css, /\.future-window-help\s*\{[\s\S]*?fill: #8795a7/);
  assert.match(
    css,
    /\.trend-line\s*\{[\s\S]*?stroke-width: 1\.8[\s\S]*?stroke-dasharray: 1\.02 1[\s\S]*?stroke-linecap: round[\s\S]*?stroke-linejoin: round[\s\S]*?animation: showroom-line-draw 520ms linear 1420ms both/,
  );
  assert.match(dashboardSource, /pathLength="1"[\s\S]*?className="trend-line"/);
  assert.match(
    dashboardSource,
    /const chartAnimationStart = 1420[\s\S]*?const chartAnimationDuration = 520[\s\S]*?const chartAnimationPointLag = 18/,
  );
  assert.match(
    dashboardSource,
    /const pointTravelByWeek = new Map<number, number>\(\)[\s\S]*?Math\.hypot\([\s\S]*?pointTravelByWeek\.set\(point\.week, totalPointTravel\)/,
  );
  assert.match(
    dashboardSource,
    /key=\{`\$\{selected\.cdsid\}-\$\{trendMetric\}`\}[\s\S]*?showroom=\{selected\}[\s\S]*?metric=\{trendMetric\}/,
  );
  assert.match(
    dashboardSource,
    /const markerSize = 6\.3;[\s\S]*?const markerRadius = markerSize \/ 2;/,
  );
  assert.match(
    dashboardSource,
    /width=\{markerSize\}[\s\S]*?height=\{markerSize\}/,
  );
  assert.equal((dashboardSource.match(/r=\{markerRadius\}/g) ?? []).length, 2);
  assert.match(css, /@keyframes showroom-line-draw\s*\{[\s\S]*?stroke-dashoffset: 1[\s\S]*?stroke-dashoffset: 0/);
});

test("ships the premium neutral design system and Pretendard typography", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const dashboardSource = await readFile(
    new URL("../app/Dashboard.tsx", import.meta.url),
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
  assert.doesNotMatch(
    css,
    /\.scatter-point\.dense:not\(\.selected\)\s*>\s*b\s*\{[^}]*opacity:\s*0\s*;/s,
  );
  assert.match(css, /\.dashboard\s*\{[\s\S]*?padding: 24px 32px 40px/);
  assert.match(
    css,
    /\.identity-strip h1\s*\{[\s\S]*?font-family: var\(--font-korean\)[\s\S]*?font-size: clamp\(40px, 3\.25vw, 44px\)/,
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
    /@media \(min-width: 761px\)\s*\{[\s\S]*?\.identity-detail-rail\s*\{[\s\S]*?grid-template-columns: repeat\(4, 126px\)/,
  );
  assert.match(
    css,
    /@media \(min-width: 761px\)\s*\{[\s\S]*?\.identity-strip dl\s*\{[\s\S]*?display: contents/,
  );
  assert.match(
    css,
    /\.identity-strip dl div\s*\{[\s\S]*?width: 126px[\s\S]*?min-width: 126px[\s\S]*?justify-items: center/,
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
    /className="combat-score-number"[\s\S]*?displayNumber\(cumulativeAverage\)/,
  );
  assert.match(
    css,
    /\.combat-score-number\s*\{[\s\S]*?animation: combat-score-drop 760ms cubic-bezier\(0\.16, 1, 0\.3, 1\) 180ms both/,
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
    /\.metric-card-value span\s*\{[\s\S]*?margin-left: 10px[\s\S]*?letter-spacing: 0\.02em[\s\S]*?word-spacing: 0\.08em/,
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
    /\.v3s-peer-bar\s*\{[\s\S]*?width: 18px[\s\S]*?min-width: 18px[\s\S]*?animation: v3s-bar-rise 760ms/,
  );
  assert.match(
    css,
    /\.v3s-bar-cluster\s*\{[\s\S]*?width: min\(98%, 146px\)[\s\S]*?gap: 12px[\s\S]*?\.v3s-peer-bar-group\s*\{[\s\S]*?width: 64px[\s\S]*?flex: 0 0 64px[\s\S]*?gap: 5px/,
  );
  assert.match(css, /\.v3s-peer-bar b\s*\{[\s\S]*?font-size: 7px/);
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
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.combat-summary-stack strong,[\s\S]*?\.metric-card-value\s*\{[^}]*min-height: 70px[^}]*display: flex[^}]*align-items: flex-end[^}]*margin-top: 0/,
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
    /\.metric-card\.warning \.metric-track span\s*\{[\s\S]*?linear-gradient\(90deg, #b83e37 0%, var\(--warning\) 68%, #df6c64 100%\)/,
  );
  assert.match(
    css,
    /\.metric-card\.caution \.metric-track span\s*\{[\s\S]*?linear-gradient\(90deg, #a66f13 0%, var\(--caution\) 68%, #dda848 100%\)/,
  );
  assert.match(css, /@keyframes progress-fill\s*\{[\s\S]*?transform: scaleX\(0\)[\s\S]*?transform: scaleX\(1\)/);
  assert.match(css, /\.comparison-controls select\s*\{[\s\S]*?height: 44px/);
  assert.match(css, /\.comparison-table\s*\{[\s\S]*?display: grid[\s\S]*?gap: 8px/);
  assert.match(
    css,
    /\.table-row\.selected\s*\{[\s\S]*?background: #eef5f8;[\s\S]*?0 12px 22px -16px rgba\(16, 42, 67, 0\.42\)/,
  );
  assert.match(
    css,
    /\.analysis-ranking-list > div\.selected\s*\{[^}]*border-color: rgba\(47, 107, 138, 0\.11\)[^}]*inset 3px 0 0 var\(--blue\)[^}]*0 12px 22px -16px rgba\(16, 42, 67, 0\.42\)/,
  );
  assert.match(
    css,
    /\.comparison-value small\s*\{[\s\S]*?display: flex[\s\S]*?white-space: nowrap/,
  );
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  await Promise.all([
    access(new URL("public/fonts/pretendard-variable.ttf", templateRoot)),
  ]);
});
