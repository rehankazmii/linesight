import { NextResponse } from "next/server";
import { ExecutionResult } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

type Health = "GOOD" | "WARN" | "BAD";

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
  health: Health;
  correlatedFailureRate: number;
};

type LotsResponse = {
  lots: LotSummary[];
};

type UnknownJson = unknown;

const episodeReferencesLot = (payload: UnknownJson, lotCode: string): boolean => {
  if (!payload) return false;
  if (typeof payload === "string") return payload.includes(lotCode);
  if (Array.isArray(payload)) {
    return payload.some((entry) => episodeReferencesLot(entry, lotCode));
  }
  if (typeof payload === "object") {
    const values = Object.values(payload as Record<string, UnknownJson>);
    return values.some((value) => episodeReferencesLot(value, lotCode));
  }
  return false;
};

export async function GET() {
  // Fetch base lots
  const lots = await prisma.componentLot.findMany({
    select: { id: true, lotNumber: true, componentName: true, receivedAt: true },
  });

  if (lots.length === 0) {
    return NextResponse.json<LotsResponse>({ lots: [] });
  }

  // Map lot -> unitIds via kit/component link
  const kitLots = await prisma.kitComponentLot.findMany({
    select: {
      componentLotId: true,
      kit: {
        select: {
          unit: {
            select: { id: true, finalResult: true },
          },
        },
      },
    },
  });

  type LotEntry = { unitIds: number[]; finalResults: Map<number, ExecutionResult | null> };
  const lotUnitMap = new Map<number, LotEntry>();
  kitLots.forEach((kl) => {
    const unit = kl.kit.unit;
    if (!unit) return;
    const entry: LotEntry = lotUnitMap.get(kl.componentLotId) ?? { unitIds: [] as number[], finalResults: new Map<number, ExecutionResult | null>() };
    entry.unitIds.push(unit.id);
    entry.finalResults.set(unit.id, unit.finalResult);
    lotUnitMap.set(kl.componentLotId, entry);
  });

  const allUnitIds = Array.from(new Set(Array.from(lotUnitMap.values()).flatMap((v) => v.unitIds)));

  // Fetch executions once (lightweight select)
  const executions = allUnitIds.length
    ? await prisma.processStepExecution.findMany({
        where: { unitId: { in: allUnitIds } },
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

  // Episodes for counts
  const episodes = await prisma.episode.findMany({
    select: { affectedLots: true },
  });

  const lotSummaries: LotSummary[] = lots.map((lot) => {
    const entry = lotUnitMap.get(lot.id);
    const unitIds = entry?.unitIds ?? [];
    const finals = entry?.finalResults ?? new Map();

    let passUnits = 0;
    let scrapUnits = 0;
    let reworkUnits = 0;
    let failureExec = 0;
    let totalExec = 0;

    unitIds.forEach((uid) => {
      const final = finals.get(uid);
      if (final === ExecutionResult.PASS) passUnits += 1;
      if (final === ExecutionResult.SCRAP) scrapUnits += 1;
      if (reworkByUnit.get(uid)) reworkUnits += 1;

      // Count failures for correlatedFailureRate
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

    const episodeCount = episodes.filter((ep) => episodeReferencesLot(ep.affectedLots, lot.lotNumber)).length;

    const health: LotSummary["health"] =
      yieldRatio < 0.9 || scrapRate > 0.08
        ? "BAD"
        : yieldRatio < 0.96 || scrapRate > 0.03
          ? "WARN"
          : "GOOD";

    return {
      id: lot.id,
      code: lot.lotNumber,
      type: lot.componentName,
      createdAt: lot.receivedAt ? lot.receivedAt.toISOString() : null,
      unitsBuilt,
      yield: yieldRatio,
      reworkRate,
      scrapRate,
      episodeCount,
      correlatedFailureRate,
      health,
    };
  });

  const sortedLots = lotSummaries.sort((a, b) => a.yield - b.yield);

  const response: LotsResponse = {
    lots: sortedLots,
  };

  return NextResponse.json(response);
}
