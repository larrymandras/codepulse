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

## AFTER table

Filled in after Task 2 and Task 3 land, below.

## ADJUDICATION

Filled in after Task 2 and Task 3 land, below.
