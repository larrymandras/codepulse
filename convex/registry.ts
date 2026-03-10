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

    // --- MCP Servers: upsert + drift detection ---
    const existingServers = await ctx.db.query("mcpServers").collect();
    const incomingServerNames = new Set<string>();

    if (Array.isArray(snap.mcpServers)) {
      for (const server of snap.mcpServers) {
        incomingServerNames.add(server.name);
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
          // Log addition
          await ctx.db.insert("configChanges", {
            configKey: `mcpServer:${server.name}`,
            oldValue: undefined,
            newValue: server,
            changedBy: "scanner",
            changedAt: now,
          });
        }
      }
    }

    // Detect removed MCP servers
    for (const existing of existingServers) {
      if (!incomingServerNames.has(existing.name)) {
        await ctx.db.insert("configChanges", {
          configKey: `mcpServer:${existing.name}`,
          oldValue: existing,
          newValue: null,
          changedBy: "scanner",
          changedAt: now,
        });
      }
    }

    // --- Plugins: upsert + drift detection ---
    const existingPlugins = await ctx.db.query("plugins").collect();
    const incomingPluginNames = new Set<string>();

    if (Array.isArray(snap.plugins)) {
      for (const plugin of snap.plugins) {
        incomingPluginNames.add(plugin.name);
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
          // Log addition
          await ctx.db.insert("configChanges", {
            configKey: `plugin:${plugin.name}`,
            oldValue: undefined,
            newValue: plugin,
            changedBy: "scanner",
            changedAt: now,
          });
        }
      }
    }

    // Detect removed plugins
    for (const existing of existingPlugins) {
      if (!incomingPluginNames.has(existing.name)) {
        await ctx.db.insert("configChanges", {
          configKey: `plugin:${existing.name}`,
          oldValue: existing,
          newValue: null,
          changedBy: "scanner",
          changedAt: now,
        });
      }
    }

    // --- Skills: upsert + drift detection ---
    const existingSkills = await ctx.db.query("skills").collect();
    const incomingSkillNames = new Set<string>();

    if (Array.isArray(snap.skills)) {
      for (const skill of snap.skills) {
        incomingSkillNames.add(skill.name);
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
          // Log addition
          await ctx.db.insert("configChanges", {
            configKey: `skill:${skill.name}`,
            oldValue: undefined,
            newValue: skill,
            changedBy: "scanner",
            changedAt: now,
          });
        }
      }
    }

    // Detect removed skills
    for (const existing of existingSkills) {
      if (!incomingSkillNames.has(existing.name)) {
        await ctx.db.insert("configChanges", {
          configKey: `skill:${existing.name}`,
          oldValue: existing,
          newValue: null,
          changedBy: "scanner",
          changedAt: now,
        });
      }
    }

    // --- Hooks: upsert ---
    if (Array.isArray(snap.hooks)) {
      for (const hook of snap.hooks) {
        const existing = await ctx.db
          .query("registeredHooks")
          .withIndex("by_hookType", (q) => q.eq("hookType", hook.hookType))
          .first();
        if (!existing) {
          await ctx.db.insert("registeredHooks", {
            hookType: hook.hookType,
            command: hook.command,
            matcher: hook.matcher,
            registeredAt: now,
          });
        }
      }
    }

    // --- Slash Commands: upsert ---
    if (Array.isArray(snap.slashCommands)) {
      for (const cmd of snap.slashCommands) {
        const existing = await ctx.db
          .query("slashCommands")
          .withIndex("by_name", (q) => q.eq("name", cmd.name))
          .first();
        if (!existing) {
          await ctx.db.insert("slashCommands", {
            name: cmd.name,
            description: cmd.description,
            source: cmd.source,
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

/**
 * Bulk-import tools from an external inventory (e.g., Astridr_Tools repo).
 * All items go into discoveredTools — these are Python tool scripts, not MCP servers.
 * Upserts by name; existing tools get description/category updated without resetting usage.
 */
export const importToolInventory = mutation({
  args: {
    tools: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        category: v.optional(v.string()),
        source: v.optional(v.string()),
        registryType: v.optional(v.string()),
      })
    ),
    importSource: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    let created = 0;
    let updated = 0;

    for (const tool of args.tools) {
      const existing = await ctx.db
        .query("discoveredTools")
        .withIndex("by_name", (q) => q.eq("name", tool.name))
        .first();

      if (existing) {
        const patch: Record<string, any> = {};
        if (tool.description) patch.description = tool.description;
        if (tool.source) patch.source = tool.source;
        if (tool.category) patch.serverName = tool.category;
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch);
          updated++;
        }
      } else {
        await ctx.db.insert("discoveredTools", {
          name: tool.name,
          source: tool.source ?? args.importSource,
          serverName: tool.category,
          description: tool.description,
          usageCount: 0,
          lastUsedAt: now,
          discoveredAt: now,
        });
        created++;
      }
    }

    return { created, updated, total: args.tools.length };
  },
});

/**
 * One-time cleanup: remove Astridr tool names that were misclassified
 * into mcpServers, skills, and plugins tables.
 */
export const cleanupMisclassifiedTools = mutation({
  args: {
    toolNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const names = new Set(args.toolNames);
    let removed = 0;

    // Clean mcpServers
    const servers = await ctx.db.query("mcpServers").collect();
    for (const s of servers) {
      if (names.has(s.name)) {
        await ctx.db.delete(s._id);
        removed++;
      }
    }

    // Clean skills
    const skills = await ctx.db.query("skills").collect();
    for (const s of skills) {
      if (names.has(s.name)) {
        await ctx.db.delete(s._id);
        removed++;
      }
    }

    // Clean plugins
    const plugins = await ctx.db.query("plugins").collect();
    for (const p of plugins) {
      if (names.has(p.name)) {
        await ctx.db.delete(p._id);
        removed++;
      }
    }

    return { removed };
  },
});

// --- New queries ---

export const listMcpServers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("mcpServers").order("desc").collect();
  },
});

export const listPlugins = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("plugins").order("desc").collect();
  },
});

export const listSkills = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("skills").order("desc").collect();
  },
});

export const listHooks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("registeredHooks").order("desc").collect();
  },
});

export const listSlashCommands = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("slashCommands").order("desc").collect();
  },
});

export const listConfigChanges = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("configChanges")
      .withIndex("by_changedAt")
      .order("desc")
      .take(limit);
  },
});

export const capabilityGrowth = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db.query("discoveredTools").collect();
    const servers = await ctx.db.query("mcpServers").collect();
    const plugins = await ctx.db.query("plugins").collect();
    const skills = await ctx.db.query("skills").collect();

    // Group by day using discoveredAt/installedAt/lastSeenAt
    const dayMap: Record<string, { tools: number; mcpServers: number; plugins: number; skills: number }> = {};

    const toDayKey = (ts: number) => {
      const d = new Date(ts * 1000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const ensure = (day: string) => {
      if (!dayMap[day]) dayMap[day] = { tools: 0, mcpServers: 0, plugins: 0, skills: 0 };
    };

    for (const t of tools) {
      const day = toDayKey(t.discoveredAt);
      ensure(day);
      dayMap[day].tools++;
    }
    for (const s of servers) {
      const day = toDayKey(s.lastSeenAt);
      ensure(day);
      dayMap[day].mcpServers++;
    }
    for (const p of plugins) {
      const day = toDayKey(p.installedAt);
      ensure(day);
      dayMap[day].plugins++;
    }
    for (const sk of skills) {
      const day = toDayKey(sk.discoveredAt);
      ensure(day);
      dayMap[day].skills++;
    }

    // Sort by date and compute cumulative
    const sorted = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0]));
    let cumTools = 0, cumServers = 0, cumPlugins = 0, cumSkills = 0;
    return sorted.map(([date, counts]) => {
      cumTools += counts.tools;
      cumServers += counts.mcpServers;
      cumPlugins += counts.plugins;
      cumSkills += counts.skills;
      return {
        date,
        tools: cumTools,
        mcpServers: cumServers,
        plugins: cumPlugins,
        skills: cumSkills,
      };
    });
  },
});

export const upsertMcpServer = mutation({
  args: {
    name: v.string(),
    status: v.string(),
    url: v.optional(v.string()),
    toolCount: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("mcpServers")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        url: args.url ?? existing.url,
        toolCount: args.toolCount ?? existing.toolCount,
        lastSeenAt: now,
      });
    } else {
      await ctx.db.insert("mcpServers", {
        name: args.name,
        status: args.status,
        url: args.url,
        toolCount: args.toolCount,
        lastSeenAt: now,
      });
    }
  },
});

export const upsertPlugin = mutation({
  args: {
    name: v.string(),
    version: v.optional(v.string()),
    pluginType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("plugins")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        version: args.version ?? existing.version,
        config: args.pluginType ? { ...((existing.config as any) ?? {}), pluginType: args.pluginType } : existing.config,
      });
    } else {
      await ctx.db.insert("plugins", {
        name: args.name,
        version: args.version,
        enabled: true,
        config: args.pluginType ? { pluginType: args.pluginType } : undefined,
        installedAt: now,
      });
    }
  },
});

export const recordVersionBump = mutation({
  args: {
    component: v.string(),
    version: v.string(),
    previousVersion: v.optional(v.string()),
    changeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    await ctx.db.insert("versionHistory", {
      component: args.component,
      version: args.version,
      previousVersion: args.previousVersion,
      changedAt: now,
      changedBy: args.changeType ?? "runtime",
    });
  },
});

/**
 * Bulk-import MCP servers from Mandras_MCP_Servers manifest.
 * Names are normalized to lowercase to avoid duplicates.
 * If a server already exists (from runtime events), updates lastSeenAt
 * without overwriting the "connected" status.
 */
export const importMcpServers = mutation({
  args: {
    items: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        url: v.optional(v.string()),
        category: v.optional(v.string()),
      })
    ),
    importSource: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    let created = 0;
    for (const item of args.items) {
      const name = item.name.toLowerCase();
      const existing = await ctx.db
        .query("mcpServers")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (existing) {
        // Don't downgrade "connected" to "configured"
        await ctx.db.patch(existing._id, {
          lastSeenAt: now,
          url: item.url ?? existing.url,
        });
      } else {
        await ctx.db.insert("mcpServers", {
          name,
          url: item.url,
          status: "configured",
          toolCount: undefined,
          lastSeenAt: now,
        });
        created++;
      }
    }
    return { created, total: args.items.length };
  },
});

/**
 * Bulk-import skills from Mandras_Skills / Mandras_Made_Skills manifests.
 */
export const importSkills = mutation({
  args: {
    items: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        source: v.optional(v.string()),
        category: v.optional(v.string()),
      })
    ),
    importSource: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    let created = 0;
    for (const item of args.items) {
      const existing = await ctx.db
        .query("skills")
        .withIndex("by_name", (q) => q.eq("name", item.name))
        .first();
      if (!existing) {
        await ctx.db.insert("skills", {
          name: item.name,
          description: item.description,
          source: item.source ?? args.importSource,
          discoveredAt: now,
        });
        created++;
      }
    }
    return { created, total: args.items.length };
  },
});

/**
 * Bulk-import hooks from Mandras_Hooks manifest.
 */
export const importHooks = mutation({
  args: {
    items: v.array(
      v.object({
        name: v.string(),
        hookType: v.string(),
        description: v.optional(v.string()),
        command: v.string(),
        matcher: v.optional(v.string()),
        category: v.optional(v.string()),
      })
    ),
    importSource: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    let created = 0;
    for (const item of args.items) {
      const existing = await ctx.db
        .query("registeredHooks")
        .withIndex("by_hookType", (q) => q.eq("hookType", item.hookType))
        .first();
      if (!existing) {
        await ctx.db.insert("registeredHooks", {
          hookType: item.hookType,
          command: item.command,
          matcher: item.matcher,
          registeredAt: now,
        });
        created++;
      }
    }
    return { created, total: args.items.length };
  },
});

/**
 * Bulk-import plugins from Mandras_Plugins manifest.
 */
export const importPlugins = mutation({
  args: {
    items: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        version: v.optional(v.string()),
        category: v.optional(v.string()),
      })
    ),
    importSource: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    let created = 0;
    for (const item of args.items) {
      const existing = await ctx.db
        .query("plugins")
        .withIndex("by_name", (q) => q.eq("name", item.name))
        .first();
      if (!existing) {
        await ctx.db.insert("plugins", {
          name: item.name,
          version: item.version,
          enabled: true,
          config: item.description
            ? { description: item.description, category: item.category }
            : undefined,
          installedAt: now,
        });
        created++;
      }
    }
    return { created, total: args.items.length };
  },
});

export const getSessionSnapshot = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("environmentSnapshots")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();
  },
});

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const mcpServers = await ctx.db.query("mcpServers").collect();
    const plugins = await ctx.db.query("plugins").collect();
    const skills = await ctx.db.query("skills").collect();
    const tools = await ctx.db.query("discoveredTools").collect();
    const hooks = await ctx.db.query("registeredHooks").collect();
    const commands = await ctx.db.query("slashCommands").collect();
    return {
      mcpServers: mcpServers.length,
      plugins: plugins.length,
      skills: skills.length,
      tools: tools.length,
      hooks: hooks.length,
      slashCommands: commands.length,
    };
  },
});
