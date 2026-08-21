# Phase 124: Shell & Information Architecture - Research

> **AMENDED 2026-08-21 (post-research, during pattern-mapping).** This document's original
> references to `inbox.listByProfile` as the Inbox count badge's backing query were wrong and
> have been corrected in place to `inbox.listHeldUnacked` (`convex/inbox.ts:216`). The shell has
> no `profileId`, and `listAll().length` is capped at 200 while the live table holds 2,777 rows
> (1,827 unacked). See the amended D-10 and D-12 in `124-CONTEXT.md` for the full finding and
> Larry's rulings. References to `listByProfile` as an *example of an index-bounded query*
> (the Validation Architecture test-template row, and the Sources list) are accurate as written
> and are deliberately left unchanged.

**Researched:** 2026-08-21
**Domain:** React Router app-shell chrome rewrite (header + sidebar), presentation-only, no route
changes.
**Confidence:** HIGH

## Summary

This phase is fully specified by two locked upstream artifacts — `124-CONTEXT.md` (17 decisions,
D-01..D-17, plus the verbatim 44-row nav map) and `124-UI-SPEC.md` (checker-verified 6/6, one
revision round). Nothing here reopens either; this document adds the live-code evidence the
planner needs to turn those decisions into tasks, and answers the one open engineering question
the phase brief flagged: how to make success criterion 3 ("a route-list diff before and after is
identical") an automated, falsifiable Vitest assertion rather than a manual eyeball.

The codebase is in good shape for this rewrite. `navRegistry.ts` already separates `navGroups`
(what SHELL-02 rewrites) from `navItems` (a deduped-by-`to` flat list `CommandPalette` consumes) —
this structural split is *why* criterion 3 is achievable at all: a pure regroup of `navGroups`
cannot change `navItems`' route set by construction, so the two things criterion 3 must prove
(the route SET is unchanged, the route STRUCTURE changed) live in genuinely different data. The
project's own accessibility test infrastructure (`e2e/a11y-routes.ts`) already solved an adjacent
problem — enumerating "all real page routes, deduped for dynamic-param siblings" — live in this
repo, and its exact dedup convention (represent `/war-room` + `/war-room/:roomId` once, at the
static path) is the right model for the golden fixture.

The header-height decision (D-06) and the 900px sidebar/Settings geometry re-check (D-17) both
have a **live, permanent Playwright regression guard already in the repo** — `e2e/polish-geometry.spec.ts` — built for exactly this class of measurement (in-page `getBoundingClientRect`/
`scrollWidth` reads, never Playwright's own reported viewport size). The plan should extend this
file, not invent a new measurement mechanism.

**Primary recommendation:** Build the route-list-diff test as a Vitest unit test importing
`navGroups`/`navItems` directly (no browser, no router) against a committed golden array captured
from the CURRENT (pre-124) registry; extend `e2e/polish-geometry.spec.ts` for D-06/D-17's
measurement gates rather than writing new Playwright specs from scratch; compose `Collapsible` +
`DropdownMenu` (both already vendored, both already used elsewhere in the repo with a known jsdom
polyfill recipe) for the two new interactions this phase introduces.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Header 3-zone layout (breadcrumb/command bar/right zone) | Browser / Client (React component, `DashboardLayout.tsx`) | — | Pure client-rendered chrome; no server round-trip |
| Sidebar 4-domain regroup, per-domain collapse | Browser / Client (`navRegistry.ts` + `DashboardLayout.tsx`) | — | Static config + client state (`localStorage`) |
| System chip state (Nominal/Attention/Critical/Offline) | Browser / Client (derived) | API / Backend (`alerts.countBySeverity` query, existing) | D-11: composed client-side from an EXISTING public query + `useConvexConnectionState()`; no new backend |
| Count badges (Inbox, Alerts) | Browser / Client (derived) | API / Backend (`inbox.listHeldUnacked`, `alerts.countBySeverity`, both existing) | Same two existing queries D-10 reuses; D-13 requires the Alerts one be read-bounded |
| Breadcrumb trail | Browser / Client (derived from `navRegistry.ts` + route `handle`/hook for 6 param routes) | Browser / Client (React Router `useMatches`/route config) | Pure derivation, no backend involvement |
| Route table (URL → component) | Browser / Client (`src/App.tsx`, React Router) | — | Explicitly UNCHANGED by this phase — the whole point of criterion 3 |

No tier in this phase touches the API/Backend layer beyond READING two already-public queries and
bounding one of them (D-13's `.collect()` fix on `countBySeverity`, itself a Convex-side change but
not a new endpoint or schema change). This matches the phase's own "presentation-only" framing.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Router v7 | (repo-pinned, `react-router` import, not `react-router-dom`) | Route table, `NavLink`, `useMatches` for breadcrumb | Already the app's router; `NavLink`'s default `aria-current="page"` behavior is what D-16/the a11y contract rely on |
| Radix `Collapsible` (via `radix-ui` package, `src/components/ui/collapsible.tsx`) | already vendored | Per-domain sidebar collapse (D-14) | Native `aria-expanded`, no custom ARIA needed — confirmed live, see Code Examples |
| Radix `DropdownMenu` (via `radix-ui` package, `src/components/ui/dropdown-menu.tsx`) | already vendored | Header `⋯` overflow menu (D-07) | Provides `aria-expanded`/`aria-haspopup`/keyboard nav for free |
| shadcn `Badge` (`src/components/ui/badge.tsx`) | already vendored | Base primitive under both `StatusBadge` and the new Inbox neutral count pill | Existing composition target named explicitly in the UI-SPEC's Component Reuse Map |

**No package installs, no version bumps.** `components.json` confirms `"registries": {}` — this
phase adds zero new dependencies (UI-SPEC's own Registry Safety section, verified 2026-08-20/21,
not re-verified here since it makes no claim about package versions that could have drifted in one
day).

### Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages — both primitives it newly *uses*
(`Collapsible`, `DropdownMenu`) are already vendored in `src/components/ui/` from a prior phase's
shadcn `add`. No `npm install` occurs in this phase's scope.

## Architecture Patterns

### System Architecture Diagram

```
Route change (React Router)
        |
        v
DashboardLayout.tsx (unchanged mount point, rewritten internals)
        |
        +--> SidebarContent
        |       |
        |       +--> navGroups (navRegistry.ts) -- REWRITTEN this phase (5 groups -> 4 domains)
        |       |       |
        |       |       +--> per-domain Collapsible (NEW) -- localStorage["codepulse-nav-domains"]
        |       |       +--> whole-sidebar rail collapse (EXISTING) -- overrides per-domain, unchanged
        |       |       +--> StatusBadge / Badge count pills (NEW) <-- alerts.countBySeverity,
        |       |             inbox.listHeldUnacked (both EXISTING queries, D-13 bounds one)
        |       |
        |       +--> footer-pinned Settings NavLink (EXISTING, unmoved -- D-04)
        |
        +--> <header> -- REWRITTEN into 3 zones
        |       |
        |       +--> Zone 1: breadcrumb (NEW, derived from navGroups + route handle)
        |       |             / hamburger below md (EXISTING, unmoved)
        |       +--> Zone 2: command bar trigger (EXISTING, unmoved -- opens CommandPalette,
        |       |             which reads navItems -- UNCHANGED route set, by construction)
        |       +--> Zone 3: brain badge / system chip (NEW, derived) / bell / E-Stop / ⋯ / user menu
        |                     |
        |                     +--> ⋯ DropdownMenu (NEW) wraps EXISTING controls:
        |                           ThemeSwitcher, PrivacyShield, AmbientAudioPlayer, CrtToggle
        |                           (each keeps its own internal state/localStorage -- only the
        |                           mount location moves)
        |
        +--> <main><Outlet/></main> -- UNTOUCHED page layer (PageHeader etc.)

navItems (flat, deduped by `to`) --> CommandPalette.tsx -- UNCHANGED consumer, proves criterion 3
```

A reader can trace: a route change re-renders `DashboardLayout`, which reads the (rewritten)
`navGroups` for the sidebar and (new) breadcrumb, and reads two pre-existing Convex queries for the
new system chip / badges — no new data source enters the system anywhere in this diagram.

### Recommended Project Structure

No new directories. Files this phase modifies or reads, exactly as `124-CONTEXT.md`'s own
`<canonical_refs>` names them — restated here with the evidence read live in this research pass:

```
src/
├── lib/
│   └── navRegistry.ts          # REWRITE navGroups (5→4 groups); navItems/iconComponents mostly untouched
├── layouts/
│   ├── DashboardLayout.tsx     # REWRITE header (:551-620) + sidebar render (:75-141, :228-236)
│   └── __tests__/
│       └── DashboardLayout.test.tsx   # ADD: 232px width assertion (replaces line 194's test.todo)
├── components/
│   ├── CommandPalette.tsx      # READ ONLY except D-05's rider (rename fix, no structural change)
│   ├── EStopButton.tsx         # READ ONLY — verify min-width, do not reimplement
│   ├── StatusBadge.tsx         # REUSE — system chip + Alerts badge compose this
│   └── ui/
│       ├── collapsible.tsx     # REUSE, unmodified — already vendored
│       └── dropdown-menu.tsx   # REUSE, unmodified — already vendored
convex/
├── alerts.ts                   # MODIFY countBySeverity (:109-125) — bound the .collect() (D-13)
└── inbox.ts                    # READ ONLY — listByProfile (:168) already index-bounded
e2e/
├── polish-geometry.spec.ts     # EXTEND — D-06 header re-measurement, D-17 900px re-check at 232px
└── a11y-routes.ts              # REFERENCE PATTERN ONLY (not imported) for the route-fixture dedup
src/lib/__tests__/ (new file, exact name is the plan's call)
└── navRegistry.routes.test.ts  # NEW — success criterion 3's automated route-set assertion
```

### Pattern 1: Flat-route dedup for a golden fixture (criterion 3's mechanism)

**What:** `e2e/a11y-routes.ts` (Phase 123, D-13/D-16) already solved "enumerate every real route,
once, even when two `<Route>` entries share one page component for a static + dynamic-param pair."
Its convention — represent the pair once, at the static path — is exactly what `navRegistry.ts`'s
existing `navItems` builder does independently (dedup by `to`, first-seen wins), because
`navGroups` never lists a route twice across groups in current data.

**When to use:** Any time a route-set needs enumerating for verification. Here: capturing the
"before" golden fixture and asserting the "after" set is identical.

**Example — the existing dedup pattern in `navRegistry.ts` itself** (`src/lib/navRegistry.ts:218-229`, read live):
```typescript
// Flat list of routes (deduped by `to`) for CommandPalette and any other
// consumer of the nav registry.
export const navItems = (() => {
  const seen = new Set<string>();
  const flat: NavItem[] = [];
  for (const grp of navGroups) {
    for (const item of grp.items) {
      if (seen.has(item.to)) continue;
      seen.add(item.to);
      flat.push(item);
    }
  }
  return flat;
})();
```
This is the object the golden-fixture test should assert against — it is untouched by SHELL-02's
regroup by construction (the function body doesn't care how many groups exist or what they're
named, only which `to` values appear across all of them), which is precisely why a pure `navGroups`
regroup cannot silently change it.

### Pattern 2: Radix Collapsible for per-domain sidebar sections (D-14)

**What:** `src/components/ui/collapsible.tsx` (read in full, 30 lines) is a thin wrapper —
`Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` — over `radix-ui`'s `Collapsible` primitive,
already vendored, currently used nowhere in `DashboardLayout.tsx` (confirmed: no `Collapsible`
import in the 645-line file read in full).

**When to use:** Each of the 4 domain headers (Command/Observe/Agents/System) becomes a
`CollapsibleTrigger` wrapping today's eyebrow `<p>` (`DashboardLayout.tsx:91`); `CollapsibleContent`
wraps that domain's `NavGroup` item list.

```typescript
// Source: src/components/ui/collapsible.tsx (read live, verbatim shape)
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

<Collapsible open={domainOpen.command} onOpenChange={(v) => setDomainOpen({ ...domainOpen, command: v })}>
  <CollapsibleTrigger>{/* eyebrow label, e.g. "COMMAND" */}</CollapsibleTrigger>
  <CollapsibleContent>{/* NavGroup items */}</CollapsibleContent>
</Collapsible>
```
Radix sets `aria-expanded` on the trigger and `data-state="open"|"closed"` automatically — no
custom ARIA required, matching the UI-SPEC's Accessibility Contract claim (verified against the
primitive's own source, not just the UI-SPEC's assertion).

### Pattern 3: Radix DropdownMenu for the header `⋯` overflow (D-07)

**What:** `src/components/ui/dropdown-menu.tsx` exports `DropdownMenu`/`DropdownMenuTrigger`/
`DropdownMenuContent`/`DropdownMenuItem` etc. over `radix-ui`'s `DropdownMenu` primitive. Already
vendored; not currently imported by `DashboardLayout.tsx`.

**When to use:** Wrap the icon-only `⋯` trigger (`aria-label="More options"`) and compose the four
existing controls (`ThemeSwitcher`, `PrivacyShield`, `AmbientAudioPlayer`, `CrtToggle`) each inside
a `DropdownMenuItem` — they keep their own internal state/`localStorage`; only their JSX mount
point moves out of the always-visible right zone.

**Load-bearing note for the plan — `ThemeSwitcher` is `lazy()`-loaded today**
(`DashboardLayout.tsx:15-17`, DEBT-03) with a `Suspense` fallback sized to its own slot
(`:611`, `<div className="w-9 h-9" aria-hidden="true" />`). Moving it inside a `DropdownMenuItem`
must preserve this lazy boundary — the entry-chunk budget DEBT-03 established is a standing
constraint this phase must not regress (`124-CONTEXT.md`'s upstream task brief flags this
explicitly). `CommandPalette` is lazy-loaded the same way (`:30-32`) and stays in Zone 2, untouched
by this move.

### Pattern 4: Deriving the system chip client-side (D-11)

**What:** No new Convex query. Compose from two already-imported/already-used primitives:
`useConvexConnectionState()` (imported `convex/react`, already used at `DashboardLayout.tsx:3`/
`:152-153` for the sidebar's connection dot) and `alerts.countBySeverity` (already exported,
`convex/alerts.ts:109-125`, returns `{ info, warning, error, critical }`).

```typescript
// Composition, not existing code — derived from the two live primitives above.
const convexState = useConvexConnectionState();
const severity = useQuery(api.alerts.countBySeverity);
const chipState =
  !convexState.isWebSocketConnected ? "offline"
  : severity === undefined ? undefined  // D-12: render nothing while loading
  : severity.critical > 0 || severity.error > 0 ? "critical"
  : severity.warning > 0 ? "attention"
  : "nominal";
```

### Anti-Patterns to Avoid

- **Reimplementing `EStopButton`'s geometry.** It already carries `shrink-0` (`EStopButton.tsx:98`)
  and `whitespace-nowrap` (`:101`) and has a dedicated permanent regression guard
  (`e2e/polish-geometry.spec.ts`'s `ESTOP_WIDTHS` block). This phase only repositions it within
  Zone 3 — do not touch its internal markup.
- **Building a new `<SystemChip>`/`<CountBadge>` component from scratch.** The UI-SPEC's Component
  Reuse Map is explicit: compose `StatusBadge` (severity-bearing) and base `Badge` (neutral Inbox
  count) instead.
- **Letting the badge render `0`.** D-12's three-state law (`undefined` → nothing,
  `> 0` → the number, `=== 0` → nothing) is a correction of a documented past defect class
  (POLISH-04's fabricated-confidence rule, TOKEN-04's six-state law) — this is not a stylistic
  preference, it's a standing project rule against rendering a zero that could mean "not loaded yet."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-domain collapse | Custom accordion state machine | Radix `Collapsible` (already vendored) | Native `aria-expanded`, tested primitive, zero new deps |
| Header overflow menu | Custom popover + manual focus trap | Radix `DropdownMenu` (already vendored) | Keyboard nav (arrows/Home/End/typeahead/Esc) for free |
| System health chip | New Convex query/aggregate | Client-side derivation from `alerts.countBySeverity` + `useConvexConnectionState()` | D-11's explicit finding: `convex/health.ts` has zero public queries; adding one is backend work outside this phase's scope |
| Route-set verification | Manual before/after screenshot or eyeball diff | Vitest unit test importing `navGroups`/`navItems` directly, asserted against a committed golden array | Deterministic, CI-enforced, zero browser dependency, fails on ANY add/remove/rename |
| Breadcrumb per-route strings | Every page component declaring its own breadcrumb prop | Single derivation from `navRegistry.ts` + a small per-route override for the 6 param routes (D-16) | Prevents the domain name being maintained in two places and drifting |

**Key insight:** every "don't hand-roll" in this phase resolves to "the repo already has the
primitive or the pattern one phase away — compose it." This is a regroup/consolidation phase, not a
component-authoring phase.

## Runtime State Inventory

**Not applicable — this is not a rename/refactor/migration phase.** SHELL-02 changes which
`navGroups` array entry a route's label sits under (a presentation regroup); it does not rename any
route, table, key, or identifier that any external system, stored data, or OS-level registration
could reference. Verified: the `to` values in the 44-row map are IDENTICAL before and after
(`124-CONTEXT.md`'s own table, "Today" vs "→ Domain" columns only differ in the group name, never
the route). `localStorage["codepulse-nav-domains"]` is a NEW key this phase introduces (not a
rename of an existing one), so there is no prior stored value to migrate — first read simply misses
and falls back to the documented all-true default (D-15).

## Common Pitfalls

### Pitfall 1: The route-list-diff test asserting the wrong thing

**What goes wrong:** A test that asserts `navGroups` (the grouped structure) is unchanged would be
vacuous — group structure is exactly what SHELL-02 changes, so such a test could only ever fail,
defeating the point. Equally wrong: a test that only checks *count* (`navItems.length === 44`)
would pass even if item #12's `to` value were typo'd during transcription, because the count would
still be 44.

**Why it happens:** "Route-list diff is identical" is ambiguous between "the grouped view" and "the
flat route set" until you commit to one.

**How to avoid:** Assert on the SORTED SET of `to` values from `navItems` (or an equivalent
flattening of `navGroups`), not on `navGroups` itself and not on a bare count. `124-CONTEXT.md`'s
own Claude's-Discretion note makes this explicit: "It must compare the route set, not the group
structure, since the group structure is precisely what changes."

**Warning signs:** A test that passes with zero changes to the golden fixture even after
deliberately renaming a `to` value in `navRegistry.ts` (the required mutation-proof, see Validation
Architecture below) is the tell that the assertion is checking the wrong axis.

### Pitfall 2: `navItems`' current dedup-by-`to` is a red herring for count math

**What goes wrong:** `navItems` is deduped by `to` (`seen.has(item.to)`), and today the flat count
happens to equal the raw item count because no route is currently listed twice across groups. A
plan that asserts `navItems.length === 44` without first confirming this equality live (rather than
assuming it from the CONTEXT.md table) risks silently baking in a stale number if the pre-change
state has drifted since 2026-08-20 (`124-CONTEXT.md`'s own capture date).

**Why it happens:** Trusting a planning document's captured count instead of re-deriving it from
the live file at plan/execution time.

**How to avoid:** Re-run `navItems.length` and the sorted `to`-value list against the LIVE
`navRegistry.ts` at plan time, not against the CONTEXT.md table's transcription, and use THAT as
the golden fixture's capture point (ideally: capture the fixture via a small script or a one-off
test run against the pre-change file, committed BEFORE the `navGroups` rewrite lands in the same
plan/commit).

**Warning signs:** Golden fixture count disagrees with a fresh `navItems.length` read at the moment
the regroup PR is about to land.

### Pitfall 3: cmdk value-collision repro (D-05's rider) needs a REAL measurement, not a code reading

**What goes wrong:** `CommandPalette.tsx:66` (`<CommandItem key={to} …>` with no `value` prop) is
cited by D-05 as the *mechanism* for a double-highlight/ArrowDown-loop defect when two nav items
share a rendered label — but D-05 explicitly labels this "a reading of the code, not a
measurement," and requires the plan to reproduce the behavior before AND after the `Analytics` →
`Agent Analytics` rename, dropping the "fix" claim entirely if no defect is actually observed.

**Why it happens:** cmdk's fallback-to-text-content behavior for an unset `value` prop is a real,
documented mechanism, but whether it actually manifests as a user-visible bug depends on cmdk's
internal keying/dedup logic at runtime, which the source reading alone cannot settle.

**How to avoid:** Use `src/components/__tests__/CommandPalette.test.tsx`'s existing pattern (already
solved the "two items with the same rendered label" harness for the `links` fixture — see its
comment at lines 34-39 citing exactly this defect class) as the repro harness template, run it
against the CURRENT duplicate-`"Analytics"` state first, then again after the rename.

**Warning signs:** Shipping a "fix" for a defect that was never actually reproduced — the exact
thing D-05 preempts by requiring the repro both ways.

### Pitfall 4: `ThemeSwitcher`'s lazy boundary getting lost inside the DropdownMenu move

**What goes wrong:** `ThemeSwitcher` is `lazy()`-loaded specifically because it is the entry
chunk's only consumer of `@radix-ui/react-select` (DEBT-03, 42,988 bytes). If the `⋯` menu's
implementation statically imports `ThemeSwitcher` instead of preserving the existing dynamic
`import()` + `Suspense` wrapper, the entry-chunk budget silently regresses — with no test failure,
since nothing in this repo currently asserts a bundle-size ceiling in CI (verified: no
`bundlesize`/`size-limit` config found in `package.json` during this research pass — a genuine gap,
not fixed by this phase, but worth flagging so the plan doesn't introduce a regression nothing will
catch automatically).

**Why it happens:** A `DropdownMenuItem`'s children are just JSX; nothing about Radix's API forces
you to preserve a `lazy()` boundary when refactoring the surrounding markup.

**How to avoid:** Keep the `const ThemeSwitcher = lazy(...)` declaration and its `<Suspense
fallback=...>` wrapper exactly as-is; only change WHERE the `<Suspense><ThemeSwitcher/></Suspense>`
JSX is mounted (inside a `DropdownMenuItem` instead of directly in the right-zone flex row).

**Warning signs:** A `git diff` on this plan's commit touching the `import` statement for
`ThemeSwitcher` at the top of `DashboardLayout.tsx` (line 15-17) — that import should not need to
change.

### Pitfall 5: jsdom + Radix DropdownMenu needs a ResizeObserver polyfill, per-file (not global)

**What goes wrong:** Radix's `DropdownMenu`/`Popover` family uses `ResizeObserver` internally for
positioning; jsdom does not implement it. A test file that renders the new `⋯` menu (or the
Collapsible sidebar, which may also trigger Radix's internal measurement code) without this
polyfill will fail with a runtime error, not a clean test failure.

**Why it happens:** `src/test/setup.ts` (read in full, 152 lines) deliberately does NOT install a
global `ResizeObserver` polyfill or mock Radix — the project's own `CLAUDE.md` states heavy
render libraries are mocked per test file, and this extends to browser-API gaps too.

**How to avoid:** Follow the existing three live precedents in this exact repo —
`src/components/skills/RunTargetChooser.test.tsx:20-24`, `SendSplitButton.test.tsx`,
`SkillLifecycleMenu.test.tsx` — all of which install a per-file `ResizeObserver` stub before
rendering a component that uses Radix `DropdownMenu`/`Popover`. Copy that idiom into the new shell
test file(s) rather than adding a global polyfill to `setup.ts` (which would be a repo-wide
behavior change outside this phase's stated scope).

**Warning signs:** `ResizeObserver is not defined` in a new `DashboardLayout.test.tsx` or sidebar
test run.

## Code Examples

### Existing per-file ResizeObserver polyfill (verified live pattern)
```typescript
// Source: src/components/skills/RunTargetChooser.test.tsx:20-24 (read live)
// Radix DropdownMenu/Popover use ResizeObserver internally — jsdom doesn't
// implement it.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
```

### Existing cmdk value-collision test fixture pattern (for D-05's repro)
```typescript
// Source: src/components/__tests__/CommandPalette.test.tsx:34-42 (read live)
// The second entry is deliberately titled "Tasks" — the same label as a Pages
// nav entry — to hold the cmdk value-collision guard honest.
links: [
  { id: "l1", title: "Convex dashboard", url: "http://127.0.0.1:6791" },
  { id: "l2", title: "Tasks", url: "http://127.0.0.1:7070" },
],
```
This file already has the harness shape needed to reproduce D-05's rider — the "Analytics" /
"Agent Analytics" collision — by constructing two `navItems`-shaped entries with identical rendered
text and asserting on cmdk's actual selection/highlight behavior (not the source code).

### Existing permanent geometry regression guard (for D-06/D-17's re-measurement)
```typescript
// Source: e2e/polish-geometry.spec.ts:178-278 (read live, abridged)
// 900px sidebar/Settings collision — in-page proof (POLISH-06)
const evidence = await page.evaluate(() => {
  const innerWidth = window.innerWidth;
  const scrollWidth = document.documentElement.scrollWidth;
  // ...walks every `body *` element, computes rightOverflow = rect.right - innerWidth...
  return { innerWidth, scrollWidth, asideRect, mainRect, culprits };
});
expect(evidence.scrollWidth).toBeLessThanOrEqual(evidence.innerWidth);
expect(evidence.culprits.length).toBe(0);
```
This file is the exact mechanism D-06 (header min-content-vs-available-width at 375px/900px) and
D-17 (re-run POLISH-06's 900px check at 232px instead of 240px) both call for. The plan should
EXTEND this file — updating `asideRect.width` expectations from 240 to 232, and adding an
equivalent min-content-width measurement for the three header zones — rather than authoring a new
spec file. The file's own header comment states it exists as "a permanent geometry regression guard
for the E-Stop [width] and header/sidebar collision" — this phase's header rewrite is precisely
what that guard exists to catch regressions in.

### Existing route-population dedup convention (model for the golden fixture, not to be imported)
```typescript
// Source: e2e/a11y-routes.ts (header comment, read live)
// Routes that share a page component across a static and a dynamic path
// (/war-room + /war-room/:roomId, /hr/roster + /hr/roster/:agentId, etc.) are
// represented once, at the static path -- there is no second page file to scan.
```
`navRegistry.ts`'s six param-route pages (`/sessions/:id`, `/quality/:profileId`,
`/war-room/:roomId`, `/hr/roster/:agentId`, `/hr/onboarding/:catalogId`, `/hr/teams/:teamId`) are
already absent from `navGroups`/`navItems` entirely (confirmed: none of the 44 rows in
`124-CONTEXT.md`'s locked map is a param route) — so this phase's route-set fixture needs no special
handling for them; they simply never appear in `navItems` today or after the regroup. D-16's
breadcrumb work is the only place these 6 routes matter in this phase.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `min-h-14 flex-wrap gap-y-1` header (2-row fallback under content pressure) | Hard `h-12` (48px), IF the re-measurement clears with margin | D-06 (this phase), gated on measurement, not asserted | Header may stay at the wrap-capable fallback if the consolidation doesn't clear — the phase must report honestly either way, per D-06's explicit if/else |
| 5 flat sidebar groups (COMMAND/GRAPHS/AGENTS/OBSERVE/ACTIVITY), 240px | 4 collapsible domains (Command/Observe/Agents/System), 232px | SHELL-02 (this phase) | GRAPHS and ACTIVITY dissolve into the other 4 per D-02/D-03's intent-based split |
| `text-sm font-mono tracking-wider` nav labels (uppercase mono chrome) | Sentence-case Geist, weight 400 (Typography table) | UI-SPEC (locked), superseding a live pattern | Direct instance of the sketch's kill-list "uppercase mono nav labels" entry |
| 10 right-zone header controls (incl. 2 dividers) | 6 stay visible + 4 move to `⋯` | D-07 (amended 2026-08-21, "help" struck) | Reduces right-zone width pressure, which is what D-06's re-measurement is testing whether it's sufficient |
| "Astridr Runtime Telemetry" decorative pill | Deleted; breadcrumb occupies its space | D-08 | Kill-list shape (pulse dot + cyan wallpaper), already banned by POLISH-01 |

**Deprecated/outdated (as of this phase, by explicit decision, not by external ecosystem change):**
- The `sidebarCollapsed` 240px width literal — becomes 232px (D-17), asserted in the currently-
  `test.todo`'d `DashboardLayout.test.tsx:194`.
- Any future addition of a `placeholder`-style disabled nav item — the capability was deliberately
  REMOVED at Phase 123's closeout (an unmeasured `opacity-50` a11y decision); do not resurrect it
  as a side effect of this regroup.

## Assumptions Log

This research makes no `[ASSUMED]`-tagged package or API claims — every citation above was read
live from the repository during this research pass (`file:line` given throughout), and the design
decisions themselves are locked upstream in `124-CONTEXT.md`/`124-UI-SPEC.md`, which this document
treats as authoritative per its scope (research does not re-litigate locked decisions). The one
genuinely uncertain item carried forward is D-06's own framing — whether the consolidated header
"clears with margin" at 375px/900px is EXPLICITLY a measurement to be taken during execution, not
something this research (or any planning document) can settle in advance.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No `bundlesize`/`size-limit` CI config exists in this repo, so an entry-chunk regression from Pitfall 4 would go uncaught by automation | Pitfall 4 | Low — this is a negative finding about tooling absence, not a design decision; if wrong (a config exists elsewhere e.g. a CI workflow step), the consequence is only that the pitfall's risk framing is slightly overstated, not that any decision changes |

**If this table is sparse:** the bulk of this research consists of live `file:line` citations
against code and locked upstream decisions, not assumptions requiring confirmation.

## Open Questions (RESOLVED — see 124-01 and 124-10)

> Both questions below were adopted as recommended and are now implemented by the plans.
> (1) The golden fixture is a literal committed array in 124-01 Task 1 (which requires
> `grep -cF "git show"` = 0, so a SHA-anchored read cannot sneak in). (2) The header
> min-content measurement is a new `test.describe` block in 124-10 Task 1, not a reuse of
> the existing whole-body overflow walk. Verified by the plan-checker, 2026-08-21.

1. **Where does the golden route-set fixture live, and how is it captured?**
   - What we know: `124-CONTEXT.md`'s Claude's-Discretion section explicitly leaves the mechanism
     to the planner (a frozen fixture + assertion, a diff script, or both), constrained only to
     "compare the route set, not the group structure."
   - What's unclear: whether the fixture should be a literal committed `.json`/`.ts` array (captured
     once, before the regroup lands, in the SAME commit or plan that performs the regroup) or
     re-derived from a frozen git SHA via `git show <sha>:src/lib/navRegistry.ts` at test time (the
     pattern Phase 123's `123-02` used for its C6 control, anchoring to a hard-coded pre-sweep SHA
     rather than a relative ref — see the 2026-08-18 `HEAD~1` lesson in this project's own standing
     practice: relative refs rot in a shared checkout, an explicit SHA does not).
   - Recommendation: a literal committed array of the 44 sorted `to` values (not a git-SHA-anchored
     read), captured in the SAME plan/commit that rewrites `navGroups`, with the mutation-proof
     described in Validation Architecture below. A plain array avoids any risk of the anchor commit
     itself being amended or squashed later, and is trivially diffable in code review.

2. **Does the header min-content-vs-available-width re-measurement (D-06) belong in
   `polish-geometry.spec.ts` or a new file?**
   - What we know: `polish-geometry.spec.ts` already measures the 900px sidebar/Settings collision
     with the exact "walk every element, compute rightOverflow" mechanism D-06 needs, and asserts
     zero culprits.
   - What's unclear: whether D-06's specific ask (combined min-content width of the THREE HEADER
     ZONES specifically, at 375px AND 900px) needs a new, more targeted measurement than the
     existing whole-body walk, since the existing walk proves "nothing overflows the viewport" but
     not "the three zones' combined min-content width clears the header's available width with
     margin" (a stricter, more diagnostic claim D-06 explicitly asks for).
   - Recommendation: extend `polish-geometry.spec.ts` with a new `test.describe` block performing
     the min-content measurement D-06 names (each zone's `getBoundingClientRect().width` summed vs.
     `header.clientWidth`, at 375px and 900px), keeping the existing 900px whole-body walk as the
     complementary "did anything actually overflow the viewport" check — the two measure different
     things and both remain useful after this phase.

## Environment Availability

**Skipped — no external dependencies.** This phase's implementation touches only in-repo
TypeScript/React/Convex code and already-vendored shadcn primitives; it introduces no new CLI tool,
service, runtime, or package manager dependency beyond what `npm run dev` / `npm test` /
`npx playwright test` already require (all confirmed present and in use by the existing test suite
this research read).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom project) for component/unit tests; Playwright for `e2e/*.spec.ts` geometry/a11y specs |
| Config file | `vitest.config.ts` (jsdom + browser projects); `playwright.config.ts` for e2e |
| Quick run command | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx src/lib/__tests__/navRegistry.routes.test.ts` (name of the new file is the plan's call) |
| Full suite command | `npm test` (Vitest); `npx playwright test e2e/polish-geometry.spec.ts` for the geometry gate |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | 48px 3-zone header renders on every route | unit + e2e | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx`; `npx playwright test e2e/polish-geometry.spec.ts` (extended) | ✅ file exists, extend it — Wave 0 |
| SHELL-01 | Header height clears the D-06 measurement gate at 375px/900px | e2e | `npx playwright test e2e/polish-geometry.spec.ts` (new `test.describe` block) | ❌ Wave 0 — new block in existing file |
| SHELL-01 | Right-zone control count (6 visible, 4 in `⋯`) and `⋯` menu contents | unit | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` | ✅ extend existing file |
| SHELL-02 | 4-domain sidebar, count badges, 2px active rail | unit | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` (232px assertion replaces the `test.todo` at line 194) | ✅ extend existing file |
| SHELL-02 | 900px Settings/sidebar geometry holds at the new 232px width | e2e | `npx playwright test e2e/polish-geometry.spec.ts` (existing block, `asideRect.width` expectation updated 240→232) | ✅ extend existing file |
| SHELL-02 | Route-list diff before/after is identical (criterion 3) | unit | `npx vitest run src/lib/__tests__/navRegistry.routes.test.ts` (new file, name is the plan's call) | ❌ Wave 0 — new file, mutation-proven per below |
| SHELL-02 | D-05's cmdk value-collision repro, before AND after the Analytics rename | unit | `npx vitest run src/components/__tests__/CommandPalette.test.tsx` (extend) | ✅ extend existing file |
| SHELL-01/02 | Alerts `.collect()` is bounded (D-13's second half) | unit (Convex) | Convex-side test or a direct handler-level assertion on read count, matching the pattern already established for other bounded queries in this repo (e.g. `inbox.listByProfile`'s index usage) | Depends on existing Convex test conventions — plan should locate a sibling bounded-query test as the template |

### Sampling Rate
- **Per task commit:** the relevant Vitest file(s) for the task just touched (`DashboardLayout.test.tsx`, the new route-set test, `CommandPalette.test.tsx`).
- **Per wave merge:** full `npm test` (jsdom project) plus `npx playwright test e2e/polish-geometry.spec.ts`.
- **Phase gate:** full suite green, PLUS the operator visual checkpoint `124-CONTEXT.md`'s
  Claude's-Discretion section recommends by default (Phases 122/123 precedent — 123's D-18
  checkpoint surfaced two real defects beyond its stated question), before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/__tests__/navRegistry.routes.test.ts` (or equivalent name) — the criterion-3 route-set
  assertion, with the golden fixture captured from the pre-regroup `navRegistry.ts` and a
  mutation-proof (see below) demonstrating the test actually discriminates.
- [ ] A new `test.describe` block in `e2e/polish-geometry.spec.ts` for D-06's header min-content
  measurement at 375px and 900px — does not exist yet; the file's existing blocks cover E-Stop
  geometry and the 900px whole-body walk, neither of which directly measures "combined min-content
  width of the three header zones vs. available width."
- [ ] `DashboardLayout.test.tsx:194`'s `test.todo("sidebar width is 240px (w-60) when expanded")`
  needs to become a real, passing assertion at 232px (D-17) — framework already in place (the file
  already mounts `DashboardLayout` with all the necessary mocks), just needs the assertion body.

**Mutation-proof requirement for the new route-set test** (per this project's own standing
verification-discipline rule — a guard test proves nothing until shown to actually fail on the
defect it exists to catch): after writing the golden-fixture test, deliberately mutate
`navRegistry.ts` three ways, one at a time, and confirm each FAILS the test before reverting:
1. **Add** a route not in the golden fixture (e.g. duplicate an existing item with a new `to`).
2. **Remove** a route from `navGroups` entirely.
3. **Rename** one `to` value (e.g. `/alerts` → `/alerts2`) without adding or removing a count.
All three must fail; a test that only catches (1) and (2) but not (3) is checking cardinality, not
the actual route set, and would pass a defect exactly like the D-05 renamed-label scenario this
phase performs deliberately elsewhere (proving the test discriminates label/path renames, not just
counts, matters precisely because this phase DOES rename two labels under D-05 without touching
their `to` values — the test must tell those two kinds of change apart).

## Security Domain

**Skipped by scope, not by config absence.** This phase touches no authentication, session,
input-validation, or cryptography surface — it is a client-side presentation regroup reading two
already-public, already-unauthenticated Convex queries (`alerts.countBySeverity`,
`inbox.listHeldUnacked`) that every other page in the app already reads without new exposure. Per
this project's own `CLAUDE.md` standing note (Self-Hosted Convex — Operational Rules, SEED-008),
the tailnet is the auth boundary for this backend, not per-function gating — a decision this phase
neither depends on nor changes. No ASVS category applies beyond what the existing pages already
satisfy or don't; this phase adds no new attack surface.

## Sources

### Primary (HIGH confidence — read live, this research pass)
- `.planning/phases/124-shell-information-architecture/124-CONTEXT.md` — full read, all 17 decisions + 44-row map
- `.planning/phases/124-shell-information-architecture/124-UI-SPEC.md` — full read, checker-verified 6/6
- `.planning/REQUIREMENTS.md:49-52,123-124` — SHELL-01/SHELL-02 verbatim
- `.planning/ROADMAP.md:832-844` — Phase 124 goal/success criteria
- `.planning/STATE.md:1-130` — position block, UI-SPEC approval narrative
- `.claude/skills/sketch-findings-codepulse/SKILL.md` and `references/shell-and-dashboard.md` — design law
- `src/lib/navRegistry.ts` — full read (230 lines)
- `src/layouts/DashboardLayout.tsx` — full read (645 lines)
- `src/layouts/__tests__/DashboardLayout.test.tsx` — full read (196 lines)
- `src/components/EStopButton.tsx` — full read (191 lines)
- `src/components/StatusBadge.tsx` — full read (179 lines)
- `convex/health.ts` — full read (83 lines), confirms zero public queries
- `convex/alerts.ts:90-135` — `countBySeverity` read, confirms unbounded `.collect()`
- `convex/inbox.ts:150-190` — `listByProfile` read, confirms index-bounded
- `src/components/CommandPalette.tsx:1-90` — read, confirms no `value` prop on nav `CommandItem`
- `src/components/__tests__/CommandPalette.test.tsx:1-70` — read, existing D-05-shaped repro fixture
- `src/App.tsx` — grepped for all `<Route path=...>`, 54 matches, cross-checked against the 44-item map
- `src/test/setup.ts` — full read (152 lines), confirms per-file mock convention
- `src/components/ui/collapsible.tsx`, `dropdown-menu.tsx` — read, confirm Radix wrapper shape
- `e2e/a11y-routes.ts:1-50` — read, confirms the dedup-for-param-routes convention
- `e2e/polish-geometry.spec.ts` — full read (280 lines), the existing geometry regression guard
- `.planning/phases/120-polish-verified-defects/120-GEOMETRY-EVIDENCE.md` — grepped, confirms the measurement methodology and file name
- `src/components/skills/RunTargetChooser.test.tsx:20-24` — read, confirms per-file ResizeObserver polyfill idiom
- `./CLAUDE.md` — full read, project instructions/conventions

### Secondary (MEDIUM confidence)
- None — this phase required no external library documentation lookup (Context7/WebSearch); all
  primitives used are already vendored and their live source was read directly.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every primitive's live source was read
- Architecture: HIGH — every claim carries `file:line` evidence from this research pass
- Pitfalls: HIGH — each pitfall is grounded in a specific, cited mechanism (existing test
  conventions, existing lazy-loading comments, existing dedup logic), not speculation

**Research date:** 2026-08-21
**Valid until:** 2026-09-04 (14 days — this is fast-moving, actively-executing milestone code;
`navRegistry.ts` and `DashboardLayout.tsx` are both mid-overhaul and could shift under a concurrent
session before this phase executes)
