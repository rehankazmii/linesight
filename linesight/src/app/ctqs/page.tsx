import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default async function CtqIndexPage() {
  const ctqs = await prisma.cTQDefinition.findMany({
    include: { processStepDefinition: true },
    orderBy: [{ processStepDefinition: { sequence: "asc" } }, { name: "asc" }],
  });

  const grouped = ctqs.reduce<Record<string, typeof ctqs>>((acc, ctq) => {
    const key = ctq.processStepDefinition?.code ?? "OTHER";
    acc[key] = acc[key] ?? [];
    acc[key].push(ctq);
    return acc;
  }, {});

  const stepOrder = Array.from(
    new Set(
      ctqs
        .map((c) => c.processStepDefinition?.sequence ?? 999)
        .sort((a, b) => a - b),
    ),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="CTQs"
        subtitle="Critical-to-quality metrics by station"
        breadcrumbs={[
          { label: "Analyze" },
          { label: "CTQs" },
        ]}
      />
      <Card title="Catalog" subtitle="Select a CTQ to open its dossier">
        {ctqs.length === 0 ? (
          <p className="text-sm text-slate-400">No CTQs defined yet.</p>
        ) : (
          <div className="space-y-4">
            {stepOrder.map((seq) => {
              const stepCtqs = ctqs.filter((c) => (c.processStepDefinition?.sequence ?? 999) === seq);
              if (stepCtqs.length === 0) return null;
              const stepName = stepCtqs[0].processStepDefinition?.name ?? "Step";
              const stepCode = stepCtqs[0].processStepDefinition?.code ?? "STEP";
              return (
                <div key={`${stepCode}-${seq}`} className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                      {stepName}
                    </p>
                    <span className="text-[11px] text-slate-500">{stepCode}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {stepCtqs.map((ctq) => {
                      const spec =
                        ctq.lowerSpecLimit !== null || ctq.upperSpecLimit !== null
                          ? `${ctq.lowerSpecLimit ?? "-"} to ${ctq.upperSpecLimit ?? "-"} ${ctq.units ?? ""}`.trim()
                          : ctq.units ?? "";
                      return (
                        <Link
                          key={ctq.id}
                          href={`/ctqs/${ctq.id}`}
                          className="flex flex-col rounded-xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 transition hover:border-slate-700 hover:bg-slate-900"
                        >
                          <p className="text-sm font-semibold text-slate-50">{ctq.name}</p>
                          <p className="text-xs text-slate-400">
                            {spec || "Spec not set"}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
