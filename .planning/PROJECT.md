# CodePulse

## What This Is

Multi-provider operational command center for Ástríðr AI assistant. React 19 + Vite + Convex SPA with 15 dashboard pages, 50+ Convex tables, and 110+ UI components. Features bidirectional WebSocket telemetry, multi-provider cost intelligence (7 providers), gateway observability with quota/routing/spend controls, agent chat with generative UI blocks, unified inbox, task Kanban, intelligent alerting with Discord/Slack/PagerDuty/Email/GitHub Actions delivery, cost forecasting, anomaly detection, LLM-powered session briefings, and call graph visualization.

## Core Value

Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard. And now: take action on it.

## Current Milestone: v11.0 Skills Command Center — Full Lifecycle & Launch

**Goal:** Turn the Skills page from a read-only catalog into a real control surface — add, move, archive, restore, delete, and *launch* skills live, executed on the host by the Forge daemon.

**Target features:**
- **Real skill intake** — flip today's dry-run validator (`IntakeModal`: "Validation only — nothing is written… intake execution has no live daemon yet (Phase 8)") into an actual install. Host daemon writes a SKILL.md (upload or GitHub URL) to **global / project / cold storage**, then rescans the registry so it appears. Closes the deferred "Phase 8" intake-executor gap.
- **Skill lifecycle mutations** — in-app **archive** (active→cold storage, frees context/tokens but stays tracked as dormant), **restore** (cold→active), **move** between global/project, and **delete** — *archive-first*, with true file deletion behind an explicit confirm (house rule: archive, don't `rm`). Respects `isShadowing` (dormant copy shadowed by an active same-name skill). Kills the current "run `/manage-skills` in a terminal" dead-end (`ColdStorageView`).
- **Skill launch / dispatch** — a real **Run** action (today "Open in Chat" only *prefills* `/skillname`) targeting all three: **Chat (auto-send via `chat.send`)**, **Forge agent launch** (agent/workspace/mode, skill as the instruction, reuses `enqueueLaunch`), and **through Ástríðr / a chosen persona**.
- **Control-surface UX** — per-row overflow menu (⋯: Move / Restore / Archive / Delete / Run) **plus** drag across **Global / Project / Cold Storage** lanes; wire up the coded-but-unused `isShadowing`; super usable, efficient, complete.
- **Cross-repo Forge daemon executor** — the load-bearing piece: the daemon gains intake + lifecycle handlers + a registry rescan so origins/scope update after any mutation. Nothing above works live without it.

**Key context / constraints:**
- **Cross-repo, daemon is the critical path.** Reuses the existing Forge command channel (`forgeCommands` queue, optimistic rows, TTL/expiry, Clerk fail-closed auth, daemon-offline degradation). Pinning down where the daemon code lives (separate `forge` repo vs astridr-repo) is execution step 1.
- **Live-integration gate closed *during* execution, not claimed after** — the v9.0 War Room lesson (feature was GREEN in tests but had never run end-to-end); every mutation verified against a running daemon before "done."
- **Skill identity is composite `(name, origin)`**; scope is encoded in `origin` (`claude-code` = global, `claude-code:project:<hash>` = project, `claude-code:available` = dormant/cold). Intake `destination` union already carries `global|project|cold`.
- Continues phase numbering — **Phase 97 (Skill Lifecycle Management)**, already promoted from backlog 999.1 on 2026-07-17, becomes the first phase of this milestone; new phases run 97+.

> **Formalized 2026-07-17 via `/gsd-new-milestone`.** Requirements + roadmap defined below / in REQUIREMENTS.md + ROADMAP.md.

## Current State

**v11.0 Phase 98 complete (2026-07-21):** Skill Lifecycle Mutations shipped — 4/4 plans across CodePulse + Forge daemon (cross-repo): `enqueueLifecycle` Convex mutation with two-layer validation, native-TS daemon executor (archive/restore/move/delete, cross-volume C:↔G: safe, host-truth re-checks), and a scope-gated ⋯ lifecycle menu on every skill row with Move/type-to-confirm-Delete dialogs. Verified 11/11 must-haves; code review found 3 criticals + 4 warnings, all fixed and test-guarded (incl. the signed-off D-05 narrowing: permanent delete is target-scoped cold-only, so a shadowed skill's dormant copy is deletable without touching the active copy). UAT approved by Larry 2026-07-21. LIFE-01..06 + DAEMON-02 validated. v11.0 resumes at Phase 99 (Skill Launch / Dispatch); Phase 100 (Control-Surface UX) depends on 98+99.
**v12.0 COMPLETE — Phase 102 tech-debt close-out (2026-07-23):** Both milestone-audit tech-debt items closed and live-verified — dead `dueSoon`/`overdue` queries + `by_dueAt` index removed from codepulse (index drop deployed to the live self-hosted backend), dead `CodePulsePoster` deleted + stale two-backend narrative swept in astridr-repo (commits on astridr `main`, merged into `feature/brain-swap`; prod + war-room containers rebuilt and verified), one real calendar tick pushed 75 events / 0 failures with events rendering on `/reminders`. Verification 10/10; advisory review (`102-REVIEW.md`) queued 4 warnings (orphaned `by_status` index, `send_to` silent-failure counting, all-day `strptime` guard, snooze-after-done recurrence dupe) for a future tech-debt pass. Milestone formal close-out/archive pending (`/gsd-complete-milestone`).
**v12.0 Phase 101 complete (2026-07-20):** Reminders & Calendar Command Center shipped — 7/7 plans (incl. 101-07 UAT gap closure), verification passed (mutation-tested regression guard), live UAT 9/10 passed with the sole gap closed. Convex `reminders` store is the single source of truth written by both the CodePulse UI and Ástríðr's chat tool; Ástríðr crons drive proactive nudges and the per-profile read-only Google Calendar cache. Advisory code review (`101-REVIEW.md`) flagged 2 criticals (snooze suppresses future nudges; edit popover UTC-shifts `dueAt`) to fix. v11.0 (Phases 98-100) remains paused mid-milestone.
**Phase 96 complete (2026-07-13):** UI deep-dive cleanup appended to v10.0 — 13/13 plans, re-verified 16/16 after gap closure (96-13). Every UI surface tells the truth and follows one standard: CONSOLE nav cluster dissolved, CommandPalette single-sourced from `navItems` (no more drift), fabricated header/security/automation readouts removed, orphaned pages (MissionControl/Profiles/Agents) deleted with redirects, both approval consumers (Chat ApprovalBlock + InboxCard) gate on the server ack boolean against the verified Ástríðr `approval.respond` contract, Chat subscribes to the real `run.blocks` event, and all pages share one `<PageHeader>`. Outstanding cross-repo handoff (astridr-repo, out of CodePulse scope): `chat.send` bypasses the security pipeline (`_ws_agent_launcher` never calls `process_inbound`) and no approval-type block producer exists — until those land, Chat-side approval blocks can't fire live (Inbox path verified live end-to-end).
**Shipped:** v10.0 Eval & Trace Observability + Hardening (2026-07-07) — all 3 phases (93-95), 15 plans, 9/9 requirements (EVAL-01..03, TRACE-01/02, HARD-01..04); each phase has a `VERIFICATION.md`. **Phase 93:** `evalScores` eval pipeline live end-to-end on prod — idempotent `task_quality` ingest, nightly LLM-as-judge `internalAction`, per-persona quality KPI grid + regression detection (verified 18/18, real cross-repo score path). **Phase 94:** `traceId` grouping live end-to-end — Ástríðr per-turn contextvar at `_process_inner` → all 3 provider emits → `/runtime-ingest` alias → `llmMetrics.traceId` → Gantt `TraceWaterfall` on SessionDetail (`?tab=trace`) + Analytics cross-link; dead `LangfuseTraceLink.tsx` deleted (verified 22/22 + operator sign-off). **Phase 95:** TypeScript 6.0.3 green via one tsconfig fix + react-day-picker deleted + four folded majors verified (HARD-03/04); Forge & Ástríðr ingest keys verified real on both sides via a live round-trip, no rotation (HARD-02); `/cso` audit SHIP — 0 vulns, 0 secrets, 4 LOW findings all remediated (ingest fail-closed, LLM action auth-gated, `.gitignore`, CI SHA-pins) (HARD-01); verified 16/16. Also fixed the Forge daemon (SQLite migration FK crash + ingest-config durability, merged to forge master). Archive: `milestones/v10.0-ROADMAP.md`.
**Prior shipped:** v9.0 Readability & Experience (2026-06-29) — all 5 phases (88-92), 30 plans, 19/19 requirements (TH-01..06, AR-01..03, ROOM-01..04, G3D-01..02, VOX-01..04). Durable ingest-time analytics rollups replacing fragile `.take()` caps (under Convex 16 MiB/exec at any volume); a fully token-driven theme system with a WCAG-AA readable theme + Midnight Aubergine editorial skin + no-flash persisted switcher (axe-clean across 4 themes × 5 surfaces); the Agent/War Room finished into a real multi-persona surface with a genuine operator Join via LiveKit (closed 5 live cross-repo integration gaps); an opt-in lazy-loaded `react-force-graph-3d` mode on `CodeVaultGraph` (~4,038 nodes at ≥30 FPS, operator GPU sign-off); and a local-wake-word Voice Command Palette (openWakeWord ONNX, no Picovoice). Archive: `milestones/v9.0-ROADMAP.md`.
**Earlier shipped:** v8.0 Graph/KG Consolidation (2026-06-23) — all 5 phases (83-87), 8/8 requirements (GH-01..04, KG-08..11), milestone audit PASSED: graph-snapshot receiver, unified `/graphs` hub, cross-graph tool→agent→KG navigation, community-cluster layout, full-text KG Search, saved/shareable views, and KG temporal Diff/Animate. Deployed to prod `tidy-whale-981`. Archive: `milestones/v8.0-ROADMAP.md`. v7.0 Forge Integration (2026-06-17) — Forge folded into CodePulse via the Surface-Substrate bridge: a local daemon emits state UP through bearer-authed Convex httpActions, and CodePulse sends commands DOWN through a Convex queue the daemon polls. Clerk-gated; no localhost/mixed-content path. Archive: `milestones/v7.0-ROADMAP.md`. v5.0 Advanced Visualization & Integrations (2026-05-25). v6.0 Agentic OS Front-End **closed 2026-06-18** — phases 71-74 shipped (light); 77 (CI hardening) complete; 75 (Agent Console) superseded by v7.0 Forge; **76 (Unified Graph Hub) NOT shipped → deferred to v8.0** (2026-06-18 reconciliation).
**Stack:** React 19, Vite 7, TypeScript 6.0, Tailwind CSS 4, Convex, shadcn/ui New York, Lucide icons, D3.js, dagre, Resend, React Email
**Codebase:** ~86,100 LOC TypeScript, non-test (src/ + convex/) — grew with v9.0 analytics rollup, theming, War Room, 3D, and voice surfaces

<details>
<summary>v4.0 — Operational Excellence (2026-04-14)</summary>

8 phases: UI Foundation, Bidirectional Telemetry, Interaction Layer, Task Management, Data Pipeline, Alert Routing, Intelligence Layer, Infrastructure Layer.
</details>

v5.0 added 12 phases:
1. Schema Foundation — 4 new tables, 2 extensions for all v5.0 features
2. Context Window Animation — real-time progress bar with compaction markers
3. Token Sunburst — two-level ring chart for per-agent/tool token consumption
4. Email Digest — scheduled HTML summary via Resend
5. Call Graph — directed agent/tool dependency graph with dagre layout
6. PagerDuty — incident trigger/resolve via Events API v2
7. GitHub Actions — workflow_dispatch from alert rules
8. Gateway Compatibility — central provider registry, OTel fix, gateway event routing
9. Multi-Provider Pricing — GPT/Gemini pricing, billingType, subscription vs API split
10. Gateway Observability — quota gauges, routing decisions, provider comparison
11. SDK Spend Guard — provider controls, spend cap, session provider badges
12. External Integrations & Call Graph — email/PagerDuty delivery + call graph visualization

## Shipped Milestone: v10.0 Eval & Trace Observability + Hardening ✅ (shipped 2026-07-07)

**Delivered:** all 3 phases (93-95), 15 plans, 9/9 requirements, each phase verified. Full detail: `milestones/v10.0-ROADMAP.md`.

**Goal:** Close the loop on agent-output quality and per-call traceability — receive and judge the quality scores Ástríðr already emits, render LLM call chains natively — and harden the platform (security audit, key rotation, major dependency migrations).

**Target features:**
- **Eval pipeline + ingest** — `evalScores` table + ingest endpoint for Ástríðr's `task_quality` scores (emitted by `langfuse_eval.py` but currently dropped — no receiving endpoint, table, or UI exists); nightly Convex `internalAction` LLM-judging sampled sessions on a rubric; quality KPI + regression detection when a persona's model/instructions change.
- **Native trace waterfall** — `traceId` grouping field on `llmMetrics`; in-app call-chain UI with timing bars, cost-per-call, and cache annotations (replaces the dead-link `LangfuseTraceLink.tsx`); self-hosted Langfuse/Phoenix explicitly deferred — the data is already in Convex.
- **Hardening** — `/cso` code-security audit + remediation of confirmed findings; Forge ingest-key rotation (deployment memory records a placeholder key); TypeScript 5.9→6 and react-day-picker 9→10 major-bump migrations (both CI-red as dependabot PRs, closed 2026-07-04 and folded here).

> **Seeded 2026-06-30** (`.planning/todos/pending/eval-and-trace-observability-v10.md`, from the cross-repo capability audit), formalized 2026-07-04 via `/gsd-new-milestone`. Both observability features ride existing `llmMetrics`/ingest data — no new transport from Ástríðr. Adjacent audit-#5 ingest data-loss bug already fixed (`aa145cd`). Continues phase numbering — v10.0 starts at Phase 93.

## Shipped Milestone: v8.0 Graph/KG Consolidation

> **Shipped 2026-06-23** (started 2026-06-18). 5 phases (83-87), 17 plans, 8/8 requirements (GH-01..04, KG-08..11); milestone audit PASSED. Completed the Unified Graph Hub that Phase 76 (v6.0) never shipped and deepened the KG Explorer (Phase 74): graph-snapshot receiver (stops dropping Ástríðr's nightly snapshots — the full ~4,038-node real graph is now live) + `/graphs` hub + cross-graph navigation + KG search / clustering / saved-views / temporal-diff. Two follow-ons are data-gated on cross-repo Ástríðr deltas (live full-text search needs `/api/kg/search`, SEED-008; live community clustering needs `community` emission, D-10) — the CodePulse side is complete and degrades gracefully today. Archive: `milestones/v8.0-ROADMAP.md`; audit: `milestones/v8.0-MILESTONE-AUDIT.md`.

## Shipped Milestone: v9.0 Readability & Experience

> **Shipped 2026-06-29** (started 2026-06-23). 5 phases (88-92), 30 plans, 19/19 requirements (TH/AR/ROOM/G3D/VOX). Archive: `milestones/v9.0-ROADMAP.md`; the 2026-06-26 audit (`milestones/v9.0-MILESTONE-AUDIT.md`) is a mid-flight `gaps_found` snapshot taken before Phases 90/91 were built (both shipped 2026-06-27..29). Accepted tech debt at close: Phases 88 & 90 lack a formal `VERIFICATION.md` (covered by Nyquist VALIDATION + operator live sign-off respectively).

**Goal:** Make CodePulse readable and richer to operate — a readability-first theme system plus three experience surfaces (Agent Room, 3D graph mode, durable analytics).

**Target features:**
- **Readable themes + editorial skin toggle** (Phase 89, partly in flight) — token-driven theming (finish the Phase 71 audit), a WCAG-AA readability-first theme, the "Midnight Aubergine" editorial skin, keep Matrix-Emerald as an option, a no-flash persisted switcher honoring `prefers-reduced-motion`, and an a11y/contrast pass.
- **Agent Room** — audit the existing room/war-room/voice/`hr/` scaffolding, then complete it into a usable multi-persona surface (scope finalized after the research/audit pass).
- **3D Memory Galaxy** — an optional React Three Fiber 3D render mode toggle for `CodeVaultGraph` (reuses the existing graph data; reverses the prior "3D out of scope" call — see Key Decisions).
- **Analytics Rollup** (Phase 88, quick-unblock already deployed) — a durable Convex 16 MiB/exec read-limit fix via ingest-time rollups, replacing the fragile `.take()` count caps.

> **Seeded 2026-06-22**, formalized 2026-06-23 via `/gsd-new-milestone`. Phase 89 already has `ThemeSwitcher` shipped (default skin now Electric Cyan); Phase 88 quick-unblock deployed (`edb614c`). Continues phase numbering — Agent Room + 3D galaxy become Phase 90+. Requirements + roadmap defined below / in ROADMAP.md.

## Closed Milestone: v6.0 Agentic OS Front-End

> **Closed 2026-06-18** (reconciled against live code). Phases **71/72/73/74 shipped** (light-mode); **75 (Agent Console) superseded** by v7.0 Forge; **77 (CI & Production Hardening) complete** (3/3). **76 (Unified Graph Hub) was NOT shipped** — only the 3 standalone graph pages exist; its HUB-01/02/03 requirements are **absorbed into v8.0** (GH-01..04). All DS/GAL/MCP/KG/CON/HUB/OPS requirements retained in REQUIREMENTS.md — nothing dropped.

## Requirements

### Validated (v4.0)

- ✓ Paperclip design language (shadcn/ui New York, oklch, zero border-radius) — v4.0 Phase 1
- ✓ MetricCard, EntityRow, FlexBarChart patterns across all pages — v4.0 Phase 1
- ✓ Compact 240px sidebar with live count badges — v4.0 Phase 1
- ✓ Bidirectional WebSocket with topic subscriptions and command sending — v4.0 Phase 2
- ✓ Real-time dashboard updates within 1 second — v4.0 Phase 2
- ✓ Generative UI Block system with BlockRenderer dispatcher — v4.0 Phase 3
- ✓ Command Palette (Cmd+K) with entity search — v4.0 Phase 3
- ✓ Agent Chat with approval gates — v4.0 Phase 3
- ✓ Unified Inbox with keyboard navigation — v4.0 Phase 3
- ✓ RunTimeline with Flow DAG visualization — v4.0 Phase 3
- ✓ Insights Chat with LLM backend — v4.0 Phase 3
- ✓ 6-column Kanban with drag-and-drop — v4.0 Phase 4
- ✓ Ideation Findings with status workflow — v4.0 Phase 4
- ✓ Config Editor with diff preview and hot-reload — v4.0 Phase 4
- ✓ Cron management with visual builder — v4.0 Phase 4
- ✓ Time-series aggregation (hourly + daily rollup) — v4.0 Phase 5
- ✓ Data retention with configurable archival — v4.0 Phase 5
- ✓ Cursor-based pagination across 7 domains — v4.0 Phase 5
- ✓ Analytics on pre-computed aggregates — v4.0 Phase 5
- ✓ Configurable alert rules (static + compound) — v4.0 Phase 6
- ✓ Discord/Slack webhook delivery with retry — v4.0 Phase 6
- ✓ Alert lifecycle (acknowledge/mute/escalate) — v4.0 Phase 6
- ✓ Per-severity notification preferences — v4.0 Phase 6
- ✓ Cost forecasting with budget thresholds — v4.0 Phase 7
- ✓ LLM-generated session briefings with daily digest — v4.0 Phase 7
- ✓ Anomaly detection with z-score auto-alerts — v4.0 Phase 7
- ✓ Memory quality metrics (dedup, staleness, contradictions) — v4.0 Phase 7
- ✓ WebSocket command catalog on Capabilities page — v4.0 Phase 58

### Validated (v5.0)

- ✓ Call graph with dagre layout, node state coloring, error path highlighting — v5.0 Phase 63/70
- ✓ Context window animated progress bar with compaction markers — v5.0 Phase 60
- ✓ Token sunburst two-level ring with drill-down — v5.0 Phase 61
- ✓ Email digest delivery via Resend with configurable schedule — v5.0 Phase 62/70
- ✓ PagerDuty trigger/resolve via Events API v2 with dedup_key — v5.0 Phase 64/70
- ✓ GitHub Actions workflow_dispatch from alert rules — v5.0 Phase 65
- ✓ Central provider registry (7 providers, 3 legacy + 4 gateway) — v5.0 Phase 66
- ✓ Multi-provider cost intelligence with billingType dimension — v5.0 Phase 67
- ✓ Gateway observability (quota, routing, tasks, comparison) — v5.0 Phase 68
- ✓ SDK spend guard with projected daily totals — v5.0 Phase 69

### Validated (v7.0 Forge Integration)

- ✓ FI-01 … FI-14 — Forge folded into CodePulse (schema/emitter, read UI, command bridge, live logs, files/preview, hardening) — Phases 78-82 (shipped 2026-06-17)

### Validated (v8.0 Graph/KG Consolidation)

- ✓ GH-01 — Graph-snapshot receiver: `graphSnapshots` table + `runtimeIngest` dispatch (idempotent on `snapshotId`) + read query API; stops dropping Ástríðr's nightly snapshots — Phase 83 (2026-06-18)
- ✓ GH-02 — `/graphs` landing renders the pushed code (graphify) + vault (Obsidian) graph from Convex, reusing `ForceGraphCanvas`, with truncation indicated — Phase 84 (2026-06-22)
- ✓ GH-03 — Unified Graphs hub: KG Explorer, Tool Galaxy, MCP Inventory, code/vault graph reachable from one hub — Phase 84 (2026-06-22)
- ✓ GH-04 — Cross-graph navigation: deep-link tool → owning agent → KG entity — Phase 85 (2026-06-22)
- ✓ KG-08 — Full-text fact/relationship Search lens (backed by Ástríðr `/api/kg/search`) — Phase 86 (2026-06-23); live results data-gated on the Ástríðr endpoint (SEED-008), graceful-degrade gate shipped
- ✓ KG-09 — Clustering / community-detection layout for large graphs — Phase 86 (2026-06-23); live halos data-gated on Ástríðr `community` emission (D-10), no-regression when absent
- ✓ KG-10 — Named, saved, and shareable graph views (beyond last-state idb persistence) — Phase 87 (2026-06-23)
- ✓ KG-11 — Temporal diff / animation between two as-of points — Phase 87 (2026-06-23)

Full definitions + traceability: archived in `.planning/milestones/v8.0-REQUIREMENTS.md` (fresh `REQUIREMENTS.md` is created by the next `/gsd-new-milestone`). Closed v6.0 requirements (DS/GAL/MCP/KG/CON/HUB/OPS) retained in the archive as well.

### Validated (v12.0 Personal Productivity — Reminders & Calendar — Phase 101 complete 2026-07-20)

- ✓ REM-01..05 — Convex `reminders` source-of-truth table + CRUD/recurrence engine (`computeNextDueAt`, spawn-on-complete), authed `/reminders-ingest`//`/reminders-read` endpoints, Ástríðr `reminders` tool (add/list/update/complete/snooze via chat, `source:"astridr"`), proactive due-reminder nudges (Ástríðr cron, `notifiedAt` dedupe, recurrence roll-forward) — Phase 101 plans 01-03/05 (verified + live UAT 2026-07-20)
- ✓ CAL-01..02 — Read-only Google Calendar cache: Ástríðr cron fetches per-profile calendars → `/calendar-ingest` → `calendarEvents`; CodePulse calendar overlay beside the reminder list (browser never touches Google) — Phase 101 plans 04/02/06
- ✓ UI-01..02 — Profile-segmented (personal/business/consulting) Reminders command-center page: grouped list (Overdue/Today/Upcoming/Done), quick actions, QuickAdd, day-filter with undated-reminder exemption (101-07 gap closure, UAT test 8) — Phase 101 plans 06/07

Post-completion advisory: `101-REVIEW.md` (2 critical, 6 warning) — snooze-vs-nudge dedupe and edit-popover timezone handling to fix before heavy live use.

### Validated (v10.0 Eval & Trace Observability + Hardening — shipped 2026-07-07)

- ✓ EVAL-01..03 — Per-persona quality persistence (`evalScores` + idempotent `task_quality` ingest + Ástríðr mirror), nightly 4-dimension LLM judge (isolated `intelligence.llm_eval` slot, rubric v1, previous-complete-day window), window-mean regression detection with delivered alerts + `/quality` KPI grid/drill-in — Phase 93 (2026-07-06, live E2E operator-verified; quality trends gated on E3 ≥0.7 judge-calibration agreement, labels pending)
- ✓ TRACE-01..02 — `traceId` grouping on `llmMetrics` + in-app Gantt `TraceWaterfall` (per-turn LLM call chains, cost/cache annotations, `?tab=trace` deep-link + Analytics cross-link) replacing the dead `LangfuseTraceLink` — Phase 94 (2026-07-06, verified 22/22 + operator live sign-off)
- ✓ HARD-01..04 — `/cso` audit SHIP (0 vulns, 0 committed secrets, 4 LOW findings all remediated: ingest fail-closed, `insightsChat.ask` auth-gated, `.gitignore` broadened, CI SHA-pinned); Forge & Ástríðr ingest keys verified real on both sides via a live real-emitter round-trip (no rotation); TypeScript 6.0.3 green + react-day-picker deleted + four folded dependency majors verified — Phase 95 (2026-07-07, verified 16/16)

### Validated (v9.0 Readability & Experience)

- ✓ TH-01..06 — Token-driven theming (~77 hex sites migrated, `useThemeColors()` resolver), WCAG-AA readable theme, Midnight Aubergine editorial skin, Matrix-Emerald + Electric Cyan retained, no-flash persisted switcher honoring `prefers-reduced-motion`, axe-clean a11y pass (4 themes × 5 surfaces) — v9.0 Phase 89
- ✓ AR-01..03 — Ingest-time analytics rollups (`analyticsRollup.ts` + `lib/sankeyClassify.ts`), idempotent dedup, historical backfill run against prod, all `.take()` count caps removed, reads O(buckets) under Convex 16 MiB/exec — v9.0 Phase 88
- ✓ ROOM-01..04 — War Room real participant identity (`useRosterAgents`), bounded listing, genuine operator Join via LiveKit + Ástríðr token endpoint, per-room deep-links + `seq`-ordered transcripts; 5 live cross-repo gaps closed — v9.0 Phase 90 (operator live sign-off)
- ✓ G3D-01..02 — Opt-in lazy-loaded `react-force-graph-3d` mode on `CodeVaultGraph` (three.js confined to lazy chunk), ~4,038-node graph at ≥30 FPS (operator GPU sign-off), clean WebGL disposal, theme-aware via `useThemeColors()` — v9.0 Phase 91
- ✓ VOX-01..04 — Local in-browser openWakeWord ONNX wake-word, Web Speech STT via shared `useSpeechRecognition`, streamed reply + persona TTS, safe-by-default OFF toggle with graceful model-load failure — v9.0 Phase 92

Full definitions + traceability: archived in `.planning/milestones/v9.0-REQUIREMENTS.md`.

### Out of Scope

- Mobile app — web-first, responsive layouts sufficient
- Multi-tenant — single operator dashboard
- OpenTelemetry collector — Convex handles persistence
- Bidirectional PagerDuty sync — inbound webhook complexity disproportionate for single operator
- ~~React Three Fiber / 3D visualizations~~ — **reversed in v9.0** (3D Memory Galaxy, opt-in mode for CodeVaultGraph); see Key Decisions

## Context

- **Ástríðr repo:** C:\Users\mandr\astridr-repo (WebSocket endpoint + CLI Gateway)
- **CodePulse repo:** C:\Users\mandr\codepulse
- **Design reference (updated 2026-07-07):** shadcn/ui New York + Tailwind 4, token-driven with a runtime theme switcher (`ThemeSwitcher.tsx` / `useThemeColors()`, v9.0 Phase 89). `<html data-theme>` persisted in `localStorage["codepulse-theme"]`; dark themes are `cyan` (Electric Cyan `#06b6d4`, **default**), `emerald` (Matrix Emerald `#10b981`), `readable` (WCAG-AA, effects off), `aubergine` (editorial); light `:root` is monochrome oklch "Paperclip". Geist + JetBrains Mono (Cinzel retired), Lucide icons, effective radius `0.5rem`, zinc neutrals, glow/CRT effects. Tokens live in `src/index.css` `[data-theme]` blocks — never hardcode hex. *(The design-system unification originally specced as "Phase 71" shipped across v7–v9; its spec is archived under `milestones/`.)*
- **Stack:** React 19, Vite 7, TypeScript 6.0, Tailwind CSS 4, Convex, shadcn/ui, Lucide, React Flow, D3.js, dagre, Resend, React Email
- **Providers:** 7 total — Anthropic Direct, OpenRouter, Ollama (legacy); Claude CLI, Codex CLI, Antigravity CLI, Claude SDK (gateway)
- **Codebase:** ~86,100 LOC TypeScript (non-test), 50+ Convex tables, 15 dashboard pages, 110+ UI components

## Constraints

- **Cross-repo:** WebSocket endpoint in Ástríðr repo, consumed by CodePulse
- **Convex:** All persistence through Convex — no direct database access
- **Backward compatible:** /ingest and /runtime-ingest endpoints must continue working

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Paperclip as design reference | Information-dense, monochromatic, professional operational feel | ✓ Good — consistent across 15 pages |
| shadcn/ui New York over custom components | Consistent design system, Radix primitives, community maintained | ✓ Good — reduced custom component code |
| Custom CSS flex charts over Recharts | Compact, lightweight, matches Paperclip aesthetic | ✓ Good — smaller bundle, better fit |
| WebSocket for real-time over polling | Sub-second latency, reduces HTTP traffic | ✓ Good — validated in Phase 2 |
| Convex .paginate() for list views | Server-side cursors, no full-table scans | ✓ Good — 7 domains paginated |
| Compound AND/OR alert rules | Flexible alert conditions beyond simple thresholds | ✓ Good — extensible rule engine |
| Z-score anomaly detection | Statistical approach, no ML dependency | ✓ Good — auto-creates alerts |
| WebSocket command catalog | Live registry vs static Convex count | ✓ Good — real-time command visibility |
| Central provider registry | Single source of truth for all 7 providers | ✓ Good — eliminates hardcoded provider arrays |
| D3 for sunburst/area, dagre for call graph | Recharts insufficient for ring/graph viz | ✓ Good — clean D3/React ownership split |
| Resend for email digest | Consistent with Convex action pattern | ✓ Good — simple API, reliable delivery |
| PagerDuty Events API v2 (not REST) | Stable dedup_key for trigger/resolve lifecycle | ✓ Good — clean incident management |
| billingType dimension on cost aggregation | Subscription vs API-billed cost separation | ✓ Good — accurate cost intelligence |
| dagre graph per-call (not module scope) | Deterministic layout on each render | ✓ Good — avoids stale layout state |
| Force-directed (react-force-graph-2d) for relationship graphs (v6.0) | Reverses the v5.0 "force-directed out of scope" call: dagre suits DAGs (call graph), but the Obsidian vault graph and Ástríðr KG are cyclic entity-relationship graphs where force layout is the right fit. Already validated by the merged Obsidian graph. | KG-viz + Obsidian graph use it; dagre retained for the call graph |
| Cross-graph nav = normalized-EXACT match, no fuzzy (v8.0, Phase 85) | A wrong jump is worse than a missing one — `focusKeysMatch` is strict equality on normalized keys; a non-match shows no link (SC#3). `decodeFromParam` constrains the return target to same-origin in-app paths. | Zero-false-positive forward links; `from`-param return chips |
| Summarize `graph_snapshot` in legacy `runtime_events` (v8.0, Phase 85) | The full {nodes,links} blob (>1 MiB) blew Convex's per-doc limit on the legacy insert, rejecting the whole ingest and silently capping the production cron; the row-based `graphSnapshots` receiver already holds the full graph. | Legacy row stores counts+sources only; full snapshots ingest (~4k nodes live) |
| Reverse "3D out of scope" for an opt-in 3D Memory Galaxy (v9.0) | The v5.0 blanket "React Three Fiber / 3D — not operationally useful" call was right for *forced* 3D, but the code/vault/KG graph is a spatial entity-relationship structure where an **opt-in** 3D mode adds genuine exploratory value without regressing the 2D default. Scoped narrowly: a render-mode toggle on the existing `CodeVaultGraph`, reusing its data — not a new immersive page. | ✓ Good — 3D opt-in only; 2D `ForceGraphCanvas` stays default; ~4,038 nodes ≥30 FPS, three.js confined to lazy chunk |
| `react-force-graph-3d` over raw R3F for 3D (v9.0, Phase 91) | The opt-in 3D mode needs force-directed layout + lazy isolation, not a `<Canvas>`/`useFrame` rewrite; `react-force-graph-3d` manages its own WebGLRenderer with a near-identical prop API to the 2D lib and avoids ~300 KB of R3F/drei. | ✓ Good — lazy chunk keeps three.js out of the 2D default bundle |
| LiveKit for the War Room operator Join (v9.0, Phase 90) | A genuine join needed real audio transport, not a cosmetic button; LiveKit (server behind a `war-room` compose profile + Ástríðr Bearer-auth token endpoint) gives real two-way voice. Surfaced that the cross-repo gate was never closed at scoping. | ✓ Good — real Join live-verified; 5 integration gaps closed; rebuilding workers evicts agents from open rooms (operational caveat) |
| openWakeWord ONNX over Picovoice for wake-word (v9.0, Phase 92) | Picovoice rejected the account; openWakeWord is Apache-2.0, runs fully in-browser via `onnxruntime-web` (no account/key/quota, no audio leaves the machine). Custom self-contained `hey_astrid.onnx` is the production model. | ✓ Good — local, key-free, safe-by-default OFF toggle |
| TS 6.0 migration is one tsconfig fix, not a code migration (v10.0, Phase 95) | All 22 PR#50 CI errors were a single root cause (Node globals unresolved after TS 6.0 stopped auto-including `@types/node`); adding `compilerOptions.types: ["node"]` fixed them all without touching any prod file. | ✓ Good — zero code churn; react-day-picker resolved by deleting a dead primitive, not a 9→10 migration |
| `validateIngestAuth` fail-closed, symmetric with Forge (v10.0, Phase 95) | `/cso` flagged the `/ingest`+`/runtime-ingest` family failing OPEN when `ASTRIDR_INGEST_API_KEY` is unset (vs the fail-closed Forge path). Now requires an explicit `ASTRIDR_INGEST_ALLOW_ANON=true` dev opt-in. | ✓ Good — removes the latent anonymous-write path; prod already had the key set |
| HARD-02 closed as verification, not rotation (v10.0, Phase 95) | The 2026-07-05 secret verification stood; a live real-emitter round-trip (Forge daemon + Ástríðr → prod Convex) proved both sides. No new rotation. | ✓ Good — honest close; surfaced + fixed a Forge daemon startup crash + a `.cloud`/`.site` checklist trap en route |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-06 — **Phase 94 (Trace Waterfall) complete**: TRACE-01/TRACE-02 validated, live-verified on prod with operator sign-off; 2 of 3 v10.0 phases done, Phase 95 (Hardening) remains. Milestone started 2026-07-04 via `/gsd-new-milestone`. Scope: eval pipeline + ingest (`evalScores`, LLM-as-judge), native trace waterfall on `llmMetrics`, hardening (cso audit, Forge key rotation, TS 6 + react-day-picker 10 majors). Continues phase numbering from 93. Prior: v9.0 SHIPPED & ARCHIVED 2026-06-29 (5 phases 88-92, 19/19 reqs, tagged v9.0); SEED-001 doc-comment HITL UI shipped outside GSD 2026-07-04 (PR #54).*

<details>
<summary>Prior footer — 2026-06-29 (v9.0 shipped)</summary>

*Last updated: 2026-06-29 after **v9.0 Readability & Experience milestone** — SHIPPED & ARCHIVED (5 phases 88-92, 30 plans, 19/19 requirements; tagged v9.0). Full evolution review complete: v9.0 reqs moved to Validated, 4 Key Decisions logged with outcomes, codebase ~86,100 LOC. Next: `/gsd-new-milestone`.*

</details>

<details>
<summary>Prior footer — 2026-06-23 (v9.0 started)</summary>

*2026-06-23 — **v9.0 Readability & Experience started** via `/gsd-new-milestone`. Scope: readable themes + editorial skin toggle (Phase 89), Agent Room (audit-first), 3D Memory Galaxy (opt-in R3F mode — reverses prior 3D out-of-scope), and Analytics Rollup (Phase 88, folded in). Continues phase numbering (Agent Room + 3D = Phase 90+). Prior: v8.0 Graph/KG Consolidation SHIPPED (phases 83-87, 8/8 requirements, milestone audit PASSED, archived + tagged).*

*2026-07-07 — **v10.0 Eval & Trace Observability + Hardening SHIPPED & ARCHIVED** (phases 93-95, 15 plans, 9/9 requirements, each phase verified). Eval pipeline + native trace waterfall + hardening (`/cso` audit, ingest-key verification, TS 6 + dependency majors). Archived to `milestones/v10.0-ROADMAP.md`, tagged `v10.0`. Cross-repo: Forge daemon FK-crash + durability fixes merged to forge master.*

</details>

---
*Last updated: 2026-07-23 — **v12.0 ALL PHASES COMPLETE** (Phase 102 tech-debt close-out done, live-verified; formal milestone close-out/archive pending). Prior: 2026-07-20 — **v12.0 Phase 101 (Reminders & Calendar Command Center) COMPLETE**: 7/7 plans incl. 101-07 UAT gap closure; REM-01..05, CAL-01..02, UI-01..02 validated (verification passed with mutation-tested regression guard; live UAT). Milestone close-out pending; `101-REVIEW.md` advisory criticals (snooze/nudge dedupe, edit-popover UTC shift) queued for fix. v11.0 paused mid-milestone (Phase 97 done; 98-100 not started).*

<details>
<summary>Prior footer — 2026-07-17 (v11.0 started)</summary>

*Last updated: 2026-07-21 — **v11.0 Phase 98 (Skill Lifecycle Mutations) complete**: 4/4 plans, verified + UAT approved, LIFE-01..06 + DAEMON-02 validated; next Phase 99. Prior: 2026-07-17 — **v11.0 Skills Command Center — Full Lifecycle & Launch started** via `/gsd-new-milestone`. Scope: real skill intake (execute today's dry-run install to global/project/cold), full skill lifecycle mutations (archive/restore/move/delete, archive-first), real skill launch to Chat/Forge-agent/Ástríðr, control-surface UX (⋯ menu + drag across scope lanes), and the cross-repo Forge daemon executor that makes it all live. Continues phase numbering from 97 (Phase 97 already promoted from backlog 999.1). Prior: v10.0 SHIPPED & closed 2026-07-13 (phases 93-96, Phase 96 UI-cleanup addendum).*

</details>

<details>
<summary>Prior footer — 2026-07-13 (v10.0 closed)</summary>

*Last updated: 2026-07-13 after Phase 96 (UI deep-dive cleanup) completion*

</details>
