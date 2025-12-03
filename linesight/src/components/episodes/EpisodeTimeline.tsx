"use client";

import { useMemo, useState } from "react";

type TimelinePoint = {
  label: string;
  rty: number;
  ctq?: number | null;
};

type Marker = {
  label: string;
  dateLabel: string;
};

type Props = {
  points: TimelinePoint[];
  markers: Marker[];
};

export default function EpisodeTimeline({ points, markers }: Props) {
  if (!points || points.length === 0) {
    return <p className="text-sm text-neutral-500">Not enough data to plot a timeline.</p>;
  }

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const maxVal = useMemo(
    () =>
      Math.max(
        ...points.flatMap((p) => [p.rty, p.ctq ?? 0]).filter((v) => Number.isFinite(v) && v > 0),
        0.01,
      ),
    [points],
  );

  const normalizeY = (v: number) => 88 - (Math.min(v, 1) / maxVal) * 76; // keep padding
  const normalizeX = (idx: number) => (points.length === 1 ? 50 : (idx / (points.length - 1)) * 100);

  const rtyPath = useMemo(() => {
    if (!points.length) return "";
    return points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${normalizeX(idx).toFixed(2)} ${normalizeY(p.rty).toFixed(2)}`)
      .join(" ");
  }, [points]);

  const ctqPath = useMemo(() => {
    const available = points.filter((p) => p.ctq !== null && p.ctq !== undefined);
    if (!available.length) return "";
    return points
      .map((p, idx) => {
        if (p.ctq === null || p.ctq === undefined) return null;
        return `${idx === 0 ? "M" : "L"} ${normalizeX(idx).toFixed(2)} ${normalizeY(p.ctq).toFixed(2)}`;
      })
      .filter(Boolean)
      .join(" ");
  }, [points]);

  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const tooltipPosition =
    hoverIndex !== null
      ? { x: normalizeX(hoverIndex), y: normalizeY(points[hoverIndex].rty) }
      : null;

  return (
    <div className="mt-3">
      <div className="relative h-56 w-full overflow-visible rounded-lg border border-slate-800/70 bg-slate-950">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          {/* markers */}
          {markers.map((m, idx) => {
            const x = (idx / Math.max(1, markers.length - 1)) * 100;
            return (
              <g key={m.label + idx}>
                <line x1={x} y1={0} x2={x} y2={100} stroke="rgba(248,113,113,0.25)" strokeDasharray="3 2" strokeWidth={0.5} />
                <text x={x} y={10} textAnchor="middle" className="fill-rose-400 text-[9px]">
                  {m.label}
                </text>
              </g>
            );
          })}
          {/* RTY path */}
          <path d={rtyPath} fill="none" stroke="#22c55e" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
          {/* CTQ path */}
          {ctqPath ? (
            <path d={ctqPath} fill="none" stroke="#0ea5e9" strokeWidth={1} strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {/* Points */}
          {points.map((p, idx) => {
            const x = normalizeX(idx);
            const y = normalizeY(p.rty);
            const isHover = hoverIndex === idx;
            return (
              <g key={p.label}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHover ? 2.2 : 1.4}
                  className={isHover ? "fill-emerald-300" : "fill-emerald-500"}
                  onMouseEnter={() => setHoverIndex(idx)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
              </g>
            );
          })}
          {points.map((p, idx) => {
            if (p.ctq === null || p.ctq === undefined) return null;
            const x = normalizeX(idx);
            const y = normalizeY(p.ctq);
            const isHover = hoverIndex === idx;
            return (
              <g key={p.label + "-ctq"}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHover ? 2 : 1.2}
                  className={isHover ? "fill-sky-200" : "fill-sky-500"}
                  onMouseEnter={() => setHoverIndex(idx)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
              </g>
            );
          })}
        </svg>
        {hoveredPoint && tooltipPosition && (
          <div
            className="pointer-events-none absolute rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-50 shadow-lg"
            style={{
              left: `${Math.min(95, Math.max(5, tooltipPosition.x))}%`,
              top: `${Math.min(85, Math.max(15, tooltipPosition.y))}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            <div className="font-semibold">{hoveredPoint.label}</div>
            <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-slate-200">
              <span className="flex items-center gap-2">
                <span className="h-2 w-3 rounded-full bg-emerald-400" />
                RTY: {(hoveredPoint.rty * 100).toFixed(1)}%
              </span>
              {hoveredPoint.ctq !== null && hoveredPoint.ctq !== undefined ? (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-3 rounded-full bg-sky-400" />
                  CTQ fallout: {(hoveredPoint.ctq * 100).toFixed(1)}%
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1 font-medium">
          <span className="h-2 w-4 rounded-full bg-emerald-500" />
          RTY over episode window
        </span>
        {points.some((p) => p.ctq !== null && p.ctq !== undefined) ? (
          <span className="flex items-center gap-1 font-medium">
            <span className="h-2 w-4 rounded-full bg-sky-500" />
            CTQ fallout (linked CTQs)
          </span>
        ) : null}
      </div>
    </div>
  );
}
