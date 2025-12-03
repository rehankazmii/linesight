import { prisma } from "@/lib/prisma";
import { CTQDirection } from "@/generated/prisma/client";

type LotEntry = { id: number; code: string; type: string; supplier: string | null };
type CtqEntry = { id: number; name: string; code: string };

export type LotHeatmapData = {
  lots: LotEntry[];
  ctqs: CtqEntry[];
  matrix: number[][];
  tested: number[][];
  fails: number[][];
};

const isInSpec = (
  value: number,
  direction: CTQDirection,
  lsl: number | null,
  usl: number | null,
) => {
  switch (direction) {
    case CTQDirection.TWO_SIDED:
      return (lsl === null || value >= lsl) && (usl === null || value <= usl);
    case CTQDirection.HIGHER_BETTER:
      return lsl === null ? true : value >= lsl;
    case CTQDirection.LOWER_BETTER:
      return usl === null ? true : value <= usl;
    default:
      return true;
  }
};

export async function getLotHeatmapData(rangeDays: number): Promise<LotHeatmapData> {
  const windowStart = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  // Top lots by measurement volume
  const measurements = await prisma.measurement.findMany({
    where: { recordedAt: { gte: windowStart } },
    include: {
      ctqDefinition: true,
      processStepExecution: {
        include: {
          unit: {
            include: {
              kit: {
                include: {
                  componentLots: { include: { componentLot: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // Lot stats
  const lotStats = new Map<number, { lot: LotEntry; measurements: typeof measurements }>();
  measurements.forEach((m) => {
    const lots = m.processStepExecution?.unit?.kit?.componentLots ?? [];
    lots.forEach((kl) => {
      const lot = kl.componentLot;
      if (!lot) return;
      const entry = lotStats.get(lot.id) ?? {
        lot: { id: lot.id, code: lot.lotNumber, type: lot.componentName, supplier: lot.supplier ?? null },
        measurements: [],
      };
      entry.measurements.push(m);
      lotStats.set(lot.id, entry);
    });
  });

  const lots = Array.from(lotStats.values())
    .sort((a, b) => b.measurements.length - a.measurements.length)
    .slice(0, 30)
    .map((l) => l.lot);

  const lotIds = new Set(lots.map((l) => l.id));
  const filteredMeasurements = measurements.filter((m) => {
    const lots = m.processStepExecution?.unit?.kit?.componentLots ?? [];
    return lots.some((kl) => lotIds.has(kl.componentLot.id));
  });

  // CTQ selection: critical or top by volume
  const ctqCounts = new Map<number, { ctq: CtqEntry; count: number }>();
  filteredMeasurements.forEach((m) => {
    const ctq = m.ctqDefinition;
    if (!ctq) return;
    const entry =
      ctqCounts.get(ctq.id) ??
      {
        ctq: { id: ctq.id, name: ctq.name, code: ctq.code ?? ctq.name },
        count: 0,
      };
    entry.count += 1;
    ctqCounts.set(ctq.id, entry);
  });
  const ctqs = Array.from(ctqCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((c) => c.ctq);

  const ctqIndex = new Map(ctqs.map((c, idx) => [c.id, idx]));
  const lotIndex = new Map(lots.map((l, idx) => [l.id, idx]));

  const tested: number[][] = Array.from({ length: lots.length }, () => Array(ctqs.length).fill(0));
  const fails: number[][] = Array.from({ length: lots.length }, () => Array(ctqs.length).fill(0));

  filteredMeasurements.forEach((m) => {
    const ctq = m.ctqDefinition;
    if (!ctq || !ctqIndex.has(ctq.id)) return;
    const lotIdsForMeas = m.processStepExecution?.unit?.kit?.componentLots?.map((kl) => kl.componentLot.id) ?? [];
    lotIdsForMeas.forEach((lid) => {
      if (!lotIndex.has(lid)) return;
      const li = lotIndex.get(lid)!;
      const ci = ctqIndex.get(ctq.id)!;
      tested[li][ci] += 1;
      const inSpec = isInSpec(m.value, ctq.direction, ctq.lowerSpecLimit, ctq.upperSpecLimit);
      if (!inSpec) fails[li][ci] += 1;
    });
  });

  const matrix = tested.map((row, li) =>
    row.map((testedCount, ci) => (testedCount === 0 ? 0 : fails[li][ci] / testedCount)),
  );

  return { lots, ctqs, matrix, tested, fails };
}
