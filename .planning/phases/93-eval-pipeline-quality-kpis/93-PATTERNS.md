# Phase 93: Eval Pipeline & Quality KPIs - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 14 (backend 8, cross-repo 1, frontend 5)
**Analogs found:** 14 / 14 (all have a strong or exact analog; no "no analog" files this phase)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/schema.ts` (+`evalScores` table) | model/schema | CRUD | `convex/schema.ts` — `events`/`alerts`/`configChanges` table blocks (same file) | exact |
| `convex/runtimeIngest.ts` (+`case "task_quality"`) | controller (httpAction dispatch) | request-response / event-driven | `convex/runtimeIngest.ts:57-76` (`llm_call` case) | exact |
| `convex/evalScores.ts` (NEW — ingest mutation, judge query/action/mutation, KPI queries, regression internalAction) | service + model | CRUD + batch + event-driven | `convex/events.ts` (idempotent mutation) + `convex/briefings.ts` (LLM caller/config-slot) + `convex/alerts.ts` (`createIfNew`) — composite | role-match (composed from 3 exact sub-patterns) |
| `convex/briefings.ts` (modify `setLLMConfig` slot validation) | service (config) | CRUD | same file, `convex/briefings.ts:241-243` | exact (in-place diff) |
| `convex/crons.ts` (+judge cron entry) | config (cron registration) | batch | `convex/crons.ts:126-132` (`sweep-graph-snapshot-versions`, most recent offset-commented entry) | exact |
| `convex/profiles.ts` (modify `upsertConfig` to write `configChanges` audit row) | service (mutation) | CRUD | same file, `convex/profiles.ts:116-152` (`updateEmail`'s audit-insert shape) | exact |
| `convex/evalScores.test.ts` (NEW) | test | transform (pure-function unit test) | `convex/runtimeIngest.test.ts` (extracted pure-function pattern) | exact |
| `convex/runtimeIngest.test.ts` (extend with `task_quality` case test) | test | transform | same file, `processSwarmTaskEvent` test block | exact |
| `astridr-repo/astridr/integrations/langfuse_eval.py` (modify `spawn_score`/`_write_score`) | service (cross-repo producer) | event-driven / fire-and-forget | `astridr-repo/astridr/channels/war_room/dispatcher.py:212-238` (`_post_codepulse_warroom`, Phase 90 mirror precedent) | exact |
| `src/pages/Quality.tsx` (NEW) | component (page) | request-response (`useQuery`) | `src/components/OperatorScoreCard.tsx` (card + loading/empty states) + page-registration precedent in `src/App.tsx`/`src/layouts/DashboardLayout.tsx` | role-match |
| `src/pages/QualityDetail.tsx` (NEW) | component (page) | request-response | `src/components/hr/detail/ResponseTimeChart.tsx` (detail-page chart) + `OperatorScoreCard.tsx` (trend/sparkline) | role-match |
| `src/components/QualityTrendChart.tsx` (NEW, per UI-SPEC) | component (chart) | transform | `src/components/hr/detail/ResponseTimeChart.tsx` | exact (swap Bar→Line per Pattern 5 below) |
| `src/hooks/useEvalScores.ts` (NEW) | hook | request-response | `src/hooks/useAlerts.ts` | exact |
| `src/layouts/DashboardLayout.tsx` (+nav entry) / `src/App.tsx` (+route) | route/config | request-response | same files, existing `navGroups`/`iconMap`/lazy-route entries | exact |

---

## Pattern Assignments

### `convex/schema.ts` — add `evalScores` table

**Analog:** same file — `events` (idempotency index shape), `alerts` (details/severity shape), `configChanges` (audit-key shape)

**Idempotency index pattern** (`convex/schema.ts:24-40`, `events` table):
```typescript
events: defineTable({
  sessionId: v.string(),
  eventType: v.string(),
  // ...
  idempotencyKey: v.optional(v.string()),   // Phase 88 D-04: producer dedup key
})
  .index("by_session", ["sessionId", "timestamp"])
  .index("by_idempotencyKey", ["idempotencyKey"]),
```

**Existing tables the new schema must join against** (do not redefine, just read):
```typescript
// convex/schema.ts:106-126 — alerts (regression alert `details` payload already v.any()-typed)
alerts: defineTable({
  severity: v.string(), source: v.string(), message: v.string(),
  details: v.optional(v.any()),
  webhookStatus: v.optional(v.string()),
}).index("by_source", ["source", "createdAt"]) /* ... */,

// convex/schema.ts:259-267 — configChanges (D-11 change-boundary source)
configChanges: defineTable({
  configKey: v.string(), oldValue: v.optional(v.any()), newValue: v.any(),
  changedBy: v.optional(v.string()), changedAt: v.float64(),
}).index("by_key", ["configKey", "changedAt"]),

// convex/schema.ts:498-507 — profileConfigs (persona identity, per RESEARCH A1)
profileConfigs: defineTable({
  profileId: v.string(), /* ... */ updatedAt: v.float64(),
}).index("by_profileId", ["profileId"]),

// convex/schema.ts:528-533 — profileSwitches (D-11 change-boundary source)
profileSwitches: defineTable({
  fromProfile: v.string(), toProfile: v.string(), reason: v.optional(v.string()),
  timestamp: v.float64(),
}).index("by_timestamp", ["timestamp"]),
```

**Apply to `evalScores`:** give it `.index("by_idempotencyKey", ["idempotencyKey"])` (copy `events` verbatim), plus a `by_profileId`/`by_scoreName` index pair for the KPI queries and regression before/after window scans (mirror `llmMetrics`'s multi-index style at `convex/schema.ts:297-320`).

---

### `convex/runtimeIngest.ts` — add `case "task_quality":`

**Analog:** `convex/runtimeIngest.ts:57-76` (`llm_call` case — closest structural match, has cost/session/agent fields)

**Imports** (`convex/runtimeIngest.ts:1-4`, file-level, no change needed — case reuses existing imports):
```typescript
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";
import { legacyEventData } from "./ingestSummary";
```

**Auth/CORS gate — already inherited, do not duplicate** (`convex/runtimeIngest.ts:15-23`):
```typescript
export const runtimeIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }
  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }
```

**Core dispatch pattern to copy** (`convex/runtimeIngest.ts:57-76`, `llm_call`):
```typescript
case "llm_call": {
  const d = data as any;
  await ctx.runMutation(api.llm.recordCall, {
    provider: d.provider ?? "unknown",
    // snake_case/camelCase coalesce for every field ...
    sessionId: d.sessionId ?? d.session_id,
    agentId: d.agentId ?? d.agent_id,
  });
  break;
}
```
New case (insert inside the same `switch (evt.eventType)` block, `convex/runtimeIngest.ts:56-934`):
```typescript
case "task_quality": {
  const d = data as any;
  await ctx.runMutation(api.evalScores.ingestTaskQuality, {
    profileId: d.profileId ?? d.profile_id ?? "unknown",
    sessionId: d.sessionId ?? d.session_id ?? "unknown",
    scoreName: "task_quality",
    overall: d.score ?? d.overall ?? 0,
    idempotencyKey: d.idempotencyKey ?? d.event_id,
    timestamp,
  });
  break;
}
```

**Error handling — outer try/catch already wraps the whole loop, do not add a nested one** (`convex/runtimeIngest.ts:25-26`, `950-955`):
```typescript
try {
  // ... for (const evt of events) { switch (evt.eventType) { ... } }
  return new Response(JSON.stringify({ ingested: events.length }), { status: 200, ... });
} catch (e: any) {
  return new Response(JSON.stringify({ error: e.message }), { status: 400, ... });
}
```

---

### `convex/evalScores.ts` (NEW file — composite of 3 analogs)

#### Sub-pattern A: Idempotent ingest mutation (EVAL-01, D-05)

**Analog:** `convex/events.ts:8-48` (`ingest` mutation)
```typescript
// Source: convex/events.ts:20-30
if (args.idempotencyKey) {
  const existing = await ctx.db
    .query("events")
    .withIndex("by_idempotencyKey", (q) =>
      q.eq("idempotencyKey", args.idempotencyKey!)
    )
    .first();
  if (existing) return; // idempotent no-op
}
await ctx.db.insert("events", { /* ... */ idempotencyKey: args.idempotencyKey });
```
Apply identically to `evalScores`: same lookup-then-insert shape, same field name `idempotencyKey`, same index name `by_idempotencyKey`. Use for BOTH `ingestTaskQuality` (EVAL-01) and the judge's own insert (EVAL-02, `idempotencyKey = \`judge:${sessionId}\``per RESEARCH's Architecture Diagram).

#### Sub-pattern B: Dual-provider LLM caller + config slot (EVAL-02, D-07)

**Analog:** `convex/briefings.ts:1-145` (`callLLMWithFallback`, `getLLMConfigInternal`)
```typescript
// Source: convex/briefings.ts:1-11 — import block to mirror
import {
  query, mutation, internalQuery, internalMutation, internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";

// Source: convex/briefings.ts:53-98 — provider branch (anthropic x-api-key / openai Bearer)
if (config.provider === "anthropic") {
  baseUrl = "https://api.anthropic.com/v1/messages";
  headers = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
    "anthropic-version": "2023-06-01",
  };
  body = {
    model: config.model || "claude-3-5-haiku-20241022",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  };
} else {
  baseUrl = "https://api.openai.com/v1/chat/completions";
  headers = { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` };
  body = { model: config.model || "gpt-4o-mini", messages: [
    { role: "system", content: systemPrompt }, { role: "user", content: userPrompt },
  ] };
}
const resp = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(body) });
if (!resp.ok) throw new Error(`LLM ${config.provider} error ${resp.status}: ${await resp.text()}`);
```
**Config-slot read** (`convex/briefings.ts:110-129`):
```typescript
export const getLLMConfigInternal = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const config = await ctx.db.query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", key)).first();
    if (!config) return null;
    const val = config.value as { provider?: string; model?: string; apiKey?: string };
    return { provider: val.provider ?? "openai", model: val.model ?? "gpt-4o-mini", apiKey: val.apiKey ?? "" };
  },
});
```
**Session digest read** (`convex/briefings.ts:131-145`, `getSessionDataInternal` — directly reusable shape for the judge's digest query):
```typescript
export const getSessionDataInternal = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId)).first();
    const events = await ctx.db.query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .filter((q) => q.neq(q.field("archived"), true))
      .take(200);
    return { session, events };
  },
});
```
**Required code change (not just config), `convex/briefings.ts:241-243`:**
```typescript
// BEFORE:
if (slot !== "primary" && slot !== "backup") {
  throw new Error(`Invalid slot "${slot}". Must be "primary" or "backup".`);
}
// AFTER:
if (slot !== "primary" && slot !== "backup" && slot !== "eval") {
  throw new Error(`Invalid slot "${slot}". Must be "primary", "backup", or "eval".`);
}
```
The judge's own LLM caller should live in `evalScores.ts` (new function, NOT reuse `callLLMWithFallback` directly — D-07 requires an isolated config slot `intelligence.llm_eval` so briefings-model changes never reweight judge scoring), reading via `getLLMConfigInternal({ key: "intelligence.llm_eval" })`.

**Public config-read redaction pattern to mirror** (`convex/briefings.ts:205-224`, T-07-05 — never return `apiKey` from a public query):
```typescript
// T-07-05: Never return apiKey to public callers
return { provider: val.provider ?? "openai", model: val.model ?? "gpt-4o-mini" };
```

#### Sub-pattern C: Alert-engine integration via `createIfNew` (EVAL-03, D-13)

**Analog:** `convex/alerts.ts:716-736` (`createIfNew`, inside `evaluateInternal`) — **NOT** the public `alerts.create` at `convex/alerts.ts:22-40` (confirmed: that mutation never sets `webhookStatus` or schedules delivery).
```typescript
// Source: convex/alerts.ts:716-736 — the delivery-wired shape the regression detector must mirror
async function createIfNew(ruleId: string, severity: string, source: string, message: string): Promise<any> {
  if (disabledRules.has(ruleId)) return null;
  if (activeSourceSet.has(ruleId)) return null;   // dedup by `source` field
  const newAlertId = await ctx.db.insert("alerts", {
    severity, source, message,
    acknowledged: false, status: "active", createdAt: now,
    webhookStatus: "pending",                       // <- required for delivery
  });
  activeSourceSet.add(ruleId);
  await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
    alertId: newAlertId, attempt: 1,
  });
  return newAlertId;
}
```
**Contrast — do NOT copy this one** (`convex/alerts.ts:22-40`, public `create`, no webhook wiring):
```typescript
export const create = mutation({
  args: { severity: v.string(), source: v.string(), message: v.string(), details: v.optional(v.any()) },
  handler: async (ctx, args) => {
    await ctx.db.insert("alerts", {
      severity: args.severity, source: args.source, message: args.message, details: args.details,
      acknowledged: false, status: "active", createdAt: Date.now() / 1000,
    }); // <- NO webhookStatus, NO scheduler.runAfter — never delivers
  },
});
```
**Recommendation for the regression detector's insert:** copy the `createIfNew` shape but extend it to also pass `details` (structured before/after means, change date, change type) directly on `ctx.db.insert("alerts", {...})` — neither existing helper accepts a `details` arg, so this insert call should not literally call the shared `createIfNew` function but replicate its exact field set plus `details`. Use `source: \`eval-regression:${profileId}\`` for natural per-persona dedup via the existing `by_source`/`activeSourceSet` mechanism.

---

### `convex/crons.ts` — add nightly judge cron entry

**Analog:** `convex/crons.ts:126-132` (`sweep-graph-snapshot-versions`, most recent offset-commented entry — establishes the comment convention for new slots)
```typescript
// Phase 83: Graph snapshot version retention (D-03)
// Offset from the 04:00 file sweep to avoid scheduler contention.
crons.daily(
  "sweep-graph-snapshot-versions",
  { hourUTC: 4, minuteUTC: 30 },
  internal.graphSnapshots.sweepGraphSnapshotVersions,
);
```
**Occupied slots confirmed by direct read of `convex/crons.ts` (full file):** 01:00, 02:00, 03:00, 03:30, 04:00, 04:30, 06:00, 06:05 (plus several `crons.interval(...)` jobs that run continuously). **05:00 UTC is free** — use it, per Pitfall 5 / D-nothing-conflicting.
```typescript
// Phase 93: Nightly LLM-judge sampling (EVAL-02). Offset from the 04:30 graph-snapshot
// sweep and the 06:00 daily-digest generation to avoid scheduler contention.
crons.daily(
  "judge-sampled-sessions",
  { hourUTC: 5, minuteUTC: 0 },
  internal.evalScores.judgeSessionsAction,
);
```

---

### `convex/profiles.ts` — close the `configChanges` audit-trail gap (D-11 dependency)

**Analog:** same file, `updateEmail` (`convex/profiles.ts:116-152`) — the only existing profile-scoped `configChanges` write

**Pattern to copy into `upsertConfig`** (`convex/profiles.ts:144-150`):
```typescript
await ctx.db.insert("configChanges", {
  configKey: `profile.${args.profileId}.emailAddress`,
  oldValue: oldEmail,
  newValue: args.emailAddress,
  changedBy: "dashboard",
  changedAt: now,
});
```
Apply this shape inside `upsertConfig` (`convex/profiles.ts:81-114`, which currently patches `modelPreferences`/`channels`/`budget` with **no** audit insert) using `configKey: \`profile.${args.profileId}.modelPreferences\`` (naming per RESEARCH's Open Question 2 recommendation — matches this exact precedent's `profile.<id>.<field>` shape). Without this change, D-11's regression-detection join against `configChanges` reads zero rows.

---

### `convex/evalScores.test.ts` (NEW) and `convex/runtimeIngest.test.ts` (extend)

**Analog:** `convex/runtimeIngest.test.ts:1-54` (extracted pure-function pattern — `convex-test` is NOT installed, confirmed by header comment)
```typescript
// Source: convex/runtimeIngest.test.ts:1-54
/**
 * ... Uses plain vitest mocks (convex-test is not installed in this repo).
 */
import { describe, it, expect } from "vitest";

interface UpsertArgs { /* mirrors the mutation's args shape */ }

/**
 * Simulate the swarm_task case in runtimeIngest.ts.
 * Returns the args that would be passed to api.swarmTasks.upsert.
 */
function processSwarmTaskEvent(data: Record<string, any>, timestamp: number): UpsertArgs {
  const d = data;
  // ... snake_case/camelCase coalesce, identical to the live case block ...
  return { /* ... */ };
}

describe("runtimeIngest — swarm_task case", () => {
  it("produces valid upsert args with the correct goalId and subtaskId", () => {
    const args = processSwarmTaskEvent({ /* fixture */ }, msTimestamp);
    expect(args.goalId).toBe("goal-xyz");
  });
});
```
Apply identically: export a `processTaskQualityEvent(data, timestamp)` pure function from `evalScores.ts` mirroring the new `case "task_quality"` block exactly, unit-test it with fixtures in a new `describe("runtimeIngest — task_quality case", ...)` block appended to `runtimeIngest.test.ts`. For `evalScores.test.ts` itself, extract and test: (a) the idempotency check function, (b) the digest builder, (c) zod validation of judge output, (d) the `Promise.allSettled` batch-failure isolation, (e) the regression threshold math (≥5 sessions/side, mean-drop threshold), (f) the alert-insert shape (asserting `webhookStatus`/`scheduler.runAfter` call args, not the bare insert). **Do not** import `convex-test`/`convexTest` anywhere — confirmed absent from `package.json`.

---

### `astridr-repo/astridr/integrations/langfuse_eval.py` — add CodePulse mirror POST (D-01, cross-repo)

**Analog:** `astridr-repo/astridr/channels/war_room/dispatcher.py:38-45, 212-238` (Phase 90 mirror precedent, fire-and-forget POST + env-anchor pattern)

**Env-anchor pattern** (`dispatcher.py:41-44`):
```python
# CodePulse Convex HTTP ingest (war room list/transcript surface). CONVEX_URL is the
# .convex.site HTTP base; auth mirrors the existing telemetry path (ASTRIDR_INGEST_API_KEY).
_CONVEX_URL = os.environ.get("CONVEX_URL", "")  # cg-ok: CG-INP-002 — optional; emit skips when unset
_CODEPULSE_INGEST_KEY = os.environ.get("ASTRIDR_INGEST_API_KEY", "")  # secretref-ok  # cg-ok: CG-INP-002 — optional; emit skips when unset
```

**Fire-and-forget POST function** (`dispatcher.py:212-238`):
```python
async def _post_codepulse_warroom(event_type: str, payload: dict[str, Any]) -> None:
    """Fire-and-forget POST to CodePulse /war-room-ingest. Never raises."""
    if not _CONVEX_URL or not _CODEPULSE_INGEST_KEY:
        return
    try:
        client = get_pool().get(timeout=5.0)
        body = {"type": event_type, **{k: v for k, v in payload.items() if v is not None}}
        resp = await client.post(
            f"{_CONVEX_URL.rstrip('/')}/war-room-ingest",
            json=body,
            headers={
                "Authorization": f"Bearer {_CODEPULSE_INGEST_KEY}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code >= 300:
            logger.error("war_room.codepulse_ingest_bad_status", status=resp.status_code, body=resp.text[:200], event_type=event_type)
    except Exception as exc:
        logger.error("war_room.codepulse_ingest_failed", error=str(exc), event_type=event_type)
```

**Fire-and-forget call-site (non-blocking task spawn)** (`dispatcher.py:34-36, 248`):
```python
_background_tasks: set[asyncio.Task] = set()

def _track_task(task: asyncio.Task) -> None:
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

# call site:
_track_task(asyncio.create_task(_post_codepulse_warroom("room.created", { ... })))
```

**Apply to `spawn_score`/`_write_score`** (`astridr-repo/astridr/integrations/langfuse_eval.py:54-117`, existing D-03 dual-write target): add a module-level `_CONVEX_URL`/`_CODEPULSE_INGEST_KEY` pair identical to the above, a `_post_task_quality(...)` function mirroring `_post_codepulse_warroom`'s exact shape but posting to `/runtime-ingest` (not `/war-room-ingest`) with `{"eventType": "task_quality", "data": {...}}` (matches `runtimeIngest.ts`'s dual-format contract — a single-event body, not the legacy `{"events": [...]}` batch), and spawn it as a second fire-and-forget task from inside `spawn_score` alongside the existing `self._write_score(...)` task (`langfuse_eval.py:70-81`) — same `task.add_done_callback(self._tasks.discard)` bookkeeping already present in this class. Include `profileId`/`agent_id`/`session_id`/`value` and a producer-generated `idempotencyKey` (D-05) in the payload. **Do not** touch the existing Langfuse write path (D-03: independent gates, neither blocks the other).

---

### `src/pages/Quality.tsx` (NEW) — KPI card grid

**Analog:** `src/components/OperatorScoreCard.tsx:1-98` (loading/empty/data states, sparkline + color/label thresholds) — reused as the per-persona card template (D-16)

**Imports** (`OperatorScoreCard.tsx:1-9`):
```typescript
import { memo } from "react";
import { AnimatedNumber } from "./MetricCard";
import Sparkline from "./Sparkline";
import { GlassPanel } from "./GlassPanel";
import { useLatestOperatorScore, useOperatorScoreHistory } from "../hooks/useOperatorScore";
```

**Threshold color + label helpers** (`OperatorScoreCard.tsx:15-28`):
```typescript
function scoreColor(score: number): string {
  if (score > 70) return "var(--status-ok, #22c55e)";
  if (score >= 40) return "var(--status-warn, #f59e0b)";
  return "var(--status-error, #ef4444)";
}
function scoreLabel(score: number): string {
  if (score > 70) return "Healthy";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}
```

**Loading / empty state pattern** (`OperatorScoreCard.tsx:84-115` — copy this shape per persona card, `undefined` = loading, `null`/empty array = no data yet since D-17 volume is tiny):
```typescript
if (latest === undefined) {
  return (
    <GlassPanel className="p-6 hover:scale-[1.01] transition-transform duration-300">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-muted animate-pulse" />
        <span className="text-base font-bold">Operator Score</span>
      </div>
      <div className="text-5xl font-bold tabular-nums text-muted-foreground">&mdash;</div>
      <p className="text-base text-muted-foreground mt-2">Loading...</p>
    </GlassPanel>
  );
}
if (latest === null) {
  return (
    <GlassPanel className="p-6 hover:scale-[1.01] transition-transform duration-300">
      <p className="text-lg font-bold text-muted-foreground">No score yet</p>
      <p className="text-base text-muted-foreground mt-1">
        Operator Score is computed after the nightly audit completes. Check back after midnight.
      </p>
    </GlassPanel>
  );
}
```

**Sub-score bar for per-dimension breakdown** (`OperatorScoreCard.tsx:44-75`, `SubScoreBar` — directly reusable for D-09's per-dimension display on the drill-in detail page):
```typescript
function SubScoreBar({ label, weight, value }: SubScoreBarProps) {
  const barColor = value < 40 ? "var(--status-error, #ef4444)" : "var(--primary, #10b981)";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            {label} <span className="opacity-50 text-xs ml-1">({weight})</span>
          </span>
          <span className="text-sm font-bold tabular-nums font-mono text-foreground">{Math.round(value)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden relative">
          <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_currentColor]"
            style={{ width: `${Math.min(value, 100)}%`, backgroundColor: barColor, color: barColor }} />
        </div>
      </div>
    </div>
  );
}
```

**Also reuse `MetricCard`'s `thresholdColor`** (`src/components/MetricCard.tsx:31-49`) for the delta badge coloring (regression drop severity) instead of re-deriving another color function:
```typescript
export interface ThresholdConfig { ok: number; warn: number; invertDirection?: boolean; }
export function thresholdColor(value: number, config: ThresholdConfig): string {
  if (config.invertDirection) {
    if (value >= config.ok) return "var(--metric-ok)";
    if (value >= config.warn) return "var(--metric-warn)";
    return "var(--metric-error)";
  }
  if (value <= config.ok) return "var(--metric-ok)";
  if (value <= config.warn) return "var(--metric-warn)";
  return "var(--metric-error)";
}
```

---

### `src/components/QualityTrendChart.tsx` (NEW) / `src/pages/QualityDetail.tsx`

**Analog:** `src/components/hr/detail/ResponseTimeChart.tsx:1-136` (Recharts + shadcn `ChartContainer`/`ChartConfig` + `ReferenceLine` markers — the real precedent; UI-SPEC's cited `CompletionRateChart.tsx` does not exist in this repo)

**Imports** (`ResponseTimeChart.tsx:1-15`):
```typescript
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ReferenceLine } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
```

**Chart config + container pattern** (`ResponseTimeChart.tsx:35-40, 97-129`):
```typescript
const chartConfig: ChartConfig = { count: { label: "Count", color: "var(--chart-1)" } };

<ChartContainer config={chartConfig} className="h-[200px] w-full">
  <BarChart data={data}>
    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
    <YAxis tick={{ fontSize: 10 }} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="count" fill="var(--chart-1)" />
    {p50Label && (
      <ReferenceLine x={p50Label} stroke="var(--chart-p50)" strokeDasharray="4 4"
        label={{ value: "p50", position: "top", fontSize: 10 }} />
    )}
  </BarChart>
</ChartContainer>
```
**Empty-state pattern** (`ResponseTimeChart.tsx:87-96`, copy verbatim shape for "no judged sessions yet"):
```typescript
{!hasData ? (
  <p className="text-base text-muted-foreground text-center py-8">No response time data</p>
) : ( /* chart */ )}
```
**For the Quality detail page's multi-dimension trend line:** swap `BarChart`/`Bar` → `LineChart`/`Line` (per-dimension + overall series, `strokeWidth={2}`, `dot={false}` — precedent for `strokeWidth={2}` confirmed in `src/components/PulseChart.tsx:64`), keep the same `ChartContainer`/`ChartConfig`/`ReferenceLine` scaffolding; use `ReferenceLine` for change-event markers (profile switches / config changes, D-16) exactly as `p50`/`p95`/`p99` markers are used here.

---

### `src/hooks/useEvalScores.ts` (NEW)

**Analog:** `src/hooks/useAlerts.ts:1-28` (full file — thin `useQuery`/`usePaginatedQuery` wrapper convention)
```typescript
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useActiveAlerts() {
  return useQuery(api.alerts.listActive) ?? [];
}
export function useAllAlertsPaginated(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.alerts.listAllPaginated, {}, { initialNumItems }
  );
  return { alerts: results ?? [], status, loadMore };
}
```
Apply identically: `useQualityKpis()` → `useQuery(api.evalScores.listPersonaKpis) ?? []`, `usePersonaDetail(profileId)` → `useQuery(api.evalScores.getPersonaDetail, { profileId }) ?? null`, `useJudgedSessions(profileId, range)` → paginated variant per D-17's range picker.

---

### `src/layouts/DashboardLayout.tsx` (+nav entry) / `src/App.tsx` (+route)

**Analog:** same files, existing OBSERVE-group entries and lazy-loaded heavy-page routes

**Nav entry pattern** (`DashboardLayout.tsx:182-193`, `navGroups`):
```typescript
{
  group: "OBSERVE",
  items: [
    { to: "/", label: "Dashboard", icon: "grid", group: "OBSERVE" },
    { to: "/hive", label: "Hive", icon: "hexagon", group: "OBSERVE" },
    { to: "/analytics", label: "Analytics", icon: "chart", group: "OBSERVE" },
    // NEW: { to: "/quality", label: "Quality", icon: "gauge", group: "OBSERVE" },
  ],
},
```
**Icon map entry** (`DashboardLayout.tsx:53, 105, 115` — import + map, per UI-SPEC's `Gauge` icon choice):
```typescript
import { LayoutGrid, Hexagon /* + Gauge */ } from "lucide-react";
// iconMap:
layout: LayoutGrid,
hexagon: Hexagon,   // Phase 149 — Hive page
// NEW: gauge: Gauge,   // Phase 93 — Quality page
```

**Lazy route registration** (`App.tsx:24-25, 68, 89, 101`):
```typescript
const Analytics = lazy(() => import("./pages/Analytics"));
// const Quality = lazy(() => import("./pages/Quality"));
// const QualityDetail = lazy(() => import("./pages/QualityDetail"));

<Route path="/analytics" element={<Suspense fallback={<div className="text-gray-500 text-base p-8 text-center">Loading Analytics...</div>}><Analytics /></Suspense>} />
// <Route path="/quality" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Quality...</div>}><Quality /></Suspense>} />
// <Route path="/quality/:profileId" element={<Suspense fallback={...}><QualityDetail /></Suspense>} />
```

---

## Shared Patterns

### Ingest Bearer-auth + CORS (EVAL-01)
**Source:** `convex/ingestAuth.ts` (`validateIngestAuth`, `getCorsHeaders`, `unauthorizedResponse`), consumed at `convex/runtimeIngest.ts:15-23`
**Apply to:** No new code needed — the `task_quality` case inherits this automatically by living inside the existing `/runtime-ingest` httpAction. Do not add a second auth check.

### Idempotent write (dedup-by-key)
**Source:** `convex/events.ts:20-30`
**Apply to:** `evalScores.ingestTaskQuality` (EVAL-01) and the judge's insert mutation (EVAL-02) — both need `.withIndex("by_idempotencyKey", ...)` early-return before insert.

### Dual-provider LLM caller + config slot
**Source:** `convex/briefings.ts:30-129` (`callLLMWithFallback`, `getLLMConfigInternal`)
**Apply to:** The judge's `callJudgeLLM` in `evalScores.ts` (EVAL-02) — copy the anthropic/openai branch verbatim, point at a new `intelligence.llm_eval` config key. Requires the `setLLMConfig` slot-validation edit in `convex/briefings.ts:241-243`.

### Alert creation with actual delivery
**Source:** `convex/alerts.ts:716-736` (`createIfNew`), contrasted with the non-delivering `convex/alerts.ts:22-40` (`create`)
**Apply to:** Regression detector's alert insert (EVAL-03, D-13) — must set `webhookStatus: "pending"` and call `ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {...})`, or the alert silently never reaches Discord/Slack/PagerDuty/email.

### Page-addition convention (pages/ + App.tsx route + DashboardLayout nav)
**Source:** Any existing page pair, e.g. `src/pages/Analytics.tsx` + `App.tsx:25,89` + `DashboardLayout.tsx:186`
**Apply to:** `src/pages/Quality.tsx`, `src/pages/QualityDetail.tsx` (EVAL-03) — lazy-load both (Analytics-style Suspense wrapper), add both to `navGroups`/route table.

### Recharts + shadcn chart scaffolding
**Source:** `src/components/hr/detail/ResponseTimeChart.tsx` (real precedent; UI-SPEC's `CompletionRateChart.tsx` reference does not exist)
**Apply to:** `src/components/QualityTrendChart.tsx` (EVAL-03 detail page) — `ChartContainer`/`ChartConfig`/`ReferenceLine` scaffolding, swap `BarChart` for `LineChart` per-dimension.

### Fire-and-forget cross-repo mirror POST
**Source:** `astridr-repo/astridr/channels/war_room/dispatcher.py:38-45, 212-238` (Phase 90 precedent)
**Apply to:** `astridr-repo/astridr/integrations/langfuse_eval.py`'s `spawn_score` (D-01) — same `CONVEX_URL`/`ASTRIDR_INGEST_API_KEY` env-anchor pair, same skip-if-unset guard, same try/except-log-never-raise body, same `asyncio.create_task` + done-callback bookkeeping (already present in `LangfuseEvaluator`, reuse `self._tasks`).

### Extracted pure-function test convention (no `convex-test`)
**Source:** `convex/runtimeIngest.test.ts:1-54`, confirmed also in `convex/swarmTasks.test.ts`, `convex/cacheStats.test.ts`, `convex/briefings.test.ts`
**Apply to:** `convex/evalScores.test.ts` and the `runtimeIngest.test.ts` extension — export pure logic functions from `evalScores.ts` (idempotency check, digest builder, zod validation, threshold math, alert-shape assertion) and unit-test with plain vitest + manual mocks. **Never** import `convex-test`/`convexTest` — confirmed absent from `package.json` dependencies and devDependencies.

---

## No Analog Found

None. Every file in this phase has at least a role-match analog in the existing codebase (see table above); the composite `evalScores.ts` is assembled from three separately-exact sub-patterns (idempotent mutation, LLM caller, alert delivery) rather than a single direct analog, since no existing file combines all three responsibilities.

---

## Metadata

**Analog search scope:** `convex/*.ts` (schema, runtimeIngest, events, briefings, alerts, crons, profiles, agentProfiles, ingestAuth, drift, ingest — all read directly per RESEARCH.md's Sources list), `src/pages/`, `src/components/`, `src/components/hr/detail/`, `src/hooks/`, `src/layouts/DashboardLayout.tsx`, `src/App.tsx`, `astridr-repo/astridr/integrations/langfuse_eval.py`, `astridr-repo/astridr/channels/war_room/dispatcher.py`, `astridr-repo/astridr/engine/telemetry.py`.
**Files scanned:** ~30 (cross-referenced against RESEARCH.md's own direct-read inventory; this pass re-verified line numbers and pulled additional excerpts RESEARCH.md summarized but didn't quote in full — e.g. `alerts.create` contrast, `OperatorScoreCard.tsx` loading/empty states, `MetricCard.tsx` thresholdColor, `useAlerts.ts` full file, `langfuse_eval.py`/`dispatcher.py` full mirror precedent).
**Pattern extraction date:** 2026-07-05
