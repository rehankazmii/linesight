"use client";

import { useState } from "react";

type ControlChartProps = {
  points: { label: string; value: number }[];
  lsl: number | null;
  usl: number | null;
};

export default function ControlChart({ points, lsl, usl }: ControlChartProps) {
  if (!points || points.length === 0) {
    return <p className="text-sm text-slate-400">Not enough data to plot a control chart.</p>;
  }

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || 1;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  const positionForIdx = (idx: number) => (idx / Math.max(1, points.length - 1)) * 100;
  const yForVal = (val: number) => 50 - ((val - minVal) / span) * 50;

  return (
    <div className="relative mt-3">
      <svg
        viewBox="0 0 100 50"
        className="h-32 w-full rounded-lg bg-slate-900/70"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {lsl !== null && (
          <line
            x1="0"
            y1={`${yForVal(lsl)}`}
            x2="100"
            y2={`${yForVal(lsl)}`}
            stroke="#fbbf24"
            strokeDasharray="3 2"
            strokeWidth={0.6}
          />
        )}
        {usl !== null && (
          <line
            x1="0"
            y1={`${yForVal(usl)}`}
            x2="100"
            y2={`${yForVal(usl)}`}
            stroke="#fbbf24"
            strokeDasharray="3 2"
            strokeWidth={0.6}
          />
        )}
        {points.map((p, idx) => {
          const x = positionForIdx(idx);
          const y = yForVal(p.value);
          return (
            <g
              key={p.label}
              onMouseEnter={() => setHoverIdx(idx)}
              onFocus={() => setHoverIdx(idx)}
              tabIndex={0}
            >
              {idx > 0 && (
                <line
                  x1={positionForIdx(idx - 1)}
                  y1={yForVal(points[idx - 1].value)}
                  x2={x}
                  y2={y}
                  stroke="#38bdf8"
                  strokeWidth={0.9}
                />
              )}
              <circle cx={x} cy={y} r={1.8} className="fill-sky-400" />
            </g>
          );
        })}
      </svg>
      {hovered ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 shadow-lg"
          style={{
            left: `${positionForIdx(hoverIdx!)}%`,
            top: `${yForVal(hovered.value)}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <div className="font-semibold">{hovered.label}</div>
          <div>Value: {hovered.value.toFixed(2)}</div>
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-slate-500">Hover any point to see date and value.</p>
    </div>
  );
}
