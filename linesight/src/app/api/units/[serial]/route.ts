import { NextRequest, NextResponse } from "next/server";
import { CTQDirection } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { UnitTraceResponse } from "@/types/unit-trace";

const getExecutionTimestamp = (completedAt: Date | null, startedAt: Date | null) => {
  const timestamp = completedAt ?? startedAt;
  return timestamp ? timestamp.getTime() : 0;
};

const isCtqInSpec = (
  value: number,
  direction: CTQDirection,
  lowerSpecLimit: number | null,
  upperSpecLimit: number | null,
) => {
  switch (direction) {
    case CTQDirection.TWO_SIDED: {
      const lowerOk = lowerSpecLimit === null ? true : value >= lowerSpecLimit;
      const upperOk = upperSpecLimit === null ? true : value <= upperSpecLimit;
      return lowerOk && upperOk;
    }
    case CTQDirection.HIGHER_BETTER: {
      if (lowerSpecLimit === null) return true;
      return value >= lowerSpecLimit;
    }
    case CTQDirection.LOWER_BETTER: {
      if (upperSpecLimit === null) return true;
      return value <= upperSpecLimit;
    }
    default:
      return true;
  }
};

const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "number") return item;
      if (item && typeof item === "object") {
        const maybeId =
          (item as Record<string, unknown>).id ??
          (item as Record<string, unknown>).stepId ??
          (item as Record<string, unknown>).ctqId ??
          (item as Record<string, unknown>).lotId;
        return typeof maybeId === "number" ? maybeId : null;
      }
      return null;
    })
    .filter((num): num is number => typeof num === "number");
};

const overlapCount = (source: number[], candidate: number[]) => {
  const sourceSet = new Set(source);
  return candidate.filter((value) => sourceSet.has(value)).length;
};

const buildLoopMetadata = (executions: typeof prisma.processStepExecution.$inferSelect[]) => {
  const loopOrder = new Map<string, number>();
  let nextIndex = 1;

  // assign order based on first appearance
  executions.forEach((exec) => {
    if (exec.reworkLoopId && !loopOrder.has(exec.reworkLoopId)) {
      loopOrder.set(exec.reworkLoopId, nextIndex++);
    }
  });

  // positions within each loop
  const loopGroups = new Map<string, typeof executions>();
  executions.forEach((exec) => {
    if (!exec.reworkLoopId) return;
    const list = loopGroups.get(exec.reworkLoopId) ?? [];
    list.push(exec);
    loopGroups.set(exec.reworkLoopId, list);
  });

  const loopPositions = new Map<number, { loopIndex: number; loopPosition: "start" | "middle" | "end" | "single" }>();
  loopGroups.forEach((list, loopId) => {
    const sorted = [...list].sort(
      (a, b) =>
        getExecutionTimestamp(a.completedAt, a.startedAt) -
        getExecutionTimestamp(b.completedAt, b.startedAt),
    );
    const loopIndex = loopOrder.get(loopId) ?? 0;
    if (sorted.length === 1) {
      loopPositions.set(sorted[0].id, { loopIndex, loopPosition: "single" });
      return;
    }
    sorted.forEach((exec, idx) => {
      const pos =
        idx === 0 ? "start" : idx === sorted.length - 1 ? "end" : "middle";
      loopPositions.set(exec.id, { loopIndex, loopPosition: pos });
    });
  });

  return { loopOrder, loopPositions };
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ serial: string }> },
) {
  try {
  const { serial: rawSerial } = await context.params;
  const serial = rawSerial?.trim();
  if (!serial) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }
  const normalizedSerial = serial.toUpperCase();

  const unit = await prisma.unit.findFirst({
    where: { serial: normalizedSerial },
    include: {
      kit: {
        include: {
          componentLots: {
            include: { componentLot: true },
          },
        },
      },
    },
  });

  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  const executions = await prisma.processStepExecution.findMany({
    where: { unitId: unit.id },
    include: {
      stepDefinition: true,
      fixture: true,
      measurements: {
        include: { ctqDefinition: true },
      },
    },
  });
  const episodes = await prisma.episode.findMany();

  const sortedExecutions = [...executions].sort((a, b) => {
    const aTs = getExecutionTimestamp(a.completedAt, a.startedAt);
    const bTs = getExecutionTimestamp(b.completedAt, b.startedAt);
    return aTs - bTs;
  });

  const reworkLoopCount = new Set(
    sortedExecutions
      .map((execution) => execution.reworkLoopId)
      .filter((id): id is string => Boolean(id)),
  ).size;

  const latestExecution = sortedExecutions[sortedExecutions.length - 1];
  const derivedFinalResult =
    unit.finalResult ??
    (latestExecution ? latestExecution.result : null) ??
    null;

  const lotIds =
    unit.kit?.componentLots.map((lot) => lot.componentLot.id).filter(Boolean) ?? [];
  const stepIds = sortedExecutions.map((exec) => exec.stepDefinitionId);
  const ctqIds = sortedExecutions.flatMap((exec) =>
    exec.measurements?.map((m) => m.ctqDefinitionId) ?? [],
  );
  const failureCodes = sortedExecutions
    .map((exec) => exec.failureCode)
    .filter((code): code is string => Boolean(code));

  const scoredEpisodes = episodes
    .map((episode) => {
      const episodeCtqs = toNumberArray(episode.affectedCtqs);
      const episodeSteps = toNumberArray(episode.affectedSteps);
      const episodeLots = toNumberArray(episode.affectedLots);

      const ctqOverlap = overlapCount(ctqIds, episodeCtqs);
      const stepOverlap = overlapCount(stepIds, episodeSteps);
      const lotOverlap = overlapCount(lotIds, episodeLots);

      const score = ctqOverlap * 3 + stepOverlap * 2 + lotOverlap * 1;

      const matchReasons: string[] = [];
      if (ctqOverlap > 0) matchReasons.push("CTQ overlap");
      if (stepOverlap > 0) matchReasons.push("Step overlap");
      if (lotOverlap > 0) matchReasons.push("Lot overlap");
      if (failureCodes.length > 0) matchReasons.push("Failure on unit");

      return { episode, score, matchReasons };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      id: item.episode.id,
      title: item.episode.title,
      status: item.episode.status,
      rootCauseCategory: item.episode.rootCauseCategory,
      effectivenessTag: item.episode.effectivenessTag ?? "",
      score: Number(item.score.toFixed(2)),
      matchReasons: item.matchReasons,
      why:
        item.matchReasons.length > 0
          ? item.matchReasons.join(", ")
          : "Similar pattern detected",
    }));

  const { loopOrder, loopPositions } = buildLoopMetadata(sortedExecutions);

  const response: UnitTraceResponse = {
    unit: {
      id: unit.id,
      serial: unit.serial,
      createdAt: unit.createdAt.toISOString(),
      finalResult: derivedFinalResult ?? null,
      reworkLoopCount,
    },
    kit: unit.kit
      ? {
          id: unit.kit.id,
          lots: unit.kit.componentLots.map((lot) => ({
            id: lot.componentLot.id,
            code: lot.componentLot.lotNumber,
            type: lot.componentLot.componentName,
          })),
      }
      : null,
    episodes: scoredEpisodes,
    executions: sortedExecutions.map((execution) => {
      const startedAt = execution.startedAt ?? execution.completedAt ?? new Date(0);
      const finishedAt = execution.completedAt ?? execution.startedAt ?? startedAt;
      const loopMeta = execution.reworkLoopId
        ? loopPositions.get(execution.id) ?? { loopIndex: loopOrder.get(execution.reworkLoopId) ?? null, loopPosition: "single" as const }
        : { loopIndex: null, loopPosition: null };

      const ctqs =
        execution.measurements?.map((measurement) => {
          const ctq = measurement.ctqDefinition;
          const inSpec = isCtqInSpec(
            measurement.value,
            ctq.direction,
            ctq.lowerSpecLimit,
            ctq.upperSpecLimit,
          );

          return {
            ctqId: ctq.id,
            code: ctq.code ?? ctq.name,
            name: ctq.name,
            units: ctq.units ?? "",
            value: measurement.value,
            inSpec,
            lowerSpecLimit: ctq.lowerSpecLimit,
            upperSpecLimit: ctq.upperSpecLimit,
            target: ctq.target,
          };
        }) ?? [];

      const inSpecAll = ctqs.every((c) => c.inSpec);
      const effectiveResult =
        execution.result === "SCRAP" ? execution.result : inSpecAll ? execution.result : "FAIL";

      return {
        id: execution.id,
        stepId: execution.stepDefinition.id,
        stepCode: execution.stepDefinition.code,
        stepName: execution.stepDefinition.name,
        stepType: execution.stepDefinition.stepType,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        result: effectiveResult,
        failureCode: execution.failureCode,
        reworkLoopId: execution.reworkLoopId,
        stationId: execution.stationCode ?? null,
        fixtureCode: execution.fixture?.code ?? null,
        loopIndex: loopMeta.loopIndex,
        loopPosition: loopMeta.loopPosition,
        ctqs,
      };
    }),
  };

  return NextResponse.json(response);
  } catch (error) {
    console.error("Unit trace error", error);
    return NextResponse.json({ error: "Unable to load unit trace" }, { status: 500 });
  }
}
