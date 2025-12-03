import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CTQDirection } from "@/generated/prisma/client";
import HistogramChart from "@/components/ctq/HistogramChart";
import ControlChart from "@/components/ctq/ControlChart";

type SearchParams = { range?: string };

type ModuleBreakdown = {
  key: string;
  failRate: number; // fails/total for that key
  failShare: number; // fails relative to all fails
  fail: number;
  total: number;
};

const RANGE_OPTIONS = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

const formatPercent = (v: number) => `${(v * 100).toFixed(1)}%`;

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

export default async function CtqPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const { range } = await searchParams;
  const rangeOpt = RANGE_OPTIONS.find((r) => r.key === range) ?? RANGE_OPTIONS[0];
  const ctqId = Number(id);
  if (Number.isNaN(ctqId)) {
    return <div className="p-6 text-sm text-slate-300">Invalid CTQ id.</div>;
  }

  const ctq = await prisma.cTQDefinition.findUnique({
    where: { id: ctqId },
    include: { processStepDefinition: true },
  });
  if (!ctq) {
    return <div className="p-6 text-sm text-slate-300">CTQ not found.</div>;
  }

  const latestMeasurement = await prisma.measurement.findFirst({
    where: { ctqDefinitionId: ctqId },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });

  const anchorDate = latestMeasurement?.recordedAt ?? new Date();
  const startDate =
    rangeOpt.days === null ? undefined : new Date(anchorDate.getTime() - rangeOpt.days * 24 * 60 * 60 * 1000);

  const measurements = await prisma.measurement.findMany({
    where: {
      ctqDefinitionId: ctqId,
      ...(startDate ? { recordedAt: { gte: startDate, lte: anchorDate } } : {}),
    },
    include: {
      processStepExecution: {
        include: {
          fixture: true,
          unit: {
            include: {
              kit: {
                include: {
                  componentLots: {
                    include: { componentLot: true },
                  },
                },
              },
            },
          },
          stepDefinition: true,
        },
      },
    },
  });

  const totalMeasurements = measurements.length;
  const fails = measurements.filter((m) =>
    !isInSpec(m.value, ctq.direction, ctq.lowerSpecLimit, ctq.upperSpecLimit),
  ).length;
  const failRate = totalMeasurements === 0 ? 0 : fails / totalMeasurements;

  // Histogram buckets
  const histogram =
    measurements.length < 5
      ? []
      : (() => {
          const values = measurements.map((m) => m.value);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const span = max - min || 1;
          const bins = 10;
          const counts = Array.from({ length: bins }, () => 0);
          values.forEach((v) => {
            const idx = Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
            counts[idx] += 1;
          });
          return counts.map((c, idx) => ({
            label: `${(min + (idx * span) / bins).toFixed(2)}`,
            count: c,
          }));
        })();

  // Control chart by day
  const controlPoints =
    measurements.length < 5
      ? []
      : (() => {
          const byDay = measurements.reduce<Record<string, number[]>>((acc, m) => {
            const d = m.recordedAt ? new Date(m.recordedAt) : new Date();
            const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
            acc[key] = acc[key] || [];
            acc[key].push(m.value);
            return acc;
          }, {});
          return Object.entries(byDay)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([label, vals]) => ({
              label: new Date(label).toLocaleDateString(),
              value: vals.reduce((s, v) => s + v, 0) / vals.length,
            }));
        })();

const relevantComponentsForCtq = (ctqCode: string | null | undefined) => {
  if (!ctqCode) return null;
  const code = ctqCode.toUpperCase();
  if (code.startsWith("INCOMING_BATT") || code.startsWith("BATT_")) return ["Battery"];
  if (code.startsWith("INCOMING_DISPLAY") || code.startsWith("DISPLAY_") || code === "COSMETIC_FINAL_GRADE")
    return ["Display"];
  if (code.startsWith("INCOMING_SIP") || code.startsWith("SIP_")) return ["SiP Module"];
  if (code === "CROWN_TORQUE") return ["Crown Assembly"];
  if (code === "BUTTON_ACT_FORCE") return ["Button Assembly"];
  if (code === "RF_TX_MARGIN") return ["U2", "Antenna Flex"];
  return null; // default: include all lots
};

const aggregateBy = (entries: typeof measurements, kind: "lot" | "fixture" | "station", ctqCode: string | null | undefined): ModuleBreakdown[] => {
    const map: Record<string, { fail: number; total: number }> = {};
    const relevantComponents = relevantComponentsForCtq(ctqCode);
    entries.forEach((m) => {
      const exec = m.processStepExecution;
      const inSpec = isInSpec(m.value, ctq.direction, ctq.lowerSpecLimit, ctq.upperSpecLimit);
      if (kind === "lot") {
        const lots =
          exec?.unit?.kit?.componentLots
            ?.filter((l) => (relevantComponents ? relevantComponents.includes(l.componentLot.componentName) : true))
            .map((l) => l.componentLot.lotNumber ?? "Unknown") ?? ["Unknown"];
        lots.forEach((key) => {
          map[key] = map[key] || { fail: 0, total: 0 };
          map[key].total += 1;
          if (!inSpec) map[key].fail += 1;
        });
      } else {
        let key = "Unknown";
        if (kind === "fixture") key = exec?.fixture?.code ?? "Unknown";
        if (kind === "station") key = exec?.stationCode ?? "Unknown";
        map[key] = map[key] || { fail: 0, total: 0 };
        map[key].total += 1;
        if (!inSpec) map[key].fail += 1;
      }
    });
    const totalFailsAll = Object.values(map).reduce((sum, v) => sum + v.fail, 0);
    return Object.entries(map)
      .filter(([, v]) => v.total > 0)
      .map(([k, v]) => ({
        key: k,
        failRate: v.fail / v.total,
        failShare: totalFailsAll === 0 ? 0 : v.fail / totalFailsAll,
        fail: v.fail,
        total: v.total,
      }))
      .sort((a, b) => b.failRate - a.failRate)
      .slice(0, 5);
  };

  const lotsBreakdown = aggregateBy(measurements, "lot", ctq.code);
  const fixturesBreakdown = aggregateBy(measurements, "fixture", ctq.code);
  const stationsBreakdown = aggregateBy(measurements, "station", ctq.code);

  // Episodes referencing CTQ
  const episodes = await prisma.episode.findMany({
    where: {
      OR: [
        { affectedCtqs: { not: null } },
      ],
    },
    orderBy: { startedAt: "desc" },
  });
  const relatedEpisodes = episodes.filter((ep) => {
    const payload = ep.affectedCtqs;
    if (!payload) return false;
    if (typeof payload === "string") return payload.includes(String(ctqId));
    if (Array.isArray(payload)) return payload.includes(ctqId as any);
    if (typeof payload === "object") {
      return Object.values(payload as any).some((val) => {
        if (Array.isArray(val)) return val.includes(ctqId as any);
        return false;
      });
    }
    return false;
  }).slice(0, 5);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">CTQ dossier</p>
          <h1 className="text-2xl font-semibold text-slate-50">{ctq.name}</h1>
          <p className="text-sm text-slate-300">
            Code {ctq.code ?? "—"} · Step {ctq.processStepDefinition?.name ?? "—"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-200">
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">Units: {ctq.units ?? "—"}</span>
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
              Spec: {ctq.lowerSpecLimit ?? "—"} – {ctq.upperSpecLimit ?? "—"}
            </span>
            {ctq.isCritical ? (
              <span className="rounded-full border border-rose-400/70 bg-rose-500/15 px-3 py-1 text-rose-100">Critical CTQ</span>
            ) : (
              <span className="rounded-full border border-emerald-400/70 bg-emerald-500/15 px-3 py-1 text-emerald-100">Standard CTQ</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((opt) => {
            const active = opt.key === (range ?? "7d");
            return (
              <Link
                key={opt.key}
                href={`/ctqs/${ctqId}?range=${opt.key}`}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  active ? "bg-slate-800 text-slate-50" : "bg-slate-900/50 text-slate-200 hover:bg-slate-800/70"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-50">Value distribution</p>
          <HistogramChart bins={histogram} />
        </div>
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-50">Trend (mean by day)</p>
          <ControlChart points={controlPoints} lsl={ctq.lowerSpecLimit} usl={ctq.upperSpecLimit} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-50">Impact on yield</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-slate-200">
            <div>
              <p className="text-xs text-slate-500">Measurements</p>
              <p className="text-lg font-semibold text-slate-50">{totalMeasurements.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Fail count</p>
              <p className="text-lg font-semibold text-slate-50">{fails.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Fail rate</p>
              <p className="text-lg font-semibold text-slate-50">{formatPercent(failRate)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Range</p>
              <p className="text-lg font-semibold text-slate-50">{rangeOpt.label}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-50">Where it fails</p>
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lots</p>
            {lotsBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500">No lot data.</p>
            ) : (
              lotsBreakdown.map((lot) => (
                <div key={lot.key} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                  <div className="flex flex-col text-sm text-slate-200">
                    <span>{lot.key}</span>
                    <span className="text-[11px] text-slate-500">
                      {lot.fail} fails / {lot.total} measurements
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-semibold text-slate-50">{formatPercent(lot.failRate)}</span>
                    <span className="block text-[11px] text-slate-500">of fails: {formatPercent(lot.failShare)}</span>
                  </div>
                </div>
              ))
            )}
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Fixtures</p>
            {fixturesBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500">No fixture data.</p>
            ) : (
              fixturesBreakdown.map((fx) => (
                <div key={fx.key} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                  <div className="flex flex-col text-sm text-slate-200">
                    <span>{fx.key}</span>
                    <span className="text-[11px] text-slate-500">
                      {fx.fail} fails / {fx.total} measurements
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-semibold text-slate-50">{formatPercent(fx.failRate)}</span>
                    <span className="block text-[11px] text-slate-500">of fails: {formatPercent(fx.failShare)}</span>
                  </div>
                </div>
              ))
            )}
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Stations</p>
            {stationsBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500">No station data.</p>
            ) : (
              stationsBreakdown.map((st) => (
                <div key={st.key} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                  <div className="flex flex-col text-sm text-slate-200">
                    <span>{st.key}</span>
                    <span className="text-[11px] text-slate-500">
                      {st.fail} fails / {st.total} measurements
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-semibold text-slate-50">{formatPercent(st.failRate)}</span>
                    <span className="block text-[11px] text-slate-500">of fails: {formatPercent(st.failShare)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-50">Related episodes</p>
        {relatedEpisodes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No episodes linked to this CTQ.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {relatedEpisodes.map((ep) => (
              <Link
                key={ep.id}
                href={`/episodes/${ep.id}`}
                className="block rounded-lg border border-slate-800 px-3 py-2 hover:border-slate-700"
              >
                <p className="text-sm font-semibold text-slate-50">{ep.title}</p>
                <p className="text-xs text-slate-400">
                  {ep.startedAt ? ep.startedAt.toDateString() : "—"} · {ep.rootCauseCategory}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
