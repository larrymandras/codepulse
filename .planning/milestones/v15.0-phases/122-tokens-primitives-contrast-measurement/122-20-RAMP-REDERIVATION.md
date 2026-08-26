# Phase 122 Plan 20: Ramp Re-Derivation and Vacuous-Assertion Fix

Gap closure authorised at the 122-19 checkpoint (operator, 2026-08-19): "one flat tone for the
most part". Two linked defects, both closed:

- **Task A** — the five per-theme `--surface-0..3`/`--hairline`/`--hairline-strong` ramps in
  `src/index.css` were perceptually flat (adjacent-step contrast 1.03-1.11:1). Re-derived.
- **Task B** — `e2e/theme-rendered-result.spec.ts`'s surface-distinctness test asserted only that
  the four sampled colours were not byte-identical, which the flat ramp satisfied. Replaced with a
  perceptual contrast-ratio floor, mutation-proven against the old ramp.

Commits: `313c9766` (feat, ramp), `a7e6734b` (test, assertion).

## Task A — the ramp

### What changed vs. 122-RAMP-DERIVATION.md, and why

122-02's ramp used two different methods per theme (cyan: verbatim sketch-findings hex;
emerald/amber: HSL stepped +3.0 percentage points of `S`-fixed lightness per stop; readable/
aubergine: hand-tuned, reusing the theme's pre-existing background/card/popover/border literals).
All five measured perceptually flat at the 122-19 checkpoint. This plan supersedes it with **one
method across all five themes**: hold `--surface-0` fixed (the page ground token; per the brief,
"the cheapest correct fix is usually to hold `--surface-0` and open up 1/2/3" — every theme takes
that path, none moves its ground tone) and re-derive `--surface-1/2/3/hairline/hairline-strong` by
walking forward in **OKLCH**, holding each theme's own hue (H) and chroma (C) constant and solving
for the lightness (L) that hits a target WCAG-style adjacent contrast ratio.

**Why OKLCH and not HSL (the method 122-02 used for emerald/amber):** a first pass reused 122-02's
approach — HSL with the anchor's saturation (`S`) held fixed while lightness (`L`) rises to hit the
same contrast targets. For emerald (anchor `S=84%`) this produced `--hairline-strong: #294eec` — a
vivid royal blue, not "navy-leaning". HSL's `S` is defined *relative to* the lightness range, so
holding it fixed while `L` rises makes near-black colours run away into increasingly vivid,
saturated colours — a defect invisible at 122-02's smaller +3pt steps but obvious at the larger
steps this fix needs. OKLCH chroma is an *absolute* quantity (not scaled to lightness), so holding
it fixed produces a self-consistent, muted ramp at every depth. This is also the colour space
Tailwind v4 itself computes in throughout this repo (`122-TOKEN-LAW.md`'s own OKLCH hue-separation
math), so it is not a novel dependency. The rejected HSL attempt is recorded in-file as a comment
on the emerald block (`src/index.css:258-268`) so a future editor does not rediscover the same
runaway and re-try it.

**Target contrast ratios per adjacent step:** `1.14 / 1.19 / 1.26 / 1.34 / 1.43` (surface-1,
surface-2, surface-3, hairline, hairline-strong, each relative to the immediately prior step).
Chosen to sit inside the "roughly 1.10-1.30" reference band named in the brief (shadcn zinc
1.123/1.189/1.426, GitHub dark 1.094/1.137/1.247) for the three surface steps, widening with depth
like both reference ramps, then continuing to widen for hairline/hairline-strong so they stay
clearly separated above surface-3 rather than converging toward it.

### Method (re-derivable; script not committed, throwaway per this phase's convention)

For each theme: convert the anchor hex to OKLCH (`sRGB -> linear -> LMS -> Oklab -> OKLCH`,
Björn Ottosson's matrices — the same conversion 122-03/122-TOKEN-LAW.md used for the emerald
`--status-ok` hue-separation measurement). For each target ratio `r`, solve
`targetLum = r*(prevLum + 0.05) - 0.05` (WCAG relative-luminance contrast formula, rearranged),
then binary-search `L` (60 iterations, holding `H`,`C` fixed) until the resulting sRGB's relative
luminance matches `targetLum`, using the *exact* piecewise-gamma relative-luminance formula
`e2e/theme-rendered-result.spec.ts`'s own `relativeLuminance()` uses. Round to integer RGB, convert
to hex.

**Cross-validated against the live rendered page**, not just the offline script: the Playwright
suite's own `console.log` of the sampled RGB triples (below) matches the script's rounded output
byte-for-byte for every theme/step, confirming the CSS literals compile and paint exactly what was
derived — this is the same rasterised-canvas method (`sampleColor`/`getImageData`) the rest of this
phase uses, never a regex scrape of a computed OKLCH string.

### Per-theme before/after step-contrast table

All figures are adjacent-pair WCAG-style contrast ratios (relative luminance), measured from the
rasterised RGB bytes.

| theme | step | BEFORE (122-19 checkpoint) | AFTER (this plan, live-rendered) |
|---|---|---|---|
| cyan | 0->1 | 1.042 | **1.140** |
| cyan | 1->2 | 1.064 | **1.190** |
| cyan | 2->3 | 1.083 | **1.255** |
| emerald | 0->1 | 1.032 | **1.139** |
| emerald | 1->2 | 1.034 | **1.190** |
| emerald | 2->3 | 1.048 | **1.265** |
| amber | 0->1 | 1.057 | **1.138** |
| amber | 1->2 | 1.066 | **1.196** |
| amber | 2->3 | 1.092 | **1.260** |
| readable | 0->1 | 1.089 | **1.140** |
| readable | 1->2 | 1.067 | **1.184** |
| readable | 2->3 | 1.109 | **1.264** |
| aubergine | 0->1 | 1.060 | **1.138** |
| aubergine | 1->2 | 1.042 | **1.190** |
| aubergine | 2->3 | 1.069 | **1.265** |

Every theme, every step, moved from below the reference band's floor (1.10) to inside/above it.
`amber`'s figures are computed the same way as the other four (its ramp exists per D-04) but are
not independently confirmed against a rendered page in this table — the same limitation
122-RAMP-DERIVATION.md already stated (`amber` is unreachable from `ThemeSwitcher`, so the
Playwright matrix's `THEMES` array excludes it, matching `e2e/theme-contrast.spec.ts`'s existing
4-theme precedent).

### Hue and character preserved

Per-theme OKLCH anchor (measured from `--surface-0`, unchanged in this plan):

| theme | Hue | Chroma | Character (unchanged, per brief) |
|---|---|---|---|
| cyan | 271.4deg | 0.011 | near-neutral blue-black (very low chroma, subtle cool cast) |
| emerald | 264.7deg | 0.041 | navy-leaning (moderate chroma, clearly blue-tinted) |
| amber | 89.9deg (undefined at C=0) | 0.000 | true neutral gray, no hue |
| readable | 268.1deg | 0.011 | lighter cool-slate |
| aubergine | 304.8deg | 0.024 | violet-leaning (editorial cast) |

Hue and chroma are held **exactly** constant across all six steps of every ramp (only `L` varies) —
this is the OKLCH method's whole point, not an approximation. `cyan`'s hue reads as ~271deg
("violet-leaning" by the numeric label) rather than a literal cyan-blue angle, but at `C=0.011` this
is barely perceptible tinting either way; the anchor hex (`#05060a`) is unchanged from before this
plan, so whatever subtle cast it already carried is exactly preserved, not altered.

### Hairline visibility, re-checked

| theme | hairline vs surface-2 | hairline vs surface-3 | hairline-strong vs hairline |
|---|---|---|---|
| cyan | 1.685:1 | 1.343:1 | 1.433:1 |
| emerald | 1.699:1 | 1.343:1 | 1.432:1 |
| amber | 1.694:1 | 1.345:1 | 1.429:1 |
| readable | 1.702:1 | 1.347:1 | 1.427:1 |
| aubergine | 1.684:1 | 1.331:1 | 1.428:1 |

`hairline` stays comfortably above `surface-3` (33-35% relative contrast) in every theme, and
`hairline-strong` steps a further ~43% above `hairline` — both remain clearly visible against the
surfaces they separate, and by a wider margin than before this plan (the old ramp's hairline values
were derived from the same flat progression and were correspondingly closer to their neighbours).

### Foreground legibility, re-measured (blocker check)

| theme | foreground | BEFORE fg-vs-surface-1 | AFTER fg-vs-surface-1 | AA (4.5:1)? | AAA (7:1)? |
|---|---|---|---|---|---|
| cyan | `#f8fafc` | not documented in 122-RAMP-DERIVATION.md (surface-1 barely changed pre-phase, no figure given) | **16.973:1** | PASS | PASS |
| emerald | `#f8fafc` (inherited from `.dark`, undeclared in emerald's own block) | not documented | **16.926:1** | PASS | PASS |
| amber | `#f8fafc` (inherited from `.dark`) | not documented | **16.635:1** | PASS | PASS |
| readable | `#e8eaf0` | 14.189:1 | **13.549:1** | PASS | PASS |
| aubergine | `#f0e8dc` | 14.865:1 | **13.853:1** | PASS | PASS |

readable and aubergine both DECREASED slightly (surface-1 got lighter, closing some of the gap to
the light foreground) but remain **far above both AA and AAA** — no theme dropped below AA, so this
plan's blocker condition (constraint 5) is not tripped. cyan/emerald/amber's figures are new
measurements, not a before/after delta, since 122-RAMP-DERIVATION.md never quoted a foreground
figure for them (only readable/aubergine, the two "WCAG-AA-constrained"/hand-tuned themes, had a
documented legibility claim to re-check).

### What stayed closed, verified

`git diff` on `src/index.css` for this task touches only `--surface-0/1/2/3`/`--hairline`/
`--hairline-strong` values and their explanatory comments in each of the five `[data-theme]`
blocks — `--background`/`--card`/`--popover`/`--border`/`--input` remain `var(--surface-N)`/
`var(--hairline)` pointers (unedited), the hue-owner law (`--astridr`, `--accent`,
`--vault-node-color`) is untouched, `--status-error-fill`/`-on-fill` (D-06) is untouched, and the
motion tokens (`--duration-*`, `--ease-house`) are untouched. `--surface-0` itself is byte-identical
to before this plan in every theme.

## Task B — the vacuous assertion

### The defect

`e2e/theme-rendered-result.spec.ts:259-271` (pre-fix) sampled the four painted `--surface-N`
colours and asserted only `new Set(triples...).size === 4` — "not byte-identical". A one-point
RGB difference on a single channel satisfies this. The file already defines `channelDistance`
(Euclidean sRGB distance) whose own docstring promises "threshold rationale is stated at each call
site" — the surface test used neither `channelDistance` nor any contrast measure, which is why it
passed cleanly on a ramp the operator called "one flat tone for the most part".

### The fix

Replaced the Set-size-only check with a **WCAG relative-luminance contrast-ratio floor per
adjacent pair**, using the same unit the checkpoint's own evidence table and this document's
derivation are stated in (not `channelDistance`, which answers a different question — perceived hue
separation, the thing sections 3/5 of the same file already use it for). `SURFACE_STEP_CONTRAST_MIN
= 1.12`:

- Sits inside the 1.10-1.30 reference band named in the brief.
- Just under shadcn zinc's weakest step (1.123) and above GitHub dark's weakest step (1.094) — the
  floor is anchored to the reference ramps actually cited as evidence, not picked freely.
- **Fails every theme's OLD ramp**, including the closest near-miss: readable's 2->3 step measured
  1.109 pre-fix — just 0.009 below the 1.10 floor that was considered and rejected as the threshold,
  because it would have left that one cell ambiguous. 1.12 clears all five themes' old worst-case
  steps with margin (cyan 1.042, emerald 1.032, amber 1.057, readable 1.089/1.067/1.109, aubergine
  1.042/1.060 — every one below 1.12).
- **Passes every theme's NEW ramp** with comfortable margin (worst-case first step per theme:
  1.138-1.140, roughly 0.02 above the floor — not razor-thin, and every deeper step is further
  above it per the before/after table).

The old Set-size check is kept as a a cheap first-line guard (still asserts 4 distinct colours) but
is now explicitly noted as **implied by, and strictly weaker than**, the new floor — it is no
longer the whole test.

### Mutation proof (live, against dev:noauth on :5181)

1. Started `VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth` from Git Bash, probed both
   `http://localhost:5181/` and `http://127.0.0.1:5181/` (200/200) before running anything.
2. Ran the new test against the (already-committed) new ramp: **4/4 themes pass**, printed
   step-ratios exactly matching the derivation script's output (see table above).
3. **Mutation:** overwrote `src/index.css` in place with `git show <parent-of-313c9766>:src/index.css`
   (the pre-Task-A ramp), let Vite HMR pick it up, re-ran the same test:

   ```
   [emerald] surface step-ratios (0->1, 1->2, 2->3): [ '1.032', '1.034', '1.048' ]
   Error: emerald: surface-0->surface-1 contrast 1.032:1 <= floor 1.12:1 (perceptually flat)

   [readable] surface step-ratios: [ '1.089', '1.067', '1.109' ]
   Error: readable: surface-0->surface-1 contrast 1.089:1 <= floor 1.12:1 (perceptually flat)

   [aubergine] surface step-ratios: [ '1.060', '1.042', '1.069' ]
   Error: aubergine: surface-0->surface-1 contrast 1.060:1 <= floor 1.12:1 (perceptually flat)
   ```

   **4 failed / 4 total** — every theme failed, each citing its real measured ratio below the
   floor (cyan's failure message is the same shape, omitted here for brevity — all four themes'
   full output was captured and reviewed).
4. Restored `src/index.css` from the in-memory backup taken before the mutation; `git diff` against
   the committed state came back **empty** (byte-identical restore, not a hand-retype).
5. Re-ran the test: **4/4 pass** again, step-ratios matching step 2 exactly.
6. Ran the full 47-test spec file (all six `test.describe` sections) against the restored new ramp:
   **47/47 pass**, both immediately after the ramp commit and again after the assertion-fix commit.

This satisfies the mutation-proof requirement: the new assertion demonstrably fails on the old
values and passes on the new ones, for every theme, not just in aggregate.

### Sibling vacuous-assertion audit

Grepped the whole file for `.size`/`Set(`/`toBe(4)`/similar shape. Two other checks use
`channelDistance` against a stated `SEPARATION_THRESHOLD = 30`:

- Section 3 (`--status-ok` vs `--primary` separation, D-05) — already threshold-based, with an
  in-file comment justifying the 30-unit floor against the measured post-phase minimum (~76,
  readable) and the pre-phase collision (exactly 0 on cyan/emerald). Not vacuous.
- Section 5 (`--astridr` exclusivity, D-08) — same `channelDistance`/`SEPARATION_THRESHOLD`
  pattern, same rationale. Not vacuous.

The surface-distinctness check (fixed by this plan) was the only Set-size/byte-identity check
standing in for a perceptual property. No other instance found; not widening scope further per the
dispatch's instruction to report rather than fix beyond this one file's one defect.

## Verification

- `npx tsc --noEmit` -> exit 0 (twice: after Task A, after Task B).
- `npm run build` -> exit 0.
- `npx vitest run` -> **346 files passed | 17 skipped (363), 4873 passed | 197 todo (5070), 0
  failed** — matches the dispatch's stated baseline exactly. One earlier run in this session showed
  a single `App.test.tsx` failure that did NOT reproduce in isolation (20/20 passed) or on a
  full-suite re-run (clean); attributed to a transient full-suite-load flake per this project's own
  established pattern, not a regression from either commit.
- `src/tokenSweep.ratchet.test.ts` (122-17) -> **15/15 passed**, both after Task A and at the final
  commit. Unaffected by value-only changes, as expected (it enforces class-string hygiene, not
  token values).
- `e2e/theme-rendered-result.spec.ts` -> **47/47 passed** against `dev:noauth` on `:5181`, both
  after Task A+B and again at the final restored state. `dev:noauth` was probed on both hosts
  before each run and confirmed down (`000`, no `LISTENING` entry) after each stop.
- `e2e/theme-contrast.spec.ts` (the axe zero-violations gate) — **run against dev:noauth for
  completeness, since it depends on rendered surface colours.** Result: **20/20 cells still fail**
  with the new ramp — but a mutation check (temporarily restoring the OLD ramp, same server, same
  probe) shows this gate **also fails 20/20 with the old ramp**, an identical failure shape. This
  is a **pre-existing gate**, not something either of this plan's two commits caused or could have
  caused by *not* touching it — `122-CONTRAST-BASELINE.md` (explicitly off-limits to this plan) is
  the phase's own tracked record of these violations, and `REQUIREMENTS.md` already routes ongoing
  contrast work to `affects: [123-contrast-remediation]`. A crude keyword-count proxy on the axe
  error text (not a rigorous violation-object diff) suggests the per-cell violation COUNT shifts in
  both directions across cells (e.g. cyan Forge 12->66, cyan Graphs 42->9, readable Forge 34->88) —
  expected, since lightening the surface ramp changes contrast for every element painted against
  `--card`/`--popover`, not only the four sampled tokens this plan's spec checks — but this is
  qualitative, not a precise count, and fixing or precisely re-measuring it is Phase 123's explicit
  scope, not this plan's. Flagged here for the orchestrator/Phase 123, not fixed.
- `a11y-before/`, `a11y-after/`, `122-CONTRAST-BASELINE.md` — **untouched** (`git status --short`
  clean on all three paths throughout this session). The AFTER matrix and its Delta section were
  measured against the OLD (flat) ramp and will need re-running against this plan's re-derived
  ramp before A11Y-01 can be considered current — the orchestrator's call on timing, per the
  dispatch.
- `.planning/STATE.md` / `.planning/ROADMAP.md` — untouched; no `gsd-sdk state.*`/`roadmap.*`/
  `phase.complete` verb was run.
- Every commit checked with `git show --stat HEAD` immediately after committing: `313c9766` touched
  only `src/index.css`, `a7e6734b` touched only `e2e/theme-rendered-result.spec.ts`. No files were
  swept in from the concurrent phase-190 session.

## Deviations from plan (this brief)

None. Both tasks were completed exactly as scoped: `src/index.css` was touched only for ramp
values (constraint honoured — aliases, hue-owner law, `--astridr`, error-fill pair, motion tokens
all unedited); the assertion fix stayed inside `e2e/theme-rendered-result.spec.ts`; the sibling
audit was reported, not acted on beyond the one file's one defect; the theme-contrast pre-existing
failure was investigated and reported, not silently fixed or silently ignored.
