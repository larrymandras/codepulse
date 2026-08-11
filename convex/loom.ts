/**
 * loom.ts — the Loom curated-pipelines domain module (Phase 119).
 *
 * Mirrors convex/galdr.ts's handler/export split: each operation is a plain
 * exported async function wrapped by a query/mutation only for the generated
 * API, so every one is directly unit-testable without the Convex runtime.
 *
 * Loom is definition-first: a pipeline describes what the system is DESIGNED to
 * do. A run lights it up. Phase 111's Mission Board is the other half — post-hoc
 * job history — and the two cross-link rather than merge (D-07).
 */
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

type LoomCtx = { db: any };

/**
 * D-05: the newest N step events a run retains, pruned inline on every append.
 *
 * This is the single constant; no other file may hardcode the number. An
 * unbounded array here is the same growth hazard Phase 116 capped for
 * promptVersions — and a long pipeline emitting per-action events is exactly
 * the shape that runs away.
 */
export const LOOM_STEP_EVENT_CAP = 200;

/** The event vocabulary the emitter may use. Anything else is refused. */
export const LOOM_EVENTS = [
  "start",
  "action",
  "complete",
  "error",
  "warn",
] as const;
export type LoomEvent = (typeof LOOM_EVENTS)[number];

export function isLoomEvent(value: string): value is LoomEvent {
  return (LOOM_EVENTS as readonly string[]).includes(value);
}

/**
 * Append one event to a run's trail, keeping only the newest
 * LOOM_STEP_EVENT_CAP. Pure so the cap is testable without a database.
 *
 * Keeps the NEWEST rather than the oldest: a run's tail is what you look at
 * when it fails, and truncating the head of a 200-event trail loses the error
 * that ended it.
 */
export function appendBounded<T>(events: T[], next: T): T[] {
  const out = [...events, next];
  if (out.length <= LOOM_STEP_EVENT_CAP) return out;
  return out.slice(out.length - LOOM_STEP_EVENT_CAP);
}

/**
 * A run's status derived from its events. `error` is sticky: once a step has
 * errored the run is not "complete" merely because a later step finished, which
 * is how a partially-failed run would otherwise report success.
 */
export function deriveStatus(
  events: Array<{ event: string }>,
  stepCount: number
): "running" | "complete" | "error" {
  if (events.some((e) => e.event === "error")) return "error";
  const completed = new Set(
    events.filter((e) => e.event === "complete").map((e) => (e as any).stepId)
  );
  if (stepCount > 0 && completed.size >= stepCount) return "complete";
  return "running";
}

// ============================================================
// Read paths
// ============================================================

export async function listPipelinesHandler(ctx: LoomCtx) {
  const rows = await ctx.db.query("pipelines").collect();
  return rows.filter((p: any) => p.enabled !== false);
}

export const listPipelines = query({
  args: {},
  handler: async (ctx) => listPipelinesHandler(ctx),
});

export async function listRunsHandler(ctx: LoomCtx, pipelineSlug: string) {
  return await ctx.db
    .query("pipelineRuns")
    .withIndex("by_pipelineSlug", (q: any) =>
      q.eq("pipelineSlug", pipelineSlug)
    )
    .order("desc")
    .take(20);
}

export const listRuns = query({
  args: { pipelineSlug: v.string() },
  handler: async (ctx, { pipelineSlug }) => listRunsHandler(ctx, pipelineSlug),
});

// ============================================================
// Write paths
// ============================================================

export async function upsertPipelineHandler(
  ctx: LoomCtx,
  args: {
    slug: string;
    name: string;
    description?: string;
    owner?: string;
    steps: Array<{
      id: string;
      name: string;
      description?: string;
      icon?: string;
      docMd?: string;
    }>;
    sourceRef?: string;
  },
  now: number
) {
  const existing = await ctx.db
    .query("pipelines")
    .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, { ...args, updatedAt: now });
    return existing._id;
  }
  return await ctx.db.insert("pipelines", {
    ...args,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * `internalMutation`, not `mutation` (v14.0 audit INT-03) — a plain `mutation`
 * lands in the client-callable `api.` namespace, so any holder of the shipped
 * `VITE_CONVEX_URL` could upsert a pipeline straight from devtools, bypassing
 * `validateLoomAuth` in loomHttp.ts entirely. Same rule Phase 108 applied to its
 * own telemetry writes (activeEngine.ts `recordRouting`, controlVerbSwaps.ts
 * `record`). The UI never calls this; the documented CLI consumer
 * (`npx convex run loom:upsertPipeline`) reaches internal functions fine.
 */
export const upsertPipeline = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    owner: v.optional(v.string()),
    steps: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        icon: v.optional(v.string()),
        docMd: v.optional(v.string()),
      })
    ),
    sourceRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => upsertPipelineHandler(ctx, args, Date.now()),
});

/**
 * Record one step event against the newest run of a pipeline, starting a run if
 * the incoming event opens one.
 *
 * D-06: an unknown pipelineSlug is a REFUSAL, never an implicit create — an
 * auto-created pipeline from a typo'd emit would sit on the board looking
 * curated. The caller surfaces this as a 404.
 */
export async function recordStepEventHandler(
  ctx: LoomCtx,
  args: {
    pipelineSlug: string;
    stepId: string;
    event: string;
    text?: string;
    runId?: string;
  },
  now: number
) {
  const pipeline = await ctx.db
    .query("pipelines")
    .withIndex("by_slug", (q: any) => q.eq("slug", args.pipelineSlug))
    .first();
  if (!pipeline) return { ok: false as const, error: "UNKNOWN_PIPELINE" };
  if (!isLoomEvent(args.event)) {
    return { ok: false as const, error: "UNKNOWN_EVENT" };
  }

  const entry = {
    stepId: args.stepId,
    event: args.event,
    text: args.text,
    at: now,
  };

  const latest = await ctx.db
    .query("pipelineRuns")
    .withIndex("by_pipelineSlug", (q: any) =>
      q.eq("pipelineSlug", args.pipelineSlug)
    )
    .order("desc")
    .first();

  // A `start` on the first step opens a NEW run rather than extending the last
  // one; otherwise every run of the same pipeline would accumulate into one row.
  const opensRun =
    !latest ||
    latest.status !== "running" ||
    (args.event === "start" && args.stepId === pipeline.steps[0]?.id);

  if (opensRun) {
    const runId = await ctx.db.insert("pipelineRuns", {
      pipelineSlug: args.pipelineSlug,
      status: "running",
      startedAt: now,
      currentStep: args.stepId,
      stepEvents: [entry],
    });
    return { ok: true as const, runId };
  }

  const events = appendBounded(latest.stepEvents ?? [], entry);
  const status = deriveStatus(events, pipeline.steps.length);
  await ctx.db.patch(latest._id, {
    stepEvents: events,
    currentStep: args.stepId,
    status,
    endedAt: status === "running" ? undefined : now,
  });
  return { ok: true as const, runId: latest._id };
}

/**
 * `internalMutation`, not `mutation` (v14.0 audit INT-03) — see `upsertPipeline`
 * above. Its only caller is loomHttp.ts's bearer-gated route; leaving it public
 * made that gate bypassable, since the same write was reachable unauthenticated
 * through `api.loom.recordStepEvent`.
 */
export const recordStepEvent = internalMutation({
  args: {
    pipelineSlug: v.string(),
    stepId: v.string(),
    event: v.string(),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => recordStepEventHandler(ctx, args, Date.now()),
});
