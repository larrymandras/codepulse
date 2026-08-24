---
phase: 125-signature-layers
plan: 13
status: complete
executed: 2026-08-24
executed_by: orchestrator (Task 1 inline) + operator (Task 2, live)
commits: [78f96661, ad68fed8]
requirements: [SIGNAL-01]
---

# 125-13 — Live E-Stop verification on the deployed wire

**Outcome: the wire is PROVEN and criterion 1 initially FAILED, then passed after a fix made in
this plan.** This is the only step in the phase that could establish end-to-end delivery, and it is
also the only step that caught the defect — which no automated check in the phase could have.

## Task 1 — Pre-arm baseline (`78f96661`)

Keyless dev server on `:5181` (PID 102152, `vite --port 5181 --strictPort --host 127.0.0.1`),
identity confirmed by command line rather than by an HTTP 200.

`PW_BASE_URL=... HORIZON_EXPECT=resting npx playwright test e2e/estop-wire.spec.ts` → 1 passed.

Observed values, via `e2e/estop-baseline.probe.mjs` (committed so the baseline is reproducible):

| observable | t≈10s | t≈70s |
|---|---|---|
| `data-horizon-state` | resting | resting |
| `data-ecg-state` | live | live |
| `data-backfill-truncated` | false | false |
| `countState` | **loading** (skeleton) | **ready** |
| numeral | — | **16** |

**The countState pair is D-17's evidence** and the reason the probe waits: the numeral is expected
ABSENT early (the 60s live-WS window is not full) and PRESENT late. Either reading alone proves
nothing — absent could mean broken, present could mean it was never degraded.

Pre-arm E-Stop status: `{"active":false,"reason":""}`. Container `astridr` healthy, 1.219 GiB / 6
GiB, 1.13% CPU.

### A probe error, recorded because the failure mode is general

The first version of the baseline probe reported an empty numeral at BOTH readings, which looked
like a missing feature. It was a broken probe: it targeted `[data-ecg-count]` and the hero's
`innerText`, neither of which holds the numeral. The real element carries an `aria-label` ending
`events in the trailing 60 seconds` (`PulseEcgHero.tsx:58`), and the loading branch renders a
`Skeleton` labelled `Pulse count loading`. Rewritten to key on those before the reading was
believed. A negative result is a claim about the probe first.

### Activation surface

`estop.py:26-63`'s docstring — itself corrected 2026-08-14 after all five documented surfaces were
measured and four turned out not to exist — leaves exactly one reachable path: loopback HTTP
`POST /api/estop/activate` with `CODEPULSE_ADMIN_KEY` in an `x-astridr-admin-key` header.

**The CodePulse E-Stop button cannot work.** The WS `estop.activate` command is gated on the ADMIN
key while the dashboard holds only the SERVICE key.

The host cannot reach it either: the container binds `0.0.0.0:8181`, so a host request arrives via
Docker NAT as a bridge IP and fails the loopback check — measured, `403` from the host vs `200`
from inside the container with the key, `403` from inside without it. The working form runs inside
the container and references the key from the container's own environment, so no secret enters the
operator's terminal.

**A PowerShell defect was found handing this over.** The first command used
`-H "x-astridr-admin-key: $CODEPULSE_ADMIN_KEY"`; PS 5.1 mangles inner double quotes passing
arguments to a native executable, so `sh -c` received the header split at the space and curl
reported `no URL specified`. Removing the space after the colon removes the need for quotes
entirely. **Check which shell the operator's prompt actually is before writing the command.**

## Task 2 — Operator live verification

The operator armed E-Stop from a terminal while observing a browser tab, which is the only way to
test the property: criterion 1 asserts crimson on EVERY page *the instant* E-Stop arms, and that
cannot be verified from the tab that pressed the button.

### First observation — the wire passed, the UI failed

With E-Stop genuinely armed (`{"active":true,...}` confirmed independently), the orchestrator
measured on fresh loads:

```
/            data-horizon-state = critical
/briefings   data-horizon-state = critical
/live-run    data-horizon-state = critical
```

**The operator, watching the screen and actively looking for it, reported: "i did not see any
change on the page."**

Both were true. The state was correct, the crimson was applied, and it was not perceptible. The
armed horizon measured `{"x":232,"y":56,"width":1168,"height":3}` — a 3px strip under the header,
exactly what `125-UI-SPEC.md:54` specified ("2px at rest, 3px when E-Stop-armed"). The
implementation was faithful; the design was not loud enough to be an alarm.

A transition-push defect was hypothesised (operator's tab was already open; the orchestrator's
probes were fresh loads, so only the on-connect path was exercised) and then REFUTED by reading the
code rather than by re-halting production: `estop.py:167-170` emits via `telemetry.send()`, and
`telemetry.py:319/347` fans that out to `_ws_subscribers`, so open tabs do receive transitions. The
simpler explanation — a 1px height change on a hairline is imperceptible whether or not it
arrived — is the one supported.

### The fix (`ad68fed8`)

Height 2px→7px, a two-layer crimson `box-shadow` mixed from `--status-error` so the signal spreads
past the bar's own box, and an 1100ms alternating pulse on opacity and glow radius with a 0.7 floor
(never 0 — a signal that periodically vanishes is worse than a static one).

**Specificity trap, caught before shipping:** the existing reduced-motion and `readable` gates set
`animation: none` on `.signal-horizon` at (0,1,0), which does NOT override the critical rule at
(0,2,0). A blanket gate would have left the alarm pulsing for exactly the users who asked for no
motion. Both gates now name the state explicitly and retain the full height and brightest static
glow — the armed signal is functional, not decorative.

Verified without halting Ástríðr again, via `window.__signalHorizonStub` (the same
`handleFrame → parseEstopPayload` path the real subscription drives), resting as the control:

```
RESTING   height=2px  animation=aurora-drift   boxShadow=none
ARMED     height=7px  animation=horizon-alarm  boxShadow=<crimson, 2 layers>
```

`125-UI-SPEC.md:54` was revised in the same commit rather than left contradicting the code.

### Second observation — passed

The operator hard-refreshed, re-armed, and returned a screenshot of `/briefings` showing a crimson
band with visible bleed spanning the content width — unmissable at a glance, against the same page
and the same armed state where the 3px version had been invisible. He then disarmed
(`{"active":false,"queued_messages":0}`) and instructed closure.

**Recorded precisely:** the operator did not give a prose verdict for this plan; his verification
consisted of the retest screenshot plus the instruction to close out. That is written here as what
happened rather than paraphrased into a quotation he did not make.

## Full arm/disarm cycle, measured

| | `/` | `/briefings` | `/live-run` |
|---|---|---|---|
| pre-arm | resting | — | — |
| armed | **critical** | **critical** | **critical** |
| disarmed | resting | resting | resting |

The same probe read both states, so the readings discriminate rather than defaulting. Two full
halt/release cycles completed; `docker restart` was never needed. Ástríðr closed healthy,
`Up About an hour (healthy)`.

## The finding worth carrying out of this phase

**Every automated check in Phase 125 passed against the invisible styling.** 125-04's 19 tests,
125-08's 65, and 125-12's four-shape malformed-snapshot control all asserted the *state attribute*
— and all were correct. Not one could observe that a human staring at the screen would not notice.

The gap is not that the tests were weak. It is that "the state is `critical`" and "an operator can
see the alarm" are different properties, and only the second is what criterion 1 actually promises.
A safety signal that is technically correct and perceptually absent has failed. This is the
strongest argument in the phase for keeping a human checkpoint that no amount of automated
assertion could have replaced.
