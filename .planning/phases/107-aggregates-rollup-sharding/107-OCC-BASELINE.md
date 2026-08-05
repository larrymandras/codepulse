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

*(Sections B and C — pre-deploy traffic volume and the read-total control — are added by Task 2.)*
