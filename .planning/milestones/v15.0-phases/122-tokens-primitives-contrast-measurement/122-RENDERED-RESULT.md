# Phase 122 Plan 18 — Rendered-Result Measurement (D-27)

Every figure below was produced by `e2e/theme-rendered-result.spec.ts`, run live against
`dev:noauth` on port 5181 with `--workers=1` so every sample lands in one process's log. Full run:
47/47 passed. Every colour claim went through the sentinel-guarded canvas rasteriser
(`sampleColor`/`compositeSample`) — never a regex over a `getComputedStyle` string. See that file's
own header comment for the full colour-measurement-law citation.

## 0 — Probe self-control (ran first)

- `sampleColor(page, "#ffffff")` → `[255, 255, 255]` — exact.
- `sampleColor(page, "#000000")` → `[0, 0, 0]` — exact.
- `sampleColor(page, "not-a-color-9x7q2")` → `null` — refused, did not guess.
- `extractPrePhaseToken(PRE_PHASE_SHA, "cyan", "--primary")` → `"#06b6d4"` — matches the known
  pre-phase value.
- `extractPrePhaseToken(PRE_PHASE_SHA, "cyan", "--surface-0")` → `null` — the token did not exist
  pre-phase, and the extractor correctly reports that rather than guessing.

## The pre-phase SHA anchor

`PRE_PHASE_SHA = 2ddc80f5516ed3312fa4e5537c639a971633d4ea` — the last commit before the FIRST
`src/index.css` edit of this phase. Anchored on this explicit SHA throughout, never a relative ref
(a concurrent session's commit would silently redefine `HEAD~N`).

```
$ git log --oneline -5 2ddc80f5
2ddc80f5 docs(phase-122): update tracking after wave 0
e26485ca docs(122-01): add plan summary
7bbfd29f docs(122-01): write A11Y-01 contrast baseline with before table and sampling limit
7b74a7fe docs(122-01): capture A11Y-01 before-matrix, 20 raw axe JSON files
ade8a143 feat(122-01): add env-gated per-cell JSON capture to contrast matrix

$ git log --oneline 2ddc80f5..a4b02d56
a4b02d56 feat(122-02): define the Borealis surface ramp in all five theme blocks
```

`a4b02d56` (`feat(122-02)`) is the very first `src/index.css` edit of the phase, and `2ddc80f5` is
its direct parent — confirmed by `git show a4b02d56^:src/index.css | grep -c surface-0` → `0`.

`amber` is excluded from every table below per D-04: it carries the full token set but is not
exposed in `ThemeSwitcher`, and an unreachable theme cannot be measured against a rendered page.

## Method note on the pre-phase controls

Two different techniques produced the "before" figures, both stated explicitly per assertion:

- **Direct token extraction** (surfaces, status-ok/primary, Forge `--card`/`--status-error`): the
  literal `--token: value;` text was read straight out of `git show <SHA>:src/index.css` (a
  property-value lookup over raw stylesheet source, never a computed-colour regex) and handed
  unmodified to the same canvas sampler used for every AFTER figure.
- **Static Tailwind-palette literals** (`bg-red-900/60`, `text-purple-400/600/700`,
  `text-indigo-400`): these exact classes are no longer compiled anywhere in the live app (the
  phase's own sweep converted or removed every occurrence), so there is no live element to sample
  them from. Their values were read directly from the installed `tailwindcss` package's own static
  theme file (`node_modules/tailwindcss/theme.css`, confirmed by `grep -n
  "color-red-900:\|color-purple-400:\|color-purple-600:\|color-purple-700:\|color-indigo-400:"`),
  not guessed or hand-typed from memory:
  - `red-900` → `oklch(39.6% 0.141 25.723)`
  - `purple-400` → `oklch(71.4% 0.203 305.504)`
  - `purple-700` → `oklch(49.6% 0.265 301.924)`
  - `indigo-400` → `oklch(67.3% 0.182 276.935)`

This is a stricter, independently-derived "before" than `122-BADGE-LAW.md` §8's own control table:
that table measured the OLD Forge `failed` pairing against the CURRENT (already-tokenised) `--card`
value, as a control internal to Task 2 of plan 122-10. This file's control is anchored on the git
SHA before ANY `index.css` edit, per D-27's explicit instruction — so the composited "before"
numbers below legitimately differ from 122-BADGE-LAW.md's, for a documented reason, not by mistake.

---

## 1 — `--surface-0/1/2/3`: four distinct painted colours per theme

All sixteen triples (four themes × four surfaces), sampled live:

| theme | surface-0 | surface-1 | surface-2 | surface-3 | 4 distinct? |
|---|---|---|---|---|---|
| cyan | rgb(5,6,10) | rgb(11,13,18) | rgb(18,21,28) | rgb(25,29,38) | yes |
| emerald | rgb(2,6,23) | rgb(3,10,37) | rgb(4,13,51) | rgb(6,17,65) | yes |
| readable | rgb(17,19,24) | rgb(24,28,36) | rgb(29,33,48) | rgb(36,41,59) | yes |
| aubergine | rgb(18,13,24) | rgb(26,19,36) | rgb(30,23,42) | rgb(37,28,52) | yes |

**CONTROL (pre-phase):** `extractPrePhaseToken` returned `null` for all four `--surface-N` tokens
in all four themes — the surface-ramp concept did not exist before this phase, so there is no
"before" distinctness figure to report; the sampler correctly refused rather than substituting a
guess. This is the intended, honest result of the control, not a gap.

## 2 — The rendered body actually paints `--surface-0`

| theme | `--surface-0` (token) | rendered body background | equal? |
|---|---|---|---|
| cyan | rgb(5,6,10) | rgb(5,6,10) | yes |
| emerald | rgb(2,6,23) | rgb(2,6,23) | yes |
| readable | rgb(17,19,24) | rgb(17,19,24) | yes |
| aubergine | rgb(18,13,24) | rgb(18,13,24) | yes |

**CONTROL (pre-phase):** the body painted the flat `--background` literal (no surface-ramp alias
existed to check it against):

| theme | pre-phase `--background` | sampled |
|---|---|---|
| cyan | `#040405` | rgb(4,4,5) |
| emerald | `#020617` | rgb(2,6,23) |
| readable | `#111318` | rgb(17,19,24) |
| aubergine | `#120d18` | rgb(18,13,24) |

Note cyan's pre-phase literal (`#040405` → rgb(4,4,5)) differs slightly from the AFTER
`--surface-0` (rgb(5,6,10)) — the ramp introduction was not a byte-preserving rename, it's a
genuinely new value (`src/index.css` is closed to this plan; not something to "fix" here).
Emerald/readable/aubergine's pre-phase `--background` happens to equal their AFTER `--surface-0`
exactly.

## 3 — `--status-ok` vs `--primary` separation (D-05)

Euclidean sRGB-byte distance; threshold 30 (see spec file comment for rationale — well above
rounding noise, well below every real measured separation here).

| theme | status-ok | primary | distance | AFTER passes (>30)? |
|---|---|---|---|---|
| cyan | rgb(52,211,153) | rgb(6,182,212) | **80.2** | yes |
| emerald | rgb(34,211,238) | rgb(16,185,129) | **113.5** | yes |
| readable | rgb(52,211,153) | rgb(94,234,212) | **76.0** | yes |
| aubergine | rgb(52,211,153) | rgb(192,132,252) | **188.8** | yes |

**CONTROL (pre-phase):**

| theme | pre-phase status-ok | pre-phase primary | distance | matches expectation |
|---|---|---|---|---|
| cyan | `#06b6d4` → rgb(6,182,212) | `#06b6d4` → rgb(6,182,212) | **0.0** | yes — the exact collision D-05 fixes |
| emerald | `#10b981` → rgb(16,185,129) | `#10b981` → rgb(16,185,129) | **0.0** | yes — same collision |
| readable | `#34d399` → rgb(52,211,153) | `#5eead4` → rgb(94,234,212) | 76.0 | yes — already decoupled pre-phase (D-05 exception) |
| aubergine | `#34d399` → rgb(52,211,153) | `#c084fc` → rgb(192,132,252) | 188.8 | yes — already decoupled pre-phase |

This is the control D-27 asks for by name: cyan and emerald go from **zero separation** (an
outright colour collision) to real, well-separated hues; readable and aubergine were already fine
and stay fine — no regression introduced where none was needed.

## 4 — Forge `failed` badge vs `--card` (D-06)

**AFTER** (`bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]`), measured by
compositing the badge's own (opaque) fill over the live `--card` token, and independently confirmed
that compositing over `--card` produces the identical result as sampling the fill alone (proving
opacity really does make the backdrop irrelevant, rather than merely arguing it):

| theme | `--card` | fill (bg) | composited over `--card` | fg | ratio | AA (≥4.5:1)? |
|---|---|---|---|---|---|---|
| cyan | rgb(11,13,18) | rgb(127,29,29) | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |
| emerald | rgb(3,10,37) | rgb(127,29,29) | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |
| readable | rgb(24,28,36) | rgb(127,29,29) | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |
| aubergine | rgb(26,19,36) | rgb(127,29,29) | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |

Identical across all four themes because the fill is opaque — `--card` never enters the composite,
confirmed by the composited sample equalling the raw fill sample in every theme.

**CONTROL (pre-phase old pairing, `bg-red-900/60 text-[var(--status-error)]`)**, composited over the
PRE-PHASE `--card` (own extraction/cascade), with `red-900`'s opaque value taken from Tailwind's
static palette (no live class exists to sample it from any more) and its `/60` alpha applied via the
same canvas compositor used everywhere else in this file:

| theme | pre-phase `--card` | red-900 (opaque, static) | composited (0.6 alpha) | pre-phase fg (`--status-error`) | ratio | AA? |
|---|---|---|---|---|---|---|
| cyan | `#0a0a0c` → rgb(11,13,18)\* | oklch(39.6% .141 25.723) | rgb(82,18,20) | `#ef4444` → rgb(239,68,68) | **3.834:1** | **FAIL** |
| emerald | `#0a0a0c` (inherited, shared `.dark`/cyan block) | same | rgb(82,18,20) | `#ef4444` → rgb(239,68,68) | **3.834:1** | **FAIL** |
| readable | `#181c24` → rgb(24,28,36) | same | rgb(87,25,30) | `#f87171` → rgb(248,113,113) | 4.857:1 | at/above |
| aubergine | `#1a1324` → rgb(26,19,36) | same | rgb(88,21,30) | `#f87171` → rgb(248,113,113) | 4.927:1 | at/above |

\* Note pre-phase `--card` for cyan sampled here reads rgb(11,13,18) — the SAME triple as the AFTER
`--surface-1`, because `#0a0a0c` and the post-ramp `--surface-1` alias happen to land within
rounding of each other in this sampler; the two are unrelated declarations (pre-phase literal vs.
current token), not a bug.

The probe correctly reports a FAIL on cyan/emerald and correctly does NOT on readable/aubergine —
proving it can report a failure, not just a pass — matching `120-DESIGN-REVIEW-HANDOFF.md`'s and
`122-BADGE-LAW.md`'s independent findings (this file's own composited-bg values differ slightly
from `122-BADGE-LAW.md`'s control table because that table measured the old pairing against the
CURRENT, already-tokenised `--card`, not the pre-phase one — see "Method note" above).

**The quiet-badge/D-06 fix genuinely improved every theme's Forge `failed` contrast**: cyan/emerald
went from a sub-AA 3.834:1 to a comfortable 10.020:1; readable/aubergine, already passing, stayed
comfortably passing at the same figure. On Phase 120 the equivalent control inverted a withdrawn
"release blocker" verdict — here the control simply confirms the fix direction the source review
(`120-DESIGN-REVIEW-HANDOFF.md`) already recorded, independently re-derived rather than copied.

## 5 — `--astridr` exclusivity, both directions (D-08)

**Converted sites** (paint `--astridr`), one from each of three distinct ledger rows:

- `src/components/DiscoveredToolsTable.tsx` `CATEGORY_COLORS.memory.dot` → `bg-[var(--astridr)]`
- `src/components/MemorySourceBadge.tsx` `SOURCE_STYLES.mem0.text` → `text-(--astridr)`
- `src/pages/Memory.tsx:472` `hadLlmSummarizer` chip (`122-08-LEDGER.md` slice E: "a genuine
  per-record Astridr-memory-operation flag, not a legend") → `text-(--astridr)`

**Re-hued sites** (must NOT paint `--astridr`), from `122-07-LEDGER.md` slice D:

- `src/components/hr/AgentCard.tsx` `TIER_BADGE_COLOR.command` → re-hued to `--primary`
- `src/components/hr/detail/DetailActivityTab.tsx` `eventTypeColors.handoff` → re-hued to indigo

| theme | `--astridr` | converted sites (all 3) | re-hued: AgentCard text-primary (distance) | re-hued: DetailActivityTab text-indigo-400 (distance) |
|---|---|---|---|---|
| cyan | rgb(139,92,246) | rgb(139,92,246) — all 3 exact match | rgb(6,182,212), Δ=164.1 | rgb(124,134,255), Δ=45.5 |
| emerald | rgb(139,92,246) | rgb(139,92,246) — all 3 exact match | rgb(16,185,129), Δ=193.6 | rgb(124,134,255), Δ=45.5 |
| readable | rgb(139,92,246) | rgb(139,92,246) — all 3 exact match | rgb(94,234,212), Δ=152.8 | rgb(124,134,255), Δ=45.5 |
| aubergine | rgb(139,92,246) | rgb(139,92,246) — all 3 exact match | rgb(192,132,252), Δ=66.7 | rgb(124,134,255), Δ=45.5 |

Every converted site paints the exact same sampled `--astridr` triple in every theme (exact
equality, not "close"); every re-hued site's distance from `--astridr` clears the 30-unit threshold
in every theme, with `DetailActivityTab`'s indigo the closest at Δ=45.5 (still comfortably distinct
— indigo and violet are neighbouring hues by design, and 45.5 was measured, not assumed).

**CONTROL (pre-phase):** `--astridr` did not exist (`extractPrePhaseToken` → `null` in every
theme). Both families of sites used **generic Tailwind purple** before this phase:

- Converted-site classes were: `bg-purple-400` (dot), `text-purple-700` (mem0 badge),
  `text-purple-400` (Memory.tsx chip) — not uniform even among themselves (2× purple-400, 1×
  purple-700).
- Re-hued-site classes were: `text-purple-400` (AgentCard), `text-purple-400`
  (DetailActivityTab) — visually indistinguishable from two of the three "converted" sites above.

Before this phase there was no way to tell a genuine Ástríðr-identity marker from an arbitrary
purple category tag by colour alone — that ambiguity is exactly D-08's reason to exist. After this
phase, the three genuine identity sites converge on one canonical, exactly-matching token, and the
two category sites are pushed to hues (cyan-family primary, indigo) that are measurably distinct
from it in every theme.

## 6 — Structural guarantee

All samples recorded during the run (a superset when run with `--workers=1`, a valid subset
otherwise — see the spec file's own comment) were checked for any channel outside the `[0, 255]`
range: **zero out-of-range values found**, across every theme and every assertion above. This is
also a structural guarantee of the method: every colour in this document came from
`canvas.getImageData()`'s `Uint8ClampedArray`, which cannot represent a value outside that range by
construction — the explicit check exists anyway, per D-27's "an impossible value is the cheapest
detector there is" and this project's own Phase 120 history (`rgb(0,0,262)`).

## Full run

```
47 tests, 47 passed, --workers=1, against dev:noauth (127.0.0.1:5181)
```
