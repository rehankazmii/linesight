import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

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

const MS_PER_HOUR = 60 * 60 * 1000;

const computeWindow = (windowParam: string | null, anchor: Date) => {
  switch (windowParam) {
    case "last8h": {
      const from = new Date(anchor.getTime() - 8 * MS_PER_HOUR);
      return { label: "last8h" as const, from, to: anchor };
    }
    case "last7d": {
      const from = new Date(anchor.getTime() - 7 * 24 * MS_PER_HOUR);
      return { label: "last7d" as const, from, to: anchor };
    }
    case "last24h":
    default: {
      const from = new Date(anchor.getTime() - 24 * MS_PER_HOUR);
      return { label: "last24h" as const, from, to: anchor };
    }
  }
};

const getExecutionTimestamp = (completedAt: Date | null, startedAt: Date | null) => {
  const ts = completedAt ?? startedAt;
  return ts ? ts.getTime() : 0;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const windowParam = url.searchParams.get("window");
  const latestExec = await prisma.processStepExecution.findFirst({
    orderBy: [
      { completedAt: "desc" },
      { startedAt: "desc" },
    ],
    select: { completedAt: true, startedAt: true },
  });

  const anchor = latestExec?.completedAt ?? latestExec?.startedAt ?? new Date();
  const { from, to, label } = computeWindow(windowParam, anchor);
  const excludeCodes = new Set(["SEAL_REWORK", "RF_DEBUG"]);

  const steps = await prisma.processStepDefinition.findMany({
    orderBy: { sequence: "asc" },
  });

  if (steps.length === 0) {
    return NextResponse.json<StationsMetricsResponse>({
      window: label,
      from: from.toISOString(),
      to: to.toISOString(),
      stations: [],
      worstByFpy: null,
      worstByRework: null,
    });
  }

  const executions = await prisma.processStepExecution.findMany({
    where: {
      OR: [
        {
          startedAt: {
            gte: from,
            lte: to,
          },
        },
        {
          completedAt: {
            gte: from,
            lte: to,
          },
        },
      ],
    },
  });

  if (executions.length === 0) {
    return NextResponse.json<StationsMetricsResponse>({
      window: label,
      from: from.toISOString(),
      to: to.toISOString(),
      stations: [],
      worstByFpy: null,
      worstByRework: null,
    });
  }

  const stations: StationMetric[] = steps.map((step) => {
    const stepExecs = executions.filter((exec) => exec.stepDefinitionId === step.id);
    const totalExecutions = stepExecs.length;
    const passExecutions = stepExecs.filter((exec) => exec.result === "PASS").length;

    const byUnit = stepExecs.reduce<Map<number, typeof stepExecs>>((map, exec) => {
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
        (a, b) => getExecutionTimestamp(a.completedAt, a.startedAt) - getExecutionTimestamp(b.completedAt, b.startedAt),
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (first?.result === "PASS" && !first.reworkLoopId) firstPassUnits += 1;
      if (sorted.length > 1 || sorted.some((e) => e.reworkLoopId)) reworkedUnits += 1;
      if (last?.result === "SCRAP") scrappedUnits += 1;
    });

    const fpy = unitsReached === 0 ? 0 : firstPassUnits / unitsReached;
    const yieldRatio = totalExecutions === 0 ? 0 : passExecutions / totalExecutions;
    const reworkRate = unitsReached === 0 ? 0 : reworkedUnits / unitsReached;
    const scrapRate = unitsReached === 0 ? 0 : scrappedUnits / unitsReached;
    const throughput = unitsReached;

    return {
      stepId: step.id,
      code: step.code,
      name: step.name,
      stepType: step.stepType,
      isExcluded: excludeCodes.has(step.code) || step.stepType === "DEBUG",
      sequence: step.sequence,
      throughput,
      fpy,
      yield: yieldRatio,
      reworkRate,
      scrapRate,
    };
  });

  const stationsFiltered = stations.filter((s) => !s.isExcluded && !Number.isNaN(s.fpy));
  const worstByFpy =
    stationsFiltered.length > 0
      ? [...stationsFiltered].sort((a, b) => a.fpy - b.fpy)[0]
      : null;
  const worstByRework =
    stationsFiltered.length > 0
      ? [...stationsFiltered].sort((a, b) => b.reworkRate - a.reworkRate)[0]
      : null;

  return NextResponse.json<StationsMetricsResponse>({
    window: label,
    from: from.toISOString(),
    to: to.toISOString(),
    stations,
    worstByFpy,
    worstByRework,
  });
}
