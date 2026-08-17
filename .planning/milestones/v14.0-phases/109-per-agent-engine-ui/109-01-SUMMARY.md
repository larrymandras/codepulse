---
phase: 109-per-agent-engine-ui
plan: 01
subsystem: api

# Cross-repo note: this plan's source changes land in a DIFFERENT repo
# (C:/Users/mandr/astridr-repo, branch feature/brain-swap) than this
# SUMMARY (codepulse). See "Cross-Repo Commits" below for the astridr hashes.
tags: [python, websocket, model-router, control-verbs, pytest, tdd]

# Dependency graph
requires: []
provides:
  - "ModelRouter.get_all_profile_overrides() / get_all_profile_override_sources() — public enumerators over the per-profile override stores (astridr/providers/router.py)"
  - "build_swap_state_payload's profile_overrides key — per-profile model+source map, empty (never omitted) when router is None (astridr/engine/control_verbs/dispatch.py)"
  - "swap.catalogue brain-target ack's default_profile_id field, sourced from astridr's own resolved config (astridr/api/ws_commands.py, astridr/engine/bootstrap/wiring.py)"
affects: [109-02, 109-03, 109-04, 109-05, 109-06, 109-07, 109-08, 109-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN via git-checkout revert: implementation edits were backed up, source files reverted to HEAD to prove the new tests genuinely fail, tests committed as RED, implementation restored and re-verified as GREEN, then committed separately — used because the plan's tasks were written implementation-first."
    - "New optional constructor params default to the status-quo value ('personal') so untouched call sites (bare CommandDispatcher(...) in older tests) keep passing without modification."

key-files:
  created: []
  modified:
    - "C:/Users/mandr/astridr-repo/astridr/providers/router.py"
    - "C:/Users/mandr/astridr-repo/astridr/engine/control_verbs/dispatch.py"
    - "C:/Users/mandr/astridr-repo/astridr/api/ws_commands.py"
    - "C:/Users/mandr/astridr-repo/astridr/engine/bootstrap/wiring.py"
    - "C:/Users/mandr/astridr-repo/tests/unit/providers/test_router.py"
    - "C:/Users/mandr/astridr-repo/tests/unit/engine/test_ws_commands.py"

key-decisions:
  - "D-05 implemented exactly as researched: build_swap_state_payload's profile_overrides key is always present (empty dict when router is None or when nothing is overridden); a cleared/restored profile is absent from the map, never null."
  - "D-03 implemented on swap.catalogue's brain-target ack only, not voice and not readiness.get, per the plan's explicit rejection of readiness.get (its only caller stops polling once ready)."
  - "default_profile_id threads through a NEW CommandDispatcher constructor param (default \"personal\") fed from bootstrap/core.py's existing config.profiles[0].id computation — reuses the exact value _ws_agent_launcher's ContextVar fallback already computes, rather than re-deriving it inside ws_commands.py."
  - "Corrected two plan file citations against live test-suite structure: Task 1's build_swap_state_payload tests went into test_router.py (no test_dispatch.py exists) per the plan's own file list; Task 2's tests went into tests/unit/engine/test_ws_commands.py (the actual existing home for every swap.catalogue test, with its dispatcher/auth/_reset_swap_catalogue_deps fixtures) rather than the plan-cited tests/unit/api/test_ws_commands_frame.py."

patterns-established:
  - "Pattern: enumerator methods over a per-key override store return a shallow dict COPY, never a live view — established for get_all_profile_overrides/get_all_profile_override_sources, callable by any future per-key override store in this codebase."

requirements-completed: [ENGINE-03, ENGINE-04]

# Metrics
duration: 17min
completed: 2026-08-09
---

# Phase 109 Plan 01: Astridr per-profile override enumerators + default_profile_id Summary

**Added ModelRouter's missing per-profile override enumerator, wired it into swap.state's new `profile_overrides` map, and reported astridr's authoritative `default_profile_id` on the `swap.catalogue` ack — closing the two backend gaps every downstream Phase 109 CodePulse plan depends on.**

## Performance

- **Duration:** ~17 min
- **Completed:** 2026-08-09T12:36:39Z
- **Tasks:** 3 (Tasks 1–2 executed as designed TDD tasks; Task 3 was verification + evidence-gathering only, no new source changes were needed)
- **Files modified:** 6 (all in astridr-repo)

## Accomplishments

- `ModelRouter.get_all_profile_overrides()` / `get_all_profile_override_sources()` — the enumerator pair that did not exist before this plan (research correctly identified this gap; CONTEXT.md's cited accessor call sites were for the setter, not an enumerator).
- `build_swap_state_payload` (and therefore both `swap.state` pushes and the `swap.get_state` ack) now carries `profile_overrides: {profile_id: {model, source}}`, absent-not-null per profile, empty dict (never omitted) when `router` is `None`.
- `swap.catalogue`'s brain-target ack now carries `default_profile_id`, sourced from astridr's own resolved config via a newly-threaded `CommandDispatcher(default_profile_id=...)` constructor param — not derived from Convex ordering.
- Full `tests/unit/providers tests/unit/engine tests/unit/api` regression (1907 tests) is green.
- Branch divergence and the stale CORS default were measured live and are reported below, per the plan's explicit "flag, do not fix" instruction.

## Task Commits

All commits are in **astridr-repo** (`C:/Users/mandr/astridr-repo`, branch `feature/brain-swap`) — this plan makes no CodePulse source changes.

1. **Task 1 RED — failing tests for profile override enumerators and swap.state map** — `10503e4f` (test)
2. **Task 1 GREEN — ModelRouter enumerators + profile_overrides on swap.state** — `effb7a48` (feat)
3. **Task 2 RED — failing tests for default_profile_id on swap.catalogue ack** — `411e0253` (test)
4. **Task 2 GREEN — default_profile_id on swap.catalogue brain ack** — `8c4842f1` (feat, includes the `_FakeModelRouterForSwapState` test-double fix, see Deviations)
5. **Task 3 — no new source changes** (see below); evidence recorded in this SUMMARY per the plan's own instruction.

**Plan metadata:** this commit, in **codepulse** (`docs(109-01): complete Astridr per-profile override enumerators plan`)

_TDD note: for both tasks, the implementation was written first, then TEMPORARILY REVERTED to HEAD (`git checkout --`) with the finished implementation backed up to the scratchpad, so the new tests could be run and proven to genuinely fail (RED) before the implementation was restored and re-verified (GREEN). This produces the same RED→GREEN commit sequence the TDD gate requires, despite the plan text being implementation-first._

## Files Created/Modified

- `astridr/providers/router.py` — added `get_all_profile_overrides()` / `get_all_profile_override_sources()`, each returning a shallow copy of the backing store.
- `astridr/engine/control_verbs/dispatch.py` — `build_swap_state_payload` gains `profile_overrides`; docstring extended to state it is the same in-memory-only class of value as `model_override`.
- `astridr/api/ws_commands.py` — `CommandDispatcher.__init__` gains `default_profile_id: str = "personal"`; `_handle_swap_catalogue`'s brain-target return dict gains `default_profile_id`.
- `astridr/engine/bootstrap/wiring.py` — `_setup_ws_telemetry`'s `CommandDispatcher(...)` construction now passes `default_profile_id=default_profile_id` (the parameter already existed on `_setup_ws_telemetry` and was already used by `_ws_agent_launcher`; it just wasn't reaching `CommandDispatcher` before).
- `tests/unit/providers/test_router.py` — new `TestProfileOverrideEnumerators` and `TestBuildSwapStatePayloadProfileOverrides` classes (9 tests).
- `tests/unit/engine/test_ws_commands.py` — 3 new tests for `default_profile_id`, plus a 2-method fix to `_FakeModelRouterForSwapState` (see Deviations).

## Decisions Made

See frontmatter `key-decisions`. In summary: D-03 and D-05 implemented exactly as CONTEXT.md/RESEARCH.md specified, with two plan-draft test-file citations corrected against the live test-suite structure (documented as deviations below, not silently changed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `_FakeModelRouterForSwapState` test double broke on the new enumerator call**
- **Found during:** Task 2 verification (running the full `tests/unit/providers tests/unit/engine tests/unit/api` suite after Task 2's implementation)
- **Issue:** `build_swap_state_payload` (Task 1) now unconditionally calls `router.get_all_profile_overrides()` when `router is not None`. `tests/unit/engine/test_ws_commands.py`'s `_FakeModelRouterForSwapState` — a hand-written stand-in for `ModelRouter` used across 4 tests (`test_swap_get_state_reflects_active_override`, `test_swap_get_state_returns_nulls_after_clear`, `test_chat_send_swap_triggers_one_swap_state_live_push`, `test_swap_set_pushes_swap_state_live_same_as_spoken_swap`) — only implemented `get_global_override`/`get_global_override_source`, so all 4 raised `AttributeError`.
- **Fix:** Added `get_all_profile_overrides()` (returns `{}`) and `get_profile_override_source()` (returns `None`) to the fake, matching the real `ModelRouter`'s empty-override shape.
- **Files modified:** `tests/unit/engine/test_ws_commands.py`
- **Verification:** All 98 tests in that file pass; full 1907-test regression (`tests/unit/providers tests/unit/engine tests/unit/api`) passes.
- **Committed in:** `8c4842f1` (Task 2 GREEN commit)

**2. [Plan-draft correction] Task 1's `build_swap_state_payload` tests do not live in a `test_dispatch.py`-shaped file**
- **Found during:** Task 1, pre-implementation research
- **Issue:** No `tests/unit/engine/test_dispatch.py` or equivalent exists; `tests/unit/engine/test_control_verbs_dispatch.py` exists but tests `dispatch_reply_tags`/`apply_inbound_control_verbs`, not `build_swap_state_payload` (which had zero existing test coverage).
- **Fix:** Added the `build_swap_state_payload` tests to `tests/unit/providers/test_router.py` — the plan's own `<files>` list for Task 1 already named this file, and it already has the `router`/`make_mock_failover`/`make_routing_config` fixtures the tests need.
- **Files modified:** `tests/unit/providers/test_router.py` (no plan deviation in file scope — this is the plan's own cited file)
- **Verification:** N/A — informational, not a code fix.

**3. [Plan-draft correction] Task 2's cited test file does not host swap.catalogue coverage**
- **Found during:** Task 2, pre-implementation research
- **Issue:** The plan's `<files>` for Task 2 cited `tests/unit/api/test_ws_commands_frame.py`. That file exists and has its own `_make_dispatcher` helper, but every existing `swap.catalogue` test (11 of them) lives in `tests/unit/engine/test_ws_commands.py`, using its `dispatcher`/`auth`/`websocket`/`_reset_swap_catalogue_deps` fixtures.
- **Fix:** Added the 3 new `default_profile_id` tests to `tests/unit/engine/test_ws_commands.py` instead, matching the established convention. `tests/unit/api/test_ws_commands_frame.py` was left untouched and still passes (verified, 17/17).
- **Files modified:** `tests/unit/engine/test_ws_commands.py` (not `tests/unit/api/test_ws_commands_frame.py` as the plan's frontmatter `files_modified` listed)
- **Verification:** `python -m pytest tests/unit/api/test_ws_commands_frame.py -x -q` — 17 passed (unaffected). `python -m pytest tests/unit/engine/test_ws_commands.py -q` — 98 passed (new tests included).

---

**Total deviations:** 3 (1 auto-fixed bug, 2 plan-draft file-location corrections documented for traceability)
**Impact on plan:** No scope creep. The bug fix was required for the full suite to stay green after Task 1's own change; the file-location corrections keep new tests in the codebase's actual established test homes rather than a plan-drafted guess.

## Cross-Repo Commits (astridr-repo, `feature/brain-swap`)

| Commit | Type | Summary |
|---|---|---|
| `10503e4f` | test | Failing tests for profile override enumerators + swap.state map (RED) |
| `effb7a48` | feat | `ModelRouter` enumerators + `profile_overrides` on `build_swap_state_payload` (GREEN) |
| `411e0253` | test | Failing tests for `default_profile_id` on `swap.catalogue` ack (RED) |
| `8c4842f1` | feat | `default_profile_id` on `swap.catalogue` brain ack + test-double fix (GREEN) |

Each commit was verified with `git show --stat HEAD` immediately after committing — every commit's file list matched exactly what this plan intended, with no sweep-in from the repo's pre-existing concurrent-session changes (`.planning/phases/188.4-.../`, `.planning/phases/188.5-.../`, `.planning/seeds/SEED-028-...`, all left untouched and unstaged throughout).

## Operator Flags (reported, not fixed — out of this plan's 2-change scope)

**1. Branch divergence (REQUIREMENTS.md carried-forward item 7) — measured live, corrects the stale "322 behind" figure:**

```
$ git log --oneline main..feature/brain-swap | wc -l
447
$ git log --oneline feature/brain-swap..main | wc -l
16
```

`feature/brain-swap` is 447 commits ahead of the shared base and 16 commits behind `main` — not 322 behind as REQUIREMENTS.md states. (109-RESEARCH.md's own measurement, taken 2026-08-08, was 432 ahead / 10 behind; the 16-behind figure taken now suggests `main` gained a small number of additional commits between research and execution — not investigated further, out of scope.)

**2. Stale CORS default in `astridr/channels/web.py:973` — still unmerged from `main`, NOT fixed (explicitly out of this plan's 2-change scope per the plan's own instruction):**

```
$ grep -n "CODEPULSE_ORIGIN" astridr/channels/web.py
961:          - CODEPULSE_ORIGIN env var (CodePulse prod frontend; defaults to the
973:        prod_origin = os.environ.get("CODEPULSE_ORIGIN", "https://tidy-whale-981.convex.site")  # cg-ok: CG-INP-002 — optional env var with a safe documented default; doctor warns if unset
```

`main`'s `5e4e257d fix(cors): drop the decommissioned-host default for CODEPULSE_ORIGIN` has not landed on `feature/brain-swap`. This is a dormant default (only matters if `CODEPULSE_ORIGIN` is unset in the deployed container's env) but should be picked up on the next merge/rebase of this branch.

## Issues Encountered

None beyond the auto-fixed test-double issue documented above.

## Known Stubs

None — this plan touches only backend Python; no CodePulse UI/data-wiring stubs were introduced.

## Threat Flags

None — both changes match the plan's own threat register exactly (T-109-01 accept, T-109-03 mitigate via server-only config read). No new trust-boundary surface was introduced beyond what the plan's `<threat_model>` already covers.

## User Setup Required

None — no external service configuration required. The astridr container will need a rebuild (`COMPOSE_PROFILES=prod,war-room docker compose up --build -d`) before any live CodePulse plan can read these fields from the running stack — flagging for whichever Phase 109 plan runs the operator-attended live gate (109-09).

## Next Phase Readiness

- Both backend fields (`profile_overrides` on `swap.state`, `default_profile_id` on `swap.catalogue`) exist and are unit-tested, unblocking every downstream CodePulse plan in this phase that reads them (109-02 through 109-08, and the 109-09 live gate).
- The astridr-agent container has NOT been rebuilt with these changes yet — the live-verify plan (109-09) must confirm a rebuild has happened before probing these fields live, per `109-RESEARCH.md`'s Environment Availability table.
- No blockers for 109-02.

---
*Phase: 109-per-agent-engine-ui*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: `C:/Users/mandr/codepulse/.planning/phases/109-per-agent-engine-ui/109-01-SUMMARY.md`
- FOUND: `C:/Users/mandr/astridr-repo/astridr/providers/router.py`
- FOUND: `C:/Users/mandr/astridr-repo/astridr/engine/control_verbs/dispatch.py`
- FOUND: `C:/Users/mandr/astridr-repo/astridr/api/ws_commands.py`
- FOUND (astridr-repo): `10503e4f`, `effb7a48`, `411e0253`, `8c4842f1`
- FOUND (codepulse): `535c6891`
