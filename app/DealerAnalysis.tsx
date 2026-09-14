"use client";

import Link from "next/link";
import dashboardJson from "./data/showrooms.json";
import vocStaffAnalysisJson from "./data/voc-staff-analysis.json";
import salesActivityAnalysisJson from "./data/sales-activity-analysis.json";
import staffCertificationsJson from "./data/staff-certifications.json";

type Showroom = { cdsid: string; showroom: string; dealer: string };
type Certification = {
  year: number;
  name: string;
  showroom: string;
  level: "Grand" | "Advanced" | "Certified";
};
type VocShowroom = {
  dealer: string;
  employees: { name: string }[];
};
type SalesShowroom = {
  summary: { deliveredSales: number };
};

const dealerOrder = ["아주", "천하", "에이치", "아이언", "아이비", "코오롱", "태영"];
const years = staffCertificationsJson.sourceYears as number[];
const showrooms = dashboardJson.showrooms as Showroom[];
const certifications = staffCertificationsJson.records as Certification[];
const vocShowrooms = vocStaffAnalysisJson.showrooms as Record<string, VocShowroom>;
const salesShowrooms = salesActivityAnalysisJson.showrooms as Record<string, SalesShowroom>;

const showroomAliases: Record<string, string> = {
  대치: "강남대치",
  신사: "강남신사",
  분당서현: "분당",
  판교: "분당판교",
};

function normalizeShowroom(value: string) {
  const normalized = value.replace(/^볼보\s*/, "").replace(/\s+/g, "");
  return showroomAliases[normalized] ?? normalized;
}

function formatCompactDate(value?: string) {
  if (!value) return "기준일 확인 중";
  return `${value.slice(2, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)} 기준`;
}

const showroomDealer = new Map(
  showrooms.map((showroom) => [normalizeShowroom(showroom.showroom), showroom.dealer]),
);

const currentDealersByName = new Map<string, Set<string>>();
for (const showroom of Object.values(vocShowrooms)) {
  for (const employee of showroom.employees) {
    const dealers = currentDealersByName.get(employee.name) ?? new Set<string>();
    dealers.add(showroom.dealer);
    currentDealersByName.set(employee.name, dealers);
  }
}

function certificationDealer(record: Certification) {
  const mapped = showroomDealer.get(normalizeShowroom(record.showroom));
  if (mapped) return mapped;
  const currentDealers = currentDealersByName.get(record.name);
  return currentDealers?.size === 1 ? [...currentDealers][0] : null;
}

const dealerRows = dealerOrder.map((dealer) => {
  const dealerShowrooms = showrooms.filter((showroom) => showroom.dealer === dealer);
  const cdsids = new Set(dealerShowrooms.map((showroom) => showroom.cdsid));
  const currentNames = new Set(
    dealerShowrooms.flatMap((showroom) =>
      (vocShowrooms[showroom.cdsid]?.employees ?? []).map((employee) => employee.name),
    ),
  );
  const dealerCertifications = certifications.filter(
    (record) => certificationDealer(record) === dealer,
  );
  const certifiedNames = new Set(dealerCertifications.map((record) => record.name));
  const currentCertified = [...currentNames].filter((name) =>
    certifications.some((record) => record.name === name),
  ).length;
  const currentUnmatched = [...certifiedNames].filter((name) => !currentNames.has(name)).length;
  const levelCounts = {
    Grand: dealerCertifications.filter((record) => record.level === "Grand").length,
    Advanced: dealerCertifications.filter((record) => record.level === "Advanced").length,
    Certified: dealerCertifications.filter((record) => record.level === "Certified").length,
  };
  const annual = years.map((year) =>
    dealerCertifications.filter((record) => record.year === year).length,
  );
  const sales = [...cdsids].reduce(
    (sum, cdsid) => sum + (salesShowrooms[cdsid]?.summary.deliveredSales ?? 0),
    0,
  );
  return {
    dealer,
    showroomCount: dealerShowrooms.length,
    currentStaff: currentNames.size,
    sales,
    certificationCount: dealerCertifications.length,
    currentCertified,
    currentUnmatched,
    levelCounts,
    annual,
  };
});

const annualMaximum = Math.max(1, ...dealerRows.flatMap((row) => row.annual));
const totalSales = dealerRows.reduce((sum, row) => sum + row.sales, 0);
const totalStaff = dealerRows.reduce((sum, row) => sum + row.currentStaff, 0);
const totalCertifications = dealerRows.reduce((sum, row) => sum + row.certificationCount, 0);

export default function DealerAnalysis({ initialCdsid }: { initialCdsid: string }) {
  const rosterDate = (vocStaffAnalysisJson.source as { rosterCheckedAt?: string }).rosterCheckedAt;
  const salesDate = (salesActivityAnalysisJson.source as { salesAsOf?: string }).salesAsOf;

  return (
    <main className="dealer-analysis-page">
      <header className="dealer-analysis-hero">
        <div className="dealer-analysis-hero-copy">
          <Link href={`/dashboard/${initialCdsid}/analysis?view=size`} scroll={false}>
            <span aria-hidden="true">←</span> 페이지 2로 돌아가기
          </Link>
          <small>ADMINISTRATOR ANALYTICS</small>
          <h1>7개 딜러사별 분석자료</h1>
          <p>인증직원 배출 추이와 현재 재직 명단, 판매 실적을 한 화면에서 비교합니다.</p>
        </div>
        <div className="dealer-analysis-hero-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <path d="M24 4.8 39 10.5v11.1c0 9.5-6.2 17.7-15 21.6C15.2 39.3 9 31.1 9 21.6V10.5L24 4.8Z" />
            <path d="M17 31v-8m7 8V16m7 15V20" />
          </svg>
          <span>MASTER</span>
        </div>
      </header>

      <section className="dealer-analysis-summary" aria-label="전국 통합 요약">
        <article><small>분석 대상</small><strong>7</strong><span>딜러사 · 39개 전시장</span></article>
        <article><small>현재 재직 명단</small><strong>{totalStaff}</strong><span>{formatCompactDate(rosterDate)}</span></article>
        <article><small>2026 누적판매</small><strong>{totalSales.toLocaleString()}</strong><span>{formatCompactDate(salesDate)} · 대</span></article>
        <article><small>인증 배출 이력</small><strong>{totalCertifications}</strong><span>{years[0]}–{years.at(-1)} · 연인원</span></article>
      </section>

      <section className="dealer-analysis-board" aria-labelledby="dealer-analysis-board-title">
        <div className="dealer-analysis-section-title">
          <div>
            <small>DEALER COMPARISON</small>
            <h2 id="dealer-analysis-board-title">딜러사별 인증·재직·판매 현황</h2>
          </div>
          <p>G · A · C는 Grand · Advanced · Certified 인증 배출 연인원입니다.</p>
        </div>

        <div className="dealer-analysis-grid">
          {dealerRows.map((row, index) => (
            <article className="dealer-analysis-card" key={row.dealer}>
              <header>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><small>VOLVO DEALER</small><h3>{row.dealer}</h3></div>
                <b>{row.showroomCount}개소</b>
              </header>
              <div className="dealer-analysis-card-kpis">
                <div><small>재직 명단</small><strong>{row.currentStaff}<i>명</i></strong></div>
                <div><small>누적판매</small><strong>{row.sales.toLocaleString()}<i>대</i></strong></div>
                <div><small>인증 배출</small><strong>{row.certificationCount}<i>명</i></strong></div>
              </div>
              <div className="dealer-analysis-levels" aria-label={`${row.dealer} 인증 등급별 배출`}>
                <span><i>G</i><strong>{row.levelCounts.Grand}</strong></span>
                <span><i>A</i><strong>{row.levelCounts.Advanced}</strong></span>
                <span><i>C</i><strong>{row.levelCounts.Certified}</strong></span>
              </div>
              <div className="dealer-analysis-trend" aria-label={`${row.dealer} 연도별 인증 배출 추이`}>
                {row.annual.map((count, yearIndex) => (
                  <span key={years[yearIndex]}>
                    <b>{count || "–"}</b>
                    <i style={{ height: `${Math.max(count ? 10 : 2, (count / annualMaximum) * 48)}px` }} />
                    <small>{String(years[yearIndex]).slice(2)}</small>
                  </span>
                ))}
              </div>
              <footer>
                <span>현재 재직 확인 <strong>{row.currentCertified}명</strong></span>
                <span>현 명단 미확인 <strong>{row.currentUnmatched}명</strong></span>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className="dealer-analysis-roadmap">
        <div className="dealer-analysis-roadmap-icon" aria-hidden="true">▶</div>
        <div>
          <small>YOUTUBE PERFORMANCE</small>
          <h2>채널 활동 × 판매 추이 분석</h2>
          <p>채널 주소를 연결하면 개설일을 기준으로 롱폼·쇼츠 업로드 수와 판매대수 추이를 딜러사별로 같은 화면에 확장합니다.</p>
        </div>
        <span>데이터 연결 대기</span>
      </section>

      <p className="dealer-analysis-data-note">
        ‘현 명단 미확인’은 과거 인증 이력 중 현재 Sales-DMS 재직 명단에서 일치하지 않는 인원이며, 퇴사 확정 수치가 아닙니다. 퇴사 이력 데이터 연결 후 재직·퇴사로 확정 구분합니다.
      </p>
    </main>
  );
}
