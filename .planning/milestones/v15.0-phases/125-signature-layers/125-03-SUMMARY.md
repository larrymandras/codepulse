---
phase: 125-signature-layers
plan: 03
subsystem: backend
tags: [cross-repo, astridr-repo, telemetry, websocket, e-stop, pytest]

# Dependency graph
requires: []
provides:
  - "estop_state telemetry event -- emitted from EmergencyStop.activate()/.deactivate() in astridr-repo, the one injection point every documented activation surface reaches"
  - "estop_state on-connect snapshot push -- create_ws_router(..., estop=...) pushes the current armed state to every WS client immediately after auth, before push_loop() starts"
affects: [125-04, 125-05, 125-09, 125-12, 125-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling telemetry emission after an existing audit-trail send, not a replacement (activate()'s security_event stays untouched)"
    - "On-connect snapshot push copying the commands.catalog precedent verbatim: after register_ws/accept, before push_loop() starts, under send_lock, exceptions logged and swallowed"

key-files:
  created:
    - C:/Users/mandr/astridr-repo/tests/engine/test_ws_telemetry_estop.py
  modified:
    - C:/Users/mandr/astridr-repo/astridr/engine/estop.py
    - C:/Users/mandr/astridr-repo/astridr/engine/ws_telemetry.py
    - C:/Users/mandr/astridr-repo/astridr/engine/bootstrap/wiring.py
    - C:/Users/mandr/astridr-repo/tests/test_estop.py

key-decisions:
  - "Task 3 (D-19, run.blocks single-emission fix) was NOT executed. The plan's own STOP condition fired: astridr-repo's buffered .send(\"run.blocks\", ...) at both paired sites is the ONLY writer that reaches Convex (send_live()/_emit_run_event never does, confirmed directly from telemetry.py:395-408's docstring and body), and codepulse's /live-run page (src/pages/LiveRun.tsx:70-74) reads that persisted history back via api.runBlocks.listSessions/getBySession. Deleting the buffered send would silently and permanently empty /live-run's history view. Per the plan's explicit instruction (\"If a persisted consumer exists, STOP, leave both emissions in place, and report\"), both emissions were left untouched in astridr-repo. No test file was created for this task, since its purpose (asserting single delivery) does not match the code as left. Documented in full below."

requirements-completed: [SIGNAL-01]

# Metrics
duration: 45min
completed: 2026-08-24
---

# Phase 125 Plan 03: Signature Layers -- E-Stop Telemetry + run.blocks Investigation Summary

**Ástríðr now emits and pushes `estop_state` (Tasks 1-2, both complete, both live-verified by pytest); Task 3's `run.blocks` double-emission fix was correctly NOT applied after re-derivation surfaced a real persisted Convex consumer the plan's D-19 decision text never accounted for.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-24

## What Was Built

### Task 1 -- `estop_state` emission from `EmergencyStop.activate()`/`.deactivate()`

`astridr-repo/astridr/engine/estop.py`:
- `activate()` gained a sibling `estop_state` emission (`{"armed": True, "reason": reason, "initiator": initiator}`) immediately after the existing `security_event` send. `security_event` is untouched -- still the sole audit-trail emission (`grep -c '"security_event"' astridr/engine/estop.py` = 1).
- `deactivate()` gained a brand-new `estop_state` emission (`{"armed": False, "reason": "", "initiator": initiator}`) -- this method had zero telemetry calls before. `reason: ""` is emitted explicitly (not omitted) so the client parses one payload shape in both directions.
- Both sit after each method's existing idempotency early-return, so a no-op activate/deactivate emits nothing.

4 new tests added to `tests/test_estop.py` using a `_FakeTelemetry` recorder (`async send()` appending `(event_type, payload)`):

Verbatim recorded emission list from test (a), `test_activate_emits_estop_state_and_security_event`:
```python
telemetry.calls == [
    ("estop_state", {"armed": True, "reason": "runaway agent detected", "initiator": "admin_user"}),
    ("security_event", {"layer": "estop", "severity": "critical", "action": "activated",
                         "details": {"reason": "runaway agent detected", "initiator": "admin_user"}}),
]
```
(asserted via filtered sub-lists, both event types present, both length 1)

- (b) `test_deactivate_emits_estop_state` -- deactivate() emits exactly one `estop_state` with `armed is False`.
- (c) `test_reactivate_and_redeactivate_while_already_in_that_state_emit_nothing` -- asserts `telemetry.calls == []` (empty list, not a count) after a re-activate/re-deactivate while already in that state.
- (d) `test_estop_with_telemetry_none_still_activates_and_deactivates` -- `EmergencyStop(telemetry=None)` still activates/deactivates without raising.

`python -m pytest tests/test_estop.py -q` -> **27 passed** (23 pre-existing + 4 new).
`grep -c '"estop_state"' astridr/engine/estop.py` = **2**. `grep -c '"security_event"' astridr/engine/estop.py` = **1**.

### Task 2 -- on-connect `estop_state` snapshot push

- `TOPIC_EVENT_MAP["security"]` (`astridr-repo/astridr/engine/ws_telemetry.py`) gained `"estop_state"`, routing through the same topic `security_event` already carries -- precedent-following (delivery would also work through the unknown-type best-effort fallback), not a fix for a blocker. No `infrastructure` entry added; `VALID_TOPICS` derivation untouched (still `{health, security, executions, agents, live-runs, infrastructure}`).
- `create_ws_router(...)` gained `estop: Any | None = None` as its last keyword parameter, documented in the docstring. When `None`, behaviour is byte-identical to before -- proven by test (c).
- Immediately after the existing `commands.catalog` push block (same position, same shape: after `register_ws`/`accept`, before `push_loop()` starts, under `send_lock`), a new `if estop is not None:` block sends `{"event_type": "estop_state", "data": {"armed": bool(estop.is_active), "reason": estop.reason or "", "initiator": "snapshot"}}`, logging `ws_telemetry.estop_snapshot_pushed` (debug) or `ws_telemetry.estop_snapshot_push_failed` (warning, swallowed -- never closes the socket).
- `wiring.py`'s single `create_ws_router(...)` call site gained `estop=estop,` (the parameter was already in scope on the enclosing `_setup_ws_telemetry`).

4 new tests in the new file `tests/engine/test_ws_telemetry_estop.py`, using `FastAPI TestClient.websocket_connect` with stub telemetry/estop objects, following `tests/unit/engine/test_ws_telemetry.py`'s own `Authorization: Bearer <api_key>` auth convention (confirmed live, not guessed):

- (a) `test_estop_armed_first_frame_is_estop_state` -- verbatim first frame received:
  ```python
  {"event_type": "estop_state", "data": {"armed": True, "reason": "runaway agent detected", "initiator": "snapshot"}}
  ```
- (b) `test_estop_disarmed_first_frame_carries_armed_false` -- first frame carries `data["armed"] is False`.
- (c) `test_estop_none_sends_no_frame_and_connection_still_works` -- the control: `estop=None`, no `estop_state` frame, connection round-trips a real `health_check` event through the push loop.
- (d) `test_estop_is_active_raises_does_not_close_socket` -- a stub whose `is_active` property raises `RuntimeError`; the socket stays open and later frames still arrive.

`python -m pytest tests/engine/test_ws_telemetry_estop.py -q` -> **4 passed**.
`python -m pytest tests/engine -q` -> **26 passed** (no collateral breakage).

**Deviation from the plan's literal acceptance criteria (repository wins, per this plan's own instruction):**
- `grep -c "estop=estop" astridr/engine/bootstrap/wiring.py` returns **5**, not the plan's expected 1. `estop` was already threaded to four *other* call sites in the same `_setup_ws_telemetry` function before this plan touched it (lines 635, 659, 880, 1282 -- confirmed by `grep -n`), consistent with `125-RESEARCH.md`'s own note that `estop: Any` "already threads it to other call sites in the same function." My one addition is line 938 (the `create_ws_router` call). The functional requirement -- one new `estop=estop,` at the `create_ws_router` call site -- is satisfied.
- `grep -c "estop_state" astridr/engine/ws_telemetry.py` returns **6**, not the plan's "≥ 2" floor's implied ~2. The extra hits are my own explanatory comments/docstring prose (lines 40, 116, 207, 210) referencing "estop_state" in plain English, in addition to the two functional occurrences (the `TOPIC_EVENT_MAP` set literal and the `event_type` dict literal). The "≥ 2" floor is satisfied; the plan's arithmetic assumed a cleaner baseline than the comments I added.

### Task 3 -- `run.blocks` single-emission fix (D-19) -- NOT EXECUTED, STOP condition fired

**Re-derived population** (fresh grep, `astridr-repo` root, excluding `tests/`):

```
astridr/agent/loop.py:1763:                        "run.blocks", session.id,       ┐ PAIRED
astridr/agent/loop.py:1768:                        await self.telemetry.send("run.blocks", {  ┘ (loop.py:1762-1772)
astridr/agent/post_turn_pipeline.py:455:                        "run.blocks", session.id,      ┐ PAIRED
astridr/agent/post_turn_pipeline.py:460:                    await self._telemetry.send("run.blocks", {  ┘ (post_turn_pipeline.py:453-464)
astridr/api/ws_commands.py:790:            await self._telemetry.send("run.blocks", {        SOLO -- untouched
astridr/engine/bootstrap/wiring.py:578:                            await telemetry.send("run.blocks", {  SOLO -- untouched
astridr/security/hitl_gate.py:236:                "run.blocks",                                 SOLO -- untouched
astridr/engine/ws_telemetry.py:65:        "run.blocks",         (TOPIC_EVENT_MAP entry, not an emission site -- excluded)
```

**Result: exactly 2 paired sites, 3 solo sites** -- matches the plan's stated expectation (D-19's own text: "an independent re-grep found 5 run.blocks sites (2 paired, 3 solo)"). No third pair found, no drift from the plan's population.

Confirmed by reading each site in full:
- `loop.py:1755-1772` and `post_turn_pipeline.py:440-464` both call `_emit_run_event`/`emit_run_event` (the survivor -- `post_turn_pipeline.py`'s `emit_run_event` parameter IS `loop.py`'s bound `self._emit_run_event`, wired at `loop.py:1844: emit_run_event=self._emit_run_event`, so it honours `set_run_event_session_id`'s override identically at both sites) immediately followed by a buffered `.send("run.blocks", ...)` call with the identical payload.
- `ws_commands.py:790`, `wiring.py:578`, `hitl_gate.py:236` each call `.send("run.blocks", ...)` **alone** -- no adjacent `_emit_run_event`/`emit_run_event` call. Genuinely single emissions, left untouched as the plan directs.

**Persisted-consumer grep (the plan's required STOP gate), run before any deletion:**

```
grep -rn "run\.blocks" codepulse/convex   -> convex/runtimeIngest.ts:1375: case "run.blocks": {
                                              (feeds api.runBlocks.record -> run_blocks table)
grep -rn "run\.blocks" codepulse/src      -> src/pages/LiveRun.tsx:70: useQuery(api.runBlocks.listSessions)
                                              src/pages/LiveRun.tsx:72: useQuery(api.runBlocks.getBySession, ...)
```

**A persisted consumer exists.** `convex/runBlocks.ts` exports `listSessions` and `getBySession` queries that read the `run_blocks` table, and `src/pages/LiveRun.tsx` (routed live at `/live-run`, `App.tsx:45,162`) consumes both via `useQuery`. The `run_blocks` table's *only* writer is `convex/runtimeIngest.ts`'s `"run.blocks"` ingest case, which is reachable *only* through the buffered `ConvexHandler.send()` path -- confirmed directly from `astridr-repo/astridr/engine/telemetry.py`:
- `send()` (`:319-353`) both buffers to the Convex `/runtime-ingest` batch AND fans out over WS (`:346-353`).
- `send_live()` (`:395-408`), which `_emit_run_event`/`emit_run_event` call, is WS-fan-out-only and its own docstring states "Does NOT send to Convex HTTP endpoint."

Deleting the buffered `.send("run.blocks", ...)` call at either paired site would therefore not just dedup the WS-visible surface -- it would eliminate the *only* writer to the `run_blocks` Convex table, silently and permanently emptying `/live-run`'s history view (both `listSessions` and `getBySession` would return `[]` forever, with nothing to notice).

**Per the plan's own explicit instruction** ("If a persisted consumer exists, STOP, leave both emissions in place, and report -- the client-side guard in plan 125-09 covers the count either way, so a wrong deletion here is the only irreversible outcome"), **both emissions were left untouched** at both paired sites in `astridr-repo`. No code was changed for Task 3; no test file was created (`tests/agent/test_run_blocks_single_emit.py` does not exist), because its stated purpose -- asserting exactly one WS delivery per turn -- would misdescribe code that still double-emits by design of this STOP.

**This means the plan's `must_haves` D-19 truth is NOT satisfied by this plan run:**
> "D-19: `run.blocks` is emitted ONCE per logical turn over WS -- the paired `_emit_run_event` + buffered `.send()` double-emission is removed at EVERY site where the pair occurs"

`run.blocks` still double-emits over WS at both paired sites, exactly as before this plan. Per D-19's own text in `125-CONTEXT.md`, "the client guard stays regardless so CodePulse is not silently dependent on a specific Ástríðr build being deployed" -- so plan 125-09's client-side dedup guard is the only mitigation currently in place for the numeral-overcounting risk this creates. Downstream plans that assume the upstream `astridr-repo` fix landed (the D-17 numeral's exactness claim, and any future assertion that "the double-emission was fixed in 125-03") should be corrected against this finding.

**Recommended next step (not taken by this executor -- outside plan 125-03's authorized scope):** a follow-up decision is needed on how to dedup `run_blocks` persistence without losing the `_emit_run_event` path's session-id-override correctness -- e.g. adding an idempotency/dedup key to `runBlocks.record` so persistence can survive collapsing to a single WS emission, or accepting the double-write to Convex as a permanent, documented characteristic and fixing only the WS-visible numeral (which plan 125-09's client guard already covers).

## Verification

- `python -m pytest tests/test_estop.py tests/engine tests/agent -q` from `C:\Users\mandr\astridr-repo` -> **61 passed, 0 failed** (Task 3 made no code changes, so `tests/agent` is the pre-existing baseline, confirmed still green).
- `git -C C:/Users/mandr/astridr-repo diff --stat` (working tree after both commits): only `.planning/STATE.md` shows as modified, and that file is astridr-repo's own STATE.md, pre-existing dirty from a concurrent session at dispatch time (see Deviations / cross-repo disclosure below) -- not touched by this plan.
- **Nothing was deployed.** No `docker compose`, `docker restart`, or `docker build` ran at any point in this plan.
- CodePulse's `npm test` is unaffected -- no file in `codepulse/` other than this SUMMARY and STATE.md/ROADMAP.md was modified.

## Cross-Repo Commits (astridr-repo, branch `feature/brain-swap`)

1. **`86b6282b`** -- `feat(125-03): emit estop_state telemetry from EmergencyStop activate/deactivate`
   Files: `astridr/engine/estop.py`, `tests/test_estop.py` (2 files, 102 insertions).
2. **`eb8f780b`** -- `feat(125-03): push estop_state snapshot on every WS connect`
   Files: `astridr/engine/bootstrap/wiring.py`, `astridr/engine/ws_telemetry.py`, `tests/engine/test_ws_telemetry_estop.py` (3 files, 172 insertions).

Both commits verified individually via `git show --stat <hash>` immediately after committing -- each contains *only* its intended files. **A concurrent session on the same branch committed on top of each of mine** (`c513798c` "fix(gateway): close two argv-limit holes..." after commit 1; `7c97bde2` "test(195-01): add persona_dials WS command test cases" after commit 2) -- neither touches any file this plan modified, confirmed by their own `git show --stat` output. No foreign file was swept into either of my commits.

**astridr-repo's own `.planning/STATE.md`** was already modified by a concurrent session before this plan started (present in the very first `git status --short` of this session) and remains modified now -- not part of this plan's scope, left untouched, disclosed per the cross-repo warning.

## Deviations from Plan

### Auto-fixed / adjusted (documented above, not repeated here)
- Task 2's two grep-based acceptance criteria (`estop=estop` count, `estop_state` count) returned higher numbers than the plan expected, for benign reasons (pre-existing threading, added comments) -- see Task 2 section above for the full accounting.

### Rule 4 -- architectural stop, plan-authorized branch taken
- **[Plan's own D-19 STOP condition] `run.blocks` was NOT made single-emission.** A persisted Convex consumer (`/live-run`'s `LiveRun.tsx`) reads the `run_blocks` table that the buffered `.send()` call is the sole writer to. Deleting it would have silently broken that page's history view. The plan explicitly anticipated and authorized this exact STOP branch ("If a persisted consumer exists, STOP, leave both emissions in place, and report"), so no code was changed and no permission was needed to take this action -- it is reported here in full per that instruction, with the population re-derivation, the persisted-consumer grep, and the telemetry.py evidence establishing why the STOP applies.

No other deviations. Tasks 1 and 2 were executed exactly as specified, with the two grep-arithmetic corrections noted above.

## Known Stubs

None introduced by this plan.

## Threat Flags

None -- the plan's own `<threat_model>` (T-125-03-01 through T-125-03-06, T-125-03-SC) already covers every trust boundary this plan's Task 1/2 changes cross (WS auth gate, read-only `estop` properties, no new write path). Task 3 made no code changes, so introduces no new surface.

## Self-Check

- `astridr/engine/estop.py` -- FOUND (2 `estop_state` sends confirmed via grep, shown above).
- `astridr/engine/ws_telemetry.py` -- FOUND (`estop` parameter + on-connect push confirmed via grep, shown above).
- `astridr/engine/bootstrap/wiring.py` -- FOUND (`estop=estop,` at the `create_ws_router` call site).
- `tests/test_estop.py` -- FOUND, 27 tests passing.
- `tests/engine/test_ws_telemetry_estop.py` -- FOUND (new file), 4 tests passing.
- `tests/agent/test_run_blocks_single_emit.py` -- CONFIRMED ABSENT (intentional -- see Task 3 above).
- Commit `86b6282b` -- FOUND in `astridr-repo` history (`git log --oneline --all | grep 86b6282b`).
- Commit `eb8f780b` -- FOUND in `astridr-repo` history (`git log --oneline --all | grep eb8f780b`).

## Self-Check: PASSED
