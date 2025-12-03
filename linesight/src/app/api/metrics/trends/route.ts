import { NextResponse } from "next/server";
import { ExecutionResult } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

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

const MS_PER_HOUR = 60 * 60 * 1000;

const getExecutionTimestamp = (completedAt: Date | null, startedAt: Date | null) => {
  const ts = completedAt ?? startedAt;
  return ts ? ts.getTime() : 0;
};

type WindowKey = "baseline" | "current";

type WindowStats = {
  unitsReached: number;
  firstPassUnits: number;
  reworkedUnits: number;
  scrappedUnits: number;
  fpy: number;
  reworkRate: number;
  scrapRate: number;
};

const computeStatsForExecutions = (
  executions: { unitId: number; result: ExecutionResult; reworkLoopId: string | null; startedAt: Date | null; completedAt: Date | null }[],
): WindowStats => {
  const byUnit = executions.reduce<Map<number, typeof executions>>((map, exec) => {
    const list = map.get(exec.unitId) ?? [];
    list.push(exec);
    map.set(exec.unitId, list);
    return map;
  }, new Map());

  const unitsReached = byUnit.size;
  let firstPassUnits = 0;
  let reworkedUnits = 0;
  let scrappedUnits = 0;

  byUnit.forEach((execs) => {
    const sorted = [...execs].sort(
      (a, b) =>
        getExecutionTimestamp(a.completedAt, a.startedAt) -
        getExecutionTimestamp(b.completedAt, b.startedAt),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first?.result === ExecutionResult.PASS && !first.reworkLoopId) firstPassUnits += 1;
    if (sorted.length > 1 || sorted.some((e) => e.reworkLoopId)) reworkedUnits += 1;
    if (last?.result === ExecutionResult.SCRAP) scrappedUnits += 1;
  });

  const fpy = unitsReached === 0 ? 0 : firstPassUnits / unitsReached;
  const reworkRate = unitsReached === 0 ? 0 : reworkedUnits / unitsReached;
  const scrapRate = unitsReached === 0 ? 0 : scrappedUnits / unitsReached;

  return { unitsReached, firstPassUnits, reworkedUnits, scrappedUnits, fpy, reworkRate, scrapRate };
};

const severityRank: Record<ScenarioSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

export async function GET() {
  try {
    const latest = await prisma.processStepExecution.findFirst({
      orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
      select: { completedAt: true, startedAt: true },
    });
    const anchor = latest?.completedAt ?? latest?.startedAt ?? new Date();
    const currentFrom = new Date(anchor.getTime() - 24 * MS_PER_HOUR);
    const baselineFrom = new Date(anchor.getTime() - 7 * 24 * MS_PER_HOUR);

    const steps = await prisma.processStepDefinition.findMany({ orderBy: { sequence: "asc" } });
    if (steps.length === 0) {
      return NextResponse.json<TrendsResponse>({
        generatedAt: new Date().toISOString(),
        scenarios: [],
      });
    }

    const executions = await prisma.processStepExecution.findMany({
      where: {
        OR: [
          { startedAt: { gte: baselineFrom } },
          { completedAt: { gte: baselineFrom } },
        ],
      },
      select: {
        unitId: true,
        stepDefinitionId: true,
        result: true,
        reworkLoopId: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (executions.length === 0) {
      return NextResponse.json<TrendsResponse>({
        generatedAt: new Date().toISOString(),
        scenarios: [],
      });
    }

    const byStep: Map<number, { baseline: typeof executions; current: typeof executions }> = new Map();
    executions.forEach((exec) => {
      const ts = getExecutionTimestamp(exec.completedAt, exec.startedAt);
      const window: WindowKey | null =
        ts >= currentFrom.getTime()
          ? "current"
          : ts >= baselineFrom.getTime()
            ? "baseline"
            : null;
      if (!window) return;
      const entry = byStep.get(exec.stepDefinitionId) ?? { baseline: [], current: [] };
      entry[window].push(exec);
      byStep.set(exec.stepDefinitionId, entry);
    });

    const scenarios: TrendScenario[] = [];

    steps.forEach((step) => {
      const windowExecs = byStep.get(step.id) ?? { baseline: [], current: [] };
      const baselineStats = computeStatsForExecutions(windowExecs.baseline);
      const currentStats = computeStatsForExecutions(windowExecs.current);

      const baselineUnits = baselineStats.unitsReached;
      const currentUnits = currentStats.unitsReached;

      // FPY droop
      if (
        baselineUnits >= 20 &&
        currentUnits >= 10 &&
        baselineStats.fpy >= 0.95 &&
        currentStats.fpy < baselineStats.fpy - 0.03
      ) {
        const drop = baselineStats.fpy - currentStats.fpy;
        const severity: ScenarioSeverity =
          drop >= 0.05 || currentStats.fpy < 0.9 ? "critical" : "warning";
        scenarios.push({
          id: `STATION_FPY_DROOP:${step.code}`,
          type: "STATION_FPY_DROOP",
          severity,
          title: `${step.name} FPY droop`,
          summary: `FPY at ${step.code} fell from ${(baselineStats.fpy * 100).toFixed(1)}% (last 7d) to ${(currentStats.fpy * 100).toFixed(1)}% (last 24h).`,
          stationCode: step.code,
          stationName: step.name,
          stepId: step.id,
          window: "last24h",
          currentFpy: currentStats.fpy,
          baselineFpy: baselineStats.fpy,
          recommendedAction:
            "Compare recent units by lot and fixture; check leak/torque/planarity CTQs and recent process changes.",
        });
      }

      // Rework spike
      if (
        baselineUnits >= 20 &&
        currentUnits >= 10 &&
        currentStats.reworkRate > baselineStats.reworkRate * 1.5 &&
        currentStats.reworkRate - baselineStats.reworkRate >= 0.03
      ) {
        const severity: ScenarioSeverity = currentStats.reworkRate >= 0.15 ? "critical" : "warning";
        scenarios.push({
          id: `STATION_REWORK_SPIKE:${step.code}`,
          type: "STATION_REWORK_SPIKE",
          severity,
          title: `${step.name} rework spike`,
          summary: `Rework at ${step.code} rose from ${(baselineStats.reworkRate * 100).toFixed(1)}% to ${(currentStats.reworkRate * 100).toFixed(1)}% comparing last 7d vs last 24h.`,
          stationCode: step.code,
          stationName: step.name,
          stepId: step.id,
          window: "last24h",
          currentRework: currentStats.reworkRate,
          baselineRework: baselineStats.reworkRate,
          recommendedAction:
            "Check recent failures and rework loops; inspect fixtures and confirm operator/recipe changes.",
        });
      }

      // Scrap spike
      if (
        baselineUnits >= 10 &&
        currentUnits >= 5 &&
        baselineStats.scrapRate < 0.02 &&
        currentStats.scrapRate >= 0.03
      ) {
        const severity: ScenarioSeverity = currentStats.scrapRate >= 0.05 ? "critical" : "warning";
        scenarios.push({
          id: `STATION_SCRAP_SPIKE:${step.code}`,
          type: "STATION_SCRAP_SPIKE",
          severity,
          title: `${step.name} scrap spike`,
          summary: `Scrap at ${step.code} increased to ${(currentStats.scrapRate * 100).toFixed(1)}% (baseline ${(baselineStats.scrapRate * 100).toFixed(1)}%).`,
          stationCode: step.code,
          stationName: step.name,
          stepId: step.id,
          window: "last24h",
          currentScrap: currentStats.scrapRate,
          baselineScrap: baselineStats.scrapRate,
          recommendedAction: "Review scrap codes and last executions; correlate with lots/fixtures and station settings.",
        });
      }
    });

    const scenariosSorted = scenarios.sort((a, b) => {
      const severityDiff = severityRank[b.severity] - severityRank[a.severity];
      if (severityDiff !== 0) return severityDiff;
      const impactA =
        (a.baselineFpy ?? 0) - (a.currentFpy ?? 0) ||
        (a.currentRework ?? 0) - (a.baselineRework ?? 0) ||
        (a.currentScrap ?? 0) - (a.baselineScrap ?? 0);
      const impactB =
        (b.baselineFpy ?? 0) - (b.currentFpy ?? 0) ||
        (b.currentRework ?? 0) - (b.baselineRework ?? 0) ||
        (b.currentScrap ?? 0) - (b.baselineScrap ?? 0);
      return impactB - impactA;
    });

    return NextResponse.json<TrendsResponse>({
      generatedAt: new Date().toISOString(),
      scenarios: scenariosSorted,
    });
  } catch (error) {
    console.error("Failed to compute trends", error);
    return NextResponse.json(
      { error: "Failed to compute trends" },
      { status: 500 },
    );
  }
}
