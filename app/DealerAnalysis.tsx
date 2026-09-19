"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import DashboardHeaderLead from "./DashboardHeaderLead";
import YouTubePerformance from "./YouTubePerformance";
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
  employees: {
    name: string;
    years?: Record<string, { responses: number; scoreSum: number }>;
  }[];
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
type SatisfactionPerformance = {
  certifiedAverage: number;
  nonCertifiedAverage: number;
  difference: number;
  certifiedResponses: number;
  nonCertifiedResponses: number;
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

function satisfactionPerformanceForShowrooms(dealerShowrooms: Showroom[]): SatisfactionPerformance {
  const staffByDealerAndName = new Map<string, { name: string; responses: number; scoreSum: number }>();
  for (const showroom of dealerShowrooms) {
    for (const employee of vocShowrooms[showroom.cdsid]?.employees ?? []) {
      const result = employee.years?.["2026"];
      if (!result || result.responses <= 0) continue;
      const key = `${showroom.dealer}:${employee.name}`;
      const aggregate = staffByDealerAndName.get(key) ?? { name: employee.name, responses: 0, scoreSum: 0 };
      aggregate.responses += result.responses;
      aggregate.scoreSum += result.scoreSum;
      staffByDealerAndName.set(key, aggregate);
    }
  }
  const staff = [...staffByDealerAndName.values()];
  const groupResult = (members: typeof staff) => {
    const responses = members.reduce((sum, member) => sum + member.responses, 0);
    const scoreSum = members.reduce((sum, member) => sum + member.scoreSum, 0);
    return { average: responses > 0 ? scoreSum / responses : 0, responses };
  };
  const certified = groupResult(staff.filter((member) => certifiedNames.has(member.name)));
  const nonCertified = groupResult(staff.filter((member) => !certifiedNames.has(member.name)));
  return {
    certifiedAverage: certified.average,
    nonCertifiedAverage: nonCertified.average,
    difference: certified.average - nonCertified.average,
    certifiedResponses: certified.responses,
    nonCertifiedResponses: nonCertified.responses,
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
    satisfactionPerformance: satisfactionPerformanceForShowrooms(dealerShowrooms),
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
const totalSatisfactionPerformance = satisfactionPerformanceForShowrooms(showrooms);
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
  if (rounded > 0) return `▲ ${rounded.toFixed(1)}`;
  if (rounded < 0) return `▼ ${Math.abs(rounded).toFixed(1)}`;
  return "― 0.0";
}

function satisfactionScore(value: number) {
  return value.toFixed(1);
}

function signedSatisfactionScore(value: number) {
  const rounded = Number(value.toFixed(1));
  if (rounded > 0) return `▲ ${rounded.toFixed(1)}`;
  if (rounded < 0) return `▼ ${Math.abs(rounded).toFixed(1)}`;
  return "― 0.0";
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
  const grandEnd = percentage(levelCounts.Grand, total);
  const advancedEnd = percentage(levelCounts.Grand + levelCounts.Advanced, total);

  return (
    <div className="dealer-mix" role="cell">
      <div
        className="dealer-mix-bar"
        data-grand-end={grandEnd}
        data-advanced-end={advancedEnd}
        aria-label={`Grand ${levelCounts.Grand}명, Advanced ${levelCounts.Advanced}명, Certified ${levelCounts.Certified}명`}
      >
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

type CertificationConnectorGeometry = {
  width: number;
  height: number;
  grandPath: string;
  advancedPath: string;
};

function CertificationTrendConnectors({
  tableRef,
  layoutKey,
}: {
  tableRef: RefObject<HTMLDivElement | null>;
  layoutKey: string;
}) {
  const [geometry, setGeometry] = useState<CertificationConnectorGeometry | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    let frame = 0;
    let cancelled = false;
    const update = () => {
      frame = 0;
      if (cancelled) return;
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect || !svgRect.width || !svgRect.height) return;
      const bars = Array.from(table.querySelectorAll<HTMLElement>(".dealer-mix-bar"));
      const points = bars.map((bar) => {
        const barRect = bar.getBoundingClientRect();
        const grandRect = bar.querySelector<HTMLElement>(".level-grand")!.getBoundingClientRect();
        const advancedRect = bar.querySelector<HTMLElement>(".level-advanced")!.getBoundingClientRect();
        return {
          grandX: grandRect.right - svgRect.left,
          advancedX: advancedRect.right - svgRect.left,
          top: barRect.top - svgRect.top,
          bottom: barRect.bottom - svgRect.top,
        };
      });
      const pathFor = (key: "grandX" | "advancedX") =>
        points.slice(0, -1).map((point, index) => {
          const next = points[index + 1];
          return `M ${point[key].toFixed(2)} ${point.bottom.toFixed(2)} L ${next[key].toFixed(2)} ${next.top.toFixed(2)}`;
        }).join(" ");

      setGeometry({
        width: svgRect.width,
        height: svgRect.height,
        grandPath: pathFor("grandX"),
        advancedPath: pathFor("advancedX"),
      });
    };
    const scheduleUpdate = () => {
      if (cancelled) return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(table);
    table.querySelectorAll<HTMLElement>(".dealer-mix-bar").forEach((bar) => observer.observe(bar));
    scheduleUpdate();
    table.addEventListener("animationend", scheduleUpdate);
    document.fonts?.ready.then(scheduleUpdate);

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      table.removeEventListener("animationend", scheduleUpdate);
    };
  }, [layoutKey, tableRef]);

  return (
    <svg
      ref={svgRef}
      className="dealer-certification-connectors"
      viewBox={geometry ? `0 0 ${geometry.width} ${geometry.height}` : undefined}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="level-grand" d={geometry?.grandPath} vectorEffect="non-scaling-stroke" />
      <path className="level-advanced" d={geometry?.advancedPath} vectorEffect="non-scaling-stroke" />
    </svg>
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
        <span>현재 재직 <strong><span className="dealer-employment-current">{current}</span><small>명</small><i><em>/</em>{total}명</i></strong></span>
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
      <span className={`difference ${differenceTone}`}><small>GAP 차이</small><strong>{signedMonthlySales(performance.difference)}<i>대</i></strong></span>
    </div>
  );
}

function SatisfactionPerformanceComparison({ performance }: { performance: SatisfactionPerformance }) {
  const roundedDifference = Number(performance.difference.toFixed(1));
  const differenceTone = roundedDifference > 0 ? "positive" : roundedDifference < 0 ? "negative" : "neutral";
  return (
    <div
      className="dealer-satisfaction-comparison"
      role="cell"
      aria-label={`2026년 인증직원 고객상담 만족도 ${satisfactionScore(performance.certifiedAverage)}점, ${performance.certifiedResponses}건; 비인증직원 ${satisfactionScore(performance.nonCertifiedAverage)}점, ${performance.nonCertifiedResponses}건; 차이 ${signedSatisfactionScore(performance.difference)}점`}
    >
      <span><small>인증 평균</small><strong>{satisfactionScore(performance.certifiedAverage)}<i>점</i></strong></span>
      <span><small>비인증 평균</small><strong>{satisfactionScore(performance.nonCertifiedAverage)}<i>점</i></strong></span>
      <span className={`difference ${differenceTone}`}><small>GAP 차이</small><strong>{signedSatisfactionScore(performance.difference)}<i>점</i></strong></span>
    </div>
  );
}

export default function DealerAnalysis({ initialCdsid }: { initialCdsid: string }) {
  const scrollArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const area = scrollArea.current;
    if (!area) return;
    let frame = 0;
    let releaseTimer: ReturnType<typeof setTimeout>;
    let entryReady = true;
    let landing = false;
    let animating = false;
    let previousTop = area.scrollTop;
    let touchStartY: number | null = null;
    let touchStartTop = area.scrollTop;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targetTop = () => {
      const section = area.querySelector<HTMLElement>(".youtube-performance");
      return section ? area.scrollTop + section.getBoundingClientRect().top - area.getBoundingClientRect().top : null;
    };
    const releaseLanding = () => {
      landing = false;
      previousTop = area.scrollTop;
    };
    const holdUntilGestureEnds = () => {
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(releaseLanding, 150);
    };
    const settleAtCreatorHeader = () => {
      const target = targetTop();
      if (target === null || landing) return;
      entryReady = false;
      landing = true;
      animating = true;
      cancelAnimationFrame(frame);
      const from = Math.min(area.scrollTop, target);
      if (area.scrollTop > target) area.scrollTop = target;
      const distance = Math.max(0, target - from);
      const duration = reduceMotion ? 0 : Math.min(400, 210 + distance * .32);
      const started = performance.now();
      const step = (now: number) => {
        const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
        area.scrollTop = from + distance * (1 - Math.pow(1 - progress, 3));
        if (progress < 1) frame = requestAnimationFrame(step);
        else {
          frame = 0;
          animating = false;
          area.scrollTop = target;
          holdUntilGestureEnds();
        }
      };
      frame = requestAnimationFrame(step);
    };
    const wheelDistance = (event: WheelEvent) => event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? area.clientHeight : 1);
    const onWheel = (event: WheelEvent) => {
      const distance = wheelDistance(event);
      if (landing) {
        event.preventDefault();
        holdUntilGestureEnds();
        return;
      }
      const target = targetTop();
      if (target === null || !entryReady || distance <= 0 || area.scrollTop >= target) return;
      if (area.scrollTop + distance >= target - 1) {
        event.preventDefault();
        settleAtCreatorHeader();
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? null;
      touchStartTop = area.scrollTop;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (landing) {
        event.preventDefault();
        holdUntilGestureEnds();
        return;
      }
      const target = targetTop();
      const currentY = event.touches[0]?.clientY;
      if (target === null || !entryReady || touchStartY === null || currentY === undefined) return;
      const downwardDistance = touchStartY - currentY;
      if (downwardDistance > 0 && touchStartTop + downwardDistance >= target - 1) {
        event.preventDefault();
        settleAtCreatorHeader();
      }
    };
    const onTouchEnd = () => {
      touchStartY = null;
      if (landing) holdUntilGestureEnds();
    };
    const onScroll = () => {
      const target = targetTop();
      if (target === null) return;
      const current = area.scrollTop;
      if (animating) {
        previousTop = current;
        return;
      }
      if (landing) {
        if (Math.abs(current - target) > 1) area.scrollTop = target;
        previousTop = target;
        return;
      }
      if (!entryReady && current < target - 48) entryReady = true;
      if (entryReady && previousTop < target && current >= target) {
        area.scrollTop = target;
        settleAtCreatorHeader();
        previousTop = target;
        return;
      }
      previousTop = current;
    };
    area.addEventListener("wheel", onWheel, {passive: false});
    area.addEventListener("touchstart", onTouchStart, {passive: true});
    area.addEventListener("touchmove", onTouchMove, {passive: false});
    area.addEventListener("touchend", onTouchEnd, {passive: true});
    area.addEventListener("touchcancel", onTouchEnd, {passive: true});
    area.addEventListener("scroll", onScroll, {passive: true});
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(releaseTimer);
      area.removeEventListener("wheel", onWheel);
      area.removeEventListener("touchstart", onTouchStart);
      area.removeEventListener("touchmove", onTouchMove);
      area.removeEventListener("touchend", onTouchEnd);
      area.removeEventListener("touchcancel", onTouchEnd);
      area.removeEventListener("scroll", onScroll);
    };
  }, []);
  const selected = showrooms.find((showroom) => showroom.cdsid === initialCdsid) ?? showrooms[0];
  const [sortKey, setSortKey] = useState<DealerSortKey>("total-desc");
  const certificationTableRef = useRef<HTMLDivElement>(null);
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

      <div ref={scrollArea} className="dealer-analysis-scroll" tabIndex={0} role="region" aria-label="딜러사 및 크리에이터 분석 스크롤">
      <section className="dealer-analysis-board" aria-labelledby="dealer-analysis-board-title">
        <div className="dealer-analysis-section-title">
          <div>
            <h2 id="dealer-analysis-board-title">딜러사별 인증레벨별 인원 및 비율</h2>
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

        <div key={sortKey} ref={certificationTableRef} className="dealer-certification-table" role="table" aria-label="7개 딜러사 인증 레벨별 인원·비율과 2026년 인증직원 고객상담 만족도·판매성과 비교">
          <div className="dealer-certification-row dealer-certification-head" role="row">
            <span role="columnheader">딜러사 / 전시장 / %</span>
            <span role="columnheader">전체 인증 / %</span>
            <span role="columnheader">인증 레벨별 구성 / %</span>
            <span role="columnheader">현재 재직인원 / 재직율(%)</span>
            <span role="columnheader">2026 인증직원 vs 비인증직원 고객상담 만족도 비교</span>
            <span role="columnheader">2026년 인증직원 vs 비인증직원 판매성과 비교</span>
          </div>
          <article className="dealer-certification-row dealer-certification-aggregate" role="row" style={{ "--row-delay": "0ms" } as CSSProperties}>
            <div className="dealer-certification-name" role="cell">
              <div><h3>전체</h3></div>
              <b>{totalShowrooms}개소<em>/</em>100%</b>
            </div>
            <div className="dealer-certification-total" role="cell">
              <strong>{totalCertifications}<i>명</i><em>/</em><b>{percentage(totalCertifications, totalCertifications)}</b></strong>
            </div>
            <CertificationMixBar levelCounts={totalLevels} total={totalCertifications} animationDelay={80} />
            <EmploymentProgressBar current={totalCurrentCertified} total={totalCertifications} animationDelay={120} />
            <SatisfactionPerformanceComparison performance={totalSatisfactionPerformance} />
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
                <b>{row.showroomCount}개소<em>/</em>{percentage(row.showroomCount, totalShowrooms)}</b>
              </div>
              <div className="dealer-certification-total" role="cell">
                <strong>{row.certificationCount}<i>명</i><em>/</em><b>{percentage(row.certificationCount, totalCertifications)}</b></strong>
              </div>
              <CertificationMixBar levelCounts={row.levelCounts} total={row.certificationCount} animationDelay={120 + index * 50} />
              <EmploymentProgressBar current={row.currentCertified} total={row.certificationCount} animationDelay={160 + index * 50} />
              <SatisfactionPerformanceComparison performance={row.satisfactionPerformance} />
              <SalesPerformanceComparison performance={row.salesPerformance} />
            </article>
          ))}
          <CertificationTrendConnectors tableRef={certificationTableRef} layoutKey={sortKey} />
        </div>
      </section>

      <YouTubePerformance />
      </div>
    </main>
  );
}
