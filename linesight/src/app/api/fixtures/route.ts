import { NextResponse } from "next/server";
import { ExecutionResult } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

type FixtureSummary = {
  id: number;
  code: string;
  type: string | null;
  stationId: string | null;
  lastCalibratedAt: string | null;
  status: string | null;
  usageCount: number;
  correlatedFailureRate: number;
  episodeCount: number;
  health: "GOOD" | "WARN" | "BAD";
  calibrationOverdue: boolean;
};

type FixturesResponse = {
  fixtures: FixtureSummary[];
};

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function GET() {
  const fixtures = await prisma.fixture.findMany({
    include: {
      executions: true,
    },
  });
  const episodes = await prisma.episode.findMany({
    select: { id: true, affectedSteps: true, affectedLots: true },
  });

  const summaries: FixtureSummary[] = fixtures.map((fixture) => {
    const usageCount = fixture.executions.length;
    const failureExecutions = fixture.executions.filter(
      (execution) =>
        execution.result === ExecutionResult.FAIL ||
        execution.result === ExecutionResult.SCRAP,
    ).length;
    const correlatedFailureRate = usageCount === 0 ? 0 : failureExecutions / usageCount;

    const episodeCount = episodes.filter((episode) => {
      const steps =
        (episode.affectedSteps as { stepDefinitionIds?: number[] } | null)?.stepDefinitionIds ??
        [];
      return steps.length === 0
        ? false
        : fixture.executions.some((exec) => steps.includes(exec.stepDefinitionId));
    }).length;

    const calibrationTs = fixture.lastCalibratedAt?.getTime() ?? 0;
    const calibrationOverdue = calibrationTs > 0 ? Date.now() - calibrationTs > NINETY_DAYS_MS : false;

    const health: FixtureSummary["health"] =
      correlatedFailureRate > 0.1 || calibrationOverdue
        ? "BAD"
        : correlatedFailureRate > 0.05
          ? "WARN"
          : "GOOD";

    return {
      id: fixture.id,
      code: fixture.code,
      type: fixture.fixtureType ?? null,
      stationId: fixture.stationCode ?? null,
      lastCalibratedAt: fixture.lastCalibratedAt
        ? fixture.lastCalibratedAt.toISOString()
        : null,
      status: fixture.status ?? null,
      usageCount,
      correlatedFailureRate,
      episodeCount,
      health,
      calibrationOverdue,
    };
  });

  const sorted = summaries.sort(
    (a, b) => b.correlatedFailureRate - a.correlatedFailureRate,
  );

  const response: FixturesResponse = {
    fixtures: sorted,
  };

  return NextResponse.json(response);
}
