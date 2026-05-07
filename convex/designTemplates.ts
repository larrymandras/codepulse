// Design Studio — Convex domain module for Open Design template mirror (Phase 01)
//
// Mirrors daemon SQLite `templates` table to Convex for template gallery discovery.
// See RESEARCH.md Pattern 3 — Convex Mirror (SQLite → Convex Sync).
//
// See designProjects.ts syncFromDaemon comment re: Convex cloud limitation (RESEARCH.md A7)

import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const upsert = mutation({
  args: {
    odTemplateId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    sourceProjectId: v.optional(v.string()),
    skillId: v.optional(v.string()),
    designSystemId: v.optional(v.string()),
    odCreatedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("designTemplates")
      .withIndex("by_odTemplateId", (q) => q.eq("odTemplateId", args.odTemplateId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, syncedAt: now });
    } else {
      await ctx.db.insert("designTemplates", { ...args, syncedAt: now });
    }
  },
});

export const remove = mutation({
  args: { odTemplateId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("designTemplates")
      .withIndex("by_odTemplateId", (q) => q.eq("odTemplateId", args.odTemplateId))
      .first();
    if (doc) await ctx.db.delete(doc._id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("designTemplates").order("desc").take(200);
  },
});

export const listIds = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("designTemplates").take(500);
    return docs.map((d) => d.odTemplateId);
  },
});

export const getSyncedAt = query({
  args: { odTemplateId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("designTemplates")
      .withIndex("by_odTemplateId", (q) => q.eq("odTemplateId", args.odTemplateId))
      .first();
    return doc?.syncedAt ?? null;
  },
});

// ---------------------------------------------------------------------------
// Sync action — fetches templates from Open Design daemon and mirrors to Convex
//
// See designProjects.ts syncFromDaemon for full Convex cloud limitation comment.
// Configure OPEN_DESIGN_URL in Convex Dashboard environment variables.
// ---------------------------------------------------------------------------
export const syncFromDaemon = action({
  args: {},
  handler: async (ctx) => {
    const url = process.env.OPEN_DESIGN_URL;
    if (!url) return { synced: 0, removed: 0 };
    try {
      // Record action start time before reading existingIds (CR-04 TOCTOU guard)
      const actionStartedAt = Date.now();
      const REMOVAL_GRACE_MS = 60_000;

      const res = await fetch(`${url}/api/templates`);
      if (!res.ok) return { synced: 0, removed: 0 };
      const templates = await res.json() as Array<{
        id: string;
        name: string;
        description?: string | null;
        source_project_id?: string | null;
        created_at: number;
      }>;
      const existingIds: string[] = await ctx.runQuery(api.designTemplates.listIds);
      const incomingIds = new Set(templates.map((t) => t.id));
      for (const t of templates) {
        await ctx.runMutation(api.designTemplates.upsert, {
          odTemplateId: t.id,
          name: t.name,
          description: t.description ?? undefined,
          sourceProjectId: t.source_project_id ?? undefined,
          odCreatedAt: t.created_at,
        });
      }
      let removed = 0;
      for (const id of existingIds) {
        if (!incomingIds.has(id)) {
          const syncedAt: number | null = await ctx.runQuery(
            api.designTemplates.getSyncedAt,
            { odTemplateId: id },
          );
          if (syncedAt !== null && actionStartedAt - syncedAt < REMOVAL_GRACE_MS) {
            continue;
          }
          await ctx.runMutation(api.designTemplates.remove, { odTemplateId: id });
          removed++;
        }
      }
      return { synced: templates.length, removed };
    } catch {
      // Daemon offline or error — skip silently
      return { synced: 0, removed: 0 };
    }
  },
});
