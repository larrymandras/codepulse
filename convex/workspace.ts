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
 * (sweepGraphSnapshotVersions) is disabled at crons.ts:145-151 because its
 * candidate-selection read (a full `.collect()` over every stored version's
 * rows) times out on this self-hosted backend. This module avoids that read
 * entirely: the live version list lives on the meta doc's `storedVersions`
 * field, so candidate selection costs O(keepN) array elements, never a table
 * scan (RESEARCH Assumption A2 / T-115-04-03).
 */

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
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
 * Bounds BOTH the prune's reads and its deletes. The prune takes CAP+1 rows,
 * so reads are 4,001 — under the 4,096-read per-function limit that this
 * mutation actually hits first, measured live on 2026-08-12 (plan 115-09):
 *   "Too many reads in a single function execution (limit: 4096)"
 *
 * CORRECTION: this constant's original comment justified 4,000 as "headroom
 * under the ~16,000-doc per-mutation write ceiling". That write ceiling is
 * real (Convex docs: Documents written 16,000) and is what MAX_DIRS_PER_INGEST
 * guards, but it is NOT what bounded this loop — the READ limit is roughly 4x
 * tighter and was never considered. The value 4,000 survives the correction by
 * coincidence, not by design, so do not raise it above 4,094 (CAP+1 must stay
 * under 4,096, leaving room for the meta-doc read).
 */
export const WORKSPACE_DELETE_CAP = 4000;

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

    // 6. INLINE PRUNE (D-11), strictly after the flip. Candidate selection
    //    reads storedVersionsAfterFlip — the array just written to the meta
    //    doc — NEVER a query over workspaceDirs. This is the entire A2
    //    mitigation: the read that times out sweepGraphSnapshotVersions
    //    (graphSnapshots.ts:176-185, a full .collect() over every stored
    //    version's rows) has no analogue here.
    const toDelete = selectVersionDeletes(storedVersionsAfterFlip, WORKSPACE_KEEP_VERSIONS);
    if (toDelete.length === 0) {
      // Nothing to prune this ingest — defaults set in step 5 already hold.
      // Plan 115-06 deviation: this mutation previously returned undefined
      // on every path, but its caller (the ingest HTTP route) needs the new
      // version number in its 200 response — plan 115-09's live proof
      // asserts on it. Returning the meta doc's own just-written fields here
      // keeps the response honest with zero extra reads.
      return { version: newVersion, prunedVersion: undefined, pruneIncomplete: false };
    }

    // Exactly ONE version per ingest, never more (mirrors graphSnapshots'
    // sweep, and keeps each ingest's total write volume bounded).
    const versionToDelete = toDelete[0];
    // BOUNDED READ, not .collect() (fixed 2026-08-12, plan 115-09 live proof).
    // .collect() read EVERY row of the stale version before WORKSPACE_DELETE_CAP
    // was applied, so the cap bounded the DELETES but never the READS. At 4,912
    // dirs/version that threw at runtime:
    //   "Too many reads in a single function execution (limit: 4096)"
    // The binding limit here is READS (4,096), NOT the ~16,000-doc WRITE ceiling
    // this file's constants were reasoned against — the write ceiling is real but
    // was never what this loop hit first. Taking CAP+1 keeps reads at 4,001 and
    // still detects "more remain" from the presence of the extra row.
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
      // Cap hit — leave versionToDelete IN storedVersions so the next
      // ingest's selectVersionDeletes re-selects it and finishes the job.
      // NEVER raise the cap to "finish it this time" — that is the mass
      // delete ./CLAUDE.md forbids on this self-hosted instance (T-115-04-02).
      await ctx.db.patch(metaId, { pruneIncomplete: true });
      return { version: newVersion, prunedVersion: undefined, pruneIncomplete: true };
    }

    // Fully deleted. Patch the meta doc a SECOND time with versionToDelete
    // removed from storedVersions. A crash between the delete loop above and
    // this patch leaves a stale entry in storedVersions pointing at a
    // partially/fully-deleted version — that is SAFE and self-healing: the
    // next ingest's selectVersionDeletes selects it again (a no-op over any
    // rows already gone) and finishes the bookkeeping. activeVersion is
    // never affected by any of this. Idempotent by construction.
    await ctx.db.patch(metaId, {
      storedVersions: storedVersionsAfterFlip.filter((ver) => ver !== versionToDelete),
      prunedVersion: versionToDelete,
      pruneIncomplete: false,
    });
    return { version: newVersion, prunedVersion: versionToDelete, pruneIncomplete: false };
  },
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
