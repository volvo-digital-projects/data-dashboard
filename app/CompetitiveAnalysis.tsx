"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dashboardJson from "./data/showrooms.json";

type AnalysisView = "dealer" | "showroom" | "region" | "size";

type AnalysisShowroom = {
  cdsid: string;
  showroom: string;
  dealer: string;
  manager: string;
  size: string;
  region: string;
  voc: number | null;
  happyCall: number | null;
};

type AnalysisPoint = AnalysisShowroom & {
  vocScore: number;
  happyScore: number;
  combined: number;
};

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

const viewMeta: Record<
  AnalysisView,
  { label: string; description: string; short: string }
> = {
  dealer: {
    label: "소속 딜러사 내 분석",
    description: "같은 딜러사 소속 전시장의 고객 경험 경쟁력을 비교합니다.",
    short: "소속 딜러사",
  },
  showroom: {
    label: "전국 전시장 내 분석",
    description: "전국 39개 전시장의 종합 만족도와 해피콜 이행을 비교합니다.",
    short: "전시장",
  },
  region: {
    label: "동일 권역별 내 분석",
    description: "동일 권역 소재 전시장 안에서 현재 위치와 균형을 확인합니다.",
    short: "권역별",
  },
  size: {
    label: "동일 사이즈 내 분석",
    description: "동급 사이즈 전시장끼리 운영 품질과 고객 경험을 비교합니다.",
    short: "동급 사이즈",
  },
};

const displayNumber = (value: number) => value.toFixed(1);

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
    const centerDistance = Math.max(1, Math.hypot(anchorX, anchorY));
    const pointRadius = isSelected ? 6.5 : 4.5;
    const overlapScale = Math.max(
      0.2,
      (centerDistance - pointRadius + 1) / centerDistance,
    );

    layouts.set(point.item.cdsid, {
      offsetX: best.offsetX,
      offsetY: best.offsetY,
      tailX: Math.max(3, Math.abs(anchorX) * overlapScale),
      tailY: Math.max(3, Math.abs(anchorY) * overlapScale),
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
  const scatterRef = useRef<HTMLDivElement>(null);
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
  const groupVocAverage = averageOf(groupItems, "vocScore");
  const groupHappyAverage = averageOf(groupItems, "happyScore");
  const groupCombinedAverage = averageOf(groupItems, "combined");
  const selectedRank =
    groupItems.findIndex((item) => item.cdsid === selected.cdsid) + 1;
  const safeSelectedRank = selectedRank || groupItems.length;
  const rankRows =
    groupItems.length <= 8 ? [...groupItems] : groupItems.slice(0, 6);
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
      <header className="analysis-header">
        <div>
          <Link href={`/dashboard/${selected.cdsid}`} className="analysis-back">
            <span className="analysis-back-icon" aria-hidden="true" />
            <span>메인 대시보드</span>
          </Link>
          <div className="analysis-title-row">
            <h1>{displayShowroomName(selected.showroom)} 경쟁력 분석</h1>
            <span>Q2</span>
          </div>
          <p>{viewMeta[view].description}</p>
        </div>
        <div className="analysis-context" aria-label="현재 전시장 정보">
          <span>
            딜러사<strong>{selected.dealer}</strong>
          </span>
          <span>
            권역별<strong>{selected.region}</strong>
          </span>
          <span>
            사이즈<strong>{selected.size}</strong>
          </span>
          <span>
            지점장<strong>{selected.manager}</strong>
          </span>
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
            <span>종합 만족도</span>
            <small>VOC + ONE Voice / 상담 및 출고 후 만족도 평가</small>
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
            <span>해피콜 이행</span>
            <small>VOC + ONE Voice / 상담 및 출고 후 해피콜 시행여부</small>
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

      <section className="analysis-workspace">
        <article className="analysis-scatter-card">
          <header className="analysis-card-heading">
            <div>
              <span>DUAL METRIC POSITION</span>
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
                    }`}
                    style={pointStyle}
                    title={pointLabel}
                    aria-label={pointLabel}
                    tabIndex={denseScatter && !isSelected ? 0 : undefined}
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
              <span>{viewMeta[view].label}</span>
              <h2>{groupLabel} 순위</h2>
            </div>
            <strong>{groupItems.length}개점</strong>
          </header>
          <div className="analysis-ranking-head" aria-hidden="true">
            <span>순위 · 전시장</span>
            <span>만족도</span>
            <span>해피콜</span>
            <span>합산 평균</span>
          </div>
          <div className="analysis-ranking-list">
            {rankRows.map((item) => {
              const rank =
                groupItems.findIndex((groupItem) => groupItem.cdsid === item.cdsid) +
                1;
              const isSelected = item.cdsid === selected.cdsid;
              return (
                <div
                  className={isSelected ? "selected" : ""}
                  key={item.cdsid}
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
              그룹 평균
              <strong>{displayNumber(groupCombinedAverage)}</strong>
            </span>
            <span>
              내 전시장
              <strong>{displayNumber(selectedPoint.combined)}</strong>
            </span>
          </footer>
        </article>
      </section>
    </main>
  );
}
