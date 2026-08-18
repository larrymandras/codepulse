# Phase 122: Tokens, Primitives & Contrast Measurement - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the **shared token layer** (surface / hue / motion) and the **shared
primitives** (metric tile, `StatusBadge`, `PageHeader`, `EmptyState`, state module) that 200+
components inherit from — plus the **measured true size of the contrast problem** across the
theme × page matrix, which Phase 123 then remediates against.

Requirements owned: **TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05, A11Y-01**.

**No new surface is built here.** The 3-zone app header and the 4-domain sidebar are Phase 124
(SHELL-01/02); the Signal Horizon and the Pulse ECG hero are Phase 125 (SIGNAL-01/02). This phase
changes what existing surfaces *read from*, and finishes the primitives Phase 120's D-16 and D-17
deliberately deferred to it.

**The design law is closed to re-litigation** (`REQUIREMENTS.md:16-18`). Borealis blend, the
three-hue-owner law, `--dur-1/2/3` = 120/200/320ms with `cubic-bezier(0.22,1,0.36,1)`, quiet
badges, and `readable` staying effect-free are all *inputs*, not open questions.

</domain>

<decisions>
## Implementation Decisions

### Surface tokens & the sweep (TOKEN-01)

- **D-01: The surface ramp is the source; the shadcn tokens become aliases of it.** Each theme
  defines `--surface-0/1/2/3` + `--hairline` (+ `--hairline-strong`), then re-points the existing
  semantic tokens at them:

  ```css
  --background: var(--surface-0);
  --card:       var(--surface-1);
  --popover:    var(--surface-2);
  --border:     var(--hairline);
  ```

  Rejected: deleting `--card`/`--popover`/`--background` and migrating all 547 `bg-card`/
  `bg-background`/`bg-popover`/`bg-muted` call sites to `bg-[var(--surface-N)]` — it would also
  require editing all 30 primitives in `src/components/ui/`, which hardcode `bg-popover`/`bg-card`
  internally, and buys nothing the alias doesn't. Also rejected: letting both vocabularies coexist
  with `--surface-*` used only in new code — that is precisely the drift TOKEN-01 exists to end.

- **D-02: Full hardcoded-surface sweep in 122 — all 335 sites.** Measured 2026-08-18 across
  `src/**/*.tsx`: **310** raw palette classes matching `bg-(slate|zinc|gray|neutral|stone)-NNN`
  and **25** `bg-`/`border-`/`text-[#hex]` literals across **9 files**. TOKEN-01's criterion is
  literally "every surface"; a partial sweep means touching the palette twice, which is the same
  argument the roadmap uses to sequence 123 immediately after 122. *(Both figures are counts of
  matched occurrences via `grep -rEo … | wc -l`, not matched lines and not files — re-derive
  before quoting.)*

- **D-03: Ramp derivation is per-theme, effort where the constraint is.** `cyan` takes the winning
  ramp verbatim from `sources/themes/default.css` (`#05060a` / `#0b0d12` / `#12151c` / `#191d26`,
  hairline `#1c2029`). `readable` (WCAG-AA constrained) and `aubergine` (editorial) are **hand-tuned**
  against measured contrast — a mechanical lightness step would flatten `readable`'s AA tuning and
  erase `aubergine`'s deliberate palette. `emerald` and `amber` are **derived mechanically** from
  their existing `--background`/`--card`.

- **D-04: `amber` gets full tokens but stays unexposed.** It is defined at `src/index.css:220` and
  is NOT in `ThemeSwitcher`, and `e2e/theme-contrast.spec.ts` tests only 4 themes. It receives the
  surface ramp, the hue decouple and the motion tokens so TOKEN-01's "all 5 themes" is literally
  true and the block never rots — but it is **not** added to the switcher and **not** added to the
  contrast matrix (an unreachable theme cannot be measured against a rendered page). Rejected:
  deleting the block; rejected: exposing it (a new user-facing capability, out of scope).

### Hue law (TOKEN-02)

- **D-05: `--status-ok` is `#34d399` in four themes; `emerald` is a documented exception.**
  Measured 2026-08-18 — `--status-ok` is **identical to `--primary` in three themes**, not one:
  `cyan` (`:142`/`:171`, both `#06b6d4`), `emerald` (`:198`/`:205`, both `#10b981`), `amber`
  (`:220`/`:227`, both `#f59e0b`). It is already decoupled in `readable` (`#5eead4` vs `#34d399`)
  and `aubergine` (`#c084fc` vs `#34d399`). So only **cyan and amber actually change** to `#34d399`.
  `emerald`'s own `--primary` is a green, so sea-green there would re-create the exact collision
  TOKEN-02 removes — it gets a **hue-separated** `--status-ok`, recorded as a deliberate per-theme
  exception. The law is about perceptible separation, not about one literal hex.

  > **Correction to `REQUIREMENTS.md:44`** (Stale Docs rule): it cites `index.css:139/165` as the
  > collision site. Those line numbers are stale — `:139` is `--card-foreground` and `:165` holds
  > no status token. The live sites are the three pairs listed above. Fix the requirement text
  > during planning.

- **D-06: Forge `failed` keeps the fill; the pairing is corrected to AA.** It measures **3.92:1**
  on the dark themes (5.33:1 on readable/aubergine), its class string
  `bg-red-900/60 text-[var(--status-error)]` is byte-identical before and after Phase 120 (i.e.
  pre-existing, not a regression), and the fill is what costs the contrast. Choose a fill/foreground
  pair clearing **4.5:1 measured against `--card`, not the page background** (per
  `120-DESIGN-REVIEW-HANDOFF.md`), in every theme. Rationale: keeping the fill preserves
  "filled = needs attention" as the app's only emphasis mechanism, and fixing it in the token layer
  is cheaper than making Phase 123 revisit the palette.

- **D-07: Build the shared `StatusBadge` primitive AND re-key emphasis to operational severity.**
  D-16 (Phase 120) explicitly deferred this primitive to 122. Emphasis is currently keyed to the
  legacy semantic bucket — `StatusBadge.tsx:47` maps the execution **mode** `strict` to the `error`
  semantic, so a mode renders like a failure, while `auth_failed` (operator-actionable) renders
  quiet. New law, per the handoff's carried item 2:

  | tier | states |
  |---|---|
  | **Strong** (filled) | failed, authentication failure, regression, rejected verification, stalled |
  | **Quiet but unmistakable** | running, queued, stopping |
  | **Quietest** | succeeded, completed, inactive administrative states |
  | **Separate visual grammar** | execution modes — strict / adaptive / standard |

  Start from `120-BADGE-INVENTORY.md`'s measured work-list (**22** `StatusBadge` consumer files —
  re-derived there, not the 19 originally claimed — plus 3 Forge files / 5 render sites). Do not
  re-derive it as a discovery task; DO re-check it against live code before acting, since it is a
  claim recorded a day earlier.

- **D-08: Create `--astridr` and adjudicate all 43 violet sites.** Measured 2026-08-18: **no
  `--astridr` token exists anywhere in `src/`**, and there are **43** raw
  `(bg|text|border)-(violet|purple|fuchsia)-NNN` usages in `src/**/*.tsx`. Add `--astridr`
  (`#8b5cf6` per the winning theme file) to all five themes, then decide each of the 43: Ástríðr-owned
  surfaces convert to `var(--astridr)`; everything else is re-hued to `--primary`, a `--status-*`
  token, or a neutral. Without the audit the token exists but the exclusivity law is unenforced,
  which is the entire requirement.

### Motion (TOKEN-03)

- **D-09: All timing and easing centralise on the tokens.** Measured 2026-08-18: **187** `animate-*`
  usages (101 `pulse`, 49 `spin`, 13 `animate-in`, 11 `animate-out`, 9 `scanline`, 2 `ping`,
  2 accordion), **70** `duration-NNN` classes, **12** `@keyframes` in `src/index.css`, **9** files
  importing `motion/react` — and **zero** `--dur-*` / `--ease-*` custom properties exist today.
  Every `duration-NNN` maps to a token, all 12 `@keyframes` take duration and easing from tokens,
  and the 9 motion/react files read the same values rather than their own literals (`MetricCard`'s
  `useSpring({ duration: 400 })` is one of them). Phase 125's Signal Horizon then inherits the house
  easing instead of reinventing it.

- **D-10: Tokens are registered in `@theme` and consumed as generated utilities.**
  `src/index.css` already has `@theme` blocks at `:12` and `:17`. Declare:

  ```css
  @theme {
    --duration-fast:   120ms;
    --duration-normal: 200ms;
    --duration-slow:   320ms;
    --ease-house: cubic-bezier(0.22, 1, 0.36, 1);
  }
  ```

  Call sites stay idiomatic (`duration-normal ease-house`), the token is the single source, and
  `grep -rE 'duration-[0-9]' src/ → 0` becomes a clean ratchet signal. Rejected: arbitrary values
  (`duration-[var(--dur-2)]`) at 70+ sites — noisy and produces no lintable pattern.

- **D-11: `readable`'s no-effects guarantee becomes one blanket rule + a test.** Today it rests on
  just **2** `[data-theme="readable"]` rules — i.e. it is enumerated per effect, so a new animation
  is effect-free only if someone remembers. Replace with a single suppression rule zeroing
  `animation` and `transition-duration` on all elements and pseudo-elements under
  `[data-theme="readable"]`, plus a Playwright assertion in `e2e/theme-reduced-motion.spec.ts`.
  New animations are then suppressed by default rather than by memory.

- **D-12: Phase 120's D-11 gating is re-verified by measurement, not trusted.** Extend
  `e2e/theme-reduced-motion.spec.ts` to assert that under `prefers-reduced-motion` **no** element
  reports a non-zero animation or transition duration — a population check, not a per-effect list.
  **Pair it with a control** (the same page without the media override must show motion) so a green
  cannot mean "the probe measured nothing". A token rewrite is exactly the change that silently
  invalidates a prior verification.

### Six-state metric tile & state honesty (TOKEN-04)

- **D-13: Rewrite `MetricCard.tsx` in place; do not build a parallel `MetricTile`.** It is already
  imported by **36 files**, so all consumers inherit the six-state contract with no import churn and
  there is never a window where two metric primitives coexist. The rewrite also strips its
  `glow-card` class, its hardcoded `text-white`, its hardcoded `text-emerald-500`/`text-red-500`
  trend colours and its two inline `rgba()` box-shadows as part of the same token sweep. Existing
  props stay source-compatible with `state` added.

- **D-14: The caller declares `state`; the tile is pure presentation.** It never infers. Convex
  `useQuery` returns `undefined` while loading and throws on failure (caught by
  `SectionErrorBoundary`), which structurally cannot distinguish `unavailable` ("no emitter exists
  behind this metric") from `error` ("the query failed") — and says nothing about `stale`. Ship a
  `useMetricState(value, { staleAfter, unavailable })` helper that derives the common Convex case
  (`undefined` → loading, empty result → empty, timestamp age → stale) so the boilerplate lives in
  one place. `staleAfter` is a **per-tile prop over a shared default constant**. The primitive stays
  trivially unit-testable across all six states.

- **D-15: Reach is all 36 MetricCard sites PLUS all 58 bare `Loading` sites and all 27 em-dash
  placeholders.** Measured 2026-08-18 across `src/**/*.tsx`: **58** occurrences of `>Loading` and
  **27** em-dash placeholder expressions, most of them not `MetricCard` at all. Each becomes an
  honest state — the tile, `EmptyState`, or a skeleton shaped like the content it replaces. **This
  is the single largest work item in the phase** and should be waved accordingly.

- **D-16: `VitalsRail.tsx:253`'s Convex dot binds to `useConvex().connectionState()`.** Carried
  from `120-FABRICATION-INVENTORY.md` (assigned to this phase). It currently renders
  `<span className="w-2 h-2 rounded-full bg-green-500" />` labelled "Convex" **unconditionally**,
  asserting health with nothing behind it — while its own sibling two lines above correctly binds
  Ástríðr's dot to `disconnected`. The client's live WebSocket state is the only signal that
  actually answers "is Convex reachable right now", needs no backend change, and mirrors the working
  sibling. Rejected: adding a `convex` key to `convex/integrations.ts healthStatus` — a query that
  answers "is Convex up?" only runs if Convex is up, so it can never report the failure it exists to
  report.

### PageHeader, EmptyState & the state vocabulary (TOKEN-05)

- **D-17: `PageHeader` is the PAGE layer; Phase 124 owns APP chrome.** It grows only what a page
  needs — title, optional 11px mono uppercase eyebrow, optional subtitle, actions slot — all reading
  the new surface/hairline/type tokens. Phase 124's 48px 3-zone bar (breadcrumb / command bar /
  system chip + E-Stop + overflow) sits **above** it as app chrome. Two distinct layers, no overlap,
  neither phase redoes the other's work. Rejected: building the 3-zone contract now — breadcrumb,
  command bar and E-Stop are app-level concerns, and 124 would inherit a header shaped before its
  own discussion.

- **D-18: Complete adoption with NAMED exemptions.** Re-derived 2026-08-18 excluding test files:
  **38 of 42** source pages in `src/pages/` use `PageHeader`; the 4 that do not are `Analytics.tsx`,
  `BuildProgress.tsx`, `Chat.tsx`, `ForgePage.tsx`. Also sweep the **5** page files in `src/pages/`
  subdirectories, whose adoption was not measured. Any surface that deliberately has no header —
  `Chat`'s full-bleed presence view being the likely case — is recorded as a **named exemption with
  its reason** in the phase artifact, never left silently unconverted, so "every route" means
  something checkable.

  > *An earlier figure in this discussion said "44 of 62" — that mixed the 20 `.test.tsx` files into
  > both numerator and denominator. 38/42 is the corrected count. Do not propagate 44/62.*

- **D-19: One shared state module feeds both the tile and `EmptyState`.** A single module defines
  the six states plus their default copy, icon and tone; the metric tile renders them at tile scale
  and `EmptyState` renders them at panel/page scale. The same backend condition then reads
  identically whether it hits one tile or a whole panel — which matters immediately, since the
  `/analytics` query-timeout todo (see Reviewed Todos) means one page will show `unavailable` at
  both scales at once.

- **D-20: Centralised copy defaults, per-site override permitted.** The state module carries a
  default string per state (`"no signal yet"` is design law for empty; equivalents for stale /
  unavailable / error), and any call site may override where genuine context exists (e.g. "no runs
  in the last 24h"). This absorbs the **26** ad-hoc empty-state prose strings measured in
  `src/**/*.tsx` into one reviewable honesty vocabulary.

### A11Y-01 measurement

- **D-21: Measure BEFORE and AFTER the token work, and record the delta.** The before-run sits on
  Phase 120's clean surface (satisfying A11Y-01's "this is sizing, and it is task 1"); the after-run
  is what Phase 123 plans against, because the token work changes every colour the baseline
  describes. The before-run is the **control**: without it, a token rewrite that made contrast worse
  is indistinguishable from one that fixed it — which is exactly what the withdrawn Phase 120
  measurement turned on.

- **D-22: axe is the population measure; a rasterised probe covers the named pairs.** Run the
  existing `e2e/theme-contrast.spec.ts` (which already encodes the 4 × 5 matrix and already carries
  the `fee96b5d` gate guard that SKIPs rather than passes vacuously behind Clerk) against
  `dev:noauth`, capturing full per-cell violation JSON. axe resolves colour itself and is immune to
  the `oklch()` string-scraping trap. Supplement with a **canvas/`getImageData` rasterised probe**
  for only the specific pairs the handoff names — Forge `failed`, and the `--status-ok` decouple —
  measured against `--card`, because those need a *ratio per pair*, not a pass/fail per element.
  **Never parse computed colour strings** (`[[tailwind-v4-oklch-defeats-css-color-scraping]]`);
  `canvas.fillStyle` silently keeps its prior value on unparseable input, so use a sentinel and
  return `null` rather than a guess.

- **D-23: Phase 123 consumes committed markdown PLUS raw JSON.** Write
  `122-CONTRAST-BASELINE.md` carrying the per-cell counts table, the before/after delta and the
  named-pair ratios, and commit the raw axe violation JSON alongside so 123 can work rule-by-rule
  and element-by-element without re-running the whole matrix.

- **D-24: Keep the 4 × 5 matrix; state the sampling limit explicitly.** The requirement names 4
  themes × 5 pages and is locked, so measure exactly that. But `src/pages/` holds **42 source
  pages** — so the artifact, 122's verification, and 123's scope must each state that **5 of ~42
  routes were measured** and name the ones that were not. Phase 123's success criterion is "zero
  violations across every cell A11Y-01 measured", so an unmeasured route can be broken while 123
  reports green. No silent caps.

### Verification of the sweep

- **D-25: A corpus-derived ratchet, committed as a test.** It must derive its population from the
  corpus on every run (`git grep -lF` over all of `src/`), bucket each file by whether it still
  holds a raw palette class, a hex literal, a `duration-NNN`, or a raw violet utility, and FAIL on
  anything not in a **frozen `KNOWN_EXEMPT` record** (a record, not a blessing). A file nobody wrote
  down must still fail — Phase 120's third `animate-pulse` site was missed precisely because it
  appeared in no triage document. Rejected: asserting on an enumerated list of known-clean files,
  which can only ratify the last fix.

  > **Matcher discipline:** every literal containing backslashes or `#` uses the fixed-string flag
  > (`grep -F` / `git grep -F` / `rg -F`) with the string typed exactly as it appears on disk —
  > never hand-escaped. And name the unit before quoting any count: `grep -c` is matching LINES per
  > file including zero rows, `grep -o | wc -l` is occurrences, `grep -l | wc -l` is files.

- **D-26: Prove the ratchet with TWO mutations, and the second is the one that matters.** (a)
  Reintroduce a hardcoded value at a site the sweep fixed → must fail. (b) Add a violation in a file
  appearing on **no** list → must **also** fail, where an enumerated test would pass. Both mutations
  must be syntactically valid, so a collection/import error can never be mistaken for a real red.

- **D-27: The rendered result is verified by rasterised assertions with a git before/after control.**
  Class-string checks prove the source changed, not that the app renders correctly. Per theme,
  assert via Playwright + canvas pixel sampling that: the resolved `--surface-0/1/2/3` are four
  **distinct** values (not four aliases of the same colour); the page body actually paints
  `--surface-0`; `--status-ok` and `--primary` are perceptibly separated; and `--astridr` appears
  only on Ástríðr surfaces. Pair each with a control measured from the **pre-phase git state** on the
  same page — on Phase 120 that control inverted the conclusion.

### Execution sequencing

- **D-28: One phase, waved, with a hard checkpoint after the token layer.** As scoped above, 122
  carries a 335-site surface sweep, ~187 motion sites, 36 + 58 + 27 state sites, 22 + 3 badge sites,
  43 violet sites, a rewritten primitive, a new shared state module, two contrast measurements and a
  ratchet — by far the largest phase in the milestone. Sequence:

  1. **Wave 1 — the token layer alone.** Ramps, aliases, hue decouple, `@theme` motion tokens.
     Small, high-leverage, and everything else depends on it. **Checkpoint here** so the leverage
     lands even if the sweeps run long.
  2. **Waves 2-n — the mechanical sweeps, in parallel** where file overlap allows (surfaces /
     motion / violet are largely disjoint from the state-honesty sweep).
  3. **Then the primitives** — `MetricCard` rewrite, `StatusBadge`, `PageHeader`, `EmptyState`, the
     state module.
  4. **Last** — the post-token contrast measurement, the ratchet, and the rendered-result probes.

  The A11Y-01 **before**-measurement runs ahead of wave 1. Splitting into 122a/122b via
  `/gsd-phase` was considered and rejected — it is a roadmap change that would renumber and require
  re-pointing 123/124/125's stated dependencies.

### Claude's Discretion

The following were not discussed and are the implementer's call, guided by the phase goal, the
design law, and the decisions above:

- Exact hex values for the derived `emerald`/`amber` ramps and for `emerald`'s hue-separated
  `--status-ok` (constraint: perceptible separation from that theme's `--primary`, and AA against
  its own `--surface-1`, both **measured**, not asserted).
- The exact fill/foreground pair chosen for Forge `failed` (constraint: ≥ 4.5:1 against `--card` in
  every theme, filled treatment retained).
- The shared state module's file location, export shape, and the default `staleAfter` constant.
- `HeroStatsBar.tsx` ~127's dead `` className={`... ${hc.bg} text-${hc.bg.replace('bg-','')}`} ``
  — a runtime-interpolated Tailwind class the static extractor cannot see, so it never ships in the
  compiled CSS. Assigned to this phase by `120-FABRICATION-INVENTORY.md` row 2 as a **dead style,
  not a fabrication**. Remove or correct it as part of the TOKEN-01/02 pass on that file.
- Whether the ratchet runs as a Vitest test or a standalone script invoked by one (either satisfies
  D-25 as long as it fails the suite).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design law (closed to re-litigation — `REQUIREMENTS.md:16-18`)
- `.claude/skills/sketch-findings-codepulse/SKILL.md` — the validated Borealis Console design law:
  surface/colour/type/motion direction, the three-hue-owner rule, the kill list. Auto-loads on UI
  work; load it explicitly anyway.
- `.claude/skills/sketch-findings-codepulse/sources/themes/default.css` — **the only existing surface
  ramp.** `--surface-0/1/2/3`, `--hairline`, `--hairline-strong`, `--astridr: #8b5cf6`,
  `--status-ok: #34d399`, `--dur-1/2/3`, `--ease-out`. D-03 ports this verbatim for `cyan`.
- `.claude/skills/sketch-findings-codepulse/sources/001-dashboard-quiet-control-room/index.html` —
  the working reference implementation of the whole direction. Open it in a browser; it answers more
  than prose can.
- `html-out/ui-premium-redesign-comparison.html` — the 3-model proposals plus the approved verdict
  tab; the convergence map.
- `html-out/redesign-before-after.html` — before/after visual reference.

### Carried inputs from Phase 120 (these are DESIGN INPUTS for 122, not 120 defects)
- `.planning/phases/120-polish-verified-defects/120-DESIGN-REVIEW-HANDOFF.md` — **read first.**
  The withdrawn-measurement correction, the sub-AA Forge `failed` badge (D-06), the
  emphasis-keyed-to-legacy-bucket proposal (D-07), and the "measure against `--card`, not the page
  background" instruction.
- `.planning/phases/120-polish-verified-defects/120-BADGE-INVENTORY.md` — the measured badge
  work-list D-17 promised this phase: 22 `StatusBadge` consumer files (re-derived) + 3 Forge files /
  5 render sites, with the derivation command included so it is checkable.
- `.planning/phases/120-polish-verified-defects/120-FABRICATION-INVENTORY.md` §rows 2-3 — the two
  residues assigned to Phase 122: the `VitalsRail.tsx:253` Convex dot (D-16) and the `HeroStatsBar`
  dead interpolated class (Claude's discretion).
- `.planning/phases/120-polish-verified-defects/120-CONTEXT.md` §D-01..D-17 — Phase 120's locked
  decisions. D-16 (no shared `StatusBadge` in 120) and D-17 (inventory the rest for 122) are the
  two that hand work directly to this phase.
- `.planning/phases/120-polish-verified-defects/120-SANCTIONED-PATTERNS.md` — patterns 120
  deliberately kept; do not "fix" them here.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §TOKEN-01..05 (`:43-47`), §A11Y-01 (`:66`) — the requirement text.
  **`:44`'s line-number citation is stale; see D-05.**
- `.planning/ROADMAP.md` §"Phase 122" (`:757`ff) — goal, dependencies, 5 success criteria; and
  `:688` for why 123 is sequenced immediately after this phase.

### Live code this phase edits
- `src/index.css` (733 lines) — `@theme` at `:12`/`:17`, `:root` at `:62`, and the five theme blocks
  at `:135` (cyan), `:196` (emerald), `:218` (amber), `:237` (readable), `:303` (aubergine). 12
  `@keyframes`; 9 `prefers-reduced-motion` blocks; only 2 `[data-theme="readable"]` rules.
- `src/components/MetricCard.tsx` — rewritten in place per D-13; 36 consumer files.
- `src/components/StatusBadge.tsx` — `:47` is the `strict → error` mis-mapping named in D-07.
- `src/components/forge/ForgeStatusBadge.tsx` — the second badge implementation; 3 files / 5 render
  sites.
- `src/components/PageHeader.tsx` — today title + optional icon + actions; grows per D-17.
- `src/components/chat/VitalsRail.tsx` `:250-253` — the correct Ástríðr dot and the fabricated Convex
  dot, three lines apart (D-16).

### Verification surfaces
- `e2e/theme-contrast.spec.ts` (72 lines) — the 4 themes × 5 pages matrix and the `fee96b5d` gate
  guard. **Do not remove the guard**; A11Y-03 (Phase 123) exists to prove it still holds.
- `e2e/theme-reduced-motion.spec.ts` — extended by D-11/D-12.
- `e2e/polish-geometry.spec.ts` `:178` — body-wide overflow assertion runs only at 900px. Noted for
  awareness; **owner is Phase 124**, not this phase.

### Operational constraint
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules" — the production backend is self-hosted;
  any deploy must name `--env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`. This phase is
  frontend-only and should need no deploy, but `useConvex().connectionState()` (D-16) is verified
  against the live backend.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/PageHeader.tsx`** — already exists and is adopted by 38 of 42 source pages.
  TOKEN-05 is mostly a *contract* problem, not a rollout problem.
- **`src/components/MetricCard.tsx`** — already the shared metric surface across 36 files; the
  six-state contract lands by rewriting it, not by introducing a competitor.
- **`src/components/ui/` (30 shadcn/ui primitives)** — all consume `bg-card`/`bg-popover`/
  `border-border` internally, which is exactly why D-01's aliasing approach gets them for free.
- **`e2e/theme-contrast.spec.ts`** — the A11Y-01 matrix, gate guard and skip-not-pass logic already
  exist; A11Y-01 is a *run-and-record* task, not a build task.
- **`120-BADGE-INVENTORY.md`** — the badge work-list is pre-measured. Re-check, don't re-derive.
- **`useConvex()`** — available from the Convex React client; nothing in `src/` calls
  `connectionState()` today, so D-16 introduces the first usage.

### Established Patterns
- **Theme architecture is `<html data-theme="…">` + CSS custom properties**, persisted in
  `localStorage["codepulse-theme"]` and applied by a no-flash pre-paint script in `index.html`
  (guarded by `e2e/theme-no-fouc.spec.ts`). Every token decision must live inside a `[data-theme]`
  block, never in component code.
- **`SectionErrorBoundary`** wraps widget groups so one failing widget cannot take down a page. The
  six-state tile's `error` state must compose with it, not duplicate it.
- **Tailwind CSS 4 via `@tailwindcss/vite`**, with `@theme` already in use — so D-10's utility
  generation is the idiomatic path, not a new mechanism.
- **`@/` path alias → `./src/`** in both Vite and tsconfig.
- **Tests live alongside source** (`src/**/*.test.tsx`); heavy render libraries are mocked
  **per test file**, not globally (`src/test/setup.ts` installs jsdom polyfills only).

### Integration Points
- **Phase 121 (DEBT-08, complete)** — `/analytics` now survives a failing `useQuery`, which is the
  precondition for TOKEN-04: a tile cannot render an honest `unavailable` state if the throw unmounts
  the React tree first.
- **Phase 123** consumes D-23's `122-CONTRAST-BASELINE.md` + raw JSON as its entire scope, and
  re-verifies `e2e/theme-contrast.spec.ts`'s guard (A11Y-03).
- **Phase 124** builds its 3-zone header and 4-domain sidebar on this phase's surface/hairline
  tokens and the quiet-badge law (D-17 draws the boundary).
- **Phase 125** reads `--surface-*`, `--status-*` and the motion tokens via `getComputedStyle` for
  the Signal Horizon and the Pulse ECG hero, and inherits `--ease-house` from D-10.

</code_context>

<specifics>
## Specific Ideas

- The winning mockup at
  `.claude/skills/sketch-findings-codepulse/sources/001-dashboard-quiet-control-room/index.html`
  is the visual target — live events, E-Stop flow, state cycling and the density toggle all work in
  it. Open it rather than reasoning from prose.
- `"no signal yet"` is the fixed empty-state phrasing (design law), and skeletons must be **shaped
  like the content they replace** rather than generic bars.
- Depth comes from **shadow, never glow** — which is why D-13 strips `MetricCard`'s `glow-card`
  class and its two inline rgba shadows rather than re-tinting them.
- Hero numerals are 40px / weight 300 / tabular; the eyebrow is a single 11px mono uppercase style.
- The `/chat` presence page is the in-repo north star for the house easing.

</specifics>

<deferred>
## Deferred Ideas

- **Exposing `amber` in `ThemeSwitcher`** — considered under D-04 and rejected as a new user-facing
  capability. If it is ever exposed, it must simultaneously join the contrast matrix (making it
  5 × 5).
- **Extending the contrast matrix beyond 5 pages** — considered under D-24. The 5 measured routes
  are all dashboard-shaped; a settings/form route and a dense table route would make Phase 123's
  remediation generalise. Rejected here because the requirement's matrix is locked, but recorded so
  the sampling limit is a known choice rather than an oversight.
- **Extending `e2e/polish-geometry.spec.ts`'s body-wide overflow assertion to 360/640px** —
  `120-DESIGN-REVIEW-HANDOFF.md` carried item 3. **Owner is Phase 124**, which inherits that spec as
  its regression guard.
- **Ástríðr's serif voice (SIGNAL-03)** — explicitly a single-surface trial in a later phase, not a
  global type change. D-17's eyebrow/type work must not pre-empt it.

### Reviewed Todos (not folded)

- **`.planning/todos/pending/unbounded-analytics-scans-timeout.md`** — matched this phase at 0.6;
  four Convex queries (`analytics:activityHeatmap`, `analytics:toolFlowSankey`,
  `analytics:tokenSunburst`, plus one found from the CLI) return
  *"too many system operations"* at current row counts, three of them surfacing as boundary
  fallbacks on `/analytics` today. **Not folded** — the fix is Convex query work and this phase is
  tokens and primitives. **But it is a live input:** those three failing panels are the real-world
  proving ground for TOKEN-04's `unavailable`/`error` states, so the tile is verified against genuine
  failures rather than a fixture. Leave the todo `pending`; its `trigger_when` still stands for a
  later Analytics-touching phase.

</deferred>

---

*Phase: 122-Tokens, Primitives & Contrast Measurement*
*Context gathered: 2026-08-18*
