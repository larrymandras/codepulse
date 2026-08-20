---
phase: 123-accessibility-remediation
plan: 07
subsystem: build
tags: [accessibility, tailwind, css, sweep-completeness, ratchet-boundary]

requires: []
provides:
  - "src/index.css: Tailwind's scan root narrowed to scripts/, e2e/, and docs/ (in addition to the pre-existing .planning exclusion), so a sweep-completeness claim about src/ is now also a claim about the shipped stylesheet"
  - "123-SWEEP-BOUNDARY.md: the phase's completeness claim stated in writing -- what the scan-root fix covers, one named unfixable-here residual, the shadow-rgba population re-derived at 21 non-black instances across 12 files (wider than the folded todo's single named site), and why no fifth ratchet bucket is added"
affects: [123-11, 123-12]

tech-stack:
  added: []
  patterns:
    - "Tailwind v4.3.2 requires one @source not directive per excluded path -- a single directive carrying multiple space-separated paths compiles without error but silently excludes nothing (measured, not assumed)"
    - "Build-time canary methodology for proving a directory is/isn't in Tailwind's scan root: place a class using valid arbitrary-value syntax (bg-[#ab12cd]) only in the target directory, grep the built CSS for it. A bare made-up utility name (bg-zzzcanary) is invalid Tailwind syntax and produces no rule regardless of scan root -- caught only because the src/ control also failed to compile it, which is what a discriminating control is for."

key-files:
  created:
    - .planning/phases/123-accessibility-remediation/123-SWEEP-BOUNDARY.md
  modified:
    - src/index.css
    - .planning/todos/pending/tailwind-scans-beyond-src.md (moved to completed/, closed)
    - .planning/todos/pending/shadow-rgba-outside-sweep-buckets.md (moved to completed/, closed)

key-decisions:
  - "Widened the exclusion beyond the plan's named scope (scripts/, conditionally e2e/) to also exclude docs/: a repo-wide git grep for the four ratchet bucket patterns outside .planning/scripts/e2e/src/ found 211 palette-shaped literal occurrences in docs/superpowers/plans/*.md, the identical defect class, confirmed leaking via the same canary methodology and fixed in the same commit rather than deferred."
  - "The plan's chosen verification literal (bg-gray-950/50) cannot reach zero within this plan's own constraints: it is quoted verbatim in a comment at src/tokenSweep.ratchet.test.ts:36 (the ratchet's own docstring, illustrating this exact defect), and that file is explicitly off-limits to this plan (D-17 reserves it for 123-06 alone). Rather than force a false green by silently swapping the probe class, this is documented as a structural residual in 123-SWEEP-BOUNDARY.md, and the exclusion mechanism's correctness is proven instead via a systematic 58-key population sweep of every migrate_tokens.py class (9 remain, all legitimate src/ usages)."
  - "D-08's population was re-derived live rather than carried forward from the folded todo's claim, and is materially wider than the todo's single named SwarmTaskNode.tsx instance: 21 non-black colour-identity rgba-in-shadow occurrences across 12 files. Reported as counted, not adjudicated -- deciding which of the other 11 files' 18 glows are deliberate vs. oversight is remediation, out of D-08's stated scope for this plan."

requirements-completed: []
# A11Y-02 is NOT completed by this plan -- see 123-04-SUMMARY.md's note; this plan closes
# D-07/D-08/D-17 specifically, not the phase-level requirement.

duration: 55min
completed: 2026-08-20
---

# Phase 123 Plan 07: Sweep-completeness boundary -- Tailwind scan root + shadow-rgba/ratchet-scope honesty (D-07/D-08/D-17) Summary

**Narrows Tailwind's scan root to exclude `scripts/`, `e2e/`, and (measured live, beyond the plan's named scope) `docs/` from the production build, proves the fix with a canary methodology plus a 58-key systematic population sweep, and writes down in `123-SWEEP-BOUNDARY.md` the one residual the fix cannot reach and the shadow-rgba population (21 non-black instances across 12 files, not just the one named site) the ratchet structurally cannot see.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-20T12:07:00-04:00 (first file read)
- **Completed:** 2026-08-20T13:02:00-04:00
- **Tasks:** 2
- **Files modified:** 1 source file, 1 new doc, 2 todos closed/moved

## Accomplishments

- Established the BEFORE control with a fixed-string probe: `grep -rlF 'bg-gray-950\/50' dist/assets/*.css | wc -l` returns **1** on a clean `npm run build` from the unmodified `src/index.css`.
- Determined the multi-path directive question empirically (per the plan's explicit instruction not to assume): a single `@source not` directive carrying multiple space-separated paths compiles without error but **silently excludes nothing** -- rebuilding with that form left the leak at 1. Tailwind v4.3.2 requires one directive per path; `src/index.css` now carries four (`.planning`, `scripts`, `e2e`, `docs`).
- Determined the `e2e/` question by measurement, not reasoning, using a build-time canary: `bg-[#ab12cd]` placed only in `e2e/`, confirmed present in `dist/assets/*.css`, confirmed absent once excluded. The first canary attempt (`bg-zzzcanaryxq9`) was invalid Tailwind syntax and produced a false "not scanned" reading for BOTH `e2e/` and the `src/` control -- caught only because the control failed too, which is exactly what a discriminating control is for.
- The same canary methodology, applied while auditing the wider repo for the same defect class, found a leak source the plan never named: `docs/superpowers/plans/*.md` holds 211 occurrences of palette-shaped class-name literals. Fixed in the same commit (Rule 2 -- correctness of the completeness claim this plan exists to make).
- A repo-wide `git grep` for the four ratchet bucket patterns across every tracked path outside `.planning/`, `scripts/`, `e2e/`, `src/`, `docs/` found nothing further -- the population is now fully accounted for among tracked, non-application text.
- Proved the exclusion mechanism against all 58 of `scripts/migrate_tokens.py`'s dict-key class literals individually (not just the one plan-chosen probe class): 9 remain present in the after-build, and all 9 are legitimate `src/`-sourced classes (shadcn semantic tokens used throughout the shell, or `bg-gray-800` with real test-file callers) -- zero are leaks.
- The plan's chosen probe class, `bg-gray-950/50`, does **not** reach zero and cannot within this plan: it is quoted verbatim in a comment at `src/tokenSweep.ratchet.test.ts:36`, illustrating this exact defect as a worked example, and that file is explicitly reserved for plan 123-06 alone (D-17). Reported as a documented structural residual rather than silently declared fixed or worked around by swapping the verification literal.
- Captured full Lightning CSS warning output before and after: 4 -> 3, diffed line-for-line -- no new warning; one pre-existing warning's source lived in a now-excluded directory and stopped firing; the remaining 3 are byte-identical, unrelated, pre-existing.
- Wrote `123-SWEEP-BOUNDARY.md`'s four required sections, quoting the ratchet's four live bucket matchers verbatim (and correcting the plan's own `<interfaces>` paraphrase of `VIOLET_PATTERN`, which omitted `fuchsia` and added a nonexistent `from|to|via` group).
- Re-derived the D-08 shadow-rgba population live rather than trusting the folded todo's claim: 42 total `rgba(...)`-in-`shadow-[...]` occurrences across 23 files, of which 21 (black, `rgba(0,0,0,...)`) are neutral drop-shadows with no palette-colour concern, and 21 across 12 files are genuine colour-identity glows -- materially wider than the todo's single named `SwarmTaskNode.tsx` instance. Named as counted, not adjudicated, per D-08's boundary-not-remediation scope.
- Closed both folded todos with resolution notes pointing at the boundary doc, and moved them to `.planning/todos/completed/` -- checked the repo's actual convention first (`completed/`, not the plan's guessed `done/`) by reading an existing closed todo's frontmatter shape rather than assuming.
- `src/tokenSweep.ratchet.test.ts` left untouched (`git diff --stat` empty for this plan, confirmed); ran its full suite post-change: 13 passed, 2 skipped -- no regression.
- `scripts/migrate_tokens.py` left untouched (`git status --porcelain scripts/` empty).

## Task Commits

1. **Task 1: Narrow the Tailwind scan root and prove the leak is gone** -- `27041b02` (fix)
2. **Task 2: Write the sweep boundary and close the two folded todos** -- `cf7ba737` (docs)

## Files Created/Modified

- `src/index.css` -- 4 `@source not` directives (added scripts/e2e/docs to the pre-existing `.planning` exclusion) plus an explanatory comment documenting the canary methodology and each source's provenance.
- `.planning/phases/123-accessibility-remediation/123-SWEEP-BOUNDARY.md` -- New. Four sections: scan-root evidence + residual, shadow-rgba population, ratchet-scope rationale, what-a-green-suite-proves.
- `.planning/todos/completed/tailwind-scans-beyond-src.md` -- Moved from `pending/`, `status: closed`, resolution note added.
- `.planning/todos/completed/shadow-rgba-outside-sweep-buckets.md` -- Moved from `pending/`, `status: closed`, resolution note added.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: widened the fix to include `docs/` (measured, not named by the plan); documented rather than forced the plan's probe-class residual; re-derived and reported the true, wider D-08 population instead of the todo's undercount.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan-text `VIOLET_PATTERN` paraphrase does not match the live ratchet file**
- **Found during:** Task 2, quoting the four bucket matchers for `123-SWEEP-BOUNDARY.md` § 3
- **Issue:** `123-07-PLAN.md`'s `<interfaces>` comment states the violet matcher as `(bg|text|border|from|to|via)-(violet|purple)-[0-9]{2,3}`. The live `src/tokenSweep.ratchet.test.ts:225` reads `(bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}` -- no `from|to|via`, plus `fuchsia`.
- **Fix:** Quoted the live file verbatim in the boundary doc and noted the plan-text discrepancy explicitly, per plan-authority instructions.
- **Files modified:** `123-SWEEP-BOUNDARY.md` (written correctly from the start)
- **Verification:** Direct read of `src/tokenSweep.ratchet.test.ts:221-225`.
- **Committed in:** `cf7ba737`

**2. [Rule 2 - Missing critical functionality] `docs/` leaks the same defect class the plan named only `scripts/` and `e2e/` for**
- **Found during:** Task 1, while auditing the wider repo for other tracked non-`src/` leak sources after confirming `scripts/`'s exclusion syntax
- **Issue:** `docs/superpowers/plans/*.md` holds 211 palette-shaped class-name literals in historical planning prose, scanned by Tailwind's default root exactly like `scripts/migrate_tokens.py`. Left unfixed, `123-SWEEP-BOUNDARY.md`'s completeness claim (D-07: "either the claim is true or it is explicitly bounded") would have been false -- the document's whole purpose is to prevent exactly this kind of unstated gap.
- **Fix:** Added `@source not "../docs";` in the same commit, proven with the same canary methodology, and documented in the boundary doc's § 1.
- **Files modified:** `src/index.css`
- **Verification:** Canary placed only in `docs/` confirmed present pre-fix, absent post-fix; before/after build pair with known-present control.
- **Committed in:** `27041b02`

**Impact on plan:** Both are scope-honest strengthenings of the plan's own stated purpose, not architectural changes -- no new files, no touched-forbidden-file violations, no dependency added.

### Findings Reported, Not Absorbed (D-08 boundary, D-17 scope)

**The plan's chosen verification literal (`bg-gray-950/50`) cannot reach zero within this plan.** It is quoted verbatim in a comment at `src/tokenSweep.ratchet.test.ts:36`, which this plan is forbidden from editing (D-17 reserves that file for 123-06 alone; `git diff --stat src/tokenSweep.ratchet.test.ts` is confirmed empty). Rather than silently swap the verification literal to something that would read as "0" without being honest about the actual gap, or override the file-touch restriction, this is reported as a named, narrow, structurally out-of-reach residual in `123-SWEEP-BOUNDARY.md` § 1, proven not to indicate a broken exclusion mechanism via the independent 58-key population sweep (9/58 remain, all legitimate).

**The shadow-rgba population (D-08) is 21 instances across 12 files, not the 1 the folded todo named.** All 21 are reported and located; none are adjudicated deliberate-vs-oversight, per D-08's explicit boundary-not-remediation scope for this plan. `123-SWEEP-BOUNDARY.md` § 2 names this as the residual a future phase would need to triage.

## Issues Encountered

None beyond the two documented above (both resolved/reported, neither blocking).

## User Setup Required

None. All measurement ran against local `npm run build` output; no server dependency for this plan's tasks.

## Next Phase Readiness

- `src/index.css`'s scan-root exclusion is now complete against every currently-tracked leak source found by a full repo sweep; no further directories are known to leak as of this measurement.
- `123-SWEEP-BOUNDARY.md` gives 123-11 and 123-12 (the remaining leaf-sweep plans) the D-08 population figures (21/12 files) if either needs to account for shadow-colour sites while sweeping their own assigned files.
- The one open item this plan surfaces but cannot close: `src/tokenSweep.ratchet.test.ts:36`'s comment quoting `bg-gray-950/50` verbatim keeps that one literal compiling into production CSS regardless of any future `scripts/` cleanup. Trivial to fix (reword the comment) whenever that file is next legitimately in scope for another plan -- not filed as a new todo since `123-SWEEP-BOUNDARY.md` § 1 already carries the full record and the fix is a one-line rewording, not a decision needing its own tracked item.
- No blockers.

---
*Phase: 123-accessibility-remediation*
*Completed: 2026-08-20*
