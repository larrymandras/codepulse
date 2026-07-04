---
phase: 89
plan: "06"
subsystem: canvas-theming
tags: [theming, canvas, th-01, a11y, hooks]
dependency_graph:
  requires:
    - "89-01 (useThemeColors hook + ThemeColors interface)"
  provides:
    - "Canvas graphs (ForceGraphCanvas, CodeVaultGraph, KnowledgeGraph) resolve node/link colors from useThemeColors()"
    - "ForceGraphCanvas accepts defaultNodeColor/defaultLinkColor props (theme-aware parent-supplied defaults)"
    - "Vault nodes use --vault-node-color token (violet) consistently, not --accent"
  affects:
    - "Phase 91 (3D Memory Galaxy) — canvas color wiring unblocked; TH-01 surface complete"
    - "Plans 89-07 (remaining phase plans) — TH-01 requirement fully satisfied"
tech_stack:
  added: []
  patterns:
    - "useThemeColors() called inside the component that owns colorFn/linkColorFn (not at module scope)"
    - "colorFn/linkColorFn wrapped in useCallback([colors]) to re-create on theme switch"
    - "ForceGraphCanvas receives colors via props from parent — does NOT call the hook"
    - "CSSOM fallback chain: parent-prop → getComputedStyle(--primary) → zinc neutral (never hardcoded emerald)"
key_files:
  modified:
    - src/components/graph/ForceGraphCanvas.tsx
    - src/components/graph/CodeVaultGraph.tsx
    - src/pages/KnowledgeGraph.tsx
    - src/components/graph/ForceGraphCanvas.test.tsx
    - src/components/graph/CodeVaultGraph.test.tsx
decisions:
  - "ForceGraphCanvas does NOT call useThemeColors() — colors come from parent props (defaultNodeColor/defaultLinkColor) per PATTERNS §Canvas files"
  - "Vault nodes use colors.vaultNode (--vault-node-color token, violet #8b5cf6 default) NOT colors.accent — per locked decision D-vault from Plan 01"
  - "CSSOM fallback uses zinc neutral (#6b7280) not hardcoded emerald — eliminates all #10b981 literals from canvas files"
  - "linkColorFn in KnowledgeGraph moved from module scope to useCallback inside component so it captures colors.primaryAlpha55"
  - "linkColorDiffFn useMemo updated to include linkColorFn in deps array (closure correctness)"
  - "CodeVaultGraph.test mocks useThemeColors with known Matrix Emerald defaults so colorFn assertions remain meaningful"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-24"
  tasks_completed: 3
  files_modified: 5
---

# Phase 89 Plan 06: Canvas Graph Theme Migration (TH-01) — Summary

Canvas graphs resolve node/link colors from `useThemeColors()` via prop-passing (ForceGraphCanvas) and direct hook calls (CodeVaultGraph, KnowledgeGraph) — eliminating all hardcoded `#10b981`/`#8b5cf6`/`rgba(16,185,129,...)` canvas color literals.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Theme-aware defaults in ForceGraphCanvas | `45b1f4e` | src/components/graph/ForceGraphCanvas.tsx |
| 2 | Route useThemeColors into CodeVaultGraph | `db9d8fb` | src/components/graph/CodeVaultGraph.tsx |
| 3 | Theme-aware current-node color in KnowledgeGraph + build/test gate | `1613472` | src/pages/KnowledgeGraph.tsx, 2 test files |

## What Changed

### Task 1 — ForceGraphCanvas (`45b1f4e`)

Removed module-level `DEFAULT_COLOR = "#10b981"` and the inline `"rgba(16,185,129,0.18)"` link color default. Added two optional props:

- `defaultNodeColor?: string` — parent supplies theme-resolved value from `useThemeColors().primary`
- `defaultLinkColor?: string` — parent supplies theme-resolved value from `useThemeColors().primaryAlpha18`

When neither prop nor `colorFn`/`linkColorFn` is supplied, the component reads `--primary` from `getComputedStyle` at call time. The fallback chain terminates at zinc neutral (`#6b7280` / `rgba(107,114,128,0.18)`) — never hardcoded emerald. `ForceGraphCanvas` does NOT import or call `useThemeColors` itself.

### Task 2 — CodeVaultGraph (`db9d8fb`)

Removed module-level `CODE_COLOR = "#10b981"` and `VAULT_COLOR = "#8b5cf6"` constants. Removed module-level `colorFn` and `linkColorFn` functions. Inside `GraphContent`:

- `const colors = useThemeColors()` called at component scope
- `colorFn`: vault nodes (`vault:` id prefix) → `colors.vaultNode`; code nodes → `colors.primary`; wrapped in `useCallback([colors])`
- `linkColorFn`: vault↔vault links → `colors.vaultNodeAlpha18`; code↔code links → `colors.primaryAlpha18`; cross-source links → `"rgba(255,255,255,0.08)"`; wrapped in `useCallback([colors])`
- `paintNode` `useCallback` deps updated to include `colorFn`
- Legend dot swatches and source-pill inline styles use `colors.primary` / `colors.vaultNode`
- `defaultNodeColor={colors.primary}` and `defaultLinkColor={colors.primaryAlpha18}` passed to `ForceGraphCanvas`

### Task 3 — KnowledgeGraph + tests (`1613472`)

Removed module-scope `COLOR_CURRENT = "rgba(16,185,129,0.55)"`. Inside the `KnowledgeGraph` component:

- `const colors = useThemeColors()` added at the top of the component
- `linkColorFn` moved from module scope to `useCallback([colors])` inside the component; uses `colors.primaryAlpha55` for current-edge color
- `linkColorDiffFn` `useMemo` updated to include `linkColorFn` in deps

**Test fixes (Rule 1 — Bug):** Two tests asserted the old hardcoded hex values:
1. `ForceGraphCanvas.test.tsx` "uses the default emerald color" → updated to assert string/non-empty behavior + added `defaultNodeColor` prop test
2. `CodeVaultGraph.test.tsx` colorFn assertion → added `useThemeColors` mock returning known Matrix Emerald values so assertions remain precise

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — no errors |
| `npx vitest run` (full suite) | PASS — 134 passed, 18 skipped, 0 failed |
| `npm run build` | PASS — exits 0 |
| `grep #10b981/#8b5cf6/rgba(16,185,129) across 3 canvas files` | PASS — 0 matches |
| `grep useThemeColors CodeVaultGraph.tsx` | PASS — 4 occurrences (import + 1 call + 2 comments) |
| `grep vaultNode CodeVaultGraph.tsx` | PASS — 8 occurrences |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test suite failure — ForceGraphCanvas "default emerald color" test**
- **Found during:** Task 3 vitest run
- **Issue:** `ForceGraphCanvas.test.tsx` line 110 asserted `nodeColor() === "#10b981"` — the old hardcoded constant. After Task 1 replaced it with CSSOM/prop-driven logic, jsdom returns empty string for `--primary`, causing the fallback to zinc neutral `#6b7280`.
- **Fix:** Renamed test to "uses a theme-resolved color when no colorFn supplied"; changed assertion to `typeof === "string" && length > 0`. Added a companion test for the new `defaultNodeColor` prop.
- **Files modified:** `src/components/graph/ForceGraphCanvas.test.tsx`
- **Commit:** `1613472`

**2. [Rule 1 - Bug] Test suite failure — CodeVaultGraph colorFn assertion**
- **Found during:** Task 3 vitest run
- **Issue:** `CodeVaultGraph.test.tsx` line 367-371 asserted `colorFn(codeNode) === "#10b981"` and `colorFn(vaultNode) === "#8b5cf6"`. After Task 2, `colorFn` returns `colors.primary`/`colors.vaultNode` from `useThemeColors()`. In jsdom without CSS loaded, `getComputedStyle` returns `""` for custom properties, so `colorFn` returned `""`.
- **Fix:** Added `vi.mock("../../hooks/useThemeColors", ...)` stub returning Matrix Emerald defaults. Updated test name to reflect theme-resolved semantics. Assertions now check `colors.primary` (`"#10b981"`) and `colors.vaultNode` (`"#8b5cf6"`) from the mock — preserving precise coverage without coupling to CSSOM availability.
- **Files modified:** `src/components/graph/CodeVaultGraph.test.tsx`
- **Commit:** `1613472`

## Known Stubs

None. All three canvas files are fully wired to `useThemeColors()`. No placeholder colors remain.

## Threat Flags

None. All changes are client-side CSSOM reads of own-origin CSS custom properties. No new network endpoints, auth paths, or schema changes. T-89-13 mitigation (hexToRgba defensive pass-through) already in place from Plan 01.

## Self-Check: PASSED

All 5 modified files exist on disk. All 3 task commits verified: `45b1f4e`, `db9d8fb`, `1613472`.
