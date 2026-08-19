# Sweep Ledger — 122-08 (Slice E: `doccomments/`, `kg/`, `reminders/`, `voice/`, `src/layouts/`, 13 pages, 22 files)

## Matchers (verbatim, run against `git`'s working tree at execution time)

```
palette: (bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}
hex:     (bg|border|text)-\[#          (fixed-string the `#` where the tool requires it)
motion:  duration-[0-9]+
violet:  (bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}
```

Counting method: `grep -oE '<pattern>' <file> | wc -l` per file — **occurrences**, not matching
lines and not files. Matches the unit slices A/B/C/D (122-04/05/06/07) used, for a consistent
phase-wide ledger format.

## Control — matchers proven against known-positives before trusting any zero

- `src/pages/KnowledgeGraph.tsx` — plan's own Task 1 acceptance criterion names this file as known
  to hold a hex literal: measured **1** hex occurrence (`bg-[#...` at line 938). Non-zero.
- `src/pages/Capabilities.tsx` — plan's own Task 1 acceptance criterion names this file as known to
  hold a violet utility: measured **2** violet occurrences (`text-purple-400` at lines 187, 209).
  Non-zero.
- Both matchers proven to discriminate before any zero in this ledger is trusted.
- This is the LAST slice — no unswept sibling remains to serve as an out-of-slice control. AFTER
  section instead uses a BEFORE/AFTER git-blob contrast: the matcher run against the pre-plan git
  blob of one of this slice's own files (non-zero) versus the working-tree version post-edit
  (zero).

## Population disagreement vs. the plan's `files_modified` list

None. Re-derived fresh via `grep -oE` directly against exactly these 22 files (confirmed present
on disk via a existence check before measuring — all 22 `OK`). Reconciled 1:1 against the plan's
`files_modified` list; no file added or removed.

## BEFORE table (occurrences, one row per file in `files_modified`; 22 rows)

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/doccomments/ApprovedEditCard.tsx` | 1 | 0 | 0 | 0 |
| `src/components/doccomments/CommentPopover.tsx` | 2 | 0 | 0 | 0 |
| `src/components/doccomments/CommentSidebar.tsx` | 5 | 0 | 0 | 0 |
| `src/components/kg/KGDetailsPanel.tsx` | 0 | 0 | 3 | 0 |
| `src/components/kg/KGViewsPopover.tsx` | 0 | 0 | 1 | 0 |
| `src/components/reminders/CalendarOverlay.tsx` | 0 | 0 | 1 | 0 |
| `src/components/reminders/ReminderList.tsx` | 0 | 0 | 1 | 0 |
| `src/components/voice/AvatarAura.tsx` | 0 | 0 | 1 | 0 |
| `src/layouts/DashboardLayout.tsx` | 0 | 0 | 5 | 0 |
| `src/pages/Alerts.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/Capabilities.tsx` | 0 | 0 | 0 | 2 |
| `src/pages/Chat.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/ForgePage.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/KnowledgeGraph.tsx` | 1 | 1 | 0 | 0 |
| `src/pages/Memory.tsx` | 0 | 0 | 0 | 2 |
| `src/pages/Quality.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/QualityDetail.tsx` | 0 | 0 | 2 | 0 |
| `src/pages/Reminders.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/ToolGalaxy.tsx` | 1 | 0 | 4 | 0 |
| `src/pages/WarRoom.tsx` | 0 | 0 | 2 | 0 |
| `src/pages/WhatsApp.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/hr/AgentAnalytics.tsx` | 0 | 0 | 4 | 0 |
| **TOTAL (occurrences)** | **10** | **1** | **30** | **4** |

## AFTER table (palette + hex only — Task 2 landed; motion/violet columns still show BEFORE, pending Task 3)

Re-measured with the identical matchers immediately after Task 2. `git grep -nE` over all 22 files
for both buckets returns zero hits (see verification below); every file's palette/hex column is 0.

| file | palette | hex | motion (pending T3) | violet (pending T3) |
|---|---|---|---|---|
| `src/components/doccomments/ApprovedEditCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/doccomments/CommentPopover.tsx` | 0 | 0 | 0 | 0 |
| `src/components/doccomments/CommentSidebar.tsx` | 0 | 0 | 0 | 0 |
| `src/components/kg/KGDetailsPanel.tsx` | 0 | 0 | 3 | 0 |
| `src/components/kg/KGViewsPopover.tsx` | 0 | 0 | 1 | 0 |
| `src/components/reminders/CalendarOverlay.tsx` | 0 | 0 | 1 | 0 |
| `src/components/reminders/ReminderList.tsx` | 0 | 0 | 1 | 0 |
| `src/components/voice/AvatarAura.tsx` | 0 | 0 | 1 | 0 |
| `src/layouts/DashboardLayout.tsx` | 0 | 0 | 5 | 0 |
| `src/pages/Alerts.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/Capabilities.tsx` | 0 | 0 | 0 | 2 |
| `src/pages/Chat.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/ForgePage.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/KnowledgeGraph.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/Memory.tsx` | 0 | 0 | 0 | 2 |
| `src/pages/Quality.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/QualityDetail.tsx` | 0 | 0 | 2 | 0 |
| `src/pages/Reminders.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/ToolGalaxy.tsx` | 0 | 0 | 4 | 0 |
| `src/pages/WarRoom.tsx` | 0 | 0 | 2 | 0 |
| `src/pages/WhatsApp.tsx` | 0 | 0 | 1 | 0 |
| `src/pages/hr/AgentAnalytics.tsx` | 0 | 0 | 4 | 0 |
| **TOTAL (occurrences)** | **0** | **0** | **30 (pending)** | **4 (pending)** |

**Verification (route stability + population):** `git diff --stat -- src/layouts/DashboardLayout.tsx`
is EMPTY after Task 2 (it held no palette/hex hits to begin with — see ADJUDICATION below).
`src/lib/navRegistry.ts` absent from `git diff --name-only`. `npx tsc --noEmit` exits 0.
`npx vitest run` → 4772 passed / 0 failed, 338 files passed / 17 skipped — matches the recorded
pre-plan baseline exactly.

**Full-diff spot-check (three files chosen at random):** `src/components/doccomments/CommentSidebar.tsx`,
`src/pages/KnowledgeGraph.tsx`, `src/pages/ToolGalaxy.tsx` — `git diff` read in full for each; every
changed line is a colour-class swap only, no logic/JSX-structure/prop change.

## ADJUDICATION (Task 2 — palette + hex)

### Palette sites

| file | site | represents | verdict |
|---|---|---|---|
| `ApprovedEditCard.tsx:30` | `text-zinc-300` on the unchanged-diff-word span | de-emphasised diff-word ink | `text-muted-foreground` |
| `CommentPopover.tsx:17` | `border-zinc-700 bg-zinc-900` on the fixed-position comment-entry popover | raised floating surface (not a Radix `Popover`, a plain positioned div playing the same role) | `border-border bg-popover` — matches the plan's explicit "raised surfaces -> bg-popover" instruction for this exact file |
| `CommentSidebar.tsx:10` | `bg-zinc-600/30 text-zinc-400` on the `stale` status badge | unclassified/inert status chip, same family as every prior slice's idle/unknown-status convention | `bg-muted text-muted-foreground` |
| `CommentSidebar.tsx:31` | `hover:bg-zinc-900/50` on an interactive comment row | hover on a raised/interactive row | `hover:bg-[var(--surface-3)]/50` |
| `CommentSidebar.tsx:38` | `text-zinc-200` on the comment body text | primary/prominent ink | `text-foreground` |
| `CommentSidebar.tsx:47` | `text-zinc-400` on the stale-anchor explainer | dim/secondary ink | `text-muted-foreground` |
| `KnowledgeGraph.tsx:1656` | `border-dashed border-slate-400/50` on the "superseded" edge-style legend swatch | de-emphasised/muted legend entry (sibling entries: `current` = `border-primary/60`, `contradiction` = `border-red-500`, out of bucket scope) | `border-muted-foreground/50` |
| `ToolGalaxy.tsx:325` | `from-zinc-900` — the brightest/center stop of a decorative canvas-backdrop radial-gradient vignette | vignette gradient stop, lightest tier | `from-[var(--surface-3)]` — identical precedent to slice D's `ForceGraphCanvas.tsx` vignette finding |

### Hex sites

| file | site | represents | verdict |
|---|---|---|---|
| `KnowledgeGraph.tsx:938` | `bg-[#09090b]` on the lazy-3D-render Suspense fallback container | canvas/panel chrome (not a per-node/per-edge data colour) | `bg-background` — same "graph canvas container" precedent as slice C/D's `ObsidianGraph.tsx`/`ForceGraph3D.tsx`/`CodeVaultGraph.tsx` |

**`ToolGalaxy.tsx:325`'s `via-[#09090b]` and `to-black` — NOT converted, out of scope, confirming an
existing exclusion, not a new exception:** identical to slice D's `ForceGraphCanvas.tsx` finding —
the hex bucket regex only matches `bg-`/`border-`/`text-` prefixes, not `via-`/`to-`, and "black" is
outside the neutral palette family for the same reason the shadcn dialog/sheet scrims are exempt in
every prior slice's ledger. Left exactly as-is, recorded here per the plan's "name what they are"
instruction rather than silently leaving a partial gradient.

### Population disagreement vs. the plan's `<interfaces>` prose

None found for Task 2 beyond what Task 1 already recorded. `src/layouts/DashboardLayout.tsx` — the
plan's `<interfaces>` text speculates at length about how its "page-level container", "sidebar and
header surfaces" should map to `bg-background`/`bg-card`/`bg-popover` — but the live tree already
uses those exact aliases throughout (`bg-background`, `bg-sidebar`, `bg-primary/*`, `bg-muted/*`,
`dark:bg-[var(--glass-bg)]`) with zero raw palette or hex literals (confirmed by Task 1's BEFORE row:
0/0). Its one `bg-black/50` mobile-overlay scrim is the same out-of-neutral-family exemption every
prior slice applied to dialog/sheet scrims (black is not in the matched family), left untouched.
**Zero palette/hex conversions were needed or made in `DashboardLayout.tsx`** — this corrects the
plan's own framing that this file was "where a wrong surface mapping is most visible" for this
bucket; it was already correct, and this slice's actual DashboardLayout work is entirely in the
motion bucket (Task 3).
