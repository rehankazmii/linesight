# Alignment Snapshot

## 1) Summary
The repo matches the general stack (Next.js App Router, Prisma/SQLite, Tailwind) and has pages/APIs for overview, units, lots, fixtures, episodes, settings, debug, and an assistant shell. A rich seed exists and health counts populate. However, many features are stubbed or shallow versus the PRODUCT_SPEC: metrics lack time bucketing and charts; similarity is basic; assistant is deterministic but limited; lots/fixtures health is surface-level; UI lacks the polished Apple-like dashboards and visualizations described in the spec.

## 2) Current state by area
| Area | Status | Notes |
| --- | --- | --- |
| Data model | CLOSE TO SPEC | Prisma models align with units/kits/lots/steps/CTQs/fixtures/episodes; missing substeps and richer loop metadata. |
| Seeds / synthetic data | PRESENT BUT ROUGH | `seed.ts` rich but static; no live streaming; data realism decent but not tuned to flows/charts. |
| Line Overview API + UI | PRESENT BUT ROUGH | Computes FPY/RTY and stations; no time bucketing UI beyond simple range, no charts/anomalies/banners, limited bottleneck logic. |
| Units API + UI | PRESENT BUT ROUGH | Timeline with rework grouping and CTQs; related episodes basic; no CTQ bands or deep drill; rework loop metadata minimal. |
| Lots API + UI | PRESENT BUT ROUGH | Health badges added but no detailed drill/filters or correlations; tables only. |
| Fixtures API + UI | PRESENT BUT ROUGH | Health and calibration badges; lacks correlated failure analysis depth. |
| Episodes API + UI | PRESENT BUT ROUGH | List only; no detail view, before/after metrics, or rich links. |
| Similarity engine | PRESENT BUT STUB/ROUGH | Simple overlap scoring; no CTQ drift patterns or station yield deltas; not prioritized as spec demands. |
| Assistant | PRESENT BUT ROUGH | Local rule-based router; limited intents; no rich narratives or cross-linking; still acceptable constraint-wise (no LLM). |
| Settings/Schema | PRESENT BUT STUB/ROUGH | Schema viewer only; no CTQ/threshold editing. |
| Layout/UX polish | PRESENT BUT ROUGH | Functional layout with sidebar/right-rail; lacks charts, density, spec-band visuals, and Apple-grade polish.

## 3) Top gaps
1) **Analytics depth (overview/stations)** – Needs real time-bucketed RTY/FPY trends, Pareto visuals, anomaly banners. (API + UI problem.)
2) **Unit trace richness** – Missing substep/loop metadata, CTQ spec bands, linked episodes/fixtures/lots drill. (API + UI problem.)
3) **Similarity engine** – Overlap-only; must prioritize CTQ drift + station yield patterns and surface context-sensitive matches. (API problem, some UI surfacing.)
4) **Lots/Fixtures health** – Basic tables; needs correlated failure/yield insights, quarantine cues, calibration alerts with context. (Data + API + UI.)
5) **Assistant capability** – Limited intents; needs broader metrics, episodes, lots/fixtures Q&A, glossary; richer response formatting. (API/logic + UI messaging.)
6) **Episodes detail** – No detail screens or before/after metrics; similarity not integrated. (UI + API.)
7) **Visual polish/charts** – Lacks charts (RTY/FPY, Pareto, CTQ trends) and Apple-like styling. (UI.)
