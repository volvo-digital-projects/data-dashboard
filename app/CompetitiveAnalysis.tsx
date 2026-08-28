"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dashboardJson from "./data/showrooms.json";
import vocStaffAnalysisJson from "./data/voc-staff-analysis.json";
import staffProfilePhotosJson from "./data/staff-profile-photos.json";
import DashboardHeaderLead from "./DashboardHeaderLead";

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
  q1?: { v3s: number | null } | null;
};

type AnalysisPoint = AnalysisShowroom & {
  vocScore: number;
  happyScore: number;
  combined: number;
};

type StaffYear = "2023" | "2024" | "2025" | "2026";
type StaffYearMetric = { responses: number; scoreSum: number };
type StaffKeyword = { label: string; mentions: number };
type StaffEmployee = {
  name: string;
  role: "영업직원" | "영업팀장";
  hireDate: string;
  tenureMonths: number;
  tenureBucket: string;
  tenureBucketLabel: string;
  years: Partial<Record<StaffYear, StaffYearMetric>>;
  commentResponses: number;
  strengthKeywords: StaffKeyword[];
  improvementKeywords: StaffKeyword[];
};
type StaffNationalYear = StaffYearMetric & {
  average: number | null;
  respondingEmployees: number;
  averageResponsesPerEmployee: number | null;
};
type StaffTenureCohort = StaffYearMetric & {
  id: string;
  label: string;
  employeeCount: number;
  respondingEmployees: number;
  average: number | null;
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
};

type StaffProfileShowroom = {
  dealer: string;
  showroom: string;
  sourcePage: string;
  employees: Record<string, StaffProfilePhoto>;
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
const staffTenureCohorts = vocStaffAnalysisJson.tenureCohorts as StaffTenureCohort[];
const staffProfilePhotosByCdsid = staffProfilePhotosJson.showrooms as Record<
  string,
  StaffProfileShowroom
>;
const staffYears: StaffYear[] = ["2023", "2024", "2025", "2026"];

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

const displayNumber = (value: number) => value.toFixed(1);

const formatStaffTenure = (months: number) => {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `${years}년 ${remainingMonths}개월`;
};

const formatStaffDate = (value: string) => value.replaceAll("-", ".");

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

const averageOf = (items: AnalysisPoint[], key: "vocScore" | "happyScore" | "combined") =>
  items.length
    ? items.reduce((sum, item) => sum + item[key], 0) / items.length
    : 0;

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
  const x = clamp(((item.happyScore - 65) / 35) * 100);
  const y = clamp(((item.vocScore - 75) / 25) * 100);
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
      offsetX: best.offsetX,
      offsetY: best.offsetY,
      tailX: Math.max(3, Math.abs(anchorX)),
      tailY: Math.max(3, Math.abs(anchorY)),
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
  const [hoveredCdsid, setHoveredCdsid] = useState<string | null>(null);
  const [selectedStaffName, setSelectedStaffName] = useState("김대준");
  const [accessDate, setAccessDate] = useState(() =>
    formatAnalysisDate(new Date()),
  );
  const scatterRef = useRef<HTMLDivElement>(null);
  const stickyAnchorRef = useRef<HTMLDivElement>(null);
  const stickyShellRef = useRef<HTMLDivElement>(null);
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
    const syncAccessDate = () => setAccessDate(formatAnalysisDate(new Date()));
    syncAccessDate();
    const timer = window.setInterval(syncAccessDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    const anchor = stickyAnchorRef.current;
    const shell = stickyShellRef.current;
    if (!anchor || !shell) return;

    let resizeFrame = 0;

    const syncAnchorHeight = () => {
      if (window.matchMedia("(max-width: 760px)").matches) {
        anchor.style.removeProperty("height");
        return;
      }
      anchor.style.height = `${Math.ceil(shell.getBoundingClientRect().height)}px`;
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
    };
  }, []);

  const groupItems = useMemo(() => {
    const filtered =
      view === "dealer"
        ? showrooms.filter((item) => item.dealer === selected.dealer)
        : view === "region"
          ? showrooms.filter((item) => item.region === selected.region)
          : view === "size"
            ? showrooms.filter((item) => item.size === selected.size)
            : showrooms;

    return filtered
      .filter(
        (item) =>
          typeof item.voc === "number" && typeof item.happyCall === "number",
      )
      .map((item) => ({
        ...item,
        vocScore: item.voc as number,
        happyScore: item.happyCall as number,
        combined: ((item.voc as number) + (item.happyCall as number)) / 2,
      }))
      .sort((a, b) => b.combined - a.combined);
  }, [selected.dealer, selected.region, selected.size, view]);

  const selectedPoint =
    groupItems.find((item) => item.cdsid === selected.cdsid) ??
    ({
      ...selected,
      vocScore: selected.voc ?? 0,
      happyScore: selected.happyCall ?? 0,
      combined: ((selected.voc ?? 0) + (selected.happyCall ?? 0)) / 2,
    } satisfies AnalysisPoint);
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
    () =>
      currentSalesStaff
        .map((employee) => {
          const totals = staffYears.reduce(
            (summary, year) => {
              const metrics = employee.years[year];
              summary.responses += metrics?.responses ?? 0;
              summary.scoreSum += metrics?.scoreSum ?? 0;
              return summary;
            },
            { responses: 0, scoreSum: 0 },
          );
          return {
            employee,
            responses: totals.responses,
            average: totals.responses ? totals.scoreSum / totals.responses : null,
          };
        })
        .sort((a, b) => {
          if (a.average === null && b.average === null) {
            return a.employee.name.localeCompare(b.employee.name, "ko");
          }
          if (a.average === null) return 1;
          if (b.average === null) return -1;
          if (b.average !== a.average) return b.average - a.average;
          if (b.responses !== a.responses) return b.responses - a.responses;
          return a.employee.name.localeCompare(b.employee.name, "ko");
        }),
    [currentSalesStaff],
  );
  const selectedStaffEmployee =
    rankedSalesStaff.find(({ employee }) => employee.name === selectedStaffName)
      ?.employee ?? rankedSalesStaff[0]?.employee;
  const selectedStaffProfileShowroom = staffProfilePhotosByCdsid[selected.cdsid];
  const selectedStaffProfile = selectedStaffEmployee
    ? selectedStaffProfileShowroom?.employees[selectedStaffEmployee.name]
    : undefined;
  const selectedStaffInitials = selectedStaffEmployee?.name.slice(-2) ?? "SC";
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
      responses: metrics.responses,
      scoreSum: metrics.scoreSum,
      average,
      nationalAverage: national.average,
      nationalResponses: national.responses,
      deltaPercent: staffDeltaPercent(average, national.average),
    };
  });
  const selectedStaffResponses = selectedStaffYearRows.reduce(
    (sum, year) => sum + year.responses,
    0,
  );
  const selectedStaffScoreSum = selectedStaffYearRows.reduce(
    (sum, year) => sum + year.scoreSum,
    0,
  );
  const selectedStaffAverage = selectedStaffResponses
    ? selectedStaffScoreSum / selectedStaffResponses
    : null;
  const staffNationalResponses = selectedStaffYearRows.reduce(
    (sum, year) => sum + year.nationalResponses,
    0,
  );
  const staffNationalScoreSum = staffYears.reduce(
    (sum, year) => sum + staffNationalYears[year].scoreSum,
    0,
  );
  const staffNationalAverage = staffNationalResponses
    ? staffNationalScoreSum / staffNationalResponses
    : null;
  const selectedStaffNationalDelta = staffDeltaPercent(
    selectedStaffAverage,
    staffNationalAverage,
  );
  const selectedStaffTenure = selectedStaffEmployee
    ? formatStaffTenure(selectedStaffEmployee.tenureMonths)
    : "―";
  const selectedStaffCohort = staffTenureCohorts.find(
    (cohort) => cohort.id === selectedStaffEmployee?.tenureBucket,
  );
  const groupVocAverage = averageOf(groupItems, "vocScore");
  const groupHappyAverage = averageOf(groupItems, "happyScore");
  const groupCombinedAverage = averageOf(groupItems, "combined");
  const groupAverageLabel =
    view === "dealer"
      ? `${selected.dealer} 평균`
      : view === "showroom"
        ? "전국 전시장 평균"
        : view === "region"
          ? "동일 권역별 평균"
          : "동일 사이즈 평균";
  const selectedAverageLabel = `${displayShowroomName(selected.showroom)} 평균`;
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
          : "전국 39개 전시장";
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
    "--avg-x": `${clamp(((groupHappyAverage - 65) / 35) * 100)}%`,
    "--avg-y": `${clamp(((groupVocAverage - 75) / 25) * 100)}%`,
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

  const changeView = (nextView: AnalysisView) => {
    setView(nextView);
    window.history.replaceState(
      null,
      "",
      `/dashboard/${selected.cdsid}/analysis?view=${nextView}`,
    );
  };

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
            aria-label={`${displayShowroomName(selected.showroom)} 현황으로 이동`}
            onClick={(event) => event.currentTarget.blur()}
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
            aria-label={`${displayShowroomName(selected.showroom)} 현황으로 이동`}
            onClick={(event) => event.currentTarget.blur()}
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
            aria-label={`${displayShowroomName(selected.showroom)} 현황으로 이동`}
            onClick={(event) => event.currentTarget.blur()}
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
            aria-label={`${displayShowroomName(selected.showroom)} 현황으로 이동`}
            onClick={(event) => event.currentTarget.blur()}
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
                {key === "dealer"
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
            <span>종합 만족도 평균</span>
            <ul className="analysis-summary-breakdown">
              <li>VOC 상담 만족도</li>
              <li>ONE Voice 시승 만족도</li>
              <li>ONE Voice 출고 만족도</li>
            </ul>
          </div>
          <strong>
            {displayNumber(selectedPoint.vocScore)}
            <small>점</small>
          </strong>
          <em
            className={
              selectedPoint.vocScore >= groupVocAverage ? "positive" : "negative"
            }
          >
            {groupLabel} 평균 {displayNumber(groupVocAverage)}점 대비{" "}
            {selectedPoint.vocScore >= groupVocAverage ? "+" : ""}
            {displayNumber(selectedPoint.vocScore - groupVocAverage)}점
          </em>
        </article>

        <article className="analysis-summary-card happycall">
          <div>
            <span>해피콜 이행률</span>
            <ul className="analysis-summary-breakdown">
              <li>VOC 상담 후 해피콜(24시간 이내)</li>
              <li>ONE VOICE 출고 후 해피콜(24시간 이내)</li>
            </ul>
          </div>
          <strong>
            {displayNumber(selectedPoint.happyScore)}
            <small>점</small>
          </strong>
          <em
            className={
              selectedPoint.happyScore >= groupHappyAverage
                ? "positive"
                : "negative"
            }
          >
            {groupLabel} 평균 {displayNumber(groupHappyAverage)}점 대비{" "}
            {selectedPoint.happyScore >= groupHappyAverage ? "+" : ""}
            {displayNumber(selectedPoint.happyScore - groupHappyAverage)}점
          </em>
        </article>

        <article className="analysis-summary-card balance">
          <div>
            <span>균형 경쟁력</span>
            <small>종합 만족도와 해피콜 합산 평균</small>
          </div>
          <strong>
            {displayNumber(selectedPoint.combined)}
            <small>점</small>
          </strong>
          <em>
            {viewMeta[view].short} {safeSelectedRank}위 / 전체 {groupItems.length}
          </em>
        </article>
        </section>
      </div>
      </div>

      <section className="analysis-workspace">
        <article className="analysis-scatter-card">
          <header className="analysis-card-heading">
            <div>
              <h2>종합 만족도 × 해피콜 이행</h2>
            </div>
            <div className="analysis-legend" aria-label="차트 범례">
              <span className="selected">내 전시장</span>
              <span>비교 전시장</span>
              <span className="average">그룹 평균</span>
            </div>
          </header>

          <div className="analysis-scatter-shell">
            <div className="scatter-y-title">종합 만족도</div>
            <div
              className="analysis-scatter"
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
                <span>해피콜 이행</span>
                <strong>평균 {displayNumber(groupHappyAverage)}점</strong>
              </span>
              <span className="scatter-average-value horizontal">
                <span>종합 만족도</span>
                <strong>평균 {displayNumber(groupVocAverage)}점</strong>
              </span>
              {groupItems.map((item) => {
                const pointX = clamp(
                  ((item.happyScore - 65) / 35) * 100,
                );
                const pointY = clamp(
                  ((item.vocScore - 75) / 25) * 100,
                );
                const isSelected = item.cdsid === selected.cdsid;
                const isHovered =
                  !isSelected && hoveredCdsid === item.cdsid;
                const callout = scatterCallouts.get(item.cdsid) ?? {
                  offsetX: 16,
                  offsetY: -16,
                  tailX: 5,
                  tailY: 5,
                  placement: "right-up" as const,
                };
                const pointStyle = {
                  "--point-x": `${pointX}%`,
                  "--point-y": `${pointY}%`,
                  "--callout-x": `${callout.offsetX}px`,
                  "--callout-y": `${callout.offsetY}px`,
                  "--callout-tail-x": `${callout.tailX}px`,
                  "--callout-tail-y": `${callout.tailY}px`,
                } as CSSProperties;
                const pointLabel = `${displayShowroomName(item.showroom)} · 종합 만족도 ${displayNumber(
                  item.vocScore,
                )} · 해피콜 ${displayNumber(item.happyScore)}`;
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
                    tabIndex={denseScatter && !isSelected ? 0 : undefined}
                    onMouseEnter={() => setHoveredCdsid(item.cdsid)}
                    onMouseLeave={() => setHoveredCdsid(null)}
                    onFocus={() => setHoveredCdsid(item.cdsid)}
                    onBlur={() => setHoveredCdsid(null)}
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
            <div className="scatter-x-title">해피콜 이행</div>
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
            <strong>{groupItems.length}개점</strong>
          </header>
          <div className="analysis-ranking-head" aria-hidden="true">
            <span>순위 · 전시장</span>
            <span>종합 만족도</span>
            <span>해피콜 이행</span>
            <span>합산 평균</span>
          </div>
          <div className="analysis-ranking-list">
            {rankRows.map((item) => {
              const rank =
                groupItems.findIndex((groupItem) => groupItem.cdsid === item.cdsid) +
                1;
              const isSelected = item.cdsid === selected.cdsid;
              const isHovered =
                !isSelected && hoveredCdsid === item.cdsid;
              return (
                <div
                  className={isSelected ? "selected" : isHovered ? "hovered" : ""}
                  key={item.cdsid}
                  onMouseEnter={() => setHoveredCdsid(item.cdsid)}
                  onMouseLeave={() => setHoveredCdsid(null)}
                >
                  <span className="analysis-rank">
                    <strong>{rank}</strong>
                    <span>
                      {displayShowroomName(item.showroom)}
                      <small>
                        {item.dealer} · {item.region} · {item.size}
                      </small>
                    </span>
                  </span>
                  <b>{displayNumber(item.vocScore)}</b>
                  <b>{displayNumber(item.happyScore)}</b>
                  <strong>{displayNumber(item.combined)}</strong>
                </div>
              );
            })}
          </div>
          <footer>
            <span>
              {groupAverageLabel}
              <strong>{displayNumber(groupCombinedAverage)}</strong>
            </span>
            <span>
              {selectedAverageLabel}
              <strong>{displayNumber(selectedPoint.combined)}</strong>
            </span>
            <span className={`analysis-average-delta ${selectedAverageDeltaTone}`}>
              평균 대비
              <strong>
                {selectedAverageDeltaArrow} {displayNumber(Math.abs(selectedAverageDelta))}점
              </strong>
            </span>
          </footer>
        </article>
      </section>

      {selectedStaffAnalysis ? (
        <section
          className="analysis-staff-card"
          aria-label={`${displayShowroomName(selected.showroom)} 소속 영업직원 상담만족도 결과`}
        >
          <header className="analysis-staff-heading">
            <div>
              <h2>소속 영업직원 상담만족도 결과</h2>
            </div>
            <div className="analysis-staff-source">
              <span>
                {staffAnalysisSource.rosterCheckedAt.replaceAll("-", "").slice(2)} Sales-DMS 재직인원 기준
              </span>
            </div>
          </header>

          <div className="analysis-staff-workspace">
            <aside
              className="analysis-staff-roster"
              aria-label="전체 기간 상담 만족도 순위별 소속 직원"
            >
              <header>
                <div>
                  <h3>소속 직원 순위</h3>
                  <p>전체 기간 상담 만족도</p>
                </div>
                <span>{currentSalesStaff.length}명</span>
              </header>
              <div className="analysis-staff-roster-list">
                {rankedSalesStaff.map(({ employee, average, responses }, index) => {
                  const isSelected = employee.name === selectedStaffEmployee?.name;
                  return (
                    <button
                      type="button"
                      className={isSelected ? "selected" : ""}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedStaffName(employee.name)}
                      key={employee.name}
                    >
                      <span className="analysis-staff-roster-rank">
                        {average === null ? "―" : index + 1}
                      </span>
                      <span className="analysis-staff-roster-identity">
                        <strong>{employee.name}</strong>
                        <small>
                          {employee.role} · {formatStaffTenure(employee.tenureMonths)}
                        </small>
                      </span>
                      <span className="analysis-staff-roster-score">
                        <strong>{average === null ? "―" : average.toFixed(1)}</strong>
                        <small>{responses ? `${responses}건` : "표본 없음"}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="analysis-staff-detail">
              <header className="analysis-staff-detail-heading">
                <div>
                  <span>MANAGER COACHING VIEW</span>
                  <h3>{selectedStaffEmployee?.name ?? "선택 직원"} SC 종합 분석</h3>
                </div>
                <p>4개년 추이 · 전국/근무연령대 비교 · 고객 코멘트</p>
              </header>

          <div className="analysis-staff-summary">
            <article className="analysis-staff-profile-card">
              <div className="analysis-staff-profile-photo">
                {selectedStaffProfile ? (
                  <img
                    src={selectedStaffProfile.image}
                    alt={`${selectedStaffEmployee?.name ?? "선택 직원"} 공식 프로필`}
                  />
                ) : (
                  <span aria-hidden="true">{selectedStaffInitials}</span>
                )}
              </div>
              <div>
                <span>선택 직원</span>
                <strong className="name">
                  {selectedStaffEmployee?.name ?? "―"}
                  <small>{selectedStaffEmployee?.role ?? ""}</small>
                </strong>
                <em>
                  {selectedStaffProfile
                    ? `${selectedStaffProfileShowroom?.dealer ?? "딜러사"} 공식 프로필`
                    : "공식 프로필 사진 미등록"}
                </em>
              </div>
            </article>
            <article>
              <span>근무기간</span>
              <strong>
                {selectedStaffTenure}
                <small>{selectedStaffEmployee?.tenureBucketLabel ?? ""}</small>
              </strong>
              <em>
                입사일 {selectedStaffEmployee ? formatStaffDate(selectedStaffEmployee.hireDate) : "―"}
              </em>
            </article>
            <article>
              <span>4개년 상담 만족도</span>
              <strong>
                {selectedStaffAverage === null
                  ? "―"
                  : selectedStaffAverage.toFixed(1)}
                <small>/ 10점</small>
              </strong>
            </article>
            <article>
              <span>VOC 회신</span>
              <strong>
                {selectedStaffResponses}
                <small>건</small>
              </strong>
            </article>
          </div>

          <div className="analysis-staff-comparison-layout">
            <div
              className="analysis-staff-history"
              role="img"
              aria-label={`${selectedStaffEmployee?.name ?? "선택 직원"} 2023년부터 2026년 YTD까지 상담 만족도`}
            >
              {selectedStaffYearRows.map((year) => {
                const barHeight = year.average === null ? 0 : year.average * 10;
                const nationalBarHeight = (year.nationalAverage ?? 0) * 10;
                const deltaTone =
                  year.deltaPercent === null
                    ? "neutral"
                    : year.deltaPercent > 0
                      ? "positive"
                      : year.deltaPercent < 0
                        ? "negative"
                        : "neutral";
                return (
                  <article
                    className={year.average === null ? "empty" : ""}
                    key={year.year}
                    aria-label={`${year.year === "2026" ? "2026 YTD" : year.year}: ${
                      year.average === null
                        ? "회신 없음"
                        : `평균 ${year.average.toFixed(1)}점, ${year.responses}건`
                    }`}
                  >
                    <header>
                      <strong>{year.year === "2026" ? "2026 YTD" : year.year}</strong>
                      <span className={`delta-${deltaTone}`}>
                        {year.deltaPercent === null
                          ? "비교 없음"
                          : `${year.deltaPercent > 0 ? "▲" : year.deltaPercent < 0 ? "▼" : "―"} ${Math.abs(year.deltaPercent).toFixed(1)}%`}
                      </span>
                    </header>
                    <div className="analysis-staff-chart-track">
                      <div className="analysis-staff-chart-bars">
                        <div
                          className="analysis-staff-chart-bar employee"
                          style={
                            { "--staff-bar-height": `${barHeight}%` } as CSSProperties
                          }
                        >
                          <b>{year.average === null ? "―" : year.average.toFixed(1)}</b>
                          <small>{year.responses ? `${year.responses}건` : "회신 없음"}</small>
                        </div>
                        <div
                          className="analysis-staff-chart-bar national"
                          style={
                            { "--staff-bar-height": `${nationalBarHeight}%` } as CSSProperties
                          }
                        >
                          <b>{year.nationalAverage?.toFixed(1) ?? "―"}</b>
                          <small>{year.nationalResponses.toLocaleString("ko-KR")}건</small>
                        </div>
                      </div>
                    </div>
                    <footer>
                      <span><i className="employee" />고객상담 만족도</span>
                      <span><i className="national" />전국 영업직원 평균</span>
                    </footer>
                  </article>
                );
              })}
            </div>

            <aside className="analysis-staff-benchmarks" aria-label="전국 및 근무연령대 비교대조군">
              <header>
                <div>
                  <h3>비교대조군</h3>
                  <p>전국 및 근무연령대</p>
                </div>
                <span>4개년 누적</span>
              </header>

              <article className="analysis-staff-national-benchmark">
                <div>
                  <span>전국 영업직원</span>
                  <strong>{staffNationalAverage?.toFixed(2) ?? "―"}<small>점</small></strong>
                </div>
                <div>
                  <b>{staffNationalResponses.toLocaleString("ko-KR")}건</b>
                  <em className={
                    selectedStaffNationalDelta === null
                      ? "neutral"
                      : selectedStaffNationalDelta >= 0
                        ? "positive"
                        : "negative"
                  }>
                    {selectedStaffNationalDelta === null
                      ? "비교 없음"
                      : `${selectedStaffNationalDelta >= 0 ? "▲" : "▼"} ${Math.abs(selectedStaffNationalDelta).toFixed(1)}%`}
                  </em>
                </div>
              </article>

              <section className="analysis-staff-tenure" aria-label="근무연령대별 상담 만족도 비교">
                <header>
                  <div>
                    <h3>근무연령대 비교</h3>
                    <p>{selectedStaffEmployee?.name ?? "선택 직원"} SC · {selectedStaffTenure}</p>
                  </div>
                  <strong>{selectedStaffEmployee?.tenureBucketLabel ?? "―"}</strong>
                </header>
                <div className="analysis-staff-cohorts">
                  {staffTenureCohorts.map((cohort) => {
                    const isSelected = cohort.id === selectedStaffCohort?.id;
                    return (
                      <article className={isSelected ? "selected" : ""} key={cohort.id}>
                        <header>
                          <strong>{cohort.label}</strong>
                          {isSelected ? <span>소속 구간</span> : null}
                        </header>
                        <div className="analysis-staff-cohort-track">
                          <i
                            style={
                              {
                                "--staff-cohort-width": `${(cohort.average ?? 0) * 10}%`,
                              } as CSSProperties
                            }
                          />
                        </div>
                        <footer>
                          <b>{cohort.average === null ? "―" : cohort.average.toFixed(2)}점</b>
                          <span>{cohort.responses.toLocaleString("ko-KR")}건 · {cohort.employeeCount}명</span>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </section>
            </aside>
          </div>

          <section className="analysis-staff-insights" aria-label="4개년 VOC 영업지원 핵심 분석">
            <header>
              <div>
                <h3>4개년 VOC 영업지원 핵심 분석</h3>
                <p>2023~2026 YTD 고객 코멘트의 반복 표현을 분류했습니다.</p>
              </div>
              <span>{selectedStaffEmployee?.commentResponses ?? 0}건 분석</span>
            </header>
            <div>
              <article className="strength">
                <h4>유지·강화</h4>
                <div>
                  {(selectedStaffEmployee?.strengthKeywords ?? []).length ? (
                    selectedStaffEmployee?.strengthKeywords.map((keyword) => (
                      <span key={keyword.label}>
                        {keyword.label}<small>{keyword.mentions}회</small>
                      </span>
                    ))
                  ) : (
                    <em>분석 가능한 긍정 코멘트 없음</em>
                  )}
                </div>
              </article>
              <article className="improvement">
                <h4>개선 기회</h4>
                <div>
                  {(selectedStaffEmployee?.improvementKeywords ?? []).length ? (
                    selectedStaffEmployee?.improvementKeywords.map((keyword) => (
                      <span key={keyword.label}>
                        {keyword.label}<small>{keyword.mentions}회</small>
                      </span>
                    ))
                  ) : (
                    <em>반복 확인된 개선 키워드 없음</em>
                  )}
                </div>
              </article>
            </div>
          </section>

            </div>
          </div>

        </section>
      ) : null}

      <section className="v3s-award-card" aria-label="V3S 인센티브 수상기록">
        <header className="v3s-award-heading">
          <div>
            <h2>
              <span className="english-title">V3S</span> 인센티브 수상기록
            </h2>
            <p>
              상반기(Q1, Q2 모두 97점 이상 시) 하반기(Q3, Q4 모두 97점 이상 시) 지급
            </p>
          </div>
          <div className="v3s-award-record">
            <span>누적기록</span>
            <strong>
              {selectedAwardName} {selectedAwardCount}회 수상
            </strong>
          </div>
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
                            <strong>{selectedAwardName}</strong>
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
