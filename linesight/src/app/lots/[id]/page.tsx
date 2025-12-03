import { notFound } from "next/navigation";

import { ExecutionResult } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Health = "GOOD" | "WARN" | "BAD";

const computeHealth = (yieldRatio: number, scrapRate: number): Health => {
  if (yieldRatio < 0.9 || scrapRate > 0.08) return "BAD";
  if (yieldRatio < 0.96 || scrapRate > 0.03) return "WARN";
  return "GOOD";
};

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lotId = Number(id);
  if (Number.isNaN(lotId)) {
    notFound();
  }

  const lot = await prisma.componentLot.findUnique({
    where: { id: lotId },
    select: { id: true, lotNumber: true, componentName: true, supplier: true, receivedAt: true },
  });

  if (!lot) {
    notFound();
  }

  // Map unitIds that used this lot and their final results
  const kitLinks = await prisma.kitComponentLot.findMany({
    where: { componentLotId: lot.id },
    select: {
      kit: {
        select: {
          unit: {
            select: {
              id: true,
              finalResult: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const unitIds: number[] = [];
  const finalResults = new Map<number, ExecutionResult | null>();
  kitLinks.forEach((kl) => {
    const unit = kl.kit.unit;
    if (!unit) return;
    unitIds.push(unit.id);
    finalResults.set(unit.id, unit.finalResult);
  });

  const executions = unitIds.length
    ? await prisma.processStepExecution.findMany({
        where: { unitId: { in: unitIds } },
        select: { unitId: true, result: true, reworkLoopId: true },
      })
    : [];

  const reworkByUnit = new Map<number, boolean>();
  const execByUnit = new Map<number, typeof executions>();
  executions.forEach((exec) => {
    if (exec.reworkLoopId) reworkByUnit.set(exec.unitId, true);
    const arr = execByUnit.get(exec.unitId) ?? [];
    arr.push(exec);
    execByUnit.set(exec.unitId, arr);
  });

  let passUnits = 0;
  let scrapUnits = 0;
  let reworkUnits = 0;
  let failureExec = 0;
  let totalExec = 0;

  unitIds.forEach((uid) => {
    const final = finalResults.get(uid);
    if (final === ExecutionResult.PASS) passUnits += 1;
    if (final === ExecutionResult.SCRAP) scrapUnits += 1;
    if (reworkByUnit.get(uid)) reworkUnits += 1;

    const unitExecs = execByUnit.get(uid) ?? [];
    unitExecs.forEach((e) => {
      totalExec += 1;
      if (e.result === ExecutionResult.FAIL || e.result === ExecutionResult.SCRAP) failureExec += 1;
    });
  });

  const unitsBuilt = unitIds.length;
  const yieldRatio = unitsBuilt === 0 ? 0 : passUnits / unitsBuilt;
  const reworkRate = unitsBuilt === 0 ? 0 : reworkUnits / unitsBuilt;
  const scrapRate = unitsBuilt === 0 ? 0 : scrapUnits / unitsBuilt;
  const correlatedFailureRate = totalExec === 0 ? 0 : failureExec / totalExec;
  const health = computeHealth(yieldRatio, scrapRate);

  const healthClasses: Record<Health, string> = {
    GOOD: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
    WARN: "bg-amber-500/20 text-amber-200 border-amber-500/40",
    BAD: "bg-rose-500/20 text-rose-200 border-rose-500/40",
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">Lot {lot.lotNumber}</h1>
        <p className="text-sm text-slate-400">
          {lot.componentName ?? "Unknown type"}
          {lot.supplier ? ` • Supplier: ${lot.supplier}` : ""}
        </p>
        <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${healthClasses[health]}`}>
          Health: {health}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Units built</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{unitsBuilt}</p>
        </div>
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Yield</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{formatPercent(yieldRatio)}</p>
        </div>
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Rework rate</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{formatPercent(reworkRate)}</p>
        </div>
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Scrap rate</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{formatPercent(scrapRate)}</p>
        </div>
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Correlated failures</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{formatPercent(correlatedFailureRate)}</p>
        </div>
        {lot.receivedAt ? (
          <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Received</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {new Date(lot.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
