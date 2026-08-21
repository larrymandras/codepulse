/**
 * Workspace Scanner Receiver — Phase 115, D-10/D-11/D-13.
 *
 * Persists Larry's host-side workspace scan (vault + .claude + .claude-alt +
 * repos) as a versioned snapshot for Phase 114's Workspace Map to render.
 * Storage pattern is copied from graphSnapshots.ts:
 *   - workspaceSnapshots — meta doc (1 row per snapshotId, activeVersion pointer)
 *   - workspaceDirs      — entity rows keyed by (snapshotId, version), one per DIRECTORY
 *
 * Writers are internalMutation — called from the ingest httpAction, which has
 * no Clerk identity (same rule as graphSnapshots.ts / forge.appendLogChunk).
 * Do NOT change this to a public `mutation` the way convex/registry.ts's
 * syncInventory is — per ./CLAUDE.md, a public Convex function is callable
 * with no credential by anything that can route to the host; a bearer check
 * on an HTTP route gates only the route, not the mutation. Do NOT add
 * identity-based auth gating either — SEED-008 (./CLAUDE.md) explicitly
 * rejected per-module auth hardening as the shape that was rejected; the
 * tailnet plus the LAN firewall block is the auth boundary here.
 *
 * Growth is bounded by an INLINE, batch-capped prune inside the SAME
 * mutation — never a cron (D-11). graphSnapshots.ts's own cron-based sweep
 * (sweepGraphSnapshotVersions) WAS disabled because its candidate-selection
 * read (a full `.collect()` over every stored version's rows) timed out on
 * this self-hosted backend; it was RE-ENABLED hourly on 2026-08-21 after
 * graphSnapshots gained the same `storedVersions` field this module
 * pioneered. This module avoids that read entirely: the live version list
 * lives on the meta doc's `storedVersions` field, so candidate selection
 * costs O(keepN) array elements, never a table scan
 * (RESEARCH Assumption A2 / T-115-04-03).
 *
 * Carry-over caution from the 2026-08-21 graphSnapshots incident: a
 * `storedVersions` field added to a table that ALREADY has rows is
 * present-but-incomplete, and the ingest path's `existing?.storedVersions ??
 * []` append cements that partial list. Any version missing from it is
 * unreachable by the prune forever, because selection is by version. This
 * module was born with the field, so it is not affected — but a force=true
 * backfill is the only thing that repairs it if it ever is.
 */

import { v } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { selectVersionDeletes } from "./graphSnapshots";

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

export const WORKSPACE_SNAPSHOT_ID = "larry-workspace";

/**
 * Deliberately NOT graphSnapshots' 7. That 7 exists for Phase 87's temporal
 * diffing, which actually reads old versions; nothing in Phase 115 or 114's
 * scope reads a version other than the active one (Phase 114 renders "the
 * map", singular, present tense). 3 gives one rollback buffer past active
 * while minimising both steady-state rows and the size of the single-version
 * delete this mutation runs on every ingest that needs one.
 */
export const WORKSPACE_KEEP_VERSIONS = 3;

/**
 * Rows deleted per pruneWorkspaceVersions CALL. Reads per call are
 * 1 meta + (CAP+1) take + CAP deletes ~= 3,002 at 1,500, under the 4,096-read
 * per-function limit.
 *
 * TWO CORRECTIONS, both from plan 115-09's live run on 2026-08-12, because the
 * original 4,000 was justified against the wrong limit twice over:
 *
 *  1. The original comment called 4,000 "headroom under the ~16,000-doc
 *     per-mutation WRITE ceiling". That ceiling is real (Convex docs:
 *     "Documents written 16,000") and is what MAX_DIRS_PER_INGEST guards, but
 *     it is not what this code hit. The READ limit is ~4x tighter.
 *  2. The real blocker was not this constant at all. While the prune lived
 *     INSIDE the ingest mutation, a query after N inserts had to merge the
 *     transaction's own pending write set at ~N reads, so 4,912 inserts blew
 *     the read limit before the cap was ever consulted. Caps of 4000, 2000,
 *     1000 and 500 all failed identically; the same prune with a 100-row
 *     insert batch succeeded. That control is what moved the prune out into
 *     its own mutation rather than tuning this number further.
 *
 * Keep CAP+1 under 4,096. Do not move the prune back inside the ingest
 * mutation at any value.
 */
export const WORKSPACE_DELETE_CAP = 1500;

const CHUNK = 1000; // matches graphSnapshots.ts:102

// ---------------------------------------------------------------------------
// Write mutation (internalMutation — httpAction caller only, D-10/D-11)
// ---------------------------------------------------------------------------

export const upsertWorkspaceSnapshot = internalMutation({
  args: {
    snapshotId: v.string(),
    generatedAt: v.float64(),
    rootCount: v.number(),
    coveredRoots: v.array(v.string()),
    scannedRootsComplete: v.boolean(),
    unclassifiedRootIds: v.array(v.string()),
    accessDerivationOk: v.boolean(),
    localConfigStatus: v.string(),
    dryRunReportHash: v.string(),
    dirs: v.array(
      v.object({
        rootId: v.string(),
        dirPath: v.string(),
        department: v.string(),
        access: v.string(),
        fileCount: v.number(),
        totalSize: v.float64(),
        latestMtime: v.float64(),
        withheldCount: v.number(),
      })
    ),
    // No `version` field — version allocation is server-side only
    // (T-115-04-06): a producer cannot supply its own version to overwrite
    // history, mirroring graphSnapshots.ts.
  },
  handler: async (ctx, args) => {
    const receivedAt = Date.now() / 1000; // epoch seconds

    // 1. Read the existing meta doc.
    const existing = await ctx.db
      .query("workspaceSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", args.snapshotId))
      .unique();

    // 2. Compute the new monotonic version, server-side only.
    const newVersion = (existing?.activeVersion ?? 0) + 1;

    // 3. Insert workspaceDirs rows for newVersion, chunked. No dangling-
    //    reference filter (unlike graphSnapshots' link filter) — directories
    //    have no cross-reference integrity concern the way links reference
    //    nodes; D-10/RESEARCH both record this step as a no-op here.
    for (let i = 0; i < args.dirs.length; i += CHUNK) {
      const batch = args.dirs.slice(i, i + CHUNK);
      for (const dir of batch) {
        await ctx.db.insert("workspaceDirs", {
          snapshotId: args.snapshotId,
          version: newVersion,
          rootId: dir.rootId,
          dirPath: dir.dirPath,
          department: dir.department,
          access: dir.access,
          fileCount: dir.fileCount,
          totalSize: dir.totalSize,
          latestMtime: dir.latestMtime,
          withheldCount: dir.withheldCount,
        });
      }
    }

    // 4. Derive totals from args.dirs server-side rather than trusting
    //    producer-supplied totals, so a producer bug cannot make the stored
    //    aggregate disagree with the stored rows (T-115-04-07).
    let totalFiles = 0;
    let totalWithheldFiles = 0;
    let totalBytes = 0;
    for (const dir of args.dirs) {
      totalFiles += dir.fileCount;
      totalWithheldFiles += dir.withheldCount;
      totalBytes += dir.totalSize;
    }
    const totalDirs = args.dirs.length;

    // 5. LAST (the pointer flip): patch-or-insert the meta doc with the new
    //    activeVersion. Nothing before this point is visible to a reader —
    //    a crash anywhere in steps 1-4 leaves the previous version still
    //    active and complete (D-10). prunedVersion/pruneIncomplete are set
    //    to their "nothing pruned yet this ingest" defaults in this same
    //    write; step 6 below issues a SECOND patch only when a prune
    //    actually runs, overwriting those two fields with the real outcome.
    const storedVersionsAfterFlip = [...(existing?.storedVersions ?? []), newVersion];
    const metaDoc = {
      snapshotId: args.snapshotId,
      activeVersion: newVersion,
      storedVersions: storedVersionsAfterFlip,
      generatedAt: args.generatedAt,
      receivedAt,
      rootCount: args.rootCount,
      coveredRoots: args.coveredRoots,
      scannedRootsComplete: args.scannedRootsComplete,
      unclassifiedRootIds: args.unclassifiedRootIds,
      accessDerivationOk: args.accessDerivationOk,
      localConfigStatus: args.localConfigStatus,
      totalDirs,
      totalFiles,
      totalWithheldFiles,
      totalBytes,
      dryRunReportHash: args.dryRunReportHash,
      prunedVersion: undefined as number | undefined,
      pruneIncomplete: false,
    };
    let metaId;
    if (existing) {
      await ctx.db.patch(existing._id, metaDoc);
      metaId = existing._id;
    } else {
      metaId = await ctx.db.insert("workspaceSnapshots", metaDoc);
    }

    // 6. NO PRUNE HERE. See pruneWorkspaceVersions below — D-11's prune moved
    //    out of this mutation on 2026-08-12 (plan 115-09) because it could not
    //    work here at any cap. Measured, with a control: a query issued AFTER
    //    N inserts in the same mutation must merge this transaction's own
    //    pending write set, and that costs ~N reads against a 4,096-read limit.
    //    Identical prune work with 4,912 inserts FAILED and with 100 inserts
    //    SUCCEEDED, which is what isolated the insert batch — not the cap — as
    //    the cost. WORKSPACE_DELETE_CAP was tested at 4000/2000/1000/500 and
    //    every value failed identically.
    //
    //    D-11's substance is unchanged: the prune is still request-driven and
    //    still a single-version capped delete, never a cron and never a mass
    //    delete. What changed is "same mutation" -> "same request".
    const prunePending =
      selectVersionDeletes(storedVersionsAfterFlip, WORKSPACE_KEEP_VERSIONS).length > 0;

    return { version: newVersion, prunePending };
  },
});

/**
 * D-11's prune, as its OWN mutation so it runs in its own transaction with a
 * fresh read budget and no pending write set to merge. Deletes at most
 * WORKSPACE_DELETE_CAP rows from exactly ONE version per call; the caller
 * (convex/workspaceHttp.ts) invokes it repeatedly until `moreWork` is false or
 * its own call cap is reached.
 *
 * Reads per call: 1 meta + (CAP+1) take + CAP deletes. Never the pending-write
 * merge that made the inline form impossible.
 *
 * Idempotent by construction: a crash between the delete loop and the final
 * patch leaves a stale entry in storedVersions pointing at a partially deleted
 * version, which the next call re-selects and finishes. activeVersion is never
 * touched by any path here.
 */
// Exported separately from the internalMutation wrapper so it can be driven with a
// fake ctx in tests — the same seam convex/workspaceHttp.ts uses by exporting
// workspaceIngestPostHandler. That is what makes the crash/self-heal path provable
// without inducing a crash: the post-crash STATE (a stale entry in storedVersions
// pointing at an already-deleted version) is constructible directly.
export async function pruneWorkspaceVersionsHandler(
  ctx: MutationCtx,
  args: { snapshotId: string }
) {
    const meta = await ctx.db
      .query("workspaceSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", args.snapshotId))
      .unique();
    if (!meta) return { moreWork: false, prunedVersion: undefined, pruneIncomplete: false };

    const toDelete = selectVersionDeletes(meta.storedVersions, WORKSPACE_KEEP_VERSIONS);
    if (toDelete.length === 0) {
      if (meta.pruneIncomplete) await ctx.db.patch(meta._id, { pruneIncomplete: false });
      return { moreWork: false, prunedVersion: undefined, pruneIncomplete: false };
    }

    // Exactly ONE version per call, never more.
    const versionToDelete = toDelete[0];
    // BOUNDED READ, never .collect(): taking CAP+1 both bounds the read and
    // detects "more remain" from the presence of the extra row.
    const staleRows = await ctx.db
      .query("workspaceDirs")
      .withIndex("by_snapshot_version", (q) =>
        q.eq("snapshotId", args.snapshotId).eq("version", versionToDelete)
      )
      .take(WORKSPACE_DELETE_CAP + 1);

    const moreRemain = staleRows.length > WORKSPACE_DELETE_CAP;

    let deleteCount = 0;
    for (const row of staleRows) {
      if (deleteCount >= WORKSPACE_DELETE_CAP) break;
      await ctx.db.delete(row._id);
      deleteCount++;
    }

    if (moreRemain) {
      // Cap hit — leave versionToDelete IN storedVersions so the next call
      // re-selects it and finishes the job. NEVER raise the cap to "finish it
      // this time" — that is the mass delete ./CLAUDE.md forbids on this
      // self-hosted instance (T-115-04-02).
      await ctx.db.patch(meta._id, { pruneIncomplete: true });
      return { moreWork: true, prunedVersion: undefined, pruneIncomplete: true };
    }

    await ctx.db.patch(meta._id, {
      storedVersions: meta.storedVersions.filter((ver) => ver !== versionToDelete),
      prunedVersion: versionToDelete,
      pruneIncomplete: false,
    });
    // More work remains only if ANOTHER whole version is still over the keep
    // limit after this one was fully removed.
    const remaining = selectVersionDeletes(
      meta.storedVersions.filter((ver) => ver !== versionToDelete),
      WORKSPACE_KEEP_VERSIONS
    );
    return {
      moreWork: remaining.length > 0,
      prunedVersion: versionToDelete,
      pruneIncomplete: false,
    };
}

export const pruneWorkspaceVersions = internalMutation({
  args: { snapshotId: v.string() },
  handler: async (ctx, args) => pruneWorkspaceVersionsHandler(ctx, args),
});

// ---------------------------------------------------------------------------
// Read query (public, graceful-skip — consistent with graphSnapshots.ts)
// ---------------------------------------------------------------------------

export const getWorkspaceMap = query({
  args: { snapshotId: v.optional(v.string()) },
  handler: async (ctx, { snapshotId = WORKSPACE_SNAPSHOT_ID }) => {
    const meta = await ctx.db
      .query("workspaceSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshotId))
      .unique();

    if (!meta) return null; // graceful-skip: no data yet

    const dirs = await ctx.db
      .query("workspaceDirs")
      .withIndex("by_snapshot_version", (q) =>
        q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)
      )
      .collect();

    return {
      snapshotId: meta.snapshotId,
      activeVersion: meta.activeVersion,
      generatedAt: meta.generatedAt,
      receivedAt: meta.receivedAt,
      rootCount: meta.rootCount,
      coveredRoots: meta.coveredRoots,
      scannedRootsComplete: meta.scannedRootsComplete,
      unclassifiedRootIds: meta.unclassifiedRootIds,
      accessDerivationOk: meta.accessDerivationOk,
      localConfigStatus: meta.localConfigStatus,
      totalDirs: meta.totalDirs,
      totalFiles: meta.totalFiles,
      totalWithheldFiles: meta.totalWithheldFiles,
      totalBytes: meta.totalBytes,
      dirs: dirs.map((d) => ({
        rootId: d.rootId,
        dirPath: d.dirPath,
        department: d.department,
        access: d.access,
        fileCount: d.fileCount,
        totalSize: d.totalSize,
        latestMtime: d.latestMtime,
        withheldCount: d.withheldCount,
      })),
    };
  },
});
