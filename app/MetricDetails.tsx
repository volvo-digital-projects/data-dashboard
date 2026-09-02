import Link from "next/link";
import dashboardJson from "./data/showrooms.json";
import weeklyDetailsJson from "./data/weekly-details.json";

type DetailMetric = "voc" | "cx";
type WeekRange = {
  week: number;
  start: string;
  end: string;
};
type DetailComponent = {
  key: string;
  label: string;
  weight: string;
  max: number;
  unit: string;
  cadence: "weekly" | "quarterly";
  latestWeek: number;
  average: Array<number | null>;
  byCdsid: Record<string, Array<number | null>>;
};
type DetailData = {
  meta: {
    syncedAt: string;
    weekRanges: WeekRange[];
  };
  voc: {
    label: string;
    components: DetailComponent[];
  };
  cx: {
    label: string;
    components: DetailComponent[];
  };
};

const detailData = weeklyDetailsJson as DetailData;
const chart = {
  width: 1440,
  height: 104,
  left: 52,
  right: 28,
  top: 20,
  bottom: 30,
};
const chartPlotWidth = chart.width - chart.left - chart.right;
const weekCellWidth = chartPlotWidth / 52;
const weekBoundaryX = (boundaryIndex: number) =>
  chart.left + boundaryIndex * weekCellWidth;

const quarterRanges = [
  { label: "Q1", start: 1, end: 13, range: "W01–W13" },
  { label: "Q2", start: 14, end: 26, range: "W14–W26" },
  { label: "Q3", start: 27, end: 39, range: "W27–W39" },
  { label: "Q4", start: 40, end: 52, range: "W40–W52" },
];

const vocContributionLabels: Record<string, string> = {
  overall: "60% 반영(60점)",
  greeting: "10% 반영(10점)",
  tablet: "10% 반영(10점)",
  happyCall: "10% 반영(10점)",
};

const cxContributionLabels: Record<string, string> = {
  delivery: "90점 이상 시 40점 반영",
  testDrive: "90점 이상 시 50점 반영",
  emergency: "미발생 혹은 2일 이내 조치 시, 10점 반영",
  actionPlan: "기한 내 제출 시, 10점 반영",
  app: "가입율 90%(점) 이상 시, 20점 반영",
};

const displayNumber = (value: number | null | undefined) =>
  typeof value === "number"
    ? value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
    : "—";

const formatSyncDate = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\.\s?/g, "")
    .trim();
};

const point = (index: number, value: number, max: number) => {
  const plotHeight = chart.height - chart.top - chart.bottom;
  const x = weekBoundaryX(index + 0.5);
  const ratio = Math.max(0, Math.min(1, value / max));
  const y = chart.top + (1 - ratio) * plotHeight;
  return { x, y };
};

const lineSegments = (values: Array<number | null>, max: number) => {
  const segments: string[] = [];
  let current: string[] = [];

  values.slice(0, 52).forEach((value, index) => {
    if (typeof value !== "number") {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const { x, y } = point(index, value, max);
    current.push(`${current.length ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));
  return segments;
};

const lastValueIndex = (values: Array<number | null>, latestWeek: number) => {
  for (let index = Math.min(52, latestWeek) - 1; index >= 0; index -= 1) {
    if (typeof values[index] === "number") return index;
  }
  return -1;
};

function MetricDetailChart({
  component,
  cdsid,
  metric,
  showroomName,
  updateWeek,
}: {
  component: DetailComponent;
  cdsid: string;
  metric: DetailMetric;
  showroomName: string;
  updateWeek: number;
}) {
  const rawShowroomValues = component.byCdsid[cdsid] ?? [];
  const showroomValues = Array.from({ length: 52 }, (_, index) => {
    if (index >= updateWeek) return null;
    const value = rawShowroomValues[index];
    if (typeof value === "number") return value;
    return metric === "voc" ? 0 : null;
  });
  const completedWeek = updateWeek;
  const latestIndex = lastValueIndex(showroomValues, updateWeek);
  const latestShowroom = latestIndex >= 0 ? showroomValues[latestIndex] : null;
  const latestPoint =
    latestIndex >= 0 && typeof latestShowroom === "number"
      ? point(latestIndex, latestShowroom, component.max)
      : null;
  const axisWeeks = Array.from({ length: 52 }, (_, index) => index + 1);
  const axisBoundaries = Array.from({ length: 53 }, (_, index) => index);
  const quarterBoundaryIndexes = [0, 13, 26, 39, 52];
  const majorAxisBoundaries = new Set(quarterBoundaryIndexes);
  const scorePoints = showroomValues.slice(0, 52).flatMap((value, index) => {
    if (typeof value !== "number") return [];
    const coordinates = point(index, value, component.max);
    return [{ index, value, ...coordinates }];
  });
  const isVckEvaluation = metric === "voc" || component.key === "app";
  const evaluationLabel = isVckEvaluation ? "VCK 평가" : "글로벌 평가";
  const contributionLabel =
    metric === "voc"
      ? vocContributionLabels[component.key]
      : cxContributionLabels[component.key];
  const isAppealable = metric === "voc" && component.key === "happyCall";
  const seriesRevealId = `metric-${metric}-${component.key}-series-reveal`;

  return (
    <article className="metric-detail-card">
      <header>
        <div>
          <h2>
            <span>{component.label}</span>
            <i aria-hidden="true">/</i>
            <small className="metric-detail-max-inline">
              {component.key === "sent"
                ? `${displayNumber(component.max)}건 기준`
                : `${displayNumber(component.max)}점 만점`}
            </small>
            {contributionLabel ? (
              <>
                <i aria-hidden="true">/</i>
                <small className="metric-detail-weight-inline">{contributionLabel}</small>
              </>
            ) : null}
            <i aria-hidden="true">/</i>
            <em className={isVckEvaluation ? "vck" : "global"}>
              <svg className="metric-detail-evaluation-icon" viewBox="0 0 20 20" aria-hidden="true">
                {isVckEvaluation ? (
                  <>
                    <path d="M10 2.5 16 5v4.4c0 3.8-2.4 6.5-6 8.1-3.6-1.6-6-4.3-6-8.1V5l6-2.5Z" />
                    <path d="m7.2 10 1.8 1.8 3.9-4" />
                  </>
                ) : (
                  <>
                    <circle cx="10" cy="10" r="7.2" />
                    <path d="M2.8 10h14.4M10 2.8c2.1 2 3.2 4.4 3.2 7.2S12.1 15.2 10 17.2C7.9 15.2 6.8 12.8 6.8 10S7.9 4.8 10 2.8Z" />
                  </>
                )}
              </svg>
              {evaluationLabel}
            </em>
            {isAppealable ? (
              <>
                <i aria-hidden="true">/</i>
                <em className="appealable">
                  <svg className="metric-detail-appeal-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M5 2.8h7l3 3V17H5V2.8Z" />
                    <path d="M12 2.8V6h3M7.5 10.3l1.6 1.6 3.5-3.6" />
                  </svg>
                  소명가능
                </em>
              </>
            ) : null}
          </h2>
        </div>
        <div className="metric-detail-chart-legend" aria-hidden="true">
          <span className="showroom">{showroomName} 점수</span>
        </div>
      </header>

      <div className="metric-detail-chart-scroll">
        <svg
          className="metric-detail-chart"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${component.label} W1부터 W52까지 ${showroomName} 점수 추이`}
        >
          <defs>
            <clipPath id={seriesRevealId}>
              <rect
                className="metric-detail-series-reveal"
                x="0"
                y="0"
                width={chart.width}
                height={chart.height}
              />
            </clipPath>
          </defs>
          {[0, 0.5, 1].map((ratio) => {
            const y = chart.top + ratio * (chart.height - chart.top - chart.bottom);
            const value = component.max * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  className="metric-detail-grid-line"
                  x1={chart.left}
                  x2={chart.width - chart.right}
                  y1={y}
                  y2={y}
                />
                <text className="metric-detail-axis-value" x={chart.left - 7} y={y + 3}>
                  {displayNumber(value)}
                </text>
              </g>
            );
          })}
          {axisBoundaries.map((boundaryIndex) => {
            const x = weekBoundaryX(boundaryIndex);
            const isMajor = majorAxisBoundaries.has(boundaryIndex);
            return (
              <line
                className={`metric-detail-week-guide${isMajor ? " major" : ""}`}
                x1={x}
                x2={x}
                y1={chart.top}
                y2={chart.height - chart.bottom}
                key={`boundary-${boundaryIndex}`}
              />
            );
          })}
          {axisWeeks.map((week) => {
            const x = point(week - 1, 0, component.max).x;
            return (
              <g key={week}>
                <line
                  className="metric-detail-week-tick"
                  x1={x}
                  x2={x}
                  y1={chart.height - chart.bottom}
                  y2={chart.height - chart.bottom + 4}
                />
                <text className="metric-detail-week-label" x={x} y={chart.height - 21}>
                  W{week}
                </text>
              </g>
            );
          })}
          {quarterRanges.map((quarter) => {
            const boundaryStartX = weekBoundaryX(quarter.start - 1);
            const boundaryEndX = weekBoundaryX(quarter.end);
            const centerX = (boundaryStartX + boundaryEndX) / 2;
            const quarterLineY = chart.height - 15;
            return (
              <g className="metric-detail-quarter-band" key={quarter.label} aria-hidden="true">
                <line
                  className="metric-detail-quarter-rule"
                  x1={boundaryStartX}
                  x2={boundaryEndX}
                  y1={quarterLineY}
                  y2={quarterLineY}
                />
                <text
                  className="metric-detail-quarter-label"
                  x={centerX}
                  y={chart.height - 3}
                  textAnchor="middle"
                >
                  <tspan>{quarter.label}</tspan>
                  <tspan className="metric-detail-quarter-range" dx="5">
                    {quarter.range}
                  </tspan>
                </text>
              </g>
            );
          })}
          {quarterBoundaryIndexes.map((boundaryIndex) => {
            const x = weekBoundaryX(boundaryIndex);
            return (
              <line
                className="metric-detail-quarter-boundary"
                x1={x}
                x2={x}
                y1={chart.height - chart.bottom}
                y2={chart.height - 1}
                key={`quarter-boundary-${boundaryIndex}`}
                aria-hidden="true"
              />
            );
          })}
          <g className="metric-detail-data-series" clipPath={`url(#${seriesRevealId})`}>
            {lineSegments(showroomValues, component.max).map((path, index) => (
              <path className="metric-detail-showroom-line" d={path} key={`showroom-${index}`} />
            ))}
            {scorePoints.map(({ index, x, y }) => (
              <g className="metric-detail-score-point" key={`point-${index}`}>
                <circle cx={x} cy={y} r="2.1" />
              </g>
            ))}
            {latestPoint ? (
              <circle
                className="metric-detail-latest-point"
                cx={latestPoint.x}
                cy={latestPoint.y}
                r="4.5"
              />
            ) : null}
          </g>
          {scorePoints.map(({ index, value, x, y }) => {
            const showLabel =
              component.cadence === "weekly" || (index + 1) % 13 === 0;
            const isFullScore = value === 100;
            const isCompletedFullScore = isFullScore && index === completedWeek - 1;
            const labelY = isFullScore ? y - 6 : y <= chart.top + 12 ? y + 12 : y - 6;
            const labelX = isCompletedFullScore ? x - 6 : x;
            const labelAnchor = isCompletedFullScore
              ? "end"
              : index === 0
                ? "start"
                : index === 51
                  ? "end"
                  : "middle";
            return showLabel ? (
              <text
                className="metric-detail-score-label"
                x={labelX}
                y={labelY}
                textAnchor={labelAnchor}
                key={`score-label-${index}`}
              >
                {displayNumber(value)}
              </text>
            ) : null;
          })}
        </svg>
      </div>

    </article>
  );
}

export default function MetricDetails({
  cdsid,
  metric,
}: {
  cdsid: string;
  metric: DetailMetric;
}) {
  const showroom = dashboardJson.showrooms.find((item) => item.cdsid === cdsid);
  const showroomName = showroom?.showroom.replace(/^볼보\s*/, "") ?? cdsid;
  const group = detailData[metric];
  const updateWeek = Math.max(1, Math.min(52, group.components[0]?.latestWeek ?? 1));
  const updateGuideX = (point(updateWeek - 1, 0, 100).x / chart.width) * 100;

  return (
    <main className="metric-detail-page">
      <div className="metric-detail-sticky-shell">
      <header className="dashboard-identity-header identity-strip metric-detail-page-header">
        <div className="identity-title metric-detail-header-primary">
          <h1>{showroom?.showroom ?? cdsid} 세부지표</h1>
          <div className="header-status-row metric-detail-header-subline">
            <Link className="header-status-item" href={`/dashboard/${cdsid}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
              </svg>
              대시보드
            </Link>
          </div>
        </div>
        <div className="identity-detail-rail metric-detail-header-context" aria-label="현재 세부지표 정보">
          <dl>
            <div className="identity-analysis-entry">
              <span className="identity-icon metric-detail-context-icon-box metric" aria-hidden="true">
                <svg className="metric-detail-context-icon" viewBox="0 0 20 20">
                  <path d="M3 16.5h14M4.5 15V11m3.7 4V7m3.7 8V9m3.6 6V4" />
                </svg>
              </span>
              <dt>지표</dt><dd>{group.label}</dd>
            </div>
            <div className="identity-analysis-entry">
              <span className="identity-icon metric-detail-context-icon-box showroom" aria-hidden="true">
                <svg className="metric-detail-context-icon" viewBox="0 0 20 20">
                  <path d="M4 17V5h12v12M7 8h2m2 0h2m-6 3h2m2 0h2M8 17v-3h4v3M3 17h14" />
                </svg>
              </span>
              <dt>전시장</dt><dd>{showroomName}</dd>
            </div>
            <div className="identity-analysis-entry">
              <span className="identity-icon metric-detail-context-icon-box week" aria-hidden="true">
                <svg className="metric-detail-context-icon" viewBox="0 0 20 20">
                  <path d="M4 6h12v11H4zM7 3v5m6-5v5M4 10h12m-9 3h1m3 0h1" />
                </svg>
              </span>
              <dt>주차</dt><dd>W1–W52</dd>
            </div>
          </dl>
          <time className="identity-profile identity-profile--static" dateTime={detailData.meta.syncedAt}>
            <span className="identity-icon metric-detail-context-icon-box update" aria-hidden="true">
              <svg className="metric-detail-context-icon" viewBox="0 0 20 20">
                <path d="M16 6V3m0 3h-3M15.7 6A6.5 6.5 0 1 0 16 13M10 6.5V10l2.7 1.8" />
              </svg>
            </span>
            <span className="identity-profile-role">업데이트</span>
            <strong>{formatSyncDate(detailData.meta.syncedAt)}</strong>
          </time>
        </div>
      </header>

      <nav className="metric-detail-tabs" aria-label="세부지표 종류">
        <Link className={metric === "voc" ? "active" : ""} href={`/dashboard/${cdsid}/details/voc`}>
          VOC <small>4개 메인지표 / 총점 100점 + 1개 참고지표</small>
        </Link>
        <Link className={metric === "cx" ? "active" : ""} href={`/dashboard/${cdsid}/details/cx`}>
          CX Index <small>5개 메인지표 / 총점 320점</small>
        </Link>
      </nav>
      </div>

      <section
        className={`metric-detail-list metric-detail-list--${metric}`}
        aria-label={`${group.label} 주간 세부지표`}
      >
        <div
          className="metric-detail-update-guide-layer"
          role="note"
          aria-label={`현재 업데이트 기준 W${updateWeek}`}
        >
          <div
            className="metric-detail-update-guide"
            style={{ left: `${updateGuideX}%` }}
          >
            <span>업데이트</span>
          </div>
        </div>
        {group.components.map((component) => (
          <MetricDetailChart
            component={component}
            cdsid={cdsid}
            metric={metric}
            showroomName={showroomName}
            updateWeek={updateWeek}
            key={component.key}
          />
        ))}
      </section>
    </main>
  );
}
