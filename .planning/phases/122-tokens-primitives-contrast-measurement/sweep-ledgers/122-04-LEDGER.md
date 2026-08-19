# Sweep Ledger — 122-04 (Slice A: `src/components/` A–E, 36 files)

## Matchers (verbatim, run against `git`'s working tree at execution time)

```
palette: (bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}
hex:     (bg|border|text)-\[#          (fixed-string the `#` where the tool requires it)
motion:  duration-[0-9]+
violet:  (bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}
```

Counting method: `grep -oE '<pattern>' <file> | wc -l` per file — this is **occurrences**, not
matching lines and not files. Command form used throughout:

```bash
grep -oE '(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}' "$f" | wc -l
```

## Control — matchers proven against known-positives before trusting any zero

- `src/components/BlackboardPanel.tsx` is known (from planning) to contain a hex literal:
  measured **4** hex occurrences. Non-zero — the hex matcher discriminates.
- `src/components/DiscoveredToolsTable.tsx` is known (from planning) to contain a violet
  utility: measured **3** violet occurrences. Non-zero — the violet matcher discriminates.

Both controls returned non-zero, so a zero elsewhere in this table is trusted as a real absence,
not a broken matcher.

## Population disagreement vs. CONTEXT.md D-02

D-02 quotes phase-wide totals (310 palette occurrences / 25 hex occurrences across 9 files, whole
repo), not a slice A figure — there is nothing in D-02 to disagree with at the slice level. This
ledger's population is derived fresh from the 36 files in this plan's `files_modified` list, which
is the authority for what this plan edits (per the plan's own instruction). No disagreement to
record.

## BEFORE table (occurrences, one row per file in `files_modified`; 36 rows)

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/ActiveTimeChart.tsx` | 7 | 0 | 0 | 0 |
| `src/components/ActivityHeatmap.tsx` | 7 | 0 | 0 | 0 |
| `src/components/AgentDetailPanel.tsx` | 31 | 0 | 0 | 2 |
| `src/components/AgentNode.tsx` | 16 | 0 | 0 | 0 |
| `src/components/AgentProfileEditor.tsx` | 44 | 0 | 0 | 0 |
| `src/components/AlertBanner.tsx` | 2 | 0 | 0 | 0 |
| `src/components/AlertRuleForm.tsx` | 3 | 0 | 1 | 0 |
| `src/components/AlertRulesEngine.tsx` | 0 | 0 | 2 | 0 |
| `src/components/AmbientAudioPlayer.tsx` | 11 | 0 | 0 | 0 |
| `src/components/ApiErrorPanel.tsx` | 18 | 0 | 0 | 0 |
| `src/components/AppErrorBoundary.tsx` | 7 | 0 | 0 | 0 |
| `src/components/AvatarGallery.tsx` | 8 | 0 | 0 | 0 |
| `src/components/AvatarUploader.tsx` | 13 | 0 | 0 | 0 |
| `src/components/BashLog.tsx` | 17 | 0 | 0 | 0 |
| `src/components/BlackboardPanel.tsx` | 0 | 4 | 0 | 0 |
| `src/components/BuildActivityFeed.tsx` | 13 | 0 | 0 | 0 |
| `src/components/CallGraphPanel.tsx` | 1 | 0 | 0 | 0 |
| `src/components/CapabilityGrowthChart.tsx` | 5 | 0 | 0 | 0 |
| `src/components/ChannelHealthPanel.tsx` | 8 | 0 | 0 | 0 |
| `src/components/CompactionTimeline.tsx` | 13 | 0 | 0 | 0 |
| `src/components/ComponentHealthGrid.tsx` | 9 | 0 | 0 | 0 |
| `src/components/ComponentTable.tsx` | 19 | 0 | 0 | 0 |
| `src/components/ContextGauge.tsx` | 15 | 0 | 0 | 0 |
| `src/components/ContextHistory.tsx` | 3 | 0 | 0 | 0 |
| `src/components/CronExecutionHistory.tsx` | 11 | 0 | 0 | 0 |
| `src/components/DeliveryHistory.tsx` | 1 | 0 | 0 | 0 |
| `src/components/DiscoveredToolsTable.tsx` | 75 | 0 | 0 | 3 |
| `src/components/DockerPanel.tsx` | 3 | 0 | 0 | 0 |
| `src/components/DriftTimeline.tsx` | 24 | 0 | 1 | 0 |
| `src/components/EntityRow.tsx` | 0 | 0 | 2 | 0 |
| `src/components/ErrorBoundary.tsx` | 3 | 0 | 0 | 0 |
| `src/components/ErrorFallback.tsx` | 5 | 0 | 0 | 0 |
| `src/components/ErrorRateTrend.tsx` | 5 | 0 | 0 | 0 |
| `src/components/EventFeed.tsx` | 0 | 1 | 0 | 0 |
| `src/components/ExecutionFilterBar.tsx` | 7 | 0 | 0 | 0 |
| `src/components/ExecutionTable.tsx` | 38 | 0 | 0 | 0 |
| **TOTAL (occurrences)** | **442** | **5** | **6** | **5** |

Note for Task 3: the plan's `<files>` list for Task 3 (`AgentDetailPanel`, `AgentNode`,
`AlertBanner`, `BlackboardPanel`, `DiscoveredToolsTable`, `EventFeed`, `ExecutionTable`) is
indicative only per the plan text. This BEFORE table is authoritative: motion hits actually land
in `AlertRuleForm.tsx` (1), `AlertRulesEngine.tsx` (2), `DriftTimeline.tsx` (1), `EntityRow.tsx`
(2) — none of which are in the plan's indicative Task 3 list, and `AgentDetailPanel`, `AgentNode`,
`AlertBanner`, `BlackboardPanel`, `EventFeed`, `ExecutionTable` hold **zero** motion hits despite
being named. Violet hits land in `AgentDetailPanel.tsx` (2) and `DiscoveredToolsTable.tsx` (3),
which does overlap the indicative list for those two files. Task 3 will edit what this table says,
not what the plan's file list guesses.

## AFTER table

(Filled by Task 2 for palette/hex, Task 3 for motion/violet.)

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/ActiveTimeChart.tsx` | | | | |
| `src/components/ActivityHeatmap.tsx` | | | | |
| `src/components/AgentDetailPanel.tsx` | | | | |
| `src/components/AgentNode.tsx` | | | | |
| `src/components/AgentProfileEditor.tsx` | | | | |
| `src/components/AlertBanner.tsx` | | | | |
| `src/components/AlertRuleForm.tsx` | | | | |
| `src/components/AlertRulesEngine.tsx` | | | | |
| `src/components/AmbientAudioPlayer.tsx` | | | | |
| `src/components/ApiErrorPanel.tsx` | | | | |
| `src/components/AppErrorBoundary.tsx` | | | | |
| `src/components/AvatarGallery.tsx` | | | | |
| `src/components/AvatarUploader.tsx` | | | | |
| `src/components/BashLog.tsx` | | | | |
| `src/components/BlackboardPanel.tsx` | | | | |
| `src/components/BuildActivityFeed.tsx` | | | | |
| `src/components/CallGraphPanel.tsx` | | | | |
| `src/components/CapabilityGrowthChart.tsx` | | | | |
| `src/components/ChannelHealthPanel.tsx` | | | | |
| `src/components/CompactionTimeline.tsx` | | | | |
| `src/components/ComponentHealthGrid.tsx` | | | | |
| `src/components/ComponentTable.tsx` | | | | |
| `src/components/ContextGauge.tsx` | | | | |
| `src/components/ContextHistory.tsx` | | | | |
| `src/components/CronExecutionHistory.tsx` | | | | |
| `src/components/DeliveryHistory.tsx` | | | | |
| `src/components/DiscoveredToolsTable.tsx` | | | | |
| `src/components/DockerPanel.tsx` | | | | |
| `src/components/DriftTimeline.tsx` | | | | |
| `src/components/EntityRow.tsx` | | | | |
| `src/components/ErrorBoundary.tsx` | | | | |
| `src/components/ErrorFallback.tsx` | | | | |
| `src/components/ErrorRateTrend.tsx` | | | | |
| `src/components/EventFeed.tsx` | | | | |
| `src/components/ExecutionFilterBar.tsx` | | | | |
| `src/components/ExecutionTable.tsx` | | | | |

## ADJUDICATION

(Per-site notes for out-of-scope hex/data-driven colours, motion sites >= 400ms, and every
violet site's verdict + reason. Filled by Tasks 2 and 3.)
