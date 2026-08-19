# Sweep Ledger — 122-06 (Slice C: `src/components/` N–S, 34 files)

## Matchers (verbatim, run against `git`'s working tree at execution time)

```
palette: (bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}
hex:     (bg|border|text)-\[#          (fixed-string the `#` where the tool requires it)
motion:  duration-[0-9]+
violet:  (bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}
```

Counting method: `grep -oE '<pattern>' <file> | wc -l` per file — this is **occurrences**, not
matching lines and not files. Matches the unit slices A (122-04) and B (122-05) used, for a
consistent phase-wide ledger format. Command form used throughout:

```bash
grep -oE '(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}' "$f" | wc -l
```

## Control — matchers proven against known-positives before trusting any zero

- `src/components/ObsidianGraph.tsx` is known (per the plan's own Task 1 acceptance criterion) to
  hold a hex literal: measured **1** hex occurrence (`border-[#00ffcc]/20` on the canvas
  container). Non-zero.
- `src/components/OriginBadge.tsx` is known (per the plan's own Task 1 acceptance criterion) to
  hold violet utilities: measured **4** violet occurrences (`bg-purple-500/10` x2,
  `text-purple-400`, `text-purple-300`). Non-zero.
- Palette matcher control: `src/components/PluginPanel.tsx` (in this slice, but independently
  verifiable) measured **32** palette occurrences. Non-zero.
- Motion matcher control: `src/components/MetricCard.tsx` (outside this slice, owned by D-13's
  later rewrite) — non-zero, per slices A/B's ledgers; not re-measured here since this slice has
  its own non-zero motion population (see below).
- All four matchers proven to discriminate before any zero in this ledger is trusted.

## Population disagreement vs. the plan's `files_modified` list

None on the file list itself — re-derived fresh via `grep -oE` directly against these 34 files
(not the alphabetic N–S range of `src/components/`, which holds 55 files; the plan's 34-file list
is a disjoint partition, not a literal alphabetic slice — `PageHeader.tsx`, `StatusBadge.tsx`,
`Sparkline.tsx` and 18 other N–S files belong to primitive-rewrite plans or sibling slices
122-07/122-08). All 34 files in `files_modified` were confirmed present on disk before measuring.

**Task 3's indicative `<files>` list needed correction, same pattern as slice A.** The plan names
`OriginBadge, PluginPanel, RoutingDecisionsTable, SessionCapabilities, SessionTimeline,
SwarmTaskNode, NotificationBell, ReplayButton` for Task 3. The re-derived BEFORE table below is
authoritative: `NotificationBell.tsx` and `ReplayButton.tsx` hold **zero** motion and **zero**
violet hits (their palette hits are Task 2 work only) and do not belong in Task 3's actual file
set. The real motion-holding files are `OperatorScoreCard.tsx` (1), `QueenNode.tsx` (1) and
`SwarmTaskNode.tsx` (1) — none of which were in the plan's indicative Task 3 list except
`SwarmTaskNode`. The violet-holding files exactly match six of the plan's eight named files:
`OriginBadge` (4), `PluginPanel` (2), `RoutingDecisionsTable` (6), `SessionCapabilities` (3),
`SessionTimeline` (3), `SwarmTaskNode` (2).

## BEFORE table (occurrences, one row per file in `files_modified`; 34 rows)

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/NotificationBell.tsx` | 17 | 0 | 0 | 0 |
| `src/components/ObsidianGraph.tsx` | 1 | 1 | 0 | 0 |
| `src/components/OperatorScoreCard.tsx` | 0 | 0 | 1 | 0 |
| `src/components/OrbitalStatusRings.tsx` | 8 | 0 | 0 | 0 |
| `src/components/OriginBadge.tsx` | 6 | 0 | 0 | 4 |
| `src/components/PermissionDecisionsChart.tsx` | 10 | 0 | 0 | 0 |
| `src/components/PhaseProgressBars.tsx` | 8 | 0 | 0 | 0 |
| `src/components/PluginPanel.tsx` | 32 | 0 | 0 | 2 |
| `src/components/PrivacyShield.tsx` | 3 | 0 | 0 | 0 |
| `src/components/ProfileCard.tsx` | 28 | 0 | 0 | 0 |
| `src/components/PromptActivityChart.tsx` | 12 | 0 | 0 | 0 |
| `src/components/ProviderControls.tsx` | 3 | 0 | 0 | 0 |
| `src/components/ProviderHealthPanel.tsx` | 20 | 0 | 0 | 0 |
| `src/components/QueenNode.tsx` | 0 | 0 | 1 | 0 |
| `src/components/RateLimitGauges.tsx` | 6 | 0 | 0 | 0 |
| `src/components/RecentGitActivity.tsx` | 11 | 0 | 0 | 0 |
| `src/components/RecoveryCommits.tsx` | 8 | 0 | 0 | 0 |
| `src/components/RecoveryTimeline.tsx` | 18 | 0 | 0 | 0 |
| `src/components/ReplayButton.tsx` | 3 | 0 | 0 | 0 |
| `src/components/RoutingDecisionsTable.tsx` | 12 | 0 | 0 | 6 |
| `src/components/SankeyFlow.tsx` | 12 | 0 | 0 | 0 |
| `src/components/ScanResultsPanel.tsx` | 4 | 0 | 0 | 0 |
| `src/components/SectionErrorBoundary.tsx` | 6 | 0 | 0 | 0 |
| `src/components/SecurityEventFeed.tsx` | 10 | 0 | 0 | 0 |
| `src/components/SecurityStats.tsx` | 3 | 0 | 0 | 0 |
| `src/components/SessionCapabilities.tsx` | 20 | 0 | 0 | 3 |
| `src/components/SessionComparison.tsx` | 18 | 0 | 0 | 0 |
| `src/components/SessionDurationHistogram.tsx` | 5 | 0 | 0 | 0 |
| `src/components/SessionHeader.tsx` | 13 | 0 | 0 | 0 |
| `src/components/SessionTimeline.tsx` | 16 | 0 | 0 | 3 |
| `src/components/Skeleton.tsx` | 11 | 0 | 0 | 0 |
| `src/components/SupabasePanel.tsx` | 7 | 0 | 0 | 0 |
| `src/components/SwarmTaskNode.tsx` | 2 | 9 | 1 | 2 |
| `src/components/SystemResources.tsx` | 6 | 0 | 0 | 0 |
| **TOTAL (occurrences)** | **339** | **10** | **3** | **20** |

Note: `SwarmTaskNode.tsx`'s 9 hex occurrences (`border-[#ef4444]/60`, `bg-[#ef4444]`,
`text-[#ef4444]` for `failed`/`verify_rejected`; `border-[#f59e0b]/50`, `bg-[#f59e0b]/70`,
`text-[#f59e0b]/80` for `cancelled`) are STATUS hex literals, not surface hex — see Task 2's
adjudication below; they are in-scope and converted, not recorded as a data-driven exception.

## AFTER table (all four buckets, final)

Re-measured with the identical matchers after Task 2 (palette/hex) and Task 3 (motion/violet).

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/NotificationBell.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ObsidianGraph.tsx` | 0 | 0 | 0 | 0 |
| `src/components/OperatorScoreCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/OrbitalStatusRings.tsx` | 0 | 0 | 0 | 0 |
| `src/components/OriginBadge.tsx` | 0 | 0 | 0 | 0 |
| `src/components/PermissionDecisionsChart.tsx` | 0 | 0 | 0 | 0 |
| `src/components/PhaseProgressBars.tsx` | 0 | 0 | 0 | 0 |
| `src/components/PluginPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/PrivacyShield.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ProfileCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/PromptActivityChart.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ProviderControls.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ProviderHealthPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/QueenNode.tsx` | 0 | 0 | 0 | 0 |
| `src/components/RateLimitGauges.tsx` | 0 | 0 | 0 | 0 |
| `src/components/RecentGitActivity.tsx` | 0 | 0 | 0 | 0 |
| `src/components/RecoveryCommits.tsx` | 0 | 0 | 0 | 0 |
| `src/components/RecoveryTimeline.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ReplayButton.tsx` | 0 | 0 | 0 | 0 |
| `src/components/RoutingDecisionsTable.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SankeyFlow.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ScanResultsPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SectionErrorBoundary.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SecurityEventFeed.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SecurityStats.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SessionCapabilities.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SessionComparison.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SessionDurationHistogram.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SessionHeader.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SessionTimeline.tsx` | 0 | 0 | 0 | 0 |
| `src/components/Skeleton.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SupabasePanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SwarmTaskNode.tsx` | 0 | 0 | 0 | 0 |
| `src/components/SystemResources.tsx` | 0 | 0 | 0 | 0 |
| **TOTAL (occurrences)** | **0** | **0** | **0** | **0** |

_(Filled in after Task 2/Task 3 edits land — see commits below.)_

**Controls that each after-check discriminates (all four buckets):**
- Palette: `git grep -lE '(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}' -- src/components/GanttTimeline.tsx` (out-of-slice, unswept slice D/E territory) — non-zero, while the identical matcher over all 34 slice-C files returns no files.
- Hex: `git grep -lE '(bg|border|text)-\[#' -- src/components/BlackboardPanel.tsx` (out-of-slice, slice A, already converted — see note below) plus a genuinely-unswept out-of-slice control — see AFTER-table control notes below for the file actually used.
- Motion: `git grep -lE 'duration-[0-9]+' -- src/components/MetricCard.tsx` (out-of-slice, owned by D-13's later rewrite) — non-zero, while all 34 slice-C files are absent from that list post-Task-3.
- Violet: `git grep -lE '(bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}' -- src/components/MemoryIndexHealth.tsx` — need a genuinely-unswept control; see AFTER-table control notes below.

**Positive proof the motion conversion is live, not just absent (Task 3 acceptance criterion):**
recorded below after `npm run build`.

## ADJUDICATION

_(Filled in during Task 2/Task 3 — see below.)_
