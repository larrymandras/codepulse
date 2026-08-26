# Phase 122: Tokens, Primitives & Contrast Measurement - Research

**Researched:** 2026-08-18
**Domain:** Tailwind CSS v4 token architecture, Convex React client state, Playwright/axe-core accessibility measurement, corpus-derived regression testing
**Confidence:** HIGH (all load-bearing claims verified against installed package source, live code, or empirical compilation tests — not training-data recall)

## Summary

This phase's technical risk is concentrated in one place: **D-10's literal `@theme` code sample does not work as written.** Tailwind v4 has no `--duration-*` theme namespace — `--duration-fast: 120ms` inside `@theme` produces zero CSS and the class `duration-fast` matches no rule. This was empirically verified by compiling the exact installed Tailwind v4.3.2 engine against that literal code sample (see Q1 below) — it is not a training-data guess. The fix is mechanical and small: Tailwind v4's `@utility` at-rule (a first-class extension mechanism, distinct from `@theme`) makes `duration-fast`/`duration-normal`/`duration-slow` work exactly as D-10 intends, with the same one-token-one-declaration shape and the same `grep -rE 'duration-[0-9]' src/ → 0` ratchet signal. `--ease-house` needs no such fix — `--ease-*` IS a real Tailwind v4 theme namespace and works via plain `@theme` today.

Everything else the phase depends on checks out cleanly: the existing `@theme inline` block (`index.css:17`) already uses the exact pattern needed to make D-01's surface-ramp aliasing work with zero additional Tailwind configuration (surfaces never need their own utilities — they're consumed only via existing `bg-background`/`bg-card`/`bg-popover` classes, which already indirect through runtime-scoped `[data-theme]` custom properties). Convex's `useQuery` hook is confirmed (by type declaration AND by this repo's own live Phase 121 evidence) to return `undefined` while loading and to throw synchronously on error, caught by `SectionErrorBoundary` (a real `componentDidCatch` class boundary). D-16's proposed binding (`useConvex().connectionState()`) is a one-shot snapshot with no reactivity — the SDK ships a purpose-built reactive alternative, `useConvexConnectionState()`, that the phase should use instead. axe-core's contrast engine is confirmed immune to the oklch-scraping trap that broke Phase 120's hand-rolled probe (verified via a real captured violation from this exact axe suite showing normalized hex output, not oklch). And the repo already has a structurally-identical precedent for D-25's corpus-derived ratchet test (`Analytics.structuralGuard.test.ts`), including its own two-mutation-plus-control pattern — this phase's ratchet is a straightforward generalization of an existing, working idiom, not a new mechanism.

**Primary recommendation:** Fix D-10's mechanism (use `@utility duration-fast { transition-duration: var(--duration-fast); }` × 3, not bare `@theme` declarations) before planning tasks around it; everything else in the 28 locked decisions is implementable as written, with the `useConvex().connectionState()` → `useConvexConnectionState()` substitution for D-16 and the two population-based cross-checks below folded into wave-1/wave-4 verification.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOKEN-01 | All 5 themes define `--surface-0/1/2/3`/`--hairline`; every surface reads them | Q2 confirms the `@theme inline` aliasing mechanism works with zero new Tailwind config; Q9 gives measured file-overlap data for wave sequencing |
| TOKEN-02 | Three-hue-owner law; `--status-ok` decoupled from `--primary` | Confirmed `--astridr` needs no `@theme` registration — consumed via the repo's existing `text-(--var)` bracket-paren convention (already live in `StatusBadge.tsx`) |
| TOKEN-03 | Motion is token-driven, `prefers-reduced-motion` gated, `readable` stays effect-free | Q1 is the load-bearing finding: D-10's `@theme`-only mechanism is broken; `@utility` is the verified fix. Q8 covers the population-based reduced-motion assertion technique |
| TOKEN-04 | Six-state metric tile; no bare "Loading…"/"—" | Q6 confirms Convex `useQuery`/`SectionErrorBoundary` semantics from both type declarations and this repo's own Phase 121 live evidence |
| TOKEN-05 | Every route uses `PageHeader`; shared `EmptyState` | Confirmed no `EmptyState` primitive exists yet (new build, not a rollout) |
| A11Y-01 | True contrast-violation scale measured across 4×5 matrix | Q3/Q4 cover axe JSON capture and the rasterised-probe pattern; confirmed axe is immune to the oklch trap via a real captured violation sample |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All 28 decisions (D-01 through D-28) in `122-CONTEXT.md` are locked and closed to re-litigation. They are not reproduced verbatim here for length — read `122-CONTEXT.md` directly; this research assumes it as the baseline and calls out only where a decision's *implementation mechanism* (not its intent) needs correction (D-10, D-16) or where research adds a verified detail (D-01/D-02, D-14, D-22).

Summary of what's locked, by requirement:
- **TOKEN-01 (D-01..D-04):** surface ramp is the source, shadcn tokens become `var()` aliases; full 335-site hardcoded-surface sweep; per-theme ramp derivation (verbatim for cyan, hand-tuned for readable/aubergine, mechanical for emerald/amber); amber gets full tokens but stays unexposed.
- **TOKEN-02 (D-05..D-08):** `--status-ok` = `#34d399` in four themes, emerald is a hue-separated exception; Forge `failed` keeps its fill, corrected to AA against `--card`; build shared `StatusBadge` with emphasis re-keyed to operational severity; create `--astridr` and adjudicate all 43 violet sites.
- **TOKEN-03 (D-09..D-12):** all timing/easing centralizes on tokens; tokens registered in `@theme` (mechanism needs correction — see Q1); `readable`'s no-effects guarantee becomes one blanket rule + test; D-12 re-verifies via population check with a control.
- **TOKEN-04 (D-13..D-16):** rewrite `MetricCard.tsx` in place, no parallel primitive; caller declares `state`, tile never infers; reach is 36 MetricCard + 58 bare-Loading + 27 em-dash sites; `VitalsRail.tsx:253`'s Convex dot binds to a Convex connection-state signal (mechanism needs correction — see Q7).
- **TOKEN-05 (D-17..D-20):** `PageHeader` stays page-layer only (Phase 124 owns app chrome); complete adoption with named exemptions; one shared state module feeds both the tile and `EmptyState`; centralised copy defaults with per-site override.
- **A11Y-01 (D-21..D-24):** measure before AND after the token work; axe is the population measure, rasterised probe for named pairs; Phase 123 consumes committed markdown + raw JSON; keep the 4×5 matrix, state the sampling limit explicitly.
- **Verification (D-25..D-28):** corpus-derived ratchet with a frozen `KNOWN_EXEMPT` record, never an enumerated allowlist; prove it with two mutations (reintroduce a known-fixed violation, AND add one in a file on no list); rendered-result verification via rasterised assertions with a pre-phase git control; one phase, waved, with a hard checkpoint after the token layer (wave 1 = tokens; waves 2-n = parallel mechanical sweeps; then primitives; then post-token measurement + ratchet).

### Claude's Discretion

- Exact hex values for derived `emerald`/`amber` ramps and `emerald`'s hue-separated `--status-ok` (constraint: perceptible separation from `--primary`, AA against `--surface-1`, both measured).
- Exact fill/foreground pair for Forge `failed` (constraint: ≥4.5:1 against `--card` in every theme, filled treatment retained).
- Shared state module's file location, export shape, default `staleAfter` constant. **Research recommendation:** follow this repo's existing convention — pure data/logic in `src/lib/` (see `src/lib/formatters.ts`, `src/lib/categoryColors.ts` for the closest analogues — colour/label lookup tables keyed by a small enum), the derivation hook in `src/hooks/` (see `src/hooks/useLiveState.ts` for the closest analogue — a hook that derives a UI-facing status from raw data). A plausible shape: `src/lib/metricState.ts` (the six-state enum + default copy/icon/tone table, consumed by both `MetricCard` and `EmptyState`) + `src/hooks/useMetricState.ts` (the Convex-shape-deriving hook, per D-14).
- `HeroStatsBar.tsx` ~127's dead runtime-interpolated Tailwind class — remove or correct as part of the TOKEN-01/02 pass on that file.
- Whether the ratchet runs as a Vitest test or a standalone script invoked by one. **Research recommendation:** Vitest test file, following the `Analytics.structuralGuard.test.ts` precedent exactly (see Q5) — `child_process.execSync('git grep ...')` is confirmed to work inside this repo's Vitest environment despite `environment: 'jsdom'` (jsdom only polyfills browser globals; the test process itself is real Node.js).

### Deferred Ideas (OUT OF SCOPE)

- Exposing `amber` in `ThemeSwitcher` (would require joining the contrast matrix too — 5×5).
- Extending the contrast matrix beyond 5 pages (locked to the requirement's stated 4×5; recorded as a known sampling limit, not fixed here).
- Extending `e2e/polish-geometry.spec.ts`'s body-wide overflow assertion to 360/640px (owner: Phase 124).
- Ástríðr's serif voice (SIGNAL-03) — a later, single-surface trial; D-17's type work must not pre-empt it.
- The `unbounded-analytics-scans-timeout.md` todo — deliberately NOT folded; used live as TOKEN-04's `unavailable`/`error` proving ground on `/analytics`.
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Surface/hue/motion token layer (`--surface-*`, `--status-*`, `--astridr`, `--duration-*`) | Browser/Client (CSS custom properties) | — | Pure CSS cascade; `[data-theme]` selector switching happens client-side via `localStorage` + pre-paint script (`index.html`) |
| `@utility`/`@theme` Tailwind build-time registration | Browser/Client (build tooling, `@tailwindcss/vite`) | — | Compile-time only; no server involvement — verified no server-rendering exists in this Vite SPA |
| `MetricCard`/`StatusBadge`/`PageHeader`/`EmptyState` primitives | Browser/Client (React components) | — | Pure presentation; D-14 explicitly forbids the tile from inferring state — caller (a page component, still client-tier) owns the decision |
| `useMetricState` state derivation | Browser/Client (React hook) | API/Backend (indirectly, via Convex query shape) | The hook interprets `useQuery`'s return shape (`undefined`/thrown/empty/timestamp), all client-side; the *data* originates server-side but the phase does no backend work |
| Convex connection-state dot (D-16) | Browser/Client (`useConvexConnectionState()`) | — | WebSocket-state is inherently client-observed; explicitly rejected building a backend `healthStatus.convex` query (D-16's own rationale: a query that answers "is Convex up?" can't run when Convex is down) |
| axe-core contrast scan + rasterised probe | Browser/Client (Playwright-driven, runs the real rendered page) | Test tooling (Node process orchestrating Playwright) | Both measure the DOM as rendered in a real Chromium instance; no backend involvement |
| Corpus-derived ratchet (D-25) | Test tooling (Node process, `git grep` via `child_process`) | — | Operates on source files on disk, not a running app; correctly excluded from Browser tier |

No API/Backend or Database/Storage tier work exists in this phase's locked scope — confirmed by CONTEXT.md's explicit boundary ("No new surface is built here") and by the file list in `<canonical_refs>` (all `src/`/`e2e/` paths, zero `convex/` paths except the already-existing `useConvex` client hook).

## Standard Stack

### Core (already installed — no new packages)

| Library | Installed version | Purpose | Confidence |
|---------|------|---------|--------------|
| `tailwindcss` | 4.3.2 (package.json declares `^4.2.1`; `npm view` shows 4.3.3 as latest at research time) [VERIFIED: local node_modules + npm registry] | `@theme`/`@utility` token generation | HIGH — verified by direct compilation, see Q1 |
| `@tailwindcss/vite` | 4.3.2 | Build-time Tailwind integration for Vite | HIGH |
| `convex` | 1.42.1 (package.json `^1.42.0`; npm registry latest 1.44.0) [VERIFIED: local node_modules + npm registry] | `useQuery`, `useConvex`, `useConvexConnectionState` | HIGH — verified by reading installed `.d.ts` and `.js` source directly |
| `@playwright/test` | ^1.61.1 | Contrast/reduced-motion E2E specs | HIGH |
| `@axe-core/playwright` | ^4.12.1 | WCAG population measurement | HIGH |
| `typescript` (via `ts` module) | ^6.0.3 | AST-based corpus ratchet (precedent: `Analytics.structuralGuard.test.ts`) | HIGH |
| `vitest` | ^4.1.9 | Ratchet test runner | HIGH |
| `react` / `react-dom` | 19.2.7 | All primitive rewrites | HIGH |

**No new packages need to be added for this phase.** Every mechanism researched (Tailwind `@utility`, Convex `useConvexConnectionState`, axe-core JSON capture, canvas `getImageData`, `child_process.execSync` for `git grep`) is available from packages already in `package.json`. `canvas`/`getImageData` is a browser-native Playwright API (`page.evaluate`), not an npm package.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useConvexConnectionState()` (React hook, reactive) | `useConvex().connectionState()` read once in a `useEffect` + manual `subscribeToConnectionState` wiring | The SDK-provided hook already does exactly this internally (`useSubscription({ getCurrentValue, subscribe })` — verified by reading `node_modules/convex/dist/esm/react/client.js:531-550`). Hand-rolling it duplicates SDK code for no benefit. |
| Tailwind `@utility` for `duration-fast/normal/slow` | `duration-(--duration-fast)` arbitrary-property syntax at every call site | Verified both work; `@utility` matches D-10's stated goal ("call sites stay idiomatic... produces a clean lintable ratchet signal") far better — `duration-(--duration-fast)` is exactly the "noisy, no lintable pattern" shape D-10 explicitly rejected for the bracket form. |
| Corpus-derived ratchet via `git grep` in a Vitest test | A standalone Node script invoked via `npm run` outside the test suite | CONTEXT's own Claude's Discretion note says either satisfies D-25 "as long as it fails the suite" — a Vitest test integrates with the existing `npm test` gate with zero extra CI wiring, matching the `Analytics.structuralGuard.test.ts` precedent exactly. |

## Package Legitimacy Audit

**Not applicable — this phase installs zero new external packages.** All mechanisms (Tailwind `@utility`, `useConvexConnectionState`, `child_process.execSync`, Playwright `page.evaluate` canvas sampling) use APIs already present in dependencies declared in `package.json` and confirmed installed in `node_modules`. The Package Legitimacy Gate protocol (slopcheck, registry verification) is skipped per its own stated scope ("Every phase that installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  BUILD TIME (Vite + @tailwindcss/vite, on every dev/build run)       │
│                                                                        │
│  src/index.css                                                       │
│    @theme { --font-*, --ease-house, ... }  ──┐                       │
│    @utility duration-fast { ... }              │   Tailwind v4        │
│    @utility duration-normal { ... }            ├──▶ oxide engine      │
│    @utility duration-slow { ... }              │   (native binary)   │
│    @theme inline { --color-background: var(--background), ... } ─┘   │
│                                                                        │
│    [data-theme="cyan"]   { --background: var(--surface-0); ... }     │
│    [data-theme="emerald"]{ --background: var(--surface-0); ... }     │
│    ... (5 theme blocks, plain CSS custom properties, NOT @theme)     │
│                                                                        │
│  → generates static utility classes: .bg-background, .duration-fast, │
│    .ease-house, etc. — these never change at runtime.                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RUNTIME (browser)                                                    │
│                                                                        │
│  index.html pre-paint script → reads localStorage["codepulse-theme"] │
│    → sets <html data-theme="cyan">  (before first paint, no FOUC)    │
│                                                                        │
│  <div class="bg-background">  ──uses──▶ var(--color-background)      │
│                                            = var(--background)        │
│                                            = resolved by the CASCADE  │
│                                              from [data-theme="cyan"] │
│                                              → var(--surface-0)       │
│                                              → #05060a                │
│                                                                        │
│  Changing data-theme swaps which [data-theme="X"] block wins the     │
│  cascade — the compiled utility class (.bg-background) never needs   │
│  to change, because @theme inline embedded the LIVE var() reference, │
│  not a build-time-resolved value.                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  REACT COMPONENT TREE                                                │
│                                                                        │
│  Convex useQuery(api.metric.get) ──▶ undefined (loading)              │
│                                   │▶ throws (error) ──▶ SectionError  │
│                                   │                      Boundary     │
│                                   │▶ [] / {} (empty)                  │
│                                   │▶ { value, updatedAt } (ready/stale│
│                                        via staleAfter comparison)     │
│                                        │                              │
│                                        ▼                              │
│                              useMetricState(value, opts)              │
│                                        │                              │
│                                        ▼                              │
│                        { state: "loading"|"ready"|"empty"|            │
│                          "stale"|"unavailable"|"error", ... }         │
│                                        │                              │
│                        ┌───────────────┴────────────────┐            │
│                        ▼                                ▼            │
│                  MetricCard (tile scale)          EmptyState (panel) │
│                  reads shared state module for default copy/icon/tone│
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions only — everything else already exists)

```
src/
├── lib/
│   └── metricState.ts        # NEW — six-state enum + default copy/icon/tone table (D-19/D-20)
├── hooks/
│   └── useMetricState.ts     # NEW — derives {state} from a Convex useQuery-shaped value (D-14)
├── components/
│   ├── MetricCard.tsx        # REWRITTEN IN PLACE (D-13) — six-state contract, tokens, no glow-card
│   ├── StatusBadge.tsx       # REWRITTEN — emphasis re-keyed to operational severity (D-07)
│   ├── PageHeader.tsx        # EXTENDED — eyebrow/subtitle, tokens (D-17)
│   ├── EmptyState.tsx        # NEW — shared primitive, consumes lib/metricState.ts (D-19)
│   └── chat/VitalsRail.tsx   # EDITED :253 — useConvexConnectionState() binding (D-16, corrected)
├── index.css                 # EDITED — surface ramps ×5, --astridr, @utility duration-*, hue decouple
└── **/*.test.tsx              # Existing per-file mocking convention, unchanged

e2e/
├── theme-contrast.spec.ts         # RUN (not built) — capture JSON per D-23
├── theme-reduced-motion.spec.ts   # EXTENDED — population assertion + control (D-11/D-12)
└── theme-rendered-result.spec.ts  # NEW (suggested name) — D-27 rasterised assertions with git-before control

.planning/phases/122-.../
├── 122-CONTRAST-BASELINE.md   # NEW — D-23 deliverable
└── (raw axe JSON, committed alongside)
```

### Pattern 1: `@theme inline` for runtime-scoped design tokens (D-01/D-03, ALREADY LIVE — no new work needed)

**What:** A Tailwind v4 `@theme inline` block emits a utility class whose generated CSS *directly embeds* the `var()` reference rather than resolving it once at the theme-variable's own scope. This is required whenever the underlying custom property's value legitimately changes at runtime (e.g. via a `[data-theme]` selector), because a plain (non-`inline`) `@theme` declaration can suffer CSS variable resolution failures when the referenced variable is redefined deeper in the DOM tree than where the alias was declared.

**When to use:** Any token whose *value* is theme-scoped but whose *utility class* must be generated once, globally.

**Verified live in this exact file** — `src/index.css:17-23`:
```css
@theme inline {
  --color-background: var(--background);
  --color-card: var(--card);
  --color-popover: var(--popover);
  --color-border: var(--border);
  /* ...9 more shadcn semantic aliases */
}
```
Because `--background`/`--card`/`--popover`/`--border` are then redefined inside each `[data-theme="X"]` selector (plain CSS, `:135`/`:196`/`:218`/`:237`/`:303`), `bg-background` etc. correctly resolve per-theme at runtime with zero additional Tailwind configuration. **This means D-01's plan — `--background: var(--surface-0)` inside each `[data-theme]` block — requires NO changes to the `@theme inline` block at all.** `--surface-0/1/2/3`/`--hairline` themselves never need Tailwind utility registration; they are pure intermediate CSS custom properties, consumed only via the existing `bg-background`/`bg-card`/etc. utility classes that already exist.

Source: [Tailwind CSS official docs, `theme.css`/`utilities.css` from installed package `node_modules/tailwindcss@4.3.2`]

### Pattern 2: `@utility` for tokens with no built-in Tailwind namespace (CORRECTS D-10's literal code sample)

**What:** Tailwind v4 recognizes a fixed, closed list of theme namespaces (`--color-*`, `--font-*`, `--text-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `--ease-*`, `--animate-*`, etc. — verified list in Q1 below). **`--duration-*` is not one of them.** Declaring `--duration-fast: 120ms` inside `@theme` does not generate a `duration-fast` utility — verified by directly compiling the installed Tailwind v4.3.2 engine against exactly this code (command + full output below). The `duration-<value>` utility Tailwind DOES ship is a different, closed-form "functional utility" that accepts only a bare integer (`duration-150` → `150ms`), `duration-initial`, an arbitrary-property reference (`duration-(--custom-prop)`), or an arbitrary bracket value (`duration-[300ms]`) — it never looks up a suffix against a theme table the way `bg-red-500` or `ease-out` does.

**The fix, verified working:** Tailwind v4's `@utility` at-rule is the documented mechanism for adding new utility classes the built-in engine doesn't generate. Declaring three one-line `@utility` blocks produces exactly the idiomatic call-site shape D-10 wants (`duration-normal ease-house`), with the token still centralized in `@theme` and the same `grep -rE 'duration-[0-9]' src/ → 0` ratchet signal:

```css
@theme {
  --duration-fast:   120ms;
  --duration-normal: 200ms;
  --duration-slow:   320ms;
  --ease-house: cubic-bezier(0.22, 1, 0.36, 1);   /* ← this line alone already works via @theme */
}

/* --duration-* is not a Tailwind namespace, so these three utilities must be declared explicitly: */
@utility duration-fast   { transition-duration: var(--duration-fast); }
@utility duration-normal { transition-duration: var(--duration-normal); }
@utility duration-slow   { transition-duration: var(--duration-slow); }
```

**Verification command and full output** (run against the exact installed `tailwindcss@4.3.2` compiler, not a training-data claim):
```
node -e "
const fs = require('fs');
const { compile } = require('./node_modules/tailwindcss/dist/lib.js');
const themeCss = fs.readFileSync('./node_modules/tailwindcss/theme.css','utf8');
const utilCss  = fs.readFileSync('./node_modules/tailwindcss/utilities.css','utf8');
const css = \`@layer theme, base, utilities;
@layer theme { \${themeCss}
@theme { --duration-fast: 120ms; --duration-normal: 200ms; --duration-slow: 320ms; --ease-house: cubic-bezier(0.22,1,0.36,1); } }
@layer utilities { \${utilCss} }\`;
compile(css, { base: process.cwd() }).then(c =>
  console.log(c.build(['duration-fast','duration-normal','ease-house','duration-150'])));
"
```
Output (abridged, full run in this session's transcript):
```css
@layer theme { :root, :host {
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-house: cubic-bezier(0.22, 1, 0.36, 1);   /* ← emitted: --ease-* is a real namespace */
  /* NOTE: --duration-fast / --duration-normal are ABSENT here — dropped entirely */
} }
@layer utilities {
  .duration-150 { --tw-duration: 150ms; transition-duration: 150ms; }   /* ← bare-number form works */
  .ease-house { --tw-ease: var(--ease-house); transition-timing-function: var(--ease-house); }
  /* NOTE: NO .duration-fast or .duration-normal rule was generated */
}
```
Re-running the identical compile with the two `@utility duration-fast {...}` / `duration-normal {...}` blocks added produces exactly the wanted `.duration-fast { transition-duration: var(--duration-fast); }` rule, with `--duration-fast` now correctly appearing in the emitted `:root` theme block (full output captured in this session).

Source: `node_modules/tailwindcss@4.3.2/theme.css`, `utilities.css` [VERIFIED: direct compilation of installed package] + [Tailwind CSS official docs `/docs/theme`, `/docs/transition-duration`, `/docs/adding-custom-styles#adding-custom-utilities` — `@utility` is the documented custom-utility mechanism]

### Pattern 3: Convex reactive connection state (CORRECTS D-16's literal binding)

**What:** `useConvex()` returns the `ConvexReactClient` instance. Calling `.connectionState()` on it reads a **snapshot at that instant** — it is a plain method call, not a subscription, so a component that calls it once during render will never re-render when the connection drops or recovers (unless something else forces a re-render at the right moment). The SDK ships a dedicated hook for exactly this case:

```ts
// node_modules/convex/dist/esm-types/react/client.d.ts:521-536
/**
 * React hook to get the current ConnectionState and subscribe to changes.
 * ...
 * @returns The current ConnectionState with the Convex backend.
 */
export declare function useConvexConnectionState(): ConnectionState;
```

Its implementation (`node_modules/convex/dist/esm/react/client.js:531-550`) wraps `convex.connectionState()` (initial read) and `convex.subscribeToConnectionState()` (change notifications) in React's `useSubscription` idiom — i.e. it is the fully-reactive version of exactly what D-16 describes wanting, already built.

`ConnectionState` shape (`node_modules/convex/dist/esm-types/browser/sync/client.d.ts:116+`):
```ts
type ConnectionState = {
  hasInflightRequests: boolean;
  isWebSocketConnected: boolean;   // ← the field VitalsRail's dot should bind to
  timeOfOldestInflightRequest: Date | null;
  hasEverConnected: boolean;
  connectionCount: number;
  connectionRetries: number;
  inflightMutations: number;
  inflightActions: number;
};
```

**Recommended binding for `VitalsRail.tsx:253`:**
```tsx
import { useConvexConnectionState } from "convex/react";
// ...
const { isWebSocketConnected } = useConvexConnectionState();
// ...
<span className={`w-2 h-2 rounded-full ${isWebSocketConnected ? "bg-green-500" : "bg-red-500"}`} />
```
This mirrors the sibling Ástríðr dot two lines above (`${disconnected ? "bg-red-500" : "bg-green-500"}`) exactly, satisfying D-16's stated rationale ("mirrors the working sibling").

**Confirmed nothing in `src/` calls either API today:** `git grep -n "useConvex\b|connectionState"` (already run by 120-05's fabrication sweep, re-confirmed this session) returns only unrelated WebRTC/voice `connectionState` matches (`useDuplexEars.ts`, `useWarRoomVoice.ts`, `WarRoom.tsx`, `VoiceControlBar.tsx` — all a different, unrelated `RTCPeerConnection.connectionState`/local voice-call state, not Convex's). This is a genuinely first-time usage in this codebase.

Source: `node_modules/convex@1.42.1/dist/esm-types/react/client.d.ts`, `dist/esm/react/client.js` [VERIFIED: direct read of installed package source, not docs]

### Pattern 4: Convex `useQuery` loading/error/empty semantics (confirms D-14)

**What:** Standard `useQuery(api.foo.bar, args)` returns `Query["_returnType"] | undefined` (`client.d.ts:403`) — `undefined` strictly while loading, per its own doc comment: `"Returns undefined while loading. // Returns undefined while loading: if (tasks === undefined) return <div>Loading...</div>;"`. Nothing in the type or the doc comment distinguishes an error state — this repo's own `SectionErrorBoundary.tsx` (a real `Component` subclass implementing `static getDerivedStateFromError`/`componentDidCatch`) is what actually intercepts a thrown query error, confirming Convex's documented behavior (a failing query throws synchronously during render, caught by the nearest ancestor error boundary — well-established Convex/React behavior, and independently confirmed live in this exact repo).

**First-party confirmation from this repo's own history** (`.planning/STATE.md`, Phase 121 close): *"three REAL un-injected query timeouts (`analytics:activityHeatmap`, `toolFlowSankey`, `tokenSunburst`) were caught by their own SectionErrorBoundaries live in Chrome while every other panel on /analytics kept rendering."* This is a live-verified instance of exactly the throw→boundary mechanism D-14 relies on, in this codebase, dated 2026-08-18 (today).

**What this means for `useMetricState`:** the hook cannot itself distinguish `error` from `unavailable` purely from `useQuery`'s return value — `undefined` is structurally ambiguous between "still loading" and "the caller never checked for a load timeout." D-14's `{ staleAfter, unavailable }` options object is the correct shape: `unavailable` must be an explicit boolean/flag the CALLER supplies (e.g. "this metric has no emitter behind it yet," known statically per D-15's audit), never inferred from the query result. `error` is caught one layer up by `SectionErrorBoundary`, not inside `useMetricState` at all — the hook only needs to cover `loading`/`ready`/`empty`/`stale`.

Source: `node_modules/convex@1.42.1/dist/esm-types/react/client.d.ts:360-403` [VERIFIED] + `.planning/STATE.md` Phase 121 entry (this repo, dated today) [VERIFIED, first-party]

### Anti-Patterns to Avoid

- **Declaring `--duration-*`/other unrecognized-namespace tokens inside `@theme` and assuming a utility appears.** Silently produces zero CSS and zero build error — the class name is simply unmatched. No warning is emitted (confirmed: the compile output above shows no error, warning, or diagnostic of any kind for the dropped `--duration-fast`/`--duration-normal` declarations).
- **Calling `useConvex().connectionState()` inside JSX and expecting live updates.** Renders correctly once, then goes stale forever unless the surrounding component re-renders for an unrelated reason.
- **Trusting a hand-rolled regex/substring scrape of `getComputedStyle(...).color` or `.backgroundColor` for a contrast measurement.** Confirmed in this exact repo's own history (Phase 120's withdrawn measurement, `120-DESIGN-REVIEW-HANDOFF.md`) — Tailwind v4/modern Chromium can serialize computed colour as `oklch()`, and a number-extraction regex reads the hue angle as a colour channel (tell: an impossible `rgb(0,0,262)`). axe-core's own contrast engine is NOT susceptible to this (see Q3/Q4) — the trap is specific to hand-written probes, not to axe.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive Convex connection status | A `useEffect` + `subscribeToConnectionState` wrapper hook | `useConvexConnectionState()` from `convex/react` | Already implemented in the installed SDK (1.42.1), identical shape to what would be hand-built |
| WCAG contrast ratio computation for the population-wide measurement | A custom colour-parsing + luminance formula for every element on the page | `@axe-core/playwright`'s `AxeBuilder` (already wired in `e2e/theme-contrast.spec.ts`) | axe-core's contrast checker is a mature, spec-compliant WCAG engine; a hand-rolled version is exactly the class of bug that broke Phase 120's badge measurement |
| Corpus population enumeration for the ratchet (D-25) | A hand-maintained list of "known clean" files | `git grep -lF <pattern> -- src` re-run fresh every test execution | This is D-25's own explicit rejection ("Rejected: asserting on an enumerated list of known-clean files, which can only ratify the last fix") — confirmed as sound practice by this repo's own precedent, `Analytics.structuralGuard.test.ts`, which derives from AST/corpus on every run rather than a name list |

**Key insight:** every "don't hand-roll" item above has a working, already-installed implementation in this exact codebase or its dependencies — this phase's job is to *use* those correctly, not build alternatives.

## Common Pitfalls

### Pitfall 1: Assuming `@theme` is a universal token registration mechanism
**What goes wrong:** A token declared in `@theme` with a namespace Tailwind doesn't recognize (`--duration-*` is the concrete instance here) silently produces no utility and no CSS variable — with zero build error, so the failure is invisible until someone notices a class does nothing.
**Why it happens:** `@theme`'s namespace list is a fixed, closed set (`--color-*`, `--font-*`, `--ease-*`, `--radius-*`, etc.) that does not intuitively map onto every plausible CSS property; developers reasonably assume any `--property-*` shape works.
**How to avoid:** Before declaring a new `@theme` namespace, compile a throwaway test (exactly as done in this research session) or check the namespace against the confirmed list in Q1. If the namespace isn't recognized, use `@utility` instead.
**Warning signs:** A class applies visually nothing; `getComputedStyle` shows the browser's UA-default value instead of the intended one; the custom property doesn't appear in `:root`'s computed styles at all.

### Pitfall 2: Reading Convex connection/query state as a one-shot value
**What goes wrong:** `useConvex().connectionState()` called during render captures a snapshot; if nothing else in the component re-renders when connectivity changes, the UI shows stale health status indefinitely (exactly POLISH-04's fabrication class — an unconditional-looking value with no real signal wired to trigger updates).
**Why it happens:** The method name (`connectionState()`) doesn't signal "this is not reactive"; only `useConvexConnectionState()`'s naming and its `useSubscription` internals reveal the distinction.
**How to avoid:** Use the dedicated `use*` hook for any value that needs to re-render on change; reserve the raw client method for one-shot reads inside event handlers.
**Warning signs:** A status dot that never changes color in manual testing, even when the dev server or backend is stopped/restarted.

### Pitfall 3: Trusting `getComputedStyle` string output for colour math
**What goes wrong:** Modern browsers can serialize computed colour values in whatever colour space the CSS declared (oklch/oklab included), not always normalized `rgb()`. A regex expecting `rgb(r,g,b)` silently misparses.
**Why it happens:** Historically `getComputedStyle().color` always normalized to `rgb()`; this assumption is now false for wide-gamut CSS Color 4 syntax, which Tailwind v4 emits by default for its palette.
**How to avoid:** Never parse the string. Rasterise via `canvas.fillStyle = computedColorString; ctx.fillRect(...); ctx.getImageData(...)` — the canvas 2D context always resolves to true sRGB bytes regardless of the input syntax, because `fillStyle` assignment goes through the browser's real colour-parsing pipeline, not a regex. Use axe-core (confirmed unaffected — see Q3/Q4) for population-scale checks; reserve rasterisation for the specific named pairs D-22 calls out.
**Warning signs:** An impossible channel value (>255, e.g. `rgb(0,0,262)` — this exact repo's own tell from Phase 120's withdrawn measurement).

### Pitfall 4: `canvas.fillStyle` silently keeping its prior value on unparseable input
**What goes wrong:** Assigning an invalid or unparseable string to `ctx.fillStyle` does NOT throw and does NOT reset to a default — the canvas context silently keeps whatever value was previously set, so a rasterised probe can report a stale/wrong colour with no error signal.
**Why it happens:** This is documented Canvas 2D API behavior (assignment to `fillStyle` is validated; on failure the assignment is simply a no-op).
**How to avoid:** Set a known sentinel value (e.g. bright magenta `#ff00ff`) before every assignment, then verify the fill actually changed away from the sentinel before trusting the sampled pixel. Return `null` (not a guess) if the sentinel persists.
**Warning signs:** A rasterised measurement that reports the same colour for two visually-different elements.

### Pitfall 5: Running `theme-contrast.spec.ts` against the wrong dev server
**What goes wrong:** `playwright.config.ts`'s `webServer` is hardcoded to `npm run dev` on port 5173 (Clerk-gated). Running the axe suite there makes every test either pass vacuously (behind the sign-in screen, which has almost no content) or, since `fee96b5d`, correctly `test.skip()` — but either way it measures nothing real.
**Why it happens:** `PW_BASE_URL` only redirects `page.goto()` navigation targets, not Playwright's own `webServer` health-check/boot target — the two are independently configured.
**How to avoid:** Start `dev:noauth` (port 5181) in its own terminal FIRST, then run `PW_BASE_URL=http://localhost:5181 npm run test:e2e:noauth` from **Git Bash, not PowerShell** (PS 5.1 silently deletes an empty-string env-var assignment, per this repo's own documented gotcha in `package.json`'s `test:e2e:noauth:help` script).
**Warning signs:** The gate-check `test.skip()` message ("Clerk auth gate present...") firing on every test — this is the suite correctly refusing to report a vacuous green, not a bug to work around by ignoring the skip.

## Code Examples

### The full `@theme` + `@utility` motion-token block (D-10, corrected)
```css
/* Source: this session's verified compilation against tailwindcss@4.3.2 */
@theme {
  --duration-fast:   120ms;
  --duration-normal: 200ms;
  --duration-slow:   320ms;
  --ease-house: cubic-bezier(0.22, 1, 0.36, 1);
}

@utility duration-fast   { transition-duration: var(--duration-fast); }
@utility duration-normal { transition-duration: var(--duration-normal); }
@utility duration-slow   { transition-duration: var(--duration-slow); }
```
Call sites remain exactly as D-10 specifies: `className="duration-normal ease-house"`.

### `useMetricState` shape (D-14, suggested — Claude's Discretion on exact export shape)
```ts
// Source: derived from confirmed useQuery semantics (client.d.ts:360-403) + D-14's decision text
export type MetricState = "loading" | "ready" | "empty" | "stale" | "unavailable" | "error";

interface UseMetricStateOptions {
  staleAfter?: number;   // ms; per-tile override beats a shared default constant (D-14)
  unavailable?: boolean; // caller-declared: "no emitter exists behind this metric" (D-14)
}

// value: the raw useQuery(...) return — undefined while loading, by Convex's own contract.
// `error` is NOT derivable here — it's caught one layer up by SectionErrorBoundary (D-14).
export function useMetricState<T>(
  value: T | undefined,
  updatedAt: number | undefined,
  opts: UseMetricStateOptions = {}
): { state: MetricState; value: T | undefined } {
  if (opts.unavailable) return { state: "unavailable", value };
  if (value === undefined) return { state: "loading", value };
  const isEmpty = Array.isArray(value) ? value.length === 0 : value == null;
  if (isEmpty) return { state: "empty", value };
  if (opts.staleAfter != null && updatedAt != null && Date.now() - updatedAt > opts.staleAfter) {
    return { state: "stale", value };
  }
  return { state: "ready", value };
}
```

### Population-wide `prefers-reduced-motion` assertion with a required control (D-11/D-12)
```ts
// Source: standard Playwright + DOM API composition — no library beyond @playwright/test needed
async function assertNoMotion(page: Page) {
  const offenders = await page.evaluate(() => {
    const bad: string[] = [];
    const all = [document.documentElement, ...document.querySelectorAll("*")];
    for (const el of all) {
      for (const pseudo of [undefined, "::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.animationDuration !== "0s" || cs.transitionDuration.split(", ").some(d => d !== "0s")) {
          bad.push(`${el.tagName}${pseudo ?? ""}: anim=${cs.animationDuration} trans=${cs.transitionDuration}`);
        }
      }
    }
    return bad;
  });
  return offenders;
}

test("no element animates under prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await assertNoMotion(page)).toEqual([]);
});

// D-12's REQUIRED control — a green above is meaningless without this failing:
test("control: the same page DOES show motion without the override", async ({ page }) => {
  // no emulateMedia call — default OS preference (no-preference)
  await page.goto("/");
  expect(await assertNoMotion(page)).not.toEqual([]);
});
```

### Rasterised contrast probe with sentinel-guarded `fillStyle` (D-22/D-27)
```ts
// Source: Canvas 2D API documented behavior (fillStyle silently keeps prior value on
// unparseable input) + this repo's own memory `tailwind-v4-oklch-defeats-css-color-scraping`
async function sampleColor(page: Page, cssColorString: string): Promise<[number, number, number] | null> {
  return page.evaluate((color) => {
    const SENTINEL = "#ff00ff"; // magenta — vanishingly unlikely to be a real theme colour
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = SENTINEL;
    ctx.fillStyle = color; // if `color` is unparseable, fillStyle silently stays SENTINEL
    if (ctx.fillStyle.toLowerCase() !== SENTINEL && ctx.fillStyle === SENTINEL) return null;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  }, cssColorString);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const L1 = relativeLuminance(fg), L2 = relativeLuminance(bg);
  const [lighter, darker] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (lighter + 0.05) / (darker + 0.05);
}
```
No existing helper of this shape was found anywhere in `src/` or `scripts/` (confirmed via `Grep` for `contrastRatio|relativeLuminance|wcagContrast` — zero hits in source, only in planning docs). This is new code for the phase, not a rollout of an existing utility.

### Corpus-derived ratchet skeleton, following the `Analytics.structuralGuard.test.ts` precedent
```ts
// Source: pattern generalized from src/pages/Analytics.structuralGuard.test.ts (this repo,
// verified working — its own "two mutations + negative control" idiom is D-26's exact shape)
import { execSync } from "node:child_process";

const KNOWN_EXEMPT: Record<string, string> = {
  // "src/pages/SomeThirdPartyEmbed.tsx": "vendor iframe — palette not ours to change",
};

function filesWithPattern(pattern: string): string[] {
  try {
    return execSync(`git grep -lE ${JSON.stringify(pattern)} -- src`, { encoding: "utf8" })
      .trim().split("\n").filter(Boolean);
  } catch (e: any) {
    if (e.status === 1) return []; // git grep exit 1 == "no matches", not an error
    throw e;
  }
}

describe("hardcoded surface sweep ratchet (D-25)", () => {
  it("no file outside KNOWN_EXEMPT still matches a raw palette class", () => {
    const hits = filesWithPattern("bg-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}");
    const unexplained = hits.filter((f) => !(f.replace(/\\/g, "/") in KNOWN_EXEMPT));
    expect(unexplained).toEqual([]);
  });
});
```
**Note on `git grep` exit codes:** exit code `1` means "pattern matched zero files" (not an error) and `execSync` throws on any non-zero exit — the `try/catch` above is required, confirmed by testing `execSync('git grep -lF "definitely-not-a-real-string-9x7q2" -- src')` in this session (throws with `status: 1`, empty stdout).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Tailwind v3 `tailwind.config.js` `theme.extend.transitionDuration` object | Tailwind v4 CSS-native `@theme`/`@utility` in the stylesheet itself | Tailwind v4 (major rewrite, 2025) | No JS config file exists in this repo (confirmed: no `tailwind.config.*` file found) — this is the correct, current pattern already in use |
| Regex-scraping `getComputedStyle` color strings for contrast checks | Canvas rasterisation (`fillStyle`→`getImageData`) or axe-core's internal engine | Discovered as broken in this exact repo, Phase 120 (2026-08-17) | Documented in this repo's own memory (`tailwind-v4-oklch-defeats-css-color-scraping`) — this phase must not regress to the old approach |
| `useConvex().connectionState()` polled/read once | `useConvexConnectionState()` reactive hook | Already present in installed `convex@1.42.1` | No migration needed — just use the correct hook from day one |

**Deprecated/outdated:** None of the researched mechanisms are themselves deprecated; the correction needed is choosing the *right currently-supported* mechanism (`@utility` over an unsupported `@theme` namespace; the reactive hook over the snapshot method).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended file locations `src/lib/metricState.ts` + `src/hooks/useMetricState.ts` for the shared state module | Claude's Discretion / Recommended Project Structure | Low — explicitly marked as Claude's Discretion in CONTEXT.md; the planner or executor can freely choose a different location without contradicting any locked decision |
| A2 | `ConnectionState.isWebSocketConnected` (rather than `hasEverConnected` or a composite check) is the right field for VitalsRail's dot | Pattern 3 | Low-medium — verified the field exists and its doc comment ("boolean") matches the binary red/green dot shape, but the exact UX choice (e.g. should "connecting" show yellow) is a design call the phase's executor should confirm against the sibling Ástríðr dot's exact semantics |
| A3 | axe-core's contrast engine correctly parses computed colour regardless of colour-space syntax (immune to the oklch trap) | Q3/Q4, Pitfall 3 | Low — supported by a real captured violation sample from THIS repo's own `theme-contrast.spec.ts` run (SEED-006, hex-format foreground/background in the violation message) but not independently verified against axe-core's own source code in this session; if wrong, the population count in A11Y-01 would still be internally consistent (axe would just be silently wrong in the same repo-specific way the hand probe was) — recommend a spot-check: manually verify one axe-reported violation's colours against a rasterised sample of the same element during Wave 4 |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Exact wave boundary for the primitive rewrites (`MetricCard`, `StatusBadge`, `PageHeader`, `EmptyState`) relative to the state-honesty sweep (58 Loading + 27 em-dash sites).**
   - What we know: D-28 places "the primitives" as a distinct wave after "the mechanical sweeps," and file-overlap data (Q9 below) shows `MetricCard` files and bare-"Loading" files share only 1 file in common — nearly disjoint.
   - What's unclear: whether rewriting `MetricCard.tsx` itself should happen in the SAME wave as its 36 call sites' migration to the new `state` prop, or in a separate wave (rewrite the primitive, then a follow-up wave migrates callers).
   - Recommendation: given D-13's explicit "existing props stay source-compatible with `state` added," the primitive rewrite can land in its own small wave, and caller migration (adding `state=` at each of the 36+58+27 sites) can proceed in parallel with the surface/motion/violet sweeps in waves 2-n, since D-13's backward-compatibility guarantee means unmigrated callers don't break.

2. **Whether `--astridr` needs any `@theme`/`@theme inline` registration at all, or is purely consumed via the bracket-paren `text-(--astridr)` convention already established for `--status-*` tokens.**
   - What we know: `StatusBadge.tsx:23-27` already uses `text-(--status-ok)`, `border-(--status-ok)/40` — this Tailwind v4 arbitrary-property syntax needs no `@theme` registration; it resolves the custom property directly wherever it's visible in the cascade.
   - What's unclear: whether any planned `--astridr` call site wants a "real" utility name (e.g. `bg-astridr` instead of `bg-(--astridr)`) for readability, which WOULD require `@theme inline { --color-astridr: var(--astridr); }`.
   - Recommendation: default to the bracket-paren form (zero Tailwind config, matches the established `--status-*` convention exactly); only add `@theme inline` registration if the phase's executor finds the bracket form genuinely hurts readability at the 43 call sites.

3. **A11Y-01's "before" measurement timing relative to Wave 1's checkpoint.**
   - What we know: D-21 requires the before-run to sit on Phase 120's clean surface, and D-28 requires "the A11Y-01 before-measurement runs ahead of wave 1."
   - What's unclear: whether this measurement should be a literal Wave 0 task (its own commit, before any token edits) or bundled into Wave 1's setup.
   - Recommendation: a dedicated Wave 0 task — a single `npx playwright test theme-contrast.spec.ts` run against `dev:noauth`, captured to JSON, committed BEFORE any `index.css` edit — makes the git-history control (needed independently for D-27's rasterised-assertion controls) trivially available as `git show <before-commit>:src/index.css` for the rest of the phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `tailwindcss` (+ `@tailwindcss/vite`) | TOKEN-01..05 | ✓ | 4.3.2 | — |
| `convex` (`convex/react`) | TOKEN-04 (D-16) | ✓ | 1.42.1 | — |
| `@axe-core/playwright` | A11Y-01 | ✓ | ^4.12.1 | — |
| `@playwright/test` | A11Y-01, TOKEN-03 (D-11/D-12), D-27 | ✓ | ^1.61.1 | — |
| `typescript` (`ts` module, for AST parsing) | D-25 ratchet (if AST-based, following the `Analytics.structuralGuard` precedent) | ✓ | ^6.0.3 | `git grep` alone suffices if the ratchet stays regex/string-match based rather than AST-based |
| `dev:noauth` server on port 5181 | A11Y-01 (running `theme-contrast.spec.ts` for real) | ✓ (script exists, confirmed in `package.json`) | — | Must be started manually in a separate terminal — NOT automatic via `playwright.config.ts`'s `webServer` (see Pitfall 5) |
| `child_process.execSync` (Node built-in) | D-25 ratchet | ✓ | Node 22.x (this session's `node -v` context) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — everything required is already installed and confirmed working.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Unit/ratchet framework | Vitest 4.1.9 (`vitest.config.ts`, `environment: 'jsdom'`, but Node built-ins like `child_process` work regardless — confirmed by existing `hooks/**/*.test.mjs` precedent and this session's own `execSync('git grep ...')` test) |
| E2E framework | Playwright 1.61.1 (`playwright.config.ts`) — TWO relevant server targets: gated `chromium` project (5173, default) and the manually-started `dev:noauth` server (5181, required for any REAL A11Y-01 measurement) |
| Quick run command (unit) | `npx vitest run src/index.css.ratchet.test.ts` (or wherever D-25's ratchet lands) |
| Full suite command (unit) | `npx vitest run` |
| Quick run command (E2E, contrast) | `PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts` (from Git Bash, `dev:noauth` already running in another terminal) |
| Full suite command (E2E) | `npm run test:e2e:noauth` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOKEN-01 | Every surface reads `--surface-*`/`--hairline`, no hardcoded palette classes remain outside `KNOWN_EXEMPT` | unit (corpus ratchet) | `npx vitest run <ratchet-file>` | ❌ Wave 0/4 — new file |
| TOKEN-01 | Four surfaces render as visually DISTINCT colours (not 4 aliases of the same value) per theme | E2E (rasterised) | `npx playwright test e2e/theme-rendered-result.spec.ts -g "distinct surfaces"` | ❌ Wave 4 — new file (D-27) |
| TOKEN-02 | `--status-ok` ≠ `--primary` (perceptibly separated) in all 5 themes | E2E (rasterised, named pair) | `npx playwright test e2e/theme-rendered-result.spec.ts -g "status-ok"` | ❌ Wave 4 — new file (D-22 named-pair probe) |
| TOKEN-02 | `--astridr` appears ONLY on Ástríðr-owned surfaces (no raw violet remains elsewhere) | unit (corpus ratchet) | same ratchet file as TOKEN-01, additional bucket | ❌ Wave 0/4 |
| TOKEN-03 | No `duration-NNN` class remains in `src/` | unit (corpus ratchet, exact grep already specified by D-10) | `grep -rE 'duration-[0-9]' src/` returns 0 lines — wrap as a Vitest assertion | ❌ Wave 4 |
| TOKEN-03 | No element animates under `prefers-reduced-motion`, WITH a must-differ control | E2E | `npx playwright test e2e/theme-reduced-motion.spec.ts` | ✅ file exists, extend per D-11/D-12 |
| TOKEN-04 | `MetricCard`/`useMetricState` cover all six states | unit | `npx vitest run src/hooks/useMetricState.test.ts` | ❌ Wave 3 — new file, trivially unit-testable per D-14 |
| TOKEN-04 | No bare `>Loading` / confident `—` metric remains outside named exemptions | unit (corpus ratchet) | same ratchet family | ❌ Wave 4 |
| TOKEN-05 | Every route uses `PageHeader` except named exemptions | unit (corpus/import-grep ratchet) | `git grep -L "PageHeader" -- 'src/pages/*.tsx'` minus exemptions, wrapped as a test | ❌ Wave 4 |
| A11Y-01 | Full 4×5 matrix measured, before AND after, JSON committed | E2E (existing spec, run twice) | `npx playwright test e2e/theme-contrast.spec.ts` against `dev:noauth`, before Wave 1 and after Wave 4 | ✅ file exists, run-and-record only |
| A11Y-01 | The `fee96b5d` skip-not-pass gate guard still fires when auth is present | E2E (regression check on the guard itself) | run `theme-contrast.spec.ts` against the GATED 5173 server and confirm `test.skip()` fires, not a false pass | ✅ covered by existing spec logic — verify the skip still triggers post-token-rewrite |

### Sampling Rate
- **Per task commit:** targeted `vitest run <touched-file>.test.ts` for primitive/hook changes; `git grep` spot-check of the specific pattern just swept for surface/motion/violet/badge tasks.
- **Per wave merge:** full `npx vitest run` (fast — Vitest, no browser) + the corpus ratchet (part of the same suite).
- **Phase gate (before `/gsd:verify-work`):** full Vitest suite green, full `theme-contrast.spec.ts` run against `dev:noauth` (both before-baseline diffed and after-measurement captured), `theme-reduced-motion.spec.ts` (with control) green, D-27's rendered-result spec green, `npx tsc --noEmit` clean, `npm run build` exit 0.

### Wave 0 Gaps
- [ ] The corpus-derived ratchet test file itself (D-25) — does not exist yet; follow `src/pages/Analytics.structuralGuard.test.ts` as the structural precedent (two-mutation-plus-control pattern already proven in this repo).
- [ ] `src/hooks/useMetricState.ts` + its test file — new, trivially unit-testable per D-14 (no DOM/Convex mocking needed if the hook takes a plain value + timestamp, not a live query).
- [ ] `e2e/theme-rendered-result.spec.ts` (or similarly named) for D-27's rasterised distinct-surfaces / named-pair assertions with the pre-phase-git-state control.
- [ ] The A11Y-01 "before" JSON capture — must be run and committed BEFORE any `index.css` edit lands, per D-21/D-28.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (defaults to enabled), but this phase is exclusively frontend CSS/component/token work with zero new input surfaces, zero auth changes, zero new external data ingestion, and zero new npm packages. No ASVS category applies in the conventional sense.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase touches zero auth code; Clerk gate behavior is only READ (to verify `theme-contrast.spec.ts`'s skip guard still fires, D-23/A11Y-03 handoff) |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | No | No new user input surfaces; `useMetricState` takes typed values from already-validated Convex query results |
| V6 Cryptography | No | — |

### Known Threat Patterns for this stack

None applicable — no new attack surface. The one item worth naming for completeness: `VitalsRail.tsx`'s Convex dot binding reads client-side-only `ConnectionState` data (no credentials, no PII) — confirmed by its type shape (booleans and counters only, `client.d.ts:116+`).

## Sources

### Primary (HIGH confidence)
- `node_modules/tailwindcss@4.3.2/theme.css`, `utilities.css`, `dist/lib.js` — direct read + direct compilation of the exact installed engine [VERIFIED: this session's own `compile()` calls, full output captured above]
- `node_modules/convex@1.42.1/dist/esm-types/react/client.d.ts`, `dist/esm/react/client.js`, `dist/esm-types/browser/sync/client.d.ts` — direct read of installed package source [VERIFIED]
- `src/index.css` (this repo, 733 lines, read in full) — confirms current `@theme`/`@theme inline`/theme-block structure [VERIFIED]
- `e2e/theme-contrast.spec.ts`, `e2e/theme-reduced-motion.spec.ts`, `playwright.config.ts` — read in full [VERIFIED]
- `src/pages/Analytics.structuralGuard.test.ts` — read in full, the precedent pattern for D-25 [VERIFIED]
- `.planning/STATE.md` (this repo, Phase 121 close entry) — first-party live evidence of Convex throw→SectionErrorBoundary behavior [VERIFIED, first-party]
- `.planning/phases/120-polish-verified-defects/120-DESIGN-REVIEW-HANDOFF.md`, `120-BADGE-INVENTORY.md`, `120-FABRICATION-INVENTORY.md` — read in full [VERIFIED, first-party]
- `.planning/seeds/SEED-006-wcag-contrast-remediation.md` — read in full, includes a real captured axe violation sample showing hex-normalized colour output [VERIFIED, first-party]
- `package.json` (this repo) — installed dependency versions [VERIFIED]

### Secondary (MEDIUM confidence)
- Tailwind CSS official docs (`tailwindcss.com/docs/theme`, `/docs/transition-duration`) via WebFetch — cross-verified against the direct compilation above; the docs excerpts alone were INCOMPLETE (did not confirm the `--duration-*` absence definitively) so the compilation test is the load-bearing evidence, docs are corroborating

### Tertiary (LOW confidence)
- None — every claim in this document that could be tested was tested against the installed package or live repo code in this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version pulled from installed `node_modules` or `npm view`, not assumed
- Architecture (Tailwind token mechanism): HIGH — the single most important claim (D-10's mechanism is broken) was verified by direct compilation of the exact installed engine, not training-data recall
- Architecture (Convex state semantics): HIGH — verified from installed `.d.ts`/`.js` source AND cross-confirmed by this repo's own first-party Phase 121 live evidence
- Pitfalls: HIGH — all five pitfalls are either directly demonstrated in this session or documented as already-occurred incidents in this exact repo's own history
- Validation architecture: MEDIUM-HIGH — test framework and commands confirmed live; exact file names for new test files (D-25's ratchet, D-27's rendered-result spec) are RECOMMENDATIONS, not yet-created artifacts

**Research date:** 2026-08-18
**Valid until:** Tailwind CSS is actively developed (v4.x point releases roughly monthly per npm registry history); re-verify the `@utility`-for-duration mechanism if the installed `tailwindcss` version bumps a MINOR version before this phase executes. Convex SDK behavior (useQuery/useConvexConnectionState) is stable API surface, low risk of drift within a point-release window. Recommend re-running this phase's planning within 14 days of this research, or re-verifying Q1's compilation test if `npm view tailwindcss version` has changed.
