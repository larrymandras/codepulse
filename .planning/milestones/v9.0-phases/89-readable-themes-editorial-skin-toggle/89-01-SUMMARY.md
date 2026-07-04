---
phase: 89
plan: "01"
subsystem: theming-foundation
tags: [theming, a11y, hooks, tdd, testing]
dependency_graph:
  requires: []
  provides:
    - useThemeColors() hook (canvas color resolver)
    - hexToRgba() utility
    - "@axe-core/playwright installed"
    - e2e test scaffolds (3 specs, 24 test cases)
    - ThemeSwitcher unit test scaffold
    - ThemeSwitcher updated (amber removed, readable/aubergine added)
  affects:
    - Phase 91 (3D Memory Galaxy) — hard dependency on useThemeColors
    - Plans 89-06 (canvas wave) — consumes ThemeColors interface
    - Plans 89-02..05 — e2e specs turn green as those plans ship
tech_stack:
  added:
    - "@axe-core/playwright@^4.12.1 (devDependency)"
  patterns:
    - MutationObserver + attributeFilter for data-theme re-resolve
    - lazy useState initializer (resolveThemeColors runs at render time, post pre-paint)
    - hexToRgba defensive pass-through for oklch values
    - TDD RED → GREEN: tests written first, then implementation
    - Playwright addInitScript + waitForLoadState('networkidle') for theme-aware e2e
key_files:
  created:
    - src/lib/hexToRgba.ts
    - src/lib/hexToRgba.test.ts
    - src/hooks/useThemeColors.ts
    - src/hooks/useThemeColors.test.ts
    - e2e/theme-contrast.spec.ts
    - e2e/theme-no-fouc.spec.ts
    - e2e/theme-reduced-motion.spec.ts
    - src/components/ThemeSwitcher.test.tsx
  modified:
    - package.json (added @axe-core/playwright devDep)
    - package-lock.json
    - src/components/ThemeSwitcher.tsx (options: amber removed, readable/aubergine added; trigger w-[160px])
decisions:
  - "@axe-core/playwright installed after operator pre-approved package legitimacy gate (Task 1 checkpoint)"
  - "ThemeSwitcher amber option removed, readable + aubergine added — per PATTERNS.md §ThemeSwitcher changes"
  - "resolveThemeColors exported as module-level function (not inside hook) per PATTERNS.md convention — allows lazy useState + MutationObserver to share the same resolver"
  - "waitFor() used in re-resolve test — jsdom MutationObserver fires async; act() alone insufficient"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-24"
  tasks_completed: 3
  files_created: 8
  files_modified: 3
---

# Phase 89 Plan 01: Foundation — Dependency Install, Hook, Test Scaffolds — Summary

Wave 0 foundation for Phase 89 theming: `@axe-core/playwright` installed, `useThemeColors()` hook + `hexToRgba()` util authored with 20 passing unit tests, and all 4 test scaffolds (3 e2e + 1 ThemeSwitcher unit) seeded with RED-pending annotations for the waves that fill in behavior.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install @axe-core/playwright (pre-approved) | `0836f53` | package.json, package-lock.json |
| 2 | hexToRgba util + useThemeColors hook (TDD) | `ba80379` | src/lib/hexToRgba.ts, src/hooks/useThemeColors.ts, 2 test files |
| 3 | e2e specs + ThemeSwitcher scaffold | `60fe86a` | 3 e2e specs, ThemeSwitcher.test.tsx, ThemeSwitcher.tsx |

## Artifacts Produced

### `src/lib/hexToRgba.ts`
Converts `#rrggbb` / `#rgb` hex strings to `rgba(r, g, b, alpha)`. Trims leading whitespace (Pitfall 1 — `getComputedStyle` leading space). Passes non-hex values (oklch, named colors) through unchanged so canvas code does not corrupt `fillStyle` (Pitfall 3 defence). No external dependencies.

### `src/hooks/useThemeColors.ts`
Exports:
- `ThemeColors` interface — 12 fields: `primary`, `primaryAlpha18`, `primaryAlpha55`, `accent`, `vaultNode`, `vaultNodeAlpha18`, `chartBar`, `chartBarAccent`, `statusOk`, `statusWarn`, `statusError`, `statusInfo`
- `resolveThemeColors(): ThemeColors` — reads CSS custom properties fresh via `getComputedStyle(document.documentElement)` + `.trim()` on each call; builds alpha variants via `hexToRgba`
- `useThemeColors(): ThemeColors` — lazy `useState(resolveThemeColors)` + `MutationObserver` on `attributeFilter: ['data-theme']`; disconnects on unmount

`vaultNode` / `vaultNodeAlpha18` implement locked decision D-vault: vault nodes use dedicated `--vault-node-color` token (default violet `#8b5cf6`), not `--accent`.

### e2e specs (RED-pending, importable)
- `e2e/theme-contrast.spec.ts` — 20 tests (4 themes × 5 pages), axe-core WCAG-AA
- `e2e/theme-no-fouc.spec.ts` — 2 tests, `domcontentloaded` `data-theme` assertion
- `e2e/theme-reduced-motion.spec.ts` — 2 tests, `emulateMedia` + hidden element assertions

### `src/components/ThemeSwitcher.test.tsx`
4 passing tests + 2 `it.todo` placeholders for Plan 05 key-migration assertions. Tests: render without crash, default cyan `data-theme`, saved theme applied, correct four items rendered (cyan/emerald/readable/aubergine; amber absent).

### `src/components/ThemeSwitcher.tsx` (modified)
Amber option removed. Readable Dark + Midnight Aubergine options added. Trigger width widened from `w-[140px]` to `w-[160px]`.

## Verification Results

| Check | Result |
|-------|--------|
| `node -e "require('@axe-core/playwright')"` | PASS |
| `npx vitest run src/lib/hexToRgba.test.ts src/hooks/useThemeColors.test.ts src/components/ThemeSwitcher.test.tsx` | PASS — 20 tests + 2 todos |
| `npx playwright test --list` (3 new specs) | PASS — 24 tests enumerated |
| `npx tsc --noEmit` (new files) | PASS — no errors |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MutationObserver async timing in test**
- **Found during:** Task 2 GREEN phase
- **Issue:** `act(() => { setAttribute('data-theme', 'readable') })` did not synchronously flush the MutationObserver callback in jsdom; the hook state did not update within the same `act()` tick, causing the re-resolve test to read the old value
- **Fix:** Added `await waitFor(() => { expect(result.current.primary).toBe('#5eead4'); })` import from `@testing-library/react` to wait for the async observer-triggered re-render
- **Files modified:** `src/hooks/useThemeColors.test.ts`
- **Commit:** `ba80379`

## Known Stubs

None. All exported functions have real implementations. The 3 e2e specs contain RED-pending assertions on behavior not yet built (token blocks, inline script, CSS suppression rules) — these are intentional scaffolds documented with `RED-pending:` comments, not stubs.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. All additions are dev-side test infrastructure and a client-side React hook reading own-origin CSSOM.

## Package Legitimacy Gate (Task 1)

Operator pre-approved `@axe-core/playwright` before execution:
- Confirmed: `@axe-core` org published by Deque Systems (dequelabs/axe-core-npm)
- Version installed: 4.12.1 (latest)
- Weekly downloads: millions
- `node -e "require('@axe-core/playwright')"` exports `AxeBuilder`

This checkpoint was pre-approved in the prompt (`<checkpoint_preapproval>`) and is documented here per the threat register entry T-89-SC.

## Self-Check: PASSED

All 8 created files exist on disk. All 3 task commits verified in git log (0836f53, ba80379, 60fe86a).
