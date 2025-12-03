"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export default function LotsPage() {
  const [data, setData] = useState<LotsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchLots = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/lots");
        if (!response.ok) {
          throw new Error("Failed to fetch lots");
        }
        const json: LotsResponse = await response.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled)
          setError("Unable to load lots right now. Please retry shortly.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLots();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!data?.lots) return [];
    const map = new Map<string, LotSummary[]>();
    data.lots.forEach((lot) => {
      const key = lot.type ?? "Unspecified";
      const list = map.get(key) ?? [];
      list.push(lot);
      map.set(key, list);
    });

    const riskRank = (lots: LotSummary[]) => {
      const total = lots.length || 1;
      const badCount = lots.filter((l) => l.health === "BAD").length;
      const warnCount = lots.filter((l) => l.health === "WARN").length;
      const badShare = badCount / total;
      const warnShare = warnCount / total;
      if (badShare >= 0.5 || badCount >= 3) return "BAD";
      if (badCount > 0 || warnShare >= 0.25 || warnCount >= 2) return "WARN";
      return "GOOD";
    };

    const items = Array.from(map.entries()).map(([type, lots]) => {
      const risk = riskRank(lots);
      const atRisk = lots.filter((l) => l.health !== "GOOD").length;
      const avgYield = lots.reduce((sum, l) => sum + l.yield, 0) / lots.length;
      return {
        type,
        lots,
        risk,
        atRisk,
        avgYield,
      };
    });

    const order = { BAD: 0, WARN: 1, GOOD: 2 } as const;
    return items.sort((a, b) => {
      if (order[a.risk] !== order[b.risk]) return order[a.risk] - order[b.risk];
      return b.atRisk - a.atRisk;
    });
  }, [data]);

  return (
    <div className="space-y-6">
      <ContentCard
        title="Lots & Suppliers"
        subtitle="Scan lot types at a glance, then drill into risky lots."
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-16 rounded-xl border border-slate-800/70 bg-slate-900/70"
              >
                <div className="h-full animate-pulse rounded-xl bg-slate-800/60" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-slate-400">No lot data yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {grouped.map((group) => {
                const pillColor =
                  group.risk === "BAD"
                    ? "bg-rose-500/20 text-rose-100 border-rose-500/40"
                    : group.risk === "WARN"
                      ? "bg-amber-500/20 text-amber-100 border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-100 border-emerald-500/40";
                return (
                  <Link
                    key={group.type}
                    href={`/lots/type/${encodeURIComponent(group.type)}`}
                    className={`flex flex-col rounded-2xl border p-4 text-left transition border-slate-800/70 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900`}
                  >
                    <div className={`inline-flex w-fit items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold ${pillColor}`}>
                      {group.risk === "BAD" ? "At risk" : group.risk === "WARN" ? "Watch" : "Healthy"}
                    </div>
                    <p className="mt-2 text-lg font-semibold text-slate-50">{group.type}</p>
                    <p className="text-sm text-slate-300">
                      {group.lots.length} lots · {group.atRisk} at risk · Avg yield {formatPercent(group.avgYield)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </ContentCard>
    </div>
  );
}
