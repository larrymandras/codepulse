---
phase: 116-galdr-prompt-library
plan: 08
subsystem: ui

tags: [react, router, nav-registry, playwright, galdr, e2e]

# Dependency graph
requires:
  - phase: 116-06
    provides: "FillVariablesDialog, SendSplitButton, PromptEditorDrawer"
  - phase: 116-05
    provides: "the live api.galdr.* surface on the self-hosted backend"
provides:
  - "src/pages/Galdr.tsx — the /galdr page: searchable card grid, derived category chips, favorites, drawer wiring"
  - "src/hooks/useGaldrPrompts.ts — list + versions wrappers, with a loading-aware variant"
  - "src/lib/navRegistry.ts — the sparkles icon and the /galdr COMMAND entry"
  - "e2e/galdr.spec.ts — the D-12 resolve-before-navigate proof with its negative control"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A `useQuery(...) ?? []` wrapper destroys the loading signal. Any surface that must render loading and empty differently needs a variant that keeps `undefined` — the fallback is a convenience for callers that only want rows, not a universal shape."
    - "Scope an e2e absence assertion to a control only the target renders. `getByText(title)` also matched the AlertDialog heading `Archive \"{title}\"?`, so the count went 2 → 1 and never reached 0; the send-target chevron is card-only and unambiguous."

key-files:
  created:
    - src/hooks/useGaldrPrompts.ts
    - src/pages/Galdr.tsx
    - src/pages/Galdr.test.tsx
    - e2e/galdr.spec.ts
  modified:
    - src/lib/navRegistry.ts
    - src/App.tsx
    - e2e/navigation.spec.ts

key-decisions:
  - "Nav entry lives only in navRegistry.ts; DashboardLayout.tsx untouched, asserted by git diff --name-only. Sidebar and CommandPalette both read the registry (Phase 96 WR-02)."
  - "Added useGaldrPromptsState() because the plan-specified wrapper cannot express the loading/empty distinction UI-SPEC requires."
  - "Added src/pages/Galdr.test.tsx, which the plan's files_modified omits but its own Task 2 acceptance criterion mandates."
  - "Playwright must run against the documented no-auth server (`dev:noauth` on 5181, PW_BASE_URL). The default 5173 run hits the Clerk gate and every nav-click test fails for reasons unrelated to the code under test."

patterns-established:
  - "Prove non-causation with a control, not an argument: reverting only the nav entry and re-running reproduced the identical 20 theme-contrast failures."

requirements-completed: []

# Metrics
duration: ~70min
completed: 2026-08-10
---

# 116-08: The /galdr page, nav entry, route and e2e proof

All three tasks complete. Phase 116 is finished.

## Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | **293 files passed, 17 skipped; 3892 passed, 193 todo, 0 failures** |
| `npx playwright test` (against `:5181`) | 40 tests — **20 passed, 20 failed** |
| `npx playwright test e2e/navigation.spec.ts` | 8/8 passed |
| `npx playwright test e2e/galdr.spec.ts` | passed, stable across two consecutive full-suite runs |

**All 20 Playwright failures are `theme-contrast.spec.ts`, and they are
pre-existing — measured, not assumed.** Adding a sidebar link is a genuinely
plausible causal path for a contrast test, so a control run with only the nav
entry reverted (everything else in place) was executed: it produced the same 20
failures. They are unrelated to Galdr and out of scope here.

**The e2e suite requires the no-auth server.** A default `npx playwright test`
run hits `http://localhost:5173`, where Clerk is enabled, and every nav-click
test fails on a sign-in gate — proven by a probe returning
`"CP\nCodePulse\n\nSign in to access the telemetry dashboard"` with
`ANCHOR_COUNT: 0` and zero console errors. The repo already documents the
correct invocation in `package.json`'s `test:e2e:noauth:help`. My first run used
the wrong one; the suite was never broken.

## Three defects found and fixed

**1. The specified hook cannot express the required states.**
`useGaldrPrompts()` returns `useQuery(...) ?? []`, collapsing "still loading"
and "the library is empty" into the same `[]` — but UI-SPEC requires skeleton
cards for one and the "No prompts yet" panel for the other. Added
`useGaldrPromptsState()` exposing `isLoading`; kept the specified wrapper.

**2. An e2e cleanup assertion that passed alone and failed under load.**
`getByText(title)` also matches the AlertDialog heading `Archive "{title}"?`, so
it resolved to 2, then 1, and never reached 0. Re-scoped to the send-target
chevron, which only a card renders.

**3. A race in the `/chat` assertion.** The original snapshotted `innerText()`
the instant the URL changed, racing `Chat.tsx`'s connect-then-send effect.
Before blaming my spec I confirmed the backend was actually up —
`:8181/health` → 200, `astridr-agent` healthy 4h — so the failure was correctly
attributed to the test rather than the environment. Replaced with a polling
`expect`.

## Mutation testing

`Galdr.test.tsx` makes two distinct claims about the Recently-used chip, so both
were mutated independently:

| Mutation | Result |
|---|---|
| Drop the `lastUsedAt` filter | exclusion test fails, control stays green |
| Flip the sort direction | ordering test fails, control stays green |

Assertions land on rendered DOM order, not the filter's return value.

## Live-instance hygiene

`e2e/galdr.spec.ts` writes to the live self-hosted Convex instance — there is no
test database. It creates one row with a run-unique title and archives that one
row. Four rows left behind by the *failing* iterations were archived
individually afterward; the library is back to exactly one prompt
(`adversarial-plan-review`, uses=1). No bulk delete and no `convex import` was
used at any point.

## Deviations from plan

- `src/pages/Galdr.test.tsx` is an added file the plan's `files_modified` omits,
  required by its own Task 2 acceptance criterion.
- `useGaldrPromptsState()` is an added export, for the reason above.
- Playwright was run against `:5181` with `PW_BASE_URL`, not the config's
  default `:5173`. The plan's verification block does not mention this, but the
  default cannot pass.

## Correction to my own reporting

An earlier reading of the Playwright output used `tail -18`, which cut off the
summary line; I read "19 passed" as a clean run when 21 had in fact failed. The
counts in this document come from a grep on the summary line itself.

## Open items

Two stale paths in this plan's own text, left as-is since the plan is otherwise
accurate and now executed: `AllSkillsOverview.tsx` is at
`src/components/skills/`, not `src/components/`.

The pre-existing 20 `theme-contrast` failures are real and unaddressed. They
belong to Phase 113 (Debt Sweep) or their own phase, not here — but they should
not be mistaken for a green suite.
