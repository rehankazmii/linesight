# Implementation Roadmap – LineSight

## 1) Phases overview
- **Phase 1: Seed + health sanity** – Ensure reproducible seeding and health check; small dataset loads fast and APIs don’t error.
- **Phase 2: Line Overview vertical slice** – Real RTY/FPY/rework/scrap metrics with time filters and station Pareto; no charts yet.
- **Phase 3: Unit traceability polish** – Solid timeline with rework loop grouping, CTQ highlights, fixtures/lots drill, link to episodes.
- **Phase 4: Lots & Fixtures health** – Add yield/health scoring, calibration warnings, and bad-actor surfacing.
- **Phase 5: Episodes + similarity MVP** – Real similarity API using episode metadata; surface on overview/unit views.
- **Phase 6: Assistant MVP** – Wire assistant panel to simple intent router over metrics/episodes; glossary responses.
- **Phase 7: UI polish + charts** – Add charts (RTY/FPY over time, Pareto), tighten styling to Apple-like quality.

## 2) Detailed steps per phase
### Phase 1: Seed + health sanity
- **Objectives:** One canonical seed (pick `seed.ts`), fast run, `/debug` non-zero counts; remove adapter/runtime flakiness.
- **Files:** `scripts/seed.ts`, `package.json`, `.env`, `src/lib/prisma.ts`, `src/app/api/debug/health/route.ts`.
- **Refactor vs replace:** Refine existing; remove unused `seed.mjs` or clearly mark secondary.
- **Acceptance:** `node --import tsx scripts/seed.ts` succeeds <60s; `/api/debug/health` shows expected counts; app boots without adapter errors.

### Phase 2: Line Overview vertical slice
- **Objectives:** Compute RTY/FPY/rework/scrap from executions; station Pareto; basic time range param; show warning badge if below thresholds.
- **Files:** `src/app/api/metrics/line-overview/route.ts`, `src/app/page.tsx`, `src/lib/prisma.ts` (helpers if needed), `src/components/content-card.tsx` (minor).
- **Refactor vs replace:** Extend existing API/UI; keep simple.
- **Acceptance:** `/` shows metrics derived from DB (not hard-coded), station table sorted FPY asc with Pareto percentage, optional `range` query works, no runtime errors.

### Phase 3: Unit traceability polish
- **Objectives:** Group rework loops with labels, show loop counts, CTQ callouts (e.g., failed values red), include fixtures and component lots in summary, link to episodes (if any).
- **Files:** `src/app/api/units/[serial]/route.ts`, `src/types/unit-trace.ts`, `src/app/units/page.tsx`.
- **Refactor vs replace:** Extend current structures; avoid new abstractions.
- **Acceptance:** Searching seeded serial returns timeline with grouped loops and CTQ highlights; summary chips include lots/fixtures; episode link chips appear when applicable; no 404 on valid serials.

### Phase 4: Lots & Fixtures health
- **Objectives:** Compute lot yield/rework/scrap and flag suspect lots; fixtures show usage/fail %, calibration due warning.
- **Files:** `src/app/api/lots/route.ts`, `src/app/api/fixtures/route.ts`, `src/app/lots/page.tsx`, `src/app/fixtures/page.tsx`.
- **Refactor vs replace:** Enrich existing tables; add badges not charts.
- **Acceptance:** Lots/fixtures pages show health badges (good/warn/bad) with computed metrics; calibration due highlighted; tables sortable without errors.

### Phase 5: Episodes + similarity MVP
- **Objectives:** Implement similarity scoring using episode metadata (affected steps/ctqs/lots) vs current anomalies; add API that returns ranked episodes; surface on overview and unit pages.
- **Files:** `src/app/api/similarity/route.ts`, `src/app/api/episodes/route.ts`, `src/app/page.tsx`, `src/app/units/page.tsx`, `src/components/episode-card.tsx` (new).
- **Refactor vs replace:** Replace placeholder API; add minimal cards UI.
- **Acceptance:** Similarity API returns ranked episodes for a given step/ctq/lot/failure code; overview shows “similar episodes” panel when a station is weak; unit page shows related episodes; no hard-coded placeholders.

### Phase 6: Assistant MVP
- **Objectives:** Simple intent router (metrics, episode search, glossary) using existing APIs; store chat history client-side; deterministic responses.
- **Files:** `src/components/LineAssistant.tsx`, `src/app/api/assistant/route.ts` (new), possibly small utils.
- **Refactor vs replace:** Extend UI component; add lightweight API.
- **Acceptance:** Assistant can answer “What’s RTY last 24h?”, “Find episodes with leak”, “Explain FPY” using live data; no streaming/LLM required.

### Phase 7: UI polish + charts
- **Objectives:** Add charts (RTY/FPY over time, station Pareto), tighten spacing, Apple-like styling, loading skeletons; ensure mobile tolerable.
- **Files:** `src/app/page.tsx`, `src/components/*` (charts), `src/app/globals.css`.
- **Refactor vs replace:** Incremental polish; no heavy design system.
- **Acceptance:** `/` shows charts fed by API; consistent spacing/typography; no “vibe coded” feel.

## 3) Ready-to-use Codex prompts
- **Phase 1 prompt:**
  - "Read scripts/seed.ts, scripts/seed.mjs, src/lib/prisma.ts, src/app/api/debug/health/route.ts. Goal: make seeding deterministic and health check non-zero. Tasks: pick one seed as canonical, clean prisma client init, ensure health route uses correct client, remove adapter errors. After changes, remind me to run `node --import tsx scripts/seed.ts` and check `/api/debug/health`."
- **Phase 2 prompt:**
  - "Read src/app/api/metrics/line-overview/route.ts and src/app/page.tsx. Implement RTY/FPY/rework/scrap from executions (no hard-coding). Add optional `range` param (last 24h default). Sort station FPY Pareto. Update UI to show computed values and warning badge when FPY < target."
- **Phase 3 prompt:**
  - "Read src/app/api/units/[serial]/route.ts, src/types/unit-trace.ts, src/app/units/page.tsx. Add rework loop grouping labels, CTQ highlight for fails, include fixtures/lots summary, and include any linked episodes. Keep API shape simple; avoid new abstractions."
- **Phase 4 prompt:**
  - "Read src/app/api/lots/route.ts and src/app/api/fixtures/route.ts plus corresponding pages. Compute yield/rework/scrap per lot/fixture, flag health (good/warn/bad), show calibration-due badges. Keep tables; no charts." 
- **Phase 5 prompt:**
  - "Read src/app/api/similarity/route.ts and episodes API; build real similarity scoring using affected steps/ctqs/lots/failure codes. Return ranked episodes. Surface related episodes on Line Overview when a station is weak and on unit timeline when failures exist."
- **Phase 6 prompt:**
  - "Read src/components/LineAssistant.tsx. Add `/api/assistant` that routes intents: metrics, episode search, glossary. Hook UI to call it, maintain chat history locally. No external LLM."
- **Phase 7 prompt:**
  - "Polish UI: add charts for RTY/FPY over time and station Pareto using existing metrics API. Tighten spacing/typography to feel Apple-like. Touch only page.tsx and shared components; keep behavior unchanged." 

## 4) Prioritization and “do not touch yet”
- **Do first:** Phase 1 (stability/seed), Phase 2 (Line Overview metrics), Phase 3 (Unit trace polish). These underpin TPM demo storytelling.
- **Later:** Phases 4–7 in order; assistant and polish are nice-to-have after core analytics.
- **Avoid/park for now:** Don’t resurrect `seed.mjs` unless needed; don’t add new abstraction layers or external services; leave streaming/live mode until analytics are solid.

