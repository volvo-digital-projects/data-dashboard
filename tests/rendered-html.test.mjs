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
  assert.match(html, /전시장 전투력/);
  assert.match(html, /3대 핵심 지표/);
  assert.doesNotMatch(html, /CORE SIGNALS/);
  assert.doesNotMatch(html, /class="topbar"/);
  assert.doesNotMatch(html, /class="identity-tools"|class="identity-tool"/);
  assert.match(
    html,
    /class="identity-detail-rail"[\s\S]*?<\/dl><button class="identity-profile"/,
  );
  assert.match(html, /identity-profile[\s\S]*?지점장[\s\S]*?김길성/);
  assert.match(html, /class="identity-profile-icon"/);
  assert.match(html, /class="identity-meta-row"/);
  assert.match(html, /class="identity-detail-rail"/);
  assert.doesNotMatch(visibleHtml, /평가 기준 한눈에 보기/);
  assert.match(html, /최근 업데이트/);
  assert.match(visibleHtml, /Q3 평가 진행중입니다\./);
  assert.doesNotMatch(visibleHtml, /Q2 원본 데이터 반영/);
  assert.match(html, /V3S/);
  assert.match(html, /VOC/);
  assert.match(html, /CX Index/);
  assert.equal((html.match(/class="quarter-score-row/g) ?? []).length, 2);
  assert.match(visibleHtml, /330점 만점/);
  assert.match(visibleHtml, /Q1[\s\S]*302\.7/);
  assert.match(visibleHtml, /Q2[\s\S]*294\.9/);
  assert.match(visibleHtml, /전국 평균 <strong>305\.4/);
  assert.doesNotMatch(html, /class="combat-gauge"/);
  assert.doesNotMatch(visibleHtml, /WATCH|집중 관리 레벨|52-WEEK PULSE/);
  assert.doesNotMatch(visibleHtml, /카드를 선택하면 주간 흐름이 바뀝니다/);
  assert.match(html, /전국 39개/);
  assert.match(html, /6KR6834/);
  assert.equal((html.match(/identity-icon/g) ?? []).length, 3);
  assert.equal((html.match(/class="table-row/g) ?? []).length, 3);
  assert.match(html, /class="comparison-head table-row"/);
  assert.match(visibleHtml, /권역별/);
  assert.match(visibleHtml, /<h1>볼보 강남 대치<\/h1>/);
  assert.match(visibleHtml, /볼보 강남 대치 실제값 · W26 100\.0점 · 입력 25주/);
  assert.match(visibleHtml, /전국 주간 평균 · W26 91\.8점 · 평균 미달 11주/);
  assert.match(visibleHtml, /52주 스코어 추이/);
  assert.doesNotMatch(visibleHtml, /주간 성과 흐름/);
  assert.match(html, /class="trend-selector"/);
  assert.equal((html.match(/class="trend-selector-icon"/g) ?? []).length, 3);
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
  assert.equal((html.match(/class="actual-point-value"/g) ?? []).length, 25);
  assert.doesNotMatch(html, /class="average-label"|class="point-value"/);
  assert.match(html, /class="coverage-line actual"/);
  assert.match(html, /class="coverage-line national"/);
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

test("ships Volvo Centum for Latin text and Paperlogy 5 for Korean text", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /font-family: "Volvo Centum Web"/);
  assert.match(css, /font-family: "Paperlogy 5"/);
  assert.match(css, /font-family: "Paperlogy 9"/);
  assert.match(css, /\.identity-strip h1[\s\S]*font-family: "Paperlogy 9"/);
  assert.match(css, /\.identity-strip\s*\{[\s\S]*?min-height: 86px/);
  assert.match(css, /\.identity-strip h1[\s\S]*?font-size: clamp\(35px, 2\.85vw, 44px\)/);
  assert.match(css, /\.identity-meta-row[\s\S]*?align-items: flex-end/);
  assert.match(css, /\.identity-detail-rail[\s\S]*?justify-content: flex-end/);
  assert.match(css, /\.identity-strip dl div[\s\S]*?padding: 0 10px 0 0/);
  assert.match(css, /\.identity-icon[\s\S]*?width: 30px[\s\S]*?height: 100%/);
  assert.match(css, /\.identity-profile\s*\{[\s\S]*?width: 112px/);
  assert.match(css, /\.combat-card\s*\{[\s\S]*?min-height: 294px/);
  assert.match(css, /\.quarter-score-row\s*\{[\s\S]*?min-height: 28px/);
  assert.match(css, /\.quarter-score-row > strong[\s\S]*?font-size: 14px/);
  assert.doesNotMatch(css, /\.combat-gauge/);
  assert.doesNotMatch(css, /\.tier-badge/);
  assert.match(css, /\.metric-card\s*\{[\s\S]*?border-radius: 4px/);
  assert.match(css, /\.trend-chart\s*\{[\s\S]*?height: 164px/);
  assert.match(css, /\.quarter-band strong[\s\S]*?font-size: 11px/);
  assert.match(css, /\.week-ruler\s*\{[\s\S]*?margin: -19px 24px 3px/);
  assert.match(css, /\.week-ruler span[\s\S]*?font-size: 8px/);
  assert.match(css, /\.actual-point-value[\s\S]*?font-size: 8px/);
  assert.match(css, /\.average-trend-line[\s\S]*stroke-width: 2\.5/);
  assert.match(css, /\.trend-line[\s\S]*stroke-width: 2\.5/);
  assert.match(css, /--font-ui:[\s\S]*var\(--font-volvo\)[\s\S]*var\(--font-korean\)/);
  assert.doesNotMatch(css, /Georgia|Helvetica|Pretendard|--font-sans/);

  await Promise.all([
    access(new URL("public/fonts/volvo-centum-light.ttf", templateRoot)),
    access(new URL("public/fonts/volvo-centum-regular.ttf", templateRoot)),
    access(new URL("public/fonts/volvo-centum-semibold.ttf", templateRoot)),
    access(new URL("public/fonts/volvo-centum-bold.ttf", templateRoot)),
    access(new URL("public/fonts/paperlogy-5-medium.ttf", templateRoot)),
    access(new URL("public/fonts/paperlogy-9-black.ttf", templateRoot)),
  ]);
});
