"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import dashboardJson from "./data/showrooms.json";
import v3sHistoryJson from "./data/v3s-history.json";
import vocConsultationJson from "./data/voc-consultation.json";
import vocSentJson from "./data/voc-sent.json";
import weeklyJson from "./data/weekly.json";
import v3sQuarterSummaryStyles from "./V3SQuarterSummary.module.css";
import DashboardHeaderLead from "./DashboardHeaderLead";
import ReleaseUpdateNotice from "./ReleaseUpdateNotice";
import {
  getV3sEvidence,
  V3SEvidenceGallery,
  type EvidenceQuarter,
} from "./V3SEvidenceGallery";

type MetricKey = "combat" | "v3s" | "voc" | "cx";
type TrendMetricKey = Exclude<MetricKey, "combat">;
type GroupKey = "all" | "dealer" | "region" | "size";
type QuarterKey = "q1" | "q2" | "q3" | "q4";

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

type ShowroomAccess = {
  role: "master" | "dealerHead" | "manager";
  allowedCdsids: string[];
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

type VocConsultationSeries = [
  number | null,
  number,
  number | null,
  number,
  number | null,
  number,
  number | null,
  number,
  number | null,
  number,
];

type VocConsultationData = {
  updatedThrough: string;
  years: number[];
  national: VocConsultationSeries;
  showrooms: Record<string, VocConsultationSeries>;
};

type VocSentData = {
  updatedThrough: string;
  years: number[];
  national: number[];
  showrooms: Record<string, number[]>;
};

const dashboard = dashboardJson as DashboardData;
const v3sHistoryByCdsid = v3sHistoryJson as Record<
  string,
  HistoricalV3sPoint[]
>;
const weeklyDashboard = weeklyJson as WeeklyData;
const vocConsultation = vocConsultationJson as unknown as VocConsultationData;
const vocSent = vocSentJson as VocSentData;
const nationalV3sQuarterAverages = [
  {
    year: 2021,
    values: [
      94.35714285714288, 93.30357142857144, 96.88965517241378,
      94.31724137931033,
    ],
  },
  {
    year: 2022,
    values: [
      88.4033333333333, 95.21000000000001, 96.32903225806453,
      95.78709677419354,
    ],
  },
  {
    year: 2023,
    values: [
      93.52812499999996, 97.36250000000001, 95.27812499999999,
      97.39999999999999,
    ],
  },
  {
    year: 2024,
    values: [
      94.96176470588237, 95.72499999999998, 95.94871794871794,
      95.66923076923078,
    ],
  },
  {
    year: 2025,
    values: [
      93.81025641025641, 95.17435897435898, 95.78974358974361,
      95.41282051282052,
    ],
  },
] as const;
const nationalV3sAnnualAverages = nationalV3sQuarterAverages.map(
  ({ year, values }) => ({
    year,
    value: values.reduce((sum, value) => sum + value, 0) / values.length,
  }),
);
const nationalV3sFiveYearValues = nationalV3sQuarterAverages.flatMap(
  ({ values }) => values,
);
const nationalV3sFiveYearAverage =
  nationalV3sFiveYearValues.reduce((sum, value) => sum + value, 0) /
  nationalV3sFiveYearValues.length;
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

const formatOneVoiceReferenceDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const [year, month, day] = formatSeoulDate(date).split(".");
  return `${year.slice(-2)}${month}${day}`;
};

type OneVoiceScores = {
  carHandoverScore: number;
  testDriveScore: number;
  capturedAt: string | null;
};

const metricMeta: Record<
  MetricKey,
  { label: string; short: string; max: number; unit: string }
> = {
  combat: { label: "종합 경쟁력", short: "TOTAL", max: 330, unit: "점" },
  v3s: { label: "V3S", short: "V3S", max: 100, unit: "점" },
  voc: { label: "VOC", short: "VOC", max: 100, unit: "점" },
  cx: { label: "CX Index", short: "CX Index", max: 320, unit: "점" },
};

const metricDescriptions: Record<TrendMetricKey, string> = {
  v3s: "Volvo Sales Skill Simulation 평가(VCK)",
  voc: "Voice of Customer · 고객 의견 평가(VCK)",
  cx: "Customer Experience Index · 고객경험 종합지수(글로벌)",
};

const vocComponents = [
  { label: "VOC종합만족도", weight: "60점" },
  { label: "VOC첫인상", weight: "20점" },
  { label: "VOC태블릿", weight: "10점" },
  { label: "VOC해피콜", weight: "10점" },
];

const cxComponents = [
  { label: "신차출고 만족도", score: "100점" },
  { label: "시승 만족도", score: "100점" },
  { label: "긴급경보 처리여부", score: "10점" },
  { label: "조치 계획", score: "10점" },
  { label: "헤이볼보 앱 가입율", score: "100점" },
];

type CxComponentRecord = Pick<
  QuarterRecord,
  "delivery" | "testDrive" | "emergency" | "actionPlan" | "app"
>;

const cxRawTotalOf = (
  record: CxComponentRecord | null | undefined,
): number | null => {
  if (!record) return null;

  const components = [
    record.delivery,
    record.testDrive,
    record.emergency,
    record.actionPlan,
    record.app,
  ];

  return components.every((value): value is number => typeof value === "number")
    ? components.reduce((sum, value) => sum + value, 0)
    : null;
};

const latestCxWeeklyValueOf = (
  cdsid: string,
  quarter: QuarterKey,
): number | null => {
  const quarterIndex = ["q1", "q2", "q3", "q4"].indexOf(quarter);
  const start = quarterIndex * 13;
  const end = start + 13;
  const series = weeklyDashboard.cx.byCdsid[cdsid]?.slice(start, end) ?? [];

  return [...series]
    .reverse()
    .find((value): value is number => typeof value === "number") ?? null;
};

const latestCxWeeklyAverageOf = (quarter: QuarterKey): number | null => {
  const quarterIndex = ["q1", "q2", "q3", "q4"].indexOf(quarter);
  const start = quarterIndex * 13;
  const end = start + 13;
  const series = weeklyDashboard.cx.average.slice(start, end);

  return [...series]
    .reverse()
    .find((value): value is number => typeof value === "number") ?? null;
};

const quarterValueOf = (
  item: Showroom,
  metric: MetricKey,
  quarter: QuarterKey,
) => {
  if (metric === "cx") {
    if (quarter === "q1") return cxRawTotalOf(item.q1);
    if (quarter === "q2") return cxRawTotalOf(item);
    return latestCxWeeklyValueOf(item.cdsid, quarter);
  }

  const value = quarter === "q1" ? item.q1?.[metric] : item[metric];
  return typeof value === "number" ? value : null;
};

const quarterAverageOf = (metric: MetricKey, quarter: QuarterKey) => {
  if (quarter === "q2") {
    if (metric === "cx") return cxRawTotalOf(dashboard.averages) ?? 0;

    return metric === "combat"
      ? dashboard.meta.combatAverage
      : (dashboard.averages[metric] ?? 0);
  }

  if (metric === "cx" && (quarter === "q3" || quarter === "q4")) {
    return latestCxWeeklyAverageOf(quarter) ?? 0;
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

const displayTrendNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
};

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
  if (delta >= 10) return { label: "대단해요", tone: "great", delta };
  if (delta >= 0) return { label: "잘했어요", tone: "good", delta };
  if (delta >= -3) return { label: "힘내세요", tone: "caution", delta };
  return { label: "위험해요", tone: "warning", delta };
}

function AppealBadge({
  type,
  labelOverride,
}: {
  type: "possible" | "partial" | "locked";
  labelOverride?: string;
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
  const emphasizedPrefix =
    labelOverride?.startsWith("VOC해피콜")
      ? "VOC해피콜"
      : labelOverride?.startsWith("신차해피콜")
        ? "신차해피콜"
        : null;
  const displayLabel = labelOverride ?? content.label;

  return (
    <span
      className={`appeal-badge ${type}`}
      title={`${labelOverride ?? content.label}: ${content.description}`}
    >
      <span aria-hidden="true">{content.icon}</span>
      <span className="appeal-badge-label">
        {emphasizedPrefix ? (
          <>
            <span className="appeal-badge-key">{emphasizedPrefix}</span>
            {displayLabel.slice(emphasizedPrefix.length)}
          </>
        ) : (
          displayLabel
        )}
      </span>
    </span>
  );
}

function MetricCard({
  metric,
  value,
  average,
  quarter,
  active,
  onSelect,
  onQuarterSelect,
  evidenceQuarters = [],
  onEvidenceOpen,
  appeal,
  appealLabel,
}: {
  metric: TrendMetricKey;
  value: number;
  average: number;
  quarter: QuarterKey;
  active: boolean;
  onSelect: () => void;
  onQuarterSelect: (quarter: QuarterKey) => void;
  evidenceQuarters?: QuarterKey[];
  onEvidenceOpen?: (quarter: QuarterKey) => void;
  appeal: "possible" | "partial" | "locked";
  appealLabel?: string;
}) {
  const signal = getSignal(value, average);
  const quarterLabel = quarter.toUpperCase();
  const fill = Math.min(100, Math.max(0, (value / metricMeta[metric].max) * 100));
  const signalRule =
    signal.tone === "warning"
      ? `위험해요: ${quarterLabel} 전국 평균 대비 5점 이상 미달`
      : signal.tone === "caution"
        ? `힘내세요: ${quarterLabel} 전국 평균 미만, 5점 미만 차이`
        : signal.tone === "great"
          ? `대단해요: ${quarterLabel} 전국 평균 대비 10점 이상 우수`
          : `잘했어요: ${quarterLabel} 전국 평균 이상`;
  const quarterScores = [
    {
      key: "q1" as const,
      label: "Q1",
      state: quarter === "q1" ? "current" : "complete",
      available: true,
    },
    {
      key: "q2" as const,
      label: "Q2",
      state: quarter === "q2" ? "current" : "complete",
      available: true,
    },
    {
      key: metric === "v3s" ? null : ("q3" as const),
      label: "Q3",
      state:
        metric === "v3s"
          ? "planned"
          : quarter === "q3"
            ? "current"
            : "complete",
      available: metric !== "v3s",
    },
    {
      key: metric === "cx" ? ("q4" as const) : null,
      label: "Q4",
      state:
        metric === "cx"
          ? quarter === "q4"
            ? "current"
            : "complete"
          : "planned",
      available: metric === "cx",
    },
  ];
  const resourceQuarters: QuarterKey[] = ["q1", "q2", "q3", "q4"];

  return (
    <article
      className={`metric-card ${signal.tone} ${active ? "active" : ""}`}
      onClick={onSelect}
    >
      <div className="metric-card-topline">
        <span className="metric-code" title={metricDescriptions[metric]}>
          {metricMeta[metric].short}
        </span>
        <span className={`signal-pill ${signal.tone}`} title={signalRule}>
          {signal.label}
        </span>
      </div>
      <div className="metric-card-value">
        {displayNumber(value)}
        <span>/ {metricMeta[metric].max}점 만점</span>
      </div>
      <div
        className="metric-benchmark"
        title={`${quarterLabel} 전국 평균 ${displayNumber(average)}점`}
      >
        <span>
          <span className="metric-benchmark-quarter">{quarterLabel}</span>{" "}
          전국 평균 대비
        </span>
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
        {quarterScores.map((quarterItem) => (
          <button
            type="button"
            className={quarterItem.state}
            key={quarterItem.label}
            disabled={!quarterItem.available}
            aria-pressed={
              quarterItem.available
                ? quarterItem.key === quarter
                : undefined
            }
            aria-label={`${metricMeta[metric].short} ${quarterItem.label} ${
              quarterItem.available ? "상세 영역으로 이동" : "평가 미완료"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              if (quarterItem.key) onQuarterSelect(quarterItem.key);
            }}
          >
            <small>{quarterItem.label}</small>
          </button>
        ))}
      </div>
      {metric === "v3s" ? (
        <div className="metric-resource-grid" aria-label="V3S 분기별 자료">
          {resourceQuarters.map((resourceQuarter) => {
            const resourceLabel = resourceQuarter.toUpperCase();
            const hasEvidence = evidenceQuarters.includes(resourceQuarter);

            return (
              <div className="metric-resource-group" key={resourceQuarter}>
                <button
                  type="button"
                  className="metric-resource-button"
                  aria-label={`V3S ${resourceLabel} PDF 보고서 준비 중`}
                  title={`${resourceLabel} PDF 보고서 준비 중`}
                  disabled
                  onClick={(event) => event.stopPropagation()}
                >
                  <span className="metric-resource-pdf" aria-hidden="true">
                    PDF
                  </span>
                </button>
                <button
                  type="button"
                  className={`metric-resource-button ${hasEvidence ? "available" : ""}`}
                  aria-label={`V3S ${resourceLabel} 증빙사진 ${
                    hasEvidence ? "보기" : "준비 중"
                  }`}
                  title={`${resourceLabel} 증빙사진 ${hasEvidence ? "보기" : "준비 중"}`}
                  disabled={!hasEvidence}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (hasEvidence) onEvidenceOpen?.(resourceQuarter);
                  }}
                >
                  <span className="metric-resource-photo" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="metric-card-footer">
          <AppealBadge type={appeal} labelOverride={appealLabel} />
        </div>
      )}
    </article>
  );
}

function V3SPerformance({
  showroom,
  compact = false,
  highlightQuarter = null,
}: {
  showroom: Showroom;
  compact?: boolean;
  highlightQuarter?: QuarterKey | null;
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
  const showroomHistory =
    showroom.historicalV3s ?? v3sHistoryByCdsid[showroom.cdsid] ?? [];
  const history = [2021, 2022, 2023, 2024, 2025].map(
    (year) =>
      showroomHistory.find((point) => point.year === year) ?? {
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
  const historyScaleValues = [
    ...historyValues.map((point) => point.value),
    ...nationalV3sAnnualAverages.map((point) => point.value),
  ];
  const historyValueMin = hasHistory
    ? Math.min(...historyScaleValues)
    : 0;
  const historyValueMax = hasHistory
    ? Math.max(...historyScaleValues)
    : 100;
  const historyPadding = Math.max(
    2,
    (historyValueMax - historyValueMin) * 0.6,
  );
  const historyMin = hasHistory
    ? Math.max(0, historyValueMin - historyPadding)
    : 0;
  const historyMax = hasHistory
    ? Math.min(100, historyValueMax + historyPadding)
    : 100;
  const historyScaleHeight = (value: number) =>
    Math.min(
      100,
      Math.max(
        0,
        ((value - historyMin) / Math.max(1, historyMax - historyMin)) * 100,
      ),
    );
  return (
    <div
      className={`v3s-performance ${compact ? "compact" : ""}`}
      aria-label="V3S 분기 및 5개년 성과"
    >
      <section className="v3s-quarter-panel">
        <header
          className={`v3s-subhead ${
            compact ? v3sQuarterSummaryStyles.compactSubhead : ""
          }`}
        >
          <div aria-hidden="true" />
          <div
            className={`v3s-cumulative ${v3sQuarterSummaryStyles.inlineCumulative} ${
              compact ? v3sQuarterSummaryStyles.compactCumulative : ""
            }`}
            aria-label={`2026 누적 평균 ${displayNumber(cumulativeAverage)}점`}
          >
            <span>2026 누적 평균</span>
            <strong className={v3sQuarterSummaryStyles.value}>
              {displayNumber(cumulativeAverage)}
            </strong>
            <small className={v3sQuarterSummaryStyles.unit}>점</small>
          </div>
        </header>

        <div
          className={`v3s-quarter-bars ${
            compact ? v3sQuarterSummaryStyles.compactBars : ""
          }`}
        >
          {quarterScores.map((quarter, index) => (
            <div
              className={`v3s-quarter-column ${quarter.state} ${
                quarter.label.toLowerCase() === highlightQuarter
                  ? "is-quarter-highlighted"
                  : ""
              }`}
              key={quarter.label}
            >
              <div
                className={`v3s-bar-stage ${
                  compact ? v3sQuarterSummaryStyles.compactStage : ""
                }`}
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
        </div>
      </section>

      <section className="v3s-history-panel">
        <header className="v3s-subhead">
          <div>
            <h3>
              <span className="english-title">5</span>개년 추이
            </h3>
          </div>
        </header>

        {hasHistory ? (
          <div
            className="v3s-history-chart"
            role="img"
            aria-label={`${displayShowroomName(
              showroom.showroom,
            )} 2021년부터 2025년까지 V3S 막대 추이, 전국 평균 비교와 볼보 5개년 평균`}
          >
            <div className="v3s-history-bar-stage" aria-hidden="true">
              <span
                className="v3s-history-average-marker"
                style={{
                  bottom: `${historyScaleHeight(nationalV3sFiveYearAverage)}%`,
                }}
              >
                <b>
                  볼보 5개년 평균 {displayNumber(nationalV3sFiveYearAverage)}
                </b>
                <i />
              </span>
              <div className="v3s-history-bars">
                {history.map((point, index) => {
                  const nationalAverage = nationalV3sAnnualAverages.find(
                    (item) => item.year === point.year,
                  );
                  return (
                    <span className="v3s-history-bar-slot" key={point.year}>
                      {nationalAverage && (
                        <i
                          className="v3s-history-national-bar-fill"
                          title={`${point.year}년 전국 평균 ${displayNumber(
                            nationalAverage.value,
                          )}점`}
                          style={{
                            height: `${historyScaleHeight(
                              nationalAverage.value,
                            )}%`,
                            animationDelay: `${80 + index * 90}ms`,
                          }}
                        >
                          <b>{displayNumber(nationalAverage.value)}</b>
                        </i>
                      )}
                      {point.value !== null && (
                        <i
                          className="v3s-history-bar-fill"
                          title={`${point.year}년 ${displayShowroomName(
                            showroom.showroom,
                          )} ${displayNumber(point.value)}점`}
                          style={{
                            height: `${historyScaleHeight(point.value)}%`,
                            animationDelay: `${120 + index * 90}ms`,
                          }}
                        >
                          <b>{displayNumber(point.value)}</b>
                        </i>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="v3s-history-years" aria-hidden="true">
              {history.map((point) => (
                <span
                  className={point.value === null ? "missing" : ""}
                  key={point.year}
                >
                  {point.year}
                </span>
              ))}
            </div>
            <div className="v3s-history-legend" aria-hidden="true">
              <span>
                <i className="v3s-history-legend-national" /> 전국 평균
              </span>
              <span>
                <i className="v3s-history-legend-showroom" />
                {displayShowroomName(showroom.showroom)}
              </span>
            </div>
          </div>
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
              <strong>등록된 점수 없음</strong>
              <span>
                원본 데이터가 비어 있는 기간은
                <br />
                값 없이 표시합니다.
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ConsultationSatisfactionHistory({ showroom }: { showroom: Showroom }) {
  const national = vocConsultation.national;
  const selected = vocConsultation.showrooms[showroom.cdsid] ?? national;
  const nationalSent = vocSent.national;
  const selectedSent = vocSent.showrooms[showroom.cdsid] ?? nationalSent;
  const cumulativeAverage = selected[0];
  const nationalCumulativeAverage = national[0];
  const cumulativeDelta =
    cumulativeAverage === null || nationalCumulativeAverage === null
      ? null
      : cumulativeAverage - nationalCumulativeAverage;
  const deltaTone =
    cumulativeDelta === null
      ? "neutral"
      : cumulativeDelta > 0.049
        ? "above"
        : cumulativeDelta < -0.049
          ? "below"
          : "neutral";
  const yearly = vocConsultation.years.map((year, index) => {
    const showroomResponses = selected[3 + index * 2] as number;
    const nationalResponses = national[3 + index * 2] as number;
    const showroomSent = selectedSent[index] ?? 0;
    const nationalSentCount = nationalSent[index] ?? 0;

    return {
      year,
      showroomAverage: selected[2 + index * 2] as number | null,
      showroomResponses,
      nationalAverage: national[2 + index * 2] as number | null,
      nationalResponses,
      showroomSent,
      nationalSent: nationalSentCount,
      showroomRate:
        showroomSent > 0 ? (showroomResponses / showroomSent) * 100 : null,
      nationalRate:
        nationalSentCount > 0
          ? (nationalResponses / nationalSentCount) * 100
          : null,
    };
  });
  const cumulativeResponses = yearly.reduce(
    (sum, item) => sum + item.showroomResponses,
    0,
  );
  const cumulativeSent = yearly.reduce(
    (sum, item) => sum + item.showroomSent,
    0,
  );
  const nationalCumulativeResponses = yearly.reduce(
    (sum, item) => sum + item.nationalResponses,
    0,
  );
  const nationalCumulativeSent = yearly.reduce(
    (sum, item) => sum + item.nationalSent,
    0,
  );
  const cumulativeResponseRate =
    cumulativeSent > 0 ? (cumulativeResponses / cumulativeSent) * 100 : null;
  const nationalCumulativeResponseRate =
    nationalCumulativeSent > 0
      ? (nationalCumulativeResponses / nationalCumulativeSent) * 100
      : null;
  const cumulativeRateDelta =
    cumulativeResponseRate === null || nationalCumulativeResponseRate === null
      ? null
      : cumulativeResponseRate - nationalCumulativeResponseRate;
  const scaleHeight = (value: number | null) =>
    value === null ? 0 : Math.min(100, Math.max(0, ((value - 8) / 2) * 100));
  const responseFormatter = new Intl.NumberFormat("ko-KR");
  const responseRateCeiling = Math.max(
    40,
    Math.ceil(
      Math.max(0, ...yearly.map((item) => item.showroomRate ?? 0)) / 10,
    ) * 10,
  );
  const responseRatePoints = yearly.map((item, index) => ({
    x: 12.5 + index * 25,
    y:
      item.showroomRate === null
        ? null
        : 90 -
          Math.min(1, Math.max(0, item.showroomRate / responseRateCeiling)) *
            78,
    rate: item.showroomRate,
    year: item.year,
  }));
  const responseRatePolyline = responseRatePoints
    .filter(
      (point): point is (typeof responseRatePoints)[number] & { y: number } =>
        point.y !== null,
    )
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const accessibleTrend = yearly
    .map(
      (item) =>
        `${item.year}년 전국 평균 ${displayNumber(item.nationalAverage)}점, ${displayShowroomName(
          showroom.showroom,
        )} ${displayNumber(item.showroomAverage)}점, 회신 ${responseFormatter.format(
          item.showroomResponses,
        )}건, 발송 ${responseFormatter.format(item.showroomSent)}건, 회신율 ${
          item.showroomRate === null ? "산출 불가" : `${item.showroomRate.toFixed(1)}%`
        }`,
    )
    .join(", ");

  return (
    <aside
      className="voc-consultation-history"
      aria-label={`${displayShowroomName(showroom.showroom)} 상담 만족도 4개년 비교`}
    >
      <header className="voc-consultation-heading">
        <div>
          <strong><span className="english-title">4</span>개년 추이</strong>
          <span className="voc-consultation-response-summary">
            회신율 <b>{cumulativeResponseRate?.toFixed(1) ?? "—"}%</b>
            <em>
              전국 {nationalCumulativeResponseRate?.toFixed(1) ?? "—"}% ·{" "}
              {cumulativeRateDelta === null
                ? "—"
                : `${cumulativeRateDelta >= 0 ? "▲" : "▼"}${Math.abs(
                    cumulativeRateDelta,
                  ).toFixed(1)}%p`}
            </em>
          </span>
        </div>
        <div className="voc-consultation-cumulative">
          <small>누적</small>
          <strong>{displayNumber(cumulativeAverage)}</strong>
          <em className={deltaTone}>
            {cumulativeDelta === null
              ? "—"
              : `${cumulativeDelta > 0.049 ? "▲" : cumulativeDelta < -0.049 ? "▼" : "±"} ${Math.abs(
                  cumulativeDelta,
                ).toFixed(1)}`}
          </em>
        </div>
      </header>

      <div className="voc-consultation-chart-wrap">
        <div
          className="voc-consultation-chart"
          role="img"
          aria-label={accessibleTrend}
        >
          <span className="voc-consultation-axis top">10.0</span>
          <span className="voc-consultation-axis middle">9.0</span>
          <span className="voc-consultation-axis base">8.0</span>
          <span className="voc-response-rate-axis top">
            {responseRateCeiling}%
          </span>
          <span className="voc-response-rate-axis base">0</span>
          <div className="voc-consultation-bars" aria-hidden="true">
            {yearly.map((item) => (
              <div className="voc-consultation-year" key={item.year}>
                <div className="voc-consultation-pair">
                  <i
                    className="voc-consultation-bar national"
                    style={{ height: `${scaleHeight(item.nationalAverage)}%` }}
                  >
                    <b>{displayNumber(item.nationalAverage)}</b>
                  </i>
                  <i
                    className={`voc-consultation-bar showroom ${
                      item.showroomAverage === null ? "missing" : ""
                    }`}
                    style={{ height: `${scaleHeight(item.showroomAverage)}%` }}
                  >
                    <b>{displayNumber(item.showroomAverage)}</b>
                  </i>
                </div>
                <small>
                  {item.year}
                  {item.year === 2026 && <em>YTD</em>}
                </small>
              </div>
            ))}
          </div>
          <div className="voc-response-rate-line-layer" aria-hidden="true">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline points={responseRatePolyline} />
            </svg>
            {responseRatePoints.map((point) =>
              point.y === null ? null : (
                <span
                  className={`voc-response-rate-point ${
                    point.y < 22 ? "label-below" : ""
                  }`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  key={point.year}
                >
                  <i />
                  <b>{point.rate?.toFixed(1)}%</b>
                </span>
              ),
            )}
          </div>
        </div>

        <div className="voc-consultation-legend" aria-hidden="true">
          <span>
            <i className="national" /> 전국 평균
          </span>
          <span>
            <i className="showroom" /> {displayShowroomName(showroom.showroom)}
          </span>
          <span>
            <i className="response-line" /> 회신율
          </span>
        </div>
      </div>
    </aside>
  );
}

function WeeklyTrend({
  showroom,
  metric,
  compact = false,
  synchronizedAnimationInView,
  highlightQuarter = null,
}: {
  showroom: Showroom;
  metric: TrendMetricKey;
  compact?: boolean;
  synchronizedAnimationInView?: boolean;
  highlightQuarter?: QuarterKey | null;
}) {
  const current =
    metric === "cx" ? (cxRawTotalOf(showroom) ?? 0) : (showroom[metric] ?? 0);
  const previous =
    metric === "cx"
      ? cxRawTotalOf(showroom.q1)
      : (showroom.q1?.[metric] ?? null);
  const average =
    metric === "cx"
      ? (cxRawTotalOf(dashboard.averages) ?? 0)
      : (dashboard.averages[metric] ?? 0);
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
  const chartHeight = compact ? 150 : 210;
  const chartYScale = chartHeight / 200;
  const chartY = (coordinate: number) => coordinate * chartYScale;
  const plotLeft = (28 / 1360) * chartWidth;
  const plotRight = compact ? chartWidth : chartWidth - plotLeft;
  const plotWidth = plotRight - plotLeft;
  const x = (week: number) =>
    plotLeft + ((week - 0.5) / 52) * plotWidth;
  const weekBoundaryX = (completedWeeks: number) =>
    plotLeft + (completedWeeks / 52) * plotWidth;
  const evaluationProgressWeek = Math.max(26, Math.min(latestWeek, 39));
  const activeQuarterStart = weekBoundaryX(26);
  const activeQuarterEnd = weekBoundaryX(39);
  const upcomingQuarterStart = weekBoundaryX(39);
  const upcomingQuarterEnd = weekBoundaryX(52);
  const highlightedQuarterStartWeek =
    highlightQuarter === "q1"
      ? 0
      : highlightQuarter === "q2"
        ? 13
        : highlightQuarter === "q4"
          ? 39
          : 26;
  const highlightedQuarterEndWeek = highlightedQuarterStartWeek + 13;
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

  const actualSeriesVisible = synchronizedAnimationInView ?? true;

  return (
    <div className={`trend-wrap ${compact ? "compact" : ""}`}>
      <div
        ref={trendScrollRef}
        className="trend-scroll"
        tabIndex={0}
        aria-label="W01부터 시작하는 52주 성과 그래프"
      >
        <div className="trend-canvas">
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
            {highlightQuarter && (
              <rect
                x={weekBoundaryX(highlightedQuarterStartWeek)}
                y={chartY(18)}
                width={
                  weekBoundaryX(highlightedQuarterEndWeek) -
                  weekBoundaryX(highlightedQuarterStartWeek)
                }
                height={chartY(152)}
                className="selected-quarter-window"
                aria-hidden="true"
              />
            )}
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
                className="week-grid quarter-boundary-line"
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
              <g
                data-animation-trigger={
                  synchronizedAnimationInView !== undefined
                    ? "scroll"
                    : "immediate"
                }
                className={`actual-series-wipe ${
                  synchronizedAnimationInView !== undefined
                    ? "one-voice-sync"
                    : ""
                } ${
                  actualSeriesVisible ? "is-visible" : ""
                }`}
              >
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
            {showNational && showActual && averagePoints.length > 0 && (
              <g className="national-priority-marker-layer" aria-hidden="true">
                {averagePoints.map((point) => {
                  const actualValue = actualAt(point.week);
                  if (actualValue === null || point.value <= actualValue) {
                    return null;
                  }

                  return (
                    <circle
                      key={`average-priority-${point.week}`}
                      cx={x(point.week)}
                      cy={y(point.value)}
                      r={markerRadius}
                      className="national-average-point national-average-point-priority"
                    />
                  );
                })}
              </g>
            )}
            {showNational && averagePoints.length > 0 && (
              <g className="national-value-label-layer" aria-hidden="true">
                {averagePoints.map((point) => (
                  <text
                    key={`average-label-${point.week}`}
                    x={x(point.week)}
                    y={nationalValueLabelY(point)}
                    textAnchor="middle"
                    className="national-point-value"
                  >
                    {displayTrendNumber(point.value)}
                  </text>
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
          <div className="quarter-band" aria-hidden="true">
            {quarterLabels.map((quarterItem) => (
              <span
                key={quarterItem.label}
                className={
                  quarterItem.label.toLowerCase() === highlightQuarter
                    ? "is-quarter-highlighted"
                    : ""
                }
              >
                <strong>{quarterItem.label}</strong>
                <small>{quarterItem.range}</small>
              </span>
            ))}
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
              <strong>5개 고객경험 항목 원점수 합산, 총 320점</strong>
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
          <div className="cx-stack" aria-label="CX Management 320점 구성">
            {[
              ["신차 출고 만족도", "원점수", 100],
              ["시승 만족도", "원점수", 100],
              ["긴급경보", "2일 이내 처리", 10],
              ["조치계획", "분기 내 제출", 10],
              ["Hej Volvo 앱", "가입률 원점수", 100],
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
  showroomAccess,
}: {
  viewer: Viewer;
  initialCdsid: string;
  showroomAccess: ShowroomAccess;
}) {
  const [selectedCode, setSelectedCode] = useState(initialCdsid);
  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>("voc");
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterKey>("q2");
  const [metricQuarters, setMetricQuarters] = useState<
    Record<TrendMetricKey, QuarterKey>
  >({ v3s: "q2", voc: "q3", cx: "q3" });
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [evidenceQuarter, setEvidenceQuarter] =
    useState<EvidenceQuarter | null>(null);
  const dashboardRootRef = useRef<HTMLElement>(null);
  const stickyAnchorRef = useRef<HTMLDivElement>(null);
  const stickyShellRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const oneVoiceRef = useRef<HTMLElement>(null);
  const quarterScrollFrameRef = useRef<number | null>(null);
  const [oneVoiceInView, setOneVoiceInView] = useState(false);
  const [oneVoiceScores, setOneVoiceScores] = useState<OneVoiceScores>({
    carHandoverScore: 94.0,
    testDriveScore: 88.5,
    capturedAt: "2026-08-20T10:00:00+09:00",
  });
  const [accessDate, setAccessDate] = useState(() =>
    formatSeoulDate(new Date()),
  );
  const oneVoiceReferenceDate = formatOneVoiceReferenceDate(
    oneVoiceScores.capturedAt,
  );
  const [latestUpdate, setLatestUpdate] = useState<LatestUpdate>({
    title: "Q1, Q2 마감, 현재 Q3평가 진행중",
    effectiveDate: dashboard.meta.updatedAt,
  });

  useEffect(() => {
    const syncAccessDate = () => setAccessDate(formatSeoulDate(new Date()));
    syncAccessDate();
    const timer = window.setInterval(syncAccessDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;

    const closeProfileOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !profileMenuRef.current?.contains(target)) {
        setProfileOpen(false);
      }
    };
    const closeProfileOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };

    document.addEventListener("pointerdown", closeProfileOnOutsidePointer);
    document.addEventListener("keydown", closeProfileOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeProfileOnOutsidePointer);
      document.removeEventListener("keydown", closeProfileOnEscape);
    };
  }, [profileOpen]);

  useEffect(
    () => () => {
      if (quarterScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(quarterScrollFrameRef.current);
      }
    },
    [],
  );

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

  useEffect(() => {
    let mounted = true;
    const syncOneVoice = async () => {
      try {
        const response = await fetch("/api/one-voice", { cache: "no-store" });
        const payload = (await response.json()) as {
          snapshot?: {
            carHandoverScore?: number;
            testDriveScore?: number;
            capturedAt?: string;
          } | null;
        };
        const snapshot = payload.snapshot;
        if (
          mounted &&
          snapshot &&
          typeof snapshot.carHandoverScore === "number" &&
          typeof snapshot.testDriveScore === "number"
        ) {
          setOneVoiceScores({
            carHandoverScore: snapshot.carHandoverScore,
            testDriveScore: snapshot.testDriveScore,
            capturedAt: snapshot.capturedAt ?? null,
          });
        }
      } catch {
        // Keep the last verified values when the collection API is unavailable.
      }
    };

    void syncOneVoice();
    const timer = window.setInterval(syncOneVoice, 60_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const panel = oneVoiceRef.current;
    if (!panel) return;

    const desktop = window.matchMedia("(min-width: 761px)");
    if (!desktop.matches || typeof IntersectionObserver === "undefined") {
      const visibleFrame = window.requestAnimationFrame(() =>
        setOneVoiceInView(true),
      );
      return () => window.cancelAnimationFrame(visibleFrame);
    }

    const resetFrame = window.requestAnimationFrame(() =>
      setOneVoiceInView(false),
    );

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        window.requestAnimationFrame(() => setOneVoiceInView(true));
        observer.disconnect();
      },
      {
        threshold: 0.45,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(panel);
    return () => {
      window.cancelAnimationFrame(resetFrame);
      observer.disconnect();
    };
  }, [selectedCode]);

  useLayoutEffect(() => {
    const dashboardRoot = dashboardRootRef.current;
    const anchor = stickyAnchorRef.current;
    const shell = stickyShellRef.current;
    if (!dashboardRoot || !anchor || !shell) return;

    let resizeFrame = 0;

    const syncAnchorHeight = () => {
      if (window.matchMedia("(max-width: 760px)").matches) {
        anchor.style.removeProperty("height");
        dashboardRoot.style.setProperty("--dashboard-sticky-offset", "0px");
        return;
      }
      const shellHeight = Math.ceil(shell.getBoundingClientRect().height);
      anchor.style.height = `${shellHeight}px`;
      dashboardRoot.style.setProperty(
        "--dashboard-sticky-offset",
        `${shellHeight}px`,
      );
    };

    const queueAnchorHeightSync = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(syncAnchorHeight);
    };

    syncAnchorHeight();
    const observer = new ResizeObserver(queueAnchorHeightSync);
    observer.observe(shell);
    window.addEventListener("resize", queueAnchorHeightSync);
    window.visualViewport?.addEventListener("resize", queueAnchorHeightSync);
    void document.fonts?.ready.then(queueAnchorHeightSync);

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      window.removeEventListener("resize", queueAnchorHeightSync);
      window.visualViewport?.removeEventListener("resize", queueAnchorHeightSync);
      dashboardRoot.style.removeProperty("--dashboard-sticky-offset");
    };
  }, []);

  const selected =
    dashboard.showrooms.find((item) => item.cdsid === selectedCode) ??
    dashboard.showrooms[0];
  const switchableShowrooms = dashboard.showrooms.filter(
    (item) =>
      showroomAccess.allowedCdsids.includes(item.cdsid) &&
      item.cdsid !== selected.cdsid,
  );
  const canSwitchShowrooms =
    showroomAccess.role !== "manager" && switchableShowrooms.length > 0;
  const scrollMetricQuarterToSection = (metric: "v3s" | "voc") => {
    const target = document.getElementById(`score-${metric}`);
    if (!target) return;

    if (quarterScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(quarterScrollFrameRef.current);
    }

    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const stickyHeight = mobile
      ? 0
      : stickyShellRef.current?.getBoundingClientRect().height ?? 0;
    const scoreHeadingHeight = mobile
      ? 0
      : document
          .querySelector<HTMLElement>(".score-stack-heading")
          ?.getBoundingClientRect().height ?? 52;
    const startTop = window.scrollY;
    const targetTop = Math.max(
      0,
      startTop +
        target.getBoundingClientRect().top -
        stickyHeight -
        scoreHeadingHeight -
        10,
    );
    const distance = targetTop - startTop;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion || Math.abs(distance) < 2) {
      window.scrollTo({
        top: targetTop,
        left: window.scrollX,
        behavior: "auto",
      });
      quarterScrollFrameRef.current = null;
      return;
    }

    const launchDistance =
      Math.sign(distance) * Math.min(Math.abs(distance) * 0.12, 96);
    const animationStartTop = startTop + launchDistance;
    const remainingDistance = targetTop - animationStartTop;
    window.scrollTo({
      top: animationStartTop,
      left: window.scrollX,
      behavior: "auto",
    });

    const duration = 360;
    const startedAt = performance.now();
    const animateScroll = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      window.scrollTo({
        top: animationStartTop + remainingDistance * eased,
        left: window.scrollX,
        behavior: "auto",
      });

      if (progress < 1) {
        quarterScrollFrameRef.current =
          window.requestAnimationFrame(animateScroll);
      } else {
        quarterScrollFrameRef.current = null;
      }
    };

    quarterScrollFrameRef.current =
      window.requestAnimationFrame(animateScroll);
  };
  const selectMetricQuarter = (
    metric: TrendMetricKey,
    quarter: QuarterKey,
  ) => {
    setMetricQuarters((current) => ({ ...current, [metric]: quarter }));
    if (metric === "v3s") setSelectedQuarter(quarter);
    setTrendMetric(metric);
    if (metric === "v3s") {
      scrollMetricQuarterToSection("v3s");
    }
    if (metric === "cx" && quarter !== "q3") {
      scrollMetricQuarterToSection("voc");
    }
  };
  const showroomCodeWidth = Math.max(
    ...dashboard.showrooms.map((item) => item.cdsid.length),
  );
  const displayUpdateTitle =
    latestUpdate.effectiveDate.replaceAll(".", "-") === "2026-07-29" ||
    latestUpdate.title === "현재 Q3평가 진행중"
      ? "Q1, Q2 마감, 현재 Q3평가 진행중"
      : latestUpdate.title;
  const combat = selected.combat ?? 0;
  const q1Combat = selected.q1?.combat ?? combat;
  const cumulativeAverage = (q1Combat + combat) / 2;
  const q1CombatAverage = quarterAverageOf("combat", "q1");
  const q2CombatAverage = quarterAverageOf("combat", "q2");
  const cumulativeNationalAverage = (q1CombatAverage + q2CombatAverage) / 2;
  const cumulativeDelta = cumulativeAverage - cumulativeNationalAverage;
  const cumulativeCombatOf = (item: Showroom) => {
    const values = [item.q1?.combat, item.combat].filter(
      (value): value is number => typeof value === "number",
    );
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : Number.NEGATIVE_INFINITY;
  };
  const cumulativeRank =
    [...dashboard.showrooms]
      .sort((a, b) => cumulativeCombatOf(b) - cumulativeCombatOf(a))
      .findIndex((item) => item.cdsid === selected.cdsid) + 1;
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
      quarter: metricQuarters.v3s,
      value: quarterValueOf(selected, "v3s", metricQuarters.v3s) ?? 0,
      average: quarterAverageOf("v3s", metricQuarters.v3s),
      appeal: "possible" as const,
      appealLabel: undefined,
    },
    {
      key: "voc" as const,
      quarter: metricQuarters.voc,
      value: quarterValueOf(selected, "voc", metricQuarters.voc) ?? 0,
      average: quarterAverageOf("voc", metricQuarters.voc),
      appeal: "partial" as const,
      appealLabel: "VOC해피콜만 사후보정 가능",
    },
    {
      key: "cx" as const,
      quarter: metricQuarters.cx,
      value: quarterValueOf(selected, "cx", metricQuarters.cx) ?? 0,
      average: quarterAverageOf("cx", metricQuarters.cx),
      appeal: "partial" as const,
      appealLabel: "신차해피콜만 사후보정 가능",
    },
  ];
  const warningCount = kpis.filter((item) => item.value < item.average).length;
  const combatDelta = selectedQuarterCombat - selectedCombatAverage;

  return (
    <main className="dashboard" ref={dashboardRootRef}>
      <div className="dashboard-sticky-anchor" ref={stickyAnchorRef}>
      <div className="dashboard-sticky-shell" ref={stickyShellRef}>
        <section className="dashboard-identity-header identity-strip">
          <DashboardHeaderLead
            title={`${displayShowroomName(selected.showroom)} 현황`}
            accessDate={accessDate}
            status={displayUpdateTitle}
          />
        <div className="identity-detail-rail">
          <dl>
            <div className="identity-analysis-entry">
              <Link
                className="identity-analysis-hit"
                href={`/dashboard/${selected.cdsid}/analysis?view=dealer`}
                aria-label={`${selected.dealer} 딜러사별 경쟁력 분석`}
                onClick={(event) => event.currentTarget.blur()}
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
                onClick={(event) => event.currentTarget.blur()}
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
                onClick={(event) => event.currentTarget.blur()}
              />
              <span
                className="identity-icon identity-icon--size"
                aria-hidden="true"
              />
              <dt>사이즈</dt>
              <dd>{selected.size}</dd>
            </div>
          </dl>
          <div className="identity-profile-menu" ref={profileMenuRef}>
            {canSwitchShowrooms ? (
              <button
                className="identity-profile"
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-controls="showroom-switcher"
                aria-label={`${selected.manager} 지점장 · 다른 전시장 선택`}
              >
                <span className="identity-profile-icon" aria-hidden="true" />
                <span className="identity-profile-role">지점장</span>
                <strong>{selected.manager}</strong>
              </button>
            ) : (
              <div
                className="identity-profile identity-profile--static"
                aria-label={`${selected.manager} 지점장`}
              >
                <span className="identity-profile-icon" aria-hidden="true" />
                <span className="identity-profile-role">지점장</span>
                <strong>{selected.manager}</strong>
              </div>
            )}
            {canSwitchShowrooms && profileOpen && (
              <div
                className="profile-popover"
                id="showroom-switcher"
                role="menu"
                aria-label={`현재 전시장을 제외한 ${switchableShowrooms.length}개 전시장`}
              >
                <div className="profile-popover-heading">
                  <strong>다른 전시장 선택</strong>
                </div>
                <div className="profile-showroom-list">
                  {switchableShowrooms.map((item) => (
                      <button
                        key={item.cdsid}
                        type="button"
                        role="menuitem"
                        className="profile-showroom-option"
                        onClick={() => {
                          setSelectedCode(item.cdsid);
                          setProfileOpen(false);
                        }}
                      >
                        <span className="profile-showroom-code">
                          {item.cdsid.padEnd(showroomCodeWidth, "\u2007")}
                        </span>
                        <strong>{displayShowroomName(item.showroom)}</strong>
                        <small>{item.manager} 지점장</small>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
        </section>

        <section className={`mobile-command ${warningCount ? "has-warning" : ""}`}>
        <div className="mobile-power">
          <div>
            <span>누적 평균</span>
            <strong>{displayNumber(cumulativeAverage)}</strong>
            <small>/ {dashboard.meta.combatMax}</small>
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
                  if (available) {
                    setSelectedQuarter(quarter);
                    setMetricQuarters((current) => ({
                      ...current,
                      v3s: quarter,
                    }));
                  }
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
                  {item.quarter.toUpperCase()} 평균 대비{" "}
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
        <article className={`combat-card combat-scoreboard ${tier.className}`}>
          <header className="scoreboard-heading">
            <div>
              <span className="english-title">2026 SCORE BOARD</span>
              <strong>분기별 종합점수</strong>
            </div>
            <small>점수를 선택하면 하단 지표가 바뀝니다</small>
          </header>

          <div className="scoreboard-layout">
            <div
              className="scoreboard-quarter-table"
              role="table"
              aria-label={`분기별 종합점수, ${dashboard.meta.combatMax}점 만점`}
            >
              <div className="scoreboard-table-head" role="row">
                <span role="columnheader">분기</span>
                <span role="columnheader">내 점수</span>
                <span role="columnheader">전국 평균</span>
                <span role="columnheader">차이</span>
              </div>
              {[
                {
                  key: "q1" as const,
                  label: "Q1",
                  value: q1Combat,
                  average: q1CombatAverage,
                  status: "마감",
                },
                {
                  key: "q2" as const,
                  label: "Q2",
                  value: combat,
                  average: q2CombatAverage,
                  status: "마감",
                },
                {
                  key: null,
                  label: "Q3",
                  value: null,
                  average: null,
                  status: "평가 중",
                },
                {
                  key: null,
                  label: "Q4",
                  value: null,
                  average: null,
                  status: "평가 전",
                },
              ].map((quarter) => {
                const delta =
                  quarter.value === null || quarter.average === null
                    ? null
                    : quarter.value - quarter.average;
                return (
                  <button
                    type="button"
                    role="row"
                    disabled={quarter.key === null}
                    aria-pressed={
                      quarter.key === null
                        ? undefined
                        : selectedQuarter === quarter.key
                    }
                    aria-label={
                      quarter.key === null
                        ? `${quarter.label} ${quarter.status}`
                        : `${quarter.label} 지표 보기`
                    }
                    onClick={() => {
                      if (quarter.key) {
                        setSelectedQuarter(quarter.key);
                        setMetricQuarters((current) => ({
                          ...current,
                          v3s: quarter.key as QuarterKey,
                        }));
                      }
                    }}
                    className={`scoreboard-quarter-row ${
                      quarter.key === selectedQuarter ? "current" : ""
                    } ${quarter.value === null ? "planned" : ""}`}
                    key={quarter.label}
                  >
                    <strong role="cell">{quarter.label}</strong>
                    {quarter.value === null ? (
                      <span className="scoreboard-quarter-status" role="cell">
                        {quarter.status}
                      </span>
                    ) : (
                      <>
                        <span role="cell">{displayNumber(quarter.value)}</span>
                        <span role="cell">{displayNumber(quarter.average)}</span>
                        <span
                          role="cell"
                          className={delta !== null && delta >= 0 ? "positive" : "negative"}
                        >
                          {delta !== null && delta >= 0 ? "+" : ""}
                          {displayNumber(delta)}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="scoreboard-summary">
              <div className="scoreboard-primary-score">
                <span>2026 누적 종합점수</span>
                <strong>{displayNumber(cumulativeAverage)}</strong>
                <small>/ {dashboard.meta.combatMax}점</small>
              </div>
              <div className="scoreboard-comparison" aria-label="누적점수 비교">
                <span>
                  <small>{displayShowroomName(selected.showroom)}</small>
                  <b>{displayNumber(cumulativeAverage)}</b>
                </span>
                <span>
                  <small>볼보 전체 평균</small>
                  <b>{displayNumber(cumulativeNationalAverage)}</b>
                </span>
              </div>
              <div className="scoreboard-summary-footer">
                <span className={cumulativeDelta >= 0 ? "positive" : "negative"}>
                  평균 대비
                  <strong>
                    {cumulativeDelta >= 0 ? "+" : ""}
                    {displayNumber(cumulativeDelta)}점
                  </strong>
                </span>
                <span>
                  전국 순위
                  <strong>
                    {cumulativeRank}위 <small>/ {dashboard.meta.showroomCount}</small>
                  </strong>
                </span>
              </div>
            </div>
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
                quarter={item.quarter}
                active={trendMetric === item.key}
                onSelect={() => setTrendMetric(item.key)}
                onQuarterSelect={(quarter) =>
                  selectMetricQuarter(item.key, quarter)
                }
                evidenceQuarters={
                  item.key === "v3s"
                    ? (["q1", "q2", "q3", "q4"] as QuarterKey[]).filter(
                        (quarter) =>
                          getV3sEvidence(selected.cdsid, quarter).length > 0,
                      )
                    : undefined
                }
                onEvidenceOpen={
                  item.key === "v3s"
                    ? (quarter) => setEvidenceQuarter(quarter)
                    : undefined
                }
                appeal={item.appeal}
                appealLabel={item.appealLabel}
              />
            ))}
          </div>
        </div>
        </section>
      </div>
      </div>

      <section
        className="content-grid"
        id="weekly-trend"
        key={`showroom-trend-${selected.cdsid}`}
      >
        <article className="panel trend-panel score-stack-panel">
          <div className="section-heading score-stack-heading">
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
                <strong className="english-title">V3S</strong>
              </header>
              <V3SPerformance
                showroom={selected}
                compact
                highlightQuarter={
                  metricQuarters.v3s
                }
              />
            </section>
            <section
              id="score-voc"
              className={`score-tier score-tier-weekly ${
                trendMetric === "voc" ? "active" : ""
              }`}
            >
              <header className="score-tier-heading voc-score-heading">
                <div className="score-tier-heading-title">
                  <strong className="english-title">VOC</strong>
                </div>
                <div
                  className="voc-component-tabs"
                  aria-label="VOC 평가 구성 항목"
                >
                  {vocComponents.map((component) => (
                    <span className="voc-component-chip" key={component.label}>
                      <span>{component.label}</span>
                      <em>({component.weight})</em>
                    </span>
                  ))}
                </div>
              </header>
              <div className="weekly-score-layout">
                <WeeklyTrend
                  key={`${selected.cdsid}-voc`}
                  showroom={selected}
                  metric="voc"
                  compact
                  highlightQuarter={
                    metricQuarters.voc
                  }
                />
                <ConsultationSatisfactionHistory showroom={selected} />
              </div>
            </section>
            <section
              id="score-cx"
              className={`score-tier score-tier-weekly ${
                trendMetric === "cx" ? "active" : ""
              }`}
            >
              <header className="score-tier-heading cx-score-heading">
                <div className="score-tier-heading-title">
                  <strong className="english-title">CX Index</strong>
                </div>
                <div
                  className="cx-component-tabs"
                  aria-label="CX Index 평가 구성 항목"
                >
                  {cxComponents.map((component) => (
                    <span className="cx-component-chip" key={component.label}>
                      <span>{component.label}</span>
                      <em>({component.score})</em>
                    </span>
                  ))}
                </div>
              </header>
              <div className="weekly-score-layout">
                <WeeklyTrend
                  key={`${selected.cdsid}-cx`}
                  showroom={selected}
                  metric="cx"
                  compact
                  synchronizedAnimationInView={oneVoiceInView}
                  highlightQuarter={
                    metricQuarters.cx
                  }
                />
                <aside
                  ref={oneVoiceRef}
                  className={`one-voice-contribution ${oneVoiceInView ? "is-visible" : ""}`}
                  aria-label="ONE VOICE 만족도"
                >
                  <header className="one-voice-contribution-heading">
                    <div>
                      <div className="one-voice-title-row">
                        <strong className="english-title">ONE VOICE</strong>
                        {oneVoiceReferenceDate && (
                          <time
                            className="one-voice-reference-date"
                            dateTime={oneVoiceScores.capturedAt ?? undefined}
                          >
                            {oneVoiceReferenceDate} 기준
                          </time>
                        )}
                      </div>
                      <span>Volvo Korea 전체</span>
                    </div>
                    <small>지난 6개월부터 오늘까지</small>
                  </header>
                  <div className="one-voice-gauge-grid">
                    <article className="one-voice-metric">
                      <div
                        className="one-voice-gauge one-voice-gauge-handover"
                        role="img"
                        aria-label={`신차출고 만족도 ${oneVoiceScores.carHandoverScore.toFixed(1)}점`}
                        title={
                          oneVoiceScores.capturedAt
                            ? `최근 수집 ${oneVoiceScores.capturedAt}`
                            : undefined
                        }
                        style={
                          {
                            "--one-voice-target":
                              oneVoiceScores.carHandoverScore,
                          } as CSSProperties
                        }
                      >
                        <span
                          className="one-voice-gauge-endpoint"
                          aria-hidden="true"
                        />
                        <span className="one-voice-gauge-value">
                          <strong>
                            {oneVoiceScores.carHandoverScore.toFixed(1)}
                          </strong>
                          <small>점</small>
                        </span>
                      </div>
                      <div className="one-voice-metric-label">
                        <strong>신차출고 만족도</strong>
                        <span>Car Handover · OSAT</span>
                      </div>
                    </article>
                    <article className="one-voice-metric">
                      <div
                        className="one-voice-gauge one-voice-gauge-test-drive"
                        role="img"
                        aria-label={`시승종합 만족도 ${oneVoiceScores.testDriveScore.toFixed(1)}점`}
                        title={
                          oneVoiceScores.capturedAt
                            ? `최근 수집 ${oneVoiceScores.capturedAt}`
                            : undefined
                        }
                        style={
                          {
                            "--one-voice-target": oneVoiceScores.testDriveScore,
                          } as CSSProperties
                        }
                      >
                        <span
                          className="one-voice-gauge-endpoint"
                          aria-hidden="true"
                        />
                        <span className="one-voice-gauge-value">
                          <strong>{oneVoiceScores.testDriveScore.toFixed(1)}</strong>
                          <small>점</small>
                        </span>
                      </div>
                      <div className="one-voice-metric-label">
                        <strong>시승종합 만족도</strong>
                        <span>Test Drive · OSAT</span>
                      </div>
                    </article>
                  </div>
                </aside>
              </div>
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
      <ReleaseUpdateNotice />
      {evidenceQuarter && (
        <V3SEvidenceGallery
          cdsid={selected.cdsid}
          showroomName={displayShowroomName(selected.showroom)}
          quarter={evidenceQuarter}
          onClose={() => setEvidenceQuarter(null)}
        />
      )}
    </main>
  );
}
