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
provides: "Live-stack proof for ENGINE-01/ENGINE-02 (activeEngineSnapshots axis): PASS. Live-stack proof for the control_verb_swap swap-history axis: FAIL, with a root-caused live defect recorded, not fixed."
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
  - "STOPPED at Task 4 (blocking human-verify checkpoint) per this plan's autonomous:false gate and the executor's explicit dispatch instructions. Task 4 was NOT self-approved and no requirement was marked complete."
  - "A real, live-discovered defect (control_verb_swap telemetry silently dropped for every WS swap.set dispatch) was found during Task 3 Step 4. It was documented with a full root-cause chain and NOT fixed in this plan, because 108-07-PLAN.md's objective states 'this plan authors no code' and Task 1's consent covered only deploying/rebuilding already-written code, not authoring and deploying a new fix. It is surfaced as a named gap for the operator's Task 4 decision."
  - "Task 2's two commits (deploy verification + rebuild/freshness proof) and Task 3's live-proof work were committed as a single evidence-file commit (87738401) rather than two separate ones, because all edits were made to the same new file in one continuous session before the first commit — splitting after the fact would require artificial hunk surgery with no benefit, matching the 108-05 precedent for genuinely inseparable diffs."

patterns-established: []
requirements-completed: []
# ENGINE-01, ENGINE-02, ENGINE-05: none marked. Per this plan's explicit instruction, no
# requirement is marked complete until operator sign-off at Task 4 (a fresh continuation agent).
# ENGINE-01's core telemetry axis (real profileId+model, refuse-to-emit, per-profile isolation,
# unscoped-vs-scoped precedence) is PROVEN LIVE in this plan's evidence — but the sign-off gate
# is Task 4, not this executor.

# Metrics
duration: "~50 min (deploy, rebuild ~3 min, live WS proof + investigation of the control_verb_swap defect)"
completed: "IN PROGRESS — stopped at Task 4 checkpoint, 2026-08-07"
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

**BLOCKED at Task 4.** Phase 109 depends on ENGINE-05 being closed (ROADMAP: "Phase 109 does not
start" until these rows are real), and ENGINE-05 is NOT marked satisfied by this executor —
that requires explicit operator sign-off on a fresh continuation agent, per Task 4's protocol.
The operator's decision also needs to cover the `control_verb_swap` defect found in Task 3: it
directly affects Phase 109's TELE-02 inheritance (the per-profile swap-history surface Phase 109
is meant to build reads from exactly the table this defect silently starves).

## Self-Check: PASSED

Files (codepulse):
- FOUND: `.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md`

Commits (codepulse, `git log --oneline --all | grep <hash>`):
- FOUND: `87738401` (Tasks 2-3 evidence)

---
*Phase: 108-per-profile-engine-telemetry-astridr-backend*
*Plan: 07*
*Status: IN PROGRESS — awaiting Task 4 operator sign-off*
