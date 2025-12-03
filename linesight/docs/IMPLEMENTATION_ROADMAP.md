# Implementation Roadmap

## 1) Phases overview
- **Phase 1: Layout & UX cleanup (shell only)** – Tighten cards/tables spacing, typography, and affordances without changing logic; keep Apple-like baseline.
- **Phase 2: Stable seed data + DB health** – Canonical deterministic seed, /debug health non-zero, ready for demos; optional light “live-ish” trickle.
- **Phase 3: Line Overview vertical slice** – Time-bucketed RTY/FPY/rework/scrap, station Pareto, anomaly cues, minimal charts per PRODUCT_SPEC.
- **Phase 4: Unit traceability vertical slice** – Rich timeline with rework loops, CTQ spec bands, fixtures/lots drill, linked episodes; accurate rework modeling.
- **Phase 5: Lots & Fixtures vertical slice** – Yield/rework/scrap scoring, correlated failures, calibration warnings, and bad-actor cues in tables.
- **Phase 6: Episodes + similarity MVP** – Episode detail, before/after metrics, and CTQ/station/lot/fixture/failure-based similarity surfaced on overview and units.
- **Phase 7: Assistant refinement + polish** – Broader intents over metrics/episodes/lots/fixtures, better responses, and UI polish; no external LLM.

## 2) Detailed tasks per phase
### Phase 1: Layout & UX cleanup
- **Objectives:** Tighten spacing/typography in cards/tables; consistent badges and densities per Apple-like guidance.
- **Files:** `src/app/layout.tsx`, `src/app/globals.css`, `src/components/content-card.tsx`, any shared UI tokens.
- **Approach:** Refactor styling only; no logic changes.
- **Acceptance:** Pages render same data but feel denser/cleaner; no regressions.

### Phase 2: Stable seed data + DB health
- **Objectives:** Single canonical seed (`scripts/seed.ts`), deterministic random seed env vars, optional trickle insert, `/api/debug/health` non-zero.
- **Files:** `scripts/seed.ts`, `.env`, `src/lib/prisma.ts`, `src/app/api/debug/health/route.ts`.
- **Approach:** Refine existing seed; remove or quarantine legacy seeds; avoid new deps.
- **Acceptance:** Seed completes <60s with realistic counts; health endpoint matches seeded totals.

### Phase 3: Line Overview vertical slice
- **Objectives:** Add time bucketing (hour/shift/day/week), RTY/FPY/rework/scrap cards, station Pareto chart, simple anomaly badges.
- **Files:** `src/app/api/metrics/line-overview/route.ts`, `src/app/page.tsx`, `src/components/*` (charts minimal).
- **Approach:** Extend current API/UI; add lightweight charting (e.g., simple SVG/mini chart) without heavy libs.
- **Acceptance:** `/` shows correct metrics per bucket from DB; station Pareto visible; anomaly cues when thresholds breached.

### Phase 4: Unit traceability vertical slice
- **Objectives:** Rework loop grouping labels with loop metadata, CTQ spec-band highlighting, fixtures/lots drill, related episodes shown; substep-friendly data.
- **Files:** `src/app/api/units/[serial]/route.ts`, `src/types/unit-trace.ts`, `src/app/units/page.tsx`.
- **Approach:** Refactor existing shapes; avoid new abstractions; add spec-band logic client-side.
- **Acceptance:** Searching seeded serial shows grouped loops, CTQs colored vs spec, fixtures/lots summaries, related episodes, no errors.

### Phase 5: Lots & Fixtures vertical slice
- **Objectives:** Compute yield/rework/scrap and correlated failures; bad-actor flags; calibration due warnings; sortable tables.
- **Files:** `src/app/api/lots/route.ts`, `src/app/api/fixtures/route.ts`, `src/app/lots/page.tsx`, `src/app/fixtures/page.tsx`.
- **Approach:** Enrich existing endpoints; keep tables (no charts); small badges.
- **Acceptance:** Tables show health badges (good/watch/at risk), correlated metrics, calibration warnings; no runtime errors.

### Phase 6: Episodes + similarity MVP
- **Objectives:** Episode detail screen; similarity scoring prioritizing CTQ drift, station yield patterns, lots, fixtures, failure codes; surfaced on overview/unit pages.
- **Files:** `src/app/api/episodes/route.ts`, `src/app/api/episodes/[id]/route.ts`, `src/app/api/similarity/route.ts`, `src/app/page.tsx`, `src/app/units/page.tsx`, shared episode card component.
- **Approach:** Refine not rewrite; keep scoring transparent; simple cards.
- **Acceptance:** Similarity API returns ranked episodes with why; overview/unit pages show related episodes; episode detail shows before/after metrics.

### Phase 7: Assistant refinement + polish
- **Objectives:** Broaden intents (metrics by time bucket, lots/fixtures health, episodes by keyword), better formatting, quick prompts; keep deterministic backend.
- **Files:** `src/app/api/assistant/route.ts`, `src/components/LineAssistant.tsx`.
- **Approach:** Extend router; richer responses; maintain no-external-LLM constraint.
- **Acceptance:** Assistant answers core questions accurately with links/metrics; UI tidy; no external calls.

## 3) Ready-to-paste Codex prompts
- **Phase 1 prompt:**
  - "Read src/app/layout.tsx, src/app/globals.css, src/components/content-card.tsx. Goal: tighten spacing/typography and badges to Apple-like polish without changing logic. Constraints: only edit these files; no new deps; no API changes. After changes, remind me to run npm run dev and visually sanity check all pages."
- **Phase 2 prompt:**
  - "Read scripts/seed.ts, src/lib/prisma.ts, src/app/api/debug/health/route.ts. Goal: canonical deterministic seed and reliable health counts. Tasks: ensure env-based seed control, remove legacy seeds, confirm health uses single client. Constraints: no new deps; keep seed JS/TS simple. After changes, remind me to run `node --import tsx scripts/seed.ts` and hit /api/debug/health."
- **Phase 3 prompt:**
  - "Read src/app/api/metrics/line-overview/route.ts and src/app/page.tsx. Goal: add time bucketing (hour/shift/day/week), station FPY Pareto chart, anomaly badges. Constraints: only touch these files + minimal shared chart helper; no heavy chart libs. After changes, remind me to run seeded app and verify / shows RTY/FPY/rework/scrap correct per bucket."
- **Phase 4 prompt:**
  - "Read src/app/api/units/[serial]/route.ts, src/types/unit-trace.ts, src/app/units/page.tsx. Goal: richer timeline with loop metadata, CTQ spec bands, fixtures/lots drill, related episodes. Constraints: keep existing shapes, no new abstractions/deps. After changes, remind me to test a seeded serial on /units." 
- **Phase 5 prompt:**
  - "Read src/app/api/lots/route.ts, src/app/api/fixtures/route.ts, src/app/lots/page.tsx, src/app/fixtures/page.tsx. Goal: health scoring (yield/rework/scrap, correlated failures), calibration warnings, badges. Constraints: tables only, no new deps. After changes, remind me to reload /lots and /fixtures." 
- **Phase 6 prompt:**
  - "Read src/app/api/similarity/route.ts, src/app/api/episodes/route.ts, src/app/api/episodes/[id]/route.ts, src/app/page.tsx, src/app/units/page.tsx. Goal: similarity scoring per spec (CTQ drift > station yields > lots > fixtures > failures) and surface related episodes on overview/unit. Constraints: minimal new components; no new deps. After changes, remind me to verify similarity responses and episode detail." 
- **Phase 7 prompt:**
  - "Read src/app/api/assistant/route.ts and src/components/LineAssistant.tsx. Goal: broaden intents (metrics by bucket, lots/fixtures health, episodes search, glossary), improve formatting/prompts. Constraints: no external LLM; no new deps. After changes, remind me to try the assistant panel with key queries." 

## 4) Do not touch (yet)
- Generated Prisma client files and migrations unless schema changes are intentional.
- Legacy/duplicate seed scripts (keep `scripts/seed.ts` canonical).
- Avoid adding heavy charting libraries; prefer lightweight/SVG until core flows stabilize.
- Any new auth/multi-tenant features; out of scope for v1.
