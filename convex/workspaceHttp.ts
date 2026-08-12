/**
 * workspaceHttp.ts — POST /workspace-ingest (Phase 115, D-04/D-10).
 *
 * The seam where hooks/workspaceScan.mjs's (a host-side Node script)
 * versioned workspace snapshot crosses into Convex. Auth reuses the existing
 * shared bearer gate exported by ./ingestAuth (see the import below) — no
 * new bearer key, no new env var, no new auth function (D-04).
 *
 * The write target is EXCLUSIVELY the internalMutation defined in
 * convex/workspace.ts. This must NEVER be reachable through the public
 * function namespace the way convex/scan.ts:23 dispatches to the PUBLIC
 * `syncInventory` mutation (convex/registry.ts:130) — ./CLAUDE.md's
 * Self-Hosted Convex Operational Rules record (measured 2026-08-11) that
 * every function in the public namespace is callable with no credential by
 * anything that can route to the host. A bearer check on this HTTP route
 * gates only the route, never the mutation namespace. `syncInventory` being
 * public is a pre-existing gap in `/scan` and is explicitly out of scope for
 * this phase — not fixed here.
 *
 * No CORS headers and no OPTIONS partner, by design (deliberately diverging
 * from 115-PATTERNS.md's scan.ts-shaped recommendation): the only client is
 * hooks/workspaceScan.mjs, a host-side Node script that sends no Origin and
 * issues no preflight, and Phase 114 reads this data through useQuery (the
 * Convex client transport), never through this route. Same boundary as the
 * /loom/event and /galdr routes in convex/http.ts.
 */
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

/**
 * The single header-construction site for this file — Content-Type only, no
 * CORS — so there is exactly one place to audit for a CORS regression
 * (mirrors loomHttp.ts's jsonResponse, same stated reason).
 */
function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * T-115-06-05 (DoS, HIGH): bounds an ingest before any write. The receiving
 * mutation chunk-inserts under a shared ~16,000-doc per-invocation write
 * ceiling and shares that budget with its own inline prune (see
 * convex/workspace.ts's WORKSPACE_DELETE_CAP comment), so an unbounded dirs
 * array is a denial-of-service vector against the single-node self-hosted
 * backend. Refusing at the route is cheaper than a half-written version.
 */
const MAX_DIRS_PER_INGEST = 20000;

const LOCAL_CONFIG_STATUSES = new Set(["merged", "absent", "version-mismatch"]);

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((el) => typeof el === "string");
}

interface DirRow {
  rootId: string;
  dirPath: string;
  department: string;
  access: string;
  fileCount: number;
  totalSize: number;
  latestMtime: number;
  withheldCount: number;
}

/**
 * Validates one dirs[] element against the receiving mutation's args.dirs
 * object validator, field for field. Returns the offending field name, or
 * null if the row is well-formed.
 */
function firstBadDirField(row: unknown): string | null {
  if (typeof row !== "object" || row === null) return "row";
  const r = row as Record<string, unknown>;
  if (typeof r.rootId !== "string") return "rootId";
  if (typeof r.dirPath !== "string") return "dirPath";
  if (typeof r.department !== "string") return "department";
  if (typeof r.access !== "string") return "access";
  if (!isFiniteNumber(r.fileCount)) return "fileCount";
  if (!isFiniteNumber(r.totalSize)) return "totalSize";
  if (!isFiniteNumber(r.latestMtime)) return "latestMtime";
  if (!isFiniteNumber(r.withheldCount)) return "withheldCount";
  return null;
}

/**
 * POST /workspace-ingest  body: the versioned workspace snapshot produced by
 * hooks/workspaceScan.mjs — see convex/workspace.ts's args validator for the
 * authoritative field shape this handler forwards, field by field.
 */
export const workspaceIngestPostHandler = async (ctx: any, request: Request) => {
  // D-04 / T-115-06-02 / T-115-06-03: fail-closed auth is the FIRST
  // executable statement, before any ctx.* access — an unauthenticated
  // caller must not be able to probe stored state by comparing response
  // codes.
  if (!validateIngestAuth(request)) return unauthorizedResponse();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  if (typeof body?.snapshotId !== "string" || body.snapshotId === "") {
    return jsonResponse({ error: "MISSING_FIELD", field: "snapshotId" }, 400);
  }

  if (!Array.isArray(body?.dirs)) {
    return jsonResponse({ error: "MISSING_FIELD", field: "dirs" }, 400);
  }

  if (
    typeof body.dryRunReportHash !== "string" ||
    !/^[0-9a-f]{64}$/i.test(body.dryRunReportHash)
  ) {
    // T-115-06-08: a SHAPE check only. The real D-12 refusal of an
    // unapproved dry-run report lives host-side in plan 115-08 — do not
    // delete that host-side gate as "redundant" with this one. This check
    // only guarantees a snapshot can never be stored with no recorded
    // provenance at all.
    return jsonResponse({ error: "MISSING_FIELD", field: "dryRunReportHash" }, 400);
  }

  if (!isFiniteNumber(body.generatedAt)) {
    return jsonResponse({ error: "MISSING_FIELD", field: "generatedAt" }, 400);
  }
  if (body.generatedAt > 1e12) {
    // T-115-06-07: this project has been bitten twice by epoch
    // seconds/millis confusion producing 1970 dates and vacuously-passing
    // cutoff comparisons. The stored field is documented epoch SECONDS
    // (convex/schema.ts's workspaceSnapshots.generatedAt) — a millisecond
    // value here is a producer bug, not a valid alternate unit.
    return jsonResponse(
      { error: "BAD_UNIT", field: "generatedAt", expected: "epoch seconds" },
      400
    );
  }

  if (typeof body.scannedRootsComplete !== "boolean") {
    return jsonResponse({ error: "MISSING_FIELD", field: "scannedRootsComplete" }, 400);
  }
  if (typeof body.accessDerivationOk !== "boolean") {
    return jsonResponse({ error: "MISSING_FIELD", field: "accessDerivationOk" }, 400);
  }

  if (!isStringArray(body.coveredRoots)) {
    return jsonResponse({ error: "MISSING_FIELD", field: "coveredRoots" }, 400);
  }
  if (!isStringArray(body.unclassifiedRootIds)) {
    return jsonResponse({ error: "MISSING_FIELD", field: "unclassifiedRootIds" }, 400);
  }

  if (!isFiniteNumber(body.rootCount)) {
    return jsonResponse({ error: "MISSING_FIELD", field: "rootCount" }, 400);
  }
  if (
    typeof body.localConfigStatus !== "string" ||
    !LOCAL_CONFIG_STATUSES.has(body.localConfigStatus)
  ) {
    return jsonResponse({ error: "MISSING_FIELD", field: "localConfigStatus" }, 400);
  }

  if (body.dirs.length > MAX_DIRS_PER_INGEST) {
    return jsonResponse(
      { error: "PAYLOAD_TOO_LARGE", dirs: body.dirs.length, max: MAX_DIRS_PER_INGEST },
      413
    );
  }

  for (let i = 0; i < body.dirs.length; i++) {
    const badField = firstBadDirField(body.dirs[i]);
    if (badField) {
      // T-115-06-06: refuse the WHOLE request on the FIRST bad element, with
      // its index — never silently drop a row. A dropped row becomes a
      // missing directory in the map with no signal, the exact failure
      // shape this project has been burned by before.
      return jsonResponse({ error: "BAD_DIR_ROW", index: i, field: badField }, 400);
    }
  }
  const dirs = body.dirs as DirRow[];

  try {
    const result = await ctx.runMutation(internal.workspace.upsertWorkspaceSnapshot, {
      snapshotId: body.snapshotId,
      generatedAt: body.generatedAt,
      rootCount: body.rootCount,
      coveredRoots: body.coveredRoots,
      scannedRootsComplete: body.scannedRootsComplete,
      unclassifiedRootIds: body.unclassifiedRootIds,
      accessDerivationOk: body.accessDerivationOk,
      localConfigStatus: body.localConfigStatus,
      dryRunReportHash: body.dryRunReportHash,
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
    });

    return jsonResponse(
      {
        ok: true,
        version: result?.version,
        prunedVersion: result?.prunedVersion,
        pruneIncomplete: result?.pruneIncomplete,
      },
      200
    );
  } catch (err) {
    // T-115-06-04: never echo the request body or the raw error in the
    // response — both can carry directory paths. Log server-side only.
    console.error("workspaceIngestPostHandler: mutation threw", err);
    return jsonResponse({ error: "INGEST_FAILED" }, 500);
  }
};

export const workspaceIngestPost = httpAction(workspaceIngestPostHandler);
