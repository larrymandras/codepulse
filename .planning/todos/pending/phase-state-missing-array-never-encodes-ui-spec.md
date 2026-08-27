---
id: TODO-phase-state-missing-array-never-encodes-ui-spec
status: pending
planted: 2026-08-25
planted_during: Phase 126 execution — surfaced independently by a peer session's adversarial review AND by Codex, then control-tested by the orchestrator
trigger_when: Before the next frontend phase is planned or executed, or any time `phase-state.json`'s `ready`/`missing` fields are used to decide whether a phase may proceed. Not urgent for 126 (its skip was a deliberate, now-recorded operator decision) — urgent as a GATE, because the field reads green for every phase regardless.
scope: Small — either make the validator encode the check, or stop presenting `missing: []` as if it were a verdict
source: `.planning/phases/*/phase-state.json`; the gsd-sdk readiness validator
resolves_phase: 138
last_reviewed: 2026-08-27
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

---

## MECHANISM FOUND 2026-08-27 — `isFrontend` is a CONSTANT-TRUE predicate

Surfaced by a Codex adversarial review of Phase 128's `phase-state.json`, then measured by the
orchestrator. This supplies the half the 2026-08-25 entry above could not explain: it established
that `missing` carries no signal, but not WHY `isFrontend` kept reading `true`.

**The classifier greps case-insensitively for `UI` as an UNANCHORED SUBSTRING.** The gate
(`plan-phase.md` step 5.6) tests the roadmap phase section against:

    UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget

`**Requirements**:` is a MANDATORY field in the GSD roadmap phase template, and it contains
`UI` inside "req-UI-rement". So every phase that uses the standard template matches.

**Measured across `.planning/ROADMAP.md` (all milestones, 2026-08-27):**

| Result | Count |
|---|---|
| Phase sections scanned | 56 |
| Classified `isFrontend` | **56** |
| Classified non-frontend | **0** |

Six fire on NOTHING ELSE — remove the string "requirement" and they stop matching entirely:
**128** (planning reconciliation), **136** (flaky-test repro), and **149/150/151/154** (Forge
backend: session lifecycle, worktrees, WS attach, permission relay). Not one is a UI phase.

A predicate that returns `true` for all 56 inputs has never once discriminated. Note the other
listed words are substrings too — `view` matches "review"/"overview", `form` matches
"information"/"performed"/"transform" — so even removing "requirement" would not make this sound.

### Refinement to this todo's own title

The title says `missing: []` carries no signal. That is right for `execute-phase` but INCOMPLETE:
under `plan-phase` the field DOES populate. Phase 128's record reads

```json
{ "command": "plan-phase", "ready": false, "missing": ["UI-SPEC.md"] }
```

— non-empty, and WRONG, on a phase whose only code deliverable is one test file. So there are two
distinct failure modes, not one: the field is vacuously empty under `execute-phase`, and
confidently wrong under `plan-phase`. Both trace to the same constant-true classifier.

### Consequence for GATE-01's acceptance criterion — this is the trap

GATE-01 must NOT be written as "`missing` becomes non-empty" or "the gate fires". Both are already
true here while the gate is broken. **Require a BIDIRECTIONAL test:** a genuine UI phase lacking a
UI-SPEC must FAIL, and a non-UI phase touching only TypeScript/tests must stay READY without one.
Anchor the match (word boundaries, or read the phase's `files_modified`) rather than substring-
grepping prose.

## Re-derivation (Phase 128, 2026-08-27)

Re-checked against `HEAD` in this worktree, per D-04/D-06. Sampled 3 `phase-state.json` files
across different UI-spec situations (the population this todo's own "Verification when fixed"
section asks for):

1. `.planning/phases/128-planning-reconciliation/phase-state.json:9-13,17-21` — `isFrontend: true`,
   no `128-UI-SPEC.md` (correct — 128 builds one test file, no UI). `{"command":"plan-phase",
   "ready":false,"missing":["UI-SPEC.md"]}` on both history entries — **non-empty and wrong**.
2. `.planning/milestones/v15.0-phases/124-shell-information-architecture/phase-state.json:6-11,30-36`
   — `isFrontend: true`, **has** `124-UI-SPEC.md`. `{"command":"code-review","ready":true,
   "missing":[]}` — empty/green.
3. `.planning/milestones/v15.0-phases/126-page-body-and-convex-read-defect-sweep/phase-state.json:12-17`
   — `isFrontend: true`, **no** UI-SPEC (deliberate skip). `{"command":"execute-phase","ready":true,
   "missing":[]}` — also empty/green, byte-identical to file 2's `missing` value despite the
   opposite UI-SPEC situation.

Files 2 and 3 confirm the field still cannot discriminate "has a spec" from "deliberately has
none" under non-`plan-phase` commands. File 1 confirms the `plan-phase`-side false positive this
todo's own 2026-08-27 addendum already found is still live today, not merely historical.

**Verdict: STILL OPEN — evidence cited above.** Full ledger entry:
`.planning/phases/128-planning-reconciliation/128-TODO-OPEN-EVIDENCE.md`, Verdict 3.
`resolves_phase: 138` confirmed against `.planning/REQUIREMENTS.md:262`
(`GATE-01 | Phase 138 | Pending`).
