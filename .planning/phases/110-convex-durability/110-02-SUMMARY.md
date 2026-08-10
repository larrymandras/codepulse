---
phase: 110-convex-durability
plan: 02
subsystem: infra
tags: [convex, self-hosted, memory, docker, github-api]

# Dependency graph
requires: []
provides:
  - "DUR-03 closed on the knob-absent branch: no general-purpose memory-bounding knob found among the six candidates probed on the live convex-backend binary"
  - "Control-paired evidence transcript (.planning/phases/110-convex-durability/110-MEMORY-EVIDENCE.md) covering the knob probe, upstream #495/#522/#525 status, and a timezone-reconciled current growth reading"
  - "CLAUDE.md D-11 bullet recording ConvexNightlyRestart as a deliberate, evidence-backed mitigation"
affects: [110-convex-durability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Control-paired absence claims (known-present + known-absent grep in the same transcript block) for any 'X was not found' evidence write-up"
    - "Verdict-beneath-transcript ordering for evidence files: never state a conclusion before the raw output that produced it"

key-files:
  created:
    - .planning/phases/110-convex-durability/110-MEMORY-EVIDENCE.md
    - .planning/phases/110-convex-durability/110-02-SUMMARY.md
  modified:
    - CLAUDE.md

key-decisions:
  - "DUR-03 closes as root-cause identified and documented (knob-absent branch), not resolved — no live experiment isolated a single cause, and D-09 declines to fund one"
  - "D-10 does not apply: no bounding knob was found, so there is nothing to enable and no measured-trial decision was needed"
  - "The growth-rate figure quoted in the evidence file and CLAUDE.md was corrected from ~0.82 GiB/h to ~1.04 GiB/h after the orchestrator's spot-check found a timezone confound (restart-convex.log is local EDT, the date -u reading is UTC) — corrected in its own atomic commit before Task 3 closed"

patterns-established:
  - "Any elapsed-time derivation that mixes a locally-timestamped log with a UTC command output must reconcile both to one timezone before subtracting — this machine runs EDT (UTC-4)"

requirements-completed: [DUR-03]

# Metrics
duration: continuation session (Tasks 1-2 by prior executor; this session: 1 correction + Task 3)
completed: 2026-08-10
---

# Phase 110 Plan 02: DUR-03 Memory-Growth Root-Cause Summary

**DUR-03 closed on the knob-absent branch: no memory-bounding knob exists on the live convex-backend binary among six candidates probed; strongest candidate contributor is upstream issue #495 (unmerged PR #522); ConvexNightlyRestart recorded in CLAUDE.md as deliberate, evidence-backed mitigation.**

## Performance

- **Tasks:** 3/3 complete (Tasks 1-2 by prior executor, Task 3 + correction by this continuation session)
- **Files modified:** 3 (110-MEMORY-EVIDENCE.md, CLAUDE.md, this summary)

## Accomplishments

- Control-paired knob probe against the live `convex-backend` binary: six candidate memory-bounding env vars checked, each with a known-present and known-absent control in the same transcript block.
- Upstream `get-convex/convex-backend` issue #495 and #525 re-verified live at write-up time (`state`, `stateReason`, author), plus PR #522's merge state (`OPEN`, `mergedAt: null` — unmerged).
- #525 ruled out for this deployment with a positive-controlled schema grep (0 `.searchIndex()`/`.vectorIndex()` usages against 288 `.index()` calls).
- Growth-rate timezone confound found by the orchestrator's spot-check, verified independently in this session (`date -u` vs `date` showed a live 4h EDT offset), and corrected: the true inter-restart window is ~14.72h, not ~18.72h, and the true rate is ~1.04 GiB/h, not ~0.82 GiB/h.
- One new pointer-shaped bullet added to CLAUDE.md's Self-Hosted Convex operational rules, carrying the corrected rate.
- Operator sign-off recorded (Task 3), closing DUR-03.

## Task Commits

1. **Task 1: Probe live backend for bounding knob + re-verify upstream state** - `b27bca23` (docs, prior executor)
2. **Task 2: Write 110-MEMORY-EVIDENCE.md + D-11 CLAUDE.md bullet** - `4c976b62` (docs, prior executor)
3. **Correction: fix DUR-03 growth-rate timezone confound** - `5695724a` (docs, this session — see Deviations below)
4. **Task 3: Operator sign-off checkpoint** - no code commit (checkpoint task; response recorded below)

**Plan metadata:** this summary's own commit (below)

## Files Created/Modified

- `.planning/phases/110-convex-durability/110-MEMORY-EVIDENCE.md` - DUR-03 evidence transcript: knob probe, upstream issue/PR status, #525 ruling-out, timezone-reconciled growth reading, verdict
- `CLAUDE.md` - One new bullet in "Self-Hosted Convex — Operational Rules" naming `ConvexNightlyRestart` as deliberate, with the corrected ~1.04 GiB/h figure

## Decisions Made

- **Knob-absent branch selected.** All six probed candidates (`DOCUMENT_RETENTION_DELAY`, `UDF_CACHE_MAX_SIZE`, `MODULE_CACHE_MAX_SIZE_BYTES`, `INDEX_CACHE_SIZE`, `DOCUMENTS_IN_MEMORY`, `FUNRUN_*`) are compiled into the running binary and default to a bounded size; only `DOCUMENT_RETENTION_DELAY` is actually set, and it governs tombstone GC timing, not a working-set cap. Their summed budget (~1.44–2.44 GiB) cannot explain the observed multi-GiB climb.
- **D-10 does not apply.** No knob was found, so there was nothing to enable and no live environment variable was changed at any point in this plan.
- **Scope-limited wording preserved.** The verdict states "no bounding knob was found among the candidates investigated" and "#495 is the strongest candidate contributor" — not "no knob exists" and not "#495 is the cause." No live experiment isolated a single cause, and D-09 explicitly declines to fund one.
- **Growth-rate correction.** See Deviations below — this is itself part of the DUR-03 evidence record, not a silent overwrite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed timezone confound in the growth-rate derivation**
- **Found during:** Orchestrator spot-check after Task 2, before Task 3's checkpoint was resolved
- **Issue:** `110-MEMORY-EVIDENCE.md`'s "Implied current-cycle rate" derivation subtracted `restart-convex.log`'s `2026-08-10 02:00:37` timestamp directly against the `date -u` UTC reading `2026-08-10 20:43:48` without reconciling clocks. `restart-convex.log` is written by a local Windows scheduled task in **local** time; this machine runs Eastern Daylight Time (verified live this session: `date -u` → `...T21:11:02Z` vs `date` → `...17:11:02-0400`, a 4h offset). The unreconciled subtraction inflated the elapsed window to 18.72h (should be 14.72h) and understated the rate as ~0.82 GiB/h (should be ~1.04 GiB/h).
- **Fix:** Independently re-verified the timezone offset and the arithmetic (15,688 MiB / 14.72h ≈ 1.04 GiB/h), corroborated against the orchestrator's own `docker stats` sample (23.57 GiB at 16:44 local ≈ 20:44 UTC, consistent with the 23.31 GiB reading at 20:43:48 UTC). Fixed the figure in all three locations it appeared in `110-MEMORY-EVIDENCE.md` (the §D growth-reading derivation, the D-09 knob-probe verdict's climb comparison, and the final `## Verdict` section), added an inline correction note (not a silent overwrite — the timezone-confound finding is itself DUR-03 process evidence) explaining the original error and the reconciliation. Updated CLAUDE.md's D-11 bullet's single figure (`~0.82 GiB/h` → `~1.04 GiB/h`); no other bullet touched.
- **Files modified:** `.planning/phases/110-convex-durability/110-MEMORY-EVIDENCE.md`, `CLAUDE.md`
- **Verification:** Re-ran the timezone probe live in this session before writing the fix; confirmed all `0.82`/`18.7` occurrences replaced (one remaining match is inside the correction note itself, describing the superseded figure); re-ran the credential-shape scan on the evidence file (clean — no `sk_`/`sb_`/`Bearer `/`NAME=VALUE` patterns); `git diff HEAD -- CLAUDE.md` showed exactly the one figure changed, zero other bullets touched; `git show --stat HEAD` after the correction commit showed only the two intended files.
- **Committed in:** `5695724a` (standalone correction commit, separate from the original Task 1/2 commits, per the orchestrator's dispatch)

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1)
**Impact on plan:** The correction changes only a derived figure quoted in two places (the evidence file's growth-reading narrative and CLAUDE.md's D-11 bullet). It does not change the DUR-03 verdict, the knob-absent branch selection, the #495/#522/#525 findings, or any control pair — all of which were independently verified by the orchestrator and stand as originally written.

## Issues Encountered

None beyond the growth-rate correction documented above.

## Operator Sign-Off (Task 3)

**Operator's verbatim response:** "Fix the number, then approve."

**Interpretation, confirmed with the operator explicitly:** the operator reviewed the checkpoint and **approved closing DUR-03 as documented (knob-absent branch)**, conditional on the growth-rate timezone correction being applied first. That correction is complete (commit `5695724a`, described above).

**D-10 applicability:** Does not apply. The knob-absent branch means no bounding knob was found, so there was no D-10 call to make — no environment variable was enabled or changed on the live `convex-backend` instance at any point in Task 1, the correction, or Task 3. Confirmed: `docker inspect convex-backend` was not re-run to change config in this session, and no `docker exec`/`npx convex` write or restart command was issued.

**Live-instance safety:** This session made zero mutating calls against `convex-backend`. No Convex query, no restart, no env var change. `npx convex env list` was not run. The only live commands issued in this session were read-only shell probes (`date`, `date -u`) to independently verify the timezone offset, and file reads/greps against the local repo and `restart-convex.log`.

**Credential-shape scan (re-run before commit):** Clean. No `sk_`, `sb_`, `Bearer `, `convex-self-hosted|`, `INSTANCE_SECRET=<value>`, or other `NAME=VALUE`-shaped secret pattern found in `110-MEMORY-EVIDENCE.md`.

## Next Phase Readiness

DUR-03 is closed. No follow-up work is implied by this plan beyond what the evidence file already flags for future readers: re-check PR #522's merge state before citing this evidence file as current beyond a few weeks out, since an upstream merge is the fact most likely to change the operational picture.

---
*Phase: 110-convex-durability*
*Completed: 2026-08-10*
