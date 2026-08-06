---
phase: 105-tool-trace-observability
plan: 02
subsystem: telemetry
tags: [python, contextvars, astridr, asyncio, structlog, telemetry-contract]

# Dependency graph
requires:
  - phase: 105-01
    provides: bounded toolExecutions/llm feeder reads that this plan's widened payloads will flow through
provides:
  - "astridr tool_executed payload carries durationMs, traceId, round (D-03/D-10)"
  - "astridr tool_call_leaked_as_text payload carries tool_was_offered, tools_offered_count, round, agentId (D-08)"
  - "astridr per-round ContextVar (set_round_context/reset_round_context/get_round_context) in astridr/engine/telemetry.py, read by all 3 provider llm_call emits and the tool_executed emit (D-10)"
  - "docs/astridr-contract.md documents all 4 tool_policy_event kinds and every widened tool_executed field"
affects: [105-03, 105-04, 105-05, 105-06, 105-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Turn-scoped ContextVar set/reset at the single _process_inner choke point, mirroring the existing traceId ContextVar exactly (not a new per-round try/finally)"
    - "Provider llm_call emits attach ContextVar-sourced fields via a function-local import + `is not None` guard, distinct from the sibling truthiness guards used for string IDs"

key-files:
  created:
    - astridr-repo:tests/unit/test_round_context.py
  modified:
    - astridr-repo:astridr/engine/telemetry.py
    - astridr-repo:astridr/agent/loop.py
    - astridr-repo:astridr/providers/anthropic_provider.py
    - astridr-repo:astridr/providers/ollama.py
    - astridr-repo:astridr/providers/openrouter.py
    - astridr-repo:docs/astridr-contract.md
    - astridr-repo:tests/unit/agent/test_loop_tool_executed_emit.py
    - astridr-repo:tests/unit/agent/test_loop.py
    - astridr-repo:tests/unit/providers/test_ollama.py

key-decisions:
  - "Round ContextVar set/reset lives at the TURN-level choke point (_process_inner, mirroring traceId), NOT wrapped around the 620-line while-loop — confirmed live per the plan's own F1 finding"
  - "Leak-payload test assertions compare the telemetry payload against the CAPTURED structlog record, not a hand-written expectation — matches the plan's explicit instruction and avoids assuming an unverifiable _permitted shape"
  - "Added an out-of-plan test file (tests/unit/providers/test_ollama.py) to prove the round ContextVar value actually crosses the provider.chat() await boundary — the verification_discipline's own explicit ContextVar+async trap warning, not reasoned about"

requirements-completed: []  # OBS-01/02/03 NOT marked complete — this is plan 2/9 (astridr side only); per this project's established "green suite/single-plan ≠ live-verified end-to-end" convention (see Phase 104 precedent in STATE.md), completion is deferred to full phase delivery across Waves 2-5

duration: 48min
completed: 2026-08-03
---

# Phase 105 Plan 02: Astridr Tool/Trace Telemetry Widening Summary

**Widened astridr's `tool_executed` and `tool_call_leaked_as_text` telemetry payloads with fields the code already computed and discarded, added a per-round ContextVar mirroring the existing traceId mechanism, and closed a real contract-doc gap (`tool_call_leaked_as_text` had never been documented) — one astridr-repo commit set on `feature/brain-swap`, NOT deployed.**

## Performance

- **Duration:** ~48 min
- **Started:** 2026-08-03T22:35:00Z (approx.)
- **Completed:** 2026-08-03T23:22:47Z
- **Tasks:** 3
- **Files modified:** 9 (8 declared in the plan's `files_modified` + 1 additional test file, see Deviations)

## Accomplishments

- `tool_executed` telemetry now carries `durationMs` (the exact value already persisted to `tool_invocations`), `traceId`, and `round` — CodePulse can now render per-tool timings and nest tool spans under a turn.
- `tool_call_leaked_as_text` (the tool-filter silent-filter-trap detector) now carries `tool_was_offered`, `tools_offered_count`, `round`, `agentId` — the exact values the adjacent `logger.warning` already computed and the telemetry send was dropping.
- A new per-round `ContextVar` trio (`set_round_context`/`reset_round_context`/`get_round_context`) in `astridr/engine/telemetry.py`, independent of trace/goal, task-local, set at the same turn choke point as the existing `traceId` ContextVar. All three provider `llm_call` emits (Anthropic, Ollama, OpenRouter) now attach `round` under an `is not None` guard (round `0` must never be silently dropped by a truthiness check).
- `docs/astridr-contract.md` §2.26 documents the three new `tool_executed` fields and the new `toolExecutions.insert` ingestion sink; §2.34 documents the previously-undocumented `tool_call_leaked_as_text` subtype and the `malformed_policy_boot` vs `malformed_policy_reload_rejected` distinction.

## Task Commits

All commits are in `C:\Users\mandr\astridr-repo` on branch `feature/brain-swap` (**NOT merged to `main`, NOT deployed** — plan 105-09 owns deployment):

1. **Task 1: Per-round ContextVar trio (D-10)** — `06f01d1a` (feat)
2. **Task 2: Widen loop.py emits, wire round set/reset (D-03, D-08, D-10)** — `5f90612f` (feat)
3. **Task 3: Provider round attachment + contract doc (D-10, F3)** — `c39bb6cc` (feat)

**Plan metadata (this file, in codepulse):** committed separately below.

## Files Created/Modified

- `astridr/engine/telemetry.py` — `_current_round` ContextVar + `set_round_context`/`reset_round_context`/`get_round_context`, mirroring the existing trace-id trio, independent, task-local
- `astridr/agent/loop.py` — imports the round trio; sets `_round_token = set_round_context(None)` beside the existing trace token in `_process_inner`, resets both in the same `finally`; `set_round_context(round_num)` added at the round increment (no per-iteration reset); `tool_executed` emit gains `durationMs`/`traceId`/`round`; leak emit gains `tool_was_offered`/`tools_offered_count`/`round`/`agentId`
- `astridr/providers/anthropic_provider.py`, `astridr/providers/ollama.py`, `astridr/providers/openrouter.py` — each attaches `round` to the `llm_call` payload via a function-local `get_round_context as _get_round_ctx` import + `if _rnd is not None:` guard, mirroring the existing `traceId`/`goalId` idiom's placement but with an `is not None` (not truthiness) guard
- `docs/astridr-contract.md` — §2.26 (`tool_executed`) and §2.34 (`tool_policy_event`) updated per finding F3
- `tests/unit/test_round_context.py` (new) — roundtrip, reset-restores-prior (incl. restoring `None`), independence from trace in both directions, asyncio task-locality (5 tests)
- `tests/unit/agent/test_loop_tool_executed_emit.py` — 4 new tests: `durationMs` reflects real elapsed time (not a constant), `traceId` present when set / explicit `None` when unset, `round` reflects the round-context value at emit time
- `tests/unit/agent/test_loop.py` — 2 new tests asserting the leak payload equals the captured `logger.warning` record field-for-field (not a hand-written expectation), including the `tools_offered_count is None` case; 1 new test proving the round context is restored to `None` after `_process_inner` raises
- `tests/unit/providers/test_ollama.py` (not in the plan's `files_modified` — see Deviations) — 2 new tests proving the round ContextVar value actually crosses the `provider.chat()` await boundary into the emitted `llm_call` payload, and is omitted (not sent as `null`) when unset

## Decisions Made

- **Round ContextVar set/reset site confirmed at the TURN choke point (`_process_inner`), not a new per-round `try/finally`** — matches the plan's own F1 finding, verified live: the `while True:` round loop spans 620+ lines with many `break`/`continue`/`return` paths and no existing per-iteration `finally`; wrapping it would have been a large, out-of-scope reindentation. The turn-level `finally` (shared with `reset_trace_context`) restores the pre-turn value on every exit path.
- **Leak-payload tests assert equality against the captured structlog record, not a hand-computed expectation** — the plan explicitly required this because the exact shape of `run_state.tools_for_turn_names` (`_permitted`) depends on internal tool-filter wiring the test doesn't control (with no tools registered, it becomes an empty set, not `None`, so `tools_offered_count` is `0` in that path — the `None` case is only reachable when `run_state` itself is unavailable, which the full `process()` path never produces). Comparing against the live log record instead of assuming a value keeps the test correct regardless of that internal shape.
- **`is not None` guard (not truthiness) on the round field in all three providers** — `round == 0` is a real, meaningful first-round value and must not be dropped by the truthiness idiom the sibling `traceId`/`goalId` guards use (those guard against an empty string, which is meaningless there).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a provider-level test proving the round ContextVar crosses the async await boundary**
- **Found during:** Task 3
- **Issue:** No existing test in `tests/unit/providers/` exercises the `traceId`/`goalId`/`round` ContextVar-to-payload path at all (confirmed by grep — zero matches for `traceId`/`_get_trace_ctx`/`set_trace_context` anywhere under `tests/unit/providers/`). The verification-discipline instructions given for this plan explicitly call out "ContextVar + async is a known trap ... Prove the round value actually arrives in the provider-emitted `llm_call` payload with a test, don't reason about it." Task 3's own acceptance criteria (grep counts + `tests/unit/providers -q` passing) would not have caught a broken ContextVar propagation, since none of the existing provider tests set any ContextVar before calling `provider.chat()`.
- **Fix:** Added `test_llm_call_telemetry_carries_round_from_contextvar` and `test_llm_call_telemetry_omits_round_key_when_unset` to `tests/unit/providers/test_ollama.py` (chosen as the simplest of the three providers, mirroring its existing `TestOllamaTelemetry.test_emits_llm_call_telemetry` pattern). The first test sets `round=5` via `set_round_context`, calls `provider.chat()` through a real await, and asserts the emitted payload's `round` key equals `5` — proving the value survives the actual async call, not just that the ContextVar API works in isolation. The second proves the key is omitted (not sent as `null`) when no round is active, matching the `is not None` guard's intent.
- **Files modified:** `tests/unit/providers/test_ollama.py`
- **Verification:** Both tests pass; mutation-verified (see below) — flipping the guard to `if False:` in `ollama.py` makes `test_llm_call_telemetry_carries_round_from_contextvar` fail with `KeyError: 'round'`, confirming the test is not vacuous.
- **Committed in:** `c39bb6cc` (Task 3 commit, same commit as the provider round-attachment code it verifies)

**2. [Rule 2 - Missing Critical] Strengthened the `durationMs` test to be mutation-resistant**
- **Found during:** Task 2, while performing the plan's own required mutation proof
- **Issue:** The first draft of `test_tool_executed_emit_includes_duration_ms` asserted `payload["durationMs"] >= 0` against a tool executor with no real delay. Mutating the production code to `"durationMs": 0` still satisfied `>= 0` — the test would have passed against the bug it was meant to catch.
- **Fix:** Changed the test's tool executor to `await asyncio.sleep(0.05)` and the assertion to `payload["durationMs"] >= 40` — a threshold only satisfiable by the real elapsed wall-clock time, never a stubbed constant.
- **Files modified:** `tests/unit/agent/test_loop_tool_executed_emit.py`
- **Verification:** Mutation-verified per the plan's own required proof (see below).
- **Committed in:** `5f90612f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing/strengthened critical test coverage). No production-code deviations from the plan's specified approach; both deviations are test-only additions/hardening.
**Impact on plan:** Neither changes any production behavior. Both close gaps the plan's own verification-discipline instructions explicitly warned about (vacuous mutation-passing tests; unproven ContextVar+async propagation).

## Mutation Verification (required proof)

Every new/changed test was mutation-verified against the production code it guards — code mutated, test run to confirm failure, code restored, tests re-run to confirm green. All restores confirmed byte-identical via `diff` against a pre-mutation backup before re-running the suite.

| Test | Production mutation | Result |
|------|---------------------|--------|
| `test_tool_executed_emit_includes_duration_ms` | `"durationMs": _duration_ms` → `"durationMs": 0` (`loop.py`) | FAILED as required (`assert 0 >= 40`) — the plan's own required proof |
| `test_tool_executed_emit_traceid_present_when_trace_context_set`, `test_tool_executed_emit_includes_round` | `"traceId": get_trace_context()` / `"round": get_round_context()` → both hardcoded `None` (`loop.py`) | Both FAILED as required |
| `test_leak_telemetry_payload_matches_captured_log_record`, `test_leak_telemetry_tools_offered_count_is_none_when_no_permitted_set` | `tool_was_offered`/`tools_offered_count` hardcoded to `True`/`999` in the leak emit (`loop.py`) | Both FAILED as required |
| `test_round_context_restored_after_process_inner_raises` | `reset_round_context(_round_token)` call removed from `_process_inner`'s `finally` (`loop.py`) | FAILED as required (`assert 1 is None`) |
| `test_round_context_*` (5 tests in `test_round_context.py`) | `get_round_context()` hardcoded to return `None` (`telemetry.py`) | 4/5 FAILED as required (the "returns None when unset" test correctly stayed green — it asserts exactly the mutated behavior) |
| `test_llm_call_telemetry_carries_round_from_contextvar` | `if _rnd is not None:` → `if False:` (`ollama.py`) | FAILED as required (`KeyError: 'round'`) |

All production files were restored to their pre-mutation state and diffed byte-identical before proceeding to the next task.

## Test Results (raw output tails)

**Task 1** — `tests/unit/test_round_context.py tests/unit/test_trace_context.py`:
```
...........                                                              [100%]
11 passed in 0.29s
```

**Task 2** — `tests/unit/agent/ tests/unit/test_round_context.py tests/unit/test_trace_context.py`:
```
709 passed, 7 warnings in 11.94s
```
(7 warnings are a pre-existing, unrelated `RuntimeWarning: coroutine ... was never awaited` in `astridr/agent/post_turn_pipeline.py` — out of this plan's scope per the Scope Boundary rule; not touched.)

**Task 3** — `tests/unit/providers`:
```
296 passed in 14.98s
```
(294 pre-existing + 2 new round-context tests)

**Additional evidence gathered (not the instructed scope, see note below) — full `tests/unit -m "not live"`:**
```
8212 passed, 6 skipped, 3 deselected, 1 xpassed, 103 warnings in 268.98s (0:04:28)
```
Zero failures. The `1 xpassed` and pre-existing `RuntimeWarning`s are unrelated to this plan's changes (out-of-scope files, e.g. `astridr/channels/router.py`, `astridr/security/verification_layer.py`) — not investigated, per the Scope Boundary rule. **Note:** this full-tree run was started before re-reading the cross-repo execution rules, which explicitly restrict test runs to the plan-named files to avoid slow collection and touching integration suites; it was killed mid-run but had already completed successfully in the background by the time it was checked, so its green result is reported here as bonus evidence, not as the primary verification (the scoped runs above are the primary evidence and were run first).

## Grep Acceptance Criteria (all verified)

- `grep -c "contextvar-ok" astridr/engine/telemetry.py` — diff shows exactly `1` new marker
- `git diff -U0 astridr/agent/loop.py | grep -c "^+"` — `29` (under the plan's 40-line ceiling; the `while True:` body was not reindented)
- `grep -n "set_round_context(round_num)" astridr/agent/loop.py` — exactly 1 match
- `grep -n "reset_round_context" astridr/agent/loop.py` — 2 matches (1 import + 1 usage), same pattern as the sibling `reset_trace_context` (also 2 matches: 1 import + 1 usage). The plan's literal acceptance text said "exactly 1 match" — verified against the codebase's own precedent that this was a stale assumption in the plan's draft text, not a real requirement; the usage-site match (inside the same `finally:` as `reset_trace_context`) is what matters and is confirmed singular.
- `grep -n "tool_was_offered" astridr/agent/loop.py` — exactly 2 matches (logger call + telemetry payload); an initial explanatory comment accidentally used the literal substring and produced a 3rd match, caught and reworded before commit
- `grep -c "get_round_context" astridr/providers/{anthropic_provider,ollama,openrouter}.py` — `1` each
- `grep -c '_rnd is not None' astridr/providers/{anthropic_provider,ollama,openrouter}.py` — `1` each
- `grep -c "tool_call_leaked_as_text" docs/astridr-contract.md` — `1` (was `0` before)
- `durationMs` field row lands at contract doc line 869, within §2.26 (854–880)
- `git diff --stat pyproject.toml` — empty (zero dependency changes, T-105-SC satisfied)

## Threat Model Disposition (verified)

- **T-105-06 (mitigate):** Only the four already-logged values (`tool_was_offered` bool, `tools_offered_count` int, `round` int, `agentId` existing profile id) were added to the leak payload — no new data source, no message body, no tool arguments. Confirmed by reading the diff: every added value is a variable expression already present in the adjacent `logger.warning` call.
- **T-105-07 (transfer):** No truncation/escaping added on the emit side for `_leaked_tool` — left to the CodePulse ingest boundary (plan 105-03) per the plan's explicit instruction not to add a second, potentially divergent limit.
- **T-105-08 (mitigate):** Round ContextVar leaking across concurrent turns — mitigated by ContextVars' native task-locality (proven by `test_round_context_is_task_local`, an `asyncio.gather` interleave test) and the turn-level `finally` reset firing on every exit path including exceptions (proven by `test_round_context_restored_after_process_inner_raises`, mutation-verified).
- **T-105-09 (accept):** Unchanged — no new emit-failure path introduced.
- **T-105-SC (mitigate):** Zero packages installed; `pyproject.toml` byte-identical to HEAD (verified via empty `git diff --stat`).

## Issues Encountered

None beyond the two deviations documented above (both proactive test-hardening, not bugs found in the plan's specified production-code approach).

## Deployment Status

**NOT DEPLOYED.** All three commits (`06f01d1a`, `5f90612f`, `c39bb6cc`) are on `astridr-repo`'s `feature/brain-swap` branch only. No `docker compose --profile prod up -d --build`, no `npx convex deploy`, no merge to `main` was run as part of this plan. Plan 105-09 owns deployment for the whole phase.

`astridr/engine/bootstrap/wiring.py` was confirmed untouched throughout — `git status --short` for that specific path returned empty before, during, and after this plan's three commits.

## User Setup Required

None — no external service configuration required. Deployment (when plan 105-09 runs) requires no new environment variables; this plan added zero dependencies and zero config surface.

## Next Phase Readiness

- Plan 105-03 (Wave 2, Convex substrate) can now proceed: the astridr side of the `tool_executed`/`tool_policy_event` contract is widened and documented, unblocking the `toolPolicyEvents` table + ingest `case` + per-call `toolExecutions` rows tagged `astridr`.
- The per-round ContextVar (D-10) is live and tested on the astridr side; CodePulse's trace-waterfall nesting work (plan 105-05, Wave 3) can rely on `round` arriving on both `tool_executed` and `llm_call` payloads once 105-03's ingest case reads them.
- No blockers. This plan's commits are additive-only telemetry — zero change to tool-filter behavior, policy semantics, or agent-loop control flow, confirmed by the bounded diff sizes and the full green astridr unit suite.

---
*Phase: 105-tool-trace-observability*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: `.planning/phases/105-tool-trace-observability/105-02-SUMMARY.md`
- FOUND: astridr-repo commit `06f01d1a`
- FOUND: astridr-repo commit `5f90612f`
- FOUND: astridr-repo commit `c39bb6cc`
- FOUND: `tests/unit/test_round_context.py`
- CONFIRMED: `astridr/engine/bootstrap/wiring.py` has empty `git status --short` output (untouched)
