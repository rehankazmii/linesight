"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";

type ScenarioSeverity = "info" | "warning" | "critical";

type ScenarioType =
  | "STATION_FPY_DROOP"
  | "STATION_REWORK_SPIKE"
  | "STATION_SCRAP_SPIKE";

type TrendScenario = {
  id: string;
  type: ScenarioType;
  severity: ScenarioSeverity;
  title: string;
  summary: string;
  stationCode?: string;
  stationName?: string;
  stepId?: number;
  window: "last24h" | "last7d";
  currentFpy?: number;
  baselineFpy?: number;
  currentRework?: number;
  baselineRework?: number;
  currentScrap?: number;
  baselineScrap?: number;
  recommendedAction?: string;
};

type TrendsResponse = {
  generatedAt: string;
  scenarios: TrendScenario[];
};

const severityStyles: Record<ScenarioSeverity, string> = {
  critical: "bg-red-500/15 text-red-200 border border-red-500/30",
  warning: "bg-amber-500/15 text-amber-200 border border-amber-400/30",
  info: "bg-sky-500/15 text-sky-200 border border-sky-400/30",
};

const formatPercent = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
};

export default function TrendsPage() {
  const [scenarios, setScenarios] = useState<TrendScenario[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/metrics/trends");
      if (!res.ok) throw new Error("Failed to load trends");
      const json: TrendsResponse = await res.json();
      setScenarios(json.scenarios ?? []);
    } catch {
      setError("Unable to load TPM scenarios. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trends / TPM Scenarios"
        subtitle="Highlights recent yield, rework, and scrap changes comparing last 24h vs the prior 7 days."
        breadcrumbs={[
          { label: "Run" },
          { label: "Line" },
          { label: "Trends" },
        ]}
        actions={
          <TabBar
            tabs={[
              { label: "Overview", href: "/line" },
              { label: "Rework Flow", href: "/line/rework-flow" },
              { label: "Trends", href: "/trends" },
            ]}
          />
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-300">
            These scenarios surface stations that deserve TPM attention right now.
          </p>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
            {scenarios.length > 0 ? `${scenarios.length} active scenarios` : "No active scenarios"}
          </span>
        </div>
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-300">Analyzing line trends…</p>
        </Card>
      ) : error ? (
        <Card>
          <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <span>{error}</span>
            <button
              onClick={fetchTrends}
              className="rounded-lg bg-amber-500/80 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-amber-400"
            >
              Retry
            </button>
          </div>
        </Card>
      ) : scenarios.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-300">
            No significant FPY, rework, or scrap trends detected in the last 24 hours. The line looks stable.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {scenarios.map((scenario) => (
            <Card key={scenario.id}>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${severityStyles[scenario.severity]}`}>
                      {scenario.severity.toUpperCase()}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {scenario.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-50">{scenario.title}</h3>
                  <p className="text-sm text-slate-300">{scenario.summary}</p>
                  {scenario.stationCode ? (
                    <p className="text-xs text-slate-400">
                      Station {scenario.stationCode}
                      {scenario.stationName ? ` · ${scenario.stationName}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-2 text-sm text-slate-200 md:items-end">
                  {scenario.currentFpy !== undefined && scenario.baselineFpy !== undefined ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">FPY</span>
                      <span className="font-semibold text-emerald-200">{formatPercent(scenario.baselineFpy)}</span>
                      <span className="text-slate-500">→</span>
                      <span className="font-semibold text-rose-200">{formatPercent(scenario.currentFpy)}</span>
                    </div>
                  ) : null}
                  {scenario.currentRework !== undefined && scenario.baselineRework !== undefined ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Rework</span>
                      <span className="font-semibold text-emerald-200">{formatPercent(scenario.baselineRework)}</span>
                      <span className="text-slate-500">→</span>
                      <span className="font-semibold text-amber-200">{formatPercent(scenario.currentRework)}</span>
                    </div>
                  ) : null}
                  {scenario.currentScrap !== undefined && scenario.baselineScrap !== undefined ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Scrap</span>
                      <span className="font-semibold text-emerald-200">{formatPercent(scenario.baselineScrap)}</span>
                      <span className="text-slate-500">→</span>
                      <span className="font-semibold text-rose-200">{formatPercent(scenario.currentScrap)}</span>
                    </div>
                  ) : null}
                  <p className="text-xs text-slate-400">
                    Window: last 24h vs prior 7d
                  </p>
                </div>
              </div>
              {scenario.recommendedAction ? (
                <p className="mt-3 text-xs text-slate-400">
                  Recommended next step:{" "}
                  <span className="text-slate-200">{scenario.recommendedAction}</span>
                </p>
              ) : null}
              <p className="mt-2 text-[11px] text-slate-500">
                Use Stations, Units, Lots, Fixtures, or Episodes to drill in further.
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
