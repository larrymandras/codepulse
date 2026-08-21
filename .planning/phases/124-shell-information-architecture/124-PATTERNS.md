# Phase 124: Shell & Information Architecture - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 11 (5 rewritten/modified, 3 test files extended, 1 new test file, 1 Convex module modified, 2 net-new UI fragments with no direct analog)
**Analogs found:** 9 / 11 (2 net-new — breadcrumb derivation, six-param-route override table)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/navRegistry.ts` | config / route-registry | transform | itself (in-place rewrite of `navGroups`) | exact |
| `src/layouts/DashboardLayout.tsx` | layout shell component | request-response / client-state (UI composition) | itself (in-place rewrite of header `:551-620` + sidebar `:75-236`) | exact |
| System chip (new, inline in `DashboardLayout.tsx` or a small subcomponent) | component, derived client-state | request-response (reads 2 existing queries) | `StatusBadge.tsx` composition sites + `useAlertCounts()` (`src/hooks/useAlerts.ts:16-18`) + `useConvexConnectionState()` already used at `DashboardLayout.tsx:152-153` | role-match, **with a caveat — see Shared Patterns** |
| Count badges (Inbox, Alerts — new, inline) | component, derived client-state | request-response | base `Badge` (`ui/badge.tsx`) under `StatusBadge`; bounded query `inbox.listAll` (`convex/inbox.ts:182-193`, already used by `Inbox.tsx`) | role-match, **wrong query cited upstream — see Shared Patterns** |
| Breadcrumb (new, derivation from `navGroups`/`navItems` + route) | component / hook, transform | derive-from-registry | **no direct analog** — nearest sibling is `AlertBanner.tsx`'s `useLocation().pathname` check (`src/components/AlertBanner.tsx:1,7,13`) | net-new, see "No Analog Found" |
| Six-param-route breadcrumb override table (D-16) | data / lookup table | transform | **no direct analog** — `handle`/`useMatches` is NOT used anywhere in `src/App.tsx` (grepped, zero hits) | net-new, see "No Analog Found" |
| `src/layouts/__tests__/DashboardLayout.test.tsx` | test (unit, jsdom) | — | itself (existing mock block `:22-70`, `renderLayout()` helper `:75-81`) | exact |
| `src/lib/__tests__/navRegistry.routes.test.ts` (NEW, name is plan's call) | test (unit) — golden-fixture / route-set assertion | transform | `navItems` dedup IIFE itself (`src/lib/navRegistry.ts:218-229`) is the object under test; `e2e/a11y-routes.ts`'s dedup-for-param-routes convention is the conceptual model, not an import | role-match (pattern, not code, is reused) |
| `src/components/CommandPalette.tsx` (D-05 rider only) | component, request-response (search/palette) | itself — Links group's explicit `value={...}` (`:87-89`) is the fix template IF the repro proves a defect on the Pages group's un-valued `CommandItem` (`:66`) | exact |
| `src/components/__tests__/CommandPalette.test.tsx` (EXTEND) | test (unit, jsdom) | — | itself — the "Tasks" dup-label fixture (`:34-43`) and value-uniqueness assertion (`:149-163`) are the exact repro harness for D-05's before/after measurement | exact |
| `convex/alerts.ts` (`countBySeverity`, D-13 bound) | Convex query, CRUD/read (aggregation) | same file — `listBySource` (`:94-107`), which already does `.withIndex(...).order("desc").take(limit)` | exact |
| `e2e/polish-geometry.spec.ts` (EXTEND) | test (Playwright e2e, geometry) | — | itself — `gateOrSkip` helper (`:74-83`), `readEstopEvidence`-style in-page `page.evaluate` + `console.log(...EVIDENCE...)` convention (`:85-109`, `:188-259`) | exact |

## Pattern Assignments

### `src/lib/navRegistry.ts` (config, transform)

**Analog:** itself — the file being rewritten in place.

**Structure to preserve exactly** (`src/lib/navRegistry.ts:116-121`, `123-126`):
```typescript
export interface NavItem {
  to: string;
  label: string;
  icon: string;
  group: string;
}

export interface NavGroupConfig {
  group: string;
  items: NavItem[];
}
```
`item.group` is currently the SAME string as the containing `NavGroupConfig.group` (e.g. every item in the `"COMMAND"` array carries `group: "COMMAND"`) — the regroup must keep this invariant when items move to a new domain (e.g. an item moving from `GRAPHS` to `System` gets `group: "System"`, matching its new container), since nothing else in the codebase reads `item.group` independently of its container today (confirmed: only `navGroups`/`navItems` consumers exist, per Integration Points below) — but do not assume that remains true without grepping again if the plan discovers a third consumer.

**Dedup pattern — DO NOT touch, it is what makes criterion 3 achievable** (`:218-229`, already excerpted in RESEARCH — reproduced here as the load-bearing object the new golden-fixture test asserts against):
```typescript
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

**Preserve-adjacency comments already in the file** (Claude's Discretion in CONTEXT.md names these explicitly — carry the comments forward, not just the items):
- `:143-149` — Seiðr Suite: Skills/Galdr/Bifröst/Studio kept adjacent, with an explanatory comment above each.
- `:159-161` — Loom's GRAPHS placement comment ("Loom is a graph surface... design doc §4.4 places it in GRAPHS") — this now needs to say Observe, not GRAPHS, once GRAPHS dissolves per D-02.

**`iconComponents` map (`:59-105`) and its Lucide imports (`:12-57`) are UNTOUCHED** — no new icon needed, no new route, so no new Lucide import. Do not add or remove entries here as part of this phase.

**The dead-capability comment block (`:107-115`) documents a real prior defect (Phase 123 D-18: an unmeasured `opacity-50` disabled style was removed).** Do not resurrect a `placeholder` field on `NavItem` for this phase's regroup — the count badges (D-10) are a DIFFERENT mechanism (rendered by the consuming component from a separate query, not a static registry field).

---

### `src/layouts/DashboardLayout.tsx` (layout shell, request-response / client-state)

**Analog:** itself — header (`:551-620`) and sidebar render (`:75-236`) rewritten in place; everything else in the 645-line file (footer Settings `:238-269`, collapse toggle `:271-279`, connection dot `:280-292`, avatar dialog `:295-309`, `CrtToggle` `:314-347`, keyboard shortcuts `:439-474`, `GlobalSwapProvider`/`Outlet` wiring `:476-644`) is untouched by this phase and must not be reformatted incidentally.

**`localStorage` try/catch idiom — copy verbatim for `codepulse-nav-domains` (D-15)** (`:353-359`, the `sidebarCollapsed` initializer cited by both CONTEXT.md and UI-SPEC):
```typescript
const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("codepulse-sidebar-collapsed") ?? "false");
  } catch {
    return false;
  }
});
```
The write-side companion (`:492-496`, inside the `onToggleCollapse` callback) is the paired pattern for persisting on change:
```typescript
onToggleCollapse={() => {
  const next = !sidebarCollapsed;
  setSidebarCollapsed(next);
  localStorage.setItem("codepulse-sidebar-collapsed", JSON.stringify(next));
}}
```
`codepulse-crt`'s version of the same idiom additionally listens for cross-tab/same-tab sync (`:362-383`) — D-15's four-domain object does NOT need this (no other surface reads `codepulse-nav-domains`), so the simpler `sidebarCollapsed`-shaped version (init + on-toggle write, no `storage`/custom-event listener) is the right amount of pattern to copy, not the CRT one.

**Existing `SectionErrorBoundary` composition (D-13's precedent)** (`:606-608`, and the component's own props at `src/components/SectionErrorBoundary.tsx:1-13`):
```typescript
<SectionErrorBoundary name="Active Brain">
  <BrainHeaderBadge />
</SectionErrorBoundary>
```
`SectionErrorBoundary` is a class component (`getDerivedStateFromError`/`componentDidCatch`) taking `{ children, name? }` — wrapping the system chip, Inbox badge, and Alerts badge each in their own instance (three separate `<SectionErrorBoundary name="...">` wrappers, not one shared wrapper around all three) is the direct extension of this exact call site.

**`lazy()` + `Suspense` header-child pattern — preserve the boundary, move only the mount point** (`:15-17`, `:611-613`; `:30-32`, `:638-640`):
```typescript
const ThemeSwitcher = lazy(() =>
  import("../components/ThemeSwitcher").then((m) => ({ default: m.ThemeSwitcher }))
);
// ...
<Suspense fallback={<div className="w-9 h-9" aria-hidden="true" />}>
  <ThemeSwitcher />
</Suspense>
```
When this moves inside a `DropdownMenuItem`, the `const ThemeSwitcher = lazy(...)` declaration at the top of the file must NOT change — only the JSX call site (currently `:611-613`) relocates. `CommandPalette`'s identical shape (`:30-32` declaration, `:638-640` mount) stays in Zone 2, untouched.

**`useConvexConnectionState()` — already imported and used, the D-11/122-D-16 precedent** (`:3`, `:152-153`):
```typescript
import { useConvexConnectionState } from "convex/react";
// ...
const convexState = useConvexConnectionState();
const isConnected = convexState.isWebSocketConnected;
```
This is inside `SidebarContent`, a sibling function component in the same file — the system chip needs its own call to this same hook (hooks can't be shared across sibling components without lifting state, and `useConvexConnectionState()` is cheap/idempotent to call twice per the existing precedent of `DashboardLayout` and `SidebarContent` both being separate function scopes).

**Header height comment block (`:529-550`) is the single most load-bearing comment in this file for D-06** — it must be UPDATED, not deleted, once the re-measurement resolves one way or the other (either replaced with a note that `h-12` was adopted after re-measurement clearing with margin, or left largely intact with a note that the wrap remains because the re-measurement did not clear). Do not silently delete this comment when changing `min-h-14` — a future reader needs to know the flex-wrap fallback was deliberate, control-proven history, not incidental styling.

**The "Astridr Runtime Telemetry" pill being deleted (D-08)** — exact block to remove is `:562-568`:
```typescript
<div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 border border-primary/20 shadow-[var(--glow-xs)]">
  <span className="w-2 h-2 rounded-full bg-primary shadow-[var(--glow-md)]" />
  <span className="text-xs font-mono tracking-widest text-primary uppercase">
    Astridr Runtime Telemetry
  </span>
</div>
```
SYS/LAT (`:570-585`) sits in the SAME parent `div` (`:562-586`) as this pill — deleting the pill without touching the SYS/LAT block means restructuring that wrapping div, not just removing three lines.

---

### System chip (new — composes `StatusBadge`)

**Analog:** `StatusBadge.tsx`'s own tier/semantic vocabulary (already excerpted in RESEARCH's Pattern 4) plus the existing `useAlertCounts()` hook.

**IMPORTANT DISCREPANCY FOUND THIS PASS — `useAlertCounts()` cannot be reused as-is for the system chip or Alerts badge.** `src/hooks/useAlerts.ts:16-18`:
```typescript
export function useAlertCounts() {
  return useQuery(api.alerts.countBySeverity) ?? { info: 0, warning: 0, error: 0, critical: 0 };
}
```
This hook collapses `undefined` (query still loading) to an all-zero object BEFORE the caller ever sees it — which is exactly the "a `0` that actually means not-loaded-yet" defect D-12 names as forbidden ("the fabricated-confidence defect POLISH-04 exists to prevent"). The system chip and the Alerts badge both need to distinguish `undefined` (render nothing / no badge) from `{critical: 0, error: 0, warning: 0, info: 0}` (query resolved, genuinely zero). **Call `useQuery(api.alerts.countBySeverity)` directly** (bypassing `useAlertCounts()`, or adding a new hook that preserves the `undefined` case) rather than reusing the existing hook verbatim — this is a real trap a planner would fall into by following RESEARCH's Pattern 4 pseudocode literally without checking the hook it half-suggests reusing.

**Composition target once the query result is resolved** — `StatusBadge`'s call shape (`src/components/StatusBadge.tsx:163-176`):
```typescript
export function StatusBadge({ status, label, tier: tierProp }: StatusBadgeProps) {
  // ...
  return (
    <Badge variant="secondary" className={cn("rounded-sm text-sm", style)}>
      {resolvedLabel}
    </Badge>
  );
}
```
`status` is NOT constrained to the legacy vocabulary — the type is `"ok" | "error" | "warn" | "idle" | string`, and any string not in `legacyMap` falls through `defaultTierForSemantic` (`:94-98`). For the four chip states, call with the DIRECT semantic + explicit `tier` + explicit `label` (bypassing `legacyMap` entirely, matching the "direct-semantic-literal callers" pattern the component's own comments describe at `:88-93`):
```typescript
<StatusBadge status="ok" tier="quiet" label="Nominal" />
<StatusBadge status="warn" tier="quiet" label="Attention" />
<StatusBadge status="error" tier="strong" label="Critical" />
<StatusBadge status="idle" tier="quietest" label="Offline" />
```
This matches the UI-SPEC's own table exactly (Header Contract § System chip).

---

### Count badges — Inbox and Alerts (new — composes base `Badge`)

**SECOND DISCREPANCY FOUND THIS PASS — the Inbox badge's cited backing query is wrong for a shell-level (profile-agnostic) badge.** `124-CONTEXT.md`'s `<canonical_refs>` and D-10 both cite `convex/inbox.ts:168 listByProfile` as the Inbox badge's data source. Read live:
```typescript
// convex/inbox.ts:168-171
export const listByProfile = query({
  args: { profileId: v.string() },
  handler: async (ctx, { profileId }) => listByProfileHandler(ctx, profileId),
});
```
`listByProfile` REQUIRES a `profileId` argument — but `DashboardLayout.tsx` has no profile-selection state anywhere in the file (grepped: `ProfileId`/`profileId` do not appear in `DashboardLayout.tsx`). The page that already surfaces inbox counts, `src/pages/Inbox.tsx`, explicitly does NOT use `listByProfile` for this reason — its own docstring says so directly (`src/pages/Inbox.tsx:8-14`):
```
 *   cards/held    — Convex inbox.listAll aggregate ALL-PROFILES read (D-12,
 *                   Plan 02/07, GOV-01/WATCH-01) — NOT a per-profile read.
 *                   Inbox.tsx has no profileId state and none is added; each
 *                   row carries its own profileId and renders a per-card
 *                   profile badge (InboxCard), so business/consulting rows
 *                   are never dropped and no profile switcher is needed.
```
`inbox.listAll` (`convex/inbox.ts:182-193`) is ALREADY bounded (index `by_createdAt` + `.take(limit ?? 200)`), already all-profiles, and is the exact query `Inbox.tsx` uses today for this reason. **SUPERSEDED 2026-08-21 — see the amended D-10 in `124-CONTEXT.md`.** This section correctly identified that `listByProfile` is unusable from the shell, but its proposed replacement (`inbox.listAll`'s length) was also rejected: `listAll` caps at `DEFAULT_LIST_ALL_LIMIT = 200` (`convex/inbox.ts:173`), and a live read of the self-hosted backend found **2,777 rows, 1,827 unacked** — so that badge would render a permanently frozen `200`, and an honest all-unacked count would render `1827`. Larry ruled the badge counts **unacked `held` rows only** via `inbox.listHeldUnacked` (`convex/inbox.ts:216-219`) — index-scoped on `by_itemType`, not subject to the 200 cap, measured at **46** live. Use that. The original analysis below is retained because its reasoning about `profileId` remains correct and load-bearing.

~~The shell Inbox badge should read `inbox.listAll`'s result length, not call `listByProfile`~~ — `listByProfile` would need a profileId the shell doesn't have, and picking one arbitrarily (e.g. hardcoding `"personal"`) would silently under-count business/consulting inbox items, the exact bug `Inbox.tsx`'s docstring says was deliberately avoided. Flag this to the planner as a correction to CONTEXT.md's own citation, not a new design decision — D-10's INTENT ("Inbox needs a badge with real backing") is unaffected; only the specific function to call changes.

**Inbox badge composition — base `Badge`, not `StatusBadge`** (UI-SPEC's own guidance, no severity concept applies):
```typescript
<Badge className="bg-(--surface-3) text-(--foreground) border border-(--hairline)">
  {count}
</Badge>
```
No live call site of the bare `Badge` primitive with this exact neutral-chip class combination was found in this pass — `src/components/ui/badge.tsx` itself was not read this pass (its base variant styles were not needed to write this excerpt, since the neutral treatment is fully specified in `124-UI-SPEC.md`'s own Sidebar Contract table verbatim) — read it before implementing to confirm the `variant="secondary"` (or default) base doesn't fight the override classes, the way `StatusBadge.tsx:172` already does (`<Badge variant="secondary" className={cn(...)}>`).

**Alerts badge — reuses the same `countBySeverity` read the system chip needs** (D-10's own text: "one subscription, two consumers"). Compose via `StatusBadge` with the worst-severity mapping from the System Chip table above, OR the simpler neutral pill — UI-SPEC leaves this as its own flagged Open Question #2, not a locked requirement.

---

### `convex/alerts.ts` — `countBySeverity` bounding (D-13, second half)

**Analog: same file, `listBySource`** (`convex/alerts.ts:94-107`) — the direct in-file template for bounding a `.collect()` into a `.take(limit)`:
```typescript
export const listBySource = query({
  args: {
    source: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("alerts")
      .withIndex("by_source", (q) => q.eq("source", args.source))
      .order("desc")
      .take(limit);
  },
});
```
The function to modify, unbounded today (`:109-126`):
```typescript
export const countBySeverity = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();
    const counts = { info: 0, warning: 0, error: 0, critical: 0 };
    for (const a of active) {
      if (a.status === "resolved") continue;
      const sev = a.severity as keyof typeof counts;
      if (sev in counts) counts[sev]++;
    }
    return counts;
  },
});
```
Unlike `listBySource`, this function needs a COUNT across ALL unacknowledged alerts, not a capped page of rows — so the fix is not a mechanical `.take(limit)` substitution (that would undercount real severities beyond the cap, defeating the badge's own purpose). The planner needs to choose between (a) capping at a generous ceiling documented as a known limitation (e.g. `.take(2000)`, matching this project's own `convex-mutation-read-limit-4096.md` finding that Convex mutations/queries have a hard read ceiling well below "all rows forever"), or (b) an `by_severity`-shaped index allowing `.take()` per severity bucket if such an index exists on the `alerts` table (not verified this pass — check `convex/schema.ts`'s `alerts` table definition before choosing). **No existing sibling query in this codebase already solves "bounded count across an unbounded unacknowledged set"** — this is the one piece of this phase without a clean same-shape analog; flag it to the planner as requiring its own small design decision within D-13's constraint, not a copy-paste fix.

**No existing Convex-level test harness for `countBySeverity`** — `convex/alerts.test.ts` (58 lines, read in full) tests only pure threshold-comparison logic extracted by hand into the test file itself; it does not import or mock the Convex `ctx.db` layer at all. No sibling bounded-query Convex test using a `convex-test`-style harness was located in this pass among the 65 `convex/*.test.ts` files glob-listed (not individually opened beyond `alerts.test.ts`) — if D-13's Convex-side test needs a live-db harness, the planner should grep for `convexTest(` or similar across `convex/*.test.ts` before assuming one exists, since this pass did not find the pattern in the one file most likely to have it.

---

### `src/components/CommandPalette.tsx` — D-05's rider (cmdk value-collision)

**Analog: same file, the Links group's explicit `value` (`:85-104`)** — this is the FIX template, to be applied to the Pages group ONLY IF the repro (below) proves a live defect:
```typescript
<CommandGroup heading="Links">
  {links.map((l) => (
    <CommandItem
      key={l.id}
      value={`${l.title} ${l.url}`}
      onSelect={() => select(() => { /* ... */ })}
    >
```
**The un-valued Pages `CommandItem` D-05 is concerned about** (`:60-72`):
```typescript
<CommandGroup heading="Pages">
  {navItems.map((item) => {
    if (!item.to) return null;
    const to = item.to;
    const Icon = iconComponents[item.icon] ?? LayoutDashboard;
    return (
      <CommandItem key={to} onSelect={() => select(() => navigate(to))}>
        <Icon className="mr-2 h-4 w-4" />
        {item.label}
      </CommandItem>
    );
  })}
</CommandGroup>
```
Confirmed live: no `value` prop is set here — cmdk's documented fallback (deriving `value` from rendered text content) applies, matching D-05's "reading of the code" claim exactly.

**Repro harness template — `src/components/__tests__/CommandPalette.test.tsx:34-43` + `:149-163`** (already excerpted in RESEARCH's Code Examples, reproduced here with the assertion half):
```typescript
// Fixture (mock hook return, :40-43):
links: [
  { id: "l1", title: "Convex dashboard", url: "http://127.0.0.1:6791" },
  { id: "l2", title: "Tasks", url: "http://127.0.0.1:7070" },  // collides with Pages' "Tasks"
],

// Assertion (:149-163):
it("a link whose title duplicates a nav page renders BOTH, with distinct cmdk values", () => {
  renderPalette({ open: true });
  const dupItems = screen.getAllByText("Tasks");
  expect(dupItems.length).toBe(2);
  const values = dupItems
    .map((el) => el.closest("[data-value]")?.getAttribute("data-value"))
    .filter(Boolean);
  expect(new Set(values).size).toBe(values.length);
});
```
This is the EXACT existing test that already proves cmdk's `value` fallback works correctly for the current "Tasks" collision (Pages "Tasks" vs. Links "Tasks", both rendering with a `value` — Links sets one explicitly, Pages falls back to text). Note this existing test does NOT reproduce D-05's specific concern (two items within the SAME group, Pages-vs-Pages, both relying on the text-fallback with no explicit value) — it proves the Links-vs-Pages case is already safe (because Links sets an explicit value), which is a DIFFERENT collision shape than "Analytics" vs "Agent Analytics" would be if left unrenamed (two Pages entries, NEITHER with an explicit value). The plan needs a NEW fixture varying `navItems`/`navGroups` (not `links`) to reproduce D-05's actual scenario — the existing test is the right harness shape to clone, not a test that already covers this case.

---

### `e2e/polish-geometry.spec.ts` — D-06/D-17 re-measurement (EXTEND)

**Analog:** itself — `gateOrSkip` (`:72-83`), the in-page evidence-object + single `console.log` line convention (`:85-109` for E-Stop, `:188-259` for the 900px walk), and the pattern of asserting `evidence.innerWidth === requestedWidth` FIRST as a void-check before trusting any other measurement (`:129-132`, `:264-267`).

**D-17's exact one-line fix** — `asideRect.width` expectation, currently implicit (no assertion on width exists yet in the excerpt read; the block asserts `scrollWidth`/`culprits` only, `:264-277`). The plan adds a new expectation `expect(evidence.asideRect?.width).toBe(232)` (or a tolerance-bounded check) alongside the existing `scrollWidth`/`culprits` assertions, in the SAME test block — RESEARCH's characterization of this as "existing block, `asideRect.width` expectation updated 240→232" is accurate to what the evidence object already captures (`asideRect` is already read at `:193-197`), just not yet asserted on.

**D-06's new `test.describe` block** — no existing block measures "combined min-content width of the three header zones" specifically; the closest structural template is the E-Stop block's `page.evaluate` + typed evidence interface + `console.log` + void-check-first pattern (`:85-176`), adapted to walk the header's three zone `<div>`s instead of one button.

---

## Shared Patterns

### `localStorage` shell-preference idiom
**Source:** `src/layouts/DashboardLayout.tsx:353-359` (read) + `:492-496` (write)
**Apply to:** the new `codepulse-nav-domains` key (D-15).
```typescript
const [x, setX] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("KEY") ?? "DEFAULT_JSON");
  } catch {
    return DEFAULT_VALUE;
  }
});
// ...on change:
setX(next);
localStorage.setItem("KEY", JSON.stringify(next));
```

### `SectionErrorBoundary` per-subscription wrapping
**Source:** `DashboardLayout.tsx:606-608`; component at `src/components/SectionErrorBoundary.tsx:13-64`
**Apply to:** system chip's alerts read, Inbox badge, Alerts badge — three separate boundary instances (D-13).

### `useConvexConnectionState()` for connection-derived UI
**Source:** `DashboardLayout.tsx:3`, `:152-153` (existing use inside `SidebarContent`)
**Apply to:** system chip's Offline branch (D-11).

### `lazy()` + fixed-size `Suspense` fallback for entry-chunk budget (DEBT-03)
**Source:** `DashboardLayout.tsx:15-17`/`:611-613` (`ThemeSwitcher`), `:30-32`/`:638-640` (`CommandPalette`)
**Apply to:** moving `ThemeSwitcher` into the `⋯` `DropdownMenuItem` — keep the `lazy()` declaration untouched, move only the `<Suspense><ThemeSwitcher/></Suspense>` JSX call site.

### Direct-semantic-literal `StatusBadge` calls (bypassing `legacyMap`)
**Source:** `src/components/StatusBadge.tsx:88-98` (the comment documenting this calling convention), `:163-176` (the component)
**Apply to:** system chip's four states, and the Alerts badge if the severity-colored option is chosen.

### `undefined`-vs-resolved query result must survive the hook boundary (D-12 correction)
**Source:** the discrepancy found in `src/hooks/useAlerts.ts:16-18` (documented above under "System chip")
**Apply to:** system chip AND Alerts badge — do not consume alert counts through a hook that defaults `undefined` to zero before the D-12 render-rule gets to see it.

---

## No Analog Found

| File / Fragment | Role | Data Flow | Reason |
|---|---|---|---|
| Breadcrumb derivation (reads `navGroups`/`navItems` + current route) | component/hook | transform | No existing hook or component in this codebase derives UI from the current route path combined with the nav registry. The nearest sibling is `AlertBanner.tsx`'s bare `useLocation().pathname.startsWith(...)` check (`src/components/AlertBanner.tsx:1,7,13`) — a route-based conditional, not a derivation — which at least confirms `useLocation` (not `useMatches`) is this repo's existing idiom for "what route am I on" and should be preferred over introducing route `handle` config. |
| Six-param-route breadcrumb override table (D-16) | data / lookup | transform | `handle`/`useMatches` — the mechanism RESEARCH's Architecture section names as an option — has ZERO existing usage in `src/App.tsx` (grepped, no matches). Introducing it would touch the route table this phase is explicitly forbidden from changing in structure (only presentation). A plain lookup object keyed by path pattern (matching `useLocation().pathname`), read from `DashboardLayout.tsx` or a small new hook file, is lower-risk and matches the one existing route-awareness idiom (`AlertBanner.tsx`) already in the repo. |
| Bounded-count-across-unbounded-set fix for `countBySeverity` | Convex query modification | CRUD/read (aggregation) | No sibling query in `convex/alerts.ts` (or found via `listBySource`'s narrower `.take(limit)`-per-page shape) solves "bounded aggregate count," only "bounded page of rows." Flagged above under `countBySeverity` — needs its own small design call, not a copy-paste. |

## Metadata

**Analog search scope:** `src/layouts/`, `src/lib/`, `src/components/` (incl. `ui/`, `__tests__/`), `src/hooks/`, `src/pages/Inbox.tsx`, `convex/alerts.ts`, `convex/inbox.ts`, `convex/health.ts`, `convex/alerts.test.ts`, `e2e/polish-geometry.spec.ts`, `e2e/a11y-routes.ts`
**Files scanned (read in full or targeted range this pass):** `124-CONTEXT.md`, `124-UI-SPEC.md`, `124-RESEARCH.md`, `DashboardLayout.tsx` (645 lines, full), `navRegistry.ts` (230 lines, full), `collapsible.tsx` (31 lines, full), `dropdown-menu.tsx` (255 lines, full), `StatusBadge.tsx` (179 lines, full), `EStopButton.tsx` (191 lines, full), `DashboardLayout.test.tsx` (196 lines, full), `CommandPalette.tsx` (240 lines, full), `CommandPalette.test.tsx` (221 lines, full), `RunTargetChooser.test.tsx` (lines 1-40), `polish-geometry.spec.ts` (280 lines, full), `a11y-routes.ts` (lines 1-59), `convex/alerts.ts` (lines 85-129), `convex/inbox.ts` (lines 150-194), `convex/health.ts` (83 lines, full), `convex/alerts.test.ts` (58 lines, full), `SectionErrorBoundary.tsx` (65 lines, full), `src/hooks/useAlerts.ts` (28 lines, full), `AlertBanner.tsx` (lines 1-13), `src/pages/Inbox.tsx` (lines 1-40)
**Pattern extraction date:** 2026-08-21
