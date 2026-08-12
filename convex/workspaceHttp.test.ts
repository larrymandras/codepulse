/**
 * Tests for convex/workspaceHttp.ts — POST /workspace-ingest (Phase 115,
 * plan 115-06, D-04/D-10). Drives the plain `workspaceIngestPostHandler`
 * export directly with a mock ctx and a real Request — the same reason
 * convex/galdrHttp.ts and convex/loomHttp.ts separate the plain handler
 * from the httpAction-wrapped constant: an httpAction-wrapped value cannot
 * be invoked from vitest. Mirrors convex/__tests__/galdrHttp.test.ts's
 * mockCtx + getFunctionName-identity pattern.
 *
 * validateIngestAuth's two branches ARE drivable in-process via
 * vi.stubEnv("ASTRIDR_INGEST_API_KEY", ...) — the same technique
 * convex/forgeIngest.test.ts already uses for its sibling
 * validateForgeIngestAuth. No `it.todo` deferral is needed here.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { getFunctionName } from "convex/server";
import { internal } from "./_generated/api";
import { workspaceIngestPostHandler, MAX_DIRS_PER_INGEST } from "./workspaceHttp";
import { WORKSPACE_DELETE_CAP } from "./workspace";

afterEach(() => {
  vi.unstubAllEnvs();
});

const AUTH_KEY = "test-workspace-ingest-key";
const AUTHED = { Authorization: `Bearer ${AUTH_KEY}` };

function stubAuthKey() {
  vi.stubEnv("ASTRIDR_INGEST_API_KEY", AUTH_KEY);
}

/**
 * mockCtx.runMutation records its args and returns { version: 1 } by
 * default, so every assertion below can check BOTH the HTTP response and
 * whether the mutation was actually reached.
 */
function makeMockCtx(opts: { mutationResult?: any; mutationThrow?: any } = {}) {
  const runMutation = vi.fn(async (_fnRef: any, _args?: any) => {
    if (opts.mutationThrow !== undefined) throw opts.mutationThrow;
    return opts.mutationResult ?? { version: 1, prunedVersion: undefined, pruneIncomplete: false };
  });
  return { runMutation };
}

const validDir = () => ({
  rootId: "vault",
  dirPath: "02-projects",
  department: "Personal",
  access: "local-only",
  fileCount: 10,
  totalSize: 2048,
  latestMtime: 1786000000, // epoch SECONDS
  withheldCount: 0,
});

const validBody = () => ({
  snapshotId: "larry-workspace",
  generatedAt: 1786000000, // epoch SECONDS, well under the 1e12 BAD_UNIT threshold
  rootCount: 3,
  coveredRoots: ["vault", "claude", "claude-alt"],
  scannedRootsComplete: true,
  unclassifiedRootIds: [],
  accessDerivationOk: true,
  localConfigStatus: "merged",
  dryRunReportHash: "a".repeat(64),
  dirs: [validDir()],
});

function makeReq(body: unknown, headers: Record<string, string> = AUTHED): Request {
  return new Request("http://localhost/workspace-ingest", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Case 1 — CONTROL: a well-formed authenticated request reaches the mutation.
// This is what makes every refusal case below meaningful.
// ---------------------------------------------------------------------------

describe("workspaceIngestPostHandler — control", () => {
  it("well-formed authenticated request -> 200, mutation called exactly once", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const response = await workspaceIngestPostHandler(ctx, makeReq(validBody()));
    expect(response.status).toBe(200);
    const parsed = await response.json();
    expect(parsed).toEqual({ ok: true, version: 1, prunedVersion: undefined, pruneIncomplete: false });
    expect(ctx.runMutation.mock.calls.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Case 2 — auth gate: fail-closed, first executable statement.
// ---------------------------------------------------------------------------

describe("workspaceIngestPostHandler — auth gate", () => {
  it("no Authorization header while ASTRIDR_INGEST_API_KEY is set -> 401, mutation never called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const response = await workspaceIngestPostHandler(ctx, makeReq(validBody(), {}));
    expect(response.status).toBe(401);
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  it("wrong bearer value -> 401, mutation never called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const response = await workspaceIngestPostHandler(
      ctx,
      makeReq(validBody(), { Authorization: "Bearer wrong-key" })
    );
    expect(response.status).toBe(401);
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Case 3 — malformed JSON body.
// ---------------------------------------------------------------------------

describe("workspaceIngestPostHandler — malformed body", () => {
  it("malformed JSON -> 400 INVALID_JSON, mutation not called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const req = new Request("http://localhost/workspace-ingest", {
      method: "POST",
      headers: { ...AUTHED, "Content-Type": "application/json" },
      body: "{not valid json",
    });
    const response = await workspaceIngestPostHandler(ctx, req);
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed.error).toBe("INVALID_JSON");
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Case 4 — missing snapshotId.
// ---------------------------------------------------------------------------

describe("workspaceIngestPostHandler — field validation", () => {
  it("missing snapshotId -> 400 MISSING_FIELD naming snapshotId, mutation not called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const body: any = validBody();
    delete body.snapshotId;
    const response = await workspaceIngestPostHandler(ctx, makeReq(body));
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed).toEqual({ error: "MISSING_FIELD", field: "snapshotId" });
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  // Case 5 — dirs not an array.
  it("dirs not an array -> 400, mutation not called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const body: any = validBody();
    body.dirs = "not-an-array";
    const response = await workspaceIngestPostHandler(ctx, makeReq(body));
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed.error).toBe("MISSING_FIELD");
    expect(parsed.field).toBe("dirs");
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  // Case 6 — dryRunReportHash wrong length / non-hex.
  it("dryRunReportHash too short -> 400, mutation not called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const body: any = validBody();
    body.dryRunReportHash = "abc123";
    const response = await workspaceIngestPostHandler(ctx, makeReq(body));
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed.field).toBe("dryRunReportHash");
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  it("dryRunReportHash non-hex -> 400, mutation not called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const body: any = validBody();
    body.dryRunReportHash = "g".repeat(64); // 'g' is not a hex digit
    const response = await workspaceIngestPostHandler(ctx, makeReq(body));
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed.field).toBe("dryRunReportHash");
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  // Case 7 — generatedAt unit check, WITH the seconds control in the same test.
  it("generatedAt in milliseconds -> 400 BAD_UNIT; the same request with seconds succeeds (control)", async () => {
    stubAuthKey();

    const ctxMillis = makeMockCtx();
    const millisBody: any = validBody();
    millisBody.generatedAt = 1786000000000; // 13 digits — looks like millis
    const millisResponse = await workspaceIngestPostHandler(ctxMillis, makeReq(millisBody));
    expect(millisResponse.status).toBe(400);
    const millisParsed = await millisResponse.json();
    expect(millisParsed.error).toBe("BAD_UNIT");
    expect(millisParsed.field).toBe("generatedAt");
    expect(ctxMillis.runMutation.mock.calls.length).toBe(0);

    // CONTROL: the identical request, but with the value in seconds, succeeds —
    // proving the unit check discriminates rather than always rejecting.
    const ctxSeconds = makeMockCtx();
    const secondsBody: any = validBody();
    secondsBody.generatedAt = 1786000000; // 10 digits — epoch seconds
    const secondsResponse = await workspaceIngestPostHandler(ctxSeconds, makeReq(secondsBody));
    expect(secondsResponse.status).toBe(200);
    expect(ctxSeconds.runMutation.mock.calls.length).toBe(1);
  });

  // Case 8 — booleans must be actual booleans, not truthy values or explicit null.
  it("scannedRootsComplete: null -> 400", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const body: any = validBody();
    body.scannedRootsComplete = null;
    const response = await workspaceIngestPostHandler(ctx, makeReq(body));
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed.field).toBe("scannedRootsComplete");
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  it("scannedRootsComplete: 1 (truthy, not boolean) -> 400", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const body: any = validBody();
    body.scannedRootsComplete = 1;
    const response = await workspaceIngestPostHandler(ctx, makeReq(body));
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed.field).toBe("scannedRootsComplete");
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  // Case 9 — bound the payload.
  it("dirs.length > MAX_DIRS_PER_INGEST -> 413 PAYLOAD_TOO_LARGE, mutation not called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const body: any = validBody();
    body.dirs = Array.from({ length: 8001 }, () => validDir());
    const response = await workspaceIngestPostHandler(ctx, makeReq(body));
    expect(response.status).toBe(413);
    const parsed = await response.json();
    expect(parsed.error).toBe("PAYLOAD_TOO_LARGE");
    expect(parsed.dirs).toBe(8001);
    expect(parsed.max).toBe(8000);
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  // Case 9b — the bound must stay inside the write budget it exists to protect.
  // Regression guard for the 2026-08-12 defect: this constant was 20,000, which
  // EXCEEDED the 16,000-doc write ceiling the guard's own comment cites, so the
  // guard admitted payloads that then died inside the mutation. Asserting the
  // relationship rather than the literal is what makes this catch a re-widening.
  it("MAX_DIRS_PER_INGEST leaves room for the prune and the meta patches", () => {
    const CONVEX_WRITE_CEILING = 16000; // Convex docs: "Documents written 16,000"
    const META_PATCHES = 2; // workspace.ts patches the meta doc in step 5 and again in step 6
    // Asserted against the REAL exported constant, not a value re-typed here -
    // a test that re-declares the number it is guarding cannot fail when the
    // number changes, which is the whole failure mode this test exists for.
    expect(
      MAX_DIRS_PER_INGEST + WORKSPACE_DELETE_CAP + META_PATCHES
    ).toBeLessThanOrEqual(CONVEX_WRITE_CEILING);
    // And the prune's bounded read (CAP+1) must stay under the 4,096-read limit
    // that actually threw live on 2026-08-12.
    expect(WORKSPACE_DELETE_CAP + 1).toBeLessThan(4096);
  });

  // Case 10 — a bad element inside dirs, at a non-zero index.
  it("a bad element inside dirs at index 3 -> 400 BAD_DIR_ROW naming that real index", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const body: any = validBody();
    body.dirs = [validDir(), validDir(), validDir(), { ...validDir(), fileCount: "not-a-number" }, validDir()];
    const response = await workspaceIngestPostHandler(ctx, makeReq(body));
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed.error).toBe("BAD_DIR_ROW");
    expect(parsed.index).toBe(3);
    expect(parsed.field).toBe("fileCount");
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Case 11 — mutation throw -> 500, response never echoes a directory path.
// ---------------------------------------------------------------------------

describe("workspaceIngestPostHandler — mutation failure", () => {
  it("mutation throws -> 500, response body does not contain a directory path from the request", async () => {
    stubAuthKey();
    const distinctivePath = "C__DISTINCTIVE_SECRET_PATH__vault/private-client-notes";
    const ctx = makeMockCtx({ mutationThrow: new Error(`boom while writing ${distinctivePath}`) });
    const body: any = validBody();
    body.dirs = [{ ...validDir(), dirPath: distinctivePath }];
    const response = await workspaceIngestPostHandler(ctx, makeReq(body));
    expect(response.status).toBe(500);
    const rawText = await response.text();
    expect(rawText).not.toContain(distinctivePath);
  });
});

// ---------------------------------------------------------------------------
// Case 12 (T-115-06-01) — structural regression guard: the handler's source
// dispatches via the literal `internal.workspace.upsertWorkspaceSnapshot`
// symbol, not any hand-typed string. This does NOT by itself enforce the
// public/internal security boundary — the namespace-swap mutation proof run
// during 115-06's execution found that convex/_generated/api.js binds BOTH
// `api` and `internal` to the SAME `anyApi` runtime object in this project
// (`export const api = anyApi; export const internal = anyApi;`), so a
// getFunctionName() identity comparison run against a mock ctx cannot
// discriminate api.* from internal.* at runtime — swapping the handler to
// `api.workspace.upsertWorkspaceSnapshot` left this assertion passing
// unchanged. The REAL enforcement is (a) TypeScript's `FilterApi<...,
// FunctionReference<any,"public">>` on the generated `api` type, which
// rejects `api.workspace.upsertWorkspaceSnapshot` at compile time with
// TS2339 (property does not exist — verified live during 115-06), and (b)
// the target mutation's own `internalMutation` declaration in
// convex/workspace.ts, which is what the Convex backend actually checks
// before allowing an external HTTP client to invoke it directly. This test
// stays as a cheap regression guard (a future edit swapping the import
// without also removing this literal call site would still be caught by
// tsc, not by this test) — see 115-06-SUMMARY.md for the full finding.
// ---------------------------------------------------------------------------

describe("workspaceIngestPostHandler — internal-namespace dispatch (T-115-06-01)", () => {
  it("runMutation's first argument is identical (by function name) to internal.workspace.upsertWorkspaceSnapshot — structural guard only, see comment above for what actually enforces the boundary", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const response = await workspaceIngestPostHandler(ctx, makeReq(validBody()));
    expect(response.status).toBe(200);
    expect(ctx.runMutation.mock.calls.length).toBe(1);
    const [fnRef] = ctx.runMutation.mock.calls[0];
    expect(getFunctionName(fnRef)).toBe(getFunctionName(internal.workspace.upsertWorkspaceSnapshot));
  });
});

// ---------------------------------------------------------------------------
// Case 13 — every forwarded field is explicit; the handler forwards by
// name, never by spreading the raw request body.
// ---------------------------------------------------------------------------

describe("workspaceIngestPostHandler — explicit field forwarding", () => {
  it("a junk top-level key present in the request body is absent from the forwarded mutation args", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const body: any = validBody();
    body.__unexpected = "x";
    const response = await workspaceIngestPostHandler(ctx, makeReq(body));
    expect(response.status).toBe(200);
    expect(ctx.runMutation.mock.calls.length).toBe(1);
    const [, args] = ctx.runMutation.mock.calls[0];
    expect(args).not.toHaveProperty("__unexpected");
    expect(Object.keys(args).sort()).toEqual(
      [
        "accessDerivationOk",
        "coveredRoots",
        "dirs",
        "dryRunReportHash",
        "generatedAt",
        "localConfigStatus",
        "rootCount",
        "scannedRootsComplete",
        "snapshotId",
        "unclassifiedRootIds",
      ].sort()
    );
  });
});
