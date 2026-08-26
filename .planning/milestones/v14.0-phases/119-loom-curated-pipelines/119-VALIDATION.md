---
phase: 119-loom-curated-pipelines
type: validation
authored: 2026-08-26
retroactive: true
---

# Phase 119 — Validation Strategy (RETROACTIVE)

**Written 2026-08-26, after the fact.** Like phase 117, phase 119 shipped without `PLAN.md`
files, which is why it carries no VALIDATION.md. This reconstructs the coverage map from what
was actually built and what tests actually exist.

**The honest headline: phase 119 has NO automated test coverage of its own.** It was verified
live and thoroughly — see `119-VERIFICATION.md` — but every one of those checks is a manual
probe. Nothing in the suite would catch a regression.

Every ❌ below is paired with a control proving the check discriminates, because an absence
claim is worthless otherwise.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`unit` project) + Playwright for e2e |
| **Config** | `vitest.config.ts` — `unit` covers `src/**/*.test.{ts,tsx}`, `convex/**/*.test.ts`, `hooks/**/*.test.mjs` |
| **Relevant suite command** | `npm test` |
| **Measured** | see the coverage map — no phase-119 test file exists to run |

## What phase 119 shipped

- `pipelines` + `pipelineRuns` tables; `convex/loom.ts`
- `convex/loomHttp.ts` — bearer-gated `POST /loom/event`
- `src/pages/Loom.tsx` — React Flow pipeline view with live run overlay
- `hooks/loom-emit.mjs` — the emit helper any script can drive
- `~/.claude/skills/loom` — `/loom-author` scanner (outside this repo)

## Coverage Map

| # | Behavior | Test Type | Status | Control proving the absence is real |
|---|----------|-----------|--------|--------------------------------------|
| 1 | `pipelines` / `pipelineRuns` exist and are live | manual (deploy output) | ✅ VERIFIED LIVE — `119-VERIFICATION.md` clause 1: `[+] pipelines.by_slug`, `[+] pipelineRuns.by_pipelineSlug`, `[+] pipelineRuns.by_startedAt`; live reads returned 1 pipeline / 2 runs | n/a |
| 2 | `/loom` renders the React Flow pipeline | manual live probe + e2e nav | ⚠️ PARTIAL — `e2e/navigation.spec.ts` (10/10) proves `/loom` is reachable; the render itself (3 `.react-flow__node`, 3 step testids) was a manual probe | no `src/pages/Loom.test.tsx` exists |
| 3 | Step events drive the view over Convex subscriptions | manual | ✅ VERIFIED LIVE — six real emits through `hooks/loom-emit.mjs` produced `status: error, currentStep: verify` with four events in order, then a clean second run | — |
| 4 | `convex/loom.ts` query/mutation behavior | — | ❌ **NO COVERAGE** | No test file imports `./loom`. Control: `convex/inbox.test.ts` and `convex/inboxIngest.test.ts` DO import `./inbox`, so the check finds sibling domain modules when they are tested |
| 5 | `convex/loomHttp.ts` — bearer gate on `POST /loom/event` | — | ❌ **NO COVERAGE** | The repo already documents this: `convex/studioHttp.test.ts:10` states "`convex/loomHttp.ts` ships no test file of its own (control: `convex/workspaceHttp.test.ts` exists, so the check discriminates)" |
| 6 | `src/pages/Loom.tsx` | — | ❌ **NO COVERAGE** | No `src/pages/Loom.test.tsx`; control: `src/pages/Bifrost.test.tsx` exists for the sibling phase-117 page |
| 7 | `hooks/loom-emit.mjs` | — | ❌ **NO COVERAGE** | No `hooks/*loom*.test.mjs`, despite `hooks/**/*.test.mjs` being in the `unit` project's include glob — so the glob would collect one if it existed |

## The one that carries security weight

Row 5 is the notable gap: `POST /loom/event` is **bearer-gated**, and nothing tests the gate.
This repo's own CLAUDE.md records that a bearer key on an HTTP route is not a boundary on the
underlying mutation — only an `internalMutation` is — and that `loom.ts`'s
`upsertPipeline`/`recordStepEvent` were made internal on 2026-08-11 precisely for that reason.
That hardening is therefore also untested: nothing would catch it being reverted to `mutation`.

An `internalMutation` regression is invisible in behaviour (the UI keeps working) and only
becomes observable when someone reaches the endpoint unauthenticated — the exact shape that
makes a test, rather than a probe, the right instrument.

## Nyquist verdict

**MANUAL-ONLY.** Phase 119's live verification was genuinely strong — real emits, real deploy
output, asserted on rendered content rather than absence of error — but it is entirely
non-repeatable. Sampling rate for regressions is effectively **zero**: no change to
`convex/loom.ts`, `convex/loomHttp.ts`, `src/pages/Loom.tsx` or `hooks/loom-emit.mjs` would be
caught by `npm test`.

**Recommended close, in priority order:**
1. `convex/loomHttp.test.ts` — mirror `convex/workspaceHttp.test.ts`'s `mockCtx` + `vi.stubEnv`
   pattern (that file's docstring explains why the plain handler is exported separately: an
   `httpAction`-wrapped value cannot be invoked from vitest). Assert the bearer gate rejects,
   and assert `upsertPipeline`/`recordStepEvent` are `internalMutation`.
2. `convex/loom.test.ts` — the query/mutation surface.
3. `src/pages/Loom.test.tsx` — mock `@xyflow/react` per this repo's per-file convention.
