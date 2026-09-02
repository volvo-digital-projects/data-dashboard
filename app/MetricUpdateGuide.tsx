"use client";

import { useLayoutEffect, useRef, useState } from "react";

export default function MetricUpdateGuide({
  updateWeek,
  fallbackLeft,
}: {
  updateWeek: number;
  fallbackLeft: number;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(`${fallbackLeft}%`);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const list = layer?.parentElement;
    if (!layer || !list) return;

    const alignToLatestPoint = () => {
      const latestPoint = list.querySelector<SVGCircleElement>(
        ".metric-detail-card .metric-detail-latest-point",
      );
      if (!latestPoint) return;

      const layerRect = layer.getBoundingClientRect();
      const pointRect = latestPoint.getBoundingClientRect();
      const pointCenter = pointRect.left + pointRect.width / 2;
      setLeft(`${pointCenter - layerRect.left}px`);
    };

    alignToLatestPoint();
    const frame = window.requestAnimationFrame(alignToLatestPoint);
    const observer = new ResizeObserver(alignToLatestPoint);
    observer.observe(list);
    const chart = list.querySelector(".metric-detail-chart");
    if (chart) observer.observe(chart);
    window.addEventListener("resize", alignToLatestPoint);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", alignToLatestPoint);
    };
  }, [fallbackLeft, updateWeek]);

  return (
    <div
      ref={layerRef}
      className="metric-detail-update-guide-layer"
      role="note"
      aria-label={`현재 업데이트 기준 W${updateWeek}`}
    >
      <div className="metric-detail-update-guide" style={{ left }}>
        <span>업데이트</span>
      </div>
    </div>
  );
}
