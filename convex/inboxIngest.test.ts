/**
 * Tests for convex/inboxIngest.ts — /inbox-ingest + /inbox-read +
 * /inbox-read-all httpActions (Phase 186 Plan 02, GOV-01/D-10/D-12) — and,
 * in the "inbox.ts handlers" section below, convex/inbox.ts's raise/ack/
 * dismiss/listByProfile/listAll handlers.
 *
 * Convex's httpAction()/mutation()/query() wrappers expose the raw handler
 * function as `._handler` (see remindersIngest.test.ts's precedent), so
 * httpActions can be invoked directly with a hand-built `ctx` (mocked
 * runMutation/runQuery) and a real `Request`, without needing convex-test
 * (not installed in this repo). This gives full-fidelity coverage of the
 * actual handler logic, not a hand-duplicated re-implementation.
 */
import { describe, it, expect, vi } from "vitest";
import { inboxIngest, inboxRead, inboxReadAll } from "./inboxIngest";
import {
  raiseHandler,
  ackHandler,
  dismissHandler,
  listByProfileHandler,
  listAllHandler,
  dismissAllCardsHandler,
} from "./inbox";

function makeCtx(overrides: Partial<{ runMutation: any; runQuery: any }> = {}) {
  return {
    runMutation: overrides.runMutation ?? vi.fn().mockResolvedValue(undefined),
    runQuery: overrides.runQuery ?? vi.fn().mockResolvedValue([]),
  };
}

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

// ---------------------------------------------------------------------------
// /inbox-ingest
// ---------------------------------------------------------------------------

describe("inboxIngest httpAction (T-186-02-01)", () => {
  it("returns 204 for OPTIONS (no auth required for preflight)", async () => {
    const req = new Request("http://localhost/inbox-ingest", { method: "OPTIONS" });
    const res = await (inboxIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(204);
  });

  it("returns 401 without an Authorization header when a key is configured", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "inbox-key-abc");
    const req = jsonRequest("http://localhost/inbox-ingest", {
      op: "raise",
      profileId: "personal",
      title: "Reminder due",
      body: "Water the plants",
      itemType: "card",
    });
    const res = await (inboxIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 401 with a blank Authorization header (fails CLOSED)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "inbox-key-abc");
    const req = jsonRequest(
      "http://localhost/inbox-ingest",
      { op: "raise" },
      { Authorization: "" }
    );
    const res = await (inboxIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("fails CLOSED when ASTRIDR_INGEST_API_KEY is unset (no silent anon open)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    const req = jsonRequest("http://localhost/inbox-ingest", { op: "raise" });
    const res = await (inboxIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 400 when op is missing", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/inbox-ingest",
      { profileId: "personal" },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 for op:raise missing required fields", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/inbox-ingest",
      { op: "raise", profileId: "personal" },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("op:raise forwards itemType/heldReason/intentId straight through to inbox.raise (D-10)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runMutation = vi.fn().mockResolvedValue("newId123");
    const req = jsonRequest(
      "http://localhost/inbox-ingest",
      {
        op: "raise",
        profileId: "business",
        emitter: "email_pulse",
        priority: "high",
        title: "New email from client",
        body: "Reply needed by EOD",
        spoken: true,
        itemType: "held",
        heldReason: "focus",
        intentId: "intent-abc-123",
        source: "watch_pulse",
      },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxIngest as any)._handler(makeCtx({ runMutation }), req);
    expect(res.status).toBe(200);
    expect(runMutation).toHaveBeenCalledTimes(1);
    const [, args] = runMutation.mock.calls[0];
    expect(args.profileId).toBe("business");
    expect(args.itemType).toBe("held");
    expect(args.heldReason).toBe("focus");
    expect(args.intentId).toBe("intent-abc-123");
    const body = await readJson(res);
    expect(body.ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns 400 for op:ack without id", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/inbox-ingest",
      { op: "ack" },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("op:ack with id dispatches to inbox.ack", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runMutation = vi.fn().mockResolvedValue(undefined);
    const req = jsonRequest(
      "http://localhost/inbox-ingest",
      { op: "ack", id: "abc123" },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxIngest as any)._handler(makeCtx({ runMutation }), req);
    expect(res.status).toBe(200);
    expect(runMutation.mock.calls[0][1].id).toBe("abc123");
    vi.unstubAllEnvs();
  });

  it("returns 400 for op:dismiss without id", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/inbox-ingest",
      { op: "dismiss" },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("op:dismiss with id dispatches to inbox.dismiss", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runMutation = vi.fn().mockResolvedValue(undefined);
    const req = jsonRequest(
      "http://localhost/inbox-ingest",
      { op: "dismiss", id: "abc123" },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxIngest as any)._handler(makeCtx({ runMutation }), req);
    expect(res.status).toBe(200);
    expect(runMutation.mock.calls[0][1].id).toBe("abc123");
    vi.unstubAllEnvs();
  });

  it("returns 400 for an unknown op", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/inbox-ingest",
      { op: "setIntentId", id: "abc123" },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toContain("Unknown op");
    vi.unstubAllEnvs();
  });

  it("returns 400 (not 500) when the mutation throws", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runMutation = vi.fn().mockRejectedValue(new Error("boom"));
    const req = jsonRequest(
      "http://localhost/inbox-ingest",
      { op: "raise", profileId: "personal", title: "X", body: "Y", itemType: "card" },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxIngest as any)._handler(makeCtx({ runMutation }), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// /inbox-read (UNCHANGED per-profile authed read)
// ---------------------------------------------------------------------------

describe("inboxRead httpAction (T-186-02-01)", () => {
  it("returns 204 for OPTIONS", async () => {
    const req = new Request("http://localhost/inbox-read", { method: "OPTIONS" });
    const res = await (inboxRead as any)._handler(makeCtx(), req);
    expect(res.status).toBe(204);
  });

  it("returns 401 without auth (inbox rows are never anonymously readable)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "inbox-key-abc");
    const req = jsonRequest("http://localhost/inbox-read", { profileId: "personal" });
    const res = await (inboxRead as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("fails CLOSED when ASTRIDR_INGEST_API_KEY is unset", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    const req = jsonRequest("http://localhost/inbox-read", { profileId: "personal" });
    const res = await (inboxRead as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 400 when profileId is missing", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest("http://localhost/inbox-read", {}, { Authorization: "Bearer k" });
    const res = await (inboxRead as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 200 + the profile's inbox rows from inbox.listByProfile", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runQuery = vi.fn().mockResolvedValue([{ _id: "i1", title: "Held item" }]);
    const req = jsonRequest(
      "http://localhost/inbox-read",
      { profileId: "business" },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxRead as any)._handler(makeCtx({ runQuery }), req);
    expect(res.status).toBe(200);
    expect(runQuery.mock.calls[0][1].profileId).toBe("business");
    const body = await readJson(res);
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// /inbox-read-all (D-12 aggregate all-profiles read, T-186-02-03)
// ---------------------------------------------------------------------------

describe("inboxReadAll httpAction (D-12, T-186-02-03)", () => {
  it("returns 204 for OPTIONS", async () => {
    const req = new Request("http://localhost/inbox-read-all", { method: "OPTIONS" });
    const res = await (inboxReadAll as any)._handler(makeCtx(), req);
    expect(res.status).toBe(204);
  });

  it("returns 401 without auth — same fail-closed check as /inbox-read, no anonymous aggregate read", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "inbox-key-abc");
    const req = jsonRequest("http://localhost/inbox-read-all", {});
    const res = await (inboxReadAll as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("fails CLOSED when ASTRIDR_INGEST_API_KEY is unset", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    const req = jsonRequest("http://localhost/inbox-read-all", {});
    const res = await (inboxReadAll as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 200 with NO profileId required and forwards inbox.listAll", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runQuery = vi.fn().mockResolvedValue([
      { _id: "i1", profileId: "personal" },
      { _id: "i2", profileId: "business" },
      { _id: "i3", profileId: "consulting" },
    ]);
    const req = jsonRequest("http://localhost/inbox-read-all", {}, { Authorization: "Bearer k" });
    const res = await (inboxReadAll as any)._handler(makeCtx({ runQuery }), req);
    expect(res.status).toBe(200);
    expect(runQuery.mock.calls[0][1].profileId).toBeUndefined();
    const body = await readJson(res);
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(3);
    vi.unstubAllEnvs();
  });

  it("forwards an optional limit through to inbox.listAll", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runQuery = vi.fn().mockResolvedValue([]);
    const req = jsonRequest(
      "http://localhost/inbox-read-all",
      { limit: 50 },
      { Authorization: "Bearer k" }
    );
    const res = await (inboxReadAll as any)._handler(makeCtx({ runQuery }), req);
    expect(res.status).toBe(200);
    expect(runQuery.mock.calls[0][1].limit).toBe(50);
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// inbox.ts handlers — raise/ack/dismiss/listByProfile/listAll persistence
// (D-10/D-12). In-memory fake ctx.db mirroring convex/reminders.test.ts's
// makeFakeDb pattern, extended with order()/take() to back the by_createdAt
// aggregate index.
// ---------------------------------------------------------------------------

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
            order(direction: "asc" | "desc") {
              const sorted = [...filtered].sort((a, b) =>
                direction === "desc"
                  ? b.createdAt - a.createdAt
                  : a.createdAt - b.createdAt
              );
              return {
                collect: async () => sorted,
                take: async (n: number) => sorted.slice(0, n),
              };
            },
            collect: async () => filtered,
          };
        },
      };
    },
  };
}

describe("inbox.ts raiseHandler + listByProfileHandler (D-10)", () => {
  it("persists itemType/heldReason/intentId and returns them via listByProfile", async () => {
    const db = makeFakeDb();

    await raiseHandler(
      { db },
      {
        profileId: "personal",
        emitter: "reminder_nudge",
        priority: "normal",
        title: "Water plants",
        body: "Due now",
        spoken: false,
        itemType: "card",
      },
      1000
    );

    await raiseHandler(
      { db },
      {
        profileId: "personal",
        emitter: "email_pulse",
        priority: "high",
        title: "Suppressed alert",
        body: "Held during focus mode",
        spoken: false,
        itemType: "held",
        heldReason: "focus",
      },
      2000
    );

    await raiseHandler(
      { db },
      {
        profileId: "personal",
        emitter: "calendar_pulse",
        priority: "high",
        title: "Meeting starting",
        body: "Standup in 5",
        spoken: true,
        itemType: "alert",
        intentId: "intent-xyz-789",
      },
      3000
    );

    const rows = await listByProfileHandler({ db }, "personal");
    expect(rows).toHaveLength(3);

    const held = rows.find((r: any) => r.itemType === "held");
    expect(held.heldReason).toBe("focus");

    const withIntent = rows.find((r: any) => r.intentId === "intent-xyz-789");
    expect(withIntent).toBeDefined();
    expect(withIntent.itemType).toBe("alert");

    // Newest first.
    expect(rows[0].createdAt).toBe(3000);
    expect(rows[2].createdAt).toBe(1000);
  });

  it("scopes listByProfile to the requested profileId only", async () => {
    const db = makeFakeDb();
    await raiseHandler(
      { db },
      {
        profileId: "personal",
        emitter: "x",
        priority: "normal",
        title: "Personal card",
        body: "b",
        spoken: false,
        itemType: "card",
      },
      100
    );
    await raiseHandler(
      { db },
      {
        profileId: "business",
        emitter: "x",
        priority: "normal",
        title: "Business card",
        body: "b",
        spoken: false,
        itemType: "card",
      },
      200
    );

    const rows = await listByProfileHandler({ db }, "personal");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Personal card");
  });
});

describe("inbox.ts listAllHandler — aggregate all-profiles read (D-12)", () => {
  it("returns rows seeded under personal AND business AND consulting", async () => {
    const db = makeFakeDb();
    await raiseHandler(
      { db },
      {
        profileId: "personal",
        emitter: "x",
        priority: "normal",
        title: "Personal card",
        body: "b",
        spoken: false,
        itemType: "card",
      },
      100
    );
    await raiseHandler(
      { db },
      {
        profileId: "business",
        emitter: "x",
        priority: "high",
        title: "Business held",
        body: "b",
        spoken: false,
        itemType: "held",
        heldReason: "quiet-hours",
      },
      200
    );
    await raiseHandler(
      { db },
      {
        profileId: "consulting",
        emitter: "x",
        priority: "normal",
        title: "Consulting card",
        body: "b",
        spoken: false,
        itemType: "card",
      },
      300
    );

    const rows = await listAllHandler({ db });
    expect(rows).toHaveLength(3);
    const profiles = rows.map((r: any) => r.profileId).sort();
    expect(profiles).toEqual(["business", "consulting", "personal"]);

    // Newest first (business/consulting are not dropped by ordering either).
    expect(rows[0].profileId).toBe("consulting");
    expect(rows[0].createdAt).toBe(300);
  });

  it("bounds the aggregate read via limit (D-12 — never unbounded)", async () => {
    const db = makeFakeDb();
    for (let i = 0; i < 5; i++) {
      await raiseHandler(
        { db },
        {
          profileId: i % 2 === 0 ? "personal" : "business",
          emitter: "x",
          priority: "normal",
          title: `Item ${i}`,
          body: "b",
          spoken: false,
          itemType: "card",
        },
        i * 100
      );
    }
    const rows = await listAllHandler({ db }, 2);
    expect(rows).toHaveLength(2);
    // Newest two only.
    expect(rows[0].createdAt).toBe(400);
    expect(rows[1].createdAt).toBe(300);
  });
});

describe("inbox.ts ackHandler / dismissHandler", () => {
  it("ack stamps ackedAt on an existing row", async () => {
    const db = makeFakeDb();
    const id = await raiseHandler(
      { db },
      {
        profileId: "personal",
        emitter: "x",
        priority: "normal",
        title: "Card",
        body: "b",
        spoken: false,
        itemType: "card",
      },
      100
    );
    await ackHandler({ db }, id, 5000);
    const row = await db.get(id);
    expect(row.ackedAt).toBe(5000);
  });

  it("dismiss stamps ackedAt on an existing row", async () => {
    const db = makeFakeDb();
    const id = await raiseHandler(
      { db },
      {
        profileId: "personal",
        emitter: "x",
        priority: "normal",
        title: "Card",
        body: "b",
        spoken: false,
        itemType: "card",
      },
      100
    );
    await dismissHandler({ db }, id, 6000);
    const row = await db.get(id);
    expect(row.ackedAt).toBe(6000);
  });

  it("is a no-op when the row does not exist (idempotent)", async () => {
    const db = makeFakeDb();
    await expect(ackHandler({ db }, "missing-id", 100)).resolves.toBeUndefined();
    await expect(dismissHandler({ db }, "missing-id", 100)).resolves.toBeUndefined();
  });
});

describe("inbox.ts dismissAllCardsHandler (Phase 186 checkpoint round 4 backlog cleanup)", () => {
  it("dismisses every unacked itemType=card row across all profiles", async () => {
    const db = makeFakeDb();
    await raiseHandler(
      { db },
      { profileId: "personal", emitter: "x", priority: "normal", title: "P card", body: "b", spoken: false, itemType: "card" },
      100
    );
    await raiseHandler(
      { db },
      { profileId: "business", emitter: "x", priority: "high", title: "B card", body: "b", spoken: true, itemType: "card" },
      200
    );
    await raiseHandler(
      { db },
      { profileId: "consulting", emitter: "x", priority: "normal", title: "C card", body: "b", spoken: false, itemType: "card" },
      300
    );

    const count = await dismissAllCardsHandler({ db }, 9999);
    expect(count).toBe(3);

    const rows = await listAllHandler({ db });
    expect(rows.every((r: any) => r.ackedAt === 9999)).toBe(true);
  });

  it("never touches held rows", async () => {
    const db = makeFakeDb();
    await raiseHandler(
      { db },
      { profileId: "personal", emitter: "x", priority: "normal", title: "Card", body: "b", spoken: false, itemType: "card" },
      100
    );
    await raiseHandler(
      { db },
      { profileId: "personal", emitter: "x", priority: "high", title: "Held", body: "b", spoken: false, itemType: "held", heldReason: "focus" },
      200
    );

    const count = await dismissAllCardsHandler({ db }, 9999);
    expect(count).toBe(1);

    const rows = await listAllHandler({ db });
    const held = rows.find((r: any) => r.itemType === "held");
    expect(held.ackedAt).toBeUndefined();
  });

  it("is idempotent -- a second run finds nothing left to dismiss", async () => {
    const db = makeFakeDb();
    await raiseHandler(
      { db },
      { profileId: "personal", emitter: "x", priority: "normal", title: "Card", body: "b", spoken: false, itemType: "card" },
      100
    );

    const first = await dismissAllCardsHandler({ db }, 9999);
    expect(first).toBe(1);
    const second = await dismissAllCardsHandler({ db }, 9999);
    expect(second).toBe(0);
  });

  it("returns 0 against an empty inbox", async () => {
    const db = makeFakeDb();
    const count = await dismissAllCardsHandler({ db }, 9999);
    expect(count).toBe(0);
  });
});
