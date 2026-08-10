# Defect 1 — make a per-profile override visible fleet-wide (implementation plan)

Source: `.planning/BRAIN-SURFACE-DEFECTS-2026-08-10.md` Defect 1.
Design decision taken by Larry, 2026-08-10: **an override participates in mixed-state
derivation** — the fleet-wide read becomes `mixed` when one profile is pinned and others
disagree. The rejected alternative was relabelling the surfaces so "Active brain" no longer
implies "your brain".

## Corrections to the handoff doc — verified before planning

- **"Phase 109 held ENGINE-04 pending; `109-10-PLAN.md` exists and is unexecuted" is stale.**
  109-10 ran and closed the phase: `6014d2c4 docs(109-10): sign ENGINE-04 and close Phase 109
  at 10/10`, with `109-10-SUMMARY.md` (`status: complete`, `outcome:
  both-gaps-closed-engine-04-signed`). This defect is **not** in any open 109 scope and needs
  its own plan — this one.
- The structural claim itself is **confirmed** as written. `useResolvedBrain.ts:337` gates the
  override rung on `profileId !== undefined`; `:367` calls `deriveMixedState(activeEngines)`
  with `profileOverrides` never threaded in.

## The change

`resolveActiveBrain`'s fleet-wide branch (`useResolvedBrain.ts:367-383`) must fold overrides in
before deriving mixed state. Do this by overlaying, not by editing `deriveMixedState` —
`deriveMixedState` stays a pure `ActiveEngineMap -> MixedState` function with its existing D-08
`modelIdsMatch` fold and its "unreported profiles are excluded" rule intact.

Shape:

```ts
// Per-profile precedence applied fleet-wide, identical to rung (a)'s scoped precedence:
// an override outranks that profile's telemetry. Building the effective map here (rather
// than teaching deriveMixedState about overrides) is what makes the fleet read agree with
// the scoped read BY CONSTRUCTION instead of by two formulas that happen to match.
const effective: ActiveEngineMap = { ...activeEngines };
for (const [pid, override] of Object.entries(profileOverrides)) {
  effective[pid] = {
    profileId: pid,
    model: override.model,
    mode: "pinned",
    selectionPath: override.source ?? "override",
    timestamp: 0,
  };
}
const mixedState = deriveMixedState(effective);
```

`ProfileBrainOverrides` is `Record<string, { model: string; source: string | null }>`
(`useResolvedBrain.ts:66`) and `ActiveEngine` requires `profileId`/`model`/`mode`/
`selectionPath`/`timestamp` (`src/lib/brainsApi.ts:40-47`), so the synthesized entry needs
those five fields and no `expiresAt` (an override has no expiry of its own).

**A profile with an override but no telemetry key gets added to the map.** That is deliberate:
`ActiveEngineMap`'s contract says a missing key means "not a known profile at all"
(`useActiveEngine.ts:22-24`), and a profile someone has pinned is provably known. This is the
rung that actually fixes the reported symptom — the freshly-pinned profile had no telemetry yet
because no turn had run on Opus 5.

## Two sub-decisions this plan does NOT silently resolve

1. **Global override + one divergent per-profile pin.** Rung (b) (`:347`) returns `source:
   "global"` and short-circuits before the fleet branch, so today a global override hides every
   pin fleet-wide. Rung (a)'s own docstring (`:318-320`) says a pinned profile under a global
   override "still shows its own pin, exactly as Ástríðr will actually resolve that profile's
   next turn" — which argues the fleet-wide truth in that state is `mixed`, not `global`.
   Changing it means reordering rung (b) against the fleet fold. **Decide before coding;** it is
   a separate behavior change from the one authorized above and it touches the global axis every
   surface reads.
2. **`source` when the single agreed model came from an override.** The fold returns `source:
   "profile"` (`:373`), which would now be reachable via a pure-override agreement. Either accept
   it or add a fleet-wide `"override"` source — the latter is a `ResolvedBrain` union change with
   consumers in `BrainHeaderBadge`, `LlmStatusPanel`, and `Chat`.

## Tests to write first (RED)

`src/hooks/useResolvedBrain.test.ts` — `resolveActiveBrain` is a pure exported function, so all
of these are direct unit tests with no React or Convex runtime.

1. One profile pinned to model A, another reporting model B, no `profileId` → `source: "mixed"`,
   `distinctModels` contains both. **This is the defect.**
2. One profile pinned to A, no telemetry for it at all, no other profiles, no `profileId` →
   resolves to A (not `"none"`, not `lastTurnModel`). **This is the reported symptom.**
3. All profiles agree on A and one of them agrees via an override → `single` path, model A, not
   `mixed`. Guards against the overlay manufacturing a spurious mixed reading.
4. Override model and telemetry model for the SAME profile differ → the override wins in the
   fold (rung (a) precedence holds fleet-wide too).
5. Two ids for one model across an override and telemetry (`anthropic/claude-sonnet-5` vs
   `claude-sonnet-5`) → NOT mixed. Proves the overlay did not bypass D-08's `modelIdsMatch`
   fold — a raw-`Set` regression would pass every test above and fail only this one.
6. **Control:** no overrides at all → every existing fleet-wide result is byte-identical to
   today's. Run the existing `useResolvedBrain` suite unchanged as part of this.

Then: mutation-check test 1 by reverting the overlay line — it must go red. Per the repo's own
history, an assertion that stays green after the mutation means the fixture never crossed the
boundary the property is about.

## Do NOT do

Do not add `profileId` to `BrainHeaderBadge.tsx:60` or `LlmStatusPanel.tsx:76`. That silently
redefines a fleet-wide badge as a personal one and is the trap the handoff doc calls out. Both
call sites stay argument-free; only the resolver changes.

## Live verification (after the unit tests are green)

The decisive check, per the handoff doc: a `scope=personal` swap, then read all three surfaces
(composer pill, header badge, Control-Center LLM STATUS) and cross-check against
`docker logs astridr-agent | grep control_verb.swap_model`. Run it on a quiet dev server — the
concurrent-editing HMR churn described in the doc confounds the WS state.

Note Defect 4's fix (composer now restores the draft and toasts on a failed send) is already in;
it no longer masks this one by silently eating the swap-triggering message.
