import v3sHistoryJson from "./data/v3s-history.json";
import weeklyJson from "./data/weekly.json";

export type ShowroomInsightKey = "v3s" | "voc" | "cx";

export type ShowroomInsight = {
  key: ShowroomInsightKey;
  label: string;
  message: string;
};

type Score = number | null;

type QuarterInsightRecord = {
  v3s: Score;
  voc: Score;
  cx: Score;
};

type ShowroomInsightRecord = {
  cdsid: string;
  v3s: Score;
  voc: Score;
  cx: Score;
  delivery: Score;
  testDrive: Score;
  app: Score;
  happyCall: Score;
  q1?: QuarterInsightRecord | null;
};

type ShowroomInsightAverages = {
  v3s: Score;
  voc: Score;
  cx: Score;
  delivery: Score;
  testDrive: Score;
  app: Score;
  happyCall: Score;
};

type HistoricalV3sPoint = {
  year: number;
  value: Score;
  average?: Score;
};

type WeeklyMetric = {
  average: Score[];
  byCdsid: Record<string, Score[]>;
};

type WeeklyData = {
  meta: {
    vocLatestWeek: number;
    cxLatestWeek: number;
  };
  voc: WeeklyMetric;
  cx: WeeklyMetric;
};

type ObservedWeek = {
  week: number;
  value: number;
};

type CxComponent = {
  label: string;
  value: number;
  average: number;
  action: string;
};

const v3sHistory = v3sHistoryJson as Record<string, HistoricalV3sPoint[]>;
const weekly = weeklyJson as WeeklyData;

const isScore = (value: Score | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const formatScore = (value: number) =>
  Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);

const formatDelta = (value: number) =>
  `${value >= 0 ? "▲" : "▼"}${formatScore(Math.abs(value))}`;

const averageOf = (values: number[]) =>
  values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;

const observedWeeks = (
  series: Score[] | undefined,
  startWeek: number,
  endWeek: number,
): ObservedWeek[] =>
  (series ?? [])
    .slice(Math.max(0, startWeek - 1), endWeek)
    .map((value, index) => ({ week: startWeek + index, value }))
    .filter(
      (item): item is ObservedWeek =>
        typeof item.value === "number" && Number.isFinite(item.value),
    );

const buildV3sInsight = (
  showroom: ShowroomInsightRecord,
  averages: ShowroomInsightAverages,
) => {
  if (!isScore(showroom.v3s)) {
    return "Q2 V3S 점수가 아직 집계되지 않았습니다—평가 완료 후 분기 변화와 전국 격차를 다시 확인하세요.";
  }

  const current = showroom.v3s;
  const q1 = isScore(showroom.q1?.v3s) ? showroom.q1.v3s : null;
  const nationalDelta = isScore(averages.v3s)
    ? current - averages.v3s
    : null;
  const quarterDelta = q1 === null ? null : current - q1;
  const history = (v3sHistory[showroom.cdsid] ?? []).filter(
    (point): point is HistoricalV3sPoint & { value: number } =>
      isScore(point.value),
  );
  const latestHistory = history.at(-1);
  const peakHistory = history.reduce<
    (HistoricalV3sPoint & { value: number }) | null
  >(
    (peak, point) => (!peak || point.value > peak.value ? point : peak),
    null,
  );

  const historyText =
    peakHistory &&
    latestHistory &&
    peakHistory.year !== latestHistory.year &&
    peakHistory.value - latestHistory.value >= 1
      ? `${peakHistory.year}년 ${formatScore(peakHistory.value)}→${latestHistory.year}년 ${formatScore(latestHistory.value)}`
      : history.length >= 2
        ? `${history[0].year}년 ${formatScore(history[0].value)}→${latestHistory?.year}년 ${formatScore(latestHistory?.value ?? current)}`
        : "5개년 이력 제한";
  const quarterText =
    q1 === null
      ? `Q2 ${formatScore(current)}점`
      : `Q1 ${formatScore(q1)}→Q2 ${formatScore(current)}점`;
  const nationalText =
    nationalDelta === null ? "" : `·전국 ${formatDelta(nationalDelta)}`;

  let action = "유지 항목과 감점 문항을 나눠 다음 분기 변동을 관리하세요.";
  if (
    (quarterDelta !== null && quarterDelta <= -3) ||
    (nationalDelta !== null && nationalDelta <= -5)
  ) {
    action = "감점 문항을 영업 단계별로 분해해 주 1회 롤플레이 코칭하세요.";
  } else if (
    quarterDelta !== null &&
    quarterDelta >= 3 &&
    (nationalDelta ?? 0) >= 0
  ) {
    action = "개선 요인을 표준 스크립트로 고정해 우수 사례를 팀에 확산하세요.";
  } else if (nationalDelta !== null && nationalDelta < 0) {
    action = "평균 미달 문항을 우선 선정해 주간 코칭과 재평가를 연결하세요.";
  }

  return `${historyText}, ${quarterText}(${nationalText.replace("·", "")})—${action}`;
};

const buildVocInsight = (
  showroom: ShowroomInsightRecord,
  averages: ShowroomInsightAverages,
) => {
  if (!isScore(showroom.voc)) {
    return "Q2 VOC 점수가 아직 집계되지 않았습니다—유효 관측과 고객 회신 데이터부터 확보하세요.";
  }

  const current = showroom.voc;
  const q1 = isScore(showroom.q1?.voc) ? showroom.q1.voc : null;
  const nationalDelta = isScore(averages.voc)
    ? current - averages.voc
    : null;
  const latestWeek = Math.min(26, weekly.meta.vocLatestWeek);
  const expectedWeeks = Math.max(0, latestWeek - 13);
  const q2Weeks = observedWeeks(
    weekly.voc.byCdsid[showroom.cdsid],
    14,
    latestWeek,
  );
  const q2Values = q2Weeks.map((item) => item.value);
  const lowestWeek = q2Weeks.reduce<ObservedWeek | null>(
    (lowest, item) => (!lowest || item.value < lowest.value ? item : lowest),
    null,
  );
  const missingWeeks = Math.max(0, expectedWeeks - q2Weeks.length);
  const coverage = expectedWeeks ? q2Weeks.length / expectedWeeks : 0;
  const scoreText =
    q1 === null
      ? `Q2 ${formatScore(current)}점`
      : `Q1 ${formatScore(q1)}→Q2 ${formatScore(current)}점`;
  const nationalText =
    nationalDelta === null ? "" : `(전국 ${formatDelta(nationalDelta)})`;
  const observationText = expectedWeeks
    ? `Q2 유효 관측 ${q2Weeks.length}/${expectedWeeks}주`
    : "Q2 주간 관측 미집계";
  const lowText = lowestWeek
    ? `·최저 W${lowestWeek.week} ${formatScore(lowestWeek.value)}점`
    : "";
  const range = q2Values.length
    ? Math.max(...q2Values) - Math.min(...q2Values)
    : 0;

  let action = "우수 회신 사례를 표준화해 현재 수준을 유지하세요.";
  if (coverage < 0.65) {
    action = `미관측 ${missingWeeks}주의 수집·회신 경로를 보완해 점수 대표성을 높이세요.`;
  } else if (
    (nationalDelta !== null && nationalDelta < 0) ||
    (q1 !== null && current - q1 <= -2)
  ) {
    action = "저점 주차의 VOC 원문과 후속조치 완료율을 함께 관리하세요.";
  } else if (range >= 8) {
    action = "저점 주차 원인과 담당별 편차를 복기해 변동폭을 줄이세요.";
  }

  return `${scoreText}${nationalText}, ${observationText}${lowText}—${action}`;
};

const buildCxInsight = (
  showroom: ShowroomInsightRecord,
  averages: ShowroomInsightAverages,
) => {
  if (!isScore(showroom.cx)) {
    return "Q2 CX Index가 아직 집계되지 않았습니다—고객 여정별 세부 항목부터 점검하세요.";
  }

  const current = showroom.cx;
  const q1 = isScore(showroom.q1?.cx) ? showroom.q1.cx : null;
  const nationalDelta = isScore(averages.cx)
    ? current - averages.cx
    : null;
  const components = [
    {
      label: "출고",
      value: showroom.delivery,
      average: averages.delivery,
      action: "인도 설명과 출고 체크리스트 이행률을 점검하세요.",
    },
    {
      label: "시승",
      value: showroom.testDrive,
      average: averages.testDrive,
      action: "니즈 기반 시승 제안과 24시간 내 후속 연락을 표준화하세요.",
    },
    {
      label: "앱",
      value: showroom.app,
      average: averages.app,
      action: "출고 전 앱 설치·로그인 완료 확인을 체크리스트에 넣으세요.",
    },
    {
      label: "해피콜",
      value: showroom.happyCall,
      average: averages.happyCall,
      action: "해피콜 이행과 이슈 종결 여부를 담당자별로 관리하세요.",
    },
  ].filter(
    (item): item is CxComponent =>
      isScore(item.value) && isScore(item.average),
  );
  const orderedComponents = [...components].sort(
    (a, b) => a.value - a.average - (b.value - b.average),
  );
  const weakest = orderedComponents[0];
  const strongest = orderedComponents.at(-1);

  const latestWeek = weekly.meta.cxLatestWeek;
  const series = weekly.cx.byCdsid[showroom.cdsid];
  const recentWeeks = observedWeeks(
    series,
    Math.max(1, latestWeek - 3),
    latestWeek,
  );
  const priorWeeks = observedWeeks(
    series,
    Math.max(1, latestWeek - 7),
    Math.max(1, latestWeek - 4),
  );
  const recentAverage = averageOf(recentWeeks.map((item) => item.value));
  const priorAverage = averageOf(priorWeeks.map((item) => item.value));
  const recentDelta =
    recentAverage !== null && priorAverage !== null
      ? recentAverage - priorAverage
      : null;
  const scoreText =
    q1 === null
      ? `Q2 ${formatScore(current)}점`
      : `Q1 ${formatScore(q1)}→Q2 ${formatScore(current)}점`;
  const nationalText =
    nationalDelta === null ? "" : `(전국 ${formatDelta(nationalDelta)})`;
  const strengthText = strongest
    ? `강점 ${strongest.label} ${formatScore(strongest.value)}점`
    : "강점 항목 미집계";
  const weakText = weakest
    ? `병목 ${weakest.label} ${formatScore(weakest.value)}점(평균 ${formatDelta(weakest.value - weakest.average)})`
    : "병목 항목 미집계";
  const recentText =
    recentAverage !== null && recentDelta !== null
      ? `·최근 4주 ${formatScore(recentAverage)}점(직전 ${formatDelta(recentDelta)})`
      : "";

  return `${scoreText}${nationalText}, ${strengthText}·${weakText}${recentText}—${weakest?.action ?? "고객 여정별 실행 편차를 점검하세요."}`;
};

export const buildShowroomInsights = (
  showroom: ShowroomInsightRecord,
  averages: ShowroomInsightAverages,
): ShowroomInsight[] => [
  {
    key: "v3s",
    label: "V3S",
    message: buildV3sInsight(showroom, averages),
  },
  {
    key: "voc",
    label: "VOC",
    message: buildVocInsight(showroom, averages),
  },
  {
    key: "cx",
    label: "CX Index",
    message: buildCxInsight(showroom, averages),
  },
];
