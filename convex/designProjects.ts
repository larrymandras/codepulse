// Design Studio — Convex domain module for Open Design project mirror (Phase 01)
//
// Mirrors daemon SQLite `projects` table to Convex for native listing/search.
// See RESEARCH.md Pattern 3 — Convex Mirror (SQLite → Convex Sync).

import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const upsert = mutation({
  args: {
    odProjectId: v.string(),
    name: v.string(),
    skillId: v.optional(v.string()),
    designSystemId: v.optional(v.string()),
    status: v.string(),
    thumbnailUrl: v.optional(v.string()),
    odCreatedAt: v.float64(),
    odUpdatedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("designProjects")
      .withIndex("by_odProjectId", (q) => q.eq("odProjectId", args.odProjectId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, syncedAt: now });
    } else {
      await ctx.db.insert("designProjects", { ...args, syncedAt: now });
    }
  },
});

export const remove = mutation({
  args: { odProjectId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("designProjects")
      .withIndex("by_odProjectId", (q) => q.eq("odProjectId", args.odProjectId))
      .first();
    if (doc) await ctx.db.delete(doc._id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("designProjects").order("desc").take(100);
  },
});

export const listIds = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("designProjects").take(500);
    return docs.map((d) => d.odProjectId);
  },
});

export const getSyncedAt = query({
  args: { odProjectId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("designProjects")
      .withIndex("by_odProjectId", (q) => q.eq("odProjectId", args.odProjectId))
      .first();
    return doc?.syncedAt ?? null;
  },
});

// ---------------------------------------------------------------------------
// Sync action — fetches projects from Open Design daemon and mirrors to Convex
//
// IMPORTANT: Convex cloud limitation (RESEARCH.md A7)
// When CodePulse uses Convex cloud (not self-hosted), this action runs on Convex's
// servers which CANNOT reach localhost:17456. The sync only works when:
//   1. Running Convex in local dev mode (npx convex dev), OR
//   2. The daemon is exposed via a tunnel/public URL set in OPEN_DESIGN_URL env var
// For production with Convex cloud: trigger sync from the browser instead using
// the listProjects() function in openDesignApi.ts and calling upsert/remove
// mutations directly from the client (see Plan 05 ProjectGallery browser-triggered sync).
//
// To configure: set OPEN_DESIGN_URL in Convex Dashboard environment variables.
// For Docker sidecar on the same host: OPEN_DESIGN_URL=http://host.docker.internal:17456
// ---------------------------------------------------------------------------
export const syncFromDaemon = action({
  args: {},
  handler: async (ctx) => {
    const url = process.env.OPEN_DESIGN_URL;
    if (!url) return { synced: 0, removed: 0 };
    try {
      // Record action start time before reading existingIds (CR-04 TOCTOU guard)
      const actionStartedAt = Date.now();
      // Grace window: don't remove projects syncedAt within the last 60 seconds.
      // This prevents deleting projects just created browser-side that the daemon
      // hasn't seen yet (race between listIds read and incoming daemon snapshot).
      const REMOVAL_GRACE_MS = 60_000;

      const res = await fetch(`${url}/api/projects`);
      if (!res.ok) return { synced: 0, removed: 0 };
      const projects = await res.json() as Array<{
        id: string;
        name: string;
        skill_id?: string | null;
        design_system_id?: string | null;
        created_at: number;
        updated_at: number;
      }>;
      const existingIds: string[] = await ctx.runQuery(api.designProjects.listIds);
      const incomingIds = new Set(projects.map((p) => p.id));
      for (const p of projects) {
        await ctx.runMutation(api.designProjects.upsert, {
          odProjectId: p.id,
          name: p.name,
          skillId: p.skill_id ?? undefined,
          designSystemId: p.design_system_id ?? undefined,
          status: "active",
          odCreatedAt: p.created_at,
          odUpdatedAt: p.updated_at,
        });
      }
      let removed = 0;
      for (const id of existingIds) {
        if (!incomingIds.has(id)) {
          // Skip removal if the record was synced after this action started —
          // it was likely just created by the browser and the daemon hasn't
          // returned it yet (CR-04 TOCTOU protection).
          const syncedAt: number | null = await ctx.runQuery(
            api.designProjects.getSyncedAt,
            { odProjectId: id },
          );
          if (syncedAt !== null && actionStartedAt - syncedAt < REMOVAL_GRACE_MS) {
            continue;
          }
          await ctx.runMutation(api.designProjects.remove, { odProjectId: id });
          removed++;
        }
      }
      return { synced: projects.length, removed };
    } catch {
      // Daemon offline or error — skip silently
      return { synced: 0, removed: 0 };
    }
  },
});
