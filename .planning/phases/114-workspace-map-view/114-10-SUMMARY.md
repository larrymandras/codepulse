---
phase: 114-workspace-map-view
plan: 10
subsystem: ui
tags: [react, react-router, url-state, error-boundaries, workspace-map]

# Dependency graph
requires:
  - phase: 114-02
    provides: "useWorkspaceMap / useArmsProbe hooks"
  - phase: 114-04
    provides: "AstridrLensEmptyState — the D-10 honest empty state"
  - phase: 114-06
    provides: "WorkspaceCoverageStrip — the D-14 always-visible header strip"
  - phase: 114-09
    provides: "WorkspaceMapCanvas — the radial canvas this page mounts"
provides:
  - "src/pages/WorkspaceMap.tsx — the /workspace-map page composing both lenses off a single subscription"
  - "Closed-set ?lens= URL param (D-12), lens-switcher Tabs, page-level selected-node/panel state"
  - "Two independent SectionErrorBoundarys around the coverage strip and canvas (T-114-18)"
  - "/workspace-map lazy route in App.tsx and a GRAPHS nav entry in navRegistry.ts"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mock convex/_generated/api with stable sentinel string values in any test that needs the fixture's queryFn-reference discrimination — the real generated api (anyApi from convex/server) is a Proxy that mints a new object on every property access, so === comparisons against the real (unmocked) api never match across two separate import sites"
    - "fireEvent.mouseDown (not fireEvent.click) to activate a Radix Tabs.Trigger in jsdom — Tabs.Trigger's selection handler is wired to onMouseDown (and onKeyDown/onFocus), not onClick (@radix-ui/react-tabs/dist/index.js:164)"

key-files:
  created:
    - src/pages/WorkspaceMap.tsx
    - src/pages/WorkspaceMap.test.tsx
  modified:
    - src/App.tsx
    - src/lib/navRegistry.ts

key-decisions:
  - "WorkspaceCoverageStrip receives `payload ?? undefined` (not the raw three-state payload) because its prop type (`WorkspaceMapData | undefined`) predates and does not accept `null` — the true-empty state (no snapshot ingested) degrades the strip to its loading skeleton rather than a distinct empty copy. This is a forced consequence of the prop contract established by 114-06 (out of this plan's file list to touch), not a new design choice; the canvas's own true-empty copy still surfaces the actual explanation."
  - "The Ástríðr lens is not wrapped in its own SectionErrorBoundary — only the two boundaries the plan and threat model (T-114-18) explicitly name (coverage strip, canvas) exist. AstridrLensEmptyState has no useQuery of its own (it's prop-driven from the page's useArmsProbe() call) so its failure surface is materially smaller than the two data-bearing sections."
  - "Lens switching always writes an explicit `lens=workspace` or `lens=astridr` param (never deletes the param on defaulting back to workspace) — simpler than conditionally omitting it, and D-12 only requires bookmarkability/reload-survival, not a minimal-URL guarantee."

patterns-established: []

requirements-completed: []  # design-doc-driven phase — traced to D-01..D-18, not REQ-IDs

# Metrics
duration: ~45min
completed: 2026-08-14
---

# Phase 114 Plan 10: Workspace Map Page, Route & Nav Entry Summary

**`/workspace-map` page composing WorkspaceCoverageStrip + WorkspaceMapCanvas (workspace lens) or AstridrLensEmptyState (Ástríðr lens) off one `useWorkspaceMap()` subscription, behind a closed-set `?lens=` URL param and two independent `SectionErrorBoundary`s — routed and added to the GRAPHS nav group.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments

- Built `WorkspaceMap.tsx`: a single `useWorkspaceMap()` call feeds both `WorkspaceCoverageStrip` and `WorkspaceMapCanvas` (D-02); `useArmsProbe()` drives `AstridrLensEmptyState`. Lens state derives from `searchParams.get("lens")` via a closed-set comparison against the literal `"astridr"`, falling through to `"workspace"` for absent, empty, or any unrecognized value (D-12) — the raw param string is never rendered or interpolated anywhere in the file. Switching lenses (via the `Tabs` switcher or the empty state's "View Larry's Workspace" action) writes the param back through `setSearchParams`, making the selection bookmarkable and reload-survivable.
- Two independent `SectionErrorBoundary`s — `name="Workspace Coverage Strip"` and `name="Workspace Map Canvas"` — wrap the strip and canvas separately (not nested, not shared), per CONTEXT.md's explicit T-114-18 requirement and the recorded Phase 110 `/analytics` / `heroStats` precedent of an unhandled `useQuery` throw blanking the whole page.
- Page-level state (`selectedNode`, `selectedRootIndex`, `panelOpen`) is driven entirely by the canvas's `onNodeSelect` callback and handed straight to `WorkspaceMapPanel` — the page computes nothing about node content itself, matching 114-08/114-09's "the panel computes neither figure" contract.
- Registered the lazy route (`/workspace-map`, matching the `KnowledgeGraph` Suspense-fallback convention exactly) in `App.tsx`, and the last GRAPHS-group nav entry (`Radar` icon, confirmed zero prior `radar` key in `iconComponents`) in `navRegistry.ts` — `DashboardLayout.tsx` untouched, confirmed by `git diff --name-only` after each commit.
- Wrote 7 tests: four `"lens param"` cases (absent, `?lens=workspace`, `?lens=astridr` with the coverage strip proven absent, and an unrecognized value proven to both fall back to the workspace lens AND never render the raw garbage string), two error-isolation tests (one per boundary, proving a fault in either section leaves the other fully rendered), and one tab-switching test that round-trips through a `useLocation()`-backed `LocationProbe` to assert the URL itself changed.

## Task Commits

1. **Task 1: Build the WorkspaceMap page** — `89ee64bd` (feat)
2. **Task 2: Register the route and the nav entry** — `d6add5b7` (feat)
3. **Task 3: Prove the lens param, including the unrecognized-value default** — `c9343deb` (test)

**Plan metadata commit:** pending (this SUMMARY.md — STATE.md/ROADMAP.md are owned by the orchestrator, not this executor, per the shared-artifact prohibition in this executor's dispatch).

## Files Created/Modified

- `src/pages/WorkspaceMap.tsx` — the page: lens derivation, `Tabs` switcher, two `SectionErrorBoundary`s, panel state, route composition. No hardcoded hex (`grep -cE '#[0-9a-fA-F]{3,8}\b'` → 0).
- `src/pages/WorkspaceMap.test.tsx` — 7 tests covering D-12's four lens cases, T-114-18's two error-isolation cases, and the tab-switching round-trip.
- `src/App.tsx` — one `lazy()` import + one `<Route>` inside the `DashboardLayout` block, matching the `KnowledgeGraph` convention verbatim (fallback text "Loading Workspace Map...").
- `src/lib/navRegistry.ts` — `Radar` import, `radar: Radar` in `iconComponents` with the per-phase comment convention, and the GRAPHS group's `items` array gains `{ to: "/workspace-map", label: "Workspace Map", icon: "radar", group: "GRAPHS" }` after `/capabilities`.

## Decisions Made

See `key-decisions` in the frontmatter above — the coverage-strip null-coercion, the deliberate non-wrapping of the Ástríðr lens in its own boundary, and the always-explicit `lens=` param on switch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `src/test/workspaceMapFixture.ts`'s discriminating `useQuery` mock needs the real `convex/_generated/api` module ALSO mocked with stable sentinel values — otherwise every `queryFn === api.x.y` comparison silently fails**

- **Found during:** Task 3, first test run — `WorkspaceCoverageStrip` rendered its loading skeleton (not real content) even though `mockGetWorkspaceMap(makeWorkspaceMapFixture())` was called in `beforeEach`.
- **Issue:** `convex/_generated/api.js` exports `api = anyApi` (from `convex/server`), which is a `Proxy` that constructs a brand-new object on every property access (`createApi()` in `node_modules/convex/dist/esm/server/api.js`). Two separate `api.workspace.getWorkspaceMap` reads — one inside `useWorkspaceMap.ts`, one inside `workspaceMapFixture.ts`'s `installDiscriminatingMockImplementation` — are therefore never `===`, so the fixture's discrimination logic (`queryFn === api.workspace.getWorkspaceMap`) fell through to its `undefined` default on every call. This is not a bug in the 114-03 fixture itself — `CodeVaultGraph.test.tsx` (the established prior-art pattern) already mocks the api module for exactly this reason; my test file was simply the first *consumer* of the discriminating helpers, and had not yet added that mock.
- **Fix:** Added `vi.mock("../../convex/_generated/api", () => ({ api: { workspace: { getWorkspaceMap: "workspace:getWorkspaceMap" }, graphSnapshots: { listSnapshots: "graphSnapshots:listSnapshots" } } }))` to `WorkspaceMap.test.tsx`. Since vi.mock intercepts by resolved absolute module path (not import specifier string), this single mock declaration is honored by every importer that resolves to the same file — `useWorkspaceMap.ts`, `useArmsProbe.ts`, and `workspaceMapFixture.ts` alike — regardless of each file's own relative-path depth.
- **Files modified:** `src/pages/WorkspaceMap.test.tsx` only (test setup, no production-code impact).
- **Verification:** All 7 tests pass; the "lens param" suite now genuinely exercises real rendered coverage-strip/canvas content (not a permanently-loading skeleton).
- **Committed in:** `c9343deb` (Task 3 commit)

**2. [Rule 1 - Bug] `fireEvent.click` on a Radix `Tabs.Trigger` never fires `onValueChange` in jsdom**

- **Found during:** Task 3, "switching lenses" test — the URL never changed after the simulated tab click.
- **Issue:** `@radix-ui/react-tabs`'s `Trigger` wires selection to `onMouseDown` (plus `onKeyDown`/`onFocus` for keyboard/automatic activation), not `onClick` (`node_modules/@radix-ui/react-tabs/dist/index.js:164`). `fireEvent.click` alone never dispatches a preceding `mousedown`, so the handler never ran.
- **Fix:** Changed the tab-activation line to `fireEvent.mouseDown(...)`, matching the actual DOM event Radix listens for. The subsequent "View Larry's Workspace" click uses a plain shadcn `Button` (real `onClick`), so `fireEvent.click` there is correct and unchanged.
- **Files modified:** `src/pages/WorkspaceMap.test.tsx` only.
- **Verification:** The switching test now correctly asserts both the URL round-trip (via `LocationProbe`) and the rendered-surface swap in both directions.
- **Committed in:** `c9343deb` (Task 3 commit)

---

**Total deviations:** 2 (both Rule 1/3, test-file-only, no production-code impact)
**Impact on plan:** None on functionality — both fixes are test-harness corrections needed to make the plan's own acceptance criteria (a genuinely green, non-vacuous test suite) achievable. No scope creep; `WorkspaceMap.tsx`, `App.tsx`, and `navRegistry.ts` are unaffected.

## Issues Encountered

None beyond the two deviations documented above.

## Privacy / Disclosure Gate

- Ran `grep -F 'C:\Users\mandr' src/pages/WorkspaceMap.tsx src/pages/WorkspaceMap.test.tsx src/App.tsx src/lib/navRegistry.ts` → **zero matches** (exit code 1).
- Known-positive control: `grep -F 'C:\Users\mandr' CLAUDE.md` → matched twice (exit code 0), proving the fixed-string pattern actually discriminates rather than trivially returning empty.
- No real root/directory/department name appears in the test file — all fixture-derived text assertions (e.g. "roots covered") are aggregate/structural, sourced from `makeWorkspaceMapFixture()`'s synthetic `root-a`/`root-b`/`root-c`/`root-d` set (114-03), never a real workspace name.

## Threat Flags

None. This plan's owned threats are mitigated exactly per the plan's `<threat_model>`:
- T-114-03 (`?lens=` tampering): closed-set comparison against the literal `"astridr"` only, proven by the unrecognized-value test asserting both the workspace fallback and the raw string's absence from rendered output.
- T-114-18 (one failing section blanking the page): two independent `SectionErrorBoundary`s, proven by the two dedicated error-isolation tests.
- T-114-19 (double subscription): `useWorkspaceMap()` called exactly once in the file (`grep -c 'useWorkspaceMap()'` → 1), payload passed to both consumers.
- T-114-SC (package installs): zero installs this plan — `Radar` came from the already-installed `lucide-react`.

No new security-relevant surface (network endpoint, auth path, file access pattern, schema change) was introduced — this plan composes already-built components and hooks behind client-side routing state only.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `/workspace-map` is live, routed, and reachable from the GRAPHS nav group. This closes out Phase 114's plan sequence (wave 5, the last autonomous build plan named in the plan's own `<verification>` block: "this is the last autonomous build plan; the wave gate applies").
- D-18's folded todo (open Chrome's Issues tab on `/workspace-map` and record the entry's category/source verbatim) is an operator-checkpoint procedure step, not a build task — it belongs to whatever manual verification step follows this plan, not to this executor's autonomous task list (this plan's frontmatter carries no `checkpoint:*` task).
- No blockers for the phase's own verification pass.

## Self-Check: PASSED

- `[ -f src/pages/WorkspaceMap.tsx ]` → FOUND.
- `[ -f src/pages/WorkspaceMap.test.tsx ]` → FOUND.
- `git log --oneline --all | grep -q 89ee64bd` → FOUND.
- `git log --oneline --all | grep -q d6add5b7` → FOUND.
- `git log --oneline --all | grep -q c9343deb` → FOUND.
- `npx tsc --noEmit` → clean (no output), run twice (after Task 1 and after Task 3).
- `npm run build` → succeeds; `WorkspaceMap` is its own lazy chunk (`WorkspaceMap-eJca02Et.js`, 17.38 kB / gzip 6.16 kB).
- `npx vitest run src/pages/WorkspaceMap.test.tsx` → 7/7 passed.
- `npx vitest run src/pages/WorkspaceMap.test.tsx -t "lens param"` → 4 passed, 3 skipped (resolves, non-empty).
- `npx vitest run src/App.test.tsx` (isolated, since `App.tsx` was modified) → 19/19 passed.
- Full suite: `npx vitest run` → 323 test files passed | 17 skipped, 4396 tests passed | 197 todo | 0 failed.
- `git show --stat HEAD` confirmed after each of the 3 commits — no foreign files swept in; `DashboardLayout.tsx` untouched (`git diff --name-only` after Task 2 listed only `App.tsx` and `navRegistry.ts`).
- Disclosure grep — zero matches on all 4 touched files, control matched on `CLAUDE.md` (see Privacy / Disclosure Gate section above).

---
*Phase: 114-workspace-map-view*
*Completed: 2026-08-14*
