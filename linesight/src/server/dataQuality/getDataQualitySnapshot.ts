import { prisma } from "@/lib/prisma";

type CoverageRow = {
  stepId: number;
  code: string;
  name: string;
  expectedUnits: number;
  actualUnits: number;
  coverage: number;
  status: "OK" | "WARN";
};

type DuplicateSerial = {
  unitId: number;
  serial: string;
  executionCount: number;
};

type OutOfOrderResult = {
  unitsChecked: number;
  unitsWithIssues: number;
  sampleSerials: string[];
};

type MissingCtqRow = {
  ctqId: number;
  name: string;
  stepName: string;
  expected: number;
  measured: number;
  missing: number;
  missingRate: number;
  status: "OK" | "WARN";
};

type LatencyStats = {
  sampleSize: number;
  avgMinutes: number;
  p95Minutes: number;
};

export type DataQualitySnapshot = {
  window: { from: string; to: string };
  coverage: CoverageRow[];
  duplicates: DuplicateSerial[];
  outOfOrder: OutOfOrderResult;
  missingCtqs: MissingCtqRow[];
  latency?: LatencyStats;
};

const MS_PER_MINUTE = 60 * 1000;

const getTimestamp = (completedAt: Date | null, startedAt: Date | null) =>
  (completedAt ?? startedAt ?? new Date(0)).getTime();

export async function getDataQualitySnapshot(): Promise<DataQualitySnapshot> {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [steps, units, executions, ctqs] = await Promise.all([
    prisma.processStepDefinition.findMany({ orderBy: { sequence: "asc" } }),
    prisma.unit.findMany({
      where: { createdAt: { gte: from } },
      select: { id: true, serial: true },
    }),
    prisma.processStepExecution.findMany({
      where: { startedAt: { gte: from } },
      select: {
        id: true,
        unitId: true,
        stepDefinitionId: true,
        startedAt: true,
        completedAt: true,
        result: true,
      },
    }),
    prisma.cTQDefinition.findMany({
      where: { isCritical: true },
      include: { processStepDefinition: { select: { id: true, name: true } } },
    }),
  ]);

  const unitIds = units.map((u) => u.id);
  const unitIdSet = new Set(unitIds);
  const stepsCount = steps.length;

  // Coverage
  const coverage: CoverageRow[] = steps.map((step) => {
    const expectedUnits = units.length;
    const actualUnits = new Set(
      executions
        .filter(
          (e) =>
            e.stepDefinitionId === step.id &&
            unitIdSet.has(e.unitId),
        )
        .map((e) => e.unitId),
    ).size;
    const cov = expectedUnits === 0 ? 1 : actualUnits / expectedUnits;
    return {
      stepId: step.id,
      code: step.code,
      name: step.name,
      expectedUnits,
      actualUnits,
      coverage: cov,
      status: cov >= 0.98 ? "OK" : "WARN",
    };
  });

  // Duplicates (heuristic: unusually high execution counts)
  const execsByUnit = executions.reduce<Record<number, typeof executions>>((acc, exec) => {
    acc[exec.unitId] = acc[exec.unitId] || [];
    acc[exec.unitId].push(exec);
    return acc;
  }, {});

  const duplicates: DuplicateSerial[] = Object.entries(execsByUnit)
    .map(([unitIdStr, execs]) => {
      const unitId = Number(unitIdStr);
      return { unitId, executionCount: execs.length };
    })
    .filter((row) => row.executionCount > stepsCount * 3)
    .sort((a, b) => b.executionCount - a.executionCount)
    .slice(0, 5)
    .map((row) => ({
      ...row,
      serial: units.find((u) => u.id === row.unitId)?.serial ?? `Unit ${row.unitId}`,
    }));

  // Out-of-order
  const stepSeq = new Map<number, number>();
  steps.forEach((s) => stepSeq.set(s.id, s.sequence));

  let unitsChecked = 0;
  let unitsWithIssues = 0;
  const outOfOrderSerials: string[] = [];

  units.slice(0, 200).forEach((unit) => {
    const unitExecs = (execsByUnit[unit.id] ?? []).slice().sort(
      (a, b) =>
        getTimestamp(a.completedAt, a.startedAt) - getTimestamp(b.completedAt, b.startedAt),
    );
    if (unitExecs.length === 0) return;
    unitsChecked += 1;
    const earliestByStep = new Map<number, typeof unitExecs[number]>();
    unitExecs.forEach((exec) => {
      if (!earliestByStep.has(exec.stepDefinitionId)) {
        earliestByStep.set(exec.stepDefinitionId, exec);
      }
    });
    const orderedSteps = steps
      .map((step) => earliestByStep.get(step.id))
      .filter(Boolean) as typeof unitExecs;
    let hasIssue = false;
    for (let i = 1; i < orderedSteps.length; i += 1) {
      const prevTs = getTimestamp(orderedSteps[i - 1].completedAt, orderedSteps[i - 1].startedAt);
      const currTs = getTimestamp(orderedSteps[i].completedAt, orderedSteps[i].startedAt);
      if (currTs < prevTs) {
        hasIssue = true;
        break;
      }
    }
    if (hasIssue) {
      unitsWithIssues += 1;
      outOfOrderSerials.push(unit.serial);
    }
  });

  // Missing CTQs
  const execsByStep = executions.reduce<Record<number, typeof executions>>((acc, exec) => {
    acc[exec.stepDefinitionId] = acc[exec.stepDefinitionId] || [];
    acc[exec.stepDefinitionId].push(exec);
    return acc;
  }, {});

  const measurements = await prisma.measurement.findMany({
    where: {
      recordedAt: { gte: from },
      processStepExecution: {
        unitId: { in: unitIds },
      },
    },
    select: { id: true, ctqDefinitionId: true, processStepExecutionId: true, recordedAt: true },
  });

  const measurementCountByCtq = measurements.reduce<Record<number, number>>((acc, m) => {
    acc[m.ctqDefinitionId] = (acc[m.ctqDefinitionId] ?? 0) + 1;
    return acc;
  }, {});

  const missingCtqs: MissingCtqRow[] = ctqs.map((ctq) => {
    const execsForStep = execsByStep[ctq.processStepDefinitionId] ?? [];
    const expected = execsForStep.length;
    const measured = measurementCountByCtq[ctq.id] ?? 0;
    const missing = Math.max(0, expected - measured);
    const missingRate = expected === 0 ? 0 : missing / expected;
    return {
      ctqId: ctq.id,
      name: ctq.name,
      stepName: ctq.processStepDefinition.name,
      expected,
      measured,
      missing,
      missingRate,
      status: missingRate > 0.02 ? "WARN" : "OK",
    };
  });

  // Latency (recordedAt - completedAt)
  const latenciesMs: number[] = measurements
    .map((m) => {
      const exec = executions.find((e) => e.id === m.processStepExecutionId);
      if (!exec) return null;
      const execTs = getTimestamp(exec.completedAt, exec.startedAt);
      const recordedTs = (m.recordedAt ?? now).getTime();
      if (!execTs || !recordedTs) return null;
      return Math.max(0, recordedTs - execTs);
    })
    .filter((v): v is number => v !== null);

  const latency: LatencyStats | undefined =
    latenciesMs.length === 0
      ? undefined
      : {
          sampleSize: latenciesMs.length,
          avgMinutes: latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length / MS_PER_MINUTE,
          p95Minutes: (() => {
            const sorted = [...latenciesMs].sort((a, b) => a - b);
            const idx = Math.floor(sorted.length * 0.95);
            return sorted[idx] / MS_PER_MINUTE;
          })(),
        };

  return {
    window: { from: from.toISOString(), to: now.toISOString() },
    coverage,
    duplicates,
    outOfOrder: {
      unitsChecked,
      unitsWithIssues,
      sampleSerials: outOfOrderSerials.slice(0, 5),
    },
    missingCtqs: missingCtqs.sort((a, b) => b.missingRate - a.missingRate),
    latency,
  };
}
