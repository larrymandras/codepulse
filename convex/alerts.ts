import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { alertRules } from "./alertRules";

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
    await ctx.db.patch(args.id, {
      acknowledged: true,
      acknowledgedBy: args.acknowledgedBy,
      acknowledgedAt: Date.now() / 1000,
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

export const listBySource = query({
  args: {
    source: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const all = await ctx.db
      .query("alerts")
      .order("desc")
      .take(500);
    return all.filter((a) => a.source === args.source).slice(0, limit);
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

// ---------- EVALUATE ENGINE ----------

export const evaluate = mutation({
  args: {},
  handler: async (ctx) => {
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

    const created: string[] = [];

    async function createIfNew(ruleId: string, severity: string, source: string, message: string) {
      // Deduplicate: skip if an active alert with this source already exists
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
      const rule = alertRules.find((r) => r.id === "std-high-error-rate")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Long sessions
    const activeSessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    for (const s of activeSessions) {
      if (now - s.startedAt > 7200) {
        const rule = alertRules.find((r) => r.id === "std-long-session")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Stale sessions
    for (const s of activeSessions) {
      if (now - s.lastEventAt > 1800) {
        const rule = alertRules.find((r) => r.id === "std-stale-sessions")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // High event count in session
    for (const s of activeSessions) {
      if (s.eventCount > 1000) {
        const rule = alertRules.find((r) => r.id === "std-high-event-count")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
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
      const rule = alertRules.find((r) => r.id === "std-agent-crash-loop")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Context overflow
    const recentSnapshots = await ctx.db
      .query("contextSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .take(10);
    for (const snap of recentSnapshots) {
      if (snap.contextTokens && snap.contextTokens > 180000) {
        const rule = alertRules.find((r) => r.id === "std-context-overflow")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Tool failures
    const toolFailEvents = recentEvents.filter(
      (e) => e.eventType === "tool_error" && e.timestamp >= thirtyMinAgo
    );
    if (toolFailEvents.length > 10) {
      const rule = alertRules.find((r) => r.id === "std-tool-failures")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Hook failures
    const hookFailEvents = recentEvents.filter(
      (e) => e.hookType && e.eventType === "error" && e.timestamp >= thirtyMinAgo
    );
    if (hookFailEvents.length > 3) {
      const rule = alertRules.find((r) => r.id === "std-hook-failures")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // --- DISCOVERY checks ---

    // MCP server disconnected
    const mcpServers = await ctx.db.query("mcpServers").collect();
    for (const srv of mcpServers) {
      if (srv.status === "disconnected" || srv.status === "error") {
        const rule = alertRules.find((r) => r.id === "disc-mcp-disconnected")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // MCP server timeout
    for (const srv of mcpServers) {
      if (now - srv.lastSeenAt > 300) {
        const rule = alertRules.find((r) => r.id === "disc-server-timeout")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Too many tools
    const toolCount = await ctx.db.query("discoveredTools").collect();
    if (toolCount.length > 100) {
      const rule = alertRules.find((r) => r.id === "disc-too-many-tools")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Disabled plugins
    const plugins = await ctx.db.query("plugins").collect();
    const disabledPlugins = plugins.filter((p) => !p.enabled);
    if (disabledPlugins.length > 0) {
      const rule = alertRules.find((r) => r.id === "disc-plugin-disabled")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Missing hooks
    const hooks = await ctx.db.query("registeredHooks").collect();
    if (hooks.length === 0) {
      const rule = alertRules.find((r) => r.id === "disc-missing-hooks")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Config drift
    const recentConfigChanges = await ctx.db
      .query("configChanges")
      .withIndex("by_changedAt")
      .order("desc")
      .take(50);
    const hourConfigChanges = recentConfigChanges.filter((c) => c.changedAt >= oneHourAgo);
    if (hourConfigChanges.length > 10) {
      const rule = alertRules.find((r) => r.id === "disc-config-drift")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // --- INFRASTRUCTURE checks ---

    // Docker containers
    const containers = await ctx.db.query("dockerContainers").collect();
    for (const c of containers) {
      if (c.status === "stopped" || c.status === "error") {
        const rule = alertRules.find((r) => r.id === "infra-container-stopped")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    for (const c of containers) {
      if (c.cpuPercent && c.cpuPercent > 80) {
        const rule = alertRules.find((r) => r.id === "infra-high-cpu")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    for (const c of containers) {
      if (c.memoryMb && c.memoryMb > 1024) {
        const rule = alertRules.find((r) => r.id === "infra-high-memory")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Supabase health
    const healthChecks = await ctx.db.query("supabaseHealth").collect();
    for (const h of healthChecks) {
      if (h.status === "degraded") {
        const rule = alertRules.find((r) => r.id === "infra-supabase-degraded")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    for (const h of healthChecks) {
      if (h.status === "down") {
        const rule = alertRules.find((r) => r.id === "infra-supabase-down")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    for (const h of healthChecks) {
      if (h.responseTimeMs && h.responseTimeMs > 2000) {
        const rule = alertRules.find((r) => r.id === "infra-high-response-time")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
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
      const rule = alertRules.find((r) => r.id === "llm-high-cost")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Rate limit
    const fiveMinLlm = recentLlm.filter((m) => m.timestamp >= fiveMinAgo);
    if (fiveMinLlm.length > 50) {
      const rule = alertRules.find((r) => r.id === "llm-rate-limit")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // High latency
    if (hourLlm.length > 0) {
      const avgLatency = hourLlm.reduce((s, m) => s + m.latencyMs, 0) / hourLlm.length;
      if (avgLatency > 10000) {
        const rule = alertRules.find((r) => r.id === "llm-high-latency")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
      }
    }

    // Cost anomaly
    for (const m of recentLlm) {
      if (m.cost && m.cost > 0.5) {
        const rule = alertRules.find((r) => r.id === "llm-cost-anomaly")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // Token budget
    for (const m of recentLlm) {
      if (m.totalTokens > 1000000) {
        const rule = alertRules.find((r) => r.id === "llm-token-budget")!;
        await createIfNew(rule.id, rule.severity, rule.source, rule.message);
        break;
      }
    }

    // No successful calls (all providers down)
    if (fiveMinLlm.length === 0 && recentLlm.length > 0) {
      const rule = alertRules.find((r) => r.id === "llm-all-providers-down")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
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
      const rule = alertRules.find((r) => r.id === "sec-critical-event")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Many high-severity
    const highSec = recentSecurity.filter(
      (e) => e.severity === "high" && e.timestamp >= oneHourAgo
    );
    if (highSec.length > 5) {
      const rule = alertRules.find((r) => r.id === "sec-many-high-severity")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Unmitigated events
    const unmitigated = recentSecurity.filter(
      (e) => !e.mitigated && e.timestamp <= thirtyMinAgo
    );
    if (unmitigated.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-unmitigated")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // High frequency
    const tenMinSec = recentSecurity.filter((e) => e.timestamp >= tenMinAgo);
    if (tenMinSec.length > 20) {
      const rule = alertRules.find((r) => r.id === "sec-high-frequency")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Permission violations
    const permViolations = recentSecurity.filter(
      (e) => e.eventType === "permission_violation" && e.timestamp >= oneHourAgo
    );
    if (permViolations.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-permission-violation")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Injection attempts
    const injections = recentSecurity.filter(
      (e) => e.eventType === "injection_attempt" && e.timestamp >= oneHourAgo
    );
    if (injections.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-injection-attempt")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Privilege escalation
    const privEsc = recentSecurity.filter(
      (e) => e.eventType === "privilege_escalation" && e.timestamp >= oneHourAgo
    );
    if (privEsc.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-privilege-escalation")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // RLS bypass
    const rlsBypass = recentSecurity.filter(
      (e) => e.eventType === "rls_bypass" && e.timestamp >= oneHourAgo
    );
    if (rlsBypass.length > 0) {
      const rule = alertRules.find((r) => r.id === "sec-rls-bypass")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
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
      const rule = alertRules.find((r) => r.id === "sh-component-failure")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Recovery failed
    const recoveryFailed = recentHealing.filter(
      (e) => e.outcome === "failed" && (e.action === "restart" || e.action === "retry") && e.timestamp >= oneHourAgo
    );
    if (recoveryFailed.length > 0) {
      const rule = alertRules.find((r) => r.id === "sh-recovery-failed")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Escalation triggered
    const escalations = recentHealing.filter(
      (e) => e.action === "escalate" && e.timestamp >= oneHourAgo
    );
    if (escalations.length > 0) {
      const rule = alertRules.find((r) => r.id === "sh-escalation-triggered")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Too many retries
    const retries = recentHealing.filter(
      (e) => e.action === "retry" && e.timestamp >= oneHourAgo
    );
    if (retries.length > 5) {
      const rule = alertRules.find((r) => r.id === "sh-too-many-retries")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Rollbacks
    const rollbacks = recentHealing.filter(
      (e) => e.action === "rollback" && e.timestamp >= oneHourAgo
    );
    if (rollbacks.length > 0) {
      const rule = alertRules.find((r) => r.id === "sh-version-rollback")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Pending too long
    const pendingHealing = recentHealing.filter(
      (e) => e.outcome === "pending" && e.timestamp <= fifteenMinAgo
    );
    if (pendingHealing.length > 0) {
      const rule = alertRules.find((r) => r.id === "sh-pending-too-long")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Cascading failure (3+ different components failing in 5 min)
    const fiveMinFailed = recentHealing.filter(
      (e) => e.outcome === "failed" && e.timestamp >= fiveMinAgo
    );
    const failedComponents = new Set(fiveMinFailed.map((e) => e.component));
    if (failedComponents.size >= 3) {
      const rule = alertRules.find((r) => r.id === "sh-cascading-failure")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Multiple components down
    if (failedComponents.size >= 2) {
      const rule = alertRules.find((r) => r.id === "sh-multiple-components-down")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    // Manual intervention needed (all auto recovery exhausted)
    const allFailed = recentHealing.filter(
      (e) => e.outcome === "failed" && e.timestamp >= oneHourAgo
    );
    const escalated = recentHealing.filter(
      (e) => e.action === "escalate" && e.outcome === "failed" && e.timestamp >= oneHourAgo
    );
    if (escalated.length > 0 && allFailed.length > 5) {
      const rule = alertRules.find((r) => r.id === "sh-manual-intervention")!;
      await createIfNew(rule.id, rule.severity, rule.source, rule.message);
    }

    return { evaluated: alertRules.length, created: created.length, alerts: created };
  },
});
