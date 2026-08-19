---
phase: 122-tokens-primitives-contrast-measurement
plan: 05
subsystem: ui
tags: [tailwind, tokens, design-system, react, motion, contrast]

# Dependency graph
requires:
  - phase: 122-tokens-primitives-contrast-measurement
    provides: "src/index.css token layer (--surface-0/1/2/3, --hairline, --astridr, --status-*, --duration-*, --ease-house) from plans 122-01/122-02/122-03"
provides:
  - "21 files in src/components/ (F-M) fully converted to the token vocabulary: zero raw palette classes, zero surface hex literals, zero duration-NNN classes, zero raw violet utilities"
  - "sweep-ledgers/122-05-LEDGER.md: per-file before/after counts and per-site adjudication for slice B"
affects: [122-09-ratchet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sunken/nested row within a card (bg-gray-900/NN + border-gray-700/NN, one tier darker than the outer card) -> bg-background/NN + border-border/NN"
    - "Click-to-reveal expanded detail panel (bg-gray-900/80 + border-gray-700/40, appears only on isExpanded) -> bg-popover/80 + border-border/40, treated as a raised overlay layer"
    - "Divider rendered as a bg- 1px strip rather than a border- utility -> bg-border/NN (not bg-[var(--surface-3)], since it functions as a hairline, not a surface)"
    - "Rotation-indexed category-color array: adjudicate by whether the SLOT's meaning is fixed (named key) or arbitrary (array index over dynamic keys) -- fixed keys can carry --astridr, arbitrary rotation slots cannot, even at the identical literal hue"

key-files:
  created:
    - .planning/phases/122-tokens-primitives-contrast-measurement/sweep-ledgers/122-05-LEDGER.md
  modified:
    - src/components/FileOpsPanel.tsx
    - src/components/FileTree.tsx
    - src/components/GanttTimeline.tsx
    - src/components/GatewayQuotaPanel.tsx
    - src/components/GatewayTasksPanel.tsx
    - src/components/GitActivityWidget.tsx
    - src/components/GithubActionsPanel.tsx
    - src/components/HeartbeatAlertsPanel.tsx
    - src/components/HotReloadBar.tsx
    - src/components/InboxCard.tsx
    - src/components/InfoTooltip.tsx
    - src/components/IntegrationHealth.tsx
    - src/components/JobLifecyclePanel.tsx
    - src/components/KanbanColumn.tsx
    - src/components/LlmAnalyticsPanel.tsx
    - src/components/LlmProviderPanel.tsx
    - src/components/LoadingState.tsx
    - src/components/McpServerPanel.tsx
    - src/components/MemoryIndexHealth.tsx
    - src/components/MemoryQualityTab.tsx
    - src/components/MemorySourceBadge.tsx

key-decisions:
  - "Re-derived slice B's population directly from the corpus (occurrence counts via grep -oE, matching slice A's unit) rather than trusting the plan's file list alone -- population matched the plan's 21-file list exactly, no reconciliation needed, unlike slice A where the Task 3 file list needed correction"
  - "MemoryIndexHealth.tsx's typeColors[5] violet (a rotation-indexed category color assigned by array position over dynamic event-type keys) rehued to neutral rather than --astridr, despite the literal hue matching, because the SLOT's meaning is arbitrary (whichever type lands at index 5), not a fixed identity -- distinguished from MemorySourceBadge.tsx's mem0 key, which is a fixed, named Astridr subsystem and DID convert to --astridr"
  - "InfoTooltip.tsx's bg-card corrected to bg-popover per the plan's explicit raised/overlay-surface instruction, even though the regex bucket never matched it (bg-card is already a semantic alias, not a raw palette class) -- a role-correction the plan called out by name, not a bucket-driven change"
  - "KanbanColumn.tsx's two duration-200 sites had explicit non-house easing (ease-in-out); replaced rather than kept, since both are one-directional width-collapse settle transitions, not the symmetric 0%/50%/100% oscillations 122-03 carved an explicit exception for"

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-03]

# Metrics
duration: ~55min
completed: 2026-08-19
---

# Phase 122 Plan 05: Sweep Slice B (src/components/ F-M) Summary

**21 components (F-M) swept clean of every hardcoded surface, motion literal and raw violet utility -- 201 palette + 0 hex + 5 motion + 4 violet occurrences all converted to the Borealis token vocabulary, with the three operator-critical files (HeartbeatAlertsPanel, IntegrationHealth, GatewayQuotaPanel) verified to keep their warning/health-signal colors byte-identical.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-19T08:53:00Z (approx, first population-derivation command)
- **Completed:** 2026-08-19T09:11:22Z (final ledger-documentation commit)
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 21 components + 1 ledger

## Accomplishments
- Re-derived slice B's four-bucket population directly from the corpus (grep -oE occurrence counts), with all four matchers proven against known-positive controls (MemorySourceBadge/MemoryIndexHealth for violet, ObsidianGraph for hex, NotificationBell for palette, MetricCard for motion) before trusting any zero -- population matched the plan's 21-file list exactly
- Converted all 201 palette occurrences to semantic tokens (`bg-card`, `bg-popover`, `bg-background`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted-foreground`, `hover:bg-[var(--surface-3)]`) via per-file, role-based adjudication -- never a batch substitution. Hex bucket was zero across the whole slice, confirmed not a broken matcher via an outside-slice control.
- Verified the three T-122-05-A operator-critical files (`HeartbeatAlertsPanel.tsx`, `IntegrationHealth.tsx`, `GatewayQuotaPanel.tsx`) byte-for-byte: every green/red/yellow/blue/emerald warning or health-status class survived untouched, because none were ever in the neutrals bucket this plan converts. Only genuinely neutral fallback states (`Unknown`, `UNLIMITED`, the progress-bar track) converted.
- Converted all 5 `duration-NNN` motion sites to `duration-normal`/`duration-slow` + `ease-house`, replacing two sites' generic `ease-in-out` since both are one-directional settle transitions, not symmetric oscillations. No site crossed the >=400ms audit threshold.
- Adjudicated both violet sites individually, reaching opposite verdicts from the identical literal hue: `MemoryIndexHealth.tsx`'s rotation-indexed category slot rehued to neutral (its meaning is arbitrary, not fixed); `MemorySourceBadge.tsx`'s `mem0` source style converted to `var(--astridr)` (a fixed, named Astridr memory subsystem).
- Zero regressions: `npx tsc --noEmit` and `npm run build` both exit 0 throughout; `npx vitest run` held at 4772 passed / 0 failed (the recorded pre-plan baseline, re-verified fresh before starting) across two full-suite runs (post-Task-2, post-Task-3).
- Positive proof for the motion conversion: the built stylesheet contains `.duration-fast{}`, `.duration-normal{}`, `.duration-slow{}`, `.ease-house{}` by fixed-string search, with a bogus `.duration-nonsense-9x7q2{}` control absent, confirming the search discriminates.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-derive slice B's population and open the ledger** - `f4fe8e07` (docs)
2. **Task 2: Convert every palette class and hex literal in slice B** - `ec2d2cf0` (feat)
3. **Task 3: Convert slice B's motion literals and adjudicate its violet sites** - `99e35320` (feat)
4. **Ledger AFTER-table and adjudication completion** - `24344833` (docs)

_No separate plan-metadata commit -- this SUMMARY commit (below) serves that role, per the
orchestrator's shared-artifact-ownership instruction that state/roadmap files are out of scope
for this executor._

## Files Created/Modified
- `sweep-ledgers/122-05-LEDGER.md` - BEFORE/AFTER four-bucket population table (21 rows), matcher controls, and full per-site adjudication for slice B
- 21 `src/components/*.tsx` files (F-M) - every raw palette class, `duration-NNN` class and raw violet utility converted to the token vocabulary; see the ledger for the per-file role mapping. Hex bucket was zero throughout this slice.

## Decisions Made
- **Population needed no correction against the plan's file list**, unlike slice A: this plan's Task 3 indicative `<files>` list matched the re-derived Task 1 ledger exactly for both motion and violet buckets.
- **`MemoryIndexHealth.tsx`'s rotation-indexed violet slot rehued to neutral, not `--astridr`**, despite sitting next to `MemorySourceBadge.tsx`'s `mem0` site which DID convert -- the distinguishing factor is whether the site's meaning is a fixed, named identity (converts) or an arbitrary array-index rotation over dynamic keys (does not), not the literal hue.
- **`InfoTooltip.tsx`'s `bg-card` corrected to `bg-popover`** per the plan's explicit raised/overlay-surface instruction, even though the palette regex never flagged it (it was already a semantic token, just the wrong one for its role).
- **`KanbanColumn.tsx`'s two `ease-in-out` easings replaced with `ease-house`** rather than preserved, since both sites are one-directional column-width collapse/expand transitions -- not the symmetric bounce/ping/orbit oscillations `122-03-SUMMARY.md` established as house-easing exceptions.

## Deviations from Plan

None - plan executed exactly as written. The population re-derivation (Task 1), the three T-122-05-A
threat-flagged files' warning-color preservation (Task 2), and the per-site violet adjudication
(Task 3) are all explicitly anticipated and required by the plan's own text; documented above for
traceability, not as auto-fixes under the deviation rules.

## Issues Encountered

None. All edits landed on the first attempt per file; every post-edit re-grep confirmed the
expected zero before moving to the next file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Slice B (21 files, `src/components/` F-M) is fully token-clean across all four buckets (palette, hex, motion, violet), verified by both the specific matchers and outside-slice controls proving each matcher discriminates.
- `sweep-ledgers/122-05-LEDGER.md` is a complete, self-contained record (matchers, controls, before/after tables, full adjudication) consistent with slice A's (122-04) format, for plans 122-06/122-07/122-08's sibling slices and 122-09's ratchet to build against.
- No blockers. `src/index.css` (the token layer) was not touched, per the plan's explicit prohibition. No files outside the 21-file slice were touched. `.planning/STATE.md` and `.planning/ROADMAP.md` were not touched, per the orchestrator's shared-artifact-ownership instruction.
- Control files outside this slice (`NotificationBell.tsx`, `ObsidianGraph.tsx`, `MetricCard.tsx`, `OriginBadge.tsx`, `PluginPanel.tsx`, `RoutingDecisionsTable.tsx`) still hold unconverted classes in their respective buckets as expected -- confirms slices 122-06..122-08 and the later primitive-rewrite plans have real, disjoint work remaining and this plan did not accidentally encroach on it.

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*

## Self-Check: PASSED

- Commit `f4fe8e07` (Task 1): FOUND in `git log --oneline --all`
- Commit `ec2d2cf0` (Task 2): FOUND in `git log --oneline --all`
- Commit `99e35320` (Task 3): FOUND in `git log --oneline --all`
- Commit `24344833` (ledger completion): FOUND in `git log --oneline --all`
- `sweep-ledgers/122-05-LEDGER.md`: FOUND on disk
- All 21 files in `files_modified`: FOUND on disk
- Population re-check (fresh grep, all four buckets, all 21 files): 0/0/0/0
