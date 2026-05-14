---
phase: 03-design-token-refresh
plan: "01"
subsystem: design-tokens
tags: [css, design-tokens, dark-theme, oklch, accessibility]
dependency_graph:
  requires: []
  provides:
    - "whisper-tint dark theme base tokens in src/index.css"
    - "five category accent tokens (cost/health/activity/memory/alerts) in :root and .dark"
    - "data-accent radial gradient selectors (5 variants)"
    - ".lift-on-hover utility class"
    - "prefers-reduced-motion coverage for new transitions"
  affects:
    - "all components consuming var(--background), var(--card), var(--border)"
    - "components that will adopt data-accent attribute (Phase 03-02+)"
    - "interactive cards that will adopt .lift-on-hover (Phase 03-02+)"
tech_stack:
  added: []
  patterns:
    - "OKLCH whisper-tint dark theme (oklch(0.160 0.012 260) base)"
    - "data-accent attribute + radial-gradient CSS selectors"
    - ".lift-on-hover utility with prefers-reduced-motion guard"
key_files:
  created: []
  modified:
    - "src/index.css"
decisions:
  - "Whisper-tint values match Claude OS exactly: background oklch(0.160 0.012 260), card oklch(0.195 0.014 260)"
  - "Border/input use alpha-channel oklch(1 0 0 / N%) rather than opaque values for overlay compositing"
  - "Accent tokens in :root at lower chroma (0.55 lightness vs 0.70 in .dark) for light-mode legibility"
  - "data-accent selectors use inline oklch values (not var()) — avoids double-var resolution in gradients"
  - "lift-on-hover explicitly nullifies will-change in reduced-motion context to prevent GPU layer retention"
metrics:
  duration: "2min"
  completed_date: "2026-05-14"
  tasks_completed: 2
  files_modified: 1
---

# Phase 03 Plan 01: Design Token Foundation Summary

Pure CSS design token foundation: OKLCH whisper-tint dark theme base tokens, five category accent hues in both `:root` and `.dark`, `data-accent` radial gradient card selectors, `.lift-on-hover` utility, and full `prefers-reduced-motion` coverage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Swap dark base tokens to whisper tint and add accent tokens | f0a8736 | src/index.css |
| 2 | Add lift-on-hover utility, data-accent gradient selectors, reduced-motion coverage | 0c823ef | src/index.css |

## What Was Built

### Task 1 — Whisper-tint dark base tokens + accent tokens

- **`.dark` block base tokens** updated to whisper-tint blue family:
  - `--background: oklch(0.160 0.012 260)` (was pure `oklch(0.145 0 0)`)
  - `--card: oklch(0.195 0.014 260)` (was `oklch(0.205 0 0)`)
  - `--border: oklch(1 0 0 / 8%)` (was opaque `oklch(0.269 0 0)`)
  - `--muted-foreground: oklch(0.65 0.02 256)` (was pure `oklch(0.708 0 0)`)
  - All related tokens (foreground, secondary, muted, accent, input, sidebar family) updated to blue-tint family
  - Glass dark overrides updated to match new card surface

- **Five accent tokens added to `.dark`:**
  - `--accent-cost: oklch(0.70 0.15 80)` (amber)
  - `--accent-health: oklch(0.70 0.15 142)` (green)
  - `--accent-activity: oklch(0.70 0.12 230)` (blue)
  - `--accent-memory: oklch(0.70 0.12 290)` (violet)
  - `--accent-alerts: oklch(0.70 0.18 27)` (red)

- **Five accent tokens added to `:root`** at lower chroma (0.55 vs 0.70) for light-mode legibility. Light theme base tokens completely untouched per D-02.

### Task 2 — Utility classes and reduced-motion

- **`.lift-on-hover`** utility: 240ms cubic-bezier transform/box-shadow/border-color transition with `translateY(-2px)` on hover
- **Five `[data-accent]` radial gradient selectors**: `radial-gradient(120% 60% at 0% 50%, <accent> / 0.10, transparent 55%)` — subtle glow from left edge
- **`prefers-reduced-motion`** block extended with explicit `.lift-on-hover` nullification (`transition: none`, `will-change: auto`, `transform: none`)

## Verification Results

```
accent-cost occurrences: 2 (one in :root, one in .dark) ✓
lift-on-hover occurrences: 5 (class, hover, reduced-motion x3) ✓
data-accent= occurrences: 5 ✓
npm run build: ✓ built in 7.83s
npx tsc --noEmit: ✓ clean
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is pure CSS token definitions. No UI data flows.

## Threat Flags

No new security-relevant surface introduced. CSS custom properties are client-side theming only (T-03-01: accept).

## Self-Check: PASSED

- `src/index.css` modified and committed ✓
- Commit `f0a8736` exists (Task 1) ✓
- Commit `0c823ef` exists (Task 2) ✓
- Build passes ✓
- TypeScript clean ✓
