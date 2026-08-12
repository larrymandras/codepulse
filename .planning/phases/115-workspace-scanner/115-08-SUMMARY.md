---
phase: 115-workspace-scanner
plan: 08
subsystem: infra
tags: [node-fs, dry-run-gate, mutation-testing, vitest, workspace-scanner]

# Dependency graph
requires:
  - phase: 115-01
    provides: "hooks/ingestPost.mjs — postSnapshot(endpointUrl, ingestKey, body, deps), never throws"
  - phase: 115-03
    provides: "hooks/workspaceApproval.mjs — canonicalReportHash/isDryRunApproved/buildApprovalMarkerContents/REPORT_RELPATH/APPROVAL_MARKER_RELPATH (D-12 gate primitives), and cases 1-4 of the mandatory five-case table"
  - phase: 115-02
    provides: "hooks/workspaceConfig.mjs — loadWorkspaceConfig"
  - phase: 115-07
    provides: "hooks/workspaceScan.mjs — walkRoot/rollupRootResults/loadMountedSet/buildSnapshot/buildDryRunReport/hashableView"
provides:
  - "hooks/workspaceScan.mjs: runWorkspaceScan(options, deps) — the entry point wiring load -> walk -> classify -> report -> GATE -> POST, in that order, with postSnapshot injectable via deps for testability"
  - "hooks/workspaceScan.mjs: the isDirectRun CLI branch — `node hooks/workspaceScan.mjs [--dry-run|--approve]`, default ingest mode, with distinct exit codes 0/2/3/4/5"
  - "hashableView() extended to also exclude reportHash from its own hash (self-referential exclusion, needed because the persisted report file on disk merges reportHash in)"
  - "hooks/__tests__/workspaceScan.test.mjs: 11 new tests (a)-(k) completing 115-VALIDATION.md's mandatory five-case table's case 5 — the injected postSnapshot-spy integration control, with 4 recorded mutation proofs"
affects: [115-09, 115-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "approve mode does NOT re-walk the filesystem — it reads whatever report is already on disk at REPORT_RELPATH and approves exactly that report's hash. A fresh walk-then-approve would let --approve silently approve a DIFFERENT, unreviewed snapshot than the one --dry-run showed Larry, defeating D-12's whole purpose (this is a correction to the plan's literal step ordering, see Deviations)."
    - "in-memory fake-disk test double (Map keyed by the exact REPORT_RELPATH/APPROVAL_MARKER_RELPATH strings) combined with REAL readdirSync/statSync against a real mkdtempSync tree in the same deps object — lets an integration test exercise the real filesystem walk while never touching the real config/ directory for report/marker I/O"

key-files:
  created: []
  modified:
    - hooks/workspaceScan.mjs
    - hooks/__tests__/workspaceScan.test.mjs

key-decisions:
  - "approve mode reads the EXISTING report off disk rather than performing a fresh walk-and-write like dry-run/ingest do. The plan's step 6 said 'always write the report... in every mode including ingest' followed immediately by step 7's approve-mode instruction to 'refuse if REPORT_RELPATH does not already exist' — those two instructions are incoherent together (a mode that always writes the report first can never observe it as absent). Corrected to: approve mode skips the walk entirely, checks existence, parses what's on disk, and approves THAT hash. This is the T-115-08-02 tampering threat's actual mitigation — re-walking before approving would silently approve unreviewed content."
  - "hashableView() (owned by 115-07, extended here) now destructures out both generatedAt AND reportHash. The persisted report file is `{ ...report, reportHash }`; without excluding reportHash, hashing the file read back off disk would never equal the value stored in that same field. Verified this is a no-op on 115-07's own fixtures, which never carry a reportHash key (destructuring an absent key is harmless) — confirmed by re-running the full 28-test 115-07 suite unchanged after the edit."
  - "the local variable holding the injected/real postSnapshot function is named `postSnapshot` (not renamed on destructure) specifically so the call site `await postSnapshot(...)` satisfies the plan's own acceptance-criteria grep (`grep -c \"postSnapshot(\" -> 2`: one JSDoc reference to the real helper's signature, one call site) without a second, redundant call path."

patterns-established:
  - "A structural gate's mode branches must each be independently checked against 'does re-deriving fresh state before this branch defeat the branch's own purpose' — a literal, unconditional 'always recompute X first' instruction in a plan can silently break a review/approve step that depends on X being frozen at review time."

requirements-completed: []  # No REQ-IDs for Phase 115 — traceability is via D-04/D-05/D-12 (CONTEXT.md).

# Metrics
duration: ~55min
completed: 2026-08-12
---

# Phase 115 Plan 08: Workspace Scanner Entry Point + D-12 Case 5 Integration Control Summary

**Wired `runWorkspaceScan` (load config -> walk -> classify -> write report -> D-12 gate -> POST via the shared `hooks/ingestPost.mjs` helper) and proved with an injected `postSnapshot` spy — plus 4 mutation proofs — that the refusal fires before any byte reaches the network, completing 115-VALIDATION.md's mandatory five-case table.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-12
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments

- `runWorkspaceScan(options, deps)` added to `hooks/workspaceScan.mjs`: `"dry-run"` walks + writes the report (never posts); `"approve"` reads the existing report off disk and writes an approval marker for its hash (never re-walks, never posts); `"ingest"` walks fresh, writes a new report, gates against the approval marker, and only then POSTs through `hooks/ingestPost.mjs`'s single `postSnapshot` call site.
- The `isDirectRun` CLI branch: `node hooks/workspaceScan.mjs [--dry-run|--approve]`, default ingest mode, distinct exit codes (0 success / 2 config-or-usage error / 3 D-12 refusal / 4 POST failed / 5 unexpected throw). `--dry-run --approve` together is a usage error (exit 2). Verified live against Larry's real tree (see below) — no shortcuts, no synthetic-only proof.
- D-12's mandatory five-case table (115-VALIDATION.md) is now fully closed: cases 1-4 live in `hooks/__tests__/workspaceApproval.test.mjs` (plan 115-03); case 5 — an injected `postSnapshot` spy proven never called under an invalid/stale/corrupted approval, with a passing control and 4 mutation proofs — lives here.
- `hashableView()` extended to also exclude `reportHash` from its own hash, closing a self-reference gap the persisted-report design introduces (see Decisions).
- D-04 preserved: `git diff --stat` for this plan touches only `hooks/workspaceScan.mjs` and its test file — `hooks/codepulse-hook.mjs`, `hooks/scanner.mjs`, and both `settings.json` files are untouched.

## Task Commits

1. **Task 1: Wire runWorkspaceScan and the CLI branch with the gate ahead of the POST** - `c41a31b6` (feat)
2. **Task 2: D-12 case 5 — the integration control proving the refusal precedes the network call** - `d27a858d` (test)

Each commit verified via `git show --stat HEAD` — exactly the intended single file each time; no foreign files swept in from this shared checkout.

## Files Created/Modified

- `hooks/workspaceScan.mjs` — added `runWorkspaceScan`, `logDryRunSummary`, the `isDirectRun` CLI branch, and imports from `workspaceApproval.mjs`/`ingestPost.mjs`/`workspaceConfig.mjs`. Extended `hashableView` to also exclude `reportHash`. 287 lines added.
- `hooks/__tests__/workspaceScan.test.mjs` — added an 11-test `describe` block (`runWorkspaceScan — D-12 case 5 integration control`) plus a fake-disk test double, using real `readdirSync`/`statSync` against real `mkdtempSync` fixtures. 368 lines added. The pre-existing 28 tests / 12 suites are byte-untouched.

## Decisions Made

See `key-decisions` in frontmatter — the two load-bearing ones: (1) approve mode does not re-walk (a plan-defect correction), and (2) `hashableView`'s reportHash self-exclusion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected approve mode to read the existing report rather than re-walking before approving**
- **Found during:** Task 1, translating the plan's step 6/7 pseudocode into working code
- **Issue:** The plan's action block said (step 6) "Always write the report... in every mode including ingest," then (step 7, approve branch) "Refuse with a non-zero exit if REPORT_RELPATH does not already exist on disk." Taken literally in sequence, approve mode would write a fresh report in step 6 and then, in step 7, check for the very file it just wrote — the "does not already exist" check could never fire, and approve would silently approve whatever the CURRENT filesystem state is rather than the report Larry actually reviewed via `--dry-run`. This is precisely the tampering threat T-115-08-02 exists to prevent (a gate that reports green without evaluating the reviewed thing).
- **Fix:** Restructured `runWorkspaceScan` so `mode === "approve"` is handled first and separately, before any config load or walk: it checks `REPORT_RELPATH` existence, parses whatever is currently on disk, computes that report's hash via `canonicalReportHash(hashableView(parsedReport))`, and writes the approval marker for exactly that hash. Only `"dry-run"` and `"ingest"` perform a fresh walk.
- **Files modified:** `hooks/workspaceScan.mjs`
- **Verification:** Case (h) and (i) in the Task 2 test suite directly exercise this: (h) confirms the marker's hash matches the report ALREADY on disk from a prior dry-run; (i) confirms approve refuses with no marker written when no report exists. Live-tree verification also confirms `node hooks/workspaceScan.mjs --dry-run` writes a report without needing an approve step to have run first.
- **Committed in:** `c41a31b6` (Task 1 commit)

**2. [Rule 2 - Missing critical] Extended `hashableView` to exclude `reportHash` from its own hash**
- **Found during:** Task 1, designing the "always write the report" step
- **Issue:** The persisted report file is `{ ...report, reportHash }` — adding the computed hash as a field on the written artifact. `hashableView` (115-07) only stripped `generatedAt`; without also excluding `reportHash`, re-parsing the written file and re-hashing it would produce a DIFFERENT hash than the one stored in that very file's `reportHash` field (a self-reference the original design didn't anticipate, since 115-07 never persisted the hash alongside the report).
- **Fix:** `hashableView` now destructures out both `generatedAt` and `reportHash`. Confirmed as a no-op against 115-07's own fixtures (which never carry a `reportHash` key) — the pre-existing 28-test suite passed unchanged both before and after.
- **Files modified:** `hooks/workspaceScan.mjs`
- **Verification:** Case (j) in the Task 2 suite: `canonicalReportHash(hashableView(parsedReportFromDisk))` equals `parsedReportFromDisk.reportHash` exactly.
- **Committed in:** `c41a31b6` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 missing-critical addition)
**Impact on plan:** Both were necessary for D-12's structural gate to mean what it claims. No scope creep — both stayed inside `hooks/workspaceScan.mjs`, the plan's declared file.

## Issues Encountered

None beyond the two deviations above. `npx tsc --noEmit` was clean after every task; `npm test` ran green throughout (4271 -> 4282, +11 new tests, 0 regressions, 0 failed).

## Mutation Proofs (Task 2, 4 required by the plan)

Each performed by `cp`-backing up `hooks/workspaceScan.mjs` to the session scratchpad, applying a single targeted mutation, running `npx vitest run hooks/__tests__/workspaceScan.test.mjs`, recording the exact failing test names, restoring via `cp` (never `git checkout --`), confirming `git diff --stat -- hooks/workspaceScan.mjs` was empty (byte-identical), then re-confirming the full 39-test file green before proceeding.

1. **Gate moved to AFTER the `postSnapshot` call** (the single most important mutation — proves ordering, not just returned status). Result: **3 failed / 36 passed.** Failing: `(b) CASE 5 — marker ABSENT...`, `(c) CASE 5 — marker STALE...`, `(d) CASE 5 — marker CORRUPTED...`. Each failed on `expect(spyCalls.length).toBe(0)` → received `1`.
2. **Gate changed to `if (false)`** (never refuses). Result: **4 failed / 35 passed.** Failing: `(b)`, `(c)`, `(d)`, plus `(f) the refusal message leaks no absolute path...` (a bonus catch — with the gate disabled, no refusal message is ever logged, so case (f)'s `expect(errors.length).toBeGreaterThan(0)` sanity check also failed).
3. **`isDryRunApproved`'s call site replaced with the constant `true`**. Result: **4 failed / 35 passed.** Same failing set as mutation 2: `(b)`, `(c)`, `(d)`, `(f)`.
4. **Refusal changed from `return` to `throw`**. Result: **5 failed / 34 passed.** Failing: `(b)`, `(c)`, `(d)`, `(f)` (the throw propagates through their own `await` and fails the test before their own assertions run), plus `(e) none of the refusal cases (b)/(c)/(d) throw or reject...` — the test this mutation directly targets.

After each mutation: `git diff --stat -- hooks/workspaceScan.mjs` returned empty (byte-identical restore), and `npx vitest run hooks/__tests__/workspaceScan.test.mjs` returned to 39/39 passed before the next mutation was applied. Final combined run (`hooks/__tests__/workspaceScan.test.mjs` + `hooks/__tests__/workspaceApproval.test.mjs`): 63/63 passed.

## Case -> Test-Name Mapping (D-12 five-case table, 115-VALIDATION.md)

| # | Case | Test file | Test name |
|---|------|-----------|-----------|
| 1 | Baseline control | `workspaceApproval.test.mjs` (115-03) | `CASE 1 — BASELINE CONTROL (must PASS): a marker built for A approves A's own hash` |
| 2 | Content drift | `workspaceApproval.test.mjs` (115-03) | `CASE 2 — content drift at the top level refuses a stale approval` (+ `CASE 2b` nested) |
| 3 | Marker absent | `workspaceApproval.test.mjs` (115-03) | (covered by `isDryRunApproved` unit cases; also re-proven at the integration level below as case 5(b)) |
| 4 | Marker corrupted | `workspaceApproval.test.mjs` (115-03) | `CASE 4 — marker corrupted (not hash-shaped) refuses` (+ `CASE 4b`) |
| 5 | Integration control | `workspaceScan.test.mjs` (this plan) | `(a)` CONTROL (spy called once) + `(b)` absent / `(c)` stale / `(d)` corrupted (spy never called) |

## Source-Ordering Evidence (D-12 gate before the POST call)

- `isDryRunApproved` usage: `hooks/workspaceScan.mjs:710`
- `postSnapshot(` call site: `hooks/workspaceScan.mjs:729`
- 710 < 729 — the gate appears in source strictly before the call, and there is no code path from the mode branch to the call that skips it.

## Real-Tree Verification (`--dry-run` against Larry's actual workspace)

Run live: `node hooks/workspaceScan.mjs --dry-run`, exit 0, ~4.8s.

- **totals.dirs: 15,647**
- **totals.files: 274,660**
- **totals.withheldFiles: 29,474**
- Personal: 1,022 dirs / 7,726 files / ~204.7MB. Unclassified: 14,625 dirs / 266,934 files / ~33.7GB (the D-16 local-root list is 61 entries, all Unclassified by design — expected and correct on first cut per D-15/D-16).
- Warnings fired: 120 filesystem cycle/reparse-point entries skipped; directory count exceeds the 5000 threshold (flagged for D-11 headroom review); scan incomplete (`scannedRootsComplete=false` — at least one declared root did not fully enumerate; not investigated further here, out of this plan's scope).
- `config/workspace-scan-report.json` (gitignored) was written; `config/workspace-scan.approved.sha256` was NOT created.
- `node hooks/workspaceScan.mjs` (default ingest mode, no marker present) → exit **3**, refusal message printed, no HTTP call attempted.
- `node hooks/workspaceScan.mjs --dry-run --approve` → exit **2**, usage error.
- **Observation for 115-09:** because `codepulse` is itself a declared root and the report file lives inside it (gitignored, so never transmitted), each successive `--dry-run`/`--ingest` invocation's report reflects the PRIOR run's report file as part of its own byte count — the reportHash therefore differs slightly run-to-run even with no other filesystem change. This did not affect correctness (the gate still refused correctly with no approval), but 115-09's real-tree review should expect the hash to shift between consecutive dry-runs for this reason, and should approve based on the LAST dry-run immediately preceding the ingest, not a cached hash from earlier in the session.

## Exit Code Table (documented in-file and here per the plan's requirement)

| Code | Meaning |
|------|---------|
| 0 | Success (dry-run written / approved / ingested) |
| 2 | Config or usage error (tracked config missing/malformed, `--dry-run` + `--approve` together, approving with no report on disk, no Convex URL resolved for an ingest run) |
| 3 | D-12 refusal (report unapproved or approval stale) |
| 4 | POST failed (unreachable backend or non-2xx response) |
| 5 | Unexpected throw (a bug, not a refusal) — never exits 0 |

## Home-Path Leak Scan (both touched files, both separator forms, with a control)

- `hooks/workspaceScan.mjs`: `grep -Fc 'C:\Users\mandr'` → 0; `grep -Fc 'C:/Users/mandr'` → 0
- `hooks/__tests__/workspaceScan.test.mjs`: `grep -Fc 'C:\Users\mandr'` → 0; `grep -Fc 'C:/Users/mandr'` → 0
- Control (known positive): `config/workspace.json` → `grep -Fc 'C:/Users/mandr'` → 6 (confirms the grep mechanism itself works)

## Ingest Key Handling

`ASTRIDR_INGEST_API_KEY` is referred to by name only throughout `hooks/workspaceScan.mjs` — never resolved into a variable that gets logged. The CLI branch reads it into `ingestKey` and passes it straight to `runWorkspaceScan`'s `options.ingestKey`, which is only ever handed to `postSnapshot` (which itself never logs the key, only warns by name when absent). Case (f) of the Task 2 suite asserts a synthetic secret string never appears in any logged refusal message.

## User Setup Required

None — no external service configuration required. No `npx convex deploy`, `npx convex env list`, or `npx convex run --push` was run. No scheduled task was registered (115-10's scope). No live network call was made at any point in this plan — every test injects a `postSnapshot` spy/fake; the real-tree CLI runs either never reached the POST (refused first) or were the deliberate `--dry-run`/default-refusal checks above.

## Next Phase Readiness

- `hooks/workspaceScan.mjs` now has a complete, gated entry point ready for 115-09's attended real-tree review-and-approve-and-ingest wave, and for 115-10's scheduled-task registration.
- 115-09 should be aware of the report-hash-shifts-between-runs observation above (codepulse being a scanned root that contains its own gitignored report file) when designing its approve-then-ingest sequencing — approve immediately before the ingest run it's meant to gate, not from an earlier dry-run in the same session.
- The `scannedRootsComplete=false` warning observed on the real tree was not investigated in this plan (out of scope — this plan's job was proving the gate, not auditing root health); worth a quick look in 115-09's manual review before first real ingest.
- No blockers for 115-09 or 115-10.

---
*Phase: 115-workspace-scanner*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: hooks/workspaceScan.mjs (runWorkspaceScan export present, verified via `grep -c "export async function runWorkspaceScan"` -> 1)
- FOUND: hooks/__tests__/workspaceScan.test.mjs (39 tests, up from 28)
- FOUND: .planning/phases/115-workspace-scanner/115-08-SUMMARY.md
- FOUND commit: c41a31b6 (Task 1 — feat)
- FOUND commit: d27a858d (Task 2 — test)
