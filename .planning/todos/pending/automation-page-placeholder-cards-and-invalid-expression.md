---
id: TODO-automation-page-placeholder-cards-and-invalid-expression
status: pending
planted: 2026-08-21
planted_during: Phase 124 — operator hit it during the 124-11 checkpoint while visiting /automation, one of the five routes that moved domain in the regroup
trigger_when: Next Automation- or cron-touching phase. Cosmetically severe (every schedule reads as broken) but no evidence yet that the crons themselves are failing — that is the first thing to establish.
scope: Unknown until investigated — two symptoms, plausibly one cause, not established
source: src/pages/Automation.tsx; observed live on /automation
resolves_phase: null
last_reviewed: 2026-08-21
---

# `/automation` — 3 of 4 stat cards never resolve, all 12 schedules read "Invalid expression"

## What was observed (2026-08-21, live, operator screenshot)

Two distinct symptoms on one page:

**1. Stat cards.** Four tiles across the top. The first renders correctly —
`CONFIGURED SCHEDULES / 12`. The other three render as **purple skeleton placeholder
bars** that never resolve into values.

**2. Every cron row says "Invalid expression".** All twelve schedules render their
interval followed by that string:

```
stale sessions            Every 5 min    Invalid expression
alert evaluation          Every 1 min    Invalid expression
metric rollup             Every 5 min    Invalid expression
docker poll               Every 2 min    Invalid expression
supabase poll             Every 1 hour   Invalid expression
llm cost rollup           Every 10 min   Invalid expression
stale agents              Every 10 min   Invalid expression
profile summary           Every 15 min   Invalid expression
memory prune              Daily          Invalid expression
purge old telemetry events Daily 03:00 UTC Invalid expression
```

Note the interval text ("Every 5 min", "Daily 03:00 UTC") renders correctly *beside* the
error, so the page has the schedule data — something downstream of that is failing to
parse or format it.

## NOT caused by Phase 124

`git log --grep="(124-" -- src/pages/Automation.tsx` returns **0 commits**. The regroup
moved this page into the System domain, which is how the operator came to open it.

## NOT INVESTIGATED

No root cause established. Deliberately not guessed. Two things worth checking first:

1. **Is this display-only, or are the crons actually not running?** That is the question
   that sets the severity, and it is answerable without touching the page — check whether
   the jobs have recent execution records. A page that renders "Invalid expression" over
   healthy crons is cosmetic; a page correctly reporting that twelve schedules failed to
   parse is an outage.
2. **Are the two symptoms one cause or two?** The three dead tiles suggest queries that
   never resolve; the parse errors suggest a formatter. They may be independent. Do not
   assume one fix covers both — and if they *are* one cause, the tile that DOES render is
   the control that tells you which input differs.

## Cheap first probe

Enumerate the distinct values actually reaching the formatter before assuming what shape
it expects. A hand-written expectation about the cron-expression format is a claim about
the parser, not about the data.
