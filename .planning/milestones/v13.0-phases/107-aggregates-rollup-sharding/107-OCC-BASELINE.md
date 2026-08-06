# Phase 107 — Pre-Deploy OCC Contention Baseline

**Purpose:** Capture the BEFORE half of the D-05 live before/after OCC-retry evidence, against
the CURRENT unsharded write path (plan 107-03's shard code exists in the working tree but has
NOT been deployed). This artifact is a hard ordering gate: plan 107-05 must not deploy until
this file exists and ends in `BASELINE COMPLETE`.

All commands below were run read-only from the `codepulse` repo root in Git Bash. No source file
was modified. No `npx convex deploy`/`import`/bulk patch/delete was run. The raw `docker logs`
capture and the `events:listRecent` scratch dumps were written to a scratch directory outside the
repo and deleted after the numbers below were derived from them (confirmed: `ls` of the scratch
dir shows no `107-04-*` files remaining).

---

## A — Pre-deploy OCC baseline

**Wall-clock timestamp of measurement:** 2026-08-05T16:10:40Z UTC (≈12:10:40 EDT)
**Commit at measurement:** `7ed669b1` (`git rev-parse --short HEAD`)

### Container uptime (both commands, cross-checked)

```
$ docker inspect -f '{{.State.StartedAt}}' convex-backend
2026-08-05T12:45:21.334055274Z

$ docker ps --filter name=convex-backend --format '{{.Status}}'
Up 3 hours (healthy)
```

Both agree: the container started at 12:45:21 UTC and the measurement was taken at 16:10:40 UTC,
so uptime is **≈3h25m** at measurement, i.e. **3 whole hours**. No discrepancy between the two
readings beyond normal Docker status-string rounding. Re-checked at the end of Task 1 and again
at the end of Task 2 (see below) — `State.StartedAt` was unchanged throughout, confirming the
container was never restarted or recreated during this plan, so the log stream is continuous.

### Chosen window

Constraints per `107-VALIDATION.md`'s corrected method: `W` must be ≤ uptime in whole hours (3);
uptime is not under 1h; uptime is not between 1–2h. Default `W = 2` applies.

```
WINDOW_HOURS: 2
```

Plan 107-06 must reuse this exact value.

### Single capture, all numbers derived from it

```
$ docker logs convex-backend --since 2h 2>&1 | grep -Ei 'occ|conflict|retry' \
    > <scratch>/107-04-occ-capture.log   # outside the repo; deleted after use
```

**Total matching lines:**
```
$ wc -l < <scratch>/107-04-occ-capture.log
298
```

**Scoped to the `aggregates` table (headline metric):**
```
$ grep -c '"aggregates" table' <scratch>/107-04-occ-capture.log
290
```
```
BASELINE_AGGREGATES_COUNT: 290
```

**Scoped-as-percentage-of-total** (visibility into out-of-scope noise, per D-02):
290 / 298 = **97.3%** of all OCC/conflict/retry lines are on the `aggregates` table; the
remaining 8 lines (2.7%) are out of scope (other tables, e.g. `discoveredTools`, matching the
2026-08-05 09:34 EDT reference sample's ~97%/3% split).

**Unscoped sanity re-check** (guard against a silently-empty scoped measurement — not needed here
since the scoped count is clearly nonzero, but run per the plan's guard requirement):
```
$ grep -Eic 'occ|conflict|retry' <scratch>/107-04-occ-capture.log
298
```
Matches the `wc -l` total exactly, confirming the capture and the count pipeline are consistent.

**Three hottest documents:**
```
$ grep -oE '[a-z0-9]{32}' <scratch>/107-04-occ-capture.log | sort | uniq -c | sort -rn | head -3
    194 td70a8dz76c9qxehafa5q778zn8bwjen
     20 td75evxd7008gs25m5cm0tswm98bx3nj
     18 td7fc7vz5hnybq46dwzx172sw58bxx8e
```
The single hottest document (`td70a8dz76c9qxehafa5q778zn8bwjen`) accounts for 194 of 290 scoped
lines — **66.9%** — an even more concentrated hot-spot than the 2026-08-05 09:34 EDT reference
sample's 35%. This is a different document ID than the reference sample's hottest doc
(`td715ppk7vphadrtfxdfhs9mq98bw8y0`), consistent with hourly bucket rollover — the "hot" row is
whichever bucket document is currently receiving concurrent writes, not a fixed document.

**Verbatim sample lines** (ANSI color codes stripped for readability; inspected for
token-shaped values per T-107-09 — none found; `instance_name="codepulse"` is a deployment label,
not a secret):
```
2026-08-05T14:12:02.764951Z ERROR isolate_worker_handle_request: common::errors: Caught occ error (RUST_BACKTRACE=1 RUST_LOG=info,common::errors=debug for full trace): Documents read from or written to the "aggregates" table changed while this mutation was being run and on every subsequent retry. Another call to this mutation changed the document with ID "td70a8dz76c9qxehafa5q778zn8bwjen". See https://docs.convex.dev/error#1 instance_name="codepulse"

2026-08-05T14:12:02.765086Z  WARN isolate_worker_handle_request: application::application_function_runner: Optimistic concurrency control failed (Documents read from or written to the "aggregates" table changed while this mutation was being run and on every subsequent retry. Another call to this mutation changed the document with ID "td70a8dz76c9qxehafa5q778zn8bwjen". See https://docs.convex.dev/error#1), retrying Udf(events.js:ingest) after 70.713013ms instance_name="codepulse"
```

Scratch capture file deleted after the above numbers were derived from it.

### Derived normalized rate

```
BASELINE_AGGREGATES_COUNT (290) / WINDOW_HOURS (2) = 145.0
BASELINE_RATE_PER_HOUR: 145.0
```

For context only (not used as a comparator, per Deviation note below): 145.0/hour projects to
~3,480/24h — well above the un-comparable `1135/24h` figure in D-05's original text, and below
the 2026-08-05 09:34 EDT reference sample's ~644/hour. Both this measurement and the reference
sample are pre-deploy (unsharded) readings taken on different days at different traffic levels;
the rate itself varies with concurrent session volume, which is exactly why plan 107-06 must
compare against *this* baseline's rate, not the 09:34 reference sample's rate.

### Deviation from D-05 as written

D-05's literally-stated command (`docker logs convex-backend --since 24h | grep -Ei 'occ|conflict|retry' | wc -l`, compared against a stored `1135/24h` figure) was **not used**. `--since 24h` cannot return 24h of data on a container whose uptime is only 3h25m — it silently truncates to the uptime window, which would manufacture a false "improvement" if run again post-deploy at a longer uptime. Separately, `1135/24h` implies ~47/hour, while every live measurement to date (this one at 145.0/hour, the 09:34 EDT reference sample at ~644/hour) is far higher on a like-for-like basis, so comparing a post-fix number against `1135` would flatter the result regardless of whether sharding actually worked. This artifact instead uses the corrected method from `107-VALIDATION.md`: an explicit, uptime-bounded window (`WINDOW_HOURS`), scoped to the `aggregates` table, normalized to a per-hour rate.

### End-of-Task-1 uptime re-check

```
$ docker inspect -f '{{.State.StartedAt}}' convex-backend
2026-08-05T12:45:21.334055274Z
```
Unchanged from the value recorded at the start of this task.

`git status --porcelain convex src` — empty. No source file was modified. Nothing was deployed.

---

## B — Pre-deploy traffic volume

Using the same `WINDOW_HOURS = 2` from Section A, `lookbackDays = 2/24 = 0.08333333333333333`.

```
$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.08333333333333333}'
{
  "PostToolUse": 189,
  "PostToolUseFailure": 2,
  "PreToolUse": 23,
  "Stop": 9,
  "SubagentStart": 4,
  "SubagentStop": 11,
  "UserPromptSubmit": 6
}
```

Sum: 189 + 2 + 23 + 9 + 4 + 11 + 6 = **244**

```
BASELINE_INGEST_VOLUME: 244
```

Non-empty, non-zero, varied per-event-type breakdown — no liveness guard needed, but the
deployment-target check below was run anyway per the plan's explicit instruction.

**Deployment-target confirmation:** the plan requires confirming a bare `npx convex run` resolves
to the self-hosted instance at `http://127.0.0.1:3210`, not a `.convex.cloud` host. Re-ran the
identical query with an explicit `--url` immediately after:
```
$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.08333333333333333}' --url http://127.0.0.1:3210
{
  "PostToolUse": 190,
  "PostToolUseFailure": 2,
  "PreToolUse": 23,
  "Stop": 9,
  "SubagentStart": 4,
  "SubagentStop": 11,
  "UserPromptSubmit": 6
}
```
190 vs 189 (+1 `PostToolUse`, ~40 seconds apart) is consistent with ordinary live-traffic drift
between the two calls, not a different backend. Confirms the bare `npx convex run` used above
resolved to the same self-hosted `127.0.0.1:3210` instance — no STOP condition triggered.

---

## C — Pre-deploy read-total control

Same `WINDOW_HOURS = 2`, but this control targets the single most recent **complete** hour rather
than the full window, per the plan's method (isolates one hour via two `eventCountsByPeriod`
calls whose difference cancels out everything before `H0`).

```
NOW = 1785946310   (2026-08-05T16:11:50Z, epoch seconds at time of this calculation)
H0  = floor(NOW/3600)*3600 - 3600 = 1785942000   (2026-08-05T15:00:00Z)
H1  = H0 + 3600                   = 1785945600   (2026-08-05T16:00:00Z)
LOOKBACK_A = (NOW - (H0 - 60)) / 86400 = 0.0505787037037037
LOOKBACK_B = (NOW - (H1 - 60)) / 86400 = 0.008912037037037038
```

```
$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.0505787037037037}'
{
  "PostToolUse": 192,
  "PostToolUseFailure": 2,
  "PreToolUse": 23,
  "Stop": 9,
  "SubagentStart": 4,
  "SubagentStop": 11,
  "UserPromptSubmit": 6
}
```
A = 192 + 2 + 23 + 9 + 4 + 11 + 6 = **247**

```
$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.008912037037037038}'
{
  "PostToolUse": 86,
  "PostToolUseFailure": 2,
  "PreToolUse": 4,
  "Stop": 3,
  "SubagentStart": 1,
  "SubagentStop": 4,
  "UserPromptSubmit": 1
}
```
B = 86 + 2 + 4 + 3 + 1 + 4 + 1 = **101**

```
BUCKET_TOTAL = A - B = 247 - 101 = 146
```

Not negative, not implausible — no re-run needed.

### Raw event count for the same hour

**Deviation encountered and resolved:** the plan's literal `{"limit":5000}` call **failed**, not
a plan-text assumption but a directly observed error — recorded here because plan 107-06 must
reuse a working limit, not this one:
```
$ npx convex run events:listRecent '{"limit":5000}'
✖ Failed to run function "events:listRecent":
Error: [Request ID: 8eb9e89c9a911670] Server Error
Uncaught Error: Too many bytes read in a single function execution (limit: 16777216 bytes).
```
Retried at descending limits: `3000` and `2000` failed identically; `1500` returned only a `WARN`
(13,565,764 of 16,777,216 bytes — near the cap, response not cleanly parseable); `1000` succeeded
cleanly:
```
$ npx convex run events:listRecent '{"limit":1000}'
[ ...1000 event documents... ]
```

**Coverage guard:** minimum `timestamp` among the 1000 returned rows is **1785938190**
(2026-08-05T14:16:30Z), which is strictly less than `H0` (1785942000 / 15:00:00Z) — **guard
PASSED** on the first working limit (1000); no further retry needed once `5000`→`1000` resolved.

Counting rows with `H0 <= timestamp < H1`:
```
RAW_EVENT_COUNT: 146
```

### Comparison

```
BUCKET_TOTAL   = 146
RAW_EVENT_COUNT = 146
```

**Exact match.** The read-total spot-check technique is proven working pre-deploy: the two
independent derivations (aggregate-bucket arithmetic vs. a raw scan of `events` rows) agree
exactly for the same hour. Two caveats recorded explicitly, not left implicit:
- `listRecent` excludes rows with `archived === true` — nothing should be archived within the
  last complete hour, and the exact match confirms nothing was.
- `events.ingest` deduplicates on `idempotencyKey`, so one aggregate bucket increment corresponds
  to exactly one stored `events` row — this is why a 1:1 match (rather than some multiple) is the
  expected honest outcome, not a coincidence.

Since they match pre-deploy, there is no discrepancy to record for plan 107-06 to account for —
a future mismatch post-deploy would be attributable to the sharding change or a genuine bug, not
to a pre-existing measurement artifact.

---

## Machine-readable summary

```
WINDOW_HOURS: 2
BASELINE_AGGREGATES_COUNT: 290
BASELINE_RATE_PER_HOUR: 145.0
BASELINE_INGEST_VOLUME: 244
BUCKET_TOTAL: 146
RAW_EVENT_COUNT: 146
```

## Final container-uptime re-check (end of plan)

```
$ docker inspect -f '{{.State.StartedAt}}' convex-backend
2026-08-05T12:45:21.334055274Z
```
Unchanged from the value recorded at the start of Task 1 — the container was not restarted or
recreated at any point during this plan's execution.

`git status --porcelain convex src` — empty throughout. No source file was modified. Nothing was
deployed.

BASELINE COMPLETE — safe to deploy (plan 107-05)
