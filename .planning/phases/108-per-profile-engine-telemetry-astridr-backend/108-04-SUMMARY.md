---
phase: 108-per-profile-engine-telemetry-astridr-backend
plan: 04
subsystem: api
tags: [contextvars, python, astridr, model-routing, ws-commands, control-verbs, convex-consumer-contract]

# Dependency graph
requires:
  - phase: 108-01
    provides: model_routing events carry profileId/model/mode, refuse-to-emit, emit-on-change memo, and _MODE_BY_SELECTION_PATH pre-registered "profile-swap-override" -> "pinned"
provides:
  - "ModelRouter per-profile override store + accessor trio (set/clear/get/get_source), keyed by profile id, mirroring the global override slot"
  - "_resolve_model's D-04 precedence rung: per-profile override outranks the global one, byte-identical unscoped"
  - "SwapSetCommand.profile_id (optional) + fail-closed validation in _handle_swap_set (voice+scope rejected, unresolvable validation source rejected, unknown id rejected) before VERB_REGISTRY dispatch"
  - "MessageRouter.known_profile_ids() public accessor, the validation seam"
  - "103-CONTRACT.md corrected in place: no Ástríðr Phase 184.1, scoped swap.set replaces gateway.model.set, 8-value selection_path vocabulary, updated auth-tier/validation sections"
affects: [108-05, 108-06, 109]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-profile override store keyed dict mirrors the existing global-override scalar slot shape (set/clear/get/get_source accessor trio) rather than inventing a new bookkeeping scheme"
    - "Precedence rung reads the same get_profile_context() ContextVar the emitter reads -- no second, parallel identity source for D-04"
    - "Fail-closed validation happens in the WS command handler, before VERB_REGISTRY dispatch, so a rejection is asserted by zero verb-execute calls, not merely a raised exception"
    - "A public accessor (known_profile_ids()) is added to the router class rather than reaching into a private dict from the command layer, so validation has one testable seam"
    - "Superseded contract text is kept, explicitly labelled as considered-and-rejected, rather than deleted, per D-08's deferred-ideas-record convention"

key-files:
  created: []
  modified:
    - "astridr-repo:astridr/providers/router.py"
    - "astridr-repo:tests/unit/providers/test_router.py"
    - "astridr-repo:astridr/api/ws_commands.py"
    - "astridr-repo:astridr/channels/router.py"
    - "astridr-repo:tests/unit/engine/test_ws_commands.py"
    - "astridr-repo:tests/unit/channels/test_router.py"
    - "codepulse:.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md"

key-decisions:
  - "Did not touch astridr-repo:astridr/engine/control_verbs/swap_model.py in this plan. Its _execute unconditionally calls set_global_override/clear_global_override regardless of args['profile_id'] -- wiring it to actually apply the per-profile store is explicitly plan 108-05's job (confirmed by reading 108-05-PLAN.md before editing: 'plan 108-04 delivered the command and the store; this is the verb that connects them', D-07). This plan delivers the command shape, the validation, and the store; it does not make the scope take effect yet."
  - "The plan's own automated <verify> grep for Task 3 (every '184.1' line must carry rejected/superseded/corrected/no-such-phase) is in unavoidable tension with its own acceptance criterion 'Sections 3, 5, 8, 9 are unmodified' -- both sections legitimately reference Phase 184.1 in hypothetical future-implementer language. Resolved in favor of the explicit, twice-stated 'leave §8/§9 alone' instruction over the mechanical grep; documented below."

patterns-established: []

requirements-completed: []
# ENGINE-02 remains Pending despite this plan's frontmatter listing it. ENGINE-02's actual text
# ("swap.set accepts a profile scope, so an operator CAN swap one agent's engine without affecting
# the others") describes the end-to-end functional outcome. swap_model.py's _execute still
# unconditionally calls set_global_override/clear_global_override regardless of args["profile_id"]
# (confirmed by reading it before editing) -- a scoped swap.set today validates and threads the
# scope but does not yet change which override actually takes effect. That wiring is plan 108-05's
# job (D-07). Marking ENGINE-02 Complete now would repeat exactly the pattern 108-02-SUMMARY.md's
# own "Gap 1" post-execution correction already flagged in this phase (a frontmatter claim
# contradicting the plan's own prose) -- so REQUIREMENTS.md's ENGINE-02 checkbox/traceability row
# were left Pending in this plan, not checked off.

# Metrics
duration: ~24min (commit-to-commit; includes a ~6.5min full astridr-repo suite run as the wave-merge gate)
completed: 2026-08-07
---

# Phase 108 Plan 4: Per-Profile Model Override + Scoped swap.set + Contract Correction Summary

**ModelRouter gains a per-profile override store outranking the global one (D-04), `swap.set` gains an optional fail-closed `profile_id` scope threaded through the existing dispatch path (D-05), and 103-CONTRACT.md is corrected in place to describe the axis CodePulse Phase 108 actually delivers.**

## Performance

- **Duration:** ~24 min (commit timestamps 07:22:57 → 07:41:53); includes a ~6m14s full astridr-repo suite run as the wave-merge gate between Task 2 and Task 3
- **Completed:** 2026-08-07
- **Tasks:** 3/3
- **Files modified:** 7 (6 astridr-repo, 1 codepulse)

## Line-Anchor Drift Check (required by plan's execution_constraints)

Re-verified live before any edit, per the plan's "concurrent session on `feature/brain-swap`" warning. Drift **was** found — the plan's `<interfaces>` block was authored against astridr-repo @ `5b8bbde1`; this plan's dependency (108-01, commits `84f91104`/`948d5d5e`/`96a30539`/`d8a8e1d5`) had already landed and shifted line numbers:

```
grep -n "_global_model_override\|def _resolve_model\|def set_global_override" astridr/providers/router.py
  132  self._global_model_override: str | None = None      (plan cited :118)
  519  def _resolve_model(                                 (plan cited chain at :429-472)
  692  def set_global_override(...)                        (plan cited :602-625 for the trio)
```

`_resolve_model`'s live body: rung 1 (`explicit_model` → `"override"`) at line ~528, global override
check at line ~536-537 (`"global-swap-override"`) — the plan's cited `:438`/`:446` anchors were both
stale by ~90 lines. Adjusted the insertion point accordingly: the new per-profile rung was inserted
between `explicit_model` and `self._global_model_override`, matching the plan's semantic intent
("between rung 1 and rung 2") rather than its literal line numbers.

## Accomplishments

- `ModelRouter` gains `_profile_model_overrides`/`_profile_override_sources` (dicts keyed by profile
  id) and a `set_profile_override`/`clear_profile_override`/`get_profile_override`/
  `get_profile_override_source` accessor trio, docstring-mirroring the existing global-override trio
  exactly, including the "no TTL, no eviction bookkeeping" framing.
- `_resolve_model` gains the D-04 precedence rung: reads `get_profile_context()` (the same ContextVar
  the emitter reads — no second identity source), returns `"profile-swap-override"` when a profile is
  in context and has an override set, sitting above the global rung. `_MODE_BY_SELECTION_PATH` already
  had `"profile-swap-override": "pinned"` pre-registered by plan 108-01, so no mapping code was added.
- `SwapSetCommand` gains `profile_id: str | None = None`, named to match `103-CONTRACT.md` §2/§7 (not
  the sibling `AgentSendTaskCommand`/`ChatSendCommand` `profile` alias) since the CodePulse Phase 109
  client binds to the contract's field name.
- `_handle_swap_set` validates fail-closed **before** `VERB_REGISTRY` dispatch: `target="voice"` +
  `profile_id` rejected, no `message_router`/no `known_profile_ids` accessor rejected, unknown
  `profile_id` rejected — each path proven by asserting the verb-execute mock recorded **zero calls**,
  per T-108-02.
- `MessageRouter.known_profile_ids()` — new public accessor (`frozenset(self._profiles)`), the one
  testable validation seam, with its own dedicated unit tests.
- `103-CONTRACT.md` corrected in place: §1's status table no longer says "Not built"/"Ástríðr Phase
  184.1"; §2 retitled to the scoped `swap.set`'s real shape with the rejected `GatewayModelSetCommand`
  kept as an explicitly-labelled considered-and-rejected alternative, plus D-06's deferred session-TTL
  note and the scoped-vs-unscoped `restore=true` semantics; §4's `selection_path` vocabulary corrected
  to all 8 live values (added `"advisor"` and `"profile-swap-override"`) and the `model` field-name
  rename noted; §6/§7 updated to reference `swap.set` instead of `gateway.model.set`/`models.catalog`,
  and §7 now records the validation is implemented, not merely specified.

## Task Commits

1. **Task 1: per-profile override store and its precedence rung** (astridr-repo) - `9ad3cea6` (feat)
2. **Task 2: scoped swap.set — command field, fail-closed validation, args threading** (astridr-repo) - `06b6f4f7` (feat)
3. **Task 3: correct 103-CONTRACT.md in place (D-08)** (codepulse) - `3421c816` (docs)

**Plan metadata:** (this commit, see below)

## `git show --stat HEAD` for every commit (per plan's `<output>` requirement)

```
commit 9ad3cea66a713f8f63e566cf4006846c063732db (astridr-repo, feature/brain-swap)
feat(108-04): per-profile model override store and precedence rung (D-04)
 astridr/providers/router.py         |  54 +++++++++++++++++++
 tests/unit/providers/test_router.py | 104 ++++++++++++++++++++++++++++++++++++
 2 files changed, 158 insertions(+)

commit 06b6f4f726dd8175f83009808894a49f6383ad86 (astridr-repo, feature/brain-swap)
feat(108-04): scoped swap.set — profile_id field, fail-closed validation, args threading (D-05)
 astridr/api/ws_commands.py            |  44 +++++++-
 astridr/channels/router.py            |   9 ++
 tests/unit/channels/test_router.py    |  17 +++
 tests/unit/engine/test_ws_commands.py | 207 ++++++++++++++++++++++++++++++++++
 4 files changed, 276 insertions(+), 1 deletion(-)

commit 3421c8162d7f31f81fd2d7913c0c72e41b73d5c1 (codepulse, master)
docs(108-04): correct 103-CONTRACT.md in place — per-profile axis is delivered (D-08)
 .../103-brain-swap-control-surface/103-CONTRACT.md | 143 +++++++++++++++------
 1 file changed, 107 insertions(+), 36 deletions(-)
```

**Disclosure check:** after every commit I ran `git show --stat HEAD` and confirmed the file list
contained ONLY my own intended paths in all three commits. `git status --short` before each staging
step showed pre-existing untouched changes this plan was told not to touch: astridr-repo's
`.claude/settings.json` (modified, not from this session) and codepulse's `src/pages/__tests__/
Chat.test.tsx` (modified, the concurrent plan 188.3-06 TDD session's uncommitted work) — neither was
staged, read for editing, or reverted. No `git stash`, `git checkout -- <file>`, `git clean`, or
branch switch was used anywhere in this plan.

## Files Created/Modified

- `astridr-repo:astridr/providers/router.py` — `_profile_model_overrides`/`_profile_override_sources`
  state slots, accessor trio, and the `_resolve_model` precedence rung (D-04)
- `astridr-repo:tests/unit/providers/test_router.py` — 9 new tests: explicit-wins-over-profile,
  precedence with BOTH overrides set (the real D-04 assertion), keyed-by-profile isolation, unscoped
  byte-identical control (tuple-equality), clear-unknown-id no-raise, source round-trip, clear-restores-default
- `astridr-repo:astridr/api/ws_commands.py` — `SwapSetCommand.profile_id`, docstring update, and
  `_handle_swap_set`'s three-stage fail-closed validation + args threading
- `astridr-repo:astridr/channels/router.py` — `MessageRouter.known_profile_ids()` public accessor
- `astridr-repo:tests/unit/engine/test_ws_commands.py` — 6 new tests: field default, scoped-known-reaches-verb,
  scoped-unknown-zero-calls, voice+scope-zero-calls, unscoped-exact-dict-equality, no-message-router-zero-calls
- `astridr-repo:tests/unit/channels/test_router.py` — 2 new tests for `known_profile_ids()`
  (configured ids returned; empty when no profiles)
- `codepulse:.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md` —
  §1/§2/§4/§6/§7/§10 corrected in place; §3/§5/§8/§9 left untouched

## Decisions Made

- **swap_model.py left untouched (scope boundary, not a gap).** Before editing, I read `astridr/
  engine/control_verbs/swap_model.py`'s `_execute` and found it unconditionally calls
  `_router.set_global_override(...)`/`clear_global_override()` regardless of `args.get("profile_id")`
  — meaning a validated, threaded `profile_id` would currently have no effect on which override
  actually applies. I then read `108-05-PLAN.md` before assuming this was a plan defect requiring a
  Rule-2 auto-fix: it explicitly states "plan 108-04 delivered the command and the store; this is the
  verb that connects them" (D-07) and lists `swap_model.py` in its own `files_modified`. This confirms
  the two-plan split is intentional sequencing, not an omission — Task 2's own `<done>` criterion
  ("reaches the verb through the existing dispatch path") and the plan's top-level success criteria
  both stop at "reaches `swap_model` with `args["profile_id"]` set," not "the override applies." Wiring
  `_execute` to branch on `args["profile_id"]` and call `set_profile_override`/`clear_profile_override`
  instead of the global pair remains 108-05's job, unmodified by this plan.
- **Field-name decision (per plan's explicit instruction):** `SwapSetCommand.profile_id`, not the
  sibling commands' shorter `profile` alias — documented inline per the plan's stated reasoning
  (103-CONTRACT.md and the args key both already say `profile_id`; the Phase 109 client binds to the
  contract name).
- **Task 3 verify/acceptance-criteria conflict, resolved explicitly (see below).**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's Task 1 acceptance criterion literal count was stale against 108-01's own pre-registration**
- **Found during:** Task 1, verifying acceptance criteria
- **Issue:** The plan's acceptance criteria state `grep -c '"profile-swap-override"' astridr/providers/router.py` returns `1`. Plan 108-01 already pre-registered `"profile-swap-override": "pinned"` in `_MODE_BY_SELECTION_PATH` (with an explanatory comment citing plan 108-04), so the live count after my change is `3` (the pre-existing comment, the pre-existing dict entry, and my new `_resolve_model` return line) — not `1`.
- **Fix:** Verified the true intent instead of the literal count: exactly one `return ... "profile-swap-override"` statement exists inside `_resolve_model` (confirmed by `grep -n`), and it has a lower line number than the `"global-swap-override"` return, satisfying the criterion the count was a proxy for.
- **Files modified:** None (verification-only finding, no code change needed)
- **Verification:** `grep -n '"profile-swap-override"' astridr/providers/router.py` — exactly one hit inside `_resolve_model`'s body; the others are 108-01's pre-existing comment and dict entry.
- **Committed in:** N/A — no fix required, documented as a stale-criterion clarification

**2. [Doc consistency, D-08-style] Plan's Task 3 `<verify>` grep command conflicts with its own acceptance criteria for §8/§9**
- **Found during:** Task 3, running the plan's exact `<verify>` command
- **Issue:** The plan's automated verify (`! grep -n "184\.1" ... | grep -v "rejected\|superseded\|corrected\|no such phase"`) requires every `184.1` occurrence in the file to carry one of those four labels on the same line. But the plan's own acceptance criteria separately require "Sections 3, 5, 8, 9 are unmodified (`git diff` shows no hunks in them)" — and §8 ("No server-side batch command") and §9 ("Known interaction: the global override shadows the per-profile default") both contain pre-existing, hypothetical "Phase 184.1" references (e.g., "Phase 184.1 must NOT design...", "Recorded here so Phase 184.1 does not have to rediscover it"). These are not false operational claims the way §1/§2 were — they're forward-looking "whoever eventually builds this" language — but touching them to satisfy the mechanical grep would violate the explicit, twice-stated "leave §8/§9 alone" instruction.
- **Fix:** Corrected every `184.1` occurrence in §1, §2, §4, §6, §7, and §10 (all sections not on the protect-list), each carrying a same-line label (`corrected`/`superseded`/`rejected`/`no such phase`, verified case-sensitively since the plan's grep has no `-i` flag). Left §8's and §9's two remaining unlabeled occurrences untouched. Confirmed via `git diff` that the only hunks touching the file are within §1/§2/§4/§6/§7/§10 — §3, §5, §8, §9 show zero diff hunks.
- **Files modified:** `codepulse:.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md`
- **Verification:** `git diff .planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md | grep -n "^@@"` — all 6 hunks fall within §1/§2/§4/§6/§7/§10 line ranges, none within §3/§5/§8/§9. The plan's own `<verify>` command still exits non-zero (fails) on the two intentionally-preserved §8/§9 lines — this is the resolved conflict, not an oversight.
- **Committed in:** `3421c816` (Task 3 commit)

**3. [Rule 1 - Bug] The plan's verify grep is case-sensitive; my first-pass "Corrected"/capitalized labels didn't match**
- **Found during:** Task 3, first run of the plan's `<verify>` command
- **Issue:** My initial corrections used sentence-capitalized `**Corrected 2026-08-07:**` at paragraph starts. The plan's verify grep pattern (`rejected\|superseded\|corrected\|no such phase`) has no `-i` flag, so capitalized "Corrected" did not match lowercase "corrected", and two of my correction paragraphs also had "no such phase" split across a markdown line-wrap (the literal file has hard line breaks at ~86 chars), so the contiguous substring "no such phase" didn't appear on a single line either.
- **Fix:** Reworded the two affected paragraphs (in §4 and §10) to use lowercase `corrected 2026-08-07:` and removed the internal line-wrap so `no such phase` reads as one contiguous line.
- **Files modified:** `codepulse:.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md`
- **Verification:** Re-ran the plan's exact `<verify>` command; the only remaining failures are the two intentionally-preserved §8/§9 lines described in deviation 2 above.
- **Committed in:** `3421c816` (Task 3 commit)

---

**Total deviations:** 3 (1 stale-acceptance-criterion clarification requiring no code change, 2 mechanics-level fixes to make the doc-correction task's own automated verify script match its own more specific acceptance criteria). No scope creep — no functionality beyond the plan's stated task boundaries was added or removed.
**Impact on plan:** None on the delivered behavior. All three are documentation/verification-mechanics corrections within Task 3's own file.

## Mutation-Check Results (verification_discipline requirement)

**Task 1 — D-04 precedence rung** (`astridr/providers/router.py`): mutated the new rung's condition
to `if False and profile_id and self._profile_model_overrides.get(profile_id):` (backup-copy, not
`git checkout`). Re-ran `pytest tests/unit/providers/test_router.py -k profile_override -q`:
`test_profile_override_wins_over_global_override` went RED
(`AssertionError: assert 'global-model' == 'profile-model'`), 6 others still passed. Restored from
backup-copy; `git diff --stat` returned empty before commit; full file re-run — 91 passed.

**Task 2 — fail-closed unknown-`profile_id` rejection** (`astridr/api/ws_commands.py`): mutated
`if cmd.profile_id not in known_ids:` to `if False and cmd.profile_id not in known_ids:` (backup-copy).
Re-ran the targeted test: `test_swap_set_scoped_unknown_profile_rejected_zero_verb_calls` went RED
(`AssertionError: assert [{'args': {...'profile_id': 'does-not-exist'...}}] == []`) — proving the test
genuinely detects an unvalidated apply, not merely an exception. Restored from backup-copy; `git diff
--stat` returned empty before commit; full `test_ws_commands.py` re-run — 95 passed.

## Defect-Class Sweep (verification_discipline requirement)

After Task 2's fix, swept the repo for the abstract pattern "a WS command handler dispatches to
`VERB_REGISTRY`/a control verb without validating a caller-supplied scope field against a known-id
set before dispatch." `grep -rn "VERB_REGISTRY.get\|VERB_REGISTRY\[" astridr/api/ws_commands.py`
shows exactly one other dispatch site (`_handle_swap_catalogue`, read-only, no scope field, no
mutation) — no other instance of the class found. `grep -n "profile_id\|profile:" astridr/api/
ws_commands.py` confirms the only other WS commands carrying a profile-shaped field
(`AgentSendTaskCommand.profile`, `ChatSendCommand.profile`) are pre-existing and out of this plan's
scope (they route through `ProfileManager.resolve_profile`, a different validation path, not
`VERB_REGISTRY` dispatch) — not touched.

## Issues Encountered

- Full-suite regression run (`pytest tests/ -q`, wave-merge gate, run after Task 2's commit) reported
  **9820 passed, 112 skipped, 1 xpassed, 0 failed** in 374.74s. The known pre-existing flake documented
  in 108-01's SUMMARY (`tests/unit/automation/test_pipes.py::TestPipeManagerScan::
  test_scan_updates_changed_pipes`) did not fail this run — consistent with its documented
  filesystem-mtime-granularity race (confirmed flaky, not deterministic). No file this plan touches has
  any relationship to that module.
- Per the plan's `<ordering_constraint>`, no `npm test`/`npx tsc` was run in codepulse at any point in
  this session — Task 3's only automated check was its own `<verify>` grep and manual reads.

## User Setup Required

None — no external service configuration required. No deploy step in this plan (astridr rebuild and
Convex deploy remain later plans' jobs per the phase's D-16 integration gate).

## Next Phase Readiness

- Plan 108-05 can now wire `swap_model.py`'s `_execute` to branch on `args.get("profile_id")` and call
  `set_profile_override`/`clear_profile_override` instead of the global pair — the store, accessors,
  and precedence rung (Task 1) plus the validated `args["profile_id"]` threading (Task 2) are both
  live and tested.
- `103-CONTRACT.md` now accurately describes the axis Phase 109's UI will bind to — no more drift
  between the archived contract and the real implementation for the sections that matter to a future
  client (§1/§2/§4/§6/§7).
- No blockers for 108-05/108-06/108-07.

## Self-Check: PASSED

Files (astridr-repo):
- FOUND: astridr/providers/router.py
- FOUND: tests/unit/providers/test_router.py
- FOUND: astridr/api/ws_commands.py
- FOUND: astridr/channels/router.py
- FOUND: tests/unit/engine/test_ws_commands.py
- FOUND: tests/unit/channels/test_router.py

Commits (astridr-repo, `git log --oneline --all | grep <hash>`):
- FOUND: 9ad3cea6 (Task 1)
- FOUND: 06b6f4f7 (Task 2)

Files/commits (codepulse repo):
- FOUND: .planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md
- FOUND commit: 3421c816 (Task 3)

## Known Stubs

None — this plan modifies backend command/routing code, its tests, and an archived contract
document; no UI/data-rendering surface is touched.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-108-01, T-108-02, T-108-17,
T-108-18, T-108-19, T-108-SC). `_handle_swap_set`'s new validation branch and `known_profile_ids()`
are both exactly the mitigations the threat model specified — no new network endpoints, auth paths,
file access patterns, or schema changes were introduced.

## Self-Check: PASSED (re-verified after write)

All 4 files and 3 commits re-confirmed present via direct filesystem/`git log` checks, matching the
Self-Check section above.

---
*Phase: 108-per-profile-engine-telemetry-astridr-backend*
*Plan: 04*
*Completed: 2026-08-07*
