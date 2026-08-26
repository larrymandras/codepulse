---
phase: 122-tokens-primitives-contrast-measurement
plan: 06
subsystem: ui
tags: [tailwind, tokens, design-system, react, motion, contrast, violet-adjudication]

# Dependency graph
requires:
  - phase: 122-tokens-primitives-contrast-measurement
    provides: "src/index.css token layer (--surface-0/1/2/3, --hairline, --astridr, --status-*, --status-error-fill/-on-fill, --duration-*, --ease-house) from plans 122-01/122-02/122-03"
provides:
  - "34 files in src/components/ (N-S) fully converted to the token vocabulary: zero raw palette classes, zero surface hex literals, zero duration-NNN classes, zero raw violet utilities"
  - "sweep-ledgers/122-06-LEDGER.md: per-file before/after counts and per-site adjudication for slice C (the densest non-hr/ violet cluster in the phase)"
affects: [122-09-ratchet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status hex literals in a per-state Record<string,string> lookup table (SwarmTaskNode's failed/cancelled) are NOT data-driven series colors -- convert to --status-* like any other status class, even though they live inside a state-color map"
    - "A <select> dropdown control maps to bg-popover per the conversion contract's own 'dropdown' naming, same tier as tooltip/popover"
    - "Two generic UI-selection-state violet sites (RoutingDecisionsTable/SessionTimeline active-filter toggles) re-hue to --primary, not a --status-* token or --astridr -- 'this is selected' is exactly what --primary signals app-wide"
    - "A fixed enumerated LIFECYCLE STATE (SwarmTaskNode's verifying) on an Astridr-owned widget still re-hues to --status-* rather than --astridr, because the color's role is 'operational status', not 'this represents Astridr' -- the whole widget already implies ownership, so tagging one arbitrary state astridr-violet would misleadingly single it out"
    - "A single fixed color applied uniformly regardless of arbitrary content (PluginPanel's category chip, styled purple no matter what p.config.category holds) has no stable identity to convert -- re-hues to neutral, distinct from a genuinely fixed-key category"

key-files:
  created:
    - .planning/phases/122-tokens-primitives-contrast-measurement/sweep-ledgers/122-06-LEDGER.md
  modified:
    - src/components/NotificationBell.tsx
    - src/components/ObsidianGraph.tsx
    - src/components/OperatorScoreCard.tsx
    - src/components/OrbitalStatusRings.tsx
    - src/components/OriginBadge.tsx
    - src/components/PermissionDecisionsChart.tsx
    - src/components/PhaseProgressBars.tsx
    - src/components/PluginPanel.tsx
    - src/components/PrivacyShield.tsx
    - src/components/ProfileCard.tsx
    - src/components/PromptActivityChart.tsx
    - src/components/ProviderControls.tsx
    - src/components/ProviderHealthPanel.tsx
    - src/components/QueenNode.tsx
    - src/components/RateLimitGauges.tsx
    - src/components/RecentGitActivity.tsx
    - src/components/RecoveryCommits.tsx
    - src/components/RecoveryTimeline.tsx
    - src/components/ReplayButton.tsx
    - src/components/RoutingDecisionsTable.tsx
    - src/components/SankeyFlow.tsx
    - src/components/ScanResultsPanel.tsx
    - src/components/SectionErrorBoundary.tsx
    - src/components/SecurityEventFeed.tsx
    - src/components/SecurityStats.tsx
    - src/components/SessionCapabilities.tsx
    - src/components/SessionComparison.tsx
    - src/components/SessionDurationHistogram.tsx
    - src/components/SessionHeader.tsx
    - src/components/SessionTimeline.tsx
    - src/components/Skeleton.tsx
    - src/components/SupabasePanel.tsx
    - src/components/SwarmTaskNode.tsx
    - src/components/SystemResources.tsx

key-decisions:
  - "SwarmTaskNode.tsx's 9 status hex literals (#ef4444/#f59e0b in three per-state Record lookup tables) converted to --status-error/--status-warn rather than left as a 'data-driven, out of scope' exception -- these are fixed STATUS colors for named lifecycle states, not a chart series, and an existing status token exists for exactly this semantic (same precedent as slice A's BlackboardPanel.tsx)"
  - "RoutingDecisionsTable.tsx's violet corrected against the plan's own speculative prose: the plan's orientation text framed it as 'which brain/engine handled a turn', but the live code shows the violet is purely a generic filter-toggle active state with zero provider/brain color-coding anywhere in the file -- re-hued to --primary, not adjudicated as Astridr-owned or provider-owned"
  - "SwarmTaskNode.tsx's verifying lifecycle state re-hued to --status-info rather than --astridr, despite the whole widget being Astridr's own agent swarm visualization -- the color's role is one arbitrary slot in an 8-state operational-status vocabulary (pending/claimed/running/verifying/done/failed/verify_rejected/cancelled), not an identity marker; using --astridr there would misleadingly single out one state as 'the Astridr one' when the entire node already is"
  - "Zero --astridr conversions this slice (7 violet sites, all re-hued to indigo/neutral/primary/status-info) -- every site traced to a referent that is NOT a fixed, named Astridr subsystem (a third-party CLI tool's provenance tag, an arbitrary-content category chip, two generic UI selection states, a generic capability-category legend entry, and one enumerated status state), which is a real, code-derived split per D-08's own audit requirement, not a shortcut"
  - "Skeleton.tsx: plan's own justification ('matches the shadcn ui/skeleton.tsx idiom') is stale -- that file actually uses bg-accent (which resolves to violet/#8b5cf6 in every dark theme), not bg-muted. Followed the plan's DIRECTIVE (bg-muted, independently correct per this plan's own interfaces table) while correcting the stale citation in the ledger"
  - "SectionErrorBoundary.tsx's outer fill converted to --status-error tokens (not a neutral card) per the plan's explicit T-122-06-A instruction, so the failure affordance's own background now carries the signal rather than relying solely on its border -- a plan-directed correction beyond the four regex buckets, verified via full diff read"

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-03]

# Metrics
duration: ~50min
completed: 2026-08-19
---

# Phase 122 Plan 06: Sweep Slice C (src/components/ N-S) Summary

**34 components (N-S) swept clean of every hardcoded surface, motion literal and raw violet utility -- 339 palette + 10 hex + 3 motion + 20 violet occurrences all converted, with zero --astridr conversions this slice (all 7 distinct violet sites traced to non-Astridr referents and re-hued to indigo/neutral/primary/status-info), including a correction to the plan's own speculative framing of RoutingDecisionsTable's violet as provider-identity.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-08-19T09:22:00Z (approx, first population-derivation command)
- **Completed:** 2026-08-19T09:41:00Z (final ledger-completion commit)
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 34 components + 1 ledger

## Accomplishments
- Re-derived slice C's four-bucket population directly from the corpus (grep -oE occurrence counts), with all four matchers proven against known-positive controls (ObsidianGraph hex, OriginBadge violet) before trusting any zero -- population matched the plan's 34-file list exactly, no files added or removed.
- Corrected Task 3's indicative file list against the re-derived population (same pattern slice A hit): motion actually lands in OperatorScoreCard/QueenNode/SwarmTaskNode, not NotificationBell/ReplayButton as the plan's indicative list suggested.
- Converted all 339 palette occurrences to semantic tokens via per-file, role-based adjudication -- never a batch substitution. Converted all 10 hex occurrences: 9 status hex literals in SwarmTaskNode's per-state lookup tables (to --status-error/--status-warn) and 1 chrome border on ObsidianGraph's canvas container (to --hairline-strong), with the file's 8-color neon node/link palette correctly left untouched as genuinely data-driven series color.
- Verified all four threat-flagged files (SecurityEventFeed, SecurityStats, RateLimitGauges, PermissionDecisionsChart) byte-for-byte: every severity/warning color survived untouched.
- Applied a plan-directed correction to SectionErrorBoundary.tsx beyond the four regex buckets: its outer fill now carries the --status-error signal (not a neutral card), per T-122-06-A's explicit instruction, with the full diff read to confirm only color classes changed.
- Converted all 3 duration-NNN motion sites (one >=400ms, audited: OperatorScoreCard's 500ms collapsed to duration-slow, a genuine speed-up, recorded per the audit rule) plus centralized two near-duplicate custom cubic-beziers onto --ease-house.
- Adjudicated all 7 distinct violet sites individually, reaching a real (not uniform) split: 0 converted to --astridr, 7 re-hued (2 to indigo, 1 to neutral, 2 to --primary, 1 to --status-info, with the PluginPanel category chip separately re-hued to neutral) -- including a correction to the plan's own speculative "brain/engine" framing of RoutingDecisionsTable's violet, which the live code shows is a generic UI selection state.
- Zero regressions: `npx tsc --noEmit` and `npm run build` both exit 0; `npx vitest run` held at 4772 passed / 0 failed (the recorded pre-plan baseline) across three full-suite runs (post-Task-2, post-Task-3, final).
- Positive proof for the motion conversion: the built stylesheet contains `.duration-slow{}`, `.duration-normal{}`, `.ease-house{}` by fixed-string search, with a bogus `.duration-nonsense-9x7q2{}` control absent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-derive slice C's population and open the ledger** - `dcbc41fc` (docs)
2. **Task 2: Convert every palette class and hex literal in slice C** - `fae4e2cc` (feat)
3. **Task 3: Convert slice C's motion literals and adjudicate its violet sites** - `db9ff3ad` (feat)
4. **Ledger AFTER-table and adjudication completion** - `2d1c8cb8` (docs)

_No separate plan-metadata commit -- this SUMMARY commit (below) serves that role, per the
orchestrator's shared-artifact-ownership instruction that state/roadmap files are out of scope
for this executor._

## Files Created/Modified
- `sweep-ledgers/122-06-LEDGER.md` - BEFORE/AFTER four-bucket population table (34 rows), matcher controls (re-verified against the final working tree, not just at planning time), and full per-site adjudication for slice C.
- 34 `src/components/*.tsx` files (N-S) - every raw palette class, surface hex literal, `duration-NNN` class and raw violet utility converted to the token vocabulary; see the ledger for the per-file role mapping and per-site violet reasoning.

## Decisions Made
- **SwarmTaskNode.tsx's status hex literals converted, not exempted.** The plan's data-viz exception is for genuinely data-driven colors (chart series, graph nodes); SwarmTaskNode's hex values are fixed STATUS colors keyed by lifecycle state name, structurally identical to slice A's BlackboardPanel precedent -- converted to `--status-error`/`--status-warn`.
- **RoutingDecisionsTable.tsx's violet corrected against the plan's own prose.** The plan speculated "Astridr-owned rows convert, a third-party provider's row does not" -- the live code has zero provider-keyed color anywhere; the violet is a generic active-filter-toggle state, re-hued to `--primary`. Recorded as a correction to the plan's orientation text per its own "decide from the code" instruction, not a defect in the plan's actual task instructions.
- **SwarmTaskNode.tsx's `verifying` state re-hued to `--status-info`, not `--astridr`**, despite the whole widget rendering Astridr's own agent swarm -- the color's role is one slot in an 8-state operational-status vocabulary, not an identity marker; tagging only `verifying` as astridr-violet would misleadingly single out one lifecycle stage.
- **Skeleton.tsx followed the plan's directive (`bg-muted`) while correcting its stale justification** -- the plan claimed this matches `ui/skeleton.tsx`'s idiom, but that file uses `bg-accent` (which resolves to violet in every dark theme); `bg-muted` is independently correct per this plan's own interfaces table, so the directive stands and only the citation was flagged as stale.
- **SectionErrorBoundary.tsx's fill mapped to `--status-error` tokens**, a plan-directed correction beyond the four regex buckets (the panel's fill previously matched every other neutral card; now the fill itself signals failure, per T-122-06-A).

## Deviations from Plan

None requiring Rule 1-4 classification. Two corrections to the plan's own text are documented above and in the ledger (RoutingDecisionsTable's speculative framing; Skeleton.tsx's stale shadcn citation) -- both are the plan's own "decide from the code" and "Stale Docs" instructions being followed, not auto-fixes of a defect. The Task 3 indicative file list needed the same kind of correction slice A's did (re-derived population is authoritative, as the plan states).

## Issues Encountered

One self-caught editing mistake: an early edit to `SwarmTaskNode.tsx`'s `stateDot`/`stateIconColor`
tables inserted a duplicate `verifying` key instead of replacing the existing violet entry in
place. Caught immediately by re-grepping for `verifying` before moving on, fixed with a follow-up
edit removing the duplicate, and verified via `npx tsc --noEmit` (which would have failed on a
genuine duplicate-key type error, though `Record<string,string>` object literals only warn, not
error, in TS -- the re-grep was the actual catch). No commit was made with the duplicate present.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Slice C (34 files, `src/components/` N-S) is fully token-clean across all four buckets (palette, hex, motion, violet), verified by both the specific matchers and out-of-slice controls proving each matcher discriminates, re-checked against the final working tree after all edits landed.
- `sweep-ledgers/122-06-LEDGER.md` is a complete, self-contained record (matchers, controls, before/after tables, full adjudication) consistent with slices A (122-04) and B (122-05)'s format, for plans 122-07/122-08's sibling slices and 122-09's ratchet to build against.
- No blockers. `src/index.css` (the token layer) was not touched, per the plan's explicit prohibition. No files outside the 34-file slice were touched. `.planning/STATE.md` and `.planning/ROADMAP.md` were not touched, per the orchestrator's shared-artifact-ownership instruction. Verified via `git diff --stat` across all four commits in this plan.
- Control files outside this slice (`TeamStatusCards.tsx`, `HeroStatsBar.tsx`, `WarRoomKanbanColumn.tsx`, `hr/AgentCard.tsx`) still hold unconverted classes in their respective buckets as expected -- confirms slices 122-07/122-08 and the `hr/`-tree/primitive-rewrite plans have real, disjoint work remaining and this plan did not accidentally encroach on it.

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*

## Self-Check: PASSED

- Commit `dcbc41fc` (Task 1): FOUND in `git log --oneline --all`
- Commit `fae4e2cc` (Task 2): FOUND in `git log --oneline --all`
- Commit `db9ff3ad` (Task 3): FOUND in `git log --oneline --all`
- Commit `2d1c8cb8` (ledger completion): FOUND in `git log --oneline --all`
- `sweep-ledgers/122-06-LEDGER.md`: FOUND on disk
- All 34 files in `files_modified`: FOUND on disk
- Population re-check (fresh grep, all four buckets, all 34 files): 0/0/0/0
