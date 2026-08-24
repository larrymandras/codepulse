---
phase: 125-signature-layers
plan: 07
status: complete
executed: 2026-08-24
executed_by: orchestrator (INLINE — not delegated; see "Why this ran inline")
commits: []
requirements: [SIGNAL-02]
---

# 125-07 — Deploy `listRecentRuntimeWindow` to the live self-hosted Convex backend

**Outcome: deployed and verified.** `events:listRecentRuntimeWindow` is live on the self-hosted
instance, runs against real data, and both of its bounds were confirmed against live rows with a
discriminating control. No schema change, no index change, no source file modified.

## Why this ran inline

This plan is `autonomous: false` and its only action is an outward-facing production deploy.
The standing lesson is that a subagent executor will (correctly) refuse real-spend / production
authorisation relayed through an orchestrator message, and that attended plans of this kind belong
in the session where the operator's approval is native. Larry authorised the deploy directly in
this session on 2026-08-24, having been shown the exact command beforehand. So no `gsd-executor`
was spawned; the orchestrator ran Tasks 1–3 itself.

## Task 1 — Pre-Deploy Working-Tree Audit

`convex deploy` ships the **WORKING TREE, not HEAD**, and this is a shared checkout with another
Claude session (astridr-repo-f3, Phase 195) committing concurrently throughout this phase. The
audit is therefore the load-bearing part of this plan, not a formality — this repo's history
already includes a "surgical" older-tree deploy that silently deleted three live indexes on
another session's active phase.

Verbatim:

```
$ git status --porcelain
?? .planning/phases/126-page-body-and-convex-read-defect-sweep/

$ git status --porcelain -- convex/
(empty)

$ git diff HEAD -- convex/schema.ts
(empty)                                  -> SCHEMA_CLEAN
```

Three-bucket classification of every dirty path:

| Bucket | Contents |
|---|---|
| (i) files this phase owns | none dirty — all committed through `4c40d678` |
| (ii) `convex/**` this phase does NOT own | **EMPTY** — the dangerous bucket, and it is clean |
| (iii) everything else | `.planning/phases/126-page-body-and-convex-read-defect-sweep/`, untracked, belongs to another session, not under `convex/`, not deployable |

Because bucket (ii) was empty, the deploy shipped `convex/` exactly as committed at HEAD. Had it
been non-empty the plan's own instruction was to STOP and report, not to stage or revert another
session's work.

### Pre-deploy state of the target function (the control half of the contrast)

```
$ npx convex function-spec --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
  | grep -c 'listRecentRuntimeWindow'
0
```

**A zero here is not self-evidently meaningful**, so it was controlled before being believed. The
first attempt at this probe also returned nothing for a broader `events:` identifier grep, which
is exactly the shape of a broken probe. Controls run:

```
total functions listed                     -> 665
'listRecentUnified' (public, predates 125) -> 1     <- probe CAN see public functions
'listRecentRuntimeWindow'                  -> 0     <- therefore genuinely absent
target url in the spec output              -> https://lmofficenew.tail5bb6b3.ts.net
```

The URL line matters independently: it confirms `--env-file` resolved to the **self-hosted tailnet
instance**, not the retired cloud deployment `tidy-whale-981` (frozen 2026-07-15) that a bare
`npx convex deploy` can target.

Noted per CLAUDE.md: `function-spec` lists **PUBLIC functions only**, so this evidence is about
public functions and nothing else. That is sufficient here because `listRecentRuntimeWindow` is
public by design (plan 125-02), but it would be worthless for an `internal.*` function.

## Task 2 — Operator decision

Larry authorised "Yes, run 125-07 now" via an explicit decision prompt that quoted the exact
command, before the audit ran. The audit then came back clean — bucket (ii) empty, SCHEMA_CLEAN —
so it contained nothing capable of changing that decision, and the orchestrator proceeded on the
existing authorisation rather than asking him to re-confirm the same choice with no new
information. **The gate exists to surface surprises; there were none.** A non-empty bucket (ii)
would have sent this back to him.

## Task 3 — The deploy

```
$ npx convex deploy --env-file "C:\Users\mandr\convex-selfhost\selfhosted.envfile" -y

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
```

`✔ No indexes are deleted by this push` is the specific line that matters. Per CLAUDE.md, a
`Deleted table indexes:` line is the **only** announcement a working-tree deploy gives of a schema
rollback. It came back clean, satisfying the must_have that no index be added or removed.

## Post-deploy verification

### Before/after contrast

| Probe | Before | After |
|---|---|---|
| `listRecentRuntimeWindow` in function-spec | **0** | **1** |
| `listRecentUnified` (control) | 1 | 1 |
| backend `/version` | HTTP 200 | HTTP 200 |

The control being unmoved is what makes the 0 -> 1 attributable to the deploy rather than to a
change in the probe.

### The function does not merely exist — it runs, and its bounds hold on live data

`npx convex run events:listRecentRuntimeWindow '{}'`:

```
rows returned  : 16 / cap 500      truncated: False
keys per row   : ['_id', 'eventType', 'timestamp']
sanity now     : 2026-08-24 11:32:56
newest row     : 2026-08-24 11:32:39
oldest row     : 2026-08-24 11:31:57
row SPAN (s)   : 41.6
oldest age at call end (s): 59.0

SPAN WITHIN WINDOW : True
NO data LEAK       : True
ORDER newest-first : True
```

**The control that makes the window claim mean something:** a bound looks enforced for free if the
table simply contains nothing older than the window. It doesn't —

```
CONTROL - sibling listRecentUnified reaches back to 2026-08-24 11:27:51 (5.1 min ago)
CONTROL - rows older than 60s DO exist and were correctly excluded: True
```

So rows outside the window were present and were filtered out. The `data` field (a `v.any()` that
can carry whole tool-argument payloads) never appears in the projection, and ordering is
newest-first as specified.

The `sanity now` line is there deliberately: telemetry timestamps in this system are **epoch
seconds**, and a threshold check written against milliseconds would compare 1970 dates and pass
vacuously. The formatted value reads as today, so the comparison is real.

## A probe error worth recording

The first window check reported `WINDOW BOUND HOLDS: False` at an oldest-row age of 83.8s, which
looked like a live defect in 125-02's query. It was not — the JSON had been captured in one shell
command and analysed in a later one, so the gap between capture and analysis was being charged to
row age. The bound is about the query's own clock, not the analyst's. Re-run with the capture and
the timestamp taken inside a single process, it passes at 41.6s span / 59.0s oldest.

Recording it because the failure mode is general: **any freshness assertion computed across two
separate tool calls silently includes the inter-call latency**, and here that was enough to
manufacture a 24-second phantom violation of a 60-second bound.

## Deviations from plan

None substantive. The plan's Task 3 anticipated an executor writing this summary; it was written by
the orchestrator for the reason given under "Why this ran inline".

## What this unblocks

Plan 125-11 mounts the ECG hero and is the first consumer. 125-09 calls this query imperatively
inside try/catch (never through `useQuery`), so an absent function would have degraded the trace
rather than unmounting the React tree — but a permanently degraded trace is still a broken
feature, which is why this deploy precedes the mount rather than following it.
