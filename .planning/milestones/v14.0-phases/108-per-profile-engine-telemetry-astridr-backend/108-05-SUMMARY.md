---
phase: 108-per-profile-engine-telemetry-astridr-backend
plan: 05
subsystem: api
tags: [astridr, control-verbs, model-routing, contextvars, telemetry, bootstrap, ws-commands]

# Dependency graph
requires:
  - phase: 108-04
    provides: "ModelRouter per-profile override store + accessor trio (set/clear/get/get_source), SwapSetCommand.profile_id + fail-closed validation threading args['profile_id'] into VERB_REGISTRY dispatch"
  - phase: 108-01
    provides: "router.py's model_routing emit path (_MODE_BY_SELECTION_PATH, refuse-to-emit guard, emit-on-change memo _last_routing_emit, payload field 'model')"
provides:
  - "swap_model._execute genuinely scopes: a scoped swap.set writes ONLY the per-profile override, an unscoped one writes ONLY the global one -- byte-identical to pre-phase behavior. Same split for restore (D-04, both directions)."
  - "All four control_verb_swap emit sites (restore, unresolved, affinity-refused, success) carry scope: profile_id | None (D-13)"
  - "astridr boot-seeds one model_routing event per configured profile, mode:'inherited', via an extracted, independently-testable _emit_profile_model_routing_seed helper (D-03)"
  - "103-CONTRACT.md's scoped-restore paragraph confirmed factually accurate, with a pointer to this plan's live in-process proof"
  - "One proxy-only WS-command rejection test strengthened to assert real voice_override state, not just a mock's call log"
affects: [108-06, 108-07, 109]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scope-branch pattern: read args.get('profile_id') or None once at the top of _execute, branch every override read/write and every telemetry field on it -- never re-derive per branch"
    - "D-03 boot-seed logic extracted into a standalone async helper (mirrors this same file's own _emit_boot_malformed_policy_telemetry precedent) so inline bootstrap()-sequencer behavior with branching (the falsy-model_default skip) is independently testable without invoking the full bootstrap() coroutine"
    - "Strengthening a proxy-only mock-call-log test: register the REAL control verb wrapped only to also count invocations (delegates every call through), so both the call-log assertion and a real-module-state assertion are available in one test"

key-files:
  created:
    - "astridr-repo:tests/unit/engine/bootstrap/test_boot_model_routing_seed.py"
  modified:
    - "astridr-repo:astridr/engine/control_verbs/swap_model.py"
    - "astridr-repo:astridr/engine/control_verbs/swap_voice.py"
    - "astridr-repo:astridr/engine/bootstrap/core.py"
    - "astridr-repo:docs/astridr-contract.md"
    - "astridr-repo:tests/unit/engine/test_swap_model.py"
    - "astridr-repo:tests/unit/engine/test_swap_voice.py"
    - "astridr-repo:tests/unit/engine/test_ws_commands.py"
    - "codepulse:.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md"

key-decisions:
  - "Task 1 and Task 2 (plan's own split) committed together in astridr-repo -- the diff hunks are genuinely interleaved (both land inside the same restore/success branches of the same _execute function), so splitting into two commits would require artificial hunk-level surgery with no benefit."
  - "D-03's boot seed extracted into a standalone async helper (_emit_profile_model_routing_seed) rather than left as a bare inline statement inside the profile_config for-loop as the plan's draft literally described -- makes the falsy-model_default skip independently testable, mirroring this file's own established precedent for untested inline bootstrap-sequencer logic."
  - "ENGINE-02 left Pending in REQUIREMENTS.md despite the code now genuinely doing what its text describes (proven live in-process below) -- followed the plan's explicit instruction to match 108-04's precedent: nothing is deployed, and ENGINE-05's live-stack gate (108-07, deferred) is this phase's stated bar for 'verified working,' not a green unit suite."

patterns-established: []

requirements-completed: []
# ENGINE-02's literal text is now TRUE in the code (see "Live Proof" below) but the checkbox stays
# Pending per this plan's explicit instruction to follow 108-04's precedent -- nothing is deployed,
# and ENGINE-05 (108-07, deferred this session) is the live-stack gate this phase requires before
# claiming a requirement done. REQUIREMENTS.md's ENGINE-02 row gets a prose note recording the
# code-complete state instead of a checkbox flip. ENGINE-01 was already Complete before this plan
# (108-01/108-03). TELE-02 stays clearly Pending -- its "surfaced as swap history" half is 108-06's job.

# Metrics
duration: ~35min (commit timestamps 08:46:12-08:46:53 for the 3 astridr-repo code commits; includes a ~5m48s full astridr-repo suite run as the wave-merge gate plus live in-process proof scripts before committing)
completed: 2026-08-07
---

# Phase 108 Plan 5: Scoped swap.set Wired to the Per-Profile Override Store Summary

**`swap_model._execute` now branches on `args["profile_id"]` — a scoped swap writes only the per-profile override, an unscoped one writes only the global one (byte-identical to before this phase), with the same split for restore; all four `control_verb_swap` emits carry `scope`; Ástríðr boot-seeds one `model_routing` event per profile at `mode:"inherited"`.**

## Performance

- **Duration:** ~35 min (commit timestamps 08:46:12 → 08:46:53 for the 3 astridr-repo code commits; total session time including reading 108-04's delivered interfaces, live in-process proof scripts, and the ~5m48s full-suite wave-merge gate was longer)
- **Completed:** 2026-08-07
- **Tasks:** 3/3 plan tasks + 1 additional small fix (all from the plan/prompt)
- **Files modified:** 8 (7 astridr-repo, 1 codepulse contract doc; +1 new astridr-repo test file)

## Accomplishments

- `swap_model._execute` reads `profile_id = args.get("profile_id") or None` once at the top. The
  restore branch now calls `clear_profile_override(profile_id)` when scoped, `clear_global_override()`
  when not — exactly mirroring the set branch's `set_profile_override(...)`/`set_global_override(...)`
  split. A spoken utterance's `match()` never produces `profile_id`, so voice swaps always take the
  unscoped/global path (D-07), proven by a regression-guard test driving `match()` directly.
- All four `control_verb_swap` telemetry emits (restore, unresolved, affinity-refused, success) now
  carry `"scope": profile_id | None` (D-13) — added at the two dict-construction sites the plan's own
  interfaces block identified, verified with 13 scope-focused tests (`-k scope` selects 13, ≥ the
  plan's 8-minimum).
- `swap_voice.py` gets a disposition comment, not a code change: no per-profile concept exists there,
  so its payloads deliberately omit `scope` rather than carrying a structurally-always-null field —
  two new regression tests assert neither its swap nor its restore payload ever carries a truthy
  `scope`.
- `docs/astridr-contract.md`'s `control_verb_swap` field table documents the new `scope` field,
  swap_model-only.
- Ástríðr now boot-seeds one `model_routing` event per configured profile, `mode:"inherited"`, via a
  new `_emit_profile_model_routing_seed(config, telemetry)` helper called from `bootstrap()` right
  after the existing `profile_config` push loop. A profile with a falsy `model_default` is skipped
  (5 tests, including "one profile skipped, others still seeded" and "no profiles configured").
- **103-CONTRACT.md's scoped-restore paragraph (§2) is now proven true, not just specified** — see
  "Live Proof" below.
- Strengthened `test_swap_set_voice_target_with_profile_id_rejected_zero_verb_calls`
  (`test_ws_commands.py`) to register the REAL `swap_voice` control verb (wrapped only to also count
  invocations) and assert real `voice_override` module state is unchanged, not just a throwaway fake's
  call log.

## Task Commits

1. **Task 1 + Task 2 (combined — see Decisions): scoped set/restore branching + scope on all four telemetry emits** (astridr-repo) - `281b65a9` (feat)
2. **Task 3: D-03 boot seed** (astridr-repo) - `98eab76c` (feat)
3. **Additional small fix: strengthen the voice+profile_id proxy test** (astridr-repo) - `f644b845` (test)
4. **103-CONTRACT.md verification note** (codepulse) - `783f8407` (docs)

**Plan metadata:** (this commit, see below)

## `git show --stat HEAD` for every commit

```
commit 281b65a9fddb879da06a8b3c204069626f4ba549 (astridr-repo, feature/brain-swap)
feat(108-05): wire scoped swap.set to the per-profile override store (D-04/D-07/D-13)
 astridr/engine/control_verbs/swap_model.py |  39 ++++-
 astridr/engine/control_verbs/swap_voice.py |  10 ++
 docs/astridr-contract.md                   |   1 +
 tests/unit/engine/test_swap_model.py       | 262 ++++++++++++++++++++++++++++-
 tests/unit/engine/test_swap_voice.py       |  26 +++
 5 files changed, 335 insertions(+), 3 deletions(-)

commit 98eab76c1b12f5cf617efb4c9d23ab271b3bc2a7 (astridr-repo, feature/brain-swap)
feat(108-05): boot-seed one model_routing event per profile, mode inherited (D-03)
 astridr/engine/bootstrap/core.py                                   |  57 +++++++++
 tests/unit/engine/bootstrap/test_boot_model_routing_seed.py        | 114 ++++++++++++++
 2 files changed, 171 insertions(+)

commit f644b84571f7f2658ba4e354fc38afe9c639c964 (astridr-repo, feature/brain-swap)
test(108-05): strengthen swap.set voice+profile_id rejection test to assert real state
 tests/unit/engine/test_ws_commands.py | 64 ++++++++++++++++++++++++++++++-----
 1 file changed, 55 insertions(+), 9 deletions(-)

commit 783f84077bfd1250393e713b868f8e48f0196922 (codepulse, master)
docs(108-05): confirm 103-CONTRACT.md's scoped-restore paragraph is now factually accurate
 .../103-brain-swap-control-surface/103-CONTRACT.md | 9 +++++++++
 1 file changed, 9 insertions(+)
```

**Disclosure check:** after every commit I ran `git show --stat HEAD` and confirmed the file list
contained ONLY my own intended paths in all four commits. `git status --short` before each staging
step showed `.claude/settings.json` (astridr-repo) modified pre-existing, not touched by this plan, not
staged. No `git stash`, `git checkout -- <file>` (except the deliberate backup-copy restore pattern
described in mutation checks below), `git clean`, `--amend`, or branch switch was used anywhere in this
plan.

## Live Proof (MANDATORY_extra_task_contract_correctness requirement)

Ran a throwaway in-process script driving the REAL `swap_model._execute` against a hand-built
`ModelRouter` instance (constructed via `__new__` + manually seeded state slots, `set_dependencies()`
wiring a fake OpenRouter provider). Real before/after state, pasted verbatim:

```
=== SCOPED RESTORE TEST ===
BEFORE scoped restore:
  global override: global-model-X
  personal profile override: profile-model-Y
AFTER scoped restore:
  global override: global-model-X          <- UNCHANGED
  personal profile override: None          <- CLEARED
  result.handled: True

=== UNSCOPED RESTORE TEST ===
BEFORE unscoped restore:
  global override: global-model-X2
  personal profile override: profile-model-Y2
AFTER unscoped restore:
  global override: None                    <- CLEARED
  personal profile override: profile-model-Y2   <- UNCHANGED
  result.handled: True
```

This is the exact opposite of what the adversarial probe found live BEFORE this plan (scoped restore
clearing the global override, profile pin left intact — grep for `profile_id` in `swap_model.py`
returned zero hits pre-plan). 103-CONTRACT.md §2's restore-semantics paragraph is now proven true, not
merely specified — annotated in place (codepulse commit `783f8407`), matching D-08's convention (no
divergence found, so no rewording was needed beyond the verification note).

**Boot seed real-payload capture** (a real `_emit_profile_model_routing_seed` call, real `RecordingTelemetry`):

```
model_routing {'profileId': 'personal', 'model': 'anthropic/claude-sonnet-5', 'mode': 'inherited', 'selectionPath': 'boot-seed', 'status': 'success'}
model_routing {'profileId': 'business', 'model': 'x-ai/grok-4.5', 'mode': 'inherited', 'selectionPath': 'boot-seed', 'status': 'success'}
total sends: 2
```
(a third profile with `model_default=""` correctly produced zero sends — debug-logged, not sent)

**Emit-on-change memo interaction proof** (108-01's D-09 guard): ran the boot seed, then a REAL
`ModelRouter._emit_model_routing()` call for the SAME profile+model with a different `selection_path`
("codepulse-default") against a router whose `_last_routing_emit` was never touched by the seed:

```
after boot seed, sends: [('model_routing', {'profileId': 'personal', ..., 'selectionPath': 'boot-seed'})]
router._last_routing_emit before first real resolution: {}
after first REAL resolution, total sends: 2
  model_routing personal anthropic/claude-sonnet-5 boot-seed
  model_routing personal anthropic/claude-sonnet-5 codepulse-default
```

The first real post-boot resolution still emitted (2nd send) — the seed did not populate
`_last_routing_emit` and therefore did not dedupe-suppress it, confirming the design note in both the
code comment and 103-CONTRACT.md.

## Files Created/Modified

- `astridr-repo:astridr/engine/control_verbs/swap_model.py` — scope-aware `_execute`: `profile_id`
  read once, restore/set branches split on it, `scope` added to both telemetry dict-construction sites
- `astridr-repo:astridr/engine/control_verbs/swap_voice.py` — disposition comment only, no behavior
  change (no per-profile concept exists there)
- `astridr-repo:astridr/engine/bootstrap/core.py` — `_emit_profile_model_routing_seed(config,
  telemetry)` helper + one call site right after the existing `profile_config` push loop
- `astridr-repo:docs/astridr-contract.md` — `control_verb_swap` field table gains the `scope` row
- `astridr-repo:tests/unit/engine/test_swap_model.py` — `FakeRouter` extended with
  profile-override tracking; `TestScopedSwapSet` (5 tests) + `TestScopeOnTelemetry` (8 tests)
- `astridr-repo:tests/unit/engine/test_swap_voice.py` — 2 new regression tests (scope never truthy)
- `astridr-repo:tests/unit/engine/bootstrap/test_boot_model_routing_seed.py` — new file, 5 tests
- `astridr-repo:tests/unit/engine/test_ws_commands.py` — one test strengthened to real state
- `codepulse:.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md` — §2
  verification note

## Decisions Made

- **Task 1 + Task 2 committed together** (see key-decisions above) — the plan's own `<interfaces>`
  block already noted the two telemetry dict-construction sites are shared by both tasks; the diff
  hunks turned out to be genuinely inseparable without artificial surgery.
- **D-03's boot seed extracted into a standalone helper** rather than left as a literal inline
  statement inside the `profile_config` for-loop (the plan's draft literal instruction) — makes the
  falsy-`model_default` skip independently testable without invoking the full `bootstrap()` coroutine,
  mirroring this same file's own `_emit_boot_malformed_policy_telemetry` precedent (Phase 182 TAP-04)
  and this test directory's established convention (`test_core_on_config_change.py`'s own docstring)
  for untested inline bootstrap-sequencer logic. The call site sits at the same iteration point
  (immediately after the `profile_config` loop finishes) and the literal string `"model_routing"`
  still appears exactly once in `core.py`, satisfying the plan's acceptance-criteria grep.
- **ENGINE-02 left Pending** — see requirements-completed note above and REQUIREMENTS.md's new prose.

## Deviations from Plan

### Auto-fixed Issues

**1. [Doc consistency] STATE.md frontmatter `stopped_at` was stale against its own Current Position section**
- **Found during:** STATE.md update at the end of this plan
- **Issue:** The frontmatter `stopped_at` field still read "Completed 108-03-PLAN.md" while the
  Current Position section below it already said "Plan 108-04 complete" — the two disagreed.
- **Fix:** Corrected both to describe 108-05's completion, in agreement with each other.
- **Files modified:** `codepulse:.planning/STATE.md`
- **Committed in:** final metadata commit (see below)

**2. [Test-mechanics] swap_voice.py's disposition comment initially tripped its own "scope count must be 0" acceptance grep**
- **Found during:** Task 2, running `grep -c '"scope"' astridr/engine/control_verbs/swap_voice.py`
- **Issue:** My first-draft comment explaining the deliberate omission used the literal quoted string
  `"scope"` (e.g. `no "scope" key`), which the plan's own acceptance criterion greps for and requires
  to be exactly 0 in this file.
- **Fix:** Reworded the comment to describe the field unquoted ("no per-profile SCOPE key", "a
  hardcoded scope=None key") so the explanation reads the same but no longer contains the literal
  quoted substring.
- **Files modified:** `astridr-repo:astridr/engine/control_verbs/swap_voice.py`
- **Verification:** `grep -c '"scope"' astridr/engine/control_verbs/swap_voice.py` returns `0`
- **Committed in:** `281b65a9`

---

**Total deviations:** 2 (1 planning-doc consistency fix, 1 test-mechanics wording fix to satisfy the
plan's own acceptance-criteria grep). No scope creep — no functionality beyond the plan's stated task
boundaries was added or removed.
**Impact on plan:** None on delivered behavior.

## Mutation-Check Results (verification_discipline requirement)

**Task 1 — scoped-success-writes-only-profile-override guard**
(`astridr/engine/control_verbs/swap_model.py`): temporarily made the scoped success branch ALSO call
`_router.set_global_override(...)` (backup-copy, not `git checkout`). Re-ran
`test_scoped_success_writes_only_profile_override`: went RED
(`AssertionError: assert 'grok-4.5' is None` — the negative-half assertion that `fake_router.override`
stays `None` for a scoped swap). Restored from backup-copy; `git diff --stat` returned empty before
staging; full `test_swap_model.py`+`test_swap_voice.py` re-run — 74 passed.

**Additional small fix — voice+profile_id rejection, state assertion isolated from the call-log
assertion** (`astridr/api/ws_commands.py`): neutralized the guard
(`if cmd.target == "voice" and False:`) AND temporarily commented out the pre-existing
`assert calls == []`/ack-status lines in the test (both changes via backup-copy) to isolate the STATE
assertion specifically. Re-ran the single test: went RED specifically on
`assert get_active_voice_override(ASTRIDR_PERSONA_ID) == before_override`
(`AssertionError: assert 'v-rachel' == None`) — proving the state assertion independently detects the
guard's removal, not merely riding on the call-log assertion. Restored both files from backup-copy;
`grep -n "MUTATION"` returned nothing in either restored file; full `test_ws_commands.py` re-run —
95 passed.

## Defect-Class Sweep (verification_discipline requirement)

**Class 1 — a rejection guard whose ONLY assertion is a proxy (a throwaway fake verb's call log)
where real, checkable state exists.** Swept `test_ws_commands.py` for `assert calls == \[\]` (6 hits
total). Two are chat.send non-match tests where the real assertion of interest is the POSITIVE path
(agent_launcher was called) — not this defect class. Two are the strengthened test itself and
`test_swap_set_missing_value_without_restore_errors` (no real mutable state exists there — nothing
would be set even with the guard removed, since `value` itself is what's missing). **Two same-class
instances found and NOT fixed:** `test_swap_set_scoped_unknown_profile_rejected_zero_verb_calls` and
`test_swap_set_scoped_no_message_router_rejected_zero_verb_calls` (both from 108-04) use the same
throwaway-fake-verb pattern for a scoped `target="brain"` rejection, where a real `ModelRouter`'s
profile-override state would be an equally valid additional assertion. **Not fixed** — the plan's
`<additional_small_fix>` explicitly caps scope to the one named test ("Do not expand beyond this one
test"). Reported here per the sweep requirement.

**Class 2 — the restore-scope inversion defect itself (scoped restore clearing the wrong slot).**
Swept `astridr/engine/control_verbs/*.py` for `clear_global_override|clear_profile_override|restore`.
Three files matched: `swap_model.py` (fixed, this plan), `swap_voice.py` (no per-profile concept,
unaffected — confirmed by reading it), `dispatch.py` (only maps LLM `[CTRL:...]` tags to `args` dicts
like `{"restore": "true"}`; contains no override-clearing calls itself, purely upstream of the fixed
code). No other instance of this defect class exists.

## Issues Encountered

- Full-suite regression run (`pytest tests/ -q`, wave-merge gate, run after all three astridr-repo
  commits) reported **9862 passed, 112 skipped, 1 xpassed, 0 failed** in 348.19s (5m48s). The two
  documented pre-existing flakes (`test_pipes.py::TestPipeManagerScan::
  test_scan_updates_changed_pipes`, `test_imagegen.py::TestLiveGeneration::test_gemini_live`) were not
  chased and did not appear as failures this run.
- Per plan instructions, no Docker rebuild, `docker compose up`, or Convex deploy was performed — that
  remains 108-07's job.

## User Setup Required

None — no external service configuration required. No deploy step in this plan.

## Next Phase Readiness

- Plan 108-06 (codepulse: `useControlVerbSwaps` hook + swap-history section in `GlobalSwapModal`) can
  now render real `scope` values on every swap-history row — the field is live and tested.
- 108-07 (deferred this session, `autonomous: false`) is the only remaining gate before ENGINE-02/
  TELE-02/ENGINE-05 can be marked complete: self-hosted Convex deploy → astridr rebuild → live scoped
  swap + profiled turn + unscoped control + fail-closed negative control, evidence pasted as rows.
- No blockers for 108-06.

## Self-Check: PASSED

Files (astridr-repo):
- FOUND: astridr/engine/control_verbs/swap_model.py
- FOUND: astridr/engine/control_verbs/swap_voice.py
- FOUND: astridr/engine/bootstrap/core.py
- FOUND: docs/astridr-contract.md
- FOUND: tests/unit/engine/test_swap_model.py
- FOUND: tests/unit/engine/test_swap_voice.py
- FOUND: tests/unit/engine/bootstrap/test_boot_model_routing_seed.py
- FOUND: tests/unit/engine/test_ws_commands.py

Commits (astridr-repo, `git log --oneline --all | grep <hash>`):
- FOUND: 281b65a9 (Task 1+2 combined)
- FOUND: 98eab76c (Task 3)
- FOUND: f644b845 (additional small fix)

Files/commits (codepulse repo):
- FOUND: .planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md
- FOUND commit: 783f8407 (contract verification note)

## Known Stubs

None — this plan modifies backend command/routing/bootstrap code, its tests, and an archived contract
document; no UI/data-rendering surface is touched.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-108-02, T-108-20, T-108-21,
T-108-22, T-108-SC). The scope-branching and scope-telemetry changes are exactly the mitigations the
threat model specified — no new network endpoints, auth paths, file access patterns, or schema changes
were introduced.

---
*Phase: 108-per-profile-engine-telemetry-astridr-backend*
*Plan: 05*
*Completed: 2026-08-07*
