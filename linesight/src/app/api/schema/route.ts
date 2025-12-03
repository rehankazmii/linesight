import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import type { CtqDef, SchemaResponse } from "@/types/schema";

export async function GET() {
  const steps = await prisma.processStepDefinition.findMany({
    orderBy: { sequence: "asc" },
    include: {
      ctqs: true,
      reworkTargets: {
        select: {
          id: true,
          code: true,
          name: true,
          sequence: true,
        },
      },
    },
  });

  const mappedSteps: SchemaResponse["steps"] = steps.map((step) => {
    const ctqs: CtqDef[] = step.ctqs.map((ctq) => ({
      id: ctq.id,
      code: ctq.code ?? ctq.name,
      name: ctq.name,
      units: ctq.units ?? "",
      lsl: ctq.lowerSpecLimit,
      usl: ctq.upperSpecLimit,
      target: ctq.target,
      isCritical: ctq.isCritical,
      direction: ctq.direction,
    }));

    return {
      id: step.id,
      code: step.code,
      name: step.name,
      stepType: step.stepType,
      sequence: step.sequence,
      canScrap: step.canScrap,
      reworkTargets: step.reworkTargets,
      ctqs,
    };
  });

  const response: SchemaResponse = {
    steps: mappedSteps,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
