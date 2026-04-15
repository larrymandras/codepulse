import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";

// ─── Pure helper (exported for testing) ─────────────────────────────────────

export function groupActivityEvents(
  events: Array<{ toolName?: string; eventType?: string }>
): Array<{ tool: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const key = e.toolName || e.eventType || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── LLM Helper with dual-provider failover ──────────────────────────────────

async function callLLMWithFallback(
  runQuery: (fn: any, args: any) => Promise<any>,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const primaryConfig = await runQuery(
    internal.briefings.getLLMConfigInternal,
    { key: "intelligence.llm_primary" }
  );
  const backupConfig = await runQuery(
    internal.briefings.getLLMConfigInternal,
    { key: "intelligence.llm_backup" }
  );

  async function callProvider(
    config: { provider: string; model: string; apiKey: string } | null
  ): Promise<string> {
    if (!config || !config.apiKey) throw new Error("LLM provider not configured");

    let baseUrl: string;
    let headers: Record<string, string>;
    let body: any;

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
      // OpenAI-compatible (default)
      baseUrl = "https://api.openai.com/v1/chat/completions";
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      };
      body = {
        model: config.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      };
    }

    const resp = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(
        `LLM ${config.provider} error ${resp.status}: ${await resp.text()}`
      );
    }
    const json = await resp.json();

    if (config.provider === "anthropic") {
      return json.content?.[0]?.text ?? "";
    }
    return json.choices?.[0]?.message?.content ?? "";
  }

  try {
    return await callProvider(primaryConfig);
  } catch (err) {
    if (!backupConfig) throw err;
    return await callProvider(backupConfig);
  }
}

// ─── Internal data queries (used by actions) ─────────────────────────────────

export const getLLMConfigInternal = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", key))
      .first();
    if (!config) return null;
    const val = config.value as {
      provider?: string;
      model?: string;
      apiKey?: string;
    };
    return {
      provider: val.provider ?? "openai",
      model: val.model ?? "gpt-4o-mini",
      apiKey: val.apiKey ?? "",
    };
  },
});

export const getSessionDataInternal = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();
    const events = await ctx.db
      .query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .filter((q) => q.neq(q.field("archived"), true))
      .take(200);
    return { session, events };
  },
});

export const getDailyDigestDataInternal = internalQuery({
  args: { dayStart: v.float64() },
  handler: async (ctx, { dayStart }) => {
    const dayEnd = dayStart + 86400;

    // (a) Today's completed sessions
    const completedSessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .filter((q) =>
        q.and(
          q.gte(q.field("lastEventAt"), dayStart),
          q.lt(q.field("lastEventAt"), dayEnd)
        )
      )
      .collect();

    // (b) Daily cost from aggregates
    const costRows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q
          .eq("metric_type", "cost")
          .eq("period", "hourly")
          .gte("bucket_start", dayStart)
      )
      .filter((q) => q.lt(q.field("bucket_start"), dayEnd))
      .collect();
    const totalCost = costRows.reduce((sum, r) => sum + r.value, 0);

    // (c) Anomaly events count for today (use by_severity index, filter by detectedAt)
    const anomalyRows = await ctx.db
      .query("anomalyEvents")
      .withIndex("by_severity")
      .filter((q) =>
        q.and(
          q.gte(q.field("detectedAt"), dayStart),
          q.lt(q.field("detectedAt"), dayEnd)
        )
      )
      .collect();
    const anomalyCount = anomalyRows.length;

    // (d) INT-06: Undismissed ideation findings
    const findings = await ctx.db
      .query("ideationFindings")
      .withIndex("by_dismissed", (q) => q.eq("dismissed", false))
      .take(20);

    return { completedSessions, totalCost, anomalyCount, findings };
  },
});

// ─── LLM Config — Public (omits apiKey for Settings display) ────────────────

export const getLLMConfig = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", key))
      .first();
    if (!config) return null;
    const val = config.value as {
      provider?: string;
      model?: string;
      apiKey?: string;
    };
    // T-07-05: Never return apiKey to public callers
    return {
      provider: val.provider ?? "openai",
      model: val.model ?? "gpt-4o-mini",
    };
  },
});

// ─── LLM Config — Mutation ───────────────────────────────────────────────────

export const setLLMConfig = mutation({
  args: {
    slot: v.string(),
    provider: v.string(),
    model: v.string(),
    apiKey: v.string(),
  },
  handler: async (ctx, { slot, provider, model, apiKey }) => {
    // CPHLTH-01: Require authenticated Clerk identity — this mutation stores API keys.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    // T-07-08: Validate slot and provider values
    if (slot !== "primary" && slot !== "backup") {
      throw new Error(`Invalid slot "${slot}". Must be "primary" or "backup".`);
    }
    if (provider !== "openai" && provider !== "anthropic") {
      throw new Error(
        `Invalid provider "${provider}". Must be "openai" or "anthropic".`
      );
    }

    const configKey = `intelligence.llm_${slot}`;
    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", configKey))
      .first();

    const value = { provider, model, apiKey };
    if (existing) {
      await ctx.db.patch(existing._id, {
        value,
        source: "dashboard",
        updatedAt: Date.now() / 1000,
      });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey,
        value,
        source: "dashboard",
        updatedAt: Date.now() / 1000,
      });
    }
  },
});

// ─── Session Completed Trigger ───────────────────────────────────────────────

export const onSessionCompleted = internalMutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    // Idempotency guard: check briefings table with by_session index
    const existing = await ctx.db
      .query("briefings")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (existing) return;

    // Schedule the briefing generation action
    await ctx.scheduler.runAfter(
      0,
      internal.briefings.generateSessionBriefingAction,
      { sessionId }
    );
  },
});

// ─── Store Briefing (internal) ───────────────────────────────────────────────

export const storeBriefing = internalMutation({
  args: {
    type: v.string(),
    sessionId: v.optional(v.string()),
    date: v.optional(v.string()),
    narrative: v.string(),
    summary: v.optional(v.string()),
    totalCost: v.optional(v.float64()),
    anomaliesDetected: v.optional(v.float64()),
    generatedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("briefings", args);
  },
});

// ─── Generate Session Briefing (action) ─────────────────────────────────────

export const generateSessionBriefingAction = internalAction({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const { session, events } = await ctx.runQuery(
      internal.briefings.getSessionDataInternal,
      { sessionId }
    );

    // Group events by tool for activity summary
    // T-07-07: Structured counts only, not raw payloads
    const activityGroups = groupActivityEvents(events as any[]);

    const errorCount = (events as any[]).filter(
      (e: any) => e.eventType === "PostToolUseFailure"
    ).length;
    const duration =
      session && (session as any).lastEventAt && (session as any).startedAt
        ? Math.round((session as any).lastEventAt - (session as any).startedAt)
        : 0;

    // T-07-06: Structured summaries only
    const activitySummary = activityGroups
      .slice(0, 10)
      .map((g) => `${g.tool}: ${g.count}`)
      .join(", ");

    const systemPrompt =
      "You are an operational briefing writer for Astridr AI agent. Given session metrics, " +
      "write a 2-3 paragraph narrative summary. Include: what was accomplished, key decisions, " +
      "any anomalies or errors. Be concise and operational.";

    const userPrompt = `Session ID: ${sessionId}
Duration: ${duration}s
Total events: ${(events as any[]).length}
Error count: ${errorCount}
Tool activity: ${activitySummary || "none"}`;

    let narrative: string;
    try {
      narrative = await callLLMWithFallback(
        ctx.runQuery.bind(ctx),
        systemPrompt,
        userPrompt
      );
    } catch {
      narrative = `Session ${sessionId} completed. ${(events as any[]).length} events recorded. Tool activity: ${activitySummary || "none"}.`;
    }

    const summary = narrative.split(".")[0].slice(0, 200);

    await ctx.runMutation(internal.briefings.storeBriefing, {
      type: "session",
      sessionId,
      narrative,
      summary,
      totalCost: 0,
      generatedAt: Date.now() / 1000,
    });
  },
});

// ─── Daily Digest Trigger (cron target) ─────────────────────────────────────

export const triggerDailyDigest = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      0,
      internal.briefings.generateDailyDigestAction,
      {}
    );
  },
});

// ─── Generate Daily Digest (action) ─────────────────────────────────────────

export const generateDailyDigestAction = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const dayStart = Math.floor(now / 86400) * 86400;
    const date = new Date(dayStart * 1000).toISOString().slice(0, 10);

    const { completedSessions, totalCost, anomalyCount, findings } =
      await ctx.runQuery(internal.briefings.getDailyDigestDataInternal, {
        dayStart,
      });

    // T-07-06: Structured data only, no raw payloads
    const systemPrompt =
      "You are an operational digest writer for Astridr AI agent. Given today's operational data, " +
      "write a daily briefing. Include: activity summary (what Astridr accomplished today), " +
      "total spend vs budget, anomalies detected, and proactive scan findings. Be concise.";

    const findingsSnippet =
      (findings as any[]).length > 0
        ? "Top findings: " +
          (findings as any[])
            .slice(0, 5)
            .map(
              (f: any) =>
                `[${f.severity}] ${(f.description ?? "").slice(0, 80)}`
            )
            .join("; ")
        : "No active findings.";

    const userPrompt = `Date: ${date}
Completed sessions: ${(completedSessions as any[]).length}
Total cost: $${(totalCost as number).toFixed(4)}
Anomalies detected: ${anomalyCount}
Ideation findings (undismissed): ${(findings as any[]).length}
${findingsSnippet}`;

    let narrative: string;
    try {
      narrative = await callLLMWithFallback(
        ctx.runQuery.bind(ctx),
        systemPrompt,
        userPrompt
      );
    } catch {
      narrative = `Daily digest for ${date}. Sessions: ${(completedSessions as any[]).length}. Cost: $${(totalCost as number).toFixed(4)}. Anomalies: ${anomalyCount}. Findings: ${(findings as any[]).length}.`;
    }

    const summary = narrative.split(".")[0].slice(0, 200);

    await ctx.runMutation(internal.briefings.storeBriefing, {
      type: "daily_digest",
      date,
      narrative,
      summary,
      totalCost: totalCost as number,
      anomaliesDetected: anomalyCount as number,
      generatedAt: now,
    });
  },
});

// ─── List Briefings (paginated public query) ─────────────────────────────────

export const listBriefings = query({
  args: {
    paginationOpts: paginationOptsValidator,
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, dateFrom, dateTo }) => {
    // Convert YYYY-MM-DD to epoch seconds for filtering
    const from = dateFrom ? new Date(dateFrom).getTime() / 1000 : undefined;
    const to = dateTo
      ? new Date(dateTo).getTime() / 1000 + 86400
      : undefined;

    let baseQuery = ctx.db.query("briefings").order("desc");

    if (from !== undefined && to !== undefined) {
      baseQuery = baseQuery.filter((q) =>
        q.and(
          q.gte(q.field("generatedAt"), from),
          q.lt(q.field("generatedAt"), to)
        )
      );
    } else if (from !== undefined) {
      baseQuery = baseQuery.filter((q) =>
        q.gte(q.field("generatedAt"), from)
      );
    } else if (to !== undefined) {
      baseQuery = baseQuery.filter((q) =>
        q.lt(q.field("generatedAt"), to)
      );
    }

    return baseQuery.paginate(paginationOpts);
  },
});
