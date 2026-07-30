"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dashboardJson from "./data/showrooms.json";
import weeklyJson from "./data/weekly.json";

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
    updatedAt: string;
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

type Viewer = {
  displayName: string;
  email: string | null;
  isEditor: boolean;
};

type LatestUpdate = {
  title: string;
  note?: string;
  effectiveDate: string;
  updatedBy?: string;
  attachments?: { filename: string; sizeBytes: number }[];
};

type WeeklyData = {
  meta: {
    workbookUrl: string;
    syncedAt: string;
    vocLatestWeek: number;
    cxLatestWeek: number;
    rules: {
      voc: string;
      cx: string;
    };
  };
  voc: {
    average: (number | null)[];
    byCdsid: Record<string, (number | null)[]>;
  };
  cx: {
    average: (number | null)[];
    byCdsid: Record<string, (number | null)[]>;
  };
};

const dashboard = dashboardJson as DashboardData;
const weeklyDashboard = weeklyJson as WeeklyData;

const metricMeta: Record<
  MetricKey,
  { label: string; short: string; max: number; unit: string }
> = {
  combat: { label: "종합 전투력", short: "TOTAL", max: 330, unit: "점" },
  v3s: { label: "V3S", short: "V3S", max: 100, unit: "점" },
  voc: { label: "VOC", short: "VOC", max: 100, unit: "점" },
  cx: { label: "CX Index", short: "CX Index", max: 130, unit: "점" },
};

const metricDescriptions: Record<TrendMetricKey, string> = {
  v3s: "Volvo Sales Standard · 영업 프로세스 평가",
  voc: "Voice of Customer · 고객 의견 평가",
  cx: "Customer Experience Index · 고객 경험 종합 지수",
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

const displayShowroomName = (name: string) => {
  const trimmed = name.trim();
  return trimmed.startsWith("볼보 ") ? trimmed : `볼보 ${trimmed}`;
};

function getTier(score: number) {
  if (score >= 320) return { className: "diamond" };
  if (score >= 310) return { className: "platinum" };
  if (score >= 300) return { className: "gold" };
  return { className: "watch" };
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
    possible: {
      icon: "↻",
      label: "사후 보정 가능",
      description: "검증 자료 제출 후 담당자 확인을 거쳐 보정할 수 있습니다.",
    },
    partial: {
      icon: "◐",
      label: "일부 평가 불가",
      description: "필수 평가 항목 중 미완료 항목이 존재합니다.",
    },
    locked: {
      icon: "⊘",
      label: "사후 보정 불가",
      description: "확정된 항목으로 사후 보정 대상이 아닙니다.",
    },
  }[type];

  return (
    <span
      className={`appeal-badge ${type}`}
      title={`${content.label}: ${content.description}`}
    >
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
  const fill = Math.min(100, Math.max(0, (value / metricMeta[metric].max) * 100));
  const signalRule =
    signal.tone === "warning"
      ? "경고: Q2 전국 평균 대비 5점 이상 미달"
      : signal.tone === "caution"
        ? "주의: Q2 전국 평균 미만, 5점 미만 차이"
        : "정상: Q2 전국 평균 이상";
  const quarterScores = [
    { label: "Q1", value: previous, state: "complete" },
    { label: "Q2", value, state: "current" },
    { label: "Q3", value: null, state: "planned" },
    { label: "Q4", value: null, state: "planned" },
  ];

  return (
    <button
      className={`metric-card ${signal.tone} ${active ? "active" : ""}`}
      onClick={onSelect}
      type="button"
      aria-pressed={active}
    >
      <div className="metric-card-topline">
        <span className="metric-code" title={metricDescriptions[metric]}>
          {metricMeta[metric].short}
        </span>
        <span className={`signal-pill ${signal.tone}`} title={signalRule}>
          <SignalIcon tone={signal.tone} />
          {signal.label}
        </span>
      </div>
      <div className="metric-card-value">
        {displayNumber(value)}
        <span>점</span>
      </div>
      <div
        className="metric-benchmark"
        title={`Q2 전국 평균 ${displayNumber(average)}점`}
      >
        <span>Q2 전국 평균 대비</span>
        <strong className={signal.tone}>
          {signal.delta >= 0 ? "+" : ""}
          {signal.delta.toFixed(1)}점
        </strong>
      </div>
      <div className="metric-track" aria-hidden="true">
        <span style={{ width: `${fill}%` }} />
        <i style={{ left: `${(average / metricMeta[metric].max) * 100}%` }} />
      </div>
      <div
        className="metric-quarter-strip"
        aria-label={`${metricMeta[metric].short} 분기 평가점수`}
      >
        {quarterScores.map((quarter) => (
          <span className={quarter.state} key={quarter.label}>
            <small>{quarter.label}</small>
            <strong>
              {quarter.value === null ? "—" : displayNumber(quarter.value)}
            </strong>
          </span>
        ))}
      </div>
      <div className="metric-card-footer">
        <AppealBadge type={appeal} />
      </div>
    </button>
  );
}

function WeeklyTrend({
  showroom,
  metric,
  showAllValues,
}: {
  showroom: Showroom;
  metric: TrendMetricKey;
  showAllValues: boolean;
}) {
  const current = showroom[metric] ?? 0;
  const previous = showroom.q1?.[metric] ?? null;
  const average = dashboard.averages[metric] ?? 0;
  const isWeeklyMetric = metric === "voc" || metric === "cx";
  const nativeWeekly =
    metric === "voc" || metric === "cx" ? weeklyDashboard[metric] : null;
  const weeklySeries = nativeWeekly?.byCdsid[showroom.cdsid] ?? null;
  const averageSeries = nativeWeekly?.average ?? null;
  const trendScrollRef = useRef<HTMLDivElement>(null);
  const [showActual, setShowActual] = useState(true);
  const [showNational, setShowNational] = useState(true);
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  const latestWeek =
    metric === "voc"
      ? weeklyDashboard.meta.vocLatestWeek
      : metric === "cx"
        ? weeklyDashboard.meta.cxLatestWeek
        : 26;
  const rawPoints = weeklySeries
    ? weeklySeries
        .slice(0, latestWeek)
        .map((value, index) =>
          value === null
            ? null
            : {
                week: index + 1,
                value,
                label: `W${String(index + 1).padStart(2, "0")}`,
              },
        )
        .filter(Boolean) as { week: number; value: number; label: string }[]
    : ([
        previous === null ? null : { week: 13, value: previous, label: "Q1 마감" },
        { week: 26, value: current, label: "Q2 마감" },
      ].filter(Boolean) as { week: number; value: number; label: string }[]);
  const averagePoints = averageSeries
    ? averageSeries
        .slice(0, latestWeek)
        .map((value, index) =>
          value === null
            ? null
            : { week: index + 1, value, label: "전국 평균" },
        )
        .filter(Boolean) as { week: number; value: number; label: string }[]
    : [];
  const chartValues = [
    ...rawPoints.map((point) => point.value),
    ...averagePoints.map((point) => point.value),
    average,
  ];
  const max = Math.min(
    metricMeta[metric].max,
    Math.max(...chartValues, metricMeta[metric].max * 0.4) + 8,
  );
  const min = Math.max(0, Math.min(...chartValues) - 8);
  const plotLeft = 28;
  const plotRight = 1332;
  const plotWidth = plotRight - plotLeft;
  const x = (week: number) =>
    plotLeft + ((week - 0.5) / 52) * plotWidth;
  const y = (value: number) => 170 - ((value - min) / Math.max(1, max - min)) * 126;
  const weeks = Array.from({ length: 52 }, (_, index) => index + 1);
  const quarterDividers = [13.5, 26.5, 39.5];
  const quarterLabels = [
    { label: "Q1", range: "W01–W13" },
    { label: "Q2", range: "W14–W26" },
    { label: "Q3", range: "W27–W39" },
    { label: "Q4", range: "W40–W52" },
  ];
  const averageAt = (week: number) =>
    averageSeries?.[week - 1] ?? average;
  const actualAt = (week: number) => weeklySeries?.[week - 1] ?? null;
  const labelBaselineY = (
    pointY: number,
    pairedPointY: number | null,
    preferred: "above" | "below",
  ) => {
    const candidates =
      preferred === "above"
        ? [pointY - 10, pointY + 15]
        : [pointY + 15, pointY - 10];

    const available = candidates.find((baseline) => {
      const labelTop = baseline - 8;
      const labelBottom = baseline + 2;
      const staysInPlot = labelTop >= 6 && labelBottom <= 166;
      const clearsPairedMarker =
        pairedPointY === null ||
        labelBottom < pairedPointY - 5 ||
        labelTop > pairedPointY + 5;
      return staysInPlot && clearsPairedMarker;
    });

    return available ?? Math.max(14, Math.min(164, candidates[0]));
  };
  const actualValueLabelY = (point: { week: number; value: number }) => {
    const pointY = y(point.value);
    const pairedPointY = y(averageAt(point.week));
    return labelBaselineY(
      pointY,
      pairedPointY,
      pointY <= pairedPointY ? "above" : "below",
    );
  };
  const nationalValueLabelY = (point: { week: number; value: number }) => {
    const pointY = y(point.value);
    const actualValue = actualAt(point.week);
    const pairedPointY = actualValue === null ? null : y(actualValue);
    return labelBaselineY(
      pointY,
      pairedPointY,
      pairedPointY === null || pointY < pairedPointY ? "above" : "below",
    );
  };
  const warningCount = rawPoints.filter(
    (point) => point.value < averageAt(point.week),
  ).length;
  const latestPoint = rawPoints.at(-1) ?? null;
  const previousPoint = rawPoints.at(-2) ?? null;
  const highestPoint = rawPoints.reduce(
    (best, point) => (!best || point.value > best.value ? point : best),
    null as { week: number; value: number; label: string } | null,
  );
  const lowestPoint = rawPoints.reduce(
    (best, point) => (!best || point.value < best.value ? point : best),
    null as { week: number; value: number; label: string } | null,
  );
  const importantActualWeeks = new Set([
    latestPoint?.week,
    highestPoint?.week,
    lowestPoint?.week,
    ...rawPoints
      .filter((point) => point.value - averageAt(point.week) <= -5)
      .map((point) => point.week),
  ]);
  const latestDelta =
    latestPoint && previousPoint ? latestPoint.value - previousPoint.value : null;
  const annotationWeek = latestPoint?.week ?? latestWeek;
  const annotationLabel = `W${String(annotationWeek).padStart(2, "0")}`;
  const makeSegments = (
    series: (number | null)[],
    limit: number,
  ) => {
    const segments: { week: number; value: number }[][] = [];
    let segment: { week: number; value: number }[] = [];

    series.slice(0, limit).forEach((value, index) => {
      if (value === null) {
        if (segment.length) segments.push(segment);
        segment = [];
        return;
      }
      segment.push({ week: index + 1, value });
    });
    if (segment.length) segments.push(segment);
    return segments;
  };
  const storeSegments = [rawPoints];
  const nationalSegments = averageSeries
    ? makeSegments(averageSeries, latestWeek)
    : [];
  const hoverActual =
    hoverWeek === null
      ? null
      : weeklySeries?.[hoverWeek - 1] ??
        rawPoints.find((point) => point.week === hoverWeek)?.value ??
        null;
  const hoverNational =
    hoverWeek === null || hoverWeek > latestWeek ? null : averageAt(hoverWeek);
  const hoverDelta =
    hoverActual === null || hoverNational === null
      ? null
      : hoverActual - hoverNational;

  useEffect(() => {
    if (trendScrollRef.current) {
      trendScrollRef.current.scrollLeft = 0;
    }
  }, [metric, showroom.cdsid]);

  return (
    <div className="trend-wrap">
      <div
        ref={trendScrollRef}
        className="trend-scroll"
        tabIndex={0}
        aria-label="W01부터 시작하는 52주 성과 그래프"
      >
        <div className="trend-canvas">
          <div className="quarter-band" aria-hidden="true">
            {quarterLabels.map((quarter) => (
              <span key={quarter.label}>
                <strong>{quarter.label}</strong>
                <small>{quarter.range}</small>
              </span>
            ))}
          </div>
          <svg
            className="trend-chart"
            viewBox="0 0 1360 200"
            role="img"
            aria-label={`${metricMeta[metric].label} W01부터 W52까지 연간 데이터 입력 현황`}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const viewX =
                ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 1360;
              const week = Math.floor(
                ((viewX - plotLeft) / plotWidth) * 52 + 1,
              );
              setHoverWeek(Math.max(1, Math.min(52, week)));
            }}
            onPointerLeave={() => setHoverWeek(null)}
          >
            <line
              x1={plotLeft}
              x2={plotRight}
              y1="170"
              y2="170"
              className="week-axis"
            />
            {weeks.map((week) => (
              <line
                key={week}
                x1={x(week)}
                x2={x(week)}
                y1="165"
                y2="170"
                className={`week-tick ${week <= latestWeek ? "entered" : "pending"}`}
              />
            ))}
            {quarterDividers.map((week) => (
              <line
                key={week}
                x1={x(week)}
                x2={x(week)}
                y1="18"
                y2="170"
                className="week-grid"
              />
            ))}
            {latestWeek < 52 && (
              <g className="future-window-group" aria-hidden="true">
                <rect
                  x={x(latestWeek + 0.5)}
                  y="18"
                  width={plotRight - x(latestWeek + 0.5)}
                  height="152"
                  className="future-window"
                />
                <text
                  x={(x(latestWeek + 0.5) + plotRight) / 2}
                  y="88"
                  textAnchor="middle"
                  className="future-window-label"
                >
                  Q3 평가 진행 중
                </text>
                <text
                  x={(x(latestWeek + 0.5) + plotRight) / 2}
                  y="104"
                  textAnchor="middle"
                  className="future-window-help"
                >
                  데이터 집계 후 자동 반영됩니다.
                </text>
              </g>
            )}
            {showNational && (nationalSegments.length ? (
              <>
                {nationalSegments.map((segment, index) => (
                  <polyline
                    key={`national-${index}`}
                    points={segment
                      .map((point) => `${x(point.week)},${y(point.value)}`)
                      .join(" ")}
                    className="average-trend-line"
                  />
                ))}
                {averagePoints.map((point) => (
                  <g key={`average-${point.week}`}>
                    <circle
                      cx={x(point.week)}
                      cy={y(point.value)}
                      r="4.5"
                      className="national-average-point"
                    >
                      <title>
                        {`W${String(point.week).padStart(2, "0")} 전국 평균 ${displayNumber(
                          point.value,
                        )}점`}
                      </title>
                    </circle>
                    {(showAllValues || point.week === annotationWeek) && (
                      <text
                        x={x(point.week)}
                        y={nationalValueLabelY(point)}
                        textAnchor="middle"
                        className="national-point-value"
                        aria-hidden="true"
                      >
                        {displayNumber(point.value)}
                      </text>
                    )}
                  </g>
                ))}
              </>
            ) : (
              <>
                <line
                  x1={plotLeft}
                  x2={plotRight}
                  y1={y(average)}
                  y2={y(average)}
                  className="average-line"
                />
              </>
            ))}
            {showActual && storeSegments.map(
              (segment, index) =>
                segment.length > 1 && (
                  <polyline
                    key={`store-${index}`}
                    points={segment
                      .map((point) => `${x(point.week)},${y(point.value)}`)
                      .join(" ")}
                    className="trend-line"
                  />
                ),
            )}
            {showActual && rawPoints.map((point) => (
              <g key={`${point.week}-${point.label}`}>
                {isWeeklyMetric ? (
                  <rect
                    x={x(point.week) - 4.5}
                    y={y(point.value) - 4.5}
                    width="9"
                    height="9"
                    data-week={point.label}
                    className="actual-week-point"
                  >
                    <title>
                      {`${point.label} ${displayShowroomName(
                        showroom.showroom,
                      )} 실제값 ${displayNumber(point.value)}점 · 전국 평균 ${displayNumber(
                        averageAt(point.week),
                      )}점`}
                    </title>
                  </rect>
                ) : (
                  <circle
                    cx={x(point.week)}
                    cy={y(point.value)}
                    r="4.5"
                    className="actual-quarter-point"
                  >
                    <title>
                      {`${point.label} ${displayNumber(point.value)}점 · 전국 평균 ${displayNumber(
                        averageAt(point.week),
                      )}점`}
                    </title>
                  </circle>
                )}
                {(showAllValues || importantActualWeeks.has(point.week)) && (
                  <text
                    x={x(point.week)}
                    y={actualValueLabelY(point)}
                    textAnchor="middle"
                    className="actual-point-value"
                    aria-hidden="true"
                  >
                    {displayNumber(point.value)}
                  </text>
                )}
              </g>
            ))}
            {hoverWeek !== null && (
              <line
                x1={x(hoverWeek)}
                x2={x(hoverWeek)}
                y1="18"
                y2="170"
                className="hover-guide"
                aria-hidden="true"
              />
            )}
          </svg>
          {hoverWeek !== null && (
            <div
              className={`chart-tooltip ${
                hoverWeek <= 4 ? "at-start" : hoverWeek >= 49 ? "at-end" : ""
              }`}
              style={{ left: `${2 + ((hoverWeek - 1) / 51) * 96}%` }}
              role="status"
              aria-live="polite"
            >
              <strong>W{String(hoverWeek).padStart(2, "0")}</strong>
              {hoverWeek > latestWeek ? (
                <span className="tooltip-upcoming">집계 예정</span>
              ) : (
                <>
                  <span>
                    <i className="tooltip-key actual" />
                    {displayShowroomName(showroom.showroom)}
                    <b>{hoverActual === null ? "—" : `${displayNumber(hoverActual)}점`}</b>
                  </span>
                  <span>
                    <i className="tooltip-key national" />
                    전국 평균
                    <b>
                      {hoverNational === null
                        ? "—"
                        : `${displayNumber(hoverNational)}점`}
                    </b>
                  </span>
                  {hoverDelta !== null && (
                    <em className={hoverDelta >= 0 ? "positive" : "negative"}>
                      평균 대비 {hoverDelta >= 0 ? "+" : ""}
                      {hoverDelta.toFixed(1)}점
                    </em>
                  )}
                </>
              )}
            </div>
          )}
          <div className="week-ruler" aria-label="W01부터 W52까지 주차">
            {weeks.map((week) => {
              const value =
                weeklySeries?.[week - 1] ??
                rawPoints.find((point) => point.week === week)?.value ??
                null;
              const isEntered = value !== null;
              const isMissing = week <= latestWeek && value === null;
              const isWarning =
                value !== null && value < averageAt(week);
              const status = isWarning
                ? "warning"
                : isEntered
                  ? "entered"
                  : isMissing
                    ? "missing"
                    : "future";
              const label = `W${String(week).padStart(2, "0")}`;
              const isMajorWeek =
                week === 1 ||
                (week - 1) % 4 === 0 ||
                [13, 26, 39, 52].includes(week);

              return (
                <span
                  key={week}
                  className={status}
                  aria-label={label}
                  title={
                    value === null
                      ? `${label} ${isMissing ? "데이터 없음" : "입력 예정"}`
                      : `${label} ${displayNumber(value)}점 · 전국 평균 ${displayNumber(
                          averageAt(week),
                        )}점`
                  }
                >
                  {isMajorWeek ? label : ""}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <div className="data-coverage" aria-label="차트 범례">
        <button
          type="button"
          className={showActual ? "active" : ""}
          aria-pressed={showActual}
          onClick={() => setShowActual((visible) => !visible)}
        >
          <i className={isWeeklyMetric ? "coverage-line actual" : "coverage-dot filled"} />
          {isWeeklyMetric
            ? `${displayShowroomName(showroom.showroom)} 실제값 · ${annotationLabel} ${
                latestPoint ? `${displayNumber(latestPoint.value)}점` : "—"
              } · 입력 ${rawPoints.length}주`
            : `최신 W${String(latestWeek).padStart(2, "0")} · 실제 입력 ${
                rawPoints.length
              }주`}
        </button>
        <button
          type="button"
          className={showNational ? "active" : ""}
          aria-pressed={showNational}
          onClick={() => setShowNational((visible) => !visible)}
        >
          <i className={isWeeklyMetric ? "coverage-line national" : "coverage-dot warning"} />
          {isWeeklyMetric
            ? `전국 주간 평균 · ${annotationLabel} ${displayNumber(
                averageAt(annotationWeek),
              )}점 · 평균 미달 ${warningCount}주`
            : `전국 평균 미달 ${warningCount}주`}
        </button>
        <span>
          <i className="coverage-dot year" />
          {latestPoint && previousPoint
            ? `${latestPoint.label} 직전 입력주 대비 ${
                latestDelta! >= 0 ? "+" : ""
              }${latestDelta!.toFixed(1)}`
            : "W01–W52 전체 주차"}
        </span>
        <span>
          <i className="coverage-dot" />
          {metric === "voc"
            ? "0.0 미응답은 제외 · 공백은 응답 대기"
            : metric === "cx"
              ? "5개 공식 평가항목 환산 · 최대 130점"
              : "분기 평가값만 표시 · 주간값 미생성"}
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
  const windowSize = 3;
  const windowStart = Math.min(
    Math.max(0, selectedIndex - 1),
    Math.max(0, members.length - windowSize),
  );
  const visible = members.slice(windowStart, windowStart + windowSize);
  const max = metricMeta[metric].max;
  const benchmark =
    metric === "combat"
      ? dashboard.meta.combatAverage
      : dashboard.averages[metric] ?? 0;

  return (
    <div className="comparison-table">
      <div className="comparison-head table-row">
        <span>순위</span>
        <span>전시장</span>
        <span>딜러 · 권역</span>
        <span>{metricMeta[metric].label}</span>
        <span>점수 · 평균 대비</span>
      </div>
      {visible.map((item) => {
        const rank =
          members.findIndex((member) => valueOf(member, metric) === valueOf(item, metric)) +
          1;
        const value = valueOf(item, metric);
        const delta = value - benchmark;
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
              {displayShowroomName(item.showroom)}
              {isSelected && <em>내 전시장</em>}
            </span>
            <span className="dealer-region">
              {item.dealer}
              <small>{item.region}</small>
            </span>
            <span
              className="comparison-bar"
              title={`${metricMeta[metric].label} ${displayNumber(
                value,
              )}점 · 전국 평균 ${displayNumber(benchmark)}점`}
            >
              <i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
              <b
                aria-hidden="true"
                style={{ left: `${Math.min(100, (benchmark / max) * 100)}%` }}
              />
            </span>
            <span className="comparison-value">
              <strong>{displayNumber(value)}</strong>
              <small className={delta >= 0 ? "positive" : "negative"}>
                {delta >= 0 ? "▲" : "▼"}
                {Math.abs(delta).toFixed(1)}
              </small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CriteriaGuide({ cdsid }: { cdsid: string }) {
  const [active, setActive] = useState<TrendMetricKey>("v3s");

  return (
    <main className="criteria-page">
      <header className="criteria-page-topbar">
        <Link className="brand" href={`/dashboard/${cdsid}`} aria-label="대시보드로 돌아가기">
          <span className="brand-mark" aria-hidden="true">
            V
          </span>
          <div>
            <strong>DSC COMMAND</strong>
            <span>Score Criteria Sheet</span>
          </div>
        </Link>
        <Link className="criteria-back" href={`/dashboard/${cdsid}`}>
          ← {cdsid} 대시보드
        </Link>
      </header>

      <div className="criteria-page-heading">
        <div>
          <span className="eyebrow">SCORING REFERENCE</span>
          <h1>평가 기준</h1>
          <p>V3S · VOC · CX Index의 산정 구조와 점수 구간을 확인합니다.</p>
        </div>
        <span>2026 DSC</span>
      </div>

      <section className="panel criteria-panel">
      <div className="criteria-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HOW THE SCORE WORKS</span>
            <h2>평가 기준 한눈에 보기</h2>
          </div>
        </div>
        <div className="criteria-tabs" role="tablist" aria-label="평가 기준 지표">
          {(["v3s", "voc", "cx"] as TrendMetricKey[]).map((metric) => (
            <button
              key={metric}
              type="button"
              role="tab"
              aria-selected={active === metric}
              className={active === metric ? "active" : ""}
              onClick={() => setActive(metric)}
            >
              {metricMeta[metric].label}
            </button>
          ))}
        </div>
      </div>

      {active === "v3s" && (
        <div className="criteria-body" role="tabpanel">
          <div className="criteria-summary">
            <span className="criteria-number">01</span>
            <div>
              <strong>500점을 100점으로 환산</strong>
              <p>
                미스터리 쇼퍼 400점과 ONE Voice 100점을 합산해 전시장별
                분기 점수를 만듭니다.
              </p>
            </div>
            <div className="criteria-tags">
              <span>개별 평가</span>
              <span>분기 1회</span>
              <span className="appealable">2영업일 내 소명</span>
            </div>
          </div>
          <div className="v3s-composition" aria-label="V3S 500점 구성">
            {[
              ["Self Check & Greeting", 100],
              ["Consulting", 150],
              ["Farewell", 50],
              ["Premium Manner", 50],
              ["CNC", 50],
              ["시승 만족도", 50],
              ["해피콜 이행률", 50],
            ].map(([label, score]) => (
              <div
                key={String(label)}
                style={{ "--segment": score } as React.CSSProperties}
              >
                <strong>{score}점</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="criteria-ladder three">
            <div className="good">
              <span>V3S 90점 이상</span>
              <strong>DSC 100점</strong>
              <small>RTC 0.2%</small>
            </div>
            <div className="caution">
              <span>85점 이상</span>
              <strong>DSC 90점</strong>
              <small>RTC 0.1%</small>
            </div>
            <div className="warning">
              <span>85점 미만</span>
              <strong>DSC 80점</strong>
              <small>RTC 0%</small>
            </div>
          </div>
        </div>
      )}

      {active === "voc" && (
        <div className="criteria-body voc-criteria" role="tabpanel">
          <div className="criteria-summary">
            <span className="criteria-number">02</span>
            <div>
              <strong>고객 만족도와 프로세스의 가중 합</strong>
              <p>
                방문 후 7일 이내 설문을 보내고, 네 항목의 점수와 이행률을
                중요도에 따라 합산합니다.
              </p>
            </div>
            <div className="criteria-tags">
              <span>개별 평가</span>
              <span>연중 상시</span>
              <span className="appealable">해피콜 증빙 가능</span>
            </div>
          </div>
          <div className="voc-formula">
            <div className="voc-ring" aria-label="VOC 가중치 60, 20, 10, 10">
              <span>VOC</span>
              <strong>100점</strong>
            </div>
            <div className="weight-list">
              {[
                ["종합 만족도", "영업직원 상담 만족", 60],
                ["Greeting", "최초 맞이", 20],
                ["Consulting", "아이패드 활용", 10],
                ["Farewell", "방문감사 해피콜", 10],
              ].map(([label, description, weight]) => (
                <div key={String(label)}>
                  <i className={`weight-${weight}`} />
                  <strong>{label}</strong>
                  <span>{description}</span>
                  <b>{weight}%</b>
                </div>
              ))}
            </div>
          </div>
          <div className="criteria-ladder two">
            <div className="good">
              <span>VOC 85점 이상</span>
              <strong>DSC 100점</strong>
              <small>RTC 0.2%</small>
            </div>
            <div className="warning">
              <span>85점 미만</span>
              <strong>DSC 90점</strong>
              <small>RTC 0.1%</small>
            </div>
          </div>
        </div>
      )}

      {active === "cx" && (
        <div className="criteria-body" role="tabpanel">
          <div className="criteria-summary">
            <span className="criteria-number">03</span>
            <div>
              <strong>5개 고객경험 항목, 총 130점</strong>
              <p>
                만족도뿐 아니라 긴급경보 처리, 조치계획, 앱 가입까지 운영
                행동을 함께 평가합니다.
              </p>
            </div>
            <div className="criteria-tags">
              <span>그룹 평가</span>
              <span>월·분기 마감</span>
              <span className="locked">항목별 보정 상이</span>
            </div>
          </div>
          <div className="cx-stack" aria-label="CX Management 130점 구성">
            {[
              ["신차 출고 만족도", "90점 이상", 40],
              ["시승 만족도", "90점 이상", 50],
              ["긴급경보", "2일 이내 처리", 10],
              ["조치계획", "분기 내 제출", 10],
              ["Hej Volvo 앱", "가입률 90% 이상", 20],
            ].map(([label, threshold, score]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <small>{threshold}</small>
                <strong>{score}점</strong>
              </div>
            ))}
          </div>
          <div className="criteria-ladder two">
            <div className="good">
              <span>합산 100점 이상</span>
              <strong>RTC 0.2%</strong>
              <small>월 마감 · 분기 지급</small>
            </div>
            <div className="warning">
              <span>합산 100점 미만</span>
              <strong>RTC 0.1%</strong>
              <small>월 마감 · 분기 지급</small>
            </div>
          </div>
        </div>
      )}

      <p className="criteria-source">
        기준: 2026 Retailer Terms &amp; Conditions Guideline · Competence
        pp.40-51 · Updated 2026.07.24
      </p>
      </section>
    </main>
  );
}

function AdminDrawer({
  viewer,
  open,
  onClose,
  onSaved,
}: {
  viewer: Viewer;
  open: boolean;
  onClose: () => void;
  onSaved: (update: LatestUpdate) => void;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/dashboard-updates", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as {
        update?: LatestUpdate;
        error?: string;
      };
      if (!response.ok || !payload.update) {
        throw new Error(payload.error ?? "업데이트를 저장하지 못했습니다.");
      }
      setStatus("done");
      setMessage("업데이트가 등록되었습니다.");
      onSaved(payload.update);
      event.currentTarget.reset();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "업데이트를 저장하지 못했습니다.",
      );
    }
  }

  return (
    <div className="admin-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="admin-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-drawer-head">
          <div>
            <span className="eyebrow">EDITOR ONLY</span>
            <h2 id="admin-title">데이터 업데이트 등록</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="editor-identity">
          <span>{viewer.displayName}</span>
          <strong>{viewer.email ?? "로컬 미리보기"}</strong>
          <em>수정 · 첨부 권한</em>
        </div>
        <form onSubmit={submit}>
          <label>
            <span>업데이트 제목</span>
            <input
              name="title"
              required
              placeholder="예: 26W30 VOC 백데이터 반영"
            />
          </label>
          <label>
            <span>적용일</span>
            <input
              name="effectiveDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label>
            <span>변경 메모</span>
            <textarea
              name="note"
              rows={4}
              placeholder="변경된 지표와 사유를 간단히 기록하세요."
            />
          </label>
          <label className="file-drop">
            <span>증빙 또는 데이터 파일</span>
            <input
              name="file"
              type="file"
              accept=".csv,.xls,.xlsx,.pdf,.png,.jpg,.jpeg"
            />
            <small>CSV · Excel · PDF · PNG · JPG, 최대 10MB</small>
          </label>
          {message && <p className={`admin-message ${status}`}>{message}</p>}
          <button
            className="admin-submit"
            type="submit"
            disabled={status === "saving" || !viewer.email}
          >
            {status === "saving" ? "저장 중…" : "업데이트 저장"}
          </button>
          {!viewer.email && (
            <p className="preview-helper">
              실제 저장은 배포된 사이트에서 허용된 편집자 계정으로 로그인한
              경우에만 가능합니다.
            </p>
          )}
        </form>
      </aside>
    </div>
  );
}

export default function Dashboard({
  viewer,
  initialCdsid,
}: {
  viewer: Viewer;
  initialCdsid: string;
}) {
  const [selectedCode, setSelectedCode] = useState(initialCdsid);
  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>("voc");
  const [showAllTrendValues, setShowAllTrendValues] = useState(false);
  const [comparisonMetric, setComparisonMetric] = useState<MetricKey>("combat");
  const [group, setGroup] = useState<GroupKey>("all");
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState<LatestUpdate>({
    title: "Q3 평가 진행중입니다.",
    effectiveDate: dashboard.meta.updatedAt,
  });

  useEffect(() => {
    let mounted = true;
    fetch("/api/dashboard-updates")
      .then((response) => response.json())
      .then((payload: { update?: LatestUpdate | null }) => {
        if (mounted && payload.update) setLatestUpdate(payload.update);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const selected =
    dashboard.showrooms.find((item) => item.cdsid === selectedCode) ??
    dashboard.showrooms[0];
  const displayUpdateTitle =
    latestUpdate.effectiveDate.replaceAll(".", "-") === "2026-07-29"
      ? "Q3 평가 진행중입니다."
      : latestUpdate.title;
  const combat = selected.combat ?? 0;
  const q1Combat = selected.q1?.combat ?? combat;
  const cumulativeAverage = (q1Combat + combat) / 2;
  const tier = getTier(combat);
  const nationalRank =
    [...dashboard.showrooms]
      .sort((a, b) => valueOf(b, "combat") - valueOf(a, "combat"))
      .findIndex((item) => item.cdsid === selected.cdsid) + 1;
  const rankInGroup = (members: Showroom[]) =>
    [...members]
      .sort((a, b) => valueOf(b, "combat") - valueOf(a, "combat"))
      .findIndex((item) => item.cdsid === selected.cdsid) + 1;
  const mobileRanks = [
    {
      label: "전국",
      rank: nationalRank,
      count: dashboard.meta.showroomCount,
    },
    {
      label: selected.dealer,
      rank: rankInGroup(
        dashboard.showrooms.filter((item) => item.dealer === selected.dealer),
      ),
      count: dashboard.showrooms.filter(
        (item) => item.dealer === selected.dealer,
      ).length,
    },
    {
      label: `${selected.size} Size`,
      rank: rankInGroup(
        dashboard.showrooms.filter((item) => item.size === selected.size),
      ),
      count: dashboard.showrooms.filter((item) => item.size === selected.size)
        .length,
    },
  ];

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

  return (
    <main className="dashboard">
      <section className="identity-strip">
        <div className="identity-title">
          <h1>{displayShowroomName(selected.showroom)}</h1>
          <div className="update-status">
            <i aria-hidden="true" />
            <time>
              최근 업데이트{" "}
              {latestUpdate.effectiveDate.replaceAll("-", ".")}
            </time>
            <span>{displayUpdateTitle}</span>
          </div>
        </div>
        <div className="identity-detail-rail">
          <dl>
            <div>
              <span className="identity-icon" aria-hidden="true">
                ⌂
              </span>
              <dt>딜러사</dt>
              <dd>{selected.dealer}</dd>
            </div>
            <div>
              <span className="identity-icon" aria-hidden="true">
                ◎
              </span>
              <dt>권역별</dt>
              <dd>{selected.region}</dd>
            </div>
            <div>
              <span className="identity-icon" aria-hidden="true">
                ↔
              </span>
              <dt>사이즈</dt>
              <dd>{selected.size}</dd>
            </div>
          </dl>
          <button
            className="identity-profile"
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
            aria-label={`${selected.manager} 지점장 프로필`}
          >
            <span className="identity-profile-icon" aria-hidden="true" />
            <span className="identity-profile-role">지점장</span>
            <strong>{selected.manager}</strong>
          </button>
        </div>
        {profileOpen && (
          <div className="profile-popover">
            {viewer.isEditor ? (
              <>
                <div>
                  <span>CDSID 프로필 전환</span>
                  <strong>데이터 점검을 위해 전시장을 선택하세요</strong>
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
                        {item.cdsid} · {displayShowroomName(item.showroom)} ·{" "}
                        {item.manager}
                      </option>
                    ))}
                  </select>
                </label>
                <small>편집 권한 계정은 전체 전시장을 점검할 수 있습니다.</small>
              </>
            ) : (
              <>
                <div>
                  <span>MY CDSID</span>
                  <strong>
                    {selected.cdsid} · {displayShowroomName(selected.showroom)}
                  </strong>
                </div>
                <Link className="profile-home-link" href="/">
                  CDSID 다시 입력
                </Link>
                <small>VIEW ONLY 계정은 선택한 전시장 데이터를 조회합니다.</small>
              </>
            )}
          </div>
        )}
      </section>

      <section className={`mobile-command ${warningCount ? "has-warning" : ""}`}>
        <div className="mobile-power">
          <div>
            <strong>{displayNumber(combat)}</strong>
            <small>
              / {dashboard.meta.combatMax} · 상반기 평균{" "}
              {displayNumber(cumulativeAverage)}
            </small>
          </div>
          <div>
            <strong>
              전국 {nationalRank}위
              <small> / {dashboard.meta.showroomCount}개점</small>
            </strong>
            <span className={combatDelta >= 0 ? "positive" : "negative"}>
              Q2 전국 평균 대비 {combatDelta >= 0 ? "+" : ""}
              {combatDelta.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="mobile-kpis">
          {kpis.map((item) => {
            const signal = getSignal(item.value, item.average);
            return (
              <button
                type="button"
                key={item.key}
                className={signal.tone}
                onClick={() => setTrendMetric(item.key)}
              >
                <span>{metricMeta[item.key].short}</span>
                <strong>{displayNumber(item.value)}</strong>
                <small>
                  Q2 평균 대비 {signal.delta >= 0 ? "+" : ""}
                  {signal.delta.toFixed(1)}
                </small>
              </button>
            );
          })}
        </div>
        <div className="mobile-alert-row">
          <div>
            <span aria-hidden="true">{warningCount ? "!" : "✓"}</span>
            <strong>
              {warningCount
                ? `평균 미달 ${warningCount}개 · 우선 조치 필요`
                : "핵심 지표 모두 평균 이상"}
            </strong>
          </div>
          <nav aria-label="모바일 빠른 이동">
            <a href="#weekly-trend">주간</a>
            <Link href={`/dashboard/${selected.cdsid}/criteria`}>평가 기준</Link>
          </nav>
        </div>
      </section>

      <section className="hero-grid">
        <article className={`combat-card ${tier.className}`}>
          <div className="combat-main">
            <div
              className="quarter-score-chart"
              aria-label={`Q1 ${displayNumber(q1Combat)}점, Q2 ${displayNumber(
                combat,
              )}점, Q3 및 Q4 평가 예정, 누적 평균 ${displayNumber(
                cumulativeAverage,
              )}점, ${dashboard.meta.combatMax}점 만점`}
            >
              <div className="quarter-score-meta">
                <span>분기 스코어</span>
                <small>{dashboard.meta.combatMax}점 만점</small>
              </div>
              {[
                { label: "Q1", value: q1Combat, current: false },
                { label: "Q2", value: combat, current: true },
                { label: "Q3", value: null, current: false },
                { label: "Q4", value: null, current: false },
              ].map((quarter) => (
                <div
                  className={`quarter-score-row ${
                    quarter.current ? "current" : ""
                  } ${quarter.value === null ? "planned" : ""}`}
                  key={quarter.label}
                >
                  <span>{quarter.label}</span>
                  <i aria-hidden="true">
                    <b
                      style={{
                        width:
                          quarter.value === null
                            ? "0%"
                            : `${Math.min(
                                100,
                                (quarter.value / dashboard.meta.combatMax) *
                                  100,
                              )}%`,
                      }}
                    />
                  </i>
                  <strong>
                    {quarter.value === null
                      ? "—"
                      : displayNumber(quarter.value)}
                  </strong>
                </div>
              ))}
            </div>
            <div className="combat-summary-stack">
              <span>Q2 종합 점수</span>
              <strong>
                {displayNumber(combat)}
                <small>점</small>
              </strong>
              <em>상반기 누적 평균 {displayNumber(cumulativeAverage)}점</em>
            </div>
          </div>
          <div className="combat-footer">
            <span>
              Q2 전국 평균{" "}
              <strong>{displayNumber(dashboard.meta.combatAverage)}</strong>
            </span>
            <span className={combatDelta >= 0 ? "positive" : "negative"}>
              Q2 전국 평균 대비{" "}
              <strong>
                {combatDelta >= 0 ? "+" : ""}
                {combatDelta.toFixed(1)}
              </strong>
            </span>
            <span>
              전국 순위{" "}
              <strong>
                {nationalRank}위 / {dashboard.meta.showroomCount}개점
              </strong>
            </span>
          </div>
        </article>

        <div className="kpi-column">
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

      <section className="content-grid" id="weekly-trend">
        <article className="panel trend-panel">
          <div className="section-heading">
            <div>
              <h2>52주 스코어 추이</h2>
            </div>
            <div className="trend-actions">
              <div
                className="trend-selector"
                role="group"
                aria-label="52주 지표 선택"
              >
                {(["v3s", "voc", "cx"] as TrendMetricKey[]).map((metric) => (
                  <button
                    key={metric}
                    type="button"
                    className={trendMetric === metric ? "active" : ""}
                    aria-label={`${metricMeta[metric].label} 52주 추이 보기`}
                    aria-pressed={trendMetric === metric}
                    onClick={() => setTrendMetric(metric)}
                  >
                    {metricMeta[metric].short}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`show-values-toggle ${
                  showAllTrendValues ? "active" : ""
                }`}
                aria-pressed={showAllTrendValues}
                onClick={() => setShowAllTrendValues((visible) => !visible)}
              >
                모든 값 표시
              </button>
            </div>
          </div>
          <WeeklyTrend
            showroom={selected}
            metric={trendMetric}
            showAllValues={showAllTrendValues}
          />
        </article>
      </section>

      <section className="panel comparison-panel">
        <div className="comparison-title-row">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COMPETITIVE POSITION</span>
              <h2>내 전시장의 경쟁 위치</h2>
              <small className="comparison-subtitle">
                전국 {dashboard.meta.showroomCount}개점 기준
              </small>
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
        <div className="mobile-comparison-summary">
          {mobileRanks.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.rank}위</strong>
              <small>{item.count}개 전시장</small>
            </div>
          ))}
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
      <AdminDrawer
        viewer={viewer}
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        onSaved={(update) => {
          setLatestUpdate(update);
          setAdminOpen(false);
        }}
      />
    </main>
  );
}
