---
phase: 125-signature-layers
plan: 12
subsystem: ui
tags: [playwright, e2e, websocket, fail-closed, state-machine, docker, cross-repo]

# Dependency graph
requires:
  - phase: 125-signature-layers
    provides: "125-03: astridr-repo estop_state emitter + on-connect snapshot push (cross-repo, feature/brain-swap)"
  - phase: 125-signature-layers
    provides: "125-04: resolveHorizonState() fail-closed state machine, parseEstopPayload() validity gate, window.__signalHorizonStub DEV hook"
  - phase: 125-signature-layers
    provides: "125-08: SignalHorizon mounted on every route via DashboardLayout"
provides:
  - "The rebuild that ships 125-03's estop_state emitter and on-connect push (run by the orchestrator inline, ~19:13Z, ahead of this plan's own execution -- see Rebuild Evidence below)"
  - "e2e/estop-wire.spec.ts: the D-20 malformed-vs-well-formed snapshot control on data-horizon-state, using window.__signalHorizonStub"
affects: [125-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DEV-only window.__signalHorizonStub hook driven directly from a Playwright spec to exercise a fail-closed WS state machine's validation path without a real socket delivery"

key-files:
  created:
    - e2e/estop-wire.spec.ts
  modified: []

key-decisions:
  - "D-20 (already recorded in 125-CONTEXT.md before this plan executed): replaced the plan's original before/after 'no emitter deployed' control with a malformed-vs-well-formed snapshot control on the same data-horizon-state observable, because the emitter was already live in the running container before this plan started, shipped incidentally by a concurrent astridr-repo session's Phase 195 rebuild."
  - "This plan's own execution surfaced a further narrowing D-20 did not anticipate: dev:noauth's WS context connects to the SAME live Ástríðr backend as production (only Clerk is disabled), so even a fresh page mount does not read data-horizon-state=unknown for more than a few hundred ms -- the real on-connect snapshot arrives almost immediately. The spec was written to never depend on mount timing: every state transition it asserts is driven explicitly through the stub from a freshly-established baseline."

patterns-established:
  - "A malformed/well-formed pair driven through a component's own DEV-only simulation hook is a legitimate substitute for a before/after infrastructure control when the infrastructure state cannot be recreated -- it tests the same validation-gate property and remains falsifiable."

requirements-completed: [SIGNAL-01, SIGNAL-02]

# Metrics
duration: ~35min
completed: 2026-08-24
---

# Phase 125 Plan 12: E-Stop Wire Rebuild and D-20 Malformed-Snapshot Control Summary

**Ástríðr rebuilt (by the orchestrator, ahead of this plan) to ship the `estop_state` emitter; this plan wrote and mutation-proved `e2e/estop-wire.spec.ts`, the D-20 replacement control proving the Signal Horizon's fail-closed state machine enters `unknown` on any malformed snapshot and leaves it only on a well-formed one, via `window.__signalHorizonStub`.**

## Performance

- **Duration:** ~35 min (this plan's own execution; excludes the orchestrator's earlier rebuild)
- **Tasks:** Rebuild (Tasks 1-3 of the original plan) run inline by the orchestrator before dispatch; this plan executed the D-20 verification work
- **Files modified:** 1 (created)

## Rebuild Evidence (already established by the orchestrator; recorded here per this plan's must_haves)

**I did not run `docker compose` or any other docker command in this plan's own execution** — per this plan's explicit constraint ("Do NOT run any docker command"). The rebuild below was run inline by the orchestrator, as a production operation Larry authorised directly, before this plan was dispatched. It is recorded here, not independently re-verified, because that is what 125-12's must_haves require on record and because re-running `docker compose up --build` a second time would itself be an unauthorised second production rebuild.

- Command run: `COMPOSE_PROFILES=prod,war-room docker compose up --build -d`, at ~19:13Z. 19/19 services reported healthy.
- Image: new `sha256:e0c731795978` (previous `9114482b45cf`). `astridr-agent` running on the new image, started `2026-08-24T19:14:40Z`.
- In-container code confirmation: `grep -c estop_state /app/astridr/engine/estop.py` = 3, `/app/astridr/engine/ws_telemetry.py` = 6. Control: both counts were 0 at `86b6282b~1` / `eb8f780b~1` (the commits immediately before 125-03 landed the emitter). Container files confirmed byte-identical to `feature/brain-swap`'s tip once CRLF is normalised.
- Pre-rebuild logs captured to `C:/Users/mandr/AppData/Local/Temp/claude/C--Users-mandr-codepulse/d8d8fed7-0deb-4b1c-9a94-ef7c544acc3c/scratchpad/prerebuild-logs/` — confirmed present on disk in this session: `astridr.log`, `cli-gateway.log`, `notebooklm-mcp.log`, `supabase-rest.log`, `war-room-astridr.log`, `war-room-freya.log`, `war-room-gondul.log`, `war-room-hervor.log`, `war-room-ragnhildr.log`, `whatsapp-bridge.log`.
- Cron calendar checked before the rebuild: only `graphify` (`0 0 * * *`, enabled) and `doc_comments` (`0 2 * * *`, disabled) exist. The rebuild ran ~15:13 local, interrupting neither.
- `git -C C:/Users/mandr/astridr-repo status --porcelain` / working-tree state at rebuild time: not independently re-checked by this plan (the rebuild itself is the orchestrator's prior action, not this plan's).

## D-20: What This Plan Actually Built

**Why the plan's original control is not what shipped.** `125-12-PLAN.md`'s Task 1/Task 3 specified a before/after control: run `e2e/estop-wire.spec.ts` with `HORIZON_EXPECT=unknown` *before* any rebuild (no emitter deployed), then with `HORIZON_EXPECT=resting` *after*. By the time this plan executed, the `estop_state` emitter was already live in the running container — shipped incidentally by a concurrent astridr-repo session's Phase 195 rebuild, not by any plan of this phase — so the "before" state (no emitter deployed) could no longer be produced without deliberately rebuilding backwards off a pre-125-03 commit, which Larry considered and rejected as disproportionate and risky (D-20, recorded in `125-CONTEXT.md` on 2026-08-24, **before** this plan's own execution began).

**What D-20 substitutes, and what this plan built to satisfy it:** prove on the same observable (`data-horizon-state`) that the horizon enters `unknown` on a MALFORMED `estop_state` snapshot and leaves `unknown` only on a WELL-FORMED one. This is the same property the original control targeted — only a valid snapshot can clear the fail-closed state — and it remains falsifiable: a component that ignored payload validity would pass the well-formed case and fail the malformed one.

**A further finding, made while writing the spec, that D-20 itself did not anticipate:** `dev:noauth`'s `AstridrWSContext` connects to the SAME live Ástríðr backend as production (only Clerk auth is disabled) — it is not a stubbed or isolated backend. Because the real `estop_state` emitter is now live, a fresh page load's real on-connect snapshot arrives within a few hundred milliseconds, so `data-horizon-state` reads `resting`, not `unknown`, by the time a Playwright locator can observe it. The first version of this spec asserted a `mount is unknown` step and it failed for exactly this reason (observed live, not merely anticipated — see the transcript below). This is itself corroborating evidence for D-20's core finding: even the dev:noauth surface can no longer produce the "no emitter deployed" state. The final spec never depends on mount timing — every transition it asserts is driven explicitly through `window.__signalHorizonStub` from a freshly re-established baseline, so it is immune to real-wire frames arriving concurrently (which currently only ever carry `armed:false`, identical to the disarmed baseline the spec itself establishes).

**Mechanism used:** `window.__signalHorizonStub` (`src/components/SignalHorizon.tsx:383-392`), the DEV-only simulation hook 125-04 built and proved routes through the exact same `handleFrame` → `parseEstopPayload` validation path the real WS `estop_state` subscription drives (T-125-04-05). This was used instead of a real socket delivery because no genuine `estop_state` frame armed/disarmed transition can be produced from a spec without astridr-repo's live emitter and a real E-Stop toggle — which is out of scope here and belongs to 125-13.

## What Was Tested (verbatim results)

`e2e/estop-wire.spec.ts` (193 lines), run against the already-running `dev:noauth` server on port 5181 (no new server started — one was already listening, confirmed via `netstat` before use):

1. **Entry into `unknown`:** from a `resting` baseline, pushing `{}` (missing `data` field) → `data-horizon-state=unknown`. Confirmed as a genuine transition, not an absence-of-resting inference.
2. **Direction 1 — well-formed disarmed leaves unknown:** from `unknown` (re-entered via `{}`), pushing `{ data: { armed: false } }` → `resting`.
3. **Direction 2 — well-formed armed leaves unknown, into `critical`:** from `unknown` (re-entered via `{}`), pushing `{ data: { armed: true } }` → `critical`. Proves the machine reads the payload's actual content on the way out of unknown, not merely its shape.
4. **Direction 3 — four distinct malformed shapes, each individually proven to flip a known `resting` baseline to `unknown`:**
   - `{}` (missing `data` field entirely) → `unknown`
   - `{ data: null }` → `unknown`
   - `{ data: { armed: "true" } }` (string, not boolean) → `unknown`
   - `{ data: {} }` (armed absent) → `unknown`
5. **Recovery check:** a further well-formed disarmed frame after the malformed run still reaches `resting` — the malformed pushes did not latch the machine anywhere unrecoverable.

Final run, green:
```
[estop-wire] malformed shape "missing data field entirely" ({}) -> data-horizon-state=unknown
[estop-wire] malformed shape "data: null" ({"data":null}) -> data-horizon-state=unknown
[estop-wire] malformed shape "armed as the string "true", not boolean" ({"data":{"armed":"true"}}) -> data-horizon-state=unknown
[estop-wire] malformed shape "data: {} (armed absent)" ({"data":{}}) -> data-horizon-state=unknown
  1 passed (4.3s)
```

## Guard-Fires Mutation Proof (T-125-12-04 discipline, adapted to D-20)

`parseEstopPayload` (`src/components/SignalHorizon.tsx:126-132`) was mutated to accept any shape (deleted both validity checks, coerced `armed` with `Boolean()` instead of requiring a genuine boolean), and the spec was re-run against the live dev:noauth server:

```
Error: ENTERS unknown on a malformed push (missing data field)

expect(locator).toHaveAttribute(expected) failed

Locator:  locator('.signal-horizon')
Expected: "unknown"
Received: "resting"
Timeout:  5000ms
```

The mutated payload (`{}`) was silently accepted as `{ armed: false }` and resolved to `resting` instead of `unknown` — the guard demonstrably fires (removing it turns the spec RED for the expected reason). The mutation was then reverted; `git diff --stat src/components/SignalHorizon.tsx` returned empty (confirmed), and the spec was re-run: `1 passed (4.3s)`, identical output to the pre-mutation run above. `npx vitest run src/components/SignalHorizon.test.tsx` also re-confirmed 28/28 passing after the revert, and `npx tsc --noEmit` exits 0.

## Task Commits

1. **e2e/estop-wire.spec.ts** — `7a05ad5c` (test)

No other commit in this plan's diff; the rebuild itself was a prior, separate operator action with no codepulse-repo commit of its own.

## Files Created/Modified

- `e2e/estop-wire.spec.ts` (created, 193 lines) — the D-20 malformed-vs-well-formed control.
- `src/components/SignalHorizon.tsx` — mutated for the guard-fires proof, then reverted; `git diff --stat` confirmed empty before committing anything, so this file carries no net change in this plan's diff.

## Decisions Made

See `key-decisions` above: the D-20 substitution (already decided before this plan ran) and the mount-timing finding this plan's own execution surfaced (dev:noauth shares the live backend, so `unknown` is not observable at mount either).

## Deviations from Plan

### Auto-fixed / plan-superseded

**1. [Plan-text superseded by an already-recorded decision, not a Rule 1-3 auto-fix] Task 1/Task 2/Task 3's before/after `HORIZON_EXPECT` control was not implemented as written**
- **Found during:** Reading `125-CONTEXT.md`'s D-20 before starting (per this plan's own dispatch instruction to read D-20 first).
- **Issue:** `125-12-PLAN.md`'s Tasks 1-3 specify an `env`-driven before/after Playwright run (`HORIZON_EXPECT=unknown` then `HORIZON_EXPECT=resting`) gated behind a `checkpoint:decision` for the rebuild itself. D-20, recorded in `125-CONTEXT.md` before this plan executed, states this control is no longer implementable and specifies its replacement.
- **Fix:** Implemented D-20's replacement directly — a malformed-vs-well-formed control via `window.__signalHorizonStub`, no `HORIZON_EXPECT` env var, no rebuild-decision checkpoint (the rebuild had already happened, run inline by the orchestrator).
- **Files modified:** `e2e/estop-wire.spec.ts` (written to D-20's spec, not the plan's literal Task 1 text).
- **Committed in:** `7a05ad5c`

**2. [Found during execution, not anticipated by D-20] `HORIZON_EXPECT`-style mount-state assertions are unobservable against dev:noauth, not just against the emitter's deployment state**
- **Found during:** First draft of the spec, which included a `mount state is unknown` assertion.
- **Issue:** The first draft failed live: `Expected: "unknown", Received: "resting"` — dev:noauth's WS context is wired to the real backend, and the real on-connect snapshot arrives before the assertion's polling window observes `unknown`.
- **Fix:** Removed the mount-state assertion; every transition the final spec asserts is driven explicitly through the stub, immune to real-wire timing.
- **Files modified:** `e2e/estop-wire.spec.ts`
- **Committed in:** `7a05ad5c`

---

**Total deviations:** 2, both required by decisions already on record (D-20) or by a live finding this plan's own first draft surfaced and corrected before committing. No scope creep — the plan's central must_have (prove the D-02 wire, or its D-20 replacement) is satisfied by what shipped.
**Impact on plan:** The rebuild (must_have 1) and the malformed-snapshot control (must_have 3, under D-20) are both satisfied. The plan's original literal Task text for the control is superseded, as instructed.

## Issues Encountered

None beyond the two deviations above, both resolved before committing.

## User Setup Required

None — no external service configuration required. No `npx convex deploy`, no docker command, run by this plan.

## What This Plan Does NOT Establish

**End-to-end wire delivery from Ástríðr's emitter through the socket to the DOM is NOT proven here.** The rebuild evidence above confirms the emitter's code is live in the running container, and the guard-fires proof confirms the client's validation path is correct — but this plan's spec never received a single frame over a real WebSocket connection carrying a real armed/disarmed E-Stop transition; every transition asserted was pushed directly through the DEV-only stub. A green `125-12` run is evidence about the CLIENT's handling of snapshot validity only. Do not read it as evidence that Ástríðr's emitter reaches the browser — that verification, arming the real E-Stop and watching the real horizon over a real connection, is 125-13's job.

## Next Phase Readiness

- 125-13 (live E-Stop verification) can proceed: the emitter is confirmed live in the running container, the client-side validation is mutation-proofed correct, and the one open question — does a real armed/disarmed transition actually reach the DOM over the real socket — is exactly what 125-13 is scoped to answer.
- No blockers.

---
*Phase: 125-signature-layers*
*Completed: 2026-08-24*

## Self-Check: PASSED

`e2e/estop-wire.spec.ts` confirmed present on disk (193 lines). Commit `7a05ad5c` confirmed present via `git log --oneline --all | grep 7a05ad5c`. `git diff --stat src/components/SignalHorizon.tsx` confirmed empty (guard-fires mutation fully reverted). `git status --porcelain` shows no other file from this plan's work outstanding.
