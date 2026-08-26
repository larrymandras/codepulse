---
phase: 124-shell-information-architecture
plan: 07
subsystem: shell-header
tags: [dropdown-menu, header, overflow-menu, theme, privacy, crt, ambient-audio, lazy-boundary]
requires: ["124-06"]
provides: ["header ⋯ overflow menu", "SHELL-01 right-zone consolidation"]
affects: ["src/layouts/DashboardLayout.tsx", "src/layouts/__tests__/DashboardLayout.test.tsx"]
tech-stack:
  added: []
  patterns: ["DropdownMenu composing existing controls (not reimplementing them)", "lazy()+Suspense boundary preserved across a relocation"]
key-files:
  created: []
  modified:
    - src/layouts/DashboardLayout.tsx
    - src/layouts/__tests__/DashboardLayout.test.tsx
decisions:
  - "ThemeSwitcher's Radix Select nests inside a DropdownMenuItem without a fallback — verified live via Playwright, not assumed."
  - "Right zone holds 5 visible items after this plan (EStop, BrainBadge, Bell, ⋯, UserMenu), not 6 — the system chip that makes it 6 is 124-08's work, not built here."
metrics:
  duration: "~90 minutes"
  completed: 2026-08-21
---

# Phase 124 Plan 07: Header Overflow Menu Summary

Built the header's `⋯` overflow menu and relocated the four settings-shaped controls
(theme, privacy, CRT, ambient audio) into it, preserving `ThemeSwitcher`'s lazy chunk
boundary — verified live, not assumed, that a Radix `Select` nested inside a Radix
`DropdownMenu` actually applies a theme change.

## What Was Built

**Task 1** (`edb020ac`) — Added a `DropdownMenu` to the header's right zone: an icon-only
trigger (`Button variant="ghost" size="icon"`, Lucide `Ellipsis`, `aria-label="More
options"`). `size-8` on that Button variant is `2rem` = 32px (no root font-size override
found in `src/index.css` — confirmed the default 16px browser root applies), giving the
trigger a genuine 32×32px hit area, unlike the file's two pre-existing icon-only controls
(hamburger, mobile close-X) which measure 24×24px and were left untouched (out of this
plan's scope). `ThemeSwitcher` (inside its existing `Suspense` boundary), `PrivacyShield`,
`CrtToggle`, and `AmbientAudioPlayer` moved from the visible row into four
`DropdownMenuItem`s, each with `onSelect={(e) => e.preventDefault()}` so operating a
control doesn't close the menu. The two now-empty `w-px h-4 bg-primary/20` divider spans
were removed. No `aria-expanded`/`aria-haspopup` was hand-written — Radix supplies both
(confirmed live in the rendered DOM during Task 2's interactive check:
`aria-haspopup="menu" aria-expanded="false"` on the trigger). No Help entry was added.
`min-h-14`/`flex-wrap` header height classes were not touched.

**Task 2** (verification only, no commit) — Confirmed the `ThemeSwitcher` lazy boundary
survived the move, by diff inspection plus a real before/after build.

**Task 3** (`890355f6`) — Added a test block asserting the menu's exact four-item contents,
Help's absence, and that the trigger/Active-Brain slot stay outside the menu. Upgraded the
`PrivacyShield`/`ThemeSwitcher`/`AmbientAudioPlayer` `vi.mock` stubs from a bare null render
to identifiable `data-testid` stubs, since a null-render mock can't distinguish "not
mounted" from "not visible." Proved the "before opening" assertion actually discriminates
by a live mutation run (below).

## Corrections to the Plan (plan-is-a-draft)

- **"Right zone holds six items" (Task 1's `<done>`)** — after this plan the right zone
  holds **5** visible items: `EStopButton`, `BrainHeaderBadge` (boundary), `NotificationBell`,
  the new `⋯` trigger, `UserMenu`. The sixth item, the system chip, is 124-08's work and
  does not exist yet. D-07's "six" describes the target state after both 124-07 and 124-08
  land, not this plan alone — confirmed by re-reading `124-CONTEXT.md` D-07/D-11 and the
  UI-SPEC's Header Contract, both of which cite the system chip as "(new)" and unbuilt here.
- **Acceptance criteria's literal grep numbers for `DropdownMenuContent`/`DropdownMenuItem`**
  (plan says 1 / 4) undercounted: `grep -c` counts matching *lines*, and each JSX element
  spans an opening-tag line and a closing-tag line, plus the import statement also matches
  the bare name. Actual counts: `DropdownMenuContent` → 3 lines (1 import + 1 open + 1
  close = exactly 1 element); `DropdownMenuItem` → 9 lines (1 import + 4 opens + 4 closes =
  exactly 4 elements). The structural intent (1 content, 4 items) is correct; the plan's
  literal numeral was wrong about what `grep -c` measures.
- **Task 3's own read_first note ("give each stub identifiable content before asserting on
  it")** turned out to matter for a component the plan didn't name: `BrainHeaderBadge`
  throws under this test suite's existing minimal `api` mock (it needs
  `useBrainCatalogue`/`useResolvedBrain` query refs this file never mocked — a pre-existing
  gap unrelated to D-07). Its `SectionErrorBoundary` catches that and renders
  `"Active Brain failed to load"`. The "six visible items" test asserts on that fallback
  text (proving the *slot* stayed in the visible row) rather than on `BrainHeaderBadge`'s
  real content, since fixing that pre-existing mock gap is out of this plan's scope.

## Task 2: Lazy Boundary Verification (Manual — No CI Gate Exists)

**No bundle-size CI gate exists in this repository**, confirmed live (not just cited from
the plan):
```
$ grep -ciE "size-limit|bundlesize|bundle-size" package.json
0
$ grep -ciE "size-limit|bundlesize|bundle-size" .github/workflows/ci.yml
0
$ grep -ci npm .github/workflows/ci.yml   # control — proves the probe discriminates
2
```

**Three diff assertions**, run against the actual Task 1 commit (`git show edb020ac --
src/layouts/DashboardLayout.tsx`):
1. `lazy()` declaration/import region untouched: `grep -c "^[-+].*lazy(" ` on that commit's
   diff → **0**.
2. `Suspense` still wraps `<ThemeSwitcher />` at its new location, fallback still the
   fixed-size `<div className="w-9 h-9" aria-hidden="true" />` placeholder — visually
   confirmed in the diff (the whole `<Suspense>...</Suspense>` block moved as a unit into
   the new `DropdownMenuItem`, untouched internally). `grep -c "Suspense"` on the file:
   **7 before, 7 after** — unchanged, as required.
3. No new static import: `grep -cE "^import \{ ?ThemeSwitcher" src/layouts/DashboardLayout.tsx`
   → **0**.

**Build measurement — real before/after pair** (before figure obtained from a detached
`git worktree` at the pre-Task-1 commit `5a8b236f`, built with a symlinked `node_modules`;
not fabricated):

| | Entry chunk | Entry gzip | ThemeSwitcher chunk | ThemeSwitcher gzip |
|---|---|---|---|---|
| Before (`5a8b236f`) | `index-BllU9mvv.js` 552.23 kB | 165.86 kB | `ThemeSwitcher-NRyMP-Ig.js` 1.71 kB | 0.89 kB |
| After (`edb020ac`, final `890355f6`) | `index-BIplx4T5.js` 581.55 kB | 173.30 kB | `ThemeSwitcher-DHkUNrvN.js` 1.71 kB | 0.89 kB |

`ThemeSwitcher`'s own emitted chunk is **byte-identical** (1.71 kB / 0.89 kB gzip) before
and after — direct proof `@radix-ui/react-select` did **not** land in the entry chunk. The
entry chunk itself grew ~29.32 kB raw / 7.44 kB gzip, which is the new static `DropdownMenu`
+ `Button` + `Ellipsis` imports (all already-vendored, no new dependency) becoming part of
the always-visible trigger — not a lazy-boundary regression. T-124-07-01 is mitigated.

**Nested-Select interactive verification — done live, not assumed.** Task 1's action text
required verifying interactively whether a Radix `Select` (`ThemeSwitcher`) nested inside a
Radix `DropdownMenuItem` actually applies a change, with a named fallback if it doesn't. No
browser tool is available to this agent directly, so a throwaway Playwright spec
(`e2e/_tmp-124-07-menu-verify.spec.ts`, deleted before finishing — never committed) was run
against the repo's own `dev:noauth` keyless server (`VITE_CLERK_PUBLISHABLE_KEY=` empty
override, per `package.json`'s own `test:e2e:noauth:help` script — the first attempt without
that override hit the Clerk sign-in gate on both :5173 and a naively-started :5181).
Observed:
```
THEME_BEFORE: cyan
THEME_AFTER: emerald
✓ overflow menu: theme select nested in DropdownMenu actually applies a theme change (1.9s)
```
Clicking "More options" → clicking the nested "Select theme" trigger → picking "Matrix
Emerald" changed `document.documentElement.dataset.theme` from `cyan` to `emerald`. **The
`DropdownMenuItem`-wrapped shape works as shipped — no plain-`<div>` fallback was needed.**
The rendered trigger DOM captured during this run also showed Radix's own
`aria-haspopup="menu" aria-expanded="false"`, confirming those attributes are supplied by
Radix at runtime and were correctly not hand-authored.

## Task 3: Discrimination Proof (Mutation Test, Not Committed)

To prove the "none of the four relocated controls is in the document before the menu opens"
test actually discriminates (rather than passing vacuously), `PrivacyShield` was temporarily
moved back out of `DropdownMenuContent` into the visible row in `DashboardLayout.tsx`:

**Run 1 (mutated — control left visible):**
```
$ npx vitest run ... -t "none of the four relocated controls"
FAIL  ... > none of the four relocated controls is in the document before the menu opens
expect(element).not.toBeInTheDocument()
expected document not to contain element, found <div data-testid="stub-privacy-shield" />
```
Confirmed FAILING, as required.

**Run 2 (reverted):**
```
$ git diff -- src/layouts/DashboardLayout.tsx
(empty)
$ npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx
Test Files  1 passed (1)
Tests  22 passed | 4 todo (26)
```
The revert was verified byte-exact via an empty `git diff` before re-running — not assumed
clean.

A second, smaller contamination was also caught and fixed: the first draft of two new test
comments contained the literal string `() => null` (describing the pre-existing stubs in
prose), which inflated the `grep -cF "() => null"` count and made the required "decreased by
3" acceptance criterion read as "decreased by 1." Reworded both comments to avoid the exact
search string; re-verified clean:
```
before (commit edb020ac, pre-Task-3) = 10
after  (final)                        = 7
delta = 3
```

## Verification

- `npx tsc --noEmit` — exits 0 (checked after every task).
- `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` — 22 passed, 4 todo (0 failed).
- `npm test` (full suite) — **349 test files passed, 17 skipped, 0 failed; 4917 tests
  passed, 195 todo.** (The repeated "Not implemented: HTMLCanvasElement's getContext()"
  jsdom warnings are pre-existing noise from chart/graph component tests — no `canvas`
  package installed — unrelated to this plan.)
- `npm run build` — exits 0. Final entry chunk `index-BIplx4T5.js` 581.55 kB (gzip
  173.30 kB); see the before/after table above.
- `git diff -- src/layouts/DashboardLayout.tsx | grep -c '^[-+].*min-h-14'` (against the
  Task 1 commit) → **0**.
- `git diff 5a8b236f HEAD -- src/layouts/DashboardLayout.tsx src/layouts/__tests__/DashboardLayout.test.tsx | grep '^+' | grep -oE '#[0-9a-fA-F]{3,8}'` → **0 hardcoded hex added**.
- `git diff 5a8b236f HEAD -- src/lib/__tests__/navRegistry.routes.test.ts` → **empty**; that
  suite: 4 passed.
- Keyboard shortcuts (Cmd/Ctrl+K, `m`, `p`, `escape`) — grepped post-edit, all still present
  and unmodified in `DashboardLayout.tsx`'s single keydown `useEffect`.
- `src/components/voice/` — untouched (`git diff --name-only 5a8b236f HEAD` lists only the
  two plan files).
- `.planning/STATE.md`, `.planning/ROADMAP.md` — not modified; no `gsd-sdk query state.*`
  or `roadmap.*` verb was run, per the orchestrator's instruction.

## Shared-Checkout Discipline

Every commit staged only its explicit file (`git add <path>`, never `-A`/`.`), and
`git show --stat HEAD` was read after each commit — no sweep-in from the concurrent
Phase 193 session in either commit (`edb020ac`: 1 file; `890355f6`: 1 file). No
`--amend`, `git checkout -- <path>`, `git reset --hard`, or `git stash` subcommand was used
anywhere in this session. The before/after build comparison used a detached `git worktree`
at the parent commit rather than any in-place checkout/stash, so the shared working tree was
never at risk. The worktree's `git worktree remove` succeeded from git's registry
(`git worktree list` shows only the main checkout, `git worktree prune` ran clean); the
filesystem directory itself failed to delete due to a Windows long-path limit inside the
scratchpad temp dir — harmless, outside the repo, left as-is.

## Deviations from Plan

### Auto-fixed Issues

None beyond the plan corrections documented above (Rule-1/2/3 territory: none applied —
no bugs found in existing code, no missing critical functionality, no blocking issues).

## Known Stubs

None introduced by this plan. `PrivacyShield`/`ThemeSwitcher`/`AmbientAudioPlayer` remain
the app's real components; only their *test-mock* stubs changed shape (from a bare null
render to an identifiable placeholder), which is test-only and does not affect production
behavior.

## Threat Flags

None beyond the plan's own threat model, which already covered this plan's full surface
(T-124-07-01 through -04, T-124-07-SC) — see `124-07-PLAN.md`'s `<threat_model>`. No new
network endpoint, auth path, file access pattern, or schema change was introduced.

## Self-Check

```
$ [ -f src/layouts/DashboardLayout.tsx ] && echo FOUND || echo MISSING
FOUND
$ [ -f src/layouts/__tests__/DashboardLayout.test.tsx ] && echo FOUND || echo MISSING
FOUND
$ git log --oneline --all | grep -q edb020ac && echo FOUND || echo MISSING
FOUND
$ git log --oneline --all | grep -q 890355f6 && echo FOUND || echo MISSING
FOUND
```

## Self-Check: PASSED
