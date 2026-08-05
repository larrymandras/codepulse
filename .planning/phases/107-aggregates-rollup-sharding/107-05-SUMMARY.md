---
phase: 107-aggregates-rollup-sharding
plan: 05
subsystem: infra
tags: [convex, occ, aggregates, deploy, self-hosted, live-evidence]

# Dependency graph
requires:
  - "107-03: the sharded write path, committed to the working tree — this plan pushes exactly that code to the live instance"
  - "107-04: 107-OCC-BASELINE.md ending BASELINE COMPLETE — a hard precondition, since the pre-deploy OCC evidence is unrecoverable once the push lands"
provides:
  - "107-OCC-EVIDENCE.md sections D and E: deploy output with both assertions, DEPLOY_UTC=2026-08-05T16:26:33Z, SHARD_PRESENCE=OBSERVED (all 8 values), READ_TOTALS=MATCH, POST-DEPLOY CHECK=PASS"
  - "SHARD_PRESENCE resolved as OBSERVED rather than DEFERRED — plan 107-06's human checkpoint does NOT need Larry to read shard values off the self-hosted Convex dashboard"
  - "Live confirmation that the one-draw-per-ingest contract holds in production data (zero creation-timestamps carrying more than one shard)"
affects: [107-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live deploy verification asserts BOTH halves from the CLI's own output — resolved target must contain 127.0.0.1:3210, and the push must print 'No indexes are deleted by this push'. Configuration is never accepted as evidence of target."
    - "A post-deploy read-total whose window does not contain post-deploy rows is recorded as such, not banked as proof — the evidential scope of a green check is stated explicitly alongside the check."

key-files:
  created: []
  modified:
    - .planning/phases/107-aggregates-rollup-sharding/107-OCC-EVIDENCE.md
    - convex/_generated/api.d.ts

key-decisions:
  - "Executed INLINE in the main session rather than via a gsd-executor subagent. This plan performs the only irreversible action in the phase (a push to the live production backend) and the user's deploy authorization is native to the main session; relaying that consent second-hand to a subagent is the documented failure mode where an executor correctly refuses, and it also puts the orchestrator at one remove from output it must assert on."
  - "Deployed at 88945325 while pre-flight (tsc + npm test) ran at a78bccb5. A concurrent session committed between the two. Proven safe rather than assumed: `git diff --name-only a78bccb5..HEAD -- convex src` is empty, so the deploy payload is byte-identical to the tested payload. Had that diff been non-empty, pre-flight would have been re-run."
  - "Committed the deploy-regenerated convex/_generated/api.d.ts instead of reverting it to satisfy the plan's 'git status clean' criterion. The criterion was written assuming no codegen; the real finding is that plan 107-03 added convex/lib/aggregateShard.ts without regenerating bindings, leaving that tracked file stale until this deploy fixed it. Recorded as deviation D.6."
  - "Did NOT rewrite history to repair a commit-provenance anomaly. A concurrent session's `git add`/`git commit` landed between this plan's stage and commit steps, so its commit e0f58e5e swallowed 107-OCC-EVIDENCE.md and api.d.ts. Content verified intact via `git show`; master is 72 commits ahead of origin with that session actively committing on top, so a reset --soft to re-split would risk corrupting their work to fix a cosmetic label. Documented as D.7; subsequent commits use single-command stage+commit."
  - "Read-total measured [15:00,16:00) — the most recent COMPLETE hour, which does not span DEPLOY_UTC and is in fact the identical hour 107-04 section C already measured. Recorded with its scope stated: it proves the deploy did not alter existing aggregate data (same bucket, same 146 total, before and after), but proves nothing about sharded-row folding. The mixed-state proof is deferred to 107-06 section F per that plan's own D-04."
  - "A grep-based shard extraction produced a degenerate '100 rows outside 0..7' result because the JSONL emits '\"shard\": 0' with a space. Treated as a failed probe rather than a finding, fixed to JSON.parse before any number was recorded, and the failure kept in the artifact (E.2) so the false alarm is visible."

requirements-completed: []

# Metrics
tasks: 2
commits: 2
duration: ~25 min
---

# Plan 107-05 — Deploy aggregate sharding to the self-hosted backend

```
DEPLOY_UTC: 2026-08-05T16:26:33Z
```

**Deploy assertion 1 — target: PASS.** Quoted from the CLI's own output:
`▌ └─ http://127.0.0.1:3210` and `✔ Deployed Convex functions to
http://127.0.0.1:3210`. No `.convex.cloud` host appears anywhere. (T-107-12)

**Deploy assertion 2 — non-destructive: PASS.** The push printed
`✔ No indexes are deleted by this push`, with no index reported added, removed
or rebuilt, plus `Schema validation complete.` for the additive optional `shard`
field against the existing ~1.94M rows. (T-107-13)

```
READ_TOTALS: MATCH (POST_BUCKET_TOTAL 146 == POST_RAW_EVENT_COUNT 146)
SHARD_PRESENCE: OBSERVED 8 distinct values 0,1,2,3,4,5,6,7
POST-DEPLOY CHECK: PASS
```

## Earliest time plan 107-06 may take its after-window measurement

`DEPLOY_UTC` + `WINDOW_HOURS` (2, from `107-OCC-BASELINE.md`):

```
2026-08-05T18:26:33Z   ==   14:26:33 EDT
```

Plan 107-06 must not measure before that moment. A shorter window is not a
smaller measurement — it is an invalid one, because `docker logs --since Nh`
silently truncates and the two halves would no longer be comparable.

## What plan 107-06 must reuse verbatim

| Value | Source | Note |
|---|---|---|
| `WINDOW_HOURS: 2` | 107-OCC-BASELINE.md | identical window length, non-negotiable |
| `BASELINE_RATE_PER_HOUR: 145.0` | 107-OCC-BASELINE.md | the comparator — NOT the stale 1135/24h figure |
| `BASELINE_AGGREGATES_COUNT: 290` | 107-OCC-BASELINE.md | scoped to the `aggregates` table |
| `BASELINE_INGEST_VOLUME: 244` | 107-OCC-BASELINE.md | required for the traffic-normalized comparison |
| `limit:1000` | 107-04 deviation | `limit:5000` fails with the 16MB single-execution read cap |
| `StartedAt 2026-08-05T12:45:21.334055274Z` | sections A and D | must still match, or the log stream is gone |

The honest normalized baseline is **290 retries / 244 ingested events ≈ 1.19
retries per event**. A raw-rate comparison across differently-busy windows can
manufacture an improvement out of nothing; the baseline window measured 145/hr
while a 2026-08-05 09:34 sample measured ~644/hr on the same table, so this
system's contention swings hard with traffic.

## Live shard evidence

Captured 12 minutes after the deploy, over the 100 most-recent `aggregates` rows:

- 100/100 carry `shard`; all 8 values `0..7` present
- distribution `{0:16, 1:8, 2:15, 3:16, 4:11, 5:16, 6:9, 7:9}` — plausibly
  uniform for a 100-row sample (mean 12.5)
- zero values outside integer `0..7`
- **zero creation-timestamps carrying more than one shard** — the
  one-draw-per-ingest contract from 107-01 holds in production, not just in
  `convex-test`

The pre-fix hot-document pattern (one document taking 35% of OCC lines in the
09:34 sample) is not reproduced in this distribution.

## Container continuity

`docker inspect -f '{{.State.StartedAt}}' convex-backend` returned
`2026-08-05T12:45:21.334055274Z` before the deploy, immediately after it, and at
the end of the plan — **unchanged throughout**. The push did not restart the
container, so plan 107-06's after-window is measurable from the same continuous
log stream that carries the 107-04 baseline. If that value ever changes before
107-06 runs, the before/after comparison is unrecoverable and the whole
measurement half must be redone.

## Not done, by design

`OCC-01` is **not** marked complete. Its success criterion is a live
before/after contention comparison, which is plan 107-06's job. Nothing in this
plan makes any claim about OCC contention — only that the change is live,
non-destructive, correctly sharded, and has not broken reads of existing data.
