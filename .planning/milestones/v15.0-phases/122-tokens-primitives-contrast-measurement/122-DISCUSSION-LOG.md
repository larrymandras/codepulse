# Phase 122: Tokens, Primitives & Contrast Measurement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `122-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-08-18
**Phase:** 122-tokens-primitives-contrast-measurement
**Areas discussed:** Surface tokens + sweep scope; Hue law + the sub-AA failed badge; Six-state
metric tile; A11Y-01 measurement; Motion token migration scope; PageHeader/EmptyState vs Phase 124;
Verification strategy for the sweep

**Area selection:** all seven presented gray areas were selected. Every question was answered with
the recommended option.

---

## Area selection & todo triage

| Option | Description | Selected |
|--------|-------------|----------|
| Use as input, don't fold | Keep the `/analytics` query-timeout fix out of scope; use the three live failing panels as the proving ground for TOKEN-04's `unavailable`/`error` states | ✓ |
| Fold into Phase 122 | Fix the four unbounded `.collect()` scans as part of this phase | |
| Defer entirely | Note in deferred ideas, no reference in 122 | |

**User's choice:** Use as input, don't fold.
**Notes:** `.planning/todos/pending/unbounded-analytics-scans-timeout.md` matched at 0.6; its
`trigger_when` names the next Analytics-touching phase. Left `pending`.

---

## Surface tokens + sweep scope

### Q1 — Relationship between the surface ramp and the existing shadcn semantic tokens

| Option | Description | Selected |
|--------|-------------|----------|
| Re-point shadcn at the ramp | Define `--surface-0/1/2/3` + `--hairline` per theme, alias `--background`/`--card`/`--popover`/`--border` to them; 547 existing sites and all 30 `ui/` primitives inherit unchanged | ✓ |
| Surfaces replace them outright | Delete the semantic tokens, migrate 547 call sites plus all 30 shadcn primitives to `bg-[var(--surface-N)]` | |
| Both coexist | Add the ramp alongside; adopt `--surface-*` only in new/touched code | |

**User's choice:** Re-point shadcn at the ramp (a code preview of the alias form was shown and
selected).
**Notes:** The rejected "replace outright" option was costed at 547 call sites + 30 `src/components/ui/`
files that hardcode `bg-popover`/`bg-card` internally. "Both coexist" was rejected as the exact
drift TOKEN-01 exists to end.

### Q2 — Sweep scope for the hardcoded surface sites

| Option | Description | Selected |
|--------|-------------|----------|
| Full sweep, all 335 | 310 raw palette classes + 25 hex literals across 9 files, all in 122 | ✓ |
| High-traffic subset + measured work-list | Shell/Dashboard/Analytics/Forge + primitives; file:line work-list for the rest (the D-17 pattern); TOKEN-01 closes Partial | |
| Token layer only | Ship the ramp and aliasing, sweep nothing | |

**User's choice:** Full sweep, all 335.
**Notes:** Rationale accepted — a partial sweep means touching the palette twice, the same argument
the roadmap uses to sequence 123 immediately after 122.

### Q3 — Deriving the other four themes' ramps

| Option | Description | Selected |
|--------|-------------|----------|
| Port cyan; hand-tune readable + aubergine | Cyan verbatim from the winning theme file; readable (WCAG) and aubergine (editorial) by hand; emerald + amber derived mechanically | ✓ |
| Derive all five mechanically | One fixed lightness step from each theme's existing `--background` | |
| Hand-tune all five | Every theme gets a designed ramp | |

**User's choice:** Port cyan; hand-tune readable + aubergine.
**Notes:** Mechanical derivation was rejected for readable/aubergine specifically because it would
flatten readable's AA tuning and erase aubergine's editorial intent.

### Q4 — `amber`'s status

| Option | Description | Selected |
|--------|-------------|----------|
| Tokens but unexposed | Full ramp/hue/motion tokens; stays out of `ThemeSwitcher` and out of the contrast matrix | ✓ |
| Retire amber | Delete `index.css:220-236`; TOKEN-01 becomes a 4-theme requirement | |
| Expose amber in the switcher | Make it a real fifth theme and grow the matrix to 5 × 5 | |

**User's choice:** Give it tokens, leave it unexposed.
**Notes:** Exposing it was flagged in the option text as a new user-facing capability, i.e. its own
scope.

---

## Hue law + the sub-AA failed badge

### Q1 — `--status-ok` value across themes

| Option | Description | Selected |
|--------|-------------|----------|
| `#34d399` everywhere except emerald | Four themes take the winning sea-green (two already have it); emerald gets a hue-separated value as a documented exception | ✓ |
| Single `#34d399` app-wide | One value in all five; emerald keeps a green-on-green collision | |
| Per-theme tuned in all five | Each theme's status-ok chosen against its own primary and surface | |

**User's choice:** `#34d399` everywhere except emerald.
**Notes:** The question was raised because measurement showed `--status-ok` equals `--primary` in
**three** themes (cyan/emerald/amber), not the one the requirement text cites — and because
emerald's `--primary` (`#10b981`) is itself a green, so a single sea-green value would re-create the
collision inside that theme.

### Q2 — The sub-AA Forge `failed` badge (3.92:1)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep filled, correct the pairing to AA | Choose a fill/foreground pair clearing 4.5:1 against `--card` in every theme, filled treatment retained | ✓ |
| Convert to high-contrast quiet | Drop the fill; strong border + high-contrast foreground | |
| Leave it; hand to Phase 123 | 122 sets the token, 123 remediates | |

**User's choice:** Keep filled, correct the pairing to AA.
**Notes:** Preserves "filled = needs attention" as the app's emphasis mechanism. The reviewer's own
observation — that the fill is what costs the contrast and thereby "weakens filled-equals-emphasised"
— was presented alongside the quiet alternative and not taken.

### Q3 — Shared `StatusBadge` primitive and emphasis re-keying

| Option | Description | Selected |
|--------|-------------|----------|
| Shared primitive + re-key to severity | Build the primitive D-16 deferred here; emphasis by operational severity with a separate grammar for execution modes | ✓ |
| Build the primitive, keep the legacy mapping | Centralise only, no visual change | |
| Neither | Leave badges as Phase 120 left them | |

**User's choice:** Shared primitive + re-key to severity.
**Notes:** Starts from `120-BADGE-INVENTORY.md`'s measured 22 + 3 work-list rather than re-deriving
it. The `strict → error` mis-mapping at `StatusBadge.tsx:47` is the concrete defect this closes.

### Q4 — The violet-is-Ástríðr-only clause

| Option | Description | Selected |
|--------|-------------|----------|
| Create the token + audit all 43 | Add `--astridr` to all five themes; adjudicate every one of the 43 violet/purple/fuchsia usages | ✓ |
| Token + obvious sites, work-list the rest | Convert clear Ástríðr surfaces, hand the ambiguous ones forward; TOKEN-02 closes Partial | |
| Token only, defer the sweep | Define `--astridr` so downstream phases have something to read | |

**User's choice:** Create the token + audit all 43.
**Notes:** Without the audit the token exists but the exclusivity law is unenforced, which is the
whole requirement.

---

## Six-state metric tile

### Q1 — Extend `MetricCard` or build a new primitive

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite `MetricCard` in place | Add the state contract, strip `glow-card`/`text-white`/hardcoded trend colours; 36 consumers inherit with no import churn | ✓ |
| New `MetricTile`, migrate all 36, delete `MetricCard` | Same end state, clearer diff, 36 import edits and a two-primitive window | |
| New `MetricTile`, migrate a named subset | Ship on Dashboard/Analytics/Forge only | |

**User's choice:** Rewrite `MetricCard` in place.

### Q2 — Where the six states come from at runtime

| Option | Description | Selected |
|--------|-------------|----------|
| Caller passes `state`; tile is pure presentation | Plus a `useMetricState(value, {staleAfter, unavailable})` helper for the common Convex derivation; `staleAfter` a per-tile prop over a shared default | ✓ |
| Tile infers from value + timestamp props | Less boilerplate; cannot distinguish `unavailable` from `error` | |
| Tile subscribes to the query itself | Least call-site code; couples a presentation primitive to Convex | |

**User's choice:** Caller passes `state`; tile is pure presentation.
**Notes:** The distinguishing argument was that `useQuery`'s `undefined`/throw pair structurally
cannot separate "no emitter exists" from "the query failed" — and "no emitter exists" is exactly the
honesty case POLISH-04 was about.

### Q3 — TOKEN-04's reach

| Option | Description | Selected |
|--------|-------------|----------|
| All 36 + all 58/27 | Every MetricCard site plus all 58 bare `>Loading` sites and 27 em-dash placeholders | ✓ |
| All 36, work-list the rest | Convert MetricCard consumers; file:line inventory for the rest; TOKEN-04 closes Partial | |
| Named surfaces only | Dashboard/Analytics/Forge | |

**User's choice:** All 36 + all 58/27.
**Notes:** The option text named this as the largest single work item in the phase before it was
selected; that sizing fed directly into the sequencing question later.

### Q4 — Signal for `VitalsRail.tsx:253`'s fabricated Convex dot

| Option | Description | Selected |
|--------|-------------|----------|
| `useConvex().connectionState()` | The client's own live WebSocket state; mirrors the working Ástríðr dot two lines above; no backend change | ✓ |
| Add a `convex` key to `integrations` healthStatus | Consistent with its siblings on that page | |
| Reuse page-level query staleness | No new dependency; conflates a slow query with a dead connection | |

**User's choice:** `useConvex().connectionState()`.
**Notes:** The healthStatus option was presented with its own disqualifier — a query answering "is
Convex up?" only runs if Convex is up, so it can never report the failure it exists to report.

---

## A11Y-01 measurement

### Q1 — When the measurement runs

| Option | Description | Selected |
|--------|-------------|----------|
| Both — before and after the token work | Baseline on Phase 120's clean surface, re-measure post-token, record the delta | ✓ |
| After only | One number, the only one 123 consumes | |
| Before only | Literal compliance with "task 1"; 123 sizes against an invalidated matrix | |

**User's choice:** Both.
**Notes:** The before-run's role as a *control* was the deciding argument — without it, a token
rewrite that worsened contrast is indistinguishable from one that fixed it, which is what the
withdrawn Phase 120 measurement turned on.

### Q2 — Instrument

| Option | Description | Selected |
|--------|-------------|----------|
| axe as the population measure + rasterised probe for named pairs | Existing spec against `dev:noauth` for per-cell JSON; canvas probe only for Forge `failed` and the status-ok decouple, measured against `--card` | ✓ |
| axe only | One instrument; reports violations not ratios, so the named-pair questions stay unanswered | |
| Bespoke rasterised probe only | Full control; re-opens the failure mode the Phase 120 correction closed | |

**User's choice:** axe + rasterised probe for named pairs.

### Q3 — Artifact Phase 123 consumes

| Option | Description | Selected |
|--------|-------------|----------|
| Committed markdown + raw JSON | Per-cell counts, before/after delta, named-pair ratios, plus raw axe violation JSON | ✓ |
| Counts table only | Compact; forces 123 to re-run the matrix to learn which elements fail | |
| Raw JSON only | Nothing paraphrased; nothing reviewable at a glance | |

**User's choice:** Committed markdown + raw JSON.

### Q4 — Matrix population

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the 5, log the sampling limit explicitly | Measure the locked 4 × 5; state in the artifact, in 122's verification and in 123's scope which routes were NOT measured | ✓ |
| Extend to the missing route archetypes | Add a form-heavy and a dense-table route; changes a locked requirement's matrix | |
| Full route sweep | Every reachable route × 4 themes | |

**User's choice:** Keep the 5, log the sampling limit explicitly.
**Notes:** The concern surfaced was that Phase 123 passes when "every cell A11Y-01 measured" is
clean, so an unmeasured route can be broken while 123 reports green. Recorded as a deferred idea so
the limit is a known choice rather than an oversight.

---

## Motion token migration scope

### Q1 — What migrates

| Option | Description | Selected |
|--------|-------------|----------|
| All timing + easing centralised | All 70 `duration-NNN`, all 12 `@keyframes`, and the 9 motion/react files read the tokens | ✓ |
| House-style transitions only | Leave `animate-spin`, skeleton pulse and Radix animate-in/out at library defaults | |
| Define tokens, adopt in new code only | | |

**User's choice:** All timing + easing centralised.
**Notes:** `MetricCard`'s `useSpring({ duration: 400 })` was cited as one of the 9 motion/react
literals in scope. Phase 125's Signal Horizon inheriting the house easing was the forward argument.

### Q2 — How tokens reach components

| Option | Description | Selected |
|--------|-------------|----------|
| Register in `@theme`, use generated utilities | `--duration-fast/normal/slow` + `--ease-house`; call sites read `duration-normal ease-house`; `grep -rE 'duration-[0-9]'` becomes a clean ratchet | ✓ |
| Arbitrary values at each site | `duration-[var(--dur-2)]` at 70+ sites; no lintable pattern | |
| CSS-only via layered rules | Centralised by construction; splits styling across two places | |

**User's choice:** Register in `@theme` (a code preview of both the token block and the resulting
ratchet command was shown and selected).

### Q3 — Enforcing `readable`'s no-effects guarantee

| Option | Description | Selected |
|--------|-------------|----------|
| One global suppression rule + a test | Blanket `animation: none` / `transition-duration: 0ms` under `[data-theme="readable"]`, plus a Playwright assertion | ✓ |
| Keep enumerating per effect | As today (only 2 such rules exist); blind to the next animation added | |
| React-level effects gate | Leaves pure-CSS animations and the 12 `@keyframes` unguarded | |

**User's choice:** One global suppression rule + a test.

### Q4 — Re-verifying Phase 120's D-11 gating

| Option | Description | Selected |
|--------|-------------|----------|
| Re-verify by measurement | Population assertion that no element reports non-zero animation/transition duration under reduced motion, paired with a control | ✓ |
| Trust D-11, gate only new animations | | |
| Re-verify by code review / grep | Fragile on CSS; cannot see runtime-composed classes | |

**User's choice:** Re-verify by measurement.

---

## PageHeader/EmptyState vs Phase 124

> **Correction made during this area:** an earlier figure in the discussion said `PageHeader` was
> used by "44 of 62" page files. That mixed the 20 `.test.tsx` files into both numerator and
> denominator. Re-derived excluding tests: **38 of 42** source pages, with 4 non-adopters
> (`Analytics.tsx`, `BuildProgress.tsx`, `Chat.tsx`, `ForgePage.tsx`) plus 5 unmeasured
> subdirectory files. The corrected figure is what the options below were built on.

### Q1 — PageHeader's role vs Phase 124's shell

| Option | Description | Selected |
|--------|-------------|----------|
| Page-level contract; 124 owns app chrome | PageHeader grows title + eyebrow + subtitle + actions; 124's 3-zone bar sits above it | ✓ |
| Build the full 3-zone contract now | Front-loads 124; 124 inherits a header shaped before its own discussion | |
| Adoption only, no contract change | TOKEN-05 would then mean only "everyone imports the same file" | |

**User's choice:** Page-level contract; 124 owns app chrome.

### Q2 — The 4 non-adopting pages

| Option | Description | Selected |
|--------|-------------|----------|
| Convert all, record documented exemptions | Convert every page with a header; record deliberate header-less surfaces (likely `Chat`) as named exemptions with reasons; also sweep the 5 subdirectory files | ✓ |
| Convert all 4, no exemptions | Puts a title bar on a surface designed without one | |
| Convert the 3 dashboard-shaped pages | Leaves the requirement's "every" quietly untrue | |

**User's choice:** Convert all, record documented exemptions.

### Q3 — Shared vocabulary between `EmptyState` and the tile

| Option | Description | Selected |
|--------|-------------|----------|
| One shared state module feeds both | Single module defines the six states, copy, icon and tone; tile renders at tile scale, EmptyState at panel/page scale | ✓ |
| Independent primitives | Same condition gets two different words on two surfaces of one page | |
| `EmptyState` is the tile at panel size | Forces prose and CTAs into a metric-shaped layout | |

**User's choice:** One shared state module feeds both.
**Notes:** The `/analytics` timeout todo was cited as the immediate case — one page will show
`unavailable` at both tile and panel scale simultaneously.

### Q4 — Copy ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Centralised defaults, per-site override | Default string per state, override permitted where genuine context exists | ✓ |
| Centralised only, no overrides | Loses specifics like "no runs in the last 24h" | |
| Per-site copy against a tone guide | 26 strings' worth of drift potential | |

**User's choice:** Centralised defaults, per-site override.

---

## Verification strategy for the sweep

### Q1 — What proves the token law holds

| Option | Description | Selected |
|--------|-------------|----------|
| Corpus-derived ratchet, committed as a test | Derives its population from `git grep -lF` over all of `src/` every run; fails on anything not in a frozen `KNOWN_EXEMPT` record | ✓ |
| Vitest assertions on known-clean files | Can only ratify the last fix | |
| Reviewer inventory in the phase artifact | Honest for this phase; nothing stops regression afterwards | |

**User's choice:** Corpus-derived ratchet.
**Notes:** The deciding precedent was Phase 120's third `animate-pulse` site, missed because it
appeared in no triage document.

### Q2 — Proving the ratchet works

| Option | Description | Selected |
|--------|-------------|----------|
| Two mutations — known site AND synthetic new one | Second mutation must fail the ratchet where an enumerated test would pass; both syntactically valid | ✓ |
| Single mutation on a known site | Proves the matcher runs, nothing about coverage | |
| No mutation test | | |

**User's choice:** Two mutations.

### Q3 — Proving the rendered result

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright token-resolution + rasterised assertions | Four distinct surface values, body paints `--surface-0`, status-ok/primary separation, `--astridr` confined to Ástríðr surfaces — all by pixel sampling, each with a git before/after control | ✓ |
| Playwright screenshot baselines | Catches layout too; 25 baselines that go stale on every intentional change in 124/125 | |
| Manual UAT against the sketch mockup | The judgement that ultimately matters; produces no re-runnable evidence | |

**User's choice:** Playwright token-resolution + rasterised assertions.

### Q4 — Execution sequencing given the phase's size

| Option | Description | Selected |
|--------|-------------|----------|
| One phase, waved, checkpoint after the token layer | Wave 1 = token layer alone; then parallel sweeps; then primitives; then measurement + ratchet | ✓ |
| Split into two phases via `/gsd-phase` | 122a = tokens + measurements + ratchet, 122b = primitives; a roadmap change requiring 123/124/125 dependency re-pointing | |
| One phase, single wave | No internal checkpoint | |

**User's choice:** One phase, waved, with a checkpoint after the token layer.
**Notes:** The question was asked with the full scope tallied honestly — 335 surface sites, ~187
motion sites, 36 + 58 + 27 state sites, 22 + 3 badge sites, 43 violet sites, a rewritten primitive, a
new state module, two contrast measurements and a ratchet. The split option was presented as viable
but carrying a roadmap change.

---

## Claude's Discretion

Recorded in `122-CONTEXT.md` §Claude's Discretion. Nothing was answered with "you decide" — every
question received an explicit selection. The discretion items are parameters the decisions leave
open by design:

- Exact hex values for the derived `emerald`/`amber` ramps and emerald's hue-separated `--status-ok`.
- The exact fill/foreground pair chosen for Forge `failed`.
- The shared state module's location, export shape, and default `staleAfter` constant.
- `HeroStatsBar.tsx` ~127's dead runtime-interpolated Tailwind class (a dead style, not a
  fabrication — `120-FABRICATION-INVENTORY.md` row 2).
- Whether the ratchet runs as a Vitest test or a standalone script invoked by one.

## Deferred Ideas

- Exposing `amber` in `ThemeSwitcher` (would also require growing the contrast matrix to 5 × 5).
- Extending the contrast matrix beyond the locked 5 pages to cover form-heavy and dense-table route
  archetypes.
- Extending `e2e/polish-geometry.spec.ts`'s body-wide overflow assertion to 360/640px — **owner is
  Phase 124**.
- Ástríðr's serif voice (SIGNAL-03) — a single-surface trial in a later phase; D-17's eyebrow/type
  work must not pre-empt it.
- Three gray areas offered at the close and declined: the type/eyebrow law as an explicit
  requirement, the ratchet's Vitest-vs-script form, and the 5 unmeasured `src/pages/` subdirectory
  files. The latter two are folded into discretion and D-18 respectively.
