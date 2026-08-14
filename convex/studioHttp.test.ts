/**
 * Tests for convex/studioHttp.ts — POST /studio/ingest and
 * POST /studio/upload-url (Phase 118 Studio, plan 118-05, D-15).
 *
 * Drives the plain `studioIngestPostHandler`/`studioUploadUrlPostHandler`
 * exports directly with a mock ctx and a real `Request` — the same reason
 * convex/loomHttp.ts and convex/workspaceHttp.ts separate the plain handler
 * from the httpAction-wrapped constant: an httpAction-wrapped value cannot
 * be invoked from vitest (convex/workspaceHttp.test.ts:1-8's own docstring).
 * `convex/loomHttp.ts` ships no test file of its own (control:
 * convex/workspaceHttp.test.ts exists, so the check discriminates) — this
 * file follows workspaceHttp.test.ts's mockCtx + vi.stubEnv pattern.
 *
 * Six required blocks, each named for the plan requirement it proves:
 *   1. Auth gate — control pair (401 + not-called, 200 + called)
 *   2. Fail-closed — unset key -> 401; STUDIO_ALLOW_ANON=true -> reaches mutation
 *   3. No CORS — Content-Type present, no access-control-* header
 *   4. Field validation — one test per required field
 *   5. Enum refusal — mediaType: "hologram" -> 400 INVALID_ENUM
 *   6. Route registration — source-level assertion over convex/http.ts
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  studioIngestPostHandler,
  studioUploadUrlPostHandler,
} from "./studioHttp";

afterEach(() => {
  vi.unstubAllEnvs();
});

const AUTH_KEY = "test-studio-ingest-key";
const AUTHED = { Authorization: `Bearer ${AUTH_KEY}` };

function stubAuthKey() {
  vi.stubEnv("STUDIO_API_KEY", AUTH_KEY);
}

function makeMockCtx(opts: { mutationResult?: any } = {}) {
  const runMutation = vi.fn(async (_fnRef: any, _args?: any) => {
    return opts.mutationResult ?? { ok: true, mediaId: "m1", created: true };
  });
  return { runMutation };
}

const validBody = () => ({
  contentHash: "a".repeat(64),
  filename: "sunset.webp",
  absPath: "C:\\Users\\mandr\\media-vault\\gen\\sunset.webp",
  mediaType: "image",
  kind: "gen",
  sizeBytes: 2_048_000,
});

function makeReq(
  path: string,
  body: unknown,
  headers: Record<string, string> = AUTHED
): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// 1. Auth gate — the control pair. A test that only asserts the 401 would
// pass against a handler that rejects everything unconditionally.
// ---------------------------------------------------------------------------

describe("studioIngestPostHandler — auth gate (control pair)", () => {
  it("no Authorization header -> 401, mutation never called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const response = await studioIngestPostHandler(
      ctx,
      makeReq("/studio/ingest", validBody(), {})
    );
    expect(response.status).toBe(401);
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  it("CONTROL: correct Bearer token -> 200, mutation reached exactly once", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const response = await studioIngestPostHandler(
      ctx,
      makeReq("/studio/ingest", validBody())
    );
    expect(response.status).toBe(200);
    expect(ctx.runMutation.mock.calls.length).toBe(1);
  });

  it("wrong bearer value -> 401, mutation never called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const response = await studioIngestPostHandler(
      ctx,
      makeReq("/studio/ingest", validBody(), { Authorization: "Bearer wrong-key" })
    );
    expect(response.status).toBe(401);
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  // Structural proof that auth runs BEFORE body parsing — the only request
  // shape where reordering the two statements is externally observable.
  // Every other test above sends syntactically valid JSON, so a handler
  // that checked auth *after* request.json() would still return 401 for
  // those cases and this suite would stay green while the ordering
  // regressed (this happened while authoring this file — see 118-05-SUMMARY.md).
  it("unauthenticated request with MALFORMED JSON body -> still 401, never 400 INVALID_JSON (proves auth precedes body parsing)", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const req = new Request("http://localhost/studio/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" }, // no Authorization
      body: "{not valid json",
    });
    const response = await studioIngestPostHandler(ctx, req);
    expect(response.status).toBe(401);
    const parsed = await response.json();
    expect(parsed).toEqual({ error: "Unauthorized" });
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Fail-closed — a missing key refuses by default; ALLOW_ANON is the only
// opt-in path.
// ---------------------------------------------------------------------------

describe("studioIngestPostHandler — fail-closed", () => {
  it("STUDIO_API_KEY unset, STUDIO_ALLOW_ANON unset -> 401", async () => {
    const ctx = makeMockCtx();
    const response = await studioIngestPostHandler(
      ctx,
      makeReq("/studio/ingest", validBody(), {})
    );
    expect(response.status).toBe(401);
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  it("CONTROL: STUDIO_API_KEY unset, STUDIO_ALLOW_ANON=true -> reaches the mutation", async () => {
    vi.stubEnv("STUDIO_ALLOW_ANON", "true");
    const ctx = makeMockCtx();
    const response = await studioIngestPostHandler(
      ctx,
      makeReq("/studio/ingest", validBody(), {})
    );
    expect(response.status).toBe(200);
    expect(ctx.runMutation.mock.calls.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. No CORS — Content-Type present (control), no access-control-* header.
// ---------------------------------------------------------------------------

describe("studioIngestPostHandler — no CORS surface", () => {
  it("200 response headers contain Content-Type (control) and no access-control-* header", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const response = await studioIngestPostHandler(
      ctx,
      makeReq("/studio/ingest", validBody())
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    const headerNames = [...response.headers.keys()];
    expect(headerNames.some((h) => h.toLowerCase().startsWith("access-control-"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Field validation — one test per required field, table-driven.
// ---------------------------------------------------------------------------

describe("studioIngestPostHandler — field validation", () => {
  const requiredFields = ["contentHash", "filename", "absPath", "mediaType", "kind", "sizeBytes"];

  it.each(requiredFields)("missing %s -> 400 MISSING_FIELD naming it, mutation not called", async (field) => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const body: any = validBody();
    delete body[field];
    const response = await studioIngestPostHandler(ctx, makeReq("/studio/ingest", body));
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed).toEqual({ error: "MISSING_FIELD", field });
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  it("malformed JSON -> 400 INVALID_JSON, mutation not called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx();
    const req = new Request("http://localhost/studio/ingest", {
      method: "POST",
      headers: { ...AUTHED, "Content-Type": "application/json" },
      body: "{not valid json",
    });
    const response = await studioIngestPostHandler(ctx, req);
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed.error).toBe("INVALID_JSON");
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Enum refusal — the mutation's INVALID_ENUM result maps to 400.
// ---------------------------------------------------------------------------

describe("studioIngestPostHandler — INVALID_ENUM mapping", () => {
  it("mutation refuses with INVALID_ENUM -> 400, same error+field surfaced", async () => {
    stubAuthKey();
    const ctx = makeMockCtx({
      mutationResult: { ok: false, error: "INVALID_ENUM", field: "mediaType" },
    });
    const body: any = validBody();
    body.mediaType = "hologram";
    const response = await studioIngestPostHandler(ctx, makeReq("/studio/ingest", body));
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed).toEqual({ error: "INVALID_ENUM", field: "mediaType" });
    expect(ctx.runMutation.mock.calls.length).toBe(1);
  });

  it("mutation refuses with THUMB_TOO_LARGE -> 400, no field key", async () => {
    stubAuthKey();
    const ctx = makeMockCtx({ mutationResult: { ok: false, error: "THUMB_TOO_LARGE" } });
    const response = await studioIngestPostHandler(ctx, makeReq("/studio/ingest", validBody()));
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed).toEqual({ error: "THUMB_TOO_LARGE" });
    expect(ctx.runMutation.mock.calls.length).toBe(1);
  });

  it("D-06 duplicate hash: mutation returns created:false -> 200, same shape surfaced (not an error)", async () => {
    stubAuthKey();
    const ctx = makeMockCtx({ mutationResult: { ok: true, mediaId: "existing-id", created: false } });
    const response = await studioIngestPostHandler(ctx, makeReq("/studio/ingest", validBody()));
    expect(response.status).toBe(200);
    const parsed = await response.json();
    expect(parsed).toEqual({ ok: true, mediaId: "existing-id", created: false });
  });
});

// ---------------------------------------------------------------------------
// 6. Route registration — source-level assertion over convex/http.ts.
// ---------------------------------------------------------------------------

describe("Route registration — convex/http.ts (source-level, no runtime)", () => {
  const httpSource = readFileSync(resolve(process.cwd(), "convex/http.ts"), "utf-8");

  it("harness liveness check: the source file was actually read and is non-trivial", () => {
    expect(httpSource.length).toBeGreaterThan(1000);
    expect(httpSource).toContain("httpRouter()");
  });

  it("exactly one http.route line mentions /studio/ingest, with method POST", () => {
    const lines = httpSource
      .split("\n")
      .filter((l) => l.includes("http.route") && l.includes("/studio/ingest"));
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatch(/method:\s*"POST"/);
  });

  it("zero lines mention /studio together with an OPTIONS-method route registration", () => {
    const lines = httpSource
      .split("\n")
      .filter((l) => l.includes("http.route") && l.includes("/studio") && l.includes('"OPTIONS"'));
    expect(lines.length).toBe(0);
  });

  it("CONTROL: at least one other path in the same file DOES have an OPTIONS partner, proving the grep can find one when it exists", () => {
    const lines = httpSource
      .split("\n")
      .filter((l) => l.includes("http.route") && l.includes("/inbox-read") && l.includes('"OPTIONS"'));
    expect(lines.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Extra — /studio/upload-url shares the same auth-first structure.
// ---------------------------------------------------------------------------

describe("studioUploadUrlPostHandler — auth gate", () => {
  it("no Authorization header -> 401, mutation never called", async () => {
    stubAuthKey();
    const ctx = makeMockCtx({ mutationResult: "https://example.tail.ts.net/upload?token=x" });
    const response = await studioUploadUrlPostHandler(
      ctx,
      new Request("http://localhost/studio/upload-url", { method: "POST" })
    );
    expect(response.status).toBe(401);
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });

  it("CONTROL: correct bearer -> 200, returns uploadUrl from the mutation", async () => {
    stubAuthKey();
    const uploadUrl = "https://example.tail.ts.net/upload?token=x";
    const ctx = makeMockCtx({ mutationResult: uploadUrl });
    const response = await studioUploadUrlPostHandler(
      ctx,
      new Request("http://localhost/studio/upload-url", { method: "POST", headers: AUTHED })
    );
    expect(response.status).toBe(200);
    const parsed = await response.json();
    expect(parsed).toEqual({ ok: true, uploadUrl });
    expect(ctx.runMutation.mock.calls.length).toBe(1);
  });
});
