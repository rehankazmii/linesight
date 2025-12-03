# Product Alignment Report – LineSight

## 1) High-level summary
LineSight is intended to be an Apple Watch Ultra 2 FATP quality dashboard with full unit→lot→station→fixture traceability, Line Overview yields/throughput/rework/scrap, RCA episodes + similarity suggestions, and a lightweight natural-language assistant. The stack is Next.js (App Router), React/TypeScript, Tailwind, Prisma + SQLite with synthetic local data.

The current repo matches the stated stack. Prisma schema is coherent and close to the conceptual model (units, kits, lots, steps, executions, CTQs, fixtures, episodes). There are multiple seed scripts (rich `seed.ts`, lighter `seed.mjs`), and DB connectivity works with the libsql adapter when installed; `/debug` health shows counts after seeding. App pages exist for Line Overview, Units, Lots, Fixtures, Episodes, Settings/Schema, Debug, and a right-rail assistant. However, most metrics are stubbed or minimal, and the UI is functional but not yet at the Apple-like, data-dense quality.

## 2) Current implementation snapshot
- **Data model / Prisma schema:** Exists; roughly aligned to PRD entities (Units, Kits, ComponentLots, ProcessStepDefinitions, ProcessStepExecutions with reworkLoopId, CTQDefinitions, Measurements, Fixtures, Episodes). Missing substeps and richer scrap categories; rework loop metadata is minimal. **Status:** Roughly aligned.
- **Seed data:** Two seeds: `scripts/seed.mjs` (simple, 12 units, minimal steps, no rework grouping metadata) and `scripts/seed.ts` (much richer, 200+ default units, multiple rework loops, CTQs). Seeds run successfully after installing libsql adapter. **Status:** Exists but divergent; `seed.mjs` is minimal, `seed.ts` is closer to PRD.
- **API routes:**
  - Line Overview metrics: `src/app/api/metrics/line-overview/route.ts` computes simple counts/yields from executions; no time bucketing/anomaly logic. **Status:** Exists but stub/low fidelity.
  - Units trace: `src/app/api/units/[serial]/route.ts` returns timeline grouped by reworkLoopId with CTQs/fixtures/kits. No similarity or episode linkage. **Status:** Exists, partial.
  - Lots: `src/app/api/lots/route.ts` lists lots with usage/execution counts; no yield/health scoring. **Status:** Exists but low detail.
  - Fixtures: `src/app/api/fixtures/route.ts` lists fixtures and simple usage/fail counts. **Status:** Exists but low detail.
  - Episodes: `src/app/api/episodes/route.ts` & `[id]` list/read episodes; no similarity or metrics derivation. **Status:** Exists, basic CRUD.
  - Similarity: `src/app/api/similarity/route.ts` returns a static placeholder array. **Status:** Exists but stub.
  - Debug/health: `src/app/api/debug/health/route.ts` counts records; works after seeding. **Status:** Roughly aligned.
  - Schema: `src/app/api/schema/route.ts` returns schema metadata; utility only. **Status:** Exists.
- **UI pages:**
  - Line Overview (`/`): Cards and table driven by API; no charts, anomalies, or time filters. **Status:** Exists but stub/partial.
  - Units (`/units`): Search + timeline with rework grouping and CTQ values; no episode links or lot/fixture drill-down beyond labels. **Status:** Exists, partial.
  - Lots (`/lots`): Table of lots with basic counts; no health/yield visuals. **Status:** Exists but low quality.
  - Fixtures (`/fixtures`): Table of fixtures with usage/fail counts; no calibration warnings/health. **Status:** Exists but low quality.
  - Episodes (`/episodes`): Table of episodes with basic fields; no detail view or similarity surfacing. **Status:** Exists but partial.
  - Settings/Schema (`/settings`): Shows schema tables/columns only. **Status:** Exists but placeholder for PRD intent.
  - Debug (`/debug`): Health counts table; works after seeding. **Status:** Roughly aligned (dev-only).
  - Line Assistant panel: Right rail renders static welcome + prompt buttons; no real NLP backend. **Status:** Exists but stub.

## 3) Alignment matrix vs PRD epics
### Epic 1 – Line Overview Dashboard
| Feature / FR | Status | Notes |
| --- | --- | --- |
| RTY/FPY/rework/scrap top cards | PARTIAL | Cards render simple counts; no RTY/RTY calc, no time filters.
| Yield over time charts | NOT IMPLEMENTED | No charts/graphs.
| Station FPY Pareto/bottlenecks | PARTIAL | Table of station yields only; no Pareto or bottleneck logic.
| Anomaly alerts | NOT IMPLEMENTED | No thresholds/alerts.

### Epic 2 – Unit Traceability
| Feature / FR | Status | Notes |
| Serial trace timeline with rework loops | PARTIAL | Timeline groups by reworkLoopId but limited metadata; no loop summaries.
| CTQ + fixture/lot drill-down | PARTIAL | CTQs shown inline; fixtures/lot names shown but no drill or correlation.
| Final status, rework count chips | PARTIAL | Basic chips present; lacks deeper insights.
| Link to episodes/similarity | NOT IMPLEMENTED | No episode linkage.

### Epic 3 – Lots & Fixtures
| Feature / FR | Status | Notes |
| Lot health (yield, failure patterns) | PARTIAL | Lists lots with counts; no health scoring or bad-actor surfacing.
| Fixture health (calibration, correlated failures) | PARTIAL | Shows counts only; no calibration due alerts or correlation.
| Actions/quarantine cues | NOT IMPLEMENTED | No warnings.

### Epic 4 – Episodes & Similarity Engine
| Feature / FR | Status | Notes |
| Episodes list/detail with before/after | PARTIAL | List with summary/status; no rich detail UI; data exists in seed.
| Similarity ranking for anomalies | NOT IMPLEMENTED | API returns static placeholder; UI not wired.
| Surfacing similar episodes on dashboards | NOT IMPLEMENTED | Absent.

### Epic 5 – Natural Language Assistant
| Feature / FR | Status | Notes |
| Persistent chat panel | PARTIAL | UI shell present with canned prompt buttons; no backend.
| Metric/episode querying | NOT IMPLEMENTED | No API or parsing.
| Term explanations | NOT IMPLEMENTED | Absent.

### Epic 6 – Data Simulation & Streaming
| Feature / FR | Status | Notes |
| Synthetic data generator | PARTIAL | `seed.ts` is robust; `seed.mjs` is minimal. No streaming/live insert.
| Realistic CTQ/rework modeling | PARTIAL | Rich seed models rework loops/CTQs; still static.
| Live streaming updates | NOT IMPLEMENTED | No cron/interval publisher.

## 4) Biggest gaps and risks
1. **Line Overview lacks real analytics** – no RTY, time slicing, or anomaly detection; TPM can’t tell line health over time. (Data + API + UI gap.)
2. **No similarity/episode surfacing** – similarity API is stub; episodes never appear in diagnostics, undermining “this happened before” storytelling. (API/logic gap.)
3. **Assistant is UI-only** – without NLP/backend, the headline “ask the line” feature is missing. (API/data gap.)
4. **Lots/Fixtures health is shallow** – no correlated failure metrics, calibration warnings, or bad-actor highlighting; TPM can’t act on suspect lots/fixtures. (Data + analytics + UI gap.)
5. **Unit trace lacks richer rework context** – no grouped loop summaries, no drill into related episodes/lots/fixtures beyond labels; weak for RCA. (API + UI gap.)
6. **No live/streaming data** – static seeds only; demo can’t show fresh data or drift. (Data generation gap.)
7. **Design polish** – UI is serviceable but not Apple-like; minimal charts and density; risks feeling “vibe coded.” (UI/UX gap.)

## 5) Strengths / good foundations
- Prisma schema closely matches PRD entities (units, kits, lots, steps, CTQs, fixtures, episodes) and is coherent.
- Rich seed (`seed.ts`) already models multiple steps, rework loops, CTQs, fixtures, and episodes; health API works after seeding.
- App Router layout with sidebar + right assistant rail is in place; pages exist for all major tabs (overview, units, lots, fixtures, episodes, settings, debug).
- APIs for units, lots, fixtures, episodes, and line overview are wired to Prisma and return structured data, providing a base to enrich rather than rewrite.
