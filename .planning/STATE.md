---
gsd_state_version: 1.0
milestone: v12.0
milestone_name: Personal Productivity — Reminders & Calendar
status: milestone_complete
stopped_at: Phase 98 Plan 04 (lifecycle menu assembly) complete
last_updated: "2026-07-21T21:38:55.367Z"
last_activity: 2026-07-21
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 7
  completed_plans: 7
  percent: 100
---

<!-- Counters hand-reconciled 2026-07-20 against git ground truth (gsd-sdk state.* verbs miscount;
     phase.complete wrote completed_plans:26 — corrected to 7).
     v12.0 scope = Phase 101 only (7 plans incl. 101-07 gap closure). v11.0 (Phases 97-100) is PAUSED mid-milestone:
     Phase 97 COMPLETE (6/6, verified 495946f); Phases 98/99/100 not started — resume after v12.0. -->

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-17)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it.
**Current focus:** Phase 98 — skill-lifecycle-mutations-archive-restore-move-delete

## Current Position

Milestone: v12.0 (Personal Productivity — Reminders & Calendar) — ACTIVATED 2026-07-19, all phases COMPLETE 2026-07-20 (formal close-out/archive pending)
Phase: 98 (skill-lifecycle-mutations-archive-restore-move-delete) — EXECUTING
Plan: 4 of 4 done — Plan 98-01 (Convex lifecycle substrate) complete and verified (163/184 tests passing + 21 pre-existing todo, 0 regressions; tsc clean); Plan 98-02 (Forge daemon lifecycle executor) complete and verified (47/47 new tests passing across lifecycle-exec.test.ts + command-poller.test.ts, tsc clean; 925/926 full forge suite — 1 pre-existing unrelated flake in manager.test.ts); Plan 98-03 (lifecycle UI building blocks) complete and verified (32/32 new tests passing across useLifecycle/MoveToProjectDialog/DeleteSkillDialog, tsc clean; repo-wide `npx vitest run` 2281/2281 passing, 0 regressions); Plan 98-04 (menu assembly) complete and verified (19/19 new tests across SkillLifecycleMenu.test.tsx + 5/5 new ColdStorageView.test.tsx, tsc clean; repo-wide `npx vitest run` 204 files / 2305 tests passing, 0 regressions after fixing 4 pre-existing suites broken by SkillRow now mounting real Convex hooks — see 98-04-SUMMARY.md).
Status: Plan 98-04 complete (2/2 tasks, commits a8c24ef/eb91eda). All 4 plans of Phase 98 are now code-complete end-to-end (Convex enqueue -> daemon executor -> UI). LIFE-01..06 traceability stays "Pending" in REQUIREMENTS.md — a manual UAT (real archive + real cross-volume move against a live Forge daemon) is still required before the phase can be marked verified (see 98-04-SUMMARY.md "Next Phase Readiness").
Last activity: 2026-07-21

**v11.0 resumed:** Phase 97 (Real Skill Intake & Daemon Foundation) COMPLETE (6/6 plans, operator-verified live 2026-07-19, commit 495946f). Phase 98 (Lifecycle Mutations) PLANNED 2026-07-21 (4 plans, 3 waves, checker passed); Plan 98-01 EXECUTED 2026-07-21 (Convex substrate — see 98-01-SUMMARY.md); Plan 98-02 EXECUTED 2026-07-21 (Forge daemon executor — see 98-02-SUMMARY.md); Plan 98-03 EXECUTED 2026-07-21 (lifecycle UI building blocks — see 98-03-SUMMARY.md); Plan 98-04 EXECUTED 2026-07-21 (lifecycle menu assembly — see 98-04-SUMMARY.md). Daemon code lives in C:\Users\mandr\forge, ROADMAP's "astridr-repo" note is stale. Phase 98 is now 4/4 plans code-complete; manual UAT still outstanding before phase verification. Phases 99 (Launch/Dispatch), 100 (Control-Surface UX) NOT started.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-06-29 (all non-blocking — see v9.0 audit reconciliation):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 80 80-HUMAN-UAT.md | passed (0 pending — false positive) |
| uat_gap | Phase 84 84-HUMAN-UAT.md | passed (0 pending — false positive) |
| uat_gap | Phase 85 85-HUMAN-UAT.md | passed (0 pending — false positive) |
| verification_gap | Phase 89 89-VERIFICATION.md | human_needed (operator signed off 2026-06-24; flag unflipped) |
| verification_gap | Phase 92 92-VERIFICATION.md | human_needed (live-verified 2026-06-25; flag unflipped) |
| quick_task | 260603-or6-codepulse-register-opus-4-8-in-cost-mode | missing (stale, unrelated to v9.0) |
| context_questions | Phase 078 078-CONTEXT.md | 3 open Qs (answered during v7.0 execution, unmarked) |
| context_questions | Phase 89 89-CONTEXT.md | 3 open Qs (answered during execution, unmarked) |

**Accepted tech debt:** Phases 88 & 90 have no formal `VERIFICATION.md` — 88 covered by Nyquist VALIDATION (47/47 tests), 90 by operator live sign-off (`90-08-SUMMARY`).

**v10.0 close-out cleanup (2026-07-07) — ALL RESOLVED (`audit-open` now reports 0 open items):**

These were completed work flagged only by naming / status-marker mismatches, not real gaps. All quick-task dirs moved to `.planning/quick-archive/` (out of the audit scan); `95-VALIDATION.md` finalized.

| Category | Item | Resolution |
|----------|------|------------|
| quick_task | 260603-or6-codepulse-register-opus-4-8-in-cost-mode | ✅ DONE 2026-06-03 — registered `claude-opus-4-8` @ $5/$25 in `modelPricing.ts` + fixed a latent 3× Opus over-pricing bug; archived |
| quick_task | 260629-close-crossnav | ✅ DONE (commit b0253b3); archived |
| quick_task | 260629-hive-task-agent-link | ✅ DONE (commit b7b8e84); archived |
| quick_task | 260629-mem-event-deeplink | ✅ DONE (commit 58b999f); archived |
| quick_task | 260629-nnf-graphs-hub-tile-index | ✅ DONE (commit 2d9df13); archived |
| quick_task | 260629-oki-reverse-cross-graph-links | ✅ DONE (commit 6cffbae); archived |
| validation_gap | Phase 95 95-VALIDATION.md | ✅ FINALIZED — `status: complete`, `nyquist_compliant: true`; all gates green, both manual checks operator-verified, cross-referenced by 95-VERIFICATION (16/16) |

The `v10.0-MILESTONE-AUDIT.md` (2026-07-06, `gaps_found`) was a stale **mid-flight snapshot** predating Phases 94/95; superseded by the three phase VERIFICATION.md files (all passed) and the archived REQUIREMENTS (9/9 complete).

## v11.0 Roadmap

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 97 | Real Skill Intake & Daemon Foundation | INTAKE-01..04, DAEMON-01, DAEMON-03, DAEMON-04 | Not started |
| 98 | Skill Lifecycle Mutations | LIFE-01..06, DAEMON-02 | Not started |
| 99 | Skill Launch / Dispatch | LAUNCH-01..04 | Not started |
| 100 | Control-Surface UX | UX-01..04 | Not started |

**Execution order:** 97 → 98 (98 reuses the daemon command-execution + registry-rescan plumbing 97 builds). 99 is independent of 97/98 (rides existing chat/Forge/Ástríðr channels, no daemon dependency) and can run in parallel. 100 depends on **both** 98 and 99 (the ⋯ menu and drag lanes wire against both) and is sequenced last.

**Note:** the backlog-promoted "Phase 97: Skill Lifecycle Management" (999.1, promoted 2026-07-17) is folded into **Phase 98** above — same scope (archive/restore/move/delete via Forge daemon, `isShadowing` guard, archive-not-delete default), renumbered once the daemon/intake foundation was sequenced first. Nothing dropped or duplicated.

<details>
<summary>Prior milestone (v10.0) Roadmap — SHIPPED 2026-07-07 (Phase 96 addendum 2026-07-13)</summary>

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 93 | Eval Pipeline & Quality KPIs | EVAL-01, EVAL-02, EVAL-03 | ✅ Complete (6/6 plans) |
| 94 | Trace Waterfall | TRACE-01, TRACE-02 | ✅ Complete (5/5 plans) |
| 95 | Hardening — Security, Key Rotation, Dependency Majors | HARD-01, HARD-02, HARD-03, HARD-04 | ✅ Complete (4/4 plans) |
| 96 | UI Deep-Dive Cleanup — IA restructure, palette drift, honesty, PageHeader | F1–F10 / D-01–D-11 (cleanup phase, no formal REQ IDs) | ✅ Complete (13/13 plans; re-verified 16/16 after 96-13 gap closure) |

**Execution order:** 93 and 94 are independent (separate schemas, both ride existing ingest paths) — either order or parallel. 95 is independent of both and sequenced last as audit/cleanup work.

<details>
<summary>Prior milestone (v9.0) Roadmap — SHIPPED 2026-06-29</summary>

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 88 | Analytics Rollup | AR-01, AR-02, AR-03 | ✅ Complete (4/4 plans) |
| 89 | Readable Themes & Editorial Skin Toggle | TH-01..TH-06 | ✅ Complete (7/7 plans) |
| 90 | Agent Room / War Room | ROOM-01..ROOM-04 | ✅ Complete (8/8 plans; live sign-off 2026-06-29) |
| 91 | 3D Memory Galaxy | G3D-01, G3D-02 | ✅ Complete (5/5 plans; FPS≥30 + WebGL-leak operator sign-off 2026-06-29) |
| 92 | Voice-Activated Command Palette (Jarvis Mode) | VOX-01..VOX-04 | ✅ Complete (6/6 plans) |

**Execution order:** 88 → 89 → 92 → 90 → 91 (all done). All five v9.0 phases complete; milestone shipped & archived.

</details>

</details>

## Accumulated Context

### Roadmap Evolution

- Phase 96 added (2026-07-13): UI deep-dive cleanup — IA restructure (dissolve CONSOLE cluster), command palette nav drift, fake header telemetry, hardcoded trust signals, orphaned pages, header/layout consistency. Full audit findings in `.planning/phases/96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa/FINDINGS.md`.
- v11.0 roadmap created (2026-07-17): 4 phases (97-100) derived from the 22 v11.0 requirements. The backlog-promoted "Phase 97: Skill Lifecycle Management" (999.1) is renumbered to Phase 98 — the daemon-executor + real-intake foundation (INTAKE-01..04, DAEMON-01/03/04) was sequenced first as Phase 97 per the dependency analysis (nothing mutates the host without the daemon executor existing). Phase 99 (Launch/Dispatch) is independent of the daemon work (rides existing chat/Forge/Ástríðr channels) and can run in parallel with 97/98. Phase 100 (Control-Surface UX) depends on both 98 and 99 and is sequenced last.

### Decisions

See PROJECT.md Key Decisions table for full history.

**v11.0 / Phase 98 Plan 04 decisions (2026-07-21, lifecycle menu assembly — final integration wave):**

- **`isDormant(skill)`/`isShadowing(skill)` are mutually exclusive against the real registry data model** — `convex/skillSync.ts`'s `groupSkillRowsByName` merges every origin for a skill name into ONE row, so a row can never have ALL origins `=== DORMANT_ORIGIN` (isDormant) AND also a non-dormant origin (isShadowing) simultaneously. The shadow-disabled-Restore branch in `SkillLifecycleMenu.tsx` is implemented exactly as the plan specifies (D-09's client-side half of the two-layer shadow check) and is unit-tested by spying on `isShadowing` directly rather than an impossible origins fixture — it's correct, harmless defensive code, not naturally reachable via today's grouped-row data, and the daemon's LAYER-2 re-check (98-02) remains the real backstop.
- **Restore only ever targets `destination: "global"`** — no destination picker; matches the UI-SPEC's single "Restore" menu item and `validateLifecyclePreflight`'s global-only shadow pre-check (98-01).
- **Host resolved inside `SkillLifecycleMenu` itself** via `useForgeHostsRaw` (IntakeModal's D-08 online-newest convention), with an optional `hostId` override prop — avoids threading a new required prop through every `SkillRow` call site (`AllSkillsOverview`/`SkillsInCategory`/`ColdStorageView`).
- **`gsd-sdk state.advance-plan` and `state.update-progress` both re-clobbered this file's frontmatter** (`status: milestone_complete` → `executing` → `verifying`, `stopped_at` reverted to the Plan-03 text) via the same full-frontmatter-resync side effect documented in Plans 98-01/02/03's own decisions — reverted to `milestone_complete`/Plan-04-complete by hand each time. `state.record-metric`/`state.add-decision`/`state.record-session` were skipped entirely this plan for the same reason (all route through the same disk-rebuild resync); this Decisions entry and the Session Continuity update above were hand-written instead, following the established workaround.
- **LIFE-01..06/DAEMON-02 still NOT marked complete in REQUIREMENTS.md** — this is the final integration plan of Phase 98 (all 4 plans are now code-complete end-to-end: Convex enqueue -> daemon executor -> UI), but the phase's manual UAT (real archive + a real cross-volume move against a live Forge daemon) has not yet run. Matches 98-01/02/03's own precedent of deferring completion to full, human-verified end-to-end delivery — not per-plan code-completion.

**v11.0 / Phase 98 Plan 03 decisions (2026-07-21, lifecycle UI building blocks):**

- **`dropdown-menu` installed cleanly via `npx shadcn add dropdown-menu`** — no hand-authored fallback needed; verified the generated file imports from the already-installed `radix-ui` v1.4.3 meta-package (no new npm dependency, `package.json`/lockfile byte-unchanged).
- **`mapLifecycleStatus` delegates to `mapIntakeStatus`** (imported, not redefined) rather than duplicating the switch statement — lifecycle-domain call sites read cleanly while guaranteeing byte-identical behavior including the "unknown -> queued" defensive fallback.
- **`LifecycleCommandRow` carries `sourceOrigin` and `workspaceId`** beyond the plan's literal field list — both already exist on the Convex doc's `lifecyclePayload` (Plan 98-01 schema) and Plan 98-04's dialogs need `sourceOrigin` to construct their own `enqueueLifecycle` calls from row context; added now to avoid a second adapter pass.
- **LIFE-03/LIFE-04/LIFE-06 still NOT marked complete in REQUIREMENTS.md** — this plan ships the reusable UI building blocks (primitive, hook, 2 dialogs), all unit-tested in isolation, but nothing is wired into `SkillRow`/`ColdStorageView` yet (Plan 98-04's job). Matches 98-01/98-02's own precedent of deferring completion to full end-to-end delivery.
- **`gsd-sdk state.advance-plan` again flipped this file's top-level `status` field** (`milestone_complete` -> `executing`) via the same full-frontmatter-resync side effect documented in Plans 98-01/98-02's decisions — reverted by hand. The generic "Ready to execute" body text was also hand-rewritten to describe what actually shipped, following the same established workaround (`state.record-metric`/`state.add-decision`/`state.record-session` were not run standalone this plan for the same reason; this Decisions entry and the Session Continuity update below were hand-written instead).

**v11.0 / Phase 98 Plan 02 decisions (2026-07-21, Forge daemon lifecycle executor):**

- **`workspaceId` resolves whichever side of the mutation is the project scope** (source for archive/move-from-project, destination for restore/move-to-project) — never a second field. LIFE-03's scope (move only ever crosses global↔project, never project↔project) makes this unambiguous.
- **Delete's cold-only host-truth re-check walks every synced project workspace, not just the global root** — the plan's must_haves truth says "verifies the skill exists ONLY at the cold root", so `runLifecycle` calls `listWorkspaces(db)` and checks each workspace's `.claude/skills` dir before permitting `fs.rmSync`, in addition to the global root.
- **The per-skillName in-flight mutex (Pitfall 4) lives in `CommandPoller`, not `lifecycle-exec.ts`** — the executor stays a pure, stateless function; concurrency control is a dispatch-layer concern, matching where Phase 97's serial intake queue already lives.
- **`rescanCfg.workspaces` became a getter, not a thunk-typed interface change** — zero changes to `skill-rescan.ts`'s `RescanAndSyncDeps`/`BuildSkillSnapshotDeps`; `buildSkillSnapshot`'s existing `const { workspaces } = deps` destructuring transparently invokes the getter, closing the Pitfall-5 startup-snapshot gap entirely at the `index.ts` call site.
- **LIFE-01..06/DAEMON-02 still NOT marked complete in REQUIREMENTS.md** — this plan ships the Forge daemon executor (native fs archive/restore/move/delete, cross-volume-safe, host-truth re-checked, wired into `CommandPoller`), but the UI (Plans 98-03/04) still needs to land, and a manual UAT (real archive + real cross-volume move) is still required before end-to-end delivery is genuinely proven. Matches Plan 98-01's own precedent.
- **`gsd-sdk state.record-metric` re-clobbered the frontmatter `status` field a second time** (flipped `milestone_complete` → `verifying`, and reset `stopped_at` back to "Phase 98 Plan 01") via the same `readModifyWriteStateMd` full-frontmatter-resync side effect documented in Plan 98-01's decisions — reverted to `milestone_complete`/Plan-02-complete by hand. `state.record-metric` itself reported `recorded: false` (this STATE.md has no `## Performance Metrics` section to append to) — no metrics row was added; not worth adding a new section for. `state.add-decision`/`state.record-session` were skipped entirely this plan (same clobbering risk) — this Decisions entry and the Session Continuity update below were hand-written instead, following 98-01's established workaround.

**v11.0 / Phase 98 Plan 01 decisions (2026-07-21, Convex lifecycle substrate):**

- **LAYER-1 pre-flight only enforces global-destination collisions** — Convex has no way to resolve a `workspaceId` to its eventual `claude-code:project:<key>` origin at enqueue time (that mapping only exists after the daemon's registry rescan), so restore/move collisions against a `project` destination are deliberately left to the daemon's LAYER-2 filesystem re-check (D-04: host truth wins over a possibly-stale registry).
- **`kind="collision"` is shared between archive (cold-collision) and move (move-target-collision) refusals** in `lifecycle-refused:<kind>:` — the adapter (`synthesizeLifecycleRefusalReport`) disambiguates house copy by `payload.action`, not a second kind value; delete's cold-only refusal got its own `kind="not-cold"` with a generic UI-SPEC-fallback copy (no specific string was defined for it in the Copywriting Contract).
- **LIFE-01..06 NOT marked complete in REQUIREMENTS.md** — this plan ships only the Convex API/backend substrate (enqueueLifecycle, the pre-flight guards, the ack adapter, the list query); no daemon executes a lifecycle command yet (Plan 98-02) and no UI enqueues one yet (Plans 98-03/04), so the requirements aren't genuinely end-to-end satisfied. Matches the existing precedent that Phase 97's INTAKE-01..04 also remain "Pending" in REQUIREMENTS.md despite Phase 97 shipping live-verified — completion is tracked at full delivery, not per-plan.
- **Corrected two gsd-sdk `state.*` side effects by hand** — `state.advance-plan` set the body "Status:" line to the generic "Ready to execute" (hand-rewritten to describe what actually shipped) and a subsequent `state.update-progress` call's frontmatter resync flipped the top-level `status:` key from `milestone_complete` to `completed` (this file's frontmatter tracks the ALREADY-shipped v12.0 milestone's 7/7 plan counters, not Phase 98's; the resync recomputed status from those counters independent of which phase is actually being worked). Reverted to `milestone_complete`, matching the file's own pre-existing hand-reconciliation convention documented in the HTML comment below the frontmatter. No `state.record-metric`/`state.add-decision` calls were run this plan (both route through the same disk-rebuild resync); this decisions entry and the Current Position update above were hand-written instead.

**v12.0 / Phase 101 Plan 07 decisions (2026-07-20, gap closure):**

- **Exempt `due === undefined` from `dayFiltered` rather than add a new UI grouping** — closed the sole `101-UAT.md` gap (test 8: undated reminders vanish when a calendar day is selected). Undated rows already group under Upcoming (`groups` L493-495), so the fix is a pure filter-predicate change: `due === undefined || startOfDaySeconds(due) === selectedDay`. No Convex change, no new UI, no CSS. RED-first regression test committed before the fix (`9c246ab` test, `4afabf2` fix).
- **Phase 101 is now 7/7 plans complete** (plan 07 added post-UAT as a gap-closure plan). This closes out Phase 101 / v12.0 milestone scope.

**v12.0 / Phase 101 Plan 06 decisions (2026-07-19):**

- **Reminders page profile accents reuse `--status-ok`/`--status-warn`/`--status-info`** (not new `--profile-*` CSS vars, not `--chart-N`) — genuinely 3-hue-distinct across all 5 `data-theme` variants with zero `index.css` changes; `--chart-3/4/5` are grayscale in 3 of the 5 dark themes so couldn't guarantee distinct accents.
- **QuickAdd focuses on "N", not the literal ⌘K/N the UI-SPEC wrote** — `DashboardLayout.tsx` already owns Cmd/Ctrl+K globally for the CommandPalette; duplicating it would double-fire both handlers on the same keystroke.
- **Phase 101 is now 6/6 plans complete.** REM-03/REM-04/REM-05/CAL-01 were already `[x]` in REQUIREMENTS.md's checkbox list from plans 03-05 but the traceability table still said "Pending" for them — hand-synced to "Complete" alongside this plan's UI-01/UI-02/CAL-02 while closing out the phase.

**v11.0 scoping decisions (2026-07-17):**

- **4-phase roadmap, daemon-first** — INTAKE-01..04 + DAEMON-01/03/04 cluster into Phase 97 because they share one delivery boundary: the daemon executes intake and rescans the registry, so intake literally cannot ship live without that daemon plumbing existing first. LIFE-01..06 + DAEMON-02 cluster into Phase 98 since lifecycle mutations reuse the same command-execution + rescan mechanism Phase 97 builds — genuinely a "Phase 97 extension," not a new integration surface. LAUNCH-01..04 form Phase 99, sequenced independently since launch rides existing `chat.send`/`enqueueLaunch`/Ástríðr channels with zero daemon dependency. UX-01..04 form Phase 100, the control-surface layer wiring the ⋯ menu and drag lanes over both the lifecycle mutations (98) and the Run/launch picker (99) — necessarily last.
- **Old backlog Phase 97 renumbered to Phase 98** — its captured context (cross-repo scope, `isShadowing` caution, archive-not-delete default, daemon-offline graceful degradation) is carried forward verbatim into Phase 98's detail block in ROADMAP.md; the phase directory `.planning/phases/97-skill-lifecycle-management/` (currently empty, `.gitkeep` only) will be renamed/renumbered at plan time to match.
- **DAEMON-04 (advertise supported command types) placed in Phase 97, not split** — it's the single capability-negotiation mechanism (`supportedTypes`/`resolveClaimTypes`) that both intake (97) and lifecycle (98) commands ride; built once in 97, lifecycle command types are added to the same array as an implementation detail of Phase 98 (not a new requirement).

**v10.0 scoping decisions (2026-07-04):**

- **3-phase roadmap** — EVAL-01..03 clustered into one phase (Phase 93) since they share the `evalScores` table (ingest, judge action, and KPI/regression UI are a single coherent delivery boundary, not three separable slices). TRACE-01/02 form Phase 94 (schema gates UI, same phase since the waterfall is unusable without `traceId`). HARD-01..04 form Phase 95 (independent audit/rotation/dependency-bump work, no shared schema with 93/94).
- **95 sequenced last** — not a hard dependency, but hardening is audit/cleanup work rather than new-feature delivery; HARD-01 (`/cso`) may surface remediation scope once run, so it isn't gating the eval/trace feature work.
- **No new Ástríðr transport** — both EVAL and TRACE ride existing `/runtime-ingest`-family paths; confirmed no emitter-protocol changes needed cross-repo.

**v9.0 scoping decisions (2026-06-23):**

- **Reverse "3D out of scope"** — opt-in mode on `CodeVaultGraph` only (not a new page); `react-force-graph-3d` not R3F (near-identical prop API, manages own WebGLRenderer).
- **Phase 89 sub-sequence** — token cleanup (77 hex sites) → no-flash script → key consolidation → Aubergine tokens → WCAG-AA axe audit. `class="dark"` stays permanent (all v9.0 themes are dark variants).
- **Phase 90 cross-repo gate** — confirm `POST /api/war-room` ingest path and `warRooms` Convex population before writing any ROOM code. If Join isn't feasible, ship observer mode with honest label.
- **Phase 88 quick-unblock** — `.take()` caps deployed `edb614c` are fragile; this phase replaces them with ingest-time rollups in `convex/analyticsRollup.ts` (new file) + wired from `ingest.ts` / `runtimeIngest.ts`.

**Phase 88 Plan 01 decisions (2026-06-24, Wave 0):**

- **Classifier extracted VERBATIM** into shared `convex/lib/sankeyClassify.ts` (sole source of `categoryOf`/`outcomeOf`, read+write paths; `payload` param dropped per OQ-2). The plan's `<behavior>` examples assumed case-INSENSITIVE `outcomeOf` (`"ToolError"→"Error"`); the real code is case-SENSITIVE (`.includes("error")`), so capitalized forms classify as `"Success"`. Kept the classifier byte-identical (T-88-01) and corrected the TEST expectations instead (`tool_error`/`tool_fail`→`"Error"`).
- **Cross-plan RED-scaffold pattern** — not-yet-built Convex modules are loaded behind a non-literal `@vite-ignore` dynamic import + a loose local module type, so dependent tests RED cleanly without breaking Vite transform or `tsc --noEmit`. Used for the Plan-02 (`incrementEventBucket`/dedup) and Plan-04 (aggregates-backed queries) targets.
- **AR-01/02/03 NOT marked complete** — they are phase-level and only complete at Plan 04; Plan 01 is scaffolding + extraction only.

**Phase 88 Plan 02 decisions (2026-06-24, Wave 1):**

- **Rollup WRITE PATH landed atomically.** `events.ingest` now dedups on `by_idempotencyKey` (early return) and, on a fresh insert, increments the `"events"` + two `"sankey_edge"` buckets — all in ONE OCC mutation (D-01/D-04). Un-keyed events always counted (D-05). The 4 write-path RED tests from Plan 01 (idempotency / no-key-counted / patch-or-insert / backfill-count-equality) are now GREEN.
- **`computeHourly` event-count + error-count branches DELETED (D-02)** in the same wave that adds ingest-time increments — Convex per-deploy atomicity means co-locating them is the only way to avoid a double-count transition tick (Pitfall 1 / T-88-04). Cost read replaced unbounded `.collect()` with a paginated cursor loop (`LLM_PAGE_SIZE 500`, D-03/T-88-05, 16 MiB-safe).
- **`incrementBatch` is `internalMutation`, never public** (T-88-03 — a public increment endpoint = unauthenticated tampering). `backfillHistorical` action exists but is NOT run here (run = Plan 03, operator-gated). `idempotencyKey = body/d.idempotencyKey ?? event_id` wired through both httpActions; neither writes `ctx.db` rollups.
- **Ran `npx convex codegen` (offline, NOT a deploy)** to regenerate `_generated/api.d.ts` for the new `analyticsRollup` module; annotated `backfillHistorical`'s runQuery result as `PaginationResult<Doc<"events">>` to break a tsc TS7022 inference cycle (events↔rollup cross-import).
- **2 remaining RED tests** in `analytics.test.ts` are the Plan-04 read-path targets (`activityHeatmapFromAggregates`/`errorRateTrendFromAggregates`), documented RED-pending Plan 04 — NOT regressions from Plan 02.

**Phase 89 Plan 01 decisions (2026-06-24, Wave 0):**

- **`@axe-core/playwright` operator-approved legitimacy gate** — installed at 4.12.1 after operator confirmed npmjs.com listing (Deque Systems `@axe-core` org, dequelabs/axe-core-npm, millions weekly downloads). Required for TH-06 WCAG-AA contrast audit.
- **`resolveThemeColors` exported module-level** (not inside hook) — shared by the lazy `useState` initializer and the MutationObserver callback; avoids creating a new closure on each render.
- **`waitFor()` required for MutationObserver test** — jsdom fires MutationObserver callbacks asynchronously; `act()` alone does not flush them. Added `await waitFor(() => expect(...))` in the re-resolve test.
- **ThemeSwitcher amber option removed; readable + aubergine added** — per PATTERNS.md §ThemeSwitcher changes; trigger width widened to `w-[160px]`.
- **e2e specs seeded RED-pending** — all 3 e2e specs (contrast, no-fouc, reduced-motion) are scaffolded with `RED-pending: <plan>` comments; they correctly fail until Plans 02-04 ship token blocks, inline script, and CSS suppression rules.
- [Phase ?]: AgentCard amber shadow preserved as status identity
- [Phase ?]: CategoryGrid COLOR_HEX map EXEMPT
- [Phase 89]: Canvas legibility, aubergine grain, vault-node violet, and no-flash classified as manual-only (axe cannot audit canvas/perceptual behaviors); T-89-15 repudiation mitigated — operator sign-off received 2026-06-24 — Per 89-VALIDATION §Manual-Only Verifications; five checks approved by operator; no axe exclusions applied across all 20 WCAG-AA contrast cases
- [Phase ?]: seq optionality for backcompat
- [Phase ?]: livekit-client exact pin + audit clean

**Phase 90 Plan 03 decisions (2026-06-26, Wave 3):**

- **idle treated as closed** — `listRooms` queries both `status="closed"` and `status="idle"` via `by_status`, merges and sorts by `createdAt` desc, bounded to `closedLimit` (default 20, cap 200). Critical Note N6 / Open Question 2 resolved.
- **seq NOT a public arg** — `insertWarRoomEvent` computes `seq` server-side via OCC read-max-then-insert (mirrors `forge.ts:634-641`); clients cannot forge ordering (T-90-INJ accepted disposition confirmed).

**Phase 90 Plan 06 decisions (2026-06-26, Wave 4):**

- **Deep-link auto-select race guard** — `useEffect` fires only when `allRooms.length > 0 && !selectedRoomId`; prevents premature setSelectedRoomId before Convex resolves the room list (Pitfall 6). Dep list uses `allRooms.length` not `allRooms` to avoid re-firing on reference changes.
- **agentsRef stable-closure pattern** — `agentsRef.current = agents` kept in sync each render; WebSocket transcript event callback reads `agentsRef.current` instead of capturing `agents` in closure, avoiding resubscription on every 30 s roster poll cycle.
- **Operator identity constant "operator"** — `pid === "operator"` is the isOperatorSelf check, matching the LiveKit join identity set in Plan 04 token request body.
- **Rule 3: useRosterAgents api-namespace guard** — `(api as any).ns?.list` optional chaining prevents TypeError when partial test mocks omit namespaces (approvalQueue, agentConfigVersions, agentProfiles); production unaffected since all namespaces exist there.
- **listRooms normalization in component** — WarRoom.tsx normalizes the `useQuery` result with `Array.isArray` check to support both the real `{active,closed,hasMore}` Convex shape and the flat-array test mock, without modifying test file or Convex layer.

**Phase 90 Plan 07 decisions (2026-06-26, Wave 5):**

- **Real Join replaces cosmetic state** — `WarRoom.tsx` dropped local `isJoined/isMuted` for `useWarRoomVoice()`; room-change effect calls `voice.leave()` (fixes T-90-LEAK audio leak on room switch).
- **Closed-room read-only (D-06)** — `isRoomEnded` (status≠active OR deep-link to non-existent room) renders the "Room Ended" notice + dimmed grid + disabled Join (Surface D); `TranscriptPanel live={false}`.
- **Live-chunk dedup (D-07)** — live transcript chunks filtered against persisted events by (timestamp, speakerId); persisted events carry `seq` for ordering.

**Phase 90 LIVE INTEGRATION GAP-CLOSURE (2026-06-27..29) — the cross-repo gate that was never closed:**

The 8 build plans were all GREEN in `convex-test`/jsdom, but the feature had **never been run end-to-end against the live stack**. The "Phase 90 cross-repo gate" (confirm `POST /api/war-room` ingest + `warRooms` Convex population) was flagged in scoping but **not actually closed before execution**. Running it live surfaced five layered gaps, each now fixed + committed:

1. **LiveKit + agent workers never started** — `livekit` server and the 5 `war-room-*` workers are behind the `war-room` Docker compose profile; a bare `docker compose up` skips them, so `create_war_room` got `ClientConnectorDNSError: livekit:7880` → HTTP 500 ("launch does nothing"). Fix: `docker compose --profile war-room up -d` (livekit + workers healthy; astridr creds already `devkey`/`secret`).
2. **Phase-90 Convex functions never deployed** — `listRooms` etc. were committed but not pushed; the live deployment ran the OLD array-returning `listRooms` → "Server Error" on the page. Fix: `npx convex dev --once` (deploys to `tidy-whale-981`).
3. **astridr never populated CodePulse's `warRooms`** — `/war-room-ingest` existed on CodePulse but **nothing in astridr ever called it**, so launched rooms never appeared in the list. Fix (commit astridr `97c63643`): `create_war_room`/`close_war_room` fire-and-forget `room.created`/`room.updated` to `${CONVEX_URL}/war-room-ingest` (mirrors the existing Supabase pattern). CodePulse `upsertWarRoom` made to preserve `name`/`createdAt` on update (commit `e09ce37`).
4. **Transcripts never streamed** — agents only wrote to Supabase. Fix (astridr `26874fac`): each Norse agent mirrors its committed response to `${CONVEX_URL}/transcript-ingest` → seq-ordered `warRoomEvents` (ROOM-04). Added `CONVEX_URL`+`ASTRIDR_INGEST_API_KEY` to the `x-war-room-env` compose anchor (workers lacked them).
5. **Two CodePulse bugs found while testing** — (a) launch dialog wiped the form on every parent re-render (effect keyed on the unstable `initialParticipantIds=[]` literal; now `[open]`-only + stable `EMPTY_IDS` ref + regression test) — commit `4c3372d`; (b) no way to delete a room — added `deleteWarRoom` mutation + trash affordance + `closeWarRoom` client; `room.updated` is now patch-only (`insertIfMissing=false`) so a late close can't resurrect a deleted room — commit `1189ff5`.

**Also learned:** rebuilding the `war-room-*` workers **evicts agents from any already-open room** (agents only join at dispatch/creation; a restarted worker does not auto-rejoin) — a live room goes silent after a worker rebuild; launch a fresh room. The astridr `POST /api/war-room/{room}/token` endpoint (commit `4093aec`) is live, Bearer-enforced, malformed-name→400.

**Phase 91 Plan 02 decisions (2026-06-29, Wave 1):**

- **ForceGraph3DLib is the sole react-force-graph-3d import site** — `ForceGraph3D.tsx` is the only file allowed to import `react-force-graph-3d`, `three`, or `3d-force-graph`; the `React.lazy` boundary in `CodeVaultGraph.tsx` keeps Three.js out of the main chunk (SC#2). Verified: `grep -rl "react-force-graph-3d" src` returns only this file.
- **cooldownTicks=150** — the library default is `Infinity`; a finite value is required so `onEngineStop` fires and `zoomToFit(400, 60)` runs on simulation settle (Pitfall 3). Value 150 matches ForceGraphCanvas's 120 ticks with a small buffer for 3D physics.
- **centerNode3DWhenReady appended without touching 2D path** — `centerNodeWhenReady` (L30-61) is byte-unchanged; the 3D function mirrors its RAF/cancel/frames/maxFrames structure exactly. `lookAt` passed as explicit node coords to prevent camera aiming at scene origin for off-center nodes (Pitfall 6).
- [Phase ?]: SC#2 PASS: three.js/react-force-graph-3d confined to ForceGraph3D-[hash].js lazy chunk; zero three.js markers in any of the 3 main index chunks
- [Phase ?]: 93-06: persona identity for Quality-page join = operational profile id stamped on session.active_profile, not shared persona_id
- [Phase ?]: 93-06: SELF-01 was never wired into AgentLoop in prod (dead since Phase 73); bootstrap now wires it, enable flag reverted post-verification (config/self-improvement.yaml)
- [Phase ?]: 93-06: Quality trends NOT trusted until E3 >=0.7 human-agreement gate closes (93-CALIBRATION.md, labels pending)
- [Phase ?]: 93-06 user-directed: astridr web chat cookie-session auth; profile-scoped /{p}/api/* auth bypass closed
- [Phase 95]: HARD-03: TS6 migration resolved via single tsconfig types:["node"] fix (Option A), not per-file globalThis casts; the four D-10 folded majors (diff@8, js-yaml@5, jsdom@29, react-easy-crop@6) were already merged to master and verified green under the new bar
- [Phase 95]: HARD-04: react-day-picker resolved by deleting the dead calendar.tsx primitive (zero consumers), not a 9->10 migration
- [Phase 101-01]: reminders is the Convex source of truth (D-01); complete() spawns the next open occurrence for recurring reminders via computeNextDueAt (D-05); one-offs and past-until recurrences spawn nothing — Locked by 101-CONTEXT.md D-01/D-05/D-09; source field records origin only and never gates writes
- [Phase 101-01]: recurrence.byday uses iCal 2-letter day codes (MO/TU/WE/TH/FR/SA/SU); Convex CRUD handlers extracted as plain *Handler(ctx,...) functions typed 'ctx: {db} | any' for unit-testing without convex-test — byday format was unspecified in the plan interface; handler pattern mirrors the existing evalScores.ts storeEvalScoreHandler precedent to sidestep QueryCtx/MutationCtx structural typing mismatch
- [Phase 101]: Tests invoke real httpAction handlers via Convex's _handler escape hatch (raw handler fn) instead of a hand-duplicated dispatch simulation, closing the test/implementation drift gap the codebase's forgeIngest.test.ts precedent left open
- [Phase 101]: calendarIngest requires calendarAccount (not just profileId+events) as a 400-gated field, since D-10's scoped prune is keyed on (profileId, calendarAccount)
- [Phase 101-03]: RemindersTool (astridr-repo) registers via the manifest TOML system (astridr/tools/manifests/reminders.manifest.toml, tool_id=="reminders"==RemindersTool.name), not config/tools.yaml's builtin/optional lists — confirmed that YAML section has zero consumers in the codebase; snooze is implemented as an op:"update" dueAt shift (not a true status:"snoozed" transition) because /reminders-ingest has no op:"snooze" and drops status/snoozedUntil on op:"update" — follow-up needed in convex/remindersIngest.ts to wire the existing api.reminders.snooze mutation
- [Phase 101-04]: astridr calendar cron registers via the real scheduler (cron_builders.py + cron_dispatcher.py), not jobs.py — jobs.py is JobManager (execution-tracking only), no periodic-job-registration surface exists there; bounded 60-day forward window achieved by post-filtering normalized events since GoogleWorkspaceTool.list_events has no time_min/time_max param — same file-scope correction likely applies to 101-05's coordination note
- [Phase 101-05]: reminder_nudge cron registers via cron_builders.py/cron_dispatcher.py (real scheduler), not jobs.py -- same file-scope correction as 101-04's calendar_cache precedent

### Pending Todos

- **v11.0 next action:** `/gsd-discuss-phase 97` (Real Skill Intake & Daemon Foundation) — roadmap defined 2026-07-17, requirements traced, ready for the discuss → ui-spec → plan → execute prerequisite chain. Execution step 1 within Phase 97: pin down where the daemon code lives (separate `forge` repo vs astridr-repo).
- **Phase 100 note:** depends on both Phase 98 (lifecycle mutations) and Phase 99 (launch/dispatch) — do not plan/execute 100 until both are complete.
- **Phase 99 note:** independent of the daemon work in 97/98 — can be discussed/planned/executed in parallel if desired, since it rides existing `chat.send`/`enqueueLaunch`/Ástríðr channels with no daemon dependency.
- **v10.0 (shipped, for reference):** ✅ COMPLETE — all 4 phases (93-96) done, milestone archived 2026-07-13.
- **Operational note:** the `war-room` Docker profile (livekit + 5 workers) must be running for War Room to work — `docker compose --profile war-room up -d`. Rebuilding workers evicts agents from open rooms.
- **Archive-name collision: ✅ RESOLVED/MOOT (2026-06-29)** — verified the feared stale `milestones/v9.0-*.md`/`v10/v11` adversarial-track archives are NOT present in this repo (milestones/ holds only v4/5/7/8; git never tracked milestones/v9.0-*). The only v9.0 file is CodePulse's own `.planning/v9.0-MILESTONE-AUDIT.md`. No rename needed.

### Blockers/Concerns

- None currently blocking v11.0. Phase 97's first execution step (pin down where the Forge daemon code lives — separate `forge` repo vs astridr-repo) is a scoping question to resolve during discuss/plan, not a blocker at roadmap time.
- Cross-repo handoff carried over from v10.0 Phase 96 (out of CodePulse scope, does not block v11.0): astridr-repo `chat.send` security-pipeline bypass + missing approval-block producer, routed to astridr Phase 178.1 (code-complete, pending live UAT as of 2026-07-13).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260713-q9k | ApprovalBlock update-by-id in Chat — resolution status-update blocks flip the existing card in place (D-05 handoff from astridr 178.1) | 2026-07-13 | 307b90a | [260713-q9k-approvalblock-update-by-id-in-chat-updat](./quick/260713-q9k-approvalblock-update-by-id-in-chat-updat/) |
| 260629-nnf | Complete Graphs Hub tile index — Capabilities, 3D Memory Galaxy, Hive/Swarm tiles | 2026-06-29 | 2d9df13 | [260629-nnf-graphs-hub-tile-index](./quick-archive/260629-nnf-graphs-hub-tile-index/) |
| 260629-oki | Reverse cross-graph deep-links (agent→tools, KG entity→owning agent) — GH-04 round-trip | 2026-06-29 | 6cffbae | [260629-oki-reverse-cross-graph-links](./quick-archive/260629-oki-reverse-cross-graph-links/) |
| 260629-ow5 | Memory ?event= deep-link focus — close the KG-provenance cross-nav target | 2026-06-29 | 58b999f | [260629-mem-event-deeplink](./quick-archive/260629-mem-event-deeplink/) |
| 260629-pcy | Hive swarm-task → agent cross-graph deep-link — Hive joins the cross-nav web | 2026-06-29 | b7b8e84 | [260629-hive-task-agent-link](./quick-archive/260629-hive-task-agent-link/) |
| 260629-qaj | Close out cross-nav — back-chip labels (Hive/Memory) + inbound agent→Hive (?goal=) | 2026-06-29 | b0253b3 | [260629-close-crossnav](./quick-archive/260629-close-crossnav/) |

## Session Continuity

Last session: 2026-07-21T21:38:00.000Z
Stopped at: Phase 98 Plan 04 (lifecycle menu assembly) complete — all 4 plans of Phase 98 code-complete
Next action: Phase 98 is code-complete end-to-end but NOT yet phase-verified — a manual UAT (real archive + a real cross-volume move against a live Forge daemon) is still required before the phase can be marked verified (see 98-04-SUMMARY.md "Next Phase Readiness"). Once that UAT passes, mark LIFE-01..06/DAEMON-02 complete in REQUIREMENTS.md and proceed to Phase 99 (Skill Launch/Dispatch, independent of 97/98) or Phase 100 (Control-Surface UX, depends on both 98 and 99). Separately, 101-REVIEW.md criticals (`/gsd-code-review 101 --fix` — CR-01 snooze never re-nudges, CR-02 edit popover UTC-shifts dueAt) and v12.0 milestone close-out (`/gsd-complete-milestone`) remain outstanding whenever convenient.
Resume file: .planning/phases/98-skill-lifecycle-mutations-archive-restore-move-delete/98-04-SUMMARY.md

## Operator Next Steps

- Review the v11.0 roadmap draft in `.planning/ROADMAP.md` (Phases 97-100) and `.planning/REQUIREMENTS.md` traceability.
- Once approved, proceed with `/gsd-discuss-phase 97` to begin the discuss → ui-spec → plan → execute chain for Phase 97 (Real Skill Intake & Daemon Foundation).
