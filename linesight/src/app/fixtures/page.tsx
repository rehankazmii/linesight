"use client";

import { useEffect, useMemo, useState } from "react";
import { ContentCard } from "@/components/content-card";

type FixtureSummary = {
  id: number;
  code: string;
  type: string | null;
  stationId: string | null;
  lastCalibratedAt: string | null;
  status: string | null;
  usageCount: number;
  correlatedFailureRate: number;
  episodeCount: number;
  health: "GOOD" | "WARN" | "BAD";
  calibrationOverdue: boolean;
};

type FixturesResponse = {
  fixtures: FixtureSummary[];
};

const formatPercent = (value: number) => {
  const pct = value * 100;
  const digits = Math.abs(pct) < 10 ? 2 : 1;
  return `${pct.toFixed(digits)}%`;
};

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export default function FixturesPage() {
  const [data, setData] = useState<FixturesResponse | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    const fetchFixtures = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/fixtures");
        if (!response.ok) throw new Error("Failed to fetch fixtures");
        const json: FixturesResponse = await response.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled)
          setError("Unable to load fixtures right now. Please retry shortly.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchFixtures();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!data?.fixtures) return [];
    const map = new Map<string, FixtureSummary[]>();
    data.fixtures.forEach((fx) => {
      const key = fx.type ?? "Unspecified";
      const list = map.get(key) ?? [];
      list.push(fx);
      map.set(key, list);
    });
    const healthForType = (list: FixtureSummary[]) => {
      const total = list.length || 1;
      const bad = list.filter((f) => f.health === "BAD").length;
      const warn = list.filter((f) => f.health === "WARN").length;
      if (bad / total >= 0.5 || bad >= 2) return "BAD" as const;
      if (bad > 0 || warn / total >= 0.25 || warn >= 2) return "WARN" as const;
      return "GOOD" as const;
    };
    const items = Array.from(map.entries()).map(([type, fixtures]) => {
      const risk = healthForType(fixtures);
      const atRisk = fixtures.filter((f) => f.health !== "GOOD").length;
      const avgFail =
        fixtures.reduce((sum, f) => sum + f.correlatedFailureRate, 0) / fixtures.length;
      return { type, fixtures, risk, atRisk, avgFail };
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
        title="Fixtures"
        subtitle="Fixture health by type; click a tile to drill into fixtures."
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-16 rounded-xl border border-slate-800/70 bg-slate-900/70">
                <div className="h-full animate-pulse rounded-xl bg-slate-800/60" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-slate-400">No fixture data yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {grouped.map((group) => {
              const pillColor =
                group.risk === "BAD"
                  ? "bg-rose-500/20 text-rose-100 border-rose-500/40"
                  : group.risk === "WARN"
                    ? "bg-amber-500/20 text-amber-100 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-100 border-emerald-500/40";
              return (
                <a
                  key={group.type}
                  href={`/fixtures/type/${encodeURIComponent(group.type)}`}
                  className="flex flex-col rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900"
                >
                  <div className={`inline-flex w-fit items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold ${pillColor}`}>
                    {group.risk === "BAD" ? "At risk" : group.risk === "WARN" ? "Watch" : "Healthy"}
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-50">{group.type}</p>
                  <p className="text-sm text-slate-300">
                    {group.fixtures.length} fixtures · {group.atRisk} at risk · Avg fail {formatPercent(group.avgFail)}
                  </p>
                </a>
              );
            })}
          </div>
        )}
      </ContentCard>
    </div>
  );
}
