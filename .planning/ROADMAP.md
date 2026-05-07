# Roadmap: CodePulse Command Center

## Milestones

- ✅ **v4.0 Operational Excellence** — Phases 1-7, 58, 59 (shipped 2026-04-14, updated 2026-05-06)

## Phases

<details>
<summary>✅ v4.0 Operational Excellence (9 phases, 42 plans) — SHIPPED 2026-05-06</summary>

- [x] Phase 1: UI Foundation (4 plans) — Paperclip design language, shadcn/ui, oklch palette
- [x] Phase 2: Bidirectional Telemetry (4 plans) — WebSocket consumer + command sender
- [x] Phase 3: Interaction Layer (6 plans) — Inbox, Command Palette, Agent Chat, Live Run, Insights Chat
- [x] Phase 4: Task Management (6 plans) — Kanban, Ideation Findings, Config Editor, Cron management
- [x] Phase 5: Data Pipeline (5 plans) — Aggregation, retention, cursor pagination
- [x] Phase 6: Alert Routing (5 plans) — Rules, webhooks, lifecycle, notification preferences
- [x] Phase 7: Intelligence Layer (5 plans) — Cost forecasting, briefings, anomaly detection, memory quality
- [x] Phase 58: Infrastructure Layer (1 plan) — Command catalog on Capabilities page
- [x] Phase 59: Rubric-Inspired Observability (5 plans) — Operations page with agent status grid, cron calendar, pipeline flow

Full details: [milestones/v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md)

</details>

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. UI Foundation | v4.0 | 6/6 | Complete   | 2026-05-07 |
| 2. Bidirectional Telemetry | v4.0 | 4/4 | Complete | 2026-03-22 |
| 3. Interaction Layer | v4.0 | 6/6 | Complete | 2026-03-29 |
| 4. Task Management | v4.0 | 6/6 | Complete | 2026-04-03 |
| 5. Data Pipeline | v4.0 | 5/5 | Complete | 2026-04-06 |
| 6. Alert Routing | v4.0 | 5/5 | Complete | 2026-04-09 |
| 7. Intelligence Layer | v4.0 | 5/5 | Complete | 2026-04-12 |
| 58. Infrastructure Layer | v4.0 | 1/1 | Complete | 2026-04-14 |
| 59. Rubric-Inspired Observability | v4.0 | 5/5 | Complete | 2026-05-06 |

### Phase 1: Design Studio — sandboxed design preview, artifact storage, template gallery, export

**Goal:** Integrate nexu-io/open-design into CodePulse as a first-class Design Studio page with two modes: iframe embed for immediate full-featured access and a native Paperclip-styled UI reimplementing the full Open Design workflow (skill selection, discovery, direction picking, live streaming generation, sandboxed preview, multi-format export).
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12
**Depends on:** Phase 0
**Plans:** 6/6 plans complete

Plans:
- [x] 01-00-PLAN.md — Wave 0: Dockerfile for Open Design daemon + 6 test stub files
- [x] 01-01-PLAN.md — Foundation: types, API client, Convex tables, hooks, Docker sidecar
- [x] 01-02-PLAN.md — Page shell, iframe embed, daemon status badge, route/nav registration
- [x] 01-03-PLAN.md — Native UI wizard shell + catalog steps 1-3 (skill, design system, brief)
- [x] 01-04-PLAN.md — Native UI steps 4-6 (direction picker, streaming preview, export panel)
- [x] 01-05-PLAN.md — Project gallery, ZIP import, page integration, Convex sync

---

*Last updated: 2026-05-07 — Phase 1 Design Studio revised (6 plans, 4 waves). Added Wave 0 plan, fixed direction generation, fixed dependencies.*
