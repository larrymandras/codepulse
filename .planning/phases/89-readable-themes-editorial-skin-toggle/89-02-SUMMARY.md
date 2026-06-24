---
phase: 89
plan: "02"
subsystem: css-tokens
tags: [theming, css-custom-properties, readable-dark, aubergine, wcag-aa, tokenization]
dependency_graph:
  requires: []
  provides:
    - "[data-theme=readable] full token block in src/index.css"
    - "[data-theme=aubergine] full token block in src/index.css"
    - "--vault-node-color token on all 5 theme blocks"
    - "aubergine body::before paper-grain + body::after ambient gradient"
    - ".matrix-bg + .crt-scanline-bar display:none suppression under readable + aubergine"
    - "prefers-reduced-motion suppression of aubergine pseudo-elements"
    - "Category F chrome tokenized via oklch(from var(--primary) l c h / alpha)"
    - ".nav-active-shadow / .nav-hover-shadow / .avatar-glow utility classes"
  affects:
    - "src/layouts/DashboardLayout.tsx (Plan 05 consumes .nav-active-shadow/.avatar-glow)"
    - "src/components/graph/CodeVaultGraph.tsx (reads --vault-node-color via useThemeColors)"
tech_stack:
  added: []
  patterns:
    - "CSS relative-color oklch(from var(--primary) l c h / alpha) for alpha variants of theme tokens"
    - "SVG feTurbulence data URI inline for paper-grain texture"
    - "[data-theme] selector scoping for aubergine body pseudo-elements"
key_files:
  created: []
  modified:
    - src/index.css
decisions:
  - "CSS relative-color syntax (oklch(from var(--primary)...)) used for alpha variants in Category F chrome — avoids rgba literals, works with any theme's --primary value"
  - ".matrix-bg second gradient uses oklch(from var(--accent)...) not oklch(from var(--primary)...) to preserve the dual-color radial pattern matching the original violet + cyan split"
  - "aubergine pseudo-elements use z-index:-1 to match existing .matrix-bg stacking pattern"
metrics:
  duration_minutes: 35
  completed_date: "2026-06-24"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 1
---

# Phase 89 Plan 02: CSS Token Blocks + Chrome Tokenization Summary

One-liner: Readable Dark and Midnight Aubergine theme token blocks added to src/index.css with full token sets, --vault-node-color on all five themes, aubergine paper-grain/gradient surface effects, effect suppression rules, Category F chrome migrated from hardcoded cyan to `oklch(from var(--primary)...)`, and `.nav-active-shadow`/`.nav-hover-shadow`/`.avatar-glow` utility classes defined for Plan 05 consumption.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add readable + aubergine token blocks; --vault-node-color on all 5 themes | 467cb3e | src/index.css |
| 2 | Aubergine surface effects + suppression + reduced-motion | f74cf6d | src/index.css |
| 3 | Tokenize Category F in-CSS chrome | 579e762 | src/index.css |
| 4 | Add Category E nav-active / avatar glow utility classes | fe081df | src/index.css |

## What Was Built

### Task 1: New Token Blocks + --vault-node-color

Added `[data-theme="readable"]` and `[data-theme="aubergine"]` full token blocks to `src/index.css`, appended after `[data-theme="amber"]` in strict source order (Pitfall 5 compliance). Both blocks define the complete canonical token set: surface, brand, status, chart, glow, glass, speaking-ring, sidebar, and `--sidebar-active-bar: var(--primary)`.

`--vault-node-color: #8b5cf6` added to all five theme blocks: `.dark`/cyan (line 183), emerald (line 202), amber (line 221), readable (line 280), aubergine (line 339). Violet default preserves vault node identity across themes without tracking `--accent` (locked decision OQ-1).

Readable spot-checks: `--background:#111318`, `--foreground:#e8eaf0`, `--primary:#5eead4`, `--glow-xs:none` (and sm/md/lg:none — glow fully disabled for readability).
Aubergine spot-checks: `--background:#120d18`, `--foreground:#f0e8dc`, `--primary:#c084fc`, `--accent:#10b981`.

### Task 2: Aubergine Surface Effects + Suppression

`[data-theme="aubergine"] body::before` — paper-grain texture via inline SVG `feTurbulence fractalNoise` data URI, `opacity:0.025`, `z-index:-1`, `pointer-events:none`, `position:fixed`.

`[data-theme="aubergine"] body::after` — dual ambient radial gradients: `rgba(192,132,252,0.06)` at top-left (plum), `rgba(16,185,129,0.04)` at bottom-right (emerald editorial counterpoint). Same stacking/isolation props.

Suppression rules: `display:none` on `.matrix-bg` and `.crt-scanline-bar` under both `[data-theme="readable"]` and `[data-theme="aubergine"]`. (`.crt-scanline-bar` class will be applied to the bar div in Plan 05.)

New `@media (prefers-reduced-motion: reduce)` block sets `opacity:0` on both aubergine pseudo-elements. The existing reduced-motion block at line ~441 is unchanged.

### Task 3: Category F Chrome Tokenization

Migrated all hardcoded `rgba(6,182,212,...)` / `#06b6d4` cyan literals from chrome rule bodies to CSS relative-color syntax:

- `glow-card::before` radial-gradient → `oklch(from var(--primary) l c h / 0.15)`
- `scrollbar-track` border → `oklch(from var(--primary) l c h / 0.1)`
- `scrollbar-thumb` background → `oklch(from var(--primary) l c h / 0.3)`
- `scrollbar-thumb:hover` background + box-shadow → `oklch(from var(--primary) l c h / 0.6/0.8)`
- `glitch-text:hover::before` text-shadow → `oklch(from var(--primary) l c h / 0.8)`
- `.matrix-bg` first radial-gradient → `oklch(from var(--primary) l c h / 0.08)`
- `.matrix-bg` second radial-gradient → `oklch(from var(--accent) l c h / 0.08)` (preserves dual-color pattern)

Token definition blocks (e.g. `--primary: #06b6d4`) are unchanged — hex values remain correct there.

### Task 4: Category E Nav/Avatar Glow Utility Classes

Three utility classes added after the Category F chrome rules, before the aubergine surface effects section:

- `.nav-active-shadow` — `inset 2px 0 15px oklch(from var(--primary) l c h / 0.15), inset 3px 0 0 var(--primary)` — mirrors DashboardLayout.tsx:313 exactly, color moved to token
- `.nav-hover-shadow` — `inset 2px 0 10px oklch(from var(--primary) l c h / 0.1), inset 3px 0 0 oklch(from var(--primary) l c h / 0.5)` — mirrors DashboardLayout.tsx:314
- `.avatar-glow` + `.avatar-glow:hover` — `0 0 10px/20px oklch(from var(--primary) l c h / 0.3/0.6)` — mirrors DashboardLayout.tsx:389

No `rgba(16,185,129,...)` literals anywhere in these classes. In the readable theme (`--primary:#5eead4`, `--glow-*:none`), these resolve to teal glow values; when a future plan wires `.nav-active-shadow` onto the nav, readable will show teal instead of emerald.

## Deviations from Plan

### Auto-decisions (no structural change)

**1. [Decision] .matrix-bg second gradient uses --accent, not --primary**
- **Found during:** Task 3
- **Issue:** The original `.matrix-bg` used two different colors — `rgba(6,182,212,0.08)` (cyan) at 15% 50% and `rgba(139,92,246,0.08)` (violet) at 85% 30%. The task specified migrating the cyan to `var(--primary)`, but the violet was also a hardcoded literal.
- **Fix:** Migrated the violet gradient to `oklch(from var(--accent) l c h / 0.08)` to preserve the intentional dual-color aesthetic. This keeps the matrix-bg visually distinct (primary + accent) per theme rather than collapsing both gradients to the same color.
- **Files modified:** src/index.css
- **Commit:** 579e762

## Known Stubs

None — all token blocks are fully specified per UI-SPEC values. No placeholder text or empty values that flow to UI rendering.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. The inline SVG `feTurbulence` data URI in `body::before` is a static author-controlled decorative texture (no external fetch, no script, no user input) — within the T-89-03 accepted threat in the plan's threat model. Both pseudo-elements use `pointer-events:none` + `z-index:-1` per T-89-04 mitigation.

## Self-Check

Files exist:
- src/index.css — FOUND (modified in place)

Commits exist:
- 467cb3e — FOUND (Task 1)
- f74cf6d — FOUND (Task 2)
- 579e762 — FOUND (Task 3)
- fe081df — FOUND (Task 4)

## Self-Check: PASSED
