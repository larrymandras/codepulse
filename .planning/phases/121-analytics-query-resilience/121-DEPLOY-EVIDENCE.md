# Phase 121 Plan 07 — Deploy Evidence

Every command below is recorded with its exact command line and verbatim output. No command in
this file contains `--push`. No secret values are printed anywhere.

## Task 1: Confirm no external consumer before the deletions become observable

**Approval status: APPROVED by the operator, relayed by the orchestrator's pre-dispatch sweep.**
This checkpoint was presented to the operator by the orchestrator BEFORE this executor was
dispatched, and the operator's `approved` reply was already returned when this executor started.
This executor did not re-ask; it is recording that approval and the sweep evidence that produced it
verbatim, per the orchestrator's explicit instruction.

**Operator decision:** APPROVED — no external caller of `llm:costByProvider` or
`llm:latencyOverTime`. Deletion may become observable.

**Endpoints being deleted, spelled exactly as an external caller would spell them:**
- `llm:costByProvider`
- `llm:latencyOverTime`

**`git status --porcelain` at approval time (captured by the orchestrator before presenting the
checkpoint):** empty (clean working tree). **HEAD at approval time:** `b23e2810`.

**Evidence the orchestrator gathered before asking** (reproduced verbatim from the dispatch
message; attributed to the orchestrator's pre-dispatch sweep, not to a probe run by this executor):

Live-backend state at approval time, via unauthenticated `POST http://127.0.0.1:3210/api/query`:
- `llm:costByProvider` → `{"status":"success", ...}` returning real per-provider cost data
- `llm:latencyOverTime` → `{"status":"success", ...}` returning real latency rows
- `llm:providerBreakdown` → `{"status":"success", value: [{avgLatency, calls, cost, provider}, ...]}`
  — the OLD ARRAY shape, i.e. the new code is provably not yet deployed
- CONTROL `llm:notARealFn9x7q2` → `{"status":"error", ... "Could not find public function for
  'llm:notARealFn9x7q2'."}` — so the probe discriminates present from absent

Consumer sweep, all zero live callers:
- `codepulse` `src/`+`convex/`: 0 (remaining hits are `.planning/` docs only; control:
  `costByModel` found in 32 files)
- `astridr-repo`: 0 live callers — 6 hits in archived `.planning/` milestone artifacts citing
  codepulse's `costByProvider` as a pattern to copy, plus 1 in `docs/codepulse-prd-v3.md:2934`,
  an illustrative `useQuery(api.llm.costByProvider, { hours: 24 })` snippet whose `hours` argument
  the live signature does not even accept (stale design doc). Control: 800 files mention `codepulse`
- `~/scripts`: 0 (control: 5 files mention `convex`)
- `convex-selfhost`: 0 — only hits are inside `retention-health.log`, a dumped inventory of every
  public function, and no `.ps1`/`.mjs`/`.js`/`.py`/`.sh` there references either name
  (control: 95 files mention `convex`)
- Windows scheduled tasks: 0 of 248 have either name in their action arguments (control: 248 tasks enumerated)

Working tree at approval time: CLEAN. HEAD was `b23e2810`.

**Resume signal received: `approved`.** Proceeding to Task 2.

## Task 2: Deploy to the self-hosted backend and record the backfill cursor's pre-run state

### 1. `git status --porcelain` (re-checked immediately before deploy)

```
$ git status --porcelain
?? .planning/phases/121-analytics-query-resilience/121-DEPLOY-EVIDENCE.md
```

**Statement of what would ship:** The only dirty entry is this evidence file itself
(`121-DEPLOY-EVIDENCE.md`), created moments earlier by this executor as this plan's own declared
`files_modified` output (see plan frontmatter). `convex.json` reads `{"functions": "convex/"}` —
the deploy bundles only the `convex/` directory as the function payload, and this file sits under
`.planning/`, outside that bundle. No concurrent-session change is present. Safe to proceed.

### 2. `git log -1 --format=%H` (base SHA the working tree is built on)

```
$ git log -1 --format=%H
b23e281018db0375b02fd242b54ab21f2f704ee9
```

Any later before/after control anchors on this explicit SHA (`b23e2810`), never on `HEAD~1`.

### 3. Backfill cursor's pre-deploy value

No generic exported public/internal query exists in `convex/` that reads an arbitrary
`agentConfigs` row by key (checked: no `agentConfigs.ts` module; grepped `by_key`/`configKey`
across `convex/` and found only call-site-specific readers, e.g. `retention_days`,
`alert-rule-override:*`, `alert-rules-disabled` — none generic). Per the plan's `<read_first>`
fallback ("If no such query exists, use the self-hosted Convex dashboard and say so"), this
executor instead used the Convex CLI's own sandboxed, read-only `--inline-query` evaluator
(`npx convex run --inline-query '...'`) — read-only by construction ("completely sandboxed... can
only read data and cannot modify the database or access the network"), not a hand-constructed
public function name, and not a dashboard session this executor cannot drive:

```
$ npx convex run --inline-query 'const rows = await ctx.db.query("agentConfigs").withIndex("by_key", (q) => q.eq("configKey", "phase104.tokenSplitBackfill.cursor")).collect(); return rows.map(r => ({ value: r.value, _creationTime: r._creationTime }));' --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile
```

Output: 121 rows returned, ascending by `_creationTime` (Convex's default `collect()` order, per
`aggregates.ts`'s own comment that "the last row... is the most recently written cursor value").
The LAST (newest) row:

```json
{ "_creationTime": 1785517319950.5725, "value": "done" }
```

**Pre-run cursor value: `"done"`. It IS latched** — a legacy terminal sentinel from a completed
prior pass (Phase 104's original `backfillTokenSplit` run, before Plan 121-01's de-latch fix
shipped). This is a **recorded fact, not a blocker**: Plan 121-01 rewrote the handler so a `"done"`
(or any non-finite) cursor value is treated as "start fresh" rather than short-circuiting — see
`convex/aggregates.ts:824-828`. Once the deploy below lands, the next `backfillTokenSplit`
invocation will read this exact `"done"` row, restart from `startingHour`, and (being
per-dimension-key idempotent) re-cover the whole retention window while only newly writing the
`calls` metric type Plan 121-01 added — this is the answer to `121-RESEARCH.md` Q3's previously
unresolved question.

### 4. Deploy

```
$ npx convex deploy --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile -y
```

**BLOCKED — not run.** The command was denied by the Claude Code auto-mode permission classifier
before it executed (no convex/network output was produced; nothing was sent to the backend):

```
Permission for this action was denied by the Claude Code auto mode classifier.
Reason: Blocked by classifier.
```

This is a genuine production write to the live self-hosted backend, so this executor is NOT
retrying the same command, NOT attempting an alternate tool/route to the same effect, and NOT
proceeding to Task 3 (which depends on the deploy having landed). Escalated to the orchestrator —
see the return report. **STOPPED HERE. Tasks 2 (deploy onward), 3, and 4 are NOT complete.**
