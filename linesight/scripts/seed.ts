/**
 * LineSight synthetic data seed
 * ------------------------------------------
 * Generates a rich, deterministic dataset covering:
 * - 90 days of production
 * - 2 lines (A, B), ~200 units per line per day (~24k units total)
 * - Full 9-step FATP flow with rework loops (leak, RF, final functional)
 * - Component lots, kits, fixtures, CTQs + measurements
 * - Documented episodes/RCA windows
 * - Data-quality edge cases (duplicates, missing measurements, out-of-order)
 *
 * Run with:
 *   npx ts-node scripts/seed.ts
 *
 * Tune volume via MAIN_PARAMS at the top if SQLite performance is slow.
 */

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient, Prisma, $Enums } from "../src/generated/prisma";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

const {
  StepType,
  ExecutionResult,
  CTQDirection,
  EpisodeStatus,
  RootCauseCategory,
  EffectivenessTag,
} = $Enums;

// -----------------------------
// Main tunables
// -----------------------------
const MAIN_PARAMS = {
  days: 90,
  unitsPerLinePerDay: 150,
  lines: ["Line A", "Line B"],
  seed: Number(process.env.SEED_RANDOM_SEED ?? 424242),
  maxBatch: 5000, // createMany batch size for executions/measurements
  skipRate: 0.02, // % of units skipping a step (data quality)
  outOfOrderRate: 0.02, // % of executions with slight timestamp swap
  missingMeasurementRate: 0.02, // % of executions missing a critical CTQ measurement
  duplicateSerialCount: 5, // number of duplicate serials to inject
};

// -----------------------------
// Deterministic PRNG
// -----------------------------
function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}
const rand = createSeededRandom(MAIN_PARAMS.seed);
const randBetween = (min: number, max: number) => rand() * (max - min) + min;
const randInt = (min: number, max: number) =>
  Math.floor(randBetween(min, max + 1));
const choice = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)];

const addMinutes = (d: Date, mins: number) =>
  new Date(d.getTime() + mins * 60 * 1000);

const isCtqOutOfSpec = (
  value: number,
  direction: $Enums.CTQDirection,
  lsl: number | null,
  usl: number | null,
) => {
  switch (direction) {
    case CTQDirection.TWO_SIDED:
      return (lsl !== null && value < lsl) || (usl !== null && value > usl);
    case CTQDirection.HIGHER_BETTER:
      return lsl !== null && value < lsl;
    case CTQDirection.LOWER_BETTER:
      return usl !== null && value > usl;
    default:
      return false;
  }
};

// -----------------------------
// Canonical steps and CTQs
// -----------------------------
type StepCode =
  | "INCOMING_QA"
  | "HOUSING_PREP"
  | "CORE_ASSEMBLY"
  | "DISPLAY_ATTACH"
  | "FINAL_CLOSE"
  | "POWER_ON_TEST"
  | "LEAK_TEST"
  | "RF_TEST"
  | "FINAL_FUNCTIONAL"
  | "SEAL_REWORK"
  | "RF_DEBUG";

const nominalFlow: StepCode[] = [
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

const stepDefinitions: Array<{
  id: number;
  code: StepCode;
  name: string;
  sequence: number;
  stepType: $Enums.StepType;
  canScrap: boolean;
}> = [
  { id: 1, code: "INCOMING_QA", name: "Incoming QA & Kitting", sequence: 1, stepType: StepType.ASSEMBLY, canScrap: false },
  { id: 2, code: "HOUSING_PREP", name: "Housing / mechanical prep", sequence: 2, stepType: StepType.ASSEMBLY, canScrap: false },
  { id: 3, code: "CORE_ASSEMBLY", name: "Core module assembly", sequence: 3, stepType: StepType.ASSEMBLY, canScrap: false },
  { id: 4, code: "DISPLAY_ATTACH", name: "Display attach & seal", sequence: 4, stepType: StepType.ASSEMBLY, canScrap: false },
  { id: 5, code: "FINAL_CLOSE", name: "Final assembly & close", sequence: 5, stepType: StepType.ASSEMBLY, canScrap: false },
  { id: 6, code: "POWER_ON_TEST", name: "Initial power-on & functional test", sequence: 6, stepType: StepType.TEST, canScrap: true },
  { id: 7, code: "LEAK_TEST", name: "Leak test", sequence: 7, stepType: StepType.TEST, canScrap: true },
  { id: 8, code: "RF_TEST", name: "RF / wireless test", sequence: 8, stepType: StepType.TEST, canScrap: true },
  { id: 9, code: "FINAL_FUNCTIONAL", name: "Final functional + cosmetic / pack-out", sequence: 9, stepType: StepType.INSPECTION, canScrap: true },
  { id: 10, code: "SEAL_REWORK", name: "Seal rework & reseal", sequence: 10, stepType: StepType.DEBUG, canScrap: false },
  { id: 11, code: "RF_DEBUG", name: "RF debug & calibration", sequence: 11, stepType: StepType.DEBUG, canScrap: false },
];

const ctqDefs = [
  // Incoming QA
  { code: "INCOMING_SIP_FUNC_PASS", name: "SiP functional self-test pass rate", step: "INCOMING_QA", units: "%", lsl: 95, usl: 100, target: 99, critical: true, dir: CTQDirection.HIGHER_BETTER },
  { code: "INCOMING_DISPLAY_FUNC_PASS", name: "Display module self-test pass rate", step: "INCOMING_QA", units: "%", lsl: 95, usl: 100, target: 99, critical: true, dir: CTQDirection.HIGHER_BETTER },
  { code: "INCOMING_BATT_OCV", name: "Battery open-circuit voltage", step: "INCOMING_QA", units: "V", lsl: 3.75, usl: 4.2, target: 4.0, critical: true, dir: CTQDirection.TWO_SIDED },
  // Housing prep
  { code: "CROWN_TORQUE", name: "Digital Crown torque", step: "HOUSING_PREP", units: "mN·m", lsl: 30, usl: 60, target: 45, critical: true, dir: CTQDirection.TWO_SIDED },
  { code: "BUTTON_ACT_FORCE", name: "Button actuation force", step: "HOUSING_PREP", units: "N", lsl: 2, usl: 4, target: 3, critical: true, dir: CTQDirection.TWO_SIDED },
  // Core assembly
  { code: "SIP_SCREW_TORQUE", name: "SiP screw torque", step: "CORE_ASSEMBLY", units: "mN·m", lsl: 10, usl: 14, target: 12, critical: true, dir: CTQDirection.TWO_SIDED },
  { code: "SPEAKER_CONTINUITY", name: "Speaker continuity", step: "CORE_ASSEMBLY", units: "Ω", lsl: 0, usl: 2, target: 1, critical: true, dir: CTQDirection.LOWER_BETTER },
  // Display attach
  { code: "DISPLAY_GAP_PLANARITY", name: "Display gap / planarity", step: "DISPLAY_ATTACH", units: "µm", lsl: 0, usl: 120, target: 80, critical: true, dir: CTQDirection.LOWER_BETTER },
  { code: "TOUCH_FUNC_PASS", name: "Display/touch functional pass rate", step: "DISPLAY_ATTACH", units: "%", lsl: 95, usl: 100, target: 99, critical: true, dir: CTQDirection.HIGHER_BETTER },
  // Power-on & tests
  { code: "BATT_IR", name: "Battery internal resistance", step: "POWER_ON_TEST", units: "mΩ", lsl: 0, usl: 140, target: 110, critical: true, dir: CTQDirection.LOWER_BETTER },
  { code: "LEAK_INDEX", name: "Leak index", step: "LEAK_TEST", units: "Pa", lsl: 0, usl: 80, target: 40, critical: true, dir: CTQDirection.LOWER_BETTER },
  { code: "RF_TX_MARGIN", name: "RF conducted power margin", step: "RF_TEST", units: "dB", lsl: 2, usl: 8, target: 5, critical: true, dir: CTQDirection.TWO_SIDED },
  // Final
  { code: "COSMETIC_FINAL_GRADE", name: "Final cosmetic grade", step: "FINAL_FUNCTIONAL", units: "0-10", lsl: 8, usl: 10, target: 9, critical: true, dir: CTQDirection.HIGHER_BETTER },
];

// Station codes per step
const stationCodeMap: Record<StepCode, string> = {
  INCOMING_QA: "ST-INCOMING",
  HOUSING_PREP: "ST-HOUSING",
  CORE_ASSEMBLY: "ST-CORE",
  DISPLAY_ATTACH: "ST-DISPLAY",
  FINAL_CLOSE: "ST-FINAL",
  POWER_ON_TEST: "ST-POWER",
  LEAK_TEST: "ST-LEAK",
  RF_TEST: "ST-RF",
  FINAL_FUNCTIONAL: "ST-PACKOUT",
  SEAL_REWORK: "ST-SEAL-REWORK",
  RF_DEBUG: "ST-RF-DEBUG",
};

// Fixture templates per step
const fixtureTemplates: Record<StepCode, string[]> = {
  INCOMING_QA: ["IQC-A1", "IQC-A2", "IQC-B1", "IQC-B2"],
  HOUSING_PREP: ["TORQUE-1", "TORQUE-2", "TORQUE-3", "TORQUE-4"],
  CORE_ASSEMBLY: ["CORE-ALIGN-1", "CORE-ALIGN-2", "CORE-ALIGN-3"],
  DISPLAY_ATTACH: ["DSP-ALIGN-1", "DSP-ALIGN-2", "DSP-ALIGN-3"],
  FINAL_CLOSE: ["FINAL-CLAMP-1", "FINAL-CLAMP-2"],
  POWER_ON_TEST: ["PWR-01", "PWR-02", "PWR-03"],
  LEAK_TEST: ["LEAK-CH-1", "LEAK-CH-2", "LEAK-CH-3", "LEAK-CH-4"],
  RF_TEST: ["RF-01", "RF-02", "RF-03", "RF-04"],
  FINAL_FUNCTIONAL: ["FINAL-FUNC-1", "FINAL-FUNC-2"],
  SEAL_REWORK: ["RESEAL-1", "RESEAL-2"],
  RF_DEBUG: ["RF-DBG-1", "RF-DBG-2"],
};

// Component lots
type LotSpec = { lotNumber: string; componentName: string; supplier?: string; receivedAt?: Date };
const lotSpecs: LotSpec[] = [];
const suppliers = ["ATL", "Sunwoda", "Luxshare", "Foxconn"];
const riskComponents = new Set(["Battery", "Display", "SiP Module", "Battery", "Button Assembly"]);
const lotCategory = (lotNumber: string, componentName?: string): "GOOD" | "WARN" | "BAD" => {
  if (componentName && !riskComponents.has(componentName)) return "GOOD";
  const suffix = parseInt(lotNumber.slice(-2), 10);
  if (suffix === 5) return "BAD";
  if (suffix === 4) return "WARN";
  return "GOOD";
};
const addLots = (prefix: string, component: string, count: number) => {
  for (let i = 1; i <= count; i++) {
    lotSpecs.push({
      lotNumber: `${prefix}-${2400 + i}-${String(i).padStart(2, "0")}`,
      componentName: component,
      supplier: choice(suppliers),
      receivedAt: new Date(Date.now() - randInt(40, 80) * 24 * 60 * 60 * 1000),
    });
  }
};
addLots("BAT", "Battery", 12);
addLots("DSP", "Display", 10);
addLots("SIP", "SiP Module", 8);
addLots("U2", "U2", 6);
addLots("ANT", "Antenna Flex", 8);
addLots("HSN", "Rear Sensor", 8);
addLots("COIL", "Charging Coil", 6);
addLots("BTN", "Button Assembly", 8);
addLots("CRWN", "Crown Assembly", 6);
// Inconsistent supplier fields for data-quality signals
lotSpecs.slice(0, 3).forEach((lot, idx) => {
  if (idx % 2 === 0) lot.supplier = undefined;
});

// -----------------------------
// Episodes (RCA windows)
// -----------------------------
type EpisodeContext = {
  title: string;
  summary: string;
  category: $Enums.RootCauseCategory;
  status: $Enums.EpisodeStatus;
  effectiveness: $Enums.EffectivenessTag;
  startDayOffset: number; // days after baseStart
  durationDays: number;
  affectedSteps: StepCode[];
  affectedCtqs: string[];
  affectedLots: string[];
  affectedFixtures: string[];
  impact: {
    leakFailDelta?: number;
    rfFailDelta?: number;
    displayDrift?: number;
    assemblyFailDelta?: number;
  };
};

const episodes: EpisodeContext[] = [
  {
    title: "Display gap drift – Line B fixture",
    summary: "DSP-ALIGN-2 mis-calibrated; display gap creeping toward USL on Line B.",
    category: RootCauseCategory.FIXTURE,
    status: EpisodeStatus.CLOSED,
    effectiveness: EffectivenessTag.EFFECTIVE,
    startDayOffset: 55,
    durationDays: 4,
    affectedSteps: ["DISPLAY_ATTACH"],
    affectedCtqs: ["DISPLAY_GAP_PLANARITY"],
    affectedLots: ["DSP-2404-04", "DSP-2410-10"],
    affectedFixtures: ["DSP-ALIGN-2"],
    impact: { displayDrift: 20 },
  },
];

// -----------------------------
// Helpers: apply episodes / CTQ gen
// -----------------------------
const findEpisodeImpact = (dayIndex: number, line: string, lotCodes: string[], fixtureCode?: string, step?: StepCode) => {
  let leakDelta = 0;
  let rfDelta = 0;
  let displayDrift = 0;
  let assemblyDelta = 0;
  const fixtureBase = fixtureCode ? fixtureCode.replace(/-(A|B)$/, "") : undefined;
  episodes.forEach((ep) => {
    const within = dayIndex >= ep.startDayOffset && dayIndex < ep.startDayOffset + ep.durationDays;
    if (!within) return;
    if (
      ep.affectedSteps.includes(step ?? ("INCOMING_QA" as StepCode)) ||
      ep.affectedLots.some((l) => lotCodes.includes(l)) ||
      (fixtureBase && ep.affectedFixtures.includes(fixtureBase))
    ) {
      leakDelta += ep.impact.leakFailDelta ?? 0;
      rfDelta += ep.impact.rfFailDelta ?? 0;
      displayDrift += ep.impact.displayDrift ?? 0;
      assemblyDelta += ep.impact.assemblyFailDelta ?? 0;
    }
  });
  return { leakDelta, rfDelta, displayDrift, assemblyDelta };
};

const inSpec = (value: number, ctq: typeof ctqDefs[number]) => {
  if (ctq.dir === CTQDirection.TWO_SIDED) {
    return (ctq.lsl == null || value >= ctq.lsl) && (ctq.usl == null || value <= ctq.usl);
  }
  if (ctq.dir === CTQDirection.HIGHER_BETTER) {
    return ctq.lsl == null || value >= ctq.lsl;
  }
  if (ctq.dir === CTQDirection.LOWER_BETTER) {
    return ctq.usl == null || value <= ctq.usl;
  }
  return true;
};

const ctqByCode = new Map(ctqDefs.map((c) => [c.code, c]));

// -----------------------------
// Clear DB
// -----------------------------
async function clearData() {
  await prisma.measurement.deleteMany();
  await prisma.processStepExecution.deleteMany();
  await prisma.episode.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.kitComponentLot.deleteMany();
  await prisma.kit.deleteMany();
  await prisma.componentLot.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.cTQDefinition.deleteMany();
  await prisma.processStepDefinition.deleteMany();
  await prisma.$executeRawUnsafe(
    "DELETE FROM sqlite_sequence WHERE name IN ('Unit','Kit','ComponentLot','ProcessStepDefinition','ProcessStepExecution','CTQDefinition','Measurement','Fixture','Episode')",
  );
}

// -----------------------------
// Seed reference data
// -----------------------------
async function seedProcessSteps() {
  await prisma.processStepDefinition.createMany({ data: stepDefinitions });
  // Rework links
  await prisma.processStepDefinition.update({
    where: { code: "LEAK_TEST" },
    data: { reworkTargets: { connect: [{ code: "SEAL_REWORK" }] } },
  });
  await prisma.processStepDefinition.update({
    where: { code: "RF_TEST" },
    data: { reworkTargets: { connect: [{ code: "RF_DEBUG" }] } },
  });
}

async function seedCtqs() {
  const ctqInputs = ctqDefs.map((c, idx) => ({
    id: idx + 1,
    code: c.code,
    name: c.name,
    units: c.units,
    lowerSpecLimit: c.lsl,
    upperSpecLimit: c.usl,
    target: c.target,
    isCritical: c.critical,
    direction: c.dir,
    processStepDefinitionId:
      stepDefinitions.find((s) => s.code === c.step)?.id ?? 1,
  }));
  await prisma.cTQDefinition.createMany({ data: ctqInputs });
}

const fixtureCodeToId = new Map<string, number>();

async function seedFixtures() {
  const fixtures: Prisma.FixtureCreateManyInput[] = [];
  let id = 1;
  MAIN_PARAMS.lines.forEach((line) => {
    stepDefinitions.forEach((step) => {
      (fixtureTemplates[step.code] ?? []).forEach((code) => {
        const fullCode = `${code}-${line === "Line A" ? "A" : "B"}`;
        fixtures.push({
          id: id++,
          code: fullCode,
          fixtureType: step.code,
          stationCode: stationCodeMap[step.code],
          status: "ACTIVE",
          lastCalibratedAt: new Date(Date.now() - randInt(5, 20) * 24 * 60 * 60 * 1000),
          calibrationDueAt: new Date(Date.now() + randInt(10, 30) * 24 * 60 * 60 * 1000),
        });
        fixtureCodeToId.set(fullCode, id - 1);
      });
    });
  });
  await prisma.fixture.createMany({ data: fixtures });
}

async function seedComponentLots() {
  await prisma.componentLot.createMany({ data: lotSpecs });
}

// -----------------------------
// Build production data
// -----------------------------
type ExecInput = Prisma.ProcessStepExecutionCreateManyInput;
type MeasInput = Prisma.MeasurementCreateManyInput;
type KitInput = Prisma.KitCreateManyInput;
type UnitInput = Prisma.UnitCreateManyInput;
type KitLotInput = Prisma.KitComponentLotCreateManyInput;

const stepIdByCode = new Map(stepDefinitions.map((s) => [s.code, s.id]));
const ctqIdByCode = new Map(ctqDefs.map((c, idx) => [c.code, idx + 1]));

const baseStart = new Date();
baseStart.setHours(8, 0, 0, 0);
baseStart.setDate(baseStart.getDate() - MAIN_PARAMS.days);

const operatorPool = ["op-a", "op-b", "op-c", "op-d", "op-e"];

function pickFixture(step: StepCode, line: string) {
  const list = fixtureTemplates[step] ?? [];
  if (list.length === 0) return undefined;
  const code = choice(list);
  return `${code}-${line === "Line A" ? "A" : "B"}`;
}

function measurementForCtq(
  ctq: typeof ctqDefs[number],
  baseMean: number,
  sigma: number,
  failBias: boolean,
) {
  let value = randBetween(baseMean - sigma, baseMean + sigma);
  if (failBias) {
    if (ctq.dir === CTQDirection.LOWER_BETTER || ctq.dir === CTQDirection.TWO_SIDED) {
      value = (ctq.usl ?? baseMean + sigma) + randBetween(1, sigma * 1.5);
    } else {
      value = (ctq.lsl ?? baseMean - sigma) - randBetween(1, sigma * 1.5);
    }
  }
  return value;
}

async function seedProduction() {
  const units: UnitInput[] = [];
  const kits: KitInput[] = [];
  const kitLots: KitLotInput[] = [];
  const executions: ExecInput[] = [];
  const measurements: MeasInput[] = [];

  // Preload lots by component
  const lotByComponent = new Map<
    string,
    { good: LotSpec[]; warn: LotSpec[]; bad: LotSpec[]; all: LotSpec[] }
  >();
  lotSpecs.forEach((lot) => {
    const bucket = lotByComponent.get(lot.componentName) ?? { good: [], warn: [], bad: [], all: [] };
    bucket.all.push(lot);
    const cat = lotCategory(lot.lotNumber, lot.componentName);
    if (cat === "GOOD") bucket.good.push(lot);
    else if (cat === "WARN") bucket.warn.push(lot);
    else bucket.bad.push(lot);
    lotByComponent.set(lot.componentName, bucket);
  });

  let unitId = 1;
  let kitId = 1;
  let execId = 1;
  let measId = 1;

  const dayCount = MAIN_PARAMS.days;
  for (let day = 0; day < dayCount; day++) {
    const dayStart = addMinutes(baseStart, day * 24 * 60);
    for (const line of MAIN_PARAMS.lines) {
      const dailyUnits = MAIN_PARAMS.unitsPerLinePerDay;
      for (let u = 0; u < dailyUnits; u++) {
        const serial = `UL2-${line === "Line A" ? "A" : "B"}-${day
          .toString()
          .padStart(2, "0")}-${String(u).padStart(4, "0")}`;
        const kitCode = `KIT-${serial}`;
        const unitCreated = addMinutes(dayStart, randInt(0, 22 * 60));

        units.push({ id: unitId, serial, kitId, createdAt: unitCreated, updatedAt: unitCreated });
        kits.push({ id: kitId, code: kitCode, createdAt: unitCreated, updatedAt: unitCreated });

        // assign lots (one each type) with weighted categories
        const chooseLot = (component: string) => {
          const bucket = lotByComponent.get(component);
          if (!bucket) return choice(lotSpecs);
          const roll = rand();
          // Bias toward healthy lots: ~0.2% bad, ~1% warn
          if (roll < 0.002 && bucket.bad.length) return choice(bucket.bad);
          if (roll < 0.012 && bucket.warn.length) return choice(bucket.warn);
          if (bucket.good.length) return choice(bucket.good);
          return choice(bucket.all);
        };
        const kitLotSpecs: LotSpec[] = [
          chooseLot("Battery"),
          chooseLot("Display"),
          chooseLot("SiP Module"),
          chooseLot("U2"),
          chooseLot("Antenna Flex"),
          chooseLot("Rear Sensor"),
          chooseLot("Charging Coil"),
          chooseLot("Button Assembly"),
          chooseLot("Crown Assembly"),
        ];
        kitLotSpecs.forEach((lot) => {
          kitLots.push({
            kitId,
            componentLotId: lotSpecs.findIndex((l) => l.lotNumber === lot.lotNumber) + 1,
            quantityUsed: 1,
          });
        });
        const worstLotCategory = kitLotSpecs.reduce<"GOOD" | "WARN" | "BAD">((acc, lot) => {
          const cat = lotCategory(lot.lotNumber, lot.componentName);
          if (cat === "BAD") return "BAD";
          if (cat === "WARN" && acc === "GOOD") return "WARN";
          return acc;
        }, "GOOD");
        // Build executions across steps
        let currentTime = unitCreated;
        let finalResult: $Enums.ExecutionResult = ExecutionResult.PASS;
        let scrapped = false;
        const lotsUsed = kitLotSpecs.map((l) => l.lotNumber);
        let reworkCounter = 0;

        const maybeSkip = () => rand() < MAIN_PARAMS.skipRate;
        const makeExec = (
          step: StepCode,
          result: $Enums.ExecutionResult,
          fixtureCode?: string,
          reworkLoopId?: string,
          failureCode?: string,
          originalFailureStepId?: number,
        ) => {
          const start = currentTime;
          const duration = randBetween(6, 18);
          const end = addMinutes(start, duration);
          let startedAt = start;
          let completedAt = end;
          if (rand() < MAIN_PARAMS.outOfOrderRate) {
            startedAt = addMinutes(startedAt, 3);
          }
          const fullFixture = fixtureCode ? fixtureCode : undefined;
          executions.push({
            id: execId++,
            unitId,
            stepDefinitionId: stepIdByCode.get(step)!,
            stationCode: stationCodeMap[step],
            fixtureId: fullFixture ? fixtureCodeToId.get(fullFixture) : undefined,
            operatorId: choice(operatorPool),
            result,
            failureCode,
            reworkLoopId,
            originalFailureStepId,
            startedAt,
            completedAt,
          });
          currentTime = end;
          return completedAt;
        };

        for (let si = 0; si < nominalFlow.length; si++) {
          if (scrapped) break;
          const step = nominalFlow[si];
          if (maybeSkip()) continue;
          const fixtureCode = pickFixture(step, line);
          const { displayDrift } = findEpisodeImpact(day, line, lotsUsed, fixtureCode, step);

          // Initial execution (provisional PASS, may be flipped after CTQs)
          const finishedAt = makeExec(step, ExecutionResult.PASS, fixtureCode);

          // Measurements for CTQs at this step
          let ctqFailed = false;
          ctqDefs
            .filter((c) => c.step === step)
            .forEach((ctq) => {
              if (rand() < MAIN_PARAMS.missingMeasurementRate) return;
              const baseMean =
                ctq.target ??
                (((ctq.lsl ?? 0) + (ctq.usl ?? (ctq.target ?? 0))) / 2 || 0);
              const sigma = Math.max(Math.abs((ctq.usl ?? baseMean) - baseMean) * 0.2, 1);
              // For incoming QA, inject a very small extra chance of forcing an out-of-spec value to trigger rework.
              const forceCtqFail = step === "INCOMING_QA" && rand() < 0.003;
              let failBias = forceCtqFail;
              if ((step === "LEAK_TEST" || step === "RF_TEST" || step === "DISPLAY_ATTACH" || step === "CORE_ASSEMBLY") && (worstLotCategory === "WARN" || worstLotCategory === "BAD")) {
                failBias = rand() < (worstLotCategory === "BAD" ? 0.5 : 0.25);
              }
              if (ctq.code === "DISPLAY_GAP_PLANARITY" && displayDrift) {
                failBias = true;
              }
              if (step === "POWER_ON_TEST" && worstLotCategory === "BAD") failBias = rand() < 0.35;
              const meanWithDrift =
                ctq.step === "DISPLAY_ATTACH" ? baseMean + displayDrift : baseMean;
              let value: number;
              if (ctq.code === "INCOMING_BATT_OCV") {
                const lsl = ctq.lsl ?? 3.75;
                const usl = ctq.usl ?? 4.2;
                const tightSigma = 0.03;
                if (failBias) {
                  // Rare force-out-of-spec for OCV
                  const goLow = rand() < 0.5;
                  value = goLow
                    ? lsl - randBetween(0.01, 0.05)
                    : usl + randBetween(0.01, 0.05);
                } else {
                  value = Math.min(
                    usl - 0.01,
                    Math.max(lsl + 0.01, randBetween(meanWithDrift - tightSigma, meanWithDrift + tightSigma)),
                  );
                }
              } else {
                value = measurementForCtq(ctq, meanWithDrift, sigma, failBias);
              }
              measurements.push({
                id: measId++,
                processStepExecutionId: execId - 1,
                ctqDefinitionId: ctqIdByCode.get(ctq.code)!,
                value,
                recordedAt: finishedAt,
              });

              const outOfSpec = isCtqOutOfSpec(value, ctq.dir, ctq.lsl, ctq.usl);
              if (outOfSpec) ctqFailed = true;
            });

          // If CTQs failed, flip result to FAIL, optionally scrap, and attempt rework once.
          if (ctqFailed) {
            const lastExec = executions[executions.length - 1];
            if (lastExec) {
              lastExec.result = ExecutionResult.FAIL;
              const canScrapHere = stepDefinitions.find((s) => s.code === step)?.canScrap ?? false;
              const scrapChance = canScrapHere ? 0.05 : 0.0;
              if (rand() < scrapChance) {
              lastExec.result = ExecutionResult.SCRAP;
              finalResult = ExecutionResult.SCRAP;
              scrapped = true;
            } else {
                const reworkLoopId = `R-${unitId}-${++reworkCounter}`;
                const originalFailureStepId = stepIdByCode.get(step);
                const reworkPass = rand() < (worstLotCategory === "BAD" ? 0.82 : worstLotCategory === "WARN" ? 0.9 : 0.94);
                const reworkResult: $Enums.ExecutionResult = reworkPass ? ExecutionResult.PASS : ExecutionResult.SCRAP;
                const reworkFinishedAt = makeExec(
                  step,
                  reworkResult,
                  fixtureCode,
                  reworkLoopId,
                  reworkPass ? undefined : "CTQ_REFAIL",
                  originalFailureStepId,
                );
                // Measurements for rework attempt (mostly in spec if reworkPass)
                ctqDefs
                  .filter((c) => c.step === step)
                  .forEach((ctq) => {
                    if (rand() < MAIN_PARAMS.missingMeasurementRate) return;
                    const baseMean =
                      ctq.target ??
                      (((ctq.lsl ?? 0) + (ctq.usl ?? (ctq.target ?? 0))) / 2 || 0);
                    const sigma = Math.max(Math.abs((ctq.usl ?? baseMean) - baseMean) * 0.15, 1);
                    const failBias = !reworkPass;
                    const value = measurementForCtq(ctq, baseMean, sigma, failBias);
                    measurements.push({
                      id: measId++,
                      processStepExecutionId: execId - 1,
                      ctqDefinitionId: ctqIdByCode.get(ctq.code)!,
                      value,
                      recordedAt: reworkFinishedAt,
                    });
                  });
                if (!reworkPass) {
                  finalResult = ExecutionResult.SCRAP;
                  scrapped = true;
                }
              }
            }
          }
          if (scrapped) {
            break;
          }
        }

        // Final result set on unit record
        units[units.length - 1].finalResult = finalResult;

        unitId += 1;
        kitId += 1;
      }
    }
  }

  // Inject duplicate serials (data-quality)
  for (let i = 0; i < MAIN_PARAMS.duplicateSerialCount; i++) {
    const baseSerial = units[randInt(0, units.length - 1)].serial;
    const dupeSerial = `${baseSerial}-DUP${i}`;
    units.push({
      id: unitId++,
      serial: dupeSerial,
      kitId,
      finalResult: ExecutionResult.PASS,
      createdAt: addMinutes(baseStart, randInt(0, dayCount * 24 * 60)),
      updatedAt: new Date(),
    });
    kits.push({ id: kitId++, code: `KIT-DUPE-${i}`, createdAt: new Date(), updatedAt: new Date() });
  }

  console.log(`Prepared: ${units.length} units, ${executions.length} executions, ${measurements.length} measurements`);

  // Order matters: kits -> units -> kit lots -> executions -> measurements
  console.log("Inserting kits/units...");
  await prisma.kit.createMany({ data: kits }).catch((err) => {
    console.error("kit createMany failed", err);
    throw err;
  });
  await prisma.unit.createMany({ data: units }).catch((err) => {
    console.error("unit createMany failed", err);
    throw err;
  });

  console.log("Inserting kit-component links...");
  for (let i = 0; i < kitLots.length; i += MAIN_PARAMS.maxBatch) {
    await prisma.kitComponentLot.createMany({ data: kitLots.slice(i, i + MAIN_PARAMS.maxBatch) }).catch((err) => {
      console.error("kitComponentLot createMany failed at batch", i, err);
      throw err;
    });
  }
  console.log("Inserting executions...");
  for (let i = 0; i < executions.length; i += MAIN_PARAMS.maxBatch) {
    await prisma.processStepExecution.createMany({ data: executions.slice(i, i + MAIN_PARAMS.maxBatch) });
  }
  console.log("Inserting measurements...");
  for (let i = 0; i < measurements.length; i += MAIN_PARAMS.maxBatch) {
    await prisma.measurement.createMany({ data: measurements.slice(i, i + MAIN_PARAMS.maxBatch) });
  }
}

// -----------------------------
// Episodes records
// -----------------------------
async function seedEpisodes() {
  const epRecords = episodes.map((ep, idx) => {
    const start = addMinutes(baseStart, ep.startDayOffset * 24 * 60);
    const end = addMinutes(start, ep.durationDays * 24 * 60);
    return {
      id: idx + 1,
      title: ep.title,
      summary: ep.summary,
      status: ep.status,
      rootCauseCategory: ep.category,
      effectivenessTag: ep.effectiveness,
      startedAt: start,
      endedAt: end,
      affectedSteps: ep.affectedSteps,
      affectedCtqs: ep.affectedCtqs,
      affectedLots: ep.affectedLots,
      beforeMetrics: { note: "Auto-generated synthetic episode window" },
      afterMetrics: { note: "Recovered after corrective action" },
      externalLinks: [{ title: "SOP", url: "https://example.com/sop" }],
    };
  });
  await prisma.episode.createMany({ data: epRecords });
}

// -----------------------------
// Main
// -----------------------------
async function main() {
  console.log("Clearing existing data...");
  await clearData();
  console.log("Seeding reference data...");
  await seedProcessSteps();
  await seedCtqs();
  await seedFixtures();
  await seedComponentLots();
  console.log("Generating production history...");
  await seedProduction();
  console.log("Seeding episodes...");
  await seedEpisodes();

  const summary = {
    units: await prisma.unit.count(),
    executions: await prisma.processStepExecution.count(),
    measurements: await prisma.measurement.count(),
    lots: await prisma.componentLot.count(),
    fixtures: await prisma.fixture.count(),
    episodes: await prisma.episode.count(),
  };
  console.log("Seed complete:", summary);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
