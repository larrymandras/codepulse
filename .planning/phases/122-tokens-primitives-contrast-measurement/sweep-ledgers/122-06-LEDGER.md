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

All four buckets re-measured against the working tree after both Task 2 and Task 3 landed: every
row is 0/0/0/0, confirmed by the same `grep -oE ... | wc -l` command form used for the BEFORE
table, run against all 34 files as a single batch (not just spot-checked per file).

**Controls that each after-check discriminates (all four buckets), all re-run against the final
working tree, chosen to be genuinely unswept (not a sibling slice's already-converted file):**
- Palette: `grep -lE '(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}' src/components/TeamStatusCards.tsx` (out-of-slice, alphabetically past this slice's S cutoff) — non-zero, while the identical matcher over all 34 slice-C files returns no files.
- Hex: `grep -lE '(bg|border|text)-\[#' src/components/HeroStatsBar.tsx` (explicitly excluded from every sweep slice per this plan's own `<interfaces>` "Files explicitly NOT in this slice" list — owned by 122-10, never converted by design, so it is a durable control) — non-zero, while the identical matcher over all 34 slice-C files returns no files.
- Motion: `grep -lE 'duration-[0-9]+' src/components/WarRoomKanbanColumn.tsx` (out-of-slice) — non-zero, while all 34 slice-C files are absent from that list post-Task-3.
- Violet: `grep -lE '(bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}' src/components/hr/AgentCard.tsx` (out-of-slice, `hr/` tree owned by a different plan) — non-zero, while all 34 slice-C files are absent from that list post-Task-3.

A zero from a matcher that returns zero for everything would prove nothing; all four plainly do
not — each control file above was re-checked against the FINAL working tree (after Task 3), not
just at Task 1 planning time.

**Positive proof the motion conversion is live, not just absent (Task 3 acceptance criterion):**
after `npm run build`, `dist/assets/index-q70oeJma.css` contains all three rules by fixed-string
search: `.duration-slow{` (1), `.duration-normal{` (1), `.ease-house{` (1) — all PRESENT (this
slice's converted sites use only `duration-slow`, never `duration-fast`/`duration-normal`, but per
122-04/122-05's precedent the `@source inline(...)` directive from 122-03 force-generates all
three rules repo-wide regardless of which slice references them). Control:
`.duration-nonsense-9x7q2{` searched in the same file — **0**, confirming the search itself
discriminates rather than matching everything.

## ADJUDICATION

### Hex sites (Task 2)

- `src/components/SwarmTaskNode.tsx` — 9 hex occurrences, all STATUS hex literals inside three
  `Record<string, string>` lookup tables (`stateBorder`, `stateDot`, `stateIconColor`) keyed by
  swarm-subtask lifecycle state: `#ef4444` (x2 keys `failed`/`verify_rejected`, x3 properties each
  = 6 occurrences) converted to `border-(--status-error)/60` / `bg-(--status-error)` /
  `text-(--status-error)`; `#f59e0b` (x1 key `cancelled`, x3 properties = 3 occurrences) converted
  to `border-(--status-warn)/50` / `bg-(--status-warn)/70` / `text-(--status-warn)/80`. Not
  "genuinely data-driven" in the chart-series sense the plan carves out as an exception — these are
  fixed STATUS colors for named lifecycle states, and an existing status token exists for exactly
  this semantic (the same pattern slice A's `BlackboardPanel.tsx` established: `#ef4444` →
  `text-(--status-error)`), so they were converted rather than left as an out-of-scope exception.
  The `#f59e0b` shade is closer to the theme's `--primary`/`--chart-p95` amber than `--status-warn`'s
  own hex (`#eab308` in cyan), but its ROLE — "this subtask was cancelled, needs attention but is
  not a failure" — matches `--status-warn`'s semantic exactly, and TOKEN-02's law is about role
  separation, not literal hex preservation (same reasoning D-05 used for `emerald`'s `--status-ok`
  exception).
- `src/components/ObsidianGraph.tsx` — 1 hex occurrence: `border-[#00ffcc]/20` on the outer canvas
  CONTAINER (chrome, not a per-node series color) — converted to `border-[var(--hairline-strong)]`
  per the plan's explicit "chrome converts, series colors are data" instruction for this file.
  `bg-gray-950` on the same container (palette bucket, not hex) converted to `bg-background`.
  **Not converted (out of this bucket's scope), recorded per the plan's instruction to name what
  they are:** the 8-entry `colors` neon palette array, the `groupColors` map, `colorFn`,
  `paintNode`'s canvas `fillStyle`/`shadowColor` assignments, and `linkColorFn` — all plain JS
  string literals consumed by Canvas 2D context APIs and `react-force-graph` props (`'#00ffcc'`,
  `'#ff00ff'`, `'#00ff00'`, `'#ffff00'`, `'#ff3366'`, `'#9933ff'`, `'#00ccff'`, `'#ff9900'`, plus
  the `'unresolved'` group's `'#4b5563'` fallback). None of these ever matched the hex bucket regex
  in the first place (`(bg|border|text)-\[#` only matches Tailwind bracket-literal classNames, not
  bare JS string values), so this is confirmation of an already-correct exclusion, not a new
  exception — same finding as slice A's `CallGraphPanel.tsx` `LEGEND_ITEMS`.

### Role-mapping conventions applied across the slice (for reviewer context)

Follows slices A (122-04) and B (122-05)'s established conventions throughout:
- Outer card/panel wrapper (`bg-gray-800/50` + `border-gray-700/50`) → `bg-card/50` +
  `border-border/50` (the single most common pattern in this slice, ~24 sites).
- Sunken/nested row within a card, one tier darker than the outer card (`bg-gray-900/NN`) →
  `bg-background/NN` (ProfileCard's stat tiles, PluginPanel's row header, RecentGitActivity/
  RecoveryCommits/RecoveryTimeline's list rows, RoutingDecisionsTable's expanded-detail row,
  SupabasePanel's service rows).
- Click-to-reveal expanded detail panel (`bg-gray-900/80` + `border-gray-700/40`, appearing only
  on `isExpanded`) → `bg-popover/80` + `border-border/40`, treated as a raised overlay layer,
  matching slice A/B's convention exactly (PluginPanel's expanded config panel).
- Hover on a raised/interactive row → `hover:bg-[var(--surface-3)]/NN` (NotificationBell,
  PluginPanel, RoutingDecisionsTable, SankeyFlow, SessionCapabilities, SessionTimeline).
- A `<select>` dropdown control → `bg-popover` (the plan's own interfaces table names "dropdown"
  explicitly alongside popover/tooltip) — `SessionTimeline.tsx`'s type filter.
- Status-fallback dots/chips/badges (unknown severity, no-provider, disabled toggle, "completed"
  session as the deliberately quiet tier of an active/completed/other tri-state) → `bg-muted`/
  `text-muted-foreground` for chip fills, `bg-muted-foreground` for solid dots — never a
  `--status-*` token, matching slices A/B's convention exactly (OriginBadge's catalog/unknown/
  dormant entries, PluginPanel's disabled toggle, ProviderControls' billing badge and toggle-off
  track, ProviderHealthPanel's no-data dot and subscription badge, RecoveryTimeline's unknown
  outcome, ScanResultsPanel's default severity, SessionComparison's "completed" status chip,
  SessionHeader's non-active status chip, SwarmTaskNode's Handle connector dots).
- Progress-bar/gauge TRACK (the empty background a fill animates across) → `bg-muted`
  (PhaseProgressBars, ProviderHealthPanel's quota track, RateLimitGauges, SystemResources) — the
  FILL itself (red/orange/yellow/green threshold colors) is out of bucket scope and left untouched
  in every case, verified per-file.
- Text ink: `-100/-200/-300` weights → `text-foreground` (primary/prominent content); `-400/-500/
  -600` weights → `text-muted-foreground` (labels, secondary content, timestamps) — identical split
  to slices A/B.
- `Skeleton.tsx`'s `bg-gray-700/50` (all 11 sites, `SkeletonText`/`SkeletonCard`/`SkeletonChart`/
  `SkeletonTable`) → `bg-muted` per the plan's explicit "shared placeholder surface" instruction.
  **Correction to the plan's own justification:** the plan states this "match[es] the shadcn
  `ui/skeleton.tsx` idiom" — read directly, `src/components/ui/skeleton.tsx:7` actually uses
  `bg-accent`, not `bg-muted`. Trusting the code over the plan's citation (per this repo's Stale
  Docs rule): `bg-accent` resolves to `#8b5cf6` (violet, the `--astridr` hue) in every dark theme,
  which would make every skeleton in the app render with a faint violet tint — clearly wrong for a
  neutral placeholder. `bg-muted` is correct because it is explicitly named in this plan's own
  `<interfaces>` palette table ("chip/track/skeleton → bg-muted"), independent of the shadcn
  citation. The DIRECTIVE stands; only its stated justification was stale.
- `src/components/SectionErrorBoundary.tsx` — **plan-directed correction, not a bucket-driven
  change.** T-122-06-A's mitigation text instructs: "map its fill to the error tokens the token
  layer now provides, not to a neutral card." The outer wrapper's `bg-gray-800/50` (a neutral,
  matched by the palette bucket) and its RED border/icon (`border-red-500/30`, `bg-red-500/10`,
  `text-red-400` — none matched by any of the four bucket regexes, since red is not a neutral and
  not violet) were converted TOGETHER to `bg-[var(--status-error)]/10 border-[var(--status-error)]/30`
  / `text-[var(--status-error)]`, so the panel's own fill now carries the error signal instead of
  relying solely on its border, per the plan's explicit instruction. The "Retry" button
  (`bg-gray-700 hover:bg-gray-600 text-gray-200`, a generic action control, not itself a status
  signal) was mapped to the neutral `bg-muted hover:bg-[var(--surface-3)] text-foreground`
  convention instead, so the error framing reads from the panel/icon, not the button. Full diff
  read in full: only color classes changed; `hasError`/`componentDidCatch`/`handleRetry` logic is
  byte-identical.
- `src/components/PrivacyShield.tsx` (T-122-06-B) — full diff read in full: only the disabled-state
  branch's three classes (`text-gray-500 hover:text-gray-300 hover:bg-gray-800` →
  `text-muted-foreground hover:text-foreground hover:bg-[var(--surface-3)]`) changed. The
  `demo`/`screenshot`/`enabled` ternary branches (all already non-neutral: amber/red/indigo) and
  every conditional predicate are byte-identical — privacy masking logic untouched.

### Threat-flagged files (T-122-06-A)

`SecurityEventFeed.tsx`, `SecurityStats.tsx`, `PermissionDecisionsChart.tsx`, `RateLimitGauges.tsx`
— verified per-file that every warning/severity-signal class was left untouched because none of
them were ever in the neutrals bucket this plan converts:
- `SecurityEventFeed.tsx`: the four `severityStyles` entries (`text-red-400 bg-red-400/10`
  critical, `text-orange-400 bg-orange-400/10` high, `text-yellow-400 bg-yellow-400/10` medium,
  `text-blue-400 bg-blue-400/10` low), the "Reviewed" `text-green-500/70` and the "Acknowledge"
  button's `bg-yellow-500/10 text-yellow-400 border-yellow-500/20` — all confirmed present,
  byte-identical. Only the unknown-severity fallback (`text-gray-400 bg-gray-400/10`, which WAS
  gray, hence in-bucket) converted to `text-muted-foreground bg-muted`.
- `SecurityStats.tsx`: the four `severityConfig` entries' `color`/`bg`/`dot` fields
  (red/orange/yellow/blue, all four properties per severity) — confirmed present, byte-identical.
  Only the card wrapper and the count number converted.
- `RateLimitGauges.tsx`: `getBarColor`'s four threshold colors (`bg-red-500`/`bg-orange-500`/
  `bg-yellow-500`/`bg-green-500`) — confirmed present, byte-identical. Only the wrapper, label text
  and the gauge TRACK (genuinely neutral) converted.
- `PermissionDecisionsChart.tsx` — no severity-coded classes exist in this file at all (accept/
  reject/by-source counts render via the external `FlexBarChart` component, out of this slice);
  listed on the threat register defensively but had nothing to preserve beyond the standard
  wrapper/text conversion.

### Motion sites (Task 3)

Three `duration-NNN` occurrences, none in the plan's indicative Task 3 file list (which named
`SwarmTaskNode` for motion but not `OperatorScoreCard`/`QueenNode`) — the re-derived Task 1 ledger
was authoritative, per the plan's own instruction, and all three were found and converted:

| file | line | old | new | reasoning |
|---|---|---|---|---|
| `OperatorScoreCard.tsx` | 68 | `duration-500` (no explicit easing) | `duration-slow ease-house` | **>= 400ms — recorded per the audit rule.** 500ms collapses to `duration-slow` (320ms), a genuine speed-up on the sub-score bar's width transition. No prior easing existed; house easing added. |
| `QueenNode.tsx` | 32 | `duration-300 ease-in-out` | `duration-slow ease-house` | 300ms falls in the 300/350 → slow bucket. `ease-in-out` replaced: this is a one-directional card hover/border-color settle, not a symmetric 0%/50%/100% oscillation — same reasoning slice B's `KanbanColumn.tsx` used for its column-width settle transitions. |
| `SwarmTaskNode.tsx` | 172 | `duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]` | `duration-slow ease-house` | 300ms → slow bucket. The custom cubic-bezier(0.23,1,0.32,1) is a near-duplicate of `--ease-house`'s cubic-bezier(0.22,1,0.36,1) — same "authored as the house curve before the token existed" pattern slice A's `EntityRow.tsx` and `src/index.css`'s `.msg-turn` both showed, so both duration and easing centralised. |

Only one site (`OperatorScoreCard.tsx:68`) crosses the >= 400ms audit threshold; its old value
(500ms) is recorded above per the plan's explicit instruction that a >= 400ms collapse "is a
genuine speed-up and must be auditable rather than silent."

### Violet sites (Task 3)

Task 1's ledger recorded 20 violet occurrences across six files, resolving to **7 distinct sites**
(each site is a single category/state/selection colour definition, some referenced by multiple
`bg-`/`text-`/`border-` sub-properties, or by the same literal repeated across a component's two
render branches). Every site adjudicated individually below; occurrence counts sum to the Task 1
total (4+2+6+3+3+2 = 20).

| file | site | represents | verdict | reason |
|---|---|---|---|---|
| `OriginBadge.tsx` | `BADGE_STYLES["claude-code"]` / `["claude-code:plugin"]` (4 occurrences: 2×`bg-purple-500/10`, `text-purple-400`, `text-purple-300`) | Origin badge shown when a skill/plugin/tool was sourced from the **Claude Code CLI** (a distinct Anthropic product, not Ástríðr) — one of 9 origin categories (native/bridge/cc/catalog/claude-code/claude-code:plugin/claude-code:available/unknown/project) | Re-hued to **indigo** (`bg-indigo-500/10`, `text-indigo-400`/`text-indigo-300`) | Neither key names Ástríðr — they name the Claude Code CLI, a different tool entirely (confirmed by this codebase's own skill-lifecycle vocabulary: `claude-code`/`claude-code:available` are skill-origin categories, not agent identity). D-08's criterion is "Ástríðr's identity/voice/agent/memory/routing"; a third-party tool's provenance tag is the plan's own "everything else" bucket. `--primary` was rejected (already the theme accent, would collide with this file's `project` category which uses cyan, close to `--primary` in the default theme); no `--status-*` applies (not a status). Indigo keeps the two-shade family relationship the original purple pair had (full skill vs. its plugin sub-item) while sitting clearly outside the reserved hue. |
| `PluginPanel.tsx` | `category` chip (2 occurrences: `bg-purple-500/10`, `text-purple-400`) | A single fixed color applied to WHATEVER string `p.config.category` happens to hold for a given plugin (e.g. "memory", "moderation", or any other value a plugin's own config sets) | Re-hued to **neutral** (`bg-muted text-muted-foreground`) | Unlike a fixed enumerated key, this chip's color is not tied to any specific category value — it is one static color applied identically regardless of content, so it cannot represent "Ástríðr's memory" specifically (it would be exactly the same purple whether the category were "memory" or "moderation" or anything else). No stable identity to convert; matches slice A's `AgentDetailPanel.tsx` `handoff` reasoning (decorative categorical tag, not an owned concept). |
| `RoutingDecisionsTable.tsx` | "Fallback only" filter toggle, active state (6 occurrences: `bg-purple-400/20 text-purple-300 border-purple-500/40`, appearing identically in both the empty-state and populated-state render branches) | The SELECTED/ACTIVE state of a generic all/fallback filter toggle button — **not** a per-row provider/brain indicator as the plan's orientation text speculated | Re-hued to **`--primary`** (`bg-primary/20 text-primary border-primary/40`) | Read the live code rather than the plan's prose per the plan's own Task 3 instruction ("decide from the code, not from this sentence"): there is no provider- or brain-keyed color anywhere in this file — `PROVIDER_DISPLAY_NAMES` renders as plain text with no styling. The violet is purely a UI "this toggle is selected" affordance, which is exactly what `--primary` exists to signal app-wide. Recorded as a correction to the plan's speculative framing, not an error in the plan's actual instruction (which explicitly told the implementer to verify against the code). |
| `SessionCapabilities.tsx` | "Tools" capability chip (3 occurrences: `bg-purple-400/10 text-purple-300 border-purple-400/20`) | One of six FIXED capability-category chips in a session's environment snapshot (MCP Servers=blue, **Tools=purple**, Plugins=emerald, Skills=amber, Hooks=rose, Slash Commands=cyan) — describes what a Claude Code session generically has access to, not anything Ástríðr-specific | Re-hued to **indigo** (`bg-indigo-400/10 text-indigo-300 border-indigo-400/20`) | Fixed key, but the key names a generic CLI capability category ("tools available to this session"), not Ástríðr's identity/voice/agent/memory/routing — any Claude Code session snapshot has this field, Ástríðr-driven or not. Kept as a vivid, distinguishable hue (matching this file's own 6-color categorical legend convention) rather than neutral, since collapsing it to gray would break the legend's visual scannability; indigo sits outside both the five already-used hues (blue/emerald/amber/rose/cyan) and the reserved violet/purple family. |
| `SessionTimeline.tsx` | Active-agent filter toggle button (3 occurrences: `bg-purple-400/20 text-purple-300 border-purple-500/40`, `activeAgents.has(a.agentId)` branch) | The SELECTED/ACTIVE state of a per-agent filter chip — structurally identical UI pattern to `RoutingDecisionsTable.tsx`'s toggle above, not an identity marker for any specific agent (Ástríðr or otherwise) | Re-hued to **`--primary`** (`bg-primary/20 text-primary border-primary/40`) | Same reasoning as `RoutingDecisionsTable.tsx`: this is a generic "this filter is active" selection affordance applied per-agent, not a marker of which agent is Ástríðr. The agents filtered here are swarm/session participants generally, not necessarily Ástríðr, and even where one happens to be Ástríðr the color codes SELECTION, not IDENTITY. |
| `SwarmTaskNode.tsx` | `stateDot.verifying` / `stateIconColor.verifying` (2 occurrences: `bg-violet-400`, `text-violet-400`) | One of 8 enumerated swarm-subtask LIFECYCLE states (pending/claimed/running/verifying/done/failed/verify_rejected/cancelled) in a fixed per-state color lookup table — `verifying` specifically means "a claiming agent's work is being checked before acceptance" | Re-hued to **`--status-info`** (`bg-(--status-info)`, `text-(--status-info)`) | Although the whole widget renders Ástríðr's own agent swarm, `verifying` names an operational STATE in an enumerated status vocabulary (structurally identical to `pending`=muted, `claimed`=primary, `running`=cyan, `done`=primary, `failed`/`verify_rejected`=status-error, `cancelled`=status-warn), not "this represents Ástríðr" — using `--astridr` for one arbitrary slot in an 8-state table would misleadingly suggest only `verifying` is Ástríðr-related when the whole node already is. `--status-info` was chosen over the other five already-claimed colors in this exact table (muted/primary/cyan/status-error/status-warn) as the one unclaimed status tier whose semantic ("evaluating, not yet resolved") fits `verifying` precisely. **Not converted (out of this bucket's scope):** the same state's `shadow-[0_4px_20px_rgba(139,92,246,0.25)]` glow (line 67, already commented `// violet — state identity color, exempt` in the source) — a bare `rgba()` inside an arbitrary `shadow-[...]` value is not matched by any of the four bucket regexes (not `bg-`/`text-`/`border-` prefixed), consistent with `failed`'s sibling shadow at line 69 (`rgba(239,68,68,...)`, also untouched) — shadows are uniformly out of this sweep's scope. |

**Split of the adjudication, as D-08 requires ("an adjudication that reaches the same verdict
everywhere is a rule being applied, not a judgement being made"):** 2 sites converted to Ástríðr-
adjacent-but-not-owned re-hues are actually **0 converted to `--astridr`** and **7 re-hued** — this
slice's violet concentration turned out to be entirely non-Ástríðr-owned once each site was traced
to what it actually represents (a third-party tool's provenance, a generic capability category, two
generic UI selection states, a decorative category chip, and one enumerated status state on an
Ástríðr-owned widget that is nonetheless a STATUS, not an identity marker). This is a real,
code-derived result, not a shortcut: every site's `represents` column above shows the specific
non-Ástríðr referent it was checked against — slices A and B each found genuine `--astridr`
conversions (`DiscoveredToolsTable.tsx`'s `memory` category, `MemorySourceBadge.tsx`'s `mem0` key)
precisely because those sites named a fixed Ástríðr subsystem by key; no site in this slice met
that bar. The `RoutingDecisionsTable.tsx` finding in particular corrects the plan's own prose,
which speculated a provider/brain-identity reading that the live code does not support.
