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

## AFTER table (all four buckets, final)

Re-measured with the identical matchers after Task 2 (palette/hex) and Task 3 (motion/violet).
Every column, every file: **0**.

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/FileOpsPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/FileTree.tsx` | 0 | 0 | 0 | 0 |
| `src/components/GanttTimeline.tsx` | 0 | 0 | 0 | 0 |
| `src/components/GatewayQuotaPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/GatewayTasksPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/GitActivityWidget.tsx` | 0 | 0 | 0 | 0 |
| `src/components/GithubActionsPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/HeartbeatAlertsPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/HotReloadBar.tsx` | 0 | 0 | 0 | 0 |
| `src/components/InboxCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/InfoTooltip.tsx` | 0 | 0 | 0 | 0 |
| `src/components/IntegrationHealth.tsx` | 0 | 0 | 0 | 0 |
| `src/components/JobLifecyclePanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/KanbanColumn.tsx` | 0 | 0 | 0 | 0 |
| `src/components/LlmAnalyticsPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/LlmProviderPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/LoadingState.tsx` | 0 | 0 | 0 | 0 |
| `src/components/McpServerPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/MemoryIndexHealth.tsx` | 0 | 0 | 0 | 0 |
| `src/components/MemoryQualityTab.tsx` | 0 | 0 | 0 | 0 |
| `src/components/MemorySourceBadge.tsx` | 0 | 0 | 0 | 0 |
| **TOTAL (occurrences)** | **0** | **0** | **0** | **0** |

**Controls that each after-check discriminates (all four buckets):**
- Palette: `git grep -lE '(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}' -- src/components/NotificationBell.tsx` (outside this slice) — non-zero, while the identical matcher over all 21 slice-B files returns no files.
- Hex: `git grep -lE '(bg|border|text)-\[#' -- src/components/ObsidianGraph.tsx` (outside this slice, owned by a later plan) — non-zero throughout, both before and after this plan's edits, since this slice never held a hex hit.
- Motion: `git grep -lE 'duration-[0-9]+' -- src/components/MetricCard.tsx` (outside this slice, owned by D-13's later rewrite) — non-zero, while all 21 slice-B files are absent from that list post-Task-3.
- Violet: `git grep -lE '(bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}' -- src/components/OriginBadge.tsx src/components/PluginPanel.tsx src/components/RoutingDecisionsTable.tsx` (outside this slice) — all three non-zero, while all 21 slice-B files are absent from that list post-Task-3.

A zero from a matcher that returns zero for everything would prove nothing; all four plainly do
not.

**Positive proof the motion conversion is live, not just absent (Task 3 acceptance criterion):**
built stylesheet `dist/assets/index-*.css` after `npm run build` contains all four rules by
fixed-string search: `.duration-fast{`, `.duration-normal{`, `.duration-slow{`, `.ease-house{` all
PRESENT (this slice's converted sites use only `duration-normal` and `duration-slow`, never
`duration-fast`, but `.duration-fast{}` is still emitted repo-wide via the `@source inline(...)`
directive from 122-03, confirming the rule generation is independent of which slice happens to
reference it). Control: `.duration-nonsense-9x7q2{}` searched in the same file — ABSENT,
confirming the search itself discriminates rather than matching everything.

## ADJUDICATION

### Hex sites (Task 2)

None. This slice's hex bucket measured **0** occurrences in all 21 files, before and after —
confirmed not a broken matcher via the `ObsidianGraph.tsx` control (1 hit, file outside this
slice, per the BEFORE table's control section).

### Role-mapping conventions applied across the slice (for reviewer context)

Follows slice A's (122-04) established conventions throughout:
- Outer card/panel wrapper (`bg-gray-800/50` + `border-gray-700/50`) → `bg-card/50` +
  `border-border/50` (~10 sites, the single most common pattern in this slice, matching slice A).
- Sunken/nested row within a card, one tier darker in the original literal (`bg-gray-900/NN` +
  `border-gray-700/NN`) → `bg-background/NN` + `border-border/NN` (GithubActionsPanel, McpServerPanel,
  IntegrationHealth — all render a list of sub-items one visual layer below the card).
- Click-to-reveal expanded detail panel (`bg-gray-900/80` + `border-gray-700/40`, appearing only
  when `isExpanded`) → `bg-popover/80` + `border-border/40`, treated as a raised overlay layer
  exactly as slice A's convention and as the plan's explicit instruction for `InfoTooltip.tsx`
  (HeartbeatAlertsPanel, JobLifecyclePanel, McpServerPanel all share this exact pattern).
- Hover on a raised/interactive row → `hover:bg-[var(--surface-3)]/NN` (FileOpsPanel, FileTree,
  HeartbeatAlertsPanel, JobLifecyclePanel, LlmAnalyticsPanel, McpServerPanel).
- Table/list row zebra striping (static, alternating) → `bg-muted/NN` (JobLifecyclePanel's
  transition-history rows).
- Divider/grid line rendered as a `bg-` 1px strip rather than a `border-` utility → `bg-border/NN`
  (GanttTimeline's swim-lane grid lines).
- Status-fallback dots/chips/text (unknown status, cancelled job, pending task, unreachable
  integration) → `bg-muted-foreground` for solid dots, `bg-muted`/`text-muted-foreground` for chip
  fills — never a `--status-*` token, matching slice A's convention exactly (FileOpsPanel's
  default file-op color, GatewayTasksPanel's `pending` status chip, IntegrationHealth's `Unknown`
  badge, JobLifecyclePanel's `cancelled`/default status).
- Text ink: `-100/-200/-300` weights → `text-foreground` (primary/prominent content: names,
  values, headings); `-400/-500/-600` weights → `text-muted-foreground` (labels, secondary
  content, timestamps, placeholders) — identical split to slice A.
- `InfoTooltip.tsx`'s `bg-card` corrected to `bg-popover` per the plan's explicit instruction that
  it is a raised/overlay surface — this site was never matched by the palette regex (it was
  already a semantic alias, not a raw palette class) but is recorded here since it's a real
  role-correction the plan called out by name.

### Threat-flagged files (T-122-05-A)

`HeartbeatAlertsPanel.tsx`, `IntegrationHealth.tsx`, `GatewayQuotaPanel.tsx` — verified per-file
that every warning/health-signal class was left untouched because none of them were ever in the
neutrals bucket this plan converts:
- `HeartbeatAlertsPanel.tsx`: the clean/alert dot and label (`isClean ? "bg-green-400" :
  "bg-red-400"` / `"text-green-400" : "text-red-400"`) and the per-alert red marker/text
  (`bg-red-400`, `text-red-300`) — all four confirmed present, byte-identical, after this plan's
  edits (green/red are not in `(slate|zinc|gray|neutral|stone)`).
- `IntegrationHealth.tsx`: all four `Connected`/`Idle`/`Degraded`/`Disconnected` status colors
  (`text-green-400 bg-green-400/10`, `text-blue-400 bg-blue-400/10`, `text-yellow-400
  bg-yellow-400/10`, `text-red-400 bg-red-400/10`) and the `checking...` indicator
  (`text-yellow-400`) — all confirmed present, byte-identical. Only the `Unknown` fallback (which
  WAS gray, hence in-bucket) converted to `text-muted-foreground bg-muted`, which preserves its
  visual distinctness from all four colored health states rather than collapsing it into one of
  them.
- `GatewayQuotaPanel.tsx`: the remaining-quota threshold bar (`bg-red-500` / `bg-yellow-500` /
  `bg-emerald-500`, selected by `remainingPct` threshold) — confirmed present, byte-identical.
  Only the `UNLIMITED` chip and the progress-bar track (both genuinely neutral, not warning
  signals) converted.

### Motion sites (Task 3)

Five `duration-NNN` occurrences, all in the plan's own Task 3 indicative file list (no correction
against the re-derived Task 1 population needed this slice, unlike slice A's):

| file | line | old | new | reasoning |
|---|---|---|---|---|
| `HotReloadBar.tsx` | 31 | `duration-200` (no explicit easing) | `duration-normal ease-house` | 200ms falls in the 200/250 → normal bucket; no easing existed, house easing added |
| `InboxCard.tsx` | 279 | `duration-300` (no explicit easing) | `duration-slow ease-house` | 300ms falls in the 300/350 → slow bucket; no easing existed, house easing added |
| `InfoTooltip.tsx` | 7 | `duration-200` (no explicit easing) | `duration-normal ease-house` | 200ms → normal bucket; no easing existed, house easing added |
| `KanbanColumn.tsx` | 60 | `duration-200 ease-in-out` | `duration-normal ease-house` | 200ms → normal bucket. `ease-in-out` replaced: this is a one-directional column-width settle (collapse/expand), not a symmetric 0%/50%/100% oscillation — it doesn't match the `eq-bar`/`ping`/`aura` exception class `122-03-SUMMARY.md` carved out for genuinely symmetric loops, so the house curve applies. |
| `KanbanColumn.tsx` | 76 | `duration-200 ease-in-out` | `duration-normal ease-house` | identical column-width settle pattern to line 60, same reasoning |

No site in this slice crossed the `>= 400ms` audit threshold, so no old-value recording was
required by the plan's audit rule.

### Violet sites (Task 3)

Task 1's ledger recorded 4 violet occurrences (2 in `MemoryIndexHealth.tsx`, 2 in
`MemorySourceBadge.tsx`) resolving to **2 distinct sites** (each site is a single
category/source colour definition referenced by both its `bg-` and `text-` sub-properties). Both
adjudicated individually below; row count (2 sites, 4 occurrences) matches the Task 1 count.

| file | line | represents | verdict | reason |
|---|---|---|---|---|
| `MemoryIndexHealth.tsx` | 30 | `typeColors[5]` — one of 8 rotating colours (`indigo/sky/emerald/amber/pink/violet/teal/rose`) assigned by array index to whichever `byType` event-type keys are present, in the "Event Types" breakdown chip list | Re-hued to **neutral** (`bg-muted text-muted-foreground`) | This slot's meaning is not fixed — it is whichever event type happens to land at index 5 of `Object.entries(health.byType)`, so it cannot represent "Astridr's own X" as a stable identity the way a fixed-key category can. It is structurally identical to its 7 numeric-rotation siblings, none of which are Astridr-owned either. `--primary` was rejected (would collide with whichever sibling uses the theme's primary hue); no `--status-*` applies (this isn't a status). Neutral is the correct fallback, and remains visually distinct from the other 7 still-colored chips in the same list — same reasoning as slice A's `AgentDetailPanel.tsx` `handoff` verdict. |
| `MemorySourceBadge.tsx` | 12 | `SOURCE_STYLES.mem0` — the badge shown when an episodic-memory row's source is Ástríðr's alternate `mem0` memory subsystem (per this file's own header comment: "shows whether memory came from episodic or mem0 (per D-07, MEM0-01)") | Converted to **`var(--astridr)`** (`bg-[var(--astridr)]/10`, `text-(--astridr)`) | This is a fixed, named key — `mem0` always means the same thing everywhere this style is read, unlike the rotation-indexed site above. It names one of Ástríðr's own memory subsystems directly, which is exactly D-08's "her memory" criterion — the same reasoning slice A's `DiscoveredToolsTable.tsx` `memory` category verdict used. |

Both verdicts follow the contract's explicit instruction to ask "what the element REPRESENTS, not
what colour it currently is" — the `MemoryIndexHealth.tsx` site's *position* happened to be
violet but its *content* is arbitrary, while the `MemorySourceBadge.tsx` site's content is a fixed,
named Ástríðr subsystem — opposite verdicts despite both starting from the same violet/purple hue
family, exactly the discipline TOKEN-02 requires.
