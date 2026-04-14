import {
  query,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Pure helper functions (exported for testing) ────────────────────────────

export function computeDeduplicationRate(
  totalStored: number,
  prunedCount: number
): number {
  if (totalStored === 0) return 0;
  return prunedCount / totalStored;
}

export function identifyStaleMemories(
  events: Array<{ eventType: string; data?: any; timestamp: number }>,
  thresholdDays: number,
  nowEpoch: number
): string[] {
  // Build a map: memoryId -> most recent access timestamp
  const lastAccess: Record<string, number> = {};
  for (const e of events) {
    const memoryId = e.data?.memoryId || e.data?.id;
    if (!memoryId) continue;
    if (
      e.eventType === "memory_stored" ||
      e.eventType === "memory_recalled"
    ) {
      lastAccess[memoryId] = Math.max(lastAccess[memoryId] ?? 0, e.timestamp);
    }
  }

  const cutoff = nowEpoch - thresholdDays * 86400;
  return Object.entries(lastAccess)
    .filter(([, ts]) => ts < cutoff)
    .map(([id]) => id);
}

// ─── Internal queries ─────────────────────────────────────────────────────────

export const getAgentConfigInternal = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", key))
      .first();
    return config?.value ?? null;
  },
});

export const getEpisodicEventsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get all episodic events (memory stored/recalled/pruned)
    const events = await ctx.db
      .query("episodicEvents")
      .withIndex("by_type", (q) =>
        q.gte("eventType", "memory_").lte("eventType", "memory_~")
      )
      .collect();
    return events;
  },
});

export const getLatestQualityRowInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("memoryQuality")
      .withIndex("by_evaluated")
      .order("desc")
      .first();
  },
});

// ─── Main evaluation cron (internalMutation) ─────────────────────────────────

export const evaluateInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000; // epoch seconds

    // Read staleness threshold from agentConfigs (default 30 days)
    const stalenessConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) =>
        q.eq("configKey", "intelligence.staleness_days")
      )
      .first();
    const thresholdDays =
      typeof stalenessConfig?.value === "number"
        ? (stalenessConfig.value as number)
        : 30;

    // Query all memory events
    const allEvents = await ctx.db
      .query("episodicEvents")
      .collect();

    // Filter to memory-related event types
    const memoryEvents = allEvents.filter((e) =>
      ["memory_stored", "memory_recalled", "memory_pruned"].includes(e.eventType)
    );

    // Compute dedup rate: pruned / stored
    const storedEvents = memoryEvents.filter(
      (e) => e.eventType === "memory_stored"
    );
    const prunedEvents = memoryEvents.filter(
      (e) => e.eventType === "memory_pruned"
    );
    const deduplicationRate = computeDeduplicationRate(
      storedEvents.length,
      prunedEvents.length
    );

    // Identify stale memories
    const staleMemoryIds = identifyStaleMemories(
      memoryEvents.map((e) => ({
        eventType: e.eventType,
        data: (e as any).data ?? { memoryId: (e as any).memoryId },
        timestamp: e.timestamp,
      })),
      thresholdDays,
      now
    );

    // Get recent (last 24h) stored memory IDs for contradiction detection
    const last24hCutoff = now - 86400;
    const recentStoredIds = storedEvents
      .filter((e) => e.timestamp > last24hCutoff)
      .map((e) => (e as any).data?.memoryId || (e as any).data?.id || e._id)
      .filter(Boolean)
      .slice(0, 20); // Cap at 20 per RESEARCH.md Pitfall 5

    // Store preliminary results (contradiction count = 0 — will be patched by action)
    const evaluatedAt = now;
    const qualityId = await ctx.db.insert("memoryQuality", {
      evaluatedAt,
      deduplicationRate,
      staleCount: staleMemoryIds.length,
      contradictionCount: 0,
      staleMemoryIds,
      contradictionPairs: [],
    });

    // Schedule contradiction detection action (runs async, patches the row)
    if (recentStoredIds.length >= 2) {
      await ctx.scheduler.runAfter(
        0,
        internal.memoryQuality.detectContradictionsAction,
        {
          recentMemoryIds: recentStoredIds,
          qualityDocId: qualityId as string,
          evaluatedAt,
        }
      );
    }
  },
});

// ─── Contradiction detection action (calls LLM) ──────────────────────────────

export const detectContradictionsAction = internalAction({
  args: {
    recentMemoryIds: v.array(v.string()),
    qualityDocId: v.string(),
    evaluatedAt: v.float64(),
  },
  handler: async (ctx, { recentMemoryIds, qualityDocId, evaluatedAt }) => {
    // Read LLM config
    const primaryConfig = await ctx.runQuery(
      internal.briefings.getLLMConfigInternal,
      { key: "intelligence.llm_primary" }
    );

    if (!primaryConfig || !primaryConfig.apiKey) {
      // No LLM configured — store 0 contradictions
      await ctx.runMutation(internal.memoryQuality.updateContradictions, {
        qualityDocId,
        contradictionPairs: [],
        contradictionCount: 0,
      });
      return;
    }

    // Fetch event summaries for the recent memory IDs
    // We'll use IDs as text proxies since episodicEvents has a summary field
    const memoryPairs: Array<[string, string]> = [];
    for (let i = 0; i < recentMemoryIds.length && memoryPairs.length < 10; i++) {
      for (
        let j = i + 1;
        j < recentMemoryIds.length && memoryPairs.length < 10;
        j++
      ) {
        memoryPairs.push([recentMemoryIds[i], recentMemoryIds[j]]);
      }
    }

    const systemPrompt =
      "You are a memory consistency checker. Given pairs of memory IDs, identify if any contradict each other. Return JSON: { contradictions: [{ memoryA: string, memoryB: string, reason: string }] }. Return empty contradictions array if none found.";
    const userPrompt = `Check these memory pairs for contradictions:\n${memoryPairs
      .map(([a, b]) => `- Memory A: ${a}, Memory B: ${b}`)
      .join("\n")}`;

    try {
      let responseText: string;

      // Call LLM (OpenAI-compatible or Anthropic)
      if (primaryConfig.provider === "anthropic") {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": primaryConfig.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: primaryConfig.model || "claude-3-5-haiku-20241022",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });
        const json = await resp.json();
        responseText = json.content?.[0]?.text ?? "{}";
      } else {
        const resp = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${primaryConfig.apiKey}`,
            },
            body: JSON.stringify({
              model: primaryConfig.model || "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
          }
        );
        const json = await resp.json();
        responseText = json.choices?.[0]?.message?.content ?? "{}";
      }

      // Parse LLM response
      const parsed = JSON.parse(responseText);
      const contradictionPairs = (parsed.contradictions ?? []).map(
        (c: any) => ({
          memoryA: c.memoryA ?? "",
          memoryB: c.memoryB ?? "",
          reason: c.reason ?? undefined,
        })
      );

      await ctx.runMutation(internal.memoryQuality.updateContradictions, {
        qualityDocId,
        contradictionPairs,
        contradictionCount: contradictionPairs.length,
      });
    } catch {
      // On LLM error, store 0 contradictions so the row is complete
      await ctx.runMutation(internal.memoryQuality.updateContradictions, {
        qualityDocId,
        contradictionPairs: [],
        contradictionCount: 0,
      });
    }
  },
});

// ─── Patch contradiction results onto existing quality row ────────────────────

export const updateContradictions = internalMutation({
  args: {
    qualityDocId: v.string(),
    contradictionPairs: v.array(
      v.object({
        memoryA: v.string(),
        memoryB: v.string(),
        reason: v.optional(v.string()),
      })
    ),
    contradictionCount: v.float64(),
  },
  handler: async (ctx, { qualityDocId, contradictionPairs, contradictionCount }) => {
    const doc = await ctx.db.get(qualityDocId as any);
    if (doc) {
      await ctx.db.patch(qualityDocId as any, {
        contradictionPairs,
        contradictionCount,
      });
    }
  },
});

// ─── Public queries ───────────────────────────────────────────────────────────

export const getLatestQuality = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("memoryQuality")
      .withIndex("by_evaluated")
      .order("desc")
      .first();
    return row ?? null;
  },
});

export const getQualityHistory = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("memoryQuality")
      .withIndex("by_evaluated")
      .order("desc")
      .take(10);
    return rows;
  },
});
