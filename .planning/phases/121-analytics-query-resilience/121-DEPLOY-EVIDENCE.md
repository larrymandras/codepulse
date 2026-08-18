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

### 4. Deploy — RE-ATTEMPTED BY THE OPERATOR (not this executor)

The prior executor's escalation was resolved out-of-band: the operator ran the deploy themselves,
at the keyboard, because `npx convex deploy` is refused by the Claude Code auto-mode permission
classifier for any agent-driven attempt. **This executor did not run this command.** It is recorded
here, attributed to the operator, exactly as relayed by the orchestrator.

```
$ npx convex deploy --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile -y
```

Output (verbatim, as relayed by the orchestrator):

```
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

**`Deleted table indexes:` check (T-121-29): the line is ABSENT.** The deploy instead printed its
affirmative counterpart, `✔ No indexes are deleted by this push`. No schema rollback occurred.
Target was `http://127.0.0.1:3210` — the self-hosted backend — never the retired cloud deployment
`tidy-whale-981`.

### 5. Post-deploy interface probes — run by the ORCHESTRATOR (not this executor)

Via unauthenticated `POST http://127.0.0.1:3210/api/query`, attributed to the orchestrator, relayed
verbatim:

```
llm:providerBreakdown -> {"status":"success","value":{"asOf":null,"expectedBuckets":720.0,"presentBuckets":0.0,"rows":[],"rowsRead":0.0,"truncated":false}}
llm:costByModel       -> {"status":"success","value":{"asOf":1787068800.0,"expectedBuckets":720.0,"presentBuckets":494.0,"rows":[{"calls":0.0,"model":"claude-cli","tokens":47230466.0},{"calls":0.0,"model":"claude-sonnet-4-6","tokens":4732822.0}, ...]}}
llm:latencyOverTime   -> {"status":"error","errorMessage":"[Request ID: 381ac9d0d60e4a1d] Server Error\nCould not find public function for 'llm:latencyOverTime'.\n"}
llm:costByProvider    -> {"status":"error","errorMessage":"[Request ID: e9164b7a7c21894c] Server Error\nCould not find public function for 'llm:costByProvider'.\n"}
CONTROL llm:notARealFn9x7q2 -> {"status":"error","errorMessage":"[Request ID: 4d2ed004607ef0d0] Server Error\nCould not find public function for 'llm:notARealFn9x7q2'.\n"}
```

**Read of these five probes:**
- `llm:providerBreakdown` returns the NEW shape (`rows`, `asOf`, `expectedBuckets`, `presentBuckets`,
  `rowsRead`, `truncated`) — the deploy landed. But `rows: []`, `presentBuckets: 0`, `asOf: null`:
  ZERO `calls` metric buckets exist yet. This phase added the `calls` rollup (121-01); nothing has
  materialized it. The Provider Comparison panel on `/analytics` is empty in production right now —
  closing that gap is Task 3's backfill below.
- `llm:costByModel` confirms this from the other side: `presentBuckets: 494` of `tokens` data
  (pre-existing, unaffected by this migration), but every model shows `calls: 0.0` — the same missing
  `calls` rollup.
- `llm:latencyOverTime` and `llm:costByProvider` both return `Could not find public function` — the
  deletion landed.
- The **control**, `llm:notARealFn9x7q2`, returns the IDENTICAL error text
  (`Could not find public function for 'llm:notARealFn9x7q2'`). This is what makes the two deletion
  results a real measurement rather than an unfalsifiable absence: the probe demonstrably
  distinguishes "deployed and reachable" from "no such function", and `costByProvider`/
  `latencyOverTime` land in the same bucket as the known-nonexistent control, not in the
  known-present bucket occupied by `providerBreakdown`/`costByModel`.

**Task 2 acceptance criteria — final status:** all five commands recorded verbatim with their exact
command lines (git status, git log SHA, cursor read, deploy, post-deploy probes); deploy line
contains `--env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`; no recorded command contains
`--push`; `Deleted table indexes:` explicitly checked and confirmed absent; `providerBreakdown`
returns the required key set; `latencyOverTime` returns the required control error; pre-run cursor
(`"done"`, latched) recorded above with its one-line note. **Task 2 is now DONE**, continuing to
Task 3 below.

## Task 3: Run the resumed backfill chain, then measure the live rollup magnitude

Run by this executor (`npx convex run` with a read-or-write mutation form — verified to pass the
Claude Code auto-mode classifier; only `convex deploy` is blocked).

### Backfill chain — command, stop condition, iteration guard

Each link:

```
$ npx convex run aggregates:backfillTokenSplit '{"maxHours": 6}' --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile
```

Driven from a shell loop with both an explicit stop condition and an explicit iteration guard
(`maxHours` fixed at 6 in every invocation, never raised):

```bash
prev_progress=1
for i in $(seq 2 200); do              # iteration guard: hard cap 200
  OUT=$(npx convex run aggregates:backfillTokenSplit '{"maxHours": 6}' --env-file "$ENVFILE" 2>&1)
  hp=$(echo "$OUT" | grep -o '"hoursProcessed": *[0-9]*' | grep -o '[0-9]*')
  if echo "$OUT" | grep -q '"done": true'; then break; fi        # stop condition
  if [ "${hp:-0}" = "0" ] && [ "$prev_progress" = "0" ]; then     # no-progress-twice guard
    echo "NO PROGRESS TWICE IN A ROW -- STOPPING"; break
  fi
  prev_progress="${hp:-0}"
done
```

Link 1 (run in Task 2's investigation, before this loop started — first invocation of this pass):

```json
{"done": false, "hoursProcessed": 6, "nextCursor": 1787050800, "rowsInserted": 13, "truncatedHours": []}
```

Links 2–120 ran via the loop above. **Total invocations this pass: 120** (link 1 + 119 loop
iterations). The loop terminated on its STOP CONDITION (`"done": true`) at link 120 — the
200-iteration guard was never reached, and the no-progress-twice guard never tripped (every `0`
`hoursProcessed`-progress link — links 26, 82, 97, 99, 103, 107, 111, 115, 119 — was immediately
followed by a nonzero link; there is no case of two `0`s in a row in the recorded log).

**Final payload (link 120, verbatim):**
```json
{
  "done": true,
  "hoursProcessed": 6,
  "nextCursor": 1787072400,
  "rowsInserted": 3,
  "truncatedHours": []
}
```

**Summed `rowsInserted` across all 120 invocations: 895** (re-derived from the raw log, not carried
forward from any running total — `grep -o '"rowsInserted": *[0-9]*' | ... | awk '{s+=$1}'`).

**Union of `truncatedHours` across all 120 invocations: none.** Every single link returned
`"truncatedHours": []` — confirmed by `grep -o '"truncatedHours": \[[^]]*\]' | sort -u` on the full
log, which returns exactly one distinct value: `"truncatedHours": []`. No hour hit the
`LLM_WINDOW_READ_CAP` (4000 rows) during this backfill; nothing undercounts.

120 invocations × 6 hours = 720 hours = exactly the 30-day retention window this phase's `calls`
metric needed to cover.

`docker stats convex-backend` was sampled every 10 links per the plan's memory-watch instruction; no
zeros/reconnect symptom occurred at any checkpoint and the run completed cleanly. (Raw samples are in
the scratch log used to drive this loop; not reproduced here as they showed nothing to escalate.)

**Post-run cursor value** (same `--inline-query` read used in Task 2, re-run after the chain):
newest row (highest `_creationTime`) is `{"_creationTime": 1787079284467.04, "value": 1787072400}` —
matches link 120's `nextCursor` exactly. Per Plan 121-01's reset-on-completion behavior (not a
latch), this is the freshest fully-completed hour, not the string `"done"` — a future invocation
would reset to a fresh pass from the current hour rather than resuming this now-closed one.

### Measurement — post-backfill

```
$ npx convex run llm:providerBreakdown '{}' --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile
```
```json
{
  "asOf": 1787072400,
  "expectedBuckets": 720,
  "presentBuckets": 499,
  "rowsRead": 889,
  "truncated": false,
  "rows": [
    {"provider": "claude-cli", "calls": 614},
    {"provider": "anthropic_direct", "calls": 3289},
    {"provider": "anthropic_advisor", "calls": 780},
    {"provider": "claude-sdk", "calls": 43},
    {"provider": "antigravity", "calls": 333},
    {"provider": "codex", "calls": 515},
    {"provider": "grok", "calls": 8},
    {"provider": "openai", "calls": 22},
    {"provider": "gemini", "calls": 3},
    {"provider": "gemini_openrouter", "calls": 201}
  ]
}
```

```
$ npx convex run llm:costByModel '{}' --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile
```
```json
{
  "asOf": 1787068800,
  "expectedBuckets": 720,
  "presentBuckets": 499,
  "rowsRead": 1773,
  "truncated": false,
  "rows": [16 models — claude-cli:614 calls/47230466 tok, claude-sonnet-4-6:410/4732822,
    claude-sonnet-5:1301/11039719, claude-haiku-4-5-20251001:151/1021381, claude-sdk:43/0,
    antigravity:333/0, codex:515/0, claude-haiku-4-5:2158/13034018, claude-opus-4-8:46/825160,
    grok-4.5:8/178465, claude-fable-5:1/146, gpt-4.1:22/396461, gemini-2.5-flash:3/677,
    google/gemini-3.6-flash:7/137681, google/gemini-2.5-flash:194/3137458, claude-opus-4-6:2/1820]
}
```

**Acceptance signal check (this plan's real acceptance criterion, per the dispatch): `rows` is
non-empty and `presentBuckets > 0` for `providerBreakdown`.** Before the backfill: `rows: []`,
`presentBuckets: 0`. After: 10 provider rows, `presentBuckets: 499`. **The empty Provider Comparison
panel is fixed.**

**`asOf` unit sanity line** (printed before drawing any freshness conclusion):
`providerBreakdown.asOf = 1787072400` → `2026-08-18T17:00:00Z`; `costByModel.asOf = 1787068800` →
`2026-08-18T16:00:00Z`. Measured against wall clock at the moment of this probe (`2026-08-18T18:55Z`):
deltas of 1h55m and 2h55m respectively — both within the last 24 hours, both consistent with epoch
SECONDS (a milliseconds misreading would land in 1970). This confirms the unit is seconds, not
millis, and the value is fresh (the extra ~1-2h beyond the docstring's "up to 60 minutes permanently
absent" reflects when this executor happened to run the probe within the current hour, not a defect).

**`ROLLUP_READ_CAP` decision:** `ROLLUP_READ_CAP = 8000` (`convex/llm.ts:19`). Measured `rowsRead`:
`providerBreakdown` = 889 (11.1% of cap), `costByModel` = 1773 (22.2% of cap). Both `truncated: false`.
Neither exceeds 50% of the cap (4000). **Decision: no change needed — `ROLLUP_READ_CAP` stays at
8000.** This is the measurement `121-RESEARCH.md` Q5 flagged as never taken; it is now taken, and the
existing constant is confirmed correctly sized rather than assumed.

**Cross-check against `subscriptionUsage`:**

Subscription-billed providers, from `convex/lib/providers.ts` `PROVIDER_BILLING`: `ollama`,
`claude-cli`, `codex`, `antigravity`.

*Expected relationship, stated BEFORE reading the observed numbers:* `subscriptionUsage` reads raw
`llmMetrics` with a continuous rolling 30-day cutoff evaluated at query time; `providerBreakdown`
reads the hourly `calls` rollup, which only covers up through the most recently *completed* hour
(the docstring's "up to 60 minutes permanently absent" gap) and only hours this backfill chain has
actually materialized. So the sum of `providerBreakdown`'s subscription-provider rows should be
CLOSE TO but not exceed `subscriptionUsage.calls` — a small gap from the freshness lag is expected;
a large gap or the rollup sum exceeding the raw sum would indicate double-counting or a window bug.

*Observed:* `subscriptionUsage` → `{"calls": 1463, "tokens": 47368105, "truncated": false}`.
`providerBreakdown` subscription-provider sum: `claude-cli` 614 + `antigravity` 333 + `codex` 515 +
`ollama` (absent from the rows, i.e. 0) = **1462**. `1462` vs `1463` — a gap of exactly 1 call, i.e.
`providerBreakdown` (rollup) is 1 call BELOW `subscriptionUsage` (raw, continuous cutoff), consistent
with the expected direction (rollup lags raw by the current partial hour) and far smaller than would
indicate a double-count or window bug. **Matches the expected relationship — no disagreement to
report.**

### `graphify update .`

```
$ graphify update .
```
Ran to completion: `AST extraction: 1177/1177 uncached files (100%)`, then
`[graphify watch] No code-graph topology changes detected; outputs left untouched.` — expected, since
this task only ran commands against the live backend and wrote to this evidence file; no `convex/`
or `src/` source was modified.

**No bulk delete or bulk patch was issued against any table.** Every write in this task was the
backfill's own single-row `ctx.db.insert` calls (`insertTokenSplitBuckets`), exactly as designed.
