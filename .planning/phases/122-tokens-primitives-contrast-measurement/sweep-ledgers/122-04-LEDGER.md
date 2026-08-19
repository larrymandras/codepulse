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

## AFTER table (all four buckets, final)

Re-measured with the identical matchers after Task 2 (palette/hex) and Task 3 (motion/violet).
Every column, every file: **0**.

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/ActiveTimeChart.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ActivityHeatmap.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AgentDetailPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AgentNode.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AgentProfileEditor.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AlertBanner.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AlertRuleForm.tsx` | 0 | 0 | 0 | 0 |
| `src/components/AlertRulesEngine.tsx` | 0 | 0 | 0 | 0 |
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
| `src/components/DiscoveredToolsTable.tsx` | 0 | 0 | 0 | 0 |
| `src/components/DockerPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/DriftTimeline.tsx` | 0 | 0 | 0 | 0 |
| `src/components/EntityRow.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ErrorBoundary.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ErrorFallback.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ErrorRateTrend.tsx` | 0 | 0 | 0 | 0 |
| `src/components/EventFeed.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ExecutionFilterBar.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ExecutionTable.tsx` | 0 | 0 | 0 | 0 |
| **TOTAL (occurrences)** | **0** | **0** | **0** | **0** |

**Controls that each after-check discriminates (all four buckets):**
- Palette: `grep -loE '(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}' src/components/*.tsx` lists `FileOpsPanel.tsx`, `FileTree.tsx` and others outside this slice as non-zero, while every slice-A file is absent from that list.
- Hex: `BlackboardPanel.tsx` and `EventFeed.tsx` were the slice's own known-positives pre-edit (see Hex sites below); post-edit both are 0, and the same matcher still finds hex sites elsewhere in the repo (out of this plan's scope to fix).
- Motion: `grep -loE 'duration-[0-9]+' src/components/*.tsx` lists `HotReloadBar.tsx`, `InboxCard.tsx`, `InfoTooltip.tsx`, `KanbanColumn.tsx`, `MetricCard.tsx` and others outside this slice as non-zero.
- Violet: `grep -loE '(bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}' src/components/*.tsx` lists `MemoryIndexHealth.tsx`, `MemorySourceBadge.tsx`, `OriginBadge.tsx`, `PluginPanel.tsx`, `RoutingDecisionsTable.tsx` and others outside this slice as non-zero.

A zero from a matcher that returns zero for everything would prove nothing; all four plainly do
not.

**Positive proof the motion conversion is live, not just absent (Task 3 acceptance criterion):**
built stylesheet `dist/assets/index-*.css` after `npm run build` contains all three rules by
fixed-string search: `.duration-fast{`, `.duration-slow{`, `.ease-house{` all PRESENT (this
slice's converted sites use only `duration-fast` and `duration-slow`, never `duration-normal`).
Control: `.duration-nonsense-9x7q2{` searched in the same file — ABSENT, confirming the search
itself discriminates rather than matching everything.

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

### Motion sites (Task 3)

Six `duration-NNN` occurrences, none matching the plan's indicative Task 3 file list — the
re-derived Task 1 ledger was authoritative, per the plan's own instruction, and all six were
found and converted:

| file | line | old | new | reasoning |
|---|---|---|---|---|
| `AlertRuleForm.tsx` | 428 | `duration-150` (no explicit easing) | `duration-fast ease-house` | 150ms falls in the 75/100/150 → fast bucket; no easing existed, house easing added |
| `AlertRulesEngine.tsx` | 82 | `duration-300` (no explicit easing) | `duration-slow ease-house` | 300ms falls in the 300/350 → slow bucket; no easing existed, house easing added |
| `AlertRulesEngine.tsx` | 210 | `duration-300` (no explicit easing) | `duration-slow ease-house` | identical scanline-hover pattern to the 82 site, same reasoning |
| `DriftTimeline.tsx` | 245 | `duration-300` (no explicit easing) | `duration-slow ease-house` | row fade-out on acknowledge; 300ms → slow bucket, no prior easing |
| `EntityRow.tsx` | 23 | `duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]` | `duration-slow ease-house` | **>= 400ms — recorded per the audit rule.** 500ms collapses to duration-slow (320ms), a genuine speed-up. The custom cubic-bezier(0.23,1,0.32,1) is a near-duplicate of `--ease-house`'s cubic-bezier(0.22,1,0.36,1) (same shape, 1-2% off on two control points) — same "authored as the house curve before the token existed" pattern `122-03-SUMMARY.md` found for `.msg-turn` in `src/index.css`, so both duration and easing were centralised rather than only the easing. |
| `EntityRow.tsx` | 28 | `duration-300` (no explicit easing) | `duration-slow ease-house` | hover indicator bar scale-in; 300ms → slow bucket, no prior easing |

Only one site (`EntityRow.tsx:23`) crosses the >= 400ms audit threshold; its old value (500ms) is
recorded above per the plan's explicit instruction that a >= 400ms collapse "is a genuine
speed-up and must be auditable rather than silent."

Not converted (out of this bucket's scope): `EntityRow.tsx`'s `motion.div` carries a
framer-motion `transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}` prop (line 20) — this
is a JS object value passed to `motion/react`, not a `duration-NNN` Tailwind class, so it does not
match this bucket's regex and centralising motion/react prop values onto the shared tokens is
`122-CONTEXT.md` D-09's explicit scope for the 9 motion/react-importing files (a different,
later plan), not this sweep bucket.

### Violet sites (Task 3)

Task 1's ledger recorded 5 violet occurrences (2 text/bg pair in `AgentDetailPanel.tsx`, 3
text/bg/dot in `DiscoveredToolsTable.tsx`) resolving to **2 distinct sites** (each site is a
single category/event-type colour definition referenced by both its `text-` and `bg-`/`dot`
sub-properties). Both adjudicated individually below; row count (2 sites, 5 occurrences) matches
the Task 1 count.

| file | line | represents | verdict | reason |
|---|---|---|---|---|
| `AgentDetailPanel.tsx` | 10 | `eventTypeColors.handoff` — one of 4 colour-coded coordination-event-type chips (handoff/message/delegation/result) shown on agent-to-agent coordination log rows | Re-hued to **neutral** (`text-muted-foreground bg-muted/10`) | This chip labels a category of inter-agent coordination traffic, not Astridr's own identity/voice/agent/memory — it is a decorative categorical tag, structurally identical to its three siblings (blue/cyan/green), none of which are Astridr-owned either. `--primary` was rejected because it's cyan in the default theme and would visually collide with the sibling `delegation` chip, which is already hardcoded cyan; no `--status-*` token applies (this isn't a status). Neutral is the correct fallback per the contract's three-option list. |
| `DiscoveredToolsTable.tsx` | 22 | `CATEGORY_COLORS.memory` — one of 9 colour-coded MCP tool-category chips/legend entries (core/infrastructure/media/workspace/data/social/**memory**/productivity/iot) filtering "All Ástríðr Python tool scripts" (per this component's own `InfoTooltip` text at line 183) | Converted to **`var(--astridr)`** (`bg-[var(--astridr)]/10`, `text-(--astridr)`, `dot: bg-[var(--astridr)]`) | This category specifically labels tools that operate on Ástríðr's own memory system — the whole catalog is already scoped to "Ástríðr Python tool scripts," and TOKEN-02's law explicitly lists "her memory" among the criteria for an Astridr-owned surface. Unlike the `handoff` chip (a generic coordination-event kind with no owner), this category names the exact capability the design law calls out by name. |

Both verdicts follow the contract's explicit instruction to ask "what the element REPRESENTS, not
what colour it currently is" — the two sites share the literal colour (`purple-400`/`purple-500`)
but resolved to opposite verdicts because one represents a generic category and the other
represents Astridr's own memory capability specifically.
