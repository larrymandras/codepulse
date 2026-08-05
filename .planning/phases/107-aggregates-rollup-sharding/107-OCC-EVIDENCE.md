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
