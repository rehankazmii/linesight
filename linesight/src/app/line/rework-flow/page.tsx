import Link from "next/link";
import ReworkSankey from "@/components/lineFlow/ReworkSankey";
import { getReworkFlowData } from "@/server/lineFlow/getReworkFlowData";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabBar } from "@/components/ui/TabBar";
import { Card } from "@/components/ui/Card";

type SearchParams = { range?: string; reworkOnly?: string };

const RANGE_OPTIONS = [
  { key: "8h", label: "Last 8h", hours: 8 },
  { key: "24h", label: "Last 24h", hours: 24 },
  { key: "7d", label: "Last 7d", hours: 24 * 7 },
];

export default async function ReworkFlowPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rangeOpt = RANGE_OPTIONS.find((r) => r.key === params.range) ?? RANGE_OPTIONS[1];
  const reworkOnly = params.reworkOnly === "1";
  const data = await getReworkFlowData(rangeOpt.hours);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rework & Scrap Flow"
        subtitle={`Transitions across the 9-step FATP line for ${rangeOpt.label.toLowerCase()}.`}
        breadcrumbs={[
          { label: "Run" },
          { label: "Line" },
          { label: "Rework Flow" },
        ]}
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

      <Card
        title="Filters"
        subtitle="Time window + focus links"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((opt) => {
            const active = opt.key === rangeOpt.key;
            return (
              <Link
                key={opt.key}
                href={`/line/rework-flow?range=${opt.key}${reworkOnly ? "&reworkOnly=1" : ""}`}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-slate-800 text-slate-50"
                    : "bg-slate-900/60 text-slate-200 hover:bg-slate-800/80"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
          <Link
            href={`/line/rework-flow?range=${rangeOpt.key}&reworkOnly=${reworkOnly ? "0" : "1"}`}
            className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-100 shadow-inner shadow-slate-950/30 transition hover:border-slate-600"
          >
            {reworkOnly ? "Show all links" : "Show only rework/scrap"}
          </Link>
        </div>
      </Card>

      <Card title="Flow" subtitle="Each link width ∝ unit count">
        {data.totalUnits < 5 ? (
          <p className="text-sm text-slate-400">Not enough units in this window to plot flow.</p>
        ) : (
          <ReworkSankey nodes={data.nodes} links={data.links} showOnlyRework={reworkOnly} />
        )}
      </Card>
    </div>
  );
}
