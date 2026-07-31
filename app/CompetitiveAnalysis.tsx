"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
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
    description: "전국 39개 전시장의 고객만족도와 해피콜 이행을 비교합니다.",
    short: "전국 전시장",
  },
  region: {
    label: "동일 수도권 내 분석",
    description: "수도권 소재 전시장 안에서 현재 위치와 균형을 확인합니다.",
    short: "수도권",
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
            <span aria-hidden="true">←</span> 메인 대시보드
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
                ? selected.dealer
                : key === "region"
                  ? selected.region
                  : key === "size"
                    ? selected.size
                    : "39개점"}
            </small>
          </button>
        ))}
      </nav>

      <section className="analysis-summary-grid">
        <article className="analysis-summary-card satisfaction">
          <div>
            <span>고객만족도</span>
            <small>VOC · 상담/시승/출고 경험</small>
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
            {groupLabel} 평균 대비{" "}
            {selectedPoint.vocScore >= groupVocAverage ? "+" : ""}
            {displayNumber(selectedPoint.vocScore - groupVocAverage)}점
          </em>
        </article>

        <article className="analysis-summary-card happycall">
          <div>
            <span>해피콜 이행</span>
            <small>상담/출고 사후관리 실행력</small>
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
            {groupLabel} 평균 대비{" "}
            {selectedPoint.happyScore >= groupHappyAverage ? "+" : ""}
            {displayNumber(selectedPoint.happyScore - groupHappyAverage)}점
          </em>
        </article>

        <article className="analysis-summary-card balance">
          <div>
            <span>균형 경쟁력</span>
            <small>고객만족도와 해피콜 단순 평균</small>
          </div>
          <strong>
            {displayNumber(selectedPoint.combined)}
            <small>점</small>
          </strong>
          <em>
            {viewMeta[view].short} {safeSelectedRank}위 / {groupItems.length}
          </em>
        </article>
      </section>

      <section className="analysis-workspace">
        <article className="analysis-scatter-card">
          <header className="analysis-card-heading">
            <div>
              <span>DUAL METRIC POSITION</span>
              <h2>고객만족도 × 해피콜 이행</h2>
            </div>
            <div className="analysis-legend" aria-label="차트 범례">
              <span className="selected">내 전시장</span>
              <span>비교 전시장</span>
              <span className="average">그룹 평균</span>
            </div>
          </header>

          <div className="analysis-scatter-shell">
            <div className="scatter-y-title">고객만족도</div>
            <div className="analysis-scatter" style={scatterStyle}>
              <span className="scatter-quadrant top-left">만족도 우세</span>
              <span className="scatter-quadrant top-right">균형 우수</span>
              <span className="scatter-quadrant bottom-left">개선 집중</span>
              <span className="scatter-quadrant bottom-right">해피콜 우세</span>
              <i className="scatter-average-line vertical" />
              <i className="scatter-average-line horizontal" />
              {groupItems.map((item, index) => {
                const pointX = clamp(
                  ((item.happyScore - 65) / 35) * 100,
                );
                const pointY = clamp(
                  ((item.vocScore - 75) / 25) * 100,
                );
                const pointStyle = {
                  "--point-x": `${pointX}%`,
                  "--point-y": `${pointY}%`,
                } as CSSProperties;
                const isSelected = item.cdsid === selected.cdsid;
                const labelPlacement = scatterLabelPlacement(
                  pointX,
                  pointY,
                  index,
                  isSelected,
                );
                const pointLabel = `${displayShowroomName(item.showroom)} · 고객만족도 ${displayNumber(
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
                    } label-${labelPlacement} ${
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
            <span>균형</span>
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
