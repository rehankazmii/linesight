import { NextResponse } from "next/server";
import { ExecutionResult } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

type LineOverviewResponse = {
  overall: {
    lineFpy: number;
    rty: number;
    throughput: number;
    reworkRate: number;
    scrapRate: number;
    status: "OK" | "WARNING" | "CRITICAL";
    rangeHours: number;
  };
  timeBuckets: {
    label: string;
    lineFpy: number;
    rty: number;
    throughput: number;
    reworkRate: number;
    scrapRate: number;
    start: string;
  }[];
  stations: {
    stepId: number;
    code: string;
    name: string;
    yield: number;
  }[];
};

const DEFAULT_RANGE_HOURS = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

const bucketConfig = {
  hour: { hours: 6, bucketHours: 1 },
  shift: { hours: 24, bucketHours: 6 },
  day: { hours: 72, bucketHours: 24 },
  week: { hours: 168, bucketHours: 24 },
} as const;

const getTimestamp = (date: Date | null | undefined) => (date ? date.getTime() : 0);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rangeParam = Number(url.searchParams.get("range"));
  const bucketParam = (url.searchParams.get("bucket") ?? "day") as keyof typeof bucketConfig;
  const bucketSettings = bucketConfig[bucketParam] ?? bucketConfig.day;
  const rangeHours =
    Number.isFinite(rangeParam) && rangeParam > 0 ? rangeParam : DEFAULT_RANGE_HOURS;
  const effectiveRangeHours = Math.max(rangeHours, bucketSettings.hours);
  const windowStart = new Date(Date.now() - effectiveRangeHours * MS_PER_HOUR);
  const bucketMs = bucketSettings.bucketHours * MS_PER_HOUR;

  const steps = await prisma.processStepDefinition.findMany({
    orderBy: { sequence: "asc" },
  });

  if (steps.length === 0) {
    return NextResponse.json<LineOverviewResponse>({
      overall: {
        lineFpy: 0,
        rty: 0,
        throughput: 0,
        reworkRate: 0,
        scrapRate: 0,
        status: "OK",
        rangeHours: effectiveRangeHours,
      },
      timeBuckets: [],
      stations: [],
    });
  }

  const executions = await prisma.processStepExecution.findMany({
    where: {
      OR: [
        { startedAt: { gte: windowStart } },
        { completedAt: { gte: windowStart } },
      ],
    },
    include: { unit: true },
    orderBy: [{ startedAt: "asc" }],
  });

  if (executions.length === 0) {
    return NextResponse.json<LineOverviewResponse>({
      overall: {
        lineFpy: 0,
        rty: 0,
        throughput: 0,
        reworkRate: 0,
        scrapRate: 0,
        status: "OK",
        rangeHours: effectiveRangeHours,
      },
      timeBuckets: [],
      stations: [],
    });
  }

  const unitGroups = executions.reduce<Map<number, typeof executions>>((map, exec) => {
    const list = map.get(exec.unitId) ?? [];
    list.push(exec);
    map.set(exec.unitId, list);
    return map;
  }, new Map());

  const stations = steps.map((step) => {
    const earliestByUnit = new Map<number, typeof executions[number]>();
    executions.forEach((exec) => {
      if (exec.stepDefinitionId !== step.id) return;
      const existing = earliestByUnit.get(exec.unitId);
      if (!existing) {
        earliestByUnit.set(exec.unitId, exec);
        return;
      }
      const currentTs = getTimestamp(exec.completedAt ?? exec.startedAt);
      const existingTs = getTimestamp(existing.completedAt ?? existing.startedAt);
      if (currentTs < existingTs) earliestByUnit.set(exec.unitId, exec);
    });

    const totalFirstPass = earliestByUnit.size;
    const passFirst = Array.from(earliestByUnit.values()).filter(
      (exec) => exec.result === ExecutionResult.PASS,
    ).length;

    const stationYield = totalFirstPass === 0 ? 0 : passFirst / totalFirstPass;

    return {
      stepId: step.id,
      code: step.code,
      name: step.name,
      yield: stationYield,
    };
  });

  const finalStepId = steps[steps.length - 1].id;
  const throughputUnits = new Set<number>();
  executions.forEach((exec) => {
    if (exec.stepDefinitionId === finalStepId && exec.result === ExecutionResult.PASS) {
      throughputUnits.add(exec.unitId);
    }
  });

  const firstStepId = steps[0]?.id;
  const unitsStartedFlow = new Set<number>();
  executions.forEach((exec) => {
    if (exec.stepDefinitionId === firstStepId) unitsStartedFlow.add(exec.unitId);
  });
  const unitsFallback = new Set(unitGroups.keys());

  let firstPassUnits = 0;
  const denominatorSet = unitsStartedFlow.size > 0 ? unitsStartedFlow : unitsFallback;
  denominatorSet.forEach((unitId) => {
    const unitExecs = unitGroups.get(unitId) ?? [];
    const passesAllSteps = steps.every((step) => {
      const earliest = unitExecs
        .filter((exec) => exec.stepDefinitionId === step.id)
        .sort((a, b) => {
          const aTime = getTimestamp(a.completedAt ?? a.startedAt);
          const bTime = getTimestamp(b.completedAt ?? b.startedAt);
          return aTime - bTime;
        })[0];

      if (!earliest) return false;
      if (earliest.reworkLoopId) return false;
      return earliest.result === ExecutionResult.PASS;
    });

    if (passesAllSteps) firstPassUnits += 1;
  });

  const unitsWithExecs = Array.from(unitGroups.keys());
  const unitsWithRework = unitsWithExecs.filter((unitId) => {
    const unitExecs = unitGroups.get(unitId) ?? [];
    return unitExecs.some((exec) => Boolean(exec.reworkLoopId));
  }).length;

  const unitsScrapped = unitsWithExecs.filter((unitId) => {
    const unitExecs = unitGroups.get(unitId) ?? [];
    if (unitExecs.length === 0) return false;
    const lastExec = unitExecs.reduce((latest, current) => {
      const latestTime = getTimestamp(latest.completedAt ?? latest.startedAt);
      const currentTime = getTimestamp(current.completedAt ?? current.startedAt);
      return currentTime > latestTime ? current : latest;
    });

    return (
      lastExec.unit.finalResult === ExecutionResult.SCRAP ||
      lastExec.result === ExecutionResult.SCRAP
    );
  }).length;

  const lineFpy =
    denominatorSet.size === 0 ? 0 : firstPassUnits / denominatorSet.size;
  const reworkRate =
    unitsWithExecs.length === 0 ? 0 : unitsWithRework / unitsWithExecs.length;
  const scrapRate =
    unitsWithExecs.length === 0 ? 0 : unitsScrapped / unitsWithExecs.length;

  const status = lineFpy >= 0.98 ? "OK" : lineFpy >= 0.95 ? "WARNING" : "CRITICAL";

  const rty = stations.reduce((product, station) => {
    if (station.yield <= 0) return product;
    return product === 0 ? station.yield : product * station.yield;
  }, 0);

  const stationsSorted = [...stations].sort((a, b) => a.yield - b.yield);

  const bucketCount = Math.max(
    1,
    Math.ceil((effectiveRangeHours * MS_PER_HOUR) / bucketMs),
  );
  const buckets = Array.from({ length: bucketCount }).map((_, idx) => {
    const startTs = windowStart.getTime() + idx * bucketMs;
    return { start: new Date(startTs), executions: [] as typeof executions };
  });

  executions.forEach((exec) => {
    const ts = getTimestamp(exec.completedAt ?? exec.startedAt);
    const index = Math.min(
      buckets.length - 1,
      Math.max(0, Math.floor((ts - windowStart.getTime()) / bucketMs)),
    );
    buckets[index]?.executions.push(exec);
  });

  const timeBuckets = buckets.map((bucket, idx) => {
    const unitMap = bucket.executions.reduce<Map<number, typeof executions>>((map, exec) => {
      const list = map.get(exec.unitId) ?? [];
      list.push(exec);
      map.set(exec.unitId, list);
      return map;
    }, new Map());

    const stationsFpy = steps.map((step) => {
      const earliestByUnit = new Map<number, typeof executions[number]>();
      bucket.executions.forEach((exec) => {
        if (exec.stepDefinitionId !== step.id) return;
        const existing = earliestByUnit.get(exec.unitId);
        if (!existing) {
          earliestByUnit.set(exec.unitId, exec);
          return;
        }
        const currentTs = getTimestamp(exec.completedAt ?? exec.startedAt);
        const existingTs = getTimestamp(existing.completedAt ?? existing.startedAt);
        if (currentTs < existingTs) earliestByUnit.set(exec.unitId, exec);
      });
      const totalFirstPass = earliestByUnit.size;
      const passFirst = Array.from(earliestByUnit.values()).filter(
        (e) => e.result === ExecutionResult.PASS,
      ).length;
      return totalFirstPass === 0 ? 0 : passFirst / totalFirstPass;
    });

    const rtyBucket = stationsFpy.reduce((prod, y) => (prod === 0 ? 0 : prod * y), 1);

    const unitsStarted = new Set<number>();
    bucket.executions.forEach((exec) => {
      if (exec.stepDefinitionId === steps[0]?.id) unitsStarted.add(exec.unitId);
    });

    let firstPass = 0;
    unitsStarted.forEach((unitId) => {
      const execs = unitMap.get(unitId) ?? [];
      const passesAll = steps.every((step) => {
        const earliest = execs
          .filter((e) => e.stepDefinitionId === step.id)
          .sort(
            (a, b) =>
              getTimestamp(a.completedAt ?? a.startedAt) -
              getTimestamp(b.completedAt ?? b.startedAt),
          )[0];
        if (!earliest) return false;
        if (earliest.reworkLoopId) return false;
        return earliest.result === ExecutionResult.PASS;
      });
      if (passesAll) firstPass += 1;
    });

    const reworkUnits = Array.from(unitMap.keys()).filter((id) => {
      const execs = unitMap.get(id) ?? [];
      return execs.some((e) => e.reworkLoopId);
    }).length;

    const scrapUnits = Array.from(unitMap.keys()).filter((id) => {
      const execs = unitMap.get(id) ?? [];
      const latest = execs.reduce((latestExec, current) => {
        if (!latestExec) return current;
        return getTimestamp(current.completedAt ?? current.startedAt) >
          getTimestamp(latestExec.completedAt ?? latestExec.startedAt)
          ? current
          : latestExec;
      }, execs[0]);
      return latest?.result === ExecutionResult.SCRAP;
    }).length;

    const lineFpyBucket =
      unitsStarted.size === 0 ? 0 : firstPass / unitsStarted.size;
    const reworkRateBucket =
      unitMap.size === 0 ? 0 : reworkUnits / unitMap.size;
    const scrapRateBucket =
      unitMap.size === 0 ? 0 : scrapUnits / unitMap.size;
    const throughputBucket = bucket.executions.filter(
      (exec) =>
        exec.stepDefinitionId === steps[steps.length - 1].id &&
        exec.result === ExecutionResult.PASS,
    ).length;

    const label = idx === buckets.length - 1 ? "Now" : `${bucketSettings.bucketHours}h`;

    return {
      label,
      lineFpy: lineFpyBucket,
      rty: rtyBucket,
      throughput: throughputBucket,
      reworkRate: reworkRateBucket,
      scrapRate: scrapRateBucket,
      start: bucket.start.toISOString(),
    };
  });

  return NextResponse.json<LineOverviewResponse>({
    overall: {
      lineFpy,
      rty: stations.length === 0 ? 0 : rty,
      throughput: throughputUnits.size,
      reworkRate,
      scrapRate,
      status,
      rangeHours: effectiveRangeHours,
    },
    timeBuckets,
    stations: stationsSorted,
  });
}
