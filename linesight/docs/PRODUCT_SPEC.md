# LineSight Product Specification

## 1) Overview
LineSight is a web application for Apple Watch Ultra 2 FATP TPMs to monitor line health, investigate defects, and accelerate root-cause actions. It presents production-grade traceability from unit → station → fixture → lot with synthesized but realistic data that mirrors a real MES/test-log. The UI is Apple-quality: compact dashboards, fast drill-downs, and a right-rail assistant.

All data is synthetic yet must feel plausible for Ultra 2 FATP. The schema and APIs are designed to be drop-in compatible with a future MES/test-log backend (SQLite/Prisma locally, but conceptually relational and normalized). The app is local-first (no external services) while remaining ready to sit atop real data in later versions.

## 2) Users & hero scenarios
- **Primary user:** FATP TPM / Sr TPM for Apple Watch Ultra 2.
- **Secondary users:** Manufacturing/process/quality engineers (read-only, investigative support).

Hero scenarios (each is a concrete narrative):
1) **Serial trace with rework loops:** User searches a serial, sees a ordered timeline of every station/substep, grouped rework loops with failure codes, CTQs, fixtures, and kit/lot context. They can spot where it failed and which lots/fixtures were involved.
2) **Line health + similarity:** User sees RTY/FPY dip on Leak Test in Line Overview, selects the weak station, and the app surfaces similar historical episodes plus what fixed them (root cause, effectiveness, links).
3) **Lot/fixture quarantine:** User opens Lots/Fixtures tabs to see bad actors (low yield/high scrap or overdue calibration) and decides which lots/fixtures to quarantine or service.
4) **Assistant question:** User asks “Which lots correlate with leak test failures today?” The assistant replies with metrics and links to lots/episodes/units.
5) **Episode review:** User browses Episodes, opens an episode, and sees affected steps/CTQs/lots, before/after metrics, and external links; similarity engine ties current anomalies to these episodes.

## 3) Line model & data model (conceptual)
- **Process flow:** Configurable ordered list of Steps (1–9 nominal FATP macro steps, each may have substeps). Step types: ASSEMBLY, TEST, CALIBRATION, DEBUG, INSPECTION. Certain test steps have predefined rework targets (e.g., Leak Test → Seal Rework; RF Test → RF Debug).
- **Rework modeling:**
  - Allowed rework paths declared on ProcessStepDefinition (not arbitrary graph).
  - Each execution is a ProcessStepExecution with `rework_loop_id`, `original_failure_step_id`, `original_failure_code`, loop start/end times, and loop final outcome (PASS/SCRAP).
  - Rework loops group executions; first-pass vs rework distinguished.
- **Entities/relationships:**
  - Unit (serial) links to Kit.
  - Kit has KitComponentLots; each links to ComponentLot (supplier, componentName, receivedAt).
  - ProcessStepDefinition defines code, name, sequence, stepType, canScrap, reworkTargets.
  - ProcessStepExecution references Unit, StepDefinition, Fixture, stationCode, operatorId, result (PASS/FAIL/SCRAP), failureCode, rework_loop_id, timings.
  - CTQDefinition tied to StepDefinition: name, units, lower/upper spec, target, isCritical, direction (TWO_SIDED/HIGHER_BETTER/LOWER_BETTER); CTQs are read-only in v1.
  - Measurement: value + optional rawData JSON, linked to ProcessStepExecution and CTQDefinition.
  - Fixture: code, type, station, status, calibration metadata; used by executions.
  - Station: represented by stationCode on executions/fixtures; not a separate model in DB but conceptually present.
  - CorrectiveActionEpisode: title, summary, status (OPEN/CLOSED/MONITORING), rootCauseCategory (COMPONENT/FIXTURE/PROCESS/DESIGN/OPERATOR), effectivenessTag, affectedSteps/CTQs/lots (JSON arrays), before/after metrics (JSON), externalLinks, time window.

## 4) Metrics & analytics definitions
- **Station Yield:** Pass executions / total executions at that station (all attempts).
- **Station FPY:** Units that pass the station on their first attempt (no rework_loop_id) / units entering the station.
- **Line FPY:** Units that pass all required steps with no rework loops / units entering the flow.
- **RTY (Rolled Throughput Yield):** Product of per-station FPYs along nominal flow.
- **Rework rate:**
  - Station: units that required rework at that station / units processed at station.
  - Line: units with any rework loop / units processed in window.
- **Scrap rate:** Units ending in SCRAP / units processed in window.
- **DPMO/defects per N:** Optional; compute from failures per million where needed.
- **Time bucketing:** Hour, shift, day, week supported for dashboards and assistant queries.
- **Usage:** Metrics drive dashboard cards/charts and color thresholds (green/yellow/red) and power similarity/assistant answers.

## 5) Features by epic (functional requirements)
- **Epic 1 – Line Overview dashboard:**
  - Screen: `/` with cards (RTY, FPY, throughput, rework, scrap), Pareto of station FPY, yield over time, rework/scrap breakdown, anomaly banners when thresholds crossed.
  - API: line overview metrics with time range/bucketing.
  - Interaction: select time ranges, click stations to see detail/similar episodes.
- **Epic 2 – Unit traceability:**
  - Screen: `/units` serial search → timeline of executions; grouped rework loops with labels; CTQs with spec bands; fixtures and lots listed; summary chips; link to related episodes/similarity.
  - API: unit trace returns unit, kit/lots, executions with CTQs/fixtures/stations, rework grouping, linked episodes.
- **Epic 3 – Lots & Fixtures health:**
  - Screens: `/lots`, `/fixtures` tables with yield/rework/scrap, bad-actor flags, calibration warnings; drill into lots/fixtures to see correlated failures and linked episodes.
  - APIs: lot health (usage, yield, rework/scrap, episode links), fixture health (usage, correlated failure rate, calibration due, episode links).
- **Epic 4 – Episodes & similarity engine:**
  - Screens: `/episodes` list/detail with before/after metrics, affected steps/CTQs/lots, effectiveness, links.
  - Similarity API ranks episodes based on CTQ drift patterns, station yield patterns, lot mix, fixture IDs, failure codes (priority order: CTQ > station yields > lots > fixtures > failures).
  - Surfacing: related episodes on overview (weak station) and unit trace (failures/rework).
- **Epic 5 – Natural language assistant:**
  - UI: right-rail chat panel; prompt buttons; responds with metrics, episode hits, lot/fixture insights, glossary of RTY/FPY/CTQ.
  - API: assistant router (no external LLM) over existing metrics/episodes/lots fixtures data.
- **Epic 6 – Data simulation & “live” feel:**
  - Seed generator creates realistic units/lots/steps/CTQs/rework loops/fixtures/episodes.
  - Optional “live” mode inserts new executions periodically; UI should gracefully update on refresh/poll.
  - Data quality checks and /debug health showing counts.

## 6) UX & visual design principles
- Navigation: Left sidebar tabs — Line Overview (default), Stations, Units, Lots, Fixtures, Episodes/RCA, Settings/Schema. Assistant pinned on right.
- Layout: Table/dashboard-first; flowchart/step diagram secondary; compact cards + charts with drill-down.
- Visuals: Yield/RTY over time, station FPY Pareto, CTQ trends with spec bands, rework/scrap breakdowns, heatmaps. Apple-like: clean typography, restrained color, subtle depth, no clutter or “vibe-coded” randomness.
- Interaction: Clear filters for time ranges; hover states; concise badges; fast load.

## 7) Data realism & constraints
- Synthetic but believable Ultra 2 FATP data; include enough units/lots/measurements for charts to look real.
- Schema aligned to a real MES/test-log: normalized relationships, clear step/rework modeling.
- Demo may simulate streaming; underlying DB can be snapshot-based. No external services.
- v1 synthetic only; future can attach real data sources.

## 8) v1 vs v2/v3
- **v1 must-haves:** Line Overview with RTY/FPY/rework/scrap + station Pareto; serial trace with rework loops, CTQs, lots/fixtures; lots/fixtures health; episodes list/detail; similarity surfacing; assistant answering core queries; robust seed + /debug health; Apple-like UI.
- **v2/v3 ideas:** Real MES/test-log integration; multi-product/multi-line; advanced anomaly detection/alerts; richer assistant with NL understanding; live streaming and subscriptions; editable CTQs/thresholds; richer flowchart/visualizations; role-based access.
