---
phase: 115-workspace-scanner
plan: 01
subsystem: infra
tags: [node-scripts, hooks, refactor, testing]

# Dependency graph
requires: []
provides:
  - "hooks/ingestPost.mjs exporting postSnapshot(endpointUrl, ingestKey, body, deps) — a single, never-throwing POST-with-bearer helper with a caller-owned endpoint path"
  - "hooks/scanner.mjs delegating its /scan POST to postSnapshot, with pre-existing wire tests (hooks/__tests__/scanner.test.mjs) passing unmodified"
affects: [115-09 (workspace scanner entry point — will import postSnapshot for the /workspace-ingest route)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injectable-deps testability pattern (deps.timeoutMs / deps.logPrefix / deps.fetchImpl) copied verbatim in shape from hooks/scanner.mjs:33-38"
    - "Caller-owns-the-route helper: postSnapshot takes the full endpoint URL, never appends a path, so future ingest routes can reuse it unchanged"

key-files:
  created: [hooks/ingestPost.mjs, hooks/__tests__/ingestPost.test.mjs]
  modified: [hooks/scanner.mjs]

key-decisions:
  - "D-04 extraction landed (not the copy fallback) — hooks/scanner.mjs's pre-existing wire tests passed unmodified on the first attempt, so the 'two genuine correction attempts' fallback clause was never triggered."

patterns-established:
  - "postSnapshot(endpointUrl, ingestKey, body, deps) is now the single POST-with-bearer site for host-side scanner traffic; the next scanner (hooks/workspaceScan.mjs, 115-08/09) imports it rather than copying the block."

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-08-12
---

# Phase 115 Plan 01: Extract postSnapshot helper Summary

**Extracted the inline POST-with-bearer block from `hooks/scanner.mjs`'s awaited SessionStart path into a standalone, never-throwing `hooks/ingestPost.mjs` module, proven behavior-preserving by the pre-existing wire tests passing unmodified plus 6 new direct-contract tests including a RED/GREEN mutation proof of the non-throwing guarantee.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-12T15:44:00Z (approx, first commit 11:44:54 local)
- **Completed:** 2026-08-12T15:56:00Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 3 (1 new module, 1 new test file, 1 edited file)

## Accomplishments

- Created `hooks/ingestPost.mjs` exporting exactly one function, `postSnapshot`, matching the byte-for-byte log-string contract of the pre-extraction inline block, with the endpoint path derived from `new URL(endpointUrl).pathname` (falling back to the raw string on a malformed URL) so the log line is correct for both `/scan` today and `/workspace-ingest` later.
- Edited `hooks/scanner.mjs` to add a static top-level import and replace the 20-line inline POST block with a single `await postSnapshot(...)` call — net line reduction (23 deletions / 2 additions in the diff), zero other changes to the file.
- The only pre-existing regression net for this path, `hooks/__tests__/scanner.test.mjs` (3 tests, real `node:http` server, asserts on actual POST body bytes), passed **unmodified** — confirmed via `git diff HEAD --name-only` not listing that file.
- Added `hooks/__tests__/ingestPost.test.mjs` with the 6 specified direct-contract cases (bearer present, bearer absent/control, non-2xx, unreachable endpoint, timeout, caller-owned path) — all pass, 9/9 combined with the pre-existing suite.
- Full suite (`npm test`) green: 310 test files passed, 17 skipped, 4118 tests passed, 193 todo, exit 0. `npx tsc --noEmit` clean.
- Manual sanity: `node hooks/scanner.mjs manual-scan --dry-run` still runs to completion without throwing (269 skills, 4 covered origins reported) — the untouched `isDirectRun` branch is unaffected.
- **RED/GREEN mutation proof** (verification-discipline requirement, beyond the plan's own acceptance criteria): temporarily changed `postSnapshot`'s catch block to `throw err;` instead of `return { ok: false, status: null }`. Observed RED — exactly cases 4 (unreachable endpoint) and 5 (timeout), the two load-bearing non-throwing assertions, failed with `TypeError: fetch failed` / `AbortError`, while the other 4 tests stayed green. Restored byte-identical (`git diff --stat hooks/ingestPost.mjs` empty). Re-observed GREEN, 9/9.

## Task Commits

1. **Task 1: Extract postSnapshot into hooks/ingestPost.mjs** - `02175d2a` (feat)
2. **Task 2: Prove behavior preservation** - `3ad4a037` (test)

No separate plan-metadata commit was made for the code/test commits above; this SUMMARY and the STATE.md/ROADMAP.md updates are committed together as the final docs commit.

## Files Created/Modified

- `hooks/ingestPost.mjs` — new module, exports `postSnapshot(endpointUrl, ingestKey, body, deps)`. Never throws; returns `{ ok, status }`.
- `hooks/scanner.mjs` — `runScan`'s inline POST block (`:220-241` pre-extraction) replaced with a single delegating call; added one static import.
- `hooks/__tests__/ingestPost.test.mjs` — new, 6 direct-contract test cases.

## Decisions Made

- **D-04 extraction landed on the first attempt.** The plan's fallback authorization (revert `scanner.mjs`, keep `ingestPost.mjs` standalone with duplicated logic) was not needed — the pre-existing `scanner.test.mjs` passed unmodified against the extracted code with no correction attempts required. Recorded per the plan's `<output>` instruction to state explicitly whether the extraction landed or the fallback was taken.
- Derived the logged pathname via `new URL(endpointUrl).pathname` with a fallback to the raw `endpointUrl` string on a throw, per the plan's explicit guidance — this keeps the non-throwing contract intact even if a caller ever passes a malformed URL.

## Deviations from Plan

None — plan executed exactly as written. The plan's draft code shapes (the exact inline block, the interfaces, the file:line citations) were independently re-verified against the live files before editing and matched exactly; no corrections were needed to the plan's own claims.

## Issues Encountered

One transient environment flake during full-suite verification: the first `npm test -- run` reported `Errors: 1 error` — "Worker exited unexpectedly" / "Worker forks emitted error" from Vitest's fork pool, with 0 tests reported failed (309 files passed, 17 skipped). A clean re-run (`npx vitest run`, no filter) completed with exit 0 and 0 errors (310 files passed, 17 skipped, one more test file counted than the flaky run, none failed) — consistent with a one-off worker-process crash unrelated to this plan's changes, not a regression. Scope boundary: not fixed, not further investigated, since it did not reproduce and touches infrastructure outside this plan's `files_modified`.

## Threat Model Verification

- **T-115-01-01 (Information Disclosure, error logging):** verified — the non-ok branch logs only `resp.status` and `await resp.text()` (the response body, which the mitigation explicitly permits); the request `body` argument is never referenced in any log line.
- **T-115-01-02 (Information Disclosure, bearer token):** verified by direct grep — `ingestKey` appears in `hooks/ingestPost.mjs` only at the parameter declaration, the JSDoc, and the `Authorization` header assignment (`headers["Authorization"] = \`Bearer ${ingestKey}\``); no log line or returned object references it.
- **T-115-01-03 (DoS, awaited SessionStart path):** verified by the RED/GREEN mutation proof above — the 3s default timeout and never-throws contract are preserved; cases 4/5 are the proof.
- **T-115-01-04 (Tampering, the only regression net):** verified — `hooks/__tests__/scanner.test.mjs` is absent from `git diff HEAD --name-only` after both task commits.
- **T-115-01-SC:** N/A — no `package.json` change.

## User Setup Required

None — no external service configuration required. This plan makes no deploy, no network call to the backend, and no scheduled-task change (per the plan's explicit scope boundary).

## Next Phase Readiness

`hooks/ingestPost.mjs` is ready to be imported by `hooks/workspaceScan.mjs` (115-08/09) — its caller-owned-path design (`postSnapshot(url, key, body, deps)`, no hardcoded `/scan`) was built and tested specifically for that reuse (test case 6). No blockers for subsequent waves in this phase.

---
*Phase: 115-workspace-scanner*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: hooks/ingestPost.mjs
- FOUND: hooks/__tests__/ingestPost.test.mjs
- FOUND: .planning/phases/115-workspace-scanner/115-01-SUMMARY.md
- FOUND: commit 02175d2a (Task 1)
- FOUND: commit 3ad4a037 (Task 2)
