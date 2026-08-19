---
id: TODO-shadow-rgba-outside-sweep-buckets
status: pending
planted: 2026-08-19
planted_during: Phase 122 (Tokens, Primitives & Contrast Measurement) — surfaced by sweep slice C (122-06) and re-confirmed when the 122-17 ratchet was scoped
trigger_when: Any future phase that claims the codebase is free of raw palette or violet colour, or that extends the token ratchet. Not urgent on its own — the surviving instances are deliberate and documented.
scope: Small (decide a policy, then either add a fifth ratchet bucket or record the exclusion permanently)
source: Measured 2026-08-19; src/components/SwarmTaskNode.tsx and the four bucket matchers in src/tokenSweep.ratchet.test.ts
resolves_phase: null
last_reviewed: 2026-08-19
---

# Raw colour inside `shadow-[...]` is invisible to every sweep bucket and to the ratchet

## The gap

Phase 122's four sweep buckets all key on a utility PREFIX:

```
palette   (bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}
hex       (bg|border|text)-\[#
duration  duration-[0-9]+
violet    (bg|text|border|from|to|via)-(violet|purple)-[0-9]{2,3}
```

A bare `rgba(...)` inside an arbitrary `shadow-[...]` value carries none of those prefixes, so no
matcher can see it — and the 122-17 ratchet inherits the same blind spot, because it re-derives its
population with the same bucket patterns.

Consequence: the ratchet can report "no raw violet remains" while raw violet is still shipping.
That statement is true *of the four buckets*, not of the codebase.

## Known surviving instances (deliberate, not oversights)

`src/components/SwarmTaskNode.tsx` keeps a violet state-identity glow on the `verifying` state:
`shadow-[0_4px_20px_rgba(139,92,246,0.25)]`. Its source already carries the comment
`// violet — state identity color, exempt`. Its sibling `failed` shadow
(`rgba(239,68,68,...)`) is untouched for the same reason. Slice C recorded both in
`sweep-ledgers/122-06-LEDGER.md` rather than converting them.

## Why it was not fixed in 122

Converting them was out of scope — the buckets were defined before the exemption was discovered,
and silently widening a sweep's matcher mid-phase would have invalidated the per-slice before/after
counts every ledger is built on.

## What a future phase should decide

Either:
1. Add a fifth ratchet bucket matching raw colour inside arbitrary-value utilities
   (`shadow-[...]`, `drop-shadow-[...]`, any `[...]` containing `rgb`/`rgba`/`#`), with an explicit
   exemption record for the deliberate state-identity glows; **or**
2. Record permanently that shadows are out of the token layer's scope, and add that sentence to the
   ratchet's own header so a future reader does not mistake a green run for full coverage.

Option 1 is preferable if the token layer is ever meant to own glow colour. Whichever is chosen,
the ratchet's own docstring should state the boundary — it currently does not.
