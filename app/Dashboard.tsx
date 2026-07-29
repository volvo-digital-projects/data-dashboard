"use client";

import { useMemo, useState } from "react";
import dashboardJson from "./data/showrooms.json";

type MetricKey = "combat" | "v3s" | "voc" | "cx";
type TrendMetricKey = Exclude<MetricKey, "combat">;
type GroupKey = "all" | "dealer" | "region" | "size";

type QuarterRecord = {
  cdsid: string;
  showroom: string;
  dealer: string;
  manager: string;
  size: string;
  region: string;
  combat: number | null;
  v3s: number | null;
  vocWeekly: number | null;
  voc: number | null;
  cx: number | null;
  deliveryWeekly: number | null;
  delivery: number | null;
  testDriveWeekly: number | null;
  testDrive: number | null;
  emergencyWeekly: number | null;
  emergency: number | null;
  actionPlan: number | null;
  appWeekly: number | null;
  app: number | null;
  happyCallWeekly: number | null;
  happyCall: number | null;
};

type Showroom = QuarterRecord & { q1: QuarterRecord | null };

type DashboardData = {
  meta: {
    showroomCount: number;
    quarter: string;
    sourceWeek: string;
    startDate: string;
    endDate: string;
    combatMax: number;
    combatAverage: number;
    generatedFrom: string[];
  };
  averages: Omit<
    QuarterRecord,
    "cdsid" | "showroom" | "dealer" | "manager" | "size" | "region" | "combat"
  >;
  showrooms: Showroom[];
};

const dashboard = dashboardJson as DashboardData;

const metricMeta: Record<
  MetricKey,
  { label: string; short: string; max: number; unit: string }
> = {
  combat: { label: "종합 전투력", short: "TOTAL", max: 330, unit: "점" },
  v3s: { label: "V3S", short: "V3S", max: 100, unit: "점" },
  voc: { label: "VOC", short: "VOC", max: 100, unit: "점" },
  cx: { label: "CX Index", short: "CX", max: 130, unit: "점" },
};

const groupMeta: Record<GroupKey, { label: string; helper: string }> = {
  all: { label: "전국 39개", helper: "볼보 전체 전시장" },
  dealer: { label: "소속 딜러사", helper: "같은 딜러사" },
  region: { label: "동일 권역", helper: "수도권 · 지방권" },
  size: { label: "동급 사이즈", helper: "같은 전시장 규모" },
};

const valueOf = (item: Showroom, metric: MetricKey) =>
  item[metric] ?? Number.NEGATIVE_INFINITY;

const displayNumber = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);

function getTier(score: number) {
  if (score >= 320) return { name: "DIAMOND", label: "최상위", className: "diamond" };
  if (score >= 310) return { name: "PLATINUM", label: "우수", className: "platinum" };
  if (score >= 300) return { name: "GOLD", label: "관찰", className: "gold" };
  return { name: "WATCH", label: "집중 관리", className: "watch" };
}

function getSignal(value: number, average: number) {
  const delta = value - average;
  if (delta >= 0) return { label: "평균 이상", tone: "good", delta };
  if (delta >= -3) return { label: "주의", tone: "caution", delta };
  return { label: "경고", tone: "warning", delta };
}

function SignalIcon({ tone }: { tone: string }) {
  return (
    <span className={`signal-icon ${tone}`} aria-hidden="true">
      {tone === "good" ? "↗" : tone === "caution" ? "!" : "↓"}
    </span>
  );
}

function AppealBadge({
  type,
}: {
  type: "possible" | "partial" | "locked";
}) {
  const content = {
    possible: { icon: "↻", label: "사후 보정 가능" },
    partial: { icon: "◐", label: "일부 보정 가능" },
    locked: { icon: "⊘", label: "사후 보정 불가" },
  }[type];

  return (
    <span className={`appeal-badge ${type}`} title={content.label}>
      <span aria-hidden="true">{content.icon}</span>
      {content.label}
    </span>
  );
}

function MetricCard({
  metric,
  value,
  average,
  previous,
  active,
  onSelect,
  appeal,
}: {
  metric: TrendMetricKey;
  value: number;
  average: number;
  previous: number | null;
  active: boolean;
  onSelect: () => void;
  appeal: "possible" | "partial" | "locked";
}) {
  const signal = getSignal(value, average);
  const quarterDelta =
    previous === null || previous === 0 ? null : value - previous;
  const fill = Math.min(100, Math.max(0, (value / metricMeta[metric].max) * 100));

  return (
    <button
      className={`metric-card ${signal.tone} ${active ? "active" : ""}`}
      onClick={onSelect}
      type="button"
      aria-pressed={active}
    >
      <div className="metric-card-topline">
        <span className="metric-code">{metricMeta[metric].short}</span>
        <span className={`signal-pill ${signal.tone}`}>
          <SignalIcon tone={signal.tone} />
          {signal.label}
        </span>
      </div>
      <div className="metric-card-value">
        {displayNumber(value)}
        <span>점</span>
      </div>
      <div className="metric-benchmark">
        <span>전국 평균 {displayNumber(average)}</span>
        <strong className={signal.tone}>
          {signal.delta >= 0 ? "+" : ""}
          {signal.delta.toFixed(1)}
        </strong>
      </div>
      <div className="metric-track" aria-hidden="true">
        <span style={{ width: `${fill}%` }} />
        <i style={{ left: `${(average / metricMeta[metric].max) * 100}%` }} />
      </div>
      <div className="metric-card-footer">
        <AppealBadge type={appeal} />
        <span className={`quarter-change ${(quarterDelta ?? 0) >= 0 ? "up" : "down"}`}>
          Q1 대비{" "}
          {quarterDelta === null
            ? "—"
            : `${quarterDelta >= 0 ? "+" : ""}${quarterDelta.toFixed(1)}`}
        </span>
      </div>
    </button>
  );
}

function WeeklyTrend({
  showroom,
  metric,
}: {
  showroom: Showroom;
  metric: TrendMetricKey;
}) {
  const current = showroom[metric] ?? 0;
  const previous = showroom.q1?.[metric] ?? null;
  const weekly = metric === "voc" ? showroom.vocWeekly : null;
  const average = dashboard.averages[metric] ?? 0;
  const rawPoints = [
    previous === null ? null : { week: 13, value: previous, label: "Q1 마감" },
    weekly === null || weekly <= 0
      ? null
      : { week: 17, value: weekly, label: dashboard.meta.sourceWeek },
    { week: 26, value: current, label: "Q2 마감" },
  ].filter(Boolean) as { week: number; value: number; label: string }[];

  const max = Math.max(metricMeta[metric].max, ...rawPoints.map((point) => point.value));
  const min = Math.max(0, Math.min(average, ...rawPoints.map((point) => point.value)) - 12);
  const x = (week: number) => 40 + ((week - 1) / 51) * 960;
  const y = (value: number) => 145 - ((value - min) / Math.max(1, max - min)) * 112;
  const path = rawPoints.map((point) => `${x(point.week)},${y(point.value)}`).join(" ");

  return (
    <div className="trend-wrap">
      <svg
        className="trend-chart"
        viewBox="0 0 1040 190"
        role="img"
        aria-label={`${metricMeta[metric].label} 52주 데이터 입력 현황`}
      >
        {[1, 13, 26, 39, 52].map((week) => (
          <g key={week}>
            <line
              x1={x(week)}
              x2={x(week)}
              y1="18"
              y2="150"
              className="week-grid"
            />
            <text x={x(week)} y="178" textAnchor="middle" className="week-label">
              W{String(week).padStart(2, "0")}
            </text>
          </g>
        ))}
        <line
          x1="40"
          x2="1000"
          y1={y(average)}
          y2={y(average)}
          className="average-line"
        />
        <text x="998" y={y(average) - 7} textAnchor="end" className="average-label">
          전국 평균 {displayNumber(average)}
        </text>
        {rawPoints.length > 1 && (
          <polyline points={path} className="trend-line" />
        )}
        {rawPoints.map((point) => (
          <g key={`${point.week}-${point.label}`}>
            <circle cx={x(point.week)} cy={y(point.value)} r="7" className="trend-point" />
            <circle cx={x(point.week)} cy={y(point.value)} r="2.5" className="trend-point-core" />
            <text
              x={x(point.week)}
              y={Math.max(15, y(point.value) - 14)}
              textAnchor="middle"
              className="point-value"
            >
              {displayNumber(point.value)}
            </text>
          </g>
        ))}
      </svg>
      <div className="data-coverage">
        <span>
          <i className="coverage-dot filled" /> 입력값 {rawPoints.length}개
        </span>
        <span>
          <i className="coverage-dot" /> Google Sheets 주간 백데이터 연결 대기
        </span>
      </div>
    </div>
  );
}

function ComparisonTable({
  selected,
  metric,
  group,
}: {
  selected: Showroom;
  metric: MetricKey;
  group: GroupKey;
}) {
  const members = useMemo(() => {
    const filtered = dashboard.showrooms.filter((item) => {
      if (group === "dealer") return item.dealer === selected.dealer;
      if (group === "region") return item.region === selected.region;
      if (group === "size") return item.size === selected.size;
      return true;
    });
    return filtered.sort((a, b) => valueOf(b, metric) - valueOf(a, metric));
  }, [group, metric, selected]);

  const selectedIndex = Math.max(
    0,
    members.findIndex((item) => item.cdsid === selected.cdsid),
  );
  const windowStart = Math.min(
    Math.max(0, selectedIndex - 2),
    Math.max(0, members.length - 5),
  );
  const visible = members.slice(windowStart, windowStart + 5);
  const max = metricMeta[metric].max;

  return (
    <div className="comparison-table">
      <div className="comparison-head table-row">
        <span>순위</span>
        <span>전시장</span>
        <span>딜러 · 권역</span>
        <span>{metricMeta[metric].label}</span>
        <span>위치</span>
      </div>
      {visible.map((item) => {
        const rank = members.findIndex((member) => member.cdsid === item.cdsid) + 1;
        const value = valueOf(item, metric);
        const isSelected = item.cdsid === selected.cdsid;
        return (
          <div
            className={`table-row ${isSelected ? "selected" : ""}`}
            key={item.cdsid}
          >
            <span className="rank-number">
              {rank}
              <small>/{members.length}</small>
            </span>
            <span className="showroom-name">
              {item.showroom.replace("볼보 ", "")}
              {isSelected && <em>MY</em>}
            </span>
            <span className="dealer-region">
              {item.dealer}
              <small>{item.region}</small>
            </span>
            <span className="comparison-bar">
              <i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
            </span>
            <strong>{displayNumber(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [selectedCode, setSelectedCode] = useState("6KR6834");
  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>("voc");
  const [comparisonMetric, setComparisonMetric] = useState<MetricKey>("combat");
  const [group, setGroup] = useState<GroupKey>("all");
  const [profileOpen, setProfileOpen] = useState(false);

  const selected =
    dashboard.showrooms.find((item) => item.cdsid === selectedCode) ??
    dashboard.showrooms[0];
  const combat = selected.combat ?? 0;
  const tier = getTier(combat);
  const nationalRank =
    [...dashboard.showrooms]
      .sort((a, b) => valueOf(b, "combat") - valueOf(a, "combat"))
      .findIndex((item) => item.cdsid === selected.cdsid) + 1;
  const topPercent = Math.ceil(
    (nationalRank / dashboard.meta.showroomCount) * 100,
  );

  const kpis = [
    {
      key: "v3s" as const,
      value: selected.v3s ?? 0,
      average: dashboard.averages.v3s ?? 0,
      previous: selected.q1?.v3s ?? null,
      appeal: "possible" as const,
    },
    {
      key: "voc" as const,
      value: selected.voc ?? 0,
      average: dashboard.averages.voc ?? 0,
      previous: selected.q1?.voc ?? null,
      appeal: "partial" as const,
    },
    {
      key: "cx" as const,
      value: selected.cx ?? 0,
      average: dashboard.averages.cx ?? 0,
      previous: selected.q1?.cx ?? null,
      appeal: "partial" as const,
    },
  ];
  const warningCount = kpis.filter((item) => item.value < item.average).length;
  const combatDelta = combat - dashboard.meta.combatAverage;
  const gaugeAngle = Math.min(360, Math.max(0, (combat / dashboard.meta.combatMax) * 360));

  const correctiveItems = [
    {
      label: "V3S",
      value: selected.v3s,
      average: dashboard.averages.v3s,
      appeal: "possible" as const,
    },
    {
      label: "VOC",
      value: selected.voc,
      average: dashboard.averages.voc,
      appeal: "partial" as const,
    },
    {
      label: "출고 만족도",
      value: selected.delivery,
      average: dashboard.averages.delivery,
      appeal: "locked" as const,
    },
    {
      label: "시승 만족도",
      value: selected.testDrive,
      average: dashboard.averages.testDrive,
      appeal: "locked" as const,
    },
    {
      label: "긴급 경보",
      value: selected.emergency,
      average: dashboard.averages.emergency,
      appeal: "possible" as const,
    },
  ].filter(
    (item) =>
      item.value !== null &&
      item.average !== null &&
      (item.value as number) < (item.average as number),
  );

  const mailSubject = `[DSC 보정 요청] ${selected.showroom} / ${dashboard.meta.quarter}`;
  const mailBody = [
    "DSC KPI 사후 보정 검토를 요청드립니다.",
    "",
    `전시장: ${selected.showroom}`,
    `지점장: ${selected.manager}`,
    `CDSID: ${selected.cdsid}`,
    `기준: ${dashboard.meta.quarter} · ${dashboard.meta.sourceWeek}`,
    "",
    `V3S: ${displayNumber(selected.v3s)} (평균 ${displayNumber(dashboard.averages.v3s)})`,
    `VOC: ${displayNumber(selected.voc)} (평균 ${displayNumber(dashboard.averages.voc)})`,
    `CX Index: ${displayNumber(selected.cx)} (평균 ${displayNumber(dashboard.averages.cx)})`,
    "",
    "보정 요청 사유 및 증빙:",
  ].join("\r\n");
  const mailto = `mailto:hanjh@edutnc.com,hlee1@volvocars.com?cc=tnc@edutnc.com&subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            V
          </span>
          <div>
            <strong>DSC COMMAND</strong>
            <span>Retail Performance Intelligence</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="private-badge">
            <i aria-hidden="true" /> PRIVATE · 관리자 전용
          </span>
          <span className="period-badge">
            2026 {dashboard.meta.quarter}
            <small>{dashboard.meta.sourceWeek}</small>
          </span>
          <button
            className="profile-button"
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
          >
            <span className="avatar">{selected.manager.slice(0, 1)}</span>
            <span>
              <strong>{selected.manager} 지점장</strong>
              <small>{selected.showroom.replace("볼보 ", "")}</small>
            </span>
            <b aria-hidden="true">⌄</b>
          </button>
        </div>
        {profileOpen && (
          <div className="profile-popover">
            <div>
              <span>CDSID 프로필 전환</span>
              <strong>접속 계정에 연결된 전시장을 선택하세요</strong>
            </div>
            <label>
              <span className="sr-only">CDSID 프로필</span>
              <select
                value={selectedCode}
                onChange={(event) => {
                  setSelectedCode(event.target.value);
                  setProfileOpen(false);
                }}
              >
                {dashboard.showrooms.map((item) => (
                  <option key={item.cdsid} value={item.cdsid}>
                    {item.cdsid} · {item.showroom} · {item.manager}
                  </option>
                ))}
              </select>
            </label>
            <small>
              Google Sheets의 CDSID-전시장 매핑 연결 전까지 사용하는 관리자
              미리보기입니다.
            </small>
          </div>
        )}
      </header>

      <section className="identity-strip">
        <div>
          <span className="eyebrow">MY SHOWROOM · {selected.cdsid}</span>
          <h1>
            {selected.showroom.replace("볼보 ", "")}
            <small>전시장의 현재 위상</small>
          </h1>
        </div>
        <dl>
          <div>
            <dt>딜러사</dt>
            <dd>{selected.dealer}</dd>
          </div>
          <div>
            <dt>권역</dt>
            <dd>{selected.region}</dd>
          </div>
          <div>
            <dt>사이즈</dt>
            <dd>{selected.size}</dd>
          </div>
        </dl>
      </section>

      {warningCount > 0 ? (
        <section className="warning-banner">
          <span className="warning-beacon" aria-hidden="true">
            !
          </span>
          <div>
            <strong>전국 평균 미달 지표 {warningCount}개 감지</strong>
            <p>
              평균선 아래 지표를 먼저 확인하세요. 보정 가능한 항목은 즉시 검토 요청할
              수 있습니다.
            </p>
          </div>
          <a href="#correction">리스크 확인 →</a>
        </section>
      ) : (
        <section className="clear-banner">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>핵심 지표 3개 모두 전국 평균 이상</strong>
            <p>현재 페이스를 유지하며 상위 그룹과의 격차를 확인하세요.</p>
          </div>
        </section>
      )}

      <section className="hero-grid">
        <article className={`combat-card ${tier.className}`}>
          <div className="card-heading">
            <div>
              <span className="eyebrow">SHOWROOM POWER INDEX</span>
              <h2>전시장 전투력</h2>
            </div>
            <span className={`tier-badge ${tier.className}`}>{tier.name}</span>
          </div>
          <div className="gauge-zone">
            <div
              className="combat-gauge"
              style={{ "--gauge-angle": `${gaugeAngle}deg` } as React.CSSProperties}
            >
              <div>
                <strong>{displayNumber(combat)}</strong>
                <span>/ {dashboard.meta.combatMax}</span>
              </div>
            </div>
            <div className="rank-stack">
              <span>{tier.label} 레벨</span>
              <strong>
                {nationalRank}
                <small>위</small>
              </strong>
              <em>전국 {dashboard.meta.showroomCount}개 중 상위 {topPercent}%</em>
            </div>
          </div>
          <div className="combat-footer">
            <span>
              전국 평균 <strong>{displayNumber(dashboard.meta.combatAverage)}</strong>
            </span>
            <span className={combatDelta >= 0 ? "positive" : "negative"}>
              평균 대비{" "}
              <strong>
                {combatDelta >= 0 ? "+" : ""}
                {combatDelta.toFixed(1)}
              </strong>
            </span>
            <span>
              Q1 대비{" "}
              <strong className={(combat - (selected.q1?.combat ?? combat)) >= 0 ? "positive" : "negative"}>
                {combat - (selected.q1?.combat ?? combat) >= 0 ? "+" : ""}
                {(combat - (selected.q1?.combat ?? combat)).toFixed(1)}
              </strong>
            </span>
          </div>
        </article>

        <div className="kpi-column">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">CORE SIGNALS</span>
              <h2>3대 핵심 지표</h2>
            </div>
            <p>카드를 선택하면 주간 흐름이 바뀝니다</p>
          </div>
          <div className="metric-grid">
            {kpis.map((item) => (
              <MetricCard
                key={item.key}
                metric={item.key}
                value={item.value}
                average={item.average}
                previous={item.previous}
                active={trendMetric === item.key}
                onSelect={() => setTrendMetric(item.key)}
                appeal={item.appeal}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel trend-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">52-WEEK PULSE</span>
              <h2>주간 성과 흐름</h2>
            </div>
            <div className="segmented">
              {(["v3s", "voc", "cx"] as TrendMetricKey[]).map((metric) => (
                <button
                  key={metric}
                  type="button"
                  className={trendMetric === metric ? "active" : ""}
                  onClick={() => setTrendMetric(metric)}
                >
                  {metricMeta[metric].short}
                </button>
              ))}
            </div>
          </div>
          <WeeklyTrend showroom={selected} metric={trendMetric} />
        </article>

        <article className="panel correction-panel" id="correction">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ACTION CENTER</span>
              <h2>보정 검토 센터</h2>
            </div>
            <span className="issue-count">{correctiveItems.length}</span>
          </div>
          {correctiveItems.length ? (
            <div className="issue-list">
              {correctiveItems.slice(0, 4).map((item) => {
                const delta = (item.value as number) - (item.average as number);
                return (
                  <div className="issue-item" key={item.label}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>
                        {displayNumber(item.value)} · 평균 대비 {delta.toFixed(1)}
                      </span>
                    </div>
                    <AppealBadge type={item.appeal} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-issues">
              <span aria-hidden="true">✓</span>
              <strong>현재 평균 미달 항목이 없습니다</strong>
              <p>주간 이상 신호가 생기면 여기에 자동으로 표시됩니다.</p>
            </div>
          )}
          <a className="mail-action" href={mailto}>
            <span aria-hidden="true">↗</span>
            Outlook으로 보정 요청
          </a>
          <p className="mail-helper">
            TO: hanjh@edutnc.com · hlee1@volvocars.com
            <br />
            CC: tnc@edutnc.com
          </p>
        </article>
      </section>

      <section className="panel comparison-panel">
        <div className="comparison-title-row">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COMPETITIVE POSITION</span>
              <h2>내 전시장의 경쟁 위치</h2>
            </div>
          </div>
          <div className="comparison-controls">
            <label>
              <span>비교 그룹</span>
              <select value={group} onChange={(event) => setGroup(event.target.value as GroupKey)}>
                {(Object.keys(groupMeta) as GroupKey[]).map((key) => (
                  <option key={key} value={key}>
                    {groupMeta[key].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>비교 지표</span>
              <select
                value={comparisonMetric}
                onChange={(event) =>
                  setComparisonMetric(event.target.value as MetricKey)
                }
              >
                {(Object.keys(metricMeta) as MetricKey[]).map((key) => (
                  <option key={key} value={key}>
                    {metricMeta[key].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="group-context">
          <span>{groupMeta[group].helper}</span>
          <strong>
            {group === "dealer"
              ? selected.dealer
              : group === "region"
                ? selected.region
                : group === "size"
                  ? `${selected.size} Size`
                  : "VOLVO KOREA"}
          </strong>
        </div>
        <ComparisonTable selected={selected} metric={comparisonMetric} group={group} />
      </section>

      <footer className="dashboard-footer">
        <span>DSC COMMAND · 2026 Retail Performance Intelligence</span>
        <span>
          기준 데이터: {dashboard.meta.quarter} · 전국 {dashboard.meta.showroomCount}개
          전시장
        </span>
      </footer>
    </main>
  );
}
