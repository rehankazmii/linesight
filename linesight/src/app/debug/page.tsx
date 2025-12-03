"use client";

import { useEffect, useMemo, useState } from "react";
import { ContentCard } from "@/components/content-card";

type HealthCounts = {
  processStepDefinitions: number;
  ctqDefinitions: number;
  units: number;
  kits: number;
  processStepExecutions: number;
  measurements: number;
  componentLots: number;
  fixtures: number;
  episodes: number;
};

type HealthResponse = {
  ok: boolean;
  counts: HealthCounts;
};

export default function DebugPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () => [
      { key: "processStepDefinitions", label: "Process step definitions" },
      { key: "ctqDefinitions", label: "CTQ definitions" },
      { key: "units", label: "Units" },
      { key: "kits", label: "Kits" },
      { key: "processStepExecutions", label: "Process step executions" },
      { key: "measurements", label: "Measurements" },
      { key: "componentLots", label: "Component lots" },
      { key: "fixtures", label: "Fixtures" },
      { key: "episodes", label: "Episodes" },
    ],
    [],
  );

  useEffect(() => {
    let isMounted = true;
    const fetchHealth = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/debug/health");
        if (!res.ok) throw new Error("Failed to fetch health");
        const data: HealthResponse = await res.json();
        if (isMounted) setHealth(data);
      } catch (err) {
        console.error(err);
        if (isMounted) setError("Error loading health");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHealth();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Database health</h1>
        <p className="text-sm text-slate-300">
          Quick check to confirm the local database is reachable and populated.
        </p>
      </div>

      <ContentCard>
        {isLoading ? (
          <p className="text-sm text-neutral-600">Loading...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : !health ? (
          <p className="text-sm text-neutral-600">No data.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-neutral-700">Status:</span>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                  health.ok
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    health.ok ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {health.ok ? "OK" : "NOT OK"}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                      Entity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-600">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {rows.map((row) => (
                    <tr key={row.key} className="hover:bg-neutral-50/70">
                      <td className="px-4 py-3 text-neutral-800">{row.label}</td>
                      <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                        {health.counts[row.key as keyof HealthCounts] ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ContentCard>
    </div>
  );
}
