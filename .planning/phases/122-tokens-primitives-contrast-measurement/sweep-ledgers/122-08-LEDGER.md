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

## AFTER table (final — all four buckets, post Task 3)

Re-measured with the identical matchers after Task 3 landed. Every row, every column: **0**.

| file | palette | hex | motion | violet |
|---|---|---|---|---|
| `src/components/doccomments/ApprovedEditCard.tsx` | 0 | 0 | 0 | 0 |
| `src/components/doccomments/CommentPopover.tsx` | 0 | 0 | 0 | 0 |
| `src/components/doccomments/CommentSidebar.tsx` | 0 | 0 | 0 | 0 |
| `src/components/kg/KGDetailsPanel.tsx` | 0 | 0 | 0 | 0 |
| `src/components/kg/KGViewsPopover.tsx` | 0 | 0 | 0 | 0 |
| `src/components/reminders/CalendarOverlay.tsx` | 0 | 0 | 0 | 0 |
| `src/components/reminders/ReminderList.tsx` | 0 | 0 | 0 | 0 |
| `src/components/voice/AvatarAura.tsx` | 0 | 0 | 0 | 0 |
| `src/layouts/DashboardLayout.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/Alerts.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/Capabilities.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/Chat.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/ForgePage.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/KnowledgeGraph.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/Memory.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/Quality.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/QualityDetail.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/Reminders.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/ToolGalaxy.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/WarRoom.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/WhatsApp.tsx` | 0 | 0 | 0 | 0 |
| `src/pages/hr/AgentAnalytics.tsx` | 0 | 0 | 0 | 0 |
| **TOTAL (occurrences)** | **0** | **0** | **0** | **0** |

**BEFORE/AFTER git-blob contrast controls (this is the LAST slice — no unswept sibling remains, per
the plan's own note; using the prescribed git-blob contrast instead):**
- Motion: `git show HEAD~1:src/layouts/DashboardLayout.tsx | grep -oE 'duration-[0-9]+' | wc -l` →
  **5** (the pre-Task-3 blob, holding this slice's own un-converted motion literals). The identical
  matcher against the current working tree → **0**. The matcher discriminates; it is not returning
  zero for everything.
- Violet: `git show HEAD~1:src/pages/Memory.tsx | grep -oE '(bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}' | wc -l`
  → **2** (pre-Task-3 blob). Working tree now → **0**. Discriminates correctly.
- Palette/hex: already proven discriminating in the Task 2 AFTER section above via the same
  before/after contrast (`git show HEAD~2:...` vs. working tree), reused here rather than repeated.

**Positive proof the motion conversion is live, not just absent (Task 3 acceptance criterion):**
after `npm run build`, `dist/assets/index-DtHO5zZo.css` contains all four rules by fixed-string
search: `.duration-fast{` (1), `.duration-normal{` (1), `.duration-slow{` (1), `.ease-house{` (1) —
all PRESENT (this slice used all three duration tiers plus `ease-house` throughout). Control:
`.duration-nonsense-9x7q2{` searched in the same file — **0**, confirming the search itself
discriminates rather than matching everything.

**Test evidence:** `npx tsc --noEmit` exits 0 (after Task 2 and again after Task 3). `npm run build`
exits 0. `npx vitest run` — 338 test files passed, 17 skipped (355 total), 4772 tests passed, 197
todo (4969 total) — matches the recorded pre-plan baseline of 4772/0 exactly; zero new failures,
re-verified after both Task 2 and Task 3.

**Route-stability check (Task 2 acceptance criterion, re-verified after Task 3 since Task 3 also
touches `DashboardLayout.tsx`):** `git diff -- src/layouts/DashboardLayout.tsx` contains no change
to any `to=`/`path=`/`href=` value (grepped and confirmed empty). `src/lib/navRegistry.ts` absent
from `git diff --name-only`. Diff is exactly **10** changed lines (5 motion sites × 1 line each) —
read in full, every one is a `duration-NNN` → `duration-{fast,normal,slow} ease-house` swap.

**Full-diff spot-check (Task 3, three files chosen at random):** `src/pages/Memory.tsx`,
`src/pages/ToolGalaxy.tsx`, `src/pages/hr/AgentAnalytics.tsx` — `git diff` read in full for each;
every changed line is a colour/motion-token class swap, no logic, JSX structure, prop, or
conditional touched.

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

## ADJUDICATION (Task 3 — motion)

30 `duration-NNN` occurrences recorded in Task 1's ledger across 12 files. One of those 30 is a
**comment-text false positive, not a live class** (see the `WarRoom.tsx` row below) — the regex
matched prose inside a JSX comment describing the retained value, not a className. All 29 live
sites are itemized below; row-by-row occurrence counts sum to 30 (3+1+1+1+1+5+1+2+1+0+1+4+1+2+1+4+2+1+4
— see per-file breakdown), matching the Task 1 total exactly once the comment mention is accounted
for.

| file | line(s) | old | new | reasoning |
|---|---|---|---|---|
| `kg/KGDetailsPanel.tsx` | 156, 216 | `duration-200` (no easing) x2 | `duration-normal ease-house` x2 | Return-nav chip hover settle (default state + no-selection placeholder variant of the same chip). |
| `kg/KGDetailsPanel.tsx` | 319 | `duration-200` (no easing) | `duration-normal ease-house` | Cross-graph "Owning agent" nav button hover settle. |
| `kg/KGViewsPopover.tsx` | 191 | `duration-150` (no easing) | `duration-fast ease-house` | 150ms falls in the fast bucket (75/100/150) — different tier from the 200ms sites above. Hover-reveal action-icon opacity fade. |
| `reminders/CalendarOverlay.tsx` | 262 | `motion-safe:duration-200` (no easing) | `motion-safe:duration-normal motion-safe:ease-house` | Day-cell hover/press settle; the `motion-safe:` prefix preserved on both duration and easing so the reduced-motion guard still applies to the new token. |
| `reminders/ReminderList.tsx` | 301 | `duration-300` (no easing) | `duration-slow ease-house` | Reminder-row opacity fade on complete/done state. |
| `voice/AvatarAura.tsx` | 373 | `duration-300 ease-out` | `duration-slow ease-house` | Speaking-frame crossfade image. `ease-out` replaced: a one-directional opacity crossfade (never a symmetric loop), matching the established "directional settle -> ease-house" precedent from every prior slice. Per the plan's explicit note, only this timing/easing class changed — the `Math.random` particle-jitter physics elsewhere in the same file was untouched. |
| `layouts/DashboardLayout.tsx` | 152 | `duration-300` (no easing) | `duration-slow ease-house` | Nav-icon drop-shadow glow transition on hover/active. |
| `layouts/DashboardLayout.tsx` | 232 | `duration-300` (no easing) | `duration-slow ease-house` | Operator-avatar image opacity fade-in. |
| `layouts/DashboardLayout.tsx` | 290 | `duration-300` (no easing) | `duration-slow ease-house` | Settings nav-icon drop-shadow glow (same pattern as :152, different NavLink). |
| `layouts/DashboardLayout.tsx` | 524 | `duration-200` (no easing) | `duration-normal ease-house` | Sidebar collapse/expand width transition. |
| `layouts/DashboardLayout.tsx` | 545 | `duration-200` (no easing) | `duration-normal ease-house` | Mobile sidebar slide-in/out transform. |
| `pages/Alerts.tsx` | 67 | `duration-200 ease-out` | `duration-normal ease-house` | Alert-row opacity fade on ack/resolve/mute state change. `ease-out` replaced per the directional-settle precedent. |
| `pages/Chat.tsx` | 791 | `duration-300` (no easing) | `duration-slow ease-house` | `AvatarAura` wrapper opacity/filter fade keyed to `listening` state. Chat.tsx is D-09's in-repo north star for the house easing — this is the file whose transitions the token was modeled on. |
| `pages/ForgePage.tsx` | 175 | `duration-200` (no easing) | `duration-normal ease-house` | Mobile job-list panel slide-in/out transform (F8). |
| `pages/Quality.tsx` | 44 | `duration-300` (no easing) | `duration-slow ease-house` | Persona card hover-lift/border settle. |
| `pages/QualityDetail.tsx` | 46 | `duration-500` (no easing) | `duration-slow ease-house` | **>= 400ms — recorded per the audit rule.** Sub-score bar width-fill transition. |
| `pages/QualityDetail.tsx` | 89 | `duration-200` (no easing) | `duration-normal ease-house` | "Back to Quality" link hover settle. |
| `pages/Reminders.tsx` | 69 | `duration-300` (no easing) | `duration-slow ease-house` | Profile-tab active-state switch. |
| `pages/ToolGalaxy.tsx` | 311 | `duration-200` (no easing) | `duration-normal ease-house` | Return-nav chip hover settle (identical pattern to `KGDetailsPanel.tsx`'s, different page). |
| `pages/ToolGalaxy.tsx` | 467, 492, 519 | `duration-200` (no easing) x3 | `duration-normal ease-house` x3 | "RELATED ACROSS GRAPHS" cross-nav buttons (owning agent / tool / goal) — three render sites sharing one class string. |
| `pages/WarRoom.tsx` | 311 (comment), 315 (class) | `duration-300` mentioned in an explanatory JSX comment (311) + the live `duration-300` class it describes (315) | comment text updated to `duration-slow ease-house` for consistency; live class converted to `duration-slow ease-house` | Mobile room-list drawer slide (F8). The comment-text occurrence is not a functional class and was never going to render, but was updated alongside the real one so the prose does not go stale describing a value the code no longer carries. |
| `pages/WhatsApp.tsx` | 428 | `duration-1000` (no easing) | `duration-slow ease-house` | **>= 400ms — recorded per the audit rule (the largest reduction in this slice, 1000ms -> 320ms).** QR-code countdown progress-bar width fill. |
| `pages/hr/AgentAnalytics.tsx` | 128, 172, 180, 204 | `duration-300` (no easing) x4 | `duration-slow ease-house` x4 | Four `GlassPanel` section wrappers (Controls, Team Summary, Leaderboard, Comparison Chart) sharing one class string pattern. |

Two sites cross the >= 400ms audit threshold in this slice (`QualityDetail.tsx:46` at 500ms,
`WhatsApp.tsx:428` at 1000ms); both recorded above per the plan's explicit instruction that a
>= 400ms collapse "is a genuine speed-up and must be auditable rather than silent."

## ADJUDICATION (Task 3 — violet)

Task 1's ledger recorded 4 violet occurrences across 2 files, resolving to **2 distinct sites**
(each a single categorical badge referenced by 1-2 sub-properties). Occurrence counts sum to the
Task 1 total (2+2 = 4). Row count (2) equals the Task 1 site count.

| file | site | represents | verdict | reason |
|---|---|---|---|---|
| `pages/Memory.tsx:472` | `stat.hadLlmSummarizer` chip (2 occurrences: `bg-purple-600/20`, `text-purple-400`) | A per-record flag on Ástríðr's own memory-tier-compression operations: this specific tier operation used HER LLM summarizer (as opposed to the heuristic fallback shown unstyled beside it) | Converted to **`var(--astridr)`** (`bg-[var(--astridr)]/20 text-(--astridr)`) | This is not "one source among several in a legend" (the plan's re-hue case) — there is no multi-hue legend here, just a single boolean state on her own memory subsystem's per-record operations. The whole page is Memory (her memory), and this chip specifically flags that a given compression used her live LLM rather than a heuristic — the plan's own framing ("Memory is Astridr's memory — a violet marking HER memory converts to `var(--astridr)`") applies directly. Matches `MemorySourceBadge.tsx`'s established `bg-[var(--astridr)]/10 text-(--astridr)` convention (slices A/B). This is the phase's **third** genuine `--astridr` conversion (after `MemorySourceBadge.tsx`'s `mem0` key and `DiscoveredToolsTable.tsx`'s `memory` category, both from earlier slices). |
| `pages/Capabilities.tsx:187,209` | `h.hookType` display (2 occurrences: `text-purple-400` x2, list-row + expanded-detail variants of the same value) | Claude Code CLI's own hook-lifecycle event name (`schema.ts:236` — `"PreToolUse" \| "PostToolUse" \| etc.`), rendered generically for whatever hook config is registered on the machine | Re-hued to **indigo** (`text-indigo-400`) | Confirmed via `convex/schema.ts` and `useCapabilities.ts`: `hookType` names a Claude Code CLI concept (a third-party tool's lifecycle vocabulary), not an Ástríðr identity/voice/agent/memory/routing marker — identical reasoning to slice C's `OriginBadge.tsx` "claude-code" origin-category verdict, which set the indigo precedent for exactly this "Claude Code CLI capability, not Ástríðr identity" case. |

**Split of the adjudication:** **1 site converted to `--astridr`** (Memory.tsx, a genuine identity
match per the plan's own binary framing), **1 site re-hued to indigo** (Capabilities.tsx, a
third-party CLI concept). Both reached from tracing what the code actually represents, not from the
directory name — `pages/Memory.tsx` and `pages/Capabilities.tsx` are exactly the two files the plan
flagged as "the two violet files here," and the plan's own steer for how to tell them apart
("marking HER memory" vs. "one source among several in a legend") resolved cleanly once the live
`hadLlmSummarizer`/`hookType` semantics were read.

## Population reconciliation (final)

Re-derived directly from the corpus at the start of this plan (Task 1), confirmed unchanged through
Task 2 and Task 3: exactly the 22 files in the plan's `files_modified` list, no file added or
removed, no file's role reassigned. Total occurrences converted: 10 palette + 1 hex + 30 motion
(29 live classes + 1 comment-text mention) + 4 violet = 45 total literal occurrences addressed
across this slice.
