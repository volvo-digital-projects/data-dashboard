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
  height: 88,
  left: 52,
  right: 28,
  top: 12,
  bottom: 22,
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
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const x = chart.left + (index / 51) * plotWidth;
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
}: {
  component: DetailComponent;
  cdsid: string;
  metric: DetailMetric;
  showroomName: string;
}) {
  const showroomValues = component.byCdsid[cdsid] ?? Array(52).fill(null);
  const latestIndex = lastValueIndex(showroomValues, component.latestWeek);
  const latestShowroom = latestIndex >= 0 ? showroomValues[latestIndex] : null;
  const latestPoint =
    latestIndex >= 0 && typeof latestShowroom === "number"
      ? point(latestIndex, latestShowroom, component.max)
      : null;
  const axisWeeks = Array.from({ length: 52 }, (_, index) => index + 1);
  const majorAxisWeeks = new Set([1, 13, 26, 39, 52]);
  const scorePoints = showroomValues.slice(0, 52).flatMap((value, index) => {
    if (typeof value !== "number") return [];
    const coordinates = point(index, value, component.max);
    return [{ index, value, ...coordinates }];
  });
  const isVckEvaluation = metric === "voc" || component.key === "app";
  const evaluationLabel = isVckEvaluation ? "VCK 평가" : "글로벌 평가";
  const sourceLabel =
    metric === "cx" ? (component.key === "app" ? "Sales-DMS" : "ONE Voice") : null;

  return (
    <article className="metric-detail-card">
      <header>
        <div>
          <h2>
            <span>{component.label}</span>
            <i aria-hidden="true">/</i>
            <small className="metric-detail-max-inline">
              {displayNumber(component.max)}점 만점
            </small>
            {sourceLabel ? (
              <>
                <i aria-hidden="true">/</i>
                <b>{sourceLabel}</b>
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
          {axisWeeks.map((week) => {
            const x = point(week - 1, 0, component.max).x;
            const isMajor = majorAxisWeeks.has(week);
            return (
              <g key={week}>
                <line
                  className={`metric-detail-week-guide${isMajor ? " major" : ""}`}
                  x1={x}
                  x2={x}
                  y1={chart.top}
                  y2={chart.height - chart.bottom}
                />
                <line
                  className="metric-detail-week-tick"
                  x1={x}
                  x2={x}
                  y1={chart.height - chart.bottom}
                  y2={chart.height - chart.bottom + 4}
                />
                <text className="metric-detail-week-label" x={x} y={chart.height - 5}>
                  W{week}
                </text>
              </g>
            );
          })}
          {lineSegments(showroomValues, component.max).map((path, index) => (
            <path className="metric-detail-showroom-line" d={path} key={`showroom-${index}`} />
          ))}
          {scorePoints.map(({ index, value, x, y }) => {
            const showLabel =
              component.cadence === "weekly" || (index + 1) % 13 === 0;
            const labelY = y <= chart.top + 12 ? y + 12 : y - 6;
            return (
              <g className="metric-detail-score-point" key={`score-${index}`}>
                <circle cx={x} cy={y} r="2.1" />
                {showLabel ? (
                  <text
                    className="metric-detail-score-label"
                    x={x}
                    y={labelY}
                    textAnchor={index === 0 ? "start" : index === 51 ? "end" : "middle"}
                  >
                    {displayNumber(value)}
                  </text>
                ) : null}
              </g>
            );
          })}
          {latestPoint ? (
            <circle
              className="metric-detail-latest-point"
              cx={latestPoint.x}
              cy={latestPoint.y}
              r="4.5"
            />
          ) : null}
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
              <span className="identity-icon identity-icon--dealer" aria-hidden="true" />
              <dt>지표</dt><dd>{group.label}</dd>
            </div>
            <div className="identity-analysis-entry">
              <span className="identity-icon identity-icon--region" aria-hidden="true" />
              <dt>전시장</dt><dd>{showroomName}</dd>
            </div>
            <div className="identity-analysis-entry">
              <span className="identity-icon identity-icon--size" aria-hidden="true" />
              <dt>주차</dt><dd>W1–W52</dd>
            </div>
          </dl>
          <time className="identity-profile identity-profile--static" dateTime={detailData.meta.syncedAt}>
            <span className="identity-profile-icon" aria-hidden="true" />
            <span className="identity-profile-role">업데이트</span>
            <strong>{formatSyncDate(detailData.meta.syncedAt)}</strong>
          </time>
        </div>
      </header>

      <nav className="metric-detail-tabs" aria-label="세부지표 종류">
        <Link className={metric === "voc" ? "active" : ""} href={`/dashboard/${cdsid}/details/voc`}>
          VOC <small>4개 지표</small>
        </Link>
        <Link className={metric === "cx" ? "active" : ""} href={`/dashboard/${cdsid}/details/cx`}>
          CX Index <small>5개 지표</small>
        </Link>
      </nav>
      </div>

      <section
        className={`metric-detail-list metric-detail-list--${metric}`}
        aria-label={`${group.label} 주간 세부지표`}
      >
        {group.components.map((component) => (
          <MetricDetailChart
            component={component}
            cdsid={cdsid}
            metric={metric}
            showroomName={showroomName}
            key={component.key}
          />
        ))}
      </section>
    </main>
  );
}
