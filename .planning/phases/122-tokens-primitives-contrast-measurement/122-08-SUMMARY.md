---
phase: 122-tokens-primitives-contrast-measurement
plan: 08
subsystem: ui
tags: [tailwind, tokens, design-system, react, motion, contrast, violet-adjudication, app-shell]

# Dependency graph
requires:
  - phase: 122-tokens-primitives-contrast-measurement
    provides: "src/index.css token layer (--surface-0/1/2/3, --hairline, --astridr, --status-*, --duration-*, --ease-house) from plans 122-01/122-02/122-03"
provides:
  - "22 files fully converted to the token vocabulary: doccomments/, kg/, reminders/, voice/ subtrees, src/layouts/DashboardLayout.tsx (the app shell), and 13 pages -- zero raw palette classes, zero surface hex literals, zero duration-NNN classes, zero raw violet utilities"
  - "sweep-ledgers/122-08-LEDGER.md: per-file before/after counts and per-site adjudication for slice E, the LAST sweep slice -- closes wave 3 (143/143 files)"
affects: [122-09-ratchet, 122-11-pageheader, 122-14, 122-15, 122-16, 124-shell]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A single boolean/method flag on an already Astridr-owned page (Memory.tsx's hadLlmSummarizer chip) is a genuine --astridr conversion when it is NOT one source among several in a legend -- the plan's own binary framing (identity marker vs. legend category) resolved this cleanly once the live semantics were read, giving the phase its third real --astridr conversion (after MemorySourceBadge.tsx and DiscoveredToolsTable.tsx from earlier slices)"
    - "A Claude Code CLI lifecycle vocabulary rendered generically (Capabilities.tsx's hookType, confirmed via convex/schema.ts's own comment) is a third-party-tool concept, not Astridr identity -- re-hues to indigo, matching slice C's OriginBadge.tsx precedent for the identical class of finding"
    - "A regex bucket count can include a comment-text false positive: WarRoom.tsx's duration-300 occurred once in a live className and once in prose inside a JSX comment describing it -- only the live class functionally matters, but the comment was updated alongside it so the prose does not go stale describing a value the code no longer carries"
    - "The single highest-blast-radius file in a sweep can hold zero conversions in one bucket and be entirely correct on the plan's own speculative framing -- DashboardLayout.tsx needed zero palette/hex changes (it already used bg-background/bg-sidebar/bg-primary throughout) and its only real work was in the motion bucket (5 sites)"
  patterns-established: []

key-files:
  created:
    - .planning/phases/122-tokens-primitives-contrast-measurement/sweep-ledgers/122-08-LEDGER.md
  modified:
    - src/components/doccomments/ApprovedEditCard.tsx
    - src/components/doccomments/CommentPopover.tsx
    - src/components/doccomments/CommentSidebar.tsx
    - src/components/kg/KGDetailsPanel.tsx
    - src/components/kg/KGViewsPopover.tsx
    - src/components/reminders/CalendarOverlay.tsx
    - src/components/reminders/ReminderList.tsx
    - src/components/voice/AvatarAura.tsx
    - src/layouts/DashboardLayout.tsx
    - src/pages/Alerts.tsx
    - src/pages/Capabilities.tsx
    - src/pages/Chat.tsx
    - src/pages/ForgePage.tsx
    - src/pages/KnowledgeGraph.tsx
    - src/pages/Memory.tsx
    - src/pages/Quality.tsx
    - src/pages/QualityDetail.tsx
    - src/pages/Reminders.tsx
    - src/pages/ToolGalaxy.tsx
    - src/pages/WarRoom.tsx
    - src/pages/WhatsApp.tsx
    - src/pages/hr/AgentAnalytics.tsx

key-decisions:
  - "Memory.tsx's hadLlmSummarizer chip (bg-purple-600/20 text-purple-400) converted to var(--astridr) -- traced as a per-record flag on Astridr's own memory-tier-compression operations, not a multi-hue legend entry, matching the plan's own steer for telling the two cases apart"
  - "Capabilities.tsx's hookType display (2 sites, list-row + expanded-detail variants of the same value) re-hued to indigo -- confirmed via convex/schema.ts (`hookType: v.string() // \"PreToolUse\" | \"PostToolUse\" | etc.`) as a Claude Code CLI lifecycle concept, not Astridr identity, matching slice C's OriginBadge.tsx precedent"
  - "DashboardLayout.tsx needed zero palette/hex conversions -- the plan's <interfaces> text speculated at length about mapping its container/sidebar/header surfaces, but the live tree already used bg-background/bg-sidebar/bg-primary/bg-muted throughout with zero raw literals; recorded as a correction to the plan's own framing rather than silently no-op'd"
  - "KnowledgeGraph.tsx's 'superseded' edge-style legend swatch (border-dashed border-slate-400/50) mapped to border-muted-foreground/50, not a --status-* token -- it is a de-emphasised/muted legend entry sitting beside 'current' (border-primary/60) and 'contradiction' (border-red-500, out of bucket scope)"
  - "ToolGalaxy.tsx's canvas-backdrop vignette gradient: only its from-zinc-900 stop (palette bucket) converted to from-[var(--surface-3)]; its via-[#09090b] and to-black stops left untouched, out of hex-bucket scope by construction (via-/to- prefixes unmatched, black outside the neutral family) -- identical finding to slice D's ForceGraphCanvas.tsx vignette"
  - "WarRoom.tsx's duration-300 appeared twice in the raw occurrence count: once as a live className, once as prose inside an adjacent JSX comment explaining why it is retained. The comment was updated to duration-slow ease-house alongside the real class so it does not go stale describing a value the code no longer carries"
  - "Two sites crossed the >=400ms motion-audit threshold and were recorded per the rule rather than silently collapsed: QualityDetail.tsx's sub-score bar fill (500ms) and WhatsApp.tsx's countdown progress bar (1000ms, the largest single reduction in the whole phase, to 320ms)"

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-03]

# Metrics
duration: ~55min
completed: 2026-08-19
---

# Phase 122 Plan 08: Sweep Slice E (doccomments/, kg/, reminders/, voice/, src/layouts/, 13 pages) Summary

**The LAST slice of the 143-file sweep -- 22 files including the app shell (DashboardLayout.tsx) and 13 pages converted clean of every hardcoded surface, motion literal and raw violet utility: 10 palette + 1 hex + 30 motion + 4 violet occurrences all converted, with two genuinely opposite violet verdicts on the slice's only two violet files (Memory.tsx's memory-operation flag -> var(--astridr), Capabilities.tsx's Claude-Code hook-type label -> indigo) and zero route/navRegistry disruption to the highest-blast-radius file in the whole phase.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-19T10:17:00Z (Task 1 commit)
- **Completed:** 2026-08-19T10:29:00Z (Task 3 commit) + summary/self-check
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 22 source files + 1 ledger

## Accomplishments
- Re-derived slice E's four-bucket population directly from the corpus (`grep -oE` occurrence counts) against exactly the plan's 22-file `files_modified` list, confirming all 22 present on disk before measuring. Both plan-cited controls (`KnowledgeGraph.tsx` hex=1, `Capabilities.tsx` violet=2) proven non-zero before trusting any zero.
- Converted all 10 palette + 1 hex occurrences via per-file, role-based adjudication across `doccomments/` (raised popover -> `bg-popover`, hover row -> `surface-3`, ink -> `foreground`/`muted-foreground`), `KnowledgeGraph.tsx` (3D-fallback container hex -> `bg-background`; legend swatch -> `border-muted-foreground/50`), and `ToolGalaxy.tsx` (vignette gradient's brightest stop -> `surface-3`, `via-`/`to-` stops correctly left out of hex-bucket scope).
- Confirmed `DashboardLayout.tsx` -- the plan's own named highest-blast-radius file, the app shell every route renders inside -- needed **zero** palette/hex conversions against the live tree, contradicting the plan's speculative framing; its only real work was 5 motion sites.
- Converted all 30 motion occurrences (29 live classes across 12 files + 1 comment-text mention updated for consistency) to `duration-{fast,normal,slow} ease-house`, including two `>=400ms` sites recorded per the audit rule (`QualityDetail.tsx` 500ms, `WhatsApp.tsx` 1000ms -- the phase's largest single reduction).
- Adjudicated both of the slice's violet files to opposite verdicts by tracing the live code: `Memory.tsx`'s `hadLlmSummarizer` chip is a genuine per-record Astridr-memory-operation flag (not a legend) -> `var(--astridr)`, the phase's third real conversion; `Capabilities.tsx`'s `hookType` display is a Claude Code CLI lifecycle vocabulary (confirmed via `convex/schema.ts`'s own inline comment) -> indigo, matching slice C's established precedent for this exact class of finding.
- Route-stability proven, not assumed: `git diff -- src/layouts/DashboardLayout.tsx` contains zero `to=`/`path=`/`href=` changes (grepped and confirmed empty both times the file was touched), `src/lib/navRegistry.ts` never appears in `git diff --name-only`, and the final diff is exactly 10 changed lines matching the 5 motion sites 1:1.
- Zero regressions: `npx tsc --noEmit` and `npm run build` both exit 0 throughout; `npx vitest run` held at 4772 passed / 0 failed (the recorded pre-plan baseline) across two full-suite runs (post-Task-2, post-Task-3).
- Positive proof for the motion conversion: the built stylesheet (`dist/assets/index-DtHO5zZo.css`) contains `.duration-fast{}`, `.duration-normal{}`, `.duration-slow{}`, `.ease-house{}` by fixed-string search, with a bogus `.duration-nonsense-9x7q2{}` control absent.
- Being the LAST slice, no unswept sibling remained to serve as an out-of-slice control -- used the plan's prescribed alternative instead: a BEFORE/AFTER git-blob contrast (pre-Task-3 commit blob vs. working tree) for both the motion and violet buckets, each proven to discriminate (non-zero before, zero after).

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-derive slice E's population and open the ledger** - `f31721bf` (docs)
2. **Task 2: Convert every palette class and hex literal in slice E** - `7f517ec3` (feat)
3. **Task 3: Convert slice E's motion literals and adjudicate its violet sites** - `7350d327` (feat, includes the ledger AFTER-table and adjudication completion)

_No separate plan-metadata commit -- this SUMMARY commit (below) serves that role, per the
orchestrator's shared-artifact-ownership instruction that state/roadmap files are out of scope
for this executor._

## Files Created/Modified
- `sweep-ledgers/122-08-LEDGER.md` - BEFORE/AFTER four-bucket population table (22 rows), matcher controls (proven both at Task 1 and via BEFORE/AFTER git-blob contrast at final verification), and full per-site adjudication for slice E.
- 22 source files (`doccomments/`, `kg/`, `reminders/`, `voice/` component subtrees, `src/layouts/DashboardLayout.tsx`, 13 pages) - every raw palette class, surface hex literal, `duration-NNN` class and raw violet utility converted to the token vocabulary; see the ledger for the per-file role mapping and per-site violet reasoning.

## Decisions Made
- **`Memory.tsx`'s `hadLlmSummarizer` chip converted to `var(--astridr)`, not re-hued.** Traced against the plan's own binary framing ("marking HER memory" vs. "one source among several in a legend") -- this is a single per-record identity flag on Astridr's own memory subsystem, not a multi-hue legend, giving the phase its third genuine `--astridr` conversion.
- **`Capabilities.tsx`'s `hookType` display re-hued to indigo, not converted.** Confirmed via `convex/schema.ts`'s own inline comment that `hookType` names Claude Code's CLI lifecycle vocabulary (`"PreToolUse" | "PostToolUse" | etc.`), a third-party-tool concept -- matching slice C's `OriginBadge.tsx` precedent exactly.
- **`DashboardLayout.tsx` required zero palette/hex work.** The plan's `<interfaces>` text speculated at length about how this file's container/sidebar/header surfaces should map to the token vocabulary; the live tree already used the correct semantic aliases throughout. Recorded as a plan-prose correction, not silently skipped.
- **WarRoom.tsx's retained-motion comment updated alongside its class**, so the explanatory prose describing "why `duration-300` is kept" does not immediately go stale once the value became `duration-slow ease-house`.
- **Two `>=400ms` motion sites recorded per the audit rule** (`QualityDetail.tsx` 500ms, `WhatsApp.tsx` 1000ms) rather than silently collapsed -- the WhatsApp countdown bar is the single largest timing reduction across the whole 143-file sweep.

## Deviations from Plan

None requiring Rule 1-4 classification. Three corrections to the plan's own prose/interfaces text
are documented above and in the ledger (DashboardLayout.tsx's speculative surface-mapping framing
proved false against the live tree; the `--astridr`/legend distinction was resolved by reading the
live semantics rather than guessed from the file name; the comment-text false positive in
`WarRoom.tsx`'s occurrence count) -- all are the plan's own "decide from the code, not from this
sentence" instruction being followed, not defects in the plan's actual task instructions.

## Issues Encountered

One `Edit` tool call against `ForgePage.tsx` failed to match on its first attempt despite the
`old_string` appearing byte-identical to the `Read` output; a second attempt with the identical
string succeeded. No underlying file corruption or encoding issue found (re-read confirmed normal
LF line endings, no trailing whitespace difference); treated as a transient tool retry, not a
defect requiring further investigation, since the second call succeeded cleanly and the resulting
diff is exactly the one-line change intended.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Slice E (22 files: `doccomments/`, `kg/`, `reminders/`, `voice/` subtrees, `src/layouts/`, 13
  pages) is fully token-clean across all four buckets (palette, hex, motion, violet), verified by
  the specific matchers and, since this is the final slice, by a BEFORE/AFTER git-blob contrast
  proving the matchers discriminate rather than returning zero unconditionally.
- **Wave 3 of the 143-file sweep is now complete: 143/143 files across slices A-E (122-04 through
  122-08).** `sweep-ledgers/122-08-LEDGER.md` is a complete, self-contained record (matchers,
  controls, before/after tables, full adjudication) consistent with slices A/B/C/D's format.
- No blockers. `src/index.css` (the token layer) was not touched, per the plan's explicit
  prohibition. No files outside the 22-file slice were touched (confirmed via
  `git diff --name-only f31721bf~1 HEAD` across all three commits in this plan). `.planning/STATE.md`
  and `.planning/ROADMAP.md` were not touched, per the orchestrator's shared-artifact-ownership
  instruction. `git show --stat HEAD` read after each commit -- no unexpected files from a
  concurrent session in any of the three commits.
- `src/layouts/DashboardLayout.tsx`'s only remaining work for this phase's later waves is
  Phase 124's planned shell rebuild (SHELL-01/02) -- this plan's edits were strictly confined to
  the motion bucket (5 sites), with the route/nav-registry surface fully verified untouched, leaving
  a clean, correctly-tokenized base for that later rebuild.
- Plans 122-11 (PageHeader), 122-14/15/16 (MetricCard/state-placeholder migration across pages) can
  now proceed against a fully swept page tier with no surviving raw literals to interfere with their
  own diffs.

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*

## Self-Check: PASSED

- Commit `f31721bf` (Task 1): FOUND in `git log --oneline --all`
- Commit `7f517ec3` (Task 2): FOUND in `git log --oneline --all`
- Commit `7350d327` (Task 3 + ledger completion): FOUND in `git log --oneline --all`
- `sweep-ledgers/122-08-LEDGER.md`: FOUND on disk
- All 22 files in `files_modified`: FOUND on disk
- Population re-check (fresh `git grep -nE`, all four buckets, all 22 files): NONE/NONE/NONE/NONE
