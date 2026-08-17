---
phase: 115-workspace-scanner
plan: 03
subsystem: infra
tags: [node-crypto, sha256, mutation-testing, dry-run-gate, vitest]

# Dependency graph
requires: []
provides:
  - "hooks/workspaceApproval.mjs — pure D-12 gate: stableStringify (recursive canonical
    serializer), canonicalReportHash (sha256), isDryRunApproved (fail-closed comparison),
    buildApprovalMarkerContents, REPORT_RELPATH/APPROVAL_MARKER_RELPATH constants"
  - "Mutation-proven regression net for the gate (hooks/__tests__/workspaceApproval.test.mjs),
    covering 115-VALIDATION.md's mandatory five-case table cases 1-4"
affects: [115-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure zero-I/O gate function, separated from its I/O-performing caller, so the refusal
      logic itself is unit- and mutation-testable (the 115-08 entry point will own reading the
      report/marker files off disk and calling into this module)"
    - "Recursive canonical JSON serialization (sort keys at every nesting level, preserve array
      order) in place of JSON.stringify's replacer-array trick, which only allowlists/reorders
      TOP-LEVEL keys and silently drops nested ones"

key-files:
  created:
    - hooks/workspaceApproval.mjs
    - hooks/__tests__/workspaceApproval.test.mjs
  modified: []

key-decisions:
  - "D-12's gate lives as pure functions (no fs import at all) so the refusal is provable by
    unit test rather than resting on discipline — matches CONTEXT.md's explicit mandate."
  - "isDryRunApproved reads only the marker's first non-empty, non-#-prefixed line, so a
    buildApprovalMarkerContents round-trip (hash + trailing comment lines) approves, while any
    trailing junk appended directly to the hash line does not (no substring/startsWith match)."
  - "Rejected the RESEARCH.md-proposed JSON.stringify(report, Object.keys(report).sort()) form —
    measured live to drop nested keys from the serialization entirely, which would let a report
    change 2+ levels deep pass a stale approval. Replaced with a recursive serializer and guarded
    by an explicit nested-mutation regression test (case 2b)."

patterns-established:
  - "Pattern: a structural gate module must be zero-I/O and its acceptance criteria must include
    a literal absence-of-defective-form grep, not just a passing test suite — a green suite alone
    cannot prove the wrong implementation was avoided."

requirements-completed: []  # No REQ-IDs for Phase 115 — traceability is via D-12 (CONTEXT.md).

# Metrics
duration: 5min
completed: 2026-08-12
---

# Phase 115 Plan 03: D-12 Structural Dry-Run Gate Summary

**Pure, zero-I/O sha256 report-hash gate (`hooks/workspaceApproval.mjs`) implementing D-12's structural refusal, proven by a 24-test mutation-tested suite covering the mandatory five-case table's cases 1-4 (case 5 deferred to 115-08 by design).**

## Performance

- **Duration:** ~5 min (12:10:51 -> 12:15:29 ET, 2026-08-12)
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both new)

## Accomplishments

- Built `hooks/workspaceApproval.mjs`: `stableStringify` (recursive canonical serializer —
  sorts object keys at every nesting level, preserves array order, matches `JSON.stringify`
  semantics for `undefined`/`NaN`/`Infinity`), `canonicalReportHash` (sha256 over the canonical
  serialization), `isDryRunApproved` (fail-closed: rejects non-64-char hashes, rejects
  non-string marker contents, plain string equality on the marker's first non-comment line —
  never a prefix/substring match), `buildApprovalMarkerContents` (hash line + optional
  `#`-prefixed metadata comments).
- Confirmed live, before writing any test, that the `JSON.stringify(report,
  Object.keys(report).sort())` form proposed in `115-RESEARCH.md` is measurably wrong: it
  allowlists/reorders only TOP-LEVEL keys, so a change nested two levels down (e.g. a
  per-department count) serializes identically to the original and the gate would silently pass
  a stale approval. `stableStringify` avoids this by construction; case 2b in the test suite is
  the explicit regression guard.
- Wrote `hooks/__tests__/workspaceApproval.test.mjs` implementing 115-VALIDATION.md's mandatory
  five-case table cases 1-4 verbatim, against a fixture report nested 3 levels deep (required —
  a flat fixture cannot exercise the replacer-array defect). Case 1 (the baseline control) is
  explicitly commented as load-bearing: without it, four `false` results would be
  indistinguishable from a function that always returns `false`.
- Mutation-proved the gate itself: flipped `isDryRunApproved`'s final `===` to `!==`, observed
  RED, restored byte-identical, re-observed GREEN. See "Mutation Proof" below for the exact
  failing test names.

## Task Commits

1. **Task 1: Write the pure D-12 gate module** - `3f0637e4` (feat)
2. **Task 2: Write the mandatory D-12 mutation test (cases 1-4, with the passing control)** - `4266f997` (test)

Each commit verified via `git show --stat HEAD` to touch exactly its own intended file; no
foreign files were swept in from the shared checkout (a concurrent Phase 112 session's
`docs(112-07)` commit landed interleaved between mine in `git log` and was left untouched).

## Files Created/Modified

- `hooks/workspaceApproval.mjs` - Pure D-12 gate: `stableStringify`, `canonicalReportHash`,
  `isDryRunApproved`, `buildApprovalMarkerContents`, `REPORT_RELPATH`,
  `APPROVAL_MARKER_RELPATH`. Zero I/O (no `fs` import at all).
- `hooks/__tests__/workspaceApproval.test.mjs` - 24 tests: five-case mutation table (cases 1-4 +
  2b), canonical-serialization invariants, stability, malformed-input never-throws coverage.

## Decisions Made

- Kept `isDryRunApproved`'s marker-parsing rule (first non-empty, non-`#` line) rather than a
  raw whole-string equality, because Task 1's action block requires `buildApprovalMarkerContents`
  output (hash + trailing `#`-comment lines) to round-trip through the checker — verified by the
  Task 1 `<verify>` block's own `node -e` probe and by a dedicated test in Task 2.
- Excluded two directory names from nothing here (N/A to this plan) — no config decisions were
  made in 115-03; this note left intentionally blank per the template's "None" guidance where
  nothing applies.
- None beyond what CONTEXT.md/PLAN.md already specified — the module and tests follow D-12 and
  the plan's `<interfaces>` correction as written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded module header comments to avoid self-tripping the plan's own literal-absence greps**
- **Found during:** Task 1, running the acceptance-criteria greps
- **Issue:** The plan requires `grep -c "readFileSync\|existsSync\|..." hooks/workspaceApproval.mjs` to return `0` and `grep -Fc 'JSON.stringify(report, Object.keys' hooks/workspaceApproval.mjs` to return `0`, proving the module is I/O-free and the defective draft form is absent. My first draft's own explanatory header comments quoted those exact literal strings (documenting what the module deliberately does NOT do), so both greps returned `1` instead of `0` — a false positive on my own documentation, not a real defect in the code.
- **Fix:** Reworded the two header-comment passages to describe the same facts (no filesystem import/I/O at all; `JSON.stringify`'s second-argument-as-array trick is a key allowlist, not a sort order) without reproducing the literal banned substrings.
- **Files modified:** `hooks/workspaceApproval.mjs` (comment-only change, verified via re-running both Task 1 `<verify>` `node -e` probes before and after — outputs identical)
- **Verification:** All 6 Task 1 acceptance-criteria checks re-run and passed after the reword (grep counts 0/0/1/not-`#!`, both `node -e` probes print PASS).
- **Committed in:** `3f0637e4` (Task 1 commit — the reword happened before the first commit, so no separate commit exists for it)

---

**Total deviations:** 1 auto-fixed (1 blocking — a documentation self-trip, not a functional defect)
**Impact on plan:** Zero functional impact; the module's actual behavior was correct both before and after the reword. No scope creep.

## Issues Encountered

None beyond the deviation above.

## Mutation Proof (recorded per plan's `<verification>` requirement)

Mutation: `hooks/workspaceApproval.mjs`, `isDryRunApproved`'s final comparison changed from
`markerHash.trim().toLowerCase() === reportHash.trim().toLowerCase()` to `!==`.

**RED** — `npx vitest run hooks/__tests__/workspaceApproval.test.mjs`: **7 failed | 17 passed (24)**

Failing tests (all inside `isDryRunApproved — D-12 mandatory mutation test (115-VALIDATION.md cases 1-4)`):
- `CASE 1 — BASELINE CONTROL (must PASS): a marker built for A approves A's own hash`
- `CASE 2 — content drift at the top level refuses a stale approval`
- `CASE 2b — content drift NESTED below the top level refuses a stale approval (replacer-array regression guard)`
- `CASE 4 — marker corrupted (not hash-shaped) refuses`
- `CASE 4b — marker holds a valid-shaped but WRONG 64-char hex hash refuses`
- `a marker with extra trailing content on the hash line refuses (no substring/prefix match)`
- `a marker holding the hash plus a comment line still approves (buildApprovalMarkerContents round-trip)`

Restore: `cp` from a pre-mutation scratchpad backup (never `git checkout --`, which would have
discarded uncommitted Task 2 work at the time); confirmed byte-identical via `git diff --stat
hooks/workspaceApproval.mjs` returning empty.

**GREEN** — re-run after restore: **24/24 passed**.

## Case-5 Deferral (by design)

Per the plan's explicit scope boundary, case 5 of 115-VALIDATION.md's five-case table
("Integration control — inject a `deps.postSnapshot` spy; run the real entry point with
approval invalid; assert the spy is never called") is **not** built in this plan. It requires
the entry point (`load -> walk -> classify -> report -> gate -> POST`), which does not exist
until 115-08. Both halves are hard acceptance requirements of the phase; neither alone is
sufficient — this is recorded here so the phase-level verification step does not mistake this
plan's green for full D-12 coverage.

## User Setup Required

None - no external service configuration required. No deploy, no network call, no scheduled-task
change — explicit scope boundary per the plan and per this phase's `<scope>` constraints.

## Next Phase Readiness

- `hooks/workspaceApproval.mjs`'s exports (`stableStringify`, `canonicalReportHash`,
  `isDryRunApproved`, `buildApprovalMarkerContents`, `REPORT_RELPATH`,
  `APPROVAL_MARKER_RELPATH`) are ready for 115-08 to import into the real entry point and for
  115-07 to use `REPORT_RELPATH` when writing the dry-run report.
- 115-08 must implement case 5 of the mutation table (the integration control) to complete D-12's
  full acceptance bar — not yet satisfied by this plan alone.
- No blockers identified for wave 2 (115-05, 115-06) or wave 3 (115-07), which do not depend on
  this plan.

## Self-Check: PASSED

- FOUND: hooks/workspaceApproval.mjs
- FOUND: hooks/__tests__/workspaceApproval.test.mjs
- FOUND: .planning/phases/115-workspace-scanner/115-03-SUMMARY.md
- FOUND: commit 3f0637e4 (feat(115-03): add pure D-12 dry-run gate module)
- FOUND: commit 4266f997 (test(115-03): D-12 mandatory mutation test, cases 1-4 with passing control)

---
*Phase: 115-workspace-scanner*
*Completed: 2026-08-12*
