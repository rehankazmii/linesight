"use client";

import { useEffect, useMemo, useState } from "react";
import { ContentCard } from "@/components/content-card";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabBar } from "@/components/ui/TabBar";

type StationMetric = {
  stepId: number;
  code: string;
  name: string;
  stepType: string;
  isExcluded: boolean;
  sequence: number;
  throughput: number;
  fpy: number;
  yield: number;
  reworkRate: number;
  scrapRate: number;
};

type StationsMetricsResponse = {
  window: "last8h" | "last24h" | "last7d";
  from: string;
  to: string;
  stations: StationMetric[];
  worstByFpy: StationMetric | null;
  worstByRework: StationMetric | null;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const badgeColor = (value: number) => {
  if (value >= 0.98) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value >= 0.95) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
};

export default function StationsPage() {
  const [selectedWindow, setSelectedWindow] = useState<StationsMetricsResponse["window"]>("last24h");
  const [data, setData] = useState<StationsMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchMetrics = async (window: StationsMetricsResponse["window"]) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/metrics/stations?window=${window}`);
        if (!res.ok) throw new Error("Failed to fetch station metrics");
        const json: StationsMetricsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Unable to load station metrics. Please retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchMetrics(selectedWindow);
    return () => {
      cancelled = true;
    };
  }, [selectedWindow]);

  const averageFpy = useMemo(() => {
    if (!data?.stations || data.stations.length === 0) return 0;
    const active = data.stations.filter((s) => !s.isExcluded);
    if (active.length === 0) return 0;
    const sum = active.reduce((acc, s) => acc + s.fpy, 0);
    return sum / active.length;
  }, [data]);

  const windowLabel: Record<StationsMetricsResponse["window"], string> = {
    last8h: "Last 8 hours",
    last24h: "Last 24 hours",
    last7d: "Last 7 days",
  };

  const worstFpy = data?.worstByFpy;
  const worstRework = data?.worstByRework;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stations"
        subtitle="Per-station FPY, yield, rework, scrap, and throughput for Ultra 2 FATP."
        breadcrumbs={[]}
        actions={null}
      />

      <ContentCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-300">Window: {windowLabel[selectedWindow]}</p>
          <div className="flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/70 px-2 py-1 text-xs text-slate-200">
            {(["last8h", "last24h", "last7d"] as const).map((window) => (
              <button
                key={window}
                onClick={() => setSelectedWindow(window)}
                className={`rounded-full px-2.5 py-1 font-semibold transition ${
                  selectedWindow === window
                    ? "bg-slate-800 text-slate-50"
                    : "text-slate-300 hover:bg-slate-800/70"
                }`}
              >
                {window === "last8h" ? "Last 8h" : window === "last24h" ? "Last 24h" : "Last 7d"}
              </button>
            ))}
          </div>
        </div>
      </ContentCard>

      <ContentCard>
        {loading ? (
          <p className="text-sm text-neutral-600">Loading station metrics…</p>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}{" "}
            <button
              className="ml-2 rounded-full bg-amber-800 px-2 py-1 text-[11px] font-semibold text-amber-50"
              onClick={() => setSelectedWindow(selectedWindow)}
            >
              Retry
            </button>
          </div>
        ) : !data || data.stations.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No station executions in this window. Try another window or run the seed script.
          </p>
        ) : (
          <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Worst FPY station
                  </p>
                {worstFpy ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-lg font-semibold text-neutral-900">
                      {worstFpy.code} · {worstFpy.name}
                    </p>
                    <p className="text-sm text-neutral-700">
                      FPY {formatPercent(worstFpy.fpy)} · Yield {formatPercent(worstFpy.yield)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-neutral-600">No data.</p>
                )}
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Worst rework station
                </p>
                {worstRework ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-lg font-semibold text-neutral-900">
                      {worstRework.code} · {worstRework.name}
                    </p>
                    <p className="text-sm text-neutral-700">
                      Rework {formatPercent(worstRework.reworkRate)} · FPY {formatPercent(worstRework.fpy)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-neutral-600">No data.</p>
                )}
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Average station FPY
                </p>
                <p className="mt-2 text-2xl font-semibold text-neutral-900">
                  {formatPercent(averageFpy)}
                </p>
                <p className="text-xs text-neutral-600">Mean of all stations in window.</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white/95 shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Seq</th>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium text-right">Throughput</th>
                    <th className="px-4 py-3 font-medium text-right">FPY</th>
                    <th className="px-4 py-3 font-medium text-right">Yield</th>
                    <th className="px-4 py-3 font-medium text-right">Rework</th>
                    <th className="px-4 py-3 font-medium text-right">Scrap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.stations
                    .slice()
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((station) => {
                      const isWorstFpy = !station.isExcluded && worstFpy?.stepId === station.stepId;
                      const isWorstRework = !station.isExcluded && worstRework?.stepId === station.stepId;
                      const rowHighlight = isWorstFpy
                        ? "bg-rose-50/60"
                        : isWorstRework
                          ? "bg-amber-50/50"
                          : station.fpy >= 0.98 && !station.isExcluded
                            ? "bg-emerald-50/40"
                            : "bg-white";
                      const showExcluded = station.isExcluded;
                      return (
                        <tr key={station.stepId} className={rowHighlight}>
                          <td className="px-4 py-3 text-neutral-700">{station.sequence}</td>
                          <td className="px-4 py-3 font-semibold text-neutral-900">
                            {station.code}
                          </td>
                          <td className="px-4 py-3 text-neutral-800">{station.name}</td>
                          <td className="px-4 py-3 text-neutral-700">{station.stepType}</td>
                          <td className="px-4 py-3 text-right font-medium text-neutral-900">
                            {station.throughput.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {showExcluded ? (
                              <span className="text-xs text-neutral-500">—</span>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-100">
                                  <div
                                    className="h-full rounded-full bg-neutral-900"
                                    style={{ width: `${Math.min(100, station.fpy * 100)}%` }}
                                  />
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeColor(station.fpy)}`}>
                                  {formatPercent(station.fpy)}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-900">
                            {formatPercent(station.yield)}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-900">
                            {showExcluded ? (
                              <span className="text-xs text-neutral-500">—</span>
                            ) : (
                              formatPercent(station.reworkRate)
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-900">
                            {formatPercent(station.scrapRate)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ContentCard>
    </div>
  );
}
