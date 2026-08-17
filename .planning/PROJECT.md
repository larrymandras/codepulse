# CodePulse

## What This Is

Multi-provider operational command center for Ástríðr AI assistant. React 19 + Vite + Convex SPA with 15 dashboard pages, 50+ Convex tables, and 110+ UI components. Features bidirectional WebSocket telemetry, multi-provider cost intelligence (7 providers), gateway observability with quota/routing/spend controls, agent chat with generative UI blocks, unified inbox, task Kanban, intelligent alerting with Discord/Slack/PagerDuty/Email/GitHub Actions delivery, cost forecasting, anomaly detection, LLM-powered session briefings, and call graph visualization.

## Core Value

Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard. And now: take action on it.

## Current Milestone: v15.0 "Borealis Console" Premium UI Overhaul

**Goal:** Make CodePulse look and feel genuinely premium — calm layered matte surfaces, colour spent only on state, two signature layers (aurora Signal Horizon + Pulse ECG hero), Ástríðr's serif voice — while raising usability through honest states, quiet badges, a 3-zone header and a 4-domain sidebar. Started 2026-08-17 via `/gsd-new-milestone`, consuming the `MILESTONE-CONTEXT.md` prepared 2026-08-07.

**Target features:**

- **Quick wins + verified defect fixes** — the unanimous 3-model kill list (`hover:scale-[1.01]`, glitch-text, matrix-bg, CRT-by-default, per-item nav glow, decorative pulse dots, cyan scrollbar glow, violet search pill); fixed-geometry E-Stop; toast restyle; quiet badge law; the 900px sidebar/Settings collision; plus three code-verified defects — the fabricated Integrations row (`HeroStatsBar.tsx:161-168`, which carries a literal "simulation" comment), a destructive confirm living in a toast (`Tasks.tsx:144-145`), and `--status-ok` being identical to `--primary` (`index.css:139/165`).
- **Tokens + primitives** — layered surface tokens (`--surface-0/1/2/3`, `--hairline`) across all 5 themes; the three-hue-owner law (cyan = machine, violet = Ástríðr only, `--status-*` = state); motion tokens; shared primitives with six explicit states (loading / ready / empty / stale / unavailable / error).
- **Shell + IA** — 48px 3-zone header; 232px sidebar regrouped into 4 collapsible domains via a pure `navRegistry.ts` regroup with **no route changes**.
- **Signature layers** — aurora-textured Signal Horizon, Pulse ECG canvas hero replacing the synthetic SYSTEM LOAD bar, and the Ástríðr serif voice trialled on **one** surface before any app-wide commit.
- **WCAG-AA contrast remediation (SEED-006)** — pulled in because this milestone redefines the token palette across all 5 themes; fixing contrast separately would mean doing the token work twice, or re-baking known violations into the new palette. **Sizing is task 1** — 234 violations on the cyan Dashboard alone is *one cell of a 4×5 matrix*, and the true total is unmeasured. Do not plan against 234.
- **CR-01 analytics rollup** — move `costByModel`/`latencyOverTime`/`providerBreakdown` onto the `aggregates` rollups. A **dependency** of the six-state tile contract, not a passenger: today a single `useQuery` throw unmounts the React tree and blanks all of `/analytics`, so a tile cannot render an honest `unavailable` state until this lands.

**Key context / constraints:**

- Variant B "Borealis blend" was chosen as the design winner on 2026-08-07, and **everything was held for v15.0** — nothing was pulled into v14.0. The validated design law (12 decisions, CSS patterns, motion tokens, kill list) lives in `Skill("sketch-findings-codepulse")`; the working reference implementation is `.planning/sketches/001-dashboard-quiet-control-room/index.html`.
- **Enhance the token architecture, don't replace it.** 5 themes via `data-theme`; `readable` stays effect-free; everything gated on `prefers-reduced-motion`.
- shadcn/Radix/Tailwind-4/Lucide only — no new UI frameworks. Entry-chunk discipline holds (the canvas hero is one component, no Recharts).
- **Prefer upgrading shared primitives over per-page rewrites** — 200+ components inherit.
- `/chat` is the in-repo north star and its easing is the house easing. Do not regress it.
- Continues phase numbering from v14.0 (108–119) → **Phases 120+**.

> **Prepared 2026-08-07, started 2026-08-17.** Requirements + roadmap in REQUIREMENTS.md + ROADMAP.md.

## Prior Milestone (shipped 2026-08-17, tagged `v14.0`): v14.0 Per-Agent Engine Visibility, Convex Durability & Mission Board

**Goal:** Finish the per-agent half of brain-swap that v13.0 deliberately deferred, make the self-hosted Convex instance durable rather than nightly-restarted, and turn the leftover jobs surface into a real mission board. Formalized 2026-08-06 via `/gsd-new-milestone`.

**Outcome:** 12 phases (108–119, grown from the original 6 when 114–119 were appended 2026-08-08), **86 plans**, **15/17 requirements satisfied**, all 12 phases verified. Suite 4654 passing / 0 failing. Audit `tech_debt` — 0 blockers, 2 warnings, 5/5 E2E flows. The two exceptions are deliberate and were *not* rounded up: **MISSION-01 ⚠ PARTIAL** (duration + orphan recovery are structurally underivable on current data — no `running` row can arrive — so the requirement was split and the remainder deferred to SEED-007) and **MISSION-02 ↗ REASSIGNED** to SEED-007 (no job↔tool join key exists in astridr). Phases 114–119 were design-doc-driven, tracing to per-phase `D-NN` decisions rather than REQ-IDs. Closed BY HAND per the standing rule. Audit: `milestones/v14.0-MILESTONE-AUDIT.md`.

**Target features:**

- **Per-agent engine visibility (cross-repo, astridr-first)** — astridr emits genuine per-profile active-engine telemetry and `swap.set` gains a profile scope; CodePulse's already-built "This profile" picker scope, header badge and confirm-modal current-engine column light up on real rows instead of `{profileId:"unknown"}` sentinels. Closes **BSC-01**, v13.0's one PARTIAL requirement.
- **Convex durability** — bound `aggregates` (defined at `convex/schema.ts:953`, absent from `RETENTION_DAYS`, grows unbounded), fix the retention cron's tombstone self-defeat so tables past index `[0]` are actually pruned, and pursue the memory-growth root cause currently only masked by `ConvexNightlyRestart`.
- **Mission board (frontend-only)** — upgrade `src/components/JobsPanel.tsx` + `subagentJobs` (`convex/schema.ts:1028`, both leftovers of astridr Phase 168) into a real mission board on data that streams today: humanized tool labels, duration, status, honest orphan recovery.
- **Telemetry coverage** — Group A (5 never-emitted contract kinds) fixed as an astridr contract-doc correction, not a build; Group B (7 real emitters) domain routes justified per-kind, starting with `control_verb_swap` because per-agent visibility needs it.
- **Small-debt sweep** — skill-registry prune churn (a transient scan drops ~56 live plugin skills), the intermittent `Chat.test.tsx` brain-pill failure `D-106-04-01`, and putting `convex-selfhost/` under version control.

**Key context / constraints:**

- **Cross-repo, astridr is the critical path for per-agent visibility.** Evidence gathered at scoping (2026-08-06): `SwapSetCommand` (`astridr/api/ws_commands.py:235-247`) has **no** profile/scope field, and `grep -rn "active_engine\|activeEngine"` across astridr-repo returns **zero hits** — no per-profile engine telemetry emitter exists. What does exist is config only (`astridr/engine/bootstrap/core.py:1356-1359` pushes `modelPreferences`), which BSC-01 explicitly forbids as the source. Same shape as v11.0's Forge-daemon phase; the integration gate closes *during* execution per the BSC-05 / Phase-90 lesson.
- **The "astridr Phase 184.1" pointer inherited from v13.0 is stale** — `grep -rn "184\.1"` across astridr's `.planning/` returns nothing. The brain-swap backend actually shipped as astridr **Phases 185/186** (`ws_commands.py:417-420`). Nothing was ever scheduled to deliver the per-profile axis.
- **No mass mutation of the live self-hosted Convex.** Bounding `aggregates` must be batch-capped like `convex/retention.ts`, never a bulk delete — that is what caused the 2026-07-21/22 tombstone incident.
- **SEED-002 stays partly planted.** Its astridr half (SEED-023) is `dormant`, `scope: Large`, and none of its runtime exists (`grep -rln "stream-json\|stream_json" --include=*.py astridr/` returns nothing). Per-mission cost, confirm cards and squad grouping are therefore **out of scope**; only the surface buildable on today's data is in.
- Continues phase numbering from v13.0 (103–107) → **Phases 108+**.

> **Formalized 2026-08-06 via `/gsd-new-milestone`.** Requirements + roadmap in REQUIREMENTS.md + ROADMAP.md.

## Prior Milestone (shipped 2026-08-06, tagged `v13.0`): v13.0 Brain-Swap Control, Cost Intelligence & Consolidation

**Goal:** Give operators live control over Ástríðr's reasoning engine, deeper cost + tool/trace observability, and close out accumulated tech-debt. Formalized 2026-07-27 via `/gsd-new-milestone`.

**Phases (103–107):**
- **103 — Brain-Swap Control Surface** — CodePulse UI to switch Ástríðr's engine (keyed API models + subscription CLIs) on the fly: live per-agent/global current-engine status, scoped swap with confirm, server-confirmed result. The CodePulse half of the astridr brain-swap thread (astridr Phase 184.1, which scopes "+ CodePulse controls"). ⚠️ **BSC-05 integration gate**: verify astridr's brain-swap endpoints live end-to-end *before* building the UI (Phase-90 "endpoint exists ≠ integration works" lesson).
- **104 — Cost Intelligence** — per-model/provider cost breakdown over time + configurable budget thresholds + anomaly/budget alerts through the existing routing layer.
- **105 — Tool & Trace Observability** — per-tool usage analytics, surfacing the astridr `tool_call_leaked_as_text` / tool-filter signals (detector shipped astridr `b7e4a534`), and a deeper trace waterfall (nested spans, tool timings, cache-hit per turn).
- **106 — Consolidation & Hardening** — typed-api sweep (kill `anyApi`), retire cloud Convex `tidy-whale-981` (export→cancel), build/chunk code-splitting, laptop Tailscale, finish deferred manual UAT.
- **107 — Aggregates Rollup Sharding** — added mid-milestone; closed OCC-01 on the second attempt after 107-06 measured the first fix as worse.

**Outcome:** 5 phases, 53 plans, **14/15 requirements satisfied**. The exception is **BSC-01 ⚠ PARTIAL** — global axis satisfied and live-verified, per-agent axis deliberately deferred as scope, not rounded up. That deferred half is v14.0's first feature. Audit: `milestones/v13.0-MILESTONE-AUDIT.md`.

**Key context / constraints (as scoped):**
- **Cross-repo for Phase 103** — consumed astridr's brain-swap *backend*; BSC-05 closed the integration gate *during* execution, not after. ⚠ The "owned by astridr Phase 184.1" attribution written here at scoping was never real — see the v14.0 constraints above.
- **No mass mutation of the live self-hosted Convex** — DEBT-02 exported/cancelled the retired *cloud* instance (`tidy-whale-981`) only.
- Continued phase numbering from v12.0 (101–102) → **Phases 103–107**.

## Prior Milestone (shipped 2026-07-25, tagged `v11.0`): v11.0 Skills Command Center — Full Lifecycle & Launch

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

**v14.0 Phase 114 (Workspace Map view) COMPLETE (2026-08-14):** 11/11 plans across 6 waves, verification `passed` **18/18** on the phase's locked decisions D-01..D-18 (this phase traces to decisions, not REQ-IDs — Phase 116's precedent). `/workspace-map` renders the live 4,912-directory snapshot as a **deterministic physics-off radial map** — 391 nodes at first paint (centre + 4 department hubs + 53 roots + depth-1), one level per click, expansion entirely client-side over a single subscription — plus an always-visible coverage strip, a click-to-open detail panel, and a lens switcher whose Ástríðr side is a probe-driven honest empty state. One backend change only (D-13 `sources` on `listSnapshots`, no schema change, no migration); **no deploy was run at any point**. CLAUDE.md's documented lean toward reusing `--chart-*` tokens for the departments was **rejected with evidence** and replaced by three dedicated `--dept-*` tokens: emerald defines only `--chart-1/-2` and aubergine aliases `--chart-3` to its own `--status-warn`, which would have made the Work department read as a warning. **The privacy gate is the part that was actually proven, not asserted:** both high-risk surfaces read `enabled && maskPaths`, and weakening either to `enabled` alone turns *exactly* the `maskPaths:false` discriminator test RED — which is the only thing that establishes those tests measure the gate at all, since `redact()` is itself gated on `enabled` ALONE and a `maskPaths:true`-only test would pass identically either way. Code review found one **real Critical, fixed rather than filed**: the page passed `data={payload ?? undefined}` to the coverage strip, collapsing "no snapshot yet" (`null`) into "loading" (`undefined`), so on a first run the strip would have shown a loading skeleton **forever** beside a canvas correctly reporting no snapshot — the exact dishonest-surface failure D-14/D-16 exist to prevent. The attended operator checkpoint passed on live data, and its sharpest move was an **extensions-off control**: 3 console errors and 3 Issues in the normal Chrome profile became `No errors` and 1 Issue in incognito, proving the errors were extension-emitted by measurement rather than by recognising the message, and showing that an "N Issues" badge is a *mixture*, not one finding. That also closed Phase 111's long-open unopened-badge todo; the one genuine Issue and the Clerk dev-keys warning both name Clerk, not the map, and were filed against the owning integration. **Two GSD tooling clobbers of STATE.md were caught and reverted from HEAD** — `state.begin-phase` at wave 1 and `phase.complete` at close; the latter returned a clean payload while over-counting plans (+3 for one plan), *under*-counting phases (leaving `completed_phases` at 10 while closing a phase), advancing to an already-complete Phase 115 instead of the only open phase 118, destroying the narrative, and reporting `requirements_updated:true` for a file it never touched. Suite 4397 passed | 0 failed. **Carried forward, not blocking:** intermittent parallel-run flakiness in Phase 106/115 test files (green serially and on every repeat run; *not* a 114 regression, but "pre-existing" is **not proven** because the first control also reduced load), and 43% of roots unclassified on live data (Phase 115's classifier vocabulary).
**v14.0 Phase 111 (Mission Board) COMPLETE (2026-08-11):** 3/3 plans, verification `passed` (3/3 must-haves). A deliberately **subtractive** phase — its value is in what no longer exists. At discuss time a live probe falsified the phase's own premise (`subagentJobs`: **7 rows ever**, `{failed:2, cancelled:3, completed:2}`, **zero `queued`, zero `running`**, `submittedAt === finishedAt` in 7 of 7, newest row 2026-07-07), so the goal was rewritten on evidence from "a real mission board on data that streams today" to a truthful **post-hoc history board**, and MISSION-02 was reassigned out of the phase entirely. `JobsPanel` now renders `MISSION HISTORY` / `{n} missions` / `finished X ago` with the day tier it lacked (the one real 34-day-old row rendered `816h` before), carries only the three terminal status icons, and keeps its seconds-epoch guard. `ActiveAgentsPanel` was **deleted outright** — it filtered `status === "running"` against a table that structurally never receives one, rendering the unfalsifiable "No agents running." forever. **The blocking operator checkpoint was actually run** (live at `:5173`, verdict `approved`, screenshot evidence for all nine legs, zero console errors on both pages). Code review returned 2 warnings, **both fixed in-session with mutation-proven tests** rather than deferred: the day-boundary mutant `h < 24 → h < 240` was invisible to the pre-existing 34-day test because 816h sits outside the corrupted window. **MISSION-01 is recorded `Partial` (D-04) and MISSION-02 `Blocked on astridr` (D-03) — both deliberate**, with the deferred emitter work owned by `SEED-007`; a checkbox this phase reverted was re-ticked twice by GSD tooling (`requirements.mark-complete`, then `phase.complete`) and reverted both times. Suite 3951 passed | 0 failed.
**v14.0 Phase 108 (Per-Profile Engine Telemetry, astridr backend) COMPLETE (2026-08-07):** 7/7 plans, cross-repo, closing **ENGINE-01/ENGINE-02/ENGINE-05** and the per-agent half of v13.0's PARTIAL **BSC-01**. Ástríðr's `model_routing` emitter now carries a real `profileId`/`model`/`mode` with a refuse-to-emit guard (the mechanism behind v13.0's 93 pruned `{profileId:"unknown", model:"unknown"}` rows — this axis had never held one valid row); `swap.set` takes an optional profile scope with fail-closed validation and a per-profile override rung that outranks the global one (D-04), leaving the unscoped path byte-identical; `control_verb_swap` routes to a `controlVerbSwaps` domain table, and both new engine-axis tables are retention-bounded before they could ever grow. **ENGINE-05 was closed during execution against the live self-hosted stack, not claimed after** — and it earned its keep: three live rounds found three real defects that unit tests, a three-agent adversarial gate, a code review and the phase verifier had all passed over (an explicit `session_id: null` silently dropping every swap row; `providerAffinity` modelled as a scalar while the emitter sends `list[str]`; a stale `pinned` row surviving a restore-to-default). Two further defects surfaced after those gates — a memo/restore composition hole that reintroduced stale readings (WR-01), and a Convex server module reaching the browser bundle, caught only from a runtime console warning (WR-02). All five fixed and re-proven. Security 39/39 threats closed; verification 4/4. **TELE-02 reassigned to Phase 109** — its routed half shipped and is proven live, but D-15's `GlobalSwapModal` host was falsified mid-execution (it is the all-profiles axis with no per-profile scope, and `listByScope`'s non-optional `profileId` cannot reach the `scope: null` rows a global swap writes). Phase 109 inherits that, plus a model-id format split (`inherited` rows carry provider-prefixed ids, `pinned` rows bare) that the three components ENGINE-03 binds to do not normalize.
**v13.0 Phase 103 (Brain-Swap Control Surface) 8/8 plans code-complete (2026-07-28); BSC-05 open:** Per-profile axis (picker, header badge, composer pill, Settings row) shipped against the D-16 stub adapter, contract-first, correctly deferred to astridr Phase 184.1. Global axis (`swap.set`/`swap.catalogue`/`swap.state`) was live-verified for real on the running stack in Plan 103-08: the catalogue read (331 real engines) and the D-15 confirm gate genuinely work; the dispatch → readback → revert leg does not, blocked by two real defects found live and left open (`GlobalSwapModal.tsx` discards the working `swap.set` result and fans out the deferred per-profile command instead; `BrainHeaderBadge.tsx` never requests a `swap.get_state` snapshot on load). Four other defects found during the same live checkpoint were fixed immediately (an aria-hidden-focus WCAG violation, the header badge being blind to the global axis, `registerBrainsWsSender` never being wired into the app, and the picker's catalogue fetch being scope-blind). `103-VALIDATION.md` records all of this honestly; **BSC-05 is explicitly not marked satisfied**. Recommended next: a gap-closure cycle (`/gsd-plan-phase 103 --gaps`) before starting Phase 104.
**v11.0 Phase 98 complete (2026-07-21):** Skill Lifecycle Mutations shipped — 4/4 plans across CodePulse + Forge daemon (cross-repo): `enqueueLifecycle` Convex mutation with two-layer validation, native-TS daemon executor (archive/restore/move/delete, cross-volume C:↔G: safe, host-truth re-checks), and a scope-gated ⋯ lifecycle menu on every skill row with Move/type-to-confirm-Delete dialogs. Verified 11/11 must-haves; code review found 3 criticals + 4 warnings, all fixed and test-guarded (incl. the signed-off D-05 narrowing: permanent delete is target-scoped cold-only, so a shadowed skill's dormant copy is deletable without touching the active copy). UAT approved by Larry 2026-07-21. LIFE-01..06 + DAEMON-02 validated. v11.0 resumes at Phase 99 (Skill Launch / Dispatch); Phase 100 (Control-Surface UX) depends on 98+99.
**v12.0 COMPLETE — Phase 102 tech-debt close-out (2026-07-23):** Both milestone-audit tech-debt items closed and live-verified — dead `dueSoon`/`overdue` queries + `by_dueAt` index removed from codepulse (index drop deployed to the live self-hosted backend), dead `CodePulsePoster` deleted + stale two-backend narrative swept in astridr-repo (commits on astridr `main`, merged into `feature/brain-swap`; prod + war-room containers rebuilt and verified), one real calendar tick pushed 75 events / 0 failures with events rendering on `/reminders`. Verification 10/10; advisory review (`102-REVIEW.md`) queued 4 warnings (orphaned `by_status` index, `send_to` silent-failure counting, all-day `strptime` guard, snooze-after-done recurrence dupe) for a future tech-debt pass. **v12.0 SHIPPED & ARCHIVED 2026-07-23** — tagged `v12.0`, archived to `milestones/v12.0-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT}.md`; the active milestone remains **v11.0** (Skills, resumes at Phase 99).
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
| One Convex `reminders` store as single source of truth, bidirectional (v12.0, Phase 101) | Both the CodePulse UI and the Ástríðr chat tool write the same table (origin-tagged `dashboard`/`astridr`) so a reminder created on either side is live on the other — no second store, no reconciliation layer. `source` records origin only, never gates writes. | ✓ Good — live-verified both directions; recurrence spawn + once-only nudge ride the same store |
| Read-only Google Calendar overlay, no write-back (v12.0, Phase 101) | The overlay is a per-profile cron cache (`googleEventId` upsert, stale-prune, bounded forward window) with **no Google write path** — the browser/Convex never mutates Google; per-account auth failures are isolated so one bad account never blanks another profile. | ✓ Good — grep-verified no write path; 3-account isolation live-proven (3/73/0 events) |
| Ástríðr crons register via the real scheduler, not `jobs.py` (v12.0, Phase 101) | The reminders tool + calendar/nudge crons register through `cron_builders.py`/`cron_dispatcher.py`; `jobs.py` (JobManager) is execution-tracking only with no periodic-registration surface. Verifying the registration surface was necessary before trusting the cron would fire. | ✓ Good — live cron ticks confirmed (nudge 1 send/dedupe held; calendar tick 75 pushed/0 failed) |

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
*Last updated: 2026-08-14 — **v14.0 Phase 114 (Workspace Map view) COMPLETE**: 11/11 plans, verification passed 18/18 on decisions D-01..D-18, code review closed with both findings fixed, attended operator checkpoint passed on live data. v14.0 progress: **11 of 12 phases complete — only Phase 118 (Studio media gallery) remains**, and it is already planned at 15 plans across 10 waves. Note for whoever picks it up: `phase.complete` advances to the numerically next phase, not the next incomplete one, so it pointed at the already-finished Phase 115 — the real next phase is 118. Prior: Last updated: 2026-08-06 — **v14.0 Per-Agent Engine Visibility, Convex Durability & Mission Board started** via `/gsd-new-milestone`. Scope: BSC-01's deferred per-agent axis (cross-repo, astridr emitter + scoped `swap.set` owned from this roadmap), Convex durability (`aggregates` never pruned, retention tombstone self-defeat, memory-growth root cause), a frontend-only mission board on today's `subagentJobs` data, astridr telemetry-coverage closure (Group A doc fix / Group B per-kind routes), and a small-debt sweep. Continues phase numbering from v13.0 → **Phases 108+**. Prior: **v13.0 SHIPPED & ARCHIVED 2026-08-06** (5 phases 103–107, 53 plans, 14/15 requirements, tagged `v13.0`; the one PARTIAL is BSC-01, picked up here).*

<details>
<summary>Prior footer — 2026-07-23 (v12.0 shipped)</summary>

*Last updated: 2026-08-07 — **v14.0 Phase 108 (Per-Profile Engine Telemetry, astridr backend) COMPLETE**: 7/7 plans, cross-repo, ENGINE-01/02/05 closed with ENGINE-05 proven live on the running stack during execution (three live rounds, five real defects found and fixed that every static gate had passed over). TELE-02 reassigned to Phase 109 — routed half shipped and proven, surfaced half needs a per-profile host after D-15 was falsified. v14.0 progress: 1/6 phases. Next: Phase 109 (Per-Agent Engine UI). Prior: 2026-07-23 — v12.0 SHIPPED & ARCHIVED.*

*Prior: 2026-07-23 — **v12.0 Personal Productivity (Reminders & Calendar) SHIPPED & ARCHIVED** (2 phases 101-102, 10 plans, 9/9 requirements REM-01..05/CAL-01..02/UI-01..02; tagged `v12.0`, archived to `milestones/v12.0-*`). Milestone audit `tech_debt` (0 blockers; 2 flagged items closed by Phase 102). `101-REVIEW-FIX` closed 8/8 findings (incl. snooze/nudge dedupe + edit-popover UTC shift). Executed as an interleaved side-quest — the active milestone remains **v11.0 Skills Command Center** (Phase 97/98 done; resumes at Phase 99 Skill Launch/Dispatch; 99/100 not started). REQUIREMENTS.md kept live (only the v12.0 section extracted to the archive). Prior: 2026-07-20 — v12.0 Phase 101 complete; 2026-07-21 — v11.0 Phase 98 complete.*

<details>
<summary>Prior footer — 2026-07-17 (v11.0 started)</summary>

*Last updated: 2026-07-21 — **v11.0 Phase 98 (Skill Lifecycle Mutations) complete**: 4/4 plans, verified + UAT approved, LIFE-01..06 + DAEMON-02 validated; next Phase 99. Prior: 2026-07-17 — **v11.0 Skills Command Center — Full Lifecycle & Launch started** via `/gsd-new-milestone`. Scope: real skill intake (execute today's dry-run install to global/project/cold), full skill lifecycle mutations (archive/restore/move/delete, archive-first), real skill launch to Chat/Forge-agent/Ástríðr, control-surface UX (⋯ menu + drag across scope lanes), and the cross-repo Forge daemon executor that makes it all live. Continues phase numbering from 97 (Phase 97 already promoted from backlog 999.1). Prior: v10.0 SHIPPED & closed 2026-07-13 (phases 93-96, Phase 96 UI-cleanup addendum).*

</details>

<details>
<summary>Prior footer — 2026-07-13 (v10.0 closed)</summary>

*Last updated: 2026-07-13 after Phase 96 (UI deep-dive cleanup) completion*

</details>

</details>
