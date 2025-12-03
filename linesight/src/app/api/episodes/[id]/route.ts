import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type EpisodeDetailResponse = {
  id: number;
  title: string;
  summary: string;
  status: string;
  rootCauseCategory: string;
  effectivenessTag: string | null;
  startTime: string | null;
  endTime: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  affectedSteps?: unknown;
  affectedCtqs?: unknown;
  affectedLots?: unknown;
  affectedFixtures?: unknown;
  beforeMetrics?: unknown;
  afterMetrics?: unknown;
  externalLinks?: unknown;
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
          (item as Record<string, unknown>).lotId ??
          (item as Record<string, unknown>).fixtureId;
        return typeof maybeId === "number" ? maybeId : null;
      }
      return null;
    })
    .filter((num): num is number => typeof num === "number");
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const episodeId = Number(id);
  if (Number.isNaN(episodeId) || episodeId <= 0) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
  });

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  const stepIds = toNumberArray(
    typeof episode.affectedSteps === "object"
      ? (episode.affectedSteps as any).stepDefinitionIds ?? episode.affectedSteps
      : episode.affectedSteps,
  );
  const ctqIds = toNumberArray(
    typeof episode.affectedCtqs === "object"
      ? (episode.affectedCtqs as any).ctqDefinitionIds ?? episode.affectedCtqs
      : episode.affectedCtqs,
  );
  const lotIds = toNumberArray(
    typeof episode.affectedLots === "object"
      ? (episode.affectedLots as any).lotIds ?? episode.affectedLots
      : episode.affectedLots,
  );
  const fixtureIds = toNumberArray(
    typeof episode.affectedSteps === "object"
      ? (episode.affectedSteps as any).fixtureIds ?? []
      : [],
  );

  const [steps, ctqs, lots, fixtures] = await Promise.all([
    stepIds.length
      ? prisma.processStepDefinition.findMany({
          where: { id: { in: stepIds } },
          orderBy: { sequence: "asc" },
        })
      : Promise.resolve([]),
    ctqIds.length
      ? prisma.cTQDefinition.findMany({
          where: { id: { in: ctqIds } },
        })
      : Promise.resolve([]),
    lotIds.length
      ? prisma.componentLot.findMany({
          where: { id: { in: lotIds } },
        })
      : Promise.resolve([]),
    fixtureIds.length
      ? prisma.fixture.findMany({
          where: { id: { in: fixtureIds } },
        })
      : Promise.resolve([]),
  ]);

  const response: EpisodeDetailResponse = {
    id: episode.id,
    title: episode.title,
    summary: episode.summary,
    status: episode.status,
    rootCauseCategory: episode.rootCauseCategory,
    effectivenessTag: episode.effectivenessTag ?? null,
    startTime: episode.startedAt?.toISOString() ?? null,
    endTime: episode.endedAt?.toISOString() ?? null,
    createdAt: episode.createdAt?.toISOString() ?? null,
    updatedAt: episode.updatedAt?.toISOString() ?? null,
    affectedSteps:
      steps.length > 0
        ? steps.map((step) => ({
            id: step.id,
            code: step.code,
            name: step.name,
            stepType: step.stepType,
            sequence: step.sequence,
          }))
        : episode.affectedSteps ?? undefined,
    affectedCtqs:
      ctqs.length > 0
        ? ctqs.map((ctq) => ({
            id: ctq.id,
            name: ctq.name,
            stepId: ctq.processStepDefinitionId,
            units: ctq.units,
            lowerSpecLimit: ctq.lowerSpecLimit,
            upperSpecLimit: ctq.upperSpecLimit,
            target: ctq.target,
            direction: ctq.direction,
          }))
        : episode.affectedCtqs ?? undefined,
    affectedLots:
      lots.length > 0
        ? lots.map((lot) => ({
            id: lot.id,
            code: lot.lotNumber,
            type: lot.componentName,
            supplier: lot.supplier,
          }))
        : episode.affectedLots ?? undefined,
    affectedFixtures:
      fixtures.length > 0
        ? fixtures.map((fixture) => ({
            id: fixture.id,
            code: fixture.code,
            stationCode: fixture.stationCode,
            fixtureType: fixture.fixtureType,
            status: fixture.status,
          }))
        : undefined,
    beforeMetrics: episode.beforeMetrics ?? undefined,
    afterMetrics: episode.afterMetrics ?? undefined,
    externalLinks: episode.externalLinks ?? undefined,
  };

  return NextResponse.json(response);
}
