"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { WatchPhotoOverlay } from "@/components/modules/WatchPhotoOverlay";
import type { ModuleViewResponse, ModuleLotMetrics } from "@/types/module-view";

export default function ModulesPage() {
  const [serial, setSerial] = useState("");
  const [moduleView, setModuleView] = useState<ModuleViewResponse | null>(null);
  const [selected, setSelected] = useState<ModuleLotMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = async (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) {
      setError("Enter a serial to load module lots.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/units/${encodeURIComponent(trimmed)}/module-view`);
      if (!res.ok) throw new Error("Failed to load module view");
      const data: ModuleViewResponse = await res.json();
      setModuleView(data);
      const first = data.modules.find((m) => m.lotCode);
      setSelected(first ?? data.modules[0] ?? null);
    } catch (e) {
      console.error(e);
      setError("Unable to load module explorer for that serial. Please retry.");
      setModuleView(null);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Explorer"
        subtitle="Exploded watch view with lot-level quality metrics"
        breadcrumbs={[
          { label: "Hardware View" },
          { label: "Module Explorer" },
        ]}
      />

      <Card title="Find a unit" subtitle="Enter a serial to load its component batches">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="e.g., UL2-000050"
            className="w-full rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => fetchModules(serial)}
            className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-50 shadow-inner shadow-slate-950/30 transition hover:border-slate-600 hover:bg-slate-900"
            disabled={loading}
          >
            {loading ? "Loading…" : "Load modules"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-amber-300">{error}</p> : null}
        {moduleView ? (
          <p className="mt-2 text-xs text-slate-400">
            Loaded {moduleView.unitSerial}. Select a module on the diagram to view lot quality.
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Tip: use a serial that exists in your seeded data to see all lots populated.
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card>
          <WatchPhotoOverlay
            modules={
              moduleView?.modules.map((m) => ({
                moduleKey: m.moduleKey,
                moduleName: m.moduleName,
                lotCode: m.lotCode,
              })) ?? []
            }
            selectedModuleKey={selected?.moduleKey ?? null}
            onSelectModule={(key) => {
              const found = moduleView?.modules.find((m) => m.moduleKey === key);
              if (found) setSelected(found);
            }}
            loading={loading}
          />
        </Card>
        <Card title="Module details" subtitle="Lot-level quality">
          {selected ? (
            <div className="space-y-2 text-sm text-slate-200">
              <p className="text-lg font-semibold text-slate-50">{selected.moduleName}</p>
              <p>
                Lot {selected.lotCode ?? "unknown"}
                {selected.supplier ? ` · Supplier ${selected.supplier}` : ""}
              </p>
              <p>Units built: {selected.unitsBuilt.toLocaleString()}</p>
              <p>FPY: {(selected.fpy * 100).toFixed(1)}%</p>
              <p>Rework: {(selected.reworkRate * 100).toFixed(1)}%</p>
              <p>Scrap: {(selected.scrapRate * 100).toFixed(1)}%</p>
              {selected.unitsBuilt > 0 && selected.unitsBuilt < 10 ? (
                <p className="text-xs text-amber-300">Low sample size; interpret with caution.</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Select a module from the diagram to see lot quality metrics.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
