---
phase: 120-polish-verified-defects
plan: 02
subsystem: ui
tags: [tailwind, css, react, dashboard-shell, accessibility, theming]

# Dependency graph
requires:
  - phase: 120-01
    provides: "hover:scale-[1.01] sweep across 36 page/component files (did not touch src/index.css or DashboardLayout.tsx)"
provides:
  - "src/index.css with the glitch-text, matrix-bg, nav-active-shadow/nav-hover-shadow, and cyberpunk-scrollbar rules fully deleted (definitions, not just usages)"
  - "src/layouts/DashboardLayout.tsx with a quiet wordmark, quiet nav (both renderings), no matrix-bg wash, a neutral search pill, and three de-animated decorative pulse dots"
  - "CRT toggle feature verified intact end-to-end (default-off, toggle, readable-theme suppression) with live browser evidence"
  - "120-SHELL-EVIDENCE.md: 4 recorded judgment calls (nav-icon glow, 49 remaining bg-accent sites, dead shadow-primary, the D-04 departure) plus a stated deviation from CONTEXT.md's D-04"
affects: [122-token-system, 124-shell-header-sidebar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Content-based (not line-based) deletion of dead CSS in a shared checkout — locate by grep/content, verify before and after with fixed-string counts"
    - "De-animate, don't remove: unconditional animate-pulse dots keep their static <span> and sizing classes, only the animation token is stripped"

key-files:
  created:
    - .planning/phases/120-polish-verified-defects/120-SHELL-EVIDENCE.md
  modified:
    - src/index.css
    - src/layouts/DashboardLayout.tsx

key-decisions:
  - "D-04 was knowingly NOT executed verbatim: the .matrix-bg half of the Phase-89 suppression rule (~647-650, pre-plan numbering) was deleted, but the .crt-scanline-bar half (~652-655) was kept, because crt-scanline-bar has no base CSS definition anywhere and that suppression rule is the only thing keeping the CRT overlay out of the readable theme's no-effects guarantee (REQUIREMENTS.md:45, TOKEN-03). This departure is pre-approved in 120-CONTEXT.md's own 'Corrections added during planning' section."
  - "shadow-primary was left on the wordmark (not enumerated by POLISH-01's kill list) — it is a Tailwind shadow-color utility with no companion shadow-size class so it renders nothing; recorded as dead-but-inert for Phase 124 rather than removed under a broadened reading of D-03."
  - "The nav-icon drop-shadow-[...] glow at DashboardLayout.tsx:152/155/290 was left untouched — POLISH-01 names the nav-active-shadow/nav-hover-shadow CLASSES specifically, and this is a third, unnamed glow mechanism on the same items; D-01 (no adjacent cleanup) keeps it in scope for Phase 124/SHELL-01."

requirements-completed: [POLISH-01]

# Metrics
duration: ~55min
completed: 2026-08-17
---

# Phase 120 Plan 02: Quiet the Shell (CSS + DashboardLayout) Summary

**Deleted the dead glitch-text/matrix-bg/nav-glow/cyberpunk-scrollbar CSS definitions from `src/index.css` (103 net lines) and stripped their six usages plus three unconditional pulse dots from `src/layouts/DashboardLayout.tsx`, while keeping the CRT overlay feature, its readable-theme suppression, and the `--accent` token completely untouched — verified live in a headless browser, not just by grep.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 2 (`src/index.css`, `src/layouts/DashboardLayout.tsx`)
- **Files created:** 1 (`.planning/phases/120-polish-verified-defects/120-SHELL-EVIDENCE.md`)

## Accomplishments

- `src/index.css`: deleted the Cyberpunk Scrollbar block (4 rules), the Glitch effect block (5
  rules + 2 keyframes), the Premium Radial Background block (`.matrix-bg` + `::after`), the
  Phase-89 `.nav-active-shadow`/`.nav-hover-shadow` pair, and the dead `.matrix-bg` theme
  suppression rule. 836 → 733 lines (−103, or −105 deletions / +2 comment-rewrite insertions per
  `git diff --stat`). Native browser scrollbar is now the only scrollbar styling; no replacement
  was added (that's TOKEN-01, Phase 122).
- `src/layouts/DashboardLayout.tsx`: removed `nav-active-shadow`/`nav-hover-shadow` from **both**
  nav renderings (desktop aside and mobile drawer — 2 hits each, 4 tokens total, verified 2→0 in
  each file location); removed `glitch-text`, the wordmark `drop-shadow`, and the now-dead
  `data-text="CodePulse"` attribute while explicitly keeping `font-mono tracking-wider`; deleted
  the `<div className="matrix-bg" />` element entirely; replaced the search pill's
  `bg-accent/50 hover:bg-accent` with a neutral `bg-muted/40 hover:bg-muted/60` surface; and
  de-animated (not removed) the three unconditional `animate-pulse` dots at the nav-group label,
  the "Operator: Larry Mandras" line, and the "Astridr Runtime Telemetry" header pill.
- CRT toggle feature verified intact via a scripted headless-browser check against
  `dev:noauth` (port 5181) — see "CRT Verification" below for the literal observations, not just
  a grep-based inference.
- `120-SHELL-EVIDENCE.md` created recording the 4 deliberate non-actions plus the D-04 departure,
  each with `file:line` and an owning future phase.

## Task Commits

**Not committed by this agent.** This is a shared checkout on `master` with concurrent sessions
per the plan's `<output>` section — the orchestrator owns every commit and will commit this
plan's changes with explicit paths. Nothing was staged (`git add`) or committed by this
execution. Working tree state at handoff:

```
 M src/index.css
 M src/layouts/DashboardLayout.tsx
?? .planning/phases/120-polish-verified-defects/120-SHELL-EVIDENCE.md
?? .planning/phases/120-polish-verified-defects/120-02-SUMMARY.md
```

1. **Task 1: Delete the dead CSS definitions and the Cyberpunk Scrollbar (D-04, D-06)** — uncommitted, `src/index.css`
2. **Task 2: Quiet the shell** — uncommitted, `src/layouts/DashboardLayout.tsx`
3. **Task 3: Record the judgment calls** — uncommitted, `.planning/phases/120-polish-verified-defects/120-SHELL-EVIDENCE.md`

## Files Created/Modified

- `src/index.css` — deleted 5 dead-code blocks (scrollbar, glitch, matrix-bg, nav-shadow classes,
  matrix-bg suppression); rewrote 2 section comments so none describes a rule that no longer
  exists.
- `src/layouts/DashboardLayout.tsx` — 6 edits: nav glow (both renderings), wordmark, matrix-bg
  div, search pill, 3 pulse dots, plus a new inline comment documenting the D-03 exception.
- `.planning/phases/120-polish-verified-defects/120-SHELL-EVIDENCE.md` — new artifact, 4 recorded
  judgment calls + the D-04 deviation, each with `file:line`.

## Decisions Made

- **D-04 departure (the plan's own required disclosure).** `120-CONTEXT.md`'s D-04 instructs
  deleting "the Phase-89 suppression rules (~646-655)" as one unit. That range holds two distinct
  rules. The `.matrix-bg` half was deleted (its class and only usage are both gone). The
  `.crt-scanline-bar` half was **kept** — `.crt-scanline-bar` has no base definition in
  `index.css` (it's styled inline at `DashboardLayout.tsx:514`), the CRT feature survives this
  phase, and this suppression rule is the sole mechanism keeping the CRT bar out of the
  `readable` theme, whose no-effects guarantee is `REQUIREMENTS.md:45` (TOKEN-03). This departure
  is pre-approved in `120-CONTEXT.md`'s "Corrections added during planning (2026-08-17)" §3, and
  is restated in full in `120-SHELL-EVIDENCE.md` item 4.
- **`shadow-primary` left in place on the wordmark.** Not one of POLISH-01's enumerated kill-list
  tokens; it's a Tailwind shadow-color utility with no companion shadow-size class so it emits an
  unused CSS custom property and renders nothing. Recorded as dead-but-inert for Phase 124 rather
  than swept under a broad reading of D-03 (which only names `glitch-text`, the `drop-shadow`,
  and `data-text`).
- **Nav-icon `drop-shadow` glow left in place.** POLISH-01 and D-04 name the per-item nav glow by
  class (`nav-active-shadow`/`nav-hover-shadow`), both fully removed. The icon-level
  `group-[.is-active]:drop-shadow-[...]` / `group-hover:drop-shadow-[...]` pair at
  `DashboardLayout.tsx:152/155/290` is a separate, unenumerated mechanism on the same elements.
  D-01 ("enumerated tokens only, no adjacent cleanup") keeps it untouched; verified count is 2
  (desktop + mobile) both before and after, per the plan's own control assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The D-03 inline comment I first wrote contained the literal string `glitch-text`, which fails its own acceptance criterion**
- **Found during:** Task 2, immediately after the first verification pass
- **Issue:** The plan requires `git grep -cF 'glitch-text' -- src/layouts/DashboardLayout.tsx` to
  be exactly 0. My first draft of the explanatory comment above the wordmark literally wrote out
  `glitch-text` while describing what was removed, so the count came back 1 instead of 0 — a
  self-inflicted contradiction between documenting the removal and the removal being complete.
- **Fix:** Reworded the comment to describe the class as "the glitch-effect class" instead of
  quoting the literal removed class name, preserving the same information (D-03 exception, what
  was removed, what was kept, why) without the exact string.
- **Files modified:** `src/layouts/DashboardLayout.tsx`
- **Verification:** Re-ran `git grep -cF 'glitch-text' -- src/layouts/DashboardLayout.tsx` → 0
  (previously 1). Broader `git grep -cF 'glitch' --` is 1 (from "glitch-effect" in the comment),
  which is not one of the plan's checked strings and does not violate any stated criterion.
- **Not committed** (orchestrator owns commit).

---

**Total deviations:** 1 auto-fixed (Rule 1, self-caught during verification, not a plan defect)
**Impact on plan:** Zero scope creep — a wording correction to satisfy the plan's own acceptance
criterion. No behavior or CSS/JSX output changed.

## CRT Verification (live browser evidence, not grep-inferred)

The plan's `<verification>` section calls this an "attended check, not automatable here" and
warns explicitly not to report it as verified from grep alone. This execution environment has no
interactive browser/screenshot tool, so I built and ran a short one-off Playwright script
(`playwright` package already installed for the repo's own e2e suite) against a locally-started
`dev:noauth` server (`VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`, port 5181, per
`package.json`'s own `test:e2e:noauth:help` recipe) rather than eyeballing it, so the three
required observations are backed by literal computed-style and localStorage assertions instead of
a description. The script and its log were deleted after use and the server process was stopped;
`git status --short` confirms no leftover files.

Literal output from the run:

```json
{
  "hasToggle": true,
  "defaultLocalStorage_afterClearAndReload": null,
  "bodyClassBefore": "bg-gray-950 text-gray-100 font-geist subpixel-antialiased",
  "crtBarPresentInDOM_before": 1,
  "bodyClassAfterOn": "bg-gray-950 text-gray-100 font-geist subpixel-antialiased crt-active",
  "localStorageAfterOn": "true",
  "crtBarComputedDisplay_underReadable": "none",
  "crtBarComputedDisplay_defaultThemeStillOn": "block",
  "localStorageOnFreshReload_afterClear": null
}
```

Mapped to the plan's three required observations:

1. **"toggle CRT on and confirm the scanline bar appears"** — confirmed. Toggling
   (`button[aria-label*='CRT effect']`, initial state "Enable CRT effect" / "CRT effect OFF —
   click to enable", proving default-off) added `crt-active` to `document.body.className` and
   set `localStorage.codepulse-crt` to `"true"`. Under the default theme with CRT on,
   `getComputedStyle(.crt-scanline-bar).display` is `"block"` — the overlay renders.
2. **"reload and confirm it does not appear by default"** — confirmed. After clearing
   `codepulse-crt` from `localStorage` and reloading, `localStorage.getItem("codepulse-crt")` is
   `null` both before the first interaction and again after the clear-and-reload at the end of
   the run, which is what `JSON.parse(... ?? "false")` reads as `false` — CRT-by-default is
   satisfied, matching `DashboardLayout.tsx:392`'s existing expression (verify-and-record item
   from Task 2F, unchanged by this plan).
3. **"switch to the readable theme with CRT on and confirm the bar is suppressed"** — confirmed.
   With CRT still on, setting `document.documentElement.setAttribute("data-theme", "readable")`
   changed `getComputedStyle(.crt-scanline-bar).display` from `"block"` to `"none"`. This is the
   surviving suppression rule at `src/index.css:549-552` (post-plan line numbers) doing its job
   live, not merely present in source — which is exactly the distinction the plan's verification
   section asked for.

## Issues Encountered

- The currently-running default dev server on port 5173 is behind the Clerk auth gate ("Sign in
  to access the telemetry dashboard"), so the CRT check could not run against it. Resolved by
  starting `dev:noauth` on port 5181 per the project's own documented recipe
  (`package.json`'s `test:e2e:noauth:help` script), which pins `--host 127.0.0.1` (never wide-bound)
  and was stopped again after the check completed.
- The onboarding guide modal (`src/components/OnboardingGuide.tsx`) intercepted the first
  scripted click on a fresh `localStorage`. Resolved by setting its known dismiss key
  (`codepulse_onboarding_complete`, read from the component's own source) before interacting,
  rather than guessing at a selector.

## User Setup Required

None — no external service configuration required. This plan is frontend-only; no Convex deploy
was needed or performed.

## Next Phase Readiness

- Phase 122 (TOKEN-01/02) has a clean, reproducible starting point: `--accent` untouched (1
  definition, verified via `grep -c 'accent: #8b5cf6' src/index.css == 1`), and a
  `file:line`-precise inventory of the 49 remaining `bg-accent` sites (2 in this file, 47
  elsewhere) in `120-SHELL-EVIDENCE.md` item 2 so it doesn't need to re-derive the list.
- Phase 124 (SHELL-01/02) has three items on record it will otherwise rediscover as "new" defects:
  the nav-icon `drop-shadow` glow (item 1), the dead `shadow-primary` on the wordmark (item 3),
  and the CRT toggle's documented relocation target (the overflow menu) — none of which this plan
  touched, all of which are enumerated in `120-SHELL-EVIDENCE.md`.
- No blockers. `npx tsc --noEmit` exits 0; `npx vitest run` is identical to the pre-plan baseline
  (332 test files passed, 17 skipped; 4654 tests passed, 197 todo) both before and after this
  plan's edits.

---
*Phase: 120-polish-verified-defects*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `src/index.css`
- FOUND: `src/layouts/DashboardLayout.tsx`
- FOUND: `.planning/phases/120-polish-verified-defects/120-SHELL-EVIDENCE.md`
- FOUND: `.planning/phases/120-polish-verified-defects/120-02-SUMMARY.md`
- `git status --short` confirms `.planning/STATE.md` and `.planning/ROADMAP.md` are untouched
  (no output from `git status --short .planning/STATE.md .planning/ROADMAP.md`).
- No task-commit hashes to verify — this plan intentionally made no commits (shared checkout,
  orchestrator owns commits per the plan's `<output>` section).
