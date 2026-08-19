---
id: TODO-tailwind-scans-beyond-src
status: pending
planted: 2026-08-19
planted_during: Phase 122 (Tokens, Primitives & Contrast Measurement) — found while chasing a phantom `.bg-gray-950/50` rule that survived the sweep in the built stylesheet
trigger_when: Any phase that asserts the shipped CSS is free of a class, or that tightens the token ratchet's corpus scope. Also worth doing opportunistically — the fix is one directive.
scope: Trivial (one `@source not` directive), plus a decision about what else Tailwind should not scan
source: Measured 2026-08-19 against a clean `npm run build`; src/index.css:5 and scripts/migrate_tokens.py
resolves_phase: null
last_reviewed: 2026-08-19
---

# Tailwind scans `scripts/`, so build tooling leaks classes into the production stylesheet

## What was observed

After Phase 122 swept every `bg-gray-950` out of `src/` and `index.html`, the built stylesheet
still contained the rule:

```css
.bg-gray-950\/50{background-color:#03071280}
```

`git grep -lF 'bg-gray-950' -- src/ index.html` returned **nothing**. The source of the rule is
`scripts/migrate_tokens.py`, which contains the literal as a Python string — Tailwind's content
scanner reads it and generates the utility.

`src/index.css:5` carries exactly one exclusion:

```css
@source not "../.planning";
```

So `.planning/` is excluded (correctly — the ledgers and summaries are full of class names), but
`scripts/`, `e2e/`, and anything else at the repo root is still scanned.

## Why it matters

Two things, neither catastrophic:

1. **Dead CSS ships.** Small — one rule here — but it grows silently with every tooling script that
   mentions a class name.
2. **It breaks the equivalence a ratchet depends on.** Phase 122's ratchet derives its corpus from
   `src/`. "Clean in `src/`" therefore does **not** mean "clean in what ships". Any future claim of
   the form "class X no longer appears in the production stylesheet" must account for the wider
   scan scope, or it will be contradicted by a build artifact exactly as this one was.

## Suggested fix

Add the missing exclusions next to the existing one in `src/index.css`:

```css
@source not "../.planning";
@source not "../scripts";
```

Then rebuild and confirm the phantom rule is gone. Pair the check with a known-present control (a
class that legitimately ships, e.g. `bg-card`) so a zero is believable — and remember Tailwind v4
emits **comma-joined selectors** and escapes parens in compiled selectors, so searching `.class{`
in the built CSS returns a false zero. Search the bare substring.

Consider whether `e2e/` should also be excluded: its specs name classes deliberately, and any class
mentioned only in a test currently compiles into production CSS.
