---
phase: 77-ci-production-hardening
plan: 02
subsystem: infra
tags: [ci, gitleaks, secrets, security, github-actions]

# Dependency graph
requires:
  - phase: 77-ci-production-hardening/77-01
    provides: CORS hardening already committed to feat/phase-77-ci-hardening

provides:
  - Gitleaks secret-scan CI workflow on master with 3-state classify + CodePulse notify + enforce
  - .gitleaks.toml with useDefault rules + baseline-derived allowlist
  - Verified-clean baseline over full git history (869 commits, gitleaks 8.30.1)

affects: [77-03, any phase adding new test fixtures or planning docs with example keys]

# Tech tracking
tech-stack:
  added: [gitleaks/gitleaks-action@v3]
  patterns:
    - "3-state gitleaks classify: secret_found->exit 1, scan_error->warning+exit 0, clean->exit 0"
    - "Baseline-first: run full-history scan before enabling enforcement"
    - "Path allowlist preferred over broad regexes for false positive suppression"

key-files:
  created:
    - .github/workflows/gitleaks-scan.yml
    - .gitleaks.toml
  modified: []

key-decisions:
  - "Mirror Astridr gitleaks-scan.yml verbatim with exactly 3 diffs: branches master, repo codepulse, no GITLEAKS_LICENSE"
  - "Start .gitleaks.toml with empty regexes; populate only from baseline scan results"
  - "All 5 baseline findings confirmed false positives; none are real secrets"
  - "Expand path allowlist to convex/*.test.ts (was __tests__/ only) and .planning/phases/** (was RESEARCH.md only) after baseline"
  - "Add regexes for R0123456789ABCDEF (PagerDuty test fixture) and r/waterfowlhunting (Reddit subreddit, historical commit)"

patterns-established:
  - "Pattern: Astridr workflow mirror with 3-diff adaptation (branch, repo, license)"
  - "Pattern: Baseline-first gitleaks enforcement - run locally, resolve false positives, then declare CI green"

requirements-completed: [OPS-02]

# Metrics
duration: 25min
completed: 2026-06-10
---

# Phase 77 Plan 02: Gitleaks Secret Scan CI Summary

**Gitleaks CI workflow on master using gitleaks-action@v3, 3-state classify/enforce, CodePulse dashboard notify; full 869-commit baseline confirmed clean (5 false positives allowlisted)**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-10T20:35:00Z
- **Completed:** 2026-06-10T20:55:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Authored `.github/workflows/gitleaks-scan.yml` as a verbatim mirror of the Astridr template with exactly 3 diffs (branches: master, repo: codepulse, no GITLEAKS_LICENSE)
- Authored `.gitleaks.toml` with `useDefault = true` and a CodePulse-specific path allowlist (empty regexes at first; populated from baseline)
- Ran full git history baseline scan (gitleaks 8.30.1, 869 commits scanned, 8.94 MB, 402ms) — confirmed 5 findings, all false positives; history is clean of real secrets
- Updated `.gitleaks.toml` allowlist based on baseline findings; re-run confirmed zero leaks
- No `gitleaks-baseline.json` report committed to the repo

## Three Diffs from Astridr Template

| Diff | Template (Astridr) | CodePulse |
|------|--------------------|-----------|
| Diff 1: branch target | `branches: [main]` | `branches: [master]` |
| Diff 2: notify repo field | `--arg repo "astridr"` | `--arg repo "codepulse"` |
| Diff 3: license | No GITLEAKS_LICENSE (confirmed absent from template) | No GITLEAKS_LICENSE (personal repo — GITHUB_TOKEN sufficient) |

All other content preserved verbatim: `fetch-depth: 0`, `gitleaks-action@v3` with `continue-on-error: true`, `GITHUB_TOKEN`, `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: "true"`, full 3-state classify step (SARIF jq finding count), `CODEPULSE_INGEST_URL`, notify step POSTing to runtime-ingest, enforce step, `permissions: {contents: read, pull-requests: read}`, `actions/checkout@v6`.

## Baseline Scan Result: CLEAN (after allowlisting false positives)

**Binary:** gitleaks 8.30.1 (installed via WinGet)
**Scope:** Full git history — 869 commits, ~8.94 MB
**Initial findings:** 5 (all false positives — see below)
**Final result:** 0 leaks found (clean)

### Finding Disposition

| Finding | File | Commit | RuleID | Disposition | Rationale |
|---------|------|--------|--------|-------------|-----------|
| `R0123456789ABCDEF` | `convex/alertRuleCustom.test.ts` L8 | 20cdd63 | generic-api-key | False positive — allowlisted | PagerDuty routing key test fixture; fabricated hex placeholder |
| `R0123456789ABCDEF` | `convex/alertRuleCustom.test.ts` L19 | 20cdd63 | generic-api-key | False positive — allowlisted | Same test fixture, second test case |
| `R0123456789ABCDEF` | `.planning/phases/59-schema-foundation/59-01-PLAN.md` L516 | 05472b4 | generic-api-key | False positive — allowlisted | Same example value in planning doc (historical commit, not in HEAD) |
| `R0123456789ABCDEF` | `.planning/phases/59-schema-foundation/59-01-PLAN.md` L527 | 05472b4 | generic-api-key | False positive — allowlisted | Same example value in planning doc |
| `r/waterfowlhunting` | `src/pages/Briefings.tsx` L159 | ddab579 | generic-api-key | False positive — allowlisted | Reddit subreddit string in data source array (historical commit, not in HEAD) |

**No real secrets found. No credentials were rotated.**

The `.env.example` `pk_test_your-clerk-key-here` Clerk placeholder is covered by the `.env\.example` path allowlist — it did NOT appear as a finding (confirmed).

## Task Commits

1. **Task 1: Author gitleaks-scan.yml and .gitleaks.toml** — `7b1c364` (feat)
2. **Task 2: Baseline scan + allowlist update** — `c990fd0` (fix)

## Files Created/Modified

- `.github/workflows/gitleaks-scan.yml` — Gitleaks secret-scan CI workflow (Astridr mirror, 3 diffs)
- `.gitleaks.toml` — Gitleaks config: `useDefault = true`, path allowlist for test files/planning docs/historical UI file, 2 baseline-derived regexes

## Decisions Made

- Gitleaks binary (8.30.1) was available on PATH — ran local baseline scan rather than CI report-only fallback.
- Expanded path allowlist beyond the initial plan template after baseline identified that `convex/alertRuleCustom.test.ts` (root-level test file) is not covered by `convex/__tests__/`.
- Added `.planning/phases/**` path allowlist to cover all planning docs (plan + research) since both a PLAN.md and RESEARCH.md can contain example token values.
- Added 2 tightly-scoped regex allowlist entries for the specific false-positive values from baseline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Extended .gitleaks.toml allowlist after baseline scan**
- **Found during:** Task 2 (baseline scan)
- **Issue:** Initial `.gitleaks.toml` allowed `convex/__tests__/` only. The test file `convex/alertRuleCustom.test.ts` is at the convex root, not in `__tests__/`, so it was not covered. Similarly, `.planning/phases/` allowlist only covered `RESEARCH.md` files, not `PLAN.md` files containing the same example values.
- **Fix:** Expanded path allowlist + added 2 regex entries for the specific false-positive values confirmed by manual inspection of each finding.
- **Files modified:** `.gitleaks.toml`
- **Verification:** Re-ran `gitleaks git -v --report-path=gitleaks-baseline.json .` — zero leaks found. Deleted report file.
- **Committed in:** `c990fd0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2: missing allowlist coverage discovered during baseline)
**Impact on plan:** Necessary for plan objective (clean baseline). No scope creep. The plan explicitly anticipated needing to update `.gitleaks.toml` from baseline results.

## Issues Encountered

None beyond the expected false positives from the baseline scan. The plan explicitly anticipated this workflow (Task 2 action block describes the disposition process).

## User Setup Required

None for this plan. The CI workflow will activate automatically on the next push/PR to `master`. No GitHub secrets are required (personal repo — `GITHUB_TOKEN` is sufficient; no `GITLEAKS_LICENSE`).

## Next Phase Readiness

- Plan 77-02 complete. `.github/workflows/gitleaks-scan.yml` and `.gitleaks.toml` ready to merge to `master`.
- On merge, the workflow will run its first enforcing CI scan. Expected result: clean pass (baseline confirmed).
- Plan 77-03 (deploy checklist) can proceed in parallel — no dependency on this plan.

---
*Phase: 77-ci-production-hardening*
*Completed: 2026-06-10*
