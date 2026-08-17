---
phase: 108-per-profile-engine-telemetry-astridr-backend
verified: 2026-08-07T18:39:25Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 108: Per-Profile Engine Telemetry (astridr backend) Verification Report

**Phase Goal:** Ástríðr's per-profile engine axis genuinely exists — real telemetry, a scoped swap
command, and a queryable swap-history route — verified live before CodePulse UI work depends on it.
**Verified:** 2026-08-07T18:39:25Z
**Status:** passed
**Re-verification:** No — initial verification

## Adversarial method

This report does not accept `108-ENGINE-05-EVIDENCE.md`'s verdicts on faith. For every claim below,
the underlying source file was opened directly in the repo the claim is about (astridr-repo branch
`feature/brain-swap`, codepulse `master`), cross-referencing exact line content against what the
plans/summaries/evidence say it should contain. Where the evidence file's own test/row counts were
checked, they were independently re-run (`npx vitest run` on the four targeted swap-history test
files — see Behavioral Spot-Checks) rather than copied from the SUMMARY. `git branch --show-current`
was run before every astridr-repo command in this session to avoid the CWD-drift failure mode this
phase's dispatch explicitly warned about.

## Goal Achievement

### Observable Truths (ROADMAP § Phase 108 success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A profile's engine resolution/swap on the running stack produces a telemetry row with a real `profileId` and model — never an `unknown` sentinel — and an unresolved value is refused at emit | ✓ VERIFIED | Code: `astridr/providers/router.py:494-518` (`_emit_model_routing`) — `profile_id = get_profile_context()`; returns with no emit and a `logger.debug("router.model_routing_skipped", reason="no_profile_context"...)` when absent, and again on `not resolved_model`. Live: `108-ENGINE-05-EVIDENCE.md` Task 2(e) — `activeEngine:latestByProfile` returns 3 rows (`consulting`/`business`/`personal`), each `mode:"inherited"`, `model:"anthropic/claude-sonnet-5"`, no `"unknown"` anywhere; Step 4 — after a scoped swap, `consulting`'s row reads `model:"claude-opus-4-8"`, `selectionPath:"profile-swap-override"`. |
| 2 | `swap.set` accepts an explicit profile scope and swaps only that profile; an unscoped call stays byte-identical to today's global behaviour | ✓ VERIFIED | Code: `astridr/api/ws_commands.py:1121-1147` — `cmd.profile_id` validated fail-closed against `known_profile_ids()` (`raise ValueError(f"unknown profile_id: ...")`) before dispatch, only then threaded into `args["profile_id"]`; `astridr/providers/router.py:437-441` — the per-profile override rung sits above the global rung, and with no profile in context the chain is unchanged (confirmed by reading the surrounding `_resolve_model` code, not just the comment). Live: Evidence Task 3 Step 4(b) — `business`/`personal` rows are **byte-identical** (`_id`, `timestamp`) to the pre-swap baseline after `consulting`'s scoped swap; Step 5 — the unscoped swap correctly changed `business` while leaving `consulting`'s pin untouched (same `_id`); Step 7 — a negative control (unknown `profile_id`) was rejected with `status:"error"` and the row set unchanged (byte-identical before/after). |
| 3 | `control_verb_swap` events route to a queryable domain table and can be listed as per-profile swap history | ✓ VERIFIED | Code: `convex/controlVerbSwaps.ts` — `record` (`internalMutation`, D-13/CR-01 compliant, not in client `api.` namespace) and `listByScope` (bounded `.take(SWAP_HISTORY_CAP)` over `by_scope` index, no `.collect()`); `convex/runtimeIngest.ts:1022` `case "control_verb_swap"` routes through `internal.controlVerbSwaps.record`; `convex/retention.ts:77` — `controlVerbSwaps: 30` (D-14 bound present). Live: this criterion **failed twice** before passing — see Adversarial Findings below — final round ("Second re-proof", evidence lines 1058-1093) pastes a raw row for a scoped swap (`scope:"consulting"`, `path:"claude-native"`, `providerAffinity` a 6-element array) and a raw row for an unscoped swap (scope column empty, same shape) directly from `controlVerbSwaps:listByScope`/`controlVerbSwaps data`. Independently re-verified: `npx convex run controlVerbSwaps:listByScope` semantics match `listByScope`'s actual handler code read directly. |
| 4 | All three of the above observed live before Phase 109 begins, closing ENGINE-05 | ✓ VERIFIED | `108-ENGINE-05-EVIDENCE.md` Task 4 — "Larry reviewed the evidence above ... and replied 'approved' on 2026-08-07." `.planning/REQUIREMENTS.md` (read directly, not the SUMMARY's paraphrase): ENGINE-05/ENGINE-01/ENGINE-02 all show `[x]` and "Complete (2026-08-07, operator sign-off...)". Phase 109 in ROADMAP.md has `Plans: TBD` — has not started. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `astridr-repo:astridr/providers/router.py` | `_emit_model_routing` profileId/refuse-to-emit/mode derivation/emit-on-change; `_resolve_model` per-profile rung | ✓ VERIFIED | Read directly at `:399-427` (call sites), `:480-561` (`_emit_model_routing`), `:429-472` (`_resolve_model`). Matches D-01/D-02/D-04/D-09/D-11/D-12 exactly. |
| `astridr-repo:astridr/channels/agent_processor.py` + `astridr/engine/bootstrap/wiring.py` | try/finally ContextVar lifecycle at both live set-points | ✓ VERIFIED | `agent_processor.py:123-165` — `set_profile_context` before the try body, `reset_profile_context(_profile_token)` in the `finally`. `wiring.py:349-351,616` — same pattern at the second set-point. |
| `astridr-repo:astridr/api/ws_commands.py` | `SwapSetCommand.profile_id` + fail-closed validation | ✓ VERIFIED | `:253` field present; `:1121-1147` validates before dispatch. |
| `astridr-repo:astridr/engine/control_verbs/swap_model.py` | scoped set/restore branches + scope on all four `control_verb_swap` emits + restore-emits-honest-inherited-row cleanup | ✓ VERIFIED | `:436-506` executor branches on `args["profile_id"]`; `:435-489` `_emit_restore_routing` reuses `_emit_profile_model_routing_seed`, D-04 pinned-profile exclusion present in code (`if _router.get_profile_override(p.id) is None`). |
| `astridr-repo:astridr/engine/bootstrap/core.py` | D-03 boot seed, reusable for D-cleanup's restore path | ✓ VERIFIED | `:137-197` `_emit_profile_model_routing_seed`, falsy-`model_default` skip present; `:1437` called from `bootstrap()`. |
| `codepulse:convex/schema.ts` | `controlVerbSwaps` table, `providerAffinity` as `v.optional(v.array(v.string()))` | ✓ VERIFIED | `:2093` table defined; `convex/controlVerbSwaps.ts:60` confirms array type, matching the emitter's real `list[str]`. |
| `codepulse:convex/controlVerbSwaps.ts` | `record` internalMutation + bounded `listByScope` query | ✓ VERIFIED | Full file read; matches D-13/D-14/CR-01/T-108-12 exactly. |
| `codepulse:convex/runtimeIngest.ts` | `case "control_verb_swap"`, `isOptionalStringArray`, `status:"failed"` skip on `model_routing` | ✓ VERIFIED | `:1022` case present; `:262` `isOptionalStringArray` guard present and used at `:392`. |
| `codepulse:convex/retention.ts` | `RETENTION_DAYS` entries for both new/newly-fed tables | ✓ VERIFIED | `:70` `activeEngineSnapshots: 30`, `:77` `controlVerbSwaps: 30`. |
| `codepulse:src/hooks/useControlVerbSwaps.ts` + `src/components/brains/GlobalSwapModal.tsx` | swap-history readout, honestly gated on a real `profileId` | ✓ VERIFIED | `GlobalSwapModal.tsx:277-284` — `SwapHistorySection` returns nothing when `profileId === undefined`; `:638` the modal's only mount site passes `profileId={undefined}` explicitly, with a comment explaining why (D-15 falsified, hand-off to Phase 109). This is the corrected, honest state — not a stub masquerading as a feature. |
| `108-ENGINE-05-EVIDENCE.md` | verbatim command transcript + pasted rows for every SC | ✓ VERIFIED | 1559-line file, read in full (both halves). Contains two genuine FAILED rounds with root-cause traces before the final PASS — this is the load-bearing artifact and it is not a sanitized success narrative. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `router.py::_emit_model_routing` | `convex/runtimeIngest.ts::case "model_routing"` | `/runtime-ingest` HTTP POST, field `model`/`profileId` | ✓ WIRED | Live rows in evidence prove end-to-end delivery, not just code-level plausibility. |
| `ws_commands.py::_handle_swap_set` | `swap_model.py::_execute` | `args["profile_id"]` through `VERB_REGISTRY` dispatch | ✓ WIRED | One dispatch path confirmed by direct code read (D-05's promise); live scoped/unscoped/negative-control swaps all behaved as coded. |
| `swap_model.py` emit sites | `convex/controlVerbSwaps.ts::record` | `runtimeIngest.ts` `case "control_verb_swap"` → `internal.controlVerbSwaps.record` | ✓ WIRED (after 2 fixes) | First proof: FAILED — `session_id` explicit `null` rejected by `isOptionalString`. Re-proof 1: FAILED — `providerAffinity` array rejected by a scalar-only guard. Re-proof 2: PASS — raw rows pasted for both scoped and unscoped swaps. All three rounds independently traced to file:line in the evidence, and this verifier confirmed the final fixed code (`isOptionalStringArray`, `normalizeOptional`) is what is actually on disk now, not merely claimed fixed. |
| `useControlVerbSwaps` hook | `api.controlVerbSwaps.listByScope` | `useQuery` | ✓ WIRED, honestly inert | Hook/query call is real; the modal's only call site passes `undefined` deliberately (D-15 falsified) so it renders nothing today. This is documented, not concealed, and is explicitly out of this phase's scope (Phase 109 owns giving it a real `profileId`). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Targeted swap-history/ingest test suite actually passes (not just claimed in SUMMARY) | `npx vitest run convex/controlVerbSwaps.test.ts convex/runtimeIngest.test.ts src/hooks/useControlVerbSwaps.test.ts src/components/brains/GlobalSwapModal.test.tsx` | `Test Files 4 passed (4)` / `Tests 146 passed (146)` | ✓ PASS — matches the evidence file's own re-run count exactly (146/146), independently reproduced by this verifier, not copied. |
| No debt markers left in phase-modified files | `grep -n "TODO\|FIXME\|XXX\|TBD"` across all 11 touched core files (astridr + codepulse) | no output, both repos | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in either repo for this phase; `108-07-PLAN.md`'s own gate (Task 1-4 of `108-07`, `autonomous: false`) **is** the probe — it is a hand-run WS/Convex command sequence against the live self-hosted stack, not a scripted file. It was executed three times (two of which failed and were fixed) and is fully reproduced verbatim in `108-ENGINE-05-EVIDENCE.md`. This verifier did not re-run the live WS swap commands against the production astridr stack (that would mutate live state and requires the same operator consent gate Task 1 of 108-07 required) — treated as SKIPPED for re-execution, but the transcript was read in full and cross-checked against the code that would produce it, which is the strongest verification available without re-triggering a live production mutation.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| ENGINE-01 | 108-01, 108-03 | Per-profile emitter, real profileId/model, refuse-to-emit | ✓ SATISFIED | REQUIREMENTS.md `[x]`, code read directly, live rows in evidence. |
| ENGINE-02 | 108-04, 108-05 | Scoped `swap.set`, byte-identical unscoped behaviour | ✓ SATISFIED | REQUIREMENTS.md `[x]`, code read directly, live scoped+unscoped+negative-control proof. |
| ENGINE-05 | 108-07 | Live integration gate before Phase 109 | ✓ SATISFIED | REQUIREMENTS.md `[x]`, Task 4 operator sign-off recorded, all 4 roadmap SCs proven live. |
| TELE-02 | 108-02, 108-03, 108-05, 108-06 (routed half) | `control_verb_swap` routed + surfaced | Reassigned to Phase 109 on 2026-08-07 | Per explicit task instruction: this is deliberate, recorded history (commits `0bb46b46`, `0df7ea7a`, `f28d1193`), confirmed in REQUIREMENTS.md (`Phase 109 | Pending`) and ROADMAP.md §Phase 108/109. **Not reported as a gap** — the routed half TELE-02 needed is genuinely code-complete and proven live in this phase (same rows that prove SC3 above); only the "surfaced on a real per-profile host" half moved, correctly, because D-15's chosen host (`GlobalSwapModal`) was proven architecturally incapable of it (all-profiles axis, one mount site, non-optional `listByScope` signature). |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s ENGINE section maps only ENGINE-01/02/03/04/05 to this milestone, and only 01/02/05 to Phase 108 (03/04 belong to Phase 109, out of this phase's scope by design).

### Anti-Patterns Found

None. No `TODO`/`FIXME`/`XXX`/`TBD` markers in any of the 11 core files this phase touched (astridr: `router.py`, `ws_commands.py`, `swap_model.py`, `swap_voice.py`, `bootstrap/core.py`; codepulse: `controlVerbSwaps.ts`, `runtimeIngest.ts`, `schema.ts`, `retention.ts`, `useControlVerbSwaps.ts`, `GlobalSwapModal.tsx`). No stub returns, no hardcoded empty data flowing to a render path that claims to be live (the one place that looks like a stub — `SwapHistorySection` rendering nothing — is a deliberately honest empty state with an explicit, documented reason, not a placeholder masquerading as done).

## Adversarial Findings

This phase's own evidence file already exhibits the adversarial rigor this verification role is
meant to apply — genuinely rare. Specifically:

1. **Criterion 3 (`control_verb_swap` → queryable table) failed on the first TWO live attempts**, not
   zero. Round 1: every row silently dropped because `ws_commands.py:1149` sends an explicit
   `session_id: null` and `runtimeIngest.ts`'s old `isOptionalString()` guard treated `null` as
   invalid (only `undefined`/`string` passed). Round 2, after fixing round 1: rows *still* didn't
   land — masked by round 1's failure until it stopped masking — because `providerAffinity` is a
   Python `list[str]` but was modelled in Convex as `v.optional(v.string())`. Both defects are
   traced to file:line in the evidence and independently confirmed against the live code in this
   report's artifact table above (`isOptionalStringArray`, `v.array(v.string())`).
2. **A prior version of the ROADMAP.md text falsely claimed the routed half was "DONE and shipped"** —
   caught and corrected the same day (commit `f28d1193`) before this verification ran, once the live
   gate actually disproved it. That correction is itself evidence the phase's self-review discipline
   is functioning, not evidence of a live gap today.
3. **TELE-02's D-15 host decision was proven wrong mid-phase** (`GlobalSwapModal` cannot serve a
   per-profile readout) and was corrected by reassigning the surfaced half to Phase 109 rather than
   quietly shipping a readout that could never populate. Verified in code: the modal's one mount site
   hardcodes `profileId={undefined}` with a comment explaining why, and `SwapHistorySection` honestly
   renders nothing rather than a fabricated empty state.
4. **No sentinel or fabricated-looking claim survived to the final state.** Every row pasted in the
   final proof round in `108-ENGINE-05-EVIDENCE.md` was cross-checked against the code that would
   have produced it (schema validators, ingest guards, emit-site field lists) — the code matches the
   claimed behavior in every case checked.

Nothing found in this review contradicts the phase's own account of itself. This is a case where the
executor's own adversarial process did the falsification work before this verifier arrived — the
job here was to confirm that work was real, not performed, and it was: independent code reads and an
independent test re-run corroborate the evidence file's claims rather than merely restating them.

## Human Verification Required

None. All four roadmap success criteria are supported by live command/row evidence plus independent
code reads in this session; no claim in this phase rests on visual UI, real-time behavior, or a
subjective judgment call that only a human can make. (Phase 109, which builds the UI surfaces that
render this telemetry, will need human/visual verification — that is out of this phase's scope.)

### Gaps Summary

No gaps found. All must-haves verified against live code and live evidence, not against summary
narrative. TELE-02's reassignment to Phase 109 is confirmed to be deliberate, correctly recorded in
REQUIREMENTS.md/ROADMAP.md, and consistent with the explicit instruction governing this
verification — not reported as a gap.

---

_Verified: 2026-08-07T18:39:25Z_
_Verifier: Claude (gsd-verifier)_
