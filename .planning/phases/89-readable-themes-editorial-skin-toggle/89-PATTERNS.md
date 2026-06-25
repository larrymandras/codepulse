# Phase 89: Readable Themes & Editorial Skin Toggle — Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 9 (2 new, 7 modified)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/hooks/useThemeColors.ts` | hook (new) | event-driven (MutationObserver) | `src/layouts/DashboardLayout.tsx` lines 574–587 (window event listener + cleanup) | role-match |
| `src/hooks/useThemeColors.test.ts` | unit test (new) | — | `src/hooks/useLiveFlash.test.ts` | exact |
| `src/components/ThemeSwitcher.test.tsx` | unit test (new) | — | `src/components/ObsidianGraph.test.tsx` | role-match |
| `e2e/theme-contrast.spec.ts` | e2e test (new) | request-response | `e2e/alerts.spec.ts` | role-match |
| `e2e/theme-no-fouc.spec.ts` | e2e test (new) | request-response | `e2e/navigation.spec.ts` | role-match |
| `src/index.css` | css-tokens (modified) | — | itself — `[data-theme="emerald"]` block lines 184–200 | exact (self-analog) |
| `src/components/ThemeSwitcher.tsx` | component (modified) | request-response | itself — lines 1–42 | exact (self-analog) |
| `src/layouts/DashboardLayout.tsx` | layout (modified) | event-driven | itself — lines 556–587 (event listener useEffect) | exact (self-analog) |
| `src/components/graph/ForceGraphCanvas.tsx` + `CodeVaultGraph.tsx` + `src/pages/KnowledgeGraph.tsx` | canvas component (modified) | transform | `src/components/ObsidianGraph.test.tsx` (mock pattern), `ForceGraphCanvas.tsx` props | exact |
| `index.html` | static-html (modified) | — | itself — lines 1–16 | exact (self-analog) |

---

## Pattern Assignments

---

### `src/hooks/useThemeColors.ts` (hook, event-driven)

**Analog:** `src/layouts/DashboardLayout.tsx` lines 574–587 — existing `useEffect` with
`window.addEventListener` + cleanup return. Structure to mirror exactly. The MutationObserver
cleanup pattern is the same shape as the event listener cleanup already in the codebase.

**Imports pattern** — copy from any hook in `src/hooks/`:

```typescript
import { useState, useEffect } from "react";
```

**Core pattern to mirror** — event listener + cleanup in `useEffect` (DashboardLayout.tsx lines 574–587):

```typescript
useEffect(() => {
  const handler = () => {
    try {
      setCrtEnabled(JSON.parse(localStorage.getItem("codepulse-crt") ?? "false"));
    } catch {}
  };
  window.addEventListener("storage", handler);
  window.addEventListener("codepulse-crt-toggle", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("codepulse-crt-toggle", handler);
  };
}, []);
```

Replace `window.addEventListener` / `removeEventListener` with `MutationObserver.observe` /
`observer.disconnect()` — same cleanup discipline.

**`useState` lazy initializer pattern** — DashboardLayout.tsx line 556–562:

```typescript
const [crtEnabled, setCrtEnabled] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("codepulse-crt") ?? "false");
  } catch {
    return false;
  }
});
```

Mirror: `const [colors, setColors] = useState<ThemeColors>(resolveColors);` — the resolver
runs synchronously as the lazy initializer, same pattern.

**Convention:** All hooks in `src/hooks/` use named exports (`export function useX`), not default
exports. Keep `resolveColors` as a module-level function (not inside the hook) so it can be
called both as the lazy initializer and inside the MutationObserver callback.

---

### `src/hooks/useThemeColors.test.ts` (unit test, new)

**Analog:** `src/hooks/useLiveFlash.test.ts` (lines 1–112) — renderHook + act + fake DOM element
manipulation. Closest existing hook test that mutates DOM state and asserts hook output changes.

**Imports pattern** (useLiveFlash.test.ts lines 1–4):

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLiveFlash } from "./useLiveFlash";
```

**DOM mutation pattern** (useLiveFlash.test.ts lines 18–23):

```typescript
const el = document.createElement("div");
Object.defineProperty(result.current.flashRef, "current", {
  value: el,
  writable: true,
});
```

For `useThemeColors`, instead of a ref, mock `document.documentElement` via
`Object.defineProperty` or `vi.spyOn(window, 'getComputedStyle')` returning a stub
`CSSStyleDeclaration` with known `--primary` etc. values. Then mutate
`document.documentElement.setAttribute('data-theme', '...')` inside `act()` and assert the
hook's returned colors updated.

**`act()` pattern** for triggering side effects (useLiveFlash.test.ts lines 24–28):

```typescript
act(() => {
  result.current.triggerFlash();
});
expect(el.classList.contains("live-update-flash")).toBe(true);
```

Replace with:

```typescript
act(() => {
  document.documentElement.setAttribute("data-theme", "readable");
});
await waitFor(() => {
  expect(result.current.colors.primary).toBe("#5eead4");
});
```

**Setup file:** `src/test/setup.ts` contains only `import '@testing-library/jest-dom'`. No
automatic mocks are relevant to this hook test — mock `getComputedStyle` manually with `vi.spyOn`.

---

### `src/components/ThemeSwitcher.test.tsx` (unit test, new)

**Analog:** `src/components/ObsidianGraph.test.tsx` lines 1–60 — component render test that
mocks a heavy external (`react-force-graph-2d`) and asserts computed prop values. ThemeSwitcher
mocks to test: localStorage read on mount, `data-theme` attribute set, `handleThemeChange` updates
both state and the attribute.

**`vi.hoisted` + `vi.mock` pattern** (ObsidianGraph.test.tsx lines 12–18):

```typescript
const h = vi.hoisted(() => ({ props: null as Record<string, any> | null }));
vi.mock('react-force-graph-2d', () => ({
  default: (props: Record<string, any>) => {
    h.props = props;
    return null;
  },
}));
```

For ThemeSwitcher: no heavy externals to mock, but `localStorage` and
`document.documentElement.setAttribute` need spying. Use `vi.spyOn(Storage.prototype, 'getItem')`
and `vi.spyOn(document.documentElement, 'setAttribute')`.

**`beforeEach` cleanup pattern** (ObsidianGraph.test.tsx line 26–28):

```typescript
beforeEach(() => {
  h.props = null;
});
```

For ThemeSwitcher: clear localStorage mocks and reset the `data-theme` attribute in `beforeEach`.

**`render` + assertion pattern** (ObsidianGraph.test.tsx lines 31–35):

```typescript
import { render } from '@testing-library/react';
render(<ObsidianGraph data={g} />);
expect(h.props).not.toBeNull();
```

For ThemeSwitcher: `render(<ThemeSwitcher />)` + assert `document.documentElement.getAttribute('data-theme')` equals `"cyan"` (default) on first render.

---

### `e2e/theme-contrast.spec.ts` and `e2e/theme-no-fouc.spec.ts` (e2e tests, new)

**Analog:** `e2e/alerts.spec.ts` (lines 1–19) — the entire existing e2e file is the structural template.

**Imports + test structure** (alerts.spec.ts lines 1–3):

```typescript
import { test, expect } from '@playwright/test';

test.describe('Alerts page', () => {
  test('alerts page loads successfully', async ({ page }) => {
    await page.goto('/alerts');
    await expect(page.locator('body')).toBeVisible();
  });
```

**`waitForLoadState('networkidle')` pattern** (alerts.spec.ts lines 10–18):

```typescript
await page.goto('/alerts');
await page.waitForLoadState('networkidle');
```

Use this in all theme-contrast tests — CodePulse pages load Convex data before rendering
content, so `networkidle` is the correct wait strategy (matches existing pattern exactly).

**Convention for new test files:** `test.describe` block wrapping, `async ({ page }) => {}` test
function signature, `page.goto(path)` + `page.waitForLoadState('networkidle')` before assertions.
The `addInitScript` approach for pre-seeding localStorage (from RESEARCH.md) fits naturally
before `page.goto`:

```typescript
await page.addInitScript((theme) => {
  localStorage.setItem('codepulse-theme', theme);
}, 'readable');
await page.goto('/');
await page.waitForLoadState('networkidle');
```

---

### `src/index.css` (css-tokens, modified)

**Analog (self):** `src/index.css` lines 184–200 — existing `[data-theme="emerald"]` block. This
is the exact pattern to copy for both new themes.

**Cascade pattern** (lines 184–200):

```css
[data-theme="emerald"] {
  --background: #020617; /* Very dark slate */
  --primary: #10b981; /* Emerald */
  --accent: #059669;
  --ring: #10b981;
  --chart-1: #10b981;
  --chart-2: #059669;
  --sidebar-primary: #10b981;
  --sidebar-ring: #10b981;
  --status-ok: #10b981;
  --chart-bar-accent: #10b981;
  --chart-p50: #10b981;
  --speaking-ring: #10b981;
  --speaking-ring-glow: rgba(16, 185, 129, 0.35);
  --glass-bg: rgba(2, 6, 23, 0.6);
  --glass-border: rgba(16, 185, 129, 0.1);
}
```

**Source-order rule (critical):** New `[data-theme="readable"]` and `[data-theme="aubergine"]`
blocks MUST be placed AFTER the `[data-theme="amber"]` block (line 218). Selector specificity is
equal (one attribute selector each); source order is the only tiebreaker. Wrong order = theme
tokens clobbered by later blocks.

**Correct append order in `src/index.css`:**
```
.dark / [data-theme="cyan"]  → lines 127–182  (DO NOT MOVE)
[data-theme="emerald"]       → lines 184–200  (DO NOT MOVE)
[data-theme="amber"]         → lines 202–218  (DO NOT MOVE)
[data-theme="readable"]      → NEW — append here
[data-theme="aubergine"]     → NEW — append after readable
```

New themes define the FULL token set (unlike emerald/amber which are partial overrides) because
their surface colors diverge from the base `.dark` values significantly.

**Effect suppression pattern to add alongside token blocks:**

```css
[data-theme="readable"] .matrix-bg,
[data-theme="aubergine"] .matrix-bg {
  display: none;
}

[data-theme="readable"] .crt-scanline-bar,
[data-theme="aubergine"] .crt-scanline-bar {
  display: none;
}
```

**Reduced-motion block** (lines 441–447) — existing rule to NOT modify; the new theme
pseudo-elements must be suppressed within a new `@media (prefers-reduced-motion: reduce)` block
appended after the existing one:

```css
@media (prefers-reduced-motion: reduce) {
  [data-theme="aubergine"] body::before,
  [data-theme="aubergine"] body::after {
    opacity: 0;
  }
}
```

---

### `src/components/ThemeSwitcher.tsx` (component, modified)

**Analog (self):** `src/components/ThemeSwitcher.tsx` lines 1–42 — the entire file is the
pattern to extend. Only add options and remove one; no structural change.

**Current structure** (lines 1–42):

```typescript
import React, { useEffect, useState } from "react";
import { Paintbrush } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>("cyan");

  useEffect(() => {
    const saved = localStorage.getItem("codepulse-theme") || "cyan";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const handleThemeChange = (value: string) => {
    setTheme(value);
    localStorage.setItem("codepulse-theme", value);
    document.documentElement.setAttribute("data-theme", value);
  };

  return (
    <div className="flex items-center gap-2">
      <Paintbrush className="w-4 h-4 text-muted-foreground" />
      <Select value={theme} onValueChange={handleThemeChange}>
        <SelectTrigger className="w-[140px] h-8 bg-card/50 border-border/50 text-sm">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cyan">Electric Cyan</SelectItem>
          <SelectItem value="emerald">Matrix Emerald</SelectItem>
          <SelectItem value="amber">Warning Amber</SelectItem>  ← REMOVE
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Changes:**
1. Remove `<SelectItem value="amber">Warning Amber</SelectItem>`.
2. Add `<SelectItem value="readable">Readable Dark</SelectItem>` and `<SelectItem value="aubergine">Midnight Aubergine</SelectItem>`.
3. Change `w-[140px]` → `w-[160px]` on `SelectTrigger`.
4. The `"codepulse-theme"` key and `document.documentElement.setAttribute` calls are already correct — no change needed to the persistence or DOM update logic.

---

### `src/layouts/DashboardLayout.tsx` (layout, modified)

**Analog (self):** Multiple self-analog sections.

**Dark mode toggle to REMOVE entirely** (lines 220–239):

```typescript
function DarkModeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  const toggle = () => { ... localStorage.setItem("theme", ...) };
  return (<button ...>...</button>);
}
```

Remove the `DarkModeToggle` component definition and all its call sites (line 411:
`<DarkModeToggle />`).

**`useEffect` to REMOVE** (lines 564–572) — reads `"theme"` key and toggles `dark` class:

```typescript
useEffect(() => {
  const saved = localStorage.getItem("theme");
  if (saved === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
}, []);
```

Delete entirely — replaced by the pre-paint inline script in `index.html`.

**CRT event listener pattern to KEEP** (lines 574–587) — this is correct and should not change:

```typescript
useEffect(() => {
  const handler = () => { ... };
  window.addEventListener("storage", handler);
  window.addEventListener("codepulse-crt-toggle", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("codepulse-crt-toggle", handler);
  };
}, []);
```

**Scanline bar to add class to** (line 626):

```typescript
// BEFORE:
<div className="w-full h-[5px] bg-primary/40 animate-scanline shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
// AFTER: add class "crt-scanline-bar" so CSS can target it per-theme:
<div className="crt-scanline-bar w-full h-[5px] bg-primary/40 animate-scanline shadow-[var(--glow-md)]" />
```

---

### Canvas files: `src/components/graph/ForceGraphCanvas.tsx`, `src/components/graph/CodeVaultGraph.tsx`, `src/pages/KnowledgeGraph.tsx` (canvas, modified)

**Analog:** `src/components/graph/ForceGraphCanvas.tsx` itself — the `colorFn` / `linkColorFn`
prop interface is already defined; the migration just changes where the values come from.

**Hardcoded constant sites to replace** (by file):

ForceGraphCanvas.tsx line 80:
```typescript
const DEFAULT_COLOR = "#10b981";   // ← becomes colors.primary from useThemeColors()
```
ForceGraphCanvas.tsx line 272:
```typescript
linkColor={linkColorFn ?? (() => "rgba(16, 185, 129, 0.18)")}
// ← becomes: linkColorFn ?? (() => colors.primaryAlpha18)
```

CodeVaultGraph.tsx lines 60–61:
```typescript
const CODE_COLOR = "#10b981";   // ← colors.primary
const VAULT_COLOR = "#8b5cf6"; // ← colors.accent (or --vault-node-color if token added)
```
CodeVaultGraph.tsx `linkColorFn` (line 120–131) — inline `rgba(16, 185, 129, 0.18)` and
`rgba(139, 92, 246, 0.18)` become `colors.primaryAlpha18` and `colors.accentAlpha18`.

KnowledgeGraph.tsx line 37:
```typescript
const COLOR_CURRENT = "rgba(16, 185, 129, 0.55)";  // ← colors.primaryAlpha55
```

**`useCallback` + `colors` dependency pattern** — since `colorFn` is a prop passed to
`ForceGraphCanvas`, wrap closures that capture `colors` in `useCallback` with `[colors]` dep:

```typescript
const colorFn = useCallback((node: any) => {
  return node.source?.startsWith("vault:") ? colors.accent : colors.primary;
}, [colors]);
```

This is consistent with how `useFocusParam`'s `onFocus` callback is handled in CodeVaultGraph.tsx
line 147 (`useCallback` with explicit deps).

**Where to call `useThemeColors()`:** In `GraphContent` (CodeVaultGraph.tsx line 135 — the
component that owns `colorFn` / `linkColorFn`), not at module level. In `KnowledgeGraph.tsx` page
component (which directly sets `COLOR_CURRENT` at module scope — move inside the component).
`ForceGraphCanvas.tsx` does NOT call the hook directly; it receives colors via props from its parent.

---

### `index.html` (static-html, modified)

**Analog (self):** `index.html` lines 1–16 — the current minimal head is the anchor.

**Current `<head>`:**

```html
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" .../>
    <title>CodePulse</title>
    <link rel="icon" .../>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/...geist..." rel="stylesheet" />
  </head>
  <body ...>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
```

**Pre-paint script placement:** Insert the inline `<script>` block immediately after `<meta charset="UTF-8" />`, before all other tags. This is the critical constraint — it must execute
before the browser encounters any `<link>` or `<script type="module">`.

```html
<meta charset="UTF-8" />
<!-- THEME PRE-PAINT: blocking inline script — sets data-theme before first paint. No FOUC. -->
<script>
(function(){
  var t=localStorage.getItem('codepulse-theme');
  var v=['cyan','emerald','readable','aubergine'];
  if(!t){var o=localStorage.getItem('theme');if(o==='light')t='readable';localStorage.removeItem('theme');}
  if(!t||!v.includes(t))t='cyan';
  document.documentElement.setAttribute('data-theme',t);
  document.documentElement.classList.add('dark');
}());
</script>
<meta name="viewport" .../>
```

**Convention:** The `class="dark"` on `<html>` stays as a static attribute AND is reinforced by
the script. The script also handles the `"theme"` → `"codepulse-theme"` localStorage migration so
users who had `"light"` stored are mapped to `"readable"` on first load.

---

## Shared Patterns

### Event listener cleanup in `useEffect`
**Source:** `src/layouts/DashboardLayout.tsx` lines 574–587
**Apply to:** `useThemeColors.ts` (MutationObserver is same pattern: observe in effect body, return `() => observer.disconnect()`)

```typescript
useEffect(() => {
  const handler = () => { /* update state */ };
  window.addEventListener("...", handler);
  return () => window.removeEventListener("...", handler);
}, []);
```

### Tailwind arbitrary shadow → CSS variable token
**Source:** RESEARCH.md §Category A + `src/index.css` `--glow-*` token definitions
**Apply to:** All ~18 component files in Category A (ActiveSessions.tsx, AgentTopology.tsx, etc.)
**Pattern:**
```
// Before (hardcoded, won't theme-switch):
shadow-[0_0_15px_rgba(16,185,129,0.05)]
hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]
// After (reads from active theme's glow token):
shadow-[var(--glow-xs)]
hover:shadow-[var(--glow-sm)]
```
When `[data-theme="readable"]` sets `--glow-xs: none`, box-shadow resolves to `none` — valid CSS.

### localStorage read + `document.documentElement.setAttribute` on mount
**Source:** `src/components/ThemeSwitcher.tsx` lines 14–19
**Apply to:** ThemeSwitcher.tsx (already present — do not duplicate in DashboardLayout after removing the dark-mode useEffect)
```typescript
useEffect(() => {
  const saved = localStorage.getItem("codepulse-theme") || "cyan";
  setTheme(saved);
  document.documentElement.setAttribute("data-theme", saved);
}, []);
```

### Vitest `renderHook` + `act` for DOM-mutating hooks
**Source:** `src/hooks/useLiveFlash.test.ts` lines 1–112
**Apply to:** `src/hooks/useThemeColors.test.ts`

### Playwright `page.goto` + `waitForLoadState('networkidle')`
**Source:** `e2e/alerts.spec.ts` lines 10–12
**Apply to:** `e2e/theme-contrast.spec.ts`, `e2e/theme-no-fouc.spec.ts`

---

## No Analog Found

No files in this phase are fully without analog. All have either exact self-analogs or close role
matches in the existing codebase.

| File | Closest Distance | Note |
|------|-----------------|-------|
| `e2e/theme-contrast.spec.ts` (axe-core integration) | Partial — `e2e/alerts.spec.ts` for structure only | `@axe-core/playwright` API (`AxeBuilder`) has no existing usage in repo — follow RESEARCH.md §axe-core pattern directly |

---

## Metadata

**Analog search scope:** `src/hooks/`, `src/components/`, `src/components/graph/`, `src/layouts/`,
`src/pages/`, `src/index.css`, `e2e/`, `index.html`
**Files read:** 20
**Pattern extraction date:** 2026-06-24
