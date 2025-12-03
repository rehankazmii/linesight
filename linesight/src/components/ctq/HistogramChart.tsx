"use client";

type HistogramChartProps = {
  bins: { label: string; count: number }[];
};

export default function HistogramChart({ bins }: HistogramChartProps) {
  if (!bins || bins.length === 0) {
    return <p className="text-sm text-slate-400">Not enough data to plot a histogram.</p>;
  }
  const max = Math.max(...bins.map((b) => b.count), 1);

  return (
    <div className="mt-3 flex items-end gap-1">
      {bins.map((bin) => (
        <div key={bin.label} className="flex-1">
          <div
            className="w-full rounded-t-sm bg-slate-500"
            style={{ height: `${Math.max(6, (bin.count / max) * 80)}px` }}
            title={`${bin.label}: ${bin.count}`}
          />
          <p className="mt-1 text-[10px] text-slate-400 text-center">{bin.label}</p>
        </div>
      ))}
    </div>
  );
}
