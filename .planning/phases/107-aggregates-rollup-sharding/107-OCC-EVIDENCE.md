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
