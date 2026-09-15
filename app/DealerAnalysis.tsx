"use client";

import { useMemo, useState, type CSSProperties } from "react";
import DashboardHeaderLead from "./DashboardHeaderLead";
import dashboardJson from "./data/showrooms.json";
import salesActivityAnalysisJson from "./data/sales-activity-analysis.json";
import vocStaffAnalysisJson from "./data/voc-staff-analysis.json";
import staffCertificationsJson from "./data/staff-certifications.json";

type Showroom = {
  cdsid: string;
  showroom: string;
  dealer: string;
  manager: string;
  region: string;
  size: string;
};
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
type SalesStaff = {
  name: string;
  deliveredSales: number;
  monthlyDeliveredSales: number[];
};
type SalesShowroom = {
  staff: SalesStaff[];
};
type SalesPerformance = {
  certifiedAverage: number;
  nonCertifiedAverage: number;
  difference: number;
};
type CertificationLevel = Certification["level"];
type DealerSortKey = "total-desc" | "rate-desc" | "current-desc";
const dealerOrder = ["아주", "천하", "에이치", "아이언", "아이비", "코오롱", "태영"];
const showrooms = dashboardJson.showrooms as Showroom[];
const certifications = staffCertificationsJson.records as Certification[];
const certifiedNames = new Set(certifications.map((record) => record.name));
const vocShowrooms = vocStaffAnalysisJson.showrooms as Record<string, VocShowroom>;
const salesShowrooms = salesActivityAnalysisJson.showrooms as Record<string, SalesShowroom>;
const certificationDealerOverrides: Record<string, string> = {
  "2025:장석우": "에이치",
  "2025:주재홍": "에이치",
  "2025:강민성": "코오롱",
  "2025:백승국": "코오롱",
  "2025:이동담": "코오롱",
  "2025:김승곤": "아이비",
};

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
  const verifiedOverride = certificationDealerOverrides[`${record.year}:${record.name}`];
  if (verifiedOverride) return verifiedOverride;
  const mapped = showroomDealer.get(normalizeShowroom(record.showroom));
  if (mapped) return mapped;
  const currentDealers = currentDealersByName.get(record.name);
  return currentDealers?.size === 1 ? [...currentDealers][0] : null;
}

function salesPerformanceForShowrooms(dealerShowrooms: Showroom[]): SalesPerformance {
  const staffByDealerAndName = new Map<string, { name: string; sales: number; months: number }>();
  for (const showroom of dealerShowrooms) {
    for (const staff of salesShowrooms[showroom.cdsid]?.staff ?? []) {
      const key = `${showroom.dealer}:${staff.name}`;
      const aggregate = staffByDealerAndName.get(key) ?? { name: staff.name, sales: 0, months: 0 };
      aggregate.sales += staff.deliveredSales;
      aggregate.months = Math.max(aggregate.months, staff.monthlyDeliveredSales.length);
      staffByDealerAndName.set(key, aggregate);
    }
  }
  const staff = [...staffByDealerAndName.values()];
  const groupAverage = (members: typeof staff) => members.length > 0
    ? members.reduce((sum, member) => sum + member.sales / Math.max(member.months, 1), 0) / members.length
    : 0;
  const certifiedAverage = groupAverage(staff.filter((member) => certifiedNames.has(member.name)));
  const nonCertifiedAverage = groupAverage(staff.filter((member) => !certifiedNames.has(member.name)));
  return {
    certifiedAverage,
    nonCertifiedAverage,
    difference: certifiedAverage - nonCertifiedAverage,
  };
}

const dealerRows = dealerOrder.map((dealer) => {
  const dealerShowrooms = showrooms.filter((showroom) => showroom.dealer === dealer);
  const currentNames = new Set(
    dealerShowrooms.flatMap((showroom) =>
      (vocShowrooms[showroom.cdsid]?.employees ?? []).map((employee) => employee.name),
    ),
  );
  const dealerCertifications = certifications.filter(
    (record) => certificationDealer(record) === dealer,
  );
  const currentCertified = [...currentNames].filter((name) =>
    certifications.some((record) => record.name === name),
  ).length;
  const levelCounts = {
    Grand: dealerCertifications.filter((record) => record.level === "Grand").length,
    Advanced: dealerCertifications.filter((record) => record.level === "Advanced").length,
    Certified: dealerCertifications.filter((record) => record.level === "Certified").length,
  };
  return {
    dealer,
    showroomCount: dealerShowrooms.length,
    certificationCount: dealerCertifications.length,
    currentCertified,
    levelCounts,
    salesPerformance: salesPerformanceForShowrooms(dealerShowrooms),
  };
});

const totalCertifications = certifications.length;
const totalShowrooms = showrooms.length;
const totalLevels = {
  Grand: certifications.filter((record) => record.level === "Grand").length,
  Advanced: certifications.filter((record) => record.level === "Advanced").length,
  Certified: certifications.filter((record) => record.level === "Certified").length,
};
const totalCurrentCertified = dealerRows.reduce((sum, row) => sum + row.currentCertified, 0);
const totalSalesPerformance = salesPerformanceForShowrooms(showrooms);
const unmatchedCertifications = certifications.filter((record) => !certificationDealer(record));

function percentage(value: number, total: number) {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
}

function monthlySales(value: number) {
  return value.toFixed(1);
}

function signedMonthlySales(value: number) {
  const rounded = Number(value.toFixed(1));
  if (rounded > 0) return `+${rounded.toFixed(1)}`;
  if (rounded < 0) return `−${Math.abs(rounded).toFixed(1)}`;
  return "±0.0";
}

const levelLabels: Record<CertificationLevel, string> = {
  Grand: "Grand",
  Advanced: "Advanced",
  Certified: "Certified",
};

function CertificationMixBar({
  levelCounts,
  total,
  animationDelay,
}: {
  levelCounts: Record<CertificationLevel, number>;
  total: number;
  animationDelay: number;
}) {
  return (
    <div className="dealer-mix" role="cell">
      <div className="dealer-mix-bar" aria-label={`Grand ${levelCounts.Grand}명, Advanced ${levelCounts.Advanced}명, Certified ${levelCounts.Certified}명`}>
        {(Object.keys(levelLabels) as CertificationLevel[]).map((level) => {
          const share = percentage(levelCounts[level], total);
          return (
            <span
              className={`dealer-mix-segment level-${level.toLowerCase()}`}
              data-tooltip={`${levelLabels[level]} · ${levelCounts[level]}명 · ${share}`}
              key={level}
              style={{
                width: share,
                "--bar-delay": `${animationDelay}ms`,
              } as CSSProperties}
              tabIndex={0}
            />
          );
        })}
      </div>
      <div className="dealer-mix-values">
        {(Object.keys(levelLabels) as CertificationLevel[]).map((level) => (
          <span className={`level-${level.toLowerCase()}`} key={level}>
            <i aria-hidden="true" />
            <small>{levelLabels[level]}</small>
            <strong>{levelCounts[level]}<em>명</em></strong>
            <b>{percentage(levelCounts[level], total)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function EmploymentProgressBar({
  current,
  total,
  animationDelay,
}: {
  current: number;
  total: number;
  animationDelay: number;
}) {
  const rate = percentage(current, total);
  return (
    <div className="dealer-employment" role="cell">
      <div
        className="dealer-employment-bar"
        data-tooltip={`현재 재직 ${current}명 / 전체 인증 ${total}명 · 재직률 ${rate}`}
        aria-label={`현재 재직 ${current}명, 전체 인증 ${total}명, 재직률 ${rate}`}
        tabIndex={0}
      >
        <i style={{ width: rate, "--bar-delay": `${animationDelay}ms` } as CSSProperties} />
      </div>
      <div className="dealer-employment-metrics">
        <span>현재 재직 <strong><span className="dealer-employment-current">{current}</span><small>명</small><i>/ {total}명</i></strong></span>
        <b>{rate}</b>
      </div>
    </div>
  );
}

function SalesPerformanceComparison({ performance }: { performance: SalesPerformance }) {
  const roundedDifference = Number(performance.difference.toFixed(1));
  const differenceTone = roundedDifference > 0 ? "positive" : roundedDifference < 0 ? "negative" : "neutral";
  return (
    <div
      className="dealer-sales-comparison"
      role="cell"
      aria-label={`2026년 인증직원 월 판매평균 ${monthlySales(performance.certifiedAverage)}대, 비인증직원 월 판매평균 ${monthlySales(performance.nonCertifiedAverage)}대, 차이 ${signedMonthlySales(performance.difference)}대`}
    >
      <span><small>인증 월평균</small><strong>{monthlySales(performance.certifiedAverage)}<i>대</i></strong></span>
      <span><small>비인증 월평균</small><strong>{monthlySales(performance.nonCertifiedAverage)}<i>대</i></strong></span>
      <span className={`difference ${differenceTone}`}><small>차이</small><strong>{signedMonthlySales(performance.difference)}<i>대</i></strong></span>
    </div>
  );
}

export default function DealerAnalysis({ initialCdsid }: { initialCdsid: string }) {
  const selected = showrooms.find((showroom) => showroom.cdsid === initialCdsid) ?? showrooms[0];
  const [sortKey, setSortKey] = useState<DealerSortKey>("total-desc");
  const displayedDealerRows = useMemo(() => {
    const rows = [...dealerRows];
    const stableOrder = (dealer: string) => dealerOrder.indexOf(dealer);
    if (sortKey === "rate-desc") {
      return rows.sort((a, b) => {
        const difference = b.currentCertified / b.certificationCount - a.currentCertified / a.certificationCount;
        return difference || stableOrder(a.dealer) - stableOrder(b.dealer);
      });
    }
    if (sortKey === "current-desc") {
      return rows.sort((a, b) => b.currentCertified - a.currentCertified || stableOrder(a.dealer) - stableOrder(b.dealer));
    }
    return rows.sort((a, b) => b.certificationCount - a.certificationCount || stableOrder(a.dealer) - stableOrder(b.dealer));
  }, [sortKey]);
  const accessDate = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/\.\s?/g, ".").replace(/\.$/, "");

  return (
    <main className="dealer-analysis-page">
      <div className="dealer-analysis-command-shell">
      <header className="dashboard-identity-header analysis-header dealer-analysis-header">
        <DashboardHeaderLead
          title="딜러사별 분석자료"
          accessDate={accessDate}
          titleClassName="analysis-title"
          hideLogout
          dashboardReturn={{
            href: `/dashboard/${selected.cdsid}/analysis?view=size`,
            label: "분석자료",
            ariaLabel: "기존 페이지 2 분석자료로 돌아가기",
          }}
        />
      </header>
      </div>

      <section className="dealer-analysis-board" aria-labelledby="dealer-analysis-board-title">
        <div className="dealer-analysis-section-title">
          <div>
            <h2 id="dealer-analysis-board-title">딜러사별 레벨별 인증인원 및 비율</h2>
          </div>
          <div className="dealer-sort-controls" aria-label="딜러사 정렬 방식">
            {([
              ["total-desc", "전체 인증 많은 순"],
              ["rate-desc", "재직률 높은 순"],
              ["current-desc", "현재 재직 많은 순"],
            ] as [DealerSortKey, string][]).map(([value, label]) => (
              <button
                className={sortKey === value ? "is-active" : ""}
                type="button"
                aria-pressed={sortKey === value}
                onClick={() => setSortKey(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="dealer-certification-table" role="table" aria-label="7개 딜러사 인증 레벨별 인원·비율과 2026년 인증직원 판매성과 비교">
          <div className="dealer-certification-row dealer-certification-head" role="row">
            <span role="columnheader">딜러사 / 전시장 / %</span>
            <span role="columnheader">전체 인증 / %</span>
            <span role="columnheader">인증 레벨별 구성 / %</span>
            <span role="columnheader">현재 재직인원 / 재직율(%)</span>
            <span role="columnheader">2026년 인증직원 vs 비인증직원 판매성과 비교</span>
          </div>
          <article className="dealer-certification-row dealer-certification-aggregate" role="row" style={{ "--row-delay": "0ms" } as CSSProperties}>
            <div className="dealer-certification-name" role="cell">
              <div><h3>전체</h3></div>
              <b>7개사 / {totalShowrooms}개소 / 100%</b>
            </div>
            <div className="dealer-certification-total" role="cell">
              <strong>{totalCertifications}<i>명</i><b>{percentage(totalCertifications, totalCertifications)}</b></strong>
            </div>
            <CertificationMixBar levelCounts={totalLevels} total={totalCertifications} animationDelay={80} />
            <EmploymentProgressBar current={totalCurrentCertified} total={totalCertifications} animationDelay={120} />
            <SalesPerformanceComparison performance={totalSalesPerformance} />
          </article>
          {displayedDealerRows.map((row, index) => (
            <article
              className="dealer-certification-row"
              role="row"
              key={row.dealer}
              style={{ "--row-delay": `${60 + index * 50}ms` } as CSSProperties}
            >
              <div className="dealer-certification-name" role="cell">
                <div><h3>{row.dealer}</h3></div>
                <b>{row.showroomCount}개소 / {percentage(row.showroomCount, totalShowrooms)}</b>
              </div>
              <div className="dealer-certification-total" role="cell">
                <strong>{row.certificationCount}<i>명</i><b>{percentage(row.certificationCount, totalCertifications)}</b></strong>
              </div>
              <CertificationMixBar levelCounts={row.levelCounts} total={row.certificationCount} animationDelay={120 + index * 50} />
              <EmploymentProgressBar current={row.currentCertified} total={row.certificationCount} animationDelay={160 + index * 50} />
              <SalesPerformanceComparison performance={row.salesPerformance} />
            </article>
          ))}
        </div>
        <div className="dealer-certification-reconcile">
          <span>딜러사 확인 <strong>{totalCertifications - unmatchedCertifications.length}명</strong></span>
          <span>딜러사 미확인 <strong>{unmatchedCertifications.length}명</strong> · 윤종현(Advanced), 김형선(Certified)</span>
          <span>전국 총계 <strong>{totalCertifications}명</strong></span>
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
        재직률은 현재 재직 확인 인원을 전체 인증 인원으로 나눈 값입니다. 현재 명단에서 확인되지 않는 과거 인증자를 퇴사자로 단정하지 않으며, 딜러사 미확인 2명은 원자료에 전시장 정보가 없어 별도로 보존했습니다.
      </p>
    </main>
  );
}
