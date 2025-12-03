"use client";

import Link from "next/link";

type FpyByStepChartProps = {
  data: {
    stepId: number;
    code: string;
    name: string;
    fpy: number;
    unitsReached: number;
    fails: number;
  }[];
};

const formatPercent = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function FpyByStepChart({ data }: FpyByStepChartProps) {
  if (!data || data.length === 0) {
    return <p className="mt-2 text-sm text-slate-400">No station data in this window.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {data.map((step) => (
        <Link
          key={step.stepId}
          href={`/stations?step=${encodeURIComponent(step.code)}`}
          className="block rounded-lg border border-slate-800/70 bg-slate-900/50 px-3 py-2 transition hover:border-slate-700 hover:bg-slate-900/80"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-50">{step.code}</p>
              <p className="text-xs text-slate-400">{step.name}</p>
            </div>
            <p className="text-sm font-semibold text-slate-50">{formatPercent(step.fpy)}</p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${Math.min(100, step.fpy * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {step.unitsReached.toLocaleString()} units · {step.fails} fails
          </p>
        </Link>
      ))}
    </div>
  );
}
