# Phase 107 — OCC Evidence (post-deploy)

Companion to `107-OCC-BASELINE.md`. Section D and E are written by plan 107-05;
sections F0, F and G are written by plan 107-06.

Executed inline in the main session (not via a subagent), because this plan
performs the only irreversible action in the phase — a push to the live
self-hosted production backend — and the user's deploy authorization is native
to that session rather than relayed second-hand.

---

## D — Deploy

### D.0 Gate — baseline must exist and be complete

```
$ grep -E '^BASELINE (COMPLETE|BLOCKED)' .planning/phases/107-aggregates-rollup-sharding/107-OCC-BASELINE.md
BASELINE COMPLETE — safe to deploy (plan 107-05)
```

GATE: **PASS** — the pre-deploy evidence exists and is complete, so the
destroy-on-read baseline is safe from this deploy.

Values inherited from the baseline, which plan 107-06 must reuse verbatim:

```
WINDOW_HOURS: 2
BASELINE_AGGREGATES_COUNT: 290
BASELINE_RATE_PER_HOUR: 145.0
BASELINE_INGEST_VOLUME: 244
BUCKET_TOTAL: 146 == RAW_EVENT_COUNT: 146
```

### D.1 Pre-flight

Working tree clean for the deploy payload:

```
$ git status --porcelain convex src
(no output)
```

Type check:

```
$ npx tsc --noEmit
tsc exit code: 0
```

Full test suite:

```
$ npm test
 Test Files  276 passed | 17 skipped (293)
      Tests  3446 passed | 193 todo (3639)
   Duration  51.46s
```

Container state before the push:

```
$ docker ps --filter name=convex-backend --format '{{.Status}}'
Up 4 hours (healthy)

$ docker inspect -f '{{.State.StartedAt}}' convex-backend
2026-08-05T12:45:21.334055274Z
```

`StartedAt` matches the value recorded by plan 107-04 exactly, so the log stream
carrying the baseline is continuous and the before/after comparison is valid.

### D.2 Commit being deployed — and a concurrent-session caveat

This checkout is shared with another active Claude Code session, which committed
between the pre-flight above and the deploy below. Both hashes are recorded
rather than papering over the move:

```
$ git rev-parse --short HEAD    # at pre-flight (tsc + npm test ran against this)
a78bccb5

$ git rev-parse --short HEAD    # at deploy
88945325

$ git log --oneline a78bccb5..HEAD
88945325 docs(106-07): record live voice UAT — wake, barge-in, re-arm all PASS

$ git diff --name-only a78bccb5..HEAD -- convex src
(no output)
```

The intervening commit is documentation-only for phase 106 and touches nothing
under `convex/` or `src/`. The deploy payload at `88945325` is therefore
byte-identical to the payload that was type-checked and fully tested at
`a78bccb5`, so T-107-15 (deploy of untested code) is not violated. Had that diff
been non-empty, the pre-flight would have been re-run before pushing.

### D.3 Deploy output (verbatim)

```
$ npx convex deploy --yes
▌ Deploying code to deployment:
▌ └─ http://127.0.0.1:3210
- Deploying to http://127.0.0.1:3210...

✔ No indexes are deleted by this push
Uploading functions to Convex...
Generating TypeScript bindings...
Running TypeScript...
Pushing code to your Convex deployment...
Schema validation complete.
Finalizing push...
✔ Deployed Convex functions to http://127.0.0.1:3210

EXIT CODE: 0
```

The captured output was scanned for token-shaped values before being pasted
(`grep -icE 'sb_|eyJ|admin.?key|bearer'` returned `0`), so nothing required
redaction.

### D.4 Deploy assertions

**ASSERTION 1 — target is the self-hosted instance: PASS**
Quoted from the CLI's own output, not from configuration:
`▌ └─ http://127.0.0.1:3210` and `✔ Deployed Convex functions to http://127.0.0.1:3210`.
No `.convex.cloud` host appears anywhere in the output. T-107-12 mitigated.

**ASSERTION 2 — push is non-destructive to indexes: PASS**
The output contains the literal string `✔ No indexes are deleted by this push`.
No index is reported as added, removed, or rebuilt anywhere in the output.
T-107-13 mitigated — this is the mechanism behind the 2026-07-21/22 outage.

**Supporting — schema accepted against existing rows:** `Schema validation
complete.` The `shard` field was pushed as `v.optional(v.float64())`, so the
~1.94M pre-existing rows validate unchanged. No `--replace-all`, no
`convex import`, no bulk patch and no bulk delete was run at any point
(T-107-14 mitigated).

```
DEPLOY_UTC: 2026-08-05T16:26:33Z
```

### D.5 Post-deploy liveness

Elapsed since `DEPLOY_UTC`: 55 seconds (recorded honestly — the plan says wait
60s; the query was issued at `2026-08-05T16:27:28Z`). The check is a
non-emptiness probe and it passed, so the 5-second shortfall changes nothing;
the container-state half is re-confirmed below and again in section E.

```
$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.05}'
{
  "PostToolUse": 185,
  "PostToolUseFailure": 7,
  "PreToolUse": 14,
  "Stop": 10,
  "SubagentStart": 1,
  "SubagentStop": 7,
  "UserPromptSubmit": 10
}
```

Non-empty, so the CLAUDE.md "dashboard-wide no-data means index rot or memory
starvation until proven otherwise" branch does not apply and `docker stats` was
not needed.

```
$ docker ps --filter name=convex-backend --format '{{.Status}}'
Up 4 hours (healthy)

$ docker inspect -f '{{.State.StartedAt}}' convex-backend
2026-08-05T12:45:21.334055274Z
```

`StartedAt` is **unchanged** across the entire deploy — the push did not restart
the container, so plan 107-06's after-window is measurable from the same
continuous log stream as the baseline.

### D.6 Deviation from the plan's acceptance criteria

The plan asserts `git status --porcelain convex src` is empty after the deploy.
It is **not**, and the reason is benign and worth recording rather than
suppressing:

```
$ git status --porcelain convex src
 M convex/_generated/api.d.ts

$ git diff convex/_generated/api.d.ts
+import type * as lib_aggregateShard from "../lib/aggregateShard.js";
+  "lib/aggregateShard": typeof lib_aggregateShard;
```

`npx convex deploy` runs `Generating TypeScript bindings...`, which regenerated
this tracked file to register the new `convex/lib/aggregateShard.ts` module added
by plan 107-03. The change is purely additive — two lines, mirroring the existing
`lib/providers` and `lib/sankeyClassify` entries — and contains no logic.

The real finding is that **plan 107-03 added a module under `convex/lib/` without
regenerating the bindings**, so the committed generated file was stale from
107-03 until this deploy corrected it. Rather than reverting the file to
re-satisfy a criterion that was written assuming no codegen, it is committed with
this plan so the repo's generated bindings match the deployed reality. No
hand-written source file was modified by this plan.

### D.7 Commit-provenance anomaly (concurrent session)

Both files above (`107-OCC-EVIDENCE.md` and `convex/_generated/api.d.ts`) are
committed, but **not under a `107-05` commit message**. They landed inside
commit `e0f58e5e docs(106-07): add plan summary, tick ROADMAP to 6/8`, which
belongs to a different Claude Code session working phase 106 in this same
checkout.

Mechanism: `git add` followed by `git commit` is not atomic in a shared
checkout. The other session ran its own `git add`/`git commit` in the window
between this plan's stage and commit steps, so its commit swept up the staged
files; the subsequent `git commit -F` here reported `nothing added to commit`.

Assessed and deliberately NOT repaired:

- Content integrity is intact. `git show HEAD:...107-OCC-EVIDENCE.md` is the
  full 206-line artifact including `DEPLOY_UTC: 2026-08-05T16:26:33Z` at line
  142, and `git show HEAD:convex/_generated/api.d.ts` contains both
  `lib_aggregateShard` lines. Nothing was lost or altered.
- History was NOT rewritten. `master` is 72 commits ahead of `origin/master`
  and the other session is actively committing on top of `e0f58e5e`. A
  `reset --soft` to re-split the commit would rewrite a commit that session may
  already have built on — the documented failure mode this project has been
  burned by before. A wrong commit label is a far smaller cost than corrupting
  another session's work.

Consequence to be aware of: a phase-107 `undo` keyed on commit messages will not
match these two files, because they carry a `106-07` subject. That is acceptable
— an evidence artifact is not something a phase revert should be undoing anyway.

Mitigation applied for the remainder of this plan: staging and committing are
issued as a single shell command so the race window is milliseconds rather than
seconds, and every commit is followed by a `git show --stat HEAD` check.

---

## E — Post-deploy shard presence and read totals

### E.1 Shard presence — OBSERVED

The CLI subcommand was confirmed to exist before the check was designed around
it, rather than assumed:

```
$ npx convex data --help
Usage: convex data [options] [table]
Inspect your Convex deployment's database.
  --limit <n>    List only the `n` the most recently created documents. (default: 100)
  --order <choice>  (choices: "asc", "desc", default: "desc")
  --format <format>  ... jsonArray (aka json) ...
```

So `SHARD_PRESENCE` is OBSERVED, not DEFERRED — plan 107-06's human checkpoint
does NOT need Larry to read shard values off the self-hosted dashboard.

Captured 12 minutes after `DEPLOY_UTC` (at `2026-08-05T16:38:42Z`), which is past
the plan's 10-minute minimum, so live ingest had time to write sharded rows:

```
$ npx convex data aggregates --limit 100 --order desc --format jsonl
```

Parsed with a real JSON parser (see the caveat in E.2 below):

```
rows returned: 100
rows WITH shard: 100 | WITHOUT (legacy, expected): 0
distinct shard values: 0, 1, 2, 3, 4, 5, 6, 7
distribution: {"0":16,"1":8,"2":15,"3":16,"4":11,"5":16,"6":9,"7":9}
values outside integer 0..7: 0
creation-timestamps with MORE THAN ONE shard (contract violation): 0
```

```
SHARD_PRESENCE: OBSERVED 8 distinct values 0,1,2,3,4,5,6,7
```

Three things this establishes beyond mere presence:

1. **All 8 shards are in use** and the distribution is plausibly uniform for a
   100-row sample of a uniform draw over 8 buckets (mean 12.5; observed 8..16).
   The pre-fix hot-document pattern — one document taking 35% of all OCC lines
   in the 2026-08-05 09:34 sample — is not reproduced here.
2. **Every value is an integer in `0..7`**, matching `AGGREGATE_SHARD_COUNT = 8`.
3. **The one-draw-per-ingest contract holds in live production data.** Rows
   sharing a `_creationTime` always share a shard — zero timestamps carry more
   than one shard value. This is the live counterpart of the unit-test contract
   plan 107-01 wrote and plan 107-03 satisfied, and it is the assertion that
   would have caught a `pickShard()` call misplaced *inside* a shared helper.

All 100 most-recent rows carry `shard`, so no legacy unsharded row appears in
this sample. Older rows without the field remain expected and correct under
D-04; they are simply outside a 100-row most-recent window on a busy table.

### E.2 A failed probe, recorded rather than buried

The first extraction attempt used `grep -o '"shard":[0-9]*'` and reported
`values outside 0..7: 100` — i.e. every row invalid. That was a broken probe,
not a broken system: the JSONL emits `"shard": 0` with a space after the colon,
so the pattern matched `"shard":` with zero digits and produced 100 empty
strings. A result that degenerate is a failure signal, so the probe was fixed
(switched to `JSON.parse`) before any number was recorded. Noted here because a
regex-derived "all rows invalid" would otherwise have been an alarming and
entirely false finding.

### E.3 Read-total spot-check

Window, computed from the clock at `2026-08-05T16:39:47Z` (`NOW=1785947987`):

```
H0 = floor(NOW/3600)*3600 - 3600 = 1785942000   (2026-08-05T15:00:00Z)
H1 = H0 + 3600                   = 1785945600   (2026-08-05T16:00:00Z)
LOOKBACK_A = (NOW - (H0 - 60)) / 86400 = 0.06998842592592593
LOOKBACK_B = (NOW - (H1 - 60)) / 86400 = 0.02832175925925926
```

```
$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.06998842592592593}'
{ "PostToolUse": 366, "PostToolUseFailure": 8, "PreToolUse": 42, "Stop": 25,
  "SubagentStart": 5, "SubagentStop": 17, "UserPromptSubmit": 23 }        -> A = 486

$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.02832175925925926}'
{ "PostToolUse": 260, "PostToolUseFailure": 8, "PreToolUse": 23, "Stop": 19,
  "SubagentStart": 2, "SubagentStop": 10, "UserPromptSubmit": 18 }        -> B = 340

POST_BUCKET_TOTAL = A - B = 486 - 340 = 146
```

Raw event count over the same hour. Per plan 107-04's finding, `limit:5000`
fails on this dataset with "Too many bytes read in a single function execution
(limit: 16777216 bytes)", so `limit:1000` is used:

```
$ npx convex run events:listRecent '{"limit":1000}'
events returned: 1000
POST_RAW_EVENT_COUNT [H0,H1): 146
min timestamp: 1785939473 (2026-08-05T14:17:53Z)
coverage guard (min < H0): PASS
```

```
POST_BUCKET_TOTAL: 146
POST_RAW_EVENT_COUNT: 146
READ_TOTALS: MATCH
```

Caveats restated rather than left implicit: `listRecent` excludes rows with
`archived === true` (nothing is archived within this window), and
`events.ingest` deduplicates on `idempotencyKey`, so one bucket increment
corresponds to exactly one stored row.

### E.4 What this read-total does and does NOT prove

**The measured hour does NOT span `DEPLOY_UTC`.** `DEPLOY_UTC` is
`1785947193` (16:26:33Z), which falls inside the *current, still-incomplete*
hour `[16:00, 17:00)`. The most recent COMPLETE hour at measurement time was
`[15:00, 16:00)`, entirely pre-deploy.

Worse for its evidential value: this is the **identical hour** plan 107-04's
section C control already measured (`H0 = 1785942000`, `H1 = 1785945600`), which
also returned `146 == 146`.

So this check must not be read as proof that the sharded write path folds
correctly. It cannot be — the bucket contains no sharded rows, and 107-03
changed only the write path while leaving every reader untouched (a fact plan
107-02 proved with 7 executable guards).

What it does prove, and this is not nothing:

- **The deploy did not alter, rewrite or damage existing aggregate data.** The
  same bucket returns the same total before and after the push — 146 both times,
  from independent query runs. That is direct evidence for T-107-14 (no bulk
  mutation of the ~1.94M existing rows) measured against live data rather than
  inferred from the absence of an import command.
- The read-total technique still executes correctly against the post-deploy
  deployment, with its coverage guard satisfied.

**The mixed-state proof is deferred to plan 107-06**, which is where it belongs
by that plan's own D-04 ("A read-total spot-check is re-run alongside the rate
comparison so a mixed sharded/unsharded bucket is proven to still total
correctly"). By 107-06's measurement time every complete hour since 16:00Z
contains sharded rows, so its re-run covers the case this one structurally
cannot.

Recording a MATCH here without this distinction would have been precisely the
kind of false-green this phase was designed to refuse.

```
POST-DEPLOY CHECK: PASS
```

PASS is justified on: both deploy assertions green, shard presence OBSERVED with
all 8 values and no contract violation in live data, existing-data totals
unchanged across the deploy, and no regression against the pre-deploy control.
It is explicitly NOT a claim about OCC contention — that verdict is plan
107-06's, and OCC-01 remains open.

---

## F0 — After-window gate

Blocking human-verify checkpoint (plan 107-06, Task 1). Executed **inline in the
main session**, not via a subagent: the gate turns on Larry's live observation of
the running dashboard and his characterization of traffic, and that approval is
native to this session rather than relayable second-hand.

No `docker logs --since` measurement command was run in this task. The
after-window measurement is Task 2 and did not begin until this gate cleared.

### F0.1 Elapsed time since deploy

```
DEPLOY_UTC : 2026-08-05T16:26:33Z   (epoch 1785947193, from section D.4)
NOW        : 2026-08-05T19:22:48Z   (epoch 1785957768, `date -u`)
ELAPSED    : 1785957768 - 1785947193 = 10575 s = 2.9375 h  (2h 56m 15s)
WINDOW_HOURS (from 107-OCC-BASELINE.md § A): 2
```

**Unit sanity line** (a threshold check that passes by accident reads identically
to one that passes correctly): the two epoch values format to 19:22:48Z and
16:26:33Z, whose wall-clock difference is 2h56m15s — exactly the 10,575 s the
subtraction gives. These are epoch **seconds**, and the comparison is against
today's date, not a 1970 artifact.

```
ELAPSED (2.94 h) >= WINDOW_HOURS (2)  →  GATE 1: PASS
```

Earliest valid measurement time was `DEPLOY_UTC + WINDOW_HOURS` =
**2026-08-05T18:26:33Z**, which passed ~56 minutes before this gate was
evaluated. No shortfall to report.

A 2 h window measured at 19:22:48Z starts at **17:22:48Z**, which is after
`DEPLOY_UTC` (16:26:33Z) — so the window carries no pre-deploy traffic. That
condition is re-asserted as a formal validity gate in section F.

### F0.2 Container was not recreated — `State.StartedAt` comparison

```
$ docker inspect -f '{{.State.StartedAt}}' convex-backend
2026-08-05T12:45:21.334055274Z

$ docker ps --filter name=convex-backend --format '{{.Status}}'
Up 7 hours (healthy)
```

Recorded in section D (and originally in 107-04 § A): `2026-08-05T12:45:21.334055274Z`.

```
StartedAt now      : 2026-08-05T12:45:21.334055274Z
StartedAt in § D   : 2026-08-05T12:45:21.334055274Z
COMPARISON: MATCH (identical to the nanosecond)
```

The container was never restarted or recreated across the baseline, the deploy,
and the after-window. The log stream carrying the baseline is continuous, so the
before/after comparison is recoverable. Uptime (7 h) also exceeds `WINDOW_HOURS`
(2), so a `--since 2h` capture cannot silently truncate — the primary false-green
this phase's method exists to prevent.

### F0.3 Dashboard health — CONFIRMED by Larry

Larry loaded the CodePulse Analytics page and confirmed all four widgets render
with plausible non-zero data: **Total Events card, activity heatmap, tool-flow
Sankey, and error-rate trend.**

Provenance stated precisely rather than over-claimed. Larry supplied a screenshot
of the upper portion of the page, which *directly* evidences:

- `TOTAL EVENTS: 144338`
- `LLM CALLS: 25`, `TOTAL TOKENS: 109,796`, `CACHE HIT RATE (24H): 55.4%`
- `API SPEND: $17.3509`; Cost Forecast populated (daily/weekly/monthly)
- SDK Daily Cap sparkline rendering, and the "Prompt cache by model — last 24h"
  table populated with per-model rows

The heatmap, Sankey and error-rate trend sit below the fold in that capture and
are recorded **on Larry's explicit confirmation**, not on anything observed in
the screenshot.

No dashboard-wide "no data / all zeros / reconnect loop" state was present, so
the `CLAUDE.md` rule — that such a state is index rot or memory starvation until
proven otherwise — does not apply, and `docker stats` was not needed.

Two cosmetic items visible in the capture were noted and deliberately **not**
folded into this gate, because neither is an OCC, index or memory signal:
a "1 models need pricing rates" banner, and `claude-haiku-4-5` showing a 0.0%
cache hit rate over 11 calls. Both are out of scope for OCC-01.

### F0.4 Traffic characterization — CONFIRMED by Larry

```
TRAFFIC_LEVEL: NORMAL
```

Larry characterized Ástríðr agent activity over the ~2.94 h since the deploy as
**roughly normal**, not an unusually quiet stretch.

This value is load-bearing and is carried into Task 2 verbatim: had it been
`unusually quiet`, section G's verdict would be forced to `INCONCLUSIVE`
regardless of how far the OCC rate fell (T-107-18). It is recorded here rather
than re-derived later so the verdict rule cannot silently override it.

### F0.5 Shard presence — not deferred

`SHARD_PRESENCE` in section E.1 reads
`OBSERVED 8 distinct values 0,1,2,3,4,5,6,7`, captured from
`npx convex data aggregates` and parsed with a real JSON parser. It is **not**
`DEFERRED`, so the conditional branch of this checkpoint — asking Larry to read
shard values off the self-hosted Convex dashboard — does not apply and was not
requested. No shard values were sourced from a human observation.

### F0.6 Gate result

| # | Condition | Result |
|---|-----------|--------|
| 1 | Elapsed (2.94 h) ≥ `WINDOW_HOURS` (2) | PASS |
| 2 | Traffic over the window was real, not idle | PASS — Larry: normal |
| 3 | `State.StartedAt` unchanged from § D | PASS — identical to the nanosecond |
| 4 | Analytics page renders non-zero across all four widgets | PASS — Larry confirmed |
| 5 | Shard values off the dashboard (only if `SHARD_PRESENCE: DEFERRED`) | N/A — already OBSERVED in § E.1 |

```
AFTER-WINDOW GATE: PASS — Task 2 measurement is valid to run.
```

---

## F — After-window measurement

Mirrors plan 107-04 § A exactly. Every parameter is stated next to its baseline
counterpart, because any deviation invalidates the comparison.

```
CAPTURE_UTC : 2026-08-05T19:26:36Z   (epoch 1785957996)
DEPLOY_UTC  : 2026-08-05T16:26:33Z   (epoch 1785947193)
ELAPSED     : 10803 s = 3.00 h
```

### F.1 Window validity gates

All three must pass before any number below counts as evidence.

**GATE 1 — equal window length: PASS**
```
WINDOW_HOURS (107-OCC-BASELINE.md § A) : 2
W_after (this measurement)             : 2
```
A longer window was NOT used despite more time having elapsed. "Use a longer
window since more time has passed" is precisely the arithmetic that manufactures
a false improvement, and it was refused.

**GATE 2 — container uptime covers the window, and was never recreated: PASS**
```
$ docker ps --filter name=convex-backend --format '{{.Status}}'
Up 7 hours (healthy)

$ docker inspect -f '{{.State.StartedAt}}' convex-backend
2026-08-05T12:45:21.334055274Z          <- at capture
2026-08-05T12:45:21.334055274Z          <- recorded in § D
2026-08-05T12:45:21.334055274Z          <- final re-check, end of this plan
```
Uptime (7 h) ≥ `WINDOW_HOURS` (2), so `--since 2h` returns a full 2 hours and
cannot silently truncate — the primary false-green this phase's method exists to
prevent. `StartedAt` is identical to the nanosecond across the baseline, the
deploy and this measurement, so both halves come from one continuous log stream.

**GATE 3 — window contains no pre-deploy traffic: PASS**
```
window start = CAPTURE_UTC - WINDOW_HOURS = 2026-08-05T17:26:36Z
DEPLOY_UTC                                = 2026-08-05T16:26:33Z
17:26:36Z >= 16:26:33Z  (margin: 1 h 0 m 3 s)
```
Every OCC line counted below was emitted by the sharded code path.

### F.2 Single capture, all numbers derived from it

```
$ docker logs convex-backend --since 2h 2>&1 | grep -Ei 'occ|conflict|retry' \
    > <scratch>/107-06-occ-capture.log   # outside the repo; deleted after use
```

**Total matching lines:**
```
$ wc -l < <scratch>/107-06-occ-capture.log
368
```

**Scoped to the `aggregates` table (headline metric, identical scope to § A):**
```
$ grep -c '"aggregates" table' <scratch>/107-06-occ-capture.log
314
```
```
AFTER_AGGREGATES_COUNT: 314
```

**Scoped-as-percentage-of-total** (D-02 visibility into out-of-scope noise):
314 / 368 = **85.3%**, against the baseline's 290 / 298 = 97.3%. The out-of-scope
remainder grew from 8 lines (2.7%) to 54 lines (14.7%). Full table breakdown,
recorded so the scope change is visible rather than buried in a percentage:

```
$ grep -oE 'the "[a-zA-Z]+" table' <scratch>/107-06-occ-capture.log | sort | uniq -c | sort -rn
    314 the "aggregates" table
     66 the "dockerContainers" table
      6 the "providerHealth" table
```

`dockerContainers` and `providerHealth` contention is out of OCC-01's scope and
is excluded from every number below, exactly as the baseline excluded its own 8
out-of-scope lines. Its growth is noted as an observation, not folded in.

**Unscoped sanity re-check** (guard against a silently-empty scoped measurement):
```
$ grep -Eic 'occ|conflict|retry' <scratch>/107-06-occ-capture.log
368
```
Matches `wc -l` exactly — capture and count pipeline are consistent.

**Three hottest documents** (same pipeline as § A):
```
$ grep -oE '[a-z0-9]{32}' <scratch>/107-06-occ-capture.log | sort | uniq -c | sort -rn | head -3
     20 td72b08wgysm62kn93npjaycgn8bw193
     18 td7167271jgxgyvmzkdddkwwh18bxe2q
     16 td70hvajzkxg80p6xddtcxr69x8bxw8r
```

**Hot-document share — this is the one metric that moved decisively in the right
direction.** The top document accounts for 20 of 314 scoped lines = **6.4%**,
against the baseline's 194 of 290 = **66.9%**. Contention is spread across **55
distinct documents** in the after-window, versus a single row absorbing two
thirds of it before. So the mechanism D-01 asked about is observable and it is
working: writes are genuinely distributed across the 8 shards, and the hot
document is gone.

That the total nevertheless did not fall is the finding of this plan, and § G
does not round it away.

**Confirmation that the hot rows are the sharded rows** — the top documents were
looked up in the live table rather than assumed:
```
{ "_id": "td72b08wgysm62kn93npjaycgn8bw193", "metric_type": "events",
  "dimensions": {"event_type":"PreToolUse"}, "bucket_start": 1785952800,
  "period": "hourly", "shard": 5, "value": 7 }
{ "_id": "td7167271jgxgyvmzkdddkwwh18bxe2q", "metric_type": "sankey_edge",
  "dimensions": {"source":"Other","target":"Read"}, "bucket_start": 1785952800,
  "period": "hourly", "shard": 3, "value": 7 }
```
Both carry a `shard` field with a valid value and the exact two metric types
107-03 sharded. The residual contention is landing **on the sharded rows
themselves**, not on some unsharded metric type that the change missed.

**Which mutation is retrying** (aggregates-scoped lines only):
```
$ grep '"aggregates" table' <capture> | grep -oE 'Udf\([a-zA-Z0-9_.:]+\)' | sort | uniq -c
    157 Udf(events.js:ingest)
```
All of it is `events.ingest`. Nothing else contends on `aggregates`.

**Line-structure note (applies identically to both halves, so the comparison is
unaffected):** each OCC occurrence emits two lines — an `ERROR ... Caught occ
error` and a `WARN ... retrying Udf(...)`. The after-window's 314 scoped lines
are 157 ERROR + 157 WARN, i.e. **157 distinct OCC retries**; the baseline's 290
are likewise ~145 retries. The headline metric is kept as the raw line count
because § A defined it that way and changing the basis mid-comparison is exactly
the kind of drift this method refuses. The 2:1 factor cancels in every ratio.

**Verbatim sample lines** (ANSI codes stripped; scanned for token-shaped values
per T-107-20 — `grep -icE 'sb_|eyJ|admin.?key|bearer'` returned `0`;
`instance_name="codepulse"` is a deployment label, not a secret):
```
2026-08-05T17:41:17.309805Z ERROR isolate_worker_handle_request: common::errors: Caught occ error (RUST_BACKTRACE=1 RUST_LOG=info,common::errors=debug for full trace): Documents read from or written to the "aggregates" table changed while this mutation was being run and on every subsequent retry. Another call to this mutation changed the document with ID "td7a95p2dkg85z38cf2nw2z7f98bwkra". See https://docs.convex.dev/error#1 instance_name="codepulse"

2026-08-05T17:41:17.309988Z  WARN isolate_worker_handle_request: application::application_function_runner: Optimistic concurrency control failed (Documents read from or written to the "aggregates" table changed while this mutation was being run and on every subsequent retry. Another call to this mutation changed the document with ID "td7a95p2dkg85z38cf2nw2z7f98bwkra". See https://docs.convex.dev/error#1), retrying Udf(events.js:ingest) after 99.681067ms instance_name="codepulse"
```

Scratch capture file deleted after these numbers were derived from it (`ls` of
the scratch dir returns zero `107-06-*` files).

### F.3 Per-hour rate

```
AFTER_AGGREGATES_COUNT (314) / WINDOW_HOURS (2) = 157.0
AFTER_RATE_PER_HOUR: 157.0
```
Baseline counterpart: `BASELINE_RATE_PER_HOUR: 145.0`.

### F.4 Traffic volume for the same window

Identical command and fractional `lookbackDays` as baseline § B
(`WINDOW_HOURS / 24 = 2/24`):
```
$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.08333333333333333}'
{
  "PostToolUse": 97,
  "PostToolUseFailure": 1,
  "PreToolUse": 37,
  "SessionStart": 3,
  "Stop": 5,
  "SubagentStop": 6,
  "UserPromptSubmit": 6
}
```
Sum: 97 + 1 + 37 + 3 + 5 + 6 + 6 = **155**
```
AFTER_INGEST_VOLUME: 155
```
Non-empty with a varied per-event-type breakdown, so the liveness guard (an
empty or all-zero result is a failed measurement, not a real zero) is satisfied.

**Deployment-target confirmation**, as in baseline § B — the identical query
re-run with an explicit `--url` returned a byte-identical result:
```
$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.08333333333333333}' --url http://127.0.0.1:3210
{ "PostToolUse": 97, "PostToolUseFailure": 1, "PreToolUse": 37, "SessionStart": 3,
  "Stop": 5, "SubagentStop": 6, "UserPromptSubmit": 6 }
```
Confirms the bare `npx convex run` resolved to the self-hosted `127.0.0.1:3210`
instance and not a `.convex.cloud` host.

### F.5 Traffic-normalized rate — the headline comparison

A raw rate drop can be produced entirely by lower traffic; a raw rate *rise* can
likewise be masked by higher traffic. Both halves are therefore normalized:

```
RETRIES_PER_1K_EVENTS = OCC count / (ingest volume / 1000)

BASELINE_RETRIES_PER_1K: 1188.5      = 290 / (244 / 1000) = 290 / 0.244
AFTER_RETRIES_PER_1K: 2025.8         = 314 / (155 / 1000) = 314 / 0.155
```

Neither ingest volume is 0, so the normalized figure is defined and the
`UNDEFINED` / inconclusive branch does not apply.

Normalization matters in the opposite direction from the one it was written to
guard against: traffic **fell 36.5%** while the OCC count **rose 8.3%**. The raw
per-hour rate understates the regression; the normalized figure is the honest
one, and it is **70.5% worse**.

### F.6 Comparison table

| Metric | Baseline (pre-deploy) | After (post-deploy) | Absolute change | Percent change |
|---|---|---|---|---|
| OCC count, `aggregates`-scoped | 290 | 314 | +24 | +8.3% |
| Rate per hour | 145.0 | 157.0 | +12.0 | +8.3% |
| Ingest volume (same window) | 244 | 155 | −89 | −36.5% |
| **Retries per 1,000 events** | **1188.5** | **2025.8** | **+837.3** | **+70.5%** |
| Hottest-document share | 66.9% (194/290) | 6.4% (20/314) | −60.5 pp | −90.5% |

Window length, grep pattern and table scope are identical across both columns.

---

## G — OCC-01 verdict

### G.1 Final read-total spot-check

Exact method from baseline § C, re-run one final time.

```
NOW = 1785958130   (2026-08-05T19:28:50Z)
H0  = floor(NOW/3600)*3600 - 3600 = 1785952800   (2026-08-05T18:00:00Z)
H1  = H0 + 3600                   = 1785956400   (2026-08-05T19:00:00Z)
LOOKBACK_A = (NOW - (H0 - 60)) / 86400 = 0.062384259259259257
LOOKBACK_B = (NOW - (H1 - 60)) / 86400 = 0.020717592592592593
```

```
$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.062384259259259257}'
{ "PostToolUse": 108, "PostToolUseFailure": 1, "PreToolUse": 41, "SessionStart": 3,
  "Stop": 5, "SubagentStop": 6, "UserPromptSubmit": 6 }              -> A = 170

$ npx convex run aggregates:eventCountsByPeriod '{"period":"hourly","lookbackDays":0.020717592592592593}'
{ "PostToolUse": 43, "PreToolUse": 12, "SessionStart": 1,
  "UserPromptSubmit": 1 }                                            -> B = 57

FINAL_BUCKET_TOTAL = A - B = 170 - 57 = 113
```

Raw count over the same hour, at `limit:1000` per 107-04's recorded finding that
`limit:5000` exceeds the 16,777,216-byte read cap on this dataset:
```
$ npx convex run events:listRecent '{"limit":1000}'
events returned: 1000
min timestamp: 1785941628 (2026-08-05T14:53:48Z)
coverage guard (min < H0 = 1785952800): PASS
FINAL_RAW_EVENT_COUNT [H0,H1): 113
```

```
FINAL_BUCKET_TOTAL: 113
FINAL_RAW_EVENT_COUNT: 113
FINAL_READ_TOTALS: MATCH
```

**This is the mixed-state proof § E.4 deferred to this plan, and it is not
vacuous.** The `[18:00, 19:00)` bucket falls entirely after `DEPLOY_UTC`, so
every row in it is sharded. A control was run to confirm the bucket genuinely
requires a multi-row fold — otherwise a MATCH would prove nothing about summing
across shards:

```
aggregates rows in the 18:00–19:00 bucket:            101
distinct (metric_type, dimensions) keys in it:         23
keys backed by MORE THAN ONE shard row:                20   <- 20 of 23
  sankey_edge {source:AskUserQuestion,target:Success} -> shards 1,3,5,7
  sankey_edge {source:Other,target:AskUserQuestion}   -> shards 1,3,5,7
  events      {event_type:UserPromptSubmit}           -> shards 1,2,3,6
  ...
```

So 20 of 23 logical keys in the measured hour are split across 2–4 shard rows,
and the readers still fold them to exactly the raw event count. The read path is
**correct under sharding** in live production data — the outcome plan 107-02's 7
executable guards predicted, now confirmed against real mixed data rather than
fixtures.

### G.2 Verdict

```
OCC-01 VERDICT: FAIL
```

**Rule that fired:** *"`FAIL` if the traffic-normalized rate did not fall."*
`AFTER_RETRIES_PER_1K` (2025.8) is **higher** than `BASELINE_RETRIES_PER_1K`
(1188.5) — a 70.5% regression, not a fall.

Every other branch was checked and none applies:

| Branch | Applies? | Why |
|---|---|---|
| `PASS` | No | Requires `AFTER_RETRIES_PER_1K` ≥50% *below* baseline and `AFTER_RATE_PER_HOUR` below baseline. Both moved the wrong way. |
| `PARTIAL` | No | Requires that the rate *fell*. It rose (145.0 → 157.0). A partial result cannot be claimed by pointing at the hot-document improvement alone. |
| `INCONCLUSIVE` | No | All three window validity gates PASSED; both ingest volumes are non-zero so the normalized figure is defined; and Larry characterized traffic in § F0.4 as **normal**, not unusually quiet. |
| `FAIL` | **Yes** | The traffic-normalized rate did not fall. |

`FINAL_READ_TOTALS: MATCH`, so this is a clean contention failure with
**correctness fully intact** — not the "lower count paired with a silently broken
fold" outcome the method was built to catch. Nothing about the data is wrong;
the fix simply did not reduce conflicts.

### G.3 What the evidence actually shows

Three findings, each backed by a measurement above rather than inference:

1. **Sharding is applied and the write spread works.** All 8 shard values are in
   use (§ E.1), one draw per ingest call holds in live data (§ E.1), and the
   hot document is gone — top-document share fell 66.9% → 6.4% across 55 distinct
   documents (§ F.2). D-01's question is answered: no single document dominates.

2. **Spreading the writes did not reduce the conflicts.** OCC on `aggregates`
   rose 290 → 314 lines (145 → 157 retries) while traffic fell 36.5%. All of it
   is `Udf(events.js:ingest)`, and the contended documents are the sharded rows
   themselves.

3. **The most likely mechanism — the read set was never sharded.** Convex OCC
   conflicts on documents *read from **or** written to*. Both write helpers in
   `convex/analyticsRollup.ts` open the bucket with a `.collect()` over the whole
   `(metric_type, period, bucket_start)` tuple and then match the dimension key
   and shard in JS:

   ```
   convex/analyticsRollup.ts:43-54   incrementEventBucket
   convex/analyticsRollup.ts:101-111 incrementSankeyEdge
       ctx.db.query("aggregates")
         .withIndex("by_type_period_bucket", q =>
            q.eq("metric_type",…).eq("period","hourly").eq("bucket_start",hourStart))
         .collect()
   ```

   107-03 narrowed the **write target** to one shard row but left the **read set**
   as the entire bucket — all 8 shards and every dimension key in it. Any
   concurrent `events.ingest` patching *any* row in that bucket invalidates this
   mutation's read set and forces a retry, regardless of which shard it wrote.

   This also explains the modest *increase*: sharding made each bucket ~8× wider
   (101 rows across 23 keys in the measured hour), so every `.collect()` now
   reads more documents and has more rows whose modification can invalidate it.

   Stated at its true confidence: findings 1 and 2 are measurements; finding 3 is
   a **strong hypothesis** consistent with the Convex OCC semantics quoted in the
   error text itself and with the code above, but it has not been isolated by a
   controlled experiment. Verifying it is the first task of the follow-up, not an
   assumption to build on.

### G.4 Next lever — handed to gap closure, NOT fixed here

No rollback was performed and none is recommended. Reverting would re-create the
single hot document that caused two multi-day incidents, and the read path is
demonstrably correct under sharding. The change is a net structural improvement
that has not yet paid off in contention.

Per this plan's own instruction, no fix was attempted. Recommended levers, in
priority order:

1. **Narrow the read set to one shard (highest expected value).** Add `shard` to
   the bucket index and range-bound the lookup to the caller's shard, so a
   mutation reads only its own shard's rows. This is the lever that follows
   directly from finding 3.
   **Correction to record:** `convex/lib/aggregateShard.ts` states that widening
   the shard range "needs no schema or index change" because `shard` is an
   *unindexed* optional field. That is true for raising the count — but it is
   exactly why this lever *does* require an index addition. The comment is
   accurate as written and should not be read as covering this change.

2. **Collapse the deferred `events.ingest` round-trip.** Fewer separate
   read-patch cycles per ingest means a smaller read set and a shorter window in
   which a conflict can occur.

3. **Raising `AGGREGATE_SHARD_COUNT` beyond 8 — explicitly NOT recommended
   first.** This plan named it as a candidate lever, and the evidence argues
   against it: under finding 3 a higher shard count makes each bucket's
   `.collect()` read *more* rows, which would likely make contention worse, not
   better. It only becomes useful *after* lever 1 narrows the read set. Recording
   this because the leading suggestion turned out to point the wrong way.

D-03 observation, recorded as an observation and deliberately not folded into the
verdict: no change to the ingest round-trip count was claimed or measured by this
plan. The read-amplification effect described in finding 3 is a *hypothesis about
why the verdict failed*, not a measured latency or round-trip result.

### Method deviations from D-05 as written

D-05's intent — a live before/after OCC-retry comparison against the running
self-hosted backend — was honored in full. Only its arithmetic was corrected,
in three places:

1. **No `--since 24h`.** Carried forward from 107-04. A 24-hour window cannot
   return 24 hours of data on a container with less uptime; it silently truncates
   to the uptime window, which would manufacture a false improvement when re-run
   later at a longer uptime. Both halves use the explicit, uptime-bounded
   `WINDOW_HOURS = 2` instead.

2. **No comparison against `1135/24h`.** Carried forward from 107-04. That figure
   implies ~47/hour, while every live like-for-like measurement is far higher
   (145.0/hour pre-deploy here; ~644/hour in the 2026-08-05 09:34 EDT reference
   sample). Comparing a post-fix number against `1135` would have flattered the
   result regardless of whether sharding worked — and in this case would have
   converted a measured regression into a fictitious 3× improvement. The
   comparison table in § F.6 uses the measured baseline only; this paragraph is
   the sole place `1135` appears, which is its only correct use.

3. **Normalization by ingest volume (introduced here).** D-05 specified a raw
   count comparison. A raw count cannot distinguish a fix from a quiet period, so
   both halves additionally record ingest volume and the headline metric is
   retries per 1,000 ingested events. In this measurement the correction mattered
   and changed the reading: traffic fell 36.5%, so the raw +8.3% understated a
   +70.5% normalized regression.

### Closing state

```
OCC-01: OPEN — FAIL recorded, no rollback, next lever named for gap closure.
```

`git status --porcelain convex src` — empty throughout this plan. No source file
was modified, and no in-code retry counter or log statement was added (it could
not reach `docker logs` anyway: `console.log` inside a UDF does not reach the
container log on self-hosted Convex).

Final `docker inspect -f '{{.State.StartedAt}}' convex-backend`:
`2026-08-05T12:45:21.334055274Z` — unchanged from § D.

---

## § H — Plan 107-07: read-set narrowing (deployed, window OPEN)

### H.1 What shipped

Commit `db7d9c9a`. `dimensions` is `v.any()` and cannot be indexed, so the dimension is
denormalised into an indexed string (`convex/lib/aggregateDimensionKey.ts`) and a new index
`by_type_period_bucket_key_shard` pins every field with `eq()`. Ingest read set: **101 rows
→ 1**. `by_type_period_bucket` deliberately unchanged — Convex confirmed at deploy time
`No indexes are deleted by this push`, so all 10 reader modules still fold the whole bucket.
`AGGREGATE_SHARD_COUNT` left at 8 so this cycle moves exactly one variable.

Test evidence: the pre-existing fake `withIndex()` ignored the index name AND the filter
callback and returned the whole table, so read-set WIDTH was untestable and a wrong
implementation would have stayed green. The fake was rewritten to apply eq/range constraints
and record what each query pinned and how many rows it returned. 3 new tests fail against the
old code (`expected 9 to be less than or equal to 1`); both mutation proofs pass. The same
defect in `events.test.ts` surfaced as 2 failures and was fixed. Suite 3459 pass / 0 fail.

### H.2 The measurement instrument is NOT trustworthy by default — three traps found

**Trap 1 — `docker logs --since` returns 0 lines for every window after container start.**
`--since 10m/30m/1h/2h` → 0; `--since 4h` → 2472; `--since 6h` → 9025. Absolute timestamps
→ 0 even for times before container start. All three clocks (host, container, WSL) agree
exactly and docker's metadata timestamp matches the in-message timestamp, so this is NOT
clock skew; root cause not established and deliberately not chased further.
**`--since` must not be used as the window selector on this host.**

**Trap 2 — a large `--tail` silently serves the ROTATED log file.** Measured:

```
--tail  1000 ->  1000 lines | 22:53:02 -> 23:03:53  CURRENT
--tail 10000 -> 10000 lines | 20:43:52 -> 23:04:16  CURRENT
--tail 15000 ->  2722 lines | 18:57:51 -> 19:49:08  ROTATED (stale)
--tail 50000 -> 29675 lines | 12:45:21 -> 19:49:08  ROTATED (stale)
(no flag)    -> 29675 lines | 12:45:21 -> 19:49:08  ROTATED (stale)
```

Asking for more lines than the current file holds returns the PREVIOUS container instance's
logs — with plausible timestamps and real content. A window measurement using a large
`--tail` would silently report 107-06-era logs as current. Driver is `json-file` with
default rotation.

**Trap 3 — a gap exists between segments.** The rotated file ends 19:49:08Z and the current
file's reachable start is ~20:45Z, so roughly 19:49–20:45 is unreachable via `docker logs`.

### H.3 The method that IS validated

Window on the **in-message RFC3339 timestamp**, never on `--since`:

```
docker logs convex-backend --tail 10000 2>&1 | sed 's/\x1b\[[0-9;]*m//g' > cur.log
awk -v s="<WINDOW_START>" 'substr($0,1,19) >= s' cur.log > window.log
grep -c '"aggregates" table' window.log
```

Two controls are mandatory before believing any number:

1. **Coverage** — the capture's earliest timestamp must be ≤ WINDOW_START, else the window
   was truncated. If `--tail 10000` no longer reaches back far enough, raise it, but
   re-check it has not flipped to the rotated file per Trap 2.
2. **Positive control** — the method reproduced 107-06's published numbers EXACTLY from the
   rotated segment over its own window (17:26:36–19:26:36Z): **368 total / 314 aggregates**,
   with an identical table breakdown (314 aggregates / 66 dockerContainers / 6
   providerHealth). 107-06's `--since 2h` capture and this timestamp-filter capture agree
   byte-for-byte, so 107-06's raw counts are independently confirmed and this method is
   calibrated against a known-good answer.

### H.4 Pre-deploy baseline for 107-07 (NOT reusing 107-06's, and why)

```
CAPTURE_UTC          : 2026-08-05T23:05:16Z
WINDOW_START         : 2026-08-05T21:05:16Z     (WINDOW_HOURS: 2)
COVERAGE CONTROL     : PASS (capture starts 20:45:17Z <= 21:05:16Z)
PRE_OCC_TOTAL        : 74
PRE_AGGREGATES_COUNT : 72          (breakdown: 72 aggregates, 2 events)
PRE_INGEST_VOLUME    : 632         (8 distinct event types — liveness guard satisfied)
PRE_RETRIES_PER_1K   : 113.9       = 72 / (632/1000)
```

107-06's `BASELINE_RETRIES_PER_1K: 1188.5` is NOT reused as this plan's baseline: it was
measured on a different container instance (`StartedAt 12:45:21Z`; the current instance
started 19:53:26Z), and a container recreate is exactly the intervention this project's
incident history says clears the degradation being measured. Comparing across it would
confound the code change with a container restart.

### H.5 A variance problem that changes how the verdict must be read

Per-clock-hour aggregates-scoped OCC counts across the **previous** container instance, on
IDENTICAL code within each side of its deploy:

```
13:00Z  542      16:00Z  172      19:00Z   32
14:00Z  238      17:00Z  116
15:00Z   46      18:00Z  184
```

A **17x swing (32–542)** hour to hour; against a total-log-line proxy the normalized rate
still swings ~8x. 107-06's baseline and after figures were each a single 2 h sample drawn
from this distribution, so its **+70.5% difference is not clearly separable from
window-to-window noise**. This does NOT show 107-06's verdict is wrong — its raw counts
reproduce exactly (§ H.3) — it shows that a single 2 h window cannot support that confidence.

**Consequence for 107-07's verdict:** a single 2 h after-window is not sufficient evidence.
Take several non-overlapping windows and compare distributions, and treat any difference
smaller than the observed noise band as INCONCLUSIVE rather than PASS or FAIL.

### H.6 Deploy record

```
DEPLOY_UTC          : 2026-08-05T23:06:55Z
Index added         : aggregates.by_type_period_bucket_key_shard
                      (metric_type, period, bucket_start, dimension_key, shard, _creationTime)
Indexes deleted     : none (Convex: "No indexes are deleted by this push")
Container restarted : NO — StartedAt still 2026-08-05T19:53:26Z, RestartCount 0
Container health    : 17.51 GiB / 64 GiB (27.36%), CPU 0.07%
```

Live confirmation that the new path is writing, from real post-deploy traffic (the separator
renders as `\u0000` in CLI output):

```
dimension_key "Stop\u0000Success"   dimensions {source:Stop,  target:Success}  shard 2
dimension_key "Other\u0000Stop"     dimensions {source:Other, target:Stop}     shard 2
dimension_key "Stop"                dimensions {event_type:Stop}               shard 2
dimension_key "Bash\u0000Success"   dimensions {source:Bash,  target:Success}  shard 4
```

One ingest's three writes share one shard (the three `shard 2` rows), so 107-03's
one-draw-per-ingest contract still holds under the narrowed lookup.

### H.7 After-window procedure (earliest valid read: 2026-08-06T01:07Z)

Settle ≥ 1 h after `DEPLOY_UTC` so no counted line predates the deploy, then take
**multiple** non-overlapping 2 h windows per § H.5. For each: run § H.3's capture, assert the
coverage control, count aggregates-scoped lines, run `PRE_INGEST_VOLUME`'s query with
`lookbackDays` = WINDOW_HOURS/24, and compute retries per 1k. Compare the distribution
against `PRE_RETRIES_PER_1K: 113.9` — not against 107-06's cross-container figures.

---

## § I — Plan 107-07 after-window measurement: `OCC-01 VERDICT: PASS`

Measured 2026-08-06T11:42–11:55Z, 12.60 h after `DEPLOY_UTC 2026-08-05T23:06:55Z`.

### I.1 Validity gates

| # | Gate | Value | Result |
|---|---|---|---|
| 1 | Elapsed >= 1 h settle | 12.60 h | **PASS** |
| 2 | Container not recreated | `StartedAt 2026-08-05T19:53:26Z`, `RestartCount 0` | **PASS** |
| 3 | Capture coverage | `--tail 40000` spans 2026-08-05T22:19:42 -> 2026-08-06T11:43:51, starting before `DEPLOY_UTC` | **PASS** |
| 4 | `--tail` not flipped to rotated file (§ H.2 Trap 2) | 40000 CURRENT; 80000 STALE — 40000 used | **PASS** |

Gate 2 is the strongest control this phase has had: **the same container instance spans
both the pre-deploy baseline and the entire post-deploy period**, so unlike the comparison
against 107-06 there is no container-recreate confound.

### I.2 Headline

```
POST-DEPLOY (107-07, narrow read), 2026-08-06T00:07Z -> 11:43Z (11.6 h)
  aggregates OCC lines : 0
  POST /ingest 200     : 176
  retries per 1k       : 0.0
```

Per-window, five non-overlapping 2 h windows plus the most recent partial:

```
  00:07-02:07   OCC=0  ingest=0     n/a (no traffic)
  02:07-04:07   OCC=0  ingest=0     n/a (no traffic)
  04:07-06:07   OCC=0  ingest=0     n/a (no traffic)
  06:07-08:07   OCC=0  ingest=0     n/a (no traffic)
  08:07-10:07   OCC=0  ingest=63    0.0
  10:07-11:43   OCC=0  ingest=100   0.0
```

### I.3 The controls, because zero is also what a broken measurement looks like

**Instrument liveness — PASS.** The same capture DOES contain OCC lines, just not on
`aggregates`:

```
15 occ|conflict|retry lines post-deploy:
   10 the "forgeHosts" table
    2 the "sessions" table
    0 the "aggregates" table
```

So the capture and grep pipeline detect conflicts; `aggregates` is specifically at zero.

**Low traffic alone does NOT explain zero.** Under the OLD code, low-traffic hours still
produced heavy contention — and the WORST normalized rate came at the LOWEST traffic:

```
hour     OCC   ingest/hr   retries/1k
13:00Z   542   716         757.0
14:00Z   238   698         341.0
15:00Z    46   146         315.1
16:00Z   172   486         353.9
17:00Z   116   133         872.2
18:00Z   184    70        2628.6     <- lowest traffic, highest normalized rate
19:00Z    32    94         340.4
```

Applying the old code's observed range to the post-deploy ingest volume:

```
176 ingests at old-code MIN rate (315.1/1k) -> 51 conflicts expected
176 ingests at old-code MAX rate (2628.6/1k) -> 428 conflicts expected
observed                                     -> 0
```

**Correctness — the write path is not silently broken.** `FINAL_READ_TOTALS: MATCH`
computed by 107-06's exact method on the completed hour `[10:00, 11:00)Z`:

```
FINAL_BUCKET_TOTAL    : 20    (eventCountsByPeriod A-B differencing: 176 - 156)
FINAL_RAW_EVENT_COUNT : 20    (events:listRecent limit 1000, [H0,H1) filter)
coverage guard        : PASS  (min ts 2026-08-05T22:23:47Z < H0)
FINAL_READ_TOTALS     : MATCH
```

Non-vacuous, proven rather than asserted: of 55 distinct `(bucket, dimension_key)` pairs
sampled, **38 are backed by more than one shard row**, with hot keys split across all **8**
shards (`PostToolUse` 8 rows, `PreToolUse` 8, `Read\u0000Success` 8, `Bash\u0000Success` 8).
Readers therefore genuinely had to fold across shards, and did. A live row observed with
`value: 2` additionally proves the narrowed point lookup FINDS and PATCHES existing rows —
a broken lookup would insert a fresh `value: 1` row every time and never patch.

### I.4 Verdict

```
PRE_RETRIES_PER_1K  : 113.9   (§ H.4, recorded pre-deploy, same container instance)
                       93.6   (22:19-23:07 pre-deploy fragment, log-derived normalizer)
AFTER_RETRIES_PER_1K:   0.0
OCC-01 VERDICT      : PASS
```

Against 107-06's own rubric: `PASS` requires the normalized rate at least 50% below
baseline AND the per-hour rate below baseline. Both hold at their limit — the rate is zero.
`PARTIAL` and `INCONCLUSIVE` do not apply: all validity gates passed, the instrument was
proven live in the same capture, and correctness was independently confirmed.

### I.5 Caveat, recorded rather than buried — peak-load confirmation outstanding

Post-deploy traffic ran at **32-62 ingest/hr**, below the lowest old-code sample (70/hr)
and far below the pre-deploy fragment's **676 ingest/hr**. Two honest limitations follow:

1. No post-deploy window has yet matched peak load, so the fix is confirmed at low-to-
   moderate concurrency and inferred, not measured, at peak.
2. An hourly average is a crude proxy for concurrency — a burst can hide inside an
   otherwise quiet hour, which is likely what produced 18:00Z's 2628.6/1k at only 70
   ingest/hr.

The § I.3 control substantially mitigates (1): the old code produced 315-2628 retries/1k
across the whole 70-146 ingest/hr band, so the post-deploy zero is not explicable by
traffic level alone. But a confirming measurement taken after a heavy working session,
using § H.3's method and these same controls, should be recorded before OCC-01 is
considered closed beyond doubt.

### I.6 Note on 107-06's verdict

107-06's raw counts were independently reproduced byte-for-byte (§ H.3), so its data was
sound, and its diagnosis — that the read set was never narrowed — is confirmed correct by
this result. Its `+70.5%` regression figure remains within the noise band identified in
§ H.5 and should not be quoted as a precise effect size; the diagnosis it drove was right
regardless.

### I.8 Peak-load follow-up (2026-08-06T12:00Z) — § I.5's caveat substantially narrowed

§ I.5 recorded that the PASS was measured at 32-62 ingest/hr, below the lowest old-code
sample (70/hr) and far below the pre-deploy peak (676/hr). Traffic rose during the
following working session, so the same § H.3 method was re-run:

```
hour     aggregates-OCC   ingest   retries/1k
09:00Z   0                43       0.0
10:00Z   0                20       0.0
11:00Z   0                270      0.0     <- 4-6x the § I.2 rate
12:00Z   0                8        0.0
```

**11:00Z ran at 270 ingest/hr with ZERO aggregates OCC.** That rate is now *above* the
entire old-code band that produced heavy contention (70-146 ingest/hr -> 315-2628.6
retries/1k), and above the 146 ingest/hr hour that produced 46 conflicts. Applying the old
code's mildest observed normalized rate (315.1/1k) to 270 ingests predicts ~85 conflicts;
0 were observed.

Residual caveat, still honest: the pre-deploy peak was 676 ingest/hr and no post-deploy
window has yet reached that. So the fix is now measured across 20-270 ingest/hr — spanning
and exceeding the band where the old code demonstrably contended — and remains inferred
only above ~270/hr. That is a materially smaller gap than § I.5 recorded, and the verdict
stands unchanged.

---

## § J — The memory buildup is NOT data volume (2026-08-06), and what was done about it

Phase 107's goal statement names two symptoms: OCC write contention (closed, § I) and
"repeated self-hosted Convex memory buildup ... never root-caused". This section records a
measurement that narrows the second one, and the mitigation put in place. **The root cause
remains open.**

### J.1 The measurement that rules out data volume

```
2026-08-05 23:06   mem 17.51 GiB
2026-08-06 11:42   mem 24.37 GiB
2026-08-06 17:47   mem 31.02 GiB    db.sqlite3  6,364,078,080 bytes
2026-08-06 17:51   mem 15.64 GiB    db.sqlite3  6,364,078,080 bytes   (recreate)
2026-08-06 18:30   mem  7.63 GiB    db.sqlite3  6,364,078,080 bytes   (restart)
```

**`db.sqlite3` is BYTE-IDENTICAL across the whole range.** The data did not grow at all
while memory went from ~7.6 GiB to 31 GiB and back. The growth is accumulated runtime
working set, not row count.

Two corrections to earlier readings in this file's own narrative, recorded rather than
silently fixed:
- The 15.64 GiB figure was taken ~20 min after a recreate and was still warming. The true
  settled baseline is **~7.8 GiB**, which matches `docker-compose.yml`'s own note that the
  "lean working set is ~9g". So the observed climb is **~4x**, not the ~2x a naive
  before/after would suggest.
- The climb happened **with** 107-07's OCC fix deployed. Narrowing the read set closed the
  contention; it did **not** slow the memory growth. These are separate problems and should
  not be conflated because they share a symptom (a wedged-feeling backend).

### J.2 Retention was considered and REJECTED — including by an existing guard

The intuitive read of "the `aggregates` table is never pruned" is that it explains the
growth. **It does not** — see J.1; the file does not grow. Adding retention would have
reclaimed approximately none of it.

An attempt to add `aggregates: 365` as cheap far-future insurance was made and **reverted**,
because `convex/retention.test.ts` carries a deliberate guard:

```
it("still keeps the cost/trend tables forever - pruning these would break dashboards")
  -> "aggregates must NOT be pruned"
```

with a real functional rationale, not a stylistic one: **Phase 104 (D-04) re-derives dollar
costs from `aggregates` token buckets on every read**, so pruning at any horizon silently
destroys re-priceable history. Combined with J.1 showing retention buys nothing for the
actual problem, the change would have traded a real capability for no benefit. `aggregates`
stays kept-forever. Shortening it further would ALSO generate the tombstone burst that
`convex/retention.ts` exists to avoid.

### J.3 Mitigation in place: nightly restart (D1)

Not a fix. A restart is what has cleared every one of these incidents to date, so it is now
scheduled instead of reactive.

```
Task        : ConvexNightlyRestart      (Windows Task Scheduler)
Schedule    : 02:00 local, daily
Script      : C:\Users\mandr\convex-selfhost\restart-convex.ps1
Launcher    : C:\Users\mandr\convex-selfhost\run-restart-hidden.vbs
Log         : C:\Users\mandr\convex-selfhost\restart-convex.log
```

Design notes, each pinned to a known failure mode:
- Uses `docker restart`, NOT `compose up --force-recreate` — the project's own escalation
  order is restart first, recreate only on failure. The script logs the escalation command
  if restart fails.
- Launched via a `.vbs` with `SW_HIDE` at creation. `powershell -WindowStyle Hidden` does
  NOT hide when Windows Terminal is the default terminal, and closing the resulting console
  console-kills the task's process tree.
- ASCII-only `.ps1` (verified: 0 bytes > 127). PS 5.1 parses a UTF-8 em-dash as a curly
  quote and dies with "missing terminator", which in a scheduled task fails silently.
- `$ErrorActionPreference` is `Continue`, never `Stop`: a native tool writing to stderr
  would otherwise become terminating and abort before the log is written.
- **Health-gated.** It polls `:3210/version` for up to 150s and logs a loud FAILED line if
  the backend does not come back, so a restart that leaves it wedged cannot report success.
- Timing chosen against the existing schedule: `ConvexBackup` 03:00 local,
  `ConvexRetentionHealthCheck` 05:30, `ConvexRetentionRootCause` 05:45, and the Convex
  `retention-prune` cron at 09:00 UTC (05:00 local, runs ~30 min). 02:00 collides with none.

**Verified by running the task itself**, not just by registering it — an unrun scheduled
task is an unverified one:

```
last result : 0
2026-08-06 14:30:03  --- nightly convex-backend restart ---
2026-08-06 14:30:04  memory before : 16753 MiB
2026-08-06 14:30:32  memory after  : 7815 MiB  (reclaimed 8938 MiB)
2026-08-06 14:30:32  OK: healthy after 25s
```

Post-restart health confirmed independently: `:3210/version` 200, `instance_name` codepulse,
`db.sqlite3` byte-identical, 695 registry rows.

### J.4 Still open

The root cause. Candidates, none tested: tombstone GC window vs. the nightly prune's own
churn, in-memory index growth, or isolate/cache accumulation. The useful new constraint for
whoever picks it up is that **the data file does not move while memory quadruples** — so any
hypothesis resting on row count or table size is already excluded.

Note `C:\Users\mandr\convex-selfhost\` is NOT a git repo, so the compose `logging:` block
(§ H.2) and these two scripts exist only on disk and are not versioned anywhere.
