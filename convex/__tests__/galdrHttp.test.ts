/**
 * Phase 116 (Galdr Prompt Library), plan 116-04 — the no-CORS boundary
 * (D-04) and the fail-closed auth gate (D-01) asserted against real
 * `Response` objects, plus the wire shape of each handler (D-06's 409,
 * D-05's forwarded query string, D-15's usage-only route isolation).
 *
 * Drives the plain `*Handler` exports directly — the same reason
 * `convex/galdrHttp.ts` separates them from the `httpAction`-wrapped
 * constants: an `httpAction`-wrapped value cannot be invoked from vitest.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getFunctionName } from "convex/server";
import { api } from "../_generated/api";
import {
  galdrPromptGetHandler,
  galdrListGetHandler,
  galdrPromptPostHandler,
  galdrUsagePostHandler,
} from "../galdrHttp";

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Fake ctx — the handlers under test only need runQuery/runMutation.
// ---------------------------------------------------------------------------

function makeFakeCtx(opts: {
  queryResult?: any;
  mutationResult?: any;
  mutationError?: any;
} = {}) {
  const runQuery = vi.fn(async (_fnRef: any, _args?: any) => opts.queryResult);
  const runMutation = vi.fn(async (_fnRef: any, _args?: any) => {
    if (opts.mutationError !== undefined) throw opts.mutationError;
    return opts.mutationResult;
  });
  return { runQuery, runMutation };
}

const AUTHED = { Authorization: "Bearer test-galdr-key" };

// ---------------------------------------------------------------------------
// CONTROL FIRST — prove the harness can observe a header when one IS
// present, before trusting any toBeNull() below.
// ---------------------------------------------------------------------------

describe("harness liveness control", () => {
  it("observes a manufactured Access-Control-Allow-Origin header on a real Response", () => {
    const response = new Response("{}", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ---------------------------------------------------------------------------
// D-04 — zero CORS headers on any galdr response, all four handlers.
// ---------------------------------------------------------------------------

describe("D-04: no CORS headers on any galdr response", () => {
  const cases: Array<{
    name: string;
    run: () => Promise<Response>;
  }> = [
    {
      name: "galdrPromptGetHandler",
      run: () => {
        vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
        const ctx = makeFakeCtx({ queryResult: { match: null, candidates: [] } });
        const req = new Request(
          "http://localhost/galdr/prompt?slug=competitor-analysis",
          { method: "GET", headers: AUTHED }
        );
        return galdrPromptGetHandler(ctx, req);
      },
    },
    {
      name: "galdrListGetHandler",
      run: () => {
        vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
        const ctx = makeFakeCtx({ queryResult: { categories: [], favorites: [] } });
        const req = new Request("http://localhost/galdr/list", {
          method: "GET",
          headers: AUTHED,
        });
        return galdrListGetHandler(ctx, req);
      },
    },
    {
      name: "galdrPromptPostHandler",
      run: () => {
        vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
        const ctx = makeFakeCtx({ mutationResult: "prompt123" });
        const req = new Request("http://localhost/galdr/prompt", {
          method: "POST",
          headers: { ...AUTHED, "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Competitor Analysis", body: "Do X" }),
        });
        return galdrPromptPostHandler(ctx, req);
      },
    },
    {
      name: "galdrUsagePostHandler",
      run: () => {
        vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
        const ctx = makeFakeCtx({ mutationResult: undefined });
        const req = new Request("http://localhost/galdr/usage", {
          method: "POST",
          headers: { ...AUTHED, "Content-Type": "application/json" },
          body: JSON.stringify({ slug: "competitor-analysis" }),
        });
        return galdrUsagePostHandler(ctx, req);
      },
    },
  ];

  for (const { name, run } of cases) {
    it(`${name}: Access-Control-Allow-Origin is null`, async () => {
      const response = await run();
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it(`${name}: Access-Control-Allow-Methods is null`, async () => {
      const response = await run();
      expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
    });

    it(`${name}: Access-Control-Allow-Headers is null`, async () => {
      const response = await run();
      expect(response.headers.get("Access-Control-Allow-Headers")).toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------
// D-01 — fail-closed auth gate precedes any database access, all four
// handlers.
// ---------------------------------------------------------------------------

describe("D-01: fail-closed auth precedes database access", () => {
  const handlers: Array<{
    name: string;
    handler: (ctx: any, req: Request) => Promise<Response>;
    makeReq: (headers: Record<string, string>) => Request;
  }> = [
    {
      name: "galdrPromptGetHandler",
      handler: galdrPromptGetHandler,
      makeReq: (headers) =>
        new Request("http://localhost/galdr/prompt?slug=x", {
          method: "GET",
          headers,
        }),
    },
    {
      name: "galdrListGetHandler",
      handler: galdrListGetHandler,
      makeReq: (headers) =>
        new Request("http://localhost/galdr/list", { method: "GET", headers }),
    },
    {
      name: "galdrPromptPostHandler",
      handler: galdrPromptPostHandler,
      makeReq: (headers) =>
        new Request("http://localhost/galdr/prompt", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ title: "X", body: "Y" }),
        }),
    },
    {
      name: "galdrUsagePostHandler",
      handler: galdrUsagePostHandler,
      makeReq: (headers) =>
        new Request("http://localhost/galdr/usage", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ slug: "x" }),
        }),
    },
  ];

  for (const { name, handler, makeReq } of handlers) {
    it(`${name}: no Authorization header while GALDR_API_KEY is set -> 401, zero db calls`, async () => {
      vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
      const ctx = makeFakeCtx();
      const response = await handler(ctx, makeReq({}));
      expect(response.status).toBe(401);
      expect(ctx.runQuery.mock.calls.length).toBe(0);
      expect(ctx.runMutation.mock.calls.length).toBe(0);
    });

    it(`${name}: wrong bearer value -> 401, zero db calls`, async () => {
      vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
      const ctx = makeFakeCtx();
      const response = await handler(
        ctx,
        makeReq({ Authorization: "Bearer wrong-key" })
      );
      expect(response.status).toBe(401);
      expect(ctx.runQuery.mock.calls.length).toBe(0);
      expect(ctx.runMutation.mock.calls.length).toBe(0);
    });

    it(`${name}: GALDR_API_KEY and GALDR_ALLOW_ANON both unset -> 401 (fail-closed reaches the route)`, async () => {
      vi.stubEnv("GALDR_API_KEY", "");
      const ctx = makeFakeCtx();
      const response = await handler(ctx, makeReq({}));
      expect(response.status).toBe(401);
      expect(ctx.runQuery.mock.calls.length).toBe(0);
      expect(ctx.runMutation.mock.calls.length).toBe(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Shape cases
// ---------------------------------------------------------------------------

describe("galdrPromptGetHandler shapes", () => {
  it("no slug parameter -> 400 MISSING_SLUG", async () => {
    vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
    const ctx = makeFakeCtx();
    const req = new Request("http://localhost/galdr/prompt", {
      method: "GET",
      headers: AUTHED,
    });
    const response = await galdrPromptGetHandler(ctx, req);
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed.error).toBe("MISSING_SLUG");
  });

  it("?slug=competitor-analysis -> 200, forwards the query string to api.galdr.lookup unmodified", async () => {
    vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
    const ctx = makeFakeCtx({ queryResult: { match: null, candidates: [] } });
    const req = new Request(
      "http://localhost/galdr/prompt?slug=competitor-analysis",
      { method: "GET", headers: AUTHED }
    );
    const response = await galdrPromptGetHandler(ctx, req);
    expect(response.status).toBe(200);
    expect(ctx.runQuery.mock.calls.length).toBe(1);
    const [fnRef, args] = ctx.runQuery.mock.calls[0];
    expect(getFunctionName(fnRef)).toBe(getFunctionName(api.galdr.lookup));
    expect(args).toEqual({ query: "competitor-analysis" });
  });
});

describe("galdrPromptPostHandler shapes", () => {
  it("SLUG_COLLISION -> 409 carrying the existing prompt's title and updatedAt (D-06 on the wire)", async () => {
    vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
    const ctx = makeFakeCtx({
      mutationError: {
        data: {
          code: "SLUG_COLLISION",
          existingSlug: "competitor-analysis",
          existingTitle: "Competitor Analysis (old)",
          existingUpdatedAt: 1_720_000_000_000,
          existingArchived: false,
        },
      },
    });
    const req = new Request("http://localhost/galdr/prompt", {
      method: "POST",
      headers: { ...AUTHED, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Competitor Analysis", body: "Do X" }),
    });
    const response = await galdrPromptPostHandler(ctx, req);
    expect(response.status).toBe(409);
    const parsed = await response.json();
    expect(parsed.error).toBe("SLUG_COLLISION");
    expect(parsed.existingTitle).toBe("Competitor Analysis (old)");
    expect(parsed.existingUpdatedAt).toBe(1_720_000_000_000);
  });

  it("missing title -> 400 MISSING_FIELD", async () => {
    vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
    const ctx = makeFakeCtx();
    const req = new Request("http://localhost/galdr/prompt", {
      method: "POST",
      headers: { ...AUTHED, "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Do X" }),
    });
    const response = await galdrPromptPostHandler(ctx, req);
    expect(response.status).toBe(400);
    const parsed = await response.json();
    expect(parsed.error).toBe("MISSING_FIELD");
    expect(ctx.runMutation.mock.calls.length).toBe(0);
  });
});

describe("galdrUsagePostHandler shapes", () => {
  it("{ slug } -> 200, exactly one runMutation call referencing api.galdr.recordUsage", async () => {
    vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
    const ctx = makeFakeCtx({ mutationResult: undefined });
    const req = new Request("http://localhost/galdr/usage", {
      method: "POST",
      headers: { ...AUTHED, "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "competitor-analysis" }),
    });
    const response = await galdrUsagePostHandler(ctx, req);
    expect(response.status).toBe(200);
    expect(ctx.runMutation.mock.calls.length).toBe(1);
    const [fnRef, args] = ctx.runMutation.mock.calls[0];
    expect(getFunctionName(fnRef)).toBe(getFunctionName(api.galdr.recordUsage));
    expect(args).toEqual({ slug: "competitor-analysis" });
  });
});

// ---------------------------------------------------------------------------
// Route-registration source assertion (supplementary to the Response
// assertions above).
// ---------------------------------------------------------------------------

describe("convex/http.ts route registration (source assertion)", () => {
  const httpSource = readFileSync(resolve(process.cwd(), "convex/http.ts"), "utf-8");
  // Strip comment lines BEFORE matching -- the D-04 explanation comment
  // added alongside the routes contains the literal word OPTIONS and would
  // otherwise make this assertion self-invalidating.
  const codeLines = httpSource.split("\n").filter((line) => {
    const trimmed = line.trim();
    return !(trimmed.startsWith("//") || trimmed.startsWith("*"));
  });

  it("control: comment-stripped source still contains >=20 method:\"OPTIONS\" lines (filter did not blank the file)", () => {
    const optionsLines = codeLines.filter((l) => l.includes('method: "OPTIONS"'));
    expect(optionsLines.length).toBeGreaterThanOrEqual(20);
  });

  it("exactly 4 surviving lines register a /galdr path, and none of them is an OPTIONS route", () => {
    const galdrLines = codeLines.filter((l) => l.includes('path: "/galdr'));
    expect(galdrLines.length).toBe(4);
    expect(galdrLines.filter((l) => l.includes("OPTIONS")).length).toBe(0);
  });
});
