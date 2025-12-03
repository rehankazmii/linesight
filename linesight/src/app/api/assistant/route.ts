import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ExecutionResult } from "@/generated/prisma/client";

type AssistantRequest = {
  query: string;
  bucket?: "hour" | "shift" | "day" | "week";
};

type AssistantResponse = {
  answer: string;
};

const formatPercent = (value: number) => {
  const pct = value * 100;
  const digits = Math.abs(pct) < 10 ? 2 : 1;
  return `${pct.toFixed(digits)}%`;
};

const parseWindow = (text: string, fallback: AssistantRequest["bucket"]) => {
  if (text.includes("shift") || text.includes("8h")) return "hour";
  if (text.includes("24") || text.includes("day")) return "shift";
  if (text.includes("7d") || text.includes("week")) return "week";
  if (text.includes("30")) return "week";
  return fallback;
};

const normalize = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildOrigin = (req: NextRequest) => req.nextUrl.origin;

const fetchJson = async <T>(origin: string, path: string): Promise<T | null> => {
  try {
    const res = await fetch(`${origin}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
};

const bulletify = (items: string[]) => items.map((line) => `• ${line}`).join("\n");

const NOMINAL_FLOW = [
  "INCOMING_QA",
  "HOUSING_PREP",
  "CORE_ASSEMBLY",
  "DISPLAY_ATTACH",
  "FINAL_CLOSE",
  "POWER_ON_TEST",
  "LEAK_TEST",
  "RF_TEST",
  "FINAL_FUNCTIONAL",
] as const;

async function computeLineSnapshot(hours: number) {
  const latestExec = await prisma.processStepExecution.findFirst({
    orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
    select: { completedAt: true, startedAt: true },
  });
  const anchor = latestExec?.completedAt ?? latestExec?.startedAt ?? new Date();
  const windowStart = new Date(anchor.getTime() - hours * 60 * 60 * 1000);

  const steps = await prisma.processStepDefinition.findMany({ orderBy: { sequence: "asc" } });
  const mainSteps = steps.filter((s) => NOMINAL_FLOW.includes(s.code as (typeof NOMINAL_FLOW)[number]));

  const executions = await prisma.processStepExecution.findMany({
    where: {
      OR: [
        { startedAt: { gte: windowStart } },
        { completedAt: { gte: windowStart } },
      ],
    },
    include: { stepDefinition: true, unit: true },
  });

  const unitGroups = executions.reduce<Map<number, typeof executions>>((map, exec) => {
    const list = map.get(exec.unitId) ?? [];
    list.push(exec);
    map.set(exec.unitId, list);
    return map;
  }, new Map());

  const stepFpys = mainSteps.map((step) => {
    const stepExecs = executions.filter((e) => e.stepDefinitionId === step.id);
    const byUnit = stepExecs.reduce<Map<number, typeof stepExecs>>((map, exec) => {
      const list = map.get(exec.unitId) ?? [];
      list.push(exec);
      map.set(exec.unitId, list);
      return map;
    }, new Map());
    let unitsReached = byUnit.size;
    let firstPass = 0;
    byUnit.forEach((list) => {
      const earliest = [...list].sort(
        (a, b) =>
          ((a.completedAt ?? a.startedAt ?? new Date(0)).getTime()) -
          ((b.completedAt ?? b.startedAt ?? new Date(0)).getTime()),
      )[0];
      if (earliest?.result === ExecutionResult.PASS && !earliest.reworkLoopId) {
        firstPass += 1;
      }
    });
    const fpy = unitsReached === 0 ? 0 : firstPass / unitsReached;
    return { fpy, unitsReached };
  });

  const nonZeroSteps = stepFpys.filter((s) => s.unitsReached > 0);
  const rty =
    nonZeroSteps.length === 0
      ? 0
      : nonZeroSteps.reduce((prod, step) => (prod === 0 ? step.fpy : prod * step.fpy), 0);

  const finalStepId =
    steps.find((s) => s.code === "FINAL_FUNCTIONAL")?.id ??
    mainSteps[mainSteps.length - 1]?.id ??
    null;

  const completedExecs =
    finalStepId === null
      ? []
      : executions.filter(
          (e) =>
            e.stepDefinitionId === finalStepId &&
            e.result === ExecutionResult.PASS &&
            e.completedAt &&
            e.completedAt >= windowStart &&
            e.completedAt <= anchor,
        );

  const unitsCompleted = new Set(completedExecs.map((e) => e.unitId)).size;
  const avgThroughput = hours === 0 ? 0 : unitsCompleted / hours;

  const windowUnitIds = new Set(executions.map((e) => e.unitId));
  const reworkUnits = new Set<number>();
  const scrapUnits = new Set<number>();
  const lastResultByUnit = new Map<number, ExecutionResult>();
  executions.forEach((exec) => {
    if (exec.reworkLoopId) reworkUnits.add(exec.unitId);
    const ts = (exec.completedAt ?? exec.startedAt ?? new Date(0)).getTime();
    const prev = lastResultByUnit.get(exec.unitId);
    if (!prev || ts >= (exec.completedAt ?? exec.startedAt ?? new Date(0)).getTime()) {
      lastResultByUnit.set(exec.unitId, exec.result);
    }
  });
  lastResultByUnit.forEach((result, unitId) => {
    if (result === ExecutionResult.SCRAP) scrapUnits.add(unitId);
  });

  const lineFpy =
    nonZeroSteps.length === 0
      ? 0
      : nonZeroSteps.reduce((prod, step) => (prod === 0 ? step.fpy : prod * step.fpy), 0);
  const reworkRate = windowUnitIds.size === 0 ? 0 : reworkUnits.size / windowUnitIds.size;
  const scrapRate = windowUnitIds.size === 0 ? 0 : scrapUnits.size / windowUnitIds.size;

  return { lineFpy, rty, reworkRate, scrapRate, throughput: unitsCompleted, avgThroughput };
}

export async function POST(request: NextRequest) {
  let body: AssistantRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawQuery = body.query ?? "";
  const normalized = normalize(rawQuery);
  const bucket = parseWindow(normalized, body.bucket ?? "day");
  const origin = buildOrigin(request);

  if (!normalized) {
    return NextResponse.json(
      {
        answer:
          "Ask me about line health (RTY/FPY), stations, CTQs, lots/fixtures, episodes, units, or trends.",
      } satisfies AssistantResponse,
    );
  }

  // Line metrics intent
  if (normalized.includes("rty") || normalized.includes("fpy") || normalized.includes("yield") || normalized.includes("line health")) {
    const hours = bucket === "hour" ? 8 : bucket === "week" ? 24 * 7 : 24;
    const snap = await computeLineSnapshot(hours);
    const label = hours === 8 ? "last 8h" : hours === 24 ? "last 24h" : "last 7d";
    const answer = bulletify([
      `Window: ${label}`,
      `RTY ${formatPercent(snap.rty)}; Line FPY ${formatPercent(snap.lineFpy)}`,
      `Rework ${formatPercent(snap.reworkRate)}; Scrap ${formatPercent(snap.scrapRate)}`,
      `Throughput ${snap.throughput} units (${snap.avgThroughput.toFixed(1)}/h)`,
      `Open /line?range=${hours === 8 ? "8h" : hours === 24 ? "24h" : "7d"}`,
    ]);
    return NextResponse.json({ answer } satisfies AssistantResponse);
  }

  // Station health intent
  if (normalized.includes("station") || normalized.includes("bottleneck")) {
    const window =
      bucket === "hour" ? "last8h" : bucket === "shift" ? "last24h" : bucket === "week" ? "last7d" : "last24h";
    const data = await fetchJson<{
      stations: { code: string; name: string; fpy: number; reworkRate: number; scrapRate: number; throughput: number }[];
    }>(origin, `/api/metrics/stations?window=${window}`);
    if (data?.stations?.length) {
      const worst = [...data.stations].sort((a, b) => a.fpy - b.fpy)[0];
      const topThroughput = [...data.stations].sort((a, b) => b.throughput - a.throughput)[0];
      const answer = bulletify([
        `Window: ${window}`,
        `Worst FPY: ${worst.code} (${formatPercent(worst.fpy)})`,
        `Rework ${formatPercent(worst.reworkRate)}; Scrap ${formatPercent(worst.scrapRate)}`,
        `Highest throughput: ${topThroughput.code} (${topThroughput.throughput} units)`,
        `See /stations`,
      ]);
      return NextResponse.json({ answer } satisfies AssistantResponse);
    }
  }

  // Units intent
  const serialMatch = normalized.match(/(ul2-\d{5,})/i);
  if (normalized.includes("unit") || normalized.includes("serial") || serialMatch) {
    const serial = serialMatch ? serialMatch[1].toUpperCase() : normalized.split(" ").find((t) => t.includes("-"));
    if (serial) {
      const data = await fetchJson<{ unit?: { serial: string; finalResult?: string }; steps?: { stepCode: string; result: string }[] }>(
        origin,
        `/api/units/${encodeURIComponent(serial)}`,
      );
      if (data?.unit) {
        const lastStep = data.steps?.[data.steps.length - 1];
        const answer = bulletify([
          `Unit ${data.unit.serial}`,
          `Final result: ${data.unit.finalResult ?? "unknown"}`,
          lastStep ? `Last step: ${lastStep.stepCode} (${lastStep.result})` : "No step data",
          `Open /units?serial=${encodeURIComponent(serial)} for full trace.`,
        ]);
        return NextResponse.json({ answer } satisfies AssistantResponse);
      }
    }
  }

  // CTQ intent
  if (normalized.includes("ctq") || normalized.includes("leak") || normalized.includes("torque")) {
    const term = normalized.replace("ctq", "").trim();
    const ctq = await prisma.cTQDefinition.findFirst({
      where: term ? { name: { contains: term } } : {},
      include: { processStepDefinition: true },
    });
    if (ctq) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const measurements = await prisma.measurement.findMany({
        where: { ctqDefinitionId: ctq.id, recordedAt: { gte: since } },
        include: { ctqDefinition: true },
      });
      const total = measurements.length;
      const fails = measurements.filter((m) =>
        m.ctqDefinition
          ? !(
              (m.ctqDefinition.lowerSpecLimit === null || m.value >= m.ctqDefinition.lowerSpecLimit!) &&
              (m.ctqDefinition.upperSpecLimit === null || m.value <= m.ctqDefinition.upperSpecLimit!)
            )
          : false,
      ).length;
      const answer = bulletify([
        `${ctq.name} (${ctq.processStepDefinition.code})`,
        `Spec: ${ctq.lowerSpecLimit ?? "-"} – ${ctq.upperSpecLimit ?? "-"} ${ctq.units ?? ""}`,
        `Fail rate (last 7d): ${formatPercent(total === 0 ? 0 : fails / total)} (${fails}/${total})`,
        `View /ctqs/${ctq.id}`,
      ]);
      return NextResponse.json({ answer } satisfies AssistantResponse);
    }
  }

  // Lots intent
  if (normalized.includes("lot")) {
    const data = await fetchJson<{ lots: { code: string; yield: number; scrapRate: number; health: string }[] }>(origin, "/api/lots");
    if (data?.lots?.length) {
      const sorted = [...data.lots].sort((a, b) => a.yield - b.yield).slice(0, 3);
      const answer = bulletify([
        "Lots with issues:",
        ...sorted.map((l) => `${l.code}: yield ${formatPercent(l.yield)}, scrap ${formatPercent(l.scrapRate)} (${l.health})`),
        "See /lots",
      ]);
      return NextResponse.json({ answer } satisfies AssistantResponse);
    }
  }

  // Fixtures intent
  if (normalized.includes("fixture")) {
    const data = await fetchJson<{ fixtures: { code: string; failureRate: number; health: string; stationCode: string }[] }>(
      origin,
      "/api/fixtures",
    );
    if (data?.fixtures?.length) {
      const worst = [...data.fixtures].sort((a, b) => b.failureRate - a.failureRate).slice(0, 3);
      const answer = bulletify([
        "Fixtures with higher failure:",
        ...worst.map((f) => `${f.code} @ ${f.stationCode}: fail ${formatPercent(f.failureRate)} (${f.health})`),
        "See /fixtures",
      ]);
      return NextResponse.json({ answer } satisfies AssistantResponse);
    }
  }

  // Episodes intent
  if (normalized.includes("episode") || normalized.includes("incident") || normalized.includes("rca")) {
    const search = normalized.replace(/episode(s)?/g, "").trim();
    const episodes = await prisma.episode.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search } },
              { summary: { contains: search } },
            ],
          }
        : {},
      orderBy: [{ startedAt: "desc" }],
      take: 3,
    });

    if (episodes.length === 0) {
      return NextResponse.json({
        answer: `No episodes found${search ? ` for "${search}"` : ""}.`,
      } satisfies AssistantResponse);
    }

    const lines = episodes.map(
      (ep) =>
        `${ep.title} (${ep.status}, ${ep.rootCauseCategory}${ep.effectivenessTag ? `, ${ep.effectivenessTag}` : ""}) – /episodes/${ep.id}`,
    );

    return NextResponse.json({
      answer: bulletify(lines),
    } satisfies AssistantResponse);
  }

  // Trends intent
  if (normalized.includes("trend") || normalized.includes("scenario")) {
    const data = await fetchJson<{ scenarios: { title: string; severity: string; summary: string }[] }>(
      origin,
      "/api/metrics/trends",
    );
    if (data?.scenarios) {
      if (data.scenarios.length === 0) {
        return NextResponse.json({ answer: "No active scenarios detected." } satisfies AssistantResponse);
      }
      const lines = data.scenarios.slice(0, 3).map((s) => `${s.title} (${s.severity}) – ${s.summary}`);
      return NextResponse.json({ answer: bulletify(lines) } satisfies AssistantResponse);
    }
  }

  // Glossary intent
  if (normalized.includes("what is fpy") || normalized.includes("define fpy")) {
    return NextResponse.json({
      answer:
        "FPY (First Pass Yield) = units that pass all required steps on their first attempt without any rework loops, divided by units entering the flow.",
    } satisfies AssistantResponse);
  }
  if (normalized.includes("what is rty") || normalized.includes("define rty")) {
    return NextResponse.json({
      answer:
        "RTY (Rolled Throughput Yield) = the product of per-step FPYs along the nominal flow. It captures compounded yield losses across the line.",
    } satisfies AssistantResponse);
  }

  return NextResponse.json({
    answer:
      "I can help with line health, stations, CTQs, lots/fixtures, episodes, units, and trends. Try: “worst station last 24h” or “lots at risk”.",
  } satisfies AssistantResponse);
}
