---
phase: 122-tokens-primitives-contrast-measurement
plan: 04
subsystem: ui
tags: [tailwind, tokens, design-system, react, motion, contrast]

# Dependency graph
requires:
  - phase: 122-tokens-primitives-contrast-measurement
    provides: "src/index.css token layer (--surface-0/1/2/3, --hairline, --astridr, --status-*, --duration-*, --ease-house) from plans 122-01/122-02/122-03"
provides:
  - "36 files in src/components/ (A-E) fully converted to the token vocabulary: zero raw palette classes, zero surface hex literals, zero duration-NNN classes, zero raw violet utilities"
  - "sweep-ledgers/122-04-LEDGER.md: per-file before/after counts and per-site adjudication for slice A, reusable as a template for plans 122-05..122-08's sibling slices"
affects: [122-05, 122-06, 122-07, 122-08, 122-09-ratchet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Card/panel wrapper: bg-gray-800/50 + border-gray-700/50 -> bg-card/50 + border-border/50 (single most common site shape in this slice)"
    - "Nested content tile role split: bg-muted for shallow static tiles, bg-popover for click-to-reveal detail panels, bg-background for darkest-tier sunken viewports (form inputs, media preview, code blocks)"
    - "Row hover/zebra: bg-muted/NN static stripe, hover:bg-[var(--surface-3)]/NN interactive hover"
    - "Status-unknown fallback dots/chips use bg-muted-foreground / bg-muted, never a --status-* token"
    - "Text ink split by original weight: -100/-200/-300 -> text-foreground, -400/-500/-600 -> text-muted-foreground"

key-files:
  created:
    - .planning/phases/122-tokens-primitives-contrast-measurement/sweep-ledgers/122-04-LEDGER.md
  modified:
    - src/components/ActiveTimeChart.tsx
    - src/components/ActivityHeatmap.tsx
    - src/components/AgentDetailPanel.tsx
    - src/components/AgentNode.tsx
    - src/components/AgentProfileEditor.tsx
    - src/components/AlertBanner.tsx
    - src/components/AlertRuleForm.tsx
    - src/components/AlertRulesEngine.tsx
    - src/components/AmbientAudioPlayer.tsx
    - src/components/ApiErrorPanel.tsx
    - src/components/AppErrorBoundary.tsx
    - src/components/AvatarGallery.tsx
    - src/components/AvatarUploader.tsx
    - src/components/BashLog.tsx
    - src/components/BlackboardPanel.tsx
    - src/components/BuildActivityFeed.tsx
    - src/components/CallGraphPanel.tsx
    - src/components/CapabilityGrowthChart.tsx
    - src/components/ChannelHealthPanel.tsx
    - src/components/CompactionTimeline.tsx
    - src/components/ComponentHealthGrid.tsx
    - src/components/ComponentTable.tsx
    - src/components/ContextGauge.tsx
    - src/components/ContextHistory.tsx
    - src/components/CronExecutionHistory.tsx
    - src/components/DeliveryHistory.tsx
    - src/components/DiscoveredToolsTable.tsx
    - src/components/DockerPanel.tsx
    - src/components/DriftTimeline.tsx
    - src/components/EntityRow.tsx
    - src/components/ErrorBoundary.tsx
    - src/components/ErrorFallback.tsx
    - src/components/ErrorRateTrend.tsx
    - src/components/EventFeed.tsx
    - src/components/ExecutionFilterBar.tsx
    - src/components/ExecutionTable.tsx

key-decisions:
  - "Re-derived slice A's population from the corpus rather than trusting the plan's file list guesses for Task 3's motion/violet scope -- 4 of 6 motion sites and 0 of 2 violet sites appeared in files the plan's indicative Task 3 <files> list did not name"
  - "BlackboardPanel.tsx's 4 hex status-icon literals (#22c55e/#ef4444) converted to --status-ok/--status-error rather than left as an out-of-scope exception, since an exact-semantic token already exists"
  - "DiscoveredToolsTable.tsx's memory category chip adjudicated to var(--astridr) (names Astridr's own memory capability per TOKEN-02); AgentDetailPanel.tsx's handoff event-type chip adjudicated to neutral (generic coordination category, not Astridr-owned) -- same literal colour, opposite verdicts, per-site adjudication as required"
  - "EntityRow.tsx's duration-500 (>=400ms) recorded in the ledger per the audit rule; its near-duplicate custom cubic-bezier(0.23,1,0.32,1) treated as a pre-existing house-curve author rather than a deliberately-different curve, matching the .msg-turn precedent from 122-03"

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-03]

# Metrics
duration: 30min
completed: 2026-08-19
---

# Phase 122 Plan 04: Sweep Slice A (src/components/ A-E) Summary

**36 components (A-E) swept clean of every hardcoded surface, motion literal and raw violet utility -- 442 palette + 5 hex + 6 motion + 5 violet occurrences all converted to the Borealis token vocabulary, each conversion role-adjudicated per-file and recorded in a ledger.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-19T12:22:00Z (approx, first population-derivation command)
- **Completed:** 2026-08-19T12:48:11Z (final commit)
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 36 components + 1 ledger

## Accomplishments
- Re-derived slice A's four-bucket population directly from the corpus (not from CONTEXT.md or the plan's guesses), with matchers proven against known-positive controls before trusting any zero
- Converted all 442 palette occurrences and 5 hex occurrences to semantic tokens (`bg-card`, `bg-popover`, `bg-muted`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`) via per-file, role-based adjudication -- never a batch substitution
- Converted all 6 `duration-NNN` motion sites to `duration-fast`/`duration-slow` + `ease-house`, with the one >=400ms collapse (`EntityRow.tsx`, 500ms->320ms) recorded in the ledger per the audit rule
- Adjudicated both violet sites individually: one converted to `var(--astridr)` (names Astridr's own memory capability), one re-hued to neutral (generic coordination-event category) -- same literal Tailwind colour, opposite verdicts, exactly the discipline TOKEN-02 requires
- Zero regressions: `npx tsc --noEmit` and `npm run build` both exit 0 throughout; `npx vitest run` held at 4772 passed / 0 failed (the recorded pre-plan baseline) across three separate full-suite runs

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-derive slice A's population and open the ledger** - `3988f811` (docs)
2. **Task 2: Convert every palette class and hex literal in slice A** - `5f40cfb6` (feat)
3. **Task 3: Convert slice A's motion literals and adjudicate its violet sites** - `206a26ff` (feat)

_No separate plan-metadata commit -- this SUMMARY commit (below) serves that role, per the
orchestrator's shared-artifact-ownership instruction that state/roadmap files are out of scope
for this executor._

## Files Created/Modified
- `sweep-ledgers/122-04-LEDGER.md` - BEFORE/AFTER four-bucket population table (36 rows), matcher controls, and full per-site adjudication for hex/motion/violet
- 36 `src/components/*.tsx` files (A-E) - every raw palette class, surface hex literal, `duration-NNN` class and raw violet utility converted to the token vocabulary; see the ledger for the per-file role mapping

## Decisions Made
- **Task 3's indicative `<files>` list was wrong; the re-derived Task 1 ledger was treated as authoritative**, exactly as the plan instructed. Motion hits actually landed in `AlertRuleForm.tsx`, `AlertRulesEngine.tsx`, `DriftTimeline.tsx`, `EntityRow.tsx` -- none of which were in the plan's guessed list of 7 files, while 6 of the 7 guessed files (`AgentDetailPanel`, `AgentNode`, `AlertBanner`, `BlackboardPanel`, `EventFeed`, `ExecutionTable`) held zero motion hits.
- **Hex status-icon literals were converted rather than declared out-of-scope.** `BlackboardPanel.tsx`'s `text-[#22c55e]`/`text-[#ef4444]` state-icon colours are not "data-driven" in the chart-series sense the plan's out-of-scope exception exists for -- an exact-semantic token (`--status-ok`/`--status-error`) already exists and is already used identically in `StatusBadge.tsx`.
- **Nested content tiles were split into three distinct roles** (bg-muted / bg-popover / bg-background) rather than one blanket mapping, based on the original literal's depth and interaction role (static stat tile vs. click-to-reveal detail panel vs. sunken input/media/code viewport) -- recorded as a reviewer-facing convention section in the ledger since it recurs ~15+ times across the slice.
- **`placeholder-gray-NNN` classes were converted for consistency even though the palette regex does not match them** (it only matches `bg|text|border|from|to|via` prefixes) -- this doesn't change any measured count but avoids leaving a hardcoded placeholder colour sitting next to a token-clean input.

## Deviations from Plan

None - plan executed exactly as written. The two "Decisions Made" items about Task 3's file list and the hex-status-icon conversion are both explicitly anticipated and authorized by the plan's own text (Task 1's action block instructs treating the re-derived ledger as authoritative over the file list; the hex conversion table instructs converting rather than exempting where a token fits) and are documented above for traceability, not as auto-fixes under the deviation rules.

## Issues Encountered
- One `Edit` call against the ledger failed on first attempt with a "string not found" error because my `old_string` misquoted a nearby line ("Per-file notes" vs. the actual "Per-site notes"). Caught immediately via the tool's own error message, re-read the exact bytes, and retried successfully -- no data loss, no incorrect content ever written.
- Two `replace_all` edits (`ExecutionFilterBar.tsx`'s two near-identical ternary branches, differing only by indentation) applied to only one of two intended occurrences because the strings weren't byte-identical; caught by the post-edit palette re-grep (which returned non-zero instead of the expected zero) and fixed with a second, more targeted edit.
- The pre-plan baseline vitest run showed `App.test.tsx` failing once under full-suite resource contention; confirmed as a pre-existing timing flake unrelated to this slice by re-running it in isolation (19/19 passed). Not investigated further as out-of-scope (untouched file, pre-existing behavior) per the plan's scope boundary; all three full-suite runs taken during this plan's own edits (post-Task-2, post-Task-3, and the isolated control) showed 4772/0, so the flake did not recur once isolated from contention.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Slice A (36 files, `src/components/` A-E) is fully token-clean across all four buckets (palette, hex, motion, violet), verified by both the specific matchers and a full corpus-wide zero-count re-check, each paired with a known-positive or known-negative control.
- `sweep-ledgers/122-04-LEDGER.md` is a complete, self-contained record (matchers, controls, before/after tables, full adjudication) that plans 122-05 through 122-08 can use as a structural template for their own disjoint slices.
- No blockers. `src/index.css` (the token layer) was not touched, per the plan's explicit prohibition. No files outside the 36-file slice were touched.
- Control file `src/components/FileOpsPanel.tsx` (outside this slice) still holds unconverted palette classes as expected -- confirms slices 122-05..122-08 have real, disjoint work remaining and this plan did not accidentally encroach on it.

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*

## Self-Check: PASSED

- Commit `3988f811` (Task 1): FOUND in `git log --oneline --all`
- Commit `5f40cfb6` (Task 2): FOUND in `git log --oneline --all`
- Commit `206a26ff` (Task 3): FOUND in `git log --oneline --all`
- `sweep-ledgers/122-04-LEDGER.md`: FOUND on disk
- All 36 files in `files_modified`: FOUND on disk
- Population re-check (fresh grep, all four buckets, all 36 files): 0/0/0/0
