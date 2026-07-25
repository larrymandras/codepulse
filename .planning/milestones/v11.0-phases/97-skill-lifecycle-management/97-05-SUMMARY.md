---
phase: 97-skill-lifecycle-management
plan: 05
subsystem: api
tags: [convex, forge, intake, error-handling, ux-copy]

# Dependency graph
requires:
  - phase: 97-skill-lifecycle-management (Plan 01, forge repo)
    provides: "mapExitCodeToResult emits structured write-refused:<kind>:<raw> / post-placement-warning:<kind>:<raw> error strings for exit codes 4-9, with report kept verbatim (D-P8-10)"
provides:
  - "synthesizeWriteRefusalReport pure adapter in convex/forge.ts: parses the daemon's write-refused:<kind>: / post-placement-warning:<kind>: error and composes the D-07 house copy"
  - "ackCommand wiring: for intake commands, the adapter runs before capAckReport and patches both row.error (actionable copy, no internal token) and row.report (synthetic findings entry + verdict flip for refusals; verdict unchanged for post-placement warnings)"
  - "Full unit coverage (18 new tests) for all 6 daemon error kinds, null/unmatched pass-through, non-object-report defensiveness, findings-append, and non-intake (launch/stop) pass-through"
affects: [97-skill-lifecycle-management-ui, skills-intake-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Convex-side defensive reshape-before-persist adapter (mirrors capAckReport's established style): never throws on malformed input, composes a house-copy string once and reuses it in two output locations (row.error + report.findings[].message)"

key-files:
  created: []
  modified:
    - convex/forge.ts
    - convex/forge.test.ts

key-decisions:
  - "Adapter lives Convex-side in ackCommand, not daemon-side (Open Question 2, locked in the plan) — forge's intake-types.ts freezes D-P8-10 (daemon never synthesizes a report), so reshaping must happen after the wire"
  - "House copy is composed ONCE per ack and reused for both the persisted error field and the synthesized finding's message — because IntakeSheet's failed branch renders ONLY row.error, composing into findings alone would leave the raw internal token on screen"
  - "Post-placement-warning kinds (catalog/ledger) never say 'nothing was written' and leave report.verdict unchanged — the atomic write already succeeded; only a secondary step failed"
  - "Collision skill-name extraction is best-effort (regex over the raw CLI reason's path-like prefix, last path segment); falls back to a name-less phrasing rather than guessing when the shape doesn't match"

patterns-established:
  - "Compose-once-reuse-twice: when a house-copy string must appear in two independent output fields, compute it once and assign to both — avoids the two fields drifting out of sync"

requirements-completed: [INTAKE-04]

# Metrics
duration: 4min
completed: 2026-07-18
---

# Phase 97 Plan 05: Write-Refusal House-Copy Adapter (INTAKE-04) Summary

**Convex-side `synthesizeWriteRefusalReport` adapter in `ackCommand` turns the daemon's `write-refused:<kind>:`/`post-placement-warning:<kind>:` error strings into the D-07 actionable house copy, written into both `row.error` (what IntakeSheet's failed branch actually renders) and a synthesized `report.findings` entry with a verdict flip.**

## Performance

- **Duration:** 4 min (commit-to-commit)
- **Started:** 2026-07-18T11:16:xx-04:00
- **Completed:** 2026-07-18T11:19:09-04:00
- **Tasks:** 2 completed
- **Files modified:** 2 (`convex/forge.ts`, `convex/forge.test.ts`)

## Accomplishments

- `synthesizeWriteRefusalReport(report, error, destination)` — a pure, exported helper in `convex/forge.ts` that parses the daemon's structured error prefix, composes kind-accurate house copy exactly once, and returns `{ report, error }` with a synthetic `{ rule_id: 'write-refused', severity, path: null, line: null, message }` finding appended (existing findings preserved).
- Refused kinds (`unrecoverable`/`collision`/`cold-marker`/`project-git`) → `severity: 'error'`, `verdict: 'reject'`, error copy: collision gets the name+destination+next-step pattern, the other three get `"Install failed: {reason}. Nothing was written."`
- Post-placement-warning kinds (`catalog`/`ledger`) → `severity: 'warning'`, verdict **unchanged**, error copy: `"Installed, but a post-placement step failed: {reason}."` (never "nothing was written" — the file is on disk).
- `ackCommand` now calls the adapter before `capAckReport` for `commandType === 'intake'` acks only; non-intake (launch/stop) acks and null/unmatched errors pass through the exact same patch shape as before.
- 18 new unit tests: 12 for the pure helper (all 6 kinds, null pass-through, unmatched pass-through, findings-append, two defensive-reshape cases, a name-less-fallback case, and a behavior-guard test that fails if only findings were composed and `error` left as the raw token), 3 for the `ackCommand` wiring via the test file's hand-maintained mirror (collision→failed, catalog-warning→done, launch-ack pass-through).

## Task Commits

Each task was committed atomically:

1. **Task 1: `synthesizeWriteRefusalReport` pure helper** - `b0293c7` (feat)
2. **Task 2: Wire the adapter into `ackCommand`** - `37affa1` (feat)

**Plan metadata:** this commit (docs: summary)

## Files Created/Modified

- `convex/forge.ts` — added `parseWriteRefusalError`, `extractSkillNameFromReason`, `composeWriteRefusalHouseCopy`, and the exported `synthesizeWriteRefusalReport` (placed right after `capAckReport`, mirroring its defensive style); wired the adapter into `ackCommand`'s intake branch before `capAckReport`.
- `convex/forge.test.ts` — imported `synthesizeWriteRefusalReport`; added a new `describe` block with 12 pure-function tests; extended the hand-maintained `ackCommandMirror` (this repo's convex-test-free DB-mock convention, per the file's own header comment) with the identical adapter wiring; added 3 integration-style tests via that mirror.

## Decisions Made

- **Adapter location:** Convex-side in `ackCommand`, per the plan's locked decision (Open Question 2) — no alternative considered during execution, the plan's rationale (D-P8-10 freezes the daemon's report-shape contract) was followed as specified.
- **Compose-once, reuse-twice:** the house copy is a single computed string assigned to both `error` and the synthetic finding's `message`, per the plan's explicit "the SAME collision house-copy string" requirement — this was implemented exactly as specified, not a deviation.
- **Skill-name extraction:** best-effort regex (`^(.*?)\s+already exists`) over the raw CLI reason, taking the last path segment. Verified against the real forge source (`C:\Users\mandr\forge\src\process\intake-exec.ts` and its test file) to confirm the exact raw-message shape (`"C:/skills/foo already exists and differs from the candidate -- pass --allow-overwrite to write here"`) before choosing the extraction regex — this is not a documented contract, just the observed live format, so the fallback (name-less phrasing) exists specifically to avoid a hard dependency on that exact prose.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<action>` and `<behavior>` blocks were implemented as specified; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

None. Read the live forge source (`C:\Users\mandr\forge\src\process\intake-exec.ts`, already committed on `forge`'s `master` per the DEPENDENCY_CONTEXT) before writing the collision skill-name extractor, to ground the regex against the CLI's real message shape rather than guessing — this was a research step, not a blocker.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `convex/forge.ts` and `convex/forge.test.ts` are the only files touched; `convex/_generated/api.d.ts` and `convex/retention.ts` (pre-existing uncommitted operator work) were verified untouched before and after both commits.
- No `convex codegen`/`convex deploy` was run — `ackCommand`'s existing public signature and validators are unchanged; only its internal handler body was extended.
- `npx vitest run convex/forge.test.ts` (131 passed, 21 todo) and the full `npm test` (2026 passed, 193 todo, 190 files) both green; `npx tsc --noEmit` clean.
- Live UAT (a real collision/exit-8/exit-9 install rendering through `IntakeSheet`/`IntakeReportView`) is out of scope for this plan (server-side unit coverage only, per the plan's `<verification>` block) — remains a manual/live check per 97-RESEARCH.md's validation architecture table for INTAKE-04.

---
*Phase: 97-skill-lifecycle-management*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: `.planning/phases/97-skill-lifecycle-management/97-05-SUMMARY.md`
- FOUND: `convex/forge.ts`
- FOUND: `convex/forge.test.ts`
- FOUND commit: `b0293c7` (Task 1)
- FOUND commit: `37affa1` (Task 2)
