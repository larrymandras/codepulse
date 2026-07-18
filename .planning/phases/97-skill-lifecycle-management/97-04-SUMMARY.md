---
phase: 97-skill-lifecycle-management
plan: 04
subsystem: ui
tags: [react, shadcn, house-honesty, copywriting, intake]

# Dependency graph
requires:
  - phase: 97-skill-lifecycle-management (plans 01-03)
    provides: real daemon write path + Convex refusal-reason adapter (row.error house copy)
provides:
  - Install-language copy across the intake surface (IntakeModal, IntakeSheet, SkillCollectionPicker)
  - D-06-compliant fan-out confirm surface ("Cancel Install", explicit-click-only submit)
  - D-07-compliant failed/collision copy rendering (row.error rendered verbatim, no redundant prefix)
affects: [97-05, 97-06, any future intake-surface UI work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dry-run→real-write copy migration: grep-gated literal-string sweep across a bounded file set, verified with an acceptance-criteria grep count of 0"
    - "Presentational framing vs. message content split: IntakeSheet owns only the label wrapper, the Convex adapter (Plan 05) owns the actionable message text baked into row.error"

key-files:
  created: []
  modified:
    - src/components/skills/IntakeModal.tsx
    - src/components/skills/IntakeModal.test.tsx
    - src/components/skills/IntakeSheet.tsx
    - src/components/skills/IntakeSheet.test.tsx
    - src/components/skills/SkillCollectionPicker.tsx
    - src/components/skills/SkillCollectionPicker.test.tsx

key-decisions:
  - "Footer real-write disclosure ('Installs to the selected host and destination.') stays always-visible (not greyed/omitted pre-destination) — simplest consistent application of the UI-SPEC's either-is-acceptable clause"
  - "IntakeSheet's failed-row paragraph renders row.error with no 'Failed:' prefix — the RowStatusBadge chip beside it already carries that label, avoiding redundant text"
  - "Also fixed the adjacent 'start the Forge daemon to validate skills' host-empty message in IntakeModal.tsx (in-file, same house-honesty concern as the plan's explicit targets, not gated by the literal grep pattern but same T-97-10 threat)"

patterns-established:
  - "Global find-and-replace obligation verified via repo-wide grep post-task, not just the plan's named files — surfaced one out-of-scope hit (Skills.tsx) logged to deferred-items.md rather than fixed"

requirements-completed: [INTAKE-01, INTAKE-02, INTAKE-04]

# Metrics
duration: 25min
completed: 2026-07-18
---

# Phase 97 Plan 04: Install-Language Copy Correction Summary

**Replaced all dry-run "Validate skill" / "Validation only — nothing is written" copy across IntakeModal, IntakeSheet, and SkillCollectionPicker with install-language copy, satisfying the D-06 confirm-first and D-07 actionable-error contracts.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-18T10:53:00Z (approx, session start)
- **Completed:** 2026-07-18
- **Tasks:** 2/2 completed
- **Files modified:** 6 (3 components + 3 test files)

## Accomplishments

- `IntakeModal.tsx`: DialogTitle, submit-button (single + batch, idle + loading variants), and footer note now use install language; fan-out Cancel button renamed to "Cancel Install" (D-06 — names the action being cancelled, never bare "Cancel")
- `SkillCollectionPicker.tsx`: multi-skill heading updated to "{N} skills found at this path"
- `IntakeSheet.tsx`: empty-state body references the renamed "Install skill" CTA; failed-row branch now renders `row.error` verbatim with no redundant "Failed:" prefix, ready to receive Plan 05's kind-accurate house copy (collision / generic-refused-with-"Nothing was written." / exit-8-9 post-placement warning) without this component re-interpreting or re-wrapping the message
- Confirmed the D-06 confirm-first invariant is preserved: `SkillCollectionPicker`'s checkbox list never auto-submits — `enqueueIntake` only fires from `IntakeModal`'s explicit submit-button click (verified by the existing/updated batch-submit tests)
- Repo-wide grep sweep for `"Validate skill"`, `` `Validate ${...} skills` ``, `"Validation only"` confirms 0 remaining occurrences in the three plan-scoped files

## Task Commits

1. **Task 1: Install-language CTA + fan-out confirm copy in IntakeModal / SkillCollectionPicker** - `04453f8` (feat)
2. **Task 2: IntakeSheet empty-state + actionable failed/collision copy** - `e0e553a` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/components/skills/IntakeModal.tsx` — DialogTitle, submit button (×4 copy sites), footer note, Cancel button, and the offline-host empty message now use install language
- `src/components/skills/IntakeModal.test.tsx` — assertions updated to `/install skill/i`, `/install N skills/i`; added a "Cancel Install" render test and a real-write-disclosure test
- `src/components/skills/SkillCollectionPicker.tsx` — multi-skill heading copy updated
- `src/components/skills/SkillCollectionPicker.test.tsx` — heading assertions updated to match
- `src/components/skills/IntakeSheet.tsx` — empty-state body + failed-row rendering updated
- `src/components/skills/IntakeSheet.test.tsx` — empty-state, failed-row, and new collision-copy regression tests updated/added

## Decisions Made

- Footer disclosure text kept always-visible (not conditionally greyed pre-destination) for the simplest consistent implementation, per the UI-SPEC's "Claude's discretion, pick one" clause.
- `IntakeSheet`'s failed-row text drops the old `Failed: ` prefix entirely rather than keeping it alongside `row.error` — the visible `RowStatusBadge` chip immediately to the left already reads "Failed", so a second textual "Failed:" would be redundant, and the plan explicitly scopes this component to "presentational framing... not the message content."
- Fixed one additional in-file dry-run string in `IntakeModal.tsx` ("start the Forge daemon to validate skills" → "...to install skills") beyond the plan's named copy sites — same house-honesty threat (T-97-10) as the explicitly-targeted strings, discovered by reading the full file before editing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical / House-Honesty Completeness] Fixed adjacent dry-run string not explicitly named in the plan's interfaces list**
- **Found during:** Task 1 (reading `IntakeModal.tsx` in full before editing)
- **Issue:** `IntakeModal.tsx` L329's "No hosts online — start the Forge daemon to validate skills." was not in the plan's interfaces list (which named only DialogTitle/footer/submit-button/Cancel), but it is the same class of dry-run string the plan's `must_haves.truths` mandates removing ("Every dry-run string... is replaced with install-language copy... keeping 'Validate' would be a false-success framing violation"), and it lives in the same file already being edited.
- **Fix:** Changed "to validate skills" → "to install skills".
- **Files modified:** `src/components/skills/IntakeModal.tsx`
- **Verification:** Repo-wide case-insensitive grep for "validate" in this file now returns 0 matches; existing tests unaffected (no test asserted this string).
- **Committed in:** `04453f8` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** In-scope, in-file, same threat mitigation (T-97-10) as the plan's explicit targets. No scope creep beyond the three named files.

## Out-of-Scope Discovery (logged, not fixed)

Repo-wide grep after both tasks found one additional site outside this plan's file scope: `src/pages/Skills.tsx:225` still renders `<Button onClick={() => setIntakeModalOpen(true)}>Validate skill</Button>` — the page-level button that opens `IntakeModal`. Since `IntakeModal`'s own copy is now "Install skill", the button that launches it and the dialog it opens now disagree. `Skills.tsx` was not in this plan's `files_modified` and the executor's EXECUTION_NOTES explicitly restricted edits to `IntakeModal.tsx`/`IntakeSheet.tsx`/`SkillCollectionPicker.tsx` (+ tests) — so this was **not fixed** here. Logged to `.planning/phases/97-skill-lifecycle-management/deferred-items.md` for a follow-up quick fix.

## Issues Encountered

None — all tasks executed as specified, verification commands passed on first run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- IntakeModal/IntakeSheet/SkillCollectionPicker are house-honest and ready to display real daemon outcomes once Plan 05's Convex adapter starts populating `row.error` with kind-accurate copy (collision / generic-refused / post-placement-warning) — `IntakeSheet`'s failed branch already renders that field verbatim with no wrapper to strip or reinterpret.
- **Blocker/follow-up for a future plan:** `src/pages/Skills.tsx:225`'s "Validate skill" button should be updated to "Install skill" to match the modal it opens (see Out-of-Scope Discovery above and `deferred-items.md`).

---
*Phase: 97-skill-lifecycle-management*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: src/components/skills/IntakeModal.tsx
- FOUND: src/components/skills/IntakeSheet.tsx
- FOUND: src/components/skills/SkillCollectionPicker.tsx
- FOUND: .planning/phases/97-skill-lifecycle-management/97-04-SUMMARY.md
- FOUND: commit 04453f8
- FOUND: commit e0e553a
