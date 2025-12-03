import { NextResponse } from "next/server";
import { ExecutionResult } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { MODULE_SLOTS } from "@/lib/module-slots";
import type { ModuleViewResponse } from "@/types/module-view";

const toUpper = (value: string) => value.toUpperCase();

export async function GET(
  _request: Request,
  context: { params: Promise<{ serial: string }> },
) {
  try {
    const { serial: rawSerial } = await context.params;
    const serial = rawSerial?.trim();
    if (!serial) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }
    const normalizedSerial = toUpper(serial);

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

    const kitLots = unit.kit?.componentLots ?? [];
    const lotByType = new Map<string, { id: number; lotNumber: string; supplier: string | null }>();
    kitLots.forEach((kc) => {
      const type = kc.componentLot.componentName;
      lotByType.set(type, {
        id: kc.componentLot.id,
        lotNumber: kc.componentLot.lotNumber,
        supplier: kc.componentLot.supplier ?? null,
      });
    });

    const lotIds = Array.from(lotByType.values()).map((lot) => lot.id);
    const kitLinks = lotIds.length
      ? await prisma.kitComponentLot.findMany({
          where: { componentLotId: { in: lotIds } },
          include: {
            kit: {
              include: { unit: true },
            },
          },
        })
      : [];

    const unitIdsForLot: Record<number, number[]> = {};
    kitLinks.forEach((kc) => {
      const u = kc.kit.unit;
      if (!u) return;
      unitIdsForLot[kc.componentLotId] = unitIdsForLot[kc.componentLotId] || [];
      unitIdsForLot[kc.componentLotId].push(u.id);
    });

    const allUnitIds = Array.from(new Set(Object.values(unitIdsForLot).flat()));
    const executions = allUnitIds.length
      ? await prisma.processStepExecution.findMany({
          where: { unitId: { in: allUnitIds } },
          select: { unitId: true, reworkLoopId: true, result: true, completedAt: true, startedAt: true },
        })
      : [];

    const reworkUnits = new Set<number>();
    const scrapUnits = new Set<number>();
    const lastExecByUnit: Record<number, { result: ExecutionResult; timestamp: number }> = {};

    executions.forEach((exec) => {
      if (exec.reworkLoopId) reworkUnits.add(exec.unitId);
      const ts = (exec.completedAt ?? exec.startedAt ?? new Date(0)).getTime();
      const last = lastExecByUnit[exec.unitId];
      if (!last || ts > last.timestamp) {
        lastExecByUnit[exec.unitId] = { result: exec.result, timestamp: ts };
      }
    });

    Object.entries(lastExecByUnit).forEach(([unitIdStr, payload]) => {
      if (payload.result === ExecutionResult.SCRAP) scrapUnits.add(Number(unitIdStr));
    });

    const modules = MODULE_SLOTS.map((slot) => {
      const lot = slot.componentTypes
        .map((type) => lotByType.get(type))
        .find((lotInfo) => Boolean(lotInfo)) ?? null;

      if (!lot) {
        return {
          moduleKey: slot.key,
          moduleName: slot.name,
          lotId: null,
          lotCode: null,
          supplier: null,
          unitsBuilt: 0,
          passFirstTryUnits: 0,
          reworkUnits: 0,
          scrapUnits: 0,
          fpy: 0,
          reworkRate: 0,
          scrapRate: 0,
        };
      }

      const unitsForLot = Array.from(new Set(unitIdsForLot[lot.id] ?? []));
      const unitsBuilt = unitsForLot.length;
      const lotRework = unitsForLot.filter((id) => reworkUnits.has(id)).length;
      const lotScrap = unitsForLot.filter((id) => scrapUnits.has(id)).length;
      const passFirstTry = Math.max(0, unitsBuilt - lotRework - lotScrap);
      const fpy = unitsBuilt === 0 ? 0 : passFirstTry / unitsBuilt;
      const reworkRate = unitsBuilt === 0 ? 0 : lotRework / unitsBuilt;
      const scrapRate = unitsBuilt === 0 ? 0 : lotScrap / unitsBuilt;

      return {
        moduleKey: slot.key,
        moduleName: slot.name,
        lotId: lot.id,
        lotCode: lot.lotNumber,
        supplier: lot.supplier,
        unitsBuilt,
        passFirstTryUnits: passFirstTry,
        reworkUnits: lotRework,
        scrapUnits: lotScrap,
        fpy,
        reworkRate,
        scrapRate,
      };
    });

    const response: ModuleViewResponse = {
      unitSerial: unit.serial,
      unitId: unit.id,
      modules,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Module view error", error);
    return NextResponse.json({ error: "Unable to load module view" }, { status: 500 });
  }
}
