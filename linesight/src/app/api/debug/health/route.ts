import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type HealthCounts = {
  processStepDefinitions: number;
  ctqDefinitions: number;
  units: number;
  kits: number;
  processStepExecutions: number;
  measurements: number;
  componentLots: number;
  fixtures: number;
  episodes: number;
};

type HealthResponse = {
  ok: boolean;
  counts: HealthCounts;
};

const EMPTY_COUNTS: HealthCounts = {
  processStepDefinitions: 0,
  ctqDefinitions: 0,
  units: 0,
  kits: 0,
  processStepExecutions: 0,
  measurements: 0,
  componentLots: 0,
  fixtures: 0,
  episodes: 0,
};

export async function GET() {
  try {
    const [
      processStepDefinitions,
      ctqDefinitions,
      units,
      kits,
      processStepExecutions,
      measurements,
      componentLots,
      fixtures,
      episodes,
    ] = await Promise.all([
      prisma.processStepDefinition.count(),
      prisma.cTQDefinition.count(),
      prisma.unit.count(),
      prisma.kit.count(),
      prisma.processStepExecution.count(),
      prisma.measurement.count(),
      prisma.componentLot.count(),
      prisma.fixture.count(),
      prisma.episode.count(),
    ]);

    const counts: HealthCounts = {
      processStepDefinitions,
      ctqDefinitions,
      units,
      kits,
      processStepExecutions,
      measurements,
      componentLots,
      fixtures,
      episodes,
    };

    return NextResponse.json<HealthResponse>({
      ok: true,
      counts,
    });
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json<HealthResponse>({
      ok: false,
      counts: EMPTY_COUNTS,
    });
  }
}
