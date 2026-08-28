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
