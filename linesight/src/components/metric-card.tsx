import { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  status?: "OK" | "WARNING" | "CRITICAL" | "NEUTRAL";
  pillLabel?: ReactNode;
};

const statusClasses: Record<
  NonNullable<MetricCardProps["status"]>,
  string
> = {
  OK: "border-emerald-200 bg-emerald-50 text-emerald-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-700",
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700",
  NEUTRAL: "border-neutral-200 bg-white text-neutral-600",
};

export function MetricCard({
  label,
  value,
  hint,
  status = "NEUTRAL",
  pillLabel,
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/90 px-4 py-5 shadow-sm">
      <div className="flex items-center justify-between text-sm text-neutral-600">
        <span>{label}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClasses[status]}`}
        >
          {pillLabel ?? "Live"}
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
        {value}
      </div>
      {hint ? <p className="mt-2 text-sm text-neutral-600">{hint}</p> : null}
    </div>
  );
}
