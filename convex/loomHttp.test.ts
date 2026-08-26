/**
 * Tests for convex/loomHttp.ts — POST /loom/event (Phase 119).
 *
 * WHY THIS FILE EXISTS. Phase 119 shipped via /gsd-quick with NO automated test
 * coverage of its own — `convex/loom.ts`, `convex/loomHttp.ts`, `src/pages/Loom.tsx`
 * and `hooks/loom-emit.mjs` were all untested. `convex/studioHttp.test.ts:10` even
 * records the gap in passing: "`convex/loomHttp.ts` ships no test file of its own
 * (control: convex/workspaceHttp.test.ts exists, so the check discriminates)".
 * Surfaced by the retroactive Nyquist audit (119-VALIDATION.md, 2026-08-26), which
 * flagged this endpoint as the one carrying security weight: it is bearer-gated and
 * nothing tested the gate.
 *
 * Drives the plain `loomEventPostHandler` export directly with a mock ctx and a real
 * Request — an httpAction-wrapped value cannot be invoked from vitest, which is why
 * loomHttp.ts separates the two. Mirrors convex/workspaceHttp.test.ts's
 * mockCtx + vi.stubEnv pattern.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFunctionName } from "convex/server";
import { internal } from "./_generated/api";
import { loomEventPostHandler } from "./loomHttp";

afterEach(() => {
  vi.unstubAllEnvs();
});

const AUTH_KEY = "test-loom-key";
const AUTHED = { Authorization: `Bearer ${AUTH_KEY}`, "Content-Type": "application/json" };

function req(body: unknown, headers: Record<string, string> = AUTHED) {
  return new Request("http://localhost/loom/event", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function mockCtx(mutationResult: any = { ok: true, runId: "run1" }) {
  const calls: Array<{ ref: any; args: any }> = [];
  return {
    calls,
    ctx: {
      runMutation: async (ref: any, args: any) => {
        calls.push({ ref, args });
        return mutationResult;
      },
    },
  };
}

const GOOD = { pipelineSlug: "review-verify", stepId: "verify", event: "start" };

describe("POST /loom/event — bearer gate (D-03 fail-closed)", () => {
  it("rejects with 401 when no Authorization header is present", async () => {
    vi.stubEnv("LOOM_API_KEY", AUTH_KEY);
    const m = mockCtx();
    const res = await loomEventPostHandler(m.ctx, req(GOOD, { "Content-Type": "application/json" }));
    expect(res.status).toBe(401);
  });

  it("rejects with 401 on a WRONG bearer token", async () => {
    vi.stubEnv("LOOM_API_KEY", AUTH_KEY);
    const m = mockCtx();
    const res = await loomEventPostHandler(
      m.ctx,
      req(GOOD, { Authorization: "Bearer wrong-key", "Content-Type": "application/json" })
    );
    expect(res.status).toBe(401);
  });

  it("does NOT touch the database on an unauthenticated request", async () => {
    // This is the property D-03 actually names: "an unauthenticated emit must not
    // be able to probe which pipelines exist". A 401 status alone does not prove
    // it — the handler could have queried first and returned 401 afterwards.
    vi.stubEnv("LOOM_API_KEY", AUTH_KEY);
    const m = mockCtx();
    await loomEventPostHandler(m.ctx, req(GOOD, { "Content-Type": "application/json" }));
    expect(m.calls).toHaveLength(0);
  });

  it("ACCEPTS a correct bearer token — the control proving the 401s above discriminate", async () => {
    vi.stubEnv("LOOM_API_KEY", AUTH_KEY);
    const m = mockCtx();
    const res = await loomEventPostHandler(m.ctx, req(GOOD));
    expect(res.status).toBe(200);
    expect(m.calls).toHaveLength(1);
  });

  it("with no LOOM_API_KEY set, anonymous access requires LOOM_ALLOW_ANON=true", async () => {
    vi.stubEnv("LOOM_API_KEY", "");
    vi.stubEnv("LOOM_ALLOW_ANON", "");
    const denied = await loomEventPostHandler(
      mockCtx().ctx,
      req(GOOD, { "Content-Type": "application/json" })
    );
    expect(denied.status).toBe(401);

    vi.stubEnv("LOOM_ALLOW_ANON", "true");
    const allowed = await loomEventPostHandler(
      mockCtx().ctx,
      req(GOOD, { "Content-Type": "application/json" })
    );
    expect(allowed.status).toBe(200);
  });
});

describe("POST /loom/event — the write stays INTERNAL", () => {
  it("routes through internal.loom.recordStepEvent, not a public mutation", async () => {
    // CLAUDE.md: the bearer key is NOT a boundary on the mutation itself — every
    // PUBLIC Convex function is callable by anything that can route to the host.
    // Only internalMutation actually gates the write, so this asserts the handler
    // reaches the INTERNAL reference.
    vi.stubEnv("LOOM_API_KEY", AUTH_KEY);
    const m = mockCtx();
    await loomEventPostHandler(m.ctx, req(GOOD));
    expect(getFunctionName(m.calls[0].ref)).toBe(
      getFunctionName(internal.loom.recordStepEvent)
    );
  });

  it("source-level: loom.ts declares recordStepEvent AND upsertPipeline as internalMutation", () => {
    // The reference check above passes as long as `internal.loom.recordStepEvent`
    // resolves — it would not catch someone ALSO exporting a public twin, nor
    // upsertPipeline (which this endpoint never calls) being opened up. Asserted
    // at source level, with a control that the file has zero public mutations.
    const src = readFileSync(join(process.cwd(), "convex", "loom.ts"), "utf8");
    expect(src).toMatch(/export const recordStepEvent = internalMutation\(/);
    expect(src).toMatch(/export const upsertPipeline = internalMutation\(/);
    expect(
      (src.match(/=\s*mutation\(/g) ?? []).length,
      "convex/loom.ts must expose NO public mutations — the bearer gate on the HTTP " +
        "route is not a boundary on the underlying write"
    ).toBe(0);
  });
});

describe("POST /loom/event — request validation", () => {
  it("returns 400 INVALID_JSON on an unparseable body", async () => {
    vi.stubEnv("LOOM_API_KEY", AUTH_KEY);
    const res = await loomEventPostHandler(mockCtx().ctx, req("{not json", AUTHED));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_JSON");
  });

  it.each([
    ["pipelineSlug", { stepId: "verify", event: "start" }],
    ["stepId", { pipelineSlug: "p", event: "start" }],
    ["event", { pipelineSlug: "p", stepId: "verify" }],
  ])("returns 400 MISSING_FIELD naming %s", async (field, body) => {
    vi.stubEnv("LOOM_API_KEY", AUTH_KEY);
    const res = await loomEventPostHandler(mockCtx().ctx, req(body));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBe("MISSING_FIELD");
    expect(j.field).toBe(field);
  });
});

describe("POST /loom/event — refusal status codes are distinguished", () => {
  it("UNKNOWN_PIPELINE is 404 and UNKNOWN_EVENT is 400", async () => {
    // loomHttp.ts's own comment: the distinction matters to the emitter, because
    // one means "author the pipeline first" and the other "you typo'd the verb".
    // Asserting both in one test keeps them paired — a single-sided check would
    // pass against a handler that returned the same status for everything.
    vi.stubEnv("LOOM_API_KEY", AUTH_KEY);

    const notFound = await loomEventPostHandler(
      mockCtx({ ok: false, error: "UNKNOWN_PIPELINE" }).ctx,
      req(GOOD)
    );
    expect(notFound.status).toBe(404);

    const badVerb = await loomEventPostHandler(
      mockCtx({ ok: false, error: "UNKNOWN_EVENT" }).ctx,
      req(GOOD)
    );
    expect(badVerb.status).toBe(400);
  });

  it("returns the runId on success", async () => {
    vi.stubEnv("LOOM_API_KEY", AUTH_KEY);
    const res = await loomEventPostHandler(mockCtx({ ok: true, runId: "run-42" }).ctx, req(GOOD));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, runId: "run-42" });
  });
});
