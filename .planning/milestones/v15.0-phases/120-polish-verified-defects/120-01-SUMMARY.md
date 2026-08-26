---
phase: 120-polish-verified-defects
plan: 01
subsystem: ui
tags: [tailwind, css, polish, kill-list, motion]

requires: []
provides:
  - "hover:scale-[1.01] and its paired orphaned transition-transform duration-300 removed from 36 files"
  - "The two legitimate lift-card exceptions (CatalogCard, TeamCard) documented in-code with a D-01 comment"
  - "120-SWEEP-EVIDENCE.md — the file-scoped evidence and residual-count attribution POLISH-01's phase-level 'zero hits' claim will be assembled from"
affects: [120-03, 120-05, 122]

tech-stack:
  added: []
  patterns:
    - "Per-line class-string transformation script (scratchpad Python, not committed to repo) driven by an explicit competing-transform check rather than a blind two-token delete"

key-files:
  created:
    - .planning/phases/120-polish-verified-defects/120-SWEEP-EVIDENCE.md
  modified:
    - src/pages/Analytics.tsx
    - src/pages/Dashboard.tsx
    - src/pages/Dreaming.tsx
    - src/pages/MeetingBot.tsx
    - src/pages/Memory.tsx
    - src/pages/Infrastructure.tsx
    - src/pages/HivePage.tsx
    - src/pages/Quality.tsx
    - src/pages/GraphsHub.tsx
    - src/pages/ForgePage.tsx
    - src/pages/WhatsApp.tsx
    - src/pages/hr/AgentAnalytics.tsx
    - src/pages/hr/Teams.tsx
    - src/pages/hr/Roster.tsx
    - src/pages/hr/Catalog.tsx
    - src/components/CallStatsBar.tsx
    - src/components/CallGraphPanel.tsx
    - src/components/OperatorScoreCard.tsx
    - src/components/ToolExecutionPanel.tsx
    - src/components/AgentTopology.tsx
    - src/components/ToolBreakdown.tsx
    - src/components/MetricCard.tsx
    - src/components/GitActivityWidget.tsx
    - src/components/FactsTable.tsx
    - src/components/EventFeed.tsx
    - src/components/DriftTimeline.tsx
    - src/components/DockerPanel.tsx
    - src/components/CommandTryItForm.tsx
    - src/components/AgentVoiceCard.tsx
    - src/components/ActiveSessions.tsx
    - src/components/hr/TeamEditor.tsx
    - src/components/hr/WizardShell.tsx
    - src/components/hr/TeamCard.tsx
    - src/components/hr/CatalogCard.tsx
    - src/components/hr/CatalogBrowser.tsx
    - src/components/forge/ForgeMetadataPanel.tsx

key-decisions:
  - "D-01 kill-list removal was mechanical for 34 of 36 files: every hover:scale-[1.01] line in those files carried no competing transform utility, so scale + its paired transition-transform duration-300 were both removed with no per-line judgment calls needed."
  - "CatalogCard.tsx and TeamCard.tsx keep transition-transform duration-300 because hover:-translate-y-1 (a lift, not a scale, not on the kill list) still needs it — documented with an inline D-01 comment above each returned element."
  - "The residual 3 hover:scale-[1.01] hits (WarRoom.tsx x2, HeroStatsBar.tsx x1) are correctly NOT zero after this plan — they belong to 120-03 and 120-05, recorded and attributed in 120-SWEEP-EVIDENCE.md rather than silently left unexplained."

requirements-completed: [POLISH-01]

duration: 45min
completed: 2026-08-17
---

# Phase 120 Plan 01: Kill-List Scale/Transition Sweep Summary

**Removed `hover:scale-[1.01]` and its now-orphaned `transition-transform duration-300` from 105
occurrences across 34 mechanical files plus 2 special-cased lift-card files (CatalogCard, TeamCard),
leaving the 3 hits in plan-120-03/120-05-owned files as an honestly-recorded residue.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 completed
- **Files modified:** 36 source files + 1 new evidence artifact (37 paths total)

## Accomplishments

- Re-measured the population independently before editing (110 `hover:scale-[1.01]` / 38 files,
  110 `transition-transform duration-300` / 37 files) and confirmed it matched the plan's stated
  numbers exactly.
- Wrote and ran a per-line Python transformation (kept in scratchpad, not committed) that removes
  `hover:scale-[1.01]` unconditionally, then removes the paired `transition-transform duration-300`
  only when no other transform utility (`translate-`, `rotate-`, `skew-`, `group-hover:scale-`, a
  second `scale-`) is present on the same line. Verified beforehand that none of the 34 Task-1
  files' target lines carried a competing transform, so the rule reduced deterministically — no
  ambiguous per-line calls were needed in Task 1.
- Hand-edited the two lift-card exceptions (`CatalogCard.tsx:31`, `TeamCard.tsx:29`), removing only
  the scale token and adding a one-line inline comment above each `return (` explaining why
  `transition-transform duration-300` survives (D-01: it still animates the surviving
  `hover:-translate-y-1`).
- Verified `transition-all duration-300` is untouched on all 8 named sites (`MetricCard.tsx:1`,
  `Quality.tsx:1`, `AgentAnalytics.tsx:4` — counts confirmed via `git grep -cF`), and that
  `glow-card` is byte-identical before/after both at whole-repo scope (38 → 38) and scoped to the
  34 Task-1 files (20 → 20).
- Wrote `.planning/phases/120-polish-verified-defects/120-SWEEP-EVIDENCE.md` with raw command
  output for all four required evidence items, explicitly naming the residual 3 hits and the
  owning plans (120-03, 120-05) so the phase-level "zero hits" claim is assembled from evidence,
  not assumed.

## Task Commits

**Not committed.** Per this plan's `<output>` section and the orchestrator's explicit override,
this is a shared checkout on `master` with concurrent sessions — the orchestrator owns every commit
for this phase. All 36 modified files plus the new `120-SWEEP-EVIDENCE.md` and this SUMMARY.md are
left uncommitted in the working tree. `.planning/STATE.md` shows as modified in `git status` but
was **not** touched by this plan — that change belongs to a concurrent session and was left alone.

## Files Created/Modified

- `.planning/phases/120-polish-verified-defects/120-SWEEP-EVIDENCE.md` — the plan-owned evidence
  artifact: before/after counts, residual attribution, survivor justification table, and the two
  discrepancies logged below.
- 34 files (Task 1) — `hover:scale-[1.01]` and its paired `transition-transform duration-300`
  removed; `glow-card`, `shadow-[var(--glow-*)]`, `hover:border-primary/50`, and `transition-all`
  left byte-identical.
- `src/components/hr/CatalogCard.tsx`, `src/components/hr/TeamCard.tsx` (Task 2) — scale removed,
  `transition-transform duration-300` retained for the surviving `hover:-translate-y-1` lift, plus
  a one-line D-01 inline comment on each.

## Decisions Made

- Followed the plan's per-line rule (D-01/D-02 restraint: enumerated tokens only, no refactor) as
  written. No new decisions were required beyond what the plan and CONTEXT.md already locked.
- Where the plan's line numbers had shifted in this shared checkout (expected per the plan's own
  `<output>` warning), located every target by content (`git grep -nF`) rather than by the cited
  line number, and the content matched exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Self-inflicted grep false-negative in the D-01 inline comments**
- **Found during:** Task 2 acceptance verification (`git grep -cF 'hover:scale-[1.01]' -- CatalogCard.tsx TeamCard.tsx`)
- **Issue:** The first draft of the inline D-01 comments above `CatalogCard`'s and `TeamCard`'s
  `return (` used the literal string `hover:scale-[1.01]` in prose ("D-01: hover:scale-[1.01]
  removed..."). That literal string satisfied the fixed-string grep used as this task's own
  acceptance criterion, so the check returned 1 for each file instead of the required 0 — a
  self-authored false positive on the exact class of check the plan warns about (fixed-string
  matching a literal that also appears in a comment).
- **Fix:** Reworded both comments to describe the change without repeating the literal class token
  ("the kill-list scale-on-hover transform was removed... the transition-transform utility below
  stays... translate-based lift-on-hover").
- **Files modified:** `src/components/hr/CatalogCard.tsx`, `src/components/hr/TeamCard.tsx`
- **Verification:** Re-ran `git grep -cF 'hover:scale-[1.01]' -- CatalogCard.tsx TeamCard.tsx` —
  now returns 0 (exit code 1, no output) for both.

**2. [Rule 1 - Bug] Dropped closing `>` while editing TeamCard.tsx**
- **Found during:** Task 2, immediately after the Edit tool call, via a direct re-read of the file.
- **Issue:** The `old_string`/`new_string` pair used to remove `hover:scale-[1.01]` from
  `TeamCard.tsx`'s wrapper `<div>` was cut at the closing `"` and did not include the trailing `>`
  that closes the JSX tag, so the edit silently dropped the `>` and left the tag open into the next
  line.
- **Fix:** Applied a second targeted Edit restoring the `>` on the same line.
- **Files modified:** `src/components/hr/TeamCard.tsx`
- **Verification:** `npx tsc --noEmit` (exit 0) after the fix; re-read the file directly and
  confirmed the tag closes correctly.

### Stale-Plan Discrepancy (not a code defect — recorded per plan_authority instructions)

**`CatalogCard.tsx`'s `hover:-translate-y-1` scoped count is 2, not the plan's expected 1.** The
plan's Task 2 acceptance criteria expected
`git grep -cF 'hover:-translate-y-1' -- CatalogCard.tsx TeamCard.tsx` to return 1 for each file.
`CatalogCard.tsx` actually contains a second, unrelated `hover:-translate-y-1` at line 80 — an "add
new" placeholder card that was never part of the `hover:scale-[1.01]` population (it has no
`transition-transform` at all) and is untouched by this plan's diff. Verified via
`git diff src/components/hr/CatalogCard.tsx`, which shows no hunk touching that region, and via
`git grep -nF 'hover:-translate-y-1' -- CatalogCard.tsx` showing both lines (`:31` — the edited
card, still carrying the lift; `:80` — the unrelated pre-existing card). This is a stale expected
count in the plan's acceptance criteria, not a defect in the sweep; recorded in
`120-SWEEP-EVIDENCE.md` §4 as well.

## Verification Output (literal)

```
$ npx tsc --noEmit
(exits 0, no output)

$ npx vitest run
 Test Files  332 passed | 17 skipped (349)
      Tests  4654 passed | 197 todo (4851)

$ npx vitest run src/components/hr
 Test Files  2 passed | 5 skipped (7)
      Tests  8 passed | 26 todo (34)
```

No test file in the repo references either `hover:scale-[1.01]` or `transition-transform` as a
literal string (`git grep -lF` against `*.test.tsx`/`*.test.ts` returns nothing for both), so the
0-failed/0-new-failures result above is equivalent to the pre-edit baseline — a pre-edit vitest run
was not separately captured (no `git stash` was used, per the destructive-git-prohibition and this
plan's shared-checkout constraint), but the absence of any test assertion on these class strings
makes the post-edit 4654-passed/0-failed result dispositive.

```
$ git grep -cF 'hover:scale-[1.01]' -- <36 files>   → 0 (both tasks)
$ git grep -cF 'glow-card' -- <34 Task-1 files>     → 20 before, 20 after
$ git grep -cF 'glow-card' -- src/                  → 38 before, 38 after
$ git grep -cF 'transition-all duration-300' -- MetricCard.tsx Quality.tsx AgentAnalytics.tsx
  → 1, 1, 4 (unchanged)
$ git diff --stat -- src/   → 34 files, no WarRoom.tsx, no HeroStatsBar.tsx
```

Full raw evidence, including the residual-count attribution and survivor table, is in
`.planning/phases/120-polish-verified-defects/120-SWEEP-EVIDENCE.md`.

## Known Stubs

None. No hardcoded empty data, no placeholder text, no unwired components introduced by this plan
— it only removes Tailwind class-string tokens.

## Threat Flags

None. This plan touches only already-rendered Tailwind class strings in existing components; no
new network surface, auth path, file access pattern, or schema change was introduced.

## Self-Check: PASSED

- FOUND: `.planning/phases/120-polish-verified-defects/120-01-SUMMARY.md`
- FOUND: `.planning/phases/120-polish-verified-defects/120-SWEEP-EVIDENCE.md`
- FOUND: `src/pages/Analytics.tsx`, `src/components/hr/CatalogCard.tsx`,
  `src/components/hr/TeamCard.tsx`, `src/components/MetricCard.tsx` (sample of modified files)
- `git diff --cached --name-only` — empty (nothing staged)
- `git log --oneline -3` — HEAD unchanged from before this plan ran (no commit made by this plan)
