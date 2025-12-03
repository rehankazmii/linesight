import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ExecutionResult, CTQDirection } from "@/generated/prisma/client";
import FpyByStepChart from "@/components/lineHealth/FpyByStepChart";
import ThroughputSparkline from "@/components/lineHealth/ThroughputSparkline";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { MetricTile } from "@/components/ui/MetricTile";
import { TabBar } from "@/components/ui/TabBar";

type StepCode =
  | "INCOMING_QA"
  | "HOUSING_PREP"
  | "CORE_ASSEMBLY"
  | "DISPLAY_ATTACH"
  | "FINAL_CLOSE"
  | "POWER_ON_TEST"
  | "LEAK_TEST"
  | "RF_TEST"
  | "FINAL_FUNCTIONAL";

const NOMINAL_FLOW: StepCode[] = [
  "INCOMING_QA",
  "HOUSING_PREP",
  "CORE_ASSEMBLY",
  "DISPLAY_ATTACH",
  "FINAL_CLOSE",
  "POWER_ON_TEST",
  "LEAK_TEST",
  "RF_TEST",
  "FINAL_FUNCTIONAL",
];

type SearchParams = {
  range?: string;
};

type StepFpy = {
  stepId: number;
  code: string;
  name: string;
  fpy: number;
  unitsReached: number;
  fails: number;
};

type ThroughputPoint = {
  label: string;
  value: number;
};

type DisplayBucket = {
  label: string;
  value: number;
};

type MixStats = {
  totalUnits: number;
  passUnits: number;
  reworkUnits: number;
  scrapUnits: number;
};
const RANGE_OPTIONS = [
  { key: "8h", label: "Last shift (8h)", hours: 8 },
  { key: "24h", label: "Last 24h", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
];

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const isCtqInSpec = (
  value: number,
  direction: CTQDirection,
  lowerSpecLimit: number | null,
  upperSpecLimit: number | null,
) => {
  switch (direction) {
    case CTQDirection.TWO_SIDED:
      return (lowerSpecLimit === null || value >= lowerSpecLimit) && (upperSpecLimit === null || value <= upperSpecLimit);
    case CTQDirection.HIGHER_BETTER:
      return lowerSpecLimit === null ? true : value >= lowerSpecLimit;
    case CTQDirection.LOWER_BETTER:
      return upperSpecLimit === null ? true : value <= upperSpecLimit;
    default:
      return true;
  }
};

export default async function LinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rangeKey = params?.range ?? "24h";
  const range = RANGE_OPTIONS.find((r) => r.key === rangeKey) ?? RANGE_OPTIONS[1];

  const latestExec = await prisma.processStepExecution.findFirst({
    orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
    select: { completedAt: true, startedAt: true },
  });
  const anchor = latestExec?.completedAt ?? latestExec?.startedAt ?? new Date();
  const windowStart = new Date(anchor.getTime() - range.hours * 60 * 60 * 1000);

  const steps = await prisma.processStepDefinition.findMany({
    orderBy: { sequence: "asc" },
  });
  const mainSteps = steps.filter((s) => NOMINAL_FLOW.includes(s.code as StepCode));

  const executions = await prisma.processStepExecution.findMany({
    where: {
      OR: [
        { startedAt: { gte: windowStart } },
        { completedAt: { gte: windowStart } },
      ],
    },
    include: { stepDefinition: true, unit: true },
  });

  const stepFpys: StepFpy[] = mainSteps.map((step) => {
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
          (a.completedAt ?? a.startedAt ?? new Date(0)).getTime() -
          (b.completedAt ?? b.startedAt ?? new Date(0)).getTime(),
      )[0];
      if (earliest?.result === ExecutionResult.PASS && !earliest.reworkLoopId) {
        firstPass += 1;
      }
    });
    const fpy = unitsReached === 0 ? 0 : firstPass / unitsReached;
    const fails = Math.max(0, unitsReached - firstPass);
    return { stepId: step.id, code: step.code, name: step.name, fpy, unitsReached, fails };
  });

  const nonZeroSteps = stepFpys.filter((s) => s.unitsReached > 0);
  const overallRty =
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
  const throughputBuckets: Record<string, number> = {};
  completedExecs.forEach((exec) => {
    const ts = exec.completedAt ?? exec.startedAt ?? new Date();
    const bucket = new Date(ts);
    bucket.setMinutes(0, 0, 0);
    const label = bucket.toISOString();
    throughputBuckets[label] = (throughputBuckets[label] ?? 0) + 1;
  });
  // Build continuous hourly buckets for the full window so we always show the full 8h/24h span
  const throughputPoints: ThroughputPoint[] = (() => {
    const pts: ThroughputPoint[] = [];
    const hours = range.hours;
    const start = new Date(windowStart);
    start.setMinutes(0, 0, 0);
    for (let i = 0; i < hours; i++) {
      const bucketStart = new Date(start.getTime() + i * 60 * 60 * 1000);
      const key = bucketStart.toISOString();
      const val = throughputBuckets[key] ?? 0;
      pts.push({ label: key, value: val });
    }
    return pts;
  })();
  const avgThroughput = range.hours === 0 ? 0 : unitsCompleted / range.hours;

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
  const mixStats: MixStats = {
    totalUnits: windowUnitIds.size,
    passUnits: windowUnitIds.size - scrapUnits.size,
    reworkUnits: reworkUnits.size,
    scrapUnits: scrapUnits.size,
  };

  const displayBuckets: DisplayBucket[] =
    range.hours <= 24
      ? throughputPoints.map((p) => {
          const ts = new Date(p.label);
          const hourLabel = `${ts.getHours().toString().padStart(2, "0")}:00`;
          return { label: hourLabel, value: p.value };
        })
      : Object.entries(
          throughputPoints.reduce<Record<string, number>>((acc, p) => {
            const d = new Date(p.label);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            acc[key] = (acc[key] ?? 0) + p.value;
            return acc;
          }, {}),
        )
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([key, value]) => {
            const [y, m, d] = key.split("-").map((n) => Number(n));
            const label = new Date(y, m, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return { label, value };
          })
          .slice(-7);

  const peakBucket = displayBuckets.reduce(
    (best, curr) => (curr.value > best.value ? curr : best),
    { label: "—", value: 0 },
  );

  // Bottleneck by avg cycle time
  const cycleByStep = steps.map((step) => {
    const stepExecs = executions.filter(
      (e) => e.stepDefinitionId === step.id && e.startedAt && e.completedAt,
    );
    if (stepExecs.length === 0) return { step, avgMs: 0, count: 0 };
    const totalMs = stepExecs.reduce(
      (sum, e) => sum + (e.completedAt!.getTime() - e.startedAt!.getTime()),
      0,
    );
    return { step, avgMs: totalMs / stepExecs.length, count: stepExecs.length };
  });
  const bottleneck = cycleByStep.sort((a, b) => b.avgMs - a.avgMs)[0];

  // CTQ fallout
  const measurements = await prisma.measurement.findMany({
    where: { recordedAt: { gte: windowStart } },
    include: {
      ctqDefinition: {
        include: { processStepDefinition: true },
      },
    },
  });
  const ctqAgg = measurements.reduce<Record<number, { ctqId: number; name: string; step: string; total: number; fail: number }>>(
    (acc, m) => {
      const ctq = m.ctqDefinition;
      if (!ctq) return acc;
      const inSpec = isCtqInSpec(m.value, ctq.direction, ctq.lowerSpecLimit, ctq.upperSpecLimit);
      const current = acc[ctq.id] ?? {
        ctqId: ctq.id,
        name: ctq.name,
        step: ctq.processStepDefinition?.code ?? "STEP",
        total: 0,
        fail: 0,
      };
      current.total += 1;
      if (!inSpec) current.fail += 1;
      acc[ctq.id] = current;
      return acc;
    },
    {},
  );
  const topCtqs = Object.values(ctqAgg)
    .filter((c) => c.total > 0)
    .map((c) => ({ ...c, fallout: c.fail / c.total }))
    .sort((a, b) => b.fallout - a.fallout)
    .slice(0, 3);

  const activeEpisodes = await prisma.episode.findMany({
    where: { status: { in: ["OPEN", "MONITORING"] } },
    orderBy: { startedAt: "desc" },
    take: 5,
  });

  const currentRangeLabel = range.label;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Line Dashboard"
        subtitle="RTY, FPY, throughput, and bottlenecks for Ultra 2 FATP"
        breadcrumbs={[]}
        actions={
          <TabBar
            tabs={[
              { label: "Overview", href: "/line" },
              { label: "Rework Flow", href: "/line/rework-flow" },
              { label: "Trends", href: "/trends" },
            ]}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((opt) => {
          const active = opt.key === rangeKey;
          return (
            <Link
              key={opt.key}
              href={`/line?range=${opt.key}`}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                active ? "bg-slate-800 text-slate-50" : "bg-slate-900/60 text-slate-200 hover:bg-slate-800/70"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricTile label="Overall RTY" value={formatPercent(overallRty)} trend={currentRangeLabel} />
        <MetricTile
          label="Units completed"
          value={unitsCompleted.toLocaleString()}
          trend={`Avg ${avgThroughput.toFixed(1)} / hr`}
        />
        <MetricTile
          label="Bottleneck"
          value={bottleneck?.step?.name ?? "No data"}
          trend={
            bottleneck && bottleneck.avgMs > 0
              ? `${(bottleneck.avgMs / 1000).toFixed(1)}s avg cycle · ${bottleneck.count} execs`
              : "No cycle data"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card title="FPY by step" subtitle="Clickable to station detail" className="h-full">
          <FpyByStepChart data={stepFpys} />
        </Card>

        <Card title="Throughput & Quality mix" subtitle="Completed units and pass/rework/scrap share in this window">
          <div className="space-y-6">
            <div className="space-y-4">
              {displayBuckets.length === 0 ? (
                <p className="text-sm text-slate-400">No completed units in this window.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
                    <span>Units completed</span>
                    <span className="font-semibold text-slate-50">
                      {unitsCompleted.toLocaleString()} · Avg {(unitsCompleted / range.hours).toFixed(1)} / hr
                    </span>
                  </div>
                  <div className="space-y-2">
                    {displayBuckets.map((bucket, idx) => {
                      const maxBucketValue = displayBuckets.length
                        ? Math.max(...displayBuckets.map((p) => p.value))
                        : 1;
                      return (
                        <div key={bucket.label + idx} className="flex items-center gap-3 text-xs text-slate-300">
                          <span className="w-16 text-slate-400">{bucket.label}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-sky-400"
                              style={{
                                width: `${Math.min(100, (bucket.value / Math.max(maxBucketValue, 1)) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="w-12 text-right text-slate-200">{bucket.value}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid gap-3 rounded-xl border border-slate-800/60 bg-slate-900/60 p-3 text-xs text-slate-300 md:grid-cols-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Peak interval</p>
                      <p className="text-sm font-semibold text-slate-50">
                        {peakBucket.label} · {peakBucket.value.toLocaleString()} units
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Recent 3 intervals</p>
                      <p className="text-sm font-semibold text-slate-50">
                        {displayBuckets.slice(-3).reduce((sum, b) => sum + b.value, 0).toLocaleString()} units
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Min interval</p>
                      <p className="text-sm font-semibold text-slate-50">
                        {displayBuckets.reduce((min, b) => (b.value < min.value ? b : min), peakBucket).label} ·{" "}
                        {displayBuckets.reduce((min, b) => (b.value < min.value ? b : min), peakBucket).value.toLocaleString()} units
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Total units seen</span>
                <span className="font-semibold text-slate-50">{mixStats.totalUnits.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Rework involved</span>
                <span className="font-semibold text-amber-200">
                  {mixStats.reworkUnits.toLocaleString()} ({mixStats.totalUnits ? ((mixStats.reworkUnits / mixStats.totalUnits) * 100).toFixed(1) : "0.0"}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Scrap</span>
                <span className="font-semibold text-rose-200">
                  {mixStats.scrapUnits.toLocaleString()} ({mixStats.totalUnits ? ((mixStats.scrapUnits / mixStats.totalUnits) * 100).toFixed(1) : "0.0"}%)
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800 flex">
                <div
                  className="h-full bg-emerald-400"
                  style={{
                    width: `${
                      mixStats.totalUnits === 0
                        ? 0
                        : ((mixStats.passUnits - mixStats.reworkUnits) / mixStats.totalUnits) * 100
                    }%`,
                  }}
                  title="Pass without rework"
                />
                <div
                  className="h-full bg-amber-400"
                  style={{
                    width: `${mixStats.totalUnits === 0 ? 0 : (mixStats.reworkUnits / mixStats.totalUnits) * 100}%`,
                  }}
                  title="Rework units"
                />
                <div
                  className="h-full bg-rose-400"
                  style={{
                    width: `${mixStats.totalUnits === 0 ? 0 : (mixStats.scrapUnits / mixStats.totalUnits) * 100}%`,
                  }}
                  title="Scrap units"
                />
              </div>
              <p className="text-xs text-slate-400">
                Bars are proportional to pass (minus rework), rework, and scrap shares in the selected window.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top CTQs by fallout" subtitle={currentRangeLabel}>
          {topCtqs.length === 0 ? (
            <p className="text-sm text-slate-400">No CTQ measurements in this window.</p>
          ) : (
            <div className="space-y-2">
              {topCtqs.map((ctq) => (
                <Link
                  key={ctq.ctqId}
                  href={`/ctqs/${ctq.ctqId}`}
                  className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-sm transition hover:border-slate-700 hover:bg-slate-900"
                >
                  <div>
                    <p className="font-semibold text-slate-50">
                      {ctq.name} <span className="text-xs text-slate-400">({ctq.step})</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {ctq.fail} fails / {ctq.total} measurements
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-rose-300">
                    {formatPercent(ctq.fallout)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card
          title="Active episodes"
          subtitle="Open or monitoring"
          footer={
            <Link href="/episodes" className="text-sm font-semibold text-slate-200 hover:text-slate-50">
              View all episodes →
            </Link>
          }
        >
          {activeEpisodes.length === 0 ? (
            <p className="text-sm text-slate-400">No active episodes.</p>
          ) : (
            <div className="space-y-2">
              {activeEpisodes.map((ep) => (
                <Link
                  key={ep.id}
                  href={`/episodes/${ep.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-sm transition hover:border-slate-700 hover:bg-slate-900"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-50">{ep.title}</p>
                    <p className="text-xs text-slate-400">
                      {ep.startedAt ? ep.startedAt.toDateString() : "—"} · {ep.status}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {ep.startedAt ? ep.startedAt.toLocaleDateString() : "—"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
