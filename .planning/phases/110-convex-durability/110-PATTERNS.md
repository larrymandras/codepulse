# Phase 110: Convex Durability - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 7 (all MODIFY except one CREATE)
**Analogs found:** 7 / 7 (all in-repo; several files ARE their own closest analog — this is a
surgical-extension phase, not a new-surface phase, so "copy the neighboring idiom" mostly means
"copy the idiom that already lives three functions above the one you're editing")

**Verification note:** every quote below was re-read directly from the live file in this session
(not carried over from CONTEXT.md/RESEARCH.md's prose) and line numbers are corrected against
that read where they drifted from the upstream docs' citations (noted inline). Nothing below
reads other than as CONTEXT.md/RESEARCH.md describe it — no staleness found.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/retention.ts` | service (`internalMutation`, cron-driven) | batch/CRUD-delete | `convex/analyticsRollup.ts` (`clearHistoricalBucketsPage`) for the predicate; `convex/webhookDelivery.ts` (`setChannel`) for the rotation-cursor patch | exact (same file family; both cited patterns are prior art living in sibling modules) |
| `convex/retentionCursor.ts` | utility (pure, dependency-free) | transform | itself (`planNextPruneStep`) — D-05's rotation write is new logic in the same spirit, no closer external analog exists | exact — extend the existing shape, don't import a new one |
| `convex/retention.test.ts` | test | transform/assertion | its own D-13 exemption test (`retention.test.ts:70-90`) — the shape D-03's positive guard must follow | exact |
| `convex/retentionCursor.test.ts` | test | transform/assertion | its own monotonic-run test (`retentionCursor.test.ts:90-126`) — the shape a Pitfall-1 regression test should follow | exact |
| `C:/Users/mandr/convex-selfhost/retention-health-check.ps1` | ops script (PowerShell, outside git) | request-response (CLI poll) | itself, lines 95-130 (per-table probe loop) — D-07 replaces the hashtable at lines 38-54, not the loop shape | exact |
| `.planning/phases/110-convex-durability/110-DUR-EVIDENCE.md` | evidence doc (CREATE) | file-I/O (verbatim transcript) | `.planning/phases/109-per-agent-engine-ui/109-LIVE-EVIDENCE.md` (section-per-gate, verdict-under-transcript) and `108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md` (task-per-heading, secret-redaction preamble) | exact — two live precedents, pick whichever heading shape fits DUR-02/DUR-03's two-leg structure |
| `CLAUDE.md` | config/docs | — | its own "Self-Hosted Convex — Operational Rules" section, `CLAUDE.md:86-95` | exact — D-11 adds one bullet to an existing list, not a new section |

## Pattern Assignments

### `convex/retention.ts` (service, batch/CRUD-delete) — MODIFY

**Read live, full file, 216 lines — matches CONTEXT.md/RESEARCH.md's description exactly.**
`RETENTION_DAYS` has **18 keys** (verified by direct count: 6 firehose @ 14d, 1 poll @ 30d, 8
build/history @ 90d, `toolPolicyEvents` @ 90d, `activeEngineSnapshots`/`controlVerbSwaps` @ 30d —
confirms D-07's "18 keys" claim exactly, not stale). The `prompts`/`promptVersions` D-13 exemption
comment is at **lines 79-95** (CONTEXT.md cites this range correctly).

**Analog 1 — the predicate shape to copy** (`convex/analyticsRollup.ts:271-292`,
`clearHistoricalBucketsPage`):
```typescript
// internalMutation: delete one bounded page of historical event/sankey buckets
// (bucket_start < cutoffHour). Looped from the action until it returns 0.
export const clearHistoricalBucketsPage = internalMutation({
  args: { cutoffHour: v.float64(), limit: v.float64() },
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const metric_type of ["events", "sankey_edge"] as const) {
      const rows = await ctx.db
        .query("aggregates")
        .withIndex("by_type_period_bucket", (q) =>
          q.eq("metric_type", metric_type).eq("period", "hourly").lt("bucket_start", args.cutoffHour)
        )
        .take(args.limit);
      for (const r of rows) {
        await ctx.db.delete(r._id);
        deleted++;
      }
      if (deleted >= args.limit) break; // respect the per-mutation write budget
    }
    return { deleted };
  },
});
```
This is the **second, pre-existing writer** on `aggregates` the new predicate must not collide
with (RESEARCH.md's collision analysis) — it deletes by `bucket_start` via `by_type_period_bucket`,
a **different index and field** than the nightly prune's `_creationTime`-keyed
`by_creation_time` seek. Document it in the new `PRUNE_PREDICATES` comment as RESEARCH.md's
illustrative code already does, so a future editor doesn't rediscover it as a surprise.

**Analog 2 — the exact delete loop being modified** (`convex/retention.ts:159-165`, current):
```typescript
let deleted = 0;
let lastCreationTime: number | null = null;
for (const doc of batch) {
  await ctx.db.delete(doc._id);
  deleted++;
  lastCreationTime = doc._creationTime;
}
```
The D-02/Pitfall-1 fix moves `lastCreationTime = doc._creationTime` **outside** the (new)
predicate-gated delete — RESEARCH.md's illustrative replacement is correct and should be copied
verbatim in shape:
```typescript
for (const doc of batch) {
  if (!predicate || predicate(doc)) {
    await ctx.db.delete(doc._id);
    deleted++;
  }
  lastCreationTime = doc._creationTime; // unconditional
}
```

**Analog 3 — the cursor-seek query the predicate must not disturb** (`convex/retention.ts:151-157`,
verified verbatim, unchanged by this phase):
```typescript
const batch = await ctx.db
  .query(table as any)
  .withIndex("by_creation_time", (q: any) =>
    q.gte("_creationTime", cursorMs).lt("_creationTime", cutoffMs)
  )
  .order("asc")
  .take(BATCH_SIZE);
```
The predicate (D-02) must apply **after** this returns, inside the delete loop — never folded
into the query itself, which would break the `by_creation_time` cursor-seek machinery D-02
explicitly requires reusing unmodified.

**Analog 4 — the rotation cursor's read/write idiom to copy**, `convex/webhookDelivery.ts:36-65`
(`setChannel`, full get-existing-or-patch call site):
```typescript
export const setChannel = mutation({
  args: {
    channel: v.union(v.literal("discord"), v.literal("slack")),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.url.startsWith("https://")) {
      throw new Error(
        "Invalid webhook URL. Paste a full Discord or Slack webhook URL starting with https://."
      );
    }
    const configKey = `webhook-${args.channel}-url`;
    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", configKey))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.url,
        updatedAt: Date.now() / 1000,
      });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey,
        value: args.url,
        updatedAt: Date.now() / 1000,
      });
    }
  },
});
```
This is the **read** shape too (`.query("agentConfigs").withIndex("by_key", q => q.eq("configKey",
...)).first()`), reused identically for the D-06 rotation-cursor read at `startNightlyPrune`'s
top and the two chain-terminal writes (`cap-reached`, `done`) inside `pruneBatchV3`. `agentConfigs`
schema (`convex/schema.ts:261-266`) is `{ configKey: string, value: any, source?: string,
updatedAt: float64 }`, indexed `by_key` on `configKey` — exactly what this call site assumes.

**ANTI-PATTERN — do NOT copy this for the rotation cursor** (`convex/aggregates.ts:625-708`,
`backfillDailyRollup`'s cursor, the insert-only idiom):
```typescript
const DAILY_ROLLUP_BACKFILL_CURSOR_KEY = "cost01.dailyRollupBackfill.cursor";
// ...
const cursorRows = await ctx.db
  .query("agentConfigs")
  .withIndex("by_key", (q) => q.eq("configKey", DAILY_ROLLUP_BACKFILL_CURSOR_KEY))
  .collect();
// Insert-only cursor: last row (ascending _creationTime) is current.
const cursorRow = cursorRows.length > 0 ? cursorRows[cursorRows.length - 1] : null;
// ...
await ctx.db.insert("agentConfigs", {
  configKey: DAILY_ROLLUP_BACKFILL_CURSOR_KEY,
  value: nextCursorValue,
  source: "runtime",
  updatedAt: Date.now() / 1000,
});
```
`convex/aggregates.ts:713-834` (`backfillTokenSplit`'s `TOKEN_SPLIT_BACKFILL_CURSOR_KEY`) repeats
the identical shape. **Why this is wrong for D-06:** it `ctx.db.insert`s a **new row every call**
and reads back via `.collect()` + take-the-last-by-insertion-order — the row count grows forever.
That is correct for these two functions because they are **operator-run resumable backfills**
(manual, rare, and the growing history is itself useful audit trail for a one-shot repair job).
D-06 explicitly wants "never grows" — a nightly-run cursor using this idiom would insert ~365
rows/year into `agentConfigs` forever, the exact unbounded-growth failure mode this whole phase
exists to prevent elsewhere. Use the `webhookDelivery.ts` patch idiom (Analog 4) instead:
`existing ? ctx.db.patch(existing._id, {...}) : ctx.db.insert(...)` — one row, forever.

### `convex/retentionCursor.ts` (utility, pure/dependency-free) — MODIFY

**Read live, full file, 121 lines.** `planNextPruneStep` (lines 83-120) is unchanged by D-05 per
RESEARCH.md's analysis — verified correct: its `Math.max(lastCreationTime ?? cursorMs, cursorMs)`
clamp at line 111 already defensively handles a null `lastCreationTime`, which is exactly the
input Pitfall 1's fix now guarantees never happens for a live batch. **No analog needed from
elsewhere in the repo** — this module has no sibling; it is itself the established pattern
("extract chain-decision logic into a dependency-free, directly-testable function, since this
repo has no `convex-test` harness" — module docstring lines 33-35). If Open Question 1 resolves
toward extraction, the shape to match is this file's own header docstring style (a `/** ... */`
block explaining *why*, then a typed interface, then the pure function) plus a **file-level doc
comment**, not inline comments only — see lines 1-58 for the full pattern to replicate for any
new sibling (e.g. a `planRotationWrite`-shaped helper).

### `convex/retention.test.ts` (test) — MODIFY

**The exact guard D-03 narrows**, read live and verbatim (`convex/retention.test.ts:92-102` —
corrects CONTEXT.md's cited `92-101`, which is off by one line; the `it(...)` block runs through
line 102):
```typescript
it("still keeps the cost/trend tables forever — pruning these would break dashboards", () => {
  // Phase 104 derives dollars from `aggregates` token buckets on every read, so
  // pruning aggregates or llmMetrics would silently destroy re-priceable history
  // (D-04). retention.ts's header comment states this; assert it.
  for (const keepForever of ["aggregates", "llmMetrics", "sessions", "alerts"]) {
    expect(
      Object.keys(RETENTION_DAYS),
      `${keepForever} must NOT be pruned`
    ).not.toContain(keepForever);
  }
});
```
D-03 narrows the loop to `["llmMetrics", "sessions", "alerts"]` (dropping `"aggregates"`, which
this phase legitimately adds as a `RETENTION_DAYS` key) and adds a **positive** guard alongside
it, asserting against the predicate function directly — not a comment. RESEARCH.md's suggested
assertion is correct and copy-ready:
```typescript
import { PRUNE_PREDICATES } from "./retention";
it("the aggregates predicate can never delete a period:daily row", () => {
  expect(PRUNE_PREDICATES.aggregates!({ period: "daily" })).toBe(false);
  expect(PRUNE_PREDICATES.aggregates!({ period: "hourly" })).toBe(true);
});
```

**The exact shape this positive guard should follow** — the Phase 116 D-13 exemption test,
`convex/retention.test.ts:70-90` (read live, verbatim), which is the established
"deliberate-exemption documented in place, and the test asserts the documentation exists"
pattern (CONTEXT.md's `<code_context>` "Established Patterns" section names this correctly):
```typescript
it("prompts and promptVersions are exempt by design (Phase 116 D-13)", () => {
  // Absence assertions alone would pass vacuously against an empty or
  // mis-imported RETENTION_DAYS — controlVerbSwaps is a known-present
  // control in the same assertion style.
  expect(Object.keys(RETENTION_DAYS)).not.toContain("prompts");
  expect(Object.keys(RETENTION_DAYS)).not.toContain("promptVersions");
  expect(Object.keys(RETENTION_DAYS)).toContain("controlVerbSwaps");

  // Prove the absence above is a real exemption of real tables, not a typo:
  // both tables actually exist in schema.ts.
  expect(schemaTables.has("prompts")).toBe(true);
  expect(schemaTables.has("promptVersions")).toBe(true);

  // The exemption must be documented in place, not merely absent — read
  // convex/retention.ts's own source the same way this file already reads
  // convex/schema.ts's source above.
  const retentionSource = readFileSync(resolve(process.cwd(), "convex/retention.ts"), "utf-8");
  expect(retentionSource).toContain("D-13");
  expect(retentionSource).toContain("prompts");
  expect(retentionSource).toContain("promptVersions");
});
```
D-03's guard should mirror this: a known-present control (e.g. `RETENTION_DAYS.aggregates ===
90`), a positive behavioral assertion against `PRUNE_PREDICATES.aggregates` itself (not a string
match — the plan's own predicate is directly callable, unlike D-13's comment-only exemption which
has nothing callable to assert against), and optionally a `retentionSource.toContain("D-0X")`
style provenance check if the new code carries a decision-ID comment the way D-13's does.

**The "harness liveness check" pattern already used at the top of this file** (`retention.test.ts:
28-35`) — worth reusing if the D-03 predicate guard adds any new source-parsing:
```typescript
it("parsed a plausible set of tables out of schema.ts (harness liveness check)", () => {
  // Guard the guard: if the regex ever stops matching, every assertion below
  // would pass vacuously against an empty set.
  expect(schemaTables.size).toBeGreaterThan(20);
  expect(schemaTables.has("alerts")).toBe(true);
  expect(schemaTables.has("llmMetrics")).toBe(true);
});
```

### `convex/retentionCursor.test.ts` (test) — MODIFY

**Read live, full file, 134 lines.** The `step()` test helper (lines 20-32) defaults
`tableCount: 14` — RESEARCH.md's note that this is a self-consistent fixture unaffected by
`RETENTION_DAYS` growing to 19 real entries is confirmed correct by direct read; no existing
assertion here needs editing for D-05/D-06, only new tests added (matches RESEARCH.md's
"Wave 0 Gaps" recommendation).

**The shape a Pitfall-1 regression test should follow** — the existing "holds the cursor steady"
test, `retentionCursor.test.ts:85-88` (closest existing case to "a batch that reports no advancing
timestamp must not stall"):
```typescript
it("holds the cursor steady rather than rewinding if a full batch reports no timestamp", () => {
  const s = step({ batchLength: BATCH_SIZE, lastCreationTime: null, cursorMs: 7_777 });
  expect(s.cursorMs).toBe(7_777);
});
```
This already tests `planNextPruneStep`'s defensive clamp in isolation — it does NOT need to
change. What Pitfall 1 actually needs is a **new test at the `retention.ts` call-site level**
(or a small extracted pure helper, if the planner chooses to pull the "compute lastCreationTime
from every returned doc" logic out for testability, mirroring how `planNextPruneStep` itself was
extracted — see the monotonic-run test below for the style to copy) proving a batch of
all-skipped docs still reports a non-null `lastCreationTime` to `planNextPruneStep`. Since
`pruneBatchV3` itself is untestable (no `convex-test` harness — same constraint noted throughout
this repo), the predicate-driven skip behavior has to be tested either as a tiny pure function
extracted from the loop, or accepted as covered only by the DUR-01 live confirmation leg
(RESEARCH.md's test map already flags this file as the Wave-0 gap for it).

**The "simulate a long run" style to copy** if a dedicated all-skipped-batch scenario test is
added, `retentionCursor.test.ts:90-126` (`"is monotonic across a long simulated run"`):
```typescript
it("is monotonic across a long simulated run — the property the old code violated", () => {
  // Simulate 600 batches of a firehose table, the shape that timed out in production.
  let cursor = 0;
  let batchesUsed = 0;
  let tableIndex = 0;
  const seen: number[] = [];

  for (let batch = 0; batch < MAX_BATCHES - 1; batch++) {
    const lastCreationTime = (batch + 1) * 1_000;
    const s = planNextPruneStep({
      batchLength: BATCH_SIZE,
      lastCreationTime,
      cursorMs: cursor,
      tableIndex,
      tableCount: 14,
      batchesUsed,
      maxBatches: MAX_BATCHES,
      batchSize: BATCH_SIZE,
    });
    if (s.action === "cap-reached") break;
    expect(s.action).toBe("continue-table");
    expect(s.cursorMs).toBeGreaterThan(cursor);
    cursor = s.cursorMs;
    tableIndex = s.tableIndex;
    seen.push(cursor);
    batchesUsed++;
  }
  // ...
});
```

### `C:/Users/mandr/convex-selfhost/retention-health-check.ps1` (ops script) — MODIFY

**Read live, lines 1-135 of 212 total.** Confirms CONTEXT.md's D-07 evidence exactly: the
`$RetentionDays` hashtable at **lines 39-54** has **14 entries** (direct count: runtime_events,
toolExecutions, activeTime, selfHealingEvents, fileOps, heartbeatAlerts, events,
environmentSnapshots, contextSnapshots, metricSnapshots, securityEvents, cronExecutions,
jobLifecycle, agentCoordination) against `RETENTION_DAYS`' 18 — `gatewayQuotaSnapshots`,
`toolPolicyEvents`, `activeEngineSnapshots`, `controlVerbSwaps` are indeed absent, matching
CONTEXT.md's claim precisely, not stale. The "Keep in sync if that map changes" comment is at
line 38, exactly as cited.

**The per-table probe loop to preserve unchanged** (`retention-health-check.ps1:95-130`, quoted
in full — this is the working, quoting-safe recipe, reuse its invocation shape for D-07's new
query call per RESEARCH.md):
```powershell
# --- per-table probe (one CLI call per table -- a looped inline-query over a table-name
# array silently produced no output when tried 2026-07-30, so this stays one call each) ---
$rows = @()
$anyTimeout = $false
$nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

foreach ($table in $RetentionDays.Keys) {
    $days = $RetentionDays[$table]
    # Single-quoted JS string literals only -- keeps this free of nested double-quotes
    # so the cmd /c wrapping below doesn't have to fight PowerShell/cmd quote parsing.
    $query = "const oldest = await ctx.db.query('$table').withIndex('by_creation_time', q => q).order('asc').take(1); return { t: oldest[0] ? oldest[0]._creationTime : null };"

    # cmd's captured output comes back as a String[] (one element per line) whenever it
    # spans more than one line -- -match against an array filters elements instead of
    # setting $matches, so this must be flattened to a single string first.
    $out = (cmd /c "cd /d `"$CodepulseDir`" && npx convex run --env-file `"$EnvFile`" --inline-query `"$query`" 2>&1") -join "`n"
    $ok = ($LASTEXITCODE -eq 0)

    if ((-not $ok) -or ($out -match 'SystemTimeout')) {
        $anyTimeout = $true
        $rows += [pscustomobject]@{ table = $table; status = 'TIMEOUT'; overhangHours = $null }
        Write-Log ("  {0} -> TIMEOUT: {1}" -f $table, ($out -join ' '))
        continue
    }

    if ($out -match '"t":\s*(\d+)') {
        $oldestMs = [double]$matches[1]
        $cutoffMs = $nowMs - ($days * 86400 * 1000)
        $overhangHours = [math]::Round(($cutoffMs - $oldestMs) / 3600000, 1)
        if ($overhangHours -lt 0) { $overhangHours = 0 }
        $rows += [pscustomobject]@{ table = $table; status = 'ok'; overhangHours = $overhangHours }
        Write-Log ("  {0} -> oldest doc overhang {1}h past {2}d cutoff" -f $table, $overhangHours, $days)
    } else {
        $rows += [pscustomobject]@{ table = $table; status = 'empty-or-caught-up'; overhangHours = 0 }
        Write-Log "  $table -> empty or fully caught up"
    }
}
```
**D-07's replacement for lines 38-54** (RESEARCH.md's recommendation, no nested quoting at all —
strictly simpler than the loop above's `--inline-query` pattern, and it is what gets substituted
*before* the loop, feeding `$RetentionDays.Keys`/`$RetentionDays[$table]` from a live query
instead of the hand-copied hashtable):
```powershell
$policyJson = (cmd /c "cd /d `"$CodepulseDir`" && npx convex run retention:listRetentionPolicy --env-file `"$EnvFile`" 2>&1") -join "`n"
$policy = $policyJson | ConvertFrom-Json    # PSCustomObject with one property per table
foreach ($table in $policy.PSObject.Properties.Name) {
    $days = $policy.$table
    # ...existing per-table probe body above, unchanged...
}
```
Note the loop body's variable names (`$table`, `$days`) are already exactly what the replacement
foreach produces — no rename needed elsewhere in the script.

### `.planning/phases/110-convex-durability/110-DUR-EVIDENCE.md` (evidence doc, CREATE)

Two live precedents in this repo, both read in full/partially this session — pick the shape that
fits DUR-02 (a two-leg checklist) + DUR-03 (a knob-found/knob-absent branch) best; either is a
legitimate analog, and RESEARCH.md's Open Question 2 recommendation (one file, `## DUR-02` /
`## DUR-03` headings) fits comfortably inside either style below.

**Precedent A — section-per-gate with a VERDICT line directly under raw output**
(`.planning/phases/109-per-agent-engine-ui/109-LIVE-EVIDENCE.md:1-58`, read live):
```markdown
# Phase 109 — Live Evidence Gate (Plan 109-09)

Durable record for the live gate that decides whether **ENGINE-03**, **ENGINE-04** and **TELE-02**
may be marked satisfied. Every verdict in this file sits directly beneath the raw output that
produced it. No verdict is written from a green unit suite alone.

- **Gate opened:** 2026-08-10
- **Operator:** Larry Mandras
- **Driver:** Claude Code (inline, attended — plan is `autonomous: false`)
- **Stack:** self-hosted Convex at `127.0.0.1:3210`; astridr on `feature/brain-swap`

---

## Section 1 — Convex backend deployed to the SELF-HOSTED instance
...
$ npx convex deploy --dry-run
...
$ npx convex deploy --yes
...
**VERDICT: PASS.** Deployed to `http://127.0.0.1:3210`, the self-hosted instance. ...

### 1a — Pre-deploy state, recorded because it is the control for this section
...
```
The "recorded because it is the control for this section" subsection pattern (1a) is directly
reusable for DUR-02's control leg (RESEARCH.md's DUR-02 live confirmation asks for an hourly-count
control alongside the daily-count assertion).

**Precedent B — task-per-heading with a secret-redaction preamble**
(`.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md:
1-22`, read live):
```markdown
# ENGINE-05 Live Integration Gate — Evidence

**Plan:** 108-07
**Date:** 2026-08-07
**Repos:** codepulse (`master`, Convex self-hosted deploy) + astridr-repo (`feature/brain-swap`, ...)

This file is a verbatim command transcript. Every `npx convex` invocation carries
`--url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"`. Neither the Convex admin key nor the
astridr service key appears anywhere below.

---

## Task 1 — Pre-flight consent

**Status:** Satisfied by prior operator approval, not re-asked in this run.
...
```
The **redaction preamble** ("Neither the Convex admin key nor the astridr service key appears
anywhere below") is directly relevant here too: D-08's evidence transcript will include
`docker logs` output and `npx convex run` invocations against the live production instance —
state up front that no admin key/secret value appears in the pasted output, matching this
project's `assertion-precedes-verification-base-rate` discipline around commands that print
secrets.

### `CLAUDE.md` (config/docs) — MODIFY

**The exact section D-11 extends, read live** (`CLAUDE.md:86-95`):
```markdown
## Self-Hosted Convex — Operational Rules (2026-07-22 incident)

The production backend is SELF-HOSTED (single node, SQLite) at `C:\Users\mandr\convex-selfhost\`. Its MVCC tombstone GC cannot absorb mass deletes while serving load. Hard rules:

- **NEVER run `npx convex import --replace-all` against the live instance.** It deletes every existing row first — millions of tombstones that poisoned every index, ballooned memory 4x, and took the dashboard down for days (2026-07-21/22). To restore or trim: import into a FRESH EMPTY instance (new volume, same INSTANCE_SECRET) and swap volumes.
- **Never bulk-delete or bulk-patch a large table on the live instance** (mass archival sweeps included). Retention-style deletes must stay batch-capped like `convex/retention.ts`.
- A dashboard-wide "no data / all zeros / reconnect loop" is index rot or memory starvation until proven otherwise — check `docker stats convex-backend`, then the soak-watch canary log (`convex-selfhost\soak-watch.log`), before touching frontend code.
- `docker inspect` showing `OOMKilled:false, ExitCode:0` does NOT rule out OOM — the kernel reaps the child server process and PID 1 exits cleanly. Check `wsl -e dmesg | grep -i oom`.
- Full incident history: Claude memory file `convex-selfhosted-setup`.
```
**Pattern to copy for D-11's new bullet:** each existing bullet is one sentence of hard rule (bold
lead phrase) followed by 1-2 sentences of "why", often with a measured number and a citation to
where the full story lives (a memory file, a source file). D-11's addition should match — e.g.
a bullet starting `**ConvexNightlyRestart is deliberate, not a workaround.**` followed by the
~0.17 GiB/h baseline and a pointer to `110-DUR-EVIDENCE.md` the way the existing last bullet
points to the `convex-selfhosted-setup` memory file. Insert as a new bullet in this list (not a
new subsection) — D-11 explicitly says "adds to this section."

## Shared Patterns

### The batch-capped, sequential, cursor-seeked prune shape
**Source:** `convex/retention.ts:18-23` (header comment) + `:151-165` (the loop) +
`convex/retentionCursor.ts` (whole file)
**Apply to:** `convex/retention.ts`'s aggregates entry and rotation logic — this is the constraint
every DUR-01/DUR-02 change must fit inside, not a pattern to introduce new instances of. Do not
add a second scheduler chain, a second batch cap, or a parallel query — D-02 is explicit that
`aggregates` joins the *existing* chain.

### Get-existing-or-patch on `agentConfigs`
**Source:** `convex/webhookDelivery.ts:36-65` (4 call sites total in that file: `webhook-discord-url`,
`webhook-slack-url`, `notification-preferences`, `last-digest-at`)
**Apply to:** the D-06 rotation cursor read/write in `convex/retention.ts`. This is the correct
idiom — see the ANTI-PATTERN callout above under `convex/retention.ts` for the idiom to avoid
(`convex/aggregates.ts`'s two insert-only backfill cursors).

### Deliberate exemption documented in place, test asserts the documentation exists
**Source:** `convex/retention.ts:79-95` (D-13 comment) + `convex/retention.test.ts:70-90` (D-13 test)
**Apply to:** D-03's narrowed keep-forever guard and its new positive predicate guard — same shape,
extended with a directly-callable assertion since `PRUNE_PREDICATES.aggregates` (unlike D-13's
comment-only exemption) is an actual function to invoke in the test.

### Verbatim live-evidence transcript, verdict directly under raw output, secrets never pasted
**Source:** `109-LIVE-EVIDENCE.md:1-58`, `108-ENGINE-05-EVIDENCE.md:1-22`
**Apply to:** `110-DUR-EVIDENCE.md` for both DUR-02's two-leg evidence and DUR-03's knob-found/
knob-absent branch. Redact/never-echo the Convex admin key and any bearer token in every pasted
`docker logs`/`npx convex run` transcript, matching `108-ENGINE-05-EVIDENCE.md`'s explicit
preamble and this project's `2026-08-10` self-hosted `env list` masking lesson.

## No Analog Found

None. All 7 files have a strong, verified, same-repo analog — this phase is entirely extension
of existing machinery per its own `<code_context>` "Established Patterns" framing ("every piece
of new machinery this phase needs already has a close relative elsewhere in this exact codebase").

## Metadata

**Analog search scope:** `convex/retention.ts`, `convex/retentionCursor.ts`,
`convex/retention.test.ts`, `convex/retentionCursor.test.ts`, `convex/webhookDelivery.ts`,
`convex/aggregates.ts`, `convex/analyticsRollup.ts`, `convex/schema.ts` (agentConfigs + aggregates
table defs), `C:/Users/mandr/convex-selfhost/retention-health-check.ps1`,
`.planning/phases/109-per-agent-engine-ui/109-LIVE-EVIDENCE.md`,
`.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md`,
`CLAUDE.md` (Self-Hosted Convex section)
**Files scanned (read live this session):** 12
**Pattern extraction date:** 2026-08-10
