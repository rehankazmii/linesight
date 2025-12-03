"use client";

import { FormEvent, useMemo, useState } from "react";
import { ContentCard } from "@/components/content-card";
import type { UnitTraceResponse } from "@/types/unit-trace";
import type { ModuleViewResponse, ModuleLotMetrics } from "@/types/module-view";
import { WatchPhotoOverlay } from "@/components/modules/WatchPhotoOverlay";

const resultStyles: Record<string, string> = {
  PASS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAIL: "bg-amber-50 text-amber-700 border-amber-200",
  SCRAP: "bg-rose-50 text-rose-700 border-rose-200",
};

type ExecutionGroup = {
  reworkLoopId: string | null;
  executions: UnitTraceResponse["executions"];
};

const specLabel = (ctq: { lowerSpecLimit?: number | null; upperSpecLimit?: number | null; target?: number | null }) => {
  const parts: string[] = [];
  if (ctq.lowerSpecLimit !== null && ctq.lowerSpecLimit !== undefined) {
    parts.push(`LSL ${ctq.lowerSpecLimit}`);
  }
  if (ctq.upperSpecLimit !== null && ctq.upperSpecLimit !== undefined) {
    parts.push(`USL ${ctq.upperSpecLimit}`);
  }
  if (ctq.target !== null && ctq.target !== undefined) {
    parts.push(`Target ${ctq.target}`);
  }
  return parts.join(" · ");
};

export default function UnitsPage() {
  const [serialInput, setSerialInput] = useState("UL2-A-20-0025");
  const [data, setData] = useState<UnitTraceResponse | null>(null);
  const [moduleView, setModuleView] = useState<ModuleViewResponse | null>(null);
  const [selectedModule, setSelectedModule] = useState<ModuleLotMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [moduleLoading, setModuleLoading] = useState(false);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );

  const { groups, loopOrder } = useMemo(() => {
    if (!data?.executions) return { groups: [], loopOrder: new Map<string, number>() };

    const order = new Map<string, number>();
    let nextOrder = 1;
    const grouped: ExecutionGroup[] = [];
    let current: ExecutionGroup | null = null;

    data.executions.forEach((execution) => {
      if (execution.reworkLoopId && !order.has(execution.reworkLoopId)) {
        order.set(execution.reworkLoopId, nextOrder++);
      }

      if (!current || current.reworkLoopId !== execution.reworkLoopId) {
        if (current) grouped.push(current);
        current = { reworkLoopId: execution.reworkLoopId, executions: [execution] };
      } else {
        current.executions.push(execution);
      }
    });

    if (current) grouped.push(current);

    return { groups: grouped, loopOrder: order };
  }, [data]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = serialInput.trim();
    if (!trimmed) {
      setError("Enter a serial to trace.");
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setData(null);
    setModuleView(null);
    setModuleError(null);
    setSelectedModule(null);

    try {
      const normalized = trimmed.toUpperCase();
      const response = await fetch(`/api/units/${encodeURIComponent(normalized)}`, {
        cache: "no-store",
      });
      if (response.status === 404) {
        setError("Unit not found.");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch unit trace");
      }
      const json: UnitTraceResponse = await response.json();
      setData(json);
      // fetch module view
      setModuleLoading(true);
      try {
        const mvRes = await fetch(`/api/units/${encodeURIComponent(normalized)}/module-view`, {
          cache: "no-store",
        });
        if (mvRes.ok) {
          const mv: ModuleViewResponse = await mvRes.json();
          setModuleView(mv);
        } else {
          setModuleError("Unable to load module view for this unit.");
        }
      } catch {
        setModuleError("Unable to load module view for this unit.");
      } finally {
        setModuleLoading(false);
      }
    } catch {
      setError("Unable to load unit trace right now. Please retry.");
    } finally {
      setIsLoading(false);
    }
  };

  const summaryChips = data ? (
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Serial</p>
        <p className="text-base font-semibold text-neutral-900">{data.unit.serial}</p>
        <p className="text-xs text-neutral-600">
          Created {timeFormatter.format(new Date(data.unit.createdAt))}
        </p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Final Result</p>
        <p className="text-base font-semibold text-neutral-900">
          {data.unit.finalResult ?? "Unknown"}
        </p>
        <p className="text-xs text-neutral-600">
          Rework loops: {data.unit.reworkLoopCount}
        </p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Kit</p>
        <p className="text-base font-semibold text-neutral-900">
          {data.kit ? `Kit #${data.kit.id}` : "No kit linked"}
        </p>
        <p className="text-xs text-neutral-600">
          {data.kit && data.kit.lots.length > 0
            ? `${data.kit.lots.length} lots · ${data.kit.lots.map((lot) => lot.code).join(", ")}`
            : "No component lots"}
        </p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Executions</p>
        <p className="text-base font-semibold text-neutral-900">
          {data.executions.length > 0 ? `${data.executions.length} steps` : "No executions"}
        </p>
        <p className="text-xs text-neutral-600">
          {data.executions.length > 0
            ? `Last at ${timeFormatter.format(
                new Date(data.executions[data.executions.length - 1].finishedAt),
              )}`
            : "Awaiting first pass"}
        </p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Fixtures</p>
        <p className="text-base font-semibold text-neutral-900">
          {data.executions
            .map((e) => e.fixtureCode)
            .filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i).length || "None"}
        </p>
        <p className="text-xs text-neutral-600">
          {data.executions
            .map((e) => e.fixtureCode)
            .filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .join(", ") || "No fixtures recorded"}
        </p>
      </div>
    </div>
  ) : null;

  const lotsList =
    data?.kit?.lots
      ?.map((lot) => lot.code)
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i) ?? [];
  const fixturesList =
    data?.executions
      ?.map((e) => e.fixtureCode)
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i) ?? [];

  return (
    <div className="space-y-6">
      <ContentCard
        title="Units"
        subtitle="Search a serial to see its full trace, rework loops, fixtures, and CTQs."
      >
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-2.5 text-sm text-neutral-900 shadow-inner outline-none ring-0 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
            type="text"
            placeholder="Enter unit serial (e.g., UL2-000050)…"
            value={serialInput}
            onChange={(e) => setSerialInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            {isLoading ? "Searching…" : "Search"}
          </button>
        </form>

        {error ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        {!data && !error && !isLoading ? (
          <p className="mt-4 text-sm text-neutral-600">
            Enter a serial to trace a unit through every station, fixture, and CTQ.
          </p>
        ) : null}

        {data ? summaryChips : null}
      </ContentCard>

      {data && data.episodes.length > 0 ? (
        <ContentCard title="Related Episodes" subtitle="Episodes that share steps or lots with this unit.">
          <div className="grid gap-3 md:grid-cols-2">
            {data.episodes.map((ep) => (
              <div
                key={ep.id}
                className="rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{ep.title}</p>
                    <p className="text-xs text-neutral-600">
                      {ep.rootCauseCategory} · {ep.effectivenessTag}
                    </p>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                    {ep.status}
                  </span>
                </div>
                {ep.matchReasons.length > 0 ? (
                  <p className="mt-2 text-xs text-neutral-600">
                    Score {ep.score ?? "—"} · {ep.matchReasons.join(", ")}
                  </p>
                ) : null}
                {ep.why ? (
                  <p className="mt-1 text-xs text-neutral-500">{ep.why}</p>
                ) : null}
              </div>
            ))}
          </div>
        </ContentCard>
      ) : null}

      {lotsList.length > 0 || fixturesList.length > 0 ? (
        <ContentCard title="Context" subtitle="Component lots and fixtures seen for this unit.">
          <div className="flex flex-wrap gap-3">
            {lotsList.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  Lots
                </span>
                {lotsList.map((lot) => (
                  <span
                    key={lot}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-800"
                  >
                    {lot}
                  </span>
                ))}
              </div>
            ) : null}
            {fixturesList.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  Fixtures
                </span>
                {fixturesList.map((fx) => (
                  <span
                    key={fx as string}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-800"
                  >
                    {fx}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </ContentCard>
      ) : null}

      <ContentCard
        title="Unit Timeline"
        subtitle="Ordered executions with CTQs, fixtures, and rework loop grouping."
      >
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-20 rounded-xl border border-neutral-200 bg-gradient-to-r from-neutral-50 via-white to-neutral-50"
              >
                <div className="h-full animate-pulse bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100" />
              </div>
            ))}
          </div>
        ) : !data ? (
          <p className="text-sm text-neutral-600">Search a serial to view its timeline.</p>
        ) : data.executions.length === 0 ? (
          <p className="text-sm text-neutral-600">No executions recorded for this unit yet.</p>
        ) : (
          <div className="relative space-y-4 pl-4">
            <div className="absolute left-2 top-3 bottom-3 w-px bg-neutral-200" />
            {groups.map((group, groupIdx) => {
              const loopNumber =
                group.reworkLoopId && loopOrder.has(group.reworkLoopId)
                  ? loopOrder.get(group.reworkLoopId)
                  : null;
              const loopMetaExec = group.executions[0];
              const loopLabel =
                loopNumber && loopMetaExec?.failureCode
                  ? `Rework Loop #${loopNumber} · Failure ${loopMetaExec.failureCode}`
                  : loopNumber
                    ? `Rework Loop #${loopNumber}`
                    : null;

              return (
                <div key={`${group.reworkLoopId ?? "base"}-${groupIdx}`} className="relative">
                  {group.reworkLoopId ? (
                    <div className="mb-2 ml-1 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span>{loopLabel}</span>
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {group.executions.map((execution) => (
                      <div
                        key={execution.id}
                        className="relative rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm"
                      >
                        <div className="absolute -left-3 top-5 h-2 w-2 rounded-full bg-neutral-300 ring-2 ring-white" />
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-neutral-900">
                              {execution.stepCode} · {execution.stepName}
                            </div>
                            <div className="text-xs text-neutral-600">
                              {execution.stepType} · Started{" "}
                              {timeFormatter.format(new Date(execution.startedAt))}
                            </div>
                            <div className="text-xs text-neutral-600">
                              Station {execution.stationId ?? "—"}
                              {execution.fixtureCode ? ` · Fixture ${execution.fixtureCode}` : ""}
                              {execution.failureCode ? ` · Failure ${execution.failureCode}` : ""}
                              {execution.loopIndex
                                ? ` · Loop #${execution.loopIndex} (${execution.loopPosition ?? "loop"})`
                                : ""}
                            </div>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              resultStyles[execution.result] ?? "border-neutral-200 bg-neutral-50"
                            }`}
                          >
                            {execution.result}
                          </span>
                        </div>

                        {execution.ctqs.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {execution.ctqs.map((ctq) => (
                              <div
                                key={`${execution.id}-${ctq.ctqId}`}
                                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-xs ${
                                  ctq.inSpec
                                    ? "border-emerald-200 bg-emerald-50/70 text-emerald-800"
                                    : "border-rose-200 bg-rose-50/70 text-rose-800"
                                }`}
                              >
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    ctq.inSpec ? "bg-emerald-500" : "bg-rose-500"
                                  }`}
                                />
                                <div className="flex flex-col">
                                  <span className="font-semibold">{ctq.name}</span>
                                  <span className="text-neutral-700">
                                    {ctq.value} {ctq.units}
                                  </span>
                                  <span className="text-[10px] text-neutral-600">
                                    {specLabel(ctq)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                     </div>
                   ))}
                 </div>
                 {groupIdx < groups.length - 1 ? (
                    <div className="absolute left-2 top-full h-4 w-px bg-neutral-200" />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </ContentCard>

      <ContentCard
        title="Module Explorer – Components by Batch"
        subtitle="Exploded view of this watch, with lot-level quality for key modules."
      >
        {moduleLoading ? (
          <p className="text-sm text-neutral-300">Loading module data…</p>
        ) : moduleError ? (
          <p className="text-sm text-amber-200">{moduleError}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <WatchPhotoOverlay
              modules={moduleView?.modules.map((m) => ({
                moduleKey: m.moduleKey,
                moduleName: m.moduleName,
                lotCode: m.lotCode,
              })) ?? []}
              selectedModuleKey={selectedModule?.moduleKey ?? null}
              onSelectModule={(key) => {
                const found = moduleView?.modules.find((m) => m.moduleKey === key);
                if (found) setSelectedModule(found);
              }}
              loading={moduleLoading}
            />
            <div className="space-y-3 rounded-xl border border-neutral-800 bg-slate-900/70 p-4 shadow-inner">
              {selectedModule ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Selected Module</p>
                  <p className="text-lg font-semibold text-neutral-50">{selectedModule.moduleName}</p>
                  <p className="text-sm text-neutral-200">
                    Lot {selectedModule.lotCode ?? "unknown"}
                    {selectedModule.supplier ? ` · Supplier ${selectedModule.supplier}` : ""}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-neutral-200">
                    <p>Units built: {selectedModule.unitsBuilt.toLocaleString()}</p>
                    <p>FPY: {(selectedModule.fpy * 100).toFixed(1)}%</p>
                    <p>Rework: {(selectedModule.reworkRate * 100).toFixed(1)}%</p>
                    <p>Scrap: {(selectedModule.scrapRate * 100).toFixed(1)}%</p>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-neutral-400">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${Math.min(100, selectedModule.fpy * 100)}%` }}
                      />
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${Math.min(100, selectedModule.reworkRate * 100)}%` }}
                      />
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full bg-rose-400"
                        style={{ width: `${Math.min(100, selectedModule.scrapRate * 100)}%` }}
                      />
                    </div>
                  </div>
                  {selectedModule.unitsBuilt > 0 && selectedModule.unitsBuilt < 10 ? (
                    <p className="mt-2 text-xs text-amber-200">
                      Low sample size; interpret with caution.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-neutral-300">
                  Click a module on the diagram to view lot-level quality metrics.
                </p>
              )}
            </div>
          </div>
        )}
      </ContentCard>
    </div>
  );
}
