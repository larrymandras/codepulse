---
phase: 89-readable-themes-editorial-skin-toggle
plan: "05"
subsystem: ui
tags: [theming, css-tokens, no-fouc, localStorage, DashboardLayout, tailwind, react]

dependency_graph:
  requires:
    - phase: 89-02
      provides: ".nav-active-shadow / .nav-hover-shadow / .avatar-glow utility classes in src/index.css"
  provides:
    - "Blocking inline pre-paint script in index.html (no FOUC on theme-switch)"
    - "codepulse-theme as sole localStorage key; legacy 'theme' key migrated and removed"
    - "class=dark permanent (DarkModeToggle removed)"
    - "crt-scanline-bar class on the CRT bar div (CSS suppression from Plan 02 now takes effect)"
    - "Zero rgba(16,185,129) emerald literals in DashboardLayout.tsx"
    - "Category E nav-active / nav-hover / avatar glow wired to Plan 02 token-driven utility classes"
  affects:
    - "89-06 (Category A glow migration in component files)"
    - "89-07 (WCAG-AA e2e audit — readable/aubergine CRT bar now suppressed)"

tech_stack:
  added: []
  patterns:
    - "Blocking inline IIFE in index.html head (before module script) for no-FOUC theme application"
    - "4-slug allowlist validation before setAttribute to prevent XSS via localStorage injection"
    - "One-time localStorage key migration (theme→codepulse-theme) in the pre-paint script"
    - "oklch(from var(--primary) l c h / alpha) for drop-shadow CSS filter values"
    - "var(--glow-*) tokens for box-shadow values (auto-suppresses in readable/aubergine)"

key_files:
  created: []
  modified:
    - index.html
    - src/components/ThemeSwitcher.test.tsx
    - src/layouts/DashboardLayout.tsx

key_decisions:
  - "Drop-shadow filter values cannot use var(--glow-*) (box-shadow format); use oklch(from var(--primary) l c h / alpha) instead — this is the correct pattern for all drop-shadow arbitrary utilities"
  - "Settings NavLink footer shadow swapped to nav-active-shadow/nav-hover-shadow even though only the main nav NavLink (313/314) was in the plan — same pattern, same fix, zero emerald literals target required it"
  - "All remaining rgba(16,185,129) literals in DashboardLayout migrated (not just Category E sites): NavGroup label, icon drop-shadows, CodePulse h1 glow, status dot, tooltip shadows, dialog shadow, telemetry bar"

requirements-completed: [TH-05, TH-01]

duration: 25min
completed: "2026-06-24"
---

# Phase 89 Plan 05: No-FOUC Script + localStorage Consolidation + Category E Token Swap Summary

**Pre-paint inline script eliminates FOUC (codepulse-theme → data-theme before React loads); DarkModeToggle removed (class=dark permanent); all rgba(16,185,129) emerald literals migrated from DashboardLayout to var(--glow-*)/oklch(from var(--primary)...) tokens; Category E nav/avatar glow wired to Plan 02 utility classes.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-24T15:00:00Z
- **Completed:** 2026-06-24T15:25:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Blocking inline IIFE in `index.html` reads `codepulse-theme`, migrates legacy `theme=light` to `readable`, validates against 4-slug allowlist, sets `data-theme` and `class=dark` before first paint
- `DashboardLayout.tsx` DarkModeToggle component and its `useEffect` reading the old `theme` key both removed; `Sun` import removed (unused); `class=dark` is now permanent via the pre-paint script
- CRT scanline bar tagged with `crt-scanline-bar` class (Plan 02's `display:none` suppression now applies in readable/aubergine); `animate-scanline` dead class removed; shadow tokenized to `var(--glow-md)`
- Category E: nav isActive → `nav-active-shadow`, nav hover → `nav-hover-shadow`, avatar → `avatar-glow` (all three Plan 02 utility classes wired)
- All remaining `rgba(16,185,129,...)` literals in `DashboardLayout.tsx` migrated to `oklch(from var(--primary)...)` (drop-shadows) and `var(--glow-*)` (box-shadows); zero emerald literals remain
- Two `it.todo` ThemeSwitcher migration test stubs converted to real passing tests

## Task Commits

1. **Task 1: No-FOUC pre-paint inline script** — `532271d` (feat)
2. **Task 2: ThemeSwitcher migration test stubs filled** — `0773ca8` (feat)
3. **Task 3: DarkModeToggle removal + dead classes + Category E swap** — `14295c5` (feat)

## Files Created/Modified

- `index.html` — Blocking inline IIFE added immediately after meta charset; validates slug against allowlist before setAttribute
- `src/components/ThemeSwitcher.test.tsx` — Two `it.todo` placeholders replaced with real passing assertions (ThemeSwitcher ignores old `theme` key; no dark-mode toggle button present)
- `src/layouts/DashboardLayout.tsx` — DarkModeToggle removed, theme-key useEffect removed, Sun import removed, avatar-glow class applied, crt-scanline-bar tagged, animate-scanline removed, crt-overlay removed, all emerald rgba literals migrated to oklch/glow tokens

## Decisions Made

- **drop-shadow vs box-shadow token format:** `var(--glow-xs)` expands to a full `box-shadow` shorthand string (`0 0 8px rgba(...)`), which is invalid inside CSS `filter: drop-shadow()`. Used `oklch(from var(--primary) l c h / alpha)` for all `drop-shadow-[...]` Tailwind arbitrary utilities, and `var(--glow-*)` only for `shadow-[...]` (box-shadow) utilities.
- **Settings NavLink included in Category E swap:** The footer Settings NavLink used the same `shadow-[inset_2px_0_..._rgba(16,185,129,...)]` pattern as the main nav. The plan's "zero emerald literals" target required it; swapped to `nav-active-shadow` / `nav-hover-shadow` identically.
- **Full DashboardLayout literal sweep:** The plan's acceptance criteria required zero `rgba(16,185,129)` in the file. Beyond Category E (313/314/389) and the scanline bar (626), 8 additional sites (NavGroup label, icon drop-shadows, label drop-shadows, tooltip shadows, h1 CodePulse, status dot, dialog shadow, telemetry bar) were migrated in the same Task 3 commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Migrated all DashboardLayout emerald rgba literals, not just Category E**

- **Found during:** Task 3 (DashboardLayout edits)
- **Issue:** After applying the 4 Category E swaps and the scanline bar fix, the plan's guard script reported 10 additional `rgba(16,185,129)` literal occurrences at other sites in the file (NavGroup labels, icon drop-shadows, tooltip shadows, dialog, h1, status dot, telemetry bar). The acceptance criteria explicitly states "ZERO rgba(16,185,129) literal remains in DashboardLayout."
- **Fix:** Migrated all remaining literals — `drop-shadow-[...]` to `drop-shadow-[0_0_*px_oklch(from_var(--primary)_l_c_h_/_alpha)]`, `shadow-[...]` to `shadow-[var(--glow-*)]`.
- **Files modified:** `src/layouts/DashboardLayout.tsx`
- **Verification:** Guard script `node -e "if(/rgba\(16, ?185, ?129/.test(...)) exit(1)"` exits 0
- **Committed in:** `14295c5` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — scope extension to satisfy zero-literal acceptance criterion)
**Impact on plan:** Required for plan's own acceptance criteria. All changes are Category A/E-class (shadow/glow tokenization) — no structural change.

## Issues Encountered

None — build passed on first attempt, all 134 test files green, tsc clean.

## Known Stubs

None — all functionality is fully wired. The pre-paint script is live in `index.html`, the CRT bar is tagged, and all emerald literals are migrated.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. The inline pre-paint script reads from `localStorage` (origin-scoped) and validates against a 4-slug allowlist before `setAttribute` — T-89-09 and T-89-10 mitigations from the plan's threat model are in place. The CSP note (T-89-11) is included as a code comment in `index.html`.

## Self-Check

Files exist:
- `index.html` — FOUND (modified)
- `src/components/ThemeSwitcher.test.tsx` — FOUND (modified)
- `src/layouts/DashboardLayout.tsx` — FOUND (modified)

Commits exist:
- `532271d` — Task 1: no-FOUC pre-paint script
- `0773ca8` — Task 2: ThemeSwitcher migration tests
- `14295c5` — Task 3: DashboardLayout cleanup + token migration

## Self-Check: PASSED

---
*Phase: 89-readable-themes-editorial-skin-toggle*
*Completed: 2026-06-24*
