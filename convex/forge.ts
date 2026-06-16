/**
 * Forge integration mutations and read queries (Phases 78 + 80).
 *
 * Phase 78: upsertJob / upsertWorkspaces are internalMutation — called
 * exclusively from the /forge-ingest httpAction (no Clerk identity).
 * listJobs / getJob / listWorkspaces are public queries (graceful-skip convention).
 *
 * Phase 80 (Command Bridge): enqueueLaunch / enqueueStop are public mutations
 * that REQUIRE Clerk identity (fail-closed, D-13). This deliberately diverges
 * from the Phase 78 read-query graceful-skip convention — see D-13 comment on
 * each mutation handler. claimAndUpsertHost / ackCommand / expireStaleCommands
 * are internalMutations called from httpActions (no Clerk). listForgeCommands /
 * listHosts are public queries (no auth check — read-only, graceful-skip).
 */

import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Phase 80: Pure-logic helpers (exported for unit tests in forge.test.ts)
// ---------------------------------------------------------------------------

/** 5-minute TTL for queued commands (D-12). */
export const FORGE_COMMAND_TTL_MS = 5 * 60 * 1000;

/**
 * Strip the `dangerous` key from a capabilities JSON string before storage (D-06, Pitfall 7).
 * Returns null when the result is empty, unparseable, or the input was null/empty.
 * Defense-in-depth on top of the UI never sending it.
 */
export function stripDangerousCapability(capabilities: string | null): string | null {
  if (!capabilities) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(capabilities) as Record<string, unknown>;
  } catch {
    return null;
  }
  delete parsed["dangerous"];
  if (Object.keys(parsed).length === 0) return null;
  return JSON.stringify(parsed);
}

/**
 * Returns true only when a command should be marked expired: status is "queued"
 * AND the expiresAt timestamp is in the past relative to `now`. Never touches
 * executing / done / failed commands (daemon may be mid-flight).
 */
export function shouldExpireCommand(status: string, expiresAt: number, now: number): boolean {
  return status === "queued" && expiresAt < now;
}

/**
 * Terminal command statuses. An ack must never overwrite one of these — a
 * late/duplicate ack (at-least-once delivery) arriving after a command has
 * already reached done/failed/expired would otherwise corrupt the audit trail.
 */
export function isTerminalCommandStatus(status: string): boolean {
  return status === "done" || status === "failed" || status === "expired";
}

interface LaunchRowArgs {
  hostId: string;
  commandId: string;
  agent: string;
  workspaceId: string;
  mode: string;
  prompt: string | null;
  model: string | null;
  capabilities: string | null;
}

interface LaunchRow {
  hostId: string;
  commandId: string;
  commandType: "launch";
  launchPayload: {
    agent: string;
    workspaceId: string;
    mode: string;
    prompt: string | null;
    model: string | null;
    capabilities: string | null;
  };
  stopPayload: null;
  status: string;
  issuedBy: string;
  createdAt: number;
  expiresAt: number;
  claimedAt: null;
  executedAt: null;
  completedAt: null;
  resolvedForgeJobId: null;
  error: null;
}

/**
 * Build the forgeCommands insert object for a launch command.
 * Capabilities have already been run through stripDangerousCapability by the caller.
 */
export function buildLaunchRow(
  args: LaunchRowArgs,
  subject: string,
  now: number,
  ttlMs: number
): LaunchRow {
  return {
    hostId:      args.hostId,
    commandId:   args.commandId,
    commandType: "launch",
    launchPayload: {
      agent:        args.agent,
      workspaceId:  args.workspaceId,
      mode:         args.mode,
      prompt:       args.prompt,
      model:        args.model,
      capabilities: args.capabilities,
    },
    stopPayload:        null,
    status:             "queued",
    issuedBy:           subject,
    createdAt:          now,
    expiresAt:          now + ttlMs,
    claimedAt:          null,
    executedAt:         null,
    completedAt:        null,
    resolvedForgeJobId: null,
    error:              null,
  };
}

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

// ---------------------------------------------------------------------------
// Phase 80: Clerk-gated write mutations (D-13 fail-closed — DELIBERATE divergence
// from the read-query graceful-skip convention above)
// ---------------------------------------------------------------------------

export const enqueueLaunch = mutation({
  args: {
    hostId:       v.string(),
    commandId:    v.string(),  // client-generated ULID for optimistic reconciliation (D-10)
    agent:        v.string(),
    workspaceId:  v.string(),
    mode:         v.string(),
    prompt:       v.union(v.string(), v.null()),
    model:        v.union(v.string(), v.null()),
    capabilities: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // D-13: Fail-closed — DELIBERATE divergence from read-query graceful-skip.
    // DO NOT change to graceful-skip (if (!identity) return;). This is a
    // write/control path. Read queries in this file have no auth check — that
    // convention does NOT propagate here.
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Authentication required to issue Forge commands");
    }

    const now = Date.now();
    // Strip dangerous before storage — D-06 / Pitfall 7 (defense-in-depth)
    const safeCapabilities = stripDangerousCapability(args.capabilities);
    const row = buildLaunchRow(
      { ...args, capabilities: safeCapabilities },
      identity.subject,
      now,
      FORGE_COMMAND_TTL_MS
    );
    await ctx.db.insert("forgeCommands", row);
  },
});

export const enqueueStop = mutation({
  args: {
    hostId:     v.string(),
    commandId:  v.string(),  // client-generated ULID for optimistic reconciliation (D-10)
    forgeJobId: v.string(),
  },
  handler: async (ctx, args) => {
    // D-13: Fail-closed — DELIBERATE divergence from read-query graceful-skip.
    // DO NOT change to graceful-skip. This is a write/control path.
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Authentication required to issue Forge commands");
    }

    const now = Date.now();
    await ctx.db.insert("forgeCommands", {
      hostId:             args.hostId,
      commandId:          args.commandId,
      commandType:        "stop",
      launchPayload:      null,
      stopPayload:        { forgeJobId: args.forgeJobId },
      status:             "queued",
      issuedBy:           identity.subject,
      createdAt:          now,
      expiresAt:          now + FORGE_COMMAND_TTL_MS,
      claimedAt:          null,
      executedAt:         null,
      completedAt:        null,
      resolvedForgeJobId: null,
      error:              null,
    });
  },
});

// ---------------------------------------------------------------------------
// Phase 80: Internal mutations (called from httpActions — bearer-authed, no Clerk)
// ---------------------------------------------------------------------------

export const claimAndUpsertHost = internalMutation({
  args: {
    hostId: v.string(),
    now:    v.number(),
  },
  handler: async (ctx, args) => {
    // Upsert forgeHosts liveness record (read+patch-or-insert = atomic in one mutation)
    const host = await ctx.db
      .query("forgeHosts")
      .withIndex("by_hostId", (q) => q.eq("hostId", args.hostId))
      .unique();
    if (host) {
      await ctx.db.patch(host._id, { lastSeenAt: args.now });
    } else {
      await ctx.db.insert("forgeHosts", { hostId: args.hostId, lastSeenAt: args.now });
    }

    // Atomically claim queued, non-expired commands for this host (up to 10).
    // Convex mutations are serializable — read + patch in one mutation = double-claim safe.
    const queued = await ctx.db
      .query("forgeCommands")
      .withIndex("by_host_status_created", (q) =>
        q.eq("hostId", args.hostId).eq("status", "queued")
      )
      .filter((q) => q.gt(q.field("expiresAt"), args.now))
      .take(10);

    for (const cmd of queued) {
      await ctx.db.patch(cmd._id, {
        status:    "executing",
        claimedAt: args.now,
        executedAt: args.now,
      });
    }

    // W1: Returned docs still show status:"queued" (pre-patch snapshot in this closure);
    // they have been atomically claimed server-side (queued→executing) — the daemon
    // must treat every returned command as to-be-executed, NOT skip on status.
    return queued;
  },
});

export const ackCommand = internalMutation({
  args: {
    commandId:          v.string(),
    status:             v.string(),  // "done" | "failed"
    resolvedForgeJobId: v.union(v.string(), v.null()),
    error:              v.union(v.string(), v.null()),
    now:                v.number(),
  },
  handler: async (ctx, args) => {
    const cmd = await ctx.db
      .query("forgeCommands")
      .withIndex("by_commandId", (q) => q.eq("commandId", args.commandId))
      .unique();
    if (!cmd) return;  // idempotent: already acked or hard-deleted
    // Idempotent on a terminal row too — never overwrite done/failed/expired
    // with a late or duplicate ack (CR-01).
    if (isTerminalCommandStatus(cmd.status)) return;
    await ctx.db.patch(cmd._id, {
      status:             args.status,
      resolvedForgeJobId: args.resolvedForgeJobId,
      error:              args.error,
      completedAt:        args.now,
    });
  },
});

export const expireStaleCommands = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Sweep commands whose expiresAt is in the past.
    // Only mark queued (unclaimed) ones expired — never touch executing/done/failed
    // (the daemon may be mid-flight on those).
    const stale = await ctx.db
      .query("forgeCommands")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .collect();
    for (const cmd of stale) {
      if (shouldExpireCommand(cmd.status, cmd.expiresAt, now)) {
        await ctx.db.patch(cmd._id, { status: "expired" });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Phase 80: Read queries for command bridge (graceful-skip convention — read-only)
// ---------------------------------------------------------------------------

export const listForgeCommands = query({
  args: {
    hostId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hostId = args.hostId;
    if (hostId) {
      return await ctx.db
        .query("forgeCommands")
        .withIndex("by_host_status_created", (q) => q.eq("hostId", hostId))
        .order("desc")
        .take(JOB_LIST_LIMIT);
    }
    // No hostId — return all commands sorted by createdAt descending (CR-02:
    // by_expires reordered by TTL, not insertion time; by_createdAt is correct).
    return await ctx.db
      .query("forgeCommands")
      .withIndex("by_createdAt")
      .order("desc")
      .take(JOB_LIST_LIMIT);
  },
});

export const listHosts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("forgeHosts")
      .withIndex("by_lastSeenAt")
      .order("desc")
      .collect();
  },
});
