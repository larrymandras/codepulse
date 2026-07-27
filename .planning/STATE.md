---
gsd_state_version: 1.0
milestone: v13.0
milestone_name: Brain-Swap Control, Cost Intelligence & Consolidation
status: milestone_planning
stopped_at: "v13.0 OPENED 2026-07-27 via /gsd-new-milestone (Phases 103-106: Brain-Swap Control Surface, Cost Intelligence, Tool & Trace Observability, Consolidation & Hardening). REQUIREMENTS.md + ROADMAP.md + PROJECT.md written; STATE reset by hand (no gsd-sdk verbs). No phases planned yet. Next: /gsd-plan-phase 103 (after discuss/ui-spec prerequisites). Prior — v11.0 SHIPPED & CLOSED 2026-07-25 (tag v11.0); v12.0 shipped 2026-07-23 (tag v12.0)."
last_updated: "2026-07-27T20:55:00.000Z"
last_activity: "2026-07-27 -- v13.0 milestone created (requirements BSC/COST/OBS/DEBT; roadmap phases 103-106; PROJECT.md current-milestone). Earlier same day - Phase-98 UAT tests 5 + 4-shadowed verified live; Forge queued-cards bug fixed (0a1b377); astridr invoke-leak detector shipped (b7e4a534))."
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

<!-- Counters hand-reconciled 2026-07-24 (gsd-sdk state.*/milestone.complete verbs miscount + clobber — NOT used; Phase 100 close done BY HAND per the established workaround, no gsd-sdk state.*/phase.complete/milestone.complete verbs run).
     ACTIVE MILESTONE = v11.0 (Skills, Phases 97-100): 97 COMPLETE (6 plans), 98 COMPLETE (5 plans), 99 COMPLETE (7 plans = 6 build + 99-07 gap closure), 100 COMPLETE (5 plans: 100-01/02/03/05/04) — completed_plans:23 = 6+5+7+5; total_plans:23; percent by phase = 4/4 = 100.
     v11.0 is now CODE-COMPLETE across all 4 phases. [UPDATE 2026-07-25: v11.0 FORMALLY CLOSED — tagged `v11.0`, `milestones/v11.0-MILESTONE-AUDIT.md` written, archived. The Phase-97 INTAKE-01..04/DAEMON-01/04 traceability rows were reconciled Pending→Complete at that close (see `milestones/v11.0-REQUIREMENTS.md` line ~93) — no code gap, they were delivered by Phase 97 (6/6 plans, live-verified 2026-07-19) and only the checkboxes lagged.] Phase 100's own manual live-Forge-daemon drag verification (archive/move/restore round-trip + honest rollback) remains outstanding, same category as Phase 98/99's own deferred manual checks.
     v12.0 (Reminders & Calendar, Phases 101-102) SHIPPED & ARCHIVED 2026-07-23 (10/10 plans, tagged v12.0) — closed by hand (extract-don't-delete: REQUIREMENTS.md kept live, only the v12.0 section extracted to milestones/v12.0-REQUIREMENTS.md; ROADMAP.md collapsed; audit moved to milestones/). v12.0 scope was Phases 101 (7 plans incl. 101-07 gap closure) + 102 (3 plans, tech-debt close-out).
     NOTE 2026-07-22: this file's WORKING COPY was found reverted to an earlier "executing / Plan 1 of 5" snapshot at the
     start of Plan 98-05's execution (frontmatter status/stopped_at/Current Position all regressed vs. the committed
     HEAD, which correctly showed Phase 98 as milestone_complete/4-4-done) — the same gsd-sdk state.* full-frontmatter-
     resync clobbering bug documented throughout this file's own Decisions history below. Rebuilt from git HEAD
     (`git show HEAD:.planning/STATE.md`) plus this plan's own edits rather than committing the stale regression. -->

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-17)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it.
**Current focus:** **v13.0 (Brain-Swap Control, Cost Intelligence & Consolidation) OPENED 2026-07-27** — requirements + roadmap written (Phases 103-106: Brain-Swap Control Surface · Cost Intelligence · Tool & Trace Observability · Consolidation & Hardening); no phases planned yet. Next: **/gsd-plan-phase 103** (after discuss/ui-spec prerequisites — 103 is a frontend surface + the BSC-05 cross-repo integration gate). Prior v11.0 (Skills) & v12.0 (Reminders) shipped.

**LIVE-VERIFY — status 2026-07-27** (a Clerk-signed-in session cleared the auth-gate blocker):

1. **Phase-98 Test 5** — ✅ **VERIFIED LIVE 2026-07-27.** Archive on a skill with a dormant cold copy → toast shows "a dormant copy already exists in cold storage", NOT "Server Error" (CR-03/ConvexError fix `1899d891` confirmed end-to-end; being signed in was load-bearing — `enqueueLifecycle`'s auth guard throws a plain Error that redacts to "Server Error").
2. **Phase-98 Test 4 (shadowed)** — ✅ **VERIFIED LIVE 2026-07-27.** Cold Storage ⋯ menu on a staged shadowed skill (active `claude-code` + dormant `claude-code:available` under one name) showed **Restore disabled** + the shadow tooltip, page did NOT blank (CR-02 holds). Staging cleaned to zero residue.
3. **Chat voice round-trip** — basic STT→native tool→TTS re-verified 2026-07-27 (weather query, clean). The full "Hey Ástríðr" wake → "stop" barge-in → "goodbye" re-arm sequence was NOT re-run this session.

(NOTE 2026-07-27: STATE.md frontmatter was regressed AGAIN by the gsd-sdk resync clobber [v11→v8, counters zeroed to 1/1/13/13]; hand-restored from the committed-HEAD v11.0 values this session per the established workaround.)

## Current Position

**ACTIVE: v13.0 (Phases 103-106) — OPENED 2026-07-27, planning stage.** Requirements (BSC-01..05 / COST-01..03 / OBS-01..03 / DEBT-01..04) in REQUIREMENTS.md; roadmap in ROADMAP.md. 0/4 phases planned. Sequencing: 106 (tech-debt) independent + low-risk; 103 gates on astridr's brain-swap backend being live end-to-end (BSC-05); 104/105 additive. Next: `/gsd-plan-phase 103`.

---

**Prior milestone —** Milestone: **v11.0 (Skills Command Center — Full Lifecycle & Launch) — ✅ SHIPPED & CLOSED 2026-07-25**, tagged `v11.0`. Phases 97-100 (23 plans), 22/22 requirements. Audit `tech_debt` (0 blockers). Archived to `milestones/v11.0-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT}.md` + `milestones/v11.0-phases/`.
Phase 100 UAT (operator, 2026-07-25): drag archive→restore round-trip PASSED live; honest-failure path confirmed; CR-02 unit-verified + live dormant→cold no-op observed.
This session also folded a large Skills-page redesign into Phase 100 (3-column command-center layout, right-hand Command Deck, filter chips, bulk-select, bridge-mirror filter, no-op feedback) — all tested, full suite green.
Queued post-v11.0 (operator-confirmed order) — **ALL DONE 2026-07-26** (ad-hoc/quick, not GSD phases; codepulse 565cef36 + astridr 82ead1fe, both pushed):

- **① fix mangled skill display names** ✅ — family-aware `generateDisplayName` (cc_-twin dedup + ≥3-member family + colon-namespace); `migrateDisplayNames` rewrote 198 auto-names on the live self-hosted Convex (0 human-edited touched); 23 unit tests.
- **② Ástríðr bridge coverage** ✅ FULLY DONE — safe-7 (`.claude-alt` plugin re-root + vault `.agents/skills` junction targets) AND the deferred-3 project-repo skills (spike-findings-forge / add-migration / home-assistant-manager, each repo's `.claude/skills` mounted read-only + added to `bridge.yaml`). **All 10 previously-unbridged skills now have cc_ twins — 202 total, live-verified astridr→forge→Convex.** astridr commits 82ead1fe + 46873c84. They load under `skill_auto_approve` (own repos; `blocked_skills` gate applies). Detail: HANDOFF-post-v11.0.md item ②.
- **③ Chat command-center** ✅ — 3-column HUD (chat · real AvatarAura + Control Center · new VitalsRail from existing Convex tables + one lean `getRecentlyUsedSkills` query); mockup→sign-off→build→~6 live iterations. Bonus: Inbox Enter-key AND R-key phantom-expand both fixed (Enter marks-read; R opens the reject input via a new InboxCard `rejectSignal` prop). codepulse commits 565cef36 / 2fac593.

Status: No active milestone. v11.0 closed; **post-v11.0 backlog FULLY CLEAR.** Next: /gsd-new-milestone.

**v12.0 (Personal Productivity — Reminders & Calendar) SHIPPED & ARCHIVED 2026-07-23** — Phases 101 (7/7, done 2026-07-20) + 102 (3/3 tech-debt close-out, live-verified 2026-07-23); 9/9 requirements; tagged `v12.0`; milestone audit `tech_debt` (0 blockers, 2 flagged items closed by Phase 102). Archived to `milestones/v12.0-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT}.md`. Closed by hand (no `gsd-sdk milestone.complete`) — REQUIREMENTS.md kept live with only the v12.0 section extracted.
Last activity: 2026-07-24 -- Phase 100 Plan 04 (final control-surface wiring: Skills.tsx + MoveToProjectDialog + integration drop tests) complete

**v11.0 resumed** (HISTORICAL mid-execution snapshot — SUPERSEDED by the "v11.0 SHIPPED & CLOSED 2026-07-25" status above; Phases 99/100 were subsequently completed and the milestone shipped): Phase 97 (Real Skill Intake & Daemon Foundation) COMPLETE (6/6 plans, operator-verified live 2026-07-19, commit 495946f). Phase 98 (Lifecycle Mutations) PLANNED 2026-07-21 (4 plans, 3 waves, checker passed); Plan 98-01 EXECUTED 2026-07-21 (Convex substrate — see 98-01-SUMMARY.md); Plan 98-02 EXECUTED 2026-07-21 (Forge daemon executor — see 98-02-SUMMARY.md); Plan 98-03 EXECUTED 2026-07-21 (lifecycle UI building blocks — see 98-03-SUMMARY.md); Plan 98-04 EXECUTED 2026-07-21 (lifecycle menu assembly — see 98-04-SUMMARY.md). Live UAT session (2026-07-21) found 1 real gap (stale-origin prune on move/delete of the last skill in a workspace) alongside 2 passed checks and 2 blocked-on-Clerk-auth checks; gap-closure Plan 98-05 PLANNED + EXECUTED 2026-07-22 (see 98-05-SUMMARY.md) — closes the gap cross-repo (forge `scannedOrigins` manifest + codepulse `computeSkillPrunes` manifest-aware pruning). Daemon code lives in C:\Users\mandr\forge, ROADMAP's "astridr-repo" note is stale. Phase 98 is now 5/5 plans code-complete; the 98-05 fix's own MANUAL verification steps (live G: repro + transient-unmount negative check) remain outstanding. Phases 99 (Launch/Dispatch) + 100 (Control-Surface UX) were subsequently completed — v11.0 shipped & closed 2026-07-25 (tag v11.0).

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
| 99 | Skill Launch / Dispatch | LAUNCH-01..04 | ✅ Complete (7/7 plans; verified 10/10 2026-07-23) |
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
- Phase 102 added: Address tech debt: reminders dead code + astridr comment cleanup

### Decisions

See PROJECT.md Key Decisions table for full history.

**v11.0 / Phase 100 Plan 04 decisions (2026-07-24, final control-surface wiring — Skills.tsx + MoveToProjectDialog + integration drop tests, closes out Phase 100):**

- **`dropTargetScope` is fully independent from the category rail's `dropTarget`** — `handleDropOnCategory` and its state are byte-unchanged; `ScopeRail` is mounted as a sibling section immediately below the `CategoryGrid` block (Pitfall 5).
- **`handleDropOnScope` never enqueues on a `dialog` result** — it only calls `setScopeMoveDialog`, opening the page-level `MoveToProjectDialog`; the pending paint (`beginPending`) begins exclusively in the dialog's own `onMoved` callback (fired after a successful `enqueueLifecycle` inside the dialog's `handleConfirm`), never at drop time (D-03, Pitfall 2/4).
- **The enqueue branch calls `beginPending` synchronously before `enqueueLifecycle`**, with a `.catch()` that calls `clearPending` + `toast.error(lifecycleRefusalMessage(err))` — the only rollback path for a LAYER-1 synchronous preflight refusal, since no `forgeCommands` row is ever created for that case and the async reconcile effect (Plan 02) alone could never clear it (Pitfall 3).
- **Host resolved via the existing `resolveHostId(useForgeHostsRaw() ?? [], undefined)` export** from `SkillLifecycleMenu.tsx` — no new host-resolution mechanism invented, matching every other lifecycle call site.
- **Rule 1 auto-fix:** mounting `ScopeRail` made 5 pre-existing `Skills.test.tsx` selectors ambiguous — `ScopeRail`'s own always-visible "Cold Storage" scope entry (Plan 03's fixed 3-entry rail) collided with the pre-existing left-rail Cold-Storage nav-toggle button (both `role="button"`, both containing the text "Cold Storage"). Added `data-testid="cold-storage-nav-toggle"` to the pre-existing button and re-scoped the 5 affected tests to that testid rather than changing either component's visible copy.
- **TDD gate closed per the 100-03 precedent** for a plan where the dedicated test task (Task 3) necessarily follows its own implementation (Tasks 1-2): `handleDropOnScope` was temporarily neutered (early `return`) to confirm a genuine RED (3/3 mutation-affected cases failed with the expected assertion errors: `enqueueLifecycle` called 0 times instead of 1, dialog stub `data-open="false"` instead of `"true"`), then restored byte-identical (diffed against a pre-mutation backup — confirmed identical) and reconfirmed GREEN (27/27).
- **Phase 100 is now 5/5 plans code-complete** (100-01, 100-02, 100-03, 100-05, 100-04) — v11.0's last phase. UX-01..04 marked Complete in REQUIREMENTS.md at this phase-close, matching the LIFE-01..06/LAUNCH-01..04 precedent from Phases 98/99 (requirements marked Complete once all planned code plans land, with the phase's own manual/live-daemon verification tracked as deferred/accepted tech debt, not a blocker to marking). This plan's own `<verification>` section still lists a live-Forge-daemon drag round-trip (archive/move/restore + honest rollback) as outstanding manual verification.
- **Full suite verified green post-wiring:** 215 test files / 2515 tests passed, 0 failures; `tsc --noEmit` clean (excluding pre-existing `TS7006` errors in `src/pages/Inbox.tsx` from a concurrent unrelated session, per this plan's own scope boundary — untouched, not staged).
- **Executed sequentially on `master`** (worktrees disabled per `config.json`); STATE.md/ROADMAP.md/REQUIREMENTS.md updated by hand per this file's established anti-clobber workaround — no `gsd-sdk state.*`/`roadmap.update-plan-progress`/`requirements.mark-complete` verbs run.

**v11.0 / Phase 100 Plan 05 decisions (2026-07-24, SkillRow pending overlay + drag reporting + UX-01/UX-04 audit):**

- **Pending overlay reads `usePendingMove(skill.name)` from context, never a new prop** — every existing `SkillRow` call site (`AllSkillsOverview`/`SkillsInCategory`/`ColdStorageView`) keeps compiling unchanged; matches Plan 02's context-not-prop-drilling design.
- **Pending bar mirrors `CategoryGrid`'s active glow-bar geometry** (`absolute left-0 top-0 bottom-0 w-1`) but in `bg-[var(--status-info)]` with `animate-pulse`, never `--primary` — the D-05 honesty rule that "pending, unconfirmed" can never read as "active/selected." Distinct opacity values (dormant 50%, pending 70%) keep the two states from ever visually overlapping.
- **`onDragStart` calls `setDraggingSkill(skill)`; new `onDragEnd` calls `setDraggingSkill(null)`** — closes the wiring gap `ScopeRail` (100-03) needed to compute per-entry drop validity from `useDraggingSkill()`.
- **Task 2 audit found NO production-code gap** — `SkillRow` has always-rendered `SkillLifecycleMenu` since Phase 98, so the ⋯ menu is identical across all three row surfaces by construction; only test-coverage gaps existed (`AllSkillsOverview` had no menu-render assertion; `SkillsInCategory` had no test file at all — created new). `grep -rn manage-skills src/components/skills/` confirmed the string survives only in `ColdStorageView.test.tsx`'s preserved negative assertion, nowhere in source. QuickDeck's Run-default click gesture (Phase 99 D-02/D-03) accepted as "reconciled" with the row menu's own Run submenu, not a menu-identity requirement.
- **Logged one out-of-scope finding to `deferred-items.md`** (4 pre-existing `TS7006` errors in `src/pages/Inbox.tsx` from a concurrent unrelated session's in-progress `InboxFilterBar.tsx` edit) — left untouched per scope-boundary rule, not staged/committed.
- **Executed sequentially on `master`** (worktrees disabled per `config.json`); STATE.md/ROADMAP.md updated by hand per this file's established anti-clobber workaround — no `gsd-sdk state.*`/`roadmap.update-plan-progress` verbs run.

**v11.0 / Phase 100 Plan 03 decisions (2026-07-24, ScopeRail — 3 always-visible scope drop targets):**

- **Fixed 3-entry `SCOPE_ENTRIES` constant (global/project/cold), never gated on a nonzero count** — a user must be able to drag into an empty Cold Storage (UI-SPEC's explicit "Empty state — Scope rail" note); matches CategoryGrid's markup/hover/active/drop-target pattern verbatim, extended with a destructive invalid-drop branch CategoryGrid lacks.
- **Per-entry validity only computed for the entry currently equal to `dropTargetScope`** (`resolveScopeDrop` is called at most once per render, not once per entry) — reads `useDraggingSkill().draggingSkill` from the 100-02 `SkillControlSurfaceProvider` context; `noop` results fall through to the plain idle branch (no highlight), matching D-02's "honest, no fake feedback" no-op rule.
- **`data-scope` attribute (not a class selector) used for DOM/test addressing** — mirrors the existing `data-testid="category-nav-item"` convention on `CategoryGrid`.
- **TDD gate closed properly**: implementation was written first, then the test file was written and the implementation temporarily renamed aside to confirm a genuine RED failure (`Failed to resolve import "./ScopeRail"`) before restoring it and confirming GREEN (5/5 tests) — avoiding the fail-fast trap of a test suite that could never have failed.
- **UX-02 still NOT marked complete in REQUIREMENTS.md** — this plan ships only the presentational drop-target component; nothing in `Skills.tsx` mounts it or wires a real `enqueueLifecycle`/dialog dispatch yet (Plan 100-04's job). Matches the established per-plan-vs-full-delivery precedent (Phase 98's LIFE-01..06, Phase 99's LAUNCH-01..04, Plans 100-01/02's own UX-01/UX-03 deferrals).
- **Executed sequentially on `master`** (worktrees disabled per `config.json`); STATE.md/ROADMAP.md updated by hand per this file's established anti-clobber workaround — no `gsd-sdk state.*`/`roadmap.update-plan-progress` verbs run.

**v11.0 / Phase 100 Plan 02 decisions (2026-07-24, commandId-correlated pending map + control-surface context):**

- **`usePendingLifecycleMoves()` correlates by `commandId` via `.find()`, never by skillName alone** — ports the `useIntakeFeed.ts:95-100` dedupe precedent, made status-aware: `done` clears silently, `failed`/`expired` clear + `toast.error` (real `lifecycleRefusalMessage`-stripped reason / the reused literal `"Expired — no daemon claimed this command."` copy), `queued`/`executing` left untouched. A row with a different `commandId` for the same skillName never reconciles the entry (Pitfall 1, unit-tested).
- **`clearPending` is the LAYER-1 `.catch()` escape hatch (Pitfall 3)** — a synchronous `enqueueLifecycle` rejection never produces a `forgeCommands` row, so the reconcile effect alone could never clear that entry; Plan 04's caller must call `clearPending` directly from its `.catch()`.
- **Both tasks (pending-map hook + `SkillControlSurfaceProvider`/reader hooks) landed in one GREEN commit** — they share the identical file by design (plan explicitly keeps client-surface state colocated) and the single RED test commit already covered both tasks' acceptance criteria together; splitting would have required an artificial partial-file checkpoint with no independently-verifiable intermediate state.
- **`React.createElement` instead of JSX** in both the implementation and test files, so `usePendingLifecycleMoves.ts`/`.test.ts` could stay plain `.ts` (matching the plan's literal file list) rather than needing a `.tsx` extension solely for the Provider component and one test-harness consumer component.
- **UX-03 NOT marked complete in REQUIREMENTS.md** — this plan ships the client-only optimistic-state machine + context, but nothing enqueues a real `enqueueLifecycle` call yet (Plan 04) and no drop target exists yet (Plan 03); matches the established Phase 98/99 precedent of deferring requirement completion to full end-to-end delivery, not per-plan code-completion.
- **A concurrent session committed unrelated `useAstridrVoice.ts`/`.test.ts` changes to this same `master` branch during this plan's execution** (commits `8788630`/`932b97f`/`798639e`, phase 186-01 voice-debug instrumentation — unrelated to v11.0/Phase 100) — confirmed via `git show --stat` that neither of this plan's own commits (`0506693`, `40768d0`) touched those files; noted per the 2026-07-09 shared-branch-concurrency lesson, no action needed.
- **Executed sequentially on `master`** (worktrees disabled per `config.json`); STATE.md/ROADMAP.md updated by hand per this file's established anti-clobber workaround — no `gsd-sdk state.*`/`roadmap.update-plan-progress` verbs run.

**v11.0 / Phase 100 Plan 01 decisions (2026-07-24, shared scope predicate + drag matrix):**

- **`resolveLifecycleActions` extracted verbatim** from `SkillLifecycleMenu.tsx`'s former inline block (`src/lib/skills.ts`), and `resolveScopeDrop` added alongside it as the complete drag matrix (D-02) — both pure, unit-tested (24 new tests: 6 parity + 18 matrix cells), no React/Convex imports.
- **`resolveScopeDrop` takes an optional `lane` param** (default `"active"`, mirroring `resolveLifecycleActions`) so a future Cold Storage drag caller can pass `lane="cold"` — the only way the "dormant && shadowed" matrix cell is reachable, since `isDormant`/`isShadowing` are mutually exclusive on real origins data (same WR-04 convention `SkillLifecycleMenu.tsx` already uses for its own dormant-branch override).
- **Cold-target drops always noop regardless of shadow status** (already cold, nowhere shorter to go) — the shadow-block only gates the global/project targets.
- **Rule 1 auto-fix:** `SkillLifecycleMenu.test.tsx`'s `isShadowing` mock factory needed updating (not its assertions) after the refactor — ESM same-module calls (`resolveLifecycleActions` → `isShadowing`, both defined in `skills.ts`) are not intercepted by mocking only the module's `isShadowing` export, so the mock factory was extended to also re-derive `resolveLifecycleActions().shadowed` through the same spy. 30/30 existing tests pass with byte-identical assertions.
- Full suite verified green post-refactor: 2470 tests passed, 0 failed; `tsc --noEmit` clean.
- **Executed sequentially on `master`** (worktrees disabled per `config.json`); STATE.md updated by hand per this file's established anti-clobber workaround (see the HTML comment below the frontmatter) — no `gsd-sdk state.*` verbs run.

**v11.0 / Phase 99 (Skill Launch / Dispatch) decisions (2026-07-23, executed 6 build plans + 1 gap closure, wave-based, worktrees disabled → sequential):**

- **Three launch paths behind ONE shared layer (D-01/D-10/D-12).** `SkillLaunchProvider` hosts a single page-level `ForgeLaunchModal` + the Forge-path `recordSkillLaunch`; `useRunLaunch`/`RunTargetChooser`/`RunTargetItems` route Chat & Ástríðr targets by navigating to `/chat` with an `AutoSendHandoff` (router state) and Forge to the provider modal — so no launch logic is duplicated across the many rows/tiles that expose Run. Contracts (`src/lib/skillRun.ts`, `src/lib/profiles.ts`) were built first (Wave 1) so Waves 2–5 built against fixed types.
- **Chat auto-send is a REAL send, not a prefilled composer (LAUNCH-01/03, D-05).** `Chat.tsx` fires `chat.send` on mount from the handoff (StrictMode-guarded single-fire via `firedRef`, honest disconnect toast, router state cleared after firing). The Ástríðr variant forwards the persona `profile` onto `chat.send` (D-07/D-14a) — profile scopes `SecurityContext.profile_id` server-side only, NOT a persona-voice switch; the popover makes no "answered as X" claim (D-09).
- **HONESTY INVARIANT (D-12/D-13) was the phase's headline goal and its main risk.** Code review (99-REVIEW.md) found 2 blockers that both defeated it, both fixed in gap-closure **99-07** with TDD: (CR-01) `useAstridrChat.sendMessage` resolved even on a failed/rejected send, so `Chat.tsx` recorded a phantom launch — fixed by making `sendMessage` return `Promise<boolean>` (true only on `ack.status === "ok"`) and gating `recordSkillLaunch` on `if (sent)`; (CR-02) the Forge path recorded on the OPTIMISTIC `onLaunched` paint before the Convex mutation confirmed — fixed by adding `onLaunchConfirmed?` to `ForgeLaunchModal` (fired only after `await launch(...)` resolves) and moving the provider's record onto it. After the fix `useCount` reflects real runs only. `convex/forge.ts` Clerk fail-closed gate untouched throughout (T-99-10).
- **Dead paths retired (D-13):** copy-to-clipboard no longer records a launch anywhere (SkillRow/QuickDeck/SkillCommandPalette), and the passive `/chat?skill=` open-in-chat affordance (a confirmed no-op) was removed entirely across the shared row/container/palette components; QuickDeck primary click now opens the Run chooser (Run = default gesture, D-02/D-03), copy demoted to a secondary non-recording hover icon.
- **CR-03 deferred (pre-existing, NOT a phase-99 regression):** raw `setIsStreaming(false)` at `useAstridrChat.ts` L189 (introduced 2026-07-20, commit `1900944`) can desync `isStreamingRef` vs the sibling `run.completed` handler and block a subsequent send. Plausible but depends on live backend event ordering — per the 2026-07-20 voice-timing lesson, fixing blind risks a streaming regression; recommended follow-up is to instrument the event lifecycle and fix from a real trace. Candidate future tech-debt/quick task.
- **Executed with worktrees DISABLED** (`workflow.use_worktrees=false`) so all 7 plans ran sequentially on `master`; **STATE.md/ROADMAP.md/REQUIREMENTS.md were updated BY HAND at close** (this entry + the counters + the roadmap/requirements checkboxes), NO `gsd-sdk state.*`/`roadmap.update-plan-progress`/`phase.complete` verbs were run, per this file's established anti-clobber workaround. Verifier independently confirmed 10/10 must-haves against live source (not SUMMARY claims), full suite 2447 tests / tsc clean.

**v11.0 / Phase 98 Plan 05 decisions (2026-07-22, gap closure — stale-origin prune fix, cross-repo):**

- **Producer-declares-coverage manifest pattern** — forge's `buildSkillSnapshot` now returns `scannedOrigins: string[]` alongside `skills`, declaring exactly which origins it covered on this scan (both home roots unconditionally, plus each synced workspace whose root passed an `fs.statSync` reachability check). This lets codepulse's `computeSkillPrunes` distinguish "covered but now empty" (safe to prune) from "unscanned/unreachable" (must stay untouched) — the root cause of the UAT-found gap where the last skill moved out of a project workspace left its `claude-code:project:<key>` row forever, rendering the skill as false multi-scope and disabling Archive/Move.
- **Reachability is keyed on the workspace ROOT, not `.claude/skills`** — an empty-but-reachable workspace still contributes its origin to the manifest (zero skills, origin still declared); an unreachable root (unmounted G: drive) contributes to neither `skills` nor `scannedOrigins` — the T-98-10 transient-unmount safety valve.
- **`computeSkillPrunes`'s legacy no-arg path is byte-for-byte unchanged** — the prunable-origin set defaults to exactly `incomingByOrigin.keys()` when `scannedOrigins` is `undefined`; the manifest, when present, only ever ADDS origins to eligibility (union, never replaces), so all 5 pre-existing tests stayed green with zero test rewrites.
- **`registry.ts`'s prune guard relaxed from a single length check to an OR** (`snap.skills.length > 0 || (Array.isArray(snap.scannedOrigins) && snap.scannedOrigins.length > 0)`) at both `syncInventory` and `syncFullInventory` call sites — a snapshot that emptied an origin now reconciles, while a fully-empty, manifest-less snapshot still cannot wipe the registry (T-98-11).
- **No TDD RED/GREEN split commits** — tests and implementation were authored together per task (one commit per repo) rather than a literal separate failing-test commit; both repos' scoped suites plus `tsc --noEmit` were verified green, and codepulse's full suite (204 test files, 2331 tests) was run as an extra check since this closes out Phase 98's wave — zero regressions.
- **STATE.md working copy was found reverted to a stale "Plan 1 of 5 / executing" snapshot at session start** (frontmatter + Current Position regressed vs. the already-committed `milestone_complete`/4-4-done HEAD) — the same gsd-sdk `state.*` full-frontmatter-resync clobbering bug documented in every prior Phase 98 plan's Decisions entry below. Rebuilt this file from `git show HEAD:.planning/STATE.md` plus this plan's own edits, per the established workaround; no `gsd-sdk state.*` mutating verbs were run this plan.
- **Phase 98's two MANUAL verification steps from the 98-05 plan's own `<verification>` section (live G: repro re-check + transient-unmount negative check) are explicitly deferred** — both require a live Forge daemon and a live Google Drive mount, out of scope for an automated executor pass. LIFE-03/LIFE-04/DAEMON-02/DAEMON-03 (this plan's `requirements` frontmatter) are the specific requirement IDs this gap-closure plan targets; they were already marked Complete in REQUIREMENTS.md at Phase 98's original completion (commit `54b6278`) and remain so — this plan is a bugfix on already-complete requirements, not a new completion event.

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
- [Phase 102]: Phase 102 Plan 01: self-hosted Convex codegen needed a freshly-generated admin key (docker exec convex-backend ./generate_admin_key.sh) passed as inline shell env vars for a single command, since the stored local admin key was stale and secret config files cannot be read or written per project security policy
- [Phase 102-02]: Deleted dead CodePulsePoster class + orphaned constants from calendar_cache.py, switched cron_dispatcher.py's _run_calendar_cache_refresh to pass self._telemetry (shared ConvexHandler), and swept the stale two-backend/404/transitional narrative out of tools/reminders.py's comment block to state the current single-local-backend truth. Live cron-tick proof deferred to plan 102-03. AUDIT-TD-02.

### Pending Todos

- **v11.0 next action:** Phase 100 (Control-Surface UX) is now 4/5 plans complete (100-01, 100-02, 100-03, 100-05 done 2026-07-24). Next: execute Plan 100-04 (Skills.tsx integration, Wave 3 — depends on 100-01/02/03; also benefits from 100-05's SkillRow pending overlay + drag reporting). It's the LAST plan of the LAST v11.0 phase.
- **Phase 99 follow-up (non-blocking):** CR-03 pre-existing `isStreamingRef` desync (`useAstridrChat.ts` L189) — needs a live event-lifecycle trace before fixing (do NOT blind-fix; see 2026-07-20 voice-timing lesson). Candidate quick task / tech-debt.
- **Phase 98 follow-up (non-blocking):** its two MANUAL verification steps (live G: workspace repro re-check + transient-unmount negative check) remain outstanding — both require a live Forge daemon + live Google Drive mount.
- **v10.0 (shipped, for reference):** ✅ COMPLETE — all 4 phases (93-96) done, milestone archived 2026-07-13.
- **Operational note:** the `war-room` Docker profile (livekit + 5 workers) must be running for War Room to work — `docker compose --profile war-room up -d`. Rebuilding workers evicts agents from open rooms.
- **Archive-name collision: ✅ RESOLVED/MOOT (2026-06-29)** — verified the feared stale `milestones/v9.0-*.md`/`v10/v11` adversarial-track archives are NOT present in this repo (milestones/ holds only v4/5/7/8; git never tracked milestones/v9.0-*). The only v9.0 file is CodePulse's own `.planning/v9.0-MILESTONE-AUDIT.md`. No rename needed.

### Blockers/Concerns

- None currently blocking v11.0. Phase 98's 98-05 gap closure landed 2026-07-22; its own manual verification steps (live G: repro + transient-unmount negative check) are outstanding but non-blocking for proceeding to Phase 99.
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
| Phase 102 P01 | 6min | 2 tasks | 4 files |
| Phase 102 P02 | 25min | 2 tasks | 4 files |

## Session Continuity

Last session: 2026-07-27T20:51:24.948Z
Stopped at: context exhaustion at 78% (2026-07-27)
Next action: Execute Plan 100-04 (Skills.tsx integration — Wave 3, depends on 100-01/02/03). This is the LAST remaining plan in Phase 100 (and v11.0). Plan 100-05 shipped `SkillRow`'s optimistic-pending visual treatment (opacity-70 + pulsing `--status-info` bar, read from the 100-02 `SkillControlSurfaceProvider` context via `usePendingMove`) plus `onDragStart`/`onDragEnd` reporting the dragged skill via `setDraggingSkill` — both pieces 100-04 needs to wire a real drag-drop lifecycle mutation with honest optimistic UI against `ScopeRail` (100-03). Plan 100-05's Task 2 audit also confirmed (not assumed) that the ⋯ `SkillLifecycleMenu` already renders consistently across `AllSkillsOverview`/`SkillsInCategory`/`ColdStorageView` and that no `/manage-skills` string survives anywhere in source — closing UX-01/UX-04's completeness-audit scope with zero production-code changes needed. Plan 100-03 shipped `ScopeRail` (`src/components/skills/ScopeRail.tsx`) — 3 always-visible Global/Project/Cold Storage native HTML5 drop targets mirroring `CategoryGrid`'s markup/highlight pattern verbatim, per-entry valid/invalid/idle states computed from `useDraggingSkill()` (100-02) + `resolveScopeDrop()` (100-01), inline destructive reject hint, presentational + event-forwarding only (props: `dropTargetScope`/`onDragOverScope`/`onDragLeaveScope`/`onDropOnScope`) — Plan 100-04 must import and mount this component directly beneath `CategoryGrid` and wire its callback props to real state + `enqueueLifecycle`/dialog dispatch, no duplication. Locked decisions carried forward from 100-01/02/03: droppable scope rail beneath Categories (D-01); drag matrix mirrors the ⋯ menu exactly via the shared `resolveLifecycleActions`/`resolveScopeDrop` predicate (D-02); drop-on-Project opens MoveToProjectDialog picker (D-03); drag never deletes (D-04); optimistic move + honest rollback reconciled against the lifecycle command-row status (D-05, implemented by 100-02, visualized by 100-05); UX-01/UX-04 treated as completeness+verification, not net-new (D-06, closed by 100-05). **Codepulse-only, frontend-focused — no new daemon/Convex mutation expected** (rides 98's `enqueueLifecycle` + 99's launch). UX-02/UX-01/UX-03/UX-04 requirements NOT yet marked complete in REQUIREMENTS.md — deferred to full end-to-end delivery at Plan 100-04's completion, matching this project's established per-plan-vs-full-delivery precedent (e.g. Phase 98's LIFE-01..06). Non-blocking carryovers: (1) Phase 99 CR-03 `isStreamingRef` desync (`useAstridrChat.ts` L189) — needs a live trace before fixing (99-REVIEW.md); (2) Phase 98's two MANUAL verification steps (live G: repro + transient-unmount — need a live Forge daemon + Google Drive mount); (3) `102-REVIEW.md`'s 4 advisory warnings; (4) a concurrent unrelated session is mid-edit on `src/pages/Inbox.tsx`/`src/components/InboxFilterBar.tsx` (introduces 4 pre-existing TS7006 errors, logged to Phase 100's `deferred-items.md`, not touched by this plan) — noted per the shared-branch-concurrency lesson.
Resume file: None

## Operator Next Steps

- Review the v11.0 roadmap draft in `.planning/ROADMAP.md` (Phases 97-100) and `.planning/REQUIREMENTS.md` traceability.
- Once approved, proceed with `/gsd-discuss-phase 99` to begin the discuss → ui-spec → plan → execute chain for Phase 99 (Skill Launch / Dispatch) — independent of 97/98, can run any time.
- Optional, whenever a live Forge daemon + Google Drive mount are convenient: run the two manual verification steps from 98-05's plan to fully close out Phase 98's live UAT.
