import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

const staleLoginCookie =
  "volvo-dashboard-access=vck-manager-session-260825-b8f41d";
const loginCookieBase = "vck-manager-session-260826-role-scope-c83d42";
const cookieFor = (cdsid) =>
  `volvo-dashboard-access=${loginCookieBase}--${cdsid.toUpperCase()}`;
const loginCookie = cookieFor("VCK-ES90");

test("uses the current Jeju showroom manager", async () => {
  const dashboard = JSON.parse(
    await readFile(new URL("../app/data/showrooms.json", import.meta.url), "utf8"),
  );
  const jeju = dashboard.showrooms.find((showroom) => showroom.cdsid === "6KR6859");
  assert.equal(jeju?.showroom, "볼보 제주");
  assert.equal(jeju?.manager, "이성민");
  assert.equal(jeju?.q1?.manager, "이성민");
});

test("keeps the 2021-2026 certification results complete and cumulative", async () => {
  const certifications = JSON.parse(
    await readFile(new URL("../app/data/staff-certifications.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(certifications.sourceYears, [2021, 2022, 2023, 2024, 2025, 2026]);
  assert.equal(certifications.records.length, 180);
  for (const year of certifications.sourceYears) {
    const yearly = certifications.records.filter((record) => record.year === year);
    assert.equal(yearly.length, 30, `${year} 인증 결과는 30명이어야 합니다.`);
    assert.equal(
      new Set(yearly.map((record) => `${record.name}|${record.showroom}`)).size,
      30,
      `${year} 인증 결과에 중복 직원이 없어야 합니다.`,
    );
  }
  assert.deepEqual(
    Object.fromEntries(
      ["Grand", "Advanced", "Certified"].map((level) => [
        level,
        certifications.records.filter((record) => record.level === level).length,
      ]),
    ),
    { Grand: 40, Advanced: 60, Certified: 80 },
  );
  const certifications2022 = certifications.records
    .filter((record) => record.year === 2022)
    .map((record) => `${record.name}:${record.level}`);
  assert.deepEqual(certifications2022, [
    "진주현:Grand", "안재현:Grand", "김형권:Grand", "김충현:Grand",
    "김태환:Grand", "김대준:Grand", "김호연:Grand", "이정환:Grand",
    "유성권:Grand", "박상혁:Grand", "백광현:Advanced", "문은지:Advanced",
    "홍국표:Advanced", "윤종현:Advanced", "안희철:Advanced", "이희도:Advanced",
    "권순영:Advanced", "임지운:Advanced", "김민지:Advanced", "최재형:Advanced",
    "김준성:Certified", "이강일:Certified", "엄재상:Certified", "장길호:Certified",
    "장호영:Certified", "이동담:Certified", "송민경:Certified", "김형선:Certified",
    "정기훈:Certified", "임태우:Certified",
  ]);
  assert.equal(
    certifications.records.some(
      (record) => record.year === 2022 && record.name === "이종인",
    ),
    false,
  );
  assert.equal(
    certifications.records.filter(
      (record) =>
        record.year === 2026 &&
        record.name === "원효" &&
        record.showroom === "광주" &&
        record.level === "Advanced",
    ).length,
    1,
  );
  assert.equal(certifications.records.some((record) => record.name === "원호"), false);
  const uijeongbuGrand = certifications.records.find(
    (record) =>
      record.year === 2026 &&
      record.showroom === "의정부" &&
      record.level === "Grand",
  );
  assert.equal(uijeongbuGrand?.name, "이송봉");
  assert.equal(uijeongbuGrand?.sourceName, "이승복");
  const kimDaeJun = certifications.records.filter((record) => record.name === "김대준");
  assert.deepEqual(
    Object.fromEntries(
      ["Grand", "Advanced", "Certified"].map((level) => [
        level,
        kimDaeJun.filter((record) => record.level === level).length,
      ]),
    ),
    { Grand: 3, Advanced: 1, Certified: 0 },
  );
});

test("shows Sales-DMS job titles beside the selected staff name", async () => {
  const [staffAnalysis, analysisSource, css] = await Promise.all([
    readFile(new URL("../app/data/voc-staff-analysis.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const employees = Object.values(staffAnalysis.showrooms).flatMap(
    (showroom) => showroom.employees,
  );
  const gangnamDaechi = staffAnalysis.showrooms["6KR6834"].employees;
  assert.ok(employees.length >= 300);
  assert.equal(
    staffAnalysis.showrooms["6KR6857"].employees.some(
      (employee) => employee.name === "이송봉",
    ),
    true,
  );
  assert.ok(employees.every((employee) => employee.jobTitle));
  assert.equal(gangnamDaechi.find((employee) => employee.name === "문정환").jobTitle, "팀장");
  assert.equal(
    staffAnalysis.showrooms["6KR6829"].employees.find(
      (employee) => employee.name === "방준호",
    ).jobTitle,
    "팀장",
  );
  assert.match(
    analysisSource,
    /type StaffEmployee = \{[\s\S]*?jobTitle: string;/,
  );
  assert.match(
    analysisSource,
    /className="analysis-staff-job-title">[\s\S]*?selectedStaffEmployee\.jobTitle/,
  );
  assert.match(
    css,
    /\.analysis-staff-summary strong\.name \.analysis-staff-job-title\s*\{[\s\S]*?font-size:\s*9px;[\s\S]*?font-weight:\s*600;/,
  );
});

test("keeps the Sales-DMS roster sync private and scheduled once each morning", async () => {
  const [workflow, syncScript, generatorScript, staffAnalysis] = await Promise.all([
    readFile(
      new URL("../.github/workflows/sync-sales-dms-roster.yml", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../scripts/sync-sales-dms-roster.py", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate-voc-staff-analysis.py", import.meta.url), "utf8"),
    readFile(new URL("../app/data/voc-staff-analysis.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.match(workflow, /cron: "0 21 \* \* \*"/);
  assert.match(workflow, /secrets\.VOLVO_SALES_ID/);
  assert.match(workflow, /secrets\.VOLVO_SALES_PASSWORD/);
  assert.match(syncScript, /return "팀장" if normalized_role == "영업팀장"/);
  assert.match(syncScript, /MINIMUM_SAFE_ROSTER = 300/);
  assert.match(syncScript, /departed = text\(raw\.get\("퇴사일자"\)\)/);
  assert.doesNotMatch(syncScript, /status and status != "활성"/);
  assert.match(generatorScript, /has_departed/);
  assert.doesNotMatch(generatorScript, /status != "활성"/);
  const restoredEmployees = Object.values(staffAnalysis.showrooms).flatMap(
    (showroom) =>
      showroom.employees.map((employee) => `${showroom.showroom}|${employee.name}`),
  );
  assert.deepEqual(
    [
      "볼보 의정부|정병준",
      "볼보 분당|이종인",
      "볼보 분당|조정민",
      "볼보 청주|고태영",
      "볼보 인천|서재현",
      "볼보 수원|이영빈",
      "볼보 전주|배정우",
      "볼보 송파|허재무",
      "볼보 동대문|정승현",
      "볼보 용산|김민지",
    ].filter((employee) => !restoredEmployees.includes(employee)),
    [],
  );
  const restoredResponseCounts = Object.fromEntries(
    Object.values(staffAnalysis.showrooms).flatMap((showroom) =>
      showroom.employees
        .filter((employee) =>
          ["정병준", "이종인", "조정민", "서재현", "이영빈", "정승현"].includes(
            employee.name,
          ),
        )
        .map((employee) => [
          `${showroom.showroom}|${employee.name}`,
          Object.values(employee.years).reduce(
            (total, year) => total + year.responses,
            0,
          ),
        ]),
    ),
  );
  assert.deepEqual(restoredResponseCounts, {
    "볼보 의정부|정병준": 19,
    "볼보 분당|이종인": 14,
    "볼보 분당|조정민": 32,
    "볼보 인천|서재현": 24,
    "볼보 수원|이영빈": 1,
    "볼보 동대문|정승현": 31,
  });
  assert.equal(
    Object.values(staffAnalysis.showrooms).flatMap(
      (showroom) => showroom.formerEmployees ?? [],
    ).length,
    5,
  );
  assert.doesNotMatch(
    JSON.stringify(
      Object.values(staffAnalysis.showrooms).flatMap((showroom) => showroom.employees),
    ),
    /직원 CDSID|직원 ID|E-mail|휴대폰번호/,
  );
});

test("expands the four staff analysis panels after removing their outer frame", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.analysis-staff-detail-body\s*\{[^}]*min-width:\s*0;[^}]*display:\s*grid;[^}]*gap:\s*10px;[^}]*padding:\s*0;[^}]*background:\s*transparent;/,
  );
  assert.doesNotMatch(
    css,
    /\.analysis-staff-roster,\s*\.analysis-staff-detail-body\s*\{[^}]*border:/,
  );
  assert.match(
    css,
    /\.analysis-staff-comparison-layout\s*\{[^}]*min-height:\s*312px;/,
  );
  assert.match(
    css,
    /\.analysis-staff-insights\s*\{[^}]*height:\s*166px;[^}]*min-height:\s*166px;/,
  );
  assert.match(css, /\.analysis-staff-history-chart\s*\{[^}]*border:\s*1px solid #dbe7ec;/);
  assert.match(css, /\.analysis-staff-benchmarks\s*\{[^}]*border:\s*1px solid #cddfe7;/);
  assert.match(css, /\.analysis-staff-insights article\s*\{[^}]*border:\s*1px solid #e2e9ec;/);
});

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

test("renders an evidence-first growth navigation without recency scoring", async () => {
  const [source, css, salesActivity, staffAnalysis, staffAnalysisGenerator] = await Promise.all([
    readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/data/sales-activity-analysis.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/data/voc-staff-analysis.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../scripts/generate-voc-staff-analysis.py", import.meta.url), "utf8"),
  ]);
  const start = source.indexOf('className="growth-navigation-sticky-summary"');
  const end = source.indexOf('{false && selectedStaffAnalysis', start);
  const navigation = source.slice(start, end);
  const profileStart = navigation.indexOf('className="growth-profile-person"');
  const profileEnd = navigation.indexOf('<div className="growth-profile-metric">', profileStart);
  const profile = navigation.slice(profileStart, profileEnd);
  assert.ok(start >= 0 && end > start);
  assert.ok(profileStart >= 0 && profileEnd > profileStart);
  assert.match(navigation, /소속 영업직원 성장 내비게이션/);
  assert.match(navigation, /<b>Sales-DMS<\/b>[\s\S]*?<i aria-hidden="true">\/<\/i>[\s\S]*?<strong>\{staffAnalysisSource\.rosterCheckedAt[\s\S]*? 기준<\/strong>/);
  assert.match(navigation, /<b>VOC 상담만족도<\/b>[\s\S]*?<i aria-hidden="true">\/<\/i>[\s\S]*?<strong>23 ~ 26 YTD 기준<\/strong>/);
  assert.doesNotMatch(navigation, /등수 대신 상담 근거와 면담 행동을 연결합니다/);
  assert.match(navigation, /영업직원 \/ 입사일자/);
  assert.doesNotMatch(navigation, /면담 직원 선택|총 <strong>\{rankedSalesStaff\.length\}<\/strong>명/);
  assert.doesNotMatch(css, /\.growth-staff-roster > header/);
  assert.doesNotMatch(profile, /displayShowroomNameWithoutBrand\(selected\.showroom\)/);
  assert.match(navigation, /className="growth-profile-role"[\s\S]*?<span>영업직원<\/span>/);
  assert.doesNotMatch(navigation, /<small>선택 영업직원<\/small>/);
  assert.match(navigation, /selectedStaffEmployee\?\.jobTitle \?\? ""\} · \{displayTwoDigitCount\(selectedStaffTenureYears \?\? 0\)\}년 \{displayTwoDigitCount\(selectedStaffTenureMonths \?\? 0\)\}개월/);
  assert.match(source, /const selectedStaffCommentTotalMentions =\s*selectedStaffStrengthTotalMentions \+ selectedStaffImprovementTotalMentions;/);
  assert.match(navigation, /growth-profile-evidence-count">회신 \{selectedStaffResponses\}건 · 코멘트 \{selectedStaffCommentTotalMentions\}건\(중복포함\)<\/small>/);
  assert.doesNotMatch(navigation, /코멘트 \{selectedStaffEmployee\?\.commentResponses \?\? 0\}건/);
  assert.doesNotMatch(navigation, /실제 회신만 사용|동일연차 기준으로 진단/);
  assert.match(css, /\.growth-profile-strip > div\s*\{[\s\S]*?min-height:\s*58px;[\s\S]*?padding:\s*6px 12px;/);
  assert.equal((navigation.match(/<span>고객상담 평균만족도<\/span>/g) ?? []).length, 2);
  assert.doesNotMatch(navigation, /<span>평균 상담만족도<\/span>|<span>상담 만족도<\/span>/);
  assert.match(navigation, /누적 판매대수/);
  assert.match(source, /sales\?\.deliveredSales \?\? null/);
  assert.match(navigation, /2026년 누적 판매 \$\{deliveredSales \?\? 0\}대/);
  assert.match(navigation, /<span>인증직원 선정<\/span>/);
  assert.match(navigation, /className="growth-profile-metric growth-profile-certification"[\s\S]*?<b>G<i aria-hidden="true">-<\/i>\{selectedStaffCertificationCounts\.Grand\}<\/b>[\s\S]*?<b>A<i aria-hidden="true">-<\/i>\{selectedStaffCertificationCounts\.Advanced\}<\/b>[\s\S]*?<b>C<i aria-hidden="true">-<\/i>\{selectedStaffCertificationCounts\.Certified\}<\/b>/);
  assert.match(css, /\.growth-profile-certification strong b i\s*\{[^}]*font-size:\s*0\.72em;[^}]*font-weight:\s*300;/);
  assert.doesNotMatch(navigation, /<span>지점장 코칭<\/span>/);
  assert.doesNotMatch(navigation, /<span>현재 면담 방향<\/span>/);
  assert.doesNotMatch(navigation, /<span>상담만족<\/span>|회신 건수<small>\(23 ~ 26 YTD\)<\/small>/);
  assert.match(css, /\.growth-staff-roster-columns,[\s\S]*?\.growth-staff-roster-list button\s*\{[^}]*grid-template-columns: minmax\(104px, 1fr\) 76px 80px;/);
  assert.match(css, /\.growth-staff-roster-list\s*\{[^}]*max-width: 100%;[^}]*overflow-x: hidden;[^}]*overflow-y: auto;/);
  assert.match(navigation, /className="growth-staff-roster-list"[\s\S]*?ref=\{growthStaffRosterRef\}[\s\S]*?onPointerDown=\{beginGrowthStaffRosterDrag\}[\s\S]*?onPointerMove=\{moveGrowthStaffRosterDrag\}[\s\S]*?onPointerUp=\{endGrowthStaffRosterDrag\}[\s\S]*?onWheel=\{scrollGrowthStaffRosterOnly\}[\s\S]*?onClickCapture=\{preventDraggedGrowthStaffSelection\}/);
  assert.match(source, /if \(!event\.currentTarget\.hasPointerCapture\(event\.pointerId\)\) \{[\s\S]*?event\.currentTarget\.setPointerCapture\(event\.pointerId\);[\s\S]*?keepGrowthStaffRosterInView\(\);[\s\S]*?event\.currentTarget\.scrollTop = drag\.originScrollTop - distance;[\s\S]*?suppressGrowthStaffRosterClickRef\.current[\s\S]*?event\.stopPropagation\(\);/);
  assert.match(source, /const scrollGrowthStaffRosterOnly = [\s\S]*?roster\.scrollTop \+= event\.deltaY;[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);/);
  assert.match(source, /const keepGrowthStaffRosterInView = \(\) => \{[\s\S]*?const safeTop = summaryBounds\.bottom \+ 8;[\s\S]*?window\.scrollBy\(\{[\s\S]*?top: rosterBounds\.top - safeTop,[\s\S]*?behavior: "auto"/);
  assert.doesNotMatch(source.match(/const beginGrowthStaffRosterDrag = [\s\S]*?const keepGrowthStaffRosterInView =/)?.[0] ?? "", /keepGrowthStaffRosterInView\(\)/);
  assert.match(source, /const scrollGrowthStaffRosterOnly = [\s\S]*?keepGrowthStaffRosterInView\(\);[\s\S]*?roster\.scrollTop \+= event\.deltaY;/);
  assert.match(source, /const shouldSettleAtGrowthNavigation = [\s\S]*?!entrySnapConsumed && workspacePassedRatio\(projectedDistance\) >= 0\.65;/);
  assert.match(source, /const usesPcSectionFlow = window\.matchMedia\([\s\S]*?\(pointer: fine\)[\s\S]*?if \(CSS\.supports\("scroll-snap-type: y proximity"\) && !usesPcSectionFlow\) return;/);
  assert.match(css, /html\.analysis-viewport-locked,[\s\S]*?html\.analysis-viewport-locked body\s*\{[^}]*scroll-snap-type: y proximity;/);
  assert.match(css, /\.competitive-analysis-page > \.growth-navigation\s*\{[^}]*scroll-margin-top: calc\([\s\S]*?--growth-navigation-sticky-top[\s\S]*?--growth-navigation-summary-height[\s\S]*?scroll-snap-align: start;[^}]*scroll-snap-stop: always;/);
  assert.match(source, /const handleEntryWheel = [\s\S]*?normalizeWheelDistance\(event\)[\s\S]*?event\.preventDefault\(\);[\s\S]*?settleAtGrowthNavigation\(\);/);
  assert.match(source, /const handleEntryTouchMove = [\s\S]*?downwardPageDistance[\s\S]*?shouldSettleAtGrowthNavigation\(downwardPageDistance\)[\s\S]*?event\.preventDefault\(\);[\s\S]*?settleAtGrowthNavigation\(\);/);
  assert.match(source, /const usesTabletSectionFlow = window\.matchMedia\([\s\S]*?\(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1400px\)[\s\S]*?const usesStaticAnalysisShell =[\s\S]*?isNarrowTabletViewport \|\| usesTabletSectionFlow;/);
  assert.match(source, /const shellHeight = usesStaticAnalysisShell[\s\S]*?Math\.ceil\(shell\.getBoundingClientRect\(\)\.height\);[\s\S]*?const analysisHeaderHeight = usesTabletSectionFlow \|\| usesPcSectionFlow[\s\S]*?\.querySelector<HTMLElement>\("\.analysis-header"\)[\s\S]*?\?\? 122/);
  assert.doesNotMatch(source, /tabletGrowthMode|revealTabletGrowthNavigation|analysis-tablet-growth-active/);
  assert.match(source, /<title>\{`상담 역량 타코미터: \$\{selectedStaffGrowthLabel\}`\}<\/title>/);
  assert.doesNotMatch(source, /<title>상담 역량 타코미터: \{selectedStaffGrowthLabel\}<\/title>/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1400px\)\s*\{[\s\S]*?html\.analysis-viewport-locked body\s*\{[^}]*scroll-snap-type: y mandatory;[\s\S]*?\.competitive-analysis-page > \.analysis-sticky-anchor\s*\{[^}]*margin-inline: calc\(-1 \* var\(--dashboard-content-overhang\)\);[^}]*scroll-snap-align: start;[^}]*scroll-snap-stop: always;[\s\S]*?\.competitive-analysis-page \.analysis-sticky-shell\s*\{[^}]*position: static;[^}]*padding-top: calc\(var\(--growth-navigation-sticky-top, 122px\) \+ 10px\);[\s\S]*?\.competitive-analysis-page \.analysis-header\s*\{[^}]*position: fixed;[^}]*top: 0;[^}]*width: auto;[^}]*z-index: 70;[\s\S]*?\.competitive-analysis-page > \.growth-navigation-sticky-summary\s*\{[^}]*top: var\(--growth-navigation-sticky-top, 122px\);[\s\S]*?\.competitive-analysis-page \.growth-navigation-workspace,[\s\S]*?100dvh - var\(--growth-navigation-sticky-top, 122px\)[\s\S]*?\.competitive-analysis-page \.growth-navigation-detail\s*\{[^}]*overflow-y: auto;[\s\S]*?\.competitive-analysis-page \.growth-staff-roster-list\s*\{[^}]*overflow-y: auto;/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1240px\)\s*\{[\s\S]*?html\.analysis-viewport-locked \.competitive-analysis-page\s*\{[^}]*--dashboard-page-gutter: 24px;[^}]*\}[\s\S]*?\.dashboard \.dashboard-identity-header\.identity-strip,[\s\S]*?\.competitive-analysis-page \.dashboard-identity-header\.analysis-header\s*\{[^}]*align-items: center;[^}]*flex-direction: row;[^}]*\}[\s\S]*?\.competitive-analysis-page > \.analysis-sticky-anchor\s*\{[^}]*margin-inline: 0;[^}]*\}[\s\S]*?\.competitive-analysis-page \.analysis-header\s*\{[^}]*right: calc\(24px \+ var\(--dashboard-sticky-content-gutter\)\);[^}]*left: calc\(24px \+ var\(--dashboard-sticky-content-gutter\)\);/);
  assert.match(source, /window\.addEventListener\("touchmove", handleEntryTouchMove, \{ passive: false \}\)/);
  assert.match(source, /const easePcScrollWithSoftLanding = \(progress: number\) => \{[\s\S]*?const landingStart = 0\.68;[\s\S]*?const initialTravelRate = 1\.18;[\s\S]*?landingStartSlope - 2[\s\S]*?return landingStartPosition \+ remainingDistance \* easedLanding/);
  assert.match(source, /const alignEntry = \(timestamp: number\) => \{[\s\S]*?usesPcSectionFlow[\s\S]*?easePcScrollWithSoftLanding\(progress\)[\s\S]*?window\.scrollTo\(\{ top: nextTop, left: window\.scrollX, behavior: "auto" \}\);[\s\S]*?if \(progress < 1\)/);
  assert.match(source, /const handlePcSectionWheel = \(event: WheelEvent\) => \{[\s\S]*?target\?\.closest\("\.growth-staff-roster-list"\)[\s\S]*?detailTarget\.scrollTop \+ detailTarget\.clientHeight <[\s\S]*?detailTarget\.scrollHeight - 1[\s\S]*?if \(canScrollDown \|\| canScrollUp\) return;[\s\S]*?const bannerBottom = persistentBannerBottom\(\);[\s\S]*?staffSectionBelow = summaryBounds\.top > bannerBottom \+ 28[\s\S]*?wheelDistance > 0 && staffSectionBelow[\s\S]*?moveTo\(flowTop\(growthSummary\) - bannerBottom\)[\s\S]*?wheelDistance > 0 && staffSectionAligned[\s\S]*?event\.preventDefault\(\);[\s\S]*?if \(wheelDistance >= 0 \|\| !staffSectionAligned\) return;[\s\S]*?moveTo\(0\)/);
  assert.match(source, /const moveTo = \(targetTop: number\) => \{[\s\S]*?const duration = reduceMotion \? 0 : 340;[\s\S]*?const easedProgress = easePcScrollWithSoftLanding\(progress\)/);
  assert.match(source, /const keepMotionLockedUntilWheelQuiet = \(\) => \{[\s\S]*?wheelQuietTimer = window\.setTimeout\(\(\) => \{[\s\S]*?motionActive = false;[\s\S]*?\}, 140\);/);
  assert.match(source, /if \(motionActive\) \{\s*event\.preventDefault\(\);\s*keepMotionLockedUntilWheelQuiet\(\);\s*return;/);
  assert.doesNotMatch(source, /className="v3s-award-card"|v3sAwardRef/);
  assert.match(source, /titleAdornment=\{selectedAwardCount > 0[\s\S]*?className="analysis-title-awards"[\s\S]*?className="analysis-title-award"[\s\S]*?<span>\{period\.year\.slice\(2\)\}년<\/span>[\s\S]*?<span>\{period\.half\}<\/span>[\s\S]*?className="analysis-title-award-count"[\s\S]*?\{selectedAwardCount\}회[\s\S]*?총 \{v3sAwardPeriods\.length\}/);
  assert.match(css, /@media \(min-width: 1024px\) and \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.competitive-analysis-page\s*\{[^}]*--growth-navigation-sticky-top: 122px;[^}]*padding-bottom: 20px;[^}]*\}[\s\S]*?\.competitive-analysis-page > \.analysis-sticky-anchor\s*\{[^}]*margin-inline: calc\(-1 \* var\(--dashboard-content-overhang\)\);[^}]*\}[\s\S]*?\.competitive-analysis-page \.analysis-sticky-shell\s*\{[^}]*position: static;[^}]*padding-top: calc\(var\(--growth-navigation-sticky-top, 122px\) \+ 8px\);[^}]*\}[\s\S]*?\.competitive-analysis-page \.analysis-header\s*\{[^}]*position: fixed;[^}]*top: 0;[^}]*width: auto;[^}]*z-index: 70;[^}]*\}[\s\S]*?\.growth-navigation-sticky-summary\s*\{[^}]*position: sticky;[^}]*top: var\(--growth-navigation-sticky-top, 122px\);[^}]*\}[\s\S]*?\.growth-navigation-workspace,[\s\S]*?100dvh - var\(--growth-navigation-sticky-top, 122px\) -[\s\S]*?var\(--growth-navigation-summary-height, 152px\) - 36px[\s\S]*?\.growth-navigation-detail\s*\{[^}]*padding-bottom: 10px;[^}]*overflow-y: auto;/);
  assert.match(css, /@media \(min-width: 1024px\) and \(hover: hover\) and \(pointer: fine\) and \(max-height: 820px\)\s*\{[\s\S]*?--growth-navigation-summary-height: 146px;[\s\S]*?\.competitive-analysis-page > \.growth-navigation-sticky-summary\s*\{[^}]*margin-top: 4px;[\s\S]*?\.competitive-analysis-page \.growth-navigation-heading\s*\{[^}]*min-height: 34px;[^}]*padding-top: 3px;[^}]*padding-bottom: 3px;[\s\S]*?\.competitive-analysis-page \.growth-navigation-workspace,[\s\S]*?100dvh - var\(--growth-navigation-sticky-top, 122px\) -[\s\S]*?var\(--growth-navigation-summary-height, 146px\) - 20px/);
  assert.match(navigation, /className="growth-navigation-detail"[\s\S]*?ref=\{growthNavigationDetailRef\}[\s\S]*?className="growth-scatter-card" ref=\{growthConsultationScatterRef\}/);
  assert.match(source, /const settleAtConsultationScatter = \(\) => \{[\s\S]*?const motionDuration = reduceMotion \? 0 : 320;[\s\S]*?Math\.pow\(1 - progress, 3\)[\s\S]*?detail\.scrollTop =/);
  assert.match(source, /const consultationScatterSettleTop = \(\) => \{[\s\S]*?if \(!usesTabletSectionFlow\) return scatterTop;[\s\S]*?Math\.max\(0, detail\.scrollHeight - detail\.clientHeight\)[\s\S]*?const targetTop = consultationScatterSettleTop\(\);/);
  assert.match(source, /const growthSummary = growthNavigationSummaryRef\.current;[\s\S]*?const reclaimPcSummarySpaceIfNeeded = \(\) => \{[\s\S]*?\(min-width: 1024px\) and \(hover: hover\) and \(pointer: fine\)[\s\S]*?detail\.scrollHeight <= detail\.clientHeight \+ 2[\s\S]*?const preservedScrollTop = detail\.scrollTop;[\s\S]*?growthSummary\.classList\.add\("is-space-reclaimed"\)[\s\S]*?detail\.scrollTop = Math\.min/);
  assert.doesNotMatch(source, /growthSummary\.classList\.contains\("is-space-reclaimed"\) \|\|\s*detail\.scrollTop > 1/);
  assert.match(source, /downwardIntent \+= Math\.max\(0, normalizedWheelDistance\(event\)\);[\s\S]*?if \(reclaimPcSummarySpaceIfNeeded\(\)\) \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?downwardIntent = 0;[\s\S]*?return;[\s\S]*?\}[\s\S]*?if \(!canSettleAtConsultationScatter\(\)\)[\s\S]*?settleAtConsultationScatter\(\);/);
  assert.match(css, /> \.growth-navigation-sticky-summary\.is-space-reclaimed\s*\{[^}]*margin-top:\s*0;/);
  assert.match(css, /> \.growth-navigation-sticky-summary\.is-space-reclaimed \.growth-navigation-heading\s*\{[^}]*min-height:\s*30px;[^}]*padding-top:\s*2px;[^}]*padding-bottom:\s*2px;/);
  assert.match(css, /> \.growth-navigation-sticky-summary\.is-space-reclaimed \.growth-profile-strip,[\s\S]*?> \.growth-navigation-sticky-summary\.is-space-reclaimed \.growth-navigation-pinned-headings\s*\{[^}]*margin-top:\s*2px;/);
  assert.match(css, /> \.growth-navigation-sticky-summary\.is-space-reclaimed \+ \.growth-navigation \.growth-navigation-workspace,[\s\S]*?> \.growth-navigation-sticky-summary\.is-space-reclaimed \+ \.growth-navigation \.growth-navigation-detail\s*\{[^}]*100dvh[\s\S]*?var\(--growth-navigation-summary-height, 152px\) - 24px/);
  assert.match(css, /> \.growth-navigation-sticky-summary\.is-space-reclaimed \+ \.growth-navigation \.growth-staff-roster-list\s*\{[^}]*100dvh[\s\S]*?var\(--growth-navigation-summary-height, 152px\) \+ 6px/);
  assert.doesNotMatch(css, /is-overview-compacted/);
  assert.doesNotMatch(source, /compactPcOverviewIfNeeded/);
  assert.match(source, /if \(!canSettleAtConsultationScatter\(\)\) return;\s*event\.preventDefault\(\);\s*downwardIntent \+= downwardDistance;/);
  assert.match(source, /const handleDetailWheel = \(event: WheelEvent\) => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?downwardIntent < 18[\s\S]*?settleAtConsultationScatter\(\);/);
  assert.match(source, /const handleDetailTouchMove = \(event: TouchEvent\) => \{[\s\S]*?downwardDistance[\s\S]*?event\.preventDefault\(\);[\s\S]*?downwardIntent < 18[\s\S]*?settleAtConsultationScatter\(\);/);
  assert.match(source, /detail\.addEventListener\("wheel", handleDetailWheel, \{ passive: false \}\)[\s\S]*?detail\.addEventListener\("touchmove", handleDetailTouchMove, \{ passive: false \}\)/);
  assert.match(source, /if \(!event\.isPrimary \|\| \(event\.pointerType === "mouse" && event\.button !== 0\)\)/);
  assert.match(css, /\.growth-staff-roster-list\s*\{[^}]*scroll-snap-type: y proximity;/);
  assert.match(css, /\.growth-staff-roster-list button\s*\{[^}]*scroll-snap-align: start;/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.growth-staff-roster-columns\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) 76px 56px;[^}]*padding-right: 24px;/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.growth-staff-roster-list::-webkit-scrollbar\s*\{[^}]*width: 6px;/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.growth-staff-roster-list\s*\{[^}]*cursor: grab;[^}]*\}[\s\S]*?\.growth-staff-roster-list\.is-dragging\s*\{[^}]*cursor: grabbing;[^}]*user-select: none;/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.growth-staff-roster-list button\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) 76px 56px;/);
  assert.doesNotMatch(navigation, /자료 근거 -/);
  assert.match(navigation, /const isTeamLeader = employee\.role === "영업팀장" \|\| employee\.jobTitle === "팀장";/);
  assert.match(navigation, /className="growth-staff-name">\{employee\.name\}<\/span>[\s\S]*?className="growth-staff-lead-badge" aria-label="팀장" title="팀장">L<\/i>/);
  const youtubeStaffBlock = source.match(/const STAFF_YOUTUBE_BADGE_KEYS = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  const expectedYoutubeStaffKeys = [
    "6KR6867:송민경", "6KR6830:진주현", "6KR6858:나수연", "6KR6870:이정훈",
    "6KR6849:신수경", "6KR6846:신승희", "6KR6847:김정호", "6KR6861:곽지명",
    "6KR6846:박형진", "6KR6858:조선별", "6KR6852:이규환", "6KR6839:박준수",
  ];
  assert.equal((youtubeStaffBlock.match(/6KR\d+:/g) ?? []).length, expectedYoutubeStaffKeys.length);
  expectedYoutubeStaffKeys.forEach((key) => assert.match(youtubeStaffBlock, new RegExp(`"${key}"`)));
  assert.doesNotMatch(youtubeStaffBlock, /6KR6834:박준수/);
  assert.match(source, /const selectedStaffHasYoutubeBadge = selectedStaffEmployee[\s\S]*?STAFF_YOUTUBE_BADGE_KEYS\.has\(`\$\{selected\.cdsid\}:\$\{selectedStaffEmployee\.name\}`\)/);
  assert.match(navigation, /selectedStaffHasYoutubeBadge \? \([\s\S]*?className="growth-profile-youtube-badge" aria-label="유튜브 활동" title="유튜브 활동"/);
  assert.doesNotMatch(navigation, /className="growth-staff-youtube-badge"/);
  assert.match(css, /\.growth-staff-roster-list button > span strong\s*\{[\s\S]*?width:\s*5\.25em;[\s\S]*?flex:\s*0 0 5\.25em;[\s\S]*?display:\s*inline-grid;[\s\S]*?grid-template-columns:\s*3em 13px;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(css, /\.growth-staff-lead-badge\s*\{[^}]*width:\s*13px;[^}]*height:\s*13px;[^}]*border-radius:\s*50%;[^}]*background:\s*#176f8a;[^}]*transform:\s*none;/);
  assert.match(css, /\.growth-profile-role\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*gap:\s*4px;/);
  assert.match(css, /\.growth-profile-youtube-badge\s*\{[^}]*width:\s*13px;[^}]*height:\s*9px;[^}]*border-radius:\s*2\.5px;[^}]*background:\s*#ff0033;/);
  assert.match(css, /\.growth-profile-youtube-badge::before\s*\{[^}]*border-left:\s*4px solid #fff;/);
  assert.match(css, /\.growth-staff-roster-list button\s*\{[^}]*min-height:\s*30px;/);
  assert.match(css, /\.growth-staff-roster-columns span:not\(:first-child\)\s*\{[^}]*text-align:\s*right;/);
  assert.match(css, /\.growth-staff-roster-list button\s*\{[^}]*padding:\s*0 10px 0 8px;/);
  assert.match(css, /\.growth-staff-roster-list button > b\s*\{[^}]*width:\s*100%;[^}]*font-variant-numeric:\s*tabular-nums;[^}]*text-align:\s*right;/);
  assert.match(css, /\.growth-staff-roster-list button > em > b\s*\{[^}]*font-family:\s*var\(--font-volvo\);[^}]*font-size:\s*13px;[^}]*font-weight:\s*700;[^}]*color:\s*#176887;/);
  assert.match(css, /\.growth-staff-roster-list button > em\s*\{[^}]*justify-content:\s*flex-end;[^}]*text-align:\s*right;/);
  assert.match(css, /\.growth-staff-roster-list button > em > b\s*\{[^}]*width:\s*100%;[^}]*font-variant-numeric:\s*tabular-nums;[^}]*text-align:\s*right;/);
  assert.doesNotMatch(navigation, /자료 근거 회신 \$\{responses\}건/);
  assert.doesNotMatch(navigation, /const evidenceConfidence = staffEvidenceConfidence\(responses\)/);
  assert.match(navigation, /집중 코칭/);
  assert.match(navigation, />고객상담 역량<\/span>/);
  assert.match(navigation, />영업활동 역량<\/span>/);
  assert.doesNotMatch(navigation, /01 ·|02 ·/);
  assert.match(css, /\.growth-navigation-pinned-heading\s*\{[^}]*font-size: 11px;[^}]*color: #25495a;/);
  assert.match(css, /\.growth-navigation-pinned-headings \.growth-staff-roster-columns\s*\{[^}]*border-right: 0;/);
  assert.match(css, /\.growth-navigation-pinned-heading\.consultation,[\s\S]*?\.growth-navigation-pinned-heading\.sales\s*\{[^}]*position: relative;[\s\S]*?\.growth-navigation-pinned-heading\.consultation::before,[\s\S]*?\.growth-navigation-pinned-heading\.sales::before\s*\{[^}]*top: 7px;[^}]*bottom: 7px;[^}]*background: rgba\(181, 202, 211, 0\.52\);[\s\S]*?\.growth-navigation-pinned-heading\.consultation::before\s*\{[^}]*left: -6px;[\s\S]*?\.growth-navigation-pinned-heading\.sales::before\s*\{[^}]*left: -8px;/);
  assert.doesNotMatch(css, /\.growth-navigation-pinned-heading\.sales\s*\{[^}]*border-left:/);
  assert.doesNotMatch(navigation, /<h3>고객상담 역량<\/h3>|<h3>영업활동 역량<\/h3>/);
  assert.doesNotMatch(navigation, /01 · 상담 영역|02 · 영업 영역/);
  assert.match(navigation, /성장 가속/);
  assert.match(navigation, /성과 확산/);
  assert.match(navigation, /유지\/강화<small className="growth-comment-share">\(\{selectedStaffStrengthShare\.toFixed\(1\)\}%\)<\/small>/);
  assert.match(navigation, /수정\/보완<small className="growth-comment-share">\(\{selectedStaffImprovementShare\.toFixed\(1\)\}%\)<\/small>/);
  assert.doesNotMatch(navigation, /유지\/ 강화 사항|보완\/ 수정 사항/);
  assert.match(source, /selectedStaffStrengthTotalMentions \/ selectedStaffCommentTotalMentions/);
  assert.match(source, /100 - selectedStaffStrengthShare/);
  assert.doesNotMatch(navigation, /유지·강화 포인트|보완·수정 포인트/);
  assert.match(css, /\.growth-comment-evidence > header span\s*\{[^}]*font-size:\s*14px;[^}]*font-weight:\s*700;[^}]*line-height:\s*1\.2;/);
  assert.match(css, /\.growth-comment-evidence > header \.growth-comment-share\s*\{[^}]*font-size:\s*10\.5px;[^}]*font-weight:\s*700;[^}]*font-variant-numeric:\s*tabular-nums;/);
  assert.match(navigation, /className="growth-comment-bars"/);
  assert.match(navigation, /--growth-comment-bar-ratio/);
  assert.match(source, /const displayTwoDigitCount = \(value: number\) => String\(value\)\.padStart\(2, "0"\);/);
  assert.match(navigation, /중복포함 총 \{displayTwoDigitCount\(selectedStaffStrengthTotalMentions\)\}회/);
  assert.match(navigation, /중복포함 총 \{displayTwoDigitCount\(selectedStaffImprovementTotalMentions\)\}회/);
  assert.doesNotMatch(navigation, /중복 포함 총/);
  assert.match(navigation, /selectedStaffStrengthKeywords\.slice\(0, 8\)\.map/);
  assert.match(navigation, /selectedStaffImprovementKeywords\.slice\(0, 8\)\.map/);
  assert.doesNotMatch(navigation, /slice\(3, 6\)/);
  assert.equal((staffAnalysisGenerator.match(/len\(STRENGTH_PATTERNS\)/g) ?? []).length, 3);
  assert.equal((staffAnalysisGenerator.match(/len\(IMPROVEMENT_PATTERNS\)/g) ?? []).length, 3);
  assert.match(staffAnalysisGenerator, /exclude_negative_context=True/);
  assert.match(staffAnalysisGenerator, /전문지식·정확성/);
  assert.match(staffAnalysisGenerator, /전문지식 정확성 부족/);
  assert.match(staffAnalysisGenerator, /시설 편의 미제공/);
  assert.match(staffAnalysisGenerator, /간결한 설명 필요/);
  assert.match(staffAnalysisGenerator, /구체적 설명 부족/);
  assert.match(staffAnalysisGenerator, /응대 태도 불량/);
  assert.match(staffAnalysisGenerator, /상담자료 활용 미흡/);
  assert.match(staffAnalysisGenerator, /전시차량 다양화 필요/);
  assert.match(staffAnalysisGenerator, /시승모델 다양화 필요/);
  assert.match(staffAnalysisGenerator, /가격혜택 안내부족/);
  assert.match(staffAnalysisGenerator, /시승기회·시간 확대/);
  assert.match(staffAnalysisGenerator, /상담공간 편의제공/);
  assert.match(staffAnalysisGenerator, /대기시간 관리 미흡/);
  assert.match(staffAnalysisGenerator, /예약절차 운영 미흡/);
  assert.match(staffAnalysisGenerator, /진행상황 안내 미흡/);
  assert.doesNotMatch(staffAnalysisGenerator, /진행상황 중간안내 미흡/);
  assert.match(source, /"진행상황 중간안내 미흡": "진행상황 안내 미흡"/);
  assert.match(staffAnalysisGenerator, /자율관람 방해/);
  assert.match(staffAnalysisGenerator, /구매·계약 압박/);
  assert.match(staffAnalysisGenerator, /과도한 응대 부담/);
  assert.doesNotMatch(staffAnalysisGenerator, /대기·예약 운영/);
  assert.doesNotMatch(staffAnalysisGenerator, /자율 관람·압박 완화/);
  assert.doesNotMatch(staffAnalysisGenerator, /후속 연락·진행안내/);
  assert.doesNotMatch(staffAnalysisGenerator, /후속연락·진행상황 안내 미흡/);
  const kimNaehwan = staffAnalysis.showrooms["6KR6849"].employees.find(({ name }) => name === "김내환");
  assert.equal(kimNaehwan.commentResponses, 36);
  assert.deepEqual(
    kimNaehwan.improvementKeywords.map(({ label }) => label),
    [
      "전문지식 정확성 부족",
      "간결한 설명 필요",
      "상담자료 활용 미흡",
      "대기시간 관리 미흡",
      "전시차량 다양화 필요",
      "구체적 설명 부족",
      "자율관람 방해",
      "가격혜택 안내부족",
      "예약절차 운영 미흡",
      "시설 편의 미제공",
    ],
  );
  const analyzedEmployees = Object.values(staffAnalysis.showrooms).flatMap(({ employees }) => employees);
  const splitPressureMentions = Object.fromEntries(
    ["자율관람 방해", "구매·계약 압박", "과도한 응대 부담"].map((label) => [
      label,
      analyzedEmployees.reduce(
        (total, { improvementKeywords }) =>
          total + (improvementKeywords.find((keyword) => keyword.label === label)?.mentions ?? 0),
        0,
      ),
    ]),
  );
  assert.deepEqual(splitPressureMentions, {
    "자율관람 방해": 1,
    "구매·계약 압박": 2,
    "과도한 응대 부담": 6,
  });
  const waitAndReservationMentions = analyzedEmployees.flatMap(({ improvementKeywords }) =>
    improvementKeywords.filter(({ label }) =>
      ["대기시간 관리 미흡", "예약절차 운영 미흡"].includes(label),
    ),
  );
  assert.equal(waitAndReservationMentions.reduce((total, { mentions }) => total + mentions, 0), 61);
  assert.ok(analyzedEmployees.some(({ strengthKeywords }) => strengthKeywords.length > 6));
  assert.ok(analyzedEmployees.some(({ improvementKeywords }) => improvementKeywords.length > 6));
  assert.ok(analyzedEmployees.every(({ strengthKeywords }) => strengthKeywords.length <= 14));
  assert.ok(analyzedEmployees.every(({ improvementKeywords }) => improvementKeywords.length <= 18));
  assert.match(staffAnalysis.source.commentAnalysis, /문장별 긍정·부정 맥락 분리 · 14개 강점\/18개 보완 주제/);
  const baekJongYoon = staffAnalysis.showrooms["6KR6854"].employees.find(({ name }) => name === "백종윤");
  assert.ok(baekJongYoon.improvementKeywords.some(({ label, mentions }) => label === "상담공간 편의제공" && mentions === 1));
  assert.ok(!baekJongYoon.improvementKeywords.some(({ label }) => label === "시설 편의 미제공"));
  assert.match(navigation, /keyword\.mentions \/ selectedStaffStrengthTotalMentions/);
  assert.match(navigation, /keyword\.mentions \/ selectedStaffImprovementTotalMentions/);
  assert.match(navigation, /displayTwoDigitCount\(keyword\.mentions\)\}회 <em>\(\{displayTwoDigitCount\(Math\.round\(\(keyword\.mentions \/ selectedStaffStrengthTotalMentions\) \* 100\)\)\}%\)/);
  assert.match(navigation, /displayTwoDigitCount\(keyword\.mentions\)\}회 <em>\(\{displayTwoDigitCount\(Math\.round\(\(keyword\.mentions \/ selectedStaffImprovementTotalMentions\) \* 100\)\)\}%\)/);
  assert.doesNotMatch(navigation, /selectedStaffPrimaryStrength|selectedStaffPrimaryImprovement/);
  assert.doesNotMatch(navigation, /지점장 면담 가이드|다음 행동 1개 합의/);
  assert.doesNotMatch(navigation, /전체 상담 분포/);
  assert.match(navigation, /className="growth-scatter-evidence-note">원 크기 = 실제 회신건수<\/small>/);
  assert.match(navigation, /r=\{Math\.min\(5\.2, 2\.2 \+ Math\.sqrt\(point\.responses\) \* 0\.42\)\}/);
  assert.match(navigation, /r=\{Math\.min\(6, 2\.8 \+ Math\.sqrt\(point\.responses\) \* 0\.46\)\}/);
  assert.match(navigation, /className="growth-scatter-y-label"[^>]*>고객상담 평균만족도<\/text>/);
  assert.match(navigation, /className="growth-scatter-x-label"[^>]*>근속기간\(년\)<\/text>/);
  assert.doesNotMatch(navigation, />상담만족\(10점\)<\/text>/);
  assert.match(css, /\.growth-scatter-y-label,\s*\.growth-scatter-x-label\s*\{[^}]*font-size:\s*9px;/);
  assert.match(css, /\.growth-profile-person small,\s*\.growth-profile-metric > span\s*\{[^}]*font-size:\s*10px;/);
  assert.match(css, /\.growth-profile-person strong\s*\{[^}]*font-size:\s*19px;/);
  assert.match(css, /\.growth-profile-metric strong\s*\{[^}]*font-size:\s*20px;/);
  assert.match(css, /\.growth-scatter-card footer\s*\{[^}]*font-size:\s*9px;/);
  assert.match(css, /\.growth-scatter-evidence-note\s*\{[^}]*font-size:\s*8\.5px;/);
  assert.match(css, /\.growth-sales-monthly-legend\s*\{[^}]*font-size:\s*9px;/);
  assert.match(css, /\.growth-sales-share-meta > small\s*\{[^}]*font-size:\s*9\.5px;/);
  assert.match(css, /\.growth-sales-share-meta\s*\{[^}]*gap: 2px;[^}]*margin-top: 6px;[^}]*text-align: left;/);
  assert.match(navigation, /className="growth-scatter-average-line"/);
  assert.equal((navigation.match(/className="growth-scatter-average-label"/g) ?? []).length, 2);
  assert.equal((navigation.match(/staffScatterPlot\.right - 32/g) ?? []).length, 2);
  assert.equal((navigation.match(/<rect width="50" height="30" rx="4" \/>/g) ?? []).length, 2);
  assert.equal((navigation.match(/<path className="pointer" d="M 25 28 L 32 36 L 39 28 Z" \/>/g) ?? []).length, 2);
  assert.match(navigation, /<text x="25" y="11" textAnchor="middle">전국 평균<\/text>/);
  assert.match(navigation, /\{\(staffScatterNationalAverage \/ 10\)\.toFixed\(1\)\}점/);
  assert.doesNotMatch(navigation, /textAnchor="end">전국 \{\(staffScatterNationalAverage \/ 10\)\.toFixed\(1\)\}/);
  assert.match(css, /\.growth-scatter-average-line\s*\{[^}]*stroke:\s*#c63d45;[^}]*stroke-width:\s*1\.2;[^}]*stroke-dasharray:\s*5 4;/);
  assert.match(css, /\.growth-scatter-average-label rect,[\s\S]*?\.growth-scatter-average-label \.pointer\s*\{[^}]*fill:\s*rgba\(255, 246, 247, 0\.97\);[^}]*stroke:\s*rgba\(198, 61, 69, 0\.42\);/);
  assert.match(css, /\.growth-scatter-average-label text\s*\{[^}]*fill:\s*#a42f38;[^}]*font-size:\s*7\.5px;[^}]*font-weight:\s*650;/);
  assert.match(css, /\.growth-scatter-average-label text\.score\s*\{[^}]*font-size:\s*9px;[^}]*font-weight:\s*750;/);
  assert.equal((navigation.match(/viewBox=\{(?:consultation|sales)ScatterZoom\.viewBox\}/g) ?? []).length, 2);
  assert.match(navigation, /전체 점수 범위를 유지하면서 8~10점 구간을 넓게 표시합니다\./);
  assert.match(source, /const staffScatterUpperRangeExponent = 1\.7;/);
  assert.match(source, /Math\.pow\(scoreRatio, staffScatterUpperRangeExponent\)/);
  assert.match(navigation, /<article className="growth-sales-funnel-card">[\s\S]*?<header>[\s\S]*?<strong>상담\/ 시승\/ 계약 전환율<\/strong>/);
  assert.match(navigation, /<article className="growth-position-card">[\s\S]*?<header>[\s\S]*?<strong>역량진단 결과<\/strong>/);
  assert.doesNotMatch(navigation, /<span>역량진단<\/span>[\s\S]*?<strong>\{selectedStaffGrowthLabel\}<\/strong>/);
  assert.doesNotMatch(navigation, /<span>상담 역량 위치<\/span>/);
  assert.equal((navigation.match(/className="growth-under-construction">공사중<\/div>/g) ?? []).length, 2);
  assert.match(css, /\.growth-under-construction\s*\{[^}]*position:\s*absolute;[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*background:\s*rgba\(43, 84, 104, 0\.72\);[^}]*color:\s*#fff;/);
  assert.match(css, /\.growth-sales-funnel-card > header strong,[\s\S]*?\.growth-sales-monthly-card > header strong\s*\{[^}]*font-size: 13px;/);
  assert.match(css, /\.growth-position-card > header strong,[\s\S]*?\.growth-sales-funnel-card > header strong,[\s\S]*?\.growth-sales-monthly-card > header strong\s*\{[^}]*font-size: 13px;[^}]*color: #244f64;/);
  assert.match(navigation, /근속기간 × <span className="growth-sales-heading-number">26<\/span>년 누적 판매/);
  assert.doesNotMatch(navigation, /근속기간 × 2026 누적판매/);
  assert.match(navigation, /근속기간 × 고객상담 평균만족도/);
  assert.doesNotMatch(navigation, /근속기간 × 상담만족/);
  assert.match(navigation, /근속기간 × <span className="growth-sales-heading-number">26<\/span>년 누적 판매대수/);
  assert.match(navigation, /전국 영업직원 근속기간별 2026년 누적 판매대수 분포/);
  assert.match(navigation, /2026 누적판매\(대\)/);
  assert.match(navigation, /staffSalesNationalAverage\.toFixed\(1\)\}대/);
  assert.match(navigation, /평균 = 전국 \{nationalStaffSalesPopulation\.length\}명 누적판매 합계 ÷ 인원/);
  assert.equal((navigation.match(/className="growth-scatter-zoom-surface"/g) ?? []).length, 2);
  assert.doesNotMatch(navigation, /growth-scatter-zoom-reset|원상복귀/);
  assert.match(source, /const scatterViewportMaximumScale = 5;/);
  assert.match(source, /if \(!event\.ctrlKey && !event\.metaKey\) return;[\s\S]*?event\.preventDefault\(\);[\s\S]*?Math\.exp\(-event\.deltaY \* 0\.0025\)/);
  assert.match(source, /svg\.addEventListener\("wheel", handleWheel, \{ passive: false \}\)/);
  assert.match(source, /if \(currentScale <= 1\.001[\s\S]*?svg\.setPointerCapture\(event\.pointerId\)[\s\S]*?svg\.classList\.add\("is-panning"\)/);
  assert.match(source, /svg\.addEventListener\("pointerdown", handlePointerDown\)[\s\S]*?svg\.addEventListener\("pointermove", handlePointerMove\)[\s\S]*?svg\.addEventListener\("pointerup", clearPan\)/);
  assert.match(source, /if \(event\.touches\.length !== 2\) return;[\s\S]*?Math\.hypot\(second\.clientX - first\.clientX, second\.clientY - first\.clientY\)/);
  assert.match(source, /svg\.addEventListener\("touchstart", handleTouchStart, \{ passive: false \}\)[\s\S]*?svg\.addEventListener\("touchmove", handleTouchMove, \{ passive: false \}\)/);
  assert.match(source, /if \(event\.touches\.length !== 1\) \{[\s\S]*?touchY = null;[\s\S]*?downwardIntent = 0;/);
  assert.match(source, /svg\.addEventListener\("dblclick", handleDoubleClick\)/);
  assert.equal((navigation.match(/className="growth-scatter-fixed-axes"/g) ?? []).length, 2);
  assert.equal((navigation.match(/className="growth-scatter-fixed-x-axis">근속기간\(년\)<\/span>/g) ?? []).length, 2);
  assert.match(navigation, /className="growth-scatter-fixed-y-axis">고객상담 평균만족도<\/span>/);
  assert.match(navigation, /className="growth-scatter-fixed-y-axis">2026 누적판매\(대\)<\/span>/);
  assert.equal((navigation.match(/data-scatter-point="true"/g) ?? []).length, 4);
  assert.match(source, /detail: "Sales-DMS 누적기준"/);
  assert.equal((navigation.match(/className="growth-scatter-point-preview"/g) ?? []).length, 2);
  assert.equal((navigation.match(/className="growth-scatter-coordinate-x"/g) ?? []).length, 2);
  assert.equal((navigation.match(/className="growth-scatter-coordinate-y"/g) ?? []).length, 2);
  assert.match(source, /target\?\.closest\("\[data-scatter-point\]"\)\) return;/);
  assert.match(source, /setStaffScatterPreview\([\s\S]*?window\.setTimeout\(\(\) => \{[\s\S]*?setStaffScatterPreview\(null\);[\s\S]*?\}, 3000\);/);
  assert.match(navigation, /onPointerDown=\{\(event\) => activateStaffScatterPoint\(event, consultationPreviewFor\(point\)\)\}/);
  assert.match(navigation, /onPointerDown=\{\(event\) => activateStaffScatterPoint\(event, salesPreviewFor\(point\)\)\}/);
  assert.match(css, /\.growth-scatter-zoom-surface\s*\{[^}]*position:\s*relative;[^}]*aspect-ratio:\s*470 \/ 210;[^}]*overflow:\s*hidden;[^}]*touch-action:\s*pan-y;/);
  assert.match(css, /\.growth-scatter-zoom-surface\[data-zoomed="true"\]\s*\{[^}]*cursor:\s*grab;[^}]*touch-action:\s*none;/);
  assert.match(css, /\.growth-scatter-fixed-axes\s*\{[^}]*pointer-events:\s*none;[^}]*font-size:\s*7\.5px;/);
  assert.match(css, /\.growth-scatter-point\.is-inspected\s*\{[^}]*stroke: #177493;[^}]*animation: growth-scatter-point-confirm/);
  assert.match(css, /\.growth-scatter-point-preview\s*\{[^}]*pointer-events: none;[^}]*animation: growth-scatter-preview-life 3s ease both;/);
  assert.match(css, /\.growth-scatter-point-popover small\s*\{[^}]*word-break: keep-all;/s);
  assert.match(css, /\.growth-scatter-coordinate-x,[\s\S]*?\.growth-scatter-coordinate-y\s*\{[^}]*background: rgba\(250, 253, 254, 0\.92\);[^}]*font-size: 7\.5px;/);
  assert.match(css, /@keyframes growth-scatter-preview-life\s*\{[\s\S]*?82%[\s\S]*?100% \{ opacity: 0; \}/);
  assert.match(css, /\.growth-scatter-card svg\s*\{[^}]*image-rendering:\s*auto;/);
  assert.equal((navigation.match(/className="growth-scatter-selected-photo"/g) ?? []).length, 2);
  assert.equal((navigation.match(/className="growth-scatter-selected-guides is-targeting"/g) ?? []).length, 2);
  assert.equal((navigation.match(/className="growth-scatter-selected-guides is-targeting"[\s\S]*?className="growth-scatter-population"/g) ?? []).length, 2);
  assert.match(navigation, /className="guide-arm guide-arm-from-top"[\s\S]*?className="guide-arm guide-arm-from-bottom"[\s\S]*?className="guide-arm guide-arm-from-left"[\s\S]*?className="guide-arm guide-arm-from-right"/);
  assert.match(css, /\.growth-scatter-selected-guides\s*\{[^}]*stroke:\s*#177493;[^}]*stroke-width:\s*1\.2;[^}]*stroke-dasharray:\s*4 4;[^}]*pointer-events:\s*none;/);
  assert.equal((navigation.match(/className="guide-arm guide-arm-from-/g) ?? []).length, 8);
  assert.match(css, /@keyframes growth-scatter-guide-y\s*\{[\s\S]*?scaleY\(0\)[\s\S]*?scaleY\(1\)/);
  assert.match(css, /@keyframes growth-scatter-guide-x\s*\{[\s\S]*?scaleX\(0\)[\s\S]*?scaleX\(1\)/);
  assert.match(css, /\.growth-scatter-selected-photo \.photo-reveal\s*\{[^}]*animation: growth-scatter-photo-reveal 620ms/);
  assert.match(css, /@keyframes growth-scatter-photo-reveal\s*\{[\s\S]*?scale\(0\.28\)[\s\S]*?scale\(1\.12\)[\s\S]*?scale\(1\)/);
  assert.equal((navigation.match(/className="photo-acquire-flash"/g) ?? []).length, 2);
  assert.equal((navigation.match(/className="photo-halo" r="9\.8"/g) ?? []).length, 2);
  assert.equal((navigation.match(/href=\{selectedStaffProfile\.image\}/g) ?? []).length, 2);
  assert.equal((navigation.match(/className="photo-fallback-silhouette"/g) ?? []).length, 2);
  assert.equal((source.match(/className="staff-profile-silhouette"/g) ?? []).length, 2);
  assert.match(source, /const staffFallbackProfileImage = "\/staff-profiles\/neutral-human-silhouette\.png";/);
  assert.match(source, /const staffFemaleFallbackProfileImage = "\/staff-profiles\/female-human-silhouette\.png";/);
  assert.match(source, /selectedStaffEmployee\?\.gender === "female"[\s\S]*?staffFemaleFallbackProfileImage[\s\S]*?: staffFallbackProfileImage/);
  assert.equal(staffAnalysis.showrooms["6KR6846"].employees.find((employee) => employee.name === "김예소")?.gender, "female");
  assert.equal((navigation.match(/(?:src|href)=\{selectedStaffFallbackProfileImage\}/g) ?? []).length, 3);
  assert.doesNotMatch(source, /(?:src|href)=\{staffFallbackProfileImage\}/);
  assert.doesNotMatch(navigation, /selectedStaffInitials/);
  assert.doesNotMatch(navigation, /<span className="staff-profile-silhouette"/);
  assert.match(css, /\.growth-profile-photo\s*\{[^}]*width: 42px;[^}]*height: auto;[^}]*aspect-ratio: 21 \/ 22;/);
  assert.match(css, /\.growth-profile-photo img\s*\{[^}]*display: block;[^}]*width: 100%;[^}]*height: auto;[^}]*object-fit: cover;/);
  assert.match(css, /\.growth-profile-photo img\.staff-profile-silhouette,[\s\S]*?object-fit: cover;[\s\S]*?object-position: center top;[\s\S]*?transform: scale\(1\.04\);/);
  assert.match(css, /\.growth-profile-photo img:not\(\.staff-profile-silhouette\),[\s\S]*?\.analysis-staff-profile-photo img:not\(\.staff-profile-silhouette\)\s*\{[^}]*width: 100%;[^}]*height: 100%;[^}]*object-fit: cover;[^}]*object-position: center top;[^}]*transform: scale\(1\.35\);[^}]*transform-origin: center top;[^}]*image-rendering: auto;/);
  assert.equal((navigation.match(/preserveAspectRatio="xMidYMin slice"/g) ?? []).length, 4);
  assert.match(css, /\.growth-scatter-selected-photo image\.photo-fallback-silhouette\s*\{[^}]*pointer-events: none;/);
  assert.match(navigation, /clipPath="url\(#consultation-selected-staff-photo\)"/);
  assert.match(navigation, /clipPath="url\(#sales-selected-staff-photo\)"/);
  assert.equal((navigation.match(/<circle className="photo-backdrop" r="9\.4" \/>/g) ?? []).length, 2);
  assert.equal((navigation.match(/x="-10\.125"[\s\S]*?y="-7\.5"[\s\S]*?width="20\.25"[\s\S]*?height="20\.25"/g) ?? []).length, 2);
  assert.equal((navigation.match(/x="-7\.5"[\s\S]*?y="-7\.5"[\s\S]*?width="15"[\s\S]*?height="15"/g) ?? []).length, 2);
  assert.equal((navigation.match(/<circle className="photo-ring" r="8" \/>/g) ?? []).length, 2);
  assert.match(css, /\.growth-scatter-selected-photo \.photo-backdrop\s*\{[^}]*stroke: #a9c4ce;[^}]*stroke-width: 1\.5;/);
  assert.match(css, /\.growth-scatter-selected-photo \.photo-ring\s*\{[^}]*stroke: #2d7187;[^}]*stroke-width: 1\.2;/);
  assert.match(css, /\.growth-scatter-selected-photo \.photo-halo\s*\{[^}]*fill: rgba\(23, 116, 147, 0\.24\);[^}]*stroke: rgba\(23, 116, 147, 0\.78\);[^}]*pointer-events: none;[^}]*animation: growth-scatter-photo-halo 1\.18s cubic-bezier\(0\.2, 0\.7, 0\.28, 1\) infinite;/);
  assert.match(css, /@keyframes growth-scatter-photo-halo\s*\{[\s\S]*?transform: scale\(0\.9\);[\s\S]*?transform: scale\(1\.48\);/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.growth-scatter-selected-photo \.photo-halo\s*\{[^}]*animation: none;/);
  assert.doesNotMatch(navigation, /className="growth-scatter-selected"|className="point"|className="halo"/);
  assert.equal((navigation.match(/\{displayShowroomNameWithoutBrand\(selected\.showroom\)\} SC<\/span>/g) ?? []).length, 2);
  assert.doesNotMatch(navigation, /\{displayShowroomNameWithoutBrand\(selected\.showroom\)\} 전시장<\/span>/);
  assert.match(css, /\.growth-position-card\s*\{[^}]*height:\s*244px;[^}]*box-sizing:\s*border-box;/);
  assert.match(css, /\.growth-sales-funnel-card\s*\{[^}]*height:\s*244px;[^}]*box-sizing:\s*border-box;/);
  assert.equal((navigation.match(/<radialGradient id="(?:consultation|sales)-showroom-gradient" cx="32%" cy="28%" r="72%">/g) ?? []).length, 2);
  assert.equal((navigation.match(/<stop offset="0%" stopColor="#7fe0bd" \/>/g) ?? []).length, 2);
  assert.equal((navigation.match(/<stop offset="48%" stopColor="#18a578" \/>/g) ?? []).length, 2);
  assert.equal((navigation.match(/<stop offset="100%" stopColor="#05684c" \/>/g) ?? []).length, 2);
  assert.match(navigation, /fill="url\(#consultation-showroom-gradient\)"/);
  assert.match(navigation, /fill="url\(#sales-showroom-gradient\)"/);
  assert.match(css, /\.growth-scatter-showroom circle\s*\{[^}]*fill-opacity:\s*0\.94;[^}]*stroke:\s*#fff;/);
  assert.match(css, /\.growth-scatter-card footer \.showroom i\s*\{[^}]*linear-gradient\(135deg, #7fe0bd 0%, #18a578 48%, #05684c 100%\);/);
  assert.doesNotMatch(navigation, /<span>2026 월별 출고 실적<\/span>/);
  assert.match(navigation, /<article className="growth-sales-monthly-card">[\s\S]*?<header>[\s\S]*?<strong>\{selectedStaffEmployee\?\.name \?\? "선택 직원"\} 누적판매 <span className="growth-sales-heading-number">\{selectedStaffDeliveredSales\}<\/span>대<\/strong>/);
  assert.match(css, /\.growth-scatter-card > header strong > \.growth-sales-heading-number,[\s\S]*?\.growth-sales-monthly-card > header strong > \.growth-sales-heading-number\s*\{[^}]*display: inline;[^}]*margin: 0;[^}]*font-family: var\(--font-volvo\);[^}]*font-size: inherit;[^}]*line-height: inherit;[^}]*color: inherit;[^}]*font-variant-numeric: tabular-nums;/);
  assert.doesNotMatch(navigation, /원자료 갱신 필요|개인정보 제외 집계|고객 흐름 연결/);
  assert.doesNotMatch(navigation, /2026 영업활동 기록 없음|최근 기록|활동 \{salesActivitySource\.activityAsOf/);
  assert.doesNotMatch(css, /\.growth-sales-funnel-card > footer\.warning/);
  assert.match(navigation, /className="growth-sales-share-panel"/);
  assert.match(navigation, /전시장 누적판매 중/);
  assert.match(navigation, /<span>\{displayShowroomNameWithoutBrand\(selected\.showroom\)\} 누적<\/span>/);
  assert.doesNotMatch(navigation, /<span>전시장 누적<\/span>/);
  assert.match(navigation, /판매비중/);
  assert.match(navigation, /selectedStaffSalesShare\.toFixed\(1\)\}%/);
  assert.match(navigation, /selectedStaffShowroomAverageDeltaMark/);
  assert.match(source, /compactName === "아주" \|\| compactName\.includes\("아주오토리움"\)[\s\S]*?return "아주"/);
  assert.match(source, /compactName === "코오롱" \|\| compactName\.includes\("코오롱오토모티브"\)[\s\S]*?return "코오롱"/);
  assert.match(source, /selectedStaffDealerSalesPopulation\.filter\([\s\S]*?staff\.deliveredSales > selectedStaffDeliveredSales[\s\S]*?\.length \+ 1/);
  assert.match(source, /selectedStaffSalesRank = selectedStaffSalesActivity[\s\S]*?staff\.deliveredSales > selectedStaffSalesActivity\.deliveredSales[\s\S]*?\.length \+ 1/);
  assert.match(source, /selectedShowroomSalesPopulationCount = selectedSalesActivityShowroom\?\.staff\.length \?\? 0/);
  assert.match(navigation, /className="growth-sales-share-rank"[\s\S]*?<b>\{selectedDealerRankName\}<\/b>[\s\S]*?<em>\{displayTwoDigitRank\(selectedStaffDealerSalesRank\)\}위<\/em>[\s\S]*?<span><i aria-hidden="true">\/<\/i>전체 \{displayTwoDigitCount\(selectedStaffDealerSalesPopulation\.length\)\}<\/span>[\s\S]*?<b>\{displayShowroomNameWithoutBrand\(selected\.showroom\)\}<\/b>[\s\S]*?<em>\{displayTwoDigitRank\(selectedStaffSalesRank\)\}위<\/em>[\s\S]*?<span><i aria-hidden="true">\/<\/i>전체 \{displayTwoDigitCount\(selectedShowroomSalesPopulationCount\)\}<\/span>/);
  assert.match(source, /const displayTwoDigitRank = \(value: number \| null\) => value === null \? "―" : displayTwoDigitCount\(value\);/);
  assert.doesNotMatch(navigation, /className="growth-sales-share-rank"[\s\S]*?selectedStaffEmployee/);
  assert.match(css, /\.growth-sales-share-rank i\s*\{[^}]*margin-right: 4px;[^}]*color: #9aabb3;[^}]*font-style: normal;/);
  assert.match(css, /\.growth-sales-share-meta\s*\{[^}]*text-align: left;/);
  assert.match(css, /\.growth-sales-share-rank\s*\{[^}]*display: grid;[^}]*grid-template-columns: max-content max-content max-content;[^}]*column-gap: 6px;[^}]*row-gap: 2px;[^}]*justify-content: start;/);
  assert.match(css, /\.growth-sales-share-rank > span\s*\{[^}]*display: contents;/);
  assert.match(css, /\.growth-sales-share-rank > span > b,[\s\S]*?\.growth-sales-share-rank > span > em,[\s\S]*?\.growth-sales-share-rank > span > span\s*\{[^}]*text-align: left;[^}]*white-space: nowrap;/);
  assert.doesNotMatch(navigation, /전시장 \{selectedStaffSalesRank \?\? "―"\}위[\s\S]*?월 평균/);
  assert.match(navigation, /1인 평균 \{selectedShowroomAverageDeliveredSales\.toFixed\(1\)\}대 대비/);
  assert.doesNotMatch(navigation, /영업활동 원자료 연결 후 활성화|산포도 표시 공간/);
  assert.equal(salesActivity.source.activityAsOf, "2026-09-07");
  assert.match(salesActivity.source.salesAsOf, /^2026-\d{2}-\d{2}$/);
  assert.match(salesActivity.source.salesSyncedAt, /^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
  assert.equal(salesActivity.source.salesUpdateSchedule, "매일 07:00·09:00 KST · 1일 2회");
  assert.doesNotMatch(navigation, /salesActivitySource\.salesAsOf\.replaceAll/);
  assert.equal(salesActivity.showrooms["6KR6834"].salesDealerCode, "HMGD");
  assert.equal(salesActivity.showrooms["6KR6834"].summary.activityStaffCount, 0);
  assert.ok(salesActivity.showrooms["6KR6834"].summary.deliveredSales > 0);
  const kimDaejunSales = salesActivity.showrooms["6KR6834"].staff.find((staff) => staff.name === "김대준");
  assert.ok(kimDaejunSales.deliveredSales >= 49);
  assert.equal(kimDaejunSales.lastActivityDate, "2025-01-16");
  assert.match(css, /\.growth-sales-funnel\s*\{[^}]*grid-template-columns: minmax\(58px, 1fr\) 44px minmax\(58px, 1fr\) 44px minmax\(58px, 1fr\) 44px minmax\(58px, 1fr\);/);
  assert.match(source, /Array\.from\(\s*\{ length: 12 \}/);
  assert.match(navigation, /2026년 1월부터 12월까지 월별 출고 실적, 미도래 월은 미집계/);
  assert.match(navigation, /<i className="staff" \/>\{selectedStaffEmployee\?\.name \?\? "선택 직원"\}<\/span>/);
  assert.match(navigation, /<i className="average" \/>\{displayShowroomNameWithoutBrand\(selected\.showroom\)\} 1인 평균/);
  assert.doesNotMatch(navigation, />소속 전시장 1인 평균<\/span>/);
  assert.match(css, /\.growth-sales-monthly-chart\s*\{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.growth-sales-monthly-body\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) 190px;/);
  assert.doesNotMatch(css, /\.growth-sales-monthly-chart::before\s*\{/);
  assert.match(css, /\.growth-sales-monthly-legend\s*\{[^}]*align-items: center;[^}]*justify-content: center;/);
  assert.match(css, /\.growth-sales-share-panel\s*\{[^}]*flex-direction: column;[^}]*border-left: 1px solid #c9d8de;/);
  assert.match(css, /\.growth-sales-share-visual\s*\{[^}]*display: grid;[^}]*grid-template-columns: 82px minmax\(0, 1fr\);[^}]*overflow: hidden;/);
  assert.match(css, /\.growth-sales-share-donut\s*\{[^}]*width: 78px;[^}]*height: 78px;[^}]*flex: 0 0 78px;/);
  assert.match(css, /\.growth-sales-share-donut > div\s*\{[^}]*width: 50px;[^}]*height: 50px;/);
  assert.match(css, /\.growth-sales-share-donut span\s*\{[^}]*font-size: 8px;/);
  assert.match(css, /\.growth-sales-share-donut\s*\{[^}]*conic-gradient\([^}]*#74aec5[^}]*#3d7f9e[^}]*#174662[^}]*#e9794f/);
  assert.match(css, /\.growth-sales-share-donut\s*\{[^}]*margin-top: 10px;[^}]*justify-self: start;/);
  assert.match(navigation, /key=\{`sales-share-\$\{selectedStaffEmployee\?\.cdsid \?\? selectedStaffEmployee\?\.name \?\? "none"\}`\}/);
  assert.match(css, /@property --growth-sales-share-angle\s*\{[^}]*syntax: "<angle>";[^}]*initial-value: 0deg;/);
  assert.match(css, /@property --growth-sales-share-mid-angle\s*\{[^}]*syntax: "<angle>";[^}]*initial-value: 0deg;/);
  assert.match(navigation, /"--growth-sales-share-mid-angle": `\$\{selectedStaffSalesShareClamped \* 1\.8\}deg`/);
  assert.match(css, /@keyframes growth-sales-share-fill\s*\{[^}]*--growth-sales-share-angle: 0deg;[^}]*clip-path: circle\(32\.5% at 50% 50%\);[\s\S]*?clip-path: circle\(50% at 50% 50%\);/);
  assert.match(css, /\.growth-sales-share-donut > div\s*\{[^}]*background: #fff;[^}]*position: relative;[^}]*z-index: 1;/);
  assert.doesNotMatch(css, /growth-sales-share-label-enter/);
  assert.match(css, /\.growth-sales-share-callout\s*\{[^}]*width: calc\(100% - 11px\);[^}]*margin: 3px 0 0 11px;[^}]*overflow: hidden;[^}]*transform: translateY\(-7px\);/);
  assert.match(navigation, /className="growth-sales-share-leader"[\s\S]*?pathLength="1"[\s\S]*?selectedStaffSalesShareLeaderX\.toFixed\(1\)/);
  assert.match(navigation, /selectedStaffSalesShareLeaderBendX\.toFixed\(1\)\},10 90,10/);
  assert.match(css, /\.growth-sales-share-leader polyline\s*\{[^}]*stroke: #3d7f9e;[^}]*stroke-dasharray: 1;[^}]*stroke-dashoffset: 1;[^}]*animation: growth-sales-share-leader-draw 720ms ease-out 420ms forwards;/);
  assert.match(css, /@keyframes growth-sales-share-leader-draw\s*\{[^}]*stroke-dashoffset: 0;/);
  assert.match(css, /\.growth-sales-share-callout > span\s*\{[^}]*font-size: 9\.5px;/);
  assert.match(css, /\.growth-sales-share-callout > strong\s*\{[^}]*font-size: 12px;/);
  assert.match(css, /\.growth-sales-share-callout > strong\s*\{[^}]*color: #176887;/);
  assert.match(css, /\.growth-sales-month > i b\s*\{[^}]*linear-gradient\(180deg, #74aec5 0%, #3d7f9e 48%, #174662 100%\);/);
  assert.match(profile, /displayTwoDigitCount\(selectedStaffTenureMonths \?\? 0\)\}개월[\s\S]*?<em>\(상위 \{selectedStaffTenureTopPercent\.toFixed\(1\)\}%\)<\/em>/);
  assert.match(profile, /displayTwoDigitCount\(selectedStaffTenureMonths \?\? 0\)\}개월\{selectedStaffTenureTopPercent/);
  assert.match(css, /\.growth-profile-person strong i em\s*\{[^}]*margin-left: 0;/);
  assert.match(source, /staff\.finalScore > selectedStaffSatisfactionScore/);
  assert.match(source, /selectedStaffSatisfactionNationalRank \/ staffTenureScatterPopulation\.length/);
  assert.match(navigation, /<small className="growth-profile-satisfaction-rank">[\s\S]*?\(상위 \{selectedStaffSatisfactionTopPercent\.toFixed\(1\)\}%\)/);
  assert.match(css, /\.growth-profile-metric strong \.growth-profile-satisfaction-rank\s*\{[^}]*margin-left: 0;[^}]*color: #3f7588;[^}]*font-family: var\(--font-ui\);[^}]*font-weight: 600;[^}]*white-space: nowrap;/);
  assert.match(source, /employee\.tenureMonths > selectedStaffEmployee\.tenureMonths/);
  assert.match(source, /selectedStaffTenureRank \/ staffCurrentSalesPopulation\.length/);
  assert.doesNotMatch(profile, /growth-profile-person-label/);
  assert.match(navigation, /<small>점<\/small>[\s\S]*?<small>\/10점<\/small>/);
  assert.match(navigation, /className="growth-profile-metric growth-profile-sales"[\s\S]*?<span>26년 누적 판매대수<\/span>[\s\S]*?\{selectedStaffDeliveredSales\}<small>대<\/small>[\s\S]*?\/ 월 평균 \{selectedStaffMonthlySalesAverage[\s\S]*?toFixed\(1\)\}대`\}/);
  assert.match(navigation, /className="growth-roster-sales-heading"[\s\S]*?<b>누적 판매대수<\/b>[\s\S]*?<i>26년 누적 판매대수<\/i>/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.growth-roster-sales-heading b\s*\{[^}]*display: inline;/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.growth-roster-sales-heading i\s*\{[^}]*display: none;/);
  assert.match(navigation, /selectedStaffSalesTopPercent\.toFixed\(1\)\}%\)<\/i>/);
  assert.match(css, /\.growth-profile-strip\s*\{[^}]*grid-template-columns: 281px repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.growth-navigation-workspace \{ grid-template-columns: 260px minmax\(0, 1fr\); \}[\s\S]*?\.growth-profile-strip \{ grid-template-columns: 253px repeat\(4, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /\.growth-profile-sales strong \.growth-profile-sales-context\s*\{[^}]*margin-left: 2px;[^}]*font-size: 10px;/);
  assert.doesNotMatch(navigation, /<b>최신성<\/b>|최신성\s*\(20%\)|전국 \d+명 중 \d+위/);
  assert.doesNotMatch(source, /const staffScoreFreshnessWeight|const staffScorePriorResponses/);
  assert.doesNotMatch(source, /peerAverage \* staffScorePriorResponses/);
  assert.match(source, /const satisfactionScore = average === null \? null : average \* 10;/);
  assert.match(css, /\.growth-navigation-workspace\s*\{[^}]*grid-template-columns: 288px minmax\(0, 1fr\);/);
  assert.match(css, /\.growth-navigation-workspace\s*\{[^}]*grid-template-areas: "roster detail";/);
  assert.match(navigation, /className="growth-navigation-sticky-summary"[\s\S]*?className="growth-navigation-heading"[\s\S]*?className="growth-profile-strip"[\s\S]*?className="growth-navigation-pinned-headings"[\s\S]*?className="growth-staff-roster-columns"[\s\S]*?className="growth-navigation-pinned-capabilities"[\s\S]*?className="growth-navigation-workspace"[\s\S]*?className="growth-staff-roster"[\s\S]*?className="growth-navigation-detail"/);
  assert.match(css, /\.growth-profile-strip\s*\{[^}]*margin: 6px 6px 0;/);
  assert.match(css, /\.growth-profile-strip > div:not\(:first-child\)::before\s*\{[^}]*top: 12px;[^}]*bottom: 12px;[^}]*background: rgba\(181, 202, 211, 0\.52\);/);
  assert.match(css, /\.growth-profile-certification strong b\s*\{[^}]*min-width: 4\.2ch;[^}]*justify-content: flex-start;/);
  assert.match(css, /\.growth-comment-bar > small\s*\{[^}]*font-variant-numeric: tabular-nums;[^}]*text-align: right;/);
  assert.match(css, /\.competitive-analysis-page > \.growth-navigation-sticky-summary,[\s\S]*?\.competitive-analysis-page > \.growth-navigation,[\s\S]*?\.competitive-analysis-page > \.v3s-award-card\s*\{[^}]*margin-right: calc\(-1 \* var\(--dashboard-content-overhang\)\);[^}]*margin-left: calc\(-1 \* var\(--dashboard-content-overhang\)\);/);
  assert.match(css, /\.growth-navigation-sticky-summary\s*\{[^}]*border: 0;[^}]*border-bottom: 0;/);
  assert.match(css, /\.growth-navigation-heading\s*\{[^}]*border-bottom: 1px solid #d8e5ea;/);
  assert.match(css, /\.growth-navigation-sticky-summary\s*\{[^}]*position: -webkit-sticky;[^}]*position: sticky;[^}]*top: var\(--growth-navigation-sticky-top, 356px\);[^}]*z-index: 44;[^}]*align-self: start;[^}]*background: #f5f9fb;[^}]*0 -18px 0 #ffffff,/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.growth-navigation-sticky-summary\s*\{/);
  assert.match(css, /@media \(min-width: 600px\) and \(max-width: 760px\)\s*\{[\s\S]*?--growth-navigation-sticky-top: 0px;/);
  assert.match(css, /html\.analysis-viewport-locked body\s*\{[^}]*overflow-x: clip;[^}]*overflow-y: visible;/);
  assert.doesNotMatch(css, /html\.analysis-viewport-locked body\s*\{[^}]*overflow-x: hidden;/);
  assert.match(source, /const isPhoneViewport = window\.matchMedia\("\(max-width: 599px\)"\)\.matches;/);
  assert.match(source, /const isNarrowTabletViewport = window\.matchMedia\([\s\S]*?"\(min-width: 600px\) and \(max-width: 760px\)"[\s\S]*?\)\.matches;/);
  assert.match(source, /const shellHeight = usesStaticAnalysisShell[\s\S]*?Math\.ceil\(shell\.getBoundingClientRect\(\)\.height\);[\s\S]*?--growth-navigation-sticky-top[\s\S]*?--growth-navigation-summary-height/);
  assert.match(source, /const analysisWorkspaceRef = useRef<HTMLElement>\(null\);/);
  assert.match(source, /const workspacePassedRatio = \(projectedDistance = 0\) => \{[\s\S]*?passedDistance \/ Math\.max\(1, workspaceBounds\.height\)/);
  assert.match(source, /let growthSummaryFlowTop =[\s\S]*?window\.scrollY \+ growthSummary\.getBoundingClientRect\(\)\.top/);
  assert.match(source, /const rememberGrowthSummaryFlowTop = \(\) => \{[\s\S]*?summaryBounds\.top > fixedHeaderBottom\(\) \+ 8[\s\S]*?growthSummaryFlowTop = window\.scrollY \+ summaryBounds\.top/);
  assert.match(source, /const settleAtGrowthNavigation = \(\) => \{[\s\S]*?growthSummaryFlowTop - persistentBannerBottom\(\) -[\s\S]*?\(usesPcSectionFlow \? 0 : 8\)[\s\S]*?window\.requestAnimationFrame\(alignEntry\)/);
  assert.match(source, /const handleEntryScroll = \(\) => \{[\s\S]*?movingDown[\s\S]*?shouldSettleAtGrowthNavigation\(\)[\s\S]*?settleAtGrowthNavigation\(\)/);
  assert.match(source, /const keepWheelGestureLocked = \(\) => \{[\s\S]*?wheelGestureActive = true;[\s\S]*?100\);/);
  assert.match(source, /const clearEntryTouch = \(\) => \{[\s\S]*?releaseEntrySnapWhenInputEnds\(\);[\s\S]*?window\.addEventListener\("scroll", handleEntryScroll, \{ passive: true \}\)/);
  assert.doesNotMatch(source, /queueEntrySettle|pendingEntrySettle/);
  assert.match(source, /workspacePassedRatio\(\) < 0\.5\) \{[\s\S]*?entrySnapConsumed = false;[\s\S]*?rememberGrowthSummaryFlowTop\(\);/);
  assert.match(source, /const revealAnalysisWorkspace = \(\) => \{[\s\S]*?visibleHeight >= Math\.min\(240, bounds\.height \* 0\.5\)[\s\S]*?window\.scrollTo\(\{[\s\S]*?top: Math\.max\(0, targetTop\),[\s\S]*?prefers-reduced-motion: reduce/);
  assert.match(source, /const changeView = \(nextView: AnalysisView\) => \{\s*revealAnalysisWorkspace\(\);\s*if \(nextView === view\) return;/);
  assert.match(source, /<section className="analysis-workspace" ref=\{analysisWorkspaceRef\}>/);
  assert.match(navigation, /className="growth-navigation-sticky-summary"\s*ref=\{growthNavigationSummaryRef\}[\s\S]*?className="growth-navigation-pinned-headings"/);
  assert.match(navigation, /className="growth-navigation-detail"[\s\S]*?role="region"[\s\S]*?tabIndex=\{0\}[\s\S]*?onPointerDown=\{beginGrowthNavigationDetailDrag\}[\s\S]*?onPointerMove=\{moveGrowthNavigationDetailDrag\}[\s\S]*?onPointerUp=\{endGrowthNavigationDetailDrag\}/);
  assert.match(source, /event\.currentTarget\.scrollTop\s*=\s*drag\.originScrollTop - \(event\.clientY - drag\.originY\)/);
  assert.match(source, /const growthNavigationDetailRef = useRef<HTMLDivElement>\(null\);/);
  assert.doesNotMatch(navigation, /scrollTo\(\{[\s\S]*?top: 0/);
  assert.match(css, /\.growth-navigation-pinned-headings\s*\{[^}]*grid-template-columns: 288px minmax\(0, 1fr\);[^}]*border-bottom: 1px solid #d5e3e9;/);
  assert.match(css, /\.growth-staff-roster-list\s*\{[^}]*padding: 3px 6px;/);
  assert.match(css, /\.growth-navigation-detail\s*\{[^}]*padding: 3px 6px 6px;/);
  assert.match(source, /const detailPaddingTop =\s*Number\.parseFloat\(window\.getComputedStyle\(detail\)\.paddingTop\) \|\| 0;[\s\S]*?scatterBounds\.top - detailBounds\.top - detailPaddingTop/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.growth-staff-roster\s*\{[^}]*height: 100%;[^}]*align-self: stretch;[^}]*overflow: hidden;[^}]*background: #ffffff;/);
  assert.doesNotMatch(css, /\.growth-staff-roster\s*\{[^}]*position: sticky;[^}]*top: calc/);
  assert.match(css, /\.growth-staff-roster-list\s*\{[^}]*max-height: calc\([\s\S]*?100dvh[\s\S]*?var\(--growth-navigation-summary-height, 152px\) - 6px/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.growth-navigation-workspace,[\s\S]*?\.growth-navigation-detail\s*\{[^}]*height: calc\([\s\S]*?100dvh[\s\S]*?var\(--growth-navigation-summary-height, 152px\) - 12px[\s\S]*?max-height: 660px;/);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.growth-navigation-detail\s*\{[^}]*overflow-x: hidden;[^}]*overflow-y: auto;[^}]*-webkit-overflow-scrolling: touch;[^}]*touch-action: pan-y;[^}]*scrollbar-width: none;[^}]*scrollbar-gutter: auto;/);
  assert.match(css, /\.growth-navigation-detail::-webkit-scrollbar\s*\{[^}]*width: 0;[^}]*height: 0;[^}]*display: none;/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.growth-navigation-detail\s*\{[^}]*cursor: grab;[^}]*\}[\s\S]*?\.growth-navigation-detail\.is-dragging\s*\{[^}]*cursor: grabbing;[^}]*user-select: none;/);
  const rosterBaseHeightRule = css.indexOf("max-height: 660px;", css.indexOf(".growth-staff-roster-list"));
  const rosterViewportHeightRule = css.indexOf("var(--growth-navigation-summary-height, 152px) - 6px", rosterBaseHeightRule + 1);
  assert.ok(rosterBaseHeightRule >= 0 && rosterViewportHeightRule > rosterBaseHeightRule);
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?\.growth-staff-roster-list\s*\{[^}]*overscroll-behavior-y:\s*contain;[^}]*-webkit-overflow-scrolling:\s*touch;[^}]*touch-action:\s*none;/);
  assert.doesNotMatch(css, /\.growth-navigation-detail \.growth-capability > header\s*\{[^}]*position: sticky;/);
  assert.doesNotMatch(css, /\.growth-navigation-workspace::before\s*\{[^}]*position: sticky;/);
  assert.match(css, /\.growth-capability\s*\{[^}]*overflow: visible;[^}]*border: 0;[^}]*border-radius: 0;[^}]*background: transparent;/);
  assert.match(css, /\.dashboard \.score-stack-heading::before\s*\{[^}]*top: -20px;[^}]*bottom: 100%;[^}]*background: #ffffff;/);
  assert.match(css, /\.growth-navigation-heading\s*\{[^}]*min-height: 40px;[^}]*padding: 6px 16px;/);
  assert.match(css, /\.growth-navigation-source\s*\{[^}]*justify-content: flex-end;[^}]*margin-left: auto;/);
  assert.match(css, /\.growth-navigation-source span\s*\{[^}]*width: auto;[^}]*min-width: max-content;[^}]*height: 22px;[^}]*align-items: center;[^}]*justify-content: center;[^}]*padding: 1px 18px 0;[^}]*font-size: 7\.5px;/);
  assert.match(source, /<strong><b>\{groupItems\.length\}<\/b>개소<\/strong>/);
  assert.match(css, /\.analysis-ranking-card > \.analysis-card-heading > strong\s*\{[^}]*min-height: 21px;[^}]*border-radius: 999px;[^}]*font-size: 7\.5px;/);
  assert.match(css, /\.analysis-ranking-card footer\s*\{[^}]*gap: 0;[^}]*background: #eef5f7;/);
  assert.match(css, /\.analysis-ranking-card footer span\s*\{[^}]*position: relative;[^}]*background: transparent;/);
  assert.match(css, /\.analysis-ranking-card footer span \+ span::before\s*\{[^}]*top: 50%;[^}]*height: 16px;[^}]*transform: translateY\(-50%\);/);
  assert.match(navigation, /className="growth-capability-columns"[\s\S]*?className="growth-capability consultation"[\s\S]*?className="growth-capability sales"/);
  assert.match(css, /\.growth-capability-columns\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.growth-capability-grid\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*gap: 6px;[^}]*padding: 0;/);
  assert.match(css, /\.growth-capability > header\s*\{[^}]*min-height: 34px;/);
  assert.match(css, /\.growth-scatter-card\s*\{[^}]*display: grid;[^}]*grid-template-rows: 18px auto 20px;/);
  assert.match(css, /\.growth-scatter-card > header\s*\{[^}]*height: 18px;[^}]*min-height: 18px;/);
  assert.match(css, /\.growth-scatter-card svg\s*\{[^}]*aspect-ratio: 470 \/ 210;/);
  assert.match(css, /\.growth-scatter-card footer\s*\{[^}]*height: 20px;[^}]*min-height: 20px;[^}]*overflow: hidden;/);
  assert.match(css, /\.growth-evidence-grid\s*\{[^}]*height: 202px;[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-template-rows: minmax\(0, 1fr\);[^}]*gap: 6px;[^}]*padding: 6px 0 0;/);
  assert.match(css, /\.growth-comment-evidence\s*\{[^}]*min-height: 0;/);
  assert.match(css, /\.growth-sales-monthly-card\s*\{[^}]*height: 196px;[^}]*min-height: 196px;/);
  assert.match(css, /\.growth-sales-dashboard\s*\{[^}]*grid-template-rows: auto auto auto;[^}]*gap: 6px;[^}]*padding: 0;[^}]*background: transparent;/);
  assert.match(css, /\.growth-comment-bars\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*gap:\s*7px;/);
  assert.match(css, /\.growth-comment-bar > span\s*\{[^}]*font-size:\s*10px;/);
  assert.match(css, /\.growth-comment-bar > i\s*\{[^}]*height:\s*12px;/);
  assert.match(css, /\.growth-comment-bar > small\s*\{[^}]*font-size:\s*9px;/);
  assert.match(css, /\.growth-comment-bar-column \+ \.growth-comment-bar-column\s*\{[^}]*margin-left:\s*0;[^}]*padding-left:\s*0;[^}]*border-left:\s*0;/);
  assert.match(css, /\.growth-comment-bar > i > b\s*\{[^}]*width: var\(--growth-comment-bar-ratio\);/);
  assert.match(css, /\.growth-comment-evidence\.improvement \.growth-comment-bar > i > b\s*\{[^}]*#bd4548/);
  assert.match(navigation, /SHOWROOM_ENVIRONMENT_IMPROVEMENT_LABELS\.has\(keyword\.label\) \? " environment"/);
  assert.match(css, /\.growth-comment-evidence\.improvement \.growth-comment-bar\.environment > span,[\s\S]*?color:\s*#8a5508;/);
  assert.match(css, /\.growth-comment-evidence\.improvement \.growth-comment-bar\.environment > i\s*\{[^}]*background:\s*#fff8e8;/);
  assert.match(css, /\.growth-comment-evidence\.improvement \.growth-comment-bar\.environment > i > b\s*\{[^}]*#8f5908/);
  assert.doesNotMatch(css, /\.growth-interview-guide/);
  assert.doesNotMatch(navigation, /이번 설계의 데이터 원칙|2025·2026 연도별 증감과 최신성은 판단에서 제외/);
  assert.doesNotMatch(css, /\.growth-data-policy\s*\{/);
  assert.match(navigation, /className=\{`growth-zone-gauge/);
  assert.match(css, /\.growth-zone-gauge\s*\{[^}]*margin:\s*-12px auto 0;[^}]*width:\s*min\(100%, 380px\);/);
  assert.match(source, /const selectedShowroomStaffResponses = rankedSalesStaff\.reduce\([\s\S]*?const selectedShowroomStaffAverage = selectedShowroomStaffResponses/);
  assert.match(source, /\(staff\.average \?\? 0\) \* staff\.responses/);
  assert.match(navigation, /className="growth-position-benchmarks"[\s\S]*?className="showroom-average"[\s\S]*?displayShowroomNameWithoutBrand\(selected\.showroom\)\} 평균 \{selectedShowroomStaffAverage/);
  assert.match(navigation, /className="growth-gauge-showroom-average-marker"[\s\S]*?--growth-showroom-average-angle/);
  assert.match(navigation, /<line x1="34" x2="210" y1="190" y2="190" \/>[\s\S]*?<circle cx="38" cy="190" r="2\.5" \/>/);
  assert.match(navigation, /전시장 평균 \$\{selectedShowroomStaffAverage\?\.toFixed\(1\)\}점/);
  assert.match(css, /\.growth-position-benchmarks \.showroom-average\s*\{[^}]*color:\s*#075f49;[^}]*font-weight:\s*700;/);
  assert.match(css, /\.growth-position-benchmarks \.showroom-average i\s*\{[^}]*width:\s*13px;[^}]*border-top:\s*1\.5px dashed #087a58;/);
  assert.match(css, /\.growth-gauge-showroom-average-marker\s*\{[^}]*rotate\(var\(--growth-showroom-average-angle\)\);[^}]*color:\s*#087a58;/);
  assert.match(css, /\.growth-gauge-showroom-average-marker line\s*\{[^}]*stroke-width:\s*1\.5;[^}]*stroke-dasharray:\s*3 3;[^}]*opacity:\s*0\.92;/);
  assert.equal((navigation.match(/key=\{`(?:strength|improvement)-bars-\$\{selectedStaffEmployee\?\.cdsid/g) ?? []).length, 2);
  assert.match(navigation, /key=\{`monthly-sales-\$\{selectedStaffEmployee\?\.cdsid/);
  assert.match(css, /\.growth-comment-bar > i > b\s*\{[^}]*animation:\s*analysis-insight-bar-enter 620ms/);
  assert.match(css, /\.growth-sales-month > i b\s*\{[^}]*animation:\s*growth-sales-bar-enter 720ms/);
  assert.match(css, /@keyframes growth-sales-bar-enter/);
  assert.match(navigation, /상담 역량 타코미터/);
  assert.match(navigation, /M45 190 A165 165/);
  assert.match(navigation, /M220 171\.5 L92 178 L220 184\.5 Z/);
  assert.match(navigation, /circle cx="210" cy="178" r="13"/);
  assert.match(navigation, /growth-gauge-current[\s\S]*?x="210" y="209"/);
  assert.match(css, /\.growth-gauge-needle\s*\{[^}]*transform-origin:\s*210px 178px;/);
  assert.match(navigation, /className=\{`growth-gauge-current \$\{selectedStaffGrowthDeltaTone\}`\}[\s\S]*?\{selectedStaffGrowthCalculation\}/);
  assert.match(source, /selectedStaffPeerDelta > 0[\s\S]*?\? "▲"[\s\S]*?: "▼"/);
  assert.match(source, /`본인 \$\{\(selectedStaffSatisfactionScore \/ 10\)\.toFixed\(1\)\}점 − 동일연차 평균 \$\{\(selectedStaffTenureFinalScore \/ 10\)\.toFixed\(1\)\}점 = \$\{selectedStaffGrowthDeltaMark\} \$\{Math\.abs\(selectedStaffPeerDelta \/ 10\)\.toFixed\(1\)\}점`/);
  assert.doesNotMatch(source, /selectedStaffPeerDelta >= 0 \? "\+"/);
  assert.match(css, /--comparison-positive-blue:\s*#176f91;/);
  assert.match(css, /\.growth-gauge-current\.positive\s*\{[^}]*fill:\s*var\(--comparison-positive-blue\);/);
  assert.match(css, /\.growth-sales-share-meta strong\.positive\s*\{[^}]*color:\s*var\(--comparison-positive-blue\) !important;/);
  assert.match(css, /\.analysis-summary-card > em\.positive\s*\{[^}]*color:\s*var\(--comparison-positive-blue\) !important;/);
  assert.match(css, /\.growth-gauge-current\.negative\s*\{[^}]*fill:\s*var\(--warning\);/);
  assert.match(css, /\.growth-gauge-current\.neutral\s*\{[^}]*fill:\s*#536f7b;/);
  assert.doesNotMatch(navigation, /className="growth-gauge-current"[^>]*>\{selectedStaffGrowthLabel\}/);
  assert.match(css, /@keyframes growth-gauge-sweep/);
  assert.match(css, /0% \{ transform: rotate\(0deg\); \}/);
  assert.match(css, /transform: rotate\(var\(--growth-needle-angle\)\)/);
  assert.match(css, /\.growth-gauge-segments \.expanding\.active/);
  assert.match(css, /\.growth-zone-gauge\[data-zone="0"\] \.coaching-label,[\s\S]*?\.growth-zone-gauge\[data-zone="1"\] \.accelerating-label,[\s\S]*?\.growth-zone-gauge\[data-zone="2"\] \.expanding-label\s*\{[^}]*fill:\s*#ffffff;/);
  assert.match(source, /Math\.max\(-6, Math\.min\(6, selectedStaffPeerDelta\)\)/);
  assert.doesNotMatch(navigation, /동일연차 평균과|등수로 평가하지 않고 다음 행동을 정합니다/);
  assert.doesNotMatch(css, /\.growth-position-card > p\s*\{/);
});

test("links ranking selections to the scatter plot in every analysis view", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /type AnalysisView = "dealer" \| "showroom" \| "region" \| "size";/);
  assert.match(source, /const \[pinnedCdsid, setPinnedCdsid\] = useState<string \| null>\(null\);/);
  assert.match(source, /const linkedCdsid = hoveredCdsid \?\? pinnedCdsid;/);
  assert.equal(
    (source.match(/const isHovered = !isSelected && linkedCdsid === item\.cdsid;/g) ?? []).length,
    2,
  );
  assert.match(
    source,
    /className=\{isSelected \? "selected" : isHovered \? "hovered" : ""\}[\s\S]*?aria-pressed=\{!isSelected \? pinnedCdsid === item\.cdsid : undefined\}[\s\S]*?onClick=\{\(\) => !isSelected && toggleLinkedShowroom\(item\.cdsid\)\}[\s\S]*?event\.key === "Enter" \|\| event\.key === " "/,
  );
  assert.match(
    css,
    /\.scatter-point\.dense\.hovered:not\(\.selected\) > b\s*\{[^}]*border-color: #4a938f[^}]*color: #245f5c[^}]*background: #e8f4f3/,
  );
});

test("orders review staff by hire date with the newest hire last", async () => {
  const [staffData, analysisSource, css] = await Promise.all([
    readFile(new URL("../app/data/voc-staff-analysis.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const orderedNames = staffData.showrooms["6KR6834"].employees
    .filter((employee) => employee.role === "영업직원" || employee.role === "영업팀장")
    .sort((a, b) => a.hireDate.localeCompare(b.hireDate) || a.name.localeCompare(b.name, "ko"))
    .map((employee) => employee.name);

  assert.ok(orderedNames.indexOf("김대준") < orderedNames.indexOf("강석"));
  assert.ok(orderedNames.indexOf("강석") < orderedNames.indexOf("송용주"));
  assert.ok(orderedNames.indexOf("송용주") < orderedNames.indexOf("박준수"));
  assert.ok(orderedNames.indexOf("박준수") < orderedNames.indexOf("정지만"));
  assert.match(
    analysisSource,
    /\.sort\(\(a, b\) => compareStaffHireDateAscending\(a\.employee, b\.employee\)\)/,
  );
  assert.match(css, /\.growth-staff-roster-list button > span strong\s*\{[^}]*width: 5\.25em;[^}]*flex: 0 0 5\.25em;/);
});

test("averages Q1-Q2 metrics before combining and keeps staff scores legible", async () => {
  const { showrooms } = JSON.parse(await readFile(new URL("../app/data/showrooms.json", import.meta.url), "utf8"));
  const mean = (values) => {
    const present = values.filter((value) => typeof value === "number");
    return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : 0;
  };
  const expected = showrooms.map((showroom) => {
    const satisfaction = mean([showroom.q1?.voc, showroom.voc]);
    const happycall = mean([showroom.q1?.happyCall, showroom.happyCall]);
    return { ...showroom, satisfaction, happycall, combined: satisfaction + happycall };
  }).sort((a, b) => b.combined - a.combined || b.satisfaction - a.satisfaction || a.showroom.localeCompare(b.showroom, "ko"));
  for (const [index, showroom] of expected.entries()) {
    const response = await render(`/dashboard/${showroom.cdsid}/analysis?view=showroom`);
    assert.equal(response.status, 200);
    const html = (await response.text()).replaceAll("<!-- -->", "");
    for (const [kind, score] of [["satisfaction", showroom.satisfaction], ["happycall", showroom.happycall], ["balance", showroom.combined]]) {
      const card = html.match(new RegExp(`<article class="analysis-summary-card ${kind}">([\\s\\S]*?)</article>`))?.[1];
      assert.ok(card, `${showroom.cdsid} ${kind}`);
      const actual = Number(card.match(/aria-label="([\d.]+)점"/)?.[1]);
      assert.equal(actual, Number(score.toFixed(1)), `${showroom.cdsid} ${kind}`);
    }
    assert.ok(html.includes(`전국 전시장 내 ${index + 1}위 / 전체 ${expected.length}`));
    assert.ok(html.includes("VOC 상담 만족도") && html.includes("ONE Voice 시승 만족도") && html.includes("ONE Voice 출고 만족도"));
    assert.ok(html.includes("VOC 상담 후 해피콜(24시간 이내 시행)") && html.includes("ONE Voice 출고 후 해피콜(24시간 이내 시행)"));
    assert.doesNotMatch(html, /2개 분기 · 200점 만점|400점 만점/);
  }
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.analysis-staff-workspace\s*\{[^}]*grid-template-columns: 330px minmax\(0, 1fr\);/);
  assert.match(css, /\.analysis-staff-roster-identity strong\s*\{[^}]*width: 38px;[^}]*font-size: 12px;/);
  assert.doesNotMatch(css.match(/\.analysis-staff-roster-identity strong\s*\{[^}]*\}/)?.[0] ?? "", /ellipsis/);
  assert.match(css, /\.analysis-staff-roster-adjusted-points,\s*\.analysis-staff-roster-freshness-points\s*\{[^}]*font-weight: 400;/);
  assert.match(css, /\.analysis-staff-roster-final\s*\{[^}]*font-family: var\(--font-volvo\)/);
  assert.match(css, /\.analysis-staff-roster-final\s*\{[^}]*font-weight: 700;/);
});

test("includes every staff member with fair provisional and unscored scatter states", async () => {
  const staffData = JSON.parse(await readFile(new URL("../app/data/voc-staff-analysis.json", import.meta.url), "utf8"));
  const source = await readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const responseCounts = Object.values(staffData.showrooms).flatMap((showroom) => showroom.employees)
    .filter((staff) => staff.role === "영업직원" || staff.role === "영업팀장")
    .map((staff) => Object.values(staff.years).reduce((sum, year) => sum + year.responses, 0));
  const expectedConfirmed = responseCounts.filter((count) => count >= 8).length;
  const expectedProvisional = responseCounts.filter((count) => count > 0 && count < 8).length;
  const expectedUnscored = responseCounts.filter((count) => count === 0).length;
  assert.ok(expectedConfirmed > 0);
  assert.ok(expectedProvisional > 0);
  assert.ok(expectedUnscored > 0);
  assert.equal(expectedConfirmed + expectedProvisional + expectedUnscored, responseCounts.length);
  assert.match(source, /className="analysis-staff-tenure-scatter"[\s\S]*?최종점수\(100점\)/);
  assert.match(source, /staffScatterYTicks\.map[\s\S]*?textAnchor="end"/);
  assert.match(source, /staffTenureScatterPopulation\.map[\s\S]*?data-final-score=\{point\.finalScore\}[\s\S]*?data-provisional=\{point\.provisional\}/);
  assert.match(source, /staffScatterNoResponses\.map[\s\S]*?data-unscored="true"/);
  assert.match(source, /analysis-staff-scatter-selected[\s\S]*?data-final-score=\{selectedStaffScatterPoint\.finalScore\}/);
  assert.doesNotMatch(source, /100점 만점 · 표시 범위|전체 0~100|analysis-staff-scatter-controls/);
  assert.match(
    css,
    /\.analysis-staff-tenure-scatter\s*\{[^}]*grid-template-rows:\s*minmax\(264px, 1fr\) auto;/,
  );
  assert.match(source, /staffTenureScatterPopulation: StaffTenureScatterPoint\[\] = nationalStaffFinalScores\.flatMap\([\s\S]*?staff\.referenceScore === null \? \[\]/);
  assert.match(source, /const satisfactionScore = average === null \? null : average \* 10;[\s\S]*?referenceScore: satisfactionScore,[\s\S]*?finalScore: satisfactionScore/);
  assert.doesNotMatch(source, /setStaffScatterFullScale|staffScatterFullScale/);
  assert.doesNotMatch(source, /staffScatterY\(point\.average\)|staffScatterY\(staffNationalAverage\)/);
  assert.match(css, /\.analysis-staff-roster > header > span\s*\{[^}]*font-size: 9px;[^}]*font-family: var\(--font-latin\)[^}]*font-weight: 400;/);
  assert.match(css, /\.analysis-staff-roster > header\s*\{[^}]*24px 104px repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.analysis-staff-roster-freshness-points\s*\{[^}]*font-size: 11px;/);
  assert.match(css, /\.analysis-staff-roster-final\s*\{[^}]*font-size: 12px;[^}]*font-weight: 700;/);
  assert.match(css, /\.analysis-staff-summary\s*\{[^}]*minmax\(160px, 0\.72fr\) repeat\(5, minmax\(0, 1fr\)\)/);
});

test("uses the selected showroom's actual comparison values in footer labels", async () => {
  const response = await render("/dashboard/6KR6834/analysis?view=size");
  assert.equal(response.status, 200);
  const html = (await response.text()).replaceAll("<!-- -->", "");
  const footer = html.match(/<footer><span>U[^]*?<\/footer>/)?.[0];
  assert.ok(footer);
  assert.match(footer, /<span>U<strong>/);
  assert.match(footer, /<span>강남대치<strong>190\.3<\/strong>/);
  assert.doesNotMatch(footer, /동일 사이즈|누적평균|볼보|합산점수/);
});

test("keeps half-year tenure labels compact and comparison details inside the card", async () => {
  const source = await readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const formatBody = source.match(/const formatStaffTenureDuration = \(months: number\) => \{([^]*?)\n\};/)[1];
  const rangeBody = source.match(/const staffTenureHalfYearRange = \(completedMonths: number\) => \{([^]*?)\n\};/)[1];
  const format = new Function("months", formatBody);
  const rangeFor = new Function("completedMonths", rangeBody);
  for (const [months, expected] of [[0, "0개월 ~ 6개월"], [36, "3년 ~ 3년 6개월"], [41, "3년 ~ 3년 6개월"], [42, "3년 6개월 ~ 4년"], [47, "3년 6개월 ~ 4년"], [48, "4년 ~ 4년 6개월"]]) {
    const range = rangeFor(months);
    assert.equal(`${format(range.start - 1)} ~ ${format(range.end)}`, expected);
  }
  assert.match(source, /formatStaffTenureDuration\(selectedStaffTenurePeerRangeStart - 1\)/);
  assert.match(source, /className="analysis-staff-metric-card analysis-staff-tenure-peer-card"/);
  assert.match(
    source,
    /selectedStaffTenureFinalScore\.toFixed\(1\)[\s\S]*?selectedStaffTenurePeerRangeLabel \?\? "―"[\s\S]*?selectedStaffTenureScoreRows\.length/,
  );
  assert.match(css, /\.analysis-staff-tenure-peer-card \.analysis-staff-metric-value > small\.analysis-staff-metric-comparison\s*\{[^}]*min-width: 0;[^}]*display: block;[^}]*white-space: nowrap;[^}]*overflow-wrap: normal;/);
});

test("redistributes compact roster width equally to both staff charts", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const block = (selector) => css.slice(css.indexOf(`${selector} {`)).split("}")[0];
  assert.match(block(".analysis-staff-workspace"), /grid-template-columns: 330px minmax\(0, 1fr\);/);
  assert.match(block(".analysis-staff-comparison-layout"), /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  for (const selector of [".analysis-staff-roster > header", ".analysis-staff-roster-list button"]) {
    assert.match(block(selector), /grid-template-columns: 24px 104px repeat\(3, minmax\(0, 1fr\)\);/);
  }
  assert.match(block(".analysis-staff-roster-identity"), /gap: 2px;[^]*padding: 0 4px 0 8px;/);
  assert.match(block(".analysis-staff-roster-identity strong"), /width: 38px;[^]*font-size: 12px;/);
  assert.match(css, /\.analysis-staff-roster-list\s*\{\s*min-width: 328px;/);
});

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
  const [css, manifest, loginCover, loginSource] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../public/volvo-dashboard-cover-clean.png",
        import.meta.url,
      ),
    ),
    readFile(new URL("../app/LoginHome.tsx", import.meta.url), "utf8"),
  ]);
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /VOLVO SALES MANAGER ONLY/);
  assert.match(html, /Volvo Data/);
  assert.match(html, /Dashboard/);
  assert.match(
    html,
    /class="login-volvo-wordmark"[^>]*>[\s\S]*?src="\/volvo-wordmark-white\.png"[^>]*alt="VOLVO"/,
  );
  assert.doesNotMatch(html, /데이터 분석을 통해/);
  assert.match(html, /정확한 인사이트로 더 나은 의사결정을 지원합니다\./);
  assert.match(
    css,
    /\.login-description\s*\{[^}]*font-size: 15px;/,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)\s*\{[\s\S]*?\.login-description\s*\{[^}]*font-size: 12px;/,
  );
  assert.match(html, /CDSID를 입력해 주세요/);
  assert.match(html, /Data Dashboard 시작/);
  assert.match(loginSource, /"checking-user": "접속자 정보 확인 중"/);
  assert.match(
    loginSource,
    /"scanning-security": "보안패치 프로그램 스캔 중"/,
  );
  assert.match(loginSource, /LOGIN_IDENTITY_MIN_MS = 700/);
  assert.match(loginSource, /LOGIN_SECURITY_SCAN_MS = 650/);
  assert.match(
    loginSource,
    /setLoginPhase\("checking-user"\)[\s\S]*?await wait\(identityRemaining\)[\s\S]*?setLoginPhase\("scanning-security"\)[\s\S]*?await wait\(LOGIN_SECURITY_SCAN_MS\)[\s\S]*?window\.location\.assign/,
  );
  assert.match(
    loginSource,
    /<strong aria-live="polite" aria-atomic="true">[\s\S]*?LOGIN_PHASE_LABELS\[loginPhase\]/,
  );
  assert.match(html, /접속 현황/);
  assert.match(html, /오늘/);
  assert.match(html, /0(?:<!-- -->)?명/);
  assert.match(html, /누적/);
  assert.doesNotMatch(html, /86(?:<!-- -->)?명|1,265(?:<!-- -->)?명/);
  assert.match(html, /UPDATE/);
  assert.match(html, /Since 260901/);
  assert.match(loginSource, /fetch\(`\/dashboard-release\.json\?t=\$\{Date\.now\(\)\}`/);
  assert.match(loginSource, /release\.items\.length > 0/);
  assert.match(loginSource, /release\.publishedAtKst/);
  assert.doesNotMatch(loginSource, /formatSeoulTimestamp\(new Date\(\)\)/);
  assert.match(
    css,
    /\.cdsid-form > button\[type="submit"\] strong\s*\{[^}]*display: inline-flex;[^}]*align-items: center;[^}]*min-height: 22px;[^}]*line-height: 22px;/,
  );
  assert.match(
    css,
    /\.login-mouse-icon\s*\{[^}]*top: 50%;[^}]*height: 22px;[^}]*transform: translateY\(-50%\);/,
  );
  assert.match(
    css,
    /html:has\(\.login-home\)\s*\{[^}]*height: 100%;[^}]*overflow: hidden;[^}]*overscroll-behavior: none;[^}]*scrollbar-gutter: auto;[^}]*background: #07141d;/,
  );
  assert.match(
    css,
    /html:has\(\.login-home\)\s*\{[^}]*background-image:[\s\S]*?rgba\(5, 17, 25, 0\.86\) 0%[\s\S]*?volvo-dashboard-cover-clean\.png[^}]*background-size: cover;/,
  );
  assert.match(
    css,
    /body:has\(\.login-home\)\s*\{[^}]*position: fixed;[^}]*inset: 0;[^}]*height: 100dvh;[^}]*min-height: 100dvh;[^}]*overflow: hidden;[^}]*overscroll-behavior: none;[^}]*touch-action: manipulation;[^}]*volvo-dashboard-cover-clean\.png[^}]*cover no-repeat/,
  );
  assert.match(
    css,
    /\.login-home\s*\{[^}]*width: 100%;[^}]*height: 100dvh;[^}]*min-height: 100dvh;[^}]*isolation: isolate/,
  );
  assert.match(
    css,
    /\.login-home::before\s*\{[^}]*position: fixed;[^}]*bottom: calc\(-1 \* max\(32px, env\(safe-area-inset-bottom, 0px\)\)\);[^}]*width: calc\(min\(790px, 48vw\) \+ env\(safe-area-inset-left, 0px\)\);/,
  );
  assert.match(
    css,
    /\.login-panel\s*\{[^}]*min-height: 100vh;[^}]*min-height: 100svh;[^}]*min-height: 100dvh;/,
  );
  assert.match(
    css,
    /\.login-photo\s*\{[^}]*position: fixed;[^}]*top: calc\(-1 \* env\(safe-area-inset-top, 0px\)\);[^}]*bottom: calc\(-1 \* env\(safe-area-inset-bottom, 0px\)\);/,
  );
  assert.match(
    css,
    /\.login-volvo-wordmark\s*\{[^}]*top: max\(27px, calc\(env\(safe-area-inset-top, 0px\) \+ 22px\)\);[^}]*left: 50%;[^}]*width: 154px;[^}]*transform: translateX\(-50%\)/,
  );
  assert.match(
    css,
    /\.login-volvo-wordmark img\s*\{[^}]*display: block;[^}]*width: 100%;[^}]*height: auto;[^}]*object-fit: contain;/,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)\s*\{[\s\S]*?\.login-volvo-wordmark\s*\{[^}]*top: max\(22px, calc\(env\(safe-area-inset-top, 0px\) \+ 16px\)\);[^}]*width: 140px;/,
  );
  assert.ok(loginCover.byteLength > 1_000_000);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /background_color: "#07141d"/);
  assert.match(
    css,
    /\.login-panel footer\s*\{[^}]*width: min\(100%, 340px\);[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\) auto;[^}]*gap: 5px 6px;/,
  );
  assert.match(css, /\.cdsid-form\s*\{[^}]*width: min\(100%, 340px\);/);
  assert.match(
    css,
    /\.login-panel footer span \+ span::before\s*\{[^}]*margin-right: 6px;/,
  );
  assert.match(
    css,
    /\.login-panel footer span:last-child\s*\{[^}]*justify-self: end;[^}]*white-space: nowrap;[^}]*text-align: right;/,
  );
  assert.match(
    css,
    /\.login-session-meta time\s*\{[^}]*margin-left: auto;[^}]*margin-right: 0;/,
  );
  assert.match(
    css,
    /\.login-copy,\s*\.login-panel footer\s*\{[^}]*transform: translateX\(clamp\(58px, 4vw, 68px\)\);/,
  );
  assert.match(
    css,
    /\.login-audience\s*\{[^}]*margin: 0 0 7px;[^}]*font-family: var\(--font-korean\)[^}]*font-size: 9px;[^}]*font-weight: 750;[^}]*letter-spacing: 1\.65px;[^}]*line-height: normal;[^}]*text-transform: uppercase;/,
  );
  assert.match(html, /class="login-intro"/);
  assert.match(css, /\.login-intro\s*\{[^}]*transform: translateY\(-22px\);/);
  assert.match(css, /\.login-copy\s*\{[^}]*margin-top: 0;/);
  assert.match(css, /\.login-description\s*\{[^}]*margin: 0 0 52px;/);
  assert.match(css, /\.login-copy h1\s*\{[^}]*font-weight: 600;[^}]*line-height: 0\.95;/);
  assert.match(
    css,
    /@media \(max-width: 760px\)\s*\{[\s\S]*?\.login-copy,\s*\.login-panel footer\s*\{[^}]*transform: translateX\(38px\);[\s\S]*?\.login-copy h1\s*\{[^}]*line-height: 0\.92;/,
  );
  assert.match(
    css,
    /@media \(hover: none\) and \(pointer: coarse\) and \(min-width: 761px\)\s*\{[\s\S]*?\.login-home,\s*\.login-panel\s*\{[^}]*height: 100svh;[^}]*max-height: 100svh;[\s\S]*?\.login-home\s*\{[^}]*position: fixed;[^}]*inset: 0;[^}]*touch-action: manipulation;/,
  );
  assert.match(
    css,
    /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: portrait\) and \(min-width: 761px\) and \(max-width: 1100px\)\s*\{[\s\S]*?\.login-panel\s*\{[^}]*position: fixed;[^}]*z-index: 3;[^}]*inset: 0 auto 0 0;[^}]*width: min\(78vw, 760px\);[^}]*height: 100svh;[\s\S]*?\.login-copy,\s*\.login-panel footer\s*\{[^}]*transform: none;/,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)\s*\{[\s\S]*?html:has\(\.login-home\)\s*\{[^}]*overflow-y: auto;[\s\S]*?body:has\(\.login-home\)\s*\{[^}]*position: static;[^}]*touch-action: pan-y;/,
  );

  const explicitLoginResponse = await render("/login");
  assert.equal(explicitLoginResponse.status, 200);
  const explicitLoginHtml = await explicitLoginResponse.text();
  assert.match(explicitLoginHtml, /Volvo Data/);
  assert.match(explicitLoginHtml, /CDSID를 입력해 주세요/);
});

test("remembers only the last successfully authenticated CDSID", async () => {
  const [loginSource, css] = await Promise.all([
    readFile(new URL("../app/LoginHome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    loginSource,
    /const LAST_LOGIN_CDSID_KEY = "volvo-dashboard-last-cdsid"/,
  );
  assert.match(
    loginSource,
    /localStorage[\s\S]*?\.getItem\(LAST_LOGIN_CDSID_KEY\)[\s\S]*?setRememberedCdsid\(rememberedCdsid\)/,
  );
  assert.match(
    loginSource,
    /onFocus=\{\(\) => \{[\s\S]*?if \(!cdsid && rememberedCdsid\) setRecentCdsidOpen\(true\);/,
  );
  assert.match(
    loginSource,
    /function selectRememberedCdsid\(\)[\s\S]*?setCdsid\(rememberedCdsid\)[\s\S]*?setRecentCdsidOpen\(false\)[\s\S]*?cdsidInputRef\.current\?\.blur\(\)/,
  );
  assert.match(
    loginSource,
    /recentCdsidOpen && rememberedCdsid[\s\S]*?role="option"[\s\S]*?onPointerDown=\{\(event\) => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?selectRememberedCdsid\(\);[\s\S]*?onClick=\{selectRememberedCdsid\}/,
  );
  assert.match(
    loginSource,
    /ref=\{cdsidInputRef\}[\s\S]*?onPointerDown=\{\(event\) => \{[\s\S]*?if \(!cdsid && rememberedCdsid && !recentCdsidOpen\) \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?setRecentCdsidOpen\(true\);[\s\S]*?cdsidInputRef\.current\?\.blur\(\);[\s\S]*?onFocus=/,
  );
  assert.match(
    loginSource,
    /aria-expanded=\{recentCdsidOpen && Boolean\(rememberedCdsid\)\}[\s\S]*?aria-autocomplete="list"/,
  );
  assert.match(
    loginSource,
    /if \(!response\.ok \|\| !payload\.redirectPath\)[\s\S]*?return;[\s\S]*?localStorage\.setItem\(LAST_LOGIN_CDSID_KEY, normalizedCdsid\)[\s\S]*?window\.location\.assign/,
  );
  assert.match(
    loginSource,
    /void refreshTimestamp\(\)[\s\S]*?addEventListener\("pageshow", refreshTimestamp\)[\s\S]*?addEventListener\("visibilitychange", refreshWhenVisible\)/,
  );
  assert.match(
    css,
    /\.cdsid-entry\s*\{[^}]*position: relative;[^}]*z-index: 5;[^}]*overflow: visible;/,
  );
  assert.match(
    css,
    /\.recent-cdsid-menu\s*\{[^}]*position: absolute;[^}]*top: calc\(100% \+ 4px\);[^}]*z-index: 20;[^}]*animation: recent-cdsid-menu-in 150ms/,
  );
});

test("automatically detects, announces, and applies new dashboard releases", async () => {
  const [layoutSource, pagesSource, noticeSource, releaseBuildSource, pagesBuildSource, css, releaseAsset] =
    await Promise.all([
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../github-pages/main.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/ReleaseUpdateNotice.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../build/prepare-dashboard-release.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../scripts/prepare-github-pages.mjs", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(
        new URL("../public/dashboard-release.json", import.meta.url),
        "utf8",
      ),
    ]);
  const release = JSON.parse(releaseAsset);

  assert.match(layoutSource, /\{children\}[\s\S]*?<ReleaseUpdateNotice \/>/);
  assert.match(pagesSource, /<PagesApp \/>[\s\S]*?<ReleaseUpdateNotice \/>/);
  assert.match(noticeSource, /\/dashboard-release\.json/);
  assert.match(noticeSource, /cache: "no-store"/);
  assert.match(noticeSource, /window\.setInterval\([\s\S]*?RELEASE_CHECK_INTERVAL/);
  assert.match(noticeSource, /window\.addEventListener\("pageshow"/);
  assert.match(noticeSource, /document\.addEventListener\("visibilitychange"/);
  assert.match(noticeSource, /currentId !== nextRelease\.id[\s\S]*?reloadForRelease/);
  assert.match(noticeSource, /nextRelease\.id !== __DASHBOARD_RELEASE_ID__/);
  assert.match(noticeSource, /requestedReleaseId !== nextRelease\.id/);
  assert.match(releaseBuildSource, /sales\.source\?\.salesAsOf/);
  assert.match(releaseBuildSource, /sales\.source\?\.salesSyncedAt/);
  assert.match(releaseBuildSource, /roster\.source\?\.rosterCheckedAt/);
  assert.match(releaseBuildSource, /const seed = `\$\{JSON\.stringify\(note\)\}\\n\$\{sales\.source\?\.salesAsOf/);
  assert.match(pagesBuildSource, /const releaseSeed = `\$\{JSON\.stringify\(releaseNote\)\}\\n\$\{salesSource\?\.salesAsOf/);
  assert.doesNotMatch(releaseBuildSource, /const seed = `\$\{JSON\.stringify\(note\)\}:\$\{builtAt\.toISOString\(\)\}`/);
  assert.match(noticeSource, /searchParams\.set\("release", nextRelease\.id\)/);
  assert.match(pagesBuildSource, /"\/dashboard-release\.json"/);
  assert.match(pagesBuildSource, /"\/staff-profiles\/"/);
  assert.match(pagesBuildSource, /content\.replaceAll\(prefix, `\$\{pagesBasePath\}/);
  assert.match(pagesBuildSource, /history\.replaceState/);
  assert.match(
    noticeSource,
    /hostname\.endsWith\("\.github\.io"\)[\s\S]*?pathname\.startsWith\("\/dashboard\/"\)[\s\S]*?nextUrl\.pathname = GITHUB_PAGES_BASE_PATH;[\s\S]*?nextUrl\.hash = currentDashboardRoute;/,
  );
  assert.match(noticeSource, /window\.location\.replace\(nextUrl\.toString\(\)\)/);
  assert.match(noticeSource, /최신 내역이 업데이트 되었습니다\./);
  assert.doesNotMatch(noticeSource, /release\.items\.map/);
  assert.match(noticeSource, /const NOTICE_DURATION = 3_200/);
  assert.match(
    noticeSource,
    /if \(!seenRelease\)[\s\S]*?localStorage\.setItem\(RELEASE_STORAGE_KEY, nextRelease\.id\)[\s\S]*?else if \(seenRelease !== nextRelease\.id\)/,
  );
  assert.match(
    css,
    /\.release-update-notice\s*\{[^}]*width: max-content;[^}]*min-height: 36px;[^}]*position: fixed;[^}]*bottom: max\(16px, env\(safe-area-inset-bottom\)\);[^}]*border-radius: 999px;/,
  );
  assert.match(css, /background: rgba\(17, 40, 61, 0\.94\)/);
  assert.equal(release.title, "최신내용 업데이트");
  assert.ok(release.items.length >= 80);
  assert.match(release.id, /^[a-f0-9]{16}$/);

  const clientAssets = new URL("../dist/client/assets/", import.meta.url);
  const noticeChunkName = (await readdir(clientAssets)).find((name) =>
    name.startsWith("ReleaseUpdateNotice-") && name.endsWith(".js"),
  );
  assert.ok(noticeChunkName);
  const noticeChunk = await readFile(new URL(noticeChunkName, clientAssets), "utf8");
  assert.match(noticeChunk, new RegExp(release.id));
});

test("downloads privacy-safe Sales-DMS staff sales every day at 09:00 KST", async () => {
  const [workflow, source] = await Promise.all([
    readFile(new URL("../.github/workflows/sync-sales-dms-sales.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/sync-sales-dms-sales.py", import.meta.url), "utf8"),
  ]);

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: "0 22 \* \* \*"/);
  assert.match(workflow, /cron: "0 0 \* \* \*"/);
  assert.match(workflow, /for attempt in 1 2 3/);
  assert.match(workflow, /actions: write/);
  assert.match(workflow, /echo "changed=true" >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /if: steps\.publish\.outputs\.changed == 'true'/);
  assert.match(workflow, /gh workflow run deploy-pages\.yml --ref main/);
  assert.match(workflow, /secrets\.VOLVO_SALES_ID/);
  assert.match(workflow, /secrets\.VOLVO_SALES_PASSWORD/);
  assert.match(workflow, /python scripts\/sync-sales-dms-sales\.py/);
  assert.match(workflow, /git add app\/data\/sales-activity-analysis\.json/);
  assert.match(source, /"Report Management",[\s\S]*?"리포트관리",[\s\S]*?"Actual Monthly Sales",[\s\S]*?"Area Total"/);
  assert.match(source, /inputs\[0\]\.fill\(f"\{as_of\.year\}-01-01"\)/);
  assert.match(source, /inputs\[1\]\.fill\(as_of\.isoformat\(\)\)/);
  assert.match(source, /visible_control\(frame, "검색"\)\.click/);
  assert.match(source, /expect_download\(timeout=900_000\)/);
  assert.match(source, /visible_control\(frame, "다운로드"\)\.click/);
  assert.match(source, /required = \{"Delivery Date", "출고여부", "Dealer", "고객명", "영업직원"\}/);
  assert.match(source, /if key not in \{"deliveredSales", "deliveredCustomers", "monthlyDeliveredSales"\}/);
  assert.doesNotMatch(source, /output\[[^\n]*고객명/);
  assert.match(source, /"salesSyncedAt": datetime\.now\(ZoneInfo\("Asia\/Seoul"\)\)\.isoformat/);
  assert.match(source, /"salesUpdateSchedule": "매일 07:00·09:00 KST · 1일 2회"/);
});

test("keeps GitHub Pages analysis tab changes inside the app URL", async () => {
  const analysisSource = await readFile(
    new URL("../app/CompetitiveAnalysis.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    analysisSource,
    /const nextRoute = `\/dashboard\/\$\{selected\.cdsid\}\/analysis\?view=\$\{nextView\}`;[\s\S]*?pathname\.startsWith\("\/data-dashboard\/"\)[\s\S]*?nextUrl\.hash = nextRoute;[\s\S]*?replaceState\(null, "", nextUrl\.toString\(\)\)/,
  );
  assert.doesNotMatch(
    analysisSource,
    /replaceState\([\s\S]{0,80}`\/dashboard\/\$\{selected\.cdsid\}\/analysis\?view=/,
  );
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

test("scopes dashboard routes to master, dealer-head, and manager access", async () => {
  const managerHome = await render("/dashboard/6KR6834", {
    cookie: cookieFor("K-KIM16"),
  });
  assert.equal(managerHome.status, 200);
  const managerHtml = await managerHome.text();
  assert.match(managerHtml, /identity-profile identity-profile--static/);
  assert.doesNotMatch(managerHtml, /aria-controls="showroom-switcher"/);

  const managerCrossShowroom = await render("/dashboard/6KR6802", {
    cookie: cookieFor("K-KIM16"),
  });
  assert.equal(managerCrossShowroom.status, 307);
  assert.equal(
    managerCrossShowroom.headers.get("location"),
    "http://localhost/dashboard/6KR6834",
  );

  const hDealerHeadShowroom = await render("/dashboard/6KR6834", {
    cookie: cookieFor("J-YE9"),
  });
  assert.equal(hDealerHeadShowroom.status, 200);
  const hDealerHeadHtml = await hDealerHeadShowroom.text();
  assert.match(hDealerHeadHtml, /aria-controls="showroom-switcher"/);
  assert.doesNotMatch(hDealerHeadHtml, /identity-profile--static/);

  const hDealerHeadCrossDealer = await render("/dashboard/6KR6828", {
    cookie: cookieFor("J-YE9"),
  });
  assert.equal(hDealerHeadCrossDealer.status, 307);
  assert.equal(
    hDealerHeadCrossDealer.headers.get("location"),
    "http://localhost/dashboard/6KR6834",
  );

  const masterCrossDealer = await render("/dashboard/6KR6828", {
    cookie: cookieFor("VCK-ES90"),
  });
  assert.equal(masterCrossDealer.status, 200);

  const [hanamManagerResponse, hanamMasterResponse] = await Promise.all([
    render("/dashboard/6KR6861", { cookie: cookieFor("H-KIM21") }),
    render("/dashboard/6KR6861", { cookie: cookieFor("VCK-ES90") }),
  ]);
  assert.equal(hanamManagerResponse.status, 200);
  assert.equal(hanamMasterResponse.status, 200);
  const [hanamManagerHtml, hanamMasterHtml] = await Promise.all([
    hanamManagerResponse.text(),
    hanamMasterResponse.text(),
  ]);
  const cxMaximum =
    /CX Index[\s\S]*?<small class="metric-max-note">\/\s*(?:<!-- -->)?320(?:<!-- -->)?점 만점<\/small>/;
  assert.match(hanamManagerHtml, cxMaximum);
  assert.match(hanamMasterHtml, cxMaximum);
  assert.doesNotMatch(
    hanamManagerHtml,
    /CX Index[\s\S]*?\/\s*(?:<!-- -->)?120(?:<!-- -->)?점 만점/,
  );
  assert.doesNotMatch(
    hanamMasterHtml,
    /CX Index[\s\S]*?\/\s*(?:<!-- -->)?120(?:<!-- -->)?점 만점/,
  );
});

test("keeps the CX Index maximum at 320 for every authorized login", async () => {
  const [loginAccess, showroomData] = await Promise.all([
    readFile(new URL("../app/data/login-access.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/data/showrooms.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const cxMaximum =
    /CX Index[\s\S]*?<small class="metric-max-note">\/\s*(?:<!-- -->)?320(?:<!-- -->)?점 만점<\/small>/;

  assert.equal(showroomData.showrooms.length, 39);
  for (const showroom of showroomData.showrooms) {
    const response = await render(`/dashboard/${showroom.cdsid}`, {
      cookie: cookieFor("VCK-ES90"),
    });
    assert.equal(response.status, 200, `${showroom.cdsid} 관리자 접근`);
    assert.match(await response.text(), cxMaximum, `${showroom.cdsid} CX Index 320점 만점`);
  }

  for (const account of loginAccess.accounts) {
    const response = await render(`/dashboard/${account.dashboardCdsid}`, {
      cookie: cookieFor(account.cdsid),
    });
    assert.equal(response.status, 200, `${account.cdsid} 대시보드 접근`);
    const html = await response.text();
    assert.match(html, cxMaximum, `${account.cdsid} CX Index 320점 만점`);
    assert.doesNotMatch(
      html,
      /CX Index[\s\S]*?\/\s*(?:<!-- -->)?120(?:<!-- -->)?점 만점/,
      `${account.cdsid} CX Index 120점 오표기 방지`,
    );
  }
});

test("keeps fixed DSC benchmarks across all 39 showrooms and authorized logins", async () => {
  const [loginAccess, showroomData] = await Promise.all([
    readFile(new URL("../app/data/login-access.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/data/showrooms.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.equal(showroomData.showrooms.length, 39);

  const assertFixedDscScores = async (dashboardCdsid, loginCdsid) => {
    const response = await render(`/dashboard/${dashboardCdsid}`, {
      cookie: cookieFor(loginCdsid),
    });
    assert.equal(response.status, 200, `${dashboardCdsid} 대시보드 접근`);
    const html = (await response.text()).replaceAll("<!-- -->", "");

    assert.match(
      html,
      /V3S[\s\S]*?aria-label="DSC 스코어 및 RTC 인센티브율"[\s\S]*?DSC 스코어\s*<strong>100점<\/strong>/,
      `${dashboardCdsid} V3S DSC 100점`,
    );
    assert.match(
      html,
      /VOC[\s\S]*?aria-label="DSC 스코어 및 RTC 인센티브율"[\s\S]*?DSC 스코어\s*<strong>100점<\/strong>/,
      `${dashboardCdsid} VOC DSC 100점`,
    );
    assert.match(
      html,
      /CX Index[\s\S]*?aria-label="DSC 스코어 및 RTC 인센티브율"[\s\S]*?DSC 스코어\s*<strong>130점<\/strong>/,
      `${dashboardCdsid} CX DSC 130점`,
    );
    assert.match(
      html,
      /통합 경쟁력 지수[\s\S]*?class="metric-stat-chips scoreboard-stat-chips"[\s\S]*?DSC 스코어\s*<strong>330점<\/strong>/,
      `${dashboardCdsid} 통합 DSC 330점`,
    );
  };

  for (const showroom of showroomData.showrooms) {
    await assertFixedDscScores(showroom.cdsid, "VCK-ES90");
  }
  for (const account of loginAccess.accounts) {
    await assertFixedDscScores(account.dashboardCdsid, account.cdsid);
  }
});

test("uses the blue exceptional state only from ten points above average", async () => {
  const dashboardSource = await readFile(
    new URL("../app/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(
    dashboardSource,
    /if \(delta >= 10\) return \{ label: "대단해요", tone: "great", delta \};/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /if \(delta >= 5\) return \{ label: "대단해요"/,
  );
  assert.match(
    css,
    /\.signal-pill\.great\s*\{[^}]*background: var\(--blue-soft\);[^}]*color: var\(--blue\);/,
  );
  assert.match(
    css,
    /\.metric-card\.great \.metric-track span\s*\{[^}]*linear-gradient\(90deg, #285f7d 0%, var\(--blue\) 68%, #6fa8c2 100%\)/,
  );
});

test("ships the blue-row manager allowlist and administrator accounts", async () => {
  const loginAccess = JSON.parse(
    await readFile(new URL("../app/data/login-access.json", import.meta.url), "utf8"),
  );
  assert.equal(loginAccess.accounts.length, 47);
  assert.equal(new Set(loginAccess.accounts.map((account) => account.cdsid)).size, 47);
  assert.equal(loginAccess.countedCdsids.length, 46);
  assert.equal(new Set(loginAccess.countedCdsids).size, 46);
  assert.deepEqual(
    new Set(loginAccess.countedCdsids),
    new Set(
      loginAccess.accounts
        .map((account) => account.cdsid)
        .filter((cdsid) => cdsid !== "VCK-ES90"),
    ),
  );
  assert.ok(loginAccess.countedCdsids.includes("S-YUN7"));
  assert.ok(!loginAccess.countedCdsids.includes("VCK-ES90"));
  assert.deepEqual(loginAccess.masterCdsids, ["VCK-ES90"]);
  assert.deepEqual(
    loginAccess.dealerHeadAccounts,
    [
      { cdsid: "Y-HAN30", dealer: "아주" },
      { cdsid: "J-JANG2", dealer: "천하" },
      { cdsid: "J-YE9", dealer: "에이치" },
      { cdsid: "H-SHIN", dealer: "아이언" },
      { cdsid: "Y-SON", dealer: "아이비" },
      { cdsid: "H-CHOI4", dealer: "코오롱" },
      { cdsid: "S-KIM122", dealer: "태영" },
    ],
  );
  assert.deepEqual(
    Object.fromEntries(
      loginAccess.dealerHeadAccounts.map(({ cdsid, dealer }) => [
        dealer,
        loginAccess.accounts.find((account) => account.cdsid === cdsid)
          ?.dashboardCdsid,
      ]),
    ),
    {
      아주: "6KR6845",
      천하: "6KR6841",
      에이치: "6KR6834",
      아이언: "6KR6842",
      아이비: "6KR6828",
      코오롱: "6KR6847",
      태영: "6KR6865",
    },
  );
  assert.deepEqual(
    loginAccess.accounts.find((account) => account.cdsid === "K-KIM16"),
    { cdsid: "K-KIM16", dashboardCdsid: "6KR6834" },
  );
  assert.deepEqual(
    loginAccess.accounts.find((account) => account.cdsid === "VCK-ES90"),
    { cdsid: "VCK-ES90", dashboardCdsid: "6KR6834" },
  );
  assert.deepEqual(
    loginAccess.accounts.find((account) => account.cdsid === "S-YUN7"),
    { cdsid: "S-YUN7", dashboardCdsid: "6KR6834" },
  );
});

test("counts only manager logins through privacy-safe Supabase and D1 sync", async () => {
  const [loginRoute, loginStats, statsRoute, pageSource, loginSource, schema, migration] =
    await Promise.all([
      readFile(new URL("../app/api/login/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/login-stats.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/login-stats/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/LoginHome.tsx", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../supabase/volvo-dashboard-login-stats.sql", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(loginRoute, /countedCdsids\.has\(cdsid\)[\s\S]*?recordLoginVisit\(cdsid\)/);
  assert.match(loginStats, /LOGIN_STATS_HASH_SALT/);
  assert.match(loginStats, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(loginStats, /record_volvo_dashboard_visit/);
  assert.match(loginStats, /get_volvo_dashboard_visit_stats/);
  assert.match(loginStats, /dashboard_login_visitors/);
  assert.match(statsRoute, /Cache-Control/);
  assert.match(pageSource, /getLoginStats\(\)/);
  assert.match(loginSource, /\/api\/login-stats\?t=/);
  assert.match(schema, /dashboardLoginVisitors/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /timezone\('Asia\/Seoul'/);
  assert.doesNotMatch(migration, /\bcdsid\s+text/i);
});

test("accepts manager and administrator logins while rejecting other CDSIDs", async () => {
  for (const cdsid of ["K-KIM16", "vck-es90", "s-yun7"]) {
    const response = await login(cdsid);
    assert.equal(response.status, 200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /volvo-dashboard-access=/);
    assert.match(setCookie, new RegExp(`--${cdsid.toUpperCase()}`));
    assert.doesNotMatch(setCookie, /Max-Age=/i);
    assert.deepEqual(await response.json(), {
      redirectPath: "/dashboard/6KR6834",
    });
  }

  for (const [cdsid, dashboardCdsid] of Object.entries({
    "H-CHOI4": "6KR6847",
    "Y-HAN30": "6KR6845",
    "H-SHIN": "6KR6842",
    "Y-SON": "6KR6828",
    "S-KIM122": "6KR6865",
    "J-JANG2": "6KR6841",
    "J-YE9": "6KR6834",
  })) {
    const response = await login(cdsid);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      redirectPath: `/dashboard/${dashboardCdsid}`,
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
    /class="(?:national|actual)-point-value"[^>]*>320<\/text>/,
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
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const dashboardSource = await readFile(
    new URL("../app/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const seoulToday = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
  })
    .format(new Date())
    .replaceAll("-", ".");
  const compactSeoulToday = seoulToday.replaceAll(".", "").slice(-6);
  assert.match(
    visibleHtml,
    /class="voc-response-rate-axis middle">20%<\/span>/,
  );
  assert.match(css, /\.voc-response-rate-axis\.middle\s*\{\s*top:\s*48px/);
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
    /class="identity-title"><h1>볼보 강남대치(?:<!-- -->)? 현황<\/h1><div class="header-status-row"/,
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
  assert.match(visibleHtml, /DSC 가이드/);
  const identityHeaderHtml =
    visibleHtml.match(/<section class="dashboard-identity-header[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.doesNotMatch(
    identityHeaderHtml,
    new RegExp(`${compactSeoulToday}[\\s\\S]*?기준`),
  );
  assert.doesNotMatch(visibleHtml, /Q1 \/ Q2 마감/);
  assert.doesNotMatch(visibleHtml, /Q3 평가·집계중/);
  assert.match(
    visibleHtml,
    /DSC 가이드[\s\S]*?class="dashboard-logout-form" action="\/api\/logout" method="post"[\s\S]*?로그아웃/,
  );
  assert.match(visibleHtml, /aria-haspopup="dialog" aria-expanded="false"/);
  assert.match(visibleHtml, /class="dashboard-logout-icon" aria-hidden="true"/);
  const dashboardCss = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(
    dashboardCss,
    /\.header-status-row\s*\{[^}]*--header-status-item-width: 100px[^}]*width: max-content[^}]*display: grid[^}]*grid-template-columns: repeat\(2, var\(--header-status-item-width\)\)[^}]*gap: 5px/,
  );
  assert.match(
    dashboardCss,
    /\.header-status-row \.dashboard-logout-form\s*\{[^}]*margin: 0/,
  );
  assert.match(
    dashboardCss,
    /\.dashboard-identity-header > \.identity-title:not\(\.analysis-title\)\s*\{[^}]*flex: 1 1 auto;[^}]*flex-direction: row;[^}]*align-items: flex-end;[^}]*gap: 18px;[\s\S]*?\.dashboard-identity-header \.identity-title:not\(\.analysis-title\) h1\s*\{[^}]*font-size: clamp\(56px, 4\.4vw, 64px\);[^}]*line-height: 0\.9;[\s\S]*?\.dashboard-identity-header \.identity-title:not\(\.analysis-title\) \.header-status-row\s*\{[^}]*align-self: flex-end;/,
  );
  assert.doesNotMatch(dashboardCss, /\.dashboard-logout-button::after/);
  assert.match(
    dashboardCss,
    /\.dashboard-logout-icon::before\s*\{[^}]*border: 1px solid currentColor[^}]*border-right: 0/,
  );
  assert.match(
    dashboardCss,
    /\.dashboard-logout-icon i\s*\{[^}]*border-top: 1px solid currentColor[^}]*border-right: 1px solid currentColor[^}]*rotate\(45deg\)/,
  );
  assert.match(
    dashboardCss,
    /\.appeal-badge\s*\{[^}]*align-items: center[^}]*white-space: nowrap/,
  );
  assert.match(
    dashboardCss,
    /\.appeal-badge > span\[aria-hidden="true"\]\s*\{[^}]*width: 17px[^}]*flex: 0 0 17px/,
  );
  assert.doesNotMatch(
    dashboardCss,
    /\.appeal-badge > span\s*\{[^}]*width:/,
  );
  assert.doesNotMatch(visibleHtml, /Q2 원본 데이터 반영/);
  assert.match(html, /V3S/);
  assert.match(html, /VOC/);
  assert.match(
    visibleHtml,
    /href="\/dashboard\/6KR6834\/details\/voc" class="metric-detail-link"/,
  );
  assert.match(
    visibleHtml,
    /href="\/dashboard\/6KR6834\/details\/cx" class="metric-detail-link"/,
  );
  assert.equal((visibleHtml.match(/class="metric-detail-link"/g) ?? []).length, 2);
  assert.doesNotMatch(visibleHtml, /class="voc-component-chip"/);
  assert.doesNotMatch(visibleHtml, /class="signal-icon/);
  assert.doesNotMatch(visibleHtml, /class="signal-pill/);
  assert.match(html, /CX Index/);
  assert.doesNotMatch(visibleHtml, /VOC해피콜<\/span>만 사후보정 가능/);
  assert.doesNotMatch(visibleHtml, /신차해피콜<\/span>만 사후보정 가능/);
  assert.doesNotMatch(visibleHtml, /VOC해피콜<\/span>만 교차검증 후/);
  assert.doesNotMatch(visibleHtml, /신차해피콜<\/span>만 교차검증 후/);
  assert.doesNotMatch(visibleHtml, /교차검증 후, 사후보정 가능/);
  assert.equal((visibleHtml.match(/<strong>평가완료<\/strong>/g) ?? []).length, 4);
  assert.doesNotMatch(visibleHtml, /검증완료/);
  assert.equal((html.match(/metric-quarter-strip--status/g) ?? []).length, 2);
  assert.doesNotMatch(visibleHtml, /사후 보정 가능/);
  assert.doesNotMatch(visibleHtml, /일부 평가 불가/);
  assert.equal(
    (visibleHtml.match(/<small class="metric-max-note">\/ 100점 만점<\/small>/g) ?? []).length,
    2,
  );
  assert.equal(
    (visibleHtml.match(/<small class="metric-max-note">\/ 320점 만점<\/small>/g) ?? []).length,
    1,
  );
  assert.match(
    dashboardCss,
    /\.combat-scoreboard \.scoreboard-heading \.metric-max-note\s*\{[^}]*color: #ffffff;/,
  );
  assert.equal((html.match(/class="metric-quarter-strip(?: |")/g) ?? []).length, 4);
  assert.equal((html.match(/class="metric-resource-button/g) ?? []).length, 8);
  assert.equal((html.match(/class="metric-resource-pdf"/g) ?? []).length, 4);
  assert.equal((html.match(/class="metric-resource-photo"/g) ?? []).length, 4);
  assert.equal(
    (html.match(/상세 영역으로 이동/g) ?? []).length,
    9,
  );
  assert.equal((html.match(/평가 미완료/g) ?? []).length, 3);
  assert.equal(
    (visibleHtml.match(/class="metric-benchmark-quarter">Q[23]<\/span>/g) ?? [])
      .length,
    3,
  );
  assert.equal(
    (visibleHtml.match(/class="metric-benchmark-average">[\d.]+점<\/span>/g) ?? [])
      .length,
    4,
  );
  assert.match(
    dashboardCss,
    /\.metric-benchmark > span\s*\{[^}]*font-size: 12px;/,
  );
  assert.match(
    dashboardCss,
    /\.metric-benchmark::before\s*\{[^}]*content: "";[^}]*flex: 1 1 auto;[^}]*height: 1px;[^}]*background: rgba\(101, 130, 143, 0\.28\);/,
  );
  assert.match(
    dashboardCss,
    /\.metric-benchmark-average\s*\{[^}]*color: #0d5e7a;[^}]*font-size: 11px;[^}]*font-weight: 800;/,
  );
  assert.match(
    dashboardCss,
    /\.metric-benchmark-quarter\s*\{[^}]*font-family: var\(--font-latin\);[^}]*font-weight: 600;/,
  );
  const v3sQuarterStrip = html.match(
    /class="metric-quarter-strip metric-quarter-strip--resources" aria-label="V3S[^>]*>([\s\S]*?)<\/div>/,
  );
  assert.ok(v3sQuarterStrip);
  assert.doesNotMatch(v3sQuarterStrip[1], /<strong/);
  const statusQuarterStrips = [
    ...html.matchAll(
      /class="metric-quarter-strip metric-quarter-strip--status"[^>]*>([\s\S]*?)<\/div>/g,
    ),
  ];
  assert.equal(statusQuarterStrips.length, 2);
  statusQuarterStrips.forEach(([, strip]) => assert.match(strip, /<strong/));
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
    /class="metric-benchmark"[\s\S]*?<strong class="positive good">▲ 3\.0점<\/strong>/,
  );
  assert.match(
    directionalVisibleHtml,
    /class="metric-benchmark"[\s\S]*?<strong class="positive great">▲ 71\.7점<\/strong>/,
  );
  assert.match(
    directionalVisibleHtml,
    /class="metric-benchmark"[\s\S]*?<strong class="negative warning">▼ 158\.7점<\/strong>/,
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
  assert.equal(
    (html.match(/aria-label="Q[12] 통합 경쟁력 지수 전체 39개 중 \d+위 지표 보기"/g) ?? [])
      .length,
    2,
  );
  assert.match(
    visibleHtml,
    /aria-label="분기별 통합 경쟁력 지수 520점 기준"/,
  );
  assert.match(visibleHtml, /통합 경쟁력 지수/);
  assert.doesNotMatch(visibleHtml, /상반기 누적 평균/);
  assert.doesNotMatch(
    visibleHtml,
    /분기 점수를 선택하면 하단 지표가 함께 변경됩니다/,
  );
  assert.match(visibleHtml, /Q1[\s\S]*14위/);
  assert.match(visibleHtml, /Q2[\s\S]*32위/);
  assert.match(visibleHtml, /Q3[\s\S]*평가 중[\s\S]*Q4[\s\S]*평가 전/);
  assert.doesNotMatch(visibleHtml, /Q2 종합 점수/);
  assert.match(visibleHtml, /통합 경쟁력 지수[\s\S]*\(520점 만점\)[\s\S]*412\.4/);
  assert.doesNotMatch(visibleHtml, /Q1·Q2 평가 기준/);
  assert.equal((html.match(/aria-label="Q[12] 통합 경쟁력 지수 전체 39개 중 \d+위 지표 보기"/g) ?? []).length, 2);
  assert.equal(
    (html.match(/aria-label="DSC 스코어 및 RTC 인센티브율"/g) ?? []).length,
    4,
  );
  assert.equal((html.match(/class="metric-rank-note" aria-label="전체 39개 전시장 중 \d+위"/g) ?? []).length, 4);
  assert.match(
    visibleHtml,
    /CX Index[\s\S]*?220\.0[\s\S]*?\/ 전체[\s\S]*?2위[\s\S]*?\/ 39/,
  );
  assert.equal((html.match(/class="metric-stat-chips(?: |")/g) ?? []).length, 4);
  assert.match(visibleHtml, /DSC 스코어[\s\S]*100점/);
  assert.match(visibleHtml, /DSC 스코어[\s\S]*330점/);
  assert.match(visibleHtml, /RTC 인센티브[\s\S]*0\.6%/);
  assert.match(visibleHtml, /RTC 인센티브[\s\S]*0\.2%/);
  assert.match(
    dashboardSource,
    /className=\{`rtc-chip \$\{rtcRate < 0\.2 \? "has-alert" : ""\}`\}[\s\S]*?<RtcAlertSiren rate=\{rtcRate\}/,
  );
  assert.match(
    dashboardSource,
    /function RtcAlertSiren[\s\S]*?RTC 인센티브 \$\{displayNumber\(rate\)\}% 경고/,
  );
  assert.match(
    css,
    /\.rtc-alert-siren\s*\{[^}]*top: -10px;[^}]*right: -9px;[\s\S]*?\.rtc-alert-siren__dome[\s\S]*?linear-gradient\(145deg, #ff8b69 0%, #e14835 54%, #a92227 100%\)/,
  );
  assert.match(
    css,
    /\.rtc-alert-siren::after\s*\{[^}]*width: 27px;[^}]*height: 27px;[^}]*conic-gradient\([^}]*animation: rtc-siren-beacon 1\.55s ease-in-out infinite;/,
  );
  assert.match(
    css,
    /\.rtc-alert-siren__dome\s*\{[^}]*animation: rtc-siren-dome-pulse 1\.55s ease-in-out infinite;/,
  );
  assert.match(css, /@keyframes rtc-siren-beacon\s*\{/);
  assert.match(css, /@keyframes rtc-siren-dome-pulse\s*\{/);
  assert.equal((html.match(/aria-label="Q3 평가 중"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-label="Q4 평가 전"/g) ?? []).length, 1);
  assert.match(
    visibleHtml,
    /class="metric-benchmark scoreboard-benchmark">[\s\S]*?Q2 볼보 평균 <span class="metric-benchmark-average">392\.4점<\/span> 대비[\s\S]*?▲ 20\.0점/,
  );
  assert.match(visibleHtml, /전체[\s\S]*\d+위[\s\S]*39/);
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
  assert.match(visibleHtml, />강남대치<\/button>/);
  assert.match(visibleHtml, />전국 평균<\/button>/);
  assert.doesNotMatch(visibleHtml, />주간 전국 평균<\/button>/);
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
  assert.equal((html.match(/class="metric-detail-link"/g) ?? []).length, 2);
  assert.match(
    css,
    /\.score-tier-heading \.metric-detail-link\s*\{[^}]*display: inline-flex;[^}]*border: 1px solid rgba\(80, 109, 128, 0\.24\);/,
  );
  assert.match(
    visibleHtml,
    /aria-label="CX Index 세부지표 W01부터 W52까지 보기"/,
  );
  assert.doesNotMatch(visibleHtml, /class="cx-component-chip"/);
  assert.doesNotMatch(html, /<h3>분기 평가<\/h3>/);
  assert.doesNotMatch(visibleHtml, /분기 평가 흐름/);
  assert.match(
    visibleHtml,
    /<span class="english-title">5<\/span>개년 추이/,
  );
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
  assert.match(
    visibleHtml,
    /전국 평균[\s\S]*?강남대치[\s\S]*?강남대치 회신율/,
  );
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
  assert.equal((html.match(/class="trend-wrap [^"]*compact"/g) ?? []).length, 2);
  assert.equal((html.match(/class="weekly-score-layout"/g) ?? []).length, 2);
  assert.match(
    html,
    /aria-label="볼보 강남대치 상담 만족도 4개년 비교"/,
  );
  assert.match(
    visibleHtml,
    /상담 만족도[\s\S]*?class="comparison-name">강남대치<\/span>[\s\S]*?class="comparison-value">[\d.]+점<\/span>[\s\S]*?class="comparison-name">전국<\/span>[\s\S]*?[▲▼±][\d.]+점/,
  );
  assert.match(
    visibleHtml,
    /회신율[\s\S]*?class="comparison-name">강남대치<\/span>[\s\S]*?class="comparison-value">[\d.]+%<\/span>[\s\S]*?class="comparison-name">전국<\/span>[\s\S]*?[▲▼±][\d.]+%p/,
  );
  assert.match(
    html,
    /class="voc-response-rate-line-layer"[\s\S]*?<polyline points="[^"]+"[\s\S]*?class="voc-response-rate-point/,
  );
  assert.doesNotMatch(html, /class="voc-response-rate-panel"/);
  assert.match(html, /aria-label="ONE Voice 만족도"/);
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
  assert.equal(actualMarkerWeeks.length, 34);
  assert.deepEqual(
    actualMarkerWeeks,
    Array.from({ length: 34 }, (_, index) =>
      `W${String(index + 1).padStart(2, "0")}`,
    ),
  );
  const actualLabelCount = (vocHtml.match(/class="actual-point-value"/g) ?? []).length;
  assert.equal(actualLabelCount, 34);
  assert.equal((vocHtml.match(/class="national-point-value"/g) ?? []).length, 34);
  assert.match(vocHtml, /aria-label="W01부터 시작하는 52주 성과 그래프"/);
  assert.match(vocHtml, /class="future-window"/);
  assert.match(
    dashboardSource,
    /const futureWindowCenterY = chartY\(18 \+ 152 \/ 2\)/,
  );
  assert.equal(
    (dashboardSource.match(/y=\{futureWindowCenterY\}[\s\S]{0,100}?dominantBaseline="middle"/g) ?? [])
      .length,
    2,
  );
  assert.match(visibleHtml, /Q3 평가 중/);
  assert.match(vocHtml, /class="future-window future-window-upcoming"/);
  assert.match(visibleHtml, /Q4 평가 전/);
  assert.doesNotMatch(visibleHtml, /데이터 집계 후 자동 반영됩니다\./);
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
  assert.doesNotMatch(html, /위험해요: Q3 전국 평균 대비 5점 이상 미달/);
  assert.doesNotMatch(visibleHtml, /위험해요/);
  assert.doesNotMatch(html, /힘내세요: Q2 전국 평균 미만, 5점 미만 차이/);
  assert.equal((visibleHtml.match(/>힘내세요<\/span>/g) ?? []).length, 0);
  assert.match(
    visibleHtml,
    /Q3<\/span> 볼보 평균 <span class="metric-benchmark-average">28\.3점<\/span> 대비[\s\S]*?▲ 70\.7점/,
  );
  assert.match(visibleHtml, /Q1/);
  assert.match(visibleHtml, /Q4/);
  assert.doesNotMatch(visibleHtml, /보정 검토 센터|ACTION CENTER|Outlook으로 보정 요청/);
  assert.doesNotMatch(visibleHtml, /전국 평균 미달 지표 [0-9]+개 감지|주간 흐름 확인/);
  assert.doesNotMatch(visibleHtml, /EDIT 권한|PRIVATE · 관리자 전용/);
  assert.doesNotMatch(visibleHtml, /MY SHOWROOM|전시장의 현재 위상/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("renders the simplified VOC and CX weekly detail pages", async () => {
  const detailCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const vocResponse = await render("/dashboard/6KR6834/details/voc");
  assert.equal(vocResponse.status, 200);
  const vocHtml = (await vocResponse.text()).replaceAll("<!-- -->", "");
  const vocBody = vocHtml.match(/<body>([\s\S]*?)<script/)?.[1] ?? vocHtml;
  assert.match(vocBody, /<h1>볼보 강남대치 세부지표<\/h1>/);
  assert.doesNotMatch(vocBody, />DATA DASHBOARD DETAIL</);
  assert.doesNotMatch(vocBody, /원본 구글시트에서 동기화한 W1~W52 전시장값/);
  for (const label of ["종합만족도", "첫인사", "태블릿", "해피콜", "발송건수"]) {
    assert.match(
      vocBody,
      new RegExp(`metric-detail-source-title">VOC<\\/span> ${label}`),
    );
  }
  assert.match(
    vocBody,
    /metric-detail-source-title">VOC<\/span> 종합만족도[\s\S]*?100점 만점[\s\S]*?60% 반영\(DSC 60점 반영\)/,
  );
  for (const label of ["VOC 첫인사", "VOC 태블릿", "VOC 해피콜"]) {
    assert.match(
      vocBody,
      new RegExp(`${label.replace("VOC ", "")}[\\s\\S]*?100점 만점[\\s\\S]*?10% 반영\\(DSC 10점\\)`),
    );
  }
  assert.match(
    vocBody,
    /metric-detail-source-title">VOC<\/span> 해피콜[\s\S]*?VCK 평가[\s\S]*?class="appealable"[\s\S]*?metric-detail-appeal-icon[\s\S]*?소명가능/,
  );
  assert.match(
    vocBody,
    /VOC <small>4개 메인지표 \/ 총점 100점\(DSC 100점\) \+ 1개 참고지표<\/small>/,
  );
  assert.match(
    vocBody,
    /CX Index <small>5개 메인지표 \/ 총점 320점\(DSC 130점\)<\/small>/,
  );
  assert.match(vocBody, /건 기준/);
  assert.doesNotMatch(vocBody, /DSC 44건/);
  assert.equal((vocBody.match(/VCK 평가/g) ?? []).length, 5);
  assert.equal((vocBody.match(/metric-detail-evaluation-icon/g) ?? []).length, 5);
  assert.equal((vocBody.match(/100점 만점/g) ?? []).length, 4);
  assert.equal((vocBody.match(/class="metric-detail-max-inline"/g) ?? []).length, 5);
  assert.equal((vocBody.match(/class="metric-detail-week-label"/g) ?? []).length, 260);
  assert.match(vocBody, />W1<\/text>/);
  assert.match(vocBody, />W52<\/text>/);
  assert.match(vocBody, /class="metric-detail-score-label"/);
  assert.match(vocBody, /class="metric-detail-score-label"[^>]*y="14"[^>]*>100<\/text>/);
  assert.match(vocBody, /class="metric-detail-update-guide-layer" role="note" aria-label="현재 업데이트 기준 W34"/);
  assert.match(vocBody, /class="metric-detail-update-guide" style="left:64\.45[^"]*%"/);
  assert.match(vocBody, /<span>업데이트<\/span>/);
  assert.doesNotMatch(vocBody, /metric-detail-complete-(?:marker|check|arrow)/);
  assert.doesNotMatch(vocBody, /class="metric-detail-national-line"/);
  assert.doesNotMatch(vocBody, /W01~W52 원본값 보기/);
  assert.doesNotMatch(vocBody, /class="metric-detail-current"/);
  assert.doesNotMatch(vocBody, /최신값/);
  assert.doesNotMatch(vocBody, />WEEKLY<|>QUARTERLY</);
  assert.equal((vocBody.match(/viewBox="0 0 1440 104"/g) ?? []).length, 5);
  assert.equal((vocBody.match(/preserveAspectRatio="xMidYMid meet"/g) ?? []).length, 5);
  assert.equal((vocBody.match(/class="metric-detail-quarter-label"/g) ?? []).length, 20);
  assert.equal((vocBody.match(/class="metric-detail-week-guide(?: major)?"/g) ?? []).length, 265);
  assert.equal((vocBody.match(/class="metric-detail-quarter-boundary"/g) ?? []).length, 25);
  assert.equal((vocBody.match(/class="metric-detail-quarter-boundary"[^>]*y2="103"/g) ?? []).length, 25);
  assert.equal((vocBody.match(/class="metric-detail-showroom-line"/g) ?? []).length, 5);
  assert.equal((vocBody.match(/class="metric-detail-score-label"/g) ?? []).length, 170);
  assert.ok((vocBody.match(/class="metric-detail-score-label"[^>]*>0<\/text>/g) ?? []).length > 0);
  assert.equal((vocBody.match(/class="metric-detail-update-guide-layer"/g) ?? []).length, 1);
  assert.match(vocBody, /class="metric-detail-list metric-detail-list--voc"/);
  assert.match(
    vocBody,
    /class="metric-detail-sticky-shell">[\s\S]*?class="dashboard-identity-header identity-strip metric-detail-page-header"[\s\S]*?class="identity-title metric-detail-header-primary"[\s\S]*?class="identity-detail-rail metric-detail-header-context"[\s\S]*?class="metric-detail-tabs"/,
  );
  assert.match(
    vocBody,
    /href="\/dashboard\/6KR6834"[\s\S]*?viewBox="0 0 24 24"[\s\S]*?d="M4 19V9m5 10V5m5 14v-7m5 7V3"[\s\S]*?대시보드/,
  );
  assert.doesNotMatch(vocBody, /현황으로/);
  assert.match(vocBody, /class="identity-profile-role">업데이트<\/span><strong>\d{6}<\/strong>/);
  assert.doesNotMatch(vocBody, /<dt>기준<\/dt>/);
  assert.equal((vocBody.match(/class="identity-analysis-entry"/g) ?? []).length, 3);
  assert.equal((vocBody.match(/class="metric-detail-context-icon"/g) ?? []).length, 4);
  assert.match(
    vocBody,
    /metric-detail-context-icon-box metric[\s\S]*?metric-detail-context-icon-box showroom[\s\S]*?metric-detail-context-icon-box week[\s\S]*?metric-detail-context-icon-box update/,
  );

  const cxResponse = await render("/dashboard/6KR6834/details/cx");
  assert.equal(cxResponse.status, 200);
  const cxHtml = (await cxResponse.text()).replaceAll("<!-- -->", "");
  const cxBody = cxHtml.match(/<body>([\s\S]*?)<script/)?.[1] ?? cxHtml;
  assert.match(cxBody, /<h1>볼보 강남대치 세부지표<\/h1>/);
  for (const label of [
    "신차출고 만족도",
    "시승 만족도",
    "긴급경보 처리여부",
    "조치 계획",
  ]) {
    assert.match(
      cxBody,
      new RegExp(`metric-detail-source-title">ONE Voice<\\/span> ${label}`),
    );
  }
  assert.match(
    cxBody,
    /metric-detail-source-title">Sales-DMS<\/span> 헤이볼보 앱 가입율/,
  );
  assert.doesNotMatch(cxBody, /CX INDEX/);
  assert.equal((cxBody.match(/class="metric-detail-max-inline"/g) ?? []).length, 5);
  assert.equal((cxBody.match(/글로벌 평가/g) ?? []).length, 4);
  assert.equal((cxBody.match(/VCK 평가/g) ?? []).length, 1);
  assert.match(
    cxBody,
    /metric-detail-source-title">ONE Voice<\/span> 신차출고 만족도<\/span><i[^>]*>\/<\/i><small class="metric-detail-max-inline">100점 만점<\/small><i[^>]*>\/<\/i><small class="metric-detail-weight-inline">90점 이상 시, DSC 40점 반영<\/small><i[^>]*>\/<\/i><em class="global">/,
  );
  assert.match(
    cxBody,
    /metric-detail-source-title">Sales-DMS<\/span> 헤이볼보 앱 가입율<\/span><i[^>]*>\/<\/i><small class="metric-detail-max-inline">100점 만점<\/small><i[^>]*>\/<\/i><small class="metric-detail-weight-inline">가입율 90%\(점\) 이상 시, DSC 20점 반영<\/small><i[^>]*>\/<\/i><em class="vck">[\s\S]*?VCK 평가/,
  );
  for (const label of [
    "90점 이상 시, DSC 50점 반영",
    "미발생 혹은 2일 이내 조치 시, DSC 10점 반영",
    "기한 내 제출 시, DSC 10점 반영",
  ]) {
    assert.match(cxBody, new RegExp(label));
  }
  assert.equal((cxBody.match(/class="metric-detail-week-label"/g) ?? []).length, 260);
  assert.doesNotMatch(cxBody, /class="metric-detail-national-line"/);
  assert.doesNotMatch(cxBody, /W01~W52 원본값 보기/);
  assert.doesNotMatch(cxBody, /class="metric-detail-current"/);
  assert.doesNotMatch(cxBody, /최신값/);
  assert.doesNotMatch(cxBody, />WEEKLY<|>QUARTERLY</);
  assert.equal((cxBody.match(/viewBox="0 0 1440 104"/g) ?? []).length, 5);
  assert.equal((cxBody.match(/preserveAspectRatio="xMidYMid meet"/g) ?? []).length, 5);
  assert.equal((cxBody.match(/class="metric-detail-quarter-label"/g) ?? []).length, 20);
  assert.equal((cxBody.match(/class="metric-detail-week-guide(?: major)?"/g) ?? []).length, 265);
  assert.equal((cxBody.match(/class="metric-detail-quarter-boundary"/g) ?? []).length, 25);
  assert.equal((cxBody.match(/class="metric-detail-quarter-boundary"[^>]*y2="103"/g) ?? []).length, 25);
  assert.equal((cxBody.match(/class="metric-detail-series-reveal"/g) ?? []).length, 5);
  assert.equal((cxBody.match(/class="metric-detail-data-series"/g) ?? []).length, 5);
  assert.equal((cxBody.match(/class="metric-detail-update-guide-layer"/g) ?? []).length, 1);
  assert.match(cxBody, /aria-label="현재 업데이트 기준 W30"/);
  assert.match(cxBody, /class="metric-detail-update-guide" style="left:57\.19[^"]*%"/);
  assert.match(
    cxBody,
    /조치 계획[\s\S]*?class="metric-detail-latest-point" cx="823\.5384615384615"/,
  );
  assert.doesNotMatch(
    cxBody,
    /조치 계획[\s\S]*?class="metric-detail-latest-point" cx="1045\.8461538461538"/,
  );
  assert.doesNotMatch(cxBody, /metric-detail-complete-(?:marker|check|arrow)/);
  assert.match(cxBody, /class="metric-detail-list metric-detail-list--cx"/);
  assert.match(
    detailCss,
    /\.metric-detail-card\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);[^}]*padding:\s*5px 8px 4px;[^}]*overflow:\s*hidden;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-list--voc\s*\{[^}]*grid-template-rows:\s*repeat\(5, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-list--cx\s*\{[^}]*grid-template-rows:\s*repeat\(5, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-chart\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*height:\s*100%;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-tabs a small\s*\{[^}]*color:\s*inherit;[^}]*font-size:\s*inherit;[^}]*font-weight:\s*inherit;[^}]*line-height:\s*inherit;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-card h2 > em\s*\{[^}]*font-family:\s*var\(--font-latin\), var\(--font-korean\);/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-source-title\s*\{[^}]*font-family:\s*var\(--font-volvo\), var\(--font-latin\), sans-serif;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-series-reveal\s*\{[^}]*transform:\s*scaleX\(0\);[^}]*transform-box:\s*fill-box;[^}]*animation:\s*metric-detail-series-wipe 5\.2s cubic-bezier\(0\.16, 0\.72, 0\.18, 1\) both;/,
  );
  assert.match(
    detailCss,
    /@keyframes metric-detail-series-wipe\s*\{[\s\S]*?transform:\s*scaleX\(1\);/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-update-guide-layer\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0 19px;[^}]*pointer-events:\s*none;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-update-guide\s*\{[^}]*top:\s*0;[^}]*bottom:\s*0;[^}]*width:\s*1px;[^}]*transform:\s*translateX\(-50%\);[^}]*background:\s*repeating-linear-gradient\(/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-update-guide > span\s*\{[^}]*animation:\s*metric-detail-update-pulse 1\.8s ease-in-out infinite;/,
  );
  assert.match(
    detailCss,
    /\.header-status-row \.header-status-item:active\s*\{[^}]*border-color:\s*rgba\(139, 197, 223, 0\.78\);[^}]*background:\s*rgba\(54, 142, 184, 0\.46\);/,
  );
  assert.match(
    detailCss,
    /@keyframes metric-detail-update-pulse\s*\{[\s\S]*?opacity:\s*0\.58;[\s\S]*?opacity:\s*1;/,
  );
  assert.doesNotMatch(detailCss, /metric-detail-complete-(?:marker|check|arrow|drop)/);
  assert.match(
    detailCss,
    /\.metric-detail-latest-point\s*\{[^}]*fill:\s*#f47b3f;[^}]*stroke:\s*#c65a24;/,
  );
  assert.match(
    detailCss,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.metric-detail-series-reveal\s*\{[^}]*animation:\s*none;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-chart-scroll\s*\{[^}]*padding:\s*4px 10px 6px;[^}]*overflow:\s*hidden;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-week-label\s*\{[^}]*font-size:\s*9px;[^}]*font-weight:\s*680;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-quarter-boundary\s*\{[^}]*stroke:\s*#cad8dd;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-page\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;[^}]*touch-action:\s*pan-x pan-y;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-sticky-shell\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*z-index:\s*70;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-sticky-shell\s*\{[^}]*padding:\s*0 var\(--dashboard-sticky-content-gutter\) 1px;/,
  );
  assert.match(
    detailCss,
    /\.voc-consultation-heading > div:first-child > strong,\s*\.metric-detail-card h2\s*\{[^}]*color:\s*#11283d;[^}]*font-family:\s*var\(--font-korean\);[^}]*font-size:\s*14px;[^}]*font-weight:\s*600;[^}]*line-height:\s*1\.25;[^}]*letter-spacing:\s*-0\.25px;/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-card h2 > \.metric-detail-max-inline\s*\{[^}]*font-size:\s*8px;[^}]*font-weight:\s*680;/,
  );
  assert.match(
    detailCss,
    /\.dashboard-identity-header\.metric-detail-page-header \.identity-title h1::before\s*\{[^}]*content:\s*"DATA DASHBOARD DETAIL";/,
  );
  assert.match(
    detailCss,
    /\.metric-detail-header-context \.identity-analysis-entry::after\s*\{[^}]*content:\s*none;/,
  );
});

test("shows a siren only when RTC incentive is below 0.2 percent", async () => {
  const response = await render("/dashboard/6KR6841");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /aria-label="RTC 인센티브 0\.1% 경고"/);
  assert.doesNotMatch(html, /aria-label="RTC 인센티브 0\.2% 경고"/);
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
  assert.match(visibleHtml, /반올림한 V3S 평가 총점 기준/);
});

test("shows Q1-Q4 badges and available quarter values in the analysis summary cards", async () => {
  const response = await render(
    "/dashboard/6KR6834/analysis?view=region",
  );
  assert.equal(response.status, 200);

  const visibleHtml = (await response.text()).replaceAll("<!-- -->", "");
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(
    visibleHtml,
    /class="analysis-quarter-values"[^>]*><span><b>Q1<\/b><strong>93\.1<\/strong><\/span><span><b>Q2<\/b><strong>87\.5<\/strong><\/span><span><b>Q3<\/b><\/span><span><b>Q4<\/b><\/span>/,
  );
  assert.match(
    visibleHtml,
    /class="analysis-quarter-values"[^>]*><span><b>Q1<\/b><strong>100<\/strong><\/span><span><b>Q2<\/b><strong>100<\/strong><\/span><span><b>Q3<\/b><\/span><span><b>Q4<\/b><\/span>/,
  );
  assert.match(
    visibleHtml,
    /분기별 합산점수 평균[\s\S]*?class="analysis-quarter-values"[^>]*><span><b>Q1<\/b><strong>193\.1<\/strong><\/span><span><b>Q2<\/b><strong>187\.5<\/strong><\/span><span><b>Q3<\/b><\/span><span><b>Q4<\/b><\/span>/,
  );
  assert.match(
    css,
    /\.analysis-quarter-values\s*\{[^}]*grid-column: 1;[^}]*grid-row: 2;[^}]*align-self: end;[^}]*color: var\(--muted\);[^}]*font-size: 9px;[^}]*font-weight: 500;/,
  );
  assert.match(css, /\.analysis-summary-card\.satisfaction > em,[\s\S]*?\.analysis-summary-card\.happycall > em,[\s\S]*?\.analysis-summary-card\.balance > em\s*\{[^}]*grid-column: 2;[^}]*grid-row: 2;[^}]*align-self: end;/);
});

test("serves the dual-metric competitive analysis sample", async () => {
  const response = await render(
    "/dashboard/6KR6834/analysis?view=dealer",
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  const visibleHtml = html.replaceAll("<!-- -->", "");
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const analysisSource = await readFile(
    new URL("../app/CompetitiveAnalysis.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    visibleHtml,
    /<footer><span>에이치<strong>187\.6<\/strong><\/span><span>강남대치<strong>190\.3<\/strong><\/span><span class="analysis-average-delta delta-positive">평균 대비<strong>▲ 2\.7점<\/strong><\/span><\/footer>/,
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
    /<header class="dashboard-identity-header analysis-header has-admin-entry"><div class="identity-title analysis-title"><div class="identity-heading-line"><h1>볼보 강남대치 분석<\/h1>/,
  );
  assert.match(visibleHtml, /href="\/dashboard\/6KR6834\/dealer-analysis" class="analysis-admin-entry"/);
  assert.match(visibleHtml, /<span>딜러사별<\/span><span>분석자료<\/span>/);
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
  assert.match(visibleHtml, /종합 만족도 × 해피콜 이행률/);
  assert.doesNotMatch(visibleHtml, /종합 만족도 × 해피콜 이행률 \(분기 평균\)/);
  assert.match(
    visibleHtml,
    /class="analysis-legend" aria-label="차트 범례"><span class="selected">강남대치<\/span><span>비교 전시장<\/span><span class="average">그룹 평균<\/span>/,
  );
  assert.doesNotMatch(visibleHtml, />내 전시장<\/span>/);
  assert.match(visibleHtml, /<h2>에이치 내 순위<\/h2><\/div><strong><b>7<\/b>개소<\/strong>/);
  assert.match(
    visibleHtml,
    /종합 만족도 평균 누적[\s\S]*VOC 상담 만족도[\s\S]*ONE Voice 시승 만족도[\s\S]*ONE Voice 출고 만족도[\s\S]*90\.3/,
  );
  assert.match(
    visibleHtml,
    /에이치 누적평균 95\.0점 대비 ▼ 4\.7점/,
  );
  assert.match(visibleHtml, /해피콜 이행률 평균 누적[\s\S]*VOC 상담 후 해피콜\(24시간 이내 시행\)[\s\S]*ONE Voice 출고 후 해피콜\(24시간 이내 시행\)[\s\S]*>100\.0<[^]*?점/);
  assert.match(
    visibleHtml,
    /에이치 누적평균 92\.7점 대비 ▲ 7\.3점/,
  );
  assert.match(visibleHtml, /합산 경쟁력[\s\S]*분기별 합산점수 평균[\s\S]*190\.3/);
  assert.doesNotMatch(visibleHtml, /2개 분기 · 200점 만점|Q1 93\.1점 \+ Q2 87\.5점|400점 만점/);
  assert.equal((visibleHtml.match(/aria-label="Q1, Q2 누적"/g) ?? []).length, 1);
  assert.match(visibleHtml, /에이치 내 4위 \/ 전체 7/);
  assert.doesNotMatch(visibleHtml, /균형 경쟁력|합산 평균/);
  assert.match(visibleHtml, /<h2>에이치 내 순위<\/h2>/);
  assert.match(html, /class="analysis-scatter scatter-motion-settled"/);
  assert.equal((html.match(/class="scatter-zone /g) ?? []).length, 2);
  assert.match(
    html.replaceAll("<!-- -->", ""),
    /class="scatter-average-value vertical"><span>해피콜 이행률<\/span><strong>평균 \d+\.\d점<\/strong>/,
  );
  assert.match(
    html.replaceAll("<!-- -->", ""),
    /class="scatter-average-value horizontal"><span>종합 만족도<\/span><strong>평균 \d+\.\d점<\/strong>/,
  );
  assert.equal((html.match(/class="scatter-point /g) ?? []).length, 7);
  assert.doesNotMatch(html, /scatter-callout-leader/);
  assert.match(html, /class="scatter-point selected\b/);
  assert.match(analysisSource, /key=\{item\.cdsid\}/);
  assert.doesNotMatch(analysisSource, /key=\{`\$\{view\}-\$\{item\.cdsid\}`\}/);
  assert.match(
    css,
    /\.scatter-point\s*\{[^}]*left 285ms cubic-bezier\(0\.22, 1, 0\.36, 1\) 145ms[^}]*bottom 285ms cubic-bezier\(0\.22, 1, 0\.36, 1\) 145ms[^}]*animation: scatter-point-enter 205ms ease-out 175ms both;/,
  );
  assert.doesNotMatch(css, /scatter-point-view-flow/);
  assert.match(html, /scatter-motion-settled/);
  assert.match(css, /\.analysis-scatter\.scatter-motion-guides \.scatter-zone\s*\{[^}]*opacity: 0;/);
  assert.match(css, /\.scatter-average-line\.vertical\s*\{[^}]*transition: left 300ms cubic-bezier\(0\.2, 0\.82, 0\.22, 1\);/);
  assert.match(css, /\.scatter-average-line\.horizontal\s*\{[^}]*transition: bottom 300ms cubic-bezier\(0\.2, 0\.82, 0\.22, 1\);/);
  assert.match(
    css,
    /@keyframes scatter-point-enter\s*\{[\s\S]*?opacity: 0;[\s\S]*?opacity: 1;/,
  );
  assert.match(
    css,
    /\.scatter-point\.selected > i\s*\{[^}]*background: #075b7c;[^}]*animation: selected-scatter-point-halo var\(--selected-scatter-pulse-duration\) var\(--selected-scatter-pulse-easing\) infinite;/,
  );
  assert.match(
    css,
    /@keyframes selected-scatter-point-halo\s*\{[\s\S]*?box-shadow:[\s\S]*?box-shadow:/,
  );
  assert.doesNotMatch(css, /selected-scatter-point-blink/);
  assert.doesNotMatch(
    css,
    /\.scatter-point\.selected > b\s*\{[^}]*animation:/,
  );
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
  assert.match(
    html.replaceAll("<!-- -->", ""),
    /class="analysis-rank"><strong>\d+<\/strong><span><em>(?!볼보 )[^<]+<\/em><small>[^<]+ · [^<]+ · [^<]+<\/small><\/span>/,
  );
  assert.match(
    css,
    /\.analysis-rank > span\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*baseline;[\s\S]*?white-space:\s*nowrap;[\s\S]*?\.analysis-rank > span > em\s*\{[^}]*flex:\s*0 0 56px;[^}]*font-size:\s*11px;[^}]*text-align:\s*left;[\s\S]*?\.analysis-rank small\s*\{[^}]*font-size:\s*9px;[^}]*text-align:\s*left;/,
  );
  assert.match(visibleHtml, /볼보 분당/);
  assert.match(
    html,
    /href="\/dashboard\/6KR6834" class="analysis-context-item"/,
  );
  assert.match(visibleHtml, /소속 영업직원 성장 내비게이션/);
  assert.doesNotMatch(visibleHtml, /analysis-staff-card|고객상담 만족도 분석결과/);
  assert.doesNotMatch(visibleHtml, /Sales DMS 재직자 중 영업직원·영업팀장만 VOC 원데이터/);
  assert.doesNotMatch(visibleHtml, /영업직원·영업팀장만 VOC 원데이터와 교차검증/);
  assert.match(visibleHtml, /김대준/);
  assert.match(visibleHtml, /조동조/);
  const staffSectionHtml = visibleHtml.match(
    /<section class="analysis-staff-card"[\s\S]*?<\/section>/,
  )?.[0];
  if (staffSectionHtml) {
  assert.match(staffSectionHtml, /class="analysis-staff-workspace"/);
  assert.match(staffSectionHtml, /class="analysis-staff-roster"/);
  assert.match(staffSectionHtml, /aria-label="보정 만족도와 최신성 최종점수 순위별 소속 직원"/);
  assert.doesNotMatch(staffSectionHtml, />전체 기간 상담 만족도</);
  assert.doesNotMatch(staffSectionHtml, /SC 종합 분석/);
  assert.match(staffSectionHtml, /class="analysis-staff-roster-list"/);
  assert.doesNotMatch(staffSectionHtml, /analysis-staff-dropdown/);
  assert.doesNotMatch(staffSectionHtml, /aria-haspopup="listbox"/);
  assert.match(staffSectionHtml, /김대준/);
  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.analysis-workspace,[\s\S]*?\.analysis-staff-card,[\s\S]*?margin-inline:\s*-10px/,
  );
  assert.match(
    css,
    /\.analysis-ranking-card,[\s\S]*?\.analysis-staff-card,[\s\S]*?border-radius:\s*var\(--radius-md\)/,
  );
  assert.match(
    css,
    /\.weekly-score-layout > \.trend-wrap\.compact \.trend-scroll\s*\{[\s\S]*?flex:\s*1 1 auto/,
  );
  assert.match(
    css,
    /\.weekly-score-layout > \.trend-wrap\.compact \.trend-canvas\s*\{[\s\S]*?grid-template-rows:\s*minmax\(150px, 1fr\) auto auto/,
  );
  assert.doesNotMatch(staffSectionHtml, /영업직원 · 13년 6개월/);
  assert.match(staffSectionHtml, /9\.28/);
  assert.match(staffSectionHtml, /class="analysis-staff-roster-final">89\.8<\/span>/);
  assert.match(staffSectionHtml, /class="analysis-staff-roster-final">77\.0<\/span>/);
  assert.match(staffSectionHtml, /번호[\s\S]*?영업직원[\s\S]*?\/ 입사일[\s\S]*?만족도[\s\S]*?\(80%\)[\s\S]*?최신성[\s\S]*?\(20%\)[\s\S]*?최종점수[\s\S]*?\(100점\)/);
  assert.match(staffSectionHtml, /class="analysis-staff-roster-adjusted-points">76\.9<\/span><span class="analysis-staff-roster-freshness-points">17\.2<\/span><span class="analysis-staff-roster-final">94\.1<\/span>/);
  assert.match(
    staffSectionHtml,
    /aria-label="최종점수 94\.1점, 만족도 76\.9점과 최신성 17\.2점 합산"[\s\S]*?<span>최종점수<\/span>[\s\S]*?94\.1<small>점<\/small>[\s\S]*?전국 329명 중 22위/,
  );
  assert.doesNotMatch(staffSectionHtml, />누적평균<\/span>/);
  assert.doesNotMatch(staffSectionHtml, />회신건수<\/span>/);
  assert.match(css, /\.analysis-staff-roster > header\s*\{[^}]*grid-template-columns:\s*24px 104px repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.analysis-staff-roster > header\s*\{[\s\S]*?min-height:\s*30px;/);
  assert.match(css, /\.analysis-staff-roster > header > span\s*\{[\s\S]*?height:\s*16px;/);
  assert.match(css, /\.analysis-staff-roster > header > span \+ span\s*\{[\s\S]*?border-left:\s*1px solid rgba\(137, 166, 180, 0\.25\);/);
  assert.match(css, /\.analysis-staff-roster-adjusted-points,\s*\.analysis-staff-roster-freshness-points\s*\{[^}]*font-size:\s*11px;[^}]*font-weight:\s*400;/);
  assert.match(css, /\.analysis-staff-roster-final\s*\{[^}]*font-size:\s*12px;[^}]*font-weight:\s*700;/);
  assert.match(css, /\.analysis-staff-roster-final\s*\{[^}]*font-family:\s*var\(--font-volvo\)/);
  assert.match(css, /\.analysis-staff-workspace\s*\{[^}]*grid-template-columns: 330px minmax\(0, 1fr\);/);
  assert.match(css, /\.analysis-staff-roster-rank\s*\{[\s\S]*?font-size:\s*8px;[\s\S]*?font-weight:\s*700;/);
  assert.match(
    staffSectionHtml,
    /class="analysis-staff-roster-identity"><strong>김대준<\/strong><small><i aria-hidden="true">\/<\/i><b>130201<\/b><\/small><\/span>/,
  );
  assert.match(
    css,
    /\.analysis-staff-roster-identity small\s*\{[^}]*width:\s*40px;[^}]*grid-template-columns:\s*4px 34px;/,
  );
  assert.match(
    css,
    /\.analysis-staff-roster-identity\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*38px 40px;[^}]*padding:\s*0 4px 0 8px;/,
  );
  assert.match(
    css,
    /\.analysis-staff-roster-identity strong\s*\{[^}]*width:\s*38px;[^}]*text-align:\s*left;/,
  );
  assert.match(
    staffSectionHtml,
    /<span>동일연차 정보<\/span>[\s\S]*?86\.8<small>점<\/small>[\s\S]*?비교 20명/,
  );
  assert.ok(staffSectionHtml.indexOf("박영환") < staffSectionHtml.indexOf("강석"));
  assert.ok(staffSectionHtml.indexOf("강석") < staffSectionHtml.indexOf("김대준"));
  assert.ok(staffSectionHtml.indexOf("김대준") < staffSectionHtml.indexOf("정지만"));
  assert.ok(staffSectionHtml.indexOf("송용주") < staffSectionHtml.indexOf("박준수"));
  assert.ok(staffSectionHtml.indexOf("박준수") < staffSectionHtml.indexOf("정지만"));
  assert.match(
    analysisSource,
    /if \(a\.finalScore === null && b\.finalScore === null\) \{[\s\S]*?compareStaffHireDateAscending\(a\.employee, b\.employee\)/,
  );
  assert.match(
    staffSectionHtml,
    /class="analysis-staff-roster-rank">14<\/span><span class="analysis-staff-roster-identity"><strong>정지만<\/strong>[\s\S]*?class="analysis-staff-roster-adjusted-points">―<\/span><span class="analysis-staff-roster-freshness-points">―<\/span><span class="analysis-staff-roster-final pending">검토<\/span>/,
  );
  assert.match(
    analysisSource,
    /className="analysis-staff-roster-rank">\s*\{index \+ 1\}/,
  );
  assert.match(
    staffSectionHtml,
    /class="selected" aria-pressed="true" aria-label="박영환, 누적 만족도 9\.7점, 보정 만족도 환산 76\.9점, 최신성 17\.2점, 최종 94\.1점"/,
  );
  assert.match(
    analysisSource,
    /window\.addEventListener\("pageshow", resetStaffSelection\)/,
  );
  assert.match(
    analysisSource,
    /const resetStaffSelection = \(\) => \{[\s\S]*?setSelectedStaffName\(null\);[\s\S]*?setSmilingStaffName\(null\);[\s\S]*?\};[\s\S]*?resetStaffSelection\(\);/,
  );
  assert.match(
    staffSectionHtml,
    /src="\/staff-profiles\/h-motors\/gangnam-daechi\/moon-jung-hwan\.jpg"/,
  );
  assert.match(staffSectionHtml, /alt="문정환 공식 프로필"/);
  assert.match(
    css,
    /\.analysis-staff-profile-photo\.smiling img\.smile\s*\{[\s\S]*?opacity:\s*1;/,
  );
  assert.match(staffSectionHtml, /<span>인증직원<\/span>/);
  assert.doesNotMatch(staffSectionHtml, /인증직원 선정/);
  assert.match(
    staffSectionHtml,
    /class="analysis-staff-tenure-value"><b>2<\/b><small>년<\/small><b>6<\/b><small>개월<\/small>/,
  );
  assert.match(staffSectionHtml, /동일연차 2년 7개월 ~ 3년/);
  assert.match(
    analysisSource,
    /const staffTenureHalfYearRange = \(completedMonths: number\) => \{[\s\S]*?Math\.floor\(Math\.max\(0, completedMonths\) \/ 6\) \* 6 \+ 1[\s\S]*?end: start \+ 5/,
  );
  assert.match(
    analysisSource,
    /staffTenureHalfYearRange\(employee\.tenureMonths\)\.start !==[\s\S]*?selectedStaffTenurePeerRangeStart/,
  );
  assert.doesNotMatch(
    staffSectionHtml,
    /<span>근무기간<\/span><strong>13년 6개월<small>10년 이상<\/small><\/strong>/,
  );
  assert.doesNotMatch(
    staffSectionHtml,
    /<span>근무기간<\/span><strong>13년 6개월<\/strong><em>입사일 2013\.02\.01<\/em>/,
  );
  assert.doesNotMatch(
    staffSectionHtml,
    /class="analysis-staff-profile-card"[\s\S]*?<div><span>선택 직원<\/span>/,
  );
  assert.doesNotMatch(
    staffSectionHtml,
    /class="analysis-staff-profile-card"[\s\S]*?<small>영업직원<\/small>/,
  );
  assert.match(
    staffSectionHtml,
    /class="analysis-staff-certification-card"[\s\S]*?G-0[\s\S]*?A-0[\s\S]*?C-0/,
  );
  assert.match(
    staffSectionHtml,
    /aria-label="누적 인증 기록 Grand 0회, Advanced 0회, Certified 0회"/,
  );
  assert.doesNotMatch(staffSectionHtml, /에이치모터스 공식 프로필/);
  assert.match(staffSectionHtml, /2023/);
  assert.match(staffSectionHtml, /2024/);
  assert.match(staffSectionHtml, /2025/);
  assert.match(staffSectionHtml, /2026 YTD/);
  assert.match(staffSectionHtml, /회신 없음/);
  assert.doesNotMatch(staffSectionHtml, /비교 없음/);
  assert.match(staffSectionHtml, />VOC 고객회신 건수<[^]*?<strong>8<small>건<\/small>/);
  assert.match(staffSectionHtml, /상담 만족도 평균\(누적\)/);
  assert.doesNotMatch(staffSectionHtml, /고객상담 만족도 평균\(2023 ~ 2026 YTD\)/);
  assert.match(staffSectionHtml, /고객상담 만족도/);
  assert.match(staffSectionHtml, /전국 영업직원 평균/);
  assert.match(
    analysisSource,
    /useState<string \| null>\(null\)[\s\S]*?key=\{selectedStaffEmployee\?\.name \?\? "staff-history"\}/,
  );
  assert.match(
    analysisSource,
    /const staffHistoryChartMinScore = 7;[\s\S]*?const staffHistoryChartMaxScore = 10;[\s\S]*?const staffHistoryChartHeight = \(score: number\) =>/,
  );
  assert.match(
    analysisSource,
    /height: staffHistoryChartHeight\(year\.average\)/,
  );
  assert.match(
    analysisSource,
    /const barHeight =[\s\S]*?staffHistoryChartHeight\(year\.average\);[\s\S]*?const nationalBarHeight = staffHistoryChartHeight/,
  );
  assert.equal(
    (staffSectionHtml.match(/class="analysis-staff-trend-marker"/g) ?? []).length,
    1,
  );
  assert.match(
    staffSectionHtml,
    /class="analysis-staff-chart-bar national"[\s\S]*class="analysis-staff-chart-bar employee"/,
  );
  assert.match(staffSectionHtml, /발송 21건[\s\S]*회신율 38\.1%/);
  assert.match(analysisSource, /sent: metrics\.sent \?\? 0/);
  assert.match(analysisSource, /metrics\.responses \/ \(metrics\.sent \?\? 1\)/);
  assert.match(staffSectionHtml, /--staff-trend-x:43\.75%/);
  assert.match(
    css,
    /\.analysis-staff-year-bars\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?gap:\s*0;/,
  );
  assert.match(
    css,
    /\.analysis-staff-trend-line polyline\s*\{[\s\S]*?stroke-width:\s*2\.5;/,
  );
  assert.match(css, /@keyframes analysis-staff-bar-rise/);
  assert.match(css, /@keyframes analysis-staff-line-wipe/);
  assert.match(analysisSource, /IntersectionObserver/);
  assert.match(analysisSource, /staffAnalysisCardRef/);
  assert.match(
    analysisSource,
    /staffCard\?\.style\.setProperty\([\s\S]*?--analysis-staff-heading-sticky-top[\s\S]*?`\$\{shellHeight \+ 8\}px`[\s\S]*?--analysis-staff-summary-sticky-top[\s\S]*?shellHeight \+ staffHeadingHeight \+ 24/,
  );
  assert.match(
    analysisSource,
    /<header className="analysis-staff-heading" ref=\{staffAnalysisHeadingRef\}>[\s\S]*?<span className="english-title">VOC<\/span> 고객상담 만족도 분석결과/,
  );
  assert.match(
    css,
    /\.competitive-analysis-page \.analysis-staff-heading\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*var\(--analysis-staff-heading-sticky-top, 354px\);[\s\S]*?z-index:\s*36;/,
  );
  assert.match(
    css,
    /\.competitive-analysis-page \.analysis-staff-summary\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*var\(--analysis-staff-summary-sticky-top, 354px\);[\s\S]*?z-index:\s*35;/,
  );
  assert.match(
    css,
    /\.competitive-analysis-page \.analysis-staff-heading\s*\{[\s\S]*?box-shadow:\s*0 -10px 0 #ffffff,[\s\S]*?0 16px 0 #ffffff;/,
  );
  assert.match(
    css,
    /\.competitive-analysis-page \.analysis-staff-summary\s*\{[\s\S]*?box-shadow:\s*0 -18px 0 #ffffff,[\s\S]*?0 14px 18px -22px rgba\(16, 42, 67, 0\.72\);/,
  );
  assert.match(
    css,
    /\.analysis-card-heading \.english-title,[\s\S]*?\.analysis-staff-heading \.english-title,[\s\S]*?\.v3s-award-heading \.english-title\s*\{[\s\S]*?font-family:\s*var\(--font-latin\);/,
  );
  assert.match(analysisSource, /staffAnalysisInView \? " is-motion-visible"/);
  assert.match(
    css,
    /\.analysis-staff-card\.is-motion-visible \.analysis-staff-chart-bar\s*\{[\s\S]*?animation:\s*analysis-staff-bar-rise/,
  );
  assert.match(
    css,
    /\.analysis-staff-card\.is-motion-visible \.analysis-staff-trend-line\s*\{[\s\S]*?animation:\s*analysis-staff-line-wipe/,
  );
  assert.match(
    css,
    /\.analysis-staff-chart-bar b\s*\{[\s\S]*?font-family:\s*"Volvo Centum"[\s\S]*?font-size:\s*13px;/,
  );
  assert.match(
    css,
    /\.analysis-staff-year-axis strong\s*\{[\s\S]*?font-family:\s*"Volvo Centum"[\s\S]*?font-size:\s*9px;[\s\S]*?font-weight:\s*500;/,
  );
  assert.match(
    css,
    /\.analysis-staff-year-axis span\s*\{[\s\S]*?font-family:\s*"Volvo Centum"[\s\S]*?font-size:\s*9px;/,
  );
  assert.match(
    css,
    /\.analysis-staff-year-axis small\s*\{[\s\S]*?font-size:\s*9px;[\s\S]*?font-weight:\s*700;/,
  );
  assert.match(
    css,
    /@container \(max-width:\s*420px\)[\s\S]*?\.analysis-staff-year-axis > div\s*\{[\s\S]*?flex-direction:\s*column;/,
  );
  assert.equal(
    (staffSectionHtml.match(/class="analysis-staff-history-legend"/g) ?? []).length,
    1,
  );
  assert.match(
    staffSectionHtml,
    /class="analysis-staff-history-legend"[\s\S]*class="national"[\s\S]*전국 평균[\s\S]*class="employee"[\s\S]*문정환/,
  );
  assert.doesNotMatch(staffSectionHtml, /문정환 4개년 추이/);
  assert.match(staffSectionHtml, /class="analysis-staff-comparison-layout"/);
  assert.match(
    css,
    /\.analysis-staff-comparison-layout\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?gap:\s*12px;/,
  );
  assert.match(staffSectionHtml, />VOC 고객회신 건수</);
  assert.doesNotMatch(staffSectionHtml, />VOC 회신</);
  assert.match(staffSectionHtml, />VOC 고객회신 건수<[\s\S]*class="analysis-staff-certification-card"/);
  assert.match(css, /\.analysis-staff-summary\s*\{[\s\S]*?grid-template-columns:\s*minmax\(160px, 0\.76fr\) repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.analysis-staff-summary article\s*\{[\s\S]*?min-height:\s*54px;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*?align-items:\s*center;[\s\S]*?align-content:\s*center;/);
  assert.match(css, /\.analysis-staff-summary strong\s*\{[\s\S]*?color:\s*#255b72;[\s\S]*?font-family:\s*var\(--font-latin\),\s*var\(--font-korean\),\s*sans-serif;[\s\S]*?font-size:\s*18px;[\s\S]*?font-weight:\s*700;[\s\S]*?font-variant-numeric:\s*tabular-nums;[\s\S]*?-webkit-font-smoothing:\s*antialiased;/);
  assert.match(css, /\.analysis-staff-summary strong\.name\s*\{[\s\S]*?font-family:\s*var\(--font-latin\),\s*var\(--font-korean\),\s*sans-serif;[\s\S]*?font-size:\s*18px;[\s\S]*?font-weight:\s*700;/);
  assert.match(css, /\.analysis-staff-summary strong\.analysis-staff-tenure-value\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*baseline;/);
  assert.match(css, /\.analysis-staff-summary strong\.analysis-staff-tenure-value small\s*\{[\s\S]*?margin-left:\s*0;/);
  assert.match(css, /\.analysis-staff-profile-photo\s*\{[\s\S]*?width:\s*42px;[\s\S]*?height:\s*44px;/);
  assert.match(css, /\.analysis-staff-certification-card strong\s*\{[\s\S]*?font-family:\s*var\(--font-latin\),\s*var\(--font-korean\),\s*sans-serif;[\s\S]*?font-size:\s*18px;[\s\S]*?font-variant-numeric:\s*tabular-nums;/);
  assert.match(staffSectionHtml, /class="analysis-staff-benchmarks"/);
  assert.match(staffSectionHtml, /class="analysis-staff-benchmark-legend"/);
  assert.match(
    css,
    /\.analysis-staff-comparison-layout\s*\{[\s\S]*?--analysis-staff-comparison-legend-height:\s*36px;/,
  );
  assert.match(
    css,
    /\.analysis-staff-history-legend\s*\{[\s\S]*?height:\s*var\(--analysis-staff-comparison-legend-height\);/,
  );
  assert.match(
    css,
    /\.analysis-staff-benchmarks\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) var\(--analysis-staff-comparison-legend-height\);/,
  );
  assert.match(
    css,
    /\.analysis-staff-benchmark-legend\s*\{[\s\S]*?height:\s*var\(--analysis-staff-comparison-legend-height\);/,
  );
  assert.match(
    css,
    /\.analysis-staff-history-legend,\s*\.analysis-staff-benchmark-legend\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?font-size:\s*9px;[\s\S]*?line-height:\s*1;/,
  );
  assert.match(
    staffSectionHtml,
    /class="analysis-staff-comparison-layout"[\s\S]*class="analysis-staff-history"[\s\S]*class="analysis-staff-benchmarks"/,
  );
  assert.doesNotMatch(staffSectionHtml, />비교대조군</);
  assert.doesNotMatch(staffSectionHtml, />전국 및 근속기간 분포</);
  assert.doesNotMatch(staffSectionHtml, /4개년 누적/);
  assert.doesNotMatch(staffSectionHtml, /근속기간별 상담 만족도 분포/);
  assert.doesNotMatch(staffSectionHtml, /Sales-DMS 재직자 중 누적 VOC 회신 보유 직원/);
  assert.match(staffSectionHtml, /class="analysis-staff-tenure-scatter-chart"/);
  assert.match(
    staffSectionHtml,
    />00<[\s\S]*>03<[\s\S]*>06<[\s\S]*>09<[\s\S]*>12<[\s\S]*>15</,
  );
  assert.match(css, /\.analysis-staff-tenure-scatter-chart svg\s*\{[\s\S]*?height:\s*230px;/);
  assert.doesNotMatch(staffSectionHtml, /class="analysis-staff-national-benchmark"/);
  assert.match(staffSectionHtml, /class="analysis-staff-scatter-average"/);
  assert.match(staffSectionHtml, />전국 평균<\/text>/);
  assert.match(staffSectionHtml, /class="score"[^>]*>\s*9\.3점\s*<\/text>/);
  assert.match(staffSectionHtml, /class="analysis-staff-scatter-showroom"/);
  assert.match(staffSectionHtml, />강남대치</);
  assert.doesNotMatch(staffSectionHtml, /문정환 SC 좌표/);
  assert.match(staffSectionHtml, /문정환 \/ 2\.5년 \/ 9\.9점 \/ 8건/);
  assert.match(staffSectionHtml, />상담 만족도</);
  assert.match(staffSectionHtml, />볼보 SC</);
  assert.doesNotMatch(staffSectionHtml, /4개년 추이<\/em>/);
  assert.match(css, /\.analysis-staff-benchmark-legend\s*\{[\s\S]*?justify-content:\s*center;/);
  assert.doesNotMatch(staffSectionHtml, /Sales-DMS 재직자 분포/);
  assert.match(css, /\.analysis-staff-scatter-population circle\s*\{[\s\S]*?fill:\s*rgba\(222, 104, 62, 0\.62\)/);
  assert.match(css, /\.analysis-staff-scatter-selected \.point\s*\{[\s\S]*?fill:\s*#075b7c/);
  assert.match(css, /\.analysis-staff-scatter-selected \.ring\s*\{[\s\S]*?fill:\s*rgba\(22, 121, 162, 0\.42\)/);
  assert.match(css, /@keyframes analysis-staff-selected-halo/);
  assert.match(css, /@keyframes analysis-staff-selected-point/);
  assert.match(
    css,
    /\.analysis-staff-scatter-selected \.halo\s*\{[\s\S]*?animation:\s*analysis-staff-selected-halo 1\.45s ease-in-out infinite;/,
  );
  assert.match(
    css,
    /\.analysis-staff-scatter-showroom circle\s*\{[\s\S]*?fill:\s*#00a878;[\s\S]*?animation:\s*analysis-staff-showroom-blink 2\.8s ease-in-out infinite;/,
  );
  assert.match(css, /@keyframes analysis-staff-showroom-blink\s*\{[\s\S]*?opacity:\s*0\.92;[\s\S]*?opacity:\s*0\.58;/);
  assert.doesNotMatch(css, /analysis-staff-showroom-orbit|translate\(0, -1\.2px\)|translate\(1\.2px, 0\)/);
  assert.match(css, /\.analysis-staff-benchmark-legend span\.showroom i\s*\{[^}]*background:\s*#00a878;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.analysis-staff-scatter-showroom circle,[\s\S]*?animation:\s*none;/);
  assert.doesNotMatch(staffSectionHtml, /class="analysis-staff-scatter-profile"/);
  assert.doesNotMatch(staffSectionHtml, /aria-label="문정환 공식 프로필 사진"/);
  assert.doesNotMatch(staffSectionHtml, /소속구간/);
  assert.equal(
    (staffSectionHtml.match(/class="analysis-staff-scatter-population"/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(staffSectionHtml, /class="analysis-staff-cohorts"/);
  assert.match(
    staffSectionHtml,
    /class="analysis-staff-tenure-value"><b>2<\/b><small>년<\/small><b>6<\/b><small>개월<\/small>/,
  );
  assert.doesNotMatch(staffSectionHtml, /MANAGER COACHING VIEW/);
  assert.doesNotMatch(staffSectionHtml, /analysis-staff-detail-heading/);
  assert.doesNotMatch(staffSectionHtml, /4개년 추이 · 전국\/근무연령대 비교 · 고객 코멘트/);
  assert.doesNotMatch(visibleHtml, />4개년 VOC 영업지원 핵심 분석</);
  assert.doesNotMatch(visibleHtml, /2023~2026 YTD 고객 코멘트의 반복 표현을 분류했습니다/);
  assert.doesNotMatch(analysisSource, /analysis-staff-insight-count/);
  assert.match(analysisSource, /analysis-staff-insight-bars/);
  assert.match(analysisSource, /--insight-bar-ratio/);
  assert.match(css, /\.analysis-staff-insight-bar\s*\{[\s\S]*?grid-template-columns:\s*92px minmax\(50px, 1fr\) 32px;/);
  assert.match(css, /@keyframes analysis-insight-bar-enter/);
  assert.match(css, /linear-gradient\(90deg, #b8ddd1 0%, #58aa8e 58%, #1f7e65 100%\)/);
  assert.match(css, /linear-gradient\(90deg, #f6cdb7 0%, #ea9665 58%, #cb6037 100%\)/);
  assert.doesNotMatch(visibleHtml, /진행상황 선제 안내/);
  assert.doesNotMatch(visibleHtml, /개선 기회/);
  assert.doesNotMatch(visibleHtml, /코칭 실행/);
  assert.doesNotMatch(visibleHtml, /고객이 재문의하기 전에 계약·출고 진행상황/);
  assert.doesNotMatch(visibleHtml, /보증·정비·소모품 등 포함·제외 항목/);
  assert.doesNotMatch(visibleHtml, /고객의 사용 목적을 먼저 확인하고 관련 기능/);
  assert.doesNotMatch(css, /\.analysis-staff-detail\s*\{[\s\S]*?grid-template-rows:\s*54px 232px 112px;/);
  assert.match(css, /\.analysis-staff-insights\s*\{[\s\S]*?height:\s*156px;[\s\S]*?min-height:\s*156px;/);
  assert.doesNotMatch(css, /\.analysis-staff-improvement-item\s*\{/);
  assert.match(staffSectionHtml, /Sales-DMS 기준/);
  assert.match(staffSectionHtml, /<strong>\d{6}<\/strong>기준/);
  assert.doesNotMatch(staffSectionHtml, /Sales-DMS 재직인원 기준/);
  assert.match(
    css,
    /\.analysis-staff-source\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, var\(--analysis-staff-source-width\)\);[\s\S]*?gap:\s*5px;/,
  );
  assert.match(
    css,
    /\.analysis-staff-source span\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*23px;[\s\S]*?border-radius:\s*999px;/,
  );
  assert.match(css, /\.analysis-staff-source strong\s*\{[\s\S]*?font-family:\s*var\(--font-latin\);[\s\S]*?font-size:\s*9px;/);
  assert.doesNotMatch(staffSectionHtml, /VOC 2026\.08\.24 기준/);
  assert.doesNotMatch(staffSectionHtml, /교차검증 메모/);
  assert.doesNotMatch(staffSectionHtml, /이름 불일치는 임의 병합하지 않습니다/);
  assert.doesNotMatch(staffSectionHtml, /명단 확인 2026\.08\.28/);
  assert.doesNotMatch(staffSectionHtml, /DMS 명단 10명/);
  assert.doesNotMatch(staffSectionHtml, /analysis-staff-quarters/);
  }

  await access(
    new URL(
      "../public/staff-profiles/h-motors/gangnam-daechi/kim-dae-jun.webp",
      import.meta.url,
    ),
  );
  const staffPhotoData = await readFile(
    new URL("../app/data/staff-profile-photos.json", import.meta.url),
    "utf8",
  );
  const staffPhotoSyncSource = await readFile(
    new URL("../scripts/sync-staff-profile-photos.py", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(staffPhotoData, /@hvolvo\.com|010-\d{4}-\d{4}/);
  assert.doesNotMatch(staffPhotoData, /consultant-cb79d612fa5b\.jpg/);
  assert.match(staffPhotoSyncSource, /PORTRAIT_SIZE = \(420, 440\)/);
  assert.match(staffPhotoSyncSource, /remove_uniform_light_background/);
  assert.match(staffPhotoSyncSource, /top = target_height - resized\.height/);
  assert.match(staffPhotoSyncSource, /\.with_suffix\("\.webp"\)/);
  assert.match(staffPhotoSyncSource, /PORTRAIT_FACE_WIDTH_RATIO = 0\.38/);
  assert.match(staffPhotoSyncSource, /PORTRAIT_SIDE_MARGIN = 10/);
  assert.match(staffPhotoSyncSource, /scale = min\(face_scale, width_scale, height_scale\)/);
  assert.match(staffPhotoSyncSource, /subject_right/);
  assert.match(staffPhotoSyncSource, /FACE_CLASSIFIER\.detectMultiScale/);
  const staffPhotoJson = JSON.parse(staffPhotoData);
  assert.equal(staffPhotoJson.showroomCount, 39);
  assert.equal(Object.keys(staffPhotoJson.showrooms).length, 39);
  assert.ok(staffPhotoJson.consultantCount > 39);
  assert.ok(
    Object.keys(staffPhotoJson.showrooms["6KR6834"].employees).length > 0,
  );
  const staffPortraits = Object.values(staffPhotoJson.showrooms).flatMap(
    (showroom) => Object.values(showroom.employees),
  );
  assert.equal(staffPortraits.length, staffPhotoJson.consultantCount);
  const readWebpSize = (buffer) => {
    assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
    assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
    assert.equal(buffer.toString("ascii", 12, 16), "VP8X");
    assert.ok((buffer[20] & 0x10) !== 0, "프로필 WebP에 투명 채널이 필요합니다.");
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  };
  await Promise.all(staffPortraits.map(async (profile) => {
    const portrait = await readFile(
      new URL(`../public${profile.image}`, import.meta.url),
    );
    assert.deepEqual(readWebpSize(portrait), { width: 420, height: 440 });
  }));

  const staffAnalysisData = await readFile(
    new URL("../app/data/voc-staff-analysis.json", import.meta.url),
    "utf8",
  );
  const staffAnalysisJson = JSON.parse(staffAnalysisData);
  const staffAnalysisShowrooms = staffAnalysisJson.showrooms;
  assert.equal(Object.keys(staffAnalysisShowrooms).length, 39);
  assert.deepEqual(
    new Set(Object.keys(staffAnalysisShowrooms)),
    new Set(Object.keys(staffPhotoJson.showrooms)),
  );
  assert.ok(
    Object.values(staffAnalysisShowrooms).reduce(
      (total, showroom) => total + showroom.employees.length,
      0,
    ) >= 300,
  );
  assert.ok(
    Object.values(staffAnalysisShowrooms).every(
      (showroom) => showroom.employees.length > 0,
    ),
  );
  assert.equal(staffAnalysisShowrooms["6KR6834"].employees.length, 14);
  assert.equal(staffAnalysisShowrooms["6KR6802"].employees.length, 19);
  assert.equal(staffAnalysisShowrooms["6KR6873"].employees.length, 2);
  assert.ok(
    Object.values(staffAnalysisShowrooms).every((showroom) =>
      showroom.employees.every(
        (employee) =>
          employee.role === "영업직원" || employee.role === "영업팀장",
      ),
    ),
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
    /class="identity-title analysis-title"[\s\S]*?class="header-status-row"[\s\S]*?DSC 가이드[\s\S]*?로그아웃/,
  );
  assert.match(analysisContextHtml, /identity-icon--dealer/);
  assert.match(analysisContextHtml, /identity-icon--region/);
  assert.match(analysisContextHtml, /identity-icon--size/);
  assert.match(analysisContextHtml, /identity-profile-icon/);
  assert.equal((analysisContextHtml.match(/<a\b/g) ?? []).length, 4);
  assert.doesNotMatch(analysisContextHtml, /<button\b|onclick=/i);
  assert.match(regionVisibleHtml, /<footer><span>수도권<strong>/);
  assert.match(regionVisibleHtml, /수도권 내 \d+위 \/ 전체 19/);
  assert.match(regionVisibleHtml, /볼보 강남신사/);
  assert.match(regionVisibleHtml, /볼보 분당판교/);
  assert.doesNotMatch(regionVisibleHtml, /볼보 강남 신사|볼보 분당 판교/);
  assert.doesNotMatch(
    regionVisibleHtml,
    /동일 권역 소재 전시장 안에서 현재 위치와 균형을 확인합니다/,
  );
  assert.doesNotMatch(regionVisibleHtml, /V3S 인센티브 수상기록|v3s-award-timeline/);
  assert.match(regionVisibleHtml, /aria-label="V3S 인센티브 1회 수상 \/ 총 12회: 21년 하반기"/);
  assert.equal((regionVisibleHtml.match(/class="analysis-title-award"/g) ?? []).length, 1);
  assert.match(regionVisibleHtml, /class="analysis-title-award"[\s\S]*?<small><span>21년<\/span><span>하반기<\/span><\/small>/);
  assert.match(regionVisibleHtml, /class="analysis-title-award-count"><span class="analysis-title-award-count-label">V3S 인센티브<\/span><span class="analysis-title-award-count-total"><strong>1회 수상<\/strong><i aria-hidden="true">\/<\/i><span>총 12<\/span><\/span><\/span>/);

  const wonjuResponse = await render(
    "/dashboard/6KR6851/analysis?view=size",
  );
  assert.equal(wonjuResponse.status, 200);
  const wonjuHtml = (await wonjuResponse.text()).replaceAll("<!-- -->", "");
  assert.match(wonjuHtml, /aria-label="V3S 인센티브 9회 수상 \/ 총 12회:/);
  assert.equal(
    (wonjuHtml.match(/class="analysis-title-award"/g) ?? []).length,
    9,
  );
  assert.match(
    wonjuHtml,
    /<small><span>22년<\/span><span>상반기<\/span><\/small>[\s\S]*?<small><span>22년<\/span><span>하반기<\/span><\/small>/,
  );
  assert.match(wonjuHtml, /class="analysis-title-award-count"><span class="analysis-title-award-count-label">V3S 인센티브<\/span><span class="analysis-title-award-count-total"><strong>9회 수상<\/strong><i aria-hidden="true">\/<\/i><span>총 12<\/span><\/span><\/span>/);
  assert.match(css, /\.analysis-title-award small\s*\{[^}]*font-size:\s*8px;[^}]*line-height:\s*1\.05;/);
  assert.match(css, /\.analysis-title-award-count\s*\{[^}]*display:\s*grid;[^}]*justify-items:\s*start;[^}]*align-self:\s*flex-end;[^}]*font-size:\s*8px;[^}]*letter-spacing:\s*-0\.04em;[^}]*line-height:\s*1\.05;[^}]*text-align:\s*left;/);
  assert.match(css, /\.analysis-title-award-count-total\s*\{[^}]*display:\s*inline-flex;[^}]*gap:\s*2px;[^}]*text-align:\s*left;/);
  assert.match(
    wonjuHtml,
    /<small><span>26년<\/span><span>상반기<\/span><\/small>/,
  );
  assert.doesNotMatch(wonjuHtml, /26년 하반기|V3S 인센티브 수상기록/);

  const sizeResponse = await render(
    "/dashboard/6KR6842/analysis?view=size",
  );
  assert.equal(sizeResponse.status, 200);
  const sizeHtml = await sizeResponse.text();
  const sizeVisibleHtml = sizeHtml.replaceAll("<!-- -->", "");
  assert.match(sizeVisibleHtml, /<footer><span>ML<strong>/);
  assert.match(sizeHtml, /scatter-point [^"]*dense/);
  assert.match(sizeHtml, /scatter-label comparison/);
  assert.match(sizeHtml, /style="opacity:1;visibility:visible"/);
  assert.match(sizeHtml, /볼보 해운대/);
  assert.match(sizeVisibleHtml, /소속 영업직원 성장 내비게이션/);
  assert.match(
    sizeVisibleHtml,
    new RegExp(staffAnalysisShowrooms["6KR6842"].employees[0].name),
  );

  const gunsanResponse = await render(
    "/dashboard/6KR6873/analysis?view=size",
  );
  assert.equal(gunsanResponse.status, 200);
  const gunsanVisibleHtml = (await gunsanResponse.text()).replaceAll(
    "<!-- -->",
    "",
  );
  assert.match(gunsanVisibleHtml, /볼보 군산 분석/);
  assert.match(gunsanVisibleHtml, /소속 영업직원 성장 내비게이션/);
  for (const employee of staffAnalysisShowrooms["6KR6873"].employees) {
    assert.match(gunsanVisibleHtml, new RegExp(employee.name));
  }

  const gangnamSizeResponse = await render(
    "/dashboard/6KR6834/analysis?view=size",
  );
  assert.equal(gangnamSizeResponse.status, 200);
  const gangnamSizeHtml = await gangnamSizeResponse.text();
  assert.match(
    gangnamSizeHtml,
    /<h2><span class="english-title">U<\/span> 사이즈 내 순위<\/h2>/,
  );
  assert.match(
    gangnamSizeHtml.replaceAll("<!-- -->", ""),
    /U 사이즈 내 \d+위 \/ 전체 7/,
  );

  const showroomResponse = await render(
    "/dashboard/6KR6834/analysis?view=showroom",
  );
  assert.equal(showroomResponse.status, 200);
  const showroomHtml = await showroomResponse.text();
  assert.match(
    showroomHtml.replaceAll("<!-- -->", ""),
    /<footer><span>전국 전시장<strong>188\.0<\/strong><\/span><span>강남대치<strong>190\.3<\/strong><\/span><span class="analysis-average-delta delta-positive">평균 대비<strong>▲ 2\.3점<\/strong><\/span><\/footer>/,
  );
  assert.match(
    showroomHtml.replaceAll("<!-- -->", ""),
    /class="analysis-ranking-head"[^>]*>[\s\S]*?만족도 평균[\s\S]*?해피콜 평균[\s\S]*?합산점수/,
  );
  const showroomRankingHtml = showroomHtml.match(
    /class="analysis-ranking-list">([\s\S]*?)<\/div><footer>/,
  )?.[1];
  assert.ok(showroomRankingHtml);
  assert.match(showroomHtml, /<h2>전국 전시장 내 순위<\/h2>/);
  assert.match(showroomHtml.replaceAll("<!-- -->", ""), /전국 전시장 내 \d+위 \/ 전체 39/);
  assert.deepEqual(
    [
      ...showroomRankingHtml.matchAll(
        /class="analysis-rank"><strong>(\d+)<\/strong>/g,
      ),
    ].map((match) => Number(match[1])),
    [14, 15, 16, 17, 18, 19, 20],
  );
  assert.match(
    showroomRankingHtml,
    /class="selected"[\s\S]*?class="analysis-rank"><strong>17<\/strong>[\s\S]*?<em>강남대치<\/em>/,
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
  assert.match(showroomHtml.replaceAll("<!-- -->", ""), /전국 전시장 내 17위 \/ 전체 39/);
  assert.match(
    showroomHtml.replaceAll("<!-- -->", ""),
    /전국 전시장 누적평균 95\.5점 대비 ▼ 5\.2점/,
  );
  assert.match(
    showroomHtml.replaceAll("<!-- -->", ""),
    /전국 전시장 누적평균 92\.5점 대비 ▲ 7\.5점/,
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
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /maximumScale: 1/);
  assert.match(layout, /userScalable: false/);
  assert.match(layout, /themeColor: "#07141d"/);
  assert.match(layout, /statusBarStyle: "black-translucent"/);
  assert.match(layout, /볼보 관리자 전용/);
  assert.match(layout, /og\.png/);
  assert.match(layout, /lang="ko"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(
    access(new URL("../app/_sites-preview", templateRoot)),
  );
});

test("starts page 1 and page 2 at the top before the destination paints", async () => {
  const [dashboardSource, analysisSource, pageScrollSource, githubPagesSource, css] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pageScroll.ts", import.meta.url), "utf8"),
    readFile(new URL("../github-pages/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(dashboardSource, /forcePageScrollToTop|resetPageScrollForHeaderNavigation/);
  assert.doesNotMatch(analysisSource, /forcePageScrollToTop|resetPageScrollForHeaderNavigation/);
  assert.equal((dashboardSource.match(/scroll=\{false\}/g) ?? []).length, 3);
  assert.equal((analysisSource.match(/scroll=\{false\}/g) ?? []).length, 5);
  assert.match(
    dashboardSource,
    /useLayoutEffect\(\(\) => \{\s*resetPageScrollToTop\(\);\s*\}, \[initialCdsid\]\);/,
  );
  assert.match(
    analysisSource,
    /useLayoutEffect\(\(\) => \{\s*return lockPageScrollToTop\(\);\s*\}, \[initialCdsid\]\);/,
  );
  assert.match(pageScrollSource, /document\.scrollingElement/);
  assert.match(pageScrollSource, /document\.documentElement\.scrollTop = 0/);
  assert.match(pageScrollSource, /document\.body\.scrollTop = 0/);
  assert.match(pageScrollSource, /window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
  assert.match(pageScrollSource, /export const lockPageScrollToTop = \(holdMilliseconds = 320\)/);
  assert.match(pageScrollSource, /const usesTouchSectionSnap = window\.matchMedia\([\s\S]*?\(hover: none\) and \(pointer: coarse\)[\s\S]*?\)\.matches;/);
  assert.match(pageScrollSource, /if \(usesTouchSectionSnap\) \{\s*root\.classList\.add\("analysis-entry-top-locked"\);\s*\}/);
  assert.match(pageScrollSource, /event\.preventDefault\(\);[\s\S]*?event\.stopImmediatePropagation\(\);[\s\S]*?resetPageScrollToTop\(\);/);
  assert.match(pageScrollSource, /addEventListener\("wheel", blockResidualScroll, \{ capture: true, passive: false \}\)/);
  assert.match(pageScrollSource, /addEventListener\("touchmove", blockResidualScroll, \{ capture: true, passive: false \}\)/);
  assert.match(pageScrollSource, /requestAnimationFrame\(keepAtTop\)/);
  assert.match(pageScrollSource, /setTimeout\(release, holdMilliseconds\)/);
  assert.match(pageScrollSource, /removeEventListener\("wheel", blockResidualScroll, true\)/);
  assert.match(pageScrollSource, /removeEventListener\("touchmove", blockResidualScroll, true\)/);
  assert.match(pageScrollSource, /resetPageScrollToTop\(\);\s*if \(usesTouchSectionSnap\) \{\s*root\.classList\.remove\("analysis-entry-top-locked"\);/);
  assert.doesNotMatch(pageScrollSource, /forcePageScrollToTop/);
  assert.match(githubPagesSource, /window\.history\.scrollRestoration = "manual";/);
  assert.match(githubPagesSource, /import \{ flushSync \} from "react-dom";/);
  assert.match(githubPagesSource, /function routeFromHash\(hash = window\.location\.hash\)/);
  assert.match(
    githubPagesSource,
    /const commitRouteAtTop = \(nextRoute:[\s\S]*?flushSync\(\(\) => setRoute\(nextRoute\)\);[\s\S]*?resetPageScrollToTop\(\);/,
  );
  assert.match(githubPagesSource, /const navigateDashboardRoute = \(event: MouseEvent\) =>/);
  assert.match(githubPagesSource, /event\.preventDefault\(\);[\s\S]*?window\.history\.pushState\(null, "", nextUrl\);[\s\S]*?commitRouteAtTop\(routeFromHash\(nextUrl\.hash\)\);/);
  assert.match(githubPagesSource, /document\.addEventListener\("click", navigateDashboardRoute, true\)/);
  assert.match(githubPagesSource, /window\.addEventListener\("hashchange", update\)/);
  assert.match(githubPagesSource, /window\.addEventListener\("popstate", update\)/);
  assert.doesNotMatch(
    githubPagesSource,
    /resetPageScrollToTop\(\);\s*flushSync\(\(\) => setRoute/,
  );
  assert.match(css, /html\s*\{[^}]*scroll-behavior: auto;/);
  assert.doesNotMatch(css, /html\s*\{[^}]*scroll-behavior: smooth;/);
  assert.match(css, /html\.analysis-entry-top-locked,\s*html\.analysis-entry-top-locked body\s*\{[^}]*scroll-behavior: auto !important;[^}]*scroll-snap-type: none !important;/);
});

test("serves a master-only seven-dealer administrator analysis", async () => {
  const response = await render("/dashboard/6KR6834/dealer-analysis");
  assert.equal(response.status, 200);
  const html = (await response.text()).replaceAll("<!-- -->", "");
  const [source, routeSource, pagesSource, css] = await Promise.all([
    readFile(new URL("../app/DealerAnalysis.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/[cdsid]/dealer-analysis/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../github-pages/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /<header class="dashboard-identity-header analysis-header dealer-analysis-header">/);
  assert.match(html, /class="dealer-analysis-command-shell"/);
  assert.match(html, /<h1>딜러사별 분석자료<\/h1>/);
  assert.match(html, /class="header-status-item header-status-item--dashboard-return"/);
  assert.match(html, /기존 페이지 2 분석자료로 돌아가기/);
  assert.doesNotMatch(html, /class="analysis-admin-entry is-active"|aria-label="현재 전시장 정보"/);
  for (const dealer of ["아주", "천하", "에이치", "아이언", "아이비", "코오롱", "태영"]) {
    assert.match(html, new RegExp(`<h3>${dealer}<\\/h3>`));
  }
  const sortedDealers = ["에이치", "코오롱", "아이언", "아주", "아이비", "태영", "천하"];
  for (let index = 1; index < sortedDealers.length; index += 1) {
    assert.ok(
      html.indexOf(`<h3>${sortedDealers[index - 1]}</h3>`) < html.indexOf(`<h3>${sortedDealers[index]}</h3>`),
      "딜러사는 전체 인증 인원의 내림차순이어야 합니다.",
    );
  }
  assert.doesNotMatch(html, /class="dealer-analysis-summary"/);
  assert.doesNotMatch(html, /딜러사 배출 연인원|현재 \d+명 중 인증이력 연결/);
  assert.match(html, /dealer-certification-row dealer-certification-aggregate/);
  assert.match(html, /<h3>전체<\/h3>/);
  assert.doesNotMatch(html, /VOLVO DEALER|ALL DEALERS/);
  assert.doesNotMatch(html, />0[1-7]<\/span>/);
  assert.match(html, /<span role="columnheader">인증 레벨 구성<\/span>/);
  assert.match(html, /<span role="columnheader">현재 재직 · 재직률<\/span>/);
  assert.equal((html.match(/class="dealer-mix-bar"/g) ?? []).length, 8);
  assert.equal((html.match(/class="dealer-employment-bar"/g) ?? []).length, 8);
  assert.doesNotMatch(html, /dealer-employment-gap|Gap · 현재 재직 외/);
  assert.match(html, /현재 재직 67명 \/ 전체 인증 180명 · 재직률 37\.2%/);
  for (const sortLabel of ["기본순", "전체 인증 많은 순", "재직률 높은 순", "재직률 낮은 순", "현재 재직 많은 순"]) {
    assert.match(html, new RegExp(`>${sortLabel}<\\/button>`));
  }
  assert.match(html, /재직률은 현재 재직 확인 인원을 전체 인증 인원으로 나눈 값/);
  assert.ok(html.indexOf("<h3>전체</h3>") < html.indexOf("<h3>에이치</h3>"));
  assert.match(html, /<h3>전체<\/h3>[\s\S]*?<strong>180<i>명<\/i><\/strong>[\s\S]*?<strong>40<em>명<\/em><\/strong>[\s\S]*?<strong>60<em>명<\/em><\/strong>[\s\S]*?<strong>80<em>명<\/em><\/strong>/);
  assert.match(html, /딜러사별 레벨별 인증인원 및 비율/);
  assert.doesNotMatch(html, /동일 인물의 연도별 수상은 각각 포함/);
  assert.match(html, /딜러사 확인 <strong>178명<\/strong>/);
  assert.match(html, /딜러사 미확인 <strong>2명<\/strong>/);
  assert.doesNotMatch(html, /누적판매/);
  assert.match(html, /현재 재직 확인/);
  assert.match(source, /"2025:장석우": "에이치"/);
  assert.match(source, /"2025:이동담": "코오롱"/);
  assert.match(source, /const totalCertifications = certifications\.length;/);
  assert.match(source, /b\.certificationCount - a\.certificationCount/);
  assert.match(routeSource, /access\.role !== "master"/);
  assert.match(pagesSource, /segments\[2\] === "dealer-analysis"[\s\S]*?access\.role !== "master"/);
  assert.match(css, /\.analysis-admin-entry\s*\{[^}]*width: 92px;[^}]*height: 92px;/);
  assert.match(css, /\.dealer-analysis-command-shell\s*\{[^}]*margin-inline: calc\(-1 \* var\(--dashboard-content-overhang\)\);[^}]*padding-inline: var\(--dashboard-sticky-content-gutter\);/);
  assert.match(css, /\.analysis-admin-entry\s*\{[^}]*margin-right: -4px;/);
  assert.match(css, /\.dealer-analysis-page\s*\{[^}]*font-family: var\(--font-latin\);/);
  assert.match(css, /\.dealer-certification-row\s*\{[^}]*grid-template-columns:[^;]*minmax\(390px, 2\.35fr\)/);
  assert.match(css, /@keyframes dealer-bar-fill/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /font-variant-numeric: tabular-nums;/);
  assert.match(css, /\.dealer-analysis-page\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /@media \(min-width:\s*761px\) and \(max-width:\s*1240px\)[\s\S]*?\.dealer-certification-row\s*\{[^}]*grid-template-columns:\s*minmax\(90px,\s*0\.7fr\)\s*64px\s*minmax\(0,\s*2\.1fr\)\s*minmax\(180px,\s*1\.45fr\)/);
});

test("splits courtesy feedback into short, actionable strength labels", async () => {
  const [generator, staffAnalysis] = await Promise.all([
    readFile(new URL("../scripts/generate-voc-staff-analysis.py", import.meta.url), "utf8"),
    readFile(new URL("../app/data/voc-staff-analysis.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const labels = new Set(
    Object.values(staffAnalysis.showrooms).flatMap((showroom) =>
      showroom.employees.flatMap((employee) =>
        employee.strengthKeywords.map((keyword) => keyword.label),
      ),
    ),
  );
  for (const label of ["친절·정중 응대", "편안한 상담", "맞춤형 설명", "성실한 답변"]) {
    assert.ok(labels.has(label), `${label} 분류가 생성되어야 합니다.`);
  }
  assert.equal(labels.has("친절·예의"), false);
  assert.equal(labels.has("부담 없는 상담"), false);
  assert.equal(labels.has("니즈 맞춤 상담"), false);
  assert.match(generator, /matched_labels\.intersection\(\{"편안한 상담", "맞춤형 설명", "성실한 답변"\}\)/);
});

test("locks page 2 zoom and fits the iPad 13-inch landscape viewport", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /root\.classList\.add\("analysis-viewport-locked"\)/);
  assert.match(source, /minimum-scale=1, maximum-scale=1, user-scalable=no/);
  assert.match(source, /addEventListener\("gesturestart", preventGestureZoom, \{ passive: false \}\)/);
  assert.match(source, /addEventListener\("wheel", preventModifiedWheelZoom, \{ passive: false \}\)/);
  assert.match(source, /\["\+", "-", "=", "0"\]\.includes\(event\.key\)/);
  assert.match(source, /root\.classList\.remove\("analysis-viewport-locked"\)/);
  assert.match(css, /html\.analysis-viewport-locked \.competitive-analysis-page\s*\{[^}]*touch-action:\s*pan-x pan-y;/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 1180px\) and \(max-width: 1400px\)\s*\{[\s\S]*?--dashboard-page-max:\s*1376px;[\s\S]*?--dashboard-page-gutter:\s*32px;[\s\S]*?width:\s*min\(1376px, 100vw\);/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1400px\)\s*\{[\s\S]*?\.competitive-analysis-page \.growth-navigation-workspace,[\s\S]*?100dvh - var\(--growth-navigation-sticky-top, 122px\) -[\s\S]*?var\(--growth-navigation-summary-height, 152px\) - 36px[\s\S]*?\.competitive-analysis-page \.growth-position-card,[\s\S]*?height: 216px;[\s\S]*?\.competitive-analysis-page \.growth-zone-gauge\s*\{[\s\S]*?width: min\(100%, 350px\);[\s\S]*?\.competitive-analysis-page \.growth-sales-stage\s*\{[\s\S]*?height: 88px;[\s\S]*?\.competitive-analysis-page \.growth-evidence-grid\s*\{[\s\S]*?height: 180px;[\s\S]*?padding-top: 0;[\s\S]*?\.competitive-analysis-page \.growth-sales-monthly-card\s*\{[\s\S]*?height: 180px;[\s\S]*?min-height: 180px;/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1400px\)\s*\{[\s\S]*?\.competitive-analysis-page \.growth-scatter-card\s*\{[^}]*padding-right: 14px;[^}]*padding-bottom: 8px;[^}]*padding-left: 14px;/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1400px\)\s*\{[\s\S]*?\.competitive-analysis-page \.growth-scatter-card > header\s*\{[^}]*width: calc\(100% \+ 7px\);[^}]*margin-left: -7px;[\s\S]*?\.competitive-analysis-page \.growth-scatter-card > header > :first-child\s*\{[^}]*transform: none;[\s\S]*?\.competitive-analysis-page \.growth-comment-evidence > header > :first-child\s*\{[^}]*transform: translateX\(-3px\);[\s\S]*?\.competitive-analysis-page \.growth-sales-funnel-card > header > :first-child,[\s\S]*?\.competitive-analysis-page \.growth-sales-monthly-card > header > :first-child\s*\{[^}]*transform: translateX\(-1px\);/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1400px\)\s*\{[\s\S]*?\.competitive-analysis-page \.growth-navigation-detail\s*\{[^}]*padding-bottom: 0;[^}]*overflow-y: auto;[\s\S]*?\.competitive-analysis-page \.growth-capability-grid,[\s\S]*?\.competitive-analysis-page \.growth-sales-dashboard\s*\{[^}]*padding-bottom: 6px;/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1400px\)\s*\{[\s\S]*?\.competitive-analysis-page \.growth-comment-bar-column\s*\{[^}]*gap: 3\.5px;[\s\S]*?\.competitive-analysis-page \.growth-comment-bar > i\s*\{[^}]*height: 10px;[\s\S]*?\.competitive-analysis-page \.growth-sales-monthly-trend\s*\{[^}]*transform: translateY\(-6px\);[\s\S]*?\.competitive-analysis-page \.growth-sales-month\s*\{[^}]*min-height: 78px;[^}]*grid-template-rows: 13px 1fr 15px;[\s\S]*?\.competitive-analysis-page \.growth-sales-month > i\s*\{[^}]*height: calc\(100% - 6px\);[^}]*min-height: 34px;[\s\S]*?\.competitive-analysis-page \.growth-sales-monthly-legend\s*\{[^}]*min-height: 16px;[^}]*padding-top: 0;/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1400px\)\s*\{[\s\S]*?\.competitive-analysis-page \.growth-sales-month > i span\s*\{[^}]*width: 74%;[\s\S]*?\.competitive-analysis-page \.growth-sales-month > i b\s*\{[^}]*width: 44%;/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1400px\)\s*\{[\s\S]*?\.competitive-analysis-page \.growth-sales-share-visual,[\s\S]*?\.competitive-analysis-page \.growth-sales-share-meta\s*\{[^}]*transform: translateY\(-6px\);[\s\S]*?\.competitive-analysis-page \.growth-sales-share-meta\s*\{[^}]*width: 100%;[^}]*justify-items: center;[^}]*text-align: center;[\s\S]*?\.competitive-analysis-page \.growth-sales-share-rank\s*\{[^}]*justify-content: center;/);
  assert.doesNotMatch(css, /\.competitive-analysis-page \.growth-capability-grid,[\s\S]*?\.competitive-analysis-page \.growth-sales-dashboard\s*\{[^}]*height: 100%;[^}]*grid-template-rows: auto minmax\(auto, 1fr\) auto;/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) and \(orientation: landscape\) and \(min-width: 761px\) and \(max-width: 1400px\)\s*\{[\s\S]*?\.competitive-analysis-page\s*\{[^}]*--growth-navigation-sticky-top: 122px;[^}]*padding-bottom: 20px;/);
});

test("matches all 39 finalized CX Index Q2 results and applies one CX rule to Q1-Q4", async () => {
  const [showroomsText, cxQ2DscText, dashboardSource] = await Promise.all([
    readFile(new URL("../app/data/showrooms.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/cx-q2-dsc.json", import.meta.url), "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
  ]);
  const showrooms = JSON.parse(showroomsText).showrooms;
  const cxQ2Dsc = JSON.parse(cxQ2DscText);
  const expectedRows = [
    ["6KR6834", 113.8, 120], ["6KR342", 109.6, 120],
    ["6KR6868", 122.4, 130], ["6KR6867", 126.1, 130],
    ["6KR6850", 103.2, 110], ["6KR6828", 111.1, 120],
    ["6KR6864", 109.8, 120], ["6KR6873", 107.1, 110],
    ["6KR6863", 101.2, 110], ["6KR6829", 127.1, 130],
    ["6KR6833", 122.4, 130], ["6KR6841", 112.7, 120],
    ["6KR6846", 126.0, 130], ["6KR6862", 88.6, 100],
    ["6KR6830", 124.0, 130], ["6KR6858", 109.4, 120],
    ["6KR6865", 126.9, 130], ["6KR6869", 127.9, 130],
    ["6KR6870", 106.0, 110], ["6KR6852", 105.9, 110],
    ["6KR6847", 99.1, 110], ["6KR6802", 102.3, 110],
    ["6KR6856", 115.0, 120], ["6KR6849", 110.5, 120],
    ["6KR6839", 100.9, 110], ["6KR6874", 112.9, 120],
    ["6KR6851", 125.7, 130], ["6KR6857", 106.5, 110],
    ["6KR6836", 99.2, 110], ["6KR6845", 115.2, 120],
    ["6KR6840", 126.3, 130], ["6KR6859", 118.8, 130],
    ["6KR6871", 125.0, 130], ["6KR6838", 123.0, 130],
    ["6KR6848", 109.9, 120], ["6KR6872", 116.3, 120],
    ["6KR6854", 115.6, 120], ["6KR6861", 125.9, 130],
    ["6KR6842", 115.6, 120],
  ];
  const byCdsid = Object.fromEntries(showrooms.map((item) => [item.cdsid, item]));

  assert.equal(showrooms.length, 39);
  assert.equal(Object.keys(cxQ2Dsc.scores).length, 39);
  for (const [cdsid, rawScore, dscScore] of expectedRows) {
    assert.equal(byCdsid[cdsid].cx, rawScore, `${cdsid} Q2 원점수`);
    assert.equal(cxQ2Dsc.scores[cdsid], dscScore, `${cdsid} Q2 DSC 스코어`);
    assert.equal(
      Math.min(130, Math.ceil((rawScore + 2) / 10) * 10),
      dscScore,
      `${cdsid} 공통 CX 환산식`,
    );
  }
  assert.equal(
    Number((expectedRows.reduce((sum, [, raw]) => sum + raw, 0) / 39).toFixed(1)),
    114.0,
  );
  assert.equal(
    Number((expectedRows.reduce((sum, [, , dsc]) => sum + dsc, 0) / 39).toFixed(1)),
    120.5,
  );
  assert.equal(expectedRows.filter(([, raw]) => raw < 100).length, 3);
  assert.equal(expectedRows.filter(([, raw]) => raw >= 100).length, 36);
  assert.equal(expectedRows.filter(([, , dsc]) => dsc >= 100).length, 39);
  assert.equal(cxQ2Dsc.maxScore, 130);
  assert.equal(cxQ2Dsc.rtcThreshold, 100);
  assert.match(
    dashboardSource,
    /const metricMaxOf = \(metric: MetricKey\) => metricMeta\[metric\]\.max;/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /metricMaxOf[\s\S]{0,240}quarter === "q1"/,
  );
  assert.match(
    dashboardSource,
    /if \(quarter === "q2"\) return item\.cx;[\s\S]*?if \(metric === "cx"\) return dashboard\.averages\.cx \?\? 0/,
  );
  assert.match(
    dashboardSource,
    /const cxDscScoreOf = \(value: number\) =>[\s\S]*?Math\.ceil\(\(value \+ 2\) \/ 10\) \* 10[\s\S]*?cxDscScoreOf\(value\) >= cxQ2Dsc\.rtcThreshold \? 0\.2 : 0\.1/,
  );
  assert.match(
    dashboardSource,
    /const fixedDscScores: Record<TrendMetricKey, number> = \{[\s\S]*?v3s: 100,[\s\S]*?voc: 100,[\s\S]*?cx: 130,[\s\S]*?const integratedDscScoreMax =[\s\S]*?fixedDscScores\.v3s \+ fixedDscScores\.voc \+ fixedDscScores\.cx/,
  );
  assert.match(
    dashboardSource,
    /Q1~Q4 공통 · 5개 CX Management 항목의 DSC 스코어 합산, 총 320점[\s\S]*?CX Management 320점 구성[\s\S]*?합산 100점 이상[\s\S]*?RTC 0\.2%[\s\S]*?합산 100점 미만[\s\S]*?RTC 0\.1%/,
  );
});

test("matches the final V3S Q2 CSV values cross-checked against all 39 PDFs", async () => {
  const [dashboardText, syncSource] = await Promise.all([
    readFile(new URL("../app/data/showrooms.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/sync-v3s-q2-final.py", import.meta.url), "utf8"),
  ]);
  const dashboard = JSON.parse(dashboardText);
  const expected = {
    "6KR342": 96.4,
    "6KR6834": 93.4,
    "6KR6868": 98.4,
    "6KR6867": 97.5,
    "6KR6850": 97.6,
    "6KR6828": 98.2,
    "6KR6864": 97.7,
    "6KR6873": 91.7,
    "6KR6863": 95.3,
    "6KR6829": 91.8,
    "6KR6833": 98.2,
    "6KR6841": 85.3,
    "6KR6846": 91.9,
    "6KR6862": 95.6,
    "6KR6830": 96.7,
    "6KR6858": 92.6,
    "6KR6865": 98.9,
    "6KR6869": 99.6,
    "6KR6870": 97.0,
    "6KR6852": 89.7,
    "6KR6847": 88.9,
    "6KR6802": 97.5,
    "6KR6856": 98.2,
    "6KR6849": 91.1,
    "6KR6839": 96.0,
    "6KR6874": 94.2,
    "6KR6851": 99.4,
    "6KR6857": 96.9,
    "6KR6836": 90.3,
    "6KR6845": 98.4,
    "6KR6840": 93.4,
    "6KR6859": 98.0,
    "6KR6871": 98.5,
    "6KR6838": 97.5,
    "6KR6848": 98.4,
    "6KR6872": 96.9,
    "6KR6854": 93.8,
    "6KR6861": 96.5,
    "6KR6842": 94.4,
  };

  assert.equal(dashboard.showrooms.length, 39);
  assert.deepEqual(
    Object.fromEntries(dashboard.showrooms.map((showroom) => [showroom.cdsid, showroom.v3s])),
    expected,
  );
  assert.equal(dashboard.averages.v3s, 95.4);
  assert.equal(dashboard.meta.combatAverage, 305.6);
  assert.ok(
    dashboard.meta.generatedFrom.includes(
      "2026 Volvo Sales Skill Simulation_Q2_Raw Data_V5.csv",
    ),
  );
  for (const showroom of dashboard.showrooms) {
    assert.equal(
      showroom.combat,
      Math.round((showroom.v3s + showroom.voc + showroom.cx) * 10) / 10,
      `${showroom.showroom} 통합 원점수도 Q2 V3S 수정값을 반영해야 합니다.`,
    );
  }
  assert.match(syncSource, /extract_pdf_score/);
  assert.match(syncSource, /if pdf_mismatches:[\s\S]*?쓰기를 중단/);

  for (const [cdsid, showroomName, score] of [
    ["6KR6833", "대전", "98.2"],
    ["6KR6834", "강남대치", "93.4"],
  ]) {
    const response = await render(`/dashboard/${cdsid}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`<h1>볼보 ${showroomName}(?:<!-- -->)? 현황<\\/h1>`));
    assert.match(
      html,
      new RegExp(
        `title="Volvo Sales Skill Simulation 평가\\(VCK\\)">V3S[\\s\\S]*?` +
          `class="metric-card-value animated-score" aria-label="${score}"[^>]*>${score}<`,
      ),
    );
    assert.match(html, /title="Q2 볼보 평균 95\.4점"/);
  }
});

test("ships Google Sheet weekly VOC, CX, and lazy detail series", async () => {
  const [weeklyText, detailsText, syncSource, dashboardSource, detailsSource] = await Promise.all([
    readFile(new URL("../app/data/weekly.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/weekly-details.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/sync-google-sheet-data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MetricDetails.tsx", import.meta.url), "utf8"),
  ]);
  const weekly = JSON.parse(weeklyText);
  const details = JSON.parse(detailsText);

  assert.equal(weekly.meta.workbookUrl, undefined);
  assert.equal(weekly.meta.vocLatestWeek, 34);
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
  assert.equal(weekly.voc.byCdsid["6KR6833"][32], 100);
  assert.equal(weekly.voc.byCdsid["6KR6833"][33], 50);
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
  const vocQuarterValues = (series, quarterIndex) =>
    series.slice(quarterIndex * 13, quarterIndex * 13 + 13);
  const vocQuarterAverage = (quarterIndex) => {
    const excludeZero = quarterIndex < 2;
    const values = Object.values(weekly.voc.byCdsid)
      .flatMap((series) => vocQuarterValues(series, quarterIndex))
      .filter(
        (value) =>
          typeof value === "number" && (!excludeZero || value !== 0),
      );
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  };
  const showroomQuarterAverage = (cdsid, quarterIndex) => {
    const values = vocQuarterValues(
      weekly.voc.byCdsid[cdsid],
      quarterIndex,
    ).filter((value) => typeof value === "number" && value !== 0);
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  };
  assert.deepEqual(
    [0, 1, 2, 3].map((quarterIndex) => {
      const value = vocQuarterAverage(quarterIndex);
      return value === null ? null : Number(value.toFixed(1));
    }),
    [94.5, 95.4, 28.3, null],
  );
  assert.deepEqual(
    [0, 1, 2, 3].map((quarterIndex) => {
      const value = showroomQuarterAverage("6KR6857", quarterIndex);
      return value === null ? null : Number(value.toFixed(1));
    }),
    [98.1, 99, 100, null],
  );
  assert.match(
    dashboardSource,
    /if \(metric === "voc"\) \{[\s\S]*?return vocQuarterValueOf\(item\.cdsid, quarter\);/,
  );
  assert.match(
    dashboardSource,
    /if \(metric === "voc"\) \{[\s\S]*?return vocQuarterAverageOf\(quarter\) \?\? 0;/,
  );
  assert.equal(weekly.cx.byCdsid["6KR6834"][0], 220);
  assert.equal(weekly.cx.byCdsid["6KR6834"][29], 220);
  assert.equal(weekly.cx.byCdsid["6KR6834"][30], null);
  assert.equal(weekly.cx.average[29], 268.7);
  assert.equal(
    weekly.meta.rules.cx,
    "신차출고 100점 + 시승 100점 + 긴급경보 10점 + 조치계획 10점 + 앱 가입율 100점의 원점수 합산(총 320점)",
  );
  assert.doesNotMatch(syncSource, /deliveryScore|testDriveScore|appScore/);
  assert.match(
    dashboardSource,
    /cxRawTotalOf[\s\S]*?record\.delivery[\s\S]*?record\.testDrive[\s\S]*?record\.emergency[\s\S]*?record\.actionPlan[\s\S]*?record\.app/,
  );
  assert.equal(details.meta.weekRanges.length, 52);
  assert.equal(details.voc.components.length, 5);
  assert.equal(details.cx.components.length, 5);
  assert.equal(Object.keys(details.voc.components[0].byCdsid).length, 39);
  assert.equal(Object.keys(details.cx.components[0].byCdsid).length, 39);
  assert.ok(
    [...details.voc.components, ...details.cx.components].every(
      (component) =>
        component.average.length === 52 &&
        component.byCdsid["6KR6834"].length === 52,
    ),
  );
  assert.match(syncSource, /01☆VOC종합만족도\(60%\)/);
  assert.match(syncSource, /04☆VOC해피콜\(10%\)/);
  assert.doesNotMatch(detailsText, /docs\.google\.com|1KZust31/);
  assert.doesNotMatch(detailsSource, /docs\.google\.com|1KZust31/);
  assert.doesNotMatch(detailsSource, /W01~W52 원본값 보기/);
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
  assert.match(
    dashboardSource,
    /const chartHeight = compact \? 150 : 210/,
  );
  assert.match(
    dashboardSource,
    /const chartYScale = chartHeight \/ 200/,
  );
  assert.match(
    dashboardSource,
    /preserveAspectRatio=\{compact \? "xMidYMax meet" : "none"\}/,
  );
  assert.match(
    css,
    /\.v3s-performance\.compact \.v3s-quarter-panel,[\s\S]*?min-height: 196px/,
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
    /\.score-tier-weekly \.trend-wrap\.compact \.data-coverage button\s*\{[^}]*background: transparent;[^}]*box-shadow: none;/,
  );
  assert.match(
    css,
    /\.score-tier-weekly \.score-tier-heading\s*\{[^}]*padding-right: calc\(25% \+ var\(--dashboard-card-gap\)\)/,
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
    /const highlightedQuarterStartWeek =[\s\S]*?highlightQuarter === "q1"[\s\S]*?\? 0[\s\S]*?highlightQuarter === "q2"[\s\S]*?\? 13[\s\S]*?highlightQuarter === "q4"[\s\S]*?\? 39[\s\S]*?: 26/,
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
    /<span className="metric-benchmark-quarter">\{quarterLabel\}<\/span>\{" "\}\s*볼보 평균\{" "\}[\s\S]*?className="metric-benchmark-average"[\s\S]*?displayNumber\(average\)[\s\S]*?대비/,
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
    /const selectMetricQuarter = \([\s\S]*?setMetricQuarters\(\(current\) => \(\{ \.\.\.current, \[metric\]: quarter \}\)\);/,
  );
  assert.match(
    dashboardSource,
    /const scrollMetricQuarterToSection = \(metric: "v3s" \| "voc"\) => \{[\s\S]*?const scoreHeadingRect = scoreHeading\?\.getBoundingClientRect\(\);[\s\S]*?const scoreStackGap =[\s\S]*?getComputedStyle\(scoreStack\)\.marginTop[\s\S]*?const scoreHeadingTop =[\s\S]*?target\.getBoundingClientRect\(\)\.top -[\s\S]*?scoreHeadingTop -[\s\S]*?scoreHeadingHeight -[\s\S]*?scoreStackGap[\s\S]*?const launchDistance =[\s\S]*?Math\.min\(Math\.abs\(distance\) \* 0\.12, 96\)[\s\S]*?top: animationStartTop[\s\S]*?const duration = 360;[\s\S]*?const eased = 1 - Math\.pow\(1 - progress, 4\);[\s\S]*?top: animationStartTop \+ remainingDistance \* eased/,
  );
  assert.match(
    dashboardSource,
    /metric === "v3s"[\s\S]*?scrollMetricQuarterToSection\("v3s"\);/,
  );
  assert.match(
    dashboardSource,
    /metric === "cx"[\s\S]*?scrollMetricQuarterToSection\("voc"\);/,
  );
  assert.match(
    dashboardSource,
    /key: metric === "cx" \? \("q4" as const\) : null,[\s\S]*?available: metric === "cx"/,
  );
  assert.match(
    dashboardSource,
    /highlightQuarter === "q4"[\s\S]*?\? 39[\s\S]*?: 26/,
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
    /\.score-stack-heading\s*\{[^}]*position: sticky[^}]*--score-heading-sticky-top,[^}]*var\(--dashboard-sticky-offset, 356px\)/,
  );
  assert.match(
    css,
    /\.dashboard \.score-stack-heading::before\s*\{[\s\S]*?top:\s*-20px;[\s\S]*?right:\s*-16px;[\s\S]*?bottom:\s*100%;[\s\S]*?left:\s*-16px;[\s\S]*?background:\s*#ffffff;/,
  );
  assert.doesNotMatch(
    css,
    /\.dashboard \.score-stack-heading::before\s*\{[\s\S]*?top:\s*-64px;/,
  );
  assert.match(
    dashboardSource,
    /const scoreHeadingRef = useRef<HTMLDivElement>\(null\);[\s\S]*?--score-heading-sticky-top[\s\S]*?ref=\{scoreHeadingRef\}/,
  );
  assert.match(dashboardSource, /function V3SPerformance/);
  assert.doesNotMatch(
    dashboardSource,
    /label: "Q3"[\s\S]{0,180}?statusText: "Q3 평가진행"/,
  );
  assert.match(
    dashboardSource,
    /label: "Q3"[\s\S]{0,180}?statusText: "평가\\u00a0중"/,
  );
  assert.match(
    dashboardSource,
    /label: "Q3"[\s\S]{0,220}?state: "in-progress"/,
  );
  assert.match(
    dashboardSource,
    /label: "Q4"[\s\S]{0,180}?statusText: "평가\\u00a0전"/,
  );
  assert.match(
    dashboardSource,
    /label: "Q4"[\s\S]{0,220}?state: "upcoming"/,
  );
  assert.match(
    dashboardSource,
    /className="future-window"[\s\S]{0,500}?평가 중/,
  );
  assert.match(
    dashboardSource,
    /className="future-window future-window-upcoming"[\s\S]{0,500}?평가 전/,
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
    /className="v3s-quarter-legend"[\s\S]*?peerBenchmarks\("q2"\)\.map[\s\S]*?className=\{`legend-peer \$\{benchmark\.key\}`\}[\s\S]*?className="legend-bar"[\s\S]*?displayShowroomNameWithoutBrand\(showroom\.showroom\)/,
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
    /\.coverage-line::after\s*\{[^}]*width: 6px[^}]*height: 6px[^}]*top: -1\.25px[^}]*left: 50%[^}]*border: 1\.5px solid currentColor[^}]*background: white[^}]*translate\(-50%, -50%\)/,
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

test("aligns the DSC score group with the integrated competitiveness rail", async () => {
  const [dashboardSource, css] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    dashboardSource,
    /className="kpi-column dsc-score-group"[\s\S]*?className="combat-card combat-scoreboard"/,
  );
  assert.match(
    dashboardSource,
    /className="metric-card-topline scoreboard-heading"[\s\S]*?통합 경쟁력 지수[\s\S]*?<AnimatedScore[\s\S]*?className="scoreboard-main-value"/,
  );
  assert.match(
    dashboardSource,
    /value=\{selectedIntegratedScore\}[\s\S]*?className="metric-rank-note"[\s\S]*?selectedIntegratedRank[\s\S]*?className="metric-stat-chips scoreboard-stat-chips"[\s\S]*?DSC 스코어[\s\S]*?selectedMetricDscScore[\s\S]*?RTC 인센티브[\s\S]*?selectedMetricRtcRate[\s\S]*?className="metric-benchmark scoreboard-benchmark"/,
  );
  assert.match(
    dashboardSource,
    /const selectedIntegratedScore = Number\([\s\S]*?kpis\.reduce\(\(sum, item\) => sum \+ item\.value, 0\)\.toFixed\(1\)/,
  );
  assert.match(
    dashboardSource,
    /const integratedScoreMax =[\s\S]*?metricMeta\.v3s\.max \+ metricMeta\.voc\.max \+ metricMeta\.cx\.max/,
  );
  assert.match(
    dashboardSource,
    /const v3sDscScoreOf =[\s\S]*?Math\.round\(value\)[\s\S]*?roundedScore >= 90 \? 100 : roundedScore >= 85 \? 90 : 80[\s\S]*?const cxDscScoreOf =[\s\S]*?Math\.ceil\(\(value \+ 2\) \/ 10\) \* 10[\s\S]*?const metricRtcIncentiveRateOf =[\s\S]*?dscScore === 100 \? 0\.2 : dscScore === 90 \? 0\.1 : 0[\s\S]*?metric === "voc"[\s\S]*?value >= 85 \? 0\.2 : 0\.1[\s\S]*?cxDscScoreOf\(value\) >= cxQ2Dsc\.rtcThreshold \? 0\.2 : 0\.1/,
  );
  assert.match(
    dashboardSource,
    /const metricDscScoreOf = \([\s\S]*?\): number => fixedDscScores\[metric\];/,
  );
  assert.match(
    dashboardSource,
    /const selectedMetricDscScore = integratedDscScoreMax;/,
  );
  assert.match(
    dashboardSource,
    /반올림한 V3S 평가 총점 기준[\s\S]*?미스터리 쇼퍼[\s\S]*?ONE Voice 시승 종합 만족도[\s\S]*?ONE Voice 신차[\s\S]*?출고 해피콜 이행률[\s\S]*?V3S 평가 총점 90점 이상[\s\S]*?DSC 100점[\s\S]*?RTC 0\.2%[\s\S]*?V3S 평가 총점 85점 이상[\s\S]*?DSC 90점[\s\S]*?RTC 0\.1%[\s\S]*?V3S 평가 총점 85점 미만[\s\S]*?DSC 80점[\s\S]*?RTC 0%/,
  );
  assert.match(
    dashboardSource,
    /분기별 VOC 최종점수 기준[\s\S]*?상·하반기 각 2회[\s\S]*?소수점 첫째 자리까지 반올림 없이 표시[\s\S]*?반올림 평가점수 85점 이상[\s\S]*?DSC 100점[\s\S]*?RTC 0\.2%[\s\S]*?반올림 평가점수 85점 미만[\s\S]*?DSC 90점[\s\S]*?RTC 0\.1%/,
  );
  assert.match(
    css,
    /\/\* DSC score group \+ integrated competitiveness rail \*\/[\s\S]*?grid-template-columns: minmax\(0, 3fr\) minmax\(236px, 1fr\)/,
  );
  assert.match(
    css,
    /\.metric-value-row \.metric-card-value,[\s\S]*?\.scoreboard-main-value\s*\{[^}]*font-size: clamp\(44px, 3\.05vw, 56px\)/,
  );
  assert.match(
    dashboardSource,
    /className="metric-score-lockup"[\s\S]*?className="metric-rank-note"[\s\S]*?\/ 전체[\s\S]*?dashboard\.meta\.showroomCount[\s\S]*?className="metric-stat-chips"[\s\S]*?DSC 스코어[\s\S]*?displayNumber\(dscScore, 0\)[\s\S]*?RTC 인센티브[\s\S]*?displayNumber\(rtcRate\)/,
  );
  assert.match(
    dashboardSource,
    /DSC 스코어 <strong>\{displayNumber\(selectedMetricDscScore, 0\)\}점<\/strong>/,
  );
  assert.match(
    css,
    /\.metric-stat-chips\s*\{[^}]*width: 92px;[^}]*min-width: 92px;/,
  );
  assert.match(
    css,
    /\.metric-rank-note\s*\{[^}]*font-size: 8px;[^}]*font-weight: 500;/,
  );
  assert.match(
    css,
    /\.metric-quarter-strip > button,[\s\S]*?\.scoreboard-quarter-strip > button\s*\{[^}]*min-height: 31px;[^}]*border-radius: 4px/,
  );
  assert.match(
    css,
    /\.metric-quarter-strip--status > button\s*\{[^}]*min-height: 50px;[^}]*height: 50px;[^}]*grid-template-rows: 20px 16px[\s\S]*?\.scoreboard-quarter-strip > button strong\s*\{[^}]*width: 46px;[^}]*min-width: 46px;[^}]*max-width: 46px;[^}]*height: 18px;[^}]*color: #315a6c;[^}]*border: 1px solid #bfd4dc;[^}]*border-radius: 999px;[^}]*background: #dbe9ee/,
  );
  assert.match(
    css,
    /\.metric-quarter-strip--status > button\.complete\s*\{[^}]*border-color: rgba\(112, 137, 148, 0\.2\);[^}]*box-shadow: none;[\s\S]*?button\.complete:not\(:disabled\):focus-visible\s*\{[^}]*border-color: rgba\(112, 137, 148, 0\.46\);[^}]*outline: none;[^}]*box-shadow: none;/,
  );
  assert.match(
    css,
    /\.metric-quarter-strip--status > button\.current\s*\{[^}]*border-color: rgba\(112, 137, 148, 0\.46\);[^}]*box-shadow: none;[\s\S]*?\.scoreboard-quarter-strip > button\.current\s*\{[^}]*border-color: rgba\(219, 235, 242, 0\.7\);[^}]*box-shadow: none;/,
  );
  assert.match(
    css,
    /\.scoreboard-quarter-strip > button\s*\{[^}]*grid-template-rows: 20px 16px;[^}]*min-height: 50px;[^}]*height: 50px;/,
  );
  assert.match(
    css,
    /\.metric-quarter-strip > button\.current,[\s\S]*?\.scoreboard-quarter-strip > button\.current\s*\{[^}]*border-color: #76a5b8;[^}]*background: #deedf3;[^}]*inset 0 2px 0 #4f89a1,/,
  );
  assert.match(dashboardSource, /metric-quarter-strip--resources/);
  assert.match(
    css,
    /\.metric-quarter-strip--resources > button\s*\{[^}]*min-height: 22px;[^}]*height: 22px;[\s\S]*?\.metric-quarter-strip--resources \+ \.metric-resource-grid\s*\{[^}]*min-height: 18px;[^}]*height: 18px;[^}]*margin-top: 3px;[^}]*padding-top: 0;/,
  );
  assert.match(
    css,
    /\.metric-quarter-strip--resources \+ \.metric-resource-grid\s*\{[^}]*gap: 4px;[\s\S]*?\.metric-quarter-strip--resources \+ \.metric-resource-grid \.metric-resource-group\s*\{[^}]*width: 100%;[^}]*gap: 4px;[\s\S]*?\.metric-quarter-strip--resources \+ \.metric-resource-grid \.metric-resource-control\s*\{[^}]*min-width: 0;[^}]*flex: 1 1 0;[\s\S]*?\.metric-quarter-strip--resources \+ \.metric-resource-grid \.metric-resource-button\s*\{[^}]*width: 100%;[^}]*min-width: 0;[^}]*flex: 1 1 0;/,
  );
  assert.match(
    css,
    /\.metric-resource-new\s*\{[^}]*top: -7px;[^}]*height: 12px;[^}]*color: #d9572b;[^}]*border: 1px solid #f36b37;[^}]*background: #fff7f3;[^}]*font-size: 5px;[^}]*font-weight: 400;/,
  );
  assert.match(
    css,
    /\.combat-card\.combat-scoreboard\s*\{[^}]*color: #f7fbfd;[^}]*linear-gradient\(135deg, #2b5265 0%, #3a6679 56%, #527e8f 100%\)/,
  );
  assert.match(
    css,
    /\.combat-card\.combat-scoreboard::after\s*\{[^}]*opacity: 0\.58;[^}]*radial-gradient/,
  );
  assert.match(
    css,
    /\.combat-scoreboard \.scoreboard-main-value,[\s\S]*?\.combat-scoreboard \.scoreboard-stat-chips strong\s*\{[^}]*color: #ffffff;/,
  );
  assert.doesNotMatch(dashboardSource, /signal-pill|className="metric-track"|DSC 평가점수/);
  assert.match(dashboardSource, /V3S_REPORT_SEEN_KEY/);
  assert.match(dashboardSource, /V3S_EVIDENCE_SEEN_KEY[\s\S]*?metric-resource-new/);
  assert.doesNotMatch(dashboardSource, /2026 SCORE BOARD|scoreboard-quarter-table|scoreboard-summary/);
  assert.doesNotMatch(dashboardSource, /combatSummaryStyles/);
  assert.doesNotMatch(dashboardSource, /Q1·Q2 평가 기준/);
  assert.doesNotMatch(css, /\.dsc-score-group::after[\s\S]*?DSC 종합평가/);
  assert.doesNotMatch(css, /\.quarter-score-row > i(?:\s|\{| b)/);
});

test("shows the showroom switcher only within the authenticated scope", async () => {
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
    /showroomAccess\.allowedCdsids\.includes\(item\.cdsid\)[\s\S]*?item\.cdsid !== selected\.cdsid/,
  );
  assert.match(
    dashboardSource,
    /showroomAccess\.role !== "manager" && switchableShowrooms\.length > 0/,
  );
  assert.match(
    dashboardSource,
    /canSwitchShowrooms \? \([\s\S]*?className="identity-profile"[\s\S]*?identity-profile--static/,
  );
  assert.match(
    dashboardSource,
    /aria-label=\{`현재 전시장을 제외한 \$\{switchableShowrooms\.length\}개 전시장`\}/,
  );
  assert.match(
    dashboardSource,
    /role="menu"[\s\S]*?className="profile-showroom-list"[\s\S]*?role="menuitem"/,
  );
  assert.match(
    dashboardSource,
    /className="identity-profile-menu"[\s\S]*?canSwitchShowrooms && profileOpen[\s\S]*?className="profile-popover"/,
  );
  assert.match(
    dashboardSource,
    /const profileMenuRef = useRef<HTMLDivElement>\(null\)/,
  );
  assert.match(
    dashboardSource,
    /if \(!profileOpen\) return;[\s\S]*?profileMenuRef\.current\?\.contains\(target\)[\s\S]*?setProfileOpen\(false\)[\s\S]*?document\.addEventListener\("pointerdown", closeProfileOnOutsidePointer\)/,
  );
  assert.match(
    dashboardSource,
    /className="identity-profile-menu" ref=\{profileMenuRef\}/,
  );
  assert.doesNotMatch(dashboardSource, /<select[\s\S]*?다른 전시장 선택/);
  assert.match(dashboardSource, /<strong>다른 전시장 선택<\/strong>/);
  assert.doesNotMatch(
    dashboardSource,
    /<span>\{dashboard\.showrooms\.length - 1\}개 전시장<\/span>/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /\{viewer\.isEditor \? \([\s\S]*?<select/,
  );
  assert.match(
    css,
    /\.identity-profile\.identity-profile--static::after\s*\{[^}]*content: none;/,
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
  assert.doesNotMatch(dashboardSource, /resetPageScrollForHeaderNavigation/);
  assert.doesNotMatch(analysisSource, /resetPageScrollForHeaderNavigation/);
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
    /\.one-voice-gauge-endpoint\s*\{[^}]*inset: 4px[^}]*rotate\([\s\S]*?var\(--one-voice-target\) \* 3\.6deg/,
  );
  assert.doesNotMatch(css, /--one-voice-progress: inherit/);
  assert.match(
    css,
    /\.one-voice-contribution\.is-visible \.one-voice-gauge-endpoint\s*\{[^}]*animation: one-voice-endpoint-sweep[\s\S]*?both/,
  );
  assert.match(
    css,
    /@keyframes one-voice-endpoint-sweep\s*\{[\s\S]*?from\s*\{[^}]*rotate\(-90deg\)[\s\S]*?to\s*\{[\s\S]*?var\(--one-voice-target\) \* 3\.6deg/,
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

  assert.match(dashboardSource, /carHandoverScore: 94\.2/);
  assert.match(dashboardSource, /testDriveScore: 89\.3/);
  assert.match(dashboardSource, /capturedAt: "2026-09-14T00:00:00\+09:00"/);
  assert.match(dashboardSource, /snapshotCapturedAt <= currentCapturedAt/);
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
    /@media \(min-width: 761px\)\s*\{\s*\.competitive-analysis-page > \.analysis-workspace\s*\{[^}]*position: relative;[^}]*top: -2px;/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header > \.identity-detail-rail,[\s\S]*?\.dashboard-identity-header > \.analysis-context\s*\{[^}]*margin-left: auto/,
  );
});

test("removes the score insight panel from both dashboard headers", async () => {
  const [headerSource, dashboardSource, analysisSource] = await Promise.all([
    readFile(new URL("../app/DashboardHeaderLead.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(headerSource, /identity-insights|identity-insight-row/);
  assert.doesNotMatch(dashboardSource, /insights=|insightLabel=|buildShowroomInsights/);
  assert.doesNotMatch(analysisSource, /insights=|insightLabel=|buildShowroomInsights/);
});

test("reserves the root scrollbar gutter across dashboard routes", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /html\s*\{[^}]*scrollbar-gutter: stable/);
});

test("keeps the shared header icon row and score units compact", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.header-status-row\s*\{[^}]*font-size: 9px/);
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
    6,
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
  assert.doesNotMatch(css, /\.analysis-sticky-shell\s*\{[^}]*padding-bottom: 22px/);
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
  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.dashboard-sticky-anchor,[\s\S]*?\.analysis-sticky-anchor\s*\{[^}]*min-height: 356px/,
  );
  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.dashboard-sticky-shell,[\s\S]*?\.analysis-sticky-shell\s*\{[^}]*height: 342px[^}]*min-height: 342px/,
  );
  assert.match(
    css,
    /\.analysis-sticky-shell \.analysis-summary-card\s*\{[^}]*height: 150px[^}]*min-height: 150px/,
  );
  assert.match(
    analysisSource,
    /anchor\.style\.height = `\$\{shellHeight\}px`;[\s\S]*?anchor\.style\.removeProperty\("min-height"\);/,
  );
  assert.equal(
    (analysisSource.match(/anchor\.style\.removeProperty\("min-height"\)/g) ?? []).length,
    4,
  );
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

test("matches every rectangular dashboard surface to the ES90 radius", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /--es90-surface-radius: 6px/);
  assert.match(
    css,
    /\.dsc-score-group\s*\{[^}]*border-radius: var\(--es90-surface-radius\)/,
  );
  assert.match(
    css,
    /\.combat-card\.combat-scoreboard\s*\{[^}]*border-radius: var\(--es90-surface-radius\)/,
  );
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
    /@media \(min-width: 761px\) and \(max-width: 1240px\)[\s\S]*?\.weekly-score-layout > \.trend-wrap\.compact \.trend-canvas\s*\{[^}]*grid-template-rows: 150px auto auto;[^}]*\}[\s\S]*?\.weekly-score-layout > \.trend-wrap\.compact \.trend-chart\s*\{[^}]*height: 150px;[^}]*min-height: 150px;[^}]*max-height: 150px;[^}]*align-self: stretch/,
  );
  assert.match(
    css,
    /@media \(min-width: 761px\) and \(max-width: 1240px\)[\s\S]*?\.weekly-score-layout \.trend-wrap\.compact \.actual-point-value,[\s\S]*?\.weekly-score-layout \.trend-wrap\.compact \.national-point-value\s*\{[^}]*font-stretch: normal;[^}]*font-synthesis: none;/,
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
    /\.analysis-tabs button\s*\{[^}]*min-height: 36px[^}]*padding: 0 12px/,
  );
  assert.match(
    css,
    /\.analysis-tabs button\.active\s*\{[^}]*background: linear-gradient\(135deg, #4f7f99, #38657e\)[^}]*box-shadow:/,
  );
  assert.match(
    css,
    /\.analysis-tabs button \+ button::before\s*\{[^}]*left: -3px;[^}]*width: 1px;[^}]*height: 22px;[^}]*background: rgba\(64, 91, 108, 0\.2\);/,
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
    /header-status-item--guide[\s\S]*?aria-haspopup="dialog"[\s\S]*?DSC 가이드[\s\S]*?<DscGuideViewer/,
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
    /\.login-rule\s*\{[^}]*width: min\(290px, 100%\);[^}]*height: 5px;[^}]*margin: 14px 0 10px;[^}]*linear-gradient\(90deg, #f47b3f[^}]*clip-path: polygon\(0 4%, 0 96%, 100% 50%\)/,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)\s*\{[\s\S]*?\.login-rule\s*\{[^}]*width: min\(232px, 100%\);[^}]*margin: 14px 0 8px;/,
  );
  assert.match(
    css,
    /\.login-panel\s*\{[\s\S]*?rgba\(5, 17, 25, 0\.86\) 0%[\s\S]*?rgba\(7, 20, 29, 0\.5\) 64%[\s\S]*?rgba\(7, 20, 29, 0\.05\) 93%[\s\S]*?rgba\(7, 20, 29, 0\) 100%/,
  );
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
  assert.doesNotMatch(css, /\.signal-icon(?:\.|\s*\{)/);
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
    /\.analysis-summary-card > em\.positive\s*\{\s*color: var\(--comparison-positive-blue\) !important;/,
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
    /\.scatter-point\.label-right-up > b::before,[\s\S]*?left: calc\(-1 \* var\(--callout-tail-x\)\)[\s\S]*?clip-path: polygon\(calc\(100% - 7px\) 0, 100% 0, 0 100%\)/,
  );
  assert.match(
    css,
    /\.scatter-point\.label-right-down > b::before,[\s\S]*?top: calc\(-1 \* var\(--callout-tail-y\)\)[\s\S]*?clip-path: polygon\(0 0, calc\(100% - 7px\) 100%, 100% 100%\)/,
  );
  assert.match(css, /--callout-border: color-mix\(in srgb, var\(--callout-color\) 58%, white\)/);
  assert.match(css, /\.scatter-point > b\s*\{[\s\S]*?width:\s*var\(--callout-width\);[\s\S]*?height:\s*var\(--callout-height\);/);
  assert.match(
    css,
    /\.scatter-average-value\.horizontal\s*\{[^}]*left: 12px[^}]*display: flex[^}]*flex-direction: column/,
  );
  assert.match(
    css,
    /\.scatter-average-value\.vertical\s*\{[^}]*left: var\(--avg-x\)[^}]*bottom: 12px[^}]*display: flex[^}]*flex-direction: column/,
  );
  assert.match(analysisSource, /--callout-tail-x/);
  assert.match(analysisSource, /--callout-width/);
  assert.match(
    analysisSource,
    /tailX: Math\.round\(Math\.max\(3, Math\.abs\(anchorX\)\)\)[\s\S]*?tailY: Math\.round\(Math\.max\(3, Math\.abs\(anchorY\)\)\)/,
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
    /\/\* ES90-inspired shared command banner preview \*\/[\s\S]*?\.dashboard-identity-header\s*\{[^}]*border-bottom: 0[^}]*#0b2b3d 0%[^}]*#10364b 42%[^}]*#18465f 72%[^}]*#1f5871 100%/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header::before\s*\{[^}]*inset: 0;[^}]*transparent 48%[^}]*rgba\(152, 205, 228, 0\.016\) 62%[^}]*rgba\(152, 205, 228, 0\.04\) 82%[^}]*rgba\(152, 205, 228, 0\.065\) 100%[^}]*rgba\(3, 25, 39, 0\.1\) 100%/,
  );
  assert.match(
    css,
    /\.dashboard-identity-header::after\s*\{[^}]*opacity: 0\.72[^}]*radial-gradient\([\s\S]*?circle at 92% -46%[\s\S]*?219px 220px/,
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
    /\.dashboard-identity-header \.identity-title h1,[\s\S]*?\.dashboard-identity-header\.analysis-header h1\s*\{[^}]*font-size: clamp\(38px, 3vw, 43px\)[^}]*font-weight: 780/,
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
    /@media \(min-width: 761px\)[\s\S]*?\.dashboard-identity-header > \.identity-detail-rail,[\s\S]*?\.dashboard-identity-header > \.analysis-context\s*\{[^}]*width: calc\(\(100% - var\(--dashboard-combat-share\) - 24px\) \/ 3\)[^}]*flex: 0 0 calc\(\(100% - var\(--dashboard-combat-share\) - 24px\) \/ 3\)/,
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
    /const selectedIntegratedAverage = Number\([\s\S]*?kpis\.reduce\(\(sum, item\) => sum \+ item\.average, 0\)\.toFixed\(1\)/,
  );
  assert.match(
    dashboardSource,
    /const competitionRankOf =[\s\S]*?score > selectedScore[\s\S]*?const selectedIntegratedRank = competitionRankOf\(selectedIntegratedScoreOf\)/,
  );
  assert.match(
    css,
    /\.scoreboard-primary-score > strong\s*\{[^}]*font-size: clamp\(42px, 3vw, 49px\)/,
  );
  assert.match(
    css,
    /\.scatter-y-title\s*\{[^}]*writing-mode: vertical-rl[^}]*text-orientation: upright/,
  );
  assert.match(
    css,
    /\.scatter-y-title\s*\{[^}]*position: absolute[^}]*top: 10px[^}]*bottom: 26px[^}]*left: 4px[^}]*width: 22px[^}]*contain: layout paint/,
  );
  assert.match(
    css,
    /\.analysis-scatter\s*\{[^}]*grid-row: 1[^}]*grid-column: 2[^}]*min-width: 0[^}]*min-height: 0/,
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
    /\.v3s-peer-bar\s*\{[\s\S]*?width: 28px[\s\S]*?min-width: 28px[\s\S]*?animation: v3s-bar-rise 760ms/,
  );
  assert.match(
    css,
    /\.v3s-bar-cluster\s*\{[\s\S]*?width: min\(96%, 124px\)[\s\S]*?gap: 4px[\s\S]*?\.v3s-peer-bar-group\s*\{[\s\S]*?width: 92px[\s\S]*?flex: 0 0 92px[\s\S]*?gap: 4px/,
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
    /\.v3s-history-years,\s*\.voc-consultation-pair > small\s*\{[^}]*color: var\(--muted\);[^}]*font-family: var\(--font-latin\);[^}]*font-size: 9px;[^}]*font-weight: 400;[^}]*font-variant-numeric: tabular-nums;[^}]*line-height: 1;[^}]*text-align: center;/,
  );
  assert.match(
    css,
    /\.voc-consultation-pair > small\s*\{[^}]*width: 100%;[^}]*top: calc\(100% \+ 7px\);[^}]*left: 0;[^}]*align-items: center;[^}]*transform: none;/,
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
    /\.v3s-peer-bar b\s*\{[^}]*top: 50%[^}]*font-size: 11px[^}]*transform: translate\(-50%, -50%\)/,
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
    /\.v3s-performance\.compact \.v3s-history-bar-stage\s*\{[^}]*height: 92px/,
  );
  assert.match(
    css,
    /\.v3s-performance\.compact \.v3s-history-bars\s*\{[^}]*padding-top: 3px/,
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
    /\.voc-consultation-pair > small\s*\{[^}]*width: 100%;[^}]*top: calc\(100% \+ 7px\);[^}]*left: 0;[^}]*align-items: center;[^}]*transform: none;/,
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
    /\.voc-response-rate-point i\s*\{[^}]*width: 6\.6px;[^}]*height: 6\.6px;[^}]*border: 1\.5px solid var\(--es90-orange\);[^}]*transform: translate\(-50%, -50%\) rotate\(45deg\);/,
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
    /@media \(min-width: 761px\) and \(max-width: 1240px\)\s*\{[\s\S]*?\.analysis-sticky-anchor\s*\{[^}]*min-height: 346px[^}]*\}[\s\S]*?\.analysis-workspace\s*\{[^}]*height: 489px[^}]*min-height: 489px[^}]*contain: layout/,
  );
  assert.match(
    css,
    /@media \(min-width: 1241px\)\s*\{[\s\S]*?\.analysis-sticky-anchor\s*\{[^}]*min-height: 356px[^}]*\}[\s\S]*?\.analysis-workspace\s*\{[^}]*height: 480px[^}]*min-height: 480px[^}]*contain: layout/,
  );
  assert.match(css, /\.analysis-workspace\s*\{[^}]*var\(--dashboard-sticky-content-gutter\)[^}]*minmax\(0, 1fr\)[^}]*var\(--dashboard-card-gap\)[^}]*minmax\(0, 1fr\)[^}]*var\(--dashboard-card-gap\)[^}]*minmax\(0, 1fr\)[^}]*var\(--dashboard-sticky-content-gutter\)[^}]*gap: 0;/);
  assert.match(css, /\.analysis-scatter-card\s*\{[^}]*grid-column: 1 \/ 5;/);
  assert.match(css, /\.analysis-ranking-card\s*\{[^}]*grid-column: 6 \/ 8;/);
  assert.match(
    css,
    /\.analysis-ranking-list\s*\{[^}]*min-height: 0[^}]*overflow-y: auto[^}]*scrollbar-gutter: stable/,
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
    /\/\* ES90 performance-comparison title typography for dashboard score headings \*\/[\s\S]*?\.trend-panel \.score-stack-heading h2,[\s\S]*?\.v3s-performance\.compact \.v3s-subhead h3,[\s\S]*?\.voc-consultation-heading > div:first-child > strong,[\s\S]*?\.metric-detail-card h2\s*\{([^}]*)\}/,
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
    /<h3 className="score-tier-side-title">\s*<span className="english-title">5<\/span>개년 추이\s*<\/h3>/,
  );
  assert.match(
    dashboardSource,
    /<h3 className="score-tier-side-title">\s*<span className="english-title">4<\/span>개년 추이\s*<\/h3>/,
  );
  assert.doesNotMatch(dashboardSource, /<span className="english-title">V3S<\/span> 5개년 추이/);
  assert.match(
    css,
    /\/\* Shared Volvo English title typography \*\/[\s\S]*?\.v3s-subhead \.english-title,[\s\S]*?\.voc-consultation-heading \.english-title,[\s\S]*?\.score-tier-heading \.english-title,[\s\S]*?\.score-tier-side-title\.english-title\s*\{([^}]*)\}/,
  );
  const englishRule = css.match(
    /\/\* Shared Volvo English title typography \*\/[\s\S]*?\.score-tier-side-title\.english-title\s*\{([^}]*)\}/,
  );
  assert.ok(englishRule);
  assert.match(englishRule[1], /font-family: var\(--font-latin\);/);
  assert.match(englishRule[1], /font-weight: 800;/);
  assert.match(englishRule[1], /letter-spacing: 0\.02em;/);
  assert.doesNotMatch(englishRule[1], /font-size:/);
  assert.match(
    css,
    /\.voc-consultation-comparison > b\s*\{[^}]*font-size: 8\.5px;/,
  );
});

test("drops the four headline scores in ES90-style sequential timing", async () => {
  const [dashboardSource, css] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(dashboardSource, /function AnimatedScore\(/);
  assert.match(
    dashboardSource,
    /120 \+ sequence \* 180/,
  );
  assert.doesNotMatch(dashboardSource, /animated-score-digit/);
  assert.match(dashboardSource, /animationSequence=\{index\}/);
  assert.match(dashboardSource, /sequence=\{3\}/);
  assert.match(
    css,
    /\.animated-score\s*\{[^}]*animation: metric-score-drop 1\.45s cubic-bezier\(0\.22, 1, 0\.36, 1\)/,
  );
  assert.match(
    css,
    /@keyframes metric-score-drop\s*\{[\s\S]*?translateY\(-18px\)[\s\S]*?translateY\(1px\)[\s\S]*?translateY\(0\)/,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.animated-score,[\s\S]*?animation: none/,
  );
});

test("matches analysis headings to the ES90 performance-comparison title at 70 percent size", async () => {
  const [analysisSource, css] = await Promise.all([
    readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const titleRule = css.match(
    /\/\* ES90 performance-comparison title typography at 70% of the prior size \*\/[\s\S]*?\.analysis-card-heading h2,[\s\S]*?\.analysis-staff-heading h2\s*\{([^}]*)\}/,
  );

  assert.ok(titleRule);
  assert.match(titleRule[1], /font-family: var\(--font-korean\);/);
  assert.match(titleRule[1], /font-size: 14px;/);
  assert.match(titleRule[1], /font-weight: 600;/);
  assert.match(titleRule[1], /letter-spacing: -0\.25px;/);

  assert.match(analysisSource, /className="analysis-title-awards"/);
  assert.match(analysisSource, /className="analysis-title-award"/);
  const awardGroupRule = css.match(/\.analysis-title-awards\s*\{([^}]*)\}/);
  assert.ok(awardGroupRule);
  assert.match(awardGroupRule[1], /align-self: flex-end;/);
  assert.doesNotMatch(awardGroupRule[1], /transform:/);
  assert.match(
    analysisSource,
    /<span className="english-title">\{selected\.size\}<\/span> 사이즈 내 순위/,
  );
  const mixedEnglishRule = css.match(
    /\/\* Volvo Centum for English inside mixed Korean analysis titles \*\/[\s\S]*?\.analysis-card-heading \.english-title,[\s\S]*?\.analysis-staff-heading \.english-title\s*\{([^}]*)\}/,
  );
  assert.ok(mixedEnglishRule);
  assert.match(mixedEnglishRule[1], /font-family: var\(--font-latin\);/);
  assert.doesNotMatch(mixedEnglishRule[1], /font-size:/);
});

test("removes the V3S cumulative average label and aligns the expanded quarter chart", async () => {
  const [dashboardSource, summaryCss] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/V3SQuarterSummary.module.css", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(dashboardSource, /2026 누적 평균/);
  assert.doesNotMatch(
    dashboardSource,
    /v3sQuarterSummaryStyles\.(?:inlineCumulative|compactSubhead|compactCumulative|value|unit)/,
  );
  assert.doesNotMatch(
    summaryCss,
    /\.(?:inlineCumulative|compactSubhead|compactCumulative)/,
  );
  assert.match(summaryCss, /\.compactBars\s*\{[^}]*height: 126px !important/);
  assert.match(
    summaryCss,
    /\.compactBars \.compactStage\s*\{[^}]*height: 92px !important/,
  );
  assert.match(
    dashboardSource,
    /className="v3s-quarter-legend"[\s\S]*?displayShowroomNameWithoutBrand\(showroom\.showroom\)[\s\S]*?legend-average" \/> 전국 평균/,
  );
});

test("provides accessible, privacy-safe V3S Q1 and Q2 evidence galleries for every mapped showroom", async () => {
  const [dashboardSource, gallerySource, galleryCss] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/V3SEvidenceGallery.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/V3SEvidenceGallery.module.css", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    dashboardSource,
    /getV3sEvidence\(selected\.cdsid, quarter\)\.length > 0/,
  );
  assert.match(dashboardSource, /V3S \$\{resourceLabel\} 증빙사진/);
  assert.match(dashboardSource, /onEvidenceOpen\?\.\(resourceQuarter\)/);
  assert.doesNotMatch(dashboardSource, /교차검증 후, 사후보정 가능/);
  assert.match(dashboardSource, /<V3SEvidenceGallery/);
  const q1ShowroomIds = [
    "6KR6802",
    "6KR6830",
    "6KR6833",
    "6KR6838",
    "6KR6839",
    "6KR6841",
    "6KR6845",
    "6KR6851",
    "6KR6852",
    "6KR6863",
  ];
  q1ShowroomIds.forEach((cdsid) => {
    assert.match(gallerySource, new RegExp(`"${cdsid}"[\\s\\S]*?q1:`));
  });
  const q2ShowroomIds = [
    "6KR6834",
    "6KR6841",
    "6KR6842",
    "6KR6846",
    "6KR6847",
    "6KR6852",
    "6KR6863",
    "6KR6870",
    "6KR6874",
  ];
  q2ShowroomIds.forEach((cdsid) => {
    assert.match(gallerySource, new RegExp(`"${cdsid}"[\\s\\S]*?q2:`));
  });
  const q1EvidenceAssets = [
    "6KR6802/v3s/2026-q1/uniform-brand-manager-spring-fall.jpg",
    "6KR6802/v3s/2026-q1/uniform-sales-winter-mosaic.jpg",
    "6KR6802/v3s/2026-q1/brand-manager-nails-mosaic.jpg",
    "6KR6830/v3s/2026-q1/uniform-brand-manager-spring-fall-mosaic.jpg",
    "6KR6830/v3s/2026-q1/uniform-sales-winter-name-tag-mosaic.jpg",
    "6KR6830/v3s/2026-q1/valet-name-tag-white-shoes-mosaic.jpg",
    "6KR6830/v3s/2026-q1/valet-name-tag-mosaic.jpg",
    "6KR6833/v3s/2026-q1/valet-sports-shoes-mosaic.jpg",
    "6KR6838/v3s/2026-q1/uniform-brand-manager-spring-fall-mosaic.jpg",
    "6KR6838/v3s/2026-q1/uniform-sales-winter-mosaic.jpg",
    "6KR6839/v3s/2026-q1/brand-manager-nails.jpg",
    "6KR6841/v3s/2026-q1/waiting-area-break-mosaic.jpg",
    "6KR6841/v3s/2026-q1/brand-manager-volvo-badge-mosaic.jpg",
    "6KR6841/v3s/2026-q1/sales-name-tag-mosaic.jpg",
    "6KR6841/v3s/2026-q1/info-desk-takeout-cup-mosaic.jpg",
    "6KR6845/v3s/2026-q1/brand-manager-phone-use-mosaic.jpg",
    "6KR6851/v3s/2026-q1/vehicle-customer-trace-hair.jpg",
    "6KR6852/v3s/2026-q1/vehicle-dust-debris.jpg",
    "6KR6863/v3s/2026-q1/uniform-brand-manager-spring-fall-mosaic.jpg",
    "6KR6863/v3s/2026-q1/uniform-sales-winter-mosaic.jpg",
  ];
  const q2EvidenceAssets = [
    "6KR6834/v3s/2026-q2/valet-name-tag-mosaic.png",
    "6KR6834/v3s/2026-q2/brand-manager-badge-mosaic.png",
    "6KR6841/v3s/2026-q2/uniform-season-mismatch-mosaic.png",
    "6KR6841/v3s/2026-q2/laptop-left-unattended-mosaic.png",
    "6KR6841/v3s/2026-q2/valet-black-round-shirt-mosaic.png",
    "6KR6841/v3s/2026-q2/unnecessary-items-left.jpg",
    "6KR6841/v3s/2026-q2/consultation-shoes-mosaic.png",
    "6KR6841/v3s/2026-q2/uniform-guide-noncompliance-mosaic.png",
    "6KR6842/v3s/2026-q2/employee-name-tag-mosaic.png",
    "6KR6846/v3s/2026-q2/uniform-season-mismatch-mosaic.png",
    "6KR6846/v3s/2026-q2/brand-manager-name-tag-mosaic.png",
    "6KR6847/v3s/2026-q2/brand-manager-long-hair-phone-mosaic.png",
    "6KR6847/v3s/2026-q2/phone-use-mosaic.png",
    "6KR6852/v3s/2026-q2/valet-name-tag-mosaic.png",
    "6KR6863/v3s/2026-q2/waiting-posture-1-mosaic.png",
    "6KR6863/v3s/2026-q2/waiting-posture-2.jpg",
    "6KR6863/v3s/2026-q2/info-desk-personal-cup.jpg",
    "6KR6863/v3s/2026-q2/podium-personal-tumbler.jpg",
    "6KR6870/v3s/2026-q2/uniform-season-mismatch-mosaic.png",
    "6KR6870/v3s/2026-q2/specialist-bottoms-mosaic.png",
    "6KR6874/v3s/2026-q2/brand-manager-volvo-badge-mosaic.png",
  ];
  const evidenceAssets = [...q1EvidenceAssets, ...q2EvidenceAssets];
  assert.equal(q1EvidenceAssets.length, 20);
  assert.equal(q2EvidenceAssets.length, 21);
  assert.equal(evidenceAssets.length, 41);
  evidenceAssets.forEach((asset) => {
    assert.match(gallerySource, new RegExp(asset.replaceAll(".", "\\.")));
  });
  assert.match(gallerySource, /aria-modal="true"/);
  assert.match(
    gallerySource,
    /className=\{styles\.latinTitle\}>V3S \{quarterLabel\}<\/span>/,
  );
  assert.match(
    galleryCss,
    /\.latinTitle\s*\{[^}]*font-family: var\(--font-volvo\)/,
  );
  assert.match(gallerySource, /aria-label="증빙사진 닫기"/);
  assert.match(gallerySource, /event\.key === "Escape"/);
  assert.match(gallerySource, /모든 얼굴은 모자이크 처리했습니다\./);
  assert.doesNotMatch(gallerySource, /모든 얼굴은 익명화했습니다\./);
  assert.doesNotMatch(gallerySource, /얼굴 익명화 완료/);
  assert.doesNotMatch(gallerySource, /X 버튼·바깥 영역·Esc 키/);
  assert.match(galleryCss, /grid-template-columns: repeat\(auto-fit,/);
  assert.match(galleryCss, /object-fit: contain/);

  await Promise.all(
    evidenceAssets.map((asset) =>
      access(new URL(`../public/evidence/${asset}`, import.meta.url)),
    ),
  );
});

test("maps all 39 V3S Q1 and Q2 reports and presents them in an iPad landscape viewer", async () => {
  const [dashboardSource, viewerSource, viewerCss] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/V3SReportViewer.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/V3SReportViewer.module.css", import.meta.url),
      "utf8",
    ),
  ]);

  const reportPageCounts = [
    ...viewerSource.matchAll(/"(6KR\d+):(q[12])": (\d+)/g),
  ].map((match) => ({
    cdsid: match[1],
    quarter: match[2],
    pageCount: Number(match[3]),
  }));
  assert.equal(reportPageCounts.length, 78);
  assert.equal(
    reportPageCounts.reduce((total, report) => total + report.pageCount, 0),
    284,
  );
  const reportCdsids = [...new Set(reportPageCounts.map((report) => report.cdsid))];
  assert.equal(new Set(reportCdsids).size, 39);

  await Promise.all(
    reportPageCounts.flatMap(({ cdsid, quarter, pageCount }) => [
      access(
        new URL(
          `../public/reports/${cdsid}/v3s/2026-${quarter}.pdf`,
          import.meta.url,
        ),
      ),
      ...Array.from({ length: pageCount }, (_, index) =>
        access(
          new URL(
            `../public/reports/${cdsid}/v3s/2026-${quarter}/page-${String(index + 1).padStart(2, "0")}.jpg`,
            import.meta.url,
          ),
        ),
      ),
    ]),
  );

  assert.match(dashboardSource, /getV3sReport\(selected\.cdsid, quarter\) !== null/);
  assert.match(dashboardSource, /onReportOpen\?\.\(resourceQuarter\)/);
  assert.match(dashboardSource, /<V3SReportViewer/);
  assert.match(viewerSource, /getV3sReportPageCount/);
  assert.match(viewerSource, /2026-\$\{quarter\}\.pdf/);
  assert.doesNotMatch(viewerSource, /<iframe/);
  assert.doesNotMatch(viewerSource, /새 창/);
  assert.doesNotMatch(viewerSource, /#view=/);
  assert.match(viewerSource, /aria-label="V3S 결과 보고서 닫기"/);
  assert.match(viewerSource, /event\.key === "Escape"/);
  assert.match(viewerSource, /moveOnePageOnWheel/);
  assert.match(viewerSource, /moveOnePageOnTouch/);
  assert.match(viewerSource, /addEventListener\("wheel"[\s\S]*?passive: false/);
  assert.match(viewerSource, /pages\.scrollTo\(/);
  assert.match(viewerSource, /page-\$\{String\(pageNumber\)\.padStart\(2, "0"\)\}\.jpg/);
  assert.match(
    viewerSource,
    /document\.documentElement\.style\.scrollbarGutter = "auto"/,
  );
  assert.match(
    viewerCss,
    /\.backdrop,\s*\.dialog\s*\{[^}]*position: fixed;[^}]*inset: 0;/,
  );
  assert.match(
    viewerCss,
    /\.pages\s*\{[^}]*height: 100%;[^}]*scroll-snap-type: y mandatory;[^}]*touch-action: none;/,
  );
  assert.match(
    viewerCss,
    /\.page\s*\{[^}]*height: 100%;[^}]*min-height: 100%;[^}]*scroll-snap-align: start;[^}]*scroll-snap-stop: always;/,
  );
  assert.match(
    viewerCss,
    /\.page img\s*\{[^}]*position: absolute;[^}]*inset: 0;[^}]*width: 100%;[^}]*height: 100%;[^}]*object-fit: contain;/,
  );
  assert.match(
    viewerCss,
    /\.header\s*\{[^}]*position: absolute;[^}]*z-index: 5;/,
  );
  assert.match(
    viewerCss,
    /\.close\s*\{[^}]*width: 43px;[^}]*height: 43px;[^}]*border-radius: 50%;/,
  );
});

test("opens the 13-page DSC guide in a full-screen snap viewer", async () => {
  const [headerSource, viewerSource, viewerCss] = await Promise.all([
    readFile(new URL("../app/DashboardHeaderLead.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/DscGuideViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/DscGuideViewer.module.css", import.meta.url), "utf8"),
  ]);

  await access(
    new URL(
      "../public/guides/dsc-competence-2026/2026-rtc-dsc-competence-guide.pdf",
      import.meta.url,
    ),
  );
  await Promise.all(
    Array.from({ length: 13 }, (_, index) =>
      access(
        new URL(
          `../public/guides/dsc-competence-2026/pages/page-${String(index + 1).padStart(2, "0")}.jpg`,
          import.meta.url,
        ),
      ),
    ),
  );

  assert.match(headerSource, /header-status-icon--guide[\s\S]*?DSC 가이드/);
  assert.match(headerSource, /aria-haspopup="dialog"/);
  assert.match(viewerSource, /const PAGE_COUNT = 13/);
  assert.match(viewerSource, /aria-label="DSC 가이드 닫기"/);
  assert.match(viewerSource, /event\.key === "Escape"/);
  assert.match(viewerSource, /IntersectionObserver/);
  assert.match(viewerCss, /\.backdrop[\s\S]*?position: fixed;[\s\S]*?z-index: 12000/);
  assert.match(viewerCss, /\.pages\s*\{[^}]*scroll-snap-type: y mandatory/);
  assert.match(viewerCss, /\.page\s*\{[^}]*height: 100dvh[^}]*scroll-snap-stop: always/);
  assert.match(viewerCss, /\.closeButton\s*\{[^}]*justify-self: end/);
});

test("keeps the dense score rail stable when Edge enforces a minimum font size", async () => {
  const [css, dashboardSource, layoutSource, pagesSource] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../github-pages/main.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    layoutSource,
    /\/Edg\\\\\/\/.+documentElement\.dataset\.browser = \"edge-desktop\"/,
  );
  assert.match(
    css,
    /html\[data-browser="edge-desktop"\]\s*\{[^}]*-webkit-text-size-adjust: 100%;[^}]*text-size-adjust: 100%;/,
  );
  assert.match(
    css,
    /html\[data-browser="edge-desktop"\] \.analysis-title-award-count\s*\{[^}]*margin-left: 6px;[^}]*font-size: 16px;[^}]*line-height: 1\.05;[^}]*zoom: 0\.5;/,
  );
  assert.match(
    css,
    /html\[data-browser="edge-desktop"\] \.metric-stat-chips > span\s*\{[^}]*width: 100%;[^}]*min-height: 33\.6px;[^}]*font-size: 12px;[^}]*zoom: 0\.625;/,
  );
  assert.match(
    css,
    /html\[data-browser="edge-desktop"\][\s\S]*?\.metric-quarter-strip--status[\s\S]*?\.scoreboard-quarter-strip > button strong\s*\{[^}]*width: 73\.6px;[^}]*height: 28\.8px;[^}]*font-size: 12px;[^}]*zoom: 0\.625;/,
  );
  assert.doesNotMatch(layoutSource, /EdgiOS/);
  assert.match(
    pagesSource,
    /\/Edg\\\/\/.+navigator\.userAgent[\s\S]*?dataset\.browser = "edge-desktop"/,
  );
  assert.doesNotMatch(pagesSource, /EdgiOS/);
  assert.equal(
    (dashboardSource.match(/className="metric-resource-new"[\s\S]*?<span>NEW<\/span>/g) ?? [])
      .length,
    2,
  );
});

test("keeps ranking metadata one pixel larger without changing row geometry", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.analysis-rank small\s*\{[^}]*font-size:\s*9px;[^}]*white-space:\s*nowrap;/,
  );
  assert.match(
    css,
    /\.analysis-ranking-list > div\s*\{[^}]*min-height:\s*40px;[^}]*padding:\s*5px 8px;/,
  );
});
