"use client";

import Link from "next/link";

type LotHeatmapProps = {
  lots: { id: number; code: string; type: string; supplier: string | null }[];
  ctqs: { id: number; name: string; code: string }[];
  matrix: number[][];
  tested: number[][];
  fails: number[][];
};

const colorForRate = (rate: number) => {
  if (rate === 0) return "bg-neutral-100";
  if (rate < 0.02) return "bg-emerald-100";
  if (rate < 0.05) return "bg-amber-200";
  if (rate < 0.1) return "bg-orange-300";
  return "bg-rose-400 text-white";
};

export default function LotHeatmap({ lots, ctqs, matrix, tested, fails }: LotHeatmapProps) {
  if (!lots.length || !ctqs.length) {
    return <p className="text-sm text-neutral-500">No lot/CTQ data available for this range.</p>;
  }

  return (
    <div className="overflow-auto">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[200px_repeat(auto,1fr)] items-stretch">
          <div className="sticky top-0 z-10 bg-white p-2 text-xs font-semibold text-neutral-800">Lot · Supplier</div>
          {ctqs.map((c) => (
            <div key={c.id} className="sticky top-0 z-10 bg-white p-2 text-xs font-semibold text-neutral-800 text-center">
              {c.code ?? c.name}
            </div>
          ))}
          {lots.map((lot, li) => (
            <Link
              href={`/lots/${lot.id}`}
              key={lot.id}
              className="contents hover:bg-neutral-50"
              title={`Lot ${lot.code} (${lot.type})`}
            >
              <div className="border-t border-neutral-200 p-2 text-sm text-neutral-800">
                <div className="font-semibold">{lot.code}</div>
                <div className="text-xs text-neutral-500">
                  {lot.type} · {lot.supplier ?? "Unknown supplier"}
                </div>
              </div>
              {ctqs.map((ctq, ci) => {
                const rate = matrix[li]?.[ci] ?? 0;
                const t = tested[li]?.[ci] ?? 0;
                const f = fails[li]?.[ci] ?? 0;
                return (
                  <div
                    key={`${lot.id}-${ctq.id}`}
                    className={`flex items-center justify-center border-t border-neutral-200 p-2 text-xs font-semibold ${colorForRate(rate)}`}
                    title={`${lot.code} × ${ctq.code ?? ctq.name}: tested ${t}, fails ${f}, rate ${(rate * 100).toFixed(1)}%`}
                  >
                    {(rate * 100).toFixed(1)}%
                  </div>
                );
              })}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
