"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import dashboardJson from "./data/showrooms.json";
import vocStaffAnalysisJson from "./data/voc-staff-analysis.json";
import salesActivityAnalysisJson from "./data/sales-activity-analysis.json";
import staffProfilePhotosJson from "./data/staff-profile-photos.json";
import staffCertificationsJson from "./data/staff-certifications.json";
import DashboardHeaderLead from "./DashboardHeaderLead";
import { forcePageScrollToTop } from "./pageScroll";

type AnalysisView = "dealer" | "showroom" | "region" | "size";

type AnalysisShowroom = {
  cdsid: string;
  showroom: string;
  dealer: string;
  manager: string;
  size: string;
  region: string;
  v3s: number | null;
  voc: number | null;
  cx: number | null;
  delivery: number | null;
  testDrive: number | null;
  app: number | null;
  happyCall: number | null;
  q1?: {
    v3s: number | null;
    voc?: number | null;
    happyCall?: number | null;
  } | null;
};

type AnalysisPoint = AnalysisShowroom & {
  vocScore: number;
  happyScore: number;
  combined: number;
  vocAverage: number;
  happyAverage: number;
  vocQuarterCount: number;
  happyQuarterCount: number;
  scoreMax: number;
};

type StaffYear = "2023" | "2024" | "2025" | "2026";
type StaffYearMetric = { responses: number; scoreSum: number; sent?: number };
type StaffKeyword = { label: string; mentions: number };
type StaffEmployee = {
  name: string;
  gender?: "female" | "male";
  role: "영업직원" | "영업팀장";
  jobTitle: string;
  hireDate: string;
  tenureMonths: number;
  tenureBucket: string;
  tenureBucketLabel: string;
  years: Partial<Record<StaffYear, StaffYearMetric>>;
  latestResponseDate?: string;
  commentResponses: number;
  strengthKeywords: StaffKeyword[];
  improvementKeywords: StaffKeyword[];
};
type StaffNationalYear = StaffYearMetric & {
  average: number | null;
  respondingEmployees: number;
  averageResponsesPerEmployee: number | null;
};
type StaffTenureScatterPoint = {
  key: string;
  cdsid: string;
  name: string;
  tenureYears: number;
  finalScore: number;
  provisional: boolean;
  responses: number;
};
type StaffAnalysisShowroom = {
  showroom: string;
  dealer: string;
  dmsShowroom: string;
  employees: StaffEmployee[];
  excludedRawNames: Array<{ name: string; responses: number; reason: string }>;
};

type StaffProfilePhoto = {
  image: string;
  smileImage?: string;
};

type StaffProfileShowroom = {
  dealer: string;
  showroom: string;
  sourcePage: string;
  employees: Record<string, StaffProfilePhoto>;
};

type StaffCertificationLevel = "Grand" | "Advanced" | "Certified";
type StaffCertificationRecord = {
  year: number;
  rank: number;
  name: string;
  showroom: string;
  level: StaffCertificationLevel;
};

type SalesActivityStaff = {
  name: string;
  activityStatus: "available" | "missing" | "ambiguous-name";
  lastActivityDate: string | null;
  activityEvents: { consultation: number; testDrive: number; contract: number };
  customers: { consultation: number; testDrive: number; contract: number };
  transitions: {
    consultationToTestDrive: number;
    testDriveToContract: number;
    contractToDelivered: number;
  };
  deliveredSales: number;
  deliveredCustomers: number;
  monthlyDeliveredSales: number[];
};

type SalesActivityShowroom = {
  salesDealerCode: string | null;
  salesDealerCodeEvidence: number;
  staff: SalesActivityStaff[];
  summary: {
    staffCount: number;
    activityStaffCount: number;
    consultationCustomers: number;
    testDriveCustomers: number;
    contractCustomers: number;
    deliveredSales: number;
    monthlyDeliveredSales: number[];
  };
};

type StaffSalesScatterPoint = {
  key: string;
  cdsid: string;
  name: string;
  tenureYears: number;
  deliveredSales: number;
};

const staffAnalysisByCdsid = vocStaffAnalysisJson.showrooms as Record<
  string,
  StaffAnalysisShowroom
>;
const staffAnalysisSource = vocStaffAnalysisJson.source;
const staffNationalYears = vocStaffAnalysisJson.nationalYears as Record<
  StaffYear,
  StaffNationalYear
>;
const staffProfilePhotosByCdsid = staffProfilePhotosJson.showrooms as Record<
  string,
  StaffProfileShowroom
>;
const staffFallbackProfileImage = "/staff-profiles/neutral-human-silhouette.png";
const staffFemaleFallbackProfileImage = "/staff-profiles/female-human-silhouette.png";
const staffCertificationRecords =
  staffCertificationsJson.records as StaffCertificationRecord[];
const salesActivityByCdsid = salesActivityAnalysisJson.showrooms as Record<
  string,
  SalesActivityShowroom
>;
const salesActivitySource = salesActivityAnalysisJson.source;
const staffCurrentNameFrequency = Object.values(staffAnalysisByCdsid).reduce(
  (frequency, showroom) => {
    showroom.employees.forEach((employee) => {
      frequency.set(employee.name, (frequency.get(employee.name) ?? 0) + 1);
    });
    return frequency;
  },
  new Map<string, number>(),
);
const staffYears: StaffYear[] = ["2023", "2024", "2025", "2026"];
const staffEvidenceConfidence = (responses: number) =>
  responses >= 20 ? "충분" : responses >= 8 ? "보통" : responses > 0 ? "참고" : "없음";
const staffHistoryChartMinScore = 7;
const staffHistoryChartMaxScore = 10;
const staffHistoryChartHeight = (score: number) =>
  Math.max(
    6,
    Math.min(
      100,
      ((score - staffHistoryChartMinScore) /
        (staffHistoryChartMaxScore - staffHistoryChartMinScore)) *
        100,
    ),
  );
const staffImprovementKeywordLabel: Record<string, string | null> = {
  "진행상황 선제 안내": null,
  "서비스 품목 안내": "보증·정비 안내",
  "제품 강점 설명 확장": "제품 강점 설명",
};
const staffCurrentSalesPopulation = Object.entries(staffAnalysisByCdsid).flatMap(
  ([cdsid, showroom]) =>
    showroom.employees
      .filter(
        (employee) =>
          employee.role === "영업직원" || employee.role === "영업팀장",
      )
      .map((employee) => ({ cdsid, employee })),
);
const nationalStaffSalesPopulation: StaffSalesScatterPoint[] =
  staffCurrentSalesPopulation.flatMap(({ cdsid, employee }) => {
    const sales = salesActivityByCdsid[cdsid]?.staff.find(
      (staff) => staff.name === employee.name,
    );
    return sales
      ? [{
          key: `${cdsid}-${employee.name}`,
          cdsid,
          name: employee.name,
          tenureYears: employee.tenureMonths / 12,
          deliveredSales: sales.deliveredSales,
        }]
      : [];
  });
type ScatterLabelPlacement =
  | "left-up"
  | "left-down"
  | "right-up"
  | "right-down";

type ScatterCalloutLayout = {
  offsetX: number;
  offsetY: number;
  tailX: number;
  tailY: number;
  labelWidth: number;
  labelHeight: number;
  placement: ScatterLabelPlacement;
};

type ScatterLabelBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const showrooms = dashboardJson.showrooms as AnalysisShowroom[];
const analysisDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatAnalysisDate = (date: Date) => {
  const parts = analysisDateFormatter.formatToParts(date);
  const part = (type: "year" | "month" | "day") =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}.${part("month")}.${part("day")}`;
};

const v3sAwardPeriods = [
  { id: "2021-H1", year: "2021", half: "상반기" },
  { id: "2021-H2", year: "2021", half: "하반기" },
  { id: "2022-H1", year: "2022", half: "상반기" },
  { id: "2022-H2", year: "2022", half: "하반기" },
  { id: "2023-H1", year: "2023", half: "상반기" },
  { id: "2023-H2", year: "2023", half: "하반기" },
  { id: "2024-H1", year: "2024", half: "상반기" },
  { id: "2024-H2", year: "2024", half: "하반기" },
  { id: "2025-H1", year: "2025", half: "상반기" },
  { id: "2025-H2", year: "2025", half: "하반기" },
  { id: "2026-H1", year: "2026", half: "상반기" },
  { id: "2026-H2", year: "2026", half: "하반기" },
] as const;

const v3sAwardWinnersByPeriod: Record<string, readonly string[]> = {
  "2021-H1": [],
  "2021-H2": [
    "6KR6834",
    "6KR6830",
    "6KR6858",
    "6KR6841",
    "6KR6863",
    "6KR6859",
  ],
  "2022-H1": ["6KR342", "6KR6851", "6KR6857", "6KR6849"],
  "2022-H2": [
    "6KR6847",
    "6KR6852",
    "6KR6848",
    "6KR6851",
    "6KR6841",
    "6KR6856",
    "6KR6854",
  ],
  "2023-H1": [
    "6KR342",
    "6KR6851",
    "6KR6874",
    "6KR6846",
    "6KR6862",
    "6KR6864",
    "6KR6854",
  ],
  "2023-H2": [
    "6KR6847",
    "6KR6858",
    "6KR6848",
    "6KR6874",
    "6KR6851",
    "6KR6862",
    "6KR6857",
    "6KR6842",
    "6KR6863",
    "6KR6828",
    "6KR6840",
    "6KR6829",
    "6KR6865",
    "6KR6854",
  ],
  "2024-H1": ["6KR6858", "6KR6851", "6KR6841", "6KR6829"],
  "2024-H2": [
    "6KR342",
    "6KR6847",
    "6KR6861",
    "6KR6848",
    "6KR6851",
    "6KR6874",
    "6KR6868",
    "6KR6869",
    "6KR6842",
    "6KR6865",
  ],
  "2025-H1": [
    "6KR342",
    "6KR6872",
    "6KR6851",
    "6KR6868",
    "6KR6867",
    "6KR6838",
    "6KR6874",
  ],
  "2025-H2": [
    "6KR342",
    "6KR6802",
    "6KR6833",
    "6KR6847",
    "6KR6851",
    "6KR6868",
    "6KR6869",
    "6KR6870",
    "6KR6857",
    "6KR6839",
    "6KR6838",
    "6KR6874",
    "6KR6873",
  ],
  "2026-H1": [
    "6KR6851",
    "6KR6854",
    "6KR6848",
    "6KR6865",
    "6KR6869",
    "6KR6867",
    "6KR6871",
  ],
  "2026-H2": [],
};

const viewMeta: Record<
  AnalysisView,
  { label: string; short: string }
> = {
  dealer: {
    label: "소속 딜러사 내 분석",
    short: "소속 딜러사",
  },
  region: {
    label: "동일 권역별 내 분석",
    short: "권역별",
  },
  size: {
    label: "동일 사이즈 내 분석",
    short: "동급 사이즈",
  },
  showroom: {
    label: "전국 전시장 내 분석",
    short: "전시장",
  },
};

const displayNumber = (value: number) =>
  Math.abs(value - 100) < Number.EPSILON ? "100" : value.toFixed(1);

const displayQuarterNumber = (value: number | null | undefined) =>
  typeof value === "number" ? displayNumber(value) : "―";

const displayTwoDigitCount = (value: number) => String(value).padStart(2, "0");

const displayRankingNumber = (value: number) => value.toFixed(1);

function AnimatedAnalysisScore({
  value,
  sequence,
}: {
  value: number;
  sequence: number;
}) {
  const displayValue = displayNumber(value);

  return (
    <strong
      key={displayValue}
      className="animated-score"
      aria-label={`${displayValue}점`}
      style={
        {
          "--score-value-delay": `${120 + sequence * 180}ms`,
        } as CSSProperties
      }
    >
      {displayValue}
      <small>점</small>
    </strong>
  );
}

const formatStaffShortDate = (value: string) => value.replaceAll("-", "").slice(2);

const compareStaffHireDateAscending = (a: StaffEmployee, b: StaffEmployee) => {
  if (!a.hireDate && !b.hireDate) return a.name.localeCompare(b.name, "ko");
  if (!a.hireDate) return 1;
  if (!b.hireDate) return -1;
  return (
    a.hireDate.localeCompare(b.hireDate) ||
    a.name.localeCompare(b.name, "ko")
  );
};

const formatStaffTenureDuration = (months: number) => {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years && remainingMonths) return `${years}년 ${remainingMonths}개월`;
  if (years) return `${years}년`;
  return `${remainingMonths}개월`;
};

const staffTenureHalfYearRange = (completedMonths: number) => {
  const start = Math.floor(Math.max(0, completedMonths) / 6) * 6 + 1;
  return { start, end: start + 5 };
};

const nationalStaffFinalScores = staffCurrentSalesPopulation
  .map(({ cdsid, employee }) => {
    const totals = staffYears.reduce(
      (summary, year) => {
        const metrics = employee.years[year];
        summary.responses += metrics?.responses ?? 0;
        summary.scoreSum += metrics?.scoreSum ?? 0;
        return summary;
      },
      { responses: 0, scoreSum: 0 },
    );
    const average = totals.responses ? totals.scoreSum / totals.responses : null;
    const tenureKey = staffTenureHalfYearRange(employee.tenureMonths).start;
    const satisfactionScore = average === null ? null : average * 10;
    return {
      cdsid,
      name: employee.name,
      tenureKey,
      tenureYears: employee.tenureMonths / 12,
      responses: totals.responses,
      referenceScore: satisfactionScore,
      finalScore: satisfactionScore,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "ko"));
const nationalStaffRespondingCount = nationalStaffFinalScores.filter(
  (staff) => staff.responses > 0,
).length;

// Every actual response is retained. Evidence volume changes confidence, never the score.
// No-response staff have no score and belong in a separate, non-numeric lane.
const staffTenureScatterPopulation: StaffTenureScatterPoint[] = nationalStaffFinalScores.flatMap(
  (staff) => staff.referenceScore === null ? [] : [{
    key: `${staff.cdsid}-${staff.name}`,
    cdsid: staff.cdsid,
    name: staff.name,
    tenureYears: staff.tenureYears,
    finalScore: staff.finalScore ?? staff.referenceScore,
    provisional: false,
    responses: staff.responses,
  }],
);
const staffScatterConfirmed = staffTenureScatterPopulation.filter((staff) => !staff.provisional);
const staffScatterNoResponses = nationalStaffFinalScores.filter((staff) => staff.responses === 0);
const staffScatterNationalAverage = staffScatterConfirmed.length
  ? staffScatterConfirmed.reduce((sum, staff) => sum + staff.finalScore, 0) /
    staffScatterConfirmed.length
  : null;

const staffDeltaPercent = (value: number | null, benchmark: number | null) =>
  value === null || benchmark === null || benchmark === 0
    ? null
    : ((value - benchmark) / benchmark) * 100;

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

const displayShowroomNameWithoutBrand = (name: string) =>
  displayShowroomName(name).replace(/^볼보\s*/, "");

const displayDealerRankName = (name: string) => {
  const compactName = name.replace(/\s+/g, "");
  if (compactName === "아주" || compactName.includes("아주오토리움")) return "아주";
  if (compactName === "코오롱" || compactName.includes("코오롱오토모티브")) return "코오롱";
  return name.trim();
};

const normalizeStaffCertificationShowroom = (name: string) => {
  const compact = name
    .replace(/^볼보\s*/, "")
    .replace(/전시장/g, "")
    .replace(/\s+/g, "");
  const aliases: Record<string, string> = {
    강남대치: "대치",
    강남신사: "신사",
    분당: "분당서현",
  };
  return aliases[compact] ?? compact;
};

const averageOf = (
  items: AnalysisPoint[],
  key: "vocScore" | "happyScore" | "combined" | "vocAverage" | "happyAverage",
) =>
  items.length
    ? items.reduce((sum, item) => sum + item[key], 0) / items.length
    : 0;

const cumulativeAnalysisPoint = (item: AnalysisShowroom): AnalysisPoint => {
  const vocQuarterScores = [item.q1?.voc, item.voc].filter(
    (score): score is number => typeof score === "number",
  );
  const happyQuarterScores = [item.q1?.happyCall, item.happyCall].filter(
    (score): score is number => typeof score === "number",
  );
  // Average the available quarters for each 100-point metric, then add the two.
  const vocScore = vocQuarterScores.length
    ? vocQuarterScores.reduce((sum, score) => sum + score, 0) / vocQuarterScores.length
    : 0;
  const happyScore = happyQuarterScores.length
    ? happyQuarterScores.reduce((sum, score) => sum + score, 0) / happyQuarterScores.length
    : 0;
  return {
    ...item,
    vocScore,
    happyScore,
    combined: vocScore + happyScore,
    vocAverage: vocScore,
    happyAverage: happyScore,
    vocQuarterCount: vocQuarterScores.length,
    happyQuarterCount: happyQuarterScores.length,
    scoreMax: 200,
  };
};

const nationalCumulativeAnalysisPoints = showrooms
  .filter(
    (item) =>
      typeof item.voc === "number" && typeof item.happyCall === "number",
  )
  .map(cumulativeAnalysisPoint)
  .sort(
    (a, b) =>
      b.combined - a.combined ||
      b.vocScore - a.vocScore ||
      a.showroom.localeCompare(b.showroom, "ko"),
  );

const clamp = (value: number) => Math.max(0, Math.min(100, value));

const scatterLabelPlacement = (
  x: number,
  y: number,
  index: number,
  isSelected: boolean,
): ScatterLabelPlacement => {
  if (isSelected) return x >= 72 ? "left-up" : "right-up";
  if (y >= 92) return x >= 60 ? "left-down" : "right-down";
  if (y <= 12) return x >= 60 ? "left-up" : "right-up";
  if (x >= 88) return index % 2 === 0 ? "left-up" : "left-down";
  if (x <= 12) return index % 2 === 0 ? "right-up" : "right-down";

  return (["right-up", "left-down", "right-down", "left-up"] as const)[
    index % 4
  ];
};

const scatterPointPosition = (
  item: AnalysisPoint,
  width: number,
  height: number,
) => {
  const x = clamp(((item.happyAverage - 65) / 35) * 100);
  const y = clamp(((item.vocAverage - 75) / 25) * 100);
  return {
    x: (x / 100) * width,
    y: ((100 - y) / 100) * height,
  };
};

const overlapArea = (first: ScatterLabelBox, second: ScatterLabelBox) =>
  Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left)) *
  Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));

const buildScatterCalloutLayout = (
  items: AnalysisPoint[],
  width: number,
  height: number,
  selectedCdsid: string,
  dense: boolean,
) => {
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(height, 240);
  const points = items.map((item) => ({
    item,
    ...scatterPointPosition(item, safeWidth, safeHeight),
  }));
  const densityOf = (point: (typeof points)[number]) =>
    points.filter(
      (candidate) =>
        candidate.item.cdsid !== point.item.cdsid &&
        Math.abs(candidate.x - point.x) < 78 &&
        Math.abs(candidate.y - point.y) < 42,
    ).length;
  const orderedPoints = [...points].sort((first, second) => {
    const selectedOrder =
      Number(second.item.cdsid === selectedCdsid) -
      Number(first.item.cdsid === selectedCdsid);
    return selectedOrder || densityOf(second) - densityOf(first);
  });
  const placedBoxes: ScatterLabelBox[] = [];
  const layouts = new Map<string, ScatterCalloutLayout>();

  orderedPoints.forEach((point) => {
    const isSelected = point.item.cdsid === selectedCdsid;
    const showroomName = displayShowroomName(point.item.showroom);
    const fontSize = isSelected ? 9 : dense ? 7.5 : 8;
    const labelWidth = Math.max(
      isSelected ? 68 : 48,
      showroomName.length * fontSize * 0.92 + (isSelected ? 20 : 16),
    );
    const labelHeight = isSelected ? 25 : dense ? 19 : 21;
    const pointXPercent = (point.x / safeWidth) * 100;
    const pointYPercent = 100 - (point.y / safeHeight) * 100;
    const preferredPlacement = scatterLabelPlacement(
      pointXPercent,
      pointYPercent,
      items.findIndex((item) => item.cdsid === point.item.cdsid),
      isSelected,
    );
    const directions = [
      { placement: preferredPlacement, x: preferredPlacement.startsWith("left") ? -1 : 1, y: preferredPlacement.endsWith("up") ? -1 : 1 },
      { placement: "left-up" as const, x: -1, y: -1 },
      { placement: "right-up" as const, x: 1, y: -1 },
      { placement: "left-down" as const, x: -1, y: 1 },
      { placement: "right-down" as const, x: 1, y: 1 },
    ].filter(
      (direction, index, allDirections) =>
        allDirections.findIndex(
          (candidate) =>
            candidate.x === direction.x && candidate.y === direction.y,
        ) === index,
    );
    const candidates: Array<{
      box: ScatterLabelBox;
      offsetX: number;
      offsetY: number;
      placement: ScatterLabelPlacement;
      score: number;
    }> = [];

    directions.forEach((direction, directionIndex) => {
      [3, 5, 7].forEach((gap, gapIndex) => {
        [0, -4, 4, -7, 7].forEach((lane, laneIndex) => {
          const perpendicularX = -direction.y;
          const perpendicularY = direction.x;
          const offsetX =
            (direction.x === 0
              ? 0
              : direction.x * (labelWidth / 2 + gap)) +
            perpendicularX * lane;
          const offsetY =
            (direction.y === 0
              ? 0
              : direction.y * (labelHeight / 2 + gap)) +
            perpendicularY * lane;
          const centerX = point.x + offsetX;
          const centerY = point.y + offsetY;
          const box = {
            left: centerX - labelWidth / 2,
            top: centerY - labelHeight / 2,
            right: centerX + labelWidth / 2,
            bottom: centerY + labelHeight / 2,
          };
          const outside =
            Math.max(0, 4 - box.left) +
            Math.max(0, 4 - box.top) +
            Math.max(0, box.right - safeWidth + 4) +
            Math.max(0, box.bottom - safeHeight + 4);
          const collision = placedBoxes.reduce(
            (sum, placed) => sum + overlapArea(box, placed),
            0,
          );
          const coveredPoints = points.filter(
            (candidate) =>
              candidate.item.cdsid !== point.item.cdsid &&
              candidate.x > box.left - 5 &&
              candidate.x < box.right + 5 &&
              candidate.y > box.top - 5 &&
              candidate.y < box.bottom + 5,
          ).length;
          const distance = Math.hypot(offsetX, offsetY);
          const score =
            outside * 100000 +
            collision * 420 +
            (collision > 0 ? 18000 : 0) +
            coveredPoints * 4200 +
            distance * 0.45 +
            directionIndex * 3 +
            gapIndex * 0.2 +
            laneIndex * 0.05;
          candidates.push({
            box,
            offsetX,
            offsetY,
            placement: direction.placement,
            score,
          });
        });
      });
    });

    const best = candidates.reduce((current, candidate) =>
      candidate.score < current.score ? candidate : current,
    );
    placedBoxes.push(best.box);

    const pointsLeft = best.placement.startsWith("right");
    const pointsUp = best.placement.endsWith("down");
    const anchorX =
      best.offsetX + (pointsLeft ? -labelWidth / 2 : labelWidth / 2);
    const anchorY =
      best.offsetY + (pointsUp ? -labelHeight / 2 : labelHeight / 2);
    layouts.set(point.item.cdsid, {
      offsetX: Math.round(best.offsetX),
      offsetY: Math.round(best.offsetY),
      tailX: Math.round(Math.max(3, Math.abs(anchorX))),
      tailY: Math.round(Math.max(3, Math.abs(anchorY))),
      labelWidth: Math.round(labelWidth),
      labelHeight: Math.round(labelHeight),
      placement: best.placement,
    });
  });

  return layouts;
};

export default function CompetitiveAnalysis({
  initialCdsid,
  initialView,
}: {
  initialCdsid: string;
  initialView: AnalysisView;
}) {
  const selected =
    showrooms.find((item) => item.cdsid === initialCdsid) ?? showrooms[0];
  const [view, setView] = useState<AnalysisView>(initialView);
  const [scatterMotionStage, setScatterMotionStage] = useState<
    "settled" | "guides" | "zones" | "points"
  >("settled");
  const [hoveredCdsid, setHoveredCdsid] = useState<string | null>(null);
  const [pinnedCdsid, setPinnedCdsid] = useState<string | null>(null);
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null);
  const [smilingStaffName, setSmilingStaffName] = useState<string | null>(null);
  const [staffAnalysisInView, setStaffAnalysisInView] = useState(false);
  const [accessDate, setAccessDate] = useState(() =>
    formatAnalysisDate(new Date()),
  );
  const scatterRef = useRef<HTMLDivElement>(null);
  const analysisWorkspaceRef = useRef<HTMLElement>(null);
  const stickyAnchorRef = useRef<HTMLDivElement>(null);
  const stickyShellRef = useRef<HTMLDivElement>(null);
  const growthNavigationSummaryRef = useRef<HTMLDivElement>(null);
  const growthStaffRosterRef = useRef<HTMLDivElement>(null);
  const growthNavigationDetailRef = useRef<HTMLDivElement>(null);
  const growthConsultationScatterRef = useRef<HTMLElement>(null);
  const growthStaffRosterDragRef = useRef<{
    pointerId: number;
    originY: number;
    originScrollTop: number;
    moved: boolean;
  } | null>(null);
  const suppressGrowthStaffRosterClickRef = useRef(false);
  const growthNavigationDetailDragRef = useRef<{
    pointerId: number;
    originY: number;
    originScrollTop: number;
  } | null>(null);
  const growthNavigationEntrySnapRef = useRef(false);
  const staffAnalysisCardRef = useRef<HTMLElement>(null);
  const staffAnalysisHeadingRef = useRef<HTMLElement>(null);
  const scatterMotionTimersRef = useRef<number[]>([]);
  const [scatterSize, setScatterSize] = useState({
    width: 920,
    height: 326,
  });
  const dealerShowroomCount = showrooms.filter(
    (item) => item.dealer === selected.dealer,
  ).length;
  const regionShowroomCount = showrooms.filter(
    (item) => item.region === selected.region,
  ).length;
  const sizeShowroomCount = showrooms.filter(
    (item) => item.size === selected.size,
  ).length;

  useEffect(() => {
    const root = document.documentElement;
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const previousViewport = viewport?.getAttribute("content") ?? null;
    const preventGestureZoom = (event: Event) => event.preventDefault();
    const preventModifiedWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    const preventKeyboardZoom = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        ["+", "-", "=", "0"].includes(event.key)
      ) {
        event.preventDefault();
      }
    };

    root.classList.add("analysis-viewport-locked");
    viewport?.setAttribute(
      "content",
      "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
    );
    document.addEventListener("gesturestart", preventGestureZoom, { passive: false });
    document.addEventListener("gesturechange", preventGestureZoom, { passive: false });
    document.addEventListener("gestureend", preventGestureZoom, { passive: false });
    document.addEventListener("wheel", preventModifiedWheelZoom, { passive: false });
    document.addEventListener("keydown", preventKeyboardZoom);

    return () => {
      root.classList.remove("analysis-viewport-locked");
      if (viewport && previousViewport !== null) {
        viewport.setAttribute("content", previousViewport);
      }
      document.removeEventListener("gesturestart", preventGestureZoom);
      document.removeEventListener("gesturechange", preventGestureZoom);
      document.removeEventListener("gestureend", preventGestureZoom);
      document.removeEventListener("wheel", preventModifiedWheelZoom);
      document.removeEventListener("keydown", preventKeyboardZoom);
    };
  }, []);

  useEffect(() => {
    const workspace = analysisWorkspaceRef.current;
    const growthSummary = growthNavigationSummaryRef.current;
    if (!workspace || !growthSummary) return;
    if (CSS.supports("scroll-snap-type: y proximity")) return;

    let entrySnapFrame = 0;
    let wheelQuietTimer = 0;
    let entrySnapConsumed = false;
    let lastWindowScrollY = window.scrollY;
    let touchActive = false;
    let touchY: number | null = null;
    let wheelGestureActive = false;
    let entryAnimationComplete = false;
    let growthSummaryFlowTop =
      window.scrollY + growthSummary.getBoundingClientRect().top;

    const releaseEntrySnap = () => {
      growthNavigationEntrySnapRef.current = false;
    };

    const releaseEntrySnapWhenInputEnds = () => {
      if (entryAnimationComplete && !touchActive && !wheelGestureActive) {
        releaseEntrySnap();
      }
    };

    const keepWheelGestureLocked = () => {
      wheelGestureActive = true;
      window.clearTimeout(wheelQuietTimer);
      wheelQuietTimer = window.setTimeout(() => {
        wheelGestureActive = false;
        releaseEntrySnapWhenInputEnds();
      }, 100);
    };

    const fixedHeaderBottom = () =>
      Math.max(0, stickyShellRef.current?.getBoundingClientRect().bottom ?? 0);

    const workspacePassedRatio = (projectedDistance = 0) => {
      const workspaceBounds = workspace.getBoundingClientRect();
      const passedDistance =
        fixedHeaderBottom() - workspaceBounds.top + projectedDistance;
      return passedDistance / Math.max(1, workspaceBounds.height);
    };

    const shouldSettleAtGrowthNavigation = (projectedDistance = 0) => {
      if (!window.matchMedia("(min-width: 600px)").matches) return false;
      return !entrySnapConsumed && workspacePassedRatio(projectedDistance) >= 0.65;
    };

    const rememberGrowthSummaryFlowTop = () => {
      const summaryBounds = growthSummary.getBoundingClientRect();
      if (summaryBounds.top > fixedHeaderBottom() + 8) {
        growthSummaryFlowTop = window.scrollY + summaryBounds.top;
      }
    };

    const settleAtGrowthNavigation = () => {
      entrySnapConsumed = true;
      entryAnimationComplete = false;
      growthNavigationEntrySnapRef.current = true;
      window.cancelAnimationFrame(entrySnapFrame);

      const startTop = window.scrollY;
      const targetTop = Math.max(
        0,
        growthSummaryFlowTop - fixedHeaderBottom() - 8,
      );
      const startedAt = performance.now();
      const motionDuration = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
        ? 0
        : 420;

      const alignEntry = (timestamp: number) => {
        const progress = motionDuration
          ? Math.min(1, (timestamp - startedAt) / motionDuration)
          : 1;
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const nextTop =
          progress < 1
            ? startTop + (targetTop - startTop) * easedProgress
            : targetTop;

        window.scrollTo({ top: nextTop, left: window.scrollX, behavior: "auto" });

        if (progress < 1) {
          entrySnapFrame = window.requestAnimationFrame(alignEntry);
          return;
        }

        window.scrollTo({ top: targetTop, left: window.scrollX, behavior: "auto" });
        entryAnimationComplete = true;
        releaseEntrySnapWhenInputEnds();
      };

      entrySnapFrame = window.requestAnimationFrame(alignEntry);
    };

    const normalizeWheelDistance = (event: WheelEvent) => {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return event.deltaY * window.innerHeight;
      }
      return event.deltaY;
    };

    const handleEntryWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      if (event.deltaY <= 0) {
        return;
      }

      if (growthNavigationEntrySnapRef.current) {
        event.preventDefault();
        keepWheelGestureLocked();
        return;
      }

      if (!shouldSettleAtGrowthNavigation(normalizeWheelDistance(event))) return;
      rememberGrowthSummaryFlowTop();
      event.preventDefault();
      keepWheelGestureLocked();
      settleAtGrowthNavigation();
    };

    const handleEntryTouchStart = (event: TouchEvent) => {
      touchActive = true;
      touchY = event.touches[0]?.clientY ?? null;
    };

    const handleEntryTouchMove = (event: TouchEvent) => {
      const nextTouchY = event.touches[0]?.clientY ?? null;
      if (touchY === null || nextTouchY === null) return;
      const downwardPageDistance = touchY - nextTouchY;
      touchY = nextTouchY;
      if (downwardPageDistance <= 0) return;

      if (growthNavigationEntrySnapRef.current) {
        event.preventDefault();
        return;
      }

      if (!shouldSettleAtGrowthNavigation(downwardPageDistance)) return;
      rememberGrowthSummaryFlowTop();
      event.preventDefault();
      settleAtGrowthNavigation();
    };

    const clearEntryTouch = () => {
      touchActive = false;
      touchY = null;
      releaseEntrySnapWhenInputEnds();
    };

    const handleEntryScroll = () => {
      const nextScrollY = window.scrollY;
      const movingDown = nextScrollY > lastWindowScrollY + 0.5;
      lastWindowScrollY = nextScrollY;

      if (growthNavigationEntrySnapRef.current) return;
      if (entrySnapConsumed) {
        if (workspacePassedRatio() < 0.5) {
          entrySnapConsumed = false;
          rememberGrowthSummaryFlowTop();
        }
        return;
      }
      if (movingDown && shouldSettleAtGrowthNavigation()) {
        rememberGrowthSummaryFlowTop();
        settleAtGrowthNavigation();
      }
    };

    entrySnapConsumed = workspacePassedRatio() >= 0.65;

    window.addEventListener("wheel", handleEntryWheel, {
      capture: true,
      passive: false,
    });
    window.addEventListener("touchstart", handleEntryTouchStart, { passive: true });
    window.addEventListener("touchmove", handleEntryTouchMove, { passive: false });
    window.addEventListener("touchend", clearEntryTouch, { passive: true });
    window.addEventListener("touchcancel", clearEntryTouch, { passive: true });
    window.addEventListener("scroll", handleEntryScroll, { passive: true });

    return () => {
      window.clearTimeout(wheelQuietTimer);
      window.cancelAnimationFrame(entrySnapFrame);
      growthNavigationEntrySnapRef.current = false;
      window.removeEventListener("wheel", handleEntryWheel, true);
      window.removeEventListener("touchstart", handleEntryTouchStart);
      window.removeEventListener("touchmove", handleEntryTouchMove);
      window.removeEventListener("touchend", clearEntryTouch);
      window.removeEventListener("touchcancel", clearEntryTouch);
      window.removeEventListener("scroll", handleEntryScroll);
    };
  }, [initialCdsid]);

  useEffect(() => {
    const detail = growthNavigationDetailRef.current;
    const consultationScatter = growthConsultationScatterRef.current;
    if (!detail || !consultationScatter) return;

    let snapFrame = 0;
    let snapActive = false;
    let downwardIntent = 0;
    let touchY: number | null = null;

    const normalizedWheelDistance = (event: WheelEvent) => {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return event.deltaY * detail.clientHeight;
      }
      return event.deltaY;
    };

    const consultationScatterTop = () => {
      const detailBounds = detail.getBoundingClientRect();
      const scatterBounds = consultationScatter.getBoundingClientRect();
      return Math.max(
        0,
        detail.scrollTop + scatterBounds.top - detailBounds.top - 6,
      );
    };

    const canSettleAtConsultationScatter = () => {
      if (!window.matchMedia("(min-width: 600px)").matches) return false;
      const targetTop = consultationScatterTop();
      return targetTop > detail.scrollTop + 8;
    };

    const settleAtConsultationScatter = () => {
      const startTop = detail.scrollTop;
      const targetTop = consultationScatterTop();
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const motionDuration = reduceMotion ? 0 : 280;
      const startedAt = performance.now();

      snapActive = true;
      downwardIntent = 0;
      window.cancelAnimationFrame(snapFrame);

      const alignScatter = (timestamp: number) => {
        const progress = motionDuration
          ? Math.min(1, (timestamp - startedAt) / motionDuration)
          : 1;
        const easedProgress = 1 - Math.pow(1 - progress, 4);
        detail.scrollTop =
          progress < 1
            ? startTop + (targetTop - startTop) * easedProgress
            : targetTop;

        if (progress < 1) {
          snapFrame = window.requestAnimationFrame(alignScatter);
          return;
        }

        detail.scrollTop = targetTop;
        snapActive = false;
      };

      snapFrame = window.requestAnimationFrame(alignScatter);
    };

    const handleDetailWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.deltaY <= 0) {
        downwardIntent = 0;
        return;
      }
      if (snapActive) {
        event.preventDefault();
        return;
      }
      if (!canSettleAtConsultationScatter()) return;

      downwardIntent += Math.max(0, normalizedWheelDistance(event));
      if (downwardIntent < 18) return;
      event.preventDefault();
      settleAtConsultationScatter();
    };

    const handleDetailTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
      downwardIntent = 0;
    };

    const handleDetailTouchMove = (event: TouchEvent) => {
      const nextTouchY = event.touches[0]?.clientY ?? null;
      if (touchY === null || nextTouchY === null) return;
      const downwardDistance = touchY - nextTouchY;
      touchY = nextTouchY;
      if (downwardDistance <= 0) {
        downwardIntent = 0;
        return;
      }
      if (snapActive) {
        event.preventDefault();
        return;
      }
      if (!canSettleAtConsultationScatter()) return;

      downwardIntent += downwardDistance;
      if (downwardIntent < 18) return;
      event.preventDefault();
      settleAtConsultationScatter();
    };

    const clearDetailTouch = () => {
      touchY = null;
      downwardIntent = 0;
    };

    detail.addEventListener("wheel", handleDetailWheel, { passive: false });
    detail.addEventListener("touchstart", handleDetailTouchStart, { passive: true });
    detail.addEventListener("touchmove", handleDetailTouchMove, { passive: false });
    detail.addEventListener("touchend", clearDetailTouch, { passive: true });
    detail.addEventListener("touchcancel", clearDetailTouch, { passive: true });

    return () => {
      window.cancelAnimationFrame(snapFrame);
      detail.removeEventListener("wheel", handleDetailWheel);
      detail.removeEventListener("touchstart", handleDetailTouchStart);
      detail.removeEventListener("touchmove", handleDetailTouchMove);
      detail.removeEventListener("touchend", clearDetailTouch);
      detail.removeEventListener("touchcancel", clearDetailTouch);
    };
  }, [initialCdsid]);

  useLayoutEffect(() => {
    forcePageScrollToTop();
  }, [initialCdsid]);

  const beginGrowthNavigationDetailDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button, a, input, select, textarea")
    ) {
      return;
    }

    growthNavigationDetailDragRef.current = {
      pointerId: event.pointerId,
      originY: event.clientY,
      originScrollTop: event.currentTarget.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("is-dragging");
    event.preventDefault();
  };

  const beginGrowthStaffRosterDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    suppressGrowthStaffRosterClickRef.current = false;
    growthStaffRosterDragRef.current = {
      pointerId: event.pointerId,
      originY: event.clientY,
      originScrollTop: event.currentTarget.scrollTop,
      moved: false,
    };
  };

  const keepGrowthStaffRosterInView = () => {
    const roster = growthStaffRosterRef.current;
    const summary = growthNavigationSummaryRef.current;
    if (!roster || !summary) return;

    const rosterBounds = roster.getBoundingClientRect();
    const summaryBounds = summary.getBoundingClientRect();
    const safeTop = summaryBounds.bottom + 8;
    if (rosterBounds.top >= safeTop - 1) return;

    window.scrollBy({
      top: rosterBounds.top - safeTop,
      behavior: "auto",
    });
  };

  const scrollGrowthStaffRosterOnly = (
    event: ReactWheelEvent<HTMLDivElement>,
  ) => {
    const roster = event.currentTarget;
    if (roster.scrollHeight <= roster.clientHeight) return;
    keepGrowthStaffRosterInView();
    roster.scrollTop += event.deltaY;
    event.preventDefault();
    event.stopPropagation();
  };

  const moveGrowthStaffRosterDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = growthStaffRosterDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientY - drag.originY;
    if (!drag.moved && Math.abs(distance) < 4) return;

    drag.moved = true;
    suppressGrowthStaffRosterClickRef.current = true;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    keepGrowthStaffRosterInView();
    event.currentTarget.classList.add("is-dragging");
    event.currentTarget.scrollTop = drag.originScrollTop - distance;
    event.preventDefault();
  };

  const endGrowthStaffRosterDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = growthStaffRosterDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    growthStaffRosterDragRef.current = null;
    event.currentTarget.classList.remove("is-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const preventDraggedGrowthStaffSelection = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (!suppressGrowthStaffRosterClickRef.current) return;
    suppressGrowthStaffRosterClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const moveGrowthNavigationDetailDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = growthNavigationDetailDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.scrollTop =
      drag.originScrollTop - (event.clientY - drag.originY);
    event.preventDefault();
  };

  const endGrowthNavigationDetailDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = growthNavigationDetailDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    growthNavigationDetailDragRef.current = null;
    event.currentTarget.classList.remove("is-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    const syncAccessDate = () => setAccessDate(formatAnalysisDate(new Date()));
    syncAccessDate();
    const timer = window.setInterval(syncAccessDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const resetStaffSelection = () => {
      setSelectedStaffName(null);
      setSmilingStaffName(null);
    };

    resetStaffSelection();
    window.addEventListener("pageshow", resetStaffSelection);
    return () => window.removeEventListener("pageshow", resetStaffSelection);
  }, [initialCdsid]);

  useEffect(() => {
    const card = staffAnalysisCardRef.current;
    if (!card) return;

    setStaffAnalysisInView(false);

    if (typeof IntersectionObserver === "undefined") {
      setStaffAnalysisInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setStaffAnalysisInView(true);
        observer.disconnect();
      },
      {
        threshold: 0.22,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [initialCdsid]);

  useEffect(
    () => () => {
      scatterMotionTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      );
    },
    [],
  );

  useLayoutEffect(() => {
    const anchor = stickyAnchorRef.current;
    const shell = stickyShellRef.current;
    if (!anchor || !shell) return;

    let resizeFrame = 0;

    const syncAnchorHeight = () => {
      const staffCard = staffAnalysisCardRef.current;
      const page = anchor.closest<HTMLElement>(".competitive-analysis-page");
      const isPhoneViewport = window.matchMedia("(max-width: 599px)").matches;
      const isNarrowTabletViewport = window.matchMedia(
        "(min-width: 600px) and (max-width: 760px)",
      ).matches;
      if (isPhoneViewport) {
        anchor.style.removeProperty("height");
        anchor.style.removeProperty("min-height");
        page?.style.removeProperty("--growth-navigation-sticky-top");
        page?.style.removeProperty("--growth-navigation-summary-height");
        staffCard?.style.removeProperty(
          "--analysis-staff-heading-sticky-top",
        );
        staffCard?.style.removeProperty(
          "--analysis-staff-summary-sticky-top",
        );
        return;
      }
      const shellHeight = isNarrowTabletViewport
        ? 0
        : Math.ceil(shell.getBoundingClientRect().height);
      const growthSummaryHeight = Math.ceil(
        growthNavigationSummaryRef.current?.getBoundingClientRect().height ?? 152,
      );
      const staffHeadingHeight = Math.ceil(
        staffAnalysisHeadingRef.current?.getBoundingClientRect().height ?? 0,
      );
      if (isNarrowTabletViewport) {
        anchor.style.removeProperty("height");
        anchor.style.removeProperty("min-height");
      } else {
        anchor.style.height = `${shellHeight}px`;
        // The desktop CSS min-height is only a first-paint fallback. Once the
        // fixed shell is measured, override it as well so page 2 has the same
        // single 8px content gap as page 1 instead of retaining extra blank
        // space when the analysis header happens to be shorter.
        anchor.style.minHeight = `${shellHeight}px`;
      }
      page?.style.setProperty("--growth-navigation-sticky-top", `${shellHeight}px`);
      page?.style.setProperty(
        "--growth-navigation-summary-height",
        `${growthSummaryHeight}px`,
      );
      if (isNarrowTabletViewport) {
        staffCard?.style.removeProperty("--analysis-staff-heading-sticky-top");
        staffCard?.style.removeProperty("--analysis-staff-summary-sticky-top");
      } else {
        staffCard?.style.setProperty(
          "--analysis-staff-heading-sticky-top",
          `${shellHeight + 8}px`,
        );
        staffCard?.style.setProperty(
          "--analysis-staff-summary-sticky-top",
          `${shellHeight + staffHeadingHeight + 24}px`,
        );
      }
    };

    const queueAnchorHeightSync = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(syncAnchorHeight);
    };

    syncAnchorHeight();
    const observer = new ResizeObserver(queueAnchorHeightSync);
    observer.observe(shell);
    if (staffAnalysisHeadingRef.current) {
      observer.observe(staffAnalysisHeadingRef.current);
    }
    if (growthNavigationSummaryRef.current) {
      observer.observe(growthNavigationSummaryRef.current);
    }
    window.addEventListener("resize", queueAnchorHeightSync);
    window.visualViewport?.addEventListener("resize", queueAnchorHeightSync);
    void document.fonts?.ready.then(queueAnchorHeightSync);

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      window.removeEventListener("resize", queueAnchorHeightSync);
      window.visualViewport?.removeEventListener("resize", queueAnchorHeightSync);
      anchor
        .closest<HTMLElement>(".competitive-analysis-page")
        ?.style.removeProperty("--growth-navigation-sticky-top");
      anchor
        .closest<HTMLElement>(".competitive-analysis-page")
        ?.style.removeProperty("--growth-navigation-summary-height");
      anchor.style.removeProperty("height");
      anchor.style.removeProperty("min-height");
      staffAnalysisCardRef.current?.style.removeProperty(
        "--analysis-staff-heading-sticky-top",
      );
      staffAnalysisCardRef.current?.style.removeProperty(
        "--analysis-staff-summary-sticky-top",
      );
    };
  }, []);

  const groupItems = useMemo(() => {
    const filtered =
      view === "dealer"
        ? nationalCumulativeAnalysisPoints.filter(
            (item) => item.dealer === selected.dealer,
          )
        : view === "region"
          ? nationalCumulativeAnalysisPoints.filter(
              (item) => item.region === selected.region,
            )
          : view === "size"
            ? nationalCumulativeAnalysisPoints.filter(
                (item) => item.size === selected.size,
              )
            : nationalCumulativeAnalysisPoints;

    return [...filtered].sort((a, b) => b.combined - a.combined);
  }, [selected.dealer, selected.region, selected.size, view]);

  const selectedPoint =
    groupItems.find((item) => item.cdsid === selected.cdsid) ??
    cumulativeAnalysisPoint(selected);
  const selectedQ1Combined =
    typeof selected.q1?.voc === "number" &&
    typeof selected.q1?.happyCall === "number"
      ? selected.q1.voc + selected.q1.happyCall
      : null;
  const selectedQ2Combined =
    typeof selected.voc === "number" && typeof selected.happyCall === "number"
      ? selected.voc + selected.happyCall
      : null;
  const selectedAwardPeriods = v3sAwardPeriods
    .filter((period) =>
      v3sAwardWinnersByPeriod[period.id]?.includes(selected.cdsid),
    )
    .map((period) => period.id);
  const selectedAwardCount = selectedAwardPeriods.length;
  const selectedAwardName = displayShowroomNameWithoutBrand(selected.showroom);
  const selectedStaffAnalysis = staffAnalysisByCdsid[selected.cdsid];
  const currentSalesStaff = useMemo(
    () =>
      (selectedStaffAnalysis?.employees ?? []).filter(
        (employee) =>
          employee.role === "영업직원" || employee.role === "영업팀장",
      ),
    [selectedStaffAnalysis],
  );
  const rankedSalesStaff = useMemo(
    () => {
      return currentSalesStaff
        .map((employee) => {
          const sales = salesActivityByCdsid[selected.cdsid]?.staff.find(
            (staff) => staff.name === employee.name,
          );
          const totals = staffYears.reduce(
            (summary, year) => {
              const metrics = employee.years[year];
              summary.responses += metrics?.responses ?? 0;
              summary.scoreSum += metrics?.scoreSum ?? 0;
              return summary;
            },
            { responses: 0, scoreSum: 0 },
          );
          const average = totals.responses ? totals.scoreSum / totals.responses : null;
          const satisfactionScore = average === null ? null : average * 10;
          return {
            employee,
            responses: totals.responses,
            deliveredSales: sales?.deliveredSales ?? null,
            average,
            satisfactionScore,
            adjustedPoints: satisfactionScore,
            freshnessPoints: 0,
            finalScore: satisfactionScore,
          };
        })
        .sort((a, b) => compareStaffHireDateAscending(a.employee, b.employee));
    },
    [currentSalesStaff, selected.cdsid],
  );
  const selectedStaffEmployee =
    rankedSalesStaff.find(({ employee }) => employee.name === selectedStaffName)
      ?.employee ?? rankedSalesStaff[0]?.employee;
  const selectedStaffScoring = rankedSalesStaff.find(
    ({ employee }) => employee.name === selectedStaffEmployee?.name,
  );
  const selectedSalesActivityShowroom = salesActivityByCdsid[selected.cdsid];
  const selectedStaffSalesActivity = selectedSalesActivityShowroom?.staff.find(
    (staff) => staff.name === selectedStaffEmployee?.name,
  );
  const selectedStaffHasActivityFunnel =
    selectedStaffSalesActivity?.activityStatus === "available";
  const selectedStaffConsultationCustomers =
    selectedStaffSalesActivity?.customers.consultation ?? 0;
  const selectedStaffTestDriveCustomers =
    selectedStaffSalesActivity?.customers.testDrive ?? 0;
  const selectedStaffContractCustomers =
    selectedStaffSalesActivity?.customers.contract ?? 0;
  const selectedStaffDeliveredSales = selectedStaffSalesActivity?.deliveredSales ?? 0;
  const selectedShowroomDeliveredSales =
    selectedSalesActivityShowroom?.summary.deliveredSales ?? 0;
  const selectedShowroomSalesStaffCount =
    selectedSalesActivityShowroom?.summary.staffCount ?? 0;
  const selectedShowroomAverageDeliveredSales = selectedShowroomSalesStaffCount
    ? selectedShowroomDeliveredSales / selectedShowroomSalesStaffCount
    : 0;
  const selectedStaffSalesRank = selectedStaffSalesActivity
    ? (selectedSalesActivityShowroom?.staff ?? []).filter(
        (staff) => staff.deliveredSales > selectedStaffSalesActivity.deliveredSales,
      ).length + 1
    : null;
  const selectedDealerRankName = displayDealerRankName(selected.dealer);
  const selectedStaffDealerSalesPopulation = nationalStaffSalesPopulation.filter(
    (staff) =>
      displayDealerRankName(
        showrooms.find((showroom) => showroom.cdsid === staff.cdsid)?.dealer ?? "",
      ) === selectedDealerRankName,
  );
  const selectedStaffDealerSalesRank = selectedStaffSalesActivity && selectedStaffDealerSalesPopulation.length
    ? selectedStaffDealerSalesPopulation.filter(
        (staff) => staff.deliveredSales > selectedStaffDeliveredSales,
      ).length + 1
    : null;
  const selectedShowroomSalesPopulationCount = selectedSalesActivityShowroom?.staff.length ?? 0;
  const selectedStaffSalesShare = selectedShowroomDeliveredSales
    ? (selectedStaffDeliveredSales / selectedShowroomDeliveredSales) * 100
    : null;
  const selectedStaffSalesNationalRank = selectedStaffSalesActivity
    ? nationalStaffSalesPopulation.filter(
        (staff) => staff.deliveredSales > selectedStaffDeliveredSales,
      ).length + 1
    : null;
  const selectedStaffSalesTopPercent = selectedStaffSalesNationalRank
    ? (selectedStaffSalesNationalRank / nationalStaffSalesPopulation.length) * 100
    : null;
  const selectedStaffSalesShareClamped = Math.max(0, Math.min(100, selectedStaffSalesShare ?? 0));
  const selectedStaffSalesShareLeaderRadians = ((selectedStaffSalesShareClamped * 1.8) - 90) * (Math.PI / 180);
  const selectedStaffSalesShareLeaderX = 39 + Math.cos(selectedStaffSalesShareLeaderRadians) * 36;
  const selectedStaffSalesShareLeaderY = 49 + Math.sin(selectedStaffSalesShareLeaderRadians) * 36;
  const selectedStaffSalesShareLeaderBendX = Math.min(84, Math.max(74, selectedStaffSalesShareLeaderX + 8));
  const selectedStaffMonthlyDeliveredSales = Array.from(
    { length: 12 },
    (_, index) => selectedStaffSalesActivity?.monthlyDeliveredSales[index] ?? null,
  );
  const selectedStaffReportedSalesMonths = selectedStaffMonthlyDeliveredSales.filter(
    (count): count is number => count !== null,
  );
  const selectedStaffMonthlySalesAverage = selectedStaffReportedSalesMonths.length
    ? selectedStaffReportedSalesMonths.reduce((sum, count) => sum + count, 0) /
      selectedStaffReportedSalesMonths.length
    : null;
  const selectedStaffShowroomAverageDelta =
    selectedStaffDeliveredSales - selectedShowroomAverageDeliveredSales;
  const selectedStaffShowroomAverageDeltaTone =
    selectedStaffShowroomAverageDelta > 0
      ? "positive"
      : selectedStaffShowroomAverageDelta < 0
        ? "negative"
        : "neutral";
  const selectedStaffShowroomAverageDeltaMark =
    selectedStaffShowroomAverageDelta > 0
      ? "▲"
      : selectedStaffShowroomAverageDelta < 0
        ? "▼"
        : "―";
  const selectedShowroomMonthlyAverageDeliveredSales = Array.from(
    { length: 12 },
    (_, index) => {
      const count = selectedSalesActivityShowroom?.summary.monthlyDeliveredSales[index];
      return typeof count === "number" && selectedShowroomSalesStaffCount
        ? count / selectedShowroomSalesStaffCount
        : null;
    },
  );
  const selectedSalesMonthScale = Math.max(
    1,
    ...selectedStaffMonthlyDeliveredSales.filter(
      (count): count is number => count !== null,
    ),
    ...selectedShowroomMonthlyAverageDeliveredSales.filter(
      (count): count is number => count !== null,
    ),
  );
  const selectedStaffConsultationToTestDriveRate = selectedStaffConsultationCustomers
    ? ((selectedStaffSalesActivity?.transitions.consultationToTestDrive ?? 0) /
        selectedStaffConsultationCustomers) * 100
    : null;
  const selectedStaffTestDriveToContractRate = selectedStaffTestDriveCustomers
    ? ((selectedStaffSalesActivity?.transitions.testDriveToContract ?? 0) /
        selectedStaffTestDriveCustomers) * 100
    : null;
  const selectedStaffContractToDeliveredRate = selectedStaffContractCustomers
    ? ((selectedStaffSalesActivity?.transitions.contractToDelivered ?? 0) /
        selectedStaffContractCustomers) * 100
    : null;
  const selectedShowroomStaffResponses = rankedSalesStaff.reduce(
    (sum, staff) => sum + staff.responses,
    0,
  );
  const selectedShowroomStaffAverage = selectedShowroomStaffResponses
    ? rankedSalesStaff.reduce(
        (sum, staff) => sum + (staff.average ?? 0) * staff.responses,
        0,
      ) / selectedShowroomStaffResponses
    : null;
  const selectedStaffNationalRankIndex = selectedStaffEmployee &&
    selectedStaffScoring?.finalScore !== null
      ? nationalStaffFinalScores.findIndex(
          (staff) =>
            staff.cdsid === selected.cdsid &&
            staff.name === selectedStaffEmployee.name,
        )
      : -1;
  const selectedStaffNationalRank = selectedStaffNationalRankIndex >= 0
    ? selectedStaffNationalRankIndex + 1
    : null;
  const selectedStaffTenureScoreRows = selectedStaffEmployee
    ? nationalStaffFinalScores.filter(
        (staff) =>
          staff.tenureKey ===
            staffTenureHalfYearRange(selectedStaffEmployee.tenureMonths).start &&
          staff.finalScore !== null,
      )
    : [];
  const selectedStaffTenureFinalScore = selectedStaffTenureScoreRows.length
    ? selectedStaffTenureScoreRows.reduce(
        (sum, staff) => sum + (staff.finalScore ?? 0),
        0,
      ) / selectedStaffTenureScoreRows.length
    : null;
  const selectedStaffRosterIndex = Math.max(
    0,
    rankedSalesStaff.findIndex(
      ({ employee }) => employee.name === selectedStaffEmployee?.name,
    ),
  );
  const selectedStaffImprovementKeywords = Array.from(
    (selectedStaffEmployee?.improvementKeywords ?? []).reduce(
      (keywords, keyword) => {
        const mappedLabel = staffImprovementKeywordLabel[keyword.label];
        const label = mappedLabel === undefined ? keyword.label : mappedLabel;
        if (!label) return keywords;
        keywords.set(label, (keywords.get(label) ?? 0) + keyword.mentions);
        return keywords;
      },
      new Map<string, number>(),
    ),
    ([label, mentions]) => ({ label, mentions }),
  ).sort(
    (left, right) =>
      right.mentions - left.mentions || left.label.localeCompare(right.label, "ko"),
  );
  const selectedStaffStrengthKeywords = [
    ...(selectedStaffEmployee?.strengthKeywords ?? []),
  ].sort(
    (left, right) =>
      right.mentions - left.mentions || left.label.localeCompare(right.label, "ko"),
  );
  const selectedStaffStrengthTotalMentions = selectedStaffStrengthKeywords.reduce(
    (sum, keyword) => sum + keyword.mentions,
    0,
  );
  const selectedStaffImprovementTotalMentions = selectedStaffImprovementKeywords.reduce(
    (sum, keyword) => sum + keyword.mentions,
    0,
  );
  const selectedStaffCommentTotalMentions =
    selectedStaffStrengthTotalMentions + selectedStaffImprovementTotalMentions;
  const selectedStaffStrengthShare = selectedStaffCommentTotalMentions > 0
    ? Math.round(
        (selectedStaffStrengthTotalMentions / selectedStaffCommentTotalMentions) * 1_000,
      ) / 10
    : 0;
  const selectedStaffImprovementShare = selectedStaffCommentTotalMentions > 0
    ? Number((100 - selectedStaffStrengthShare).toFixed(1))
    : 0;
  const selectedStaffStrengthMax = Math.max(
    1,
    ...selectedStaffStrengthKeywords.map((keyword) => keyword.mentions),
  );
  const selectedStaffImprovementMax = Math.max(
    1,
    ...selectedStaffImprovementKeywords.map((keyword) => keyword.mentions),
  );
  const selectedStaffProfileShowroom = staffProfilePhotosByCdsid[selected.cdsid];
  const selectedStaffProfile = selectedStaffEmployee
    ? selectedStaffProfileShowroom?.employees[selectedStaffEmployee.name]
    : undefined;
  const selectedStaffFallbackProfileImage = selectedStaffEmployee?.gender === "female"
    ? staffFemaleFallbackProfileImage
    : staffFallbackProfileImage;
  const selectedStaffCertificationCounts = {
    Grand: 0,
    Advanced: 0,
    Certified: 0,
  } satisfies Record<StaffCertificationLevel, number>;
  if (selectedStaffEmployee) {
    const nameFrequency =
      staffCurrentNameFrequency.get(selectedStaffEmployee.name) ?? 0;
    const currentShowroom = normalizeStaffCertificationShowroom(
      displayShowroomNameWithoutBrand(selected.showroom),
    );
    staffCertificationRecords.forEach((record) => {
      if (record.name !== selectedStaffEmployee.name) return;
      if (
        nameFrequency > 1 &&
        normalizeStaffCertificationShowroom(record.showroom) !== currentShowroom
      ) {
        return;
      }
      selectedStaffCertificationCounts[record.level] += 1;
    });
  }
  const selectedStaffYearRows = staffYears.map((year) => {
    const metrics = selectedStaffEmployee?.years[year] ?? {
      responses: 0,
      scoreSum: 0,
    };
    const national = staffNationalYears[year];
    const average =
      metrics.responses > 0 ? metrics.scoreSum / metrics.responses : null;
    return {
      year,
      sent: metrics.sent ?? 0,
      responseRate:
        (metrics.sent ?? 0) > 0
          ? (metrics.responses / (metrics.sent ?? 1)) * 100
          : 0,
      responses: metrics.responses,
      scoreSum: metrics.scoreSum,
      average,
      nationalAverage: national.average,
      nationalResponses: national.responses,
      deltaPercent: staffDeltaPercent(average, national.average),
    };
  });
  const selectedStaffTrendPoints = selectedStaffYearRows.flatMap((year, index) =>
    year.average === null
      ? []
      : [
          {
            key: year.year,
            index,
            x: (index + 0.5) * 25,
            xCss: `calc(${(index + 0.5) * 25}% + 20px)`,
            y: 100 - staffHistoryChartHeight(year.average),
            height: staffHistoryChartHeight(year.average),
            average: year.average,
          },
        ],
  );
  const selectedStaffTrendPolyline = selectedStaffTrendPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const selectedStaffResponses = selectedStaffYearRows.reduce(
    (sum, year) => sum + year.responses,
    0,
  );
  const staffNationalResponses = selectedStaffYearRows.reduce(
    (sum, year) => sum + year.nationalResponses,
    0,
  );
  const selectedStaffTenureYears = selectedStaffEmployee
    ? Math.floor(selectedStaffEmployee.tenureMonths / 12)
    : null;
  const selectedStaffTenureMonths = selectedStaffEmployee
    ? selectedStaffEmployee.tenureMonths % 12
    : null;
  const selectedStaffTenureRank = selectedStaffEmployee
    ? staffCurrentSalesPopulation.filter(
        ({ employee }) =>
          employee.tenureMonths > selectedStaffEmployee.tenureMonths,
      ).length + 1
    : null;
  const selectedStaffTenureTopPercent = selectedStaffTenureRank
    ? (selectedStaffTenureRank / staffCurrentSalesPopulation.length) * 100
    : null;
  const selectedStaffResponseShare = staffNationalResponses
    ? (selectedStaffResponses / staffNationalResponses) * 100
    : null;
  const selectedStaffSatisfactionScore = selectedStaffScoring?.satisfactionScore ?? null;
  const selectedStaffSatisfactionNationalRank = selectedStaffSatisfactionScore === null
    ? null
    : staffTenureScatterPopulation.filter(
        (staff) => staff.finalScore > selectedStaffSatisfactionScore,
      ).length + 1;
  const selectedStaffSatisfactionTopPercent = selectedStaffSatisfactionNationalRank === null
    ? null
    : (selectedStaffSatisfactionNationalRank / staffTenureScatterPopulation.length) * 100;
  const selectedStaffEvidenceLevel = staffEvidenceConfidence(selectedStaffResponses);
  const selectedStaffTenurePeerRange = selectedStaffEmployee
    ? staffTenureHalfYearRange(selectedStaffEmployee.tenureMonths)
    : null;
  const selectedStaffTenurePeerRangeStart =
    selectedStaffTenurePeerRange?.start ?? null;
  const selectedStaffTenurePeerRangeEnd =
    selectedStaffTenurePeerRange?.end ?? null;
  const selectedStaffTenurePeerRangeLabel =
    selectedStaffTenurePeerRangeStart === null ||
    selectedStaffTenurePeerRangeEnd === null
      ? null
      : `${formatStaffTenureDuration(selectedStaffTenurePeerRangeStart - 1)} ~ ${formatStaffTenureDuration(selectedStaffTenurePeerRangeEnd)}`;
  const selectedStaffPeerDelta =
    selectedStaffSatisfactionScore === null || selectedStaffTenureFinalScore === null
      ? null
      : selectedStaffSatisfactionScore - selectedStaffTenureFinalScore;
  const selectedStaffGrowthZone =
    selectedStaffSatisfactionScore === null
      ? null
      : selectedStaffPeerDelta !== null && selectedStaffPeerDelta < -2
        ? 0
        : selectedStaffPeerDelta !== null && selectedStaffPeerDelta >= 2
          ? 2
          : 1;
  const selectedStaffGrowthLabels = ["집중 코칭", "성장 가속", "성과 확산"] as const;
  const selectedStaffGrowthNeedleAngle = selectedStaffGrowthZone === null
    ? 0
    : selectedStaffPeerDelta === null
      ? 90
      : Math.round(
          ((Math.max(-6, Math.min(6, selectedStaffPeerDelta)) + 6) / 12) * 1800,
        ) / 10;
  const selectedShowroomGrowthDelta =
    selectedShowroomStaffAverage === null || selectedStaffTenureFinalScore === null
      ? null
      : selectedShowroomStaffAverage * 10 - selectedStaffTenureFinalScore;
  const selectedShowroomGrowthAngle = selectedShowroomGrowthDelta === null
    ? null
    : Math.round(
        ((Math.max(-6, Math.min(6, selectedShowroomGrowthDelta)) + 6) / 12) * 1800,
      ) / 10;
  const selectedStaffGrowthLabel = selectedStaffGrowthZone === null
    ? "자료 확인"
    : selectedStaffGrowthLabels[selectedStaffGrowthZone];
  const selectedStaffGrowthDeltaTone = selectedStaffPeerDelta === null || selectedStaffPeerDelta === 0
    ? "neutral"
    : selectedStaffPeerDelta > 0
      ? "positive"
      : "negative";
  const selectedStaffGrowthDeltaMark = selectedStaffPeerDelta === null || selectedStaffPeerDelta === 0
    ? "±"
    : selectedStaffPeerDelta > 0
      ? "▲"
      : "▼";
  const selectedStaffGrowthCalculation =
    selectedStaffSatisfactionScore === null ||
    selectedStaffTenureFinalScore === null ||
    selectedStaffPeerDelta === null
      ? "본인 점수와 동일연차 평균을 비교해 위치를 산출합니다"
      : `본인 ${(selectedStaffSatisfactionScore / 10).toFixed(1)}점 − 동일연차 평균 ${(selectedStaffTenureFinalScore / 10).toFixed(1)}점 = ${selectedStaffGrowthDeltaMark} ${Math.abs(selectedStaffPeerDelta / 10).toFixed(1)}점`;
  const selectedStaffScatterPoint = staffTenureScatterPopulation.find(
    (point) =>
      point.cdsid === selected.cdsid && point.name === selectedStaffEmployee?.name,
  );
  const sameShowroomStaffScatterPoints = staffTenureScatterPopulation.filter(
    (point) =>
      point.cdsid === selected.cdsid && point.name !== selectedStaffEmployee?.name,
  );
  const otherStaffScatterPoints = staffTenureScatterPopulation.filter(
    (point) => point.cdsid !== selected.cdsid,
  );
  const staffScatterMaxYears = Math.max(
    15,
    Math.ceil(
      Math.max(
        ...nationalStaffFinalScores.map((point) => point.tenureYears),
        selectedStaffScatterPoint?.tenureYears ?? 0,
      ) / 5,
    ) * 5,
  );
  const staffScatterPlot = { left: 42, right: 448, top: 16, bottom: 170 };
  const staffScatterMinScore = Math.max(0, Math.min(
    60,
    Math.floor(Math.min(100, ...staffTenureScatterPopulation.map((point) => point.finalScore)) / 10) * 10,
  ));
  const staffScatterX = (tenureYears: number) =>
    staffScatterPlot.left +
    (tenureYears / staffScatterMaxYears) *
      (staffScatterPlot.right - staffScatterPlot.left);
  const staffScatterUpperRangeExponent = 1.7;
  const staffScatterY = (finalScore: number) => {
    const scoreRatio = Math.max(
      0,
      Math.min(
        1,
        (finalScore - staffScatterMinScore) / (100 - staffScatterMinScore),
      ),
    );
    return staffScatterPlot.bottom -
      Math.pow(scoreRatio, staffScatterUpperRangeExponent) *
        (staffScatterPlot.bottom - staffScatterPlot.top);
  };
  const staffScatterXTicks = Array.from(
    { length: 6 },
    (_, index) => (staffScatterMaxYears / 5) * index,
  );
  const staffScatterTickStep = 10;
  const staffScatterYTicks = Array.from(
    { length: (100 - staffScatterMinScore) / staffScatterTickStep + 1 },
    (_, index) => staffScatterMinScore + index * staffScatterTickStep,
  );
  const selectedStaffSalesScatterPoint = nationalStaffSalesPopulation.find(
    (point) =>
      point.cdsid === selected.cdsid && point.name === selectedStaffEmployee?.name,
  );
  const sameShowroomStaffSalesScatterPoints = nationalStaffSalesPopulation.filter(
    (point) =>
      point.cdsid === selected.cdsid && point.name !== selectedStaffEmployee?.name,
  );
  const otherStaffSalesScatterPoints = nationalStaffSalesPopulation.filter(
    (point) => point.cdsid !== selected.cdsid,
  );
  const staffSalesNationalAverage = nationalStaffSalesPopulation.length
    ? nationalStaffSalesPopulation.reduce(
        (sum, point) => sum + point.deliveredSales,
        0,
      ) / nationalStaffSalesPopulation.length
    : null;
  const staffSalesMax = Math.max(
    1,
    ...nationalStaffSalesPopulation.map((point) => point.deliveredSales),
  );
  const staffSalesTickStep = Math.max(5, Math.ceil(staffSalesMax / 25) * 5);
  const staffSalesScaleMax = staffSalesTickStep * 5;
  const staffSalesScatterY = (sales: number) =>
    staffScatterPlot.bottom -
    (Math.max(0, Math.min(staffSalesScaleMax, sales)) / staffSalesScaleMax) *
      (staffScatterPlot.bottom - staffScatterPlot.top);
  const staffSalesYTicks = Array.from(
    { length: 6 },
    (_, index) => index * staffSalesTickStep,
  );
  const groupVocAverage = averageOf(groupItems, "vocScore");
  const groupHappyAverage = averageOf(groupItems, "happyScore");
  const groupCombinedAverage = averageOf(groupItems, "combined");
  const groupVocRateAverage = averageOf(groupItems, "vocAverage");
  const groupHappyRateAverage = averageOf(groupItems, "happyAverage");
  const groupAverageLabel =
    view === "dealer"
      ? selected.dealer
      : view === "showroom"
        ? "전국 전시장"
        : view === "region"
          ? selected.region
          : selected.size;
  const selectedAverageLabel = displayShowroomNameWithoutBrand(selected.showroom);
  const displayedGroupAverage = Number(groupCombinedAverage.toFixed(1));
  const displayedSelectedAverage = Number(selectedPoint.combined.toFixed(1));
  const selectedAverageDelta = Number(
    (displayedSelectedAverage - displayedGroupAverage).toFixed(1),
  );
  const selectedAverageDeltaTone =
    selectedAverageDelta > 0
      ? "delta-positive"
      : selectedAverageDelta < 0
        ? "delta-negative"
        : "delta-neutral";
  const selectedAverageDeltaArrow =
    selectedAverageDelta > 0 ? "▲" : selectedAverageDelta < 0 ? "▼" : "―";
  const selectedRank =
    groupItems.findIndex((item) => item.cdsid === selected.cdsid) + 1;
  const safeSelectedRank = selectedRank || groupItems.length;
  const selectedNationalRank =
    nationalCumulativeAnalysisPoints.findIndex(
      (item) => item.cdsid === selected.cdsid,
    ) + 1;
  const summaryRank =
    view === "showroom"
      ? selectedNationalRank || nationalCumulativeAnalysisPoints.length
      : safeSelectedRank;
  const summaryRankTotal =
    view === "showroom"
      ? nationalCumulativeAnalysisPoints.length
      : groupItems.length;
  const summaryRankLabel =
    view === "showroom"
      ? "전국 전시장 내"
      : view === "size"
        ? `${selected.size} 사이즈 내`
        : view === "region"
          ? `${selected.region} 내`
          : `${selected.dealer} 내`;
  const rankWindowSize = 7;
  const rankWindowRadius = Math.floor(rankWindowSize / 2);
  const rankWindowStart = Math.min(
    Math.max(0, safeSelectedRank - 1 - rankWindowRadius),
    Math.max(0, groupItems.length - rankWindowSize),
  );
  const rankRows = groupItems.slice(
    rankWindowStart,
    rankWindowStart + rankWindowSize,
  );
  if (
    !rankRows.some((item) => item.cdsid === selected.cdsid) &&
    selectedPoint
  ) {
    rankRows.push(selectedPoint);
  }
  const groupLabel =
    view === "dealer"
      ? selected.dealer
      : view === "region"
        ? selected.region
        : view === "size"
          ? `${selected.size} 사이즈`
          : "전국 전시장";
  const rankingTitle =
    view === "showroom"
      ? "전국 전시장 내 순위"
      : view === "size"
        ? `${selected.size} 사이즈 내 순위`
        : view === "region"
          ? `${selected.region} 내 순위`
          : view === "dealer"
            ? `${selected.dealer} 내 순위`
        : `${groupLabel} 순위`;
  const scatterStyle = {
    "--avg-x": `${clamp(((groupHappyRateAverage - 65) / 35) * 100)}%`,
    "--avg-y": `${clamp(((groupVocRateAverage - 75) / 25) * 100)}%`,
  } as CSSProperties;
  const denseScatter = groupItems.length > 12;
  const scatterCallouts = useMemo(
    () =>
      buildScatterCalloutLayout(
        groupItems,
        scatterSize.width,
        scatterSize.height,
        selected.cdsid,
        denseScatter,
      ),
    [
      denseScatter,
      groupItems,
      scatterSize.height,
      scatterSize.width,
      selected.cdsid,
    ],
  );

  useEffect(() => {
    const scatter = scatterRef.current;
    if (!scatter) return;

    const updateSize = () => {
      const bounds = scatter.getBoundingClientRect();
      const width = Math.round(bounds.width);
      const height = Math.round(bounds.height);
      if (!width || !height) return;
      setScatterSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };

    updateSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(scatter);
    return () => observer.disconnect();
  }, []);

  const revealAnalysisWorkspace = () => {
    window.requestAnimationFrame(() => {
      const workspace = analysisWorkspaceRef.current;
      if (!workspace) return;

      const bounds = workspace.getBoundingClientRect();
      const isFixedHeader = window.matchMedia("(min-width: 761px)").matches;
      const fixedHeaderBottom = isFixedHeader
        ? (stickyShellRef.current?.getBoundingClientRect().bottom ?? 0)
        : 0;
      const visibleHeight = Math.max(
        0,
        Math.min(bounds.bottom, window.innerHeight) -
          Math.max(bounds.top, fixedHeaderBottom),
      );
      const enoughIsVisible =
        visibleHeight >= Math.min(240, bounds.height * 0.5);
      if (enoughIsVisible) return;

      const targetTop =
        window.scrollY + bounds.top - fixedHeaderBottom - 8;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  };

  const changeView = (nextView: AnalysisView) => {
    revealAnalysisWorkspace();
    if (nextView === view) return;
    scatterMotionTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    scatterMotionTimersRef.current = [];
    setHoveredCdsid(null);
    setPinnedCdsid(null);
    setScatterMotionStage("guides");
    setView(nextView);
    scatterMotionTimersRef.current.push(
      window.setTimeout(() => setScatterMotionStage("zones"), 105),
      window.setTimeout(() => setScatterMotionStage("points"), 185),
      window.setTimeout(() => setScatterMotionStage("settled"), 470),
    );
    const nextRoute = `/dashboard/${selected.cdsid}/analysis?view=${nextView}`;
    if (window.location.pathname.startsWith("/data-dashboard/")) {
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = nextRoute;
      window.history.replaceState(null, "", nextUrl.toString());
    } else {
      window.history.replaceState(null, "", nextRoute);
    }
  };

  const resetPageScrollForHeaderNavigation = (
    event: ReactMouseEvent<HTMLAnchorElement>,
  ) => {
    event.currentTarget.blur();
    forcePageScrollToTop();
  };

  const toggleLinkedShowroom = (cdsid: string) => {
    setPinnedCdsid((current) => (current === cdsid ? null : cdsid));
  };

  const linkedCdsid = hoveredCdsid ?? pinnedCdsid;

  return (
    <main className="competitive-analysis-page">
      <div className="analysis-sticky-anchor" ref={stickyAnchorRef}>
      <div className="analysis-sticky-shell" ref={stickyShellRef}>
        <header className="dashboard-identity-header analysis-header">
          <DashboardHeaderLead
            title={`${displayShowroomName(selected.showroom)} 분석`}
            accessDate={accessDate}
            titleClassName="analysis-title"
          />
        <div className="analysis-context" aria-label="현재 전시장 정보">
          <Link
            className="analysis-context-item"
            href={`/dashboard/${selected.cdsid}`}
            scroll={false}
            aria-label={`${displayShowroomName(selected.showroom)} 현황으로 이동`}
            onClick={resetPageScrollForHeaderNavigation}
          >
            <span
              className="identity-icon identity-icon--dealer"
              aria-hidden="true"
            />
            <small>딜러사</small>
            <strong>{selected.dealer}</strong>
          </Link>
          <Link
            className="analysis-context-item"
            href={`/dashboard/${selected.cdsid}`}
            scroll={false}
            aria-label={`${displayShowroomName(selected.showroom)} 현황으로 이동`}
            onClick={resetPageScrollForHeaderNavigation}
          >
            <span
              className="identity-icon identity-icon--region"
              aria-hidden="true"
            />
            <small>권역별</small>
            <strong>{selected.region}</strong>
          </Link>
          <Link
            className="analysis-context-item"
            href={`/dashboard/${selected.cdsid}`}
            scroll={false}
            aria-label={`${displayShowroomName(selected.showroom)} 현황으로 이동`}
            onClick={resetPageScrollForHeaderNavigation}
          >
            <span
              className="identity-icon identity-icon--size"
              aria-hidden="true"
            />
            <small>사이즈</small>
            <strong>{selected.size}</strong>
          </Link>
          <Link
            className="analysis-context-item"
            href={`/dashboard/${selected.cdsid}`}
            scroll={false}
            aria-label={`${displayShowroomName(selected.showroom)} 현황으로 이동`}
            onClick={resetPageScrollForHeaderNavigation}
          >
            <span className="identity-profile-icon" aria-hidden="true" />
            <small>지점장</small>
            <strong>{selected.manager}</strong>
          </Link>
        </div>
        </header>

        <nav className="analysis-tabs" aria-label="경쟁력 분석 기준">
          {(Object.keys(viewMeta) as AnalysisView[]).map((key) => (
            <button
              key={key}
              type="button"
              className={view === key ? "active" : ""}
              aria-pressed={view === key}
              onClick={() => changeView(key)}
            >
              <span>{viewMeta[key].label}</span>
              <small>
                / {key === "dealer"
                  ? `${selected.dealer} ${dealerShowroomCount}개소`
                  : key === "region"
                    ? `${selected.region} ${regionShowroomCount}개소`
                    : key === "size"
                      ? `${selected.size} ${sizeShowroomCount}개소`
                      : "전국 39개소"}
              </small>
            </button>
          ))}
        </nav>

        <section className="analysis-summary-grid">
        <article className="analysis-summary-card satisfaction">
          <div>
            <span className="analysis-summary-title">
              종합 만족도 평균 누적
            </span>
            <ul className="analysis-summary-breakdown">
              <li>VOC 상담 만족도</li>
              <li>ONE Voice 시승 만족도</li>
              <li>ONE Voice 출고 만족도</li>
            </ul>
          </div>
          <AnimatedAnalysisScore value={selectedPoint.vocScore} sequence={0} />
          <p className="analysis-quarter-values" aria-label={`Q1 ${displayQuarterNumber(selected.q1?.voc)}, Q2 ${displayQuarterNumber(selected.voc)}, Q3 미집계, Q4 미집계`}>
            <span><b>Q1</b><strong>{displayQuarterNumber(selected.q1?.voc)}</strong></span>
            <span><b>Q2</b><strong>{displayQuarterNumber(selected.voc)}</strong></span>
            <span><b>Q3</b></span>
            <span><b>Q4</b></span>
          </p>
          <em
            className={
              selectedPoint.vocScore >= groupVocAverage ? "positive" : "negative"
            }
          >
            {groupLabel} 누적평균 {displayNumber(groupVocAverage)}점 대비{" "}
            {selectedPoint.vocScore > groupVocAverage
              ? "▲ "
              : selectedPoint.vocScore < groupVocAverage
                ? "▼ "
                : "― "}
            {displayNumber(Math.abs(selectedPoint.vocScore - groupVocAverage))}점
          </em>
        </article>

        <article className="analysis-summary-card happycall">
          <div>
            <span className="analysis-summary-title">
              해피콜 이행률 평균 누적
            </span>
            <ul className="analysis-summary-breakdown">
              <li>VOC 상담 후 해피콜(24시간 이내 시행)</li>
              <li>ONE Voice 출고 후 해피콜(24시간 이내 시행)</li>
            </ul>
          </div>
          <AnimatedAnalysisScore value={selectedPoint.happyScore} sequence={1} />
          <p className="analysis-quarter-values" aria-label={`Q1 ${displayQuarterNumber(selected.q1?.happyCall)}, Q2 ${displayQuarterNumber(selected.happyCall)}, Q3 미집계, Q4 미집계`}>
            <span><b>Q1</b><strong>{displayQuarterNumber(selected.q1?.happyCall)}</strong></span>
            <span><b>Q2</b><strong>{displayQuarterNumber(selected.happyCall)}</strong></span>
            <span><b>Q3</b></span>
            <span><b>Q4</b></span>
          </p>
          <em
            className={
              selectedPoint.happyScore >= groupHappyAverage
                ? "positive"
                : "negative"
            }
          >
            {groupLabel} 누적평균 {displayNumber(groupHappyAverage)}점 대비{" "}
            {selectedPoint.happyScore > groupHappyAverage
              ? "▲ "
              : selectedPoint.happyScore < groupHappyAverage
                ? "▼ "
                : "― "}
            {displayNumber(Math.abs(selectedPoint.happyScore - groupHappyAverage))}점
          </em>
        </article>

        <article className="analysis-summary-card balance">
          <div>
            <span className="analysis-summary-title">
              합산 경쟁력
              <span className="analysis-quarter-badges" aria-label="Q1, Q2 누적">
                <b>Q1</b><b>Q2</b>
              </span>
            </span>
            <small>분기별 합산점수 평균</small>
          </div>
          <AnimatedAnalysisScore value={selectedPoint.combined} sequence={2} />
          <p className="analysis-quarter-values" aria-label={`Q1 ${displayQuarterNumber(selectedQ1Combined)}, Q2 ${displayQuarterNumber(selectedQ2Combined)}, Q3 미집계, Q4 미집계`}>
            <span><b>Q1</b><strong>{displayQuarterNumber(selectedQ1Combined)}</strong></span>
            <span><b>Q2</b><strong>{displayQuarterNumber(selectedQ2Combined)}</strong></span>
            <span><b>Q3</b></span>
            <span><b>Q4</b></span>
          </p>
          <em>
            {summaryRankLabel} {summaryRank}위 / 전체 {summaryRankTotal}
          </em>
        </article>
        </section>
      </div>
      </div>

      <section className="analysis-workspace" ref={analysisWorkspaceRef}>
        <article className="analysis-scatter-card">
          <header className="analysis-card-heading">
            <div>
              <h2>종합 만족도 × 해피콜 이행률</h2>
            </div>
            <div className="analysis-legend" aria-label="차트 범례">
              <span className="selected">
                {displayShowroomNameWithoutBrand(selected.showroom)}
              </span>
              <span>비교 전시장</span>
              <span className="average">그룹 평균</span>
            </div>
          </header>

          <div className="analysis-scatter-shell">
            <div className="scatter-y-title">종합 만족도</div>
            <div
              className={`analysis-scatter scatter-motion-${scatterMotionStage}`}
              style={scatterStyle}
              ref={scatterRef}
            >
              <span className="scatter-zone balanced" aria-hidden="true" />
              <span className="scatter-zone improve" aria-hidden="true" />
              <span className="scatter-quadrant top-left">만족도 우세</span>
              <span className="scatter-quadrant top-right">균형 우수</span>
              <span className="scatter-quadrant bottom-left">개선 집중</span>
              <span className="scatter-quadrant bottom-right">해피콜 우세</span>
              <i className="scatter-average-line vertical" />
              <i className="scatter-average-line horizontal" />
              <span className="scatter-average-value vertical">
                <span>해피콜 이행률</span>
                <strong>평균 {displayNumber(groupHappyRateAverage)}점</strong>
              </span>
              <span className="scatter-average-value horizontal">
                <span>종합 만족도</span>
                <strong>평균 {displayNumber(groupVocRateAverage)}점</strong>
              </span>
              {groupItems.map((item) => {
                const pointX = clamp(
                  ((item.happyAverage - 65) / 35) * 100,
                );
                const pointY = clamp(
                  ((item.vocAverage - 75) / 25) * 100,
                );
                const isSelected = item.cdsid === selected.cdsid;
                const isHovered = !isSelected && linkedCdsid === item.cdsid;
                const callout = scatterCallouts.get(item.cdsid) ?? {
                  offsetX: 16,
                  offsetY: -16,
                  tailX: 5,
                  tailY: 5,
                  labelWidth: 52,
                  labelHeight: 21,
                  placement: "right-up" as const,
                };
                const pointStyle = {
                  "--point-x": `${pointX}%`,
                  "--point-y": `${pointY}%`,
                  "--callout-x": `${callout.offsetX}px`,
                  "--callout-y": `${callout.offsetY}px`,
                  "--callout-tail-x": `${callout.tailX}px`,
                  "--callout-tail-y": `${callout.tailY}px`,
                  "--callout-width": `${callout.labelWidth}px`,
                  "--callout-height": `${callout.labelHeight}px`,
                } as CSSProperties;
                const pointLabel = `${displayShowroomName(item.showroom)} · 분기 평균 만족도 ${displayNumber(
                  item.vocAverage,
                )} · 분기 평균 해피콜 ${displayNumber(item.happyAverage)}`;
                return (
                  <span
                    key={item.cdsid}
                    className={`scatter-point ${
                      isSelected
                        ? "selected"
                        : item.combined >= groupCombinedAverage
                          ? "above"
                          : "below"
                    } label-${callout.placement} ${
                      denseScatter ? "dense" : ""
                    } ${isHovered ? "hovered" : ""}`}
                    style={pointStyle}
                    title={pointLabel}
                    aria-label={pointLabel}
                    role={!isSelected ? "button" : undefined}
                    aria-pressed={!isSelected ? pinnedCdsid === item.cdsid : undefined}
                    tabIndex={!isSelected ? 0 : undefined}
                    onMouseEnter={() => setHoveredCdsid(item.cdsid)}
                    onMouseLeave={() => setHoveredCdsid(null)}
                    onFocus={() => setHoveredCdsid(item.cdsid)}
                    onBlur={() => setHoveredCdsid(null)}
                    onClick={() => !isSelected && toggleLinkedShowroom(item.cdsid)}
                    onKeyDown={(event) => {
                      if (!isSelected && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        toggleLinkedShowroom(item.cdsid);
                      }
                    }}
                  >
                    <i />
                    <b
                      className={`scatter-label ${
                        isSelected ? "selected" : "comparison"
                      }`}
                      style={{ opacity: 1, visibility: "visible" }}
                    >
                      {displayShowroomName(item.showroom)}
                    </b>
                  </span>
                );
              })}
              <span className="scatter-y-max">100</span>
              <span className="scatter-y-min">75</span>
              <span className="scatter-x-min">65</span>
              <span className="scatter-x-max">100</span>
            </div>
            <div className="scatter-x-title">해피콜 이행률</div>
          </div>
        </article>

        <article className="analysis-ranking-card">
          <header className="analysis-card-heading">
            <div>
              <h2>
                {view === "size" ? (
                  <>
                    <span className="english-title">{selected.size}</span> 사이즈 내 순위
                  </>
                ) : (
                  rankingTitle
                )}
              </h2>
            </div>
            <strong><b>{groupItems.length}</b>개소</strong>
          </header>
          <div className="analysis-ranking-head" aria-hidden="true">
            <span>순위 · 전시장</span>
            <span>만족도 평균</span>
            <span>해피콜 평균</span>
            <span>합산점수</span>
          </div>
          <div className="analysis-ranking-list">
            {rankRows.map((item) => {
              const rank =
                groupItems.findIndex((groupItem) => groupItem.cdsid === item.cdsid) +
                1;
              const isSelected = item.cdsid === selected.cdsid;
              const isHovered = !isSelected && linkedCdsid === item.cdsid;
              return (
                <div
                  className={isSelected ? "selected" : isHovered ? "hovered" : ""}
                  key={item.cdsid}
                  role={!isSelected ? "button" : undefined}
                  tabIndex={!isSelected ? 0 : undefined}
                  aria-label={!isSelected ? `${displayShowroomName(item.showroom)}를 차트에서 강조` : undefined}
                  aria-pressed={!isSelected ? pinnedCdsid === item.cdsid : undefined}
                  onMouseEnter={() => setHoveredCdsid(item.cdsid)}
                  onMouseLeave={() => setHoveredCdsid(null)}
                  onFocus={() => setHoveredCdsid(item.cdsid)}
                  onBlur={() => setHoveredCdsid(null)}
                  onClick={() => !isSelected && toggleLinkedShowroom(item.cdsid)}
                  onKeyDown={(event) => {
                    if (!isSelected && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      toggleLinkedShowroom(item.cdsid);
                    }
                  }}
                >
                  <span className="analysis-rank">
                    <strong>{rank}</strong>
                    <span>
                      <em>{displayShowroomNameWithoutBrand(item.showroom)}</em>
                      <small>
                        {item.dealer} · {item.region} · {item.size}
                      </small>
                    </span>
                  </span>
                  <b>{displayRankingNumber(item.vocScore)}</b>
                  <b>{displayRankingNumber(item.happyScore)}</b>
                  <strong>{displayRankingNumber(item.combined)}</strong>
                </div>
              );
            })}
          </div>
          <footer>
            <span>
              {groupAverageLabel}
              <strong>{displayRankingNumber(groupCombinedAverage)}</strong>
            </span>
            <span>
              {selectedAverageLabel}
              <strong>{displayRankingNumber(selectedPoint.combined)}</strong>
            </span>
            <span className={`analysis-average-delta ${selectedAverageDeltaTone}`}>
              평균 대비
              <strong>
                {selectedAverageDeltaArrow} {displayRankingNumber(Math.abs(selectedAverageDelta))}점
              </strong>
            </span>
          </footer>
        </article>
      </section>

      {selectedStaffAnalysis ? (
        <>
          <div
            className="growth-navigation-sticky-summary"
            ref={growthNavigationSummaryRef}
            aria-label={`${displayShowroomName(selected.showroom)} 소속 영업직원 성장 내비게이션 고정 요약`}
          >
          <header className="growth-navigation-heading">
            <div>
              <h2>소속 영업직원 성장 내비게이션</h2>
            </div>
            <div className="growth-navigation-source" aria-label="분석 기준">
              <span>
                <b>Sales-DMS</b>
                <i aria-hidden="true">/</i>
                <strong>{staffAnalysisSource.rosterCheckedAt.replaceAll("-", "").slice(2)} 기준</strong>
              </span>
              <span>
                <b>VOC 상담만족도</b>
                <i aria-hidden="true">/</i>
                <strong>23 ~ 26 YTD 기준</strong>
              </span>
            </div>
          </header>

          <section className="growth-profile-strip" aria-label="영업직원 상담 분석 요약">
              <div className="growth-profile-person">
                <span className="growth-profile-photo" aria-hidden="true">
                  {selectedStaffProfile ? (
                    <img src={selectedStaffProfile.image} alt="" draggable={false} />
                  ) : (
                    <img
                      className="staff-profile-silhouette"
                      src={selectedStaffFallbackProfileImage}
                      alt=""
                      draggable={false}
                    />
                  )}
                </span>
                <span>
                  <small>영업직원</small>
                  <strong>
                    {selectedStaffEmployee?.name ?? "―"}
                    <i>
                      {selectedStaffEmployee?.jobTitle ?? ""} · {displayTwoDigitCount(selectedStaffTenureYears ?? 0)}년 {displayTwoDigitCount(selectedStaffTenureMonths ?? 0)}개월{selectedStaffTenureTopPercent === null ? null : (
                        <em>(상위 {selectedStaffTenureTopPercent.toFixed(1)}%)</em>
                      )}
                    </i>
                  </strong>
                </span>
              </div>
              <div className="growth-profile-metric">
                <span>고객상담 평균만족도</span>
                <strong>
                  {selectedStaffScoring?.average?.toFixed(1) ?? "―"}
                  {selectedStaffScoring?.average === null || !selectedStaffScoring ? null : <small>점</small>}
                  <small>/10점</small>
                  {selectedStaffSatisfactionTopPercent === null ? null : (
                    <small className="growth-profile-satisfaction-rank">
                      (상위 {selectedStaffSatisfactionTopPercent.toFixed(1)}%)
                    </small>
                  )}
                </strong>
              </div>
              <div className="growth-profile-metric growth-profile-sales">
                <span>누적 판매대수</span>
                <strong>
                  {selectedStaffDeliveredSales}<small>대</small>
                  <small className="growth-profile-sales-context">
                    / 월 평균 {selectedStaffMonthlySalesAverage === null ? "―" : `${selectedStaffMonthlySalesAverage.toFixed(1)}대`}
                    {selectedStaffSalesTopPercent === null ? null : <i>(상위 {selectedStaffSalesTopPercent.toFixed(1)}%)</i>}
                  </small>
                </strong>
              </div>
              <div className="growth-profile-metric">
                <span>자료 신뢰도</span>
                <strong className={`confidence-${selectedStaffEvidenceLevel}`}>
                  {selectedStaffEvidenceLevel}
                  <small className="growth-profile-evidence-count">회신 {selectedStaffResponses}건 · 코멘트 {selectedStaffCommentTotalMentions}건(중복포함)</small>
                </strong>
              </div>
              <div className="growth-profile-metric growth-profile-certification">
                <span>인증직원 선정</span>
                <strong
                  aria-label={`누적 인증 기록 Grand ${selectedStaffCertificationCounts.Grand}회, Advanced ${selectedStaffCertificationCounts.Advanced}회, Certified ${selectedStaffCertificationCounts.Certified}회`}
                >
                  <b>G<i aria-hidden="true">-</i>{selectedStaffCertificationCounts.Grand}</b>
                  <em aria-hidden="true">/</em>
                  <b>A<i aria-hidden="true">-</i>{selectedStaffCertificationCounts.Advanced}</b>
                  <em aria-hidden="true">/</em>
                  <b>C<i aria-hidden="true">-</i>{selectedStaffCertificationCounts.Certified}</b>
                </strong>
              </div>
          </section>
          <div className="growth-navigation-pinned-headings">
            <div className="growth-staff-roster-columns" aria-hidden="true">
              <span>영업직원 / 입사일자</span>
              <span>고객상담 평균만족도</span>
              <span>누적 판매대수</span>
            </div>
            <div className="growth-navigation-pinned-capabilities" aria-hidden="true">
              <div className="growth-navigation-pinned-heading consultation">
                <span>고객상담 역량</span>
              </div>
              <div className="growth-navigation-pinned-heading sales">
                <span>영업활동 역량</span>
              </div>
            </div>
          </div>
          </div>

        <section
          className="growth-navigation"
          aria-label={`${displayShowroomName(selected.showroom)} 소속 영업직원 성장 내비게이션`}
        >
          <div className="growth-navigation-workspace">

            <aside className="growth-staff-roster" aria-label="소속 영업직원 선택 · 입사일자 오래된 순">
              <div
                className="growth-staff-roster-list"
                ref={growthStaffRosterRef}
                onPointerDown={beginGrowthStaffRosterDrag}
                onPointerMove={moveGrowthStaffRosterDrag}
                onPointerUp={endGrowthStaffRosterDrag}
                onPointerCancel={endGrowthStaffRosterDrag}
                onWheel={scrollGrowthStaffRosterOnly}
                onClickCapture={preventDraggedGrowthStaffSelection}
              >
                {rankedSalesStaff.map(({ employee, average, deliveredSales }) => {
                  const isSelected = employee.name === selectedStaffEmployee?.name;
                  const isTeamLeader = employee.role === "영업팀장" || employee.jobTitle === "팀장";
                  return (
                    <button
                      type="button"
                      className={isSelected ? "selected" : ""}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedStaffName(employee.name);
                        setSmilingStaffName(null);
                      }}
                      key={employee.name}
                    >
                      <span>
                        <strong>
                          <span className="growth-staff-name">{employee.name}</span>
                          {isTeamLeader ? (
                            <i className="growth-staff-lead-badge" aria-label="팀장" title="팀장">L</i>
                          ) : null}
                        </strong>
                        <small>{formatStaffShortDate(employee.hireDate)}</small>
                      </span>
                      <b>{average === null ? "―" : average.toFixed(1)}</b>
                      <em aria-label={`2026년 누적 판매 ${deliveredSales ?? 0}대`}>
                        <b>{deliveredSales ?? "―"}</b>
                      </em>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div
              className="growth-navigation-detail"
              ref={growthNavigationDetailRef}
              role="region"
              aria-label="선택 영업직원의 상담 및 영업활동 분석 세부정보"
              tabIndex={0}
              onPointerDown={beginGrowthNavigationDetailDrag}
              onPointerMove={moveGrowthNavigationDetailDrag}
              onPointerUp={endGrowthNavigationDetailDrag}
              onPointerCancel={endGrowthNavigationDetailDrag}
            >
              <div className="growth-capability-columns">
              <section className="growth-capability consultation">
                <div className="growth-capability-grid">
                  <article className="growth-position-card">
                    <header>
                      <div>
                        <span>상담 역량 위치</span>
                        <strong>{selectedStaffGrowthLabel}</strong>
                      </div>
                      <small className="growth-position-benchmarks">
                        <span className="showroom-average"><i aria-hidden="true" />{displayShowroomNameWithoutBrand(selected.showroom)} 평균 {selectedShowroomStaffAverage === null ? "―" : selectedShowroomStaffAverage.toFixed(1)}점</span>
                        <span>동일연차 평균 {selectedStaffTenureFinalScore === null ? "―" : (selectedStaffTenureFinalScore / 10).toFixed(1)}점</span>
                      </small>
                    </header>
                    <div
                      className={`growth-zone-gauge${selectedStaffGrowthZone === null ? " no-evidence" : ""}`}
                      style={{ "--growth-needle-angle": `${selectedStaffGrowthNeedleAngle}deg` } as CSSProperties}
                      data-zone={selectedStaffGrowthZone ?? "none"}
                    >
                      <svg
                        viewBox="0 0 420 230"
                        role="img"
                        aria-label={`집중 코칭, 성장 가속, 성과 확산 중 ${selectedStaffGrowthLabel}${selectedStaffPeerDelta === null ? "" : `, 동일연차 평균 대비 ${(selectedStaffPeerDelta / 10).toFixed(1)}점 위치`}`}
                      >
                        <title>상담 역량 타코미터: {selectedStaffGrowthLabel}</title>
                        <g className="growth-gauge-segments">
                          <path className={selectedStaffGrowthZone === 0 ? "coaching active" : "coaching"} d="M45 190 A165 165 0 0 1 127.5 47.1 L156 96.5 A108 108 0 0 0 102 190 Z" />
                          <path className={selectedStaffGrowthZone === 1 ? "accelerating active" : "accelerating"} d="M127.5 47.1 A165 165 0 0 1 292.5 47.1 L264 96.5 A108 108 0 0 0 156 96.5 Z" />
                          <path className={selectedStaffGrowthZone === 2 ? "expanding active" : "expanding"} d="M292.5 47.1 A165 165 0 0 1 375 190 L318 190 A108 108 0 0 0 264 96.5 Z" />
                        </g>
                        {selectedShowroomGrowthAngle === null ? null : (
                          <g
                            className="growth-gauge-showroom-average-marker"
                            style={{ "--growth-showroom-average-angle": `${selectedShowroomGrowthAngle}deg` } as CSSProperties}
                            aria-label={`${displayShowroomNameWithoutBrand(selected.showroom)} 전시장 평균 ${selectedShowroomStaffAverage?.toFixed(1)}점`}
                          >
                            <line x1="34" x2="210" y1="190" y2="190" />
                            <circle cx="38" cy="190" r="2.5" />
                            <title>{displayShowroomNameWithoutBrand(selected.showroom)} 전시장 평균 {selectedShowroomStaffAverage?.toFixed(1)}점</title>
                          </g>
                        )}
                        <g className="growth-gauge-ticks" aria-hidden="true">
                          <circle cx="124" cy="168" r="2.4" /><circle cx="134" cy="146" r="2.4" />
                          <circle cx="149" cy="128" r="2.4" /><circle cx="167" cy="114" r="2.4" />
                          <circle cx="188" cy="105" r="2.4" /><circle cx="210" cy="102" r="2.4" />
                          <circle cx="232" cy="105" r="2.4" /><circle cx="253" cy="114" r="2.4" />
                          <circle cx="271" cy="128" r="2.4" /><circle cx="286" cy="146" r="2.4" />
                          <circle cx="296" cy="168" r="2.4" />
                        </g>
                        <g className="growth-gauge-label coaching-label">
                          <text x="101" y="102">집중 코칭</text>
                          <text className="detail" x="101" y="121">한 행동부터 교정</text>
                        </g>
                        <g className="growth-gauge-label accelerating-label">
                          <text x="210" y="54">성장 가속</text>
                          <text className="detail" x="210" y="73">강점 유지·전환 보완</text>
                        </g>
                        <g className="growth-gauge-label expanding-label">
                          <text x="319" y="102">성과 확산</text>
                          <text className="detail" x="319" y="121">우수 행동을 확산</text>
                        </g>
                        {selectedStaffGrowthZone !== null && (
                          <g
                            className="growth-gauge-needle"
                            key={`${selectedStaffEmployee?.cdsid ?? selectedStaffEmployee?.name ?? "none"}-${selectedStaffGrowthZone}`}
                            aria-hidden="true"
                          >
                            <path d="M220 171.5 L92 178 L220 184.5 Z" />
                            <circle cx="210" cy="178" r="13" />
                            <circle className="needle-cap" cx="210" cy="178" r="5" />
                          </g>
                        )}
                        <text className={`growth-gauge-current ${selectedStaffGrowthDeltaTone}`} x="210" y="209">{selectedStaffGrowthCalculation}</text>
                      </svg>
                    </div>
                  </article>

                  <article className="growth-scatter-card" ref={growthConsultationScatterRef}>
                    <header>
                      <div><strong>근속기간 × 고객상담 평균만족도</strong></div>
                    </header>
                    <svg viewBox="0 0 470 210" role="img" aria-label="전국 영업직원 근속기간별 고객상담 평균만족도 분포, 상단 점수 구간 확대">
                      <desc>전체 점수 범위를 유지하면서 8~10점 구간을 넓게 표시합니다.</desc>
                      <defs>
                        <clipPath id="consultation-selected-staff-photo">
                          <circle r="7.5" />
                        </clipPath>
                      </defs>
                      {staffScatterYTicks.map((tick) => {
                        const y = staffScatterY(tick);
                        return <g className="growth-scatter-grid" key={`growth-y-${tick}`}>
                          <line x1={staffScatterPlot.left} x2={staffScatterPlot.right} y1={y} y2={y} />
                          <text x={staffScatterPlot.left - 7} y={y + 3} textAnchor="end">{(tick / 10).toFixed(0)}</text>
                        </g>;
                      })}
                      {staffScatterXTicks.map((tick) => {
                        const x = staffScatterX(tick);
                        return <g className="growth-scatter-grid" key={`growth-x-${tick}`}>
                          <line x1={x} x2={x} y1={staffScatterPlot.top} y2={staffScatterPlot.bottom} />
                          <text x={x} y={staffScatterPlot.bottom + 17} textAnchor="middle">{tick.toFixed(0)}</text>
                        </g>;
                      })}
                      <text className="growth-scatter-y-label" x="12" y="93" textAnchor="middle">고객상담 평균만족도</text>
                      <text className="growth-scatter-x-label" x="245" y="202" textAnchor="middle">근속기간(년)</text>
                      {selectedStaffScatterPoint ? (
                        <g
                          className="growth-scatter-selected-guides is-targeting"
                          aria-hidden="true"
                          key={`consultation-guides-${selectedStaffEmployee?.name ?? "selected"}`}
                        >
                          <line
                            className="guide-arm guide-arm-from-top"
                            x1={staffScatterX(selectedStaffScatterPoint.tenureYears)}
                            x2={staffScatterX(selectedStaffScatterPoint.tenureYears)}
                            y1={staffScatterPlot.top}
                            y2={staffScatterY(selectedStaffScatterPoint.finalScore)}
                          />
                          <line
                            className="guide-arm guide-arm-from-bottom"
                            x1={staffScatterX(selectedStaffScatterPoint.tenureYears)}
                            x2={staffScatterX(selectedStaffScatterPoint.tenureYears)}
                            y1={staffScatterPlot.bottom}
                            y2={staffScatterY(selectedStaffScatterPoint.finalScore)}
                          />
                          <line
                            className="guide-arm guide-arm-from-left"
                            x1={staffScatterPlot.left}
                            x2={staffScatterX(selectedStaffScatterPoint.tenureYears)}
                            y1={staffScatterY(selectedStaffScatterPoint.finalScore)}
                            y2={staffScatterY(selectedStaffScatterPoint.finalScore)}
                          />
                          <line
                            className="guide-arm guide-arm-from-right"
                            x1={staffScatterPlot.right}
                            x2={staffScatterX(selectedStaffScatterPoint.tenureYears)}
                            y1={staffScatterY(selectedStaffScatterPoint.finalScore)}
                            y2={staffScatterY(selectedStaffScatterPoint.finalScore)}
                          />
                        </g>
                      ) : null}
                      {staffScatterNationalAverage !== null ? (
                        <line
                          className="growth-scatter-average-line"
                          x1={staffScatterPlot.left}
                          x2={staffScatterPlot.right}
                          y1={staffScatterY(staffScatterNationalAverage)}
                          y2={staffScatterY(staffScatterNationalAverage)}
                        />
                      ) : null}
                      <g className="growth-scatter-population">
                        {otherStaffScatterPoints.map((point) => (
                          <circle
                            cx={staffScatterX(point.tenureYears)}
                            cy={staffScatterY(point.finalScore)}
                            r={Math.min(5.2, 2.2 + Math.sqrt(point.responses) * 0.42)}
                            key={point.key}
                          ><title>{`${point.name} · 만족도 ${(point.finalScore / 10).toFixed(1)} · 회신 ${point.responses}건`}</title></circle>
                        ))}
                      </g>
                      <g className="growth-scatter-showroom">
                        {sameShowroomStaffScatterPoints.map((point) => (
                          <circle
                            cx={staffScatterX(point.tenureYears)}
                            cy={staffScatterY(point.finalScore)}
                            r={Math.min(6, 2.8 + Math.sqrt(point.responses) * 0.46)}
                            key={point.key}
                          ><title>{`${point.name} · ${displayShowroomNameWithoutBrand(selected.showroom)} 전시장 · 만족도 ${(point.finalScore / 10).toFixed(1)} · 회신 ${point.responses}건`}</title></circle>
                        ))}
                      </g>
                      {selectedStaffScatterPoint ? (
                        <g className="growth-scatter-selected-photo" transform={`translate(${staffScatterX(selectedStaffScatterPoint.tenureYears)} ${staffScatterY(selectedStaffScatterPoint.finalScore)})`} key={`consultation-photo-${selectedStaffEmployee?.name ?? "selected"}`}>
                          <g className="photo-reveal">
                            <circle className="photo-acquire-flash" r="9.8" />
                            <circle className="photo-halo" r="9.8" />
                            <circle className="photo-backdrop" r="9.4" />
                            {selectedStaffProfile ? (
                              <image
                                href={selectedStaffProfile.image}
                                x="-7.5"
                                y="-7.5"
                                width="15"
                                height="15"
                                preserveAspectRatio="xMidYMin slice"
                                clipPath="url(#consultation-selected-staff-photo)"
                              />
                            ) : (
                              <image
                                className="photo-fallback-silhouette"
                                href={selectedStaffFallbackProfileImage}
                                x="-7.5"
                                y="-7.5"
                                width="15"
                                height="15"
                                preserveAspectRatio="xMidYMid meet"
                                clipPath="url(#consultation-selected-staff-photo)"
                              />
                            )}
                            <circle className="photo-ring" r="8" />
                          </g>
                        </g>
                      ) : null}
                      {staffScatterNationalAverage !== null ? (
                        <g
                          className="growth-scatter-average-label"
                          transform={`translate(${staffScatterPlot.right - 28} ${staffScatterY(staffScatterNationalAverage) - 36})`}
                        >
                          <path className="pointer" d="M 20 28 L 28 36 L 36 28 Z" />
                          <rect width="56" height="30" rx="4" />
                          <text x="28" y="11" textAnchor="middle">전국 평균</text>
                          <text className="score" x="28" y="23" textAnchor="middle">
                            {(staffScatterNationalAverage / 10).toFixed(1)}점
                          </text>
                        </g>
                      ) : null}
                    </svg>
                    <footer>
                      <span><i />전국 SC</span>
                      <span className="showroom"><i />{displayShowroomNameWithoutBrand(selected.showroom)} SC</span>
                      <span className="selected"><i />{selectedStaffEmployee?.name ?? "선택 직원"}</span>
                      <small className="growth-scatter-evidence-note">원 크기 = 실제 회신 근거</small>
                    </footer>
                  </article>
                </div>

                <div className="growth-evidence-grid">
                  <article className="growth-comment-evidence strength">
                    <header><span>강화({selectedStaffStrengthShare.toFixed(1)}%)</span><strong>중복포함 총 {displayTwoDigitCount(selectedStaffStrengthTotalMentions)}회</strong></header>
                    <div className="growth-comment-bars" key={`strength-bars-${selectedStaffEmployee?.cdsid ?? selectedStaffEmployee?.name ?? "none"}`}>
                      {selectedStaffStrengthKeywords.length ? (
                        <>
                          {[selectedStaffStrengthKeywords.slice(0, 3), selectedStaffStrengthKeywords.slice(3, 6)].map((column, columnIndex) => (
                            <div className="growth-comment-bar-column" key={`strength-${columnIndex}`}>
                              {column.map((keyword, index) => (
                                <div
                                  className="growth-comment-bar"
                                  key={keyword.label}
                                  style={{
                                    "--growth-comment-bar-ratio": `${selectedStaffStrengthTotalMentions > 0 ? (keyword.mentions / selectedStaffStrengthTotalMentions) * 100 : 0}%`,
                                    "--growth-comment-bar-index": columnIndex * 3 + index,
                                  } as CSSProperties}
                                >
                                  <span>{keyword.label}</span>
                                  <i aria-hidden="true"><b /></i>
                                  <small>{displayTwoDigitCount(keyword.mentions)}회 <em>({displayTwoDigitCount(Math.round((keyword.mentions / selectedStaffStrengthTotalMentions) * 100))}%)</em></small>
                                </div>
                              ))}
                            </div>
                          ))}
                        </>
                      ) : <em>분석 가능한 긍정 코멘트가 없습니다.</em>}
                    </div>
                  </article>
                  <article className="growth-comment-evidence improvement">
                    <header><span>수정({selectedStaffImprovementShare.toFixed(1)}%)</span><strong>중복포함 총 {displayTwoDigitCount(selectedStaffImprovementTotalMentions)}회</strong></header>
                    <div className="growth-comment-bars" key={`improvement-bars-${selectedStaffEmployee?.cdsid ?? selectedStaffEmployee?.name ?? "none"}`}>
                      {selectedStaffImprovementKeywords.length ? (
                        <>
                          {[selectedStaffImprovementKeywords.slice(0, 3), selectedStaffImprovementKeywords.slice(3, 6)].map((column, columnIndex) => (
                            <div className="growth-comment-bar-column" key={`improvement-${columnIndex}`}>
                              {column.map((keyword, index) => (
                                <div
                                  className="growth-comment-bar"
                                  key={keyword.label}
                                  style={{
                                    "--growth-comment-bar-ratio": `${selectedStaffImprovementTotalMentions > 0 ? (keyword.mentions / selectedStaffImprovementTotalMentions) * 100 : 0}%`,
                                    "--growth-comment-bar-index": columnIndex * 3 + index,
                                  } as CSSProperties}
                                >
                                  <span>{keyword.label}</span>
                                  <i aria-hidden="true"><b /></i>
                                  <small>{displayTwoDigitCount(keyword.mentions)}회 <em>({displayTwoDigitCount(Math.round((keyword.mentions / selectedStaffImprovementTotalMentions) * 100))}%)</em></small>
                                </div>
                              ))}
                            </div>
                          ))}
                        </>
                      ) : <em>반복 확인된 보완 코멘트가 없습니다.</em>}
                    </div>
                  </article>
                </div>
              </section>

              <section className="growth-capability sales">
                <div className="growth-sales-dashboard">
                  <article className="growth-sales-funnel-card">
                    <header>
                      <div>
                        <strong>상담/ 시승/ 계약 전환율</strong>
                      </div>
                    </header>
                    <div className={`growth-sales-funnel${selectedStaffHasActivityFunnel ? "" : " unavailable"}`}>
                      <div className="growth-sales-stage consultation">
                        <span>상담 고객</span>
                        <strong>{selectedStaffHasActivityFunnel ? selectedStaffConsultationCustomers : "―"}<small>{selectedStaffHasActivityFunnel ? "명" : ""}</small></strong>
                      </div>
                      <i className="growth-sales-transition">
                        <b>{selectedStaffConsultationToTestDriveRate === null || !selectedStaffHasActivityFunnel ? "―" : `${Math.round(selectedStaffConsultationToTestDriveRate)}%`}</b>
                        <span>시승 연결</span>
                      </i>
                      <div className="growth-sales-stage test-drive">
                        <span>시승 고객</span>
                        <strong>{selectedStaffHasActivityFunnel ? selectedStaffTestDriveCustomers : "―"}<small>{selectedStaffHasActivityFunnel ? "명" : ""}</small></strong>
                      </div>
                      <i className="growth-sales-transition">
                        <b>{selectedStaffTestDriveToContractRate === null || !selectedStaffHasActivityFunnel ? "―" : `${Math.round(selectedStaffTestDriveToContractRate)}%`}</b>
                        <span>계약 연결</span>
                      </i>
                      <div className="growth-sales-stage contract">
                        <span>계약 고객</span>
                        <strong>{selectedStaffHasActivityFunnel ? selectedStaffContractCustomers : "―"}<small>{selectedStaffHasActivityFunnel ? "명" : ""}</small></strong>
                      </div>
                      <i className="growth-sales-transition">
                        <b>{selectedStaffContractToDeliveredRate === null || !selectedStaffHasActivityFunnel ? "―" : `${Math.round(selectedStaffContractToDeliveredRate)}%`}</b>
                        <span>출고 연결</span>
                      </i>
                      <div className="growth-sales-stage delivered">
                        <span>실제 출고</span>
                        <strong>{selectedStaffDeliveredSales}<small>대</small></strong>
                      </div>
                    </div>
                    {selectedStaffHasActivityFunnel ? (
                      <footer className="available">
                        <b>활동 기록 연결 완료</b><span>동일 고객·직원 조합의 단계 이동으로 계산</span>
                      </footer>
                    ) : null}
                  </article>
                  <article className="growth-scatter-card growth-sales-scatter-card">
                    <header>
                      <div><strong>근속기간 × <span className="growth-sales-heading-number">26</span>년 누적판매대수</strong></div>
                    </header>
                    <svg viewBox="0 0 470 210" role="img" aria-label="전국 영업직원 근속기간별 2026년 누적판매대수 분포">
                      <desc>현재 재직 중인 전국 영업직원의 2026년 누적 출고 실적과 근속기간을 비교합니다.</desc>
                      <defs>
                        <clipPath id="sales-selected-staff-photo">
                          <circle r="7.5" />
                        </clipPath>
                      </defs>
                      {staffSalesYTicks.map((tick) => {
                        const y = staffSalesScatterY(tick);
                        return <g className="growth-scatter-grid" key={`sales-y-${tick}`}>
                          <line x1={staffScatterPlot.left} x2={staffScatterPlot.right} y1={y} y2={y} />
                          <text x={staffScatterPlot.left - 7} y={y + 3} textAnchor="end">{tick}</text>
                        </g>;
                      })}
                      {staffScatterXTicks.map((tick) => {
                        const x = staffScatterX(tick);
                        return <g className="growth-scatter-grid" key={`sales-x-${tick}`}>
                          <line x1={x} x2={x} y1={staffScatterPlot.top} y2={staffScatterPlot.bottom} />
                          <text x={x} y={staffScatterPlot.bottom + 17} textAnchor="middle">{tick.toFixed(0)}</text>
                        </g>;
                      })}
                      <text className="growth-scatter-y-label" x="12" y="93" textAnchor="middle">2026 누적판매(대)</text>
                      <text className="growth-scatter-x-label" x="245" y="202" textAnchor="middle">근속기간(년)</text>
                      {selectedStaffSalesScatterPoint ? (
                        <g
                          className="growth-scatter-selected-guides is-targeting"
                          aria-hidden="true"
                          key={`sales-guides-${selectedStaffEmployee?.name ?? "selected"}`}
                        >
                          <line
                            className="guide-arm guide-arm-from-top"
                            x1={staffScatterX(selectedStaffSalesScatterPoint.tenureYears)}
                            x2={staffScatterX(selectedStaffSalesScatterPoint.tenureYears)}
                            y1={staffScatterPlot.top}
                            y2={staffSalesScatterY(selectedStaffSalesScatterPoint.deliveredSales)}
                          />
                          <line
                            className="guide-arm guide-arm-from-bottom"
                            x1={staffScatterX(selectedStaffSalesScatterPoint.tenureYears)}
                            x2={staffScatterX(selectedStaffSalesScatterPoint.tenureYears)}
                            y1={staffScatterPlot.bottom}
                            y2={staffSalesScatterY(selectedStaffSalesScatterPoint.deliveredSales)}
                          />
                          <line
                            className="guide-arm guide-arm-from-left"
                            x1={staffScatterPlot.left}
                            x2={staffScatterX(selectedStaffSalesScatterPoint.tenureYears)}
                            y1={staffSalesScatterY(selectedStaffSalesScatterPoint.deliveredSales)}
                            y2={staffSalesScatterY(selectedStaffSalesScatterPoint.deliveredSales)}
                          />
                          <line
                            className="guide-arm guide-arm-from-right"
                            x1={staffScatterPlot.right}
                            x2={staffScatterX(selectedStaffSalesScatterPoint.tenureYears)}
                            y1={staffSalesScatterY(selectedStaffSalesScatterPoint.deliveredSales)}
                            y2={staffSalesScatterY(selectedStaffSalesScatterPoint.deliveredSales)}
                          />
                        </g>
                      ) : null}
                      {staffSalesNationalAverage !== null ? (
                        <line
                          className="growth-scatter-average-line"
                          x1={staffScatterPlot.left}
                          x2={staffScatterPlot.right}
                          y1={staffSalesScatterY(staffSalesNationalAverage)}
                          y2={staffSalesScatterY(staffSalesNationalAverage)}
                        />
                      ) : null}
                      <g className="growth-scatter-population">
                        {otherStaffSalesScatterPoints.map((point) => (
                          <circle
                            cx={staffScatterX(point.tenureYears)}
                            cy={staffSalesScatterY(point.deliveredSales)}
                            r="3.2"
                            key={point.key}
                          ><title>{`${point.name} · 누적판매 ${point.deliveredSales}대 · 근속 ${point.tenureYears.toFixed(1)}년`}</title></circle>
                        ))}
                      </g>
                      <g className="growth-scatter-showroom">
                        {sameShowroomStaffSalesScatterPoints.map((point) => (
                          <circle
                            cx={staffScatterX(point.tenureYears)}
                            cy={staffSalesScatterY(point.deliveredSales)}
                            r="4.2"
                            key={point.key}
                          ><title>{`${point.name} · ${displayShowroomNameWithoutBrand(selected.showroom)} 전시장 · 누적판매 ${point.deliveredSales}대`}</title></circle>
                        ))}
                      </g>
                      {selectedStaffSalesScatterPoint ? (
                        <g className="growth-scatter-selected-photo" transform={`translate(${staffScatterX(selectedStaffSalesScatterPoint.tenureYears)} ${staffSalesScatterY(selectedStaffSalesScatterPoint.deliveredSales)})`} key={`sales-photo-${selectedStaffEmployee?.name ?? "selected"}`}>
                          <g className="photo-reveal">
                            <circle className="photo-acquire-flash" r="9.8" />
                            <circle className="photo-halo" r="9.8" />
                            <circle className="photo-backdrop" r="9.4" />
                            {selectedStaffProfile ? (
                              <image
                                href={selectedStaffProfile.image}
                                x="-7.5"
                                y="-7.5"
                                width="15"
                                height="15"
                                preserveAspectRatio="xMidYMin slice"
                                clipPath="url(#sales-selected-staff-photo)"
                              />
                            ) : (
                              <image
                                className="photo-fallback-silhouette"
                                href={selectedStaffFallbackProfileImage}
                                x="-7.5"
                                y="-7.5"
                                width="15"
                                height="15"
                                preserveAspectRatio="xMidYMid meet"
                                clipPath="url(#sales-selected-staff-photo)"
                              />
                            )}
                            <circle className="photo-ring" r="8" />
                          </g>
                        </g>
                      ) : null}
                      {staffSalesNationalAverage !== null ? (
                        <g
                          className="growth-scatter-average-label"
                          transform={`translate(${staffScatterPlot.right - 28} ${staffSalesScatterY(staffSalesNationalAverage) - 36})`}
                        >
                          <path className="pointer" d="M 20 28 L 28 36 L 36 28 Z" />
                          <rect width="56" height="30" rx="4" />
                          <text x="28" y="11" textAnchor="middle">전국 평균</text>
                          <text className="score" x="28" y="23" textAnchor="middle">
                            {staffSalesNationalAverage.toFixed(1)}대
                          </text>
                        </g>
                      ) : null}
                    </svg>
                    <footer>
                      <span><i />전국 SC</span>
                      <span className="showroom"><i />{displayShowroomNameWithoutBrand(selected.showroom)} SC</span>
                      <span className="selected"><i />{selectedStaffEmployee?.name ?? "선택 직원"}</span>
                      <small className="growth-scatter-evidence-note">평균 = 전국 {nationalStaffSalesPopulation.length}명 누적판매 합계 ÷ 인원</small>
                    </footer>
                  </article>
                  <article className="growth-sales-monthly-card">
                    <header>
                      <strong>{selectedStaffEmployee?.name ?? "선택 직원"} 누적판매 <span className="growth-sales-heading-number">{selectedStaffDeliveredSales}</span>대</strong>
                    </header>
                    <div className="growth-sales-monthly-body">
                      <div className="growth-sales-monthly-trend">
                        <div className="growth-sales-monthly-chart" key={`monthly-sales-${selectedStaffEmployee?.cdsid ?? selectedStaffEmployee?.name ?? "none"}`} role="img" aria-label={`${selectedStaffEmployee?.name ?? "선택 직원"} 2026년 1월부터 12월까지 월별 출고 실적, 미도래 월은 미집계`}>
                          {selectedStaffMonthlyDeliveredSales.map((count, index) => (
                            <div className={`growth-sales-month${count === null ? " unreported" : ""}`} key={`sales-month-${index + 1}`}>
                              <strong>{count ?? "―"}</strong>
                              <i aria-hidden="true">
                                {selectedShowroomMonthlyAverageDeliveredSales[index] === null ? null : (
                                  <span style={{ height: `${(selectedShowroomMonthlyAverageDeliveredSales[index] / selectedSalesMonthScale) * 100}%` }} />
                                )}
                                {count === null ? <b className="unreported" /> : (
                                  <b
                                    style={{
                                      height: `${(count / selectedSalesMonthScale) * 100}%`,
                                      "--growth-sales-month-index": index,
                                    } as CSSProperties}
                                  />
                                )}
                              </i>
                              <small>{index + 1}월</small>
                            </div>
                          ))}
                        </div>
                        <div className="growth-sales-monthly-legend">
                          <span><i className="staff" />{selectedStaffEmployee?.name ?? "선택 직원"}</span>
                          <span title={`월별 소속 전시장 출고 ÷ 현재 영업직원 ${selectedShowroomSalesStaffCount}명`}><i className="average" />{displayShowroomNameWithoutBrand(selected.showroom)} 1인 평균</span>
                        </div>
                      </div>
                      <aside className="growth-sales-share-panel" aria-label={`${displayShowroomNameWithoutBrand(selected.showroom)} 전시장 누적판매 중 ${selectedStaffEmployee?.name ?? "선택 직원"} 판매 비중`}>
                        <div className="growth-sales-share-visual">
                          <div
                            className="growth-sales-share-donut"
                            key={`sales-share-${selectedStaffEmployee?.cdsid ?? selectedStaffEmployee?.name ?? "none"}`}
                            style={{
                              "--growth-sales-share-angle": `${selectedStaffSalesShareClamped * 3.6}deg`,
                              "--growth-sales-share-mid-angle": `${selectedStaffSalesShareClamped * 1.8}deg`,
                            } as CSSProperties}
                            aria-hidden="true"
                          >
                            <div>
                              <span>{displayShowroomNameWithoutBrand(selected.showroom)} 누적</span>
                              <strong>{selectedShowroomDeliveredSales.toLocaleString()}<small>대</small></strong>
                            </div>
                          </div>
                          <svg
                            className="growth-sales-share-leader"
                            viewBox="0 0 90 24"
                            aria-hidden="true"
                            key={`sales-share-leader-${selectedStaffEmployee?.cdsid ?? selectedStaffEmployee?.name ?? "none"}`}
                          >
                            <polyline
                              pathLength="1"
                              points={`${selectedStaffSalesShareLeaderX.toFixed(1)},${selectedStaffSalesShareLeaderY.toFixed(1)} ${selectedStaffSalesShareLeaderBendX.toFixed(1)},10 90,10`}
                            />
                          </svg>
                          <div className="growth-sales-share-callout">
                            <span>{selectedStaffEmployee?.name ?? "선택 직원"} 판매비중</span>
                            <strong>
                              {selectedStaffDeliveredSales}대 · {selectedStaffSalesShare === null ? "―" : `${selectedStaffSalesShare.toFixed(1)}%`}
                            </strong>
                          </div>
                        </div>
                        <div className="growth-sales-share-meta">
                          <small className="growth-sales-share-rank">
                            <span>
                              <b>{selectedDealerRankName}</b> {selectedStaffDealerSalesRank ?? "―"}위
                              <i aria-hidden="true">/</i>
                              전체 {selectedStaffDealerSalesPopulation.length}
                            </span>
                            <span>
                              <b>{displayShowroomNameWithoutBrand(selected.showroom)}</b> {selectedStaffSalesRank ?? "―"}위
                              <i aria-hidden="true">/</i>
                              전체 {selectedShowroomSalesPopulationCount}
                            </span>
                          </small>
                          <small>
                            {displayShowroomNameWithoutBrand(selected.showroom)} 1인 평균 {selectedShowroomAverageDeliveredSales.toFixed(1)}대 대비 {" "}
                            <strong className={selectedStaffShowroomAverageDeltaTone}>
                              {selectedStaffShowroomAverageDeltaMark}{Math.abs(selectedStaffShowroomAverageDelta).toFixed(1)}대
                            </strong>
                          </small>
                        </div>
                      </aside>
                    </div>
                  </article>
                </div>
              </section>
              </div>

            </div>
          </div>
        </section>
        </>
      ) : null}

      {false && selectedStaffAnalysis ? (
        <section
          ref={staffAnalysisCardRef}
          className={`analysis-staff-card${
            staffAnalysisInView ? " is-motion-visible" : ""
          }`}
          aria-label={`${displayShowroomName(selected.showroom)} 소속 영업직원 상담 및 영업 역량 매트릭스`}
        >
          <header className="analysis-staff-heading" ref={staffAnalysisHeadingRef}>
            <div>
              <h2>
                소속 영업직원 상담 및 영업 역량 매트릭스
              </h2>
            </div>
            <div className="analysis-staff-source" aria-label="영업직원 분석 기준">
              <span>Sales-DMS 기준</span>
              <span>
                <strong>{staffAnalysisSource.rosterCheckedAt.replaceAll("-", "").slice(2)}</strong>
                기준
              </span>
            </div>
          </header>

          <div className="analysis-staff-workspace">
            <aside
              className="analysis-staff-roster"
              aria-label="보정 만족도와 최신성 최종점수 순위별 소속 직원"
            >
              <header className="analysis-staff-roster-columns" aria-hidden="true">
                <span>번호</span>
                <span className="analysis-staff-roster-identity-heading">
                  <b>영업직원</b>
                  <small>/ 입사일</small>
                </span>
                <span className="analysis-staff-roster-score-heading">
                  <b>만족도</b>
                  <small>(80%)</small>
                </span>
                <span className="analysis-staff-roster-score-heading">
                  <b>최신성</b>
                  <small>(20%)</small>
                </span>
                <span className="analysis-staff-roster-score-heading">
                  <b>최종점수</b>
                  <small>(100점)</small>
                </span>
              </header>
              <div className="analysis-staff-roster-list">
                {selectedStaffEmployee ? (
                  <span
                    className="analysis-staff-roster-selection"
                    aria-hidden="true"
                    style={
                      {
                        "--staff-roster-selection-index": selectedStaffRosterIndex,
                      } as CSSProperties
                    }
                  />
                ) : null}
                {rankedSalesStaff.map(({
                  employee,
                  average,
                  responses,
                  adjustedPoints,
                  freshnessPoints,
                  finalScore,
                }, index) => {
                  const isSelected = employee.name === selectedStaffEmployee?.name;
                  return (
                    <button
                      type="button"
                      className={isSelected ? "selected" : ""}
                      aria-pressed={isSelected}
                      aria-label={`${employee.name}, 누적 만족도 ${
                        average === null ? "표본 없음" : `${average.toFixed(1)}점`
                      }, ${
                        finalScore === null
                          ? `회신 ${responses}건으로 최종점수 산정 유보`
                          : `보정 만족도 환산 ${adjustedPoints?.toFixed(1)}점, 최신성 ${freshnessPoints.toFixed(1)}점, 최종 ${finalScore.toFixed(1)}점`
                      }`}
                      onClick={() => {
                        setSelectedStaffName(employee.name);
                        setSmilingStaffName(null);
                      }}
                      key={employee.name}
                    >
                      <span className="analysis-staff-roster-rank">
                        {index + 1}
                      </span>
                      <span className="analysis-staff-roster-identity">
                        <strong>{employee.name}</strong>
                        <small>
                          <i aria-hidden="true">/</i>
                          <b>{formatStaffShortDate(employee.hireDate)}</b>
                        </small>
                      </span>
                      <span className="analysis-staff-roster-adjusted-points">
                        {adjustedPoints === null ? "―" : adjustedPoints.toFixed(1)}
                      </span>
                      <span className="analysis-staff-roster-freshness-points">
                        {finalScore === null ? "―" : freshnessPoints.toFixed(1)}
                      </span>
                      <span className={`analysis-staff-roster-final${finalScore === null ? " pending" : ""}`}>
                        {finalScore === null ? "검토" : finalScore.toFixed(1)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="analysis-staff-detail">
          <div className="analysis-staff-summary">
            <article className="analysis-staff-profile-card">
              <span>소속 영업직원</span>
              <div className="analysis-staff-profile-value">
                <button
                  type="button"
                  className={`analysis-staff-profile-photo${
                    selectedStaffProfile?.smileImage ? " interactive" : ""
                  }${
                    selectedStaffEmployee?.name === smilingStaffName
                      ? " smiling"
                      : ""
                  }`}
                  disabled={!selectedStaffProfile?.smileImage}
                  aria-label={
                    selectedStaffProfile?.smileImage
                      ? `${selectedStaffEmployee?.name ?? "선택 직원"} 미소 표정 전환`
                      : undefined
                  }
                  aria-pressed={
                    selectedStaffProfile?.smileImage
                      ? selectedStaffEmployee?.name === smilingStaffName
                      : undefined
                  }
                  onClick={() =>
                    setSmilingStaffName((current) =>
                      current === selectedStaffEmployee?.name
                        ? null
                        : selectedStaffEmployee?.name ?? null,
                    )
                  }
                >
                  {selectedStaffProfile ? (
                    <>
                      <img
                        className="base"
                        src={selectedStaffProfile.image}
                        alt={`${selectedStaffEmployee?.name ?? "선택 직원"} 공식 프로필`}
                        draggable={false}
                      />
                      {selectedStaffProfile.smileImage ? (
                        <img
                          className="smile"
                          src={selectedStaffProfile.smileImage}
                          alt=""
                          aria-hidden="true"
                          draggable={false}
                        />
                      ) : null}
                    </>
                  ) : (
                    <img
                      className="staff-profile-silhouette"
                      src={selectedStaffFallbackProfileImage}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                  )}
                </button>
                <strong className="name">
                  {selectedStaffEmployee?.name ?? "―"}
                  {selectedStaffEmployee?.jobTitle ? (
                    <small className="analysis-staff-job-title">
                      {selectedStaffEmployee.jobTitle}
                    </small>
                  ) : null}
                </strong>
              </div>
            </article>
            <article className="analysis-staff-metric-card">
              <span>총 근무기간</span>
              <div className="analysis-staff-metric-value">
                <strong className="analysis-staff-tenure-value">
                  {selectedStaffTenureYears === null || selectedStaffTenureMonths === null ? (
                    "―"
                  ) : (
                    <>
                      <b>{selectedStaffTenureYears}</b><small>년</small>
                      <b>{selectedStaffTenureMonths}</b><small>개월</small>
                    </>
                  )}
                </strong>
                {selectedStaffTenureTopPercent === null ? null : (
                  <small className="analysis-staff-metric-comparison">
                    <i aria-hidden="true">/</i>
                    전국 상위 {selectedStaffTenureTopPercent.toFixed(1)}%
                  </small>
                )}
              </div>
            </article>
            <article
              className="analysis-staff-metric-card"
              aria-label={
                selectedStaffScoring?.finalScore === null
                  ? `최종점수 검토, 회신 ${selectedStaffScoring.responses}건`
                  : `최종점수 ${selectedStaffScoring?.finalScore.toFixed(1)}점, 만족도 ${selectedStaffScoring?.adjustedPoints?.toFixed(1)}점과 최신성 ${selectedStaffScoring?.freshnessPoints.toFixed(1)}점 합산`
              }
            >
              <span>최종점수</span>
              <div className="analysis-staff-metric-value">
                <strong>
                  {selectedStaffScoring?.finalScore === null || !selectedStaffScoring
                    ? "검토"
                    : selectedStaffScoring.finalScore.toFixed(1)}
                  {selectedStaffScoring?.finalScore === null || !selectedStaffScoring
                    ? null
                    : <small>점</small>}
                </strong>
                <small className="analysis-staff-metric-comparison">
                  <i aria-hidden="true">/</i>
                  {selectedStaffScoring?.finalScore === null || !selectedStaffScoring
                    ? `회신 ${selectedStaffScoring?.responses ?? 0}건 · 8건부터 산정`
                    : `전국 ${nationalStaffRespondingCount}명 중 ${selectedStaffNationalRank}위`}
                </small>
              </div>
            </article>
            <article
              className="analysis-staff-metric-card analysis-staff-tenure-peer-card"
              aria-label={`동일연차 ${selectedStaffTenurePeerRangeLabel ?? "범위 없음"}, 최종점수 평균 ${
                selectedStaffTenureFinalScore === null
                  ? "표본 없음"
                  : `${selectedStaffTenureFinalScore.toFixed(1)}점`
              }, 비교 ${selectedStaffTenureScoreRows.length}명`}
            >
              <span>동일연차 정보</span>
              <div className="analysis-staff-metric-value">
                <strong>
                  {selectedStaffTenureFinalScore === null
                    ? "―"
                    : selectedStaffTenureFinalScore.toFixed(1)}
                  {selectedStaffTenureFinalScore === null ? null : <small>점</small>}
                </strong>
                <small className="analysis-staff-metric-comparison">
                  {selectedStaffTenurePeerRangeLabel ?? "―"} · 비교 {selectedStaffTenureScoreRows.length}명
                </small>
              </div>
            </article>
            <article className="analysis-staff-metric-card">
              <span>누적 회신건수</span>
              <div className="analysis-staff-metric-value">
                <strong>
                  {selectedStaffResponses}
                  <small>건</small>
                </strong>
                {selectedStaffResponseShare === null ? null : (
                  <small className="analysis-staff-metric-comparison">
                    <i aria-hidden="true">/</i>
                    전체 {staffNationalResponses.toLocaleString("ko-KR")}건 중 {selectedStaffResponseShare.toFixed(1)}%
                  </small>
                )}
              </div>
            </article>
            <article className="analysis-staff-certification-card">
              <span>인증직원 선발</span>
              <strong
                aria-label={`누적 인증 기록 Grand ${selectedStaffCertificationCounts.Grand}회, Advanced ${selectedStaffCertificationCounts.Advanced}회, Certified ${selectedStaffCertificationCounts.Certified}회`}
              >
                <b>G<i aria-hidden="true">-</i>{selectedStaffCertificationCounts.Grand}</b>
                <em aria-hidden="true">/</em>
                <b>A<i aria-hidden="true">-</i>{selectedStaffCertificationCounts.Advanced}</b>
                <em aria-hidden="true">/</em>
                <b>C<i aria-hidden="true">-</i>{selectedStaffCertificationCounts.Certified}</b>
              </strong>
            </article>
          </div>

          <div className="analysis-staff-detail-body">
          <div className="analysis-staff-comparison-layout">
            <div
              className="analysis-staff-history"
              role="img"
              aria-label={`${selectedStaffEmployee?.name ?? "선택 직원"} 2023년부터 2026년 YTD까지 상담 만족도`}
            >
              <article
                className="analysis-staff-history-chart"
                key={selectedStaffEmployee?.name ?? "staff-history"}
              >
                <div className="analysis-staff-trend-plot">
                  {selectedStaffTrendPoints.length > 1 ? (
                    <svg
                      className="analysis-staff-trend-line"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <polyline pathLength="1" points={selectedStaffTrendPolyline} />
                      {selectedStaffTrendPoints.slice(1).map((point, index) => {
                        const previousPoint = selectedStaffTrendPoints[index];
                        return previousPoint.y === 0 && point.y === 0 ? (
                          <line
                            className="analysis-staff-trend-top-segment"
                            key={`${previousPoint.key}-${point.key}`}
                            x1={previousPoint.x}
                            y1="0.9"
                            x2={point.x}
                            y2="0.9"
                          />
                        ) : null;
                      })}
                    </svg>
                  ) : null}
                  <div className="analysis-staff-trend-markers" aria-hidden="true">
                    {selectedStaffTrendPoints.map((point) => (
                      <span
                        className="analysis-staff-trend-marker"
                        key={point.key}
                        style={
                          {
                            "--staff-trend-x": point.xCss,
                            "--staff-trend-height": `${point.height}%`,
                            "--staff-history-index": point.index,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </div>
                  <div className="analysis-staff-year-groups">
                    {selectedStaffYearRows.map((year, yearIndex) => {
                      const barHeight =
                        year.average === null ? 0 : staffHistoryChartHeight(year.average);
                      const nationalBarHeight = staffHistoryChartHeight(
                        year.nationalAverage ?? staffHistoryChartMinScore,
                      );
                      const deltaTone =
                        year.deltaPercent === null
                          ? "neutral"
                          : year.deltaPercent > 0
                            ? "positive"
                            : year.deltaPercent < 0
                              ? "negative"
                              : "neutral";
                      return (
                        <div
                          className={year.average === null ? "empty" : ""}
                          key={year.year}
                          style={
                            { "--staff-history-index": yearIndex } as CSSProperties
                          }
                          aria-label={`${year.year === "2026" ? "2026 YTD" : year.year}: 발송 ${year.sent}건, ${
                            year.average === null
                              ? "회신 없음"
                              : `평균 ${year.average.toFixed(1)}점, ${year.responses}건`
                          }`}
                        >
                          <div className="analysis-staff-year-bars">
                            <div
                              className="analysis-staff-chart-bar national"
                              style={
                                { "--staff-bar-height": `${nationalBarHeight}%` } as CSSProperties
                              }
                            >
                              <small>{year.nationalResponses.toLocaleString("ko-KR")}건</small>
                            </div>
                            <div
                              className="analysis-staff-chart-bar employee"
                              style={
                                { "--staff-bar-height": `${barHeight}%` } as CSSProperties
                              }
                            >
                              <small>{year.responses ? `${year.responses}건` : "회신 없음"}</small>
                            </div>
                            <b
                              className="analysis-staff-chart-score national"
                              style={
                                { "--staff-bar-height": `${nationalBarHeight}%` } as CSSProperties
                              }
                            >
                              {year.nationalAverage?.toFixed(1) ?? "―"}
                            </b>
                            {year.average === null ? null : (
                              <b
                                className="analysis-staff-chart-score employee"
                                style={
                                  { "--staff-bar-height": `${barHeight}%` } as CSSProperties
                                }
                              >
                                {year.average.toFixed(1)}
                              </b>
                            )}
                          </div>
                          <div className="analysis-staff-year-axis">
                            <div>
                              <strong>{year.year === "2026" ? "2026 YTD" : year.year}</strong>
                              <span className={`delta-${deltaTone}`}>
                                {year.deltaPercent === null
                                  ? "회신 없음"
                                  : `${year.deltaPercent > 0 ? "▲" : year.deltaPercent < 0 ? "▼" : "―"} ${Math.abs(year.deltaPercent).toFixed(1)}%`}
                              </span>
                            </div>
                            <small>
                              <span>발송 {year.sent.toLocaleString("ko-KR")}건</span>
                              <span>(회신율 {year.responseRate.toFixed(1)}%)</span>
                            </small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <footer className="analysis-staff-history-legend">
                  <span className="national" aria-label="전국 영업직원 평균"><i />전국 평균</span>
                  <span className="employee" aria-label={`${selectedStaffEmployee?.name ?? "선택 직원"} 고객상담 만족도`}><i />{selectedStaffEmployee?.name ?? "선택 직원"}</span>
                </footer>
              </article>
            </div>

            <aside className="analysis-staff-benchmarks" aria-label="전국 및 근속기간 분포 비교대조군">
              <div
                className="analysis-staff-tenure-scatter"
                role="group"
                aria-label="근속기간별 최종점수 산포도, 100점 만점"
              >
                <div className="analysis-staff-tenure-scatter-chart">
                  <svg
                    viewBox="0 0 470 284"
                    role="img"
                    aria-label={selectedStaffScatterPoint
                      ? `${selectedStaffScatterPoint.name}의 근속기간과 ${selectedStaffScatterPoint.provisional ? "참고점수" : "최종점수"} ${selectedStaffScatterPoint.finalScore.toFixed(1)}점 좌표, 100점 만점`
                      : `${selectedStaffEmployee?.name ?? "선택 직원"}: 회신 없음, 미평가 줄 표시`}
                  >
                    {staffScatterYTicks.map((tick) => {
                      const y = staffScatterY(tick);
                      return (
                        <g className="analysis-staff-scatter-grid" key={`y-${tick}`}>
                          <line x1={staffScatterPlot.left} x2={staffScatterPlot.right} y1={y} y2={y} />
                          <text x={staffScatterPlot.left - 8} y={y + 3} textAnchor="end">
                            {tick.toFixed(0)}
                          </text>
                        </g>
                      );
                    })}
                    {staffScatterXTicks.map((tick) => {
                      const x = staffScatterX(tick);
                      return (
                        <g className="analysis-staff-scatter-grid" key={`x-${tick}`}>
                          <line x1={x} x2={x} y1={staffScatterPlot.top} y2={staffScatterPlot.bottom} />
                          <text x={x} y={staffScatterPlot.bottom + 17} textAnchor="middle">
                            {tick.toFixed(0).padStart(2, "0")}
                          </text>
                        </g>
                      );
                    })}
                    <text className="analysis-staff-scatter-y-label" x="12" y="116" textAnchor="middle">
                      최종점수(100점)
                    </text>
                    <text className="analysis-staff-scatter-x-label" x="245" y="235" textAnchor="middle">
                      근속기간(년)
                    </text>
                    {staffScatterNationalAverage !== null ? (
                      <g className="analysis-staff-scatter-average">
                        <line
                          x1={staffScatterPlot.left - 10}
                          x2={staffScatterPlot.right + 10}
                          y1={staffScatterY(staffScatterNationalAverage)}
                          y2={staffScatterY(staffScatterNationalAverage)}
                        />
                        <g className="label" transform={`translate(${staffScatterPlot.right - 30} ${staffScatterY(staffScatterNationalAverage) - 36})`}>
                          <path className="pointer" d="M 22 28 L 30 36 L 38 28 Z" />
                          <rect width="56" height="30" rx="6" />
                          <text x="28" y="11" textAnchor="middle">전국 평균</text>
                          <text className="score" x="28" y="23" textAnchor="middle">
                            {staffScatterNationalAverage.toFixed(1)}점
                          </text>
                        </g>
                      </g>
                    ) : null}
                    <g className="analysis-staff-scatter-population">
                      {otherStaffScatterPoints.map((point) => (
                        <circle
                          cx={staffScatterX(point.tenureYears)}
                          cy={staffScatterY(point.finalScore)}
                          key={point.key}
                          data-final-score={point.finalScore}
                          data-provisional={point.provisional}
                          className={point.provisional ? "provisional" : ""}
                          r={point.provisional ? 3.3 : 2.7}
                        >
                          <title>{`${point.name} · ${point.tenureYears.toFixed(1)}년 · ${point.provisional ? "참고점수(순위 제외)" : "최종점수"} ${point.finalScore.toFixed(1)}점 · 회신 ${point.responses}건`}</title>
                        </circle>
                      ))}
                    </g>
                    <g className="analysis-staff-scatter-showroom">
                      {sameShowroomStaffScatterPoints.map((point) => (
                        <circle
                          cx={staffScatterX(point.tenureYears)}
                          cy={staffScatterY(point.finalScore)}
                          key={point.key}
                          data-final-score={point.finalScore}
                          data-provisional={point.provisional}
                          className={point.provisional ? "provisional" : ""}
                          r={3.5}
                        >
                          <title>{`${point.name} SC · ${point.tenureYears.toFixed(1)}년 · ${point.provisional ? "참고점수(순위 제외)" : "최종점수"} ${point.finalScore.toFixed(1)}점/100점 · ${point.responses}건`}</title>
                        </circle>
                      ))}
                    </g>
                    {selectedStaffScatterPoint ? (
                      <g
                        className={`analysis-staff-scatter-selected${selectedStaffScatterPoint.provisional ? " provisional" : ""}`}
                        data-final-score={selectedStaffScatterPoint.finalScore}
                        data-provisional={selectedStaffScatterPoint.provisional}
                        transform={`translate(${staffScatterX(selectedStaffScatterPoint.tenureYears)} ${staffScatterY(selectedStaffScatterPoint.finalScore)})`}
                      >
                        <line
                          className="axis-x"
                          x1={0}
                          x2={0}
                          y1={0}
                          y2={staffScatterPlot.bottom - staffScatterY(selectedStaffScatterPoint.finalScore)}
                        />
                        <line
                          className="axis-y"
                          x1={staffScatterPlot.left - staffScatterX(selectedStaffScatterPoint.tenureYears)}
                          x2={0}
                          y1={0}
                          y2={0}
                        />
                        <title>{`${selectedStaffScatterPoint.name} · ${selectedStaffScatterPoint.provisional ? "참고점수(순위 제외)" : "최종점수"} ${selectedStaffScatterPoint.finalScore.toFixed(1)}점 · 회신 ${selectedStaffScatterPoint.responses}건`}</title>
                        <circle className="halo" r="12" />
                        <circle className="ring" r="8" />
                        <circle className="point" r="5" />
                      </g>
                    ) : null}
                    <g className="analysis-staff-scatter-unscored" aria-label="회신 없음: 점수와 무관한 별도 줄">
                      <rect x="42" y="248" width="406" height="28" rx="4" />
                      <text x="38" y="258" textAnchor="end">회신 없음</text>
                      <text x="38" y="269" textAnchor="end">(미평가)</text>
                      {staffScatterNoResponses.map((point, index) => {
                        const isSelected = point.cdsid === selected.cdsid && point.name === selectedStaffEmployee?.name;
                        return <circle key={`${point.cdsid}-${point.name}`}
                          data-unscored="true" cx={staffScatterX(point.tenureYears)} cy={262 + (index % 3 - 1) * 7}
                          r={isSelected ? 5 : 2.7}
                          className={isSelected ? "selected" : point.cdsid === selected.cdsid ? "showroom" : ""}>
                          <title>{`${point.name} · ${point.tenureYears.toFixed(1)}년 · 회신 0건 · 점수 미평가(0점 아님)`}</title>
                        </circle>;
                      })}
                    </g>
                  </svg>
                </div>
                <p className="analysis-staff-scatter-score-note">
                  만족도 80% + 최신성 20% · 빈 원 = 1~7건 참고점수(순위·평균 제외)
                  <br />
                  {selectedStaffScatterPoint?.provisional
                    ? `${selectedStaffScatterPoint.name}: 참고 ${selectedStaffScatterPoint.finalScore.toFixed(1)}점 · 적은 표본은 동일연차 평균으로 보정`
                    : "회신 0건은 아래 미평가 줄에 표시 · 원 크기는 회신 건수와 무관"}
                </p>
              </div>
              <footer className="analysis-staff-benchmark-legend">
                <span><i />전체 볼보 SC</span>
                <span className="average"><i />전국 평균</span>
                <span className="showroom"><i />동일 전시장 SC</span>
                <span className="selected">
                  <i />
                  {selectedStaffEmployee?.name ?? "선택 SC"}
                </span>
                <em>○ 1~7건 참고</em>
              </footer>
            </aside>
          </div>

          <section className="analysis-staff-insights" aria-label="4개년 VOC 영업지원 핵심 분석">
            <div>
              <article className="strength">
                <h4>유지·강화</h4>
                <div className="analysis-staff-insight-bars">
                  {selectedStaffStrengthKeywords.length ? (
                    selectedStaffStrengthKeywords.map((keyword, index) => (
                      <div
                        className="analysis-staff-insight-bar"
                        key={keyword.label}
                        style={{
                          "--insight-bar-ratio": `${(keyword.mentions / selectedStaffStrengthMax) * 100}%`,
                          "--insight-bar-index": index,
                        } as CSSProperties}
                      >
                        <span>{keyword.label}</span>
                        <i aria-hidden="true"><b /></i>
                        <small>{keyword.mentions}회</small>
                      </div>
                    ))
                  ) : (
                    <em>분석 가능한 긍정 코멘트 없음</em>
                  )}
                </div>
              </article>
              <article className="improvement">
                <h4>개선·보강</h4>
                <div className="analysis-staff-insight-bars">
                  {selectedStaffImprovementKeywords.length ? (
                    selectedStaffImprovementKeywords.map((keyword, index) => (
                      <div
                        className="analysis-staff-insight-bar"
                        key={keyword.label}
                        style={{
                          "--insight-bar-ratio": `${(keyword.mentions / selectedStaffImprovementMax) * 100}%`,
                          "--insight-bar-index": index,
                        } as CSSProperties}
                      >
                        <span>{keyword.label}</span>
                        <i aria-hidden="true"><b /></i>
                        <small>{keyword.mentions}회</small>
                      </div>
                    ))
                  ) : (
                    <em>반복 확인된 개선·보강 키워드 없음</em>
                  )}
                </div>
              </article>
            </div>
          </section>

            </div>
            </div>
          </div>

        </section>
      ) : null}

      <section className="v3s-award-card" aria-label="V3S 인센티브 수상기록">
        <header className="v3s-award-heading">
          <h2>
            <span className="v3s-award-heading-title">
              <span className="english-title">V3S</span> 인센티브 수상기록
            </span>
            <span
              className="v3s-award-heading-summary"
              aria-label={`${selectedAwardName} ${selectedAwardCount}회 수상`}
            >
              <span aria-hidden="true">/</span>
              <span>{selectedAwardName}</span>
              <strong>{selectedAwardCount}</strong>
              <span>회 수상</span>
            </span>
          </h2>
        </header>

        <div className="v3s-award-timeline">
          {["2021", "2022", "2023", "2024", "2025", "2026"].map(
            (year) => (
              <article className="v3s-award-year" key={year}>
                <h3>{year}</h3>
                <div>
                  {v3sAwardPeriods
                    .filter((period) => period.year === year)
                    .map((period) => {
                      const isAwarded = selectedAwardPeriods.includes(period.id);
                      return (
                        <div
                          className={`v3s-award-period ${
                            isAwarded ? "awarded" : "empty"
                          }`}
                          key={period.id}
                        >
                          <span>{period.half}</span>
                          {isAwarded ? (
                            <>
                              <span
                                className="v3s-award-prize-icon"
                                aria-hidden="true"
                              >
                                <svg viewBox="0 0 24 24" focusable="false">
                                  <path className="trophy-cup" d="M7 3.5h10v3.8c0 3.2-2.2 5.7-5 5.7S7 10.5 7 7.3V3.5Z" />
                                  <path className="trophy-handle" d="M7 5H4.5v1.8c0 2 1.3 3.5 3.2 3.7M17 5h2.5v1.8c0 2-1.3 3.5-3.2 3.7" />
                                  <path className="trophy-stand" d="M12 13v4m-3 3h6m-5.2-3h4.4" />
                                  <path className="trophy-sparkle sparkle-one" d="m4 1 .6 1.4L6 3l-1.4.6L4 5l-.6-1.4L2 3l1.4-.6L4 1Z" />
                                  <path className="trophy-sparkle sparkle-two" d="m20 10 .45 1.05 1.05.45-1.05.45L20 13l-.45-1.05-1.05-.45 1.05-.45L20 10Z" />
                                </svg>
                              </span>
                              <strong>{selectedAwardName}</strong>
                            </>
                          ) : (
                            <i className="sr-only">수상 기록 없음</i>
                          )}
                        </div>
                      );
                    })}
                </div>
              </article>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
