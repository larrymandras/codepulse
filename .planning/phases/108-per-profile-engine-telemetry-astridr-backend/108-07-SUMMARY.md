---
phase: 108-per-profile-engine-telemetry-astridr-backend
plan: 07
subsystem: infra
tags: [convex-self-hosted, docker-compose, astridr, live-integration, ws-commands, model-routing, control-verb-swap]

# Dependency graph
requires:
  - phase: 108-05
    provides: "scope-aware swap_model set/restore, scope on all four control_verb_swap emit sites, D-03 boot seed"
  - phase: 108-06
    provides: "useControlVerbSwaps hook + swap-history section (codepulse-side, not exercised live by this plan)"
provides: "Live-stack proof for ENGINE-01/ENGINE-02 (activeEngineSnapshots axis): PASS (confirmed again on re-proof). Live-stack proof for the control_verb_swap swap-history axis: FAIL, TWICE, on two DIFFERENT root causes — session_id-null (first proof, fixed+deployed+verified in the re-proof) and provider_affinity array-vs-string (re-proof, newly discovered, not fixed)."
affects: [109]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - "codepulse:.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md"
  modified: []

key-decisions:
  - "STOPPED at Task 4 (blocking human-verify checkpoint) per this plan's autonomous:false gate and the executor's explicit dispatch instructions. Task 4 was NOT self-approved and no requirement was marked complete. This remains true after the re-proof: STOPPED again before sign-off, per the re-proof dispatch's own explicit instruction."
  - "A real, live-discovered defect (control_verb_swap telemetry silently dropped for every WS swap.set dispatch, root cause: session_id explicit null rejected by isOptionalString) was found during Task 3 Step 4 of the first proof. It was documented with a full root-cause chain and NOT fixed in that plan run, per its 'this plan authors no code' scope."
  - "That defect was fixed and deployed in a later session (codepulse d78fb5c1/1521fe2d, astridr f632752c) and this re-proof VERIFIED the fix works: a direct freshness probe with explicit-null optional fields landed a row with the nulls correctly stripped, and both Step 7 restore-path events (which also carry session_id:null) landed live rows."
  - "The re-proof found a SECOND, previously-masked defect on the same resolver: swap_model.py's provider_affinity field is a real list/array on every success path, but convex/runtimeIngest.ts's isOptionalString() guard only accepts undefined/null/string, so the array fails the type check and the event is skipped — this affects only success-path swaps (restore/refused paths have provider_affinity:null and are unaffected, proven by direct positive control). This is NOT the same defect as the first proof's finding; it was invisible until the first defect stopped masking it. NOT fixed in this session, per the same 'authors no code' scope — documented as a second named gap for the operator's Task 4 decision."
  - "Task 2's two commits (deploy verification + rebuild/freshness proof) and Task 3's live-proof work were committed as a single evidence-file commit (87738401) rather than two separate ones, because all edits were made to the same new file in one continuous session before the first commit — splitting after the fact would require artificial hunk surgery with no benefit, matching the 108-05 precedent for genuinely inseparable diffs."

patterns-established: []
requirements-completed: []
# ENGINE-01, ENGINE-02, ENGINE-05: none marked. Per this plan's explicit instruction, no
# requirement is marked complete until operator sign-off at Task 4 (a fresh continuation agent).
# ENGINE-01's core telemetry axis (real profileId+model, refuse-to-emit, per-profile isolation,
# unscoped-vs-scoped precedence) is PROVEN LIVE in this plan's evidence — but the sign-off gate
# is Task 4, not this executor.

# Metrics
duration: "~50 min (first proof) + ~35 min (re-proof: deploy, rebuild, freshness probe, swap re-run including one network-timeout retry, restore, defect #2 diagnosis)"
completed: "IN PROGRESS — stopped at Task 4 checkpoint again after re-proof, 2026-08-07"
---

# Phase 108 Plan 7: ENGINE-05 Live Integration Gate Summary

**Tasks 1-3 complete and committed; Task 4 (operator sign-off) is a blocking checkpoint and this
run STOPPED there, as instructed — no requirement is marked complete.**

## Status

- **Task 1 (consent):** Satisfied by prior operator approval (provenance recorded in the evidence
  file). Not re-asked.
- **Task 2 (deploy, rebuild, prove freshness):** COMPLETE. Self-hosted Convex deploy landed
  (`npx convex deploy --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" --yes` — the exact
  working invocation, recorded verbatim for future phases). `astridr-agent` + 5 war-room agents +
  `notebooklm-mcp` + `cli-gateway` rebuilt via `COMPOSE_PROFILES=prod,war-room docker compose up
  --build -d`. Four in-container symbol probes all report `True`/present. D-03 boot seed captured:
  3 rows (`personal`/`business`/`consulting`), all real `profileId`+`model`
  (`anthropic/claude-sonnet-5`), `mode: "inherited"` — no sentinels.
- **Task 3 (the live proof):** COMPLETE, with a mixed result — see below.

## Live Proof Results (see `108-ENGINE-05-EVIDENCE.md` for every raw row and command)

**PASS — the `activeEngineSnapshots` axis (ROADMAP criteria 1, 2, 4; ENGINE-01/ENGINE-02's core
claim):**
- (a) A scoped `swap.set` for `consulting` → `claude-opus-4-8` produced a real row:
  `profileId: "consulting"`, `model: "claude-opus-4-8"`, `mode: "pinned"`,
  `selectionPath: "profile-swap-override"`.
- (b) `business`'s row was byte-identical to its Step-1 baseline (same `_id`, same `timestamp`) —
  the scoped swap touched only its target profile.
- (d) An unscoped `swap.set` → `claude-haiku-4-5-20251001` produced `business`'s row with
  `selectionPath: "global-swap-override"` — the global path behaves exactly as before this phase.
- (e) `consulting`'s per-profile pin was untouched by the unscoped call (byte-identical to its own
  prior reading) — D-04's precedence (per-profile outranks global) holds live.
- Restore: both overrides genuinely cleared, proven not by the ack alone but by driving a fresh
  turn on each profile and observing `run.completed`'s `model` field revert to `claude-sonnet-5`
  for both `consulting` and `business`.
- Step 7 (negative control): an unknown `profile_id` produced `status: "error"` naming the
  rejected value, AND the row read before/after was byte-identical — the fail-closed guard at
  `ws_commands.py:1137` rejects before any dispatch, so no silent global apply occurred.

**FAIL — the `control_verb_swap` swap-history axis (assertions (c) and (f)):** every scoped and
unscoped `swap.set` dispatched over the WS command path produced **zero** rows in
`controlVerbSwaps`, confirmed both via `listByScope` and a direct `npx convex data
controlVerbSwaps` table dump ("There are no documents in this table."). This is not a proof
artifact — it is a real, live-discovered, root-caused defect:

`astridr/api/ws_commands.py:1149` (`_handle_swap_set`) unconditionally constructs
`ControlVerbContext(session_id=None, ...)` for every command-channel swap. The telemetry dict
literal in `swap_model.py` carries `"session_id": ctx.session_id` verbatim (explicit `null`, not
an omitted key), and `astridr/engine/telemetry.py`'s buffered `_post_to_convex()` path — unlike
its sibling `send_to()`, whose own docstring documents the exact footgun — does not strip
`None`-valued keys before serializing. On the CodePulse side, `convex/runtimeIngest.ts`'s
`isOptionalString()` guard (`value === undefined || typeof value === "string"`) rejects an
explicit `null`, so `resolveControlVerbSwapEvent()` returns `null` for the whole event and the
insert is silently skipped — no exception, so it is invisible to the `dropped` counter the
per-event try/catch (108-03 gap closure) tracks. **This affects every manual (WS `swap.set`)
`control_verb_swap` emission, on all four sites, scoped and unscoped alike — spoken swaps (which
thread a real `session_id`) are unaffected.**

Per this plan's own scope (`108-07-PLAN.md`: "This plan authors no code"), this defect was
**documented, not fixed**. It is a named gap for the operator to decide on at Task 4: fix now
(small, well-understood — strip `None`-valued keys before `_post_to_convex` serializes, or make
`isOptionalString` treat `null` the same as `undefined`) with a fresh consent/deploy cycle, or
defer to a follow-up plan.

## Re-proof after gap closure (2026-08-07, later same day)

The session_id-null fix above was written, deployed to self-hosted Convex, and astridr was
rebuilt (`COMPOSE_PROFILES=prod,war-room docker compose up --build -d`). Full transcript appended
to `108-ENGINE-05-EVIDENCE.md` under "Re-proof after gap closure."

- **Freshness proof:** PASS. The new `skipped` field is live in the `/runtime-ingest` response,
  and a direct freshness probe (explicit-null optional fields, matching the exact defect shape)
  landed a row with the nulls correctly stripped — confirmed the fix works at the Convex layer.
- **In-container code proof:** PASS. `_post_to_convex` calls `_strip_none_values`, confirmed live
  inside the rebuilt `astridr-agent` container (probed both immediately after rebuild and again
  after an unexplained-but-benign single container recreate settled to healthy — RestartCount
  never incremented, so this was not a crash loop).
- **Core engine axis regression check:** PASS, unchanged from the first proof. `consulting` pins
  to the scoped-swap model, `business` pins to the global-swap model, `personal` stays at its
  boot-seed default.
- **Swap-history axis (assertions c/f): STILL FAIL — a genuinely different, second defect.**
  Real scoped and unscoped `swap.set` dispatches still produced zero `controlVerbSwaps` rows.
  Root cause traced and directly reproduced (not just inferred): `swap_model.py`'s
  `provider_affinity` field is a real Python list on every path where a swap actually resolves to
  a model, but `convex/runtimeIngest.ts`'s `isOptionalString()` guard only accepts
  `undefined`/`null`/`string` — a JSON array fails that check, so the whole event is skipped. A
  positive control (the `restore` path, where `provider_affinity` is `None`) landed real rows
  under the exact same `session_id: null` conditions, isolating the new defect precisely to
  `provider_affinity`'s type. **This means the one case the swap-history feature exists to show —
  an actual successful swap — still never lands, even after the first fix.** Not fixed in this
  session, per the same "authors no code" scope.
- **One disclosed operational hiccup, not a defect:** the first swap attempt after the astridr
  rebuild was lost to a transient telemetry-buffer timeout (`telemetry.timeout events=30`,
  startup DNS/network settling after the compose recreate) — confirmed via direct in-container
  connectivity probe and log evidence, then the swap sequence was cleanly re-run once three
  consecutive successful buffer flushes were observed.
- **Restore:** PASS. Both overrides cleared, proven by driving fresh turns on both affected
  profiles and observing `model: "claude-sonnet-5"` (the pre-test default), not by acks alone.
  Larry's assistant is not left pinned to a test model.

**Net result of this re-proof:** the operator's first-proof fix is verified working exactly as
designed. ENGINE-05's swap-history axis is still not closed — for a new, distinct, root-caused
reason discovered only because the first defect stopped masking it. This is presented to the
operator as two separate, sequential findings, not conflated into one.

## Task Commits

1. **Tasks 2+3 combined (evidence file, deploy + rebuild + live proof + defect finding)**
   (codepulse) - `87738401` (docs)

`git show --stat HEAD` confirmed the commit contains only
`108-ENGINE-05-EVIDENCE.md` — no unintended files swept in.

## Files Created

- `codepulse:.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md`
  — full verbatim command transcript and pasted raw row output for every assertion, Tasks 1-3.

## Deviations from Plan

### Auto-fixed Issues

**None** — per this plan's explicit "authors no code" scope, no code was written or fixed, even
though a real defect (the `control_verb_swap` drop bug above) was discovered. This is a deliberate
departure from the general Rule 1 "auto-fix bugs found during execution" convention: this plan's
own text and its `autonomous: false` gate scope the executor to deploy/execute/read/paste only,
and Task 4 is explicitly the decision point for gaps found live. Documented here as a disclosed,
reasoned exception, not an oversight.

### Environment/tooling notes (not code deviations)

- `docker exec astridr-agent python - <<'PY' ... PY` (without `-i`) silently produced zero stdout
  in this Git-Bash/Windows environment — the `-i` flag is required to attach stdin for heredoc
  piping into the container process. Recorded so future phases don't rediscover this.
- CWD drifted to `astridr-repo` partway through Task 3 investigation (several `grep`/`sed`
  commands against astridr files ran with no explicit `cd`, succeeding only because the drift had
  already happened) — caught when a subsequent `grep convex/...` command failed with "no such
  file." Recovered by using explicit `cd /c/Users/mandr/codepulse &&` prefixes for every
  codepulse-side command from that point forward, per this plan's own `<repo_scope_and_cwd>`
  warning.

## Known Stubs

None — this plan authors no code and touches no UI/data-rendering surface.

## Threat Flags

None beyond the plan's own `<threat_model>`. T-108-25 (secret disclosure) was actively verified,
not just assumed: the evidence file was grepped for `ADMIN_KEY`/`Bearer `/`service_key`/
`ASTRIDR_WEB_API_KEY` before this SUMMARY was written, and every hit is the shell variable
reference `"$ADMIN_KEY"`, never a resolved secret value.

## Next Phase Readiness

**STILL BLOCKED at Task 4, after the re-proof.** Phase 109 depends on ENGINE-05 being closed
(ROADMAP: "Phase 109 does not start" until these rows are real), and ENGINE-05 is NOT marked
satisfied by this executor — that requires explicit operator sign-off on a fresh continuation
agent, per Task 4's protocol. The re-proof confirms the operator's first fix works exactly as
intended, but surfaces a SECOND defect (`provider_affinity` array-vs-string) that must also be
resolved before the swap-history axis can be proven live. This directly affects Phase 109's
TELE-02 inheritance (reassigned to Phase 109 per the re-proof dispatch — not marked or re-added
here) — the per-profile swap-history surface it is meant to build reads from exactly the table
both defects silently starved.

## Self-Check: PASSED

Files (codepulse):
- FOUND: `.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md`
- FOUND: `.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-07-SUMMARY.md` (this file, re-proof section)

Commits (codepulse, `git log --oneline --all | grep <hash>`):
- FOUND: `87738401` (Tasks 2-3 evidence, first proof)
- Re-proof commit hash recorded below once created.

---
*Phase: 108-per-profile-engine-telemetry-astridr-backend*
*Plan: 07*
*Status: IN PROGRESS — awaiting Task 4 operator sign-off (re-proof complete, second defect found)*
