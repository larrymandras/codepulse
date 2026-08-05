---
phase: 106-consolidation-hardening
plan: 04
subsystem: frontend
tags: [code-splitting, react-lazy, bundle-size, tone-js, vite, rollup]

# Dependency graph
requires:
  - phase: 106-02
    provides: the ANALYZE_BUNDLE chunk-composition plugin and the measured entry-chunk baseline this plan reduces
provides:
  - "every page module in src/App.tsx loaded through React.lazy behind the file's existing Suspense convention (14 conversions, 0 static page imports left)"
  - "the Tone.js synthesis library deferred out of the entry chunk into its own isDynamicEntry chunk via a memoised dynamic import (tonePromise/loadTone)"
  - "react-easy-crop deferred out of the entry chunk by lazying AvatarUploader at its app-shell import site"
  - "an ## After remediation section in 106-BUNDLE-ANALYSIS.md with three-point attribution, residual entry composition, accepted exceptions, and the DEBT-03 verdict"
  - "source-shape regression guards in src/App.test.tsx against re-introducing a static page import or dropping a Suspense wrapper"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "memoised dynamic import for a heavy runtime-only dependency: type-only namespace import for type positions, module-local `let Tone!: ToneModule` assigned by a `tonePromise ??= import(...)` loader awaited from the async init path"
    - "a failed dynamic import is rethrown AND de-memoised, so one transient chunk-fetch error cannot permanently disable the feature"
    - "source-shape tests: read the file from disk with node:fs and assert on its import/JSX shape, for invariants a module import would erase"

key-files:
  created:
    - src/lib/audioEngine.test.ts
    - src/contexts/AmbientContext.test.tsx
    - .planning/phases/106-consolidation-hardening/deferred-items.md
  modified:
    - src/App.tsx
    - src/App.test.tsx
    - src/lib/audioEngine.ts
    - src/layouts/DashboardLayout.tsx
    - .planning/phases/106-consolidation-hardening/106-BUNDLE-ANALYSIS.md

key-decisions:
  - "Re-measured the baseline from the pre-plan tree instead of quoting 106-02's prose, so before and after share a build (2,042,353 vs 106-02's recorded 2,042,261 — a 92-byte drift from four intervening commits)."
  - "Took a third, intermediate build with Task 1 applied and Task 2 not, so the two deferrals are attributed separately. That build also proved tone really was in the baseline entry chunk, which the baseline report could not show at its 30-module cap."
  - "Did NOT assert the transient Suspense fallback at runtime. Vitest's module cache lets the dynamic import resolve inside render()'s own act() flush, so the assertion failed on a different route each run. The boundary is asserted deterministically against the source instead."
  - "Exported loadTone (the plan specified an unexported loader). A private loader has no observable memoisation: under vitest's module cache a non-memoised `import()` still returns the cached module, so the mutation would have gone undetected. Promise identity across two exported calls is a real guard and does fail under the mutation."
  - "Left src/contexts/AmbientContext.tsx unmodified. It already awaits the async start() and keeps its own catch, so the deferral needed no edit there — recorded rather than churned."
  - "Did not take the refractor/Prism trim on the voice-stack chunk. It is not voice-gated, has two import sites rather than the single one the plan's action branch assumed, and is a behavioural change (which languages stop highlighting) on an already-lazy chunk. Logged to deferred-items.md, not silently dropped."

patterns-established:
  - "Every remaining >=30 kB module in the entry chunk must carry a named, concrete before-first-paint reason with a file:line for its mount site — an unexplained residual is not an accepted exception."

requirements-completed: []

# Metrics
duration: 78min
completed: 2026-08-05
---

# Phase 106 Plan 04: Entry-Chunk Remediation Summary

Cut the CodePulse entry chunk from 2,042,353 to 563,616 bytes (−72.4%) by lazying the last 14 statically-imported page routes, deferring the Tone.js synthesis library behind a memoised dynamic import, and moving `react-easy-crop` out of the app shell — with the residual floor named module by module and the warning threshold untouched.

## What Shipped

### Task 1 — 14 page routes converted to lazy (`127a0291`)

The exact static set was re-derived from the file rather than trusted from the plan text; it matched the plan's list of fourteen precisely, and all fourteen are default exports (checked per module, so all use the plain `lazy(() => import(...))` form — none needed the `.then((m) => ({ default: m.X }))` shape).

| | |
|---|---|
| `grep -cE '^import .+ from "./pages/' src/App.tsx` | 14 → **0** |
| `lazy(() => import("./pages/` occurrences | 28 → **42** (+14) |
| `<Suspense` occurrences | 32 → **46** (+14) |
| `src/App.test.tsx` tests | 1 → **19** |

Converted: `Dashboard`, `SessionDetail`, `Capabilities`, `Alerts`, `Infrastructure`, `Security`, `SelfHealing`, `BuildProgress`, `Settings`, `Memory`, `Briefings`, `Automation`, `Executions`, `Ideation`. `Dashboard` was converted too, per the plan's explicit instruction — leaving the landing route eager is what kept `@xyflow` (234,442 bytes at baseline) and the whole panel graph in the entry chunk. `AuthGuard`, `DashboardLayout`, `AstridrWSProvider`, `ProactiveAlertListener`, `FocusExitDigest` and `BrainsWsRegistrar` were left static, as instructed.

Each converted page now emits its own `dist/assets/<Page>-*.js` chunk, all fourteen with `isDynamicEntry: true`, none of which existed in the baseline build (they could not have — the pages were statically imported).

The largest entry-chunk page contributors the baseline named all left: `Settings.tsx` (42,056), `Memory.tsx` (38,265), `Security.tsx` (28,335), `Capabilities.tsx` (25,877), plus `@xyflow/react` + `@xyflow/system` (234,442) via `Dashboard`, and `@dnd-kit/core` (84,979) via `Settings` — the last confirming baseline candidate #4's "probable consequence" prediction as measured fact (it is now in `sortable.esm-*.js`, 48,493 bytes).

### Task 2 — synthesis library deferred (`ca52b923`)

`src/lib/audioEngine.ts` line 7's `import * as Tone from "tone"` is gone. In its place:

- `import type * as ToneNS from "tone"` for the two type positions (`masterVolume`, `channels`), so the file's public types are unchanged.
- A module-local `let Tone!: ToneModule` assigned by the loader, which means every one of the ~90 runtime `Tone.X` call sites is untouched.
- `tonePromise` + an exported `loadTone()` using `??=`, awaited once at the top of the already-async `SoundEngine.start()`.
- A `ForceGraph3D.tsx`-style isolation-rule docstring, written in prose ("the synthesis library") so it does not trip the plan's own acceptance greps — the failure mode plans 105-01 through 105-07 each hit independently.

A failed load is rethrown **and** de-memoised (`tonePromise = null`), so one transient chunk-fetch failure cannot leave ambient audio permanently unable to start.

`src/contexts/AmbientContext.tsx` needed no change: it already calls `engine.start()` and chains `.then(...)/.catch(...)`, so widening the entry point to await the loader was invisible to it. Recorded as a deliberate no-op rather than edited for the sake of matching `files_modified`.

### Task 3 — re-measure, plus one more deferral (`b38f3ceb`)

After tasks 1 and 2 the entry chunk was 590,788 bytes — still above 512,000 — so per the plan's instruction the residual list was worked rather than merely documented. The next real contributor was `react-easy-crop` (36,362 bytes), reaching the entry chunk through `DashboardLayout.tsx:21`'s static `AvatarUploader` import. The uploader only ever renders inside a `Dialog` that is closed on every page load, so it took the `CodeVaultGraph.tsx` sub-component lazy pattern. Entry chunk 590,788 → 563,616; new `AvatarUploader-*.js` chunk at 27,311 bytes.

`106-BUNDLE-ANALYSIS.md` gained `## After remediation` with the before/after table, the new-chunk list, the residual entry composition, the voice-chunk resolution, accepted exceptions, and the verdict.

## Measured Result

| Build | Entry chunk `renderedBytes` | Delta vs. baseline |
|---|---|---|
| Baseline (`1c26a69a`) | 2,042,353 | — |
| After Task 1 | 837,729 | −1,204,624 (−59.0%) |
| After Task 2 | 590,788 | −1,451,565 (−71.1%) |
| After Task 3 (final) | **563,616** | **−1,478,737 (−72.4%)** |

Requirement was ≥40%; delivered 72.4%.

**DEBT-03 CHUNK VERDICT: 563,616 bytes — NOT under 512,000.** The 51,616-byte residual is fully enumerated: React DOM runtime (452,138 pre-min), the Clerk auth gate wrapping every route (53,145 + 32,587), the app-wide toast host three headless shell listeners publish to (51,597), and the Radix select primitive behind the always-visible header theme switcher (42,988). Each carries a `file:line` for its mount site in the analysis. Going lower means deferring something that must execute before first paint — which moves the wait rather than removing it — or dropping a dependency, which is a product decision.

`build.chunkSizeWarningLimit` was **not** raised and no `manualChunks` was added (`grep -cE 'chunkSizeWarningLimit|manualChunks' vite.config.ts` = 0). The build still prints its over-500-kB warning for three chunks, which is the intended end state.

**Bytes were relocated, not deleted.** Total emitted JS went from 6,647,495 bytes / 111 chunks to 6,766,860 bytes / 188 chunks — about 119 kB *more* overall, from per-chunk boilerplate. A visitor who opens every route downloads slightly more than before. What changed is that a visitor to one route no longer downloads the other thirteen, the audio synthesis stack, and an image cropper.

## Mutation Proofs

Every new guard was mutated, confirmed failing, and the production line restored byte-identically (`diff -q` against a pre-mutation copy).

| # | Mutation | Result |
|---|---|---|
| 1 | `src/App.tsx`: `const Ideation = lazy(() => import("./pages/Ideation"));` → `import Ideation from "./pages/Ideation";` | **2 fail** — "statically imports zero page modules", "declares a lazy loader for every converted route" |
| 2 | `src/App.tsx`: strip the `<Suspense>` wrapper off the `/settings` route | **1 fail** — "wraps every converted route element in a Suspense boundary" |
| 3 | `src/lib/audioEngine.ts`: add a module-level static load of the library | **6 fail** across both new test files, including both "not loaded at module-evaluation time" assertions |
| 4 | `src/lib/audioEngine.ts`: `tonePromise ??= import("tone")` → `tonePromise = import("tone")` | **1 fail** — "hands back the identical promise on repeated loads (memoised)" |
| 5 | `src/lib/audioEngine.ts`: swallow the load failure (`throw err` → `return {} as ToneModule`) | **2 fail** — see the confound below |

### A confound mutation 5 exposed

On its first run, mutation 5 left "propagates a failed dynamic import to the caller" **green**. The test asserted `engine.start()` rejects — but a swallowed load resolves to an empty module object, so `Tone.start` is `undefined` and `start()` still rejects, with a downstream `TypeError`. The test was passing for the wrong reason. It now asserts on `loadTone()` directly first, and the mutation was re-run against the strengthened version: 2 failures.

A separate near-miss is worth recording: the first attempt at mutation 5 used a multi-line `perl -0pi` pattern that silently matched nothing against this repo's CRLF line endings, and the resulting "7 passed" briefly looked like a green-under-mutation result. Verifying the mutation actually landed (`sed -n` on the edited region) before believing the run is what caught it.

## Deviations from Plan

### 1. [Rule 2 — missing critical functionality] `loadTone` is exported, not unexported

- **Found during:** Task 2, designing the memoisation test.
- **Issue:** The plan specified "a small unexported function". With the loader private, memoisation has no observable effect in vitest: the module registry caches `tone`, so a non-memoised `import("tone")` still returns the same module and the `??=` → `=` mutation goes undetected. The test would have been green under its own mutation — i.e. not a guard.
- **Fix:** Exported `loadTone`, and the memoisation test asserts *promise identity* (`loadTone() === loadTone()`). `import()` returns a fresh promise on every call even for a cached module, so the mutation genuinely breaks it (proof #4).
- **Files modified:** `src/lib/audioEngine.ts`
- **Commit:** `ca52b923`

### 2. [Rule 2 — missing critical functionality] De-memoise a failed load

- **Found during:** Task 2.
- **Issue:** A plain `tonePromise ??= import(...)` caches a *rejected* promise forever. One transient network failure would leave ambient audio unable to start for the rest of the page's life, which contradicts the plan's requirement that failures be surfaced without breaking the feature.
- **Fix:** The `.catch` nulls `tonePromise` before rethrowing. Guarded by a test that fails the load, then succeeds on retry.
- **Files modified:** `src/lib/audioEngine.ts`
- **Commit:** `ca52b923`

### 3. [Rule 1 — bug] Racy fallback assertion replaced with a deterministic structural one

- **Found during:** Task 1.
- **Issue:** The behavior block asks each route to be asserted "reached through a Suspense boundary". The first implementation asserted the fallback text was present immediately after `render()`. It failed intermittently on a *different route each run* — vitest's ESM cache often resolves the dynamic import inside the `act()` flush `render()` already performs, so the fallback is never committed to the DOM. Asserting it is a race against module-cache state, not against the code.
- **Fix:** Runtime tests assert each route's own `<h1>` appears via `findByRole` (the app shell renders no `<h1>`, so this cannot be satisfied by the shell); a separate source-shape test asserts the exact `<Suspense fallback=...>` wrapper exists for all 14 routes. Both facts are covered, neither racily.
- **Files modified:** `src/App.test.tsx`
- **Commit:** `127a0291`

### 4. [Rule 3 — blocking issue] `convex/react` mock widened

- **Found during:** Task 1.
- **Issue:** Four routes (`/alerts`, `/security`, `/briefings`, `/executions`) crashed once actually navigated to: `App.test.tsx`'s `vi.mock('convex/react')` provided only 5 exports, and those pages reach `usePaginatedQuery` / `useAction`. Previously invisible because no test ever rendered those routes.
- **Fix:** Added `usePaginatedQuery` and `useAction` — the complete remaining set, derived by grepping every `convex/react` import across `src/`, not by adding them one failure at a time.
- **Files modified:** `src/App.test.tsx`
- **Commit:** `127a0291`

### 5. [Rule 1 — bug] `findBy*` timeouts under full-suite load

- **Found during:** Task 3's full-suite run.
- **Issue:** `src/App.test.tsx` passed in isolation but three route cases failed in the full suite with "Unable to find role=heading" — a `findBy*` timeout, not a missing element. These cases genuinely transform and import whole page trees on demand, which exceeds testing-library's 1s default when 292 files are running in parallel.
- **Fix:** Wait window widened to 20 s with a matching per-test timeout. The assertions themselves are unchanged; nothing was weakened or skipped. Three consecutive clean full-suite runs afterwards.
- **Files modified:** `src/App.test.tsx`
- **Commit:** `b38f3ceb`

### 6. [Task 3 scope] `src/layouts/DashboardLayout.tsx` modified, though not in `files_modified`

Task 3's action explicitly directs: "If the entry chunk is still at or above 512 000 bytes after tasks 1 and 2, do not stop at documenting it. Work down the residual list … and defer the next real contributor." It was (590,788), so `AvatarUploader` was deferred at its shell import site. Authorised by the task text; recorded here because the frontmatter's `files_modified` did not anticipate it.

### 7. Stale CLAUDE.md claim, not fixed here

`CLAUDE.md`'s Testing section states `src/test/setup.ts` "mocks heavy externals (Clerk, Recharts, Three.js, Globe, React Flow, Tone.js)". It does not mock Tone.js — the file was read in full and has no `tone` mock; before this plan, no test file mocked `tone` at all. Both new test files supply their own factory. Flagged rather than edited, to keep this plan's diff to its subject; worth a one-line correction in a later plan.

## Known Stubs

None. No placeholder values, empty-array literals feeding UI, or TODO markers were introduced.

## Deferred Issues

Logged to `.planning/phases/106-consolidation-hardening/deferred-items.md`:

1. **`src/pages/Chat.test.tsx:576` is intermittently failing.** Caught on the *pre-change* baseline run (run 1 of 3 failed; runs 2–3 passed at 3401/3401 on the untouched tree at `1c26a69a`). It did not recur in any of the three post-change full-suite runs, but an intermittent failure is not cleared by a passing run. Pre-existing, unrelated to the bundle work, and belongs to the Chat/brains surface.
2. **The `react-syntax-highlighter` / refractor language-allowlist trim (~774,578 bytes).** Baseline remediation candidate #1, reasoning written up in `106-BUNDLE-ANALYSIS.md` § 4. Still open and unclaimed.

## Threat Model

All three registered mitigations were applied:

- **T-106-12** (routes behind new lazy boundaries): every converted route keeps the file's existing Suspense fallback (asserted structurally for all 14) and is asserted to render its real page via `findBy*` (asserted at runtime for all 14). Full suite and `npm run build` both clean.
- **T-106-13** (ambient audio init failure after deferral): the existing failure surfacing is preserved and de-memoised; two tests cover a rejecting dynamic import, and a fourth covers the provider surviving a rejected `start()`.
- **T-106-14** (`dist/chunk-composition.json` disclosure): the `ANALYZE_BUNDLE=1` gate was not touched. Verified live — a default `npm run build` emits no `chunk-composition.json`.
- **T-106-SC** (package installs): nothing installed. `git diff --stat package.json package-lock.json` is empty.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary. All changes are import-shape and test-only.

## Verification

| Gate | Result |
|---|---|
| `grep -cE '^import .+ from "./pages/' src/App.tsx` | `0` |
| `grep -c 'import \* as Tone from' src/lib/audioEngine.ts` | `0` |
| `grep -c 'tonePromise' src/lib/audioEngine.ts` | `4` (≥2) |
| Entry chunk contains no `node_modules/tone/` module | asserted by the plan's node one-liner, exit 0 |
| A chunk with `isDynamicEntry: true` holds `node_modules/tone/` modules | `assets/esm-DfzvAqi2.js`, 340,276 bytes |
| Entry chunk ≥40% below baseline | **72.4%** below |
| `grep -cE 'chunkSizeWarningLimit\|manualChunks' vite.config.ts` | `0` |
| `git diff --stat package.json package-lock.json` | empty |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `npx vitest run` | **3430 passed**, 193 todo, 0 failed (baseline 3401) — three consecutive clean runs |
