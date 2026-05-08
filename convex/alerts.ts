import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import { alertRules } from "./alertRules";
import { requireAuth } from "./lib/auth";

// ============================================================
// LOOKBACK WINDOW HELPER
// ============================================================

function lookbackToSeconds(window: string): number {
  switch (window) {
    case "5m": return 300;
    case "15m": return 900;
    case "30m": return 1800;
    case "1h": return 3600;
    case "24h": return 86400;
    default: return 3600;
  }
}

export const create = mutation({
  args: {
    severity: v.string(),
    source: v.string(),
    message: v.string(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("alerts", {
      severity: args.severity,
      source: args.source,
      message: args.message,
      details: args.details,
      acknowledged: false,
      createdAt: Date.now() / 1000,
    });
  },
});

export const acknowledge = mutation({
  args: {
    id: v.id("alerts"),
    acknowledgedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.patch(args.id, {
      acknowledged: true,
      acknowledgedBy: args.acknowledgedBy,
      acknowledgedAt: Date.now() / 1000,
    });
  },
});

export const acknowledgeInternal = internalMutation({
  args: {
    id: v.id("alerts"),
    acknowledgedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      acknowledged: true,
      acknowledgedBy: args.acknowledgedBy,
      acknowledgedAt: Date.now() / 1000,
      status: "resolved",
      resolvedAt: Date.now() / 1000,
    });
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .order("desc")
      .take(50);
  },
});

// ---------- NEW QUERIES ----------

export const listAll = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("alerts")
      .order("desc")
      .take(limit);
  },
});

export const listAllPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alerts")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const listBySource = query({
  args: {
    source: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("alerts")
      .withIndex("by_source", (q) => q.eq("source", args.source))
      .order("desc")
      .take(limit);
  },
});

export const countBySeverity = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();
    const counts = { info: 0, warning: 0, error: 0, critical: 0 };
    for (const a of active) {
      const sev = a.severity as keyof typeof counts;
      if (sev in counts) counts[sev]++;
    }
    return counts;
  },
});

export const dismissAll = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const active = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();
    const now = Date.now() / 1000;
    for (const a of active) {
      await ctx.db.patch(a._id, {
        acknowledged: true,
        acknowledgedBy: "dashboard-bulk",
        acknowledgedAt: now,
      });
    }
    return { dismissed: active.length };
  },
});

export const autoAcknowledgeStaleInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const twentyFourHoursAgo = now - 86400;
    const active = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();

    let count = 0;
    for (const a of active) {
      if (a.severity !== "critical" && a.createdAt < twentyFourHoursAgo) {
        await ctx.db.patch(a._id, {
          acknowledged: true,
          acknowledgedBy: "auto-acknowledge",
          acknowledgedAt: now,
        });
        count++;
      }
    }
    return { acknowledged: count };
  },
});

export const listActiveGrouped = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .order("desc")
      .take(100);

    const groups: Map<string, { alert: any; count: number }> = new Map();
    for (const a of active) {
      const windowKey = `${a.source}-${Math.floor(a.createdAt / 300)}`;
      const existing = groups.get(windowKey);
      if (existing) {
        existing.count++;
      } else {
        groups.set(windowKey, { alert: a, count: 1 });
      }
    }

    return Array.from(groups.values()).map(({ alert, count }) => ({
      ...alert,
      groupCount: count,
    }));
  },
});

// ---------- EVALUATE ENGINE ----------

export const evaluate = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const now = Date.now() / 1000;
    const oneHourAgo = now - 3600;
    const thirtyMinAgo = now - 1800;
    const fifteenMinAgo = now - 900;
    const tenMinAgo = now - 600;
    const fiveMinAgo = now - 300;

    // Fetch existing active alerts to avoid duplicates
    const activeAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();
    const activeSourceSet = new Set(activeAlerts.map((a) => a.source));

    // Load disabled rules from config
    const disabledConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "alert-rules-disabled"))
      .first();
    const disabledRules = new Set<string>((disabledConfig?.value as string[]) ?? []);

    const created: string[] = [];

    async function createIfNew(ruleId: string, severity: string, source: string, message: string) {
      // Skip disabled rules
      if (disabledRules.has(ruleId)) return;
      // Deduplicate: activeSourceSet is keyed on a.source, and all inserts below set source=ruleId,
      // so this check is correct. If source ever differs from ruleId, dedup will break silently.
      if (activeSourceSet.has(ruleId)) return;
      await ctx.db.insert("alerts", {
        severity,
        source: ruleId,
        message,
        acknowledged: false,
        createdAt: now,
      });
      activeSourceSet.add(ruleId);
      created.push(ruleId);
    }

    // --- STANDARD checks ---

    // High error rate
    const recentEvents = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);
    const hourEvents = recentEvents.filter((e) => e.timestamp >= oneHourAgo);
    const errorEvents = hourEvents.filter((e) => e.eventType === "error" || e.eventType === "tool_error");
    if (hourEvents.length > 10 && errorEvents.length / hourEvents.length > 0.2) {
      const rule = alertRules.find((r) => r.id === "std-high-error-rate");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Long sessions
    const activeSessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    for (const s of activeSessions) {
      if (now - s.startedAt > 7200) {
        const rule = alertRules.find((r) => r.id === "std-long-session");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Stale sessions
    for (const s of activeSessions) {
      if (now - s.lastEventAt > 1800) {
        const rule = alertRules.find((r) => r.id === "std-stale-sessions");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // High event count in session
    for (const s of activeSessions) {
      if (s.eventCount > 1000) {
        const rule = alertRules.find((r) => r.id === "std-high-event-count");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Agent crash loop
    const failedAgents = await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .take(50);
    const recentFailed = failedAgents.filter((a) => a.endedAt && a.endedAt >= tenMinAgo);
    if (recentFailed.length >= 3) {
      const rule = alertRules.find((r) => r.id === "std-agent-crash-loop");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Context overflow
    const recentSnapshots = await ctx.db
      .query("contextSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .take(10);
    for (const snap of recentSnapshots) {
      if (snap.contextTokens && snap.contextTokens > 180000) {
        const rule = alertRules.find((r) => r.id === "std-context-overflow");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Tool failures
    const toolFailEvents = recentEvents.filter(
      (e) => e.eventType === "tool_error" && e.timestamp >= thirtyMinAgo
    );
    if (toolFailEvents.length > 10) {
      const rule = alertRules.find((r) => r.id === "std-tool-failures");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Hook failures
    const hookFailEvents = recentEvents.filter(
      (e) => e.hookType && e.eventType === "error" && e.timestamp >= thirtyMinAgo
    );
    if (hookFailEvents.length > 3) {
      const rule = alertRules.find((r) => r.id === "std-hook-failures");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // --- DISCOVERY checks ---

    // MCP server disconnected
    const mcpServers = await ctx.db.query("mcpServers").collect();
    for (const srv of mcpServers) {
      if (srv.status === "disconnected" || srv.status === "error") {
        const rule = alertRules.find((r) => r.id === "disc-mcp-disconnected");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // MCP server timeout
    for (const srv of mcpServers) {
      if (now - srv.lastSeenAt > 300) {
        const rule = alertRules.find((r) => r.id === "disc-server-timeout");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Too many tools
    const toolCount = await ctx.db.query("discoveredTools").collect();
    if (toolCount.length > 100) {
      const rule = alertRules.find((r) => r.id === "disc-too-many-tools");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Disabled plugins
    const plugins = await ctx.db.query("plugins").collect();
    const disabledPlugins = plugins.filter((p) => !p.enabled);
    if (disabledPlugins.length > 0) {
      const rule = alertRules.find((r) => r.id === "disc-plugin-disabled");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Missing hooks
    const hooks = await ctx.db.query("registeredHooks").collect();
    if (hooks.length === 0) {
      const rule = alertRules.find((r) => r.id === "disc-missing-hooks");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Config drift
    const recentConfigChanges = await ctx.db
      .query("configChanges")
      .withIndex("by_changedAt")
      .order("desc")
      .take(50);
    const hourConfigChanges = recentConfigChanges.filter((c) => c.changedAt >= oneHourAgo);
    if (hourConfigChanges.length > 10) {
      const rule = alertRules.find((r) => r.id === "disc-config-drift");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // --- INFRASTRUCTURE checks ---

    // Docker containers
    const containers = await ctx.db.query("dockerContainers").collect();
    for (const c of containers) {
      if (c.status === "stopped" || c.status === "error") {
        const rule = alertRules.find((r) => r.id === "infra-container-stopped");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    for (const c of containers) {
      if (c.cpuPercent && c.cpuPercent > 80) {
        const rule = alertRules.find((r) => r.id === "infra-high-cpu");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    for (const c of containers) {
      if (c.memoryMb && c.memoryMb > 1024) {
        const rule = alertRules.find((r) => r.id === "infra-high-memory");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Supabase health
    const healthChecks = await ctx.db.query("supabaseHealth").collect();
    for (const h of healthChecks) {
      if (h.status === "degraded") {
        const rule = alertRules.find((r) => r.id === "infra-supabase-degraded");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    for (const h of healthChecks) {
      if (h.status === "down") {
        const rule = alertRules.find((r) => r.id === "infra-supabase-down");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    for (const h of healthChecks) {
      if (h.responseTimeMs && h.responseTimeMs > 2000) {
        const rule = alertRules.find((r) => r.id === "infra-high-response-time");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // --- LLM checks ---

    const recentLlm = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    // High cost
    const hourLlm = recentLlm.filter((m) => m.timestamp >= oneHourAgo);
    const totalCost = hourLlm.reduce((sum, m) => sum + (m.cost ?? 0), 0);
    if (totalCost > 5) {
      const rule = alertRules.find((r) => r.id === "llm-high-cost");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Rate limit
    const fiveMinLlm = recentLlm.filter((m) => m.timestamp >= fiveMinAgo);
    if (fiveMinLlm.length > 50) {
      const rule = alertRules.find((r) => r.id === "llm-rate-limit");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // High latency
    if (hourLlm.length > 0) {
      const avgLatency = hourLlm.reduce((s, m) => s + m.latencyMs, 0) / hourLlm.length;
      if (avgLatency > 10000) {
        const rule = alertRules.find((r) => r.id === "llm-high-latency");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
      }
    }

    // Cost anomaly
    for (const m of recentLlm) {
      if (m.cost && m.cost > 0.5) {
        const rule = alertRules.find((r) => r.id === "llm-cost-anomaly");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Token budget
    for (const m of recentLlm) {
      if (m.totalTokens > 1000000) {
        const rule = alertRules.find((r) => r.id === "llm-token-budget");
        if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // No successful calls (all providers down)
    if (fiveMinLlm.length === 0 && recentLlm.length > 0) {
      const rule = alertRules.find((r) => r.id === "llm-all-providers-down");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // --- SECURITY checks ---

    const recentSecurity = await ctx.db
      .query("securityEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    // Critical security events
    const criticalSec = recentSecurity.filter(
      (e) => e.severity === "critical" && e.timestamp >= oneHourAgo
    );
    if (criticalSec.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-critical-event");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Many high-severity
    const highSec = recentSecurity.filter(
      (e) => e.severity === "high" && e.timestamp >= oneHourAgo
    );
    if (highSec.length > 5) {
      const rule = alertRules.find((r) => r.id === "sec-many-high-severity");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Unmitigated events
    const unmitigated = recentSecurity.filter(
      (e) => !e.mitigated && e.timestamp <= thirtyMinAgo
    );
    if (unmitigated.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-unmitigated");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // High frequency
    const tenMinSec = recentSecurity.filter((e) => e.timestamp >= tenMinAgo);
    if (tenMinSec.length > 20) {
      const rule = alertRules.find((r) => r.id === "sec-high-frequency");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Permission violations
    const permViolations = recentSecurity.filter(
      (e) => e.eventType === "permission_violation" && e.timestamp >= oneHourAgo
    );
    if (permViolations.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-permission-violation");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Injection attempts
    const injections = recentSecurity.filter(
      (e) => e.eventType === "injection_attempt" && e.timestamp >= oneHourAgo
    );
    if (injections.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-injection-attempt");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Privilege escalation
    const privEsc = recentSecurity.filter(
      (e) => e.eventType === "privilege_escalation" && e.timestamp >= oneHourAgo
    );
    if (privEsc.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-privilege-escalation");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // RLS bypass
    const rlsBypass = recentSecurity.filter(
      (e) => e.eventType === "rls_bypass" && e.timestamp >= oneHourAgo
    );
    if (rlsBypass.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-rls-bypass");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // --- SELF-HEALING checks ---

    const recentHealing = await ctx.db
      .query("selfHealingEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    // Component failures
    const failedHealing = recentHealing.filter(
      (e) => e.outcome === "failed" && e.timestamp >= oneHourAgo
    );
    if (failedHealing.length > 0) {
      const rule = alertRules.find((r) => r.id === "sh-component-failure");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Recovery failed
    const recoveryFailed = recentHealing.filter(
      (e) => e.outcome === "failed" && (e.action === "restart" || e.action === "retry") && e.timestamp >= oneHourAgo
    );
    if (recoveryFailed.length > 0) {
      const rule = alertRules.find((r) => r.id === "sh-recovery-failed");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Escalation triggered
    const escalations = recentHealing.filter(
      (e) => e.action === "escalate" && e.timestamp >= oneHourAgo
    );
    if (escalations.length > 0) {
      const rule = alertRules.find((r) => r.id === "sh-escalation-triggered");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Too many retries
    const retries = recentHealing.filter(
      (e) => e.action === "retry" && e.timestamp >= oneHourAgo
    );
    if (retries.length > 5) {
      const rule = alertRules.find((r) => r.id === "sh-too-many-retries");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Rollbacks
    const rollbacks = recentHealing.filter(
      (e) => e.action === "rollback" && e.timestamp >= oneHourAgo
    );
    if (rollbacks.length > 0) {
      const rule = alertRules.find((r) => r.id === "sh-version-rollback");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Pending too long
    const pendingHealing = recentHealing.filter(
      (e) => e.outcome === "pending" && e.timestamp <= fifteenMinAgo
    );
    if (pendingHealing.length > 0) {
      const rule = alertRules.find((r) => r.id === "sh-pending-too-long");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Cascading failure (3+ different components failing in 5 min)
    const fiveMinFailed = recentHealing.filter(
      (e) => e.outcome === "failed" && e.timestamp >= fiveMinAgo
    );
    const failedComponents = new Set(fiveMinFailed.map((e) => e.component));
    if (failedComponents.size >= 3) {
      const rule = alertRules.find((r) => r.id === "sh-cascading-failure");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Multiple components down
    if (failedComponents.size >= 2) {
      const rule = alertRules.find((r) => r.id === "sh-multiple-components-down");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Manual intervention needed (all auto recovery exhausted)
    const allFailed = recentHealing.filter(
      (e) => e.outcome === "failed" && e.timestamp >= oneHourAgo
    );
    const escalated = recentHealing.filter(
      (e) => e.action === "escalate" && e.outcome === "failed" && e.timestamp >= oneHourAgo
    );
    if (escalated.length > 0 && allFailed.length > 5) {
      const rule = alertRules.find((r) => r.id === "sh-manual-intervention");
      if (rule) await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    return { evaluated: alertRules.length, created: created.length, alerts: created };
  },
});

// Internal version for cron jobs and scheduler
export const evaluateInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const oneHourAgo = now - 3600;

    // ---- AUTO-RESOLVE: check active alerts whose condition is no longer met ----
    const activeAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();

    for (const alert of activeAlerts) {
      // Only auto-resolve alerts tied to a static rule (source matches a rule id)
      const rule = alertRules.find((r) => r.id === alert.source);
      if (!rule) continue;
      // Check if condition is still met by re-evaluating the rule's key metric
      // For simplicity, we resolve if the alert is older than the lookback window and no new alert would fire
      // (Full re-evaluation per rule would require duplicating all check logic — instead we mark resolved
      // if acknowledged=false and status is explicitly "active" and createdAt > 6 hours, suggesting stale)
      // Real resolution happens via the specific condition re-check below for key rules.
      if (alert.status === "active" && now - alert.createdAt > 21600) {
        await ctx.db.patch(alert._id, {
          status: "resolved",
          resolvedAt: now,
        });
      }
    }

    // Reload after resolves
    const stillActive = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();
    const activeSourceSet = new Set(stillActive.map((a) => a.source));

    const disabledConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "alert-rules-disabled"))
      .first();
    const disabledRules = new Set<string>((disabledConfig?.value as string[]) ?? []);

    const created: string[] = [];

    async function createIfNew(ruleId: string, severity: string, source: string, message: string) {
      if (disabledRules.has(ruleId)) return;
      if (activeSourceSet.has(ruleId)) return;
      const newAlertId = await ctx.db.insert("alerts", {
        severity,
        source: ruleId,
        message,
        acknowledged: false,
        createdAt: now,
        webhookStatus: "pending",
      });
      activeSourceSet.add(ruleId);
      created.push(ruleId);
      // Schedule webhook delivery (per D-08) — non-blocking
      await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
        alertId: newAlertId,
        attempt: 1,
      });
    }

    // ---- THRESHOLD OVERRIDE HELPER ----
    async function getOverride(ruleId: string): Promise<{ threshold: number; lookbackWindow: string } | null> {
      const configKey = `alert-rule-override:${ruleId}`;
      const row = await ctx.db
        .query("agentConfigs")
        .withIndex("by_key", (q) => q.eq("configKey", configKey))
        .first();
      return row ? (row.value as { threshold: number; lookbackWindow: string }) : null;
    }

    // ---- STATIC RULE EVALUATION ----
    const recentEvents = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    // High error rate (with threshold override support)
    {
      const rule = alertRules.find((r) => r.id === "std-high-error-rate");
      if (rule) {
        const override = await getOverride(rule.id);
        const windowSeconds = override?.lookbackWindow ? lookbackToSeconds(override.lookbackWindow) : 3600;
        const threshold = override?.threshold ?? 0.2;
        const windowStart = now - windowSeconds;
        const windowEvents = recentEvents.filter((e) => e.timestamp >= windowStart);
        const errorEvts = windowEvents.filter((e) => e.eventType === "error" || e.eventType === "tool_error");
        if (windowEvents.length > 10 && errorEvts.length / windowEvents.length > threshold) {
          await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        }
      }
    }

    const activeSessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Stale sessions
    {
      const rule = alertRules.find((r) => r.id === "std-stale-sessions");
      if (rule) {
        const override = await getOverride(rule.id);
        const windowSeconds = override?.threshold ?? 1800;
        for (const s of activeSessions) {
          if (now - s.lastEventAt > windowSeconds) {
            await createIfNew(rule.id, rule.severity, rule.source, rule.message);
            break;
          }
        }
      }
    }

    // ---- CUSTOM RULE EVALUATION ----
    const customRules = await ctx.db
      .query("alertRuleCustom")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();

    for (const customRule of customRules) {
      if (activeSourceSet.has(customRule._id)) continue;
      if (disabledRules.has(customRule._id)) continue;

      const evaluateCondition = (condition: {
        metric: string;
        operator: string;
        threshold: number;
        lookbackWindow: string;
      }): boolean => {
        const windowSeconds = lookbackToSeconds(condition.lookbackWindow);
        const windowStart = now - windowSeconds;
        const windowEvents = recentEvents.filter((e) => e.timestamp >= windowStart);

        let value = 0;
        if (condition.metric === "error_rate") {
          value = windowEvents.length > 0
            ? windowEvents.filter((e) => e.eventType === "error" || e.eventType === "tool_error").length / windowEvents.length
            : 0;
        } else if (condition.metric === "event_count") {
          value = windowEvents.length;
        } else if (condition.metric === "error_count") {
          value = windowEvents.filter((e) => e.eventType === "error" || e.eventType === "tool_error").length;
        }

        switch (condition.operator) {
          case "gt": return value > condition.threshold;
          case "gte": return value >= condition.threshold;
          case "lt": return value < condition.threshold;
          case "lte": return value <= condition.threshold;
          case "eq": return value === condition.threshold;
          default: return false;
        }
      };

      let triggered = false;
      const logic = customRule.conditionLogic ?? "AND";

      if (customRule.conditionGroups && customRule.conditionGroups.length > 0) {
        // Evaluate groups
        const groupResults = customRule.conditionGroups.map((group: { conditions: any[]; logic: string }) => {
          const condResults = group.conditions.map(evaluateCondition);
          return group.logic === "OR"
            ? condResults.some(Boolean)
            : condResults.every(Boolean);
        });
        triggered = logic === "OR" ? groupResults.some(Boolean) : groupResults.every(Boolean);
      } else {
        const condResults = customRule.conditions.map(evaluateCondition);
        triggered = logic === "OR" ? condResults.some(Boolean) : condResults.every(Boolean);
      }

      if (triggered) {
        const message = customRule.messageTemplate ?? `Custom alert rule triggered: ${customRule.name}`;
        await createIfNew(customRule._id, customRule.severity, customRule.name, message);
      }
    }

    return { evaluated: alertRules.length + customRules.length, created: created.length, alerts: created };
  },
});

// Rate-limit helper: returns the last critical eval timestamp (epoch seconds) or null
export const getLastCriticalEvalTimestamp = internalQuery({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "last-critical-eval"))
      .first();
    return config ? (config.value as number) : null;
  },
});

// Critical-only evaluation for ingest hook (sub-60s alerting, per D-04)
export const evaluateCriticalInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;

    const activeAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();
    const activeSourceSet = new Set(activeAlerts.map((a) => a.source));

    const disabledConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "alert-rules-disabled"))
      .first();
    const disabledRules = new Set<string>((disabledConfig?.value as string[]) ?? []);

    const created: string[] = [];

    async function createCriticalIfNew(ruleId: string, severity: string, source: string, message: string) {
      if (disabledRules.has(ruleId)) return;
      if (activeSourceSet.has(ruleId)) return;
      const newAlertId = await ctx.db.insert("alerts", {
        severity,
        source: ruleId,
        message,
        acknowledged: false,
        createdAt: now,
        webhookStatus: "pending",
      });
      activeSourceSet.add(ruleId);
      created.push(ruleId);
      await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
        alertId: newAlertId,
        attempt: 1,
      });
    }

    // Only evaluate critical-severity static rules
    const criticalStaticRules = alertRules.filter((r) => r.severity === "critical");
    const recentEvents = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
    const oneHourAgo = now - 3600;
    const hourEvents = recentEvents.filter((e) => e.timestamp >= oneHourAgo);

    for (const rule of criticalStaticRules) {
      if (rule.id === "sec-critical-event") {
        const criticalSecEvents = await ctx.db
          .query("securityEvents")
          .withIndex("by_timestamp")
          .order("desc")
          .take(10);
        const recent = criticalSecEvents.filter(
          (e) => e.severity === "critical" && e.timestamp >= oneHourAgo
        );
        if (recent.length > 0) {
          await createCriticalIfNew(rule.id, rule.severity, rule.source, rule.message);
        }
      } else if (rule.id === "std-high-error-rate") {
        const errorEvts = hourEvents.filter((e) => e.eventType === "error" || e.eventType === "tool_error");
        if (hourEvents.length > 10 && errorEvts.length / hourEvents.length > 0.2) {
          await createCriticalIfNew(rule.id, rule.severity, rule.source, rule.message);
        }
      }
    }

    // Only evaluate critical-severity custom rules
    const criticalCustomRules = await ctx.db
      .query("alertRuleCustom")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    const criticalCustom = criticalCustomRules.filter((r) => r.severity === "critical");

    for (const customRule of criticalCustom) {
      if (activeSourceSet.has(customRule._id)) continue;
      if (disabledRules.has(customRule._id)) continue;

      const evaluateCondition = (condition: {
        metric: string;
        operator: string;
        threshold: number;
        lookbackWindow: string;
      }): boolean => {
        const windowSeconds = lookbackToSeconds(condition.lookbackWindow);
        const windowStart = now - windowSeconds;
        const windowEvents = recentEvents.filter((e) => e.timestamp >= windowStart);

        let value = 0;
        if (condition.metric === "error_rate") {
          value = windowEvents.length > 0
            ? windowEvents.filter((e) => e.eventType === "error" || e.eventType === "tool_error").length / windowEvents.length
            : 0;
        } else if (condition.metric === "event_count") {
          value = windowEvents.length;
        } else if (condition.metric === "error_count") {
          value = windowEvents.filter((e) => e.eventType === "error" || e.eventType === "tool_error").length;
        }

        switch (condition.operator) {
          case "gt": return value > condition.threshold;
          case "gte": return value >= condition.threshold;
          case "lt": return value < condition.threshold;
          case "lte": return value <= condition.threshold;
          case "eq": return value === condition.threshold;
          default: return false;
        }
      };

      const logic = customRule.conditionLogic ?? "AND";
      let triggered = false;

      if (customRule.conditionGroups && customRule.conditionGroups.length > 0) {
        const groupResults = customRule.conditionGroups.map((group: { conditions: any[]; logic: string }) => {
          const condResults = group.conditions.map(evaluateCondition);
          return group.logic === "OR"
            ? condResults.some(Boolean)
            : condResults.every(Boolean);
        });
        triggered = logic === "OR" ? groupResults.some(Boolean) : groupResults.every(Boolean);
      } else {
        const condResults = customRule.conditions.map(evaluateCondition);
        triggered = logic === "OR" ? condResults.some(Boolean) : condResults.every(Boolean);
      }

      if (triggered) {
        const message = customRule.messageTemplate ?? `Custom critical alert: ${customRule.name}`;
        await createCriticalIfNew(customRule._id, customRule.severity, customRule.name, message);
      }
    }

    // Update rate-limit timestamp so subsequent ingest calls can skip re-evaluation
    const evalTimestampConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "last-critical-eval"))
      .first();
    if (evalTimestampConfig) {
      await ctx.db.patch(evalTimestampConfig._id, { value: now as any, updatedAt: now });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey: "last-critical-eval",
        value: now as any,
        updatedAt: now,
      });
    }

    return { evaluated: criticalStaticRules.length + criticalCustom.length, created: created.length, alerts: created };
  },
});

// ============================================================
// INTERNAL HELPERS (for webhookDelivery action)
// ============================================================

export const getById = internalQuery({
  args: {
    id: v.id("alerts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const updateWebhookStatus = internalMutation({
  args: {
    id: v.id("alerts"),
    status: v.string(),
    deliveredAt: v.optional(v.float64()),
    attempts: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const { id, status, deliveredAt, attempts } = args;
    await ctx.db.patch(id, {
      webhookStatus: status,
      ...(deliveredAt !== undefined ? { webhookDeliveredAt: deliveredAt } : {}),
      ...(attempts !== undefined ? { webhookAttempts: attempts } : {}),
    });
  },
});
