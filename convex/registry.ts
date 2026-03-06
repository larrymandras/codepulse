import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncInventory = mutation({
  args: {
    snapshot: v.any(),
  },
  handler: async (ctx, args) => {
    const snap = args.snapshot;
    const now = Date.now() / 1000;

    // Store environment snapshot
    await ctx.db.insert("environmentSnapshots", {
      sessionId: snap.sessionId ?? undefined,
      snapshot: snap,
      scannedAt: snap.scannedAt ?? now,
    });

    // Upsert MCP servers
    if (Array.isArray(snap.mcpServers)) {
      for (const server of snap.mcpServers) {
        const existing = await ctx.db
          .query("mcpServers")
          .withIndex("by_name", (q) => q.eq("name", server.name))
          .first();
        if (existing) {
          await ctx.db.patch(existing._id, {
            status: server.status ?? "connected",
            lastSeenAt: now,
          });
        } else {
          await ctx.db.insert("mcpServers", {
            name: server.name,
            url: server.url,
            status: server.status ?? "discovered",
            lastSeenAt: now,
          });
        }
      }
    }

    // Upsert plugins
    if (Array.isArray(snap.plugins)) {
      for (const plugin of snap.plugins) {
        const existing = await ctx.db
          .query("plugins")
          .withIndex("by_name", (q) => q.eq("name", plugin.name))
          .first();
        if (!existing) {
          await ctx.db.insert("plugins", {
            name: plugin.name,
            version: plugin.version,
            enabled: plugin.enabled ?? true,
            config: plugin.config,
            installedAt: now,
          });
        }
      }
    }

    // Upsert skills
    if (Array.isArray(snap.skills)) {
      for (const skill of snap.skills) {
        const existing = await ctx.db
          .query("skills")
          .withIndex("by_name", (q) => q.eq("name", skill.name))
          .first();
        if (!existing) {
          await ctx.db.insert("skills", {
            name: skill.name,
            description: skill.description,
            source: skill.source,
            discoveredAt: now,
          });
        }
      }
    }
  },
});

export const listTools = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("discoveredTools")
      .withIndex("by_usage")
      .order("desc")
      .take(50);
  },
});

export const detectAndRegisterTool = mutation({
  args: {
    name: v.string(),
    source: v.string(),
    serverName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("discoveredTools")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        usageCount: existing.usageCount + 1,
        lastUsedAt: now,
      });
    } else {
      await ctx.db.insert("discoveredTools", {
        name: args.name,
        source: args.source,
        serverName: args.serverName,
        usageCount: 1,
        lastUsedAt: now,
        discoveredAt: now,
      });
    }
  },
});
