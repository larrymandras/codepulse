---
phase: 123-accessibility-remediation
plan: 07
title: The boundary of this phase's sweep-completeness claim
purpose: D-07, D-08, D-17
---

# 123 Sweep Boundary

This phase makes a completeness claim about a sweep: "the token/opacity-modifier sweep is
clean." That claim is only as strong as its measurement. This document states, precisely, what
it covers and what it structurally cannot — per the objective's own rule: "either the claim is
true or it is explicitly bounded."

## 1. Scan root (D-07)

**The problem.** Tailwind's default JIT scan root is the whole repo minus explicit `@source not`
exclusions. Before this plan, `src/index.css` excluded only `../.planning`. Everything else —
including files that are not application source — was scanned for class-name candidates, and any
matching string compiled a real utility rule into the production stylesheet regardless of whether
that string was a live class usage or just a string that happened to look like one.

**Before.** A clean `npm run build`, fixed-string probe (`grep -rlF`, never a hand-escaped
regex — the class name contains a literal backslash-escaped slash in the compiled selector):

```
grep -rlF 'bg-gray-950\/50' dist/assets/*.css | wc -l    ->  1
```

The rule reproduces (`.bg-gray-950\/50{background-color:#03071280}` and its `color-mix` sibling),
sourced from `scripts/migrate_tokens.py:24`'s dict key `"bg-gray-950/50": "bg-background",` — a
one-time migration tool, not shipped code.

**Directive shape.** Tailwind v4.3.2 was tested empirically, not assumed: a single `@source not`
directive carrying multiple space-separated paths (`@source not "../.planning" "../scripts"
"../e2e";`) **compiles without error but silently excludes nothing** — rebuilding with that form
left the leak count at 1. The installed engine requires **one directive per path**. `src/index.css`
now carries four:

```
@source not "../.planning";
@source not "../scripts";
@source not "../e2e";
@source not "../docs";
```

**Population, widened beyond the plan's named scope.** The plan's action text named `scripts/`
(certain) and asked that `e2e/` be decided by measurement. Both were tested with a build-time
canary methodology: place a class that exists in valid Tailwind arbitrary-value syntax
(`bg-[#ab12cd]`, chosen because a bare made-up utility name like `bg-zzzcanary` is not valid
Tailwind syntax and produces no rule regardless of scan root — this was the first, failed,
uninformative version of the canary, caught only because its own control, the same string placed
in `src/`, *also* failed to compile) **only** in the target directory, then grep the built CSS for
it:

| Directory | Canary present in `dist/assets/*.css`? |
|---|---|
| `src/` (control — must compile) | yes |
| `scripts/` | yes, before exclusion / no, after |
| `e2e/` | yes, before exclusion / no, after |

While auditing the wider repo for the same defect class (`git grep` for the four ratchet bucket
patterns — see §3 — across every tracked path outside `.planning/`, `scripts/`, `e2e/`, `src/`),
one more source turned up that the plan never named: **`docs/superpowers/plans/*.md`** holds
**211 occurrences** (`git grep -oE '(bg|text|border|ring|placeholder|from|to|via)-(slate|zinc|
gray|neutral|stone|violet|purple|fuchsia)-[0-9]{2,3}(\\?/[0-9]+)?' -- docs/ | wc -l`, unit:
occurrences) of palette-shaped class-name literals in historical planning prose — never intended
as usage, same class of leak as `scripts/`. Confirmed via the same canary methodology and added
to the exclusion in the same commit. No other tracked, non-`src/` location in the repo matched any
of the four bucket patterns (`git grep -lE` across `.` minus the five now-accounted-for roots
returned nothing).

**After.** Fresh `npm run build` following the fix:

```
grep -rlF 'bg-gray-950\/50' dist/assets/*.css | wc -l          ->  1   (see residual, below)
grep -rlF 'text-muted-foreground' dist/assets/*.css | wc -l    ->  1   (known-present control)
```

The known-present control still returns 1 on the same after-build, proving the build genuinely ran
and was genuinely scanned — a build that silently emitted nothing would also show 0 for the leak,
so the control is what makes any zero informative here.

**Residual — the plan's chosen probe class does not reach zero, and cannot within this plan.**
`bg-gray-950/50` is uniquely bad as a verification literal: it is quoted **verbatim, in a
comment**, at `src/tokenSweep.ratchet.test.ts:36` — the ratchet's own docstring, illustrating
*this exact defect* as a worked example ("`scripts/migrate_tokens.py`'s string literals (e.g.
`"bg-gray-950/50"` ...) compile into the PRODUCTION stylesheet"). Tailwind's content scanner
cannot distinguish a class name inside a JS comment from a real usage, so as long as that sentence
exists inside `src/` (which is, correctly, never excluded — it is the application source), the
string keeps compiling regardless of what `@source not` excludes elsewhere. This plan's own
acceptance criteria (`git diff --stat src/tokenSweep.ratchet.test.ts` must be empty; D-17
reserves that file for plan 123-06 alone) forbid editing that comment here. **This is not a failed
fix; it is a documented, structural boundary of this plan's own constraints, not the exclusion
mechanism.**

To prove the exclusion mechanism itself is sound (as opposed to this one self-referential
literal), every one of `scripts/migrate_tokens.py`'s 58 class-name dict keys was checked against
the after-build individually (`grep -qF` per key, escaping `/` to `\/` to match Tailwind's
compiled selector form — unit: files, one check per key):

```
58 keys checked; 9 still present.
```

All 9 are legitimate `src/`-sourced classes, not leaks: `bg-background`, `bg-card`, `bg-muted`,
`bg-muted-foreground`, `border-border`, `ring-background`, `text-foreground`,
`text-muted-foreground` are live shadcn semantic tokens used throughout the app shell; `bg-gray-800`
has real callers in `src/components/CostTrendChart.test.tsx` and (again) `tokenSweep.ratchet.test.ts`.
None of the other 49 keys — including every other opacity-modified gray variant
(`bg-gray-700/40`, `bg-gray-900/60`, `border-gray-600/30`, etc.) — remain. The exclusion works;
`bg-gray-950/50` is the sole, narrow, structurally-unfixable-here exception, and it exists only
because a prior plan's documentation of this very defect is itself inside the scanned corpus.
Closing it costs one string edit inside a comment in `tokenSweep.ratchet.test.ts` (e.g. inserting
a zero-width break, or rephrasing without the literal) — trivial, but out of this plan's reach.

**Build health.** `npm run build` exits 0 before and after. Lightning CSS warning count: 4 before,
3 after (both captured in full; diffed line-for-line). No new warning appeared — one pre-existing
warning's source string lived inside a now-excluded directory and simply stopped being emitted;
the remaining 3 (`--status-*` and similar wildcard example strings inside arbitrary-value classes)
are byte-identical before and after, unrelated to this change, and out of this plan's scope.

`scripts/migrate_tokens.py` was not edited (`git status --porcelain scripts/` empty for this plan).

## 2. Shadow colour (D-08)

**The gap.** `src/tokenSweep.ratchet.test.ts`'s four bucket matchers, quoted verbatim from the
live file:

```
PALETTE_PATTERN  = "(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}"
HEX_PATTERN      = "(bg|border|text)-\\[#"
DURATION_PATTERN = "duration-[0-9]+"
VIOLET_PATTERN   = "(bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}"
```

(Note for the record: `123-07-PLAN.md`'s own `<interfaces>` comment paraphrases `VIOLET_PATTERN`
as `(bg|text|border|from|to|via)-(violet|purple)-[0-9]{2,3}` — missing `fuchsia` and adding
`from|to|via`, which the live pattern does not carry. The live file, quoted above, is
authoritative; the plan text is a draft and is corrected here.)

Every matcher requires a `bg-`/`text-`/`border-`/`from-`/`to-`/`via-` prefix immediately before
the colour token. A bare `rgba(r, g, b, a)` sitting inside an arbitrary `shadow-[...]` value
carries none of those prefixes — the prefix that *is* present is `shadow-`, which no bucket
matches — so it is invisible to every bucket, and to the ratchet that re-derives its population
from the same four patterns.

Shadows do not produce WCAG **text**-contrast violations (they are not text, and axe's
`color-contrast` rule does not evaluate `box-shadow`). This section is therefore a boundary
statement about what the ratchet cannot see, not a remediation — no code changes ship for it in
this plan, matching D-08's decision.

**Live population, re-derived (not carried over from the todo's claim).** Fixed-string-safe
command, unit stated:

```
git grep -noE 'shadow-\[[^]]*rgba\([0-9]+,\s*[0-9]+,\s*[0-9]+' -- src/ ':!*.test.*'
  ->  42 occurrences, across 23 files   (unit: matched lines via -o, i.e. occurrences —
                                          NOT grep -c, which would undercount a line with two
                                          hits and pad with a path:0 row per scanned file)
```

Of those 42, **21 are `rgba(0, 0, 0, ...)`** — plain black drop-shadows, a neutral design pattern
with no palette-colour identity concern (design depth/elevation, not a themed hue). The remaining
**21, across 12 files**, are genuine non-black colour-identity glows structurally identical in
kind to `SwarmTaskNode.tsx`'s violet — **wider than the todo's single named instance**:

`AgentAvatar.tsx` (4 — green/blue/yellow/red presence-status glows), `AlertRulesEngine.tsx`
(4 — red/orange/yellow/blue severity glows), `ConversationTimeline.tsx` (1 — orange),
`HeroStatsBar.tsx` (1 — orange), `ObsidianGraph.tsx` (1 — cyan-adjacent), `QueenNode.tsx`
(1 — amber), `SwarmTaskNode.tsx` (3 — 1 violet + 2 red, the todo's named site, both `failed` and
`verify_rejected` states share the same red glow), `ToolExecutionPanel.tsx` (2 — green/red),
`hr/AgentCard.tsx` (1 — amber), `hr/AgentDetailSheet.tsx` (1 — red), `Memory.tsx` (1 — indigo),
`hr/Roster.tsx` (1 — amber, plus a sibling `drop-shadow-[...rgba(...)]` in the same file — the
`drop-shadow-` filter form of the same gap, present in exactly one file, not separately counted
above).

The named site — `src/components/SwarmTaskNode.tsx:67,69,70`, verbatim:

```
verifying: "shadow-[0_4px_20px_rgba(139,92,246,0.25)]",  // violet — state identity color, exempt
failed: "shadow-[0_4px_15px_rgba(239,68,68,0.25)]",     // red — state identity color, exempt
verify_rejected: "shadow-[0_4px_15px_rgba(239,68,68,0.25)]", // red — state identity color, exempt
```

is representative, not exhaustive — it is the only one of the 21 colourful sites carrying an
explicit `// ... exempt` comment recording deliberate intent. The other 11 files' 18 colourful
glows carry no such comment; whether each is deliberate (a status-identity colour, matching this
repo's existing convention of using raw colour for non-token state semantics — e.g.
`AgentAvatar.tsx`'s green/red presence dots) or an oversight from before the token sweep existed
is **not adjudicated here** — doing so would be remediation, which D-08 places out of this plan's
scope. It is named as the residual population a future phase would need to triage.

## 3. Ratchet scope (D-17)

**No `text-*/NN` bucket is added to `src/tokenSweep.ratchet.test.ts`, and no fifth bucket for
shadow colour is added either.** Both are deliberate, for reasons already on record and restated
here:

1. A grep bucket guards the **spelling** of a class name, not the **property** (measured contrast)
   it produces. It would false-positive on a legitimate `text-foo/70` that measures above
   threshold — exactly why D-01 rejected banning the opacity-modifier idiom outright.
2. A grep bucket sails straight past a sub-AA pairing written with **no** opacity modifier at all.
   This phase found two such nodes live: `src/components/RunTimeline.tsx:81` measured at
   **2.68:1 (cyan) / 2.69:1 (emerald) / 4.48:1 (aubergine)** — all sub-AA except the near-miss
   aubergine reading, none using a `/NN` suffix a grep bucket could have caught (see plan
   `123-05-PLAN.md`).

The widened axe suite (47 routes × 4 themes) **is** the ratchet for this defect class: it measures
the actual rendered contrast, so it catches both the spelling-based and the spelling-free cases a
grep bucket cannot distinguish between.

**The residual gap D-17 itself names:** sites that never render during any scan cell are guarded
only by D-02's isolation-harness ledger (`e2e/.artifacts/`, hybrid pass 2), not by the axe suite,
which can only measure what actually paints to the DOM in a given run. A component behind a
feature flag, an empty-state branch, or a rarely-triggered timing window (as `RunTimeline.tsx`'s
own `showThinking` gate turned out to be, per `123-04-SUMMARY.md`'s reported residual) can sit
sub-AA indefinitely without the suite ever seeing it. This is not fixed here — closing it is
D-02's harness's job, not this plan's.

## 4. What a green suite does and does not prove

In the same spirit as `122-RATCHET-EXEMPTIONS.md`'s framing ("a record, not a blessing"):

- A green axe run proves the routes and themes it actually scanned, in the DOM states they
  actually rendered in, meet AA contrast. It does not prove every route, every theme, every DOM
  state does.
- A `grep`-bucket ratchet returning zero proves no *spelling* it knows to look for exists in the
  corpus it scanned. It does not prove no sub-AA *pairing* exists, spelled or not, in that corpus
  or outside it.
- This document's zero for the scan-root leak (§1, modulo the one named residual) proves the
  specific `scripts/`/`e2e/`/`docs/` sources are excluded. It does not prove no other non-`src/`
  directory could ever leak a class in the future — only that none currently does, measured today.
- None of the above proves the shadow-colour population (§2) is fully accounted for as
  deliberate-vs-oversight. It is counted, not adjudicated.

A record of these boundaries is what makes the phase's completeness claim honest — not a
guarantee that nothing here will ever need revisiting.
