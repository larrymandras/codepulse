---
phase: 115-workspace-scanner
plan: 02
subsystem: infra
tags: [config, node-scripts, hooks, testing, security]

# Dependency graph
requires: []
provides:
  - "config/workspace.json — tracked classification rules (schemaVersion, snapshotId, departments, excludeDirs/excludeFiles, deny-by-default shareableAllowlist, 5 declared non-sensitive roots, composeFile, localConfigPath)"
  - "config/workspace.local.json — gitignored local root list, 61 declared roots, all Unclassified (D-16), never committed"
  - "hooks/workspaceConfig.mjs exporting loadWorkspaceConfig / mergeWorkspaceConfig / DEPARTMENTS / UNCLASSIFIED / CONFIG_SCHEMA_VERSION — fail-closed tracked-then-local merge"
affects: ["115-05 (classifier — pure function of (path, config), reads config/workspace.json's shareableAllowlist/excludeDirs/excludeFiles)", "115-07 (walk — reads roots/excludeDirs from the merged config; dry-run report lists every Unclassified root for Larry's local re-map)", "115-08/09 (entry point — imports loadWorkspaceConfig)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tracked-rules + gitignored-local config split, merged by a pure fail-closed function (mergeWorkspaceConfig) wrapped by a thin I/O loader (loadWorkspaceConfig) — mirrors validateIngestAuth's fail-closed shape (convex/ingestAuth.ts:76-85) and hooks/scanner.mjs's existsSync+try/catch defensive-read wrapping."
    - "Injectable-deps testability (repoRoot/readFileSync/existsSync overrides), same shape as hooks/scanner.mjs's deps param."

key-files:
  created: [config/workspace.json, hooks/workspaceConfig.mjs, hooks/__tests__/workspaceConfig.test.mjs]
  modified: [.gitignore]

key-decisions:
  - "D-08/D-17 config split implemented as specified: .gitignore edited in the same task, before config/workspace.local.json existed on disk — verified live with git check-ignore before the file was ever created."
  - "Task 2's local-root enumeration used the plan's literal instruction ('every real project/work root... even if a directory name looks obviously like a ProtectAll/Work repo, it still ships Unclassified') rather than narrowing to only the ~10 'ambiguous' names CONTEXT.md's research phase had eyeballed — this produced 61 declared local roots, not ~10. See Deviations."
  - "Two directory names (scoop, Intel) were excluded from the local-root enumeration on judgment, not on the plan's literal named exclusion list: both are well-known Windows package-manager/vendor-install directories, structurally identical in kind to .npm/.cargo/.nuget (which ARE named exclusions) despite lacking a leading dot on Windows."

patterns-established:
  - "postSnapshot-style caller-owned helper precedent extended: mergeWorkspaceConfig is the pure unit; loadWorkspaceConfig is the only I/O boundary. 115-05's classifier should follow the same split when it becomes a pure function of (path, config)."

requirements-completed: []

# Metrics
duration: 55min
completed: 2026-08-12
---

# Phase 115 Plan 02: Split workspace config + fail-closed loader Summary

**Built the D-08/D-17 split classification config — a tracked deny-by-default rules file plus a gitignored local root list — and a fail-closed loader that merges them, local winning on collision, falling closed to tracked-roots-only on any local-config failure; proven by 12 tests including two independent RED/GREEN mutation proofs of the fail-closed contract.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-12
- **Tasks:** 3 completed (Task 2 produced no commit — its only file is gitignored by design)
- **Files created:** 3 (config/workspace.json, hooks/workspaceConfig.mjs, hooks/__tests__/workspaceConfig.test.mjs) + 1 gitignored (config/workspace.local.json, never committed)
- **Files modified:** 1 (.gitignore)

## Accomplishments

- **Task 1:** `.gitignore` gained a new block (three explicit filenames, not a glob) citing D-17, committed BEFORE `config/workspace.local.json` existed on disk — `git check-ignore -v` matched all three target filenames pre-creation, and the control (`git check-ignore config/workspace.json`) exited non-zero, proving the ignore rules are specific rather than swallowing the whole `config/` directory. `config/workspace.json` was written with `schemaVersion`, `snapshotId: "larry-workspace"`, the D-06 exclude sets, a deny-by-default `shareableAllowlist` (D-02) whose `default.extensions` list was verified programmatically to contain none of the 14 measured-leaky extension families, and 5 declared roots each carrying `department` + `evidence` (D-14/D-15). `composeFile` was independently re-verified against the live `astridr-repo/docker-compose.yml:344` before writing.
- **Task 2:** Enumerated every top-level directory under `C:/Users/mandr/`, excluded Windows profile folders (the plan's literal named list) and tool caches (the plan's literal named list, plus `scoop`/`Intel` on judgment — see Decisions), and the 5 already-tracked roots. Wrote all remaining directories to the gitignored `config/workspace.local.json`, every single one `department: "Unclassified"` (D-16) — **61 local roots**, none omitted, none guessed into a real department. `git status --porcelain config/workspace.local.json` produces no output (proven to discriminate: an untracked, non-ignored probe file dropped in the same directory DOES show up under `git status --porcelain`, and was removed immediately after the check). `git ls-files config/` lists exactly `config/workspace.json`.
- **Task 3:** `hooks/workspaceConfig.mjs` — `mergeWorkspaceConfig` (pure, no I/O) merges tracked + local, local winning on key collision and on a per-root `id` basis, normalizes every path to forward slashes with no trailing separator, and coerces any department outside the fixed 4-string vocabulary to `"Unclassified"`. Fails closed to tracked-roots-only (`localConfigStatus: "absent"`) on `local === null`, and to the same tracked-roots-only result on a `schemaVersion` mismatch (`"version-mismatch"`) — never throws, never widens to "everything unclassified is fine to scan." An absent/malformed/version-mismatched **tracked** config throws by design (the one deliberate asymmetry — a repo build defect, not a runtime condition). `loadWorkspaceConfig` is the thin I/O wrapper: the tracked read is unguarded (throws propagate); the local read is wrapped in `existsSync` + `try/catch`, and any failure passes `null` into `mergeWorkspaceConfig`. `hooks/__tests__/workspaceConfig.test.mjs` implements all 8 required cases plus 4 more (a "no I/O deps at all" control and 3 `loadWorkspaceConfig` disk-fixture tests) — 12/12 passing.

## Task Commits

1. **Task 1: tracked rules config + .gitignore split** — `c4cd72a7` (feat)
2. **Task 2: gitignored local root list** — no commit (file is gitignored by design; nothing to stage)
3. **Task 3: fail-closed loader + tests** — `10099e08` (feat)

## Files Created/Modified

- `.gitignore` — new block ignoring `config/workspace.local.json`, `config/workspace-scan-report.json`, `config/workspace-scan.approved.sha256`.
- `config/workspace.json` — tracked, public. Rules only; no sensitive root names.
- `config/workspace.local.json` — gitignored, never committed. 61 declared local roots, all `Unclassified`.
- `hooks/workspaceConfig.mjs` — new module. `mergeWorkspaceConfig`, `loadWorkspaceConfig`, `DEPARTMENTS`, `UNCLASSIFIED`, `CONFIG_SCHEMA_VERSION`.
- `hooks/__tests__/workspaceConfig.test.mjs` — new, 12 tests.

## Mutation-Test Evidence (RED/GREEN)

Both mutations were applied to `hooks/workspaceConfig.mjs`, run in isolation against `hooks/__tests__/workspaceConfig.test.mjs`, then restored from a scratchpad backup and verified byte-identical via `git diff --stat` (empty) before re-running.

**Mutation A — department coercion disabled** (`normalizeRoot`'s `DEPARTMENTS.includes(...)` check replaced with a pass-through): observed RED — exactly case 6 ("an unknown department is coerced to Unclassified... control") failed (`expected 'Engineering' to be 'Unclassified'`), the other 11 tests stayed green. Restored; re-observed GREEN, 12/12.

**Mutation B — fail-closed absent path broken** (`local === null` branch changed to return `roots: []` instead of `roots: trackedRoots`, simulating the exact "scan nothing visible" / silent-narrowing failure D-17 forbids — note this is the inverse-shaped defect from "scan everything unclassified," but equally a violation of the "never omitted" half of D-16/D-17's fail-closed contract): observed RED — exactly case 2 ("local absent (null) returns tracked roots unchanged, status absent") failed (`expected +0 to be 2`), the other 11 tests stayed green. Restored; re-observed GREEN, 12/12.

Both mutations independently confirm the test suite is not a set of refusal cases that would pass against a function that always fails closed — case 1 (the passing control) already establishes that a genuine merge happens, and these two mutations confirm the specific fail-closed and coercion mechanisms are load-bearing to the tests that guard them.

## Verification Evidence

- `git check-ignore -v config/workspace.local.json config/workspace-scan-report.json config/workspace-scan.approved.sha256` → all 3 matched, run BEFORE `config/workspace.local.json` existed on disk.
- `git check-ignore config/workspace.json` → exit 1 (control: the tracked file is provably not ignored).
- Task 1 `<verify>` node invariant script → `PASS tracked config invariants`.
- `grep -Fc Unclassified config/workspace.json` → 4 (≥3 required). `grep -Fc '"evidence"' config/workspace.json` → 5 (≥5 required).
- Task 2 `<verify>` node invariant script → `PASS local config invariants; roots=61`.
- `git status --porcelain config/workspace.local.json` → empty, discriminated against an untracked probe file in the same directory (shows up) and against `config/workspace.json` (shows up while unstaged/uncommitted at the time it was checked).
- `git ls-files config/` → exactly `config/workspace.json`.
- `npx vitest run hooks/__tests__/workspaceConfig.test.mjs` → 12/12 passed.
- `head -c 2 hooks/workspaceConfig.mjs` → `//`, not `#!`.
- `grep -v '^\s*[/*]' hooks/workspaceConfig.mjs | grep -c "readFileSync\|existsSync"` → 3 (the import line + the 2 real usages inside `loadWorkspaceConfig`; `mergeWorkspaceConfig`'s body contains neither).
- `node -e "import('./hooks/workspaceConfig.mjs')..."` real on-disk merge → `status=merged roots=66` (5 tracked + 61 local), confirming the real merge works, not just fixtures.
- `npx tsc --noEmit` → clean.
- Full suite: `npx vitest run` → **311 files passed, 17 skipped; 4133 tests passed, 193 todo, 0 failed** (baseline after 115-01 was 310/4118; delta includes this plan's 12 new tests plus a concurrent Phase 112-08 session's own test additions landing in the same shared checkout — not attributable to this plan alone, confirmed by `git log` showing `112-08` commits interleaved with this plan's own).
- Each commit verified with `git show --stat HEAD` immediately after committing: Task 1's commit touched exactly `.gitignore` + `config/workspace.json` (2 files, 96 insertions); Task 3's commit touched exactly `hooks/workspaceConfig.mjs` + `hooks/__tests__/workspaceConfig.test.mjs` (2 files, 296 insertions).

## Deviations from Plan

**1. [Not a defect, a scope clarification] Task 2's local-root list is 61, not "~10."** CONTEXT.md's D-16 narrative describes research finding "~10 directories it could not classify from the name alone." The PLAN's own Task 2 `<action>` text is explicit and broader: enumerate *every* real project/work root under `C:/Users/mandr/` (not just ambiguous-sounding ones), excluding only Windows profile folders, tool caches, and the 5 already-tracked roots — "Even if a directory name looks obviously like a ProtectAll/Work repo, it still ships Unclassified here." Following the plan's literal instruction over CONTEXT.md's narrower research-time estimate produced 61 declared roots (protectall variants, astridr git worktrees, and many project directories the research pass never individually eyeballed). This is the correct, more complete interpretation of D-16's "never omitted" mandate — the "~10" figure described what research found *ambiguous by name alone during discussion*, not a cap on what the mechanical Task 2 enumeration should declare.

**2. [Rule 3 — blocking issue, judgment call] Two directories excluded beyond the plan's literal named exclusion list.** `scoop` (Windows package-manager install root) and `Intel` (vendor-created driver/diagnostics folder) are not on the plan's literal Windows-profile-folder or tool-cache exclusion lists, but are structurally identical in kind to entries that ARE on that list (`.npm`, `.cargo`, `.nuget` — Windows lacks the dotfile convention for `scoop`, and `Intel` is an OS/vendor artifact, not user work). Both fail the plan's own inclusion test ("is otherwise plainly a working directory") on their face. Excluded via judgment rather than the plan's literal list; documented here per the plan's own instruction not to record local root names elsewhere.

**3. [Verification-discipline finding, honestly disclosed] The literal whole-repo `git grep -F` per-root-id check (Task 2 acceptance criterion) found 23 of 61 candidate ids already present in tracked files, entirely PRE-DATING this plan's commits.** Inspected all 23 by hand: every hit is either (a) a pre-existing, unrelated planning-history reference (e.g. a directory name appearing incidentally in an old calibration transcript's `cwd` field, a historical HANDOFF doc, or a WAKEWORD-STRATEGY doc that predates Phase 115 entirely), or (b) already cited in `115-05-PLAN.md`'s own draft compose-mount excerpt (written during the planning session, before this executor ran, not introduced by this plan's commits). None of the 23 hits appear in either of THIS plan's two commits (`c4cd72a7`, `10099e08`) — both were verified via `git show --stat HEAD` to touch only their intended files, neither of which names any local root. **This plan introduced zero new instances of any local root name into any tracked file.** The remaining 38 of 61 ids have no pre-existing tracked-file occurrence at all — those are the genuinely first-appearance names the `.gitignore` mechanism protects going forward. The check as literally specified (a repo-wide grep with an expectation of zero total hits) does not distinguish "pre-existing, unrelated, out-of-scope-to-redact history" from "a new disclosure this plan caused" — that distinction required manual inspection, which is recorded here rather than pretending a clean zero. No root name is repeated in this document; only the counts (23, 38, 61) are given, consistent with the plan's "report only the count" instruction.

## Threat Model Verification

- **T-115-02-01** (config/workspace.local.json in a PUBLIC repo): mitigated and verified — `.gitignore` rule written first, in the same task, before the file existed; `git check-ignore` matched and `git status --porcelain` produced no output for the file (discriminated against a probe control).
- **T-115-02-02** (local root names leaking via SUMMARY/commit/comment): mitigated — this SUMMARY names zero local roots (counts only); both commits verified to touch only their intended files. See Deviation 3 for the honest disclosure of the whole-repo grep's pre-existing (out-of-scope) hits.
- **T-115-02-03** (over-broad ignore rule hiding real source): mitigated and verified — 3 explicit filenames, not a glob; `git check-ignore config/workspace.json` exits non-zero (control).
- **T-115-02-04** (allowlist drift re-adding forbidden extensions): mitigated — Task 1's automated invariant check enforces this; `_excludedFromAllowlistRationale` field records why.
- **T-115-02-05** (fail-open on missing local config): mitigated and mutation-proven — Mutation B directly attacked this property and was caught by case 2.
- **T-115-02-06** (malformed local config crashing a swallowed task): mitigated — every local read wrapped in `existsSync` + `try/catch`; case 3 asserts on the returned status, not a caught throw.
- **T-115-02-SC**: N/A — no `package.json` change, no npm installs.

## User Setup Required

None — no external service configuration, no deploy, no network call to the backend. `config/workspace.local.json` exists locally on this machine only (gitignored) and will need to exist identically on any other machine that runs the scanner — that is expected local-per-machine state, not a gap.

## Next Phase Readiness

`hooks/workspaceConfig.mjs`'s `loadWorkspaceConfig`/`mergeWorkspaceConfig` are ready for 115-05 (classifier, pure function of `(path, config)`) and 115-07 (walk + dry-run report, which must list every `Unclassified` root — all 61 local plus the 3 D-15 tracked roots — so Larry can re-map in one local edit). No blockers for subsequent waves in this phase.

---
*Phase: 115-workspace-scanner*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: config/workspace.json
- FOUND: hooks/workspaceConfig.mjs
- FOUND: hooks/__tests__/workspaceConfig.test.mjs
- FOUND (gitignored, on disk, not committed): config/workspace.local.json
- FOUND: commit c4cd72a7 (Task 1)
- FOUND: commit 10099e08 (Task 3)
