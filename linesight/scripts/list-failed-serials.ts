import { prisma } from "../src/lib/prisma";

async function main() {
  const fails = await prisma.processStepExecution.findMany({
    where: { result: { not: "PASS" } },
    include: { unit: true, stepDefinition: true },
    orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
    take: 200,
  });

  const seen = new Set<string>();
  const samples: { serial: string; step: string; result: string }[] = [];
  fails.forEach((f) => {
    const serial = f.unit?.serial;
    if (!serial || seen.has(serial)) return;
    seen.add(serial);
    samples.push({
      serial,
      step: f.stepDefinition?.code ?? "UNKNOWN",
      result: f.result,
    });
  });

  console.log("Sample units with failures (first 20):");
  samples.slice(0, 20).forEach((s, idx) => {
    console.log(`${idx + 1}. ${s.serial} – ${s.step} (${s.result})`);
  });
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
