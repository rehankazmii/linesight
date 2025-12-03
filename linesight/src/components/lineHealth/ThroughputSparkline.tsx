"use client";

type ThroughputSparklineProps = {
  data: { label: string; value: number }[];
};

export default function ThroughputSparkline({ data }: ThroughputSparklineProps) {
  if (!data || data.length === 0) {
    return <p className="mt-2 text-sm text-neutral-500">No throughput data in this window.</p>;
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="mt-3 flex items-end gap-1">
      {data.map((point, idx) => (
        <div key={point.label + idx} className="flex-1">
          <div
            className="w-full rounded-t-sm bg-neutral-200"
            style={{ height: `${Math.max(8, (point.value / maxVal) * 60)}px` }}
            title={`${point.value} units`}
          />
        </div>
      ))}
    </div>
  );
}
