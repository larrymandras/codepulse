import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const BATCH_SIZE = 500;

/**
 * Inspect the `skills` table by origin. Read-only.
 *
 * Used to identify orphaned origins: `computeSkillPrunes` only prunes origins that
 * are PRESENT in an incoming snapshot, so an origin the scanner stops emitting
 * survives forever. That happened with `claude-code:project:<hash>` rows produced
 * when a session's cwd was the home directory (see hooks/skillScan.mjs).
 */
export const listSkillOrigins = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("skills").collect();
    const byOrigin = new Map<string, { count: number; sampleName: string; sampleSource?: string }>();
    for (const r of rows) {
      const o = r.origin ?? "unknown";
      const cur = byOrigin.get(o);
      if (cur) cur.count++;
      else byOrigin.set(o, { count: 1, sampleName: r.name, sampleSource: r.source });
    }
    return {
      total: rows.length,
      origins: [...byOrigin.entries()]
        .map(([origin, v]) => ({ origin, ...v }))
        .sort((a, b) => b.count - a.count),
    };
  },
});

/**
 * Pure, exported, total predicate: does this stored `skills.source` path look like it came
 * from a `.claude/plugins/` cache tree? Normalizes backslashes to forward slashes and matches
 * case-insensitively. Returns `false` for any non-string, empty, or non-matching input — never
 * throws.
 *
 * This predicate ALONE cannot distinguish astridr's 54 `native`-origin plugin-cache rows
 * (`/home/astridr/.claude/plugins/cache/...`) from the ~57 `claude-code`-origin rows this
 * migration targets — both match. `reoriginPluginSkills` guards against that by ALSO requiring
 * `origin === "claude-code"`; do not use this predicate alone to select rows to mutate.
 */
export function isPluginSourcePath(source?: string | null): boolean {
  if (typeof source !== "string" || source.length === 0) return false;
  const normalized = source.replace(/\\/g, "/").toLowerCase();
  return normalized.includes(".claude/plugins/");
}

/**
 * D-04 (113-debt-sweep): one-shot, batch-capped re-origin of the ~57 pre-existing `skills` rows
 * that D-02's producer-side origin split (113-01) leaves behind on the old shared `claude-code`
 * origin. Those rows were written before the split shipped and are indistinguishable from
 * personal-dir skills except by their stored `source` path, so this migration classifies each
 * row once, from its own data, rather than guessing.
 *
 * Why not let the next scan self-heal them: the server-side prune guard (113-02) protects
 * undeclared origins during a partial scan, but the heal path still runs through the same prune
 * machinery being hardened, and a transient plugin read during that heal would delete these rows
 * with nothing replacing them until the next successful scan. A one-shot migration avoids that
 * window entirely.
 *
 * Filters on BOTH `origin === "claude-code"` AND `isPluginSourcePath(r.source)` — the origin
 * check is what keeps astridr's `native`-origin plugin-cache rows out of scope; the path
 * predicate alone would match them too. Capped at `BATCH_SIZE` even though the expected
 * population is ~57: if `matched` ever exceeds `BATCH_SIZE`, nothing is patched and the result
 * says so, so a human decides rather than a partial silent patch. Dry-run by default; PATCHES
 * `origin` on each matched row when `apply: true` — never deletes. Must not be re-run after the
 * producer has been emitting `claude-code:plugin` for a full scan cycle: a second run against an
 * already-migrated table legitimately matches zero rows, which reads identically to a failure.
 */
export const reoriginPluginSkills = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, { apply }) => {
    const fromOrigin = "claude-code";
    const toOrigin = "claude-code:plugin";
    const rows = (await ctx.db.query("skills").collect()).filter(
      (r) => (r.origin ?? "unknown") === fromOrigin && isPluginSourcePath(r.source)
    );

    const samples = rows.slice(0, 5).map((r) => ({ name: r.name, source: r.source }));

    if (rows.length > BATCH_SIZE) {
      // Refuse to patch a partial set silently — surface it and let a human decide.
      return {
        fromOrigin,
        toOrigin,
        matched: rows.length,
        patched: 0,
        dryRun: true,
        exceededBatchSize: true,
        samples,
      };
    }

    if (!apply) {
      return { fromOrigin, toOrigin, matched: rows.length, patched: 0, dryRun: true, samples };
    }

    for (const r of rows) {
      await ctx.db.patch(r._id, { origin: toOrigin });
    }

    return { fromOrigin, toOrigin, matched: rows.length, patched: rows.length, dryRun: false, samples };
  },
});

/**
 * Delete every `skills` row for one origin. Dry-run unless `apply: true`.
 * Deliberately NOT batched-with-continuation: the orphan origins are ~130 rows each.
 */
export const purgeSkillsByOrigin = internalMutation({
  args: { origin: v.string(), apply: v.optional(v.boolean()) },
  handler: async (ctx, { origin, apply }) => {
    const rows = (await ctx.db.query("skills").collect()).filter((r) => (r.origin ?? "unknown") === origin);
    if (!apply) {
      return { origin, matched: rows.length, deleted: 0, dryRun: true, names: rows.slice(0, 5).map((r) => r.name) };
    }
    for (const r of rows) await ctx.db.delete(r._id);
    return { origin, matched: rows.length, deleted: rows.length, dryRun: false };
  },
});

/**
 * Purge events with sessionId="unknown" in batches.
 */
export const purgeUnknownEventsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", "unknown"))
      .take(BATCH_SIZE);

    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    return { deleted: events.length, done: events.length < BATCH_SIZE };
  },
});

/**
 * Purge toolExecutions with sessionId="unknown" in batches.
 */
export const purgeUnknownToolExecBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("toolExecutions")
      .withIndex("by_session", (q) => q.eq("sessionId", "unknown"))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length, done: rows.length < BATCH_SIZE };
  },
});

/**
 * Purge fileOps with sessionId="unknown" in batches.
 */
export const purgeUnknownFileOpsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("fileOps")
      .withIndex("by_session", (q) => q.eq("sessionId", "unknown"))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length, done: rows.length < BATCH_SIZE };
  },
});

/**
 * Purge contextSnapshots with sessionId="unknown" in batches.
 */
export const purgeUnknownSnapshotsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("contextSnapshots")
      .withIndex("by_session", (q) => q.eq("sessionId", "unknown"))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length, done: rows.length < BATCH_SIZE };
  },
});

/**
 * Purge agents with sessionId="unknown" in batches.
 */
export const purgeUnknownAgentsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("sessionId", "unknown"))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length, done: rows.length < BATCH_SIZE };
  },
});

/**
 * Delete the "unknown" session record and reset eventCounts on real sessions.
 */
export const cleanupSessionRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const unknownSession = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", "unknown"))
      .first();

    if (unknownSession) {
      await ctx.db.delete(unknownSession._id);
    }

    // Recalculate eventCounts on real sessions
    const sessions = await ctx.db.query("sessions").collect();
    let updated = 0;

    for (const session of sessions) {
      const events = await ctx.db
        .query("events")
        .withIndex("by_session", (q) => q.eq("sessionId", session.sessionId))
        .collect();

      if (events.length !== session.eventCount) {
        await ctx.db.patch(session._id, { eventCount: events.length });
        updated++;
      }
    }

    return { deletedUnknown: !!unknownSession, sessionsUpdated: updated };
  },
});

/**
 * Phase 105-09 (live gate, 2026-08-04): backfill `provider: "astridr"` onto historical
 * `toolExecutions` rows left untagged by the `command_execution` case's pre-105-09 insert
 * (fixed going forward in `runtimeIngest.ts`'s `resolveCommandExecutionToolRow`). Scoped to
 * the exact two literal fallback sessionIds that case used (`profileId ?? "unknown"`, where
 * `command_execution` payloads carry no `profileId` from a plain chat turn, matching the
 * "astridr" and "unknown" values seen live) — these are genuine historical Ástríðr tool-call
 * records (real toolName/duration data), not junk, so this PATCHES rather than deletes,
 * unlike the neighboring `purgeUnknown*` migrations. Dry-run by default; `apply: true` writes.
 * Only ~90 rows total as of 2026-08-04 (well under BATCH_SIZE) — a single invocation suffices,
 * but batch-capped anyway per this file's own convention.
 */
export const backfillAstridrProviderTag = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, { apply }) => {
    const targets = ["astridr", "unknown"];
    let matched = 0;
    let patched = 0;
    const samples: { sessionId: string; toolName: string; timestamp: number }[] = [];

    for (const sessionId of targets) {
      const rows = await ctx.db
        .query("toolExecutions")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .take(BATCH_SIZE);
      const untagged = rows.filter((r) => r.provider === undefined);
      matched += untagged.length;
      for (const row of untagged.slice(0, 5 - samples.length)) {
        samples.push({ sessionId, toolName: row.toolName, timestamp: row.timestamp });
      }
      if (apply) {
        for (const row of untagged) {
          await ctx.db.patch(row._id, { provider: "astridr" });
          patched++;
        }
      }
    }

    return { matched, patched, dryRun: !apply, samples };
  },
});

/**
 * Phase 105-09 (live gate, 2026-08-04): D-12/unattributed-rows live verification could not be
 * organically produced — no live session remotely approaches the 1000-row `SESSION_TOOLS_READ_CAP`,
 * and no real session combines "has LLM calls" with "has an untraced tool row" (every post-105-02/03
 * tool_executed row carries traceId/round). Seeds exactly `SESSION_TOOLS_READ_CAP` (1000) synthetic
 * `toolExecutions` rows plus one `llmMetrics` row under a dedicated, clearly-fake test sessionId
 * (`system:105-09-truncation-test`, NEVER a real Ástríðr session) so the TraceWaterfall's
 * truncation banner and "Tool calls with no reported round" / component-level "Untraced calls"
 * sections can be verified against real UI rendering, not reasoned about. Composition of the 1000:
 * 998 correctly-attributed (matching traceId+round, trips the >= cap boundary exactly), 1 with a
 * matching traceId but no round (unattributed-within-turn), 1 with no traceId at all (fully
 * untraced). Labeled synthetic throughout `105-VALIDATION.md`; see `cleanupTruncationTestData` for
 * teardown after verification.
 */
export const seedTruncationTestData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sessionId = "system:105-09-truncation-test";
    const traceId = "test-trace-105-09-truncation";
    const now = 1785900000; // fixed anchor, not wall-clock (repo convention: no Date.now() in scripts)

    await ctx.db.insert("llmMetrics", {
      sessionId,
      traceId,
      round: 1,
      model: "synthetic-105-09-seed",
      provider: "astridr",
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      cost: 0,
      latencyMs: 100,
      billingType: "api",
      timestamp: now,
    });

    let inserted = 0;
    for (let i = 0; i < 998; i++) {
      await ctx.db.insert("toolExecutions", {
        sessionId,
        toolName: `synthetic-105-09-seed-${i}`,
        success: true,
        durationMs: 10,
        provider: "astridr",
        traceId,
        round: 1,
        timestamp: now + i,
      });
      inserted++;
    }
    // Unattributed: matching traceId, no round — "Tool calls with no reported round".
    await ctx.db.insert("toolExecutions", {
      sessionId,
      toolName: "synthetic-105-09-seed-unattributed",
      success: true,
      durationMs: 10,
      provider: "astridr",
      traceId,
      timestamp: now + 998,
    });
    inserted++;
    // Fully untraced: no traceId at all — component-level "Untraced calls" bucket.
    await ctx.db.insert("toolExecutions", {
      sessionId,
      toolName: "synthetic-105-09-seed-untraced",
      success: true,
      durationMs: 10,
      provider: "astridr",
      timestamp: now + 999,
    });
    inserted++;

    return { sessionId, toolRowsInserted: inserted, llmRowsInserted: 1 };
  },
});

/**
 * Teardown for `seedTruncationTestData` — deletes every row under the dedicated test sessionId
 * from both `toolExecutions` and `llmMetrics`. Safe to re-run (no-ops once clean).
 */
export const cleanupTruncationTestData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sessionId = "system:105-09-truncation-test";
    const toolRows = await ctx.db
      .query("toolExecutions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const row of toolRows) await ctx.db.delete(row._id);

    const llmRows = await ctx.db
      .query("llmMetrics")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const row of llmRows) await ctx.db.delete(row._id);

    return { toolRowsDeleted: toolRows.length, llmRowsDeleted: llmRows.length };
  },
});

/**
 * Orchestrator: Purge all "unknown" session data and clean up.
 */
export const runFullPurge = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("[purge] Starting cleanup of unknown-session data...");

    const tables = [
      { name: "events", fn: internal.migrations.purgeUnknownEventsBatch },
      { name: "toolExecutions", fn: internal.migrations.purgeUnknownToolExecBatch },
      { name: "fileOps", fn: internal.migrations.purgeUnknownFileOpsBatch },
      { name: "contextSnapshots", fn: internal.migrations.purgeUnknownSnapshotsBatch },
      { name: "agents", fn: internal.migrations.purgeUnknownAgentsBatch },
    ] as const;

    for (const { name, fn } of tables) {
      let total = 0;
      let done = false;

      while (!done) {
        const result: any = await ctx.runMutation(fn, {});
        total += result.deleted;
        done = result.done;
      }
      console.log(`[purge] ${name}: deleted ${total} rows`);
    }

    const cleanup: any = await ctx.runMutation(
      internal.migrations.cleanupSessionRecords,
      {}
    );
    console.log(`[purge] Deleted unknown session: ${cleanup.deletedUnknown}, updated ${cleanup.sessionsUpdated} session counts`);

    console.log("[purge] Complete! New sessions will track correctly.");
  },
});
