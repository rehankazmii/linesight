"use client";

import { useEffect, useState } from "react";
import { ContentCard } from "@/components/content-card";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DataQualitySnapshot } from "@/server/dataQuality/getDataQualitySnapshot";

export default function DataQualityPage() {
  const [snapshot, setSnapshot] = useState<DataQualitySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/debug/data-quality", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load data quality");
        const json: DataQualitySnapshot = await res.json();
        if (mounted) setSnapshot(json);
      } catch (err) {
        if (mounted) setError("Unable to load data quality snapshot.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Quality Monitor"
        subtitle="Catch missing steps, duplicate serials, timestamp order, and CTQ capture issues."
        breadcrumbs={[
          { label: "System" },
          { label: "Data Health" },
        ]}
      />

      {loading ? (
        <ContentCard>
          <p className="text-sm text-slate-200">Loading data quality snapshot…</p>
        </ContentCard>
      ) : error ? (
        <ContentCard>
          <p className="text-sm text-rose-300">{error}</p>
        </ContentCard>
      ) : !snapshot ? (
        <ContentCard>
          <p className="text-sm text-slate-200">No data yet.</p>
        </ContentCard>
      ) : (
        <>
          <ContentCard title="Step coverage" subtitle="Units created in the last 24h vs executions per step.">
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/70 text-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">Step</th>
                    <th className="px-3 py-2 text-right">Expected</th>
                    <th className="px-3 py-2 text-right">Actual</th>
                    <th className="px-3 py-2 text-right">Coverage</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/40 text-slate-100">
                  {snapshot.coverage.map((row) => (
                    <tr key={row.stepId} className="hover:bg-slate-900/70">
                      <td className="px-3 py-2">
                        <p className="font-semibold">{row.code}</p>
                        <p className="text-xs text-slate-400">{row.name}</p>
                      </td>
                      <td className="px-3 py-2 text-right">{row.expectedUnits}</td>
                      <td className="px-3 py-2 text-right">{row.actualUnits}</td>
                      <td className="px-3 py-2 text-right">{(row.coverage * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            row.status === "OK"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-amber-500/15 text-amber-200"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ContentCard>

          <ContentCard title="Duplicate serials" subtitle="Units with unusually high execution counts (possible serial duplication).">
            {snapshot.duplicates.length === 0 ? (
              <p className="text-sm text-slate-300">No duplicate serial patterns detected.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-100">
                {snapshot.duplicates.map((dup) => (
                  <li key={dup.unitId} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{dup.serial}</span>
                      <span className="text-xs text-slate-400">Execs: {dup.executionCount}</span>
                    </div>
                    <p className="text-xs text-slate-400">Unit ID {dup.unitId}</p>
                  </li>
                ))}
              </ul>
            )}
          </ContentCard>

          <ContentCard title="Out-of-order timestamps" subtitle="Units with step timestamps that violate process order.">
            <p className="text-sm text-slate-200">
              Checked {snapshot.outOfOrder.unitsChecked} units; {snapshot.outOfOrder.unitsWithIssues} had ordering issues.
            </p>
            {snapshot.outOfOrder.sampleSerials.length > 0 ? (
              <p className="text-xs text-amber-200 mt-2">
                Examples: {snapshot.outOfOrder.sampleSerials.join(", ")}
              </p>
            ) : null}
          </ContentCard>

          <ContentCard title="CTQ capture completeness" subtitle="Critical CTQs with missing measurements (last 24h).">
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/70 text-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">CTQ</th>
                    <th className="px-3 py-2 text-right">Expected</th>
                    <th className="px-3 py-2 text-right">Measured</th>
                    <th className="px-3 py-2 text-right">Missing</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/40 text-slate-100">
                  {snapshot.missingCtqs.map((row) => (
                    <tr key={row.ctqId} className="hover:bg-slate-900/70">
                      <td className="px-3 py-2">
                        <p className="font-semibold">{row.name}</p>
                        <p className="text-xs text-slate-400">{row.stepName}</p>
                      </td>
                      <td className="px-3 py-2 text-right">{row.expected}</td>
                      <td className="px-3 py-2 text-right">{row.measured}</td>
                      <td className="px-3 py-2 text-right">
                        {row.missing} ({(row.missingRate * 100).toFixed(1)}%)
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            row.status === "OK"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-amber-500/15 text-amber-200"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ContentCard>

          {snapshot.latency ? (
            <ContentCard title="Ingestion latency" subtitle="Time between execution completion and measurement record.">
              <p className="text-sm text-slate-200">
                Sample size: {snapshot.latency.sampleSize.toLocaleString()} measurements
              </p>
              <p className="text-sm text-slate-200">
                Avg: {snapshot.latency.avgMinutes.toFixed(1)} min · P95:{" "}
                {snapshot.latency.p95Minutes.toFixed(1)} min
              </p>
            </ContentCard>
          ) : (
            <ContentCard title="Ingestion latency">
              <p className="text-sm text-slate-300">No latency data for the selected window.</p>
            </ContentCard>
          )}
        </>
      )}
    </div>
  );
}
