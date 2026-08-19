# Sweep Ledger — 122-05 (Slice B: `src/components/` F–M, 21 files)

## Matchers (verbatim, run against `git`'s working tree at execution time)

```
palette: (bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}
hex:     (bg|border|text)-\[#          (fixed-string the `#` where the tool requires it)
motion:  duration-[0-9]+
violet:  (bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}
```

Counting method: `grep -oE '<pattern>' <file> | wc -l` per file — this is **occurrences**, not
matching lines and not files. Matches the unit slice A (122-04) used, for a consistent phase-wide
ledger format. Command form used throughout:

```bash
grep -oE '(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}' "$f" | wc -l
```

## Control — matchers proven against known-positives before trusting any zero

- `src/components/MemorySourceBadge.tsx` is known (per the plan's own acceptance criterion) to
  hold violet utilities: measured **2** violet occurrences. Non-zero.
- `src/components/MemoryIndexHealth.tsx` is likewise known to hold violet utilities: measured
  **2** violet occurrences. Non-zero.
- Both controls returned non-zero, so a zero elsewhere in this slice's violet column is trusted
  as a real absence, not a broken matcher.
- Hex matcher control (this slice measured **0** hex occurrences in every file — see population
  disagreement note below): `src/components/ObsidianGraph.tsx` (outside this slice, owned by a
  later plan) measured **1** hex occurrence with the identical matcher. Non-zero — the hex matcher
  discriminates; this slice's all-zero hex column is a real absence, not a dead pattern.
- Palette matcher control: `src/components/NotificationBell.tsx` (outside this slice) measured
  **17** palette occurrences with the identical matcher. Non-zero.
- Motion matcher control: `src/components/MetricCard.tsx` (outside this slice, owned by a later
  plan per D-13) measured **1** motion occurrence with the identical matcher. Non-zero.

All four matchers proven to discriminate before any zero in this ledger is trusted.

## Population disagreement vs. the plan's `files_modified` list

None. The plan's 21-file `files_modified` list is this slice's population by definition (disjoint
per-file partitioning across the five sweep slices, per the phase's D-28 sequencing). Re-derived
fresh via `git grep`/`grep -oE` directly against these 21 files rather than trusting any prior
count; no file was added or removed from the population.

## BEFORE table (occurrences, one row per file in `files_modified`; 21 rows)

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/FileOpsPanel.tsx` | 18 | 0 | 0 | 0 |
| `src/components/FileTree.tsx` | 15 | 0 | 0 | 0 |
| `src/components/GanttTimeline.tsx` | 16 | 0 | 0 | 0 |
| `src/components/GatewayQuotaPanel.tsx` | 9 | 0 | 0 | 0 |
| `src/components/GatewayTasksPanel.tsx` | 4 | 0 | 0 | 0 |
| `src/components/GitActivityWidget.tsx` | 4 | 0 | 0 | 0 |
| `src/components/GithubActionsPanel.tsx` | 13 | 0 | 0 | 0 |
| `src/components/HeartbeatAlertsPanel.tsx` | 13 | 0 | 0 | 0 |
| `src/components/HotReloadBar.tsx` | 0 | 0 | 1 | 0 |
| `src/components/InboxCard.tsx` | 0 | 0 | 1 | 0 |
| `src/components/InfoTooltip.tsx` | 0 | 0 | 1 | 0 |
| `src/components/IntegrationHealth.tsx` | 12 | 0 | 0 | 0 |
| `src/components/JobLifecyclePanel.tsx` | 20 | 0 | 0 | 0 |
| `src/components/KanbanColumn.tsx` | 0 | 0 | 2 | 0 |
| `src/components/LlmAnalyticsPanel.tsx` | 12 | 0 | 0 | 0 |
| `src/components/LlmProviderPanel.tsx` | 4 | 0 | 0 | 0 |
| `src/components/LoadingState.tsx` | 2 | 0 | 0 | 0 |
| `src/components/McpServerPanel.tsx` | 23 | 0 | 0 | 0 |
| `src/components/MemoryIndexHealth.tsx` | 21 | 0 | 0 | 2 |
| `src/components/MemoryQualityTab.tsx` | 15 | 0 | 0 | 0 |
| `src/components/MemorySourceBadge.tsx` | 0 | 0 | 0 | 2 |
| **TOTAL (occurrences)** | **201** | **0** | **5** | **4** |

Notes for Task 3: motion hits land in `HotReloadBar.tsx` (1), `InboxCard.tsx` (1),
`InfoTooltip.tsx` (1), `KanbanColumn.tsx` (2) — matching the plan's Task 3 indicative `<files>`
list for those four; `MemoryIndexHealth.tsx` and `MemorySourceBadge.tsx` (also in the plan's Task
3 indicative list) hold **zero** motion hits — only violet. Violet hits land in
`MemoryIndexHealth.tsx` (2) and `MemorySourceBadge.tsx` (2), matching the plan's Task 3 indicative
list exactly for the violet bucket. This slice's Task 3 file list needed no correction against the
re-derived population, unlike slice A's.

Hex bucket: **zero occurrences in all 21 files.** Confirmed not a broken matcher — see the
ObsidianGraph.tsx control above (1 hit, file outside this slice).

## AFTER table

(populated after Task 2 and Task 3)

## ADJUDICATION

(populated after Task 2 and Task 3)
