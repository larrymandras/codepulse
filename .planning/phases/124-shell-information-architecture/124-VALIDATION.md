---
phase: 124
slug: shell-information-architecture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-21
---

# Phase 124 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `124-RESEARCH.md` § Validation Architecture (lines 527-600).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom project) for component/unit tests; Playwright for `e2e/*.spec.ts` geometry + a11y specs |
| **Config file** | `vitest.config.ts` (jsdom + browser projects); `playwright.config.ts` for e2e |
| **Quick run command** | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx src/lib/__tests__/navRegistry.routes.test.ts` |
| **Full suite command** | `npm test` (Vitest), plus `npx playwright test e2e/polish-geometry.spec.ts` for the geometry gate |
| **Estimated runtime** | ~35s Vitest quick run; full Vitest suite + the single Playwright spec well under 5 min |

**Per-file mocking convention (do not change globally).** `src/test/setup.ts` (152 lines) installs
jsdom polyfills and exactly one `vi.mock` (`livekit-client`). Heavy render libraries are mocked
**per test file**, not globally. Radix primitives introduced by this phase (`Collapsible`,
`DropdownMenu`) need a per-file `ResizeObserver` polyfill — the live idiom already exists at
`src/components/skills/RunTargetChooser.test.tsx:20-24` and two siblings. No `setup.ts` change is
required or wanted.

---

## Sampling Rate

- **After every task commit:** the Vitest file(s) covering the surface just touched
  (`DashboardLayout.test.tsx`, the new route-set test, `CommandPalette.test.tsx`).
- **After every plan wave:** full `npm test` **plus** `npx playwright test e2e/polish-geometry.spec.ts`.
- **Before `/gsd:verify-work`:** full suite green, plus the operator visual checkpoint
  (Phases 122/123 precedent — 123's D-18 checkpoint surfaced two real defects beyond its
  stated question, so this is not ceremony).
- **Max feedback latency:** ~35s (quick run), ~5 min (wave gate).

---

## Per-Requirement Verification Map

Task IDs are bound at plan time; this map is keyed on requirement + behavior so the planner can
attach each row to the task that delivers it.

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| SHELL-01 | 48px 3-zone header renders on every route | unit + e2e | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx`; `npx playwright test e2e/polish-geometry.spec.ts` | ✅ extend |
| SHELL-01 | Header zones' min-content clears available width at 375px + 900px (D-06) | e2e | `npx playwright test e2e/polish-geometry.spec.ts` (**new** `test.describe` block) | ❌ W0 |
| SHELL-01 | Right zone holds 6 visible controls; `⋯` holds exactly theme, privacy, CRT, audio (D-07 — **no help**) | unit | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` | ✅ extend |
| SHELL-02 | 4-domain sidebar, count badges, 2px `--primary` active rail, `aria-current` on active item | unit | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` | ✅ extend |
| SHELL-02 | Sidebar is 232px expanded (replaces the `test.todo` at `DashboardLayout.test.tsx:194`) | unit | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` | ✅ extend |
| SHELL-02 | 900px Settings/sidebar geometry holds at 232px (`asideRect.width` 240→232) | e2e | `npx playwright test e2e/polish-geometry.spec.ts` (existing block, expectation updated) | ✅ extend |
| SHELL-02 | **Route-list diff before/after is identical (Criterion 3)** | unit | `npx vitest run src/lib/__tests__/navRegistry.routes.test.ts` | ❌ W0 |
| SHELL-02 | D-05's cmdk value-collision repro, before AND after the Analytics label rename | unit | `npx vitest run src/components/__tests__/CommandPalette.test.tsx` | ✅ extend |
| SHELL-01/02 | `alerts.countBySeverity` `.collect()` is bounded (D-13) | unit (Convex) | Assertion on read bound, modelled on a sibling index-bounded query (`inbox.listByProfile`, `convex/inbox.ts:168`) | ❌ W0 — planner locates the sibling test as template |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/navRegistry.routes.test.ts` — the Criterion-3 route-set assertion. Golden
      fixture is a **committed literal array** captured from the pre-regroup `navRegistry.ts`
      (not a git-SHA-anchored read — this project has been bitten by relative-ref rot).
      Ships with the mutation-proof below.
- [ ] New `test.describe` block in `e2e/polish-geometry.spec.ts` for D-06's header min-content
      measurement at 375px and 900px. The file's existing blocks cover E-Stop geometry and a
      900px whole-body overflow walk — neither measures the three zones' combined min-content
      against available width, which is the stricter thing D-06 asks for.
- [ ] Convert `DashboardLayout.test.tsx:194`'s `test.todo("sidebar width is 240px (w-60) when
      expanded")` into a real passing assertion at **232px** (D-17). The file already mounts
      `DashboardLayout` with every mock it needs; only the assertion body is missing.
- [ ] Bounded-read assertion for `alerts.countBySeverity`.

---

## Mutation-Proof Requirement (BLOCKING — Criterion 3)

A guard test proves nothing until it is shown to fail on the defect it exists to catch. After
writing the route-set test, mutate `src/lib/navRegistry.ts` three ways, **one at a time**, and
confirm each **FAILS** before reverting:

1. **Add** a route absent from the golden fixture (duplicate an item with a new `to`).
2. **Remove** a route from `navGroups` entirely.
3. **Rename** one `to` value (`/alerts` → `/alerts2`) with no change in count.

All three must fail. A test that catches (1) and (2) but not (3) is asserting **cardinality**, not
the route set. Case (3) is the one that matters here: **this phase deliberately renames two nav
labels under D-05 without touching their `to` values**, so the test must discriminate a label
rename from a path rename — otherwise it passes exactly the defect class it was written for.

Each mutation must be **syntactically valid**. A mutation that breaks the module import produces a
collection error, which is red for the wrong reason and proves nothing.

**Why Criterion 3 is achievable at all:** `navRegistry.ts:218-229` already flattens `navGroups`
into a `navItems` array deduped by `to`. Regrouping changes which group an item sits in; it does
not touch the flattened path set. Verified live this pass.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `ThemeSwitcher`'s `lazy()` + `Suspense` wrapper survives the move into the `⋯` menu | SHELL-01 (DEBT-03 budget) | **No bundle-size CI gate exists in this repo**, so nothing catches an entry-chunk regression automatically. Confirmed absent this pass. | Diff-review the `ThemeSwitcher` mount site: the `lazy()` import and `Suspense` fallback must be unchanged; only the mount location moves. If the `lazy()` boundary is collapsed, the control lands in the entry chunk silently. |
| Calm/quiet visual read of the assembled shell | SHELL-01, SHELL-02 | Aesthetic judgment on the assembled result — 122/123 precedent shows the checkpoint finds defects beyond its stated question | Operator visual checkpoint before `/gsd:verify-work`, per `124-CONTEXT.md`'s Claude's-Discretion section |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all ❌ references above
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 35s for the quick run
- [ ] Mutation-proof for the route-set test executed, all 3 cases shown failing
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
