/**
 * Forge integration mutations and read queries (Phase 78).
 *
 * upsertJob / upsertWorkspaces are internalMutation — they are called
 * exclusively from the /forge-ingest httpAction, which has no Clerk identity.
 * listJobs / getJob / listWorkspaces are public queries consumed by P79 UI.
 */

import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Upsert mutations (called from httpAction — must be internalMutation)
// ---------------------------------------------------------------------------

export const upsertJob = internalMutation({
  args: {
    forgeJobId:    v.string(),
    hostId:        v.string(),
    agent:         v.string(),
    mode:          v.string(),
    prompt:        v.union(v.string(), v.null()),
    workspaceId:   v.string(),
    status:        v.string(),
    pid:           v.union(v.number(), v.null()),
    exitCode:      v.union(v.number(), v.null()),
    startedAt:     v.union(v.string(), v.null()),
    finishedAt:    v.union(v.string(), v.null()),
    artifactCount: v.number(),
    model:         v.union(v.string(), v.null()),
    capabilities:  v.string(),
    createdAt:     v.string(),
    updatedAt:     v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("forgeJobs")
      .withIndex("by_forgeJobId", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId)
      )
      .unique();

    if (existing) {
      // Last-writer-wins: only update when incoming updatedAt >= existing (SC#2).
      // String ISO comparison is correct here — both are ISO 8601 timestamps.
      if (args.updatedAt >= existing.updatedAt) {
        await ctx.db.patch(existing._id, {
          agent:         args.agent,
          mode:          args.mode,
          prompt:        args.prompt,
          workspaceId:   args.workspaceId,
          status:        args.status,
          pid:           args.pid,
          exitCode:      args.exitCode,
          startedAt:     args.startedAt,
          finishedAt:    args.finishedAt,
          artifactCount: args.artifactCount,
          model:         args.model,
          capabilities:  args.capabilities,
          createdAt:     args.createdAt,
          updatedAt:     args.updatedAt,
        });
      }
      // Else: stale update — drop silently (idempotent, SC#2)
    } else {
      await ctx.db.insert("forgeJobs", {
        forgeJobId:    args.forgeJobId,
        hostId:        args.hostId,
        agent:         args.agent,
        mode:          args.mode,
        prompt:        args.prompt,
        workspaceId:   args.workspaceId,
        status:        args.status,
        pid:           args.pid,
        exitCode:      args.exitCode,
        startedAt:     args.startedAt,
        finishedAt:    args.finishedAt,
        artifactCount: args.artifactCount,
        model:         args.model,
        capabilities:  args.capabilities,
        createdAt:     args.createdAt,
        updatedAt:     args.updatedAt,
      });
    }
  },
});

export const upsertWorkspaces = internalMutation({
  args: {
    hostId: v.string(),
    workspaces: v.array(
      v.object({
        workspaceId: v.string(),
        class:       v.string(),
        name:        v.string(),
        rootPath:    v.string(),
        updatedAt:   v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const ws of args.workspaces) {
      const existing = await ctx.db
        .query("forgeWorkspaces")
        .withIndex("by_host_workspaceId", (q) =>
          q.eq("hostId", args.hostId).eq("workspaceId", ws.workspaceId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          class:     ws.class,
          name:      ws.name,
          rootPath:  ws.rootPath,
          updatedAt: ws.updatedAt,
        });
      } else {
        await ctx.db.insert("forgeWorkspaces", {
          hostId:      args.hostId,
          workspaceId: ws.workspaceId,
          class:       ws.class,
          name:        ws.name,
          rootPath:    ws.rootPath,
          updatedAt:   ws.updatedAt,
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Read queries — consumer contract for P79 (D-07)
// ---------------------------------------------------------------------------

// Newest-first cap for the job list. forgeJobs is append-only telemetry, so an
// unbounded .collect() would grow without limit; surface the most recent N.
const JOB_LIST_LIMIT = 1000;

export const listJobs = query({
  args: {
    hostId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hostId = args.hostId;
    if (hostId) {
      // Index-scoped to the host, newest-first — no full-table scan + JS filter.
      return await ctx.db
        .query("forgeJobs")
        .withIndex("by_host_updatedAt", (q) => q.eq("hostId", hostId))
        .order("desc")
        .take(JOB_LIST_LIMIT);
    }
    return await ctx.db
      .query("forgeJobs")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(JOB_LIST_LIMIT);
  },
});

export const getJob = query({
  args: {
    hostId:     v.string(),
    forgeJobId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("forgeJobs")
      .withIndex("by_forgeJobId", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId)
      )
      .unique();
  },
});

export const listWorkspaces = query({
  args: {
    hostId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hostId = args.hostId;
    if (hostId) {
      // Index-scoped prefix scan — reads only this host's workspaces.
      return await ctx.db
        .query("forgeWorkspaces")
        .withIndex("by_host_workspaceId", (q) => q.eq("hostId", hostId))
        .collect();
    }
    return await ctx.db.query("forgeWorkspaces").collect();
  },
});
