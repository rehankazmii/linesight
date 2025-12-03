"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function FixtureTypePage({ params }: { params: Promise<{ type: string }> }) {
  const resolvedParams = use(params);
  const typeLabel = useMemo(() => decodeURIComponent(resolvedParams.type), [resolvedParams.type]);
  const [data, setData] = useState<FixturesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/fixtures");
        if (!res.ok) throw new Error("Failed to fetch fixtures");
        const json: FixturesResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Unable to load fixtures. Please retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [resolvedParams.type]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const fixtures = data?.fixtures.filter((f) => (f.type ?? "Unspecified") === typeLabel) ?? [];

  return (
    <div className="space-y-6">
      <ContentCard
        title={`Fixture type: ${typeLabel}`}
        subtitle="Detailed fixture metrics for this type"
      >
        <div className="mb-3 text-sm">
          <Link href="/fixtures" className="text-sky-300 hover:underline">
            ← Back to fixture types
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-12 rounded-xl border border-slate-800/70 bg-slate-900/70">
                <div className="h-full animate-pulse rounded-xl bg-slate-800/60" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : fixtures.length === 0 ? (
          <p className="text-sm text-slate-400">No fixtures for this type.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/80 shadow-inner shadow-slate-950/30">
            <table className="w-full border-collapse text-sm text-slate-100">
              <thead className="bg-slate-900/70 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fixture code</th>
                  <th className="px-4 py-3 font-semibold">Station</th>
                  <th className="px-4 py-3 font-semibold text-right">Usage</th>
                  <th className="px-4 py-3 font-semibold text-right">Failure rate</th>
                  <th className="px-4 py-3 font-semibold text-right">Last calibrated</th>
                  <th className="px-4 py-3 font-semibold text-right">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Episodes</th>
                  <th className="px-4 py-3 font-semibold text-right">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {fixtures.map((fx, idx) => {
                  const rowBg = idx % 2 === 0 ? "bg-slate-900/60" : "bg-slate-900/40";
                  const isBad = fx.health === "BAD";
                  const isWarn = fx.health === "WARN";
                  const lastCal = fx.lastCalibratedAt ? new Date(fx.lastCalibratedAt) : null;
                  const overdue = fx.calibrationOverdue;
                  return (
                    <tr
                      key={fx.id}
                      className={`${rowBg} ${isBad ? "bg-rose-500/10" : isWarn ? "bg-amber-500/10" : ""}`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-50">{fx.code}</td>
                      <td className="px-4 py-3 text-slate-200">{fx.stationId ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-100">{fx.usageCount}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center justify-end rounded-full px-2 py-0.5 text-xs font-medium ${
                            isBad ? "bg-rose-500/20 text-rose-100" : "bg-emerald-500/20 text-emerald-100"
                          }`}
                        >
                          {formatPercent(fx.correlatedFailureRate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {lastCal ? dateFormatter.format(lastCal) : "—"}
                        {overdue ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-100">
                            Overdue
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">{fx.status ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-100">{fx.episodeCount}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center justify-end rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isBad
                              ? "bg-rose-500/20 text-rose-100"
                              : isWarn
                                ? "bg-amber-500/20 text-amber-100"
                                : "bg-emerald-500/20 text-emerald-100"
                          }`}
                        >
                          {fx.health === "GOOD" ? "Good" : fx.health === "WARN" ? "Watch" : "At risk"}
                        </span>
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
