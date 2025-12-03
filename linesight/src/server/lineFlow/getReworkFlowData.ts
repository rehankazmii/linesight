import { prisma } from "@/lib/prisma";
import { ExecutionResult } from "@/generated/prisma/client";

export type SankeyNode = { id: string; label: string };
export type SankeyLink = { source: string; target: string; value: number; kind: "forward" | "rework" | "scrap" };

export type ReworkFlowData = {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalUnits: number;
};

const STEP_LABELS: Record<string, string> = {
  INCOMING_QA: "Incoming QA",
  HOUSING_PREP: "Housing Prep",
  CORE_ASSEMBLY: "Core Assembly",
  DISPLAY_ATTACH: "Display Attach",
  FINAL_CLOSE: "Final Close",
  POWER_ON_TEST: "Power On Test",
  LEAK_TEST: "Leak Test",
  RF_TEST: "RF Test",
  FINAL_FUNCTIONAL: "Final Functional",
  SEAL_REWORK: "Seal Rework",
  RF_DEBUG: "RF Debug",
  SCRAP: "Scrap",
};

const ORDER = [
  "INCOMING_QA",
  "HOUSING_PREP",
  "CORE_ASSEMBLY",
  "DISPLAY_ATTACH",
  "FINAL_CLOSE",
  "POWER_ON_TEST",
  "LEAK_TEST",
  "RF_TEST",
  "FINAL_FUNCTIONAL",
  "SEAL_REWORK",
  "RF_DEBUG",
  "SCRAP",
];

export async function getReworkFlowData(rangeHours: number): Promise<ReworkFlowData> {
  const latest = await prisma.processStepExecution.findFirst({
    orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
    select: { completedAt: true, startedAt: true },
  });
  const anchor = latest?.completedAt ?? latest?.startedAt ?? new Date();
  const windowStart = new Date(anchor.getTime() - rangeHours * 60 * 60 * 1000);

  const execs = await prisma.processStepExecution.findMany({
    where: {
      OR: [
        { startedAt: { gte: windowStart } },
        { completedAt: { gte: windowStart } },
      ],
    },
    select: {
      unitId: true,
      stepDefinition: { select: { code: true } },
      result: true,
      startedAt: true,
      completedAt: true,
      reworkLoopId: true,
    },
  });

  const byUnit = execs.reduce<Map<number, typeof execs>>((map, exec) => {
    const list = map.get(exec.unitId) ?? [];
    list.push(exec);
    map.set(exec.unitId, list);
    return map;
  }, new Map());

  const linkCounts = new Map<string, number>();
  const nodes: SankeyNode[] = ORDER.map((code) => ({ id: code, label: STEP_LABELS[code] ?? code }));

  byUnit.forEach((list) => {
    const sorted = [...list].sort(
      (a, b) =>
        (a.completedAt ?? a.startedAt ?? new Date(0)).getTime() -
        (b.completedAt ?? b.startedAt ?? new Date(0)).getTime(),
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      const src = cur.stepDefinition?.code ?? "UNKNOWN";
      const tgt = next.stepDefinition?.code ?? "UNKNOWN";
      const key = `${src}->${tgt}`;
      const isRework =
        Boolean(cur.reworkLoopId) ||
        Boolean(next.reworkLoopId) ||
        src === tgt ||
        src.includes("REWORK") ||
        tgt.includes("REWORK") ||
        src.includes("DEBUG") ||
        tgt.includes("DEBUG");
      const kind: SankeyLink["kind"] = isRework ? "rework" : "forward";
      const current = linkCounts.get(key) ?? { value: 0, kind };
      linkCounts.set(key, { value: current.value + 1, kind });
    }

    const last = sorted[sorted.length - 1];
    if (last?.result === ExecutionResult.SCRAP) {
      const src = last.stepDefinition?.code ?? "UNKNOWN";
      const key = `${src}->SCRAP`;
      const current = linkCounts.get(key) ?? { value: 0, kind: "scrap" as const };
      linkCounts.set(key, { value: current.value + 1, kind: "scrap" });
    }
  });

  const links: SankeyLink[] = Array.from(linkCounts.entries()).map(([key, entry]) => {
    const [source, target] = key.split("->");
    return { source, target, value: entry.value, kind: entry.kind };
  });

  return { nodes, links, totalUnits: byUnit.size };
}
