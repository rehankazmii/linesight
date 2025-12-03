"use client";

import clsx from "clsx";

type MetricTileProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: string;
  status?: "neutral" | "good" | "warn" | "bad";
  onClick?: () => void;
};

export function MetricTile({
  label,
  value,
  delta,
  trend,
  status = "neutral",
  onClick,
}: MetricTileProps) {
  const statusColor =
    status === "good"
      ? "text-emerald-400"
      : status === "warn"
        ? "text-amber-400"
        : status === "bad"
          ? "text-rose-400"
          : "text-slate-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full rounded-2xl border border-slate-800/70 bg-slate-900/70 px-4 py-3 text-left shadow-inner shadow-slate-950/30 transition hover:border-slate-700 hover:bg-slate-900",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-slate-50">{value}</p>
        {delta ? <span className={clsx("text-sm font-medium", statusColor)}>{delta}</span> : null}
      </div>
      {trend ? <p className="text-xs text-slate-400">{trend}</p> : null}
    </button>
  );
}
