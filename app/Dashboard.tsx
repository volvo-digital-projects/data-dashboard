"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import dashboardJson from "./data/showrooms.json";
import weeklyJson from "./data/weekly.json";

type MetricKey = "combat" | "v3s" | "voc" | "cx";
type TrendMetricKey = Exclude<MetricKey, "combat">;
type GroupKey = "all" | "dealer" | "region" | "size";
type QuarterKey = "q1" | "q2";

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

type HistoricalV3sPoint = {
  year: number;
  value: number | null;
  average?: number | null;
};

type Showroom = QuarterRecord & {
  q1: QuarterRecord | null;
  historicalV3s?: HistoricalV3sPoint[];
};

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
    weekRanges: {
      week: number;
      start: string;
      end: string;
    }[];
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
const seoulDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatSeoulDate = (date: Date) => {
  const parts = seoulDateFormatter.formatToParts(date);
  const part = (type: "year" | "month" | "day") =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}.${part("month")}.${part("day")}`;
};

const metricMeta: Record<
  MetricKey,
  { label: string; short: string; max: number; unit: string }
> = {
  combat: { label: "종합 경쟁력", short: "TOTAL", max: 330, unit: "점" },
  v3s: { label: "V3S", short: "V3S", max: 100, unit: "점" },
  voc: { label: "VOC", short: "VOC", max: 100, unit: "점" },
  cx: { label: "CX Index", short: "CX Index", max: 130, unit: "점" },
};

const metricDescriptions: Record<TrendMetricKey, string> = {
  v3s: "Volvo Sales Skill Simulation 평가 (VCK)",
  voc: "Voice of Customer · 고객 의견 평가(VCK)",
  cx: "Customer Experience Index · 고객경험 종합지수(글로벌)",
};

const quarterValueOf = (
  item: Showroom,
  metric: MetricKey,
  quarter: QuarterKey,
) => {
  const value = quarter === "q1" ? item.q1?.[metric] : item[metric];
  return typeof value === "number" ? value : null;
};

const quarterAverageOf = (metric: MetricKey, quarter: QuarterKey) => {
  if (quarter === "q2") {
    return metric === "combat"
      ? dashboard.meta.combatAverage
      : (dashboard.averages[metric] ?? 0);
  }

  const values = dashboard.showrooms
    .map((item) => quarterValueOf(item, metric, quarter))
    .filter((value): value is number => value !== null);
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
};

const groupQuarterAverageOf = (
  showroom: Showroom,
  metric: MetricKey,
  quarter: QuarterKey,
  group: Exclude<GroupKey, "all">,
) => {
  const values = dashboard.showrooms
    .filter((item) => {
      if (group === "dealer") return item.dealer === showroom.dealer;
      if (group === "region") return item.region === showroom.region;
      return item.size === showroom.size;
    })
    .map((item) => quarterValueOf(item, metric, quarter))
    .filter((value): value is number => value !== null);

  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
};

const displayNumber = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);

const displayTrendNumber = (value: number | null | undefined) =>
  value !== null && value !== undefined && Number.isInteger(value)
    ? value.toFixed(0)
    : displayNumber(value);

const displayShowroomName = (name: string) => {
  const trimmed = name.trim();
  const showroomName = trimmed.startsWith("볼보 ")
    ? trimmed.slice(3).trim()
    : trimmed;
  const compactName = showroomName.replace(/\s+/g, "");
  const normalizedName = /^[가-힣]{4}$/.test(compactName)
    ? compactName
    : showroomName;
  return `볼보 ${normalizedName}`;
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
  if (delta >= -3) return { label: "주의 필요", tone: "caution", delta };
  return { label: "위험 감지", tone: "warning", delta };
}

function SignalIcon({ tone }: { tone: string }) {
  return (
    <span className={`signal-icon ${tone}`} aria-hidden="true">
      {tone === "good" ? "▲" : "▼"}
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
  q1Value,
  q2Value,
  quarter,
  active,
  onSelect,
  appeal,
}: {
  metric: TrendMetricKey;
  value: number;
  average: number;
  q1Value: number | null;
  q2Value: number | null;
  quarter: QuarterKey;
  active: boolean;
  onSelect: () => void;
  appeal: "possible" | "partial" | "locked";
}) {
  const signal = getSignal(value, average);
  const quarterLabel = quarter.toUpperCase();
  const fill = Math.min(100, Math.max(0, (value / metricMeta[metric].max) * 100));
  const signalRule =
    signal.tone === "warning"
      ? `위험 감지: ${quarterLabel} 전국 평균 대비 5점 이상 미달`
      : signal.tone === "caution"
        ? `주의 필요: ${quarterLabel} 전국 평균 미만, 5점 미만 차이`
        : `정상: ${quarterLabel} 전국 평균 이상`;
  const quarterScores = [
    {
      label: "Q1",
      value: q1Value,
      state: quarter === "q1" ? "current" : "complete",
    },
    {
      label: "Q2",
      value: q2Value,
      state: quarter === "q2" ? "current" : "complete",
    },
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
        <span>점 / {metricMeta[metric].max}점 만점</span>
      </div>
      <div
        className="metric-benchmark"
        title={`${quarterLabel} 전국 평균 ${displayNumber(average)}점`}
      >
        <span>{quarterLabel} 전국 평균 대비</span>
        <strong
          className={`${
            signal.delta > 0
              ? "positive"
              : signal.delta < 0
                ? "negative"
                : "neutral"
          } ${signal.tone}`}
        >
          {signal.delta > 0 ? "▲" : signal.delta < 0 ? "▼" : "―"}{" "}
          {Math.abs(signal.delta).toFixed(1)}점
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

function V3SPerformance({
  showroom,
  compact = false,
}: {
  showroom: Showroom;
  compact?: boolean;
}) {
  const peerBenchmarks = (quarter: QuarterKey | null) => [
    {
      key: "dealer",
      label: `소속사 ${showroom.dealer} 평균`,
      value:
        quarter === null
          ? null
          : groupQuarterAverageOf(showroom, "v3s", quarter, "dealer"),
    },
    {
      key: "region",
      label: `권역별 ${showroom.region} 평균`,
      value:
        quarter === null
          ? null
          : groupQuarterAverageOf(showroom, "v3s", quarter, "region"),
    },
    {
      key: "size",
      label: `사이즈 ${showroom.size} 평균`,
      value:
        quarter === null
          ? null
          : groupQuarterAverageOf(showroom, "v3s", quarter, "size"),
    },
  ];
  const quarterScores = [
    {
      label: "Q1",
      value: showroom.q1?.v3s ?? null,
      average: quarterAverageOf("v3s", "q1"),
      benchmarks: peerBenchmarks("q1"),
      statusText: null,
      state: "complete",
    },
    {
      label: "Q2",
      value: showroom.v3s,
      average: quarterAverageOf("v3s", "q2"),
      benchmarks: peerBenchmarks("q2"),
      statusText: null,
      state: "current",
    },
    {
      label: "Q3",
      value: null,
      average: null,
      benchmarks: peerBenchmarks(null),
      statusText: "평가 진행",
      state: "in-progress",
    },
    {
      label: "Q4",
      value: null,
      average: null,
      benchmarks: peerBenchmarks(null),
      statusText: "평가 예정",
      state: "upcoming",
    },
  ];
  const quarterScaleValues = quarterScores
    .flatMap((quarter) => [
      quarter.value,
      quarter.average,
      ...quarter.benchmarks.map((benchmark) => benchmark.value),
    ])
    .filter((value): value is number => value !== null);
  const v3sScaleMax = 100;
  const v3sScaleMin = quarterScaleValues.length
    ? Math.max(
        0,
        Math.min(
          80,
          Math.floor((Math.min(...quarterScaleValues) - 5) / 5) * 5,
        ),
      )
    : 0;
  const v3sScaleHeight = (value: number) =>
    Math.min(
      100,
      Math.max(
        0,
        ((value - v3sScaleMin) / (v3sScaleMax - v3sScaleMin)) * 100,
      ),
    );
  const enteredQuarters = quarterScores.filter(
    (quarter): quarter is (typeof quarterScores)[number] & { value: number } =>
      quarter.value !== null,
  );
  const cumulativeAverage = enteredQuarters.length
    ? enteredQuarters.reduce((sum, quarter) => sum + quarter.value, 0) /
      enteredQuarters.length
    : null;
  const history = [2021, 2022, 2023, 2024, 2025].map(
    (year) =>
      showroom.historicalV3s?.find((point) => point.year === year) ?? {
        year,
        value: null,
        average: null,
      },
  );
  const historyValues = history.filter(
    (point): point is HistoricalV3sPoint & { value: number } =>
      point.value !== null,
  );
  const hasHistory = historyValues.length > 0;
  const historyMin = hasHistory
    ? Math.max(0, Math.min(...historyValues.map((point) => point.value)) - 8)
    : 0;
  const historyMax = hasHistory
    ? Math.min(100, Math.max(...historyValues.map((point) => point.value)) + 8)
    : 100;
  const historyX = (year: number) => 28 + ((year - 2021) / 4) * 384;
  const historyY = (value: number) =>
    126 -
    ((value - historyMin) / Math.max(1, historyMax - historyMin)) * 94;
  const historyPath = historyValues
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${historyX(point.year)} ${historyY(
          point.value,
        )}`,
    )
    .join(" ");
  const firstHistory = historyValues.at(0) ?? null;
  const latestHistory = historyValues.at(-1) ?? null;
  const historyDelta =
    firstHistory && latestHistory
      ? latestHistory.value - firstHistory.value
      : null;

  return (
    <div
      className={`v3s-performance ${compact ? "compact" : ""}`}
      aria-label="V3S 분기 및 5개년 성과"
    >
      <section className="v3s-quarter-panel">
        <header className="v3s-subhead">
          <div>
            <h3>분기 평가</h3>
          </div>
          <div className="v3s-cumulative">
            <span>2026 누적 평균</span>
            <strong>
              {displayNumber(cumulativeAverage)}
              <small>점</small>
            </strong>
          </div>
        </header>

        <div className="v3s-quarter-bars">
          {quarterScores.map((quarter, index) => (
            <div
              className={`v3s-quarter-column ${quarter.state}`}
              key={quarter.label}
            >
              <div
                className="v3s-bar-stage"
                aria-label={`${quarter.label} ${
                  quarter.value === null
                    ? quarter.statusText
                    : `${displayNumber(quarter.value)}점`
                }`}
              >
                {quarter.value !== null && (
                  <span
                    className="v3s-average-marker"
                    style={{
                      bottom: `${v3sScaleHeight(
                        quarter.average ?? v3sScaleMin,
                      )}%`,
                    }}
                    title={`전국 평균 ${displayNumber(quarter.average)}점`}
                  >
                    <b>{displayNumber(quarter.average)}</b>
                    <i />
                  </span>
                )}
                <span className="v3s-bar-cluster">
                  <span className="v3s-peer-bar-group">
                    {quarter.benchmarks.map((benchmark, benchmarkIndex) => (
                      <span
                        className={`v3s-peer-bar ${benchmark.key} ${
                          benchmark.value === null ? "planned" : ""
                        }`}
                        key={benchmark.key}
                        title={`${benchmark.label} ${
                          benchmark.value === null
                            ? quarter.statusText
                            : `${displayNumber(benchmark.value)}점`
                        }`}
                        style={{
                          height:
                            benchmark.value === null
                              ? "48%"
                              : `${v3sScaleHeight(benchmark.value)}%`,
                          animationDelay: `${
                            300 + index * 100 + benchmarkIndex * 45
                          }ms`,
                        }}
                      >
                        {benchmark.value !== null && (
                          <b>{displayNumber(benchmark.value)}</b>
                        )}
                      </span>
                    ))}
                  </span>
                  {quarter.value === null ? (
                    <span className="v3s-upcoming-bar">
                      <b>{quarter.statusText}</b>
                    </span>
                  ) : (
                    <span
                      className="v3s-bar-fill"
                      style={{
                        height: `${v3sScaleHeight(quarter.value)}%`,
                        animationDelay: `${140 + index * 100}ms`,
                      }}
                    >
                      <b>{displayNumber(quarter.value)}</b>
                    </span>
                  )}
                </span>
              </div>
              <div className="v3s-quarter-label">
                <strong>{quarter.label}</strong>
              </div>
            </div>
          ))}
        </div>
        <div className="v3s-quarter-legend">
          {peerBenchmarks("q2").map((benchmark) => (
            <span className="v3s-peer-legend" key={benchmark.key}>
              <i className={`legend-peer ${benchmark.key}`} />
              {benchmark.label}
            </span>
          ))}
          <span>
            <i className="legend-bar" />{" "}
            {displayShowroomName(showroom.showroom)}
          </span>
          <span>
            <i className="legend-average" /> 분기 전국 평균
          </span>
          <small>100점 만점</small>
        </div>
      </section>

      <section className="v3s-history-panel">
        <header className="v3s-subhead">
          <div>
            <h3>5개년 추이</h3>
          </div>
          {historyDelta !== null && (
            <strong
              className={`v3s-history-delta ${
                historyDelta >= 0 ? "positive" : "negative"
              }`}
            >
              5년간 {historyDelta >= 0 ? "+" : ""}
              {displayNumber(historyDelta)}점
            </strong>
          )}
        </header>

        {hasHistory ? (
          <>
            <div className="v3s-history-chart">
              <svg
                viewBox="0 0 440 150"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${displayShowroomName(
                  showroom.showroom,
                )} 2021년부터 2025년까지 V3S 추세`}
              >
                <defs>
                  <linearGradient
                    id={`v3s-history-fill-${showroom.cdsid}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#2f6b8a" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#2f6b8a" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="28" x2="412" y1="126" y2="126" className="v3s-history-axis" />
                {history.map((point) => (
                  <line
                    key={point.year}
                    x1={historyX(point.year)}
                    x2={historyX(point.year)}
                    y1="122"
                    y2="126"
                    className="v3s-history-tick"
                  />
                ))}
                {historyValues.length > 1 && (
                  <path
                    d={`${historyPath} L ${historyX(
                      latestHistory?.year ?? 2025,
                    )} 126 L ${historyX(
                      firstHistory?.year ?? 2021,
                    )} 126 Z`}
                    fill={`url(#v3s-history-fill-${showroom.cdsid})`}
                    className="v3s-history-area"
                  />
                )}
                <path d={historyPath} className="v3s-history-line" pathLength="1" />
                {historyValues.map((point) => (
                  <g key={point.year}>
                    <circle
                      cx={historyX(point.year)}
                      cy={historyY(point.value)}
                      r="4"
                      className="v3s-history-point"
                    />
                    <text
                      x={historyX(point.year)}
                      y={historyY(point.value) - 10}
                      textAnchor="middle"
                      className="v3s-history-value"
                    >
                      {displayNumber(point.value)}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="v3s-history-years" aria-hidden="true">
                {history.map((point) => (
                  <span key={point.year}>{point.year}</span>
                ))}
              </div>
            </div>
            <div className="v3s-history-summary">
              <span>
                시작점
                <strong>{displayNumber(firstHistory?.value)}점</strong>
              </span>
              <span>
                최근점
                <strong>{displayNumber(latestHistory?.value)}점</strong>
              </span>
              <span>
                5년 증감
                <strong
                  className={
                    historyDelta !== null && historyDelta < 0
                      ? "negative"
                      : "positive"
                  }
                >
                  {historyDelta === null
                    ? "—"
                    : `${historyDelta >= 0 ? "+" : ""}${displayNumber(
                        historyDelta,
                      )}점`}
                </strong>
              </span>
            </div>
          </>
        ) : (
          <div className="v3s-history-empty">
            <div className="v3s-history-ghost" aria-hidden="true">
              {[48, 58, 54, 70, 76].map((height, index) => (
                <span key={history[index].year}>
                  <i style={{ height: `${height}%` }} />
                  <small>{history[index].year}</small>
                </span>
              ))}
            </div>
            <div className="v3s-history-empty-copy">
              <strong>5개년 데이터 연결 예정</strong>
              <span>
                전시장별 2021–2025 점수가 들어오면
                <br />
                성장 방향과 5년 증감을 자동 표시합니다.
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function WeeklyTrend({
  showroom,
  metric,
  compact = false,
}: {
  showroom: Showroom;
  metric: TrendMetricKey;
  compact?: boolean;
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
  const [measuredChartWidth, setMeasuredChartWidth] = useState(1360);
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
  const chartWidth = compact ? measuredChartWidth : 1360;
  const chartHeight = compact ? 125 : 210;
  const chartYScale = chartHeight / 200;
  const chartY = (coordinate: number) => coordinate * chartYScale;
  const plotLeft = (28 / 1360) * chartWidth;
  const plotRight = chartWidth - plotLeft;
  const plotWidth = plotRight - plotLeft;
  const x = (week: number) =>
    plotLeft + ((week - 0.5) / 52) * plotWidth;
  const weekBoundaryX = (completedWeeks: number) =>
    plotLeft + (completedWeeks / 52) * plotWidth;
  const evaluationProgressWeek = Math.max(26, Math.min(latestWeek, 39));
  const activeQuarterStart = weekBoundaryX(evaluationProgressWeek);
  const activeQuarterEnd = weekBoundaryX(39);
  const upcomingQuarterStart = weekBoundaryX(39);
  const upcomingQuarterEnd = weekBoundaryX(52);
  const markerSize = 6.3;
  const markerRadius = markerSize / 2;
  const y = (value: number) =>
    chartY(170) -
    ((value - min) / Math.max(1, max - min)) * chartY(126);
  const weeks = Array.from({ length: 52 }, (_, index) => index + 1);
  const quarterDividers = [13, 26, 39];
  const quarterLabels = [
    { label: "Q1", range: "W01–W13(13주)" },
    { label: "Q2", range: "W14–W26(13주)" },
    { label: "Q3", range: "W27–W39(13주)" },
    { label: "Q4", range: "W40–W52(13주)" },
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
      const staysInPlot =
        labelTop >= chartY(6) && labelBottom <= chartY(166);
      const clearsPairedMarker =
        pairedPointY === null ||
        labelBottom < pairedPointY - 5 ||
        labelTop > pairedPointY + 5;
      return staysInPlot && clearsPairedMarker;
    });

    return (
      available ??
      Math.max(chartY(14), Math.min(chartY(164), candidates[0]))
    );
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
  const hoverWeekRange =
    hoverWeek === null ? null : weeklyDashboard.meta.weekRanges[hoverWeek - 1];
  const hoverWeekLabel =
    hoverWeek === null
      ? ""
      : `W${String(hoverWeek).padStart(2, "0")}${
          hoverWeekRange
            ? ` (${hoverWeekRange.start} ~ ${hoverWeekRange.end})`
            : ""
        }`;

  useEffect(() => {
    if (trendScrollRef.current) {
      trendScrollRef.current.scrollLeft = 0;
    }
  }, [metric, showroom.cdsid]);

  useEffect(() => {
    const container = trendScrollRef.current;
    if (!compact || !container) return;

    const updateWidth = () => {
      const nextWidth = Math.max(1, Math.round(container.clientWidth));
      setMeasuredChartWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth,
      );
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [compact]);

  return (
    <div className={`trend-wrap ${compact ? "compact" : ""}`}>
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
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${metricMeta[metric].label} W01부터 W52까지 연간 데이터 입력 현황`}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const viewX =
                ((event.clientX - bounds.left) / Math.max(1, bounds.width)) *
                chartWidth;
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
              y1={chartY(170)}
              y2={chartY(170)}
              className="week-axis"
            />
            {weeks.map((week) => (
              <line
                key={week}
                x1={x(week)}
                x2={x(week)}
                y1={chartY(165)}
                y2={chartY(170)}
                className={`week-tick ${week <= latestWeek ? "entered" : "pending"}`}
              />
            ))}
            {quarterDividers.map((completedWeeks) => (
              <line
                key={completedWeeks}
                x1={weekBoundaryX(completedWeeks)}
                x2={weekBoundaryX(completedWeeks)}
                y1={chartY(18)}
                y2={chartY(170)}
                data-week-boundary={completedWeeks}
                className="week-grid"
              />
            ))}
            {evaluationProgressWeek < 39 && (
              <g className="future-window-group" aria-hidden="true">
                <rect
                  x={activeQuarterStart}
                  y={chartY(18)}
                  width={activeQuarterEnd - activeQuarterStart}
                  height={chartY(152)}
                  className="future-window"
                />
                <text
                  x={(activeQuarterStart + activeQuarterEnd) / 2}
                  y={chartY(88)}
                  textAnchor="middle"
                  className="future-window-label"
                >
                  Q3 평가 진행 중
                </text>
                <text
                  x={(activeQuarterStart + activeQuarterEnd) / 2}
                  y={chartY(104)}
                  textAnchor="middle"
                  className="future-window-help"
                >
                  데이터 집계 후 자동 반영됩니다.
                </text>
              </g>
            )}
            {latestWeek < 39 && (
              <g className="future-window-group" aria-hidden="true">
                <rect
                  x={upcomingQuarterStart}
                  y={chartY(18)}
                  width={upcomingQuarterEnd - upcomingQuarterStart}
                  height={chartY(152)}
                  className="future-window future-window-upcoming"
                />
                <text
                  x={(upcomingQuarterStart + upcomingQuarterEnd) / 2}
                  y={chartY(88)}
                  textAnchor="middle"
                  className="future-window-label"
                >
                  Q4 평가 예정 중
                </text>
                <text
                  x={(upcomingQuarterStart + upcomingQuarterEnd) / 2}
                  y={chartY(104)}
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
                      r={markerRadius}
                      className="national-average-point"
                    >
                      <title>
                        {`W${String(point.week).padStart(2, "0")} 전국 평균 ${displayTrendNumber(
                          point.value,
                        )}점`}
                      </title>
                    </circle>
                    <text
                      x={x(point.week)}
                      y={nationalValueLabelY(point)}
                      textAnchor="middle"
                      className="national-point-value"
                      aria-hidden="true"
                    >
                      {displayTrendNumber(point.value)}
                    </text>
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
            {showActual && (
              <g className="actual-series-wipe">
                {storeSegments.map(
                  (segment, index) =>
                    segment.length > 1 && (
                      <g key={`store-${showroom.cdsid}-${metric}-${index}`}>
                        <polyline
                          points={segment
                            .map((point) => `${x(point.week)},${y(point.value)}`)
                            .join(" ")}
                          className="trend-line"
                        />
                      </g>
                    ),
                )}
                {rawPoints.map((point) => (
                  <g
                    key={`${showroom.cdsid}-${metric}-${point.week}-${point.label}`}
                  >
                    {isWeeklyMetric ? (
                      <rect
                        x={x(point.week) - markerRadius}
                        y={y(point.value) - markerRadius}
                        width={markerSize}
                        height={markerSize}
                        data-week={point.label}
                        className="actual-week-point"
                      >
                        <title>
                          {`${point.label} ${displayShowroomName(
                            showroom.showroom,
                          )} 실제값 ${displayTrendNumber(point.value)}점 · 전국 평균 ${displayTrendNumber(
                            averageAt(point.week),
                          )}점`}
                        </title>
                      </rect>
                    ) : (
                      <circle
                        cx={x(point.week)}
                        cy={y(point.value)}
                        r={markerRadius}
                        className="actual-quarter-point"
                      >
                        <title>
                          {`${point.label} ${displayTrendNumber(point.value)}점 · 전국 평균 ${displayTrendNumber(
                            averageAt(point.week),
                          )}점`}
                        </title>
                      </circle>
                    )}
                    <text
                      x={x(point.week)}
                      y={actualValueLabelY(point)}
                      textAnchor="middle"
                      className="actual-point-value"
                      aria-hidden="true"
                    >
                      {displayTrendNumber(point.value)}
                    </text>
                  </g>
                ))}
              </g>
            )}
            {hoverWeek !== null && (
              <line
                x1={x(hoverWeek)}
                x2={x(hoverWeek)}
                y1={chartY(18)}
                y2={chartY(170)}
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
              <strong>{hoverWeekLabel}</strong>
              {hoverWeek > latestWeek ? (
                <span className="tooltip-upcoming">집계 예정</span>
              ) : (
                <>
                  <span>
                    <i className="tooltip-key actual" />
                    {displayShowroomName(showroom.showroom)}
                    <b>
                      {hoverActual === null
                        ? "—"
                        : `${displayTrendNumber(hoverActual)}점`}
                    </b>
                  </span>
                  <span>
                    <i className="tooltip-key national" />
                    전국 평균
                    <b>
                      {hoverNational === null
                        ? "—"
                        : `${displayTrendNumber(hoverNational)}점`}
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
              return (
                <span
                  key={week}
                  className={status}
                  aria-label={label}
                  title={
                    value === null
                      ? `${label} ${isMissing ? "데이터 없음" : "입력 예정"}`
                      : `${label} ${displayTrendNumber(value)}점 · 전국 평균 ${displayTrendNumber(
                          averageAt(week),
                        )}점`
                  }
                >
                  {label}
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
          <i className="coverage-line actual" />
          {displayShowroomName(showroom.showroom)}
        </button>
        <button
          type="button"
          className={showNational ? "active" : ""}
          aria-pressed={showNational}
          onClick={() => setShowNational((visible) => !visible)}
        >
          <i className="coverage-line national" />
          주간 전국 평균
        </button>
      </div>
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
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterKey>("q2");
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [accessDate, setAccessDate] = useState(() =>
    formatSeoulDate(new Date()),
  );
  const [latestUpdate, setLatestUpdate] = useState<LatestUpdate>({
    title: "현재 Q3평가 진행중",
    effectiveDate: dashboard.meta.updatedAt,
  });

  useEffect(() => {
    const syncAccessDate = () => setAccessDate(formatSeoulDate(new Date()));
    syncAccessDate();
    const timer = window.setInterval(syncAccessDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
  const showroomCodeWidth = Math.max(
    ...dashboard.showrooms.map((item) => item.cdsid.length),
  );
  const displayUpdateTitle =
    latestUpdate.effectiveDate.replaceAll(".", "-") === "2026-07-29"
      ? "현재 Q3평가 진행중"
      : latestUpdate.title;
  const combat = selected.combat ?? 0;
  const q1Combat = selected.q1?.combat ?? combat;
  const cumulativeAverage = (q1Combat + combat) / 2;
  const cumulativeScoreDigits = displayNumber(cumulativeAverage)
    .split("")
    .reduce<string[]>((digits, character) => {
      if (character === "." && digits.length) {
        digits[digits.length - 1] += character;
      } else {
        digits.push(character);
      }
      return digits;
    }, []);
  const selectedQuarterLabel = selectedQuarter.toUpperCase();
  const selectedQuarterCombat =
    quarterValueOf(selected, "combat", selectedQuarter) ?? combat;
  const selectedCombatAverage = quarterAverageOf("combat", selectedQuarter);
  const tier = getTier(cumulativeAverage);
  const nationalRank =
    [...dashboard.showrooms]
      .sort(
        (a, b) =>
          (quarterValueOf(b, "combat", selectedQuarter) ??
            Number.NEGATIVE_INFINITY) -
          (quarterValueOf(a, "combat", selectedQuarter) ??
            Number.NEGATIVE_INFINITY),
      )
      .findIndex((item) => item.cdsid === selected.cdsid) + 1;
  const kpis = [
    {
      key: "v3s" as const,
      value: quarterValueOf(selected, "v3s", selectedQuarter) ?? 0,
      average: quarterAverageOf("v3s", selectedQuarter),
      q1Value: selected.q1?.v3s ?? null,
      q2Value: selected.v3s ?? null,
      appeal: "possible" as const,
    },
    {
      key: "voc" as const,
      value: quarterValueOf(selected, "voc", selectedQuarter) ?? 0,
      average: quarterAverageOf("voc", selectedQuarter),
      q1Value: selected.q1?.voc ?? null,
      q2Value: selected.voc ?? null,
      appeal: "partial" as const,
    },
    {
      key: "cx" as const,
      value: quarterValueOf(selected, "cx", selectedQuarter) ?? 0,
      average: quarterAverageOf("cx", selectedQuarter),
      q1Value: selected.q1?.cx ?? null,
      q2Value: selected.cx ?? null,
      appeal: "partial" as const,
    },
  ];
  const warningCount = kpis.filter((item) => item.value < item.average).length;
  const combatDelta = selectedQuarterCombat - selectedCombatAverage;

  return (
    <main className="dashboard">
      <section className="identity-strip">
        <div className="identity-title">
          <h1>{displayShowroomName(selected.showroom)} 현황</h1>
          <div className="update-status">
            <i aria-hidden="true" />
            <time dateTime={accessDate.replaceAll(".", "-")}>
              최근 업데이트 {accessDate}
            </time>
            <span>{displayUpdateTitle}</span>
          </div>
        </div>
        <div className="identity-detail-rail">
          <dl>
            <div className="identity-analysis-entry">
              <Link
                className="identity-analysis-hit"
                href={`/dashboard/${selected.cdsid}/analysis?view=dealer`}
                aria-label={`${selected.dealer} 딜러사별 경쟁력 분석`}
              />
              <span
                className="identity-icon identity-icon--dealer"
                aria-hidden="true"
              />
              <dt>딜러사</dt>
              <dd>{selected.dealer}</dd>
            </div>
            <div className="identity-analysis-entry">
              <Link
                className="identity-analysis-hit"
                href={`/dashboard/${selected.cdsid}/analysis?view=region`}
                aria-label={`${selected.region} 권역별 경쟁력 분석`}
              />
              <span
                className="identity-icon identity-icon--region"
                aria-hidden="true"
              />
              <dt>권역별</dt>
              <dd>{selected.region}</dd>
            </div>
            <div className="identity-analysis-entry">
              <Link
                className="identity-analysis-hit"
                href={`/dashboard/${selected.cdsid}/analysis?view=size`}
                aria-label={`${selected.size} 사이즈별 경쟁력 분석`}
              />
              <span
                className="identity-icon identity-icon--size"
                aria-hidden="true"
              />
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
                        {item.cdsid.padEnd(showroomCodeWidth, "\u2007")} ·{" "}
                        {displayShowroomName(item.showroom)} ·{" "}
                        {item.manager}
                      </option>
                    ))}
                  </select>
                </label>
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
            <span>누적 평균</span>
            <strong>{displayNumber(cumulativeAverage)}</strong>
            <small>
              / {dashboard.meta.combatMax} · Q1·Q2 평가 기준
            </small>
          </div>
          <div>
            <strong>
              전국 {nationalRank}위
              <small> / {dashboard.meta.showroomCount}개점</small>
            </strong>
            <span className={combatDelta >= 0 ? "positive" : "negative"}>
              {selectedQuarterLabel} 전국 평균 대비{" "}
              {combatDelta >= 0 ? "+" : ""}
              {combatDelta.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="mobile-quarter-selector" aria-label="평가 분기 선택">
          {(["q1", "q2", "q3", "q4"] as const).map((quarter) => {
            const available = quarter === "q1" || quarter === "q2";
            return (
              <button
                key={quarter}
                type="button"
                disabled={!available}
                className={selectedQuarter === quarter ? "active" : ""}
                aria-pressed={available ? selectedQuarter === quarter : undefined}
                onClick={() => {
                  if (available) setSelectedQuarter(quarter);
                }}
              >
                {quarter.toUpperCase()}
                {!available && <small>예정</small>}
              </button>
            );
          })}
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
                  {selectedQuarterLabel} 평균 대비{" "}
                  {signal.delta >= 0 ? "+" : ""}
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

      <section
        className="hero-grid"
        key={`showroom-score-${selected.cdsid}`}
      >
        <article className={`combat-card ${tier.className}`}>
          <div className="combat-main">
            <div
              className="quarter-score-chart"
              aria-label={`Q1 ${displayNumber(q1Combat)}점, Q2 ${displayNumber(
                combat,
              )}점, Q3 평가 진행, Q4 평가 예정, 누적 평균 ${displayNumber(
                cumulativeAverage,
              )}점, ${dashboard.meta.combatMax}점 만점`}
            >
              <div className="quarter-score-meta">
                <span>분기 선택</span>
                <small>{dashboard.meta.combatMax}점 만점</small>
              </div>
              {[
                { key: "q1" as const, label: "Q1", value: q1Combat },
                { key: "q2" as const, label: "Q2", value: combat },
                { key: null, label: "Q3", value: null },
                { key: null, label: "Q4", value: null },
              ].map((quarter) => (
                <button
                  type="button"
                  disabled={quarter.key === null}
                  aria-pressed={
                    quarter.key === null
                      ? undefined
                      : selectedQuarter === quarter.key
                  }
                  aria-label={
                    quarter.key === null
                      ? `${quarter.label} ${
                          quarter.label === "Q4" ? "평가 예정" : "평가 진행"
                        }`
                      : `${quarter.label} 지표 보기`
                  }
                  onClick={() => {
                    if (quarter.key) setSelectedQuarter(quarter.key);
                  }}
                  className={`quarter-score-row ${
                    quarter.key === selectedQuarter ? "current" : ""
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
                </button>
              ))}
            </div>
            <div className="combat-summary-stack">
              <span>누적 평균</span>
              <strong>
                <span
                  className="combat-score-number"
                  aria-label={displayNumber(cumulativeAverage)}
                >
                  {cumulativeScoreDigits.map((digit, index) => (
                    <span
                      className="combat-score-digit"
                      aria-hidden="true"
                      style={{ animationDelay: `${180 + index * 130}ms` }}
                      key={`${digit}-${index}`}
                    >
                      {digit}
                    </span>
                  ))}
                </span>
                <small>점</small>
              </strong>
              <em>Q1·Q2 평가 기준</em>
            </div>
          </div>
          <div className="combat-footer">
            <span>
              {selectedQuarterLabel} 전국 평균{" "}
              <strong>{displayNumber(selectedCombatAverage)}</strong>
            </span>
            <span className={combatDelta >= 0 ? "positive" : "negative"}>
              {selectedQuarterLabel} 전국 평균 대비{" "}
              <strong>
                {combatDelta >= 0 ? "+" : ""}
                {combatDelta.toFixed(1)}
              </strong>
            </span>
            <span>
              전시장 경쟁력 전국 순위{" "}
              <strong>
                {nationalRank}위 / 전체 {dashboard.meta.showroomCount}
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
                q1Value={item.q1Value}
                q2Value={item.q2Value}
                quarter={selectedQuarter}
                active={trendMetric === item.key}
                onSelect={() => setTrendMetric(item.key)}
                appeal={item.appeal}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className="content-grid"
        id="weekly-trend"
        key={`showroom-trend-${selected.cdsid}`}
      >
        <article className="panel trend-panel score-stack-panel">
          <div className="section-heading">
            <div>
              <h2>{displayShowroomName(selected.showroom)} 스코어</h2>
            </div>
          </div>
          <div className="score-stack" aria-label="V3S, VOC, CX Index 스코어">
            <section
              id="score-v3s"
              className={`score-tier score-tier-v3s ${
                trendMetric === "v3s" ? "active" : ""
              }`}
            >
              <header className="score-tier-heading">
                <strong>V3S</strong>
                <span>{metricDescriptions.v3s}</span>
              </header>
              <V3SPerformance showroom={selected} compact />
            </section>
            <section
              id="score-voc"
              className={`score-tier score-tier-weekly ${
                trendMetric === "voc" ? "active" : ""
              }`}
            >
              <header className="score-tier-heading">
                <strong>VOC</strong>
                <span>{metricDescriptions.voc}</span>
              </header>
              <WeeklyTrend
                key={`${selected.cdsid}-voc`}
                showroom={selected}
                metric="voc"
                compact
              />
            </section>
            <section
              id="score-cx"
              className={`score-tier score-tier-weekly ${
                trendMetric === "cx" ? "active" : ""
              }`}
            >
              <header className="score-tier-heading">
                <strong>CX Index</strong>
                <span>{metricDescriptions.cx}</span>
              </header>
              <WeeklyTrend
                key={`${selected.cdsid}-cx`}
                showroom={selected}
                metric="cx"
                compact
              />
            </section>
          </div>
        </article>
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
