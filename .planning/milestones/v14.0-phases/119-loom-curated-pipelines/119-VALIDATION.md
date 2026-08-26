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

**The honest headline as first written: phase 119 had NO automated test coverage of its own.**
It was verified live and thoroughly — see `119-VERIFICATION.md` — but every one of those checks
is a manual probe.

**Partly closed the same day.** The security-weighted endpoint (`POST /loom/event`) is now
covered by `convex/loomHttp.test.ts`. Three of the four gaps remain — see the map and the
remaining-work list.

Every ❌ below is paired with a control proving the check discriminates, because an absence
claim is worthless otherwise.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`unit` project) + Playwright for e2e |
| **Config** | `vitest.config.ts` — `unit` covers `src/**/*.test.{ts,tsx}`, `convex/**/*.test.ts`, `hooks/**/*.test.mjs` |
| **Relevant suite command** | `npm test` |
| **Measured** | `npx vitest run convex/loomHttp.test.ts` — **13 passed** (added 2026-08-26). The other three gaps still have no file to run |

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
| 5 | `convex/loomHttp.ts` — bearer gate on `POST /loom/event` | unit | ✅ **CLOSED 2026-08-26** — `convex/loomHttp.test.ts`, 13 tests | Gap found by this audit and closed in the same pass |
| 6 | `src/pages/Loom.tsx` | — | ❌ **NO COVERAGE** | No `src/pages/Loom.test.tsx`; control: `src/pages/Bifrost.test.tsx` exists for the sibling phase-117 page |
| 7 | `hooks/loom-emit.mjs` | — | ❌ **NO COVERAGE** | No `hooks/*loom*.test.mjs`, despite `hooks/**/*.test.mjs` being in the `unit` project's include glob — so the glob would collect one if it existed |

## The one that carried security weight — now closed

Row 5 WAS the notable gap: `POST /loom/event` is **bearer-gated**, and nothing tested the gate.
This repo's own CLAUDE.md records that a bearer key on an HTTP route is not a boundary on the
underlying mutation — only an `internalMutation` is — and that `loom.ts`'s
`upsertPipeline`/`recordStepEvent` were made internal on 2026-08-11 precisely for that reason.
That hardening was therefore also untested: nothing would have caught it being reverted to `mutation`.

An `internalMutation` regression is invisible in behaviour (the UI keeps working) and only
becomes observable when someone reaches the endpoint unauthenticated — the exact shape that
makes a test, rather than a probe, the right instrument.

**CLOSED 2026-08-26.** `convex/loomHttp.test.ts` (13 tests) drives the plain handler with a
mock ctx and a real `Request`, mirroring `workspaceHttp.test.ts`. It asserts the gate rejects
missing and wrong tokens, ACCEPTS a correct one (the control proving the 401s discriminate),
and honours the `LOOM_ALLOW_ANON` fallback. Critically it also asserts the handler **does not
touch the database** on an unauthenticated request — a 401 status alone would not prove D-03's
actual claim that "an unauthenticated emit must not be able to probe which pipelines exist",
since the handler could have queried first and returned 401 afterwards.

The `internalMutation` hardening is guarded two ways: a `getFunctionName` identity check that
the handler routes through `internal.loom.recordStepEvent`, plus a source-level assertion that
BOTH `recordStepEvent` and `upsertPipeline` are `internalMutation` and that `loom.ts` exposes
**zero** public mutations — the reference check alone would not catch a public twin, nor
`upsertPipeline` (which this endpoint never calls) being opened up.

**Mutation-proven both ways:** deleting the bearer gate fails 4 tests; changing
`recordStepEvent` to a public `mutation` fails the source guard.

## Nyquist verdict

**MANUAL-ONLY, IMPROVED.** The security-weighted endpoint is now covered (row 5). Phase 119's live verification was genuinely strong — real emits, real deploy
output, asserted on rendered content rather than absence of error — but it is entirely
non-repeatable. Regression sampling is now **partial**: a change to `convex/loomHttp.ts` or to
the `internalMutation` hardening in `convex/loom.ts` IS caught by `npm test`, but a change to
`convex/loom.ts`'s query surface, `src/pages/Loom.tsx` or `hooks/loom-emit.mjs` still is not.

**Remaining, in priority order:**
1. ~~`convex/loomHttp.test.ts`~~ — **DONE 2026-08-26**, 13 tests, mutation-proven.
2. `convex/loom.test.ts` — the query/mutation surface. Still uncovered.
3. `src/pages/Loom.test.tsx` — mock `@xyflow/react` per this repo's per-file convention.
   Still uncovered.
4. `hooks/loom-emit.mjs` — still uncovered, though `hooks/**/*.test.mjs` is already in the
   `unit` project's include glob, so a test file would be collected the moment one exists.
