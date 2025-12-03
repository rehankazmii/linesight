import { PrismaClient, Prisma as PrismaNS, $Enums } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL,
});

type ExecutionResult = $Enums.ExecutionResult;

const prisma = new PrismaClient({ adapter, log: ["error", "warn"] } as PrismaNS.PrismaClientOptions);
const ER = $Enums.ExecutionResult;

type Health = "GOOD" | "WARN" | "BAD";

const lotHealth = (yieldRatio: number, scrapRate: number): Health => {
  if (yieldRatio < 0.9 || scrapRate > 0.08) return "BAD";
  if (yieldRatio < 0.96 || scrapRate > 0.03) return "WARN";
  return "GOOD";
};

const typeHealth = (lots: Health[]): Health => {
  const total = lots.length || 1;
  const bad = lots.filter((h) => h === "BAD").length;
  const warn = lots.filter((h) => h === "WARN").length;
  if (bad / total >= 0.5 || bad >= 3) return "BAD";
  if (bad > 0 || warn / total >= 0.25 || warn >= 2) return "WARN";
  return "GOOD";
};

async function main() {
  const lots = await prisma.componentLot.findMany({
    select: { id: true, lotNumber: true, componentName: true },
  });

  const kitLots = await prisma.kitComponentLot.findMany({
    select: { componentLotId: true, kit: { select: { unit: { select: { id: true, finalResult: true } } } } },
  });

  const lotUnits = new Map<number, { unitIds: number[]; finals: Map<number, ExecutionResult | null> }>();
  kitLots.forEach((kl) => {
    const unitId = kl.kit.unit?.id;
    const finalResult = kl.kit.unit?.finalResult ?? null;
    if (unitId === undefined) return;
    const entry = lotUnits.get(kl.componentLotId) ?? { unitIds: [], finals: new Map<number, ExecutionResult | null>() };
    entry.unitIds.push(unitId);
    entry.finals.set(unitId, finalResult);
    lotUnits.set(kl.componentLotId, entry);
  });

  const allUnitIds = Array.from(new Set(Array.from(lotUnits.values()).flatMap((v) => v.unitIds)));
  const executions = allUnitIds.length
    ? await prisma.processStepExecution.findMany({
        where: { unitId: { in: allUnitIds } },
        select: { unitId: true, result: true, reworkLoopId: true },
      })
    : [];

  const reworkByUnit = new Map<number, boolean>();
  const execByUnit = new Map<number, typeof executions>();
  executions.forEach((e) => {
    if (e.reworkLoopId) reworkByUnit.set(e.unitId, true);
    const arr = execByUnit.get(e.unitId) ?? [];
    arr.push(e);
    execByUnit.set(e.unitId, arr);
  });

  const summaries = lots.map((lot) => {
    const entry = lotUnits.get(lot.id);
    const unitIds = entry?.unitIds ?? [];
    const finals = entry?.finals ?? new Map<number, ExecutionResult | null>();

    let passUnits = 0;
    let scrapUnits = 0;
    let reworkUnits = 0;
    let failureExec = 0;
    let totalExec = 0;

    unitIds.forEach((uid) => {
      const final = finals.get(uid);
      if (final === ER.PASS) passUnits += 1;
      if (final === ER.SCRAP) scrapUnits += 1;
      if (reworkByUnit.get(uid)) reworkUnits += 1;
      const unitExecs = execByUnit.get(uid) ?? [];
      unitExecs.forEach((e) => {
        totalExec += 1;
        if (e.result === ER.FAIL || e.result === ER.SCRAP) failureExec += 1;
      });
    });

    const unitsBuilt = unitIds.length || 1;
    const yieldRatio = passUnits / unitsBuilt;
    const scrapRate = scrapUnits / unitsBuilt;
    const reworkRate = reworkUnits / unitsBuilt;
    const failureRate = totalExec === 0 ? 0 : failureExec / totalExec;
    const health = lotHealth(yieldRatio, scrapRate);

    return { lot, yieldRatio, scrapRate, reworkRate, failureRate, health };
  });

  const byType = new Map<string, { yields: number[]; healths: Health[] }>();
  summaries.forEach((s) => {
    const key = s.lot.componentName ?? "Unspecified";
    const entry = byType.get(key) ?? { yields: [], healths: [] };
    entry.yields.push(s.yieldRatio);
    entry.healths.push(s.health);
    byType.set(key, entry);
  });

  console.log("Lot type health summary:");
  byType.forEach((value, key) => {
    const avgYield = value.yields.reduce((a, b) => a + b, 0) / value.yields.length;
    const health = typeHealth(value.healths);
    const good = value.healths.filter((h) => h === "GOOD").length;
    const warn = value.healths.filter((h) => h === "WARN").length;
    const bad = value.healths.filter((h) => h === "BAD").length;
    console.log(
      `${key}: type=${health}, lots: ${good}G / ${warn}W / ${bad}B, avgYield=${(avgYield * 100).toFixed(2)}%`,
    );
  });
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
