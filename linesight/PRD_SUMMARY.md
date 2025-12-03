# LineSight – PRD Summary

## 1. Overview

**Product name (working):** LineSight – Apple Watch Ultra 2 Quality Dashboard  
**Type:** Web application (desktop-first)  

**Primary user:** Apple Watch FATP TPM / Sr. TPM  
**Secondary users (nice-to-have):** Process / Manufacturing engineers, Quality / Reliability engineers  

**Vision (one sentence)**  
LineSight lets a TPM track every Apple Watch unit from modules to pack-out, turning raw station data into intuitive line-health analytics, natural-language insights, and “this has happened before” suggestions that dramatically speed root-cause analysis.   

**Goals for v1**

- Production-grade line tracker with full unit → lot → station → fixture traceability.  
- Live and historical line-health dashboards (FPY, RTY, CTQs, rework, scrap, bottlenecks).  
- Anomaly detection with proactive alerts.  
- Similarity engine that matches current anomalies to past corrective-action episodes.  
- Chat-style assistant that answers TPM questions and explains trends in plain language.  
- Apple-quality UI/UX – clean, fast, not “vibe coded.”   

All data is **synthetic** (no real Apple data). An About screen makes this explicit.

---

## 2. Scope

**In scope (v1)**

- FATP for **Apple Watch Ultra 2**, but the process model is configurable and can support other products later.  
- Single factory / line, with:
  - Configurable multi-step process (macro steps + substeps).  
  - Defined CTQs per step.  
  - Rework and scrap modeling.  
- Local relational DB (SQLite via Prisma) that could sit on top of a real MES/test-log in production.  
- Synthetic data generator + “live streaming” simulator.   

**Out of scope (v1)**

- Multi-factory / multi-product deployment UI.  
- Authentication / multi-role permissions (assume a single TPM user).  
- Real integration with Apple internal systems.  
- Heavy file uploads; store only external links to docs.

---

## 3. Users & Core Use Cases

**Persona – FATP TPM (“Steven / Juan”)**

- Owns line health, drives yield improvements, coordinates investigations.  
- Comfortable with RTY/FPY, CTQs, DOE, etc.   

**Hero scenarios**

1. **Serial trace:** Search a watch serial and see the complete process history including substeps, rework loops, scrap decisions, and associated lots/fixtures.  
2. **Trend + suggestion:** See leak-test yield drooping on Line Overview; the app flags it, finds similar historical episodes, and suggests likely root causes and successful CAs.  
3. **Ask the line:** Ask “What’s RTY this week?” or “Which lots correlate with today’s leak failures?” and get clear, linked answers.

Supported decisions: pause/slow a line, quarantine a lot, escalate to design/supplier, adjust torque/pressure specs or tooling.   

---

## 4. Process & Data Model (Conceptual)

**Process flow**

- Configurable ordered list of **Steps** and optional **Substeps**, typed as `ASSEMBLY`, `TEST`, `CALIBRATION`, `DEBUG`, `INSPECTION`.  
- Certain test steps can route units backward into specific **rework/debug steps** (e.g., Leak Test → Seal rework; RF Test → RF debug).  
- Each execution of a step is a `ProcessStepExecution` row.  
- A **rework loop** is a group of executions sharing `rework_loop_id`, with:
  - `original_failure_step_id`, `original_failure_code`  
  - `rework_steps_executed`, `loop_start_time`, `loop_end_time`, `final_outcome` (PASS/SCRAP).   

**Scrap**

- Whether a unit can be scrapped at a step is encoded in `ProcessStepDefinition` (based on safety/economics).  
- Scrap instances log a **scrap reason category** (COMPONENT, PROCESS, DESIGN, SAFETY, etc.).

**Key entities (Prisma models)**

- **Unit** – one watch, identified by serial; links to a `Kit` and final status.  
- **Kit** – aggregation of module `ComponentLot`s used for a unit.  
- **ComponentLot** – supplier lots for components/modules.  
- **ProcessStepDefinition** – defines a step in the flow: name, order, `stepType`, allowed rework targets, scrappability.  
- **ProcessStepExecution** – one unit’s pass through a step: timestamps, stationId, fixtureId, operatorId, `result` (PASS/FAIL/SCRAP), `failureCode`, optional `reworkLoopId`.  
- **CTQDefinition** – CTQs per step: name, units, LSL/USL, target, `isCritical`, `direction` (TWO_SIDED, HIGHER_BETTER, LOWER_BETTER). Read-only in the UI.  
- **Measurement** – CTQ values for a `ProcessStepExecution` (numeric value + optional JSON for raw curves).  
- **Fixture** – fixtures/tools: code, type, station, calibration metadata, status.  
- **Episode** – corrective-action episodes: title, summary, `status` (OPEN/CLOSED/MONITORING), `rootCauseCategory` (COMPONENT/FIXTURE/PROCESS/DESIGN/OPERATOR), time window, affected steps/CTQs/lots (JSON), before/after metrics (JSON), `effectivenessTag` (EFFECTIVE/MIXED/INEFFECTIVE), externalLinks.   

All entities live in a single relational DB (SQLite) accessible via Prisma.

---

## 5. Metrics & Analytics

**Metric definitions**

- **Station Yield** = passes / total executions at that station (all attempts).  
- **Station FPY** = units that passed the station on their **first** execution (no `reworkLoopId`) / units entering.  
- **Line FPY** = units that pass all required steps with **no** rework loops.  
- **RTY** = product of per-step FPYs along the nominal forward path.  
- **DPMO** = defects per N units (implementation detail).   

Definitions are not exposed as formulas in the UI, but the chat assistant can explain them.

**Time bucketing**

- All dashboards support `hour`, `shift`, `day`, and `week` time slicing.

**Thresholds & visuals**

- Per-metric targets & thresholds (RTY, FPY, key CTQs) drive green/yellow/red state:
  - Green = within spec, Yellow = warning, Red = out of spec.  

**Bottlenecks**

- For a selected time range, highlight:
  - Station with highest average cycle time.  
  - Stations with WIP buildup or low FPY.

---

## 6. Core Features (Epics)

**Epic 1 – Line Overview Dashboard**

- Top cards: Line RTY, throughput, overall rework %, scrap %, top bottleneck stations.  
- Yield over time charts (RTY/FPY).  
- Station FPY Pareto.  
- Rework/scrap breakdown.  
- Anomaly banners when thresholds are crossed.   

**Epic 2 – Unit Traceability**

- Serial search → Unit Timeline.  
- Timeline is an ordered list of `ProcessStepExecution`s (repeated steps visible).  
- Rework loops grouped and labeled (“Rework Loop #1 – Leak Test failure → Seal rework → Leak Test pass”).  
- Summary chips: rework loop count, final status, key lots.  
- Drill-down from a unit to its Kit, Fixtures, and related Episodes.

**Epic 3 – Lots & Fixtures**

- Lots tab: list component lots with yields, rework/scrap, and failure patterns; highlight “bad actor” lots.  
- Fixtures tab: fixture health metrics (usage count, correlated failure rates, calibration dates) and warnings for suspicious fixtures.   

**Epic 4 – Episodes & Similarity Engine**

- Episodes tab: list all corrective-action episodes with sortable columns.  
- Episode detail: summary, root cause category, affected steps/CTQs/lots, before/after metrics, links.  
- When an anomaly is detected on Line Overview/Station view, automatically compute similarity vs. historical Episodes using, in priority order:
  1. CTQ drift patterns,  
  2. Station yield patterns,  
  3. Lot mix,  
  4. Fixture/tool IDs.  
- Show ranked similar Episodes with cards and a short “why this is similar” explanation string.   

**Epic 5 – Natural Language Assistant (MVP)**

- Persistent chat panel on the right.  
- Supports queries like:
  - “Show RTY for Line 3 last week.”  
  - “Find all episodes involving Taptic fixture drift.”  
  - “Which lots correlate with leak test failures today?”  
- Queries structured metrics and unstructured text (Episode summaries, notes).  
- Suggests related metrics when a query is ambiguous; can explain key terms like RTY/FPY.   

**Epic 6 – Data Simulation & Streaming**

- Data generator script creates realistic Ultra-2-like process data at scale (units, lots, step executions, CTQs, rework, scrap).  
- “Live mode” periodically inserts new executions so dashboards update in near-real-time.  
- Data quality checks; if impossible states appear, the UI shows warnings.   

---

## 7. UX, Tech Stack, and Non-Functional

**UX & Navigation**

- Primary layout: **table/dashboard-first**, with the 9-step FATP flow as a secondary interactive diagram on relevant pages.  
- Left sidebar tabs: Line Overview (default), Stations, Units, Lots, Fixtures, Episodes/RCA, Settings/Schema.  
- Screens are compact, expert dashboards with cards + key charts, with deeper detail on drill-down.  
- Interaction: primarily point-and-click, with clear filters; minimal keyboard shortcuts as stretch.   

**Tech stack**

- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS.  
- Backend: Next.js API routes using TypeScript.  
- DB: SQLite via Prisma ORM.  

**Performance**

- Serial search and standard filters: < 500 ms perceived latency.  
- Similarity search: ideally ≤ 2–3 seconds for demo-scale data.

**Security & reliability**

- No real Apple data; About page states data is synthetic.  
- Single user; no auth needed for the demo.  
- Dataset is mostly clean but app can show data-quality warnings.

---

## 8. Roadmap (Post-v1, Storytelling Only)

- Real MES/test-log integration.  
- Multi-factory, multi-product support.  
- Role-based views (Exec, QE, PE).  
- Alerting via email/Slack/iMessage.  
- UI-editable, versioned CTQs and process configs.   
