# Phase 123: Accessibility Remediation - Research

**Researched:** 2026-08-20
**Domain:** WCAG-AA contrast remediation (Tailwind v4 opacity-modifier tokens), axe-core scan widening, Playwright skip-vs-fail harness mechanics
**Confidence:** HIGH — every population figure and every harness-mechanics claim below was re-derived live against this repo's installed toolchain (Tailwind 4.3.2, Playwright 1.61.1) this session, not inherited from CONTEXT.md or training data.

## Summary

Phase 122 froze the palette and measured the damage; Phase 123 fixes it. The corpus re-derives
cleanly: **176 occurrences** across the three `text-primary/NN` / `text-muted-foreground/NN` /
`text-(--token)/NN` families match CONTEXT.md exactly, but the **file count is 65, not 75** —
re-derived two independent ways, both agreeing. The route denominator (47 = 42 top-level + 5 under
`hr/`) and the 184-of-205-nodes DashboardLayout attribution both reproduce exactly.

The single most consequential finding is mechanical, not numerical: Tailwind v4 compiles every
`/NN` opacity modifier on a `var()`-backed token into `color-mix(in oklab, var(--token) NN%,
transparent)` inside an `@supports` block (verified against this repo's own production build
output, not docs). Deleting the modifier is therefore a clean, predictable no-op — it just removes
the `@supports` override and falls back to the unconditional `color:var(--token)` rule already
present above it — which validates D-04's "default is delete" remedy. It also strengthens the case
against the analytic-composite option D-02 rejected: `color-mix(in oklab, ...)` is a perceptual
mix, not a linear alpha blend, so even a correctly-guessed ancestor color could not be composited
correctly by hex+alpha arithmetic. Rasterisation is the only sound method, for two independent
reasons, not one.

The second major finding is a live empirical test of D-11's fail-on-skip mechanism, run three ways
against this repo's actual Playwright 1.61.1 install. A `test.afterAll` hook that throws **does**
fail the run (verified: real, unpiped `$?` = 1), but it **overwrites the `result.status` of
whichever test ran last in that hook's scope from `"skipped"` to `"failed"`** — destroying exactly
the three-way distinction D-11 says is the point of keeping `test.skip()`. A `globalTeardown` script
reading a filesystem side-channel does not have this defect: verified live, all skipped cells kept
`result.status: "skipped"`, the run still exited 1. This is the recommended mechanism, not
`test.afterAll`.

**Primary recommendation:** re-derive every population figure at plan time exactly as CONTEXT.md
instructs (do not adopt 176/75 wholesale — 176 is right, 75 is wrong, 65 is right); implement D-11
via `globalTeardown` + an `fs`-based side-channel log, not `test.afterAll`; reuse
`e2e/theme-rendered-result.spec.ts`'s sentinel-guarded `sampleColor`/`compositeSample` primitives
verbatim for D-02's isolation harness rather than writing new ones.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Opacity-modifier sweep (D-01/D-04) | Frontend / Browser (CSS) | — | Pure Tailwind class edits in `src/`; no backend involvement |
| Contrast measurement harness (D-02, D-16, D-17) | Browser (Playwright + axe-core) | — | Runs against a rendered page in a real browser context; axe resolves colour from the live CSSOM |
| Skip/fail guard mechanics (D-11–D-14) | Test-runner tooling (Playwright process orchestration) | Browser | The guard logic runs in Node (Playwright's test runner / `globalTeardown`), but what it observes (Clerk gate, page content) is browser-rendered |
| ARIA markup fixes (D-05, D-06) | Frontend / Browser (JSX/DOM) | — | Attribute-level JSX edits; no data layer involvement |
| `PageHeader` adoption (D-09) | Frontend / Browser (React component) | — | Pure component substitution, no backend |
| Operator visual checkpoint (D-18) | Human / Browser | — | Not automatable by construction — a perceptual judgment call |

Everything in this phase lives in the browser/frontend tier or in Node-side test tooling. There is
no backend (Convex) surface in scope — confirmed by CONTEXT.md's explicit boundary and by this
phase's own file list, none of which touches `convex/`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| A11Y-02 | `e2e/theme-contrast.spec.ts` passes against `dev:noauth` with zero `wcag2a`/`wcag2aa` violations, across every theme × page cell A11Y-01 measured | Corpus re-derivation (§1), Tailwind opacity-modifier mechanics (§2), rasterisation harness reuse (§3), axe scan widening mechanics (§4), aria-prohibited-attr / aria-busy census (§6–§7), folded-todo current-state verification (§8) |
| A11Y-03 | The contrast suite cannot report green against a page it never rendered | Empirical Playwright skip/fail mechanics (§5), including the `test.afterAll` status-overwrite defect and the verified `globalTeardown` alternative |
</phase_requirements>

## Standard Stack

No new external packages are needed for this phase. Everything required already ships in this
repo's `package.json`:

| Library | Installed version | Purpose | Confidence |
|---------|-------|---------|--------------|
| `@axe-core/playwright` | 4.12.1 | Live-DOM accessibility scanning (`wcag2a`/`wcag2aa` tags), immune to the oklch-scrape trap because it resolves colour from the CSSOM, not from a string | `[VERIFIED: package.json + `node_modules` read]` |
| `@playwright/test` | 1.61.1 (confirmed via `node_modules/@playwright/test/package.json`, not `^1.61.1` from `package.json` alone) | E2E harness, `globalSetup`/`globalTeardown` hooks, JSON reporter | `[VERIFIED: npx playwright --version + node -e require(...).version]` |
| `tailwindcss` | 4.3.2 (confirmed via `node_modules/tailwindcss/package.json`) | CSS engine emitting the `color-mix(in oklab, ...)` opacity-modifier CSS this phase's sweep depends on understanding | `[VERIFIED: node -e require(...).version]` |

No package legitimacy audit is required — no packages are being added.

## Package Legitimacy Audit

Not applicable. This phase adds zero external dependencies; every tool used is already installed
and verified above.

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  SOURCE: src/**/*.tsx  (176 opacity-modifier occurrences, 65 files)  │
│  ├─ text-primary/NN            (86 occurrences)                     │
│  ├─ text-muted-foreground/NN   (88 occurrences)                     │
│  └─ text-(--status-*)/NN       (2 occurrences)                      │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ Tailwind v4 JIT compile
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  COMPILED CSS: .text-muted-foreground\/80{color:var(--token)}       │
│  @supports(color:color-mix(...)){ ...{color:color-mix(in oklab,     │
│    var(--token) 80%, transparent)} }                                │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ browser paint (real ancestor stack)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MEASUREMENT — two passes, every ledger row labelled by which one   │
│                                                                       │
│  PASS 1: axe-core (widened to 47 routes × 4 themes = 188 cells)     │
│    → e2e/theme-contrast.spec.ts, AxeBuilder#analyze()               │
│    → resolves colour from live CSSOM directly (immune to oklch trap)│
│                                                                       │
│  PASS 2: isolation harness (unreachable/state-gated sites)          │
│    → extends e2e/theme-rendered-result.spec.ts's sentinel-guarded   │
│      sampleColor/compositeSample (canvas getImageData)              │
│    → NEW: read computed font-size/weight for the D-03 large-text    │
│      threshold (not yet present in the reused file)                 │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ ratio < threshold?
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  REMEDY (D-04): delete /NN by default; swap token only if           │
│  hierarchy collapses; never reintroduce alpha                       │
└───────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  HARNESS TRUST (A11Y-03) — orthogonal to the above                  │
│  ├─ D-11: fail-on-skip — globalTeardown + fs side-channel           │
│  │        (test.afterAll REJECTED, see §5 — it corrupts result      │
│  │        status on the last-run test in its scope)                │
│  ├─ D-13: per-page content marker — each page's own <h1>            │
│  │        (PageHeader renders one on 4/5 measured routes; Forge's   │
│  │        hand-rolled <h1> is the 5th, until D-09 lands)            │
│  └─ D-14: A11Y_MEASURE_ONLY made non-green                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new directories. This phase edits existing files in place:

```
src/
├── layouts/DashboardLayout.tsx     # :91, :148, :607-620 — 184 of 205 nodes
├── components/
│   ├── forge/ForgeJobList.tsx      # :172-175 aria-prohibited-attr; check :227 aria-selected too
│   ├── skills/SkillReviewDrawer.tsx
│   ├── StatusBadge.tsx             # :53-56 — the control D-05 copies from
│   ├── IdeationRow.tsx / InboxCard.tsx / ScanResultsPanel.tsx / TaskDetail.tsx  # D-05 warn-fill
│   └── SwarmTaskNode.tsx           # D-08 — deliberately NOT converted, boundary only
├── pages/ForgePage.tsx             # D-09 — PageHeader adoption, :150-159
├── index.css                       # D-07 — add @source not "../scripts"
└── tokenSweep.ratchet.test.ts      # D-17 — NOT extended, stays as-is

e2e/
├── theme-contrast.spec.ts          # D-11/D-13/D-14/D-16 edits; PAGES array widened
├── theme-rendered-result.spec.ts   # D-02 pass-2 primitives reused/extended
└── global-teardown-*.ts (NEW)      # D-11's recommended mechanism, see §5

scripts/
└── migrate_tokens.py               # D-07 — literal "bg-gray-950/50" still present, :24
```

### Pattern 1: Sentinel-guarded rasterised colour sampling (reuse verbatim)

**What:** `sampleColor`/`compositeSample` in `e2e/theme-rendered-result.spec.ts` hand a raw CSS
colour string to `canvas.fillStyle` (the browser's real parser), set a magenta sentinel first, and
return `null` rather than a guess if the fill never moved off the sentinel.

**When to use:** D-02's isolation harness (pass 2) for every site axe cannot reach.

**Example (existing code, `e2e/theme-rendered-result.spec.ts:84-99`):**
```typescript
// Source: this repo, e2e/theme-rendered-result.spec.ts:84-99
async function sampleColor(page: Page, cssColorString: string): Promise<RGB | null> {
  return page.evaluate(
    ({ color, SENTINEL }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = SENTINEL;
      ctx.fillStyle = color; // unparseable input silently leaves fillStyle at SENTINEL
      if (ctx.fillStyle.toLowerCase() === SENTINEL) return null;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b] as [number, number, number];
    },
    { color: cssColorString, SENTINEL },
  );
}
```
The file also already exports `contrastRatio` (WCAG relative-luminance formula) and
`relativeLuminance` — D-02/D-03 need no new colour math, only a font-size/weight reader added
alongside the existing `getThemeTokenText`.

### Pattern 2: `globalTeardown` + filesystem side-channel for cross-worker aggregation (NEW, verified this session)

**What:** Playwright's default config (`fullyParallel: true`, `workers: undefined`) runs tests
across multiple worker **processes**. A module-scope JS variable is per-process and cannot see
skips recorded in sibling workers — the same caveat `theme-rendered-result.spec.ts` already
documents for its `allSamples` array. `test.afterAll` additionally **corrupts** the status of
whichever test happened to run last in its scope (see §5 for the full empirical comparison). A
`globalTeardown` script, by contrast, runs exactly once in the main process after every worker
exits, and can safely read an `fs`-based log that every worker process appended to.

**When to use:** D-11's fail-on-skip mechanism.

**Verified working recipe** (this session, against this repo's real Playwright install, 6 skip
sites split across 6 parallel worker processes — exit code 1, **zero** cells misreported as
`"failed"`, all 6 correctly retained `result.status: "skipped"`):

```typescript
// playwright.config.ts
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/theme-contrast.global-teardown.ts', // NEW
  // ...
});

// e2e/theme-contrast.global-teardown.ts
import { readFileSync, existsSync } from "node:fs";

export default function globalTeardown() {
  const p = "e2e/.a11y-skip-log.txt"; // must be cleared in globalSetup at run start
  const count = existsSync(p) ? readFileSync(p, "utf8").trim().split("\n").filter(Boolean).length : 0;
  if (count > 0) {
    throw new Error(`${count} contrast-suite cell(s) were skipped (Clerk gate) -- suite must fail`);
  }
}

// inside each test, on the skip branch:
import { appendFileSync } from "node:fs";
appendFileSync("e2e/.a11y-skip-log.txt", `${theme}__${pg.name}\n`);
test.skip(true, "...");
```

**Implementation caveats found empirically, not in any doc:**
- The log file must be truncated/removed at the *start* of a run (in `global-setup.ts`, which this
  repo already has wired for Clerk token fetching) — otherwise a stale file from a previous failing
  run will fail a subsequent clean run.
- Write the log path outside `src/`/`dist/` and add it to `.gitignore` if it lives under `e2e/`.
- This mechanism is a straight upgrade over `test.afterAll` — same non-zero exit code, but with the
  per-cell `result.status`/`stats.skipped` bucket left intact.

### Anti-Patterns to Avoid

- **Module-scope counter + `test.afterAll` for D-11:** verified this session to have two distinct
  failure modes depending on scoping (see §5's full empirical trace). Either it corrupts one
  arbitrary test's status per worker into `"failed"` (destroying the "never rendered" vs
  "rendered clean" vs "violating" distinction D-11 exists to preserve), or — if forced onto a
  single worker via `test.describe.configure({ mode: "serial" })` to get an accurate global count —
  it serialises the entire matrix, working directly against D-16's "the scan is cheap because it's
  parallel" runtime goal.
- **Analytic hex+alpha composite for the isolation harness (D-02, already rejected, reinforced
  here):** Tailwind v4's opacity modifier is a `color-mix(in oklab, ...)` perceptual mix, not a
  linear sRGB alpha blend. Even with a correctly-identified ancestor colour, hand-computing the
  composited colour from hex + alpha would not match what the browser actually paints.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sentinel-guarded colour sampling | A second canvas rasteriser | `sampleColor`/`compositeSample` in `e2e/theme-rendered-result.spec.ts` | Already exists, already sentinel-guarded against the `fillStyle` silent-retain trap, already used and trusted by 122 |
| WCAG contrast-ratio math | A new luminance formula | `contrastRatio`/`relativeLuminance` in the same file | Already correct, already the unit every 122 figure is stated in |
| Cross-worker test aggregation | A custom Playwright reporter plugin | `globalTeardown` + `fs` side-channel (§ Pattern 2) | Verified minimal, verified correct, no new dependency |

**Key insight:** Phase 122 already built and hardened every colour-measurement primitive this phase
needs. The only genuinely new code is (a) the font-size/weight reader for D-03's large-text
threshold, and (b) the `globalTeardown` skip-aggregation script for D-11.

## Common Pitfalls

### Pitfall 1: Trusting CONTEXT.md's "75 files" without re-deriving

**What goes wrong:** The planner sizes wave/plan boundaries against a file count that is off by 10
(75 claimed vs. 65 actual).
**Why it happens:** CONTEXT.md's own D-01 text explicitly warns of this ("discussion measured 176
occurrences in 75 files ... the planner must re-derive the exact population at plan time"), but the
number is easy to skim past as already-verified.
**How to avoid:** Re-derived twice this session (`grep -rlE` with a combined alternation, and
`grep -rlE` per-family piped through `sort -u`) — both agree at **65**. The 176-occurrence figure
does independently reproduce exactly. Use 65, not 75.
**Warning signs:** Any plan or ledger that carries "75 files" forward without its own `grep -rl`
re-derivation command attached.

### Pitfall 2: Assuming `test.afterAll` preserves per-cell skip status

**What goes wrong:** A "the cell still reads skipped, the suite fails" claim is taken as
self-evidently satisfied by any hook that throws when a skip counter is non-zero. It is not — see
§5's empirical trace.
**Why it happens:** Playwright's hook-error attribution (attach the error to whichever test ran
last in that hook's scope, overwriting its `result.status`) is a real but non-obvious runner
behaviour, and the failure mode is silent — the run does fail correctly, so a superficial check
("does the suite go red? yes") does not catch the status corruption.
**How to avoid:** Use the `globalTeardown` recipe in Pattern 2, verified this session to leave
`result.status: "skipped"` on every cell.
**Warning signs:** After implementing, grep the JSON reporter output for `"status": "failed"` among
tests whose `annotations` carry `type: "skip"` — any hit is this defect.

### Pitfall 3: `getComputedStyle` colour scraping (already known, restated for completeness)

Already documented project-wide (`[[tailwind-v4-oklch-defeats-css-color-scraping]]`,
`122-CONTRAST-BASELINE.md`'s Method section). Re-confirmed this session against the actual compiled
CSS: `.text-muted-foreground\/80{color:var(--muted-foreground)}` plus an `@supports` override —
neither form is a plain rgb()/hex string a regex could safely parse, and `--muted-foreground`
itself is hex in the dark themes but `oklch()` in the light `:root` (`src/index.css:110`), so a
number-scrape would silently misparse depending on which theme happens to be active.

## Code Examples

### Compiled CSS for the opacity-modifier idiom (verified via `npx vite build`, this session)

```css
/* Source: dist/assets/index-*.css (this repo's own production build, 2026-08-20) */
.text-muted-foreground\/80{color:var(--muted-foreground)}
@supports (color:color-mix(in lab, red, red)){
  .text-muted-foreground\/80{color:color-mix(in oklab, var(--muted-foreground) 80%, transparent)}
}
.text-primary\/60{color:var(--primary)}
@supports (color:color-mix(in lab, red, red)){
  .text-primary\/60{color:color-mix(in oklab, var(--primary) 60%, transparent)}
}
.text-\(--status-warn\)\/80{color:var(--status-warn)}
@supports (color:color-mix(in lab, red, red)){
  .text-\(--status-warn\)\/80{color:color-mix(in oklab, var(--status-warn) 80%, transparent)}
}
```

**Consequence for D-04:** deleting `/NN` from any of these three families removes only the
`@supports` block. The un-suffixed base rule (`color:var(--token)`, full opacity) is *already
compiled* immediately above it — verified this is true for every occurrence sampled, not just
these three. There is no risk of the base rule being absent; Tailwind always emits both.

### The three real corpus-count commands (re-run these at plan time, do not reuse cached numbers)

```bash
# occurrences (176 total) -- grep -o, not grep -c
grep -rhoE 'text-primary/[0-9]+' src | wc -l                          # 86
grep -rhoE 'text-muted-foreground/[0-9]+' src | wc -l                 # 88
grep -rhoE 'text-\(--[a-zA-Z-]+\)/[0-9]+' src | wc -l                 # 2

# files (65, NOT 75) -- grep -rl, union via sort -u, verified two ways
{ grep -rlE 'text-primary/[0-9]+' src; \
  grep -rlE 'text-muted-foreground/[0-9]+' src; \
  grep -rlE 'text-\(--[a-zA-Z-]+\)/[0-9]+' src; } | sort -u | wc -l   # 65

# of those 65, exactly 1 is a test file
grep -rlE 'text-primary/[0-9]+|text-muted-foreground/[0-9]+|text-\(--[a-zA-Z-]+\)/[0-9]+' src \
  | grep -c '\.test\.'                                                # 1 (JobsPanel.test.tsx)
```

### Route population (47, reproduces exactly)

```bash
ls src/pages/*.tsx | grep -v '\.test\.' | wc -l          # 42
ls src/pages/*/*.tsx | grep -v '\.test\.' | wc -l         # 5 (src/pages/hr/)
# control -- do not propagate:
ls src/pages/*.tsx | wc -l                                # 62 (includes tests)
```

All 47 non-test page files have a corresponding lazy-imported `<Route>` in `src/App.tsx` — verified
by diffing the file population against every `import("./pages/...")` call in `App.tsx`: zero
orphans in either direction. `SessionDetail` (`/sessions/:id`) and `QualityDetail`
(`/quality/:profileId`) are the only two of the 47 whose route requires a path param; both are
still directly navigable (e.g. `/sessions/nonexistent`), they will just render whatever
loading/empty/error state the component defines for a missing record — worth a one-line decision
at plan time on whether that counts as "the page's content rendered" for D-13's marker.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `test.skip()` alone, no run-level guard | `test.skip()` + `globalTeardown` fail-on-skip | This phase (D-11) | Closes the vacuous-pass path a bare skip leaves open |
| App-shell nav as the "page rendered" marker | Per-page `<h1>` (via `PageHeader`, or Forge's own until D-09 lands) | This phase (D-13) | Distinguishes "page shell rendered" from "page content rendered" — `/analytics` can legitimately render as shell + `SectionErrorBoundary` fallbacks and currently still counts as "rendered" |
| 5-route matrix | 47-route scan, 20-cell criterion (checkpoint to widen) | This phase (D-16) | ~9.4× more axe coverage at roughly proportional (still sub-few-minute) cost, per 122's own 12.2s-for-20-cells timing |

**Deprecated/outdated:** none — this is a remediation phase working entirely within Phase 122's
frozen token layer and Phase 122's existing harness files; nothing here supersedes a prior
approach that is still in active use elsewhere.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 188-cell (47×4) scan will complete in "minutes", extrapolated linearly from 122's measured 12.2-14.4s for 20 cells, NOT independently re-measured this session (no `dev:noauth` server was started to avoid port/process conflicts with concurrent sessions) | §4 / Code Examples runtime note | If axe scan cost is non-linear per additional route (e.g. some of the 42 unmeasured routes are far heavier than the 5 measured ones), the actual runtime could exceed "minutes"; low risk since axe cost scales with DOM size, not route count, and nothing suggests the unmeasured routes are exceptional |
| A2 | The `aria-selected={isSelected}` on a plain `<button>` at `ForgeJobList.tsx:227` is a plausible second `aria-prohibited-attr`-family violation the widened scan will surface | § Recommended Project Structure | Not verified by actually running axe against it this session — flagged from ARIA-spec knowledge only (aria-selected is role-restricted to option/row/tab/gridcell/etc., not button). If wrong, it simply doesn't fire and the D-06 measurement-defined sweep correctly ignores it — no downside to flagging it as a hypothesis |
| A3 | `test.afterAll`'s status-overwrite behaviour (attaching a thrown hook error to the last-run test in its scope) generalises beyond the exact describe-block/serial-mode shapes tested this session | §5 | Verified in 3 concrete configurations (describe-scoped parallel, serial-mode single-worker, and the working globalTeardown alternative) against this repo's actual Playwright 1.61.1 install — HIGH confidence for THIS version; Playwright's hook-error-attribution behaviour is not something this session found documented explicitly in official docs, so treat as empirically-verified-here rather than officially-guaranteed-stable across future Playwright upgrades |

## Open Questions

1. **How should D-13's marker table handle the two param routes (`/sessions/:id`,
   `/quality/:profileId`) if the 47-route criterion is ever widened past the current 20 cells?**
   - What we know: both are directly navigable with a placeholder/garbage param and will render
     *some* state (likely an empty/error state, not a 404 — React Router doesn't 404 on a
     mismatched param, only on an unmatched path).
   - What's unclear: whether that empty/error state constitutes "the page's content rendered" for
     marker purposes, or whether these two need a seeded real ID to be meaningfully scanned at all.
   - Recommendation: out of scope for A11Y-02's held-at-20-cells criterion this phase; worth a
     one-line note in the widened-scan ledger rather than blocking on it.

2. **Does the `aria-selected` button at `ForgeJobList.tsx:227` actually fire `aria-prohibited-attr`
   under axe?**
   - What we know: the ARIA spec restricts `aria-selected` to specific roles; a bare `<button>`
     does not carry one of them.
   - What's unclear: not run against axe this session (see Assumption A2).
   - Recommendation: let D-06's measurement-defined sweep answer this once the widened matrix runs
     on `/forge` — do not pre-fix it on spec-reading alone, consistent with D-06's own "no
     hand-maintained census" rejection.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `dev:noauth` server (`:5181`) | A11Y-02 measurement runs | Not running this session (not started, to avoid conflicting with concurrent sessions' servers) | — | Start via `VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`, issued from Git Bash per this repo's own documented gotcha (PowerShell empty-string assignment deletes the var) |
| `npm run dev` server (`:5173`) | D-18 operator checkpoint, ad-hoc probes | Yes — confirmed live throughout this session (200 on every probe) | — | — |
| Playwright browsers (chromium) | All e2e work | Yes — used throughout this session for the skip/fail probes | Playwright 1.61.1 | — |
| axe-core / `@axe-core/playwright` | A11Y-02 scan | Yes, installed | 4.12.1 | — |
| Live gated `:5173` run of the full 20/188-cell matrix (D-12's evidence half) | A11Y-03 verification | **Structurally blocked for an agent** — `122-CONTRAST-BASELINE.md` records this exact attempt being stopped by the session's own permission classifier before execution, same class of block as `npx convex deploy` | — | Operator-run, per D-12's own design (this is why D-12 splits into a self-test half + an operator-run evidence half) |

**Missing dependencies with no fallback:** none — the one structurally-blocked item (live gated-server
verification) already has its fallback designed into D-12 itself (operator runs it).

**Missing dependencies with fallback:** `dev:noauth` server — trivial to start, documented recipe
above, not started this session purely to avoid a port/process collision with concurrent sessions
also working in this repo.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.61.1 (`@playwright/test`), axe-core via `@axe-core/playwright` 4.12.1 |
| Config file | `playwright.config.ts` (`fullyParallel: true`, `workers: undefined` outside CI, `globalSetup: './e2e/global-setup.ts'`) |
| Quick run command | `PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts --grep "\[cyan\] Dashboard"` (single cell, seconds) |
| Full suite command | `VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth` (separate terminal) then `PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts` (20-cell current matrix; widen `PAGES` for the 47-route scan) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| A11Y-02 | Zero `wcag2a`/`wcag2aa` violations across every measured cell | e2e (axe) | `PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts` | Yes, `e2e/theme-contrast.spec.ts` |
| A11Y-02 (near-miss / unreachable sites) | Rasterised ratio ≥ WCAG threshold for sites axe cannot reach | e2e (canvas rasterisation) | `npx playwright test e2e/theme-rendered-result.spec.ts` (extend, don't replace) | Yes, needs extension for D-02 pass 2 + D-03's font-size/weight read |
| A11Y-03 | Guard still fires against a genuinely gated server | e2e (self-test) + operator-run live evidence | Self-test: new spec injecting the gated sign-in state deterministically. Live evidence: operator runs the matrix against `:5173` | Self-test: ❌ Wave 0 (new file). Live evidence: operator action, not automatable |
| A11Y-03 | Suite exits non-zero on any skip, without corrupting per-cell status | e2e (harness mechanics) | The `globalTeardown` recipe in this document, Pattern 2 | ❌ Wave 0 (new `globalTeardown` file + `global-setup.ts` edit to clear the log) |
| A11Y-03 | Content marker distinguishes shell-only from content-rendered | e2e (per-page `<h1>` wait) | Extend `theme-contrast.spec.ts`'s existing `PAGES` array with a marker field | Partial — `PAGES` array exists, marker column does not yet |

### Sampling Rate

- **Per task commit:** single-cell quick run (`--grep` one theme×page) after any sweep edit that
  touches a shared-chrome file (`DashboardLayout.tsx`); full 20-cell run after any change to
  `theme-contrast.spec.ts` itself.
- **Per wave merge:** full current 20-cell matrix, `A11Y_MEASURE_ONLY=1` first (sizing, always
  completes) then unset (remediation gate).
- **Phase gate:** widened 47×4 scan (D-16) at minimum once, before `/gsd:verify-work`; D-18's
  operator checkpoint is a separate, additional, blocking gate that no automated run substitutes
  for.

### Wave 0 Gaps

- [ ] `e2e/theme-contrast.global-teardown.ts` — the fail-on-skip mechanism (D-11), verified working
      pattern in Pattern 2 above; does not exist yet.
- [ ] `e2e/global-setup.ts` edit — truncate the skip-log file at run start, so a stale file from a
      previous failing run cannot fail a subsequent clean one.
- [ ] A D-12 self-test spec that deterministically injects the gated sign-in state (stub auth /
      render the gated shell) without a live Clerk key or gated server — does not exist yet.
- [ ] Font-size/weight reader added to `e2e/theme-rendered-result.spec.ts` (or a new sibling file)
      for D-03's large-text threshold in the isolation harness's pass 2.
- [ ] `PAGES` array in `e2e/theme-contrast.spec.ts` needs a per-route marker column for D-13, and
      widening to all 47 routes for D-16 (both are edits to the same array, sequence per the
      planner's discretion).

## Security Domain

Not applicable — `security_enforcement` is not referenced anywhere in `.planning/config.json`
(absent = default, but this phase touches zero authentication, authorization, input-validation, or
cryptography surfaces; it is a pure CSS/ARIA-markup/test-harness remediation phase with no new
attack surface). No ASVS categories apply.

## Sources

### Primary (HIGH confidence — verified live against this repo this session)
- This repo's own `npx vite build` production output (`dist/assets/index-*.css`) — the compiled
  `color-mix(in oklab, ...)` mechanism for opacity-modifier tokens.
- Three empirical Playwright 1.61.1 test-runner probes, run and cleaned up this session (scratch
  specs in `e2e/`, `playwright.config.ts` temporarily edited and restored via `git checkout`,
  verified `git status --porcelain` clean before and after) — the `test.afterAll` status-overwrite
  behaviour and the `globalTeardown` alternative.
- `git grep`/`grep -rhoE`/`grep -rlE` corpus re-derivation commands, run live against `src/` this
  session — the 176-occurrence / 65-file / 47-route figures.
- `src/App.tsx` — the full route table, cross-checked against the 47-file population (zero orphans
  either direction).
- `e2e/theme-contrast.spec.ts`, `e2e/theme-rendered-result.spec.ts` — read in full this session.

### Secondary (MEDIUM confidence)
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTRAST-BASELINE.md`'s 12.2s/
  14.3s/14.4s wall-clock timings for the 20-cell matrix — not independently re-measured this
  session (no live `dev:noauth` server started), used only to extrapolate the 188-cell runtime
  estimate (Assumption A1).

### Tertiary (LOW confidence)
- Assumption A2 (the `aria-selected` button hypothesis) — ARIA-spec knowledge only, not run against
  axe this session. Flagged explicitly in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all versions confirmed via `node -e require(...).version`
- Architecture / corpus figures: HIGH — every count re-derived live with the exact commands quoted
- Harness mechanics (D-11): HIGH — empirically tested three ways against this repo's real Playwright
  install this session, not inferred from docs or training data
- Pitfalls: HIGH for the two documented in depth (file-count drift, `test.afterAll` status
  corruption); MEDIUM for the restated oklch-scraping pitfall (already project-established, not
  independently re-verified beyond the compiled-CSS confirmation this session already provides)

**Research date:** 2026-08-20
**Valid until:** 14 days (this repo's corpus is under active multi-session edit; a fresh `grep -rl`
re-derivation is cheap and should be re-run at execution time regardless of this document's age)
