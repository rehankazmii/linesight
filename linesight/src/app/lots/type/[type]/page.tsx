"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ContentCard } from "@/components/content-card";

type LotSummary = {
  id: number;
  code: string;
  type: string | null;
  createdAt: string | null;
  unitsBuilt: number;
  yield: number;
  reworkRate: number;
  scrapRate: number;
  episodeCount: number;
  health: "GOOD" | "WARN" | "BAD";
  correlatedFailureRate: number;
};

type LotsResponse = {
  lots: LotSummary[];
};

const formatPercent = (value: number) => {
  const pct = value * 100;
  const digits = Math.abs(pct) < 10 ? 2 : 1;
  return `${pct.toFixed(digits)}%`;
};

const lotHealthClass = (health: LotSummary["health"]) => {
  if (health === "BAD") return "bg-rose-500/10 border-rose-500/30";
  if (health === "WARN") return "bg-amber-500/10 border-amber-500/30";
  return "bg-slate-900/50 border-slate-800";
};

export default function LotTypePage() {
  const params = useParams<{ type: string }>();
  const [data, setData] = useState<LotsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const typeLabel = useMemo(() => decodeURIComponent(params.type), [params.type]);

  useEffect(() => {
    let cancelled = false;
    const fetchLots = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/lots");
        if (!res.ok) throw new Error("Failed to fetch lots");
        const json: LotsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Unable to load lots. Please retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLots();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLots =
    data?.lots.filter((l) => (l.type ?? "Unspecified") === typeLabel) ?? [];

  return (
    <div className="space-y-6">
      <ContentCard
        title={`Lot Type: ${typeLabel}`}
        subtitle="Detailed lot metrics for this type"
      >
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Link href="/lots" className="text-sky-300 hover:underline">
            ← Back to lot types
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-12 rounded-xl border border-slate-800/70 bg-slate-900/70"
              >
                <div className="h-full animate-pulse rounded-xl bg-slate-800/60" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : filteredLots.length === 0 ? (
          <p className="text-sm text-slate-400">No lots for this type.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/80 shadow-inner shadow-slate-950/30">
            <table className="w-full border-collapse text-sm text-slate-100">
              <thead className="bg-slate-900/70 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Lot code</th>
                  <th className="px-4 py-3 font-semibold text-right">Units built</th>
                  <th className="px-4 py-3 font-semibold text-right">Yield</th>
                  <th className="px-4 py-3 font-semibold text-right">Rework</th>
                  <th className="px-4 py-3 font-semibold text-right">Scrap</th>
                  <th className="px-4 py-3 font-semibold text-right">Failure rate</th>
                  <th className="px-4 py-3 font-semibold text-right">Episodes</th>
                  <th className="px-4 py-3 font-semibold text-right">Health</th>
                  <th className="px-4 py-3 font-semibold text-right">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredLots.map((lot, idx) => {
                  const rowBg = idx % 2 === 0 ? "bg-slate-900/60" : "bg-slate-900/40";
                  return (
                    <tr
                      key={lot.id}
                      className={`${rowBg} ${lotHealthClass(lot.health)}`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-50">
                        {lot.code}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-100">
                        {lot.unitsBuilt}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center justify-end rounded-full px-2 py-0.5 text-xs font-medium ${
                            lot.health === "BAD"
                              ? "bg-rose-500/20 text-rose-100"
                              : "bg-emerald-500/20 text-emerald-100"
                          }`}
                        >
                          {formatPercent(lot.yield)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-100">
                        {formatPercent(lot.reworkRate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center justify-end rounded-full px-2 py-0.5 text-xs font-medium ${
                            lot.scrapRate > 0.02
                              ? "bg-rose-500/20 text-rose-100"
                              : "bg-slate-800 text-slate-200"
                          }`}
                        >
                          {formatPercent(lot.scrapRate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-100">
                        {formatPercent(lot.correlatedFailureRate)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-100">
                        {lot.episodeCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center justify-end rounded-full px-2 py-0.5 text-xs font-semibold ${
                            lot.health === "BAD"
                              ? "bg-rose-500/20 text-rose-100"
                              : lot.health === "WARN"
                                ? "bg-amber-500/20 text-amber-100"
                                : "bg-emerald-500/20 text-emerald-100"
                          }`}
                        >
                          {lot.health === "GOOD"
                            ? "Good"
                            : lot.health === "WARN"
                              ? "Watch"
                              : "At risk"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {lot.createdAt ? dateFormatter.format(new Date(lot.createdAt)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ContentCard>
    </div>
  );
}
