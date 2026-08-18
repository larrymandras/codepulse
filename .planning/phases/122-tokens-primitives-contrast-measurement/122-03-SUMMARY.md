# Phase 122 Plan 03: Hue Law, `--astridr`, Forge Fill Pair, Motion Tokens Summary

Closes the token layer: the three-hue-owner law (`--status-ok` decoupled from `--primary` in
cyan/amber, emerald's measured hue-separated exception, `--astridr` created in all five themes,
an AA-clearing Forge `failed` fill pair), the motion tokens with real `@utility`-emitted CSS, and
`readable`'s blanket no-effects rule. Task 3 (the D-28 hard checkpoint) is **pending operator
verification** and has NOT been performed by this executor.

## What Was Built

**Task 1 -- the three-hue-owner law.** `--status-ok` decoupled from `--primary` in cyan and amber
(`#34d399`, matching readable/aubergine's already-compliant value); emerald's own `--primary`
is itself a green, so it receives a measured hue-separated exception (`#22d3ee`, verified 49.05deg
OKLCH hue separation and 10.82:1 contrast against `--surface-1`) rather than the shared value,
which would recreate the exact collision TOKEN-02 removes. `--astridr: #8b5cf6` added verbatim to
all five theme blocks (`--accent`/`--vault-node-color` left untouched -- different tokens,
different jobs). A `--status-error-fill`/`--status-error-on-fill` pair was added to all five
themes for the sub-AA Forge `failed` badge -- an opaque pair (`#7f1d1d`/`#ffffff`, 10.02:1),
deliberately not translucent like the old `bg-red-900/60`, so the ratio is fixed and
theme-independent rather than needing five separate alpha-composited tunings. This plan defines
the tokens only; `ForgeStatusBadge.tsx` itself is untouched (per the plan's file restriction) --
wiring the new pair into that component is 122-10's job.

**Task 2 -- motion tokens and readable's blanket rule.** `@theme` carries D-10's
`--duration-fast/normal/slow`/`--ease-house` block verbatim. Independently re-verified (against
this repo's real build, not just `122-RESEARCH.md`'s isolated compile test) that the plain
`@theme` block alone does not make `duration-normal`/`ease-house` compile to a usable utility
class -- Tailwind's content scanner only emits a class rule for a name it finds used in a
scanned file, and this plan is restricted to `src/index.css` only. Fixed with
`@source inline("duration-fast duration-normal duration-slow ease-house")`, Tailwind v4's
documented mechanism for forcing specific utility names to compile regardless of scanned-file
content -- confirmed present in the installed `tailwindcss@4.3.2` source. `index.css`'s own
animation/transition declarations were swept: sites whose duration was a house-timing
near-neighbour and/or whose easing already matched `--ease-house`'s curve were centralised on
the tokens; symmetric oscillations, a discrete blink, and two ambient rotation/bob loops kept
their authored timing with an inline comment explaining why `--ease-house`'s asymmetric curve
does not fit them. `readable`'s two enumerated CRT-scanline rules stay as they were (a display
rule, not motion); a new single blanket rule now suppresses `animation`/`transition-duration` on
every element and pseudo-element under `[data-theme="readable"]`.

**Measurement discipline.** All colour claims used a rasterised canvas round-trip
(`fillStyle` -> `fillRect` -> `getImageData`), never a `getComputedStyle` string scrape, per
`[[tailwind-v4-oklch-defeats-css-color-scraping]]`. Every measurement run carried a known-value
control (`#ffffff`/`#000000` round-tripping exactly) and a known-invalid control (a bogus colour
string leaving the sentinel in place). The Forge fill-pair measurement additionally ran the OLD
pairing through the same probe as a must-fail control, reproducing the same three-below/two-above
AA bucketing `120-DESIGN-REVIEW-HANDOFF.md` reports. The motion-utility proof used a positive
built-CSS check (`.duration-normal{`/`.ease-house{` present) paired with a discriminating
known-absent control (`.duration-nonsense-9x7q2{`), plus a live-DOM `getComputedStyle` check on
a real element (not just text presence in the compiled CSS) for both the utility mechanism and
`readable`'s suppression (a cyan-vs-readable contrast pair, since a rule that cannot fire is
indistinguishable from one never violated). Two throwaway Playwright + canvas scripts performed
the rasterised/DOM measurements, were run from the repo root, and were deleted before staging --
confirmed absent from both commits and the final `git status`.

## Deviations from Plan

**1. [Measurement discipline -- self-caught] `crt-scanline-bar` grep-count self-contamination.**
The plan's acceptance criterion requires `grep -cF 'crt-scanline-bar' src/index.css` to return 2.
My first draft of the D-11 blanket-rule's explanatory comment used the literal string
`crt-scanline-bar` to refer to the neighbouring display rule, which made the count read 3 -- not
because the display rule was touched, but because my own commentary matched the same grep. This
is the same class of defect as the 2026-08-18 lesson about self-inflicted grep contamination from
disclosure comments: reworded the comment to describe the rule without repeating its literal
selector text, re-verified the count returns exactly 2, rebuilt, and re-ran `tsc --noEmit` clean.
No functional change -- the display rule itself was never touched at any point.

**2. [Task 2c interpretation, disclosed not hidden] 520ms/600ms kept their authored duration.**
The plan's task text names 520ms (`.activity-entry-new`) and 600ms (`.live-update-flash`) only
as "a near neighbor that was clearly meant to be" a house timing, without a numeric tolerance.
Both are 60-90% larger than the nearest house value (320ms) -- judged NOT a near-neighbour, so
their durations were left authored and only their easing (`ease-out`, semantically identical to
what `--ease-house` centralises) was moved to the token, each with an inline comment naming the
reasoning. `.msg-turn`'s 340ms (6% off 320ms, and whose easing was already byte-identical to
`--ease-house`) WAS judged a clear near-neighbour and fully centralised. This is a judgement call
within the plan's own stated discretion, recorded rather than silently applied.

No other deviations. Both tasks executed as specified, including the mandatory D-10 `@utility`
correction and the positive-proof discipline the plan requires.

## Task 3 -- NOT Performed

Task 3 is a `checkpoint:human-verify` gated `blocking`. Per the checkpoint contract, this
executor did not perform it, self-approve it, or record a verdict for it. See the CHECKPOINT
REACHED report returned alongside this summary for the verbatim how-to-verify steps.

## Verification

- `npm run build` -> exit 0 (after Task 1, after Task 2, and after the Deviation-1 comment fix)
- `npx tsc --noEmit` -> exit 0
- `npx vitest run` -> **4772 passed | 0 failed** (338 files passed, 17 skipped, 197 todo) --
  identical to the pre-plan baseline recorded in `122-02-SUMMARY.md`, zero new failures
- Task 1 acceptance criteria: `--status-ok: #34d399` count = 4; emerald's `--status-ok` is
  `#22d3ee` (neither `#34d399` nor `#10b981`); `--astridr: #8b5cf6` count = 5;
  `--status-error-fill:`/`--status-error-on-fill:` counts = 5 each; all five Forge-pair ratios
  measured 10.020:1 (> 4.5); the old-pairing control reports below 4.5:1 on cyan/emerald/amber
- Task 2 acceptance criteria: built stylesheet contains `.duration-fast{`/`.duration-normal{`/
  `.duration-slow{`/`.ease-house{` (all PRESENT) and `--duration-normal` as an emitted custom
  property; `.duration-nonsense-9x7q2{` control is ABSENT; `@utility duration-fast`/`normal`/
  `slow` each count = 1; `--ease-house: cubic-bezier(0.22, 1, 0.36, 1)` count = 1; no live
  `transition-timing-function: cubic-bezier` outside comments; `crt-scanline-bar` count = 2
- `git show --stat HEAD` inspected immediately after each of the two commits: only
  `src/index.css` and `122-TOKEN-LAW.md`, nothing swept in from a concurrent session
- `.planning/STATE.md` / `.planning/ROADMAP.md`: `git status --short` for both is clean at the
  end of this run, and `git log -- .planning/STATE.md .planning/ROADMAP.md` shows no commit from
  this executor (most recent touches predate this session)
- Both throwaway measurement scripts (`measure-token-scratch.mjs`, `measure-dom-scratch.mjs`)
  confirmed deleted and absent from `git status` and from both commits

## Self-Check

- `src/index.css` -- FOUND, contains all Task 1 and Task 2 tokens/rules (verified above)
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-TOKEN-LAW.md` -- FOUND
- Commit `e35bf85f` (Task 1) -- FOUND in `git log --oneline`
- Commit `91f47f11` (Task 2, including the Deviation-1 comment fix) -- FOUND in `git log --oneline`

## Self-Check: PASSED

## Key Files

- `src/index.css` -- modified across both commits (+136/-9 total): hue-law decouple, `--astridr`,
  Forge fill pair (Task 1); motion tokens + `@utility` blocks + `@source inline(...)`, retimed
  animations, readable's blanket suppressor (Task 2)
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-TOKEN-LAW.md` -- new file,
  all measurements, controls, and per-theme records for both tasks

## Metrics

- Duration: this session
- Tasks: 2/2 auto tasks completed; 1 checkpoint task pending operator
- Commits: 2 (`e35bf85f`, `91f47f11`)
- Files touched: 2 (`src/index.css`, `122-TOKEN-LAW.md`)
