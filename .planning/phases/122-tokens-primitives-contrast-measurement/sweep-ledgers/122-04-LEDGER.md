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

## AFTER table (Task 2: palette + hex; motion/violet columns still pending Task 3)

Re-measured with the identical commands after Task 2's edits. Every file's palette and hex
columns are 0. Motion and violet are left as-is (matching BEFORE) because Task 2 does not touch
those buckets — they are filled by Task 3.

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/ActiveTimeChart.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ActivityHeatmap.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AgentDetailPanel.tsx` | 0 | 0 | 0 | 2 |
| `src/components/AgentNode.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AgentProfileEditor.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AlertBanner.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AlertRuleForm.tsx` | 0 | 0 | 1 | 0 |
| `src/components/AlertRulesEngine.tsx` | 0 | 0 | 2 | 0 |
| `src/components/AmbientAudioPlayer.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ApiErrorPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AppErrorBoundary.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AvatarGallery.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AvatarUploader.tsx` | 0 | 0 | 0 | 0 |
| `src/components/BashLog.tsx` | 0 | 0 | 0 | 0 |
| `src/components/BlackboardPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/BuildActivityFeed.tsx` | 0 | 0 | 0 | 0 |
| `src/components/CallGraphPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/CapabilityGrowthChart.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ChannelHealthPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/CompactionTimeline.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ComponentHealthGrid.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ComponentTable.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ContextGauge.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ContextHistory.tsx` | 0 | 0 | 0 | 0 |
| `src/components/CronExecutionHistory.tsx` | 0 | 0 | 0 | 0 |
| `src/components/DeliveryHistory.tsx` | 0 | 0 | 0 | 0 |
| `src/components/DiscoveredToolsTable.tsx` | 0 | 0 | 0 | 3 |
| `src/components/DockerPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/DriftTimeline.tsx` | 0 | 0 | 1 | 0 |
| `src/components/EntityRow.tsx` | 0 | 0 | 2 | 0 |
| `src/components/ErrorBoundary.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ErrorFallback.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ErrorRateTrend.tsx` | 0 | 0 | 0 | 0 |
| `src/components/EventFeed.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ExecutionFilterBar.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ExecutionTable.tsx` | 0 | 0 | 0 | 0 |
| **TOTAL (occurrences)** | **0** | **0** | **6** | **5** |

**Control that the after-check discriminates (Task 2 acceptance criterion):** the identical
palette command run against `src/components/FileOpsPanel.tsx` (outside this slice, owned by a
later sweep plan) returns non-zero — confirmed via
`grep -loE '(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}' src/components/*.tsx`
which lists `FileOpsPanel.tsx`, `FileTree.tsx` and others alongside every slice-A file being
absent from that list. A zero from a matcher that returns zero for everything would prove
nothing; this matcher plainly does not.

## ADJUDICATION

### Hex sites (Task 2)

- `src/components/BlackboardPanel.tsx` — 4 hex occurrences, all status-semantic icon colours, not
  surfaces: `text-[#22c55e]` (x2, "running" state icon) converted to `text-(--status-ok)`;
  `text-[#ef4444]` (x2, "failed"/"verify_rejected" state icons) converted to
  `text-(--status-error)`. These are not "data-driven" in the chart-series sense — an existing
  status token exists for exactly this semantic (StatusBadge.tsx already uses
  `text-(--status-error)` for the same red), so they were converted rather than left as an
  out-of-scope exception.
- `src/components/EventFeed.tsx` — 1 hex occurrence, `bg-[#09090b]` on the outer terminal-style
  panel. `#09090b` is the project's own zinc-950 neutral (named in `CLAUDE.md`'s neutrals list)
  used here as the deepest/page-level surface fill for a full-bleed terminal panel — converted to
  `bg-background` (role: page-level container fill).

No hex sites in this slice were data-driven chart/graph colours requiring an out-of-scope
exception; `CallGraphPanel.tsx`'s `LEGEND_ITEMS` hex values are plain JS object properties
consumed via inline `style={{ backgroundColor }}`, not Tailwind bracket literals, so they never
matched the hex bucket regex in the first place and are correctly outside this bucket's scope.

### Role-mapping conventions applied across the slice (for reviewer context)

- Outer card/panel wrapper (`bg-gray-800/50` + `border-gray-700/50`) → `bg-card/50` +
  `border-border/50` (~20 sites, the single most common pattern in this slice).
- Nested/sunken content tile within a card (stat box, code/output preview, expanded detail
  reveal) → `bg-muted` for shallow nested tiles, `bg-popover` for click-to-reveal detail panels
  (treated as a raised overlay layer), `bg-background` for the darkest-tier sunken viewports
  (form inputs, media/cropper preview, terminal code blocks) — distinguished by original literal
  depth (gray-700/800 vs gray-900) and by role (static content vs. interactive input vs.
  reveal-on-click).
- Table/list row zebra striping and hover → `bg-muted/NN` (static stripe) and
  `hover:bg-[var(--surface-3)]/NN` (interactive hover), matching the "hover state on a raised
  surface" rule in the conversion contract.
- Status-fallback dots/chips (unknown status, unknown category) → `bg-muted-foreground` for solid
  dots, `bg-muted`/`text-muted-foreground` for chip fills — never a `--status-*` token, since
  these fallbacks explicitly represent the absence of a known status.
- Text ink: `-100/-200/-300` weights → `text-foreground` (primary/prominent content: names,
  values, headings); `-400/-500/-600` weights → `text-muted-foreground` (labels, secondary
  content, timestamps, placeholders).
- `placeholder-gray-NNN` classes (not matched by the palette regex, since it only matches
  `bg|text|border|from|to|via` prefixes) were still converted to `placeholder-muted-foreground`
  everywhere they appeared, for consistency with the surrounding input's `text-foreground` — this
  does not change any measured count since the regex never counted them, but leaves no
  inconsistent hardcoded placeholder colour sitting next to a token-clean input.

### Threat-flagged files

T-122-04-A (`AlertBanner.tsx`, `ApiErrorPanel.tsx`, `ErrorBoundary.tsx`, `ErrorFallback.tsx`) —
verified the red/error-signalling classes (`border-red-500/*`, `bg-red-500/*`, `text-red-400`)
were never touched (out of bucket scope, not gray/zinc/slate), so the visual distinctness of the
error state is unchanged; only the surrounding card/text tokens were converted.
`AppErrorBoundary.tsx` (also failure-messaging, not on the formal threat register but same
category) received the same treatment.

(Motion sites >= 400ms and every violet site's verdict + reason are filled by Task 3.)
