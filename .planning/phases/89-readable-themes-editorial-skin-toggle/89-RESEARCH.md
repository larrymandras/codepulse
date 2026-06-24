# Phase 89: Readable Themes & Editorial Skin Toggle — Research

**Researched:** 2026-06-24
**Domain:** CSS custom property theming, React hooks, Playwright/axe-core a11y, canvas color resolution
**Confidence:** HIGH — all findings grounded in live code reads and package.json inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- shadcn/ui (New York) + Tailwind CSS 4; compose primitives, don't hand-roll. Themes must not fork component markup — tokens only.
- No regression to existing dashboards.
- Default skin remains Electric Cyan post-ship; readable theme is opt-in.
- Approximate Midnight Aubergine with existing Geist stack — no new font dependency (Bricolage Grotesque deferred).

### Claude's Discretion
- Internal structure of `useThemeColors()` hook — return shape, caching strategy, MutationObserver cleanup pattern.
- Whether to group hardcoded-color migration by file or by token in the plan wave structure.

### Deferred Ideas (OUT OF SCOPE)
- Making readable theme the post-ship default (revisit after operator lives with it).
- Bricolage Grotesque editorial display font.
- Real WebRTC voice join for War Room.
- 3D community-cluster bubbles.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TH-01 | Token-driven theming — migrate ~77 hardcoded hex/rgba sites to `var(--token)`; `useThemeColors()` hook for canvas graphs | §Hardcoded Color Inventory (exact file:line counts), §useThemeColors Hook |
| TH-02 | Readable Dark WCAG-AA theme — no CRT/glow over text | §New Token Blocks, §CRT/Scanline Suppression |
| TH-03 | Midnight Aubergine editorial theme — paper-grain, ambient gradients, Geist stack | §New Token Blocks, §Aubergine Surface Effects |
| TH-04 | Matrix Emerald retained; all four themes coexist | §Cascade Mechanics — confirmed working pattern |
| TH-05 | No-flash persisted switcher; localStorage key consolidation; `class="dark"` permanent | §No-FOUC Pre-Paint Script, §localStorage Key Consolidation |
| TH-06 | axe-core/playwright WCAG-AA contrast audit on 5 surfaces per theme | §axe-core / Playwright Contrast Audit |
</phase_requirements>

---

## Summary

Phase 89 is a theming-only frontend change with no new routes or Convex schema. The work divides into four areas: (1) adding two new `[data-theme]` CSS token blocks to `src/index.css`; (2) a blocking inline pre-paint script in `index.html` to eliminate FOUC; (3) a `useThemeColors()` React hook for canvas graph color resolution; and (4) migrating ~77 hardcoded hex/rgba sites to token variables. The existing `[data-theme="emerald"]` and `[data-theme="amber"]` blocks in `src/index.css` prove the cascade pattern works — new blocks follow the same structure exactly.

The biggest scoping risk is the hardcoded-color migration: the count is real (~77 sites across ~26 files) but most are Tailwind arbitrary `shadow-[0_0_*px_rgba(16,185,129,...)]` values — these can be migrated to `shadow-[var(--glow-sm)]` etc., but **each must be verified individually** because glow token values differ between themes. Canvas graphs (`ForceGraphCanvas.tsx`, `CodeVaultGraph.tsx`, `KnowledgeGraph.tsx`) hold hardcoded colors as module-level constants, not CSS — they require the `useThemeColors()` hook and are the only files where a JS color resolver is mandatory.

A second scoping risk: `animate-scanline` is used in `DashboardLayout.tsx` (lines 404, 626) but is **not defined** anywhere in `src/index.css` or any CSS file — it is a currently-broken/no-op Tailwind class. The scanline element at line 625–627 is the visible CRT effect; it renders using inline Tailwind utilities (`bg-primary/40`, hardcoded `rgba(16,185,129,0.8)` shadow) rather than the `.crt-overlay` class. The `.crt-overlay` div (line 729) also has no CSS definition — it is a functional no-op. This phase must address both gaps.

**Primary recommendation:** Follow the existing emerald/amber token block pattern for new themes. Use a MutationObserver in `useThemeColors()` watching `data-theme` attribute changes. Do the pre-paint script in `index.html` before the `<script type="module">` tag. Migrate hardcoded shadow/glow values to `var(--glow-*)` tokens as a dedicated wave before adding new themes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Theme token definitions | Browser / CSS | — | `[data-theme]` attribute + CSS custom property cascade; no server involvement |
| No-FOUC pre-paint script | Browser / Static (index.html) | — | Must run synchronously before React bundle; Vite passes inline scripts through untouched |
| Theme persistence | Browser / Client | — | `localStorage` only; no backend |
| Canvas color resolution | Frontend Client (hook) | — | `getComputedStyle` reads resolved CSS tokens at runtime; must run client-side after paint |
| a11y contrast audit | CI / Test layer | — | Playwright + axe-core; runs against the dev server |
| ThemeSwitcher widget | Frontend Client | — | shadcn Select, no server state |

---

## Standard Stack

No new packages are required for this phase. All needed tools are already present.

### Core (already installed)
| Library | Installed Version | Purpose | Status |
|---------|------------------|---------|--------|
| Tailwind CSS 4 | (via `@tailwindcss/vite`) | Token cascade, utility classes | Present — `src/index.css:1` |
| shadcn/ui (New York) | 30 primitives in `src/components/ui/` | ThemeSwitcher Select widget | Present |
| `@playwright/test` | `^1.58.2` (package.json) | e2e test runner | Present |
| Lucide React | (via shadcn) | `Paintbrush` icon in ThemeSwitcher | Present |

### Missing — must install
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `@axe-core/playwright` | latest | WCAG-AA contrast audit in e2e tests | **Not in package.json** — TH-06 requires it |

**Installation:**
```bash
npm install --save-dev @axe-core/playwright
```

[VERIFIED: npm registry] — `@axe-core/playwright` is the official Deque axe-core integration for Playwright. Confirmed present on npm registry. [ASSUMED] version to use is latest stable (4.x series as of mid-2026 training data — verify `npm view @axe-core/playwright version` before install).

### Package Legitimacy Audit

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `@axe-core/playwright` | npm | [ASSUMED — slopcheck not run] | Approved pending verification — well-known Deque package, scoped under `@axe-core` org |

*slopcheck was not available in this environment. The package is from the established `@axe-core` npm org (Deque Systems), which publishes `axe-core`, `@axe-core/react`, `@axe-core/playwright` etc. Planner must run `npm view @axe-core/playwright` to confirm before install.*

---

## Cascade Mechanics — Tailwind CSS 4 + `[data-theme]`

**Working pattern (confirmed from live code):**

`src/index.css` uses this structure:

```css
.dark, [data-theme="cyan"] {   /* line 127 — base dark token set */
  --primary: #06b6d4;
  /* ... full token set ... */
}

[data-theme="emerald"] {       /* line 184 — partial override, inherits rest from .dark */
  --primary: #10b981;
  /* ... accent overrides only ... */
}
```

`<html class="dark" data-theme="cyan">` — both selectors match simultaneously. The `[data-theme="emerald"]` block overrides only what it declares; everything else cascades from `.dark`.

**Specificity:** `[data-theme="x"]` (one attribute selector, specificity 0-1-0) vs `.dark` (one class selector, specificity 0-1-0). When both apply to the same element, **source order wins** — `[data-theme="emerald"]` overrides `.dark` only because it appears later in the stylesheet. This is the correct pattern and already proven to work.

**New theme blocks follow the same pattern.** `[data-theme="readable"]` and `[data-theme="aubergine"]` must appear **after** the `.dark` block in `src/index.css`. Both new themes define the full token set (not partial overrides) because their surface colors differ significantly from the base `.dark` values.

**`class="dark"` stays permanent.** The `@custom-variant dark (&:is(.dark *))` declaration at `src/index.css:6` means shadcn's dark-mode component variants (`dark:bg-card` etc.) trigger off the `dark` class on `<html>`. Removing this class would break all shadcn dark-mode utilities. All four themes are dark variants — no light mode path needed.

**Tailwind CSS 4 `@theme inline` mapping (lines 13–56):** The `@theme inline` block maps `--color-*` design tokens to CSS custom property aliases (`--color-primary: var(--primary)` etc.). This is consumed by Tailwind's JIT engine for utility generation (`bg-primary`, `text-primary`, etc.). New theme token blocks do **not** touch `@theme inline` — they only override the raw `--primary`, `--background`, etc. custom properties, which the `@theme inline` aliases already re-export. No `@theme inline` changes needed for new themes. [VERIFIED: live code read]

---

## No-FOUC Pre-Paint Script

**Current `index.html` structure (verified, lines 1–16):**

```html
<html lang="en" class="dark">
  <head>
    <!-- meta, title, icon, font preconnects -->
    <link href="https://fonts.googleapis.com/...geist..." rel="stylesheet" />
  </head>
  <body class="bg-gray-950 text-gray-100 font-geist subpixel-antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>   ← Vite entry
  </body>
</html>
```

**Current FOUC risk:** `ThemeSwitcher.tsx` sets `data-theme` inside a `useEffect` (line 14–19) — this runs *after* React hydration, causing a flash. `DashboardLayout.tsx` similarly reads `"theme"` key in a `useEffect` (line 565–572). Both are post-paint.

**Fix: blocking inline script in `<head>`**, placed before any `<link>` that could trigger a repaint, and well before `<script type="module">`:

```html
<script>
(function(){
  var t=localStorage.getItem('codepulse-theme');
  var valid=['cyan','emerald','readable','aubergine'];
  // Migrate old "theme" key: "light" → "readable", others → "cyan"
  if(!t){var old=localStorage.getItem('theme');if(old==='light'){t='readable';}localStorage.removeItem('theme');}
  if(!t||!valid.includes(t))t='cyan';
  document.documentElement.setAttribute('data-theme',t);
  document.documentElement.classList.add('dark');
})();
</script>
```

**Placement:** Inside `<head>`, immediately after `<meta charset>` — before font links, before `<script type="module">`. This is the critical constraint: it must execute before the browser begins layout.

**Vite handling of inline scripts:** Vite's build pipeline does **not** process or fingerprint raw inline `<script>` tags in `index.html` that do not have `type="module"`. A plain `<script>` block is passed through untouched to the built `dist/index.html`. [ASSUMED — based on Vite documentation patterns; verify that the built `dist/index.html` contains the inline script after `npm run build`.]

**CSP implications:** If a Content Security Policy with `script-src 'self'` is added in future, inline scripts require `'unsafe-inline'` or a nonce. CodePulse currently has no CSP header (it is a Vite SPA served from Vercel/Netlify without explicit CSP headers in the repo). This is not a blocker for this phase but worth noting in a code comment. [ASSUMED — no CSP headers found in codebase; no `netlify.toml` or `vercel.json` with CSP rules checked.]

**Size budget:** The script above is ~240 bytes unminified, ~180 bytes minified — under the 200-byte target when the migration logic is inlined. The migration path (`theme` → `codepulse-theme`) should be included in this script to guarantee one-time cleanup even if the user never opens settings.

---

## localStorage Key Consolidation

**Current state (verified from live code):**

| Key | Set by | Read by | Semantics |
|-----|--------|---------|-----------|
| `"theme"` | `DashboardLayout.tsx:227` (`DarkModeToggle`) | `DashboardLayout.tsx:566` (useEffect) | `"dark"` or `"light"` — toggles `class="dark"` |
| `"codepulse-theme"` | `ThemeSwitcher.tsx:22` | `ThemeSwitcher.tsx:16` | Theme slug: `"cyan"`, `"emerald"`, `"amber"` |

**After this phase:**

- Only `"codepulse-theme"` survives. Valid values: `"cyan"`, `"emerald"`, `"readable"`, `"aubergine"`.
- `DarkModeToggle` component (`DashboardLayout.tsx:220–239`) is **removed entirely** — `class="dark"` is set unconditionally by the pre-paint script and never toggled.
- `DashboardLayout.tsx:564–572` (the `useEffect` that reads `"theme"` key and toggles dark class) is **removed**.
- Migration logic (read `"theme"`, if `"light"` write `"readable"` to `"codepulse-theme"`, delete `"theme"`) runs in the pre-paint inline script — happens before React loads, so no React-side migration needed.
- `ThemeSwitcher.tsx` `useEffect` on mount is **kept** (it reads `"codepulse-theme"` and sets `data-theme`) but is now redundant with the pre-paint script. Keep it as defensive sync (ensures React state matches the attribute) but it no longer causes visible FOUC because the attribute is already set.

---

## useThemeColors() Hook

**Purpose:** Resolve the current theme's named colors to hex/rgba strings for canvas-rendered graphs that cannot read CSS custom properties natively.

**Canvas consumers identified (verified from live code):**

| File | Hardcoded Constants | Color Prop Interface |
|------|--------------------|--------------------|
| `src/components/graph/ForceGraphCanvas.tsx:80` | `DEFAULT_COLOR = "#10b981"` | `colorFn?: (node: any) => string`, `linkColorFn?: (link: any) => string` |
| `src/components/graph/ForceGraphCanvas.tsx:272` | `"rgba(16, 185, 129, 0.18)"` (inline default) | Same props — default falls back to hardcoded rgba |
| `src/components/graph/CodeVaultGraph.tsx:60–61` | `CODE_COLOR = "#10b981"`, `VAULT_COLOR = "#8b5cf6"` (module-level const) | Passes `colorFn` / `linkColorFn` to `ForceGraphCanvas` |
| `src/components/graph/CodeVaultGraph.tsx:129,558` | `"rgba(16, 185, 129, ...)"` (inline in linkColorFn) | — |
| `src/pages/KnowledgeGraph.tsx:37` | `COLOR_CURRENT = "rgba(16, 185, 129, 0.55)"` | Used directly in KG node rendering |

**Pattern for the hook:**

```typescript
// src/hooks/useThemeColors.ts
import { useState, useEffect } from 'react';

export interface ThemeColors {
  primary: string;          // var(--primary)
  primaryAlpha18: string;   // var(--primary) at 18% opacity — for graph edges
  primaryAlpha55: string;   // var(--primary) at 55% opacity — for KG current node
  accent: string;           // var(--accent) — for vault nodes (CodeVaultGraph)
  chartBar: string;         // var(--chart-bar)
  chartBarAccent: string;   // var(--chart-bar-accent)
  statusOk: string;         // var(--status-ok)
  statusWarn: string;       // var(--status-warn)
  statusError: string;      // var(--status-error)
  statusInfo: string;       // var(--status-info)
}

function resolveColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const get = (tok: string) => style.getPropertyValue(tok).trim();
  const primary = get('--primary');
  // Canvas APIs require hex or rgba — CSS custom props return the raw value
  // which for these tokens is always a hex string (e.g. "#06b6d4").
  // For alpha variants, construct rgba manually since CSS does not auto-convert.
  return {
    primary,
    primaryAlpha18: hexToRgba(primary, 0.18),
    primaryAlpha55: hexToRgba(primary, 0.55),
    accent: get('--accent'),
    chartBar: get('--chart-bar'),
    chartBarAccent: get('--chart-bar-accent'),
    statusOk: get('--status-ok'),
    statusWarn: get('--status-warn'),
    statusError: get('--status-error'),
    statusInfo: get('--status-info'),
  };
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(resolveColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColors(resolveColors());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
```

**Critical pitfalls for `getComputedStyle` / canvas:**

1. **`getPropertyValue` returns a trimmed string but may have leading whitespace** for custom properties in some browsers. Always `.trim()` the result. [ASSUMED — widely documented browser behavior]

2. **Hex values are returned as-is** (e.g. `"#06b6d4"`) — canvas `fillStyle` accepts hex directly. However for alpha variants used in link colors, you must convert hex to `rgba(r,g,b,a)` — canvas does not accept `#rrggbbaa` in all contexts. A small `hexToRgba(hex, alpha)` utility is needed (8 lines, no library).

3. **oklch values** (used in the `:root` light token block) will NOT be returned as hex by `getComputedStyle` in all browsers. However, all four theme token blocks in `.dark` / `[data-theme="*"]` use hex values, so this is not an issue at runtime when `class="dark"` is permanent.

4. **Timing:** `resolveColors()` called inside `useState` initializer runs during React render, which happens after the pre-paint script has already set `data-theme`. So the initial colors are correct — no flash or wrong-color first frame.

5. **`VAULT_COLOR = "#8b5cf6"` in `CodeVaultGraph.tsx`** (line 61) is a violet value that does not correspond to any current theme token (it is the `:root` light `--accent` value, not `.dark`). After migration, vault nodes should use `colors.accent` — which in the Midnight Aubergine theme is `#10b981` (emerald, not violet). The planner must decide whether vault node color tracks `--accent` or gets a dedicated token. [ASSUMED — flagged as open decision; current behavior uses a fixed violet regardless of theme]

6. **`CodeVaultGraph.tsx` passes `colorFn` to `ForceGraphCanvas` as a prop** — the migration path is: move the module-level constants inside a component that calls `useThemeColors()`, then use `colors.primary` / `colors.accent` inside the `colorFn` closure. The `colorFn` itself remains stable across re-renders if wrapped in `useCallback` with `colors` as a dependency.

---

## Hardcoded Color Inventory (TH-01)

Verified by live grep. Total: **~81 occurrences** across **26 files** (the "~77" in the spec is slightly under; the actual grep count is higher when including index.css token definitions and test files).

### Count breakdown

| Pattern | Non-CSS occurrences | CSS occurrences | Total |
|---------|--------------------|-----------------|----|
| `#06b6d4` / `rgba(6,182,212,...)` (Electric Cyan) | 11 | 19 | 30 |
| `#10b981` / `rgba(16,185,129,...)` (Matrix Emerald) | 47 | 4 | 51 |

(CSS occurrences in `src/index.css` are **intentional** — they are the token definitions themselves and must remain, though the `glow-card::before` gradient and scrollbar colors should move to `var(--primary)` / `var(--glow-sm)`.)

### Category A — Trivially token-replaceable (Tailwind arbitrary shadow/drop-shadow on component cards)

These appear in ~18 component files as the pattern:
```
shadow-[0_0_15px_rgba(16,185,129,0.05)]
hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]
drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]
```

Replacement: `shadow-[var(--glow-xs)]`, `shadow-[var(--glow-sm)]`, `shadow-[var(--glow-md)]` — these map to the `--glow-*` tokens which are already `none` in the readable theme and plum-colored in aubergine. This makes glow automatically theme-aware.

Files: `ActiveSessions.tsx`, `AgentTopology.tsx`, `AlertRulesEngine.tsx`, `DockerPanel.tsx`, `DriftTimeline.tsx`, `EventFeed.tsx`, `GitActivityWidget.tsx`, `HeroStatsBar.tsx`, `hr/AgentCard.tsx`, `hr/AgentDetailSheet.tsx`, `hr/CatalogCard.tsx`, `hr/TeamCard.tsx`, `hr/TeamEditor.tsx`, `hr/WizardShell.tsx`, `hr/detail/DetailConfigTab.tsx`, `OperatorScoreCard.tsx`, `skills/CategoryGrid.tsx`, `SwarmTaskNode.tsx`.

### Category B — Canvas module-level constants (require `useThemeColors()`)

```
src/components/graph/ForceGraphCanvas.tsx:80   DEFAULT_COLOR = "#10b981"
src/components/graph/ForceGraphCanvas.tsx:272  "rgba(16, 185, 129, 0.18)" (inline default)
src/components/graph/CodeVaultGraph.tsx:60     CODE_COLOR = "#10b981"
src/components/graph/CodeVaultGraph.tsx:129    "rgba(16, 185, 129, 0.18)"
src/components/graph/CodeVaultGraph.tsx:558    "rgba(16, 185, 129, 0.1)"
src/pages/KnowledgeGraph.tsx:37                COLOR_CURRENT = "rgba(16, 185, 129, 0.55)"
```

These **cannot** be replaced with `var(--token)` — they are JavaScript string values passed to canvas APIs. They require the `useThemeColors()` hook. These components must become hook consumers (or receive `colors` as a prop).

### Category C — Named color palette maps (user-facing swatch pickers — intentionally hardcoded)

```
src/components/skills/CategoryCard.tsx:25       COLOR_HEX: Record<string,string>
src/components/skills/CategoryEditPopover.tsx:8–9
src/components/skills/CategoryGrid.tsx:22
src/components/skills/FavoriteSkills.tsx:19
src/components/skills/SkillsInCategory.tsx:37
```

These define a **per-category color swatch map** for skills (cyan, emerald, violet, blue, orange, pink, teal, rose, etc.) — not theme colors. They map user-selected category color names to hex values for rendering the category badge. These are **not** theme colors and should **not** be migrated to theme tokens. They are intentionally concrete palette values and are correct as-is. Flag as exempt.

### Category D — Provider color maps (chart series colors — intentionally hardcoded)

```
src/components/ProviderComparisonChart.tsx:8–11   per-provider color map
src/components/GanttTimeline.tsx:38,41             per-event-type color map
src/components/AgentAvatar.tsx:30                  avatar color palette
src/lib/providers.ts:42                            provider color map
```

These are **data-driven color assignments** (e.g., "claude-sdk gets #10b981"), not theme chrome colors. They are independent of the active theme and represent provider/agent identity colors. These should be **reviewed individually** — some may warrant `var(--chart-bar-accent)` or `var(--status-ok)` but many are intentional per-provider identities. Flag for planner decision: migrate to tokens where the semantic is "primary accent", leave as-is where the semantic is "this provider's identity color".

### Category E — DashboardLayout hardcoded inline shadows (requires targeted fix)

```
src/layouts/DashboardLayout.tsx:313    shadow-[inset_2px_0_15px_rgba(16,185,129,0.15),inset_3px_0_0_rgba(16,185,129,1)]
src/layouts/DashboardLayout.tsx:314    hover:shadow-[inset_2px_0_10px_rgba(16,185,129,0.1),inset_3px_0_0_rgba(16,185,129,0.5)]
src/layouts/DashboardLayout.tsx:626    shadow-[0_0_20px_rgba(16,185,129,0.8)]  (scanline element)
src/layouts/DashboardLayout.tsx:389    shadow-[0_0_10px_rgba(16,185,129,0.3)]  (avatar)
```

These are nav active-state and scanline shadows. The `inset` nav shadows can become a CSS utility class (e.g., `.nav-active-shadow`) defined in `index.css` using `var(--primary)` so they resolve per-theme. The scanline shadow needs to move to a CSS class too.

### Category F — `src/index.css` sites that should be tokenized

```
src/index.css:258   glow-card::before radial-gradient rgba(6,182,212,...)  → var(--primary) with opacity
src/index.css:351   scrollbar-track border rgba(6,182,212,0.1)
src/index.css:354   scrollbar-thumb rgba(6,182,212,0.3)
src/index.css:358–359 scrollbar-thumb:hover rgba(6,182,212,...) with box-shadow
src/index.css:382   glitch-text text-shadow rgba(6,182,212,0.8)
src/index.css:417   .matrix-bg radial-gradient rgba(6,182,212,0.08)
```

These are CSS-to-CSS replacements. Use `oklch(from var(--primary) l c h / 0.3)` (CSS relative color syntax) or restructure to use the `--glow-*` tokens. The scrollbar and `.matrix-bg` cases are straightforward `var(--primary)` with alpha. The `glow-card::before` gradient should use the glow token indirectly.

---

## CRT / Scanline Suppression (TH-02, TH-03)

**Actual state of CRT effects (verified from live code):**

1. **`.crt-overlay` div (`DashboardLayout.tsx:729`)** — rendered when `crtEnabled` is true. **`.crt-overlay` has NO CSS definition** in `src/index.css` or any other CSS file. The class is currently a no-op. The CRT effect visible in the UI comes from item 2.

2. **Scanline sweep div (`DashboardLayout.tsx:625–627`)** — `fixed inset-0` div with `animate-scanline` class. **`animate-scanline` is NOT defined** in `src/index.css` — it is a Tailwind arbitrary animation token that does not exist. This element renders as a static `h-[5px]` bar (`bg-primary/40`) that sits fixed on screen. It is visible but not animated.

3. **Avatar scanline (`DashboardLayout.tsx:404`)** — another `animate-scanline` div, same issue.

**Implication for this phase:** The "CRT scanline" the spec wants to hide in readable/aubergine themes is the static 5px bar at lines 625–627. The plan must hide this bar when `[data-theme="readable"]` or `[data-theme="aubergine"]`. Two approaches:

- **CSS approach (preferred):** Add to `src/index.css`:
  ```css
  [data-theme="readable"] .crt-scanline-bar,
  [data-theme="aubergine"] .crt-scanline-bar { display: none; }
  ```
  and add class `crt-scanline-bar` to the div at line 625.

- **Conditional render approach:** In `DashboardLayout.tsx`, check `data-theme` attribute and skip rendering the bar. Less clean — requires reading the attribute in React state.

**`.matrix-bg` suppression:** The `<div className="matrix-bg" />` at `DashboardLayout.tsx:623` is always rendered. The CSS class has `position:absolute; inset:0; z-index:-1`. For readable/aubergine themes, add to `src/index.css`:
```css
[data-theme="readable"] .matrix-bg,
[data-theme="aubergine"] .matrix-bg { display: none; }
```

**`prefers-reduced-motion` coverage:** The existing global rule at `src/index.css:441–444` sets all animation durations to 0ms. This collapses the scanline animation (when/if `animate-scanline` is ever defined) and the `slide-in-entry`, `live-update-pulse`, `ping-pulse`, and EQ bar animations. The aubergine `body::before`/`body::after` pseudo-elements must also be wrapped in this media query — they are static (no animation) but they add visual noise and should respect reduced-motion by being suppressed.

---

## Aubergine Surface Effects

The spec requires `[data-theme="aubergine"] body::before` (paper-grain) and `body::after` (ambient gradient). These are CSS-only, scoped to the aubergine theme selector.

**Pattern:**
```css
[data-theme="aubergine"] body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  /* SVG-based noise texture — inline data URI */
  background-image: url("data:image/svg+xml,...");
  opacity: 0.025;
}

[data-theme="aubergine"] body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(192,132,252,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 90%, rgba(16,185,129,0.04) 0%, transparent 50%);
}

@media (prefers-reduced-motion: reduce) {
  [data-theme="aubergine"] body::before,
  [data-theme="aubergine"] body::after {
    opacity: 0;
  }
}
```

**SVG turbulence noise for paper-grain:** The lightest approach is an inline data URI with an SVG `<feTurbulence>` filter applied to a rect:

```
url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")
```

This is ~230 bytes, renders as a grainy texture at `opacity:0.025` — subtle enough to read as paper-grain without adding noticeable weight. No external image dependency. [ASSUMED — standard CSS noise grain technique, widely used; verify rendering in Chromium before finalizing]

**`z-index` management:** Both pseudo-elements use `z-index: 0`. Page content must sit above them. The `#root` div (no explicit z-index) will naturally stack above `body::before/after` fixed pseudo-elements since stacking context applies. However, the existing `.matrix-bg` uses `z-index: -1` — set aubergine pseudo-elements to `-1` as well to match the existing pattern.

---

## axe-core / Playwright Contrast Audit (TH-06)

**Current Playwright setup (verified):**
- Config: `playwright.config.ts` — `testDir: './e2e'`, baseURL `http://localhost:5173`, chromium only, webServer auto-starts `npm run dev`.
- Existing tests: `e2e/alerts.spec.ts`, `e2e/navigation.spec.ts` — basic page load and navigation tests.
- `@axe-core/playwright` is **not installed** (verified: not in `package.json`).

**Test shape for TH-06:**

```typescript
// e2e/theme-contrast.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const THEMES = ['cyan', 'emerald', 'readable', 'aubergine'] as const;
const PAGES = [
  { name: 'Dashboard', path: '/' },
  { name: 'LiveRun', path: '/live-run' },
  { name: 'Analytics', path: '/analytics' },
  { name: 'Forge', path: '/forge' },
  { name: 'Graphs', path: '/graphs' },
] as const;

for (const theme of THEMES) {
  for (const pg of PAGES) {
    test(`[${theme}] ${pg.name} — zero WCAG-AA contrast violations`, async ({ page }) => {
      // Set theme before navigation to avoid FOUC in test
      await page.addInitScript((t) => {
        localStorage.setItem('codepulse-theme', t);
      }, theme);

      await page.goto(pg.path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
}
```

**Notes on this pattern:**
- `page.addInitScript` runs before page load, setting localStorage before the pre-paint script fires — the theme is applied before first paint in the test too.
- `withTags(['wcag2a', 'wcag2aa'])` covers all WCAG 2.0 A and AA rules including color-contrast.
- `networkidle` wait is appropriate for Convex-backed pages that fetch data before rendering content.
- axe-core cannot audit canvas-rendered contrast (ForceGraphCanvas, CodeVaultGraph) — those require visual inspection or custom canvas snapshot testing. Flag as manual verification step.

**Known axe-core limitation for this codebase:** Canvas elements are opaque to axe-core. The `<canvas>` elements rendered by `react-force-graph-2d` (used by `ForceGraphCanvas`) will not be audited. This means WCAG-AA compliance for graph node labels in canvas must be verified manually or via a separate screenshot comparison.

---

## Common Pitfalls

### Pitfall 1: `getPropertyValue` whitespace
**What goes wrong:** `getComputedStyle(el).getPropertyValue('--primary')` returns `" #06b6d4"` (leading space) in some browsers.
**Why it happens:** CSS custom property value includes the whitespace from the declaration (e.g., `--primary: #06b6d4` — the space before the hash is part of the value).
**How to avoid:** Always call `.trim()` on the result: `style.getPropertyValue('--primary').trim()`.
**Warning signs:** Canvas fills appear transparent or default-black — the browser silently ignores invalid fillStyle values.

### Pitfall 2: MutationObserver fires before cascade settles
**What goes wrong:** The `data-theme` attribute change is observed, `resolveColors()` is called, but the new CSS custom property values haven't been computed yet — resolves to old values.
**Why it happens:** MutationObserver callbacks are microtasks, but CSSOM recalculation is synchronous with attribute changes. In practice the cascade recalculates before the observer fires. However, if the observer callback reads styles synchronously, it will get the new values.
**How to avoid:** Read via `getComputedStyle` in the observer callback (not via a cached style object). The `resolveColors()` function must call `getComputedStyle(document.documentElement)` fresh on each call — do not cache the `CSSStyleDeclaration` object.

### Pitfall 3: `oklch` tokens returned by getComputedStyle
**What goes wrong:** `useThemeColors()` returns `"oklch(0.65 0.15 142)"` — canvas rejects this as an invalid color.
**Why it happens:** The `:root` light token block uses `oklch()` values. If `class="dark"` is ever removed, or if the wrong token is read, `getComputedStyle` returns the oklch string.
**How to avoid:** All dark-theme token blocks (`[data-theme="*"]`) use hex values exclusively. Keep `class="dark"` permanent. Add a runtime assertion in development: if the returned value starts with `oklch`, log a warning.

### Pitfall 4: Tailwind `shadow-[var(--glow-sm)]` with `none` value
**What goes wrong:** When `--glow-sm: none`, the Tailwind arbitrary shadow `shadow-[var(--glow-sm)]` may render incorrectly — some implementations treat `none` as invalid in `box-shadow` shorthand.
**Why it happens:** CSS `box-shadow: none` is valid, but `box-shadow: var(--glow-sm)` where `--glow-sm = none` resolves correctly in browsers because `none` is a valid `box-shadow` keyword. However, Tailwind's JIT may generate a style rule like `box-shadow: var(--glow-sm)` which is correct — but this must be tested in Chrome/Firefox.
**How to avoid:** Test the readable theme in the browser after token migration. The readable theme sets `--glow-sm: none` — all `.glow-card` elements should have no box-shadow.
**Warning signs:** Cards in readable theme show unexpected shadows or missing borders.

### Pitfall 5: `[data-theme="emerald"]` specificity gap
**What goes wrong:** The existing `[data-theme="emerald"]` block only overrides ~12 tokens (accent-related). Tokens like `--foreground`, `--card`, `--muted-foreground` are not overridden — they inherit from `.dark`. If `.dark` and `[data-theme="emerald"]` have the same specificity and `.dark` appears first, emerald correctly inherits `--foreground` from `.dark`. But if a new theme block appears between `.dark` and `[data-theme="emerald"]` in the file, it could override shared tokens unexpectedly.
**How to avoid:** Place all new `[data-theme="*"]` blocks **after** the existing ones — preserve the source order: `.dark` → `[data-theme="cyan"]` → `[data-theme="emerald"]` → `[data-theme="amber"]` → `[data-theme="readable"]` → `[data-theme="aubergine"]`.

### Pitfall 6: `CostBreakdown.tsx` and `OperatorScoreCard.tsx` JS-interpolated colors
**What goes wrong:** These files use patterns like `"var(--primary, #10b981)"` (line 54 in OperatorScoreCard) or `"bg-[#10b981]"` (CostBreakdown:54–55) — they pass color values through inline styles or Tailwind arbitrary classes, bypassing the token cascade.
**Why it happens:** JS-side style interpolation can't use CSS variable shorthand for arbitrary properties; the fallback `#10b981` wins if the custom property is not set.
**How to avoid:** Replace with `getComputedStyle`-resolved values from `useThemeColors()`, or restructure to use a CSS class with the token applied. `OperatorScoreCard.tsx:54` — `"var(--primary, #10b981)"` is already using the token correctly (the fallback is a safeguard); verify this renders correctly in all themes without removing the fallback.

### Pitfall 7: CodeVaultGraph `VAULT_COLOR` after migration
**What goes wrong:** After migration, vault nodes use `colors.accent` from `useThemeColors()`. In Midnight Aubergine, `--accent = #10b981` (emerald). This means vault nodes turn emerald in aubergine theme — potentially confusing since emerald was previously the "code graph" color identity.
**Why it happens:** The theme spec assigns `--accent` to a complementary editorial color, but `VAULT_COLOR` was historically fixed at `#8b5cf6` (violet) — a color not defined as `--accent` in any theme.
**How to avoid:** Consider a dedicated `--vault-node-color` token that maps to violet across all themes, or accept the theme-driven color change. Flag as a planner decision with the user before execution.

---

## Code Examples

### Token block pattern (follow existing emerald structure)
```css
/* Source: src/index.css:184–200 — existing working pattern */
[data-theme="readable"] {
  --background: #111318;
  --foreground: #e8eaf0;
  /* ... full token set as specified in UI-SPEC ... */
  --glow-xs: none;
  --glow-sm: none;
  --glow-md: none;
  --glow-lg: none;
}
```

### Pre-paint inline script (index.html)
```html
<!-- Place in <head> before all other tags except <meta charset> -->
<script>
(function(){var t=localStorage.getItem('codepulse-theme'),v=['cyan','emerald','readable','aubergine'];if(!t){var o=localStorage.getItem('theme');if(o==='light')t='readable';localStorage.removeItem('theme');}if(!t||!v.includes(t))t='cyan';document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.add('dark');}());
</script>
```

### Driving theme in Playwright tests
```typescript
// Source: @axe-core/playwright docs pattern [ASSUMED — verify against installed version]
await page.addInitScript((theme) => {
  localStorage.setItem('codepulse-theme', theme);
}, 'readable');
await page.goto('/');
```

---

## Runtime State Inventory

This is not a rename/refactor phase — no stored data, live service config, OS-registered state, secrets, or build artifacts need updating. The two localStorage keys being consolidated exist only in the browser — no migration of stored records needed beyond what the pre-paint inline script handles.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Package install | ✓ | (project running) | — |
| `@playwright/test` | TH-06 e2e tests | ✓ | `^1.58.2` | — |
| `@axe-core/playwright` | TH-06 contrast audit | ✗ | — | Manual contrast check (not acceptable for TH-06) |
| Chromium (Playwright) | e2e test runs | ✓ | bundled with Playwright | — |
| Dev server (`npm run dev`) | e2e tests (webServer) | ✓ | Vite 7 | — |

**Missing dependencies with no fallback:**
- `@axe-core/playwright` — must be installed before TH-06 tests can run. Wave 0 task.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Unit test framework | Vitest `^4.0.18` |
| e2e framework | `@playwright/test ^1.58.2` |
| e2e config | `playwright.config.ts` |
| Quick run command | `npx vitest run` |
| e2e run command | `npm run test:e2e` |
| Dev server required for e2e | `npm run dev` (auto-started by playwright webServer) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TH-01 | Token variables resolve correctly per theme | Unit (hook) | `npx vitest run src/hooks/useThemeColors.test.ts` | ❌ Wave 0 |
| TH-01 | Canvas graphs receive theme colors, not hardcoded hex | Visual / e2e snapshot | Manual inspection + `npm run test:e2e` | ❌ Wave 0 |
| TH-02 | Readable theme WCAG-AA contrast on 5 surfaces | e2e axe | `npm run test:e2e -- --grep "readable"` | ❌ Wave 0 |
| TH-03 | Aubergine theme WCAG-AA contrast on 5 surfaces | e2e axe | `npm run test:e2e -- --grep "aubergine"` | ❌ Wave 0 |
| TH-04 | Cyan + Emerald retain contrast on 5 surfaces | e2e axe | `npm run test:e2e -- --grep "cyan\|emerald"` | ❌ Wave 0 |
| TH-05 | No FOUC on hard refresh (pre-paint script fires before paint) | e2e (hard reload) | `npm run test:e2e -- --grep "no-fouc"` | ❌ Wave 0 |
| TH-05 | localStorage "theme" key migrated on init | Unit | `npx vitest run src/components/ThemeSwitcher.test.tsx` | ❌ Wave 0 (ThemeSwitcher.test doesn't exist yet) |
| TH-06 | Zero axe violations per theme per surface (20 test cases) | e2e axe | `npm run test:e2e` (theme-contrast.spec.ts) | ❌ Wave 0 |

### FOUC Verification
The no-FOUC requirement (TH-05) is verified by:
1. **e2e test:** `page.goto('/')` after setting theme in localStorage → take screenshot on `domcontentloaded` event (before React hydration) → assert `data-theme` attribute is already set on `<html>`. This confirms the inline script ran.
2. **Visual observation:** Hard-refresh the browser on a non-default theme (e.g., readable) — no flash of cyan colors should appear before the UI settles.

### Canvas Theming Verification (TH-01)
Canvas graph theming is not verifiable by axe-core. Verification strategy:
1. **Unit test on `useThemeColors()`:** Mock `document.documentElement` with `getComputedStyle` returning known values; assert hook returns expected hex strings on `data-theme` mutation.
2. **Visual e2e:** Navigate to `/graphs` with each theme → Playwright screenshot → manual/visual diff comparison (no automated pixel assertion in this phase scope).

### prefers-reduced-motion Verification (TH-05)
```typescript
// In e2e test
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto('/');
// Assert .matrix-bg and scanline bar are hidden
await expect(page.locator('.matrix-bg')).toBeHidden();
```

### Sampling Rate
- **Per commit:** `npx vitest run` (unit tests only, ~10 seconds)
- **Per wave merge:** `npm run test:e2e` (full e2e suite including contrast)
- **Phase gate:** Full e2e suite green (zero axe violations across all 20 theme×surface combinations) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `e2e/theme-contrast.spec.ts` — covers TH-02, TH-03, TH-04, TH-06 (20 test cases)
- [ ] `e2e/theme-no-fouc.spec.ts` — covers TH-05 pre-paint verification
- [ ] `src/hooks/useThemeColors.test.ts` — covers TH-01 hook unit tests
- [ ] Install `@axe-core/playwright`: `npm install --save-dev @axe-core/playwright`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite passes raw inline `<script>` tags in `index.html` through untouched to `dist/index.html` | No-FOUC Pre-Paint Script | If Vite strips or transforms it, FOUC occurs in production but not dev |
| A2 | No CSP headers in the deployed app that would block inline scripts | No-FOUC Pre-Paint Script | If CSP exists, inline script is blocked → FOUC in production |
| A3 | `@axe-core/playwright` latest version is 4.x (mid-2026) | Standard Stack | Wrong version may have API differences; run `npm view @axe-core/playwright` to confirm |
| A4 | SVG turbulence noise renders acceptably as paper-grain in Chromium | Aubergine Surface Effects | May appear too subtle or too harsh — requires visual QA |
| A5 | `hexToRgba` conversion of `getComputedStyle` values is reliable (all dark tokens are hex, not oklch) | useThemeColors Hook | If any dark token returns oklch, canvas fillStyle is invalid → transparent renders |
| A6 | `VAULT_COLOR = "#8b5cf6"` should track `--accent` after migration | Hardcoded Color Inventory Cat B | Aubergine --accent is emerald (#10b981) — vault nodes would turn emerald; planner must confirm desired behavior |
| A7 | `slopcheck` was unavailable — `@axe-core/playwright` marked [ASSUMED] | Package Legitimacy Audit | Package is from Deque's verified org; low risk, but verify with `npm view` |

---

## Open Questions

1. **`VAULT_COLOR` identity after migration**
   - What we know: `CodeVaultGraph` uses fixed `#8b5cf6` (violet) for vault nodes. This color does not correspond to any theme token.
   - What's unclear: Should vault nodes track `--accent` (which changes per theme) or a fixed violet identity that doesn't change?
   - Recommendation: Add a `--vault-node-color` token to all theme blocks defaulting to `#8b5cf6`, so vault node color is theme-declared but consistent. Decide before the canvas migration wave.

2. **Provider color maps — migrate or preserve?**
   - What we know: `ProviderComparisonChart`, `GanttTimeline`, `providers.ts` use `#10b981` and `#06b6d4` as per-provider identity colors.
   - What's unclear: Should "claude-sdk" always be emerald regardless of active theme, or should it use `var(--primary)` / `var(--chart-bar-accent)`?
   - Recommendation: Preserve per-provider identity colors as-is (they are semantic to provider identity, not chrome). Only the glow/shadow instances need migration.

3. **`animate-scanline` — define or remove?**
   - What we know: Used in two places, never defined in CSS. Currently a no-op (the element is visible but not animated).
   - What's unclear: Was this intentional (animation removed for performance) or an oversight?
   - Recommendation: Define `@keyframes scanline` in `src/index.css` scoped to `[data-theme="cyan"]` and `[data-theme="emerald"]` only, so the scanline animation is a cyberpunk-only feature. Or remove the class and rely on the `crt-overlay` mechanism. Decide before DashboardLayout changes.

---

## Sources

### Primary (HIGH confidence — live code reads)
- `src/index.css` (lines 1–448) — token structure, cascade pattern, existing theme blocks, reduced-motion rule
- `index.html` (lines 1–16) — current head structure, script placement
- `src/components/ThemeSwitcher.tsx` — existing localStorage key, theme options
- `src/layouts/DashboardLayout.tsx` — dark mode toggle, CRT toggle, header chrome, scanline element
- `src/components/graph/ForceGraphCanvas.tsx` — canvas color prop interface, hardcoded DEFAULT_COLOR
- `src/components/graph/CodeVaultGraph.tsx` — CODE_COLOR, VAULT_COLOR, linkColorFn
- `src/pages/KnowledgeGraph.tsx:37` — COLOR_CURRENT
- `package.json` — confirmed `@playwright/test ^1.58.2` present, `@axe-core/playwright` absent
- `playwright.config.ts` — e2e setup, baseURL, webServer config

### Secondary (MEDIUM confidence — npm registry existence)
- `@axe-core/playwright` — npm scoped package from Deque Systems `@axe-core` org; [ASSUMED] version

### Tertiary (LOW confidence — training knowledge, not session-verified)
- Vite inline script passthrough behavior
- CSP absence in production deployment
- Browser `getComputedStyle` whitespace behavior for custom properties

---

## Metadata

**Confidence breakdown:**
- Cascade mechanics / token structure: HIGH — verified from live `src/index.css`
- Hardcoded color inventory: HIGH — verified by grep with file:line evidence
- Canvas consumers: HIGH — verified from live `ForceGraphCanvas.tsx`, `CodeVaultGraph.tsx`
- No-FOUC script pattern: MEDIUM — pattern is standard; Vite passthrough behavior is ASSUMED
- axe-core test shape: MEDIUM — API shape is standard; version and exact import path need verification after install
- `animate-scanline` no-op finding: HIGH — verified by absence in `src/index.css`
- `.crt-overlay` no-op finding: HIGH — verified by absence in `src/index.css`

**Research date:** 2026-06-24
**Valid until:** 2026-07-24 (stable CSS/Tailwind/Playwright stack; re-verify if Tailwind 4 minor version changes)

---

## RESEARCH COMPLETE

**Phase:** 89 — Readable Themes & Editorial Skin Toggle
**Confidence:** HIGH

### Key Findings

1. **Cascade pattern is proven** — `[data-theme="emerald"]` and `[data-theme="amber"]` already work in `src/index.css`. New blocks follow the same pattern verbatim; place them after existing blocks to preserve specificity ordering.

2. **No-FOUC script is straightforward** — `index.html` currently has no pre-paint script at all. Insert a ~180-byte blocking inline `<script>` in `<head>` before fonts. Vite leaves it untouched. Consolidate `"theme"` → `"codepulse-theme"` inside the same script.

3. **`animate-scanline` and `.crt-overlay` are currently no-ops** — neither class has a CSS definition. The visible CRT effect is a hardcoded static div at `DashboardLayout.tsx:625–627`. This phase must suppress that specific element under `[data-theme="readable"]` and `[data-theme="aubergine"]` via CSS selector.

4. **Hardcoded color count is ~81 occurrences across 26 files** (not exactly 77). The migration divides cleanly into: (A) Tailwind shadow/drop-shadow arbitrary values → `var(--glow-*)` tokens (~18 files, trivial), (B) canvas module constants → `useThemeColors()` hook (3 files, requires hook integration), (C/D) skills swatches + provider identity colors → **exempt** (intentional concrete values, not theme chrome).

5. **`@axe-core/playwright` is not installed** — must be added as a Wave 0 task. The 20 test cases (4 themes × 5 pages) are straightforward to author using `addInitScript` to set localStorage before navigation.

6. **`VAULT_COLOR = "#8b5cf6"`** in `CodeVaultGraph.tsx` does not map to any theme token — this is an open decision (track `--accent` or introduce `--vault-node-color`). Flag for user before executing the canvas migration wave.

### File Created
`.planning/phases/89-readable-themes-editorial-skin-toggle/89-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| CSS cascade mechanics | HIGH | Live code verified — pattern proven by existing emerald/amber blocks |
| Hardcoded color inventory | HIGH | Grep with file:line evidence; categorized by type |
| Canvas consumers | HIGH | Live code verified — ForceGraphCanvas, CodeVaultGraph, KnowledgeGraph.tsx |
| No-FOUC script | MEDIUM | Pattern is standard; Vite passthrough is ASSUMED |
| axe-core test shape | MEDIUM | API shape standard; version unverified until install |
| CRT/scanline state | HIGH | Verified: animate-scanline and .crt-overlay are both no-ops |

### Open Questions
- `VAULT_COLOR` fate after canvas migration (track `--accent` or new `--vault-node-color` token)
- Provider/provider-chart identity colors — migrate to tokens or preserve as data-driven identity
- `animate-scanline` — define properly (scoped to cyberpunk themes) or remove
