/**
 * Tests for convex/personaDialsIngest.ts — /persona-dials-ingest httpAction
 * (Phase 189 Plan 10, DIAL-01).
 *
 * Convex's httpAction() wrapper exposes the raw handler as `._handler` (see
 * node_modules/convex/dist/cjs/server/impl/registration_impl.js), so it can
 * be invoked directly with a hand-built ctx and a real Request, without
 * convex-test (not installed in this repo — see convex/runtimeIngest.test.ts:9).
 *
 * Unlike remindersIngest.test.ts's dispatch-only assertions, the default
 * ctx here wires runMutation/runQuery to the REAL personaDials.ts handler
 * functions against an in-memory fake db, so "set then get" is a genuine
 * round trip through actual upsert/clamp logic, not a mocked echo.
 */
import { describe, it, expect, vi } from "vitest";
import { personaDialsIngest } from "./personaDialsIngest";
import { getPersonaDialsHandler, setPersonaDialsHandler } from "./personaDials";

function makeFakeDb() {
  let idCounter = 0;
  const rows = new Map<string, any>();
  return {
    rows,
    async insert(_table: string, doc: any) {
      const id = `id_${idCounter++}`;
      rows.set(id, { _id: id, ...doc });
      return id;
    },
    async get(id: string) {
      return rows.get(id) ?? null;
    },
    async patch(id: string, patch: Record<string, unknown>) {
      const existing = rows.get(id);
      if (existing) rows.set(id, { ...existing, ...patch });
    },
    query(_table: string) {
      const list = () => Array.from(rows.values());
      return {
        withIndex(_indexName: string, cb?: (q: any) => any) {
          let filtered = list();
          if (cb) {
            const conditions: Array<[string, any]> = [];
            const qProxy = {
              eq(field: string, value: any) {
                conditions.push([field, value]);
                return qProxy;
              },
            };
            cb(qProxy);
            filtered = filtered.filter((r) =>
              conditions.every(([f, v]) => r[f] === v)
            );
          }
          return {
            collect: async () => filtered,
            first: async () => filtered[0] ?? null,
          };
        },
      };
    },
  };
}

function makeCtx(
  db: ReturnType<typeof makeFakeDb>,
  overrides: Partial<{ runMutation: any; runQuery: any }> = {}
) {
  return {
    runMutation:
      overrides.runMutation ??
      (async (_ref: any, args: any) =>
        setPersonaDialsHandler({ db }, args, 1700000000)),
    runQuery:
      overrides.runQuery ??
      (async (_ref: any, args: any) => getPersonaDialsHandler({ db }, args)),
  };
}

function jsonRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

describe("personaDialsIngest httpAction (DIAL-01, T-189-43/45)", () => {
  it("returns 204 for OPTIONS (no auth required for preflight)", async () => {
    const req = new Request("http://localhost/persona-dials-ingest", {
      method: "OPTIONS",
    });
    const res = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      req
    );
    expect(res.status).toBe(204);
  });

  it("returns 401 without an Authorization header when a key is configured, and NO mutation runs", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "dial-key-abc");
    const runMutation = vi.fn();
    const req = jsonRequest("http://localhost/persona-dials-ingest", {
      op: "set",
      profileId: "personal",
      personaId: "astridr",
      humor: 50,
      candor: 50,
    });
    const res = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb(), { runMutation }),
      req
    );
    expect(res.status).toBe(401);
    // T-189-43: a 401 that still wrote would be the real defect.
    expect(runMutation).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("returns 401 with a blank Authorization header (fails CLOSED)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "dial-key-abc");
    const req = jsonRequest(
      "http://localhost/persona-dials-ingest",
      { op: "get" },
      { Authorization: "" }
    );
    const res = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      req
    );
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("fails CLOSED when ASTRIDR_INGEST_API_KEY is unset (no silent anon open)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    const req = jsonRequest("http://localhost/persona-dials-ingest", {
      op: "get",
    });
    const res = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      req
    );
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 400 when op is missing", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/persona-dials-ingest",
      { profileId: "personal", personaId: "astridr" },
      { Authorization: "Bearer k" }
    );
    const res = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      req
    );
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 for op:set missing profileId/personaId/humor/candor", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/persona-dials-ingest",
      { op: "set", profileId: "personal" },
      { Authorization: "Bearer k" }
    );
    const res = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      req
    );
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 for op:get missing profileId/personaId", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/persona-dials-ingest",
      { op: "get", profileId: "personal" },
      { Authorization: "Bearer k" }
    );
    const res = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      req
    );
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 for an unknown op", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/persona-dials-ingest",
      { op: "delete" },
      { Authorization: "Bearer k" }
    );
    const res = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      req
    );
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toContain("Unknown op");
    vi.unstubAllEnvs();
  });

  it("returns 400 (not 500) when the mutation throws", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runMutation = vi.fn().mockRejectedValue(new Error("boom"));
    const req = jsonRequest(
      "http://localhost/persona-dials-ingest",
      { op: "set", profileId: "personal", personaId: "astridr", humor: 50, candor: 50 },
      { Authorization: "Bearer k" }
    );
    const res = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb(), { runMutation }),
      req
    );
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("op:get returns null (not an error) when no dial row exists yet", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/persona-dials-ingest",
      { op: "get", profileId: "personal", personaId: "astridr" },
      { Authorization: "Bearer k" }
    );
    const res = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      req
    );
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.dial).toBeNull();
    vi.unstubAllEnvs();
  });

  it("set then get round-trips the exact values", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    const setRes = await (personaDialsIngest as any)._handler(
      makeCtx(db),
      jsonRequest(
        "http://localhost/persona-dials-ingest",
        { op: "set", profileId: "personal", personaId: "astridr", humor: 72, candor: 34 },
        { Authorization: "Bearer k" }
      )
    );
    expect(setRes.status).toBe(200);

    const getRes = await (personaDialsIngest as any)._handler(
      makeCtx(db),
      jsonRequest(
        "http://localhost/persona-dials-ingest",
        { op: "get", profileId: "personal", personaId: "astridr" },
        { Authorization: "Bearer k" }
      )
    );
    const body = await readJson(getRes);
    expect(body.dial.humor).toBe(72);
    expect(body.dial.candor).toBe(34);
    expect(body.dial.profileId).toBe("personal");
    expect(body.dial.personaId).toBe("astridr");
    vi.unstubAllEnvs();
  });

  it("a second set on the same profile+persona patches in place (no duplicate row)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    await (personaDialsIngest as any)._handler(
      makeCtx(db),
      jsonRequest(
        "http://localhost/persona-dials-ingest",
        { op: "set", profileId: "personal", personaId: "astridr", humor: 20, candor: 20 },
        { Authorization: "Bearer k" }
      )
    );
    await (personaDialsIngest as any)._handler(
      makeCtx(db),
      jsonRequest(
        "http://localhost/persona-dials-ingest",
        { op: "set", profileId: "personal", personaId: "astridr", humor: 80, candor: 80 },
        { Authorization: "Bearer k" }
      )
    );
    expect(db.rows.size).toBe(1);
    vi.unstubAllEnvs();
  });

  it("a different personaId under the same profile gets its own row", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    await (personaDialsIngest as any)._handler(
      makeCtx(db),
      jsonRequest(
        "http://localhost/persona-dials-ingest",
        { op: "set", profileId: "personal", personaId: "astridr", humor: 20, candor: 20 },
        { Authorization: "Bearer k" }
      )
    );
    await (personaDialsIngest as any)._handler(
      makeCtx(db),
      jsonRequest(
        "http://localhost/persona-dials-ingest",
        { op: "set", profileId: "personal", personaId: "other-persona", humor: 90, candor: 90 },
        { Authorization: "Bearer k" }
      )
    );
    expect(db.rows.size).toBe(2);
    vi.unstubAllEnvs();
  });

  it("set with humor:150 clamps and stores 100 (T-189-45)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const setRes = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      jsonRequest(
        "http://localhost/persona-dials-ingest",
        { op: "set", profileId: "personal", personaId: "astridr", humor: 150, candor: 50 },
        { Authorization: "Bearer k" }
      )
    );
    const body = await readJson(setRes);
    expect(body.dial.humor).toBe(100);
    vi.unstubAllEnvs();
  });

  it("set with humor:-5 clamps and stores 0 (T-189-45)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const setRes = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      jsonRequest(
        "http://localhost/persona-dials-ingest",
        { op: "set", profileId: "personal", personaId: "astridr", humor: -5, candor: 50 },
        { Authorization: "Bearer k" }
      )
    );
    const body = await readJson(setRes);
    expect(body.dial.humor).toBe(0);
    vi.unstubAllEnvs();
  });

  it("candor is clamped the same way as humor at both boundaries", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const highRes = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      jsonRequest(
        "http://localhost/persona-dials-ingest",
        { op: "set", profileId: "personal", personaId: "astridr", humor: 50, candor: 150 },
        { Authorization: "Bearer k" }
      )
    );
    expect((await readJson(highRes)).dial.candor).toBe(100);

    const lowRes = await (personaDialsIngest as any)._handler(
      makeCtx(makeFakeDb()),
      jsonRequest(
        "http://localhost/persona-dials-ingest",
        { op: "set", profileId: "personal", personaId: "astridr", humor: 50, candor: -5 },
        { Authorization: "Bearer k" }
      )
    );
    expect((await readJson(lowRes)).dial.candor).toBe(0);
    vi.unstubAllEnvs();
  });
});
