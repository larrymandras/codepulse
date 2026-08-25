---
id: TODO-phase-state-missing-array-never-encodes-ui-spec
status: pending
planted: 2026-08-25
planted_during: Phase 126 execution — surfaced independently by a peer session's adversarial review AND by Codex, then control-tested by the orchestrator
trigger_when: Before the next frontend phase is planned or executed, or any time `phase-state.json`'s `ready`/`missing` fields are used to decide whether a phase may proceed. Not urgent for 126 (its skip was a deliberate, now-recorded operator decision) — urgent as a GATE, because the field reads green for every phase regardless.
scope: Small — either make the validator encode the check, or stop presenting `missing: []` as if it were a verdict
source: `.planning/phases/*/phase-state.json`; the gsd-sdk readiness validator
resolves_phase: null
last_reviewed: 2026-08-25
---

# `phase-state.json`'s `missing: []` carries no signal about UI-SPEC — for ANY phase

## What was observed (2026-08-25)

Phase 126's `phase-state.json` records:

```json
{ "command": "execute-phase", "ready": true, "missing": [] }
...
"isFrontend": true
```

with **no `*-UI-SPEC.md`** anywhere in the phase directory or its `artifacts` inventory. Read
alone, that is the shape of a gate reporting green while skipping the check it exists to perform —
the same failure class as [[gsd-coverage-gates-selfskip-on-phase-prefix]], where `passed: true`
accompanied `skipped: true, total: 0`.

## The control, which is what makes this a finding rather than a suspicion

**Phase 124 HAS a `124-UI-SPEC.md`. Its `phase-state.json` also records `"missing": []`.**

So the field is byte-identical whether the UI-SPEC exists or not. It is not that Phase 126 slipped
past a check — **the field never encodes this check for any phase**, so it cannot distinguish:

- a deliberate, reasoned skip (126's actual case),
- an inherited spec from a parent phase,
- or a genuine omission on a phase that needed one.

A reader — human or automated — cannot tell those apart from the state file. That is the defect.

## What is NOT wrong here

Phase 126's skip was legitimate and is now recorded. It is a defect sweep over existing pages
building no new surface; `ROADMAP.md` records the same deliberate `--skip-ui` policy for sweep
phases 110/113/115/117/119/122, explicitly contrasted with 124/125 which DO build new surface and
each carry their own spec. Phase 126's own entry was added to its ROADMAP section on 2026-08-25.

So do **not** "fix" this by writing a retroactive UI-SPEC for 126. The decision was right; only its
machine-readable trace was missing, and that half is closed.

## The fix, when picked up

One of:

1. **Make the validator encode it** — for `isFrontend: true`, check for a UI-SPEC (or an explicitly
   recorded inherited/skipped decision) and populate `missing` accordingly, so `ready: true` means
   the check ran and passed.
2. **Add an explicit field** — e.g. `uiSpec: "present" | "skipped:<reason>" | "inherited:<phase>" |
   "absent"` — so the state records which of the four cases holds.
3. **Stop presenting `missing: []` as a verdict** if it is only ever an empty placeholder, because
   an always-empty field that looks like a check is worse than no field.

## Verification when fixed

Do not accept a single green. The control is the whole test: run the validator against a frontend
phase WITH a UI-SPEC and one WITHOUT, and confirm the outputs **differ**. Today they do not — that
identical output across the two cases is exactly what proved the field carries no signal, and it is
the same probe that must come out differently afterwards.

Pair it with the standing rule for this repo's gates: **read `missing`/`skipped`/`total`, never
`ready`/`passed` alone.**
