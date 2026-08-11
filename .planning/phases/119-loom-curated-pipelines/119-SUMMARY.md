---
phase: 119-loom-curated-pipelines
plan: 01
subsystem: fullstack

tags: [convex, react-flow, pipelines, skill, seidr-suite]

requires: []
provides:
  - "pipelines + pipelineRuns tables, convex/loom.ts, bearer-gated POST /loom/event"
  - "src/pages/Loom.tsx — React Flow pipeline view with live run overlay"
  - "hooks/loom-emit.mjs — the emit helper any script can drive"
  - "~/.claude/skills/loom — /loom-author scanner + reasoning layer"
affects: []

tech-stack:
  added: []
  patterns:
    - "Step state as a pure function (src/lib/loomStepState.ts), not inlined in the node: it is the one place a live run can lie about itself."
    - "Sticky error at both levels — per step and per run. A step retried to green still renders errored, because that is the only visible trace something went wrong."

key-files:
  created:
    - convex/loom.ts
    - convex/loomHttp.ts
    - convex/__tests__/loom.test.ts
    - hooks/loom-emit.mjs
    - src/lib/loomStepState.ts
    - src/lib/loomStepState.test.ts
    - src/hooks/useLoom.ts
    - src/components/loom/LoomStepNode.tsx
    - src/pages/Loom.tsx
    - "C:/Users/mandr/.claude/skills/loom/SKILL.md"
    - "C:/Users/mandr/.claude/skills/loom/scripts/loom-scan.mjs"
  modified:
    - convex/schema.ts
    - convex/http.ts
    - convex/ingestAuth.ts
    - src/lib/navRegistry.ts
    - src/App.tsx
    - e2e/navigation.spec.ts

key-decisions:
  - "D-02 live mode is HTTP emit, no WebSocket layer"
  - "D-03/D-04 emit route bearer-gated, fail-closed, no CORS or OPTIONS partner"
  - "D-05 stepEvents bounded at 200, keeping the NEWEST"
  - "D-06 unknown pipelineSlug is a 404 refusal, never an implicit create"
  - "D-07 Loom is now the only live-progress surface, because Phase 111 is turning Mission Board into post-hoc history"
  - "D-08 Ástríðr cron lens deferred, per the design doc's own deferral to v29 A3"

requirements-completed: []

duration: ~2h
completed: 2026-08-11
---

# 119: Loom Curated Pipelines

Three commits: backend (`73816fb1`), frontend + emit helper (`b24282f8`), and
the skill in the config repo (`0a5087f`, pushed).

## The design doc's gate, closed end to end

> One real pipeline authored renders with per-step docs; a live run driven by
> real emits animates start→complete on every step; an error event renders
> distinctly — **control: a clean run shows no error styling.**

Driven with the real `hooks/loom-emit.mjs` against the live backend:

| Run | Rendered step testids | Run row |
|---|---|---|
| Errored run | `["loom-step-complete","loom-step-error","loom-step-pending"]` | `loom-run-error` |
| Clean run (control) | `["loom-step-complete","loom-step-complete","loom-step-complete"]` | `loom-run-complete` |

Same pipeline, same view, same components — only the run differs. The error
renders distinctly *alongside* a complete and a pending step in the first case,
and **vanishes entirely** in the second. That is the control the gate asks for.

## Auth and refusal, control-paired

| Probe | Result |
|---|---|
| `POST /loom/event` no auth | 401 |
| bogus bearer | 401 |
| **real bearer** | **200** |
| unknown `pipelineSlug` | **404** — and `listPipelines` still returns 1, so nothing was auto-created |
| `OPTIONS /loom/event` vs control `/preflight-ingest` | **404 vs 204** |

The 401s were measured before `LOOM_API_KEY` existed and the 200 after Larry set
it, so the pair is a real before/after rather than two readings of the same
state.

## Mutation testing

| Mutation | Result |
|---|---|
| keep OLDEST events instead of newest | 1 of 10 fails |
| make run-level `error` non-sticky | 1 of 10 fails |
| step `error` no longer outranks `complete` | 3 of 11 fail |
| `pending` given a status colour | 1 of 11 fails |

Every error assertion is paired with a clean-run control, so a function that
always returned `error` could not pass.

## Gates

`npx tsc --noEmit` exit 0 · `npx vitest run` **298 files, 3947 passed, 0
failures** · `e2e/navigation.spec.ts` 10/10 · `npx convex deploy` →
`127.0.0.1:3210`, no indexes deleted, 3 added.

## Things the work corrected

**The workflow files are `.js`, not `.mjs`.** The design doc's prose implies
`.mjs`; an `*.mjs`-only glob matches zero files. Caught because my first meta
grep returned nothing. The scanner globs both.

**A backtick in a `git commit -m` message was executed by bash**, silently
deleting a word from the skill commit's message. Caught by reading the committed
message rather than trusting the exit code, then repaired with `--amend -F`
after asserting HEAD was still my own commit.

**Two of my own probes were wrong before the code was.** An "all zeros" step
count was a missing `waitFor`, not a regression; and a `Runs (` marker read
false because `innerText` reflects CSS `text-transform: uppercase`. Both were
measurement bugs, and I checked before reporting either as a defect.

## Gaps — stated, not buried

1. **The seeded `review-verify` card has 3 steps; the workflow declares 2.** I
   hand-seeded `review → verify → report` before the scanner existed;
   `loom-scan.mjs` correctly proposes `Review → Verify` from the real `meta`.
   The card is richer than its source. Re-author it with `/loom-author` to make
   the two agree, or keep the extra step deliberately.
2. **`LOOM_API_KEY` is set on the backend but NOT as a user-level env var**
   (step 5 of the setup was not run; confirmed by probe, with `GALDR_API_KEY` as
   the control proving the probe works). Emits therefore need the key passed
   explicitly until that is done.
3. **D-08 deferrals:** the Ástríðr cron lens and manual in-UI authoring.
4. **No e2e spec for `/loom` beyond the nav test.** The live gate was verified
   by direct probe rather than a committed spec, so it is not guarded against
   regression the way `/bifrost` and `/galdr` are.
