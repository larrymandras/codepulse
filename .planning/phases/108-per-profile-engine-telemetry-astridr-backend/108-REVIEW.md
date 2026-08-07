---
phase: 108-per-profile-engine-telemetry-astridr-backend
reviewed: 2026-08-07T18:42:40Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - convex/schema.ts
  - convex/controlVerbSwaps.ts
  - convex/runtimeIngest.ts
  - convex/retention.ts
  - convex/activeEngineFilters.ts
  - convex/activeEngine.ts
  - src/hooks/useControlVerbSwaps.ts
  - src/components/brains/GlobalSwapModal.tsx
  - astridr/providers/router.py
  - astridr/channels/agent_processor.py
  - astridr/engine/bootstrap/wiring.py
  - astridr/engine/bootstrap/core.py
  - astridr/api/ws_commands.py
  - astridr/channels/router.py
  - astridr/engine/control_verbs/swap_model.py
  - astridr/engine/control_verbs/swap_voice.py
  - astridr/engine/telemetry.py
  - astridr/automation/focus_digest.py
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: clean
---

# Phase 108: Code Review Report

**Reviewed:** 2026-08-07T18:42:40Z
**Depth:** standard (cross-repo, with targeted call-chain tracing on the restore/emit-memo interaction per the dispatch instructions)
**Files Reviewed:** 18 (15 read in full, 3 spot-checked — `swap_voice.py`, `ws_commands.py` §`SwapSetCommand`, `channels/router.py` §`known_profile_ids`)
**Status:** clean — WR-01 resolved, astridr-repo commit `ad77aa20` (2026-08-07)

## Summary

Reviewed both halves of Phase 108 (codepulse ingest/schema/UI + astridr router/telemetry/control-verb backend). The per-event try/catch in `runtimeIngest.ts`, the `normalizeOptional`/type-guard family, `swap_model.py`'s scope branching, and the restore-emits-inherited path in `bootstrap/core.py` were all read in full and traced against their call sites and tests, per the dispatch's specific ask.

All of the previously-fixed issues named in the dispatch (total `isUnresolvedRouting`, mirror-test replacement, `session_id: null` handling, `providerAffinity` array typing, stale-`pinned`-after-restore) are confirmed fixed in the live code and are not re-reported. The three explicitly-accepted items (`by_timestamp` unconsumed index, `listByScope`'s non-optional `profileId`, the `inherited`/`pinned` model-id format split) are also not re-reported.

One real, previously-unaddressed defect was found by tracing the interaction between `ModelRouter._last_routing_emit` (D-09's emit-on-change memo, `router.py`) and the ENGINE-05 restore-emission path (`swap_model.py` → `bootstrap/core.py`), which was deliberately built to bypass that memo. The two mechanisms were verified independently correct in isolation but produce a stale/wrong telemetry reading when composed in sequence. No test in the repo crosses this boundary (`swap_model.py`'s test suite uses `FakeRouter`, never the real `ModelRouter`; `router.py`'s test suite never calls the `bootstrap/core.py` restore-emission path) — grepped `_last_routing_emit` across the whole repo and confirmed it is referenced only in `router.py` itself.

No hardcoded secrets, dangerous-function usage, injection vectors, or empty-catch patterns were found in the reviewed files. Error handling, batch-poisoning isolation, and the null/undefined-vs-absent normalization discipline are all applied consistently and correctly.

## Warnings

### WR-01: RESOLVED (astridr-repo `ad77aa20`, 2026-08-07)

Fixed with the smaller of this warning's own two proposed options (a): a new
`ModelRouter.clear_last_routing_emit(profile_id)` accessor (mirrors the
`clear_profile_override` no-op-safe idiom) that `swap_model._emit_restore_routing`
calls for every profile it emits a restore seed row for, right after the seed
call — invalidating the D-09 memo entry so the next real resolution for that
profile can never be suppressed against a pre-restore value. D-09 suppression
and D-02's refuse-to-emit guard are both unchanged (verified by a control test
proving two identical consecutive resolutions with no restore in between are
still suppressed). New test `TestWR01RestoreInvalidatesEmitMemo` in
`tests/unit/engine/test_swap_model.py` exercises the exact pin → restore →
re-pin-to-the-same-model sequence against a REAL `ModelRouter` (not
`FakeRouter`, which never modeled `_last_routing_emit` — the gap this warning
names as the reason no prior test caught it) and asserts the re-pin's emit
actually fires. Both the sequence test and its control were mutation-verified
RED (once with the fix reverted, once with suppression disabled). Live
re-proof against the rebuilt stack confirms four distinct
`activeEngineSnapshots` row `_id`s across baseline → pin → restore → re-pin-
same-model, with the final re-pin row showing `mode: "pinned"`,
`model: "claude-opus-4-8"`, `selectionPath: "profile-swap-override"` — see
`108-ENGINE-05-EVIDENCE.md`'s "WR-01 fix and re-proof" section for the full
transcript. Stack restored to its pre-test default afterward, proven by a real
turn.

### WR-01 (original finding): A scoped or global restore followed by re-selecting the *same* model silently fails to update `activeEngineSnapshots`

**File:** `astridr/providers/router.py:150,472-549` (the emit-on-change memo and its consumer, `_emit_model_routing`) interacting with `astridr/engine/control_verbs/swap_model.py:436-492` (`_emit_restore_routing`) and `astridr/engine/bootstrap/core.py:137-203` (`_emit_profile_model_routing_seed`, reused by the restore path per the 108-ENGINE-05 commit)

**Issue:**

`ModelRouter._emit_model_routing` (router.py) suppresses a `model_routing` telemetry send whenever `(resolved_model, mode, selection_path, status)` is unchanged from the last value recorded in `self._last_routing_emit[profile_id]` (D-09, router.py:541-549):

```python
emit_key = (resolved_model, mode, selection_path, status)
if self._last_routing_emit.get(profile_id) == emit_key:
    ...
    return
self._last_routing_emit[profile_id] = emit_key
```

The ENGINE-05 restore fix (`_emit_restore_routing` in swap_model.py, reusing `_emit_profile_model_routing_seed` in bootstrap/core.py) intentionally sends its "honest inherited row" **directly via `telemetry.send(...)`, bypassing `_emit_model_routing` entirely** — this is documented and correct in isolation (core.py:159-163: "this seed does NOT populate `_last_routing_emit`... the first REAL resolution after boot must still emit, rather than being deduped against this seed").

The problem is that this bypass never touches or invalidates the *pre-restore* value already sitting in `_last_routing_emit[profile_id]`. Concretely:

1. Profile `consulting` is pinned to model `X` (`swap.set target=brain value=X profile_id=consulting`). A subsequent real turn resolves via `profile-swap-override` → mode `"pinned"`. `_emit_model_routing` computes `emit_key = (X, "pinned", "profile-swap-override", "success")`, finds no prior memo entry, emits, and sets `self._last_routing_emit["consulting"] = emit_key`.
2. The user restores (`swap.set restore=true profile_id=consulting`, or the spoken "back to your usual brain" for the global/unscoped case). `_router.clear_profile_override("consulting")` runs, then `_emit_restore_routing` sends a fresh `model_routing` row directly (mode `"inherited"`, `selectionPath="restore-to-default"`) — correctly updating `activeEngineSnapshots`. `_last_routing_emit["consulting"]` is **not** touched and still holds `(X, "pinned", "profile-swap-override", "success")`.
3. The user re-pins `consulting` to the **same** model `X` again (a plausible undo/redo sequence, or simply re-selecting the model they just reverted). `_router.set_profile_override("consulting", X)` runs. The next real turn resolves via `profile-swap-override` → `X` again, and `_emit_model_routing` computes the identical `emit_key = (X, "pinned", "profile-swap-override", "success")`. Since this equals the *stale* memo entry from step 1, the guard at router.py:542 treats it as unchanged and **returns without sending**.

Net effect: `activeEngineSnapshots`' latest row for `consulting` remains the `mode:"inherited"`/`selectionPath:"restore-to-default"` row from step 2, even though the profile is now genuinely re-pinned to `X`. Any CodePulse surface reading `activeEngineSnapshots` (a different tab/session, a page reload, `useActiveEngine`, the per-profile badge) shows a stale/wrong engine state — the exact class of fabricated/stale reading D-14 and the ENGINE-05 fix exist to eliminate, just reintroduced via a different path. The same mechanism applies to the unscoped/global restore branch (`_emit_restore_routing(None, ...)` seeds every currently-unpinned profile), so re-applying the same global override after a restore can suppress the update for those profiles too.

Confirmed via grep that `_last_routing_emit` is referenced only at its three sites in `router.py` (declaration, read, write) — `set_profile_override`/`clear_profile_override`/`set_global_override`/`clear_global_override` never touch it, and no call site clears or reconciles it against the restore-emission bypass.

**Confidence:** High — traced the full call chain and data flow across both files; the memo and the bypass are each individually well-reasoned and correctly documented, but their composition was not covered by any test (`test_swap_model.py` exercises `_emit_restore_routing`/`_execute` against a `FakeRouter`, never a real `ModelRouter`; `test_router.py`'s D-09 dedup test — `test_model_routing_dedup_emits_once_for_identical_resolutions` — never involves a restore in between).

**Fix:** Either (a) have `_emit_restore_routing`/`_emit_profile_model_routing_seed` also clear (`.pop(profile_id, None)`) the affected profile(s)' entries in `router._last_routing_emit` when it bypasses the memo, so the next real resolution is never deduped against a pre-restore value; or (b) fold the restore emission back through `_emit_model_routing` (with a distinct `selection_path="restore-to-default"` that already makes its `emit_key` differ from most prior states) instead of a parallel `telemetry.send(...)` call — trading the "must not populate the memo before boot's first real resolution" property for one that also can't go stale after a restore. Option (a) is the smaller, most targeted fix given the existing design intent documented in core.py:159-163.

```python
# in _emit_restore_routing, after computing target_profiles and before/after
# the _emit_profile_model_routing_seed call:
for _p in target_profiles:
    _router._last_routing_emit.pop(_p.id, None)
```

---

### WR-02: RESOLVED (codepulse `b6f6d540`, 2026-08-07)

**Found at RUNTIME** — in the browser console on the live CodePulse page — *after* this code
review (above), the phase's security audit, and the phase verifier had all already passed. None
of those three gates is structured to catch it: it is a bundler-level defect (which files a
Vite/Rollup build graph actually pulls into `dist/`), not a defect any static source read, unit
test, or requirement-coverage check would surface on its own.

**File:** `src/hooks/useControlVerbSwaps.ts:22` (introduced by plan 108-06) value-importing
`SWAP_HISTORY_CAP`/`isBrainSwap` directly from `convex/controlVerbSwaps.ts`, which imports
`internalMutation`/`query` from `./_generated/server` and defines `record`/`listByScope` — pulling
the whole Convex server runtime into the client bundle. Symptom: `client:525 Convex functions
should not be imported in the browser. This will throw an error in future versions of \`convex\`.`
on every CodePulse page load.

**Fix:** Split `SWAP_HISTORY_CAP`/`isBrainSwap` into a new pure module,
`convex/controlVerbSwapsFilters.ts` — zero `_generated/server` imports, zero function definitions —
mirroring the existing `activeEngineFilters.ts` precedent for the active-engine axis.
`convex/controlVerbSwaps.ts` now imports the constant from the shared module instead of defining
it, deliberately without re-exporting it, so the old `./controlVerbSwaps` import path stops
resolving for browser code rather than staying open as a trap for the next consumer. The hook and
both affected test files were repointed at the pure module; the pre-existing
`SWAP_HISTORY_CAP`-equals-the-server-value drift-guard test (`useControlVerbSwaps.test.ts`) became
tautological once both sides import the same shared binding, so it was restructured to instead
read `convex/controlVerbSwaps.ts`'s own source and assert its `.take()` still consumes the shared
symbolic constant rather than a hardcoded literal.

**Proof:** Full sweep of every `src/ → convex/` value/type import in the repo confirmed this was
the only unsafe one (all others are either `import type` — erased at compile time — or target
already-pure modules). After the fix, `npm run build` was grepped: `providerAffinity`,
`internalMutation`, and `sessionId` (strings unique to `controlVerbSwaps.ts`'s `record` mutation)
are absent from every `dist/assets/*.js`, while a known-present control string (`"Showing the
last"`) and the actually-shipped `GlobalSwapModal` code path (`"Recent swaps"`, `"swap_model"`)
are present — confirming the fix landed on the live, reachable code path. Full suite (280 files,
0 failed) re-run clean in an isolated worktree pinned to the fix commit.

**Commit:** `b6f6d540`

---

## What I dropped and why

- **Restore for a profile with a falsy `model_default` still emits nothing** (core.py:165-167, `_emit_profile_model_routing_seed`'s D-02-parity skip) — initially looked like a related staleness gap, but `tests/unit/engine/test_swap_model.py::test_scoped_restore_falsy_model_default_emits_nothing` confirms this is deliberate, tested, documented behavior (D-02 parity: "a row with no model is not a reading"), not an oversight. Dropped.
- **`describeSwapOutcome`'s `"unresolved"` branch** (`useControlVerbSwaps.ts`) appears unreachable given the astridr emitter's actual `path` vocabulary (`claude-native | openrouter | refused | restore`, always paired with `resolved` for the first two and `null` only for `refused`/`restore`) — but it's explicitly defensive dead code guarding against an ingest-boundary type slip, not a logic error. Dropped as not-a-bug.
- **`_emit_model_routing` sets `self._last_routing_emit[profile_id] = emit_key` before `await self._telemetry.send(...)` completes** — looked like a possible "marked-sent-before-actually-sent" race, but `ConvexHandler.send()` is a synchronous buffer-append for non-critical events (`model_routing` is not in `CRITICAL_CONDITIONS`) and cannot raise from a transport failure at that call site (`_post_to_convex` catches every exception internally in its own retry loop). Not exploitable. Dropped.
- Did not re-scan for hardcoded secrets / `eval` / dangerous functions beyond a standard read-through — none present in any reviewed file, and none of the phase's diff touches auth, credentials, or shell/SQL construction.
- `docs/astridr-contract.md`, all `*-PLAN.md`/`*-SUMMARY.md`/`*-CONTEXT.md` phase artifacts, and test files were read for context but not scanned as review targets, per the review-file-list scope and the "don't report issues in test files" rule.

---

_Reviewed: 2026-08-07T18:42:40Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
