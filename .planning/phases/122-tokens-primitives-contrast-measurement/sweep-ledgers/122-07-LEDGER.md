# Sweep Ledger — 122-07 (Slice D: `src/components/` T–Z plus `graph/`, `hr/`, `skills/`, `ui/`, 30 files)

## Matchers (verbatim, run against `git`'s working tree at execution time)

```
palette: (bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}
hex:     (bg|border|text)-\[#          (fixed-string the `#` where the tool requires it)
motion:  duration-[0-9]+
violet:  (bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}
```

Counting method: `grep -oE '<pattern>' <file> | wc -l` per file — **occurrences**, not matching
lines and not files. Matches the unit slices A/B/C (122-04/05/06) used, for a consistent
phase-wide ledger format.

Fifth column (four `ui/` files only): count of `bg-popover` + `bg-card` + `border-border`
occurrences — the D-01 shadcn alias baseline this plan must not decrease.

## Control — matchers proven against known-positives before trusting any zero

- `src/components/graph/ForceGraph3D.tsx` — plan's own Task 1 acceptance criterion names this file
  as known to hold a hex literal: measured **1** hex occurrence (`bg-[#09090b]` on the canvas
  container). Non-zero.
- `src/components/hr/RosterTable.tsx` — plan's own Task 1 acceptance criterion names this file as
  known to hold a violet utility: measured **1** violet occurrence (`bg-purple-600`). Non-zero.
- Palette matcher control: `src/components/TokenSunburst.tsx` (in this slice, independently
  verifiable) measured **21** palette occurrences. Non-zero.
- Motion matcher control: `src/components/hr/AgentCard.tsx` (in this slice) measured **5** motion
  occurrences. Non-zero.
- All four matchers proven to discriminate before any zero in this ledger is trusted.
- Out-of-slice control (used again post-edit in the AFTER section): `src/components/MetricCard.tsx`
  (excluded from every sweep slice per this plan's own "Files explicitly NOT in this slice" list —
  durable, never converted by design) holds a live `duration-NNN` motion literal throughout.

## Population disagreement vs. the plan's `files_modified` list

None. Re-derived fresh via `grep -oE` directly against exactly these 30 files. All 30 present on
disk, no file added or removed. Reconciled 1:1 against the plan's `files_modified` list.

**Plan-prose corrections found while re-deriving (per the "read the code, not the plan's prose"
discipline established by slice C):**

1. **The four `ui/` files do NOT currently hold any raw palette or hex literal.** The plan's
   `<interfaces>` text states "four of them still carry a raw palette or hex class and are
   therefore in this slice." Measured: `accordion.tsx`, `alert-dialog.tsx`, `dialog.tsx`,
   `sheet.tsx` all read **0/0** palette/hex, both individually and via `git grep` across all four
   at once. The claim was true at some earlier point in the phase's history (git log shows their
   last substantive edit predates 122) but is false against the live tree at execution time. Task
   2 therefore has **zero conversions** in the four `ui/` files — see ADJUDICATION.
2. **`StatusBadge.tsx:22-27` is not the live `--astridr` convention.** The plan's `<interfaces>`
   cites it as "the convention live in `src/components/StatusBadge.tsx:22-27`." Read directly:
   `StatusBadge.tsx` contains no `--astridr` reference anywhere (confirmed via `git grep`). The
   real, live convention is `src/components/MemorySourceBadge.tsx:12`
   (`bg-[var(--astridr)]/10` / `text-(--astridr)`) and `src/components/DiscoveredToolsTable.tsx:22`,
   both established by slice A/B. Used those as the pattern to imitate instead.
3. **Task 2's `read_first` cites `120-SANCTIONED-PATTERNS.md` for `hr/CatalogCard.tsx` and
   `hr/TeamCard.tsx`'s surviving transform consumers.** That file (written by Plan 120-03) covers
   toast-action patterns only and never mentions either file. The actual citation is
   `120-DESIGN-REVIEW-HANDOFF.md:130-131` ("the three surviving transform consumers
   `CatalogCard.tsx:31`, `TeamCard.tsx:29`, `WarRoom.tsx:315`"), corroborated by the live inline
   `D-01` comments at `CatalogCard.tsx:27-29` and `TeamCard.tsx:25-27`. The substance of the
   citation holds; only the file pointer was wrong.
4. **`CatalogCard.tsx` and `TeamCard.tsx` hold live `duration-300`/`duration-500` motion literals**
   (5 and 3 occurrences respectively) despite neither being in Task 3's indicative `<files>` list.
   The ledger is authoritative per the plan's own instruction — both converted in Task 3.

## BEFORE table (occurrences, one row per file in `files_modified`; 30 rows)

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/TeamStatusCards.tsx` | 10 | 0 | 0 | 0 |
| `src/components/TokenSunburst.tsx` | 21 | 0 | 0 | 0 |
| `src/components/TokenWaterfall.tsx` | 10 | 0 | 0 | 0 |
| `src/components/ToolExecutionPanel.tsx` | 8 | 0 | 0 | 0 |
| `src/components/UserMenu.tsx` | 2 | 0 | 0 | 0 |
| `src/components/VersionHistory.tsx` | 9 | 0 | 0 | 0 |
| `src/components/WarRoomKanbanColumn.tsx` | 0 | 0 | 1 | 0 |
| `src/components/WarRoomTaskCard.tsx` | 0 | 0 | 1 | 0 |
| `src/components/graph/CodeVaultGraph.tsx` | 0 | 4 | 3 | 0 |
| `src/components/graph/ForceGraph3D.tsx` | 0 | 1 | 0 | 0 |
| `src/components/graph/ForceGraphCanvas.tsx` | 1 | 1 | 0 | 0 |
| `src/components/hr/AgentCard.tsx` | 4 | 0 | 5 | 3 |
| `src/components/hr/AgentDetailSheet.tsx` | 1 | 0 | 0 | 1 |
| `src/components/hr/CatalogCard.tsx` | 0 | 0 | 5 | 0 |
| `src/components/hr/RosterOrgChart.tsx` | 2 | 0 | 0 | 1 |
| `src/components/hr/RosterTable.tsx` | 1 | 0 | 0 | 1 |
| `src/components/hr/TeamCard.tsx` | 0 | 0 | 3 | 0 |
| `src/components/hr/TeamEditor.tsx` | 1 | 0 | 0 | 1 |
| `src/components/hr/detail/DetailActivityTab.tsx` | 2 | 0 | 0 | 2 |
| `src/components/hr/detail/DetailConfigTab.tsx` | 0 | 0 | 1 | 0 |
| `src/components/hr/detail/DetailVersionsTab.tsx` | 0 | 0 | 0 | 1 |
| `src/components/skills/RunAstridrPopover.tsx` | 0 | 0 | 1 | 0 |
| `src/components/skills/vault/ClusterDetailCard.tsx` | 8 | 0 | 0 | 0 |
| `src/components/skills/vault/SkillKanbanView.tsx` | 4 | 0 | 0 | 0 |
| `src/components/skills/vault/SkillVaultDetailCard.tsx` | 14 | 0 | 0 | 0 |
| `src/components/skills/vault/SkillVaultView.tsx` | 0 | 1 | 0 | 0 |
| `src/components/ui/accordion.tsx` | 0 | 0 | 1 | 0 |
| `src/components/ui/alert-dialog.tsx` | 0 | 0 | 1 | 0 |
| `src/components/ui/dialog.tsx` | 0 | 0 | 1 | 0 |
| `src/components/ui/sheet.tsx` | 0 | 0 | 2 | 0 |
| **TOTAL (occurrences)** | **98** | **7** | **25** | **10** |

### Fifth column — D-01 shadcn alias baseline (four `ui/` files, must not decrease)

| file | `bg-popover` + `bg-card` + `border-border` count |
|---|---|
| `src/components/ui/accordion.tsx` | 0 |
| `src/components/ui/alert-dialog.tsx` | 0 |
| `src/components/ui/dialog.tsx` | 0 |
| `src/components/ui/sheet.tsx` | 0 |

All four currently use `bg-background` on their content panels (not `bg-popover`/`bg-card`), and
plain `border`/`border-l`/`border-r`/`border-t`/`border-b` width utilities with no explicit color
class (so no `border-border` literal exists to count either). The baseline is genuinely 0 for all
four — confirmed by `grep -noE 'bg-popover|bg-card|border-border|bg-background' <file>` per file,
which surfaces the `bg-background` occurrences for context without counting them in this column.

## AFTER table (all four buckets, final)

Re-measured with the identical matchers after Task 2 (palette/hex) and Task 3 (motion/violet).
Every row, every column: **0**.

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/TeamStatusCards.tsx` | 0 | 0 | 0 | 0 |
| `src/components/TokenSunburst.tsx` | 0 | 0 | 0 | 0 |
| `src/components/TokenWaterfall.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ToolExecutionPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/UserMenu.tsx` | 0 | 0 | 0 | 0 |
| `src/components/VersionHistory.tsx` | 0 | 0 | 0 | 0 |
| `src/components/WarRoomKanbanColumn.tsx` | 0 | 0 | 0 | 0 |
| `src/components/WarRoomTaskCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/graph/CodeVaultGraph.tsx` | 0 | 0 | 0 | 0 |
| `src/components/graph/ForceGraph3D.tsx` | 0 | 0 | 0 | 0 |
| `src/components/graph/ForceGraphCanvas.tsx` | 0 | 0 | 0 | 0 |
| `src/components/hr/AgentCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/hr/AgentDetailSheet.tsx` | 0 | 0 | 0 | 0 |
| `src/components/hr/CatalogCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/hr/RosterOrgChart.tsx` | 0 | 0 | 0 | 0 |
| `src/components/hr/RosterTable.tsx` | 0 | 0 | 0 | 0 |
| `src/components/hr/TeamCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/hr/TeamEditor.tsx` | 0 | 0 | 0 | 0 |
| `src/components/hr/detail/DetailActivityTab.tsx` | 0 | 0 | 0 | 0 |
| `src/components/hr/detail/DetailConfigTab.tsx` | 0 | 0 | 0 | 0 |
| `src/components/hr/detail/DetailVersionsTab.tsx` | 0 | 0 | 0 | 0 |
| `src/components/skills/RunAstridrPopover.tsx` | 0 | 0 | 0 | 0 |
| `src/components/skills/vault/ClusterDetailCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/skills/vault/SkillKanbanView.tsx` | 0 | 0 | 0 | 0 |
| `src/components/skills/vault/SkillVaultDetailCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/skills/vault/SkillVaultView.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ui/accordion.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ui/alert-dialog.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ui/dialog.tsx` | 0 | 0 | 0 | 0 |
| `src/components/ui/sheet.tsx` | 0 | 0 | 0 | 0 |
| **TOTAL (occurrences)** | **0** | **0** | **0** | **0** |

**D-01 alias boundary, re-checked post-edit (must not have decreased from the 0 baseline):**

| file | `bg-popover` + `bg-card` + `border-border` count |
|---|---|
| `src/components/ui/accordion.tsx` | 0 |
| `src/components/ui/alert-dialog.tsx` | 0 |
| `src/components/ui/dialog.tsx` | 0 |
| `src/components/ui/sheet.tsx` | 0 |

0 -> 0 for all four. No alias was rewritten to a bracket reference; none existed to rewrite, and
none was added, since the plan's premise (raw literals present on these four files) was false
against the live tree.

**Controls that each after-check discriminates, all re-run against the final working tree, chosen
to be genuinely unswept (not a sibling slice's already-converted file — slice E / 122-08 owns the
`doccomments/`, `kg/`, `reminders/`, `voice/` subtrees, `src/layouts/`, and 13 pages, and is still
unswept at the time of this ledger):**
- Palette: `grep -coE '(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}' src/pages/KnowledgeGraph.tsx` -> **1**; same matcher run against `src/pages/ToolGalaxy.tsx` -> **1**. Both out-of-slice (slice E), both non-zero, while the identical matcher over all 30 slice-D files returns no files.
- Hex: (no dedicated hex control needed beyond the Task 1 control — `ForceGraph3D.tsx` measured 1 hex BEFORE this plan touched it; re-running the identical matcher post-edit on the same file now returns 0, proving the edit landed, not that the matcher stopped discriminating.)
- Motion: `grep -coE 'duration-[0-9]+' src/components/MetricCard.tsx` (explicitly excluded from every sweep slice per this plan's own "Files explicitly NOT in this slice" list, owned by D-13's later rewrite — a durable, permanent control) -> **1**. Non-zero, while all 30 slice-D files are absent from that list post-Task-3.
- Violet: `grep -coE '(bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}' src/pages/Capabilities.tsx` -> **2**; `src/pages/Memory.tsx` -> **1**. Both out-of-slice (slice E), both non-zero, while all 30 slice-D files are absent from that list post-Task-3.

A zero from a matcher that returns zero for everything would prove nothing; all four plainly do
not.

**Positive proof the motion conversion is live, not just absent (Task 3 acceptance criterion):**
after `npm run build`, `dist/assets/index-Cl2yjlNm.css` contains all four rules by fixed-string
search: `.duration-fast{` (1), `.duration-normal{` (1), `.duration-slow{` (1), `.ease-house{` (1) —
all PRESENT (this slice used all three duration tiers plus `ease-house` throughout). Control:
`.duration-nonsense-9x7q2{` searched in the same file — **0**, confirming the search itself
discriminates rather than matching everything.

**Test evidence:** `npx tsc --noEmit` exits 0 (both after Task 2 and again after Task 3).
`npx vitest run src/components/graph` — 4 test files, 48 tests, all passed. Full suite
`npx vitest run` — 338 test files passed, 17 skipped (355 total), 4772 tests passed, 197 todo
(4969 total) — matches the recorded pre-plan baseline of 4772/0 exactly; zero new failures.
`npm run build` exits 0.

**Full-diff spot-check (Task 2 acceptance criterion, three files chosen at random):**
`src/components/hr/AgentCard.tsx`, `src/components/ui/sheet.tsx`,
`src/components/hr/detail/DetailVersionsTab.tsx` — `git diff` read in full for each; every changed
line is a colour/motion-token class swap, no logic, JSX structure, prop, or conditional touched.

## ADJUDICATION

### Plan-prose correction: the four `ui/` files hold zero raw literals (Task 2)

Re-measured directly against the live tree (see Population disagreement section above): all four
of `accordion.tsx`, `alert-dialog.tsx`, `dialog.tsx`, `sheet.tsx` read 0 palette and 0 hex hits,
individually and via a single combined `git grep`. Their content panels use `bg-background` (an
existing semantic alias, not a raw literal) and plain unlabelled `border`/`border-l`/`border-r`
width utilities (no `border-*-NNN` colour class exists to convert). Their modal/sheet/dialog
overlay scrims use `bg-black/50` — a genuine hardcoded literal, but "black" is not in the neutral
palette family `(slate|zinc|gray|neutral|stone)` D-02 measured, so it was never part of this
phase's counted population; every prior slice (A/B/C) left `bg-black`/`bg-white` sites untouched
for the identical reason, and this slice does the same for consistency. No conversion was made in
Task 2 for any of the four `ui/` files; the D-01 alias-boundary check is trivially satisfied
(0 -> 0) because nothing existed to preserve or accidentally rewrite.

### Hex sites (Task 2)

- `src/components/graph/CodeVaultGraph.tsx` (4), `src/components/graph/ForceGraph3D.tsx` (1),
  `src/components/graph/ForceGraphCanvas.tsx` (1), `src/components/skills/vault/SkillVaultView.tsx`
  (1) — all seven occurrences are the identical literal `bg-[#09090b]` on each file's outermost
  canvas/vault-viewport CONTAINER (`overflow-hidden ... bg-[#09090b]`, `fixed inset-0 z-50
  bg-[#09090b]`, or the empty-state panel) — chrome, not per-node/per-edge data, matching the
  plan's explicit "the panel chrome... convert; the NODE and EDGE colours are data" instruction.
  All four converted to `bg-background`, following the identical precedent slice C's
  `ObsidianGraph.tsx` set for the same "graph canvas container" role (`bg-gray-950` -> `bg-background`).
- `src/components/graph/ForceGraphCanvas.tsx`'s decorative backdrop radial-gradient
  (`from-zinc-900 via-[#09090b] to-black`, a vignette sitting inside the already-converted canvas
  container) — the `from-zinc-900` stop is in the PALETTE bucket (converted to
  `from-[var(--surface-3)]`, the lightest surface tier, matching its role as the vignette's
  brightest/center stop). `via-[#09090b]` and `to-black` are **not converted, out of scope**: the
  hex bucket regex only matches `bg-`/`border-`/`text-` prefixes, not `via-`/`to-`, and "black" is
  outside the neutral palette family for the same reason the dialog/sheet scrims above are exempt.
  Recorded here rather than silently left as a partial gradient.
- `src/components/skills/vault/ClusterDetailCard.tsx`, `SkillKanbanView.tsx`,
  `SkillVaultDetailCard.tsx` — **not matched by the hex bucket at all, confirmed correct
  exclusion, not a new exception**: `CONTAINER_ACCENT`, `cluster.color`/`skill.color`/`s.color`,
  and every `style={{ backgroundColor: ... }}`/`boxShadow` use are plain JS hex strings consumed
  via inline `style` props (per-container/per-skill data colour, genuinely data-driven), never a
  `bg-[#...]` Tailwind className literal — the hex bucket regex requires the `bg-`/`border-`/
  `text-` class prefix and does not match bare JS string values or `style` prop keys. Same finding
  as slice C's `ObsidianGraph.tsx` `colors`/`groupColors`/`colorFn` confirmation.
- `src/components/TokenWaterfall.tsx`'s `MODEL_COLORS` — same confirmation: a plain JS
  `Record<string, string>` of hex strings consumed via `style={{ backgroundColor: color }}`, never
  a className literal. Never matched the hex bucket regex; not a new exception.

### Role-mapping conventions applied across the slice (for reviewer context)

Follows slices A/B/C's established conventions throughout:
- Outer card/panel wrapper (`bg-gray-800/50` + `border-gray-700/50`) -> `bg-card/50` +
  `border-border/50` (TeamStatusCards, TokenSunburst x2, TokenWaterfall x2, VersionHistory).
- Sunken/nested stat tile within a card (`bg-gray-900/NN`) -> `bg-background/NN` (TokenSunburst's
  cost/token tiles, VersionHistory's version rows).
- Static content row inside a card, lighter than its own container rather than darker
  (`bg-gray-700/30`) -> `bg-muted/30` (TeamStatusCards' per-team row — the opposite tonal direction
  from the "sunken row" pattern above, so mapped to the generic quiet-list-row token rather than
  `bg-background`).
- Hover on a raised/interactive table row -> `hover:bg-[var(--surface-3)]/NN` (TokenSunburst's
  drill-down provider row).
- Status-fallback dots/chips (idle team status, unknown activity-event type) -> `bg-muted`/
  `text-muted-foreground`, never a `--status-*` token, matching every prior slice's convention
  (TeamStatusCards' idle badge, DetailActivityTab's unmapped-eventType fallback).
- Placeholder/fallback avatar chip (no Clerk key configured) -> `bg-muted text-muted-foreground`
  (UserMenu's "?" circle).
- Text ink: `-100/-200/-300` weights -> `text-foreground`; `-400/-500/-600` weights ->
  `text-muted-foreground` — identical split to every prior slice, applied throughout
  ToolExecutionPanel's expanded-detail labels/values, TokenSunburst/TokenWaterfall/VersionHistory/
  TeamStatusCards' body text, and the skills/vault detail-card ink hierarchy below.
- Floating "glass" detail-overlay card over a 3D/canvas visualisation (`bg-zinc-950/85`, absolutely
  positioned, `role="dialog"`) -> `bg-popover/85`, treated as a raised overlay layer exactly like
  every prior slice's "click-to-reveal expanded panel" convention (`ClusterDetailCard.tsx`,
  `SkillVaultDetailCard.tsx` — both float over `SkillVaultView`'s 3D canvas).
- Discrete draggable card inside a kanban lane, base state semi-transparent and solidifying (not
  lightening) on hover (`bg-zinc-900/60` -> hover `bg-zinc-900`, no opacity suffix) ->
  `bg-card/60` -> `hover:bg-card`, preserving the exact "same tone, more opaque" hover behaviour
  rather than substituting the usual `hover:bg-[var(--surface-3)]` raise (`SkillKanbanView.tsx`'s
  skill card). Its grip-handle icon (`text-zinc-600 group-hover:text-zinc-400`, a genuine
  brightening on hover, not merely an opacity reveal) mapped to
  `text-muted-foreground/50 group-hover:text-muted-foreground` to preserve the two-state contrast
  the flat `-600`/`-400` -> `text-muted-foreground` bucket mapping would otherwise collapse.
- `border-white/N` and `bg-white/[N]` throughout the skills/vault glass-card family
  (`ClusterDetailCard`, `SkillKanbanView`, `SkillVaultDetailCard`) — **left untouched, out of
  bucket scope**: "white" is not in the neutral palette family the palette regex matches, same
  exemption as `bg-black` elsewhere in this ledger. These are the deliberate hairline/glass
  aesthetic of the 3D-vault overlay family, not part of D-02's measured population.

### `hr/` agent-tier badges: correction to the plan's `<interfaces>` example (Task 2 + Task 3)

`AgentCard.tsx`, `AgentDetailSheet.tsx`, `RosterOrgChart.tsx`, `RosterTable.tsx`, `TeamEditor.tsx`
all share the identical `command`/`domain`/`shared` tier enumeration (`TeamEditor.tsx:45` even
comments "Tier badge colors (consistent with AgentCard / RosterTable)"), confirmed against
`useRosterAgents.ts:112` and `astridrApi.ts:92`: `tier: "command" | "domain" | "shared"`, a
generic three-way ORG-CHART hierarchy where any number of agents can hold any tier — there is no
`isAstridr`/`is_astridr` flag or singular "this agent is Ástríðr" marker anywhere in the roster
data model (confirmed via `git grep`). Every agent rendered by every one of these five files is
already one of Ástríðr's own agents (per this repo's own framing); using `var(--astridr)` for just
the `command` slot of a 3-tier enum would misleadingly suggest only command-tier agents are
Ástríðr-owned, when the whole roster already is — the identical reasoning slice C's
`SwarmTaskNode.tsx` `verifying` verdict used for one arbitrary slot in an enumerated status table.
**Re-hued to `--primary`** in all five files (bundled per-key with its own text pairing:
`bg-primary/20 text-primary border-primary/30` for AgentCard's low-opacity chip variant;
`bg-primary text-primary-foreground` for the four solid-fill variants, replacing a `text-white`
value that was hardcoded per-key and therefore safe to swap for the correct semantic
foreground-on-primary pairing token). `domain` (blue) is untouched throughout (not violet). The
`shared` tier's own gray fill (palette bucket, Task 2) converted to `bg-muted`/
`text-muted-foreground` as a matched pair everywhere except `RosterOrgChart.tsx`, whose consuming
JSX applied a single hardcoded `text-white` across all three tiers regardless of key — bundling
`shared`'s text colour into its own map value (rather than leaving the external `text-white`
unconditional) was necessary there to avoid pairing near-white `bg-muted` (light-theme
`--muted` is `oklch(0.97 0 0)`) with white text, which the light `:root` theme has no surface-ramp
override for. `AgentDetailSheet.tsx`'s consumer additionally appends a hardcoded `bg-transparent`
suffix after the tier class (a pre-existing "quiet badge" override, unrelated to and unmodified by
this plan) — confirmed the intended visual there is unaffected since the override always wins
regardless of which background class the map supplies.

**This corrects the plan's own orientation text**, which named these four files (plus
`RosterTable.tsx`) as places where "a genuine `var(--astridr)` verdict is far more likely... than
in slice C" — read directly, the live tier-enum data model gives the opposite answer: **0 sites
converted to `--astridr`, 5 sites re-hued to `--primary`** across this slice's `command`-tier
cluster, matching slice C's own finding that speculative plan prose about likely `--astridr` sites
did not survive contact with the code.

### Violet sites (Task 3) — full adjudication

Task 1's ledger recorded 10 violet occurrences across 7 files, resolving to **7 distinct sites**
(one site is a single category/tier colour definition, in several cases referenced by multiple
`bg-`/`text-`/`border-` sub-properties or repeated across a shared badge-colour map consumed by
more than one JSX call site in the same file). Occurrence counts sum to the Task 1 total
(3+1+1+1+1+2+1 = 10). Row count (7) equals the Task 1 site count.

| file | site | represents | verdict | reason |
|---|---|---|---|---|
| `AgentCard.tsx` | `TIER_BADGE_COLOR.command` / `TIER_GLOW.command` (3 occurrences: `bg-purple-600/20`, `text-purple-400`, `border-purple-500/30`; `from-purple-600/20` is a 4th class in the same map but was not separately counted by the occurrence regex since it uses `from-` on the SAME literal already counted — see note below) | One slot (`command`) of a 3-way agent org-chart tier enum (`command`/`domain`/`shared`) shared identically across 5 files in this slice | Re-hued to **`--primary`** (`bg-primary/20 text-primary border-primary/30`; glow `from-primary/20`) | See the dedicated "`hr/` agent-tier badges" section above — every agent in the roster is already Ástríðr's, so a single enum slot cannot be the exclusive `--astridr` owner. |
| `AgentDetailSheet.tsx` | `TIER_BADGE_COLOR.command` (1: `bg-purple-600`, paired with the file's own `text-white`) | Same `command` tier slot, solid-fill variant | Re-hued to **`--primary`** (`bg-primary text-primary-foreground`) | Same reasoning as AgentCard; solid-fill sibling of the same enum. |
| `RosterOrgChart.tsx` | `TIER_COLOR.command` (1: `bg-purple-600`, org-chart node badge) | Same `command` tier slot, solid-fill org-chart node | Re-hued to **`--primary`** (`bg-primary text-primary-foreground`, text decoupled per-key — see correction note above) | Same reasoning; this file's own Task 1 acceptance-criterion sibling site (`RosterTable.tsx`) confirms the enum is shared app-wide. |
| `RosterTable.tsx` | `TIER_BADGE_COLOR.command` (1: `bg-purple-600`) | Same `command` tier slot, solid-fill roster-table badge | Re-hued to **`--primary`** (`bg-primary text-primary-foreground`) | Same reasoning. Named in the plan's own Task 1 acceptance criterion as the known violet control for this slice. |
| `TeamEditor.tsx` | `TIER_BADGE_COLOR.command` (1: `bg-purple-600`) | Same `command` tier slot, solid-fill member-list badge (consumed at two JSX call sites, `:106` and `:394`, both reading the same map) | Re-hued to **`--primary`** (`bg-primary text-primary-foreground`) | Same reasoning — the plan's own orientation text flagged this file as "likelier a category-colour case," which the shared-enum evidence confirms. |
| `hr/detail/DetailActivityTab.tsx` | `eventTypeColors.handoff` (2: `text-purple-400`, `bg-purple-400/10`) | One of 4 FIXED activity-event-type categories in an agent's activity feed (handoff=purple, message=blue, delegation=cyan, result=green) — describes what KIND of inter-agent event occurred, not which agent is Ástríðr | Re-hued to **indigo** (`text-indigo-400 bg-indigo-400/10`) | Fixed key, but names a generic event-type category shared by every agent's activity feed (any agent can trigger a `handoff`), not an identity marker — same shape as slice C's `SessionCapabilities.tsx` "Tools" chip verdict. `--primary` was rejected (would collide with this file's own accent usage elsewhere); indigo keeps a vivid, legend-scannable hue distinct from the file's existing blue/cyan/green trio, matching slice C's `OriginBadge.tsx` precedent for the identical "categorical tag, needs a hue outside the reserved family" case. |
| `hr/detail/DetailVersionsTab.tsx` | `CHANGE_TYPE_COLORS.clone` (1: `bg-purple-600`, paired with the file's own hardcoded `text-white`) | One of 5 FIXED version-change-type categories (create=green, update=blue, clone=purple, import=amber, rollback=red) — describes what KIND of config-version event occurred | Re-hued to **indigo** (`bg-indigo-600 text-white`) | Same reasoning as `DetailActivityTab.tsx` — a generic categorical tag (any agent's config can be cloned), not an Ástríðr-identity marker. Consistent indigo choice across both `hr/detail/` categorical-tag sites in this slice. |

**Split of the adjudication, as D-08 requires ("an adjudication that reaches the same verdict
everywhere is a rule being applied, not a judgement being made"):** **0 sites converted to
`--astridr`**, **5 sites re-hued to `--primary`** (the shared `command`-tier enum, identical
reasoning applied consistently because it IS the same enum shared across 5 files, not a shortcut),
**2 sites re-hued to indigo** (independent categorical tags in unrelated maps). The two indigo
sites and the five `--primary` sites reached different verdicts from genuinely different code —
the tier enum is app-wide shared state read from `useRosterAgents`/`astridrApi`, while the
`eventTypeColors`/`CHANGE_TYPE_COLORS` maps are file-local enums with no cross-file relationship —
confirming this was traced per site rather than pattern-matched by directory name, exactly as the
plan's orientation text warned against ("do not convert the whole subtree on the strength of the
directory name").

### Motion sites (Task 3)

25 `duration-NNN` occurrences (Task 1 ledger) across 12 files, itemized below by file and line —
several files carry more than one occurrence per element (e.g. two duration classes in the same
`className` string, resolved with a single shared `ease-house`) or more than one distinct element.
Row-by-row occurrence counts below sum to 25 (1+1+1+2+5+5+3+1+1+1+1+1+2 = 25), matching the Task 1
total exactly. `CatalogCard.tsx` and `TeamCard.tsx` were
**not** in the plan's indicative Task 3 file list but held 5 and 3 occurrences respectively — the
Task 1 ledger was authoritative per the plan's own instruction, and both were found and converted.

| file | line(s) | old | new | reasoning |
|---|---|---|---|---|
| `WarRoomKanbanColumn.tsx` | 49 | `duration-300` (no easing) | `duration-slow ease-house` | 300ms -> slow bucket; drop-zone border/bg settle, no prior easing. |
| `WarRoomTaskCard.tsx` | 44 | `duration-300` (no easing) | `duration-slow ease-house` | 300ms -> slow bucket; hover-lift/drag settle. |
| `graph/CodeVaultGraph.tsx` | 473 | `duration-300` (no easing) | `duration-slow ease-house` | Fullscreen container transition. |
| `graph/CodeVaultGraph.tsx` | 717, 837 | `duration-200` (no easing) x2 | `duration-normal ease-house` x2 | Back-navigation and cross-graph link hover-colour transitions. |
| `hr/AgentCard.tsx` | 57, 64, 67, 70, 86 | `duration-500` (no easing) x5 | `duration-slow ease-house` x5 | **All 5 >= 400ms — recorded per the audit rule.** Card wrapper, tier-glow wash, grid overlay, top scanline, avatar-scale settle — all uniform 500ms with no prior easing on this card. |
| `hr/CatalogCard.tsx` | 31 (x2), 33, 80, 82 | `duration-300` (no easing) x5 | `duration-slow` (`ease-house` added once per element) x5 | Not in the plan's indicative Task 3 list; found via the re-derived ledger. Card wrapper (two duration mentions on one line — `ease-house` added once, applies to both since it's a single `transition-timing-function`), category-emoji scale, `BlankAgentCard` wrapper, and its "+"-icon scale settle. The kill-list-surviving `hover:-translate-y-1`/`group-hover:scale-110` transforms themselves (Phase 120 D-01, `120-DESIGN-REVIEW-HANDOFF.md:130-131`) are untouched — only the duration/easing values changed. |
| `hr/TeamCard.tsx` | 29 (x2), 30 | `duration-300` (no easing) x2, `duration-500` (no easing) x1 | `duration-slow` (`ease-house` added) x2, `duration-slow ease-house` x1 | **The 500ms site is >= 400ms — recorded.** Same lift-card wrapper pattern as `CatalogCard.tsx`; the hover top-highlight bar (separate element, its own independent transition) got its own `ease-house`. |
| `hr/detail/DetailConfigTab.tsx` | 219 | `duration-500` (no easing, `animate-in fade-in`) | `duration-slow ease-house` | **>= 400ms — recorded.** Read-mode entrance fade for the agent config panel. |
| `skills/RunAstridrPopover.tsx` | 72 | `duration-300` (no easing) | `duration-slow ease-house` | Persona-switch segmented-control active-state transition. |
| `ui/accordion.tsx` | 42 | `duration-200` (no easing) | `duration-normal ease-house` | Chevron rotate-on-expand icon transition — one of the four `ui/` primitives every accordion in the app inherits. |
| `ui/alert-dialog.tsx` | 55 | `duration-200` (no explicit non-house easing) | `duration-normal ease-house` | AlertDialogContent enter/exit — every destructive confirmation dialog in the app inherits this. |
| `ui/dialog.tsx` | 62 | `duration-200` (no explicit non-house easing) | `duration-normal ease-house` | DialogContent enter/exit — every modal in the app inherits this. |
| `ui/sheet.tsx` | 61 | `duration-300` (close) / `duration-500` (open), explicit `ease-in-out` | `duration-slow` (both) / `ease-house` | **The open-side 500ms value is >= 400ms — recorded.** `ease-in-out` replaced with `ease-house`: the slide-in/slide-out is a one-directional per-event settle (enter OR exit, never a symmetric oscillation), matching slice B's `KanbanColumn.tsx` and slice C's `QueenNode.tsx`/`SwarmTaskNode.tsx` precedent for replacing a non-house `ease-in-out` on directional (not looping) transitions. Every sheet in the app (all four `side` variants) inherits this. |

No site introduced a NEW easing where a genuinely symmetric 0%/50%/100% loop existed (none of
this slice's motion sites are loops); every explicit non-house easing found (`sheet.tsx`'s
`ease-in-out`) was a one-directional settle, matching the established replace-it precedent rather
than the "symmetric loop, leave it" exception class 122-03 carved out.
