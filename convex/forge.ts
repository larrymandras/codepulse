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
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Phase 80: Pure-logic helpers (exported for unit tests in forge.test.ts)
// ---------------------------------------------------------------------------

/** 5-minute TTL for queued commands (D-12). */
export const FORGE_COMMAND_TTL_MS = 5 * 60 * 1000;

/** 1 MB hard cap on an uploaded SKILL.md (D-P6-09). */
export const MAX_INTAKE_UPLOAD_BYTES = 1_000_000;

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
  intakePayload: null;
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
    intakePayload:      null,
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

interface IntakeRowArgs {
  hostId: string;
  commandId: string;
  destination: "global" | "project" | "cold";
  workspaceId: string | null;
  storageId?: Id<"_storage">;
  githubUrl?: string;
  subpath?: string;
}

interface IntakeRow {
  hostId: string;
  commandId: string;
  commandType: "intake";
  launchPayload: null;
  stopPayload: null;
  intakePayload: {
    destination: "global" | "project" | "cold";
    workspaceId: string | null;
    storageId?: Id<"_storage">;
    githubUrl?: string;
    subpath?: string;
  };
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
 * Build the forgeCommands insert object for an intake command.
 * Mirrors buildLaunchRow exactly (D-P6-01..09).
 */
export function buildIntakeRow(
  args: IntakeRowArgs,
  subject: string,
  now: number,
  ttlMs: number
): IntakeRow {
  return {
    hostId:      args.hostId,
    commandId:   args.commandId,
    commandType: "intake",
    launchPayload: null,
    stopPayload:   null,
    intakePayload: {
      destination: args.destination,
      workspaceId: args.workspaceId,
      storageId:   args.storageId,
      githubUrl:   args.githubUrl,
      subpath:     args.subpath,
    },
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

// Direct TypeScript port of skill_intake's github_url.py FULL_URL/SHORTHAND
// regexes (D-P6-06). Must never accept a form the Python parser would reject —
// port, don't reinterpret. Source: skill-intake repo,
// src/skill_intake/ingestion/github_url.py.
const GITHUB_FULL_URL = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/(.+?))?\/?$/i;
const GITHUB_SHORTHAND = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/;

/**
 * True when `url` matches either the full github.com URL form or the
 * owner/repo shorthand form accepted by skill-intake's own CLI (D-P6-06).
 */
export function isAcceptedGithubUrlShape(url: string): boolean {
  return GITHUB_FULL_URL.test(url) || GITHUB_SHORTHAND.test(url);
}

/**
 * True when `subpath` is undefined, or is a relative path with no leading
 * slash/backslash and no ".." segment. Stops path-traversal strings from
 * crossing the bridge (D-P6-07 fan-out field).
 */
export function isSafeSubpath(subpath: string | undefined): boolean {
  if (subpath === undefined) return true;
  if (subpath.startsWith("/") || subpath.startsWith("\\")) return false;
  const segments = subpath.split(/[/\\]/);
  return !segments.includes("..");
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

// Oldest-first cap for log chunks. Retention sweep (D-2) already bounds the real set
// to ~1 MB per job, so 5 000 chunks is a ceiling that will rarely be hit in practice.
const LOG_CHUNK_LIMIT = 5000;

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
      intakePayload:      null,
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

export const enqueueIntake = mutation({
  args: {
    hostId:      v.string(),
    commandId:   v.string(),  // client-generated ULID for optimistic reconciliation (D-10)
    destination: v.union(v.literal("global"), v.literal("project"), v.literal("cold")),
    workspaceId: v.union(v.string(), v.null()),
    storageId:   v.optional(v.id("_storage")),
    githubUrl:   v.optional(v.string()),
    subpath:     v.optional(v.string()),
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

    // D-P6-05: exactly one of storageId / githubUrl, never both, never neither.
    const hasFile = args.storageId !== undefined;
    const hasUrl = args.githubUrl !== undefined;
    if (hasFile === hasUrl) {
      throw new Error("Provide exactly one of storageId or githubUrl");
    }

    if (hasFile) {
      // D-P6-09: 1 MB hard cap, enforced before any row is ever inserted.
      // Non-deprecated size-check API — do NOT use ctx.storage.getMetadata().
      const meta = await ctx.db.system.get("_storage", args.storageId!);
      // A bogus/dangling storageId must fail here, not surface later as a
      // null downloadUrl on the claimed row (review fix, Plan 06-04).
      if (!meta) {
        throw new Error("Uploaded file not found: storageId does not reference an existing file");
      }
      if (meta.size > MAX_INTAKE_UPLOAD_BYTES) {
        throw new Error(`Uploaded file exceeds ${MAX_INTAKE_UPLOAD_BYTES} bytes`);
      }
    }

    if (hasUrl) {
      if (!isAcceptedGithubUrlShape(args.githubUrl!)) {
        throw new Error(`Not a recognized GitHub URL form: ${args.githubUrl}`);
      }
    }

    if (!isSafeSubpath(args.subpath)) {
      throw new Error(`Invalid subpath: ${args.subpath}`);
    }

    if (args.destination === "project" && !args.workspaceId) {
      throw new Error("workspaceId is required when destination is 'project'");
    }

    const row = buildIntakeRow(args, identity.subject, Date.now(), FORGE_COMMAND_TTL_MS);
    await ctx.db.insert("forgeCommands", row);
  },
});

export const generateForgeUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // D-13: Fail-closed — DELIBERATE divergence from read-query graceful-skip.
    // DO NOT change to graceful-skip. This is a write/control path.
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Authentication required to issue Forge commands");
    }
    // D-P6-08: exactly one signed URL per call, for a single SKILL.md — no
    // zip or multi-file path exists in this mutation.
    return await ctx.storage.generateUploadUrl();
  },
});

// ---------------------------------------------------------------------------
// Phase 80: Internal mutations (called from httpActions — bearer-authed, no Clerk)
// ---------------------------------------------------------------------------

// D-P6-11: a daemon that sends no supportedTypes field is today's daemon, which
// can only execute "launch"/"stop" — default to that so it never sees an intake
// row it cannot execute.
export function resolveClaimTypes(supportedTypes?: string[]): string[] {
  return supportedTypes ?? ["launch", "stop"];
}

// TEST-ONLY: used exclusively by scripts/verify-intake-claim.mjs (SC5,
// D-P6-15). internalMutation — never part of the api.* surface the browser
// SDK can call. Do not import from client code.
export const generateVerificationUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// TEST-ONLY: used exclusively by scripts/verify-intake-claim.mjs (SC5,
// D-P6-15). internalMutation — never part of the api.* surface the browser
// SDK can call. Do not import from client code. Reuses buildIntakeRow exactly
// like enqueueIntake does, but skips the Clerk check and enqueueIntake's own
// validation (XOR/size/URL-shape) — the script controls its own inputs
// directly and those paths are already unit-tested in Plan 06-01.
export const seedIntakeRowForVerification = internalMutation({
  args: {
    hostId:      v.string(),
    commandId:   v.string(),
    destination: v.union(v.literal("global"), v.literal("project"), v.literal("cold")),
    workspaceId: v.union(v.string(), v.null()),
    storageId:   v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert(
      "forgeCommands",
      buildIntakeRow(args, "verification-script", Date.now(), FORGE_COMMAND_TTL_MS)
    );
  },
});

export const claimAndUpsertHost = internalMutation({
  args: {
    hostId: v.string(),
    now:    v.number(),
    supportedTypes: v.optional(v.array(v.string())),
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

    const types = resolveClaimTypes(args.supportedTypes);

    // D-P6-11: an explicit empty supportedTypes means "I can execute nothing
    // right now" — liveness is recorded (above) but nothing is claimed. This
    // also guards the q.or(...) below, which requires at least one expression
    // and would error at runtime on a zero-length spread (review fix, 06-04).
    if (types.length === 0) return [];

    // Atomically claim queued, non-expired commands for this host (up to 10).
    // Convex mutations are serializable — read + patch in one mutation = double-claim safe.
    const queued = await ctx.db
      .query("forgeCommands")
      .withIndex("by_host_status_created", (q) =>
        q.eq("hostId", args.hostId).eq("status", "queued")
      )
      .filter((q) =>
        q.and(
          q.gt(q.field("expiresAt"), args.now),
          q.or(...types.map((t) => q.eq(q.field("commandType"), t)))
        )
      )
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
    report:             v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const cmd = await ctx.db
      .query("forgeCommands")
      .withIndex("by_commandId", (q) => q.eq("commandId", args.commandId))
      .unique();
    if (!cmd) return;  // idempotent: already acked or hard-deleted
    // Idempotent on a terminal row too — never overwrite done/failed/expired
    // with a late or duplicate ack (CR-01). This also guarantees the blob
    // delete below never fires twice for the same row.
    if (isTerminalCommandStatus(cmd.status)) return;
    // D-P6-10 (site 1 of 2): delete the uploaded SKILL.md blob before the row
    // goes terminal, mirroring sweepForgeFileRecords's storage-first ordering (D-05).
    if (
      cmd.commandType === "intake" &&
      cmd.intakePayload?.storageId &&
      (args.status === "done" || args.status === "failed")
    ) {
      await ctx.storage.delete(cmd.intakePayload.storageId);
    }
    await ctx.db.patch(cmd._id, {
      status:             args.status,
      resolvedForgeJobId: args.resolvedForgeJobId,
      error:              args.error,
      completedAt:        args.now,
      report:             args.report ?? null,
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
        // D-P6-10 (site 2 of 2): an unclaimed intake row that TTL-expires
        // also needs its blob deleted before the terminal patch — this site
        // is independent of ackCommand's (an expired row is never acked).
        if (cmd.commandType === "intake" && cmd.intakePayload?.storageId) {
          await ctx.storage.delete(cmd.intakePayload.storageId);
        }
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

// ---------------------------------------------------------------------------
// Phase 81: Retention sweep constants + pure helpers (FI-11 / D-2)
//
// Pure helpers are exported so forgeLogIngest.test.ts can exercise the
// deletion-decision logic without a live Convex DB (plan 02 TDD pattern).
// ---------------------------------------------------------------------------

/** 7-day TTL for log chunks (D-2). */
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Per-job log byte cap (~1 MB, D-01 / D-2). Drop-oldest when exceeded. */
export const LOG_BYTE_CAP_PER_JOB = 1_000_000;

/**
 * Returns the total byte size of a chunk by summing the character length of
 * every line. Used by the retention sweep for per-job byte accounting.
 */
export function chunkByteSize(chunk: { lines: string[] }): number {
  let total = 0;
  for (const line of chunk.lines) {
    total += line.length;
  }
  return total;
}

/**
 * Given an array of chunks, returns those whose _creationTime is strictly
 * older than the TTL boundary (now - SEVEN_DAYS_MS). At-boundary chunks survive.
 */
export function selectTtlDeletes<T extends { _id: any; _creationTime: number; lines: string[] }>(
  chunks: T[],
  now: number
): T[] {
  const cutoff = now - SEVEN_DAYS_MS;
  return chunks.filter((c) => c._creationTime < cutoff);
}

/**
 * Given an array of surviving chunks for a SINGLE job (ordered by seq ascending,
 * oldest first), returns the oldest chunks that must be deleted to bring the
 * total byte count at or below `capBytes`. Newest chunks always survive.
 */
export function selectCapDeletes<T extends { _id: any; seq: number; lines: string[] }>(
  chunks: T[],
  capBytes: number
): T[] {
  // Sum total bytes across all surviving chunks.
  let total = chunks.reduce((acc, c) => acc + chunkByteSize(c), 0);
  if (total <= capBytes) return [];

  // Drop oldest first (ascending seq = chunks[0] is oldest).
  const toDelete: T[] = [];
  for (const chunk of chunks) {
    if (total <= capBytes) break;
    toDelete.push(chunk);
    total -= chunkByteSize(chunk);
  }
  return toDelete;
}

export const sweepForgeLogChunks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // -------------------------------------------------------------------------
    // Pass 1: TTL — collect all chunks older than 7 days and delete them.
    // -------------------------------------------------------------------------
    const allChunks = await ctx.db.query("forgeLogChunks").collect();
    const ttlDeletes = selectTtlDeletes(allChunks, now);
    for (const chunk of ttlDeletes) {
      await ctx.db.delete(chunk._id);
    }

    // -------------------------------------------------------------------------
    // Pass 2: Per-job byte cap — group surviving chunks by (hostId, forgeJobId),
    // compute total bytes, and drop oldest-first for any job over the cap.
    // -------------------------------------------------------------------------
    const ttlDeletedIds = new Set(ttlDeletes.map((c) => c._id));
    const surviving = allChunks.filter((c) => !ttlDeletedIds.has(c._id));

    // Group by job key.
    const byJob = new Map<string, typeof surviving>();
    for (const chunk of surviving) {
      const key = `${chunk.hostId}::${chunk.forgeJobId}`;
      if (!byJob.has(key)) byJob.set(key, []);
      byJob.get(key)!.push(chunk);
    }

    // For each job, sort ascending by seq then apply the cap.
    for (const chunks of byJob.values()) {
      chunks.sort((a, b) => a.seq - b.seq);
      const capDeletes = selectCapDeletes(chunks, LOG_BYTE_CAP_PER_JOB);
      for (const chunk of capDeletes) {
        await ctx.db.delete(chunk._id);
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Phase 81: Log ingest + reactive read (FI-09)
// ---------------------------------------------------------------------------

export const appendLogChunk = internalMutation({
  args: {
    hostId:     v.string(),
    forgeJobId: v.string(),
    lines:      v.array(v.string()),
    seq:        v.number(),
    sentAt:     v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // D-1 idempotency: skip insert if (hostId, forgeJobId, seq) already exists.
    // Append-only — no patch branch (unlike upsertJob's last-writer-wins patch).
    const existing = await ctx.db
      .query("forgeLogChunks")
      .withIndex("by_host_job_seq", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId).eq("seq", args.seq)
      )
      .unique();

    if (existing) return;  // Idempotent no-op (D-1)

    await ctx.db.insert("forgeLogChunks", {
      hostId:     args.hostId,
      forgeJobId: args.forgeJobId,
      lines:      args.lines,
      seq:        args.seq,
      sentAt:     args.sentAt,
    });
  },
});

export const listJobLogs = query({
  args: {
    hostId:     v.string(),
    forgeJobId: v.string(),
  },
  handler: async (ctx, args) => {
    // Oldest chunk first — terminal display reads top-to-bottom.
    // LOG_CHUNK_LIMIT is the ceiling; D-2 retention sweep keeps the real set small.
    return await ctx.db
      .query("forgeLogChunks")
      .withIndex("by_host_job", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId)
      )
      .order("asc")
      .take(LOG_CHUNK_LIMIT);
  },
});

// ---------------------------------------------------------------------------
// Phase 82: File/artifact ingest + reactive read + retention sweep (FI-12 / FI-13 / D-05)
//
// Pure helpers are exported so forgeFileIngest.test.ts can exercise the
// deletion-decision logic without a live Convex DB (same pattern as Phase 81).
// ---------------------------------------------------------------------------

/** Max rows returned per listJobFiles call (discretionary, D-03). */
export const FILE_LIST_LIMIT = 1000;

/** Total artifact byte cap per job (~10 MB). Drop-oldest when exceeded. */
export const ARTIFACT_BYTE_CAP_PER_JOB = 10_000_000;

/** Per-file/artifact byte cap (1 MB — matches Convex per-doc value limit ceiling). */
export const PER_FILE_BYTE_CAP = 1_000_000;

/**
 * Returns the effective byte size of an artifact:
 * - textContent.length when content is present (text/HTML stored as string)
 * - sizeBytes otherwise (image artifacts counted by file size, not blob overhead)
 */
export function artifactByteSize(artifact: { textContent?: string; sizeBytes: number }): number {
  return artifact.textContent !== undefined ? artifact.textContent.length : artifact.sizeBytes;
}

/**
 * Given an array of file/artifact records, returns those whose `createdAt` ISO
 * string is strictly older than the TTL boundary (now - SEVEN_DAYS_MS).
 * At-boundary records survive.
 *
 * Keyed on the explicit `createdAt` ISO field (not `_creationTime`) — matches
 * the forgeFiles / forgeArtifacts schema convention.
 */
export function selectFileTtlDeletes<T extends { _id: any; createdAt: string }>(
  records: T[],
  now: number
): T[] {
  const cutoff = now - SEVEN_DAYS_MS;
  return records.filter((r) => Date.parse(r.createdAt) < cutoff);
}

/**
 * Given an array of surviving artifact records for a SINGLE job (sorted by
 * createdAt ascending, oldest first), returns the oldest records that must be
 * deleted to bring the total artifact byte count at or below `capBytes`.
 * Newest records always survive by construction.
 */
export function selectFileCapDeletes<
  T extends { _id: any; createdAt: string; sizeBytes: number; textContent?: string }
>(records: T[], capBytes: number): T[] {
  // Sort ascending by createdAt (oldest first) — caller may not guarantee order.
  const sorted = [...records].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );
  let total = sorted.reduce((acc, r) => acc + artifactByteSize(r), 0);
  if (total <= capBytes) return [];

  const toDelete: T[] = [];
  for (const record of sorted) {
    if (total <= capBytes) break;
    toDelete.push(record);
    total -= artifactByteSize(record);
  }
  return toDelete;
}

/**
 * Idempotent upsert of file metadata rows for a given job.
 * Idempotency key: (hostId, forgeJobId, path) via by_host_job_path index.
 * Last-writer-wins patch (unlike append-only log chunks) — file size may change on re-push.
 */
export const upsertFileEntries = internalMutation({
  args: {
    hostId:     v.string(),
    forgeJobId: v.string(),
    files: v.array(v.object({
      path:      v.string(),
      kind:      v.string(),
      sizeBytes: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    for (const file of args.files) {
      const existing = await ctx.db
        .query("forgeFiles")
        .withIndex("by_host_job_path", (q) =>
          q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId).eq("path", file.path)
        )
        .unique();

      if (existing) {
        // Last-writer-wins: patch sizeBytes/kind in case they changed on re-push.
        await ctx.db.patch(existing._id, { kind: file.kind, sizeBytes: file.sizeBytes });
      } else {
        await ctx.db.insert("forgeFiles", {
          hostId:     args.hostId,
          forgeJobId: args.forgeJobId,
          path:       file.path,
          kind:       file.kind,
          sizeBytes:  file.sizeBytes,
          createdAt:  now,
        });
      }
    }
  },
});

/**
 * Idempotent upsert of artifact content rows for a given job.
 * Idempotency key: (hostId, forgeJobId, path) via by_host_job_path index.
 *
 * D-05: If an existing image artifact is being overwritten (new storageId differs),
 * call ctx.storage.delete(existing.storageId) BEFORE patch to prevent blob leak.
 *
 * Coerce absent textContent/storageId → undefined (never null), per Phase 81 sentAt rule.
 */
export const upsertArtifacts = internalMutation({
  args: {
    hostId:     v.string(),
    forgeJobId: v.string(),
    artifacts: v.array(v.object({
      path:        v.string(),
      kind:        v.string(),
      sizeBytes:   v.number(),
      textContent: v.optional(v.string()),
      storageId:   v.optional(v.id("_storage")),
    })),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    for (const artifact of args.artifacts) {
      const existing = await ctx.db
        .query("forgeArtifacts")
        .withIndex("by_host_job_path", (q) =>
          q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId).eq("path", artifact.path)
        )
        .unique();

      if (existing) {
        // D-05: Delete old blob BEFORE patch to prevent leak on image overwrite.
        if (existing.storageId && existing.storageId !== artifact.storageId) {
          await ctx.storage.delete(existing.storageId);
        }
        await ctx.db.patch(existing._id, {
          kind:        artifact.kind,
          sizeBytes:   artifact.sizeBytes,
          textContent: artifact.textContent ?? undefined,
          storageId:   artifact.storageId ?? undefined,
        });
      } else {
        await ctx.db.insert("forgeArtifacts", {
          hostId:      args.hostId,
          forgeJobId:  args.forgeJobId,
          path:        artifact.path,
          kind:        artifact.kind,
          sizeBytes:   artifact.sizeBytes,
          textContent: artifact.textContent ?? undefined,
          storageId:   artifact.storageId ?? undefined,
          createdAt:   now,
        });
      }
    }
  },
});

/**
 * Public reactive query — returns all file metadata rows for a given job.
 * D-04: public graceful-skip (no Clerk auth), consistent with listJobs / listJobLogs.
 */
export const listJobFiles = query({
  args: {
    hostId:     v.string(),
    forgeJobId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("forgeFiles")
      .withIndex("by_host_job", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId)
      )
      .order("asc")
      .take(FILE_LIST_LIMIT);
  },
});

/**
 * Public reactive query — returns a single artifact record plus resolved imageUrl.
 * D-04: public graceful-skip; ctx.storage.getUrl available on QueryCtx per Convex docs.
 */
export const getJobArtifact = query({
  args: {
    hostId:     v.string(),
    forgeJobId: v.string(),
    path:       v.string(),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db
      .query("forgeArtifacts")
      .withIndex("by_host_job_path", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId).eq("path", args.path)
      )
      .unique();

    if (!artifact) return null;

    // Resolve storageId → URL for images (D-02: images via Convex File Storage).
    // getUrl is available on QueryCtx per Convex docs (serve-files).
    let imageUrl: string | null = null;
    if (artifact.storageId) {
      imageUrl = await ctx.storage.getUrl(artifact.storageId);
    }

    return { ...artifact, imageUrl };
  },
});

/**
 * Retention sweep for file/artifact records (D-05).
 * Called by the daily cron at 04:00 UTC (offset from 03:30 log sweep).
 *
 * Two passes:
 *   1. TTL: delete forgeArtifacts + forgeFiles with createdAt > 7 days ago.
 *      CRITICAL: for image artifacts, ctx.storage.delete(storageId) BEFORE ctx.db.delete.
 *   2. Per-job byte cap: drop oldest artifacts for any job exceeding ARTIFACT_BYTE_CAP_PER_JOB.
 */
export const sweepForgeFileRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // -------------------------------------------------------------------------
    // Pass 1: TTL — collect artifact records older than 7 days and delete them.
    // CRITICAL D-05: storage.delete(storageId) BEFORE db.delete to prevent blob leak.
    // -------------------------------------------------------------------------
    const allArtifacts = await ctx.db.query("forgeArtifacts").collect();
    const artifactTtlDeletes = selectFileTtlDeletes(allArtifacts, now);
    for (const artifact of artifactTtlDeletes) {
      if (artifact.storageId) {
        await ctx.storage.delete(artifact.storageId); // blob FIRST (D-05)
      }
      await ctx.db.delete(artifact._id);              // then doc row
    }

    // TTL pass for file metadata rows.
    const allFiles = await ctx.db.query("forgeFiles").collect();
    const fileTtlDeletes = selectFileTtlDeletes(allFiles, now);
    for (const file of fileTtlDeletes) {
      await ctx.db.delete(file._id);
    }

    // -------------------------------------------------------------------------
    // Pass 2: Per-job artifact byte cap — group surviving artifacts by job,
    // then drop oldest-first for any job over ARTIFACT_BYTE_CAP_PER_JOB.
    // -------------------------------------------------------------------------
    const artifactTtlDeletedIds = new Set(artifactTtlDeletes.map((a) => a._id));
    const survivingArtifacts = allArtifacts.filter((a) => !artifactTtlDeletedIds.has(a._id));

    const byJob = new Map<string, typeof survivingArtifacts>();
    for (const artifact of survivingArtifacts) {
      const key = `${artifact.hostId}::${artifact.forgeJobId}`;
      if (!byJob.has(key)) byJob.set(key, []);
      byJob.get(key)!.push(artifact);
    }

    for (const artifacts of byJob.values()) {
      const capDeletes = selectFileCapDeletes(artifacts, ARTIFACT_BYTE_CAP_PER_JOB);
      for (const artifact of capDeletes) {
        if (artifact.storageId) {
          await ctx.storage.delete(artifact.storageId); // blob FIRST (D-05)
        }
        await ctx.db.delete(artifact._id);
      }
    }
  },
});
