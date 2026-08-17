---
phase: 109-per-agent-engine-ui
plan: 10
type: summary
wave: 8
gap_closure: true
requirements: [ENGINE-04, ENGINE-03]
status: complete
outcome: both-gaps-closed-engine-04-signed
date: 2026-08-10
---

# 109-10 — Gap Closure for the 109-09 Live Gate

Closed both items 109-09 left open, and signed ENGINE-04 against the running stack.

Executed inline (attended), same reasoning as 109-09: `autonomous: false` with a blocking
human-verify checkpoint and an operator sign-off.

## Task 1 — the defect, fixed and regression-guarded

**RED first, proven.** Four new cases in `useProfileSwap.test.ts` failed against unmodified source
with exactly the live gate's symptom:

```
expected { status: 'pending' } to deeply equal { status: 'confirming' }
```

Two design points that make them real rather than decorative:

- A **CONTROL case** asserts StrictMode genuinely double-invokes effects in this environment
  (`["mount","cleanup","mount"]`). Without it, a green regression case could mean "fixed" or "the
  boundary was never crossed" — indistinguishable.
- An explicit `unmount()` + fresh `renderHook()` would NOT reproduce the bug, because `useRef` is
  per-instance and a new render gets a fresh `unmountedRef`. Only StrictMode's cleanup-then-re-run
  against the SAME fiber preserves the latched ref. The test crosses the boundary the way
  production does.
- A **GUARD INTACT case** asserts a dispatch resolving after a genuine unmount still cannot advance
  the machine, so a later "simplification" that deletes the ref rather than resetting it turns the
  file red.

**The fix** (`useProfileSwap.ts`): reset `unmountedRef.current = false` at the top of the mount
effect. One line. The guard is reset, never removed.

Result: 18/18 in that file, full suite green, `tsc` exit 0.

## Task 2 — live re-verification

### Probe D re-run, on the DEV server (`:5173`)

A production pass would have proven nothing — 109-09 established production was never affected.
`Environment: development` confirmed for the run. All four legs, one instrumented measurement:

```
t=108063  DOM    suffix up, base label STILL OLD (claude-opus-4-8)
t=108117  WS     ack status=ok
t=108383  WS     control_verb_swap + swap.state
t=108743  DOM    label flips — 626 ms AFTER the ack
t=109458  DOM    SUFFIX CLEARS                       <- previously never
t=109463  TOAST  success "business switched to Claude Sonnet 5."   <- previously never
```

The instrument was proven live before use rather than assumed. An earlier attempt produced the same
DOM legs with an EMPTY frame log (the socket predated the patch), so it carried no ack timestamp and
could not support the "only after the ack" claim — discarded and re-run with a forced reconnect
rather than reported with a gap.

### Probe F — the delete gap, and closing it

Probe F could not be satisfied by the plan's assumed route. **`New Profile` writes `agentProfiles`,
while the Agent Profiles rows render from `profileConfigs`** — the component's own docstring says so
(`Settings.tsx:237-240`). A profile created there is structurally invisible on the surfaces Probe F
must read. My first reading of the missing row as "the create failed" was wrong; querying
`agentProfiles:list` showed it created fine, and it was deleted immediately with a control.

Satisfying Probe F needed a `profileConfigs` row — and there was **no delete for `profileConfigs`
anywhere in `convex/`**. Rather than permanently adding a profile to the operator's live config, the
operator chose to close the gap: `profiles.removeConfig` was added (single-row, index-seeked,
audited, idempotent, explicitly not a bulk delete).

Probe F then passed on every measurable surface, each against real-valued controls in the same
reading:

| Surface | `gate-probe-f` | Controls |
|---|---|---|
| Settings row | `Not reported` | 3 profiles at `anthropic/claude-sonnet-5` |
| Confirm modal current-engine column | `Not reported` | 3 profiles at `Claude Sonnet 5` |
| Picker, "This profile" | ZERO rows marked current | every prior measurement had exactly one |
| Header badge | not measurable — bound to the ACTIVE profile | recorded as a structural limit, not a pass |

## A defect in my own new mutation, caught only by running it live

The first `removeConfig` call FAILED and left the row undeleted: the audit insert set
`newValue: undefined`, Convex omits undefined-valued fields, and `configChanges.newValue` is
`v.any()` — REQUIRED, unlike `oldValue: v.optional(v.any())` (`schema.ts:270-271`). The insert
failed validation, aborting the whole mutation.

**All eleven structural tests passed while it was broken.** They assert the source's SHAPE
(index-seeked, single `.delete()`, no bulk-delete idioms, audit-before-delete ordering); none of
that can catch a runtime validator rejection. This is the gate's own premise applied to my own work.
A regression assertion was added afterwards, and the bulk-delete guard was separately
mutation-tested (`.first()` → `.collect()` turns it red) so the suite's green is not taken on trust.

## Requirement outcome

**ENGINE-04 — SATISFIED**, signed under explicit operator authorization on 2026-08-10 after both
blockers were cleared and re-verified live. ENGINE-03 and TELE-02 were signed at the 109-09 gate.

Final probe scoreboard across both plans: **A · B · C · D · E · F · G · H — all pass.**

## Environment left clean

- Live routing at baseline: `model_override: null`, `profile_overrides: {}`.
- Throwaway profile removed, verified against a control (three real profiles still returned).
- `astridr-agent` and `convex-backend` healthy; `8181`, `3210`, `5173` all 200.
- Suite: 3755 passed / 285 files / 17 skipped; `tsc --noEmit` exit 0.

## Incidental findings raised, not silently dropped

1. **`New Profile` creates rows the section it lives in never displays** — it writes `agentProfiles`
   while the card renders `profileConfigs`. Whether that is a defect or an intentional split serving
   the Roster feature is not established here.
2. **A stale claim in two load-bearing comments.** `Settings.tsx:239` and `convex/profiles.ts:113`
   both justify ignoring `agentProfiles` on the grounds it has "zero rows in production". The live
   self-hosted instance returns **3993**. The rendering decision may still be right; its stated
   justification is false as written.

Neither is in this plan's scope. Both are candidates for a follow-up.
