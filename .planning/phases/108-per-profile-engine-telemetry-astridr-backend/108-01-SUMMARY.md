---
phase: 108-per-profile-engine-telemetry-astridr-backend
plan: 01
subsystem: telemetry
tags: [contextvars, python, astridr, model-routing, convex-consumer-contract]

# Dependency graph
requires: []
provides:
  - "model_routing events carry a real profileId + model + mode, refuse to emit when either is unresolved"
  - "both live profile ContextVar set-points (agent_processor.process, wiring._ws_agent_launcher) reliably set-and-reset via token pairing"
  - "per-profile emit-on-change memo on ModelRouter, so a hot resolution path costs zero telemetry per call"
  - "docs/astridr-contract.md's model_routing section matches the emitted payload"
affects: [108-04, 108-05, 109]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read astridr/engine/telemetry.py's pre-existing _current_profile_id ContextVar via get_profile_context() from providers/router.py rather than inventing a second ContextVar"
    - "Token-paired set_profile_context()/reset_profile_context() in a try/finally at every live set-point, matching the existing set_goal_context/reset_goal_context idiom (channels/router.py:508-525)"
    - "Refuse-to-emit as two early-return guards in the single shared emit helper, rather than filtering at the ingest boundary"
    - "mode derived once from selection_path via a module-level dict + .get(..., default) catch-all, never an exhaustive match"
    - "Per-profile last-emitted-tuple memo for emit-on-change dedup"

key-files:
  created:
    - "astridr-repo:tests/unit/channels/test_agent_processor_profile_context.py"
  modified:
    - "astridr-repo:astridr/channels/agent_processor.py"
    - "astridr-repo:astridr/engine/bootstrap/wiring.py"
    - "astridr-repo:astridr/providers/router.py"
    - "astridr-repo:docs/astridr-contract.md"
    - "astridr-repo:tests/unit/providers/test_router.py"

key-decisions:
  - "test_router.py: wrapped every existing chat()-driven telemetry test in a new profile_context() helper, and rewrote test_model_routing_default into test_model_routing_default_refuses_to_emit, because D-02's guard makes the plan's literal 4-line-rename instruction incomplete for the 'default' rung case."

patterns-established:
  - "profile_context() pytest contextmanager helper (tests/unit/providers/test_router.py) for any future test asserting on a model_routing payload"

requirements-completed: [ENGINE-01]

# Metrics
duration: ~25min
completed: 2026-08-07
---

# Phase 108 Plan 1: Per-Profile Engine Telemetry Producer Fix Summary

**`ModelRouter._emit_model_routing` now emits `{profileId, model, mode}` sourced from a repaired ContextVar, refuses to emit on an unresolved profile or model, and dedupes per-profile on unchanged resolutions.**

## Performance

- **Duration:** ~25 min (includes a 391.85s / ~6.5min full astridr-repo suite run as the wave-merge gate)
- **Completed:** 2026-08-07
- **Tasks:** 3/3
- **Files modified:** 5 (astridr-repo only; this plan touches no codepulse files)

## Line-Anchor Drift Check (Task 1, required by plan's execution_constraints)

Re-verified live before any edit, per the plan's "a concurrent session is committing to this branch" warning:

```
grep -n "set_profile_context\|async def process" astridr/channels/agent_processor.py
  43:    async def process(
  116:            from astridr.engine.telemetry import set_profile_context
  117:            set_profile_context(profile.id)

grep -n "_emit_model_routing\|selectedModel\|def _resolve_model\|_global_model_override" astridr/providers/router.py
  118, 302, 375, 393, 399, 413, 429, 446, 447, 611, 616, 621  -- all matched the plan's citations exactly

grep -n "_ws_agent_launcher\|_profile_or_default" astridr/engine/bootstrap/wiring.py
  32 (comment), 332 (def), 399 (_profile_or_default), 631 (registration)
```

**No drift found.** Every line anchor the plan cited (`agent_processor.py:116-117`, `router.py:399/413/429/446-447`, `wiring.py:332/399`) matched the live checkout exactly at HEAD `aa9ef473` (the commit the plan was authored against). The branch had NOT moved between planning and execution start this time.

## Task 1 Mutation-Check Result (required by plan's acceptance criteria)

Per the plan: "temporarily delete the `finally` and confirm assertions (ii) and (iii) go RED, then restore."

1. Backed up `agent_processor.py` to a scratchpad file.
2. Deleted the `finally: if _profile_token is not None: reset_profile_context(_profile_token)` block.
3. Ran `pytest tests/unit/channels/test_agent_processor_profile_context.py -x -q`:
   ```
   FAILED test_profile_context_set_during_turn_and_cleared_after
   AssertionError: assert 'personal' is None
    +  where 'personal' = get_profile_context()
   ```
   **Went RED as required** — confirms the `finally` is load-bearing for assertion (ii), not incidental.
4. Restored `agent_processor.py` from the scratchpad backup.
5. Re-ran: `3 passed in 0.24s`.

## Accomplishments

- Both live profile ContextVar set-points (`agent_processor.py:process()`, `wiring.py:_ws_agent_launcher`) now set-and-reset via token pairing in a `finally`, closing the one genuine latent leak this repo's `_current_profile_id` ContextVar had (never reset anywhere before this phase, unlike its `_current_trace_id`/`_current_goal_id`/`_current_round` siblings).
- `wiring.py`'s `_ws_agent_launcher` — the launcher behind every CodePulse `chat.send`/`agent.send_task` turn — previously had **no profile ContextVar set-point at all**. Without this, D-02's refuse-to-emit would have silenced the per-profile engine axis on the operator's own primary surface.
- `_emit_model_routing` reads the profile from `get_profile_context()` (no second, parallel ContextVar), refuses to emit when the profile or the resolved model is unavailable (two independent early-return guards), renames `selectedModel` → `model` and drops the `or "default"` coalesce, and adds `profileId` sourced only from the server-set ContextVar (never caller-supplied — T-108-08).
- `mode` is derived once, at the single emit helper, from `selection_path` via a `.get(..., "inherited")` catch-all covering all 7 live values (`override`, `global-swap-override`, `session-override`, `codepulse-default`, `category-rule`, `default`, `advisor`) plus a pre-registered `profile-swap-override` for plan 108-04.
- A per-profile `(model, mode, selectionPath, status)` emit-on-change memo means a hot resolution path now costs zero telemetry per call once the state stabilizes.
- `docs/astridr-contract.md`'s `### 2.37 model_routing` section corrected in the same commit as the code: field renamed, `profileId` row added, refuse-to-emit behavior documented in prose.

## Task Commits

1. **Task 1: Repair the profile ContextVar lifecycle at both live set-points** - `84f91104` (fix)
2. **Task 2: profileId, refuse-to-emit, and the selectedModel→model rename** - `948d5d5e` (feat)
3. **Task 3: derive mode from selection_path, and emit only on change** - `96a30539` (feat)

All three commits are in `astridr-repo` (branch `feature/brain-swap`). This plan modifies no codepulse files; this SUMMARY.md is the only codepulse-repo artifact.

## `git show --stat HEAD` for every commit (per plan's `<output>` requirement)

```
commit 84f91104867c6c5315d860c548d996cac4b9a356
fix(108-01): repair profile ContextVar lifecycle at both live set-points
 astridr/channels/agent_processor.py                |  14 ++-
 astridr/engine/bootstrap/wiring.py                 |  24 +++-
 .../test_agent_processor_profile_context.py        | 133 +++++++++++++++++++++
 3 files changed, 168 insertions(+), 3 deletions(-)

commit 948d5d5e3b05cf428831657d810cf8da33fc5c26
feat(108-01): profileId, refuse-to-emit, and selectedModel->model rename
 astridr/providers/router.py         |  48 ++++++++-
 docs/astridr-contract.md            |   5 +-
 tests/unit/providers/test_router.py | 189 +++++++++++++++++++++++++-----------
 3 files changed, 180 insertions(+), 62 deletions(-)

commit 96a30539b570e8ce8d86bd013cf934d153f07bf2
feat(108-01): derive mode from selection_path, emit only on change
 astridr/providers/router.py         | 48 ++++++++++++++++++++++++++++
 tests/unit/providers/test_router.py | 63 +++++++++++++++++++++++++++++++++++++
 2 files changed, 111 insertions(+)
```

**Disclosure check:** after every commit I ran `git show --stat HEAD` and confirmed the file list contained ONLY my own intended paths — no files were swept in from the two concurrent sessions committing to this branch during execution (`1e7b39c9 feat(260807-8hj): add GatewayChatProvider adapter` landed between my Task 2 and Task 3 commits; further `260807-8hj` commits landed after Task 3). `git status --short` throughout showed the pre-existing untracked/modified files this plan was told not to touch (`.claude/settings.json`, `.planning/proposed/gateway-cost-shift-and-hygiene.md`) staying untouched by my `git add` calls, which named explicit paths only.

## Files Created/Modified

- `astridr/channels/agent_processor.py` — token-paired `set_profile_context`/`reset_profile_context` around `process()`, reset in `finally` covering every return path and the exception handler
- `astridr/engine/bootstrap/wiring.py` — new profile ContextVar set-point in `_ws_agent_launcher`; `_profile_or_default` hoisted out of the `security_pipeline` conditional so it's computed unconditionally
- `astridr/providers/router.py` — `_emit_model_routing` payload rename + refuse-to-emit guards + profileId + mode derivation + emit-on-change memo; new `_MODE_BY_SELECTION_PATH` module constant; new `self._last_routing_emit` instance dict
- `docs/astridr-contract.md` — `### 2.37 model_routing` field table and prose corrected to match the new payload shape
- `tests/unit/providers/test_router.py` — new `profile_context()` helper, renamed assertions, 6 new test cases (2 refuse-to-emit, 1 profileId, 2 mode-mapping, 1 dedup)
- `tests/unit/channels/test_agent_processor_profile_context.py` — new file, 3 behavioral tests

## Decisions Made

- Reused the pre-existing `_current_profile_id` ContextVar (`astridr/engine/telemetry.py`) exactly as the plan and its research specified, rather than inventing a second one — confirmed by grep that `set_profile_context`/`get_profile_context`/`reset_profile_context` had exactly the shape needed.
- Wrapped every pre-existing `TestModelRoutingTelemetry`/`_emit_model_routing`-adjacent test in a `profile_context()` contextmanager, and rewrote `test_model_routing_default` into `test_model_routing_default_refuses_to_emit` — see Deviations below. This was necessary for the plan's own `<verify>` command (`pytest tests/unit/providers/test_router.py -x -q`) to pass at all once the D-02 guard landed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan's own test instructions] `test_model_routing_default` could not be satisfied by a literal rename**
- **Found during:** Task 2
- **Issue:** The plan's action item 5 lists exactly 4 assertion lines (`:664, :686, :703, :719`) to rename from `payload["selectedModel"]` to `payload["model"]`. Line `:719` belongs to `test_model_routing_default`, which exercises the `_resolve_model` "default" rung (`resolved_model=None`). Under the SAME task's own guard #2 ("resolved_model is falsy → return without sending"), this scenario now sends **zero** telemetry — there is no `payload["model"]` to assert on at all. A literal rename would have left this test asserting against a call that never happens.
- **Fix:** Renamed the test to `test_model_routing_default_refuses_to_emit` and rewrote its body to assert `telemetry.send.assert_not_called()` instead of inspecting a payload — which is exactly what the plan's own action item 2 (guard 2's rationale) and acceptance criteria (dedicated refuse-to-emit test cases) require this scenario to do.
- **Files modified:** `tests/unit/providers/test_router.py`
- **Verification:** `pytest tests/unit/providers/test_router.py -x -q` — 82 passed.
- **Committed in:** `948d5d5e` (Task 2 commit)

**2. [Rule 1 - Bug in plan's own scope] Every pre-existing `router.chat()`-driven telemetry test needed a profile context, not just the 4 cited lines**
- **Found during:** Task 2
- **Issue:** Adding the D-02 "no profile in context → refuse to emit" guard breaks EVERY existing test in `TestModelRoutingTelemetry` (8 tests) plus 3 tests in a different class that call `_emit_model_routing` indirectly through `router.chat()` — none of them set a profile in context, so all of them would see `telemetry.send` never called, failing their `assert_called_once()` assertions. The plan's action items only explicitly named 4 line-level renames and 3 new dedicated test cases; it did not call out that the guard's blast radius covers all 11 pre-existing tests in this file.
- **Fix:** Added a `profile_context()` pytest contextmanager helper at module scope and wrapped every affected `await router.chat(...)` call in it.
- **Files modified:** `tests/unit/providers/test_router.py`
- **Verification:** `pytest tests/unit/providers/test_router.py -x -q` — 79 passed after Task 2 (later 82 after Task 3's additions), all green.
- **Committed in:** `948d5d5e` (Task 2 commit)

**3. [Doc correction, D-08-style] `docs/astridr-contract.md` already had a dedicated `### 2.37 model_routing` section**
- **Found during:** Task 2
- **Issue:** 108-RESEARCH.md's Item 2 stated "the file does not yet have a dedicated section for this event today" and cited only a single table-row hit at `:1175`. Live grep this session found a full pre-existing `### 2.37 model_routing` section (`docs/astridr-contract.md:1156-1188`) with a complete field table, prose describing the 7 `selectionPath` rungs, ingestion, and dashboard notes — not just one stray row.
- **Fix:** Updated the existing section's field table (rename + profileId row + refuse-to-emit prose) in place, rather than authoring a new section. No scope change — the plan's Task 2 action item 4 already targeted "the field table row" at this same location; the correction is that a fuller section existed than the research doc described, which made the edit more complete (adding a `profileId` row, adding refuse-to-emit prose) than a bare one-word rename.
- **Files modified:** `docs/astridr-contract.md`
- **Verification:** Manual read of the corrected section; `grep -c "selectedModel" docs/astridr-contract.md` → 0.
- **Committed in:** `948d5d5e` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule-1 test-scope corrections required by the plan's own guard semantics, 1 doc-scope correction from a stale research claim).
**Impact on plan:** All three were necessary for Task 2's own stated `<verify>` command to pass and for D-02's guard to be tested honestly. No scope creep — no files touched beyond what the plan's `files_modified` frontmatter already listed.

## Issues Encountered

- Full-suite regression run (`pytest tests/ -q`, wave-merge gate) surfaced 1 pre-existing failure unrelated to this plan: `tests/unit/automation/test_pipes.py::TestPipeManagerScan::test_scan_updates_changed_pipes`, a filesystem-mtime-granularity race in `astridr/automation/pipes.py`'s `PipeManager.scan()` (confirmed flaky by re-running in isolation: fail, fail, pass). No file this plan touches has any relationship to that module. Logged in `deferred-items.md`, not fixed (SCOPE BOUNDARY rule). Suite otherwise: 9795 passed, 112 skipped, 1 xpassed.

## Known Stubs

None — this plan only modifies backend telemetry-producer code and its tests; no UI/data-rendering surface is touched.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-108-07 through T-108-11, T-108-SC) — no new network endpoints, auth paths, file access patterns, or schema changes were introduced.

## Next Phase Readiness

- `model_routing` events now carry a real `profileId`/`model`/`mode`; CodePulse's existing `case "model_routing"` (`convex/runtimeIngest.ts:717-748`) and `activeEngine.ts`'s `recordRouting` should start accepting real rows once a profiled turn runs against the deployed stack (D-16's live-integration gate is a later plan's job, not this one's).
- `_MODE_BY_SELECTION_PATH` already has `"profile-swap-override": "pinned"` pre-registered — plan 108-04 (the per-profile override itself) needs no mapping code addition when it lands.
- No blockers for 108-02 through 108-07. This plan's `<verification>` steps 1-3 are all satisfied; step 4 (per-commit disclosure) is satisfied and documented above.

## Self-Check: PASSED

Files (astridr-repo):
- FOUND: astridr/channels/agent_processor.py
- FOUND: astridr/engine/bootstrap/wiring.py
- FOUND: astridr/providers/router.py
- FOUND: docs/astridr-contract.md
- FOUND: tests/unit/providers/test_router.py
- FOUND: tests/unit/channels/test_agent_processor_profile_context.py

Commits (astridr-repo, `git log --oneline --all | grep <hash>`):
- FOUND: 84f91104 (Task 1)
- FOUND: 948d5d5e (Task 2)
- FOUND: 96a30539 (Task 3)

Files/commits (codepulse repo):
- FOUND: .planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-01-SUMMARY.md
- FOUND commit: 6163a09a (plan-completion metadata commit)

---
*Phase: 108-per-profile-engine-telemetry-astridr-backend*
*Plan: 01*
*Completed: 2026-08-07*
