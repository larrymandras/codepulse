---
phase: 93-eval-pipeline-quality-kpis
plan: 03
subsystem: astridr-integration
tags: [cross-repo, langfuse, task_quality, fire-and-forget, eval-pipeline]

# Dependency graph
requires: ["93-01"]
provides:
  - "astridr-repo: langfuse_eval.py spawn_score dual-writes Langfuse (unchanged) + a fire-and-forget task_quality mirror POST to CodePulse /runtime-ingest"
  - "astridr-repo: _post_task_quality (module-level, env-gated, never-raises) + _CONVEX_URL/_CODEPULSE_INGEST_KEY env anchors"
  - "astridr-repo: spawn_score gained an optional profile_id kwarg carrying persona identity directly (RESEARCH Pitfall 1)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-03 independent gates: Langfuse write gated on self._enabled; CodePulse mirror gated independently on _CONVEX_URL/_CODEPULSE_INGEST_KEY — either can be on/off without affecting the other"
    - "Phase 90 war-room dispatcher fire-and-forget mirror precedent reused verbatim: skip-if-unset guard, pooled httpx client, swallow-all-exceptions, log-on-bad-status"

key-files:
  created: []
  modified:
    - "C:/Users/mandr/astridr-repo/astridr/integrations/langfuse_eval.py"
    - "C:/Users/mandr/astridr-repo/tests/test_langfuse_eval.py"

key-decisions:
  - "Added an optional profile_id kwarg to spawn_score (default \"\", mirror payload coalesces to \"unknown\") rather than threading a required param through every existing call site — the plan's file scope excludes astridr/agent/self_improvement.py, so today's only caller (spawn_evaluation) still omits it; a future plan can pass a real persona id once the caller surface is in scope"
  - "Restructured spawn_score's top-level `if not self._enabled: return` into two independent `if` gates (Langfuse write, CodePulse mirror) so the mirror can fire even when Langfuse itself is disabled — matches the plan's D-03 'independent gates' interface note and the threat model's T-93-09 mitigation"
  - "idempotencyKey = f\"{session_id}:{agent_id}:{name}\" (session/agent/score-name composite) rather than a Langfuse score id, since _write_score never returns/exposes one to spawn_score's synchronous caller"

requirements-completed: [EVAL-01]

# Metrics
duration: ~15min
completed: 2026-07-05
---

# Phase 93 Plan 03: EVAL-01 Producer Mirror (astridr-repo → CodePulse) Summary

**`langfuse_eval.py`'s `spawn_score` now dual-writes: the unchanged Langfuse score write plus a new fire-and-forget `task_quality` mirror POST to CodePulse's `/runtime-ingest`, gated independently on `CONVEX_URL`/`ASTRIDR_INGEST_API_KEY` and never able to raise into the score path.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 2 (both in `astridr-repo`, cross-repo from this CodePulse worktree)

## Accomplishments
- Ástríðr's `spawn_score` now mirrors every `task_quality` score to CodePulse's ingest contract from Plan 01 (`{"eventType": "task_quality", "data": {...}}`), closing the producer half of EVAL-01 — without this, Plan 01's ingest case never receives real data.
- The mirror follows the Phase 90 war-room dispatcher precedent exactly: module-level env anchors, pooled `httpx` client, `Authorization: Bearer` header, skip-if-unset guard, log-and-swallow on bad status or exception — it can never block or raise into the Langfuse write path (T-93-09).
- The two writes (Langfuse, CodePulse) are now independently gated (D-03): disabling either one has zero effect on the other.
- Producer tests pin: correct mirror body/headers, no-POST-when-unconfigured, and never-raises-on-failure — both via a direct `_post_task_quality` call and via `spawn_score` end-to-end.

## Task Commits

Both tasks committed atomically **in `astridr-repo`** (not this CodePulse worktree — this is a cross-repo plan):

1. **Task 1: Add the CodePulse mirror POST to spawn_score** — `b63a4674` (feat, astridr-repo)
2. **Task 2: Extend the producer tests** — `c5da8f30` (test, astridr-repo)

**Plan metadata / SUMMARY:** this commit (codepulse worktree)

## Files Created/Modified
- `C:/Users/mandr/astridr-repo/astridr/integrations/langfuse_eval.py` — `_CONVEX_URL`/`_CODEPULSE_INGEST_KEY` env anchors, `_post_task_quality` fire-and-forget mirror function, `spawn_score` gained `profile_id` kwarg + independently-gated mirror `asyncio.create_task` call site (tracked via the existing `self._tasks` bookkeeping)
- `C:/Users/mandr/astridr-repo/tests/test_langfuse_eval.py` — 4 new tests: mirror body/headers assertion, skip-when-unconfigured, `_post_task_quality` swallows exceptions directly, `spawn_score` mirror failure doesn't propagate

## Decisions Made
- `profile_id` added as an optional kwarg (default `""`) rather than required — the plan's file scope is limited to `langfuse_eval.py` + its test file, so `self_improvement.py`'s existing `spawn_evaluation` call site (the only current caller) is untouched and will pass `"unknown"` via the mirror's own `profile_id or "unknown"` coalescing until a future plan threads real persona identity through the caller.
- Restructured the single `if not self._enabled: return` guard into two independent `if` blocks so Langfuse-disabled deployments still get the CodePulse mirror (and vice versa) — required to satisfy the plan interface's explicit "D-03 independent gates" language and the threat model's T-93-09 disposition.
- `idempotencyKey` is a producer-generated composite (`session_id:agent_id:name`) rather than reusing a Langfuse-assigned score id, since `_write_score`'s Langfuse SDK call is fire-and-forget from `spawn_score`'s perspective and never surfaces an id back synchronously.

## Deviations from Plan

None — plan executed as written. The `profile_id` kwarg addition and the two-gate restructuring were both anticipated by the plan's own interface/threat-model language (RESEARCH Pitfall 1, D-03, T-93-09), not undocumented scope creep.

## Cross-Repo Execution Notes
- All code + test changes live in `astridr-repo` (current branch: `main`, no worktree/branch created there per instructions).
- `astridr-repo` had one pre-existing unrelated uncommitted change (`config/tool-access-policy.yaml`) present before this plan started and left untouched throughout — verified via `git status --short` before and after both commits.
- Verification commands run from `astridr-repo` root:
  - `python -c "import ast; ast.parse(open('astridr/integrations/langfuse_eval.py').read()); print('ok')"` → `ok`
  - `python -m pytest tests/test_langfuse_eval.py -q` → `9 passed in 0.04s`

## Issues Encountered
None.

## User Setup Required
None for this plan's code change. Per the plan's `user_setup` block, the mirror only activates in a live environment once `CONVEX_URL` (CodePulse's `.convex.site` HTTP base, tidy-whale-981) and `ASTRIDR_INGEST_API_KEY` are set in the Ástríðr process environment — both already exist as Phase 90 war-room/transcript mirror anchors, so no new secret provisioning is required. Live round-trip verification against prod Convex is explicitly deferred to Plan 06 (D-04) per this plan's `<verification>` section.

## Next Phase Readiness
- The producer side of EVAL-01 is complete and test-pinned. Plan 01's `task_quality` ingest case (already merged) can now receive real traffic once the env vars above are set in a running Ástríðr deployment.
- No blockers identified for remaining Phase 93 plans.

---
*Phase: 93-eval-pipeline-quality-kpis*
*Completed: 2026-07-05*

## Self-Check: PASSED

- `C:/Users/mandr/astridr-repo/astridr/integrations/langfuse_eval.py` — FOUND, modified as described
- `C:/Users/mandr/astridr-repo/tests/test_langfuse_eval.py` — FOUND, modified as described
- Commit `b63a4674` — FOUND in `astridr-repo` git log
- Commit `c5da8f30` — FOUND in `astridr-repo` git log
- `python -m pytest tests/test_langfuse_eval.py -q` — 9 passed
