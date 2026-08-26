---
phase: 120-polish-verified-defects
plan: 06
subsystem: ui
tags: [tailwind, accessibility, prefers-reduced-motion, react]

# Dependency graph
requires:
  - phase: 120-01
    provides: hover:scale-[1.01] sweep across 36 files (shared kill-list mechanics this plan follows)
provides:
  - "src/lib/prefersReducedMotion.ts — the sixth reduced-motion predicate implementation in the repo, jsdom-safe by construction, for new gates only"
  - "Full census and classification of all 98 non-test animate-pulse occurrences in the pre-edit tree"
  - "31 decorative pulse sites de-animated (dot kept, animation removed) per D-09"
  - "16 genuinely state-gated pulse sites gated on prefers-reduced-motion per D-11 (15 via the new helper, VoiceControlBar.tsx already gated via a pre-existing motion/react mechanism)"
  - "120-PULSE-TRIAGE.md — the auditable per-site record for Phase 122's TOKEN-03/TOKEN-04"
affects: [122-token-03-motion-tokens, 122-token-04-skeleton-contract]

tech-stack:
  added: []
  patterns:
    - "Consumption-site reduced-motion gating for Record/map-valued className sources (STATUS_RING, tierFlagConfig, stateIcon) — the Record itself is left untouched, the pulse token is stripped or overridden where the value is CONSUMED, not where it's defined"

key-files:
  created:
    - src/lib/prefersReducedMotion.ts
    - src/lib/prefersReducedMotion.test.ts
    - .planning/phases/120-polish-verified-defects/120-PULSE-TRIAGE.md
  modified:
    - src/components/ActiveSessions.tsx
    - src/components/AgentAvatar.tsx
    - src/components/AgentTopology.tsx
    - src/components/BlackboardPanel.tsx
    - src/components/ConnectionPopover.tsx
    - src/components/ConversationTimeline.tsx
    - src/components/CostBreakdown.tsx
    - src/components/DockerPanel.tsx
    - src/components/DriftTimeline.tsx
    - src/components/EventFeed.tsx
    - src/components/GitActivityWidget.tsx
    - src/components/OperatorScoreCard.tsx
    - src/components/PulseChart.tsx
    - src/components/RunTimeline.tsx
    - src/components/TeamStatusCards.tsx
    - src/components/ToolBreakdown.tsx
    - src/components/ToolExecutionPanel.tsx
    - src/components/WarRoomKanbanColumn.tsx
    - src/components/blocks/ThinkingBlock.tsx
    - src/components/brains/BrainHeaderBadge.tsx
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/GlobalSwapModal.tsx
    - src/components/hr/AgentCard.tsx
    - src/components/hr/AgentDetailSheet.tsx
    - src/components/hr/TeamEditor.tsx
    - src/components/hr/WizardShell.tsx
    - src/components/hr/detail/DetailConfigTab.tsx
    - src/components/skills/NewSkillsBanner.tsx
    - src/components/skills/ScopeRail.tsx
    - src/components/skills/SkillCommandDeck.tsx
    - src/components/workspace/WorkspaceMapCanvas.tsx
    - src/pages/HivePage.tsx
    - src/pages/Settings.tsx
    - src/pages/Skills.tsx

key-decisions:
  - "CostBreakdown.tsx:127 reclassified KILL (plan's draft said KEEP+GATE) — animate-pulse applied to BOTH branches of the isRunaway ternary, unconditional per D-09's letter"
  - "workspace/WorkspaceMapCanvas.tsx:270 reclassified KEEP+GATE (plan's draft said KILL) — wrapped in if (payload === undefined) with role=status aria-label=Loading, genuinely state-gated, not decorative"
  - "VoiceControlBar.tsx:125 left unedited despite being in files_modified — already gated via motion/react's useReducedMotion for this exact site, adding the new helper would double-gate and violate the plan's own no-refactor instruction for pre-existing useReducedMotion usage"
  - "ToolExecutionPanel.tsx:144, hr/detail/DetailConfigTab.tsx:62, ToolExecutionPanel.tsx:257(x2) classified KILL — none proposed in the plan's interfaces; static empty-state text / unconditional-across-ternary dots read as decorative, not live signals"
  - "BlackboardPanel.tsx:28 (stateIcon.running), CostBreakdown.tsx:69 (tierFlagConfig OPUS WORKER), DockerPanel.tsx:52 (refreshing), DriftTimeline.tsx:140 (isDrifting), RunTimeline.tsx:77 (showThinking), TeamStatusCards.tsx:91 (team.status===active) classified KEEP+GATE — none proposed in the plan's interfaces, found via full re-derivation of the 47-site population and gated"
  - "A fifth pre-existing reduced-motion hand-copy found (reminders/ReminderList.tsx's usePrefersReducedMotion hook), beyond the four the plan's interfaces named — recorded for Phase 122's TOKEN-03"

patterns-established:
  - "Consumption-site gating for Record-valued classNames: strip animate-pulse via .replace(/\\s*animate-pulse/, \"\") at the point of use, or cloneElement for pre-built JSX Record values, leaving the Record definition itself untouched"

requirements-completed: [POLISH-01]

# Metrics
duration: ~70min
completed: 2026-08-17
---

# Phase 120 Plan 06: Pulse Dot Triage & Reduced-Motion Gating Summary

**Full census and classification of all 47 non-skeleton `animate-pulse` sites in the app — 31 decorative dots de-animated per D-09, 16 genuine activity signals gated on `prefers-reduced-motion` per D-11 (15 via a new shared jsdom-safe predicate, 1 already compliant via a pre-existing mechanism) — with every disagreement from the plan's own draft classification and every site the plan's draft never named recorded in `120-PULSE-TRIAGE.md`.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-08-17T18:16:55Z
- **Tasks:** 4 (all complete)
- **Files modified:** 33 existing files + 2 new (`src/lib/prefersReducedMotion.ts`, `.test.ts`) + 1 new triage doc = 36

## Accomplishments

- Re-derived the full `animate-pulse` population from scratch (127 all-files / 98 non-test occurrences
  before edits, matching the orchestrator's independent pre-dispatch measurement of 98/59 exactly) rather
  than trusting the plan's quoted 47-site list, and found the population actually needed classifying
  against **every** occurrence, not just the ones the plan's `<interfaces>` proposed a verdict for.
- Created `src/lib/prefersReducedMotion.ts`, byte-identical in logic to the in-repo `ReadinessPill.tsx`
  precedent, proven jsdom-safe with both the `matchMedia`-undefined case (the load-bearing behavior) and
  a `matches: true` control that proves the predicate isn't hardwired to `false`.
- De-animated 31 unconditional decorative pulse sites (dot element kept, `animate-pulse` token removed)
  across 24 files, preserving every co-located glow/shadow class per D-01.
- Gated 16 genuinely state-gated pulse sites across 15 files on the new predicate — including 6 sites
  the plan's own draft never classified at all (found only by re-reading every occurrence's surrounding
  conditional), plus 2 Record-consumption-site gates (`AgentAvatar.STATUS_RING`,
  `CostBreakdown.tierFlagConfig`) and 1 `cloneElement`-based Record gate (`BlackboardPanel.stateIcon`).
- Corrected two of the plan's own draft classifications after reading the live code
  (`CostBreakdown.tsx:127` KEEP+GATE→KILL, `WorkspaceMapCanvas.tsx:270` KILL→KEEP+GATE), each documented
  with reasoning in the triage doc.
- Found a fifth pre-existing hand-copy of the reduced-motion predicate
  (`reminders/ReminderList.tsx`'s `usePrefersReducedMotion` hook) that the plan's `<interfaces>` section
  did not know about — a qualitatively richer implementation (live `matchMedia` change listener) worth
  flagging for Phase 122's TOKEN-03 consolidation decision.
- Ran the required observed-flip control: a scratch test stubbing `window.matchMedia` to
  `matches: true` confirmed a gated component (`ThinkingBlock`) renders WITHOUT `animate-pulse`, and the
  paired control (`matches: false`) confirmed it renders WITH it — proving the gate is real, not merely
  present in source. Scratch test deleted after the run.
- Zero test regressions: 336 files / 4689 tests passed both before and after (baseline 335/4684 + 5 new
  tests in `prefersReducedMotion.test.ts`). `BrainHeaderBadge.test.tsx`, the named tripwire, passed 31/31
  both before and after this plan's edits, unedited.

## Task Commits

Per the orchestrator override: **no commits were made by this executor.** All work is left uncommitted in
the working tree; the orchestrator commits with explicit paths after this SUMMARY is returned.

## Files Created/Modified

- `src/lib/prefersReducedMotion.ts` — the shared predicate, mirrors `ReadinessPill.tsx:39-41`
- `src/lib/prefersReducedMotion.test.ts` — 5 tests: undefined-matchMedia (load-bearing), matches:false,
  matches:true (control), never-throws, window-undefined (SSR)
- 33 component/page files — see per-site classification and reasoning in `120-PULSE-TRIAGE.md` §2-3
- `.planning/phases/120-polish-verified-defects/120-PULSE-TRIAGE.md` — full census, classification table,
  judgment calls, out-of-scope citations, and TOKEN-03/TOKEN-04 handoff

## Decisions Made

See `key-decisions` in frontmatter above and `120-PULSE-TRIAGE.md` §3 for full reasoning on each. In
summary: two disagreements with the plan's own draft classifications (both corrected after reading live
code, both documented at the edit site with a comment), one deliberate non-edit of a file in
`files_modified` (VoiceControlBar.tsx, already compliant via a different legitimate mechanism), and six
additional KEEP+GATE sites the plan's `<interfaces>` never classified at all, found via full re-derivation
of the population rather than trusting the plan's own count.

## Deviations from Plan

### Auto-fixed / Rule-1-adjacent corrections (classification disagreements, not bugs — Rule 4 does not
apply since these are readings of an existing rule, not architectural changes)

**1. CostBreakdown.tsx:127 — reclassified from the plan's proposed KEEP+GATE to KILL**
- **Found during:** Task 2/3 boundary (re-reading Population C before editing)
- **Issue:** The plan's `<interfaces>` draft proposed gating this site. Reading the code showed
  `animate-pulse` applies unconditionally across BOTH branches of the `isRunaway` ternary — only the dot
  color changes, not whether it pulses.
- **Fix:** De-animated instead of gated; documented the disagreement inline with a comment citing
  `120-PULSE-TRIAGE.md` §3.
- **Files modified:** `src/components/CostBreakdown.tsx`
- **Verification:** `npx tsc --noEmit` clean; full `npx vitest run` clean (336 files / 4689 tests)

**2. workspace/WorkspaceMapCanvas.tsx:270 — reclassified from the plan's proposed KILL to KEEP+GATE**
- **Found during:** Task 2 (reading Population C before editing)
- **Issue:** The plan's draft called this ring loader "decorative". Reading the code showed it is wrapped
  in `if (payload === undefined)` with `role="status" aria-label="Loading workspace map"` — a genuine
  loading-state indicator, not decorative, and not literally matching D-10's skeleton shape (border-only,
  no neutral fill).
- **Fix:** Gated instead of de-animated.
- **Files modified:** `src/components/workspace/WorkspaceMapCanvas.tsx`
- **Verification:** Same as above.

**3. VoiceControlBar.tsx:125 — left unedited (file was in `files_modified` and Task 3's file list)**
- **Found during:** Task 3
- **Issue:** This site already reads `shouldReduce` from `motion/react`'s `useReducedMotion()` inside
  `case "reconnecting":`, already correctly satisfying D-11 for this exact pulse. The plan's Task 3 text
  explicitly forbids introducing the new helper alongside a pre-existing `useReducedMotion` usage
  ("mixing the two would be a refactor").
- **Fix:** No edit. Documented in `120-PULSE-TRIAGE.md` §3 item 3, including the resulting genuine
  tension with Task 3's own acceptance criterion ("all ten files contain `prefersReducedMotion`") — 9 of
  10 satisfy it via the new helper, the tenth via a pre-existing, equally legitimate mechanism.
- **Files modified:** none
- **Verification:** Confirmed via source read that the site is genuinely gated (`shouldReduce ? "...bg-(--status-warn)" : "...bg-(--status-warn) animate-pulse"`).

**4-9. Six additional KEEP+GATE sites gated that the plan's `<interfaces>` never proposed a classification
for at all** (`ToolExecutionPanel.tsx:144`, `hr/detail/DetailConfigTab.tsx:62`,
`ToolExecutionPanel.tsx:257`×2 — all classified KILL; `BlackboardPanel.tsx:28`, `CostBreakdown.tsx:69`,
`DockerPanel.tsx:52`, `DriftTimeline.tsx:140`, `RunTimeline.tsx:77`, `TeamStatusCards.tsx:91` — all
classified KEEP+GATE)
- **Found during:** Task 2 (full re-derivation of the 47-site population via unfiltered `git grep`,
  rather than iterating only over the plan's own named list)
- **Issue:** The plan's own instruction ("D-09 says 'and siblings found by the same shape,' so the
  remaining 28 are in scope and must each be classified") applied to more sites than `<interfaces>`
  itself enumerated — the plan's own draft list undercounted its own population.
- **Fix:** Classified each by reading the surrounding conditional (see reasoning per-site in
  `120-PULSE-TRIAGE.md` §2-3), then edited per its classification.
- **Files modified:** listed above.
- **Verification:** Same tsc/vitest run as above; no regressions.

---

**Total deviations:** 9 documented (2 reclassifications, 1 deliberate non-edit, 6 additional
classifications). **Impact on plan:** All are readings of D-09's stated rule applied more thoroughly than
the plan's own draft did, not scope changes — every edit stays within the file boundaries the plan already
declared in `files_modified`. No scope creep; no file outside `files_modified` was touched.

## Issues Encountered

None blocking. The counting-discipline warning in the dispatch (grep -c counts lines not occurrences,
emits path:0 for every scanned file) was heeded throughout — every count in this SUMMARY and the triage
doc uses `git grep -oF ... | wc -l` for occurrences or `git grep -lF ... | wc -l` for files, stated
explicitly which unit is being reported.

## User Setup Required

None — no external service configuration required.

## Verification Evidence (literal output)

**tsc:**
```
$ npx tsc --noEmit
(no output, exit 0)
```

**Full test suite, run twice (after Task 1 alone, and again after all edits):**
```
$ npx vitest run
 Test Files  336 passed | 17 skipped (353)
      Tests  4689 passed | 197 todo (4886)
```
Baseline stated in dispatch: 335 files / 4684 tests passing, 0 failing. Delta: +1 file / +5 tests, exactly
matching the new `src/lib/prefersReducedMotion.test.ts` (5 tests). **0 failing, both runs, identical.**

**Tripwire test, before and after:**
```
$ npx vitest run src/components/brains/BrainHeaderBadge.test.tsx   # BEFORE any edit
 Test Files  1 passed (1)
      Tests  31 passed (31)

$ npx vitest run src/components/brains/BrainHeaderBadge.test.tsx   # AFTER all edits
 Test Files  1 passed (1)
      Tests  31 passed (31)
```
Identical pass count, file unedited between runs except the gate added to its own two dots (which did not
change the test's assertions or outcome).

**Observed-flip control (Task 3 requirement):**
A scratch test file (`src/lib/__scratch-flip-control.test.tsx`, deleted after this run) rendered
`ThinkingBlock` with `streaming={true}` under two stubbed `window.matchMedia` conditions:
```
$ npx vitest run src/lib/__scratch-flip-control.test.tsx
 Test Files  1 passed (1)
      Tests  2 passed (2)
```
- `matches: true` → rendered dot's className did NOT contain `animate-pulse` (gate suppressed it)
- `matches: false` (control) → rendered dot's className DID contain `animate-pulse` (default motion allowed)

This is a real, observed flip of rendered output — not inferred from reading the source — satisfying the
plan's requirement that "a VISUAL check cannot substitute, because `src/index.css`'s global
reduced-motion rule stops the animation either way."

**D-10 negative assertion (no skeleton touched):**
```
$ git diff -- src | grep -E '^\+' | grep 'animate-pulse' | grep -E 'bg-muted|bg-gray-|bg-zinc-|bg-white/'
NONE FOUND (clean)
```

**Population A control (dots survived, not deleted):**
```
$ git grep -cF 'rounded-full bg-primary' -- <8 Population A files>
ActiveSessions.tsx:1  AgentTopology.tsx:2  BlackboardPanel.tsx:1  ConversationTimeline.tsx:1
DockerPanel.tsx:1  DriftTimeline.tsx:1  EventFeed.tsx:1  GitActivityWidget.tsx:1
```
All present — no header dot was deleted, only de-animated, per D-09's "de-animate, not remove."

**D-01 glow control:**
```
$ git grep -cF 'shadow-[var(--glow-xs)]' -- ToolExecutionPanel.tsx WarRoomKanbanColumn.tsx hr/WizardShell.tsx
ToolExecutionPanel.tsx:3  WarRoomKanbanColumn.tsx:2  hr/WizardShell.tsx:3
```
Unchanged from before this plan's edits — every glow survived.

**Scope control (no file outside `files_modified`):**
```
$ git status --short
```
33 `src/` files matching `files_modified` exactly (minus `VoiceControlBar.tsx`, deliberately unedited —
see Deviation #3), plus 2 new `src/lib/` files. `.planning/STATE.md` also shows modified in `git status`
— per the executor dispatch's explicit instruction, this is a concurrent session's change, not this
plan's; it was not read as ground truth, not edited, and is excluded from this plan's scope entirely.

## Known Stubs

None. This plan removes decoration and adds accessibility gating; it introduces no new data-fetching
surface, no placeholder values, and no "coming soon" text.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change was introduced. The one
trust boundary named in the plan's own threat model (OS accessibility preference → rendered animation) is
addressed by the verification evidence above (the observed-flip control and the jsdom-safety tests).

## Next Phase Readiness

- Every surviving pulse in the app is now gated on `prefers-reduced-motion`, satisfying D-11 ahead of
  Phase 122's TOKEN-03 audit — that audit can assert on className rather than re-discovering these sites.
- `120-PULSE-TRIAGE.md` §5 hands TOKEN-03 the corrected duplication count (5 pre-existing hand-copies, not
  4) and the verification caveat (visual checks carry no information here — assert on className).
- `120-PULSE-TRIAGE.md` §5 also flags two ambiguous loading-state sites
  (`WorkspaceMapCanvas.tsx:270`, `ToolExecutionPanel.tsx:144`/`DetailConfigTab.tsx:62`) for TOKEN-04 to
  decide whether they belong in the unified skeleton/loading-state contract.
- No blockers for the rest of Phase 120's remaining plans or Phase 122.

---
*Phase: 120-polish-verified-defects*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `src/lib/prefersReducedMotion.ts`
- FOUND: `src/lib/prefersReducedMotion.test.ts`
- FOUND: `.planning/phases/120-polish-verified-defects/120-PULSE-TRIAGE.md`
- FOUND: `.planning/phases/120-polish-verified-defects/120-06-SUMMARY.md` (this file)
- CONFIRMED: `src/lib/__scratch-flip-control.test.tsx` (Task 3's observed-flip control) was deleted after
  its run — not present in the working tree.
- No commit hashes to verify — per the executor dispatch's `CRITICAL_COMMIT_OVERRIDE`, this plan made
  zero commits; all work is uncommitted in the working tree for the orchestrator to commit.
- `git status --short` reflects exactly the 33 `files_modified` src files this plan edited (minus
  `VoiceControlBar.tsx`, deliberately unedited per Deviation #3) plus the 2 new `src/lib/` files; no file
  outside this plan's declared scope was touched by this executor.
