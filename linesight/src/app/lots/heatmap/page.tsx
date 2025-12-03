import Link from "next/link";
import LotHeatmap from "@/components/lots/LotHeatmap";
import { getLotHeatmapData } from "@/server/lots/getLotHeatmapData";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

type SearchParams = { range?: string };

const RANGE_OPTIONS = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
];

export default async function LotHeatmapPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rangeOpt = RANGE_OPTIONS.find((r) => r.key === params.range) ?? RANGE_OPTIONS[1];
  const data = await getLotHeatmapData(rangeOpt.days);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lot & Supplier Health Heatmap"
        subtitle={`Failure rate per lot × CTQ for ${rangeOpt.label.toLowerCase()}.`}
        breadcrumbs={[
          { label: "Analyze" },
          { label: "Lots" },
          { label: "Heatmap" },
        ]}
        actions={
          <Link
            href="/lots"
            className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-100 shadow-inner shadow-slate-950/30 hover:border-slate-600"
          >
            Back to lots
          </Link>
        }
      />

      <Card title="Filters">
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((opt) => {
            const active = opt.key === rangeOpt.key;
            return (
              <Link
                key={opt.key}
                href={`/lots/heatmap?range=${opt.key}`}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-slate-800 text-slate-50"
                    : "bg-slate-900/70 text-slate-200 hover:bg-slate-800/70"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </Card>

      <Card title="Lot × CTQ failure rate">
        <LotHeatmap lots={data.lots} ctqs={data.ctqs} matrix={data.matrix} tested={data.tested} fails={data.fails} />
      </Card>
    </div>
  );
}
