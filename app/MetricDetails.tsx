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
  width: 960,
  height: 148,
  left: 38,
  right: 12,
  top: 12,
  bottom: 26,
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
  showroomName,
  weekRanges,
}: {
  component: DetailComponent;
  cdsid: string;
  showroomName: string;
  weekRanges: WeekRange[];
}) {
  const showroomValues = component.byCdsid[cdsid] ?? Array(52).fill(null);
  const latestIndex = lastValueIndex(showroomValues, component.latestWeek);
  const nationalLatestIndex = lastValueIndex(component.average, component.latestWeek);
  const latestWeek = Math.max(latestIndex, nationalLatestIndex) + 1;
  const latestShowroom = latestIndex >= 0 ? showroomValues[latestIndex] : null;
  const latestNational =
    nationalLatestIndex >= 0 ? component.average[nationalLatestIndex] : null;
  const latestPoint =
    latestIndex >= 0 && typeof latestShowroom === "number"
      ? point(latestIndex, latestShowroom, component.max)
      : null;
  const axisWeeks = [1, 13, 26, 39, 52];
  const latestPeriodLabel =
    component.cadence === "quarterly"
      ? `Q${Math.max(1, Math.ceil(latestWeek / 13))}`
      : `W${String(latestWeek || 0).padStart(2, "0")}`;

  return (
    <article className="metric-detail-card">
      <header>
        <div>
          <span>{component.cadence === "quarterly" ? "QUARTERLY" : "WEEKLY"}</span>
          <h2>{component.label}</h2>
          <small>
            {component.weight} 반영
            {component.cadence === "quarterly" ? " · 분기값을 해당 주차 구간에 표시" : ""}
          </small>
        </div>
        <div className="metric-detail-current">
          <span>{latestPeriodLabel} 최신값</span>
          <strong>
            {displayNumber(latestShowroom)}<small>{component.unit}</small>
          </strong>
          <em>전국 {displayNumber(latestNational)}{component.unit}</em>
        </div>
      </header>

      <div className="metric-detail-chart-legend" aria-hidden="true">
        <span className="showroom">{showroomName}</span>
        <span className="national">전국</span>
      </div>

      <div className="metric-detail-chart-scroll">
        <svg
          className="metric-detail-chart"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-label={`${component.label} W01부터 W52까지 ${showroomName} 및 전국 추이`}
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
            return (
              <g key={week}>
                <line
                  className="metric-detail-week-guide"
                  x1={x}
                  x2={x}
                  y1={chart.top}
                  y2={chart.height - chart.bottom}
                />
                <text className="metric-detail-week-label" x={x} y={chart.height - 8}>
                  W{String(week).padStart(2, "0")}
                </text>
              </g>
            );
          })}
          {lineSegments(component.average, component.max).map((path, index) => (
            <path className="metric-detail-national-line" d={path} key={`national-${index}`} />
          ))}
          {lineSegments(showroomValues, component.max).map((path, index) => (
            <path className="metric-detail-showroom-line" d={path} key={`showroom-${index}`} />
          ))}
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

      <details className="metric-detail-values">
        <summary>W01~W52 원본값 보기</summary>
        <div className="metric-detail-value-grid">
          {weekRanges.map((range, index) => (
            <div className={index + 1 > component.latestWeek ? "pending" : ""} key={range.week}>
              <b>W{String(range.week).padStart(2, "0")}</b>
              <small>{range.start}~{range.end}</small>
              <span>{showroomName} <strong>{displayNumber(showroomValues[index])}</strong></span>
              <em>전국 {displayNumber(component.average[index])}</em>
            </div>
          ))}
        </div>
      </details>
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
      <header className="metric-detail-page-header">
        <div>
          <Link href={`/dashboard/${cdsid}`}>
            <span aria-hidden="true">←</span>
            현황으로
          </Link>
          <span>{showroom?.showroom ?? cdsid}</span>
        </div>
        <div>
          <small>GOOGLE SHEET WEEKLY DETAIL</small>
          <h1>{group.label} 세부지표</h1>
          <p>원본 구글시트에서 동기화한 W01~W52 전시장값과 전국값입니다.</p>
        </div>
        <time dateTime={detailData.meta.syncedAt}>
          {formatSyncDate(detailData.meta.syncedAt)} 기준
        </time>
      </header>

      <nav className="metric-detail-tabs" aria-label="세부지표 종류">
        <Link className={metric === "voc" ? "active" : ""} href={`/dashboard/${cdsid}/details/voc`}>
          VOC <small>4개 지표</small>
        </Link>
        <Link className={metric === "cx" ? "active" : ""} href={`/dashboard/${cdsid}/details/cx`}>
          CX Index <small>5개 지표</small>
        </Link>
      </nav>

      <section className="metric-detail-list" aria-label={`${group.label} 주간 세부지표`}>
        {group.components.map((component) => (
          <MetricDetailChart
            component={component}
            cdsid={cdsid}
            showroomName={showroomName}
            weekRanges={detailData.meta.weekRanges}
            key={component.key}
          />
        ))}
      </section>
    </main>
  );
}
