/**
 * Tests for convex/remindersIngest.ts — /reminders-ingest + /reminders-read
 * httpActions (Phase 101 Plan 02, REM-02) — and, in the "calendarEvents
 * upsertCalendarBatchHandler" / "calendarIngest httpAction" sections below,
 * convex/calendarEvents.ts's upsert+prune mutation and /calendar-ingest
 * httpAction (CAL-01, Task 3).
 *
 * Convex's httpAction()/mutation()/query() wrappers expose the raw handler
 * function as `._handler` (see node_modules/convex/dist/cjs/server/impl/
 * registration_impl.js — `q._handler = func`), so httpActions can be invoked
 * directly with a hand-built `ctx` (mocked `runMutation`/`runQuery`) and a
 * real `Request`, without needing convex-test (not installed in this repo —
 * see convex/runtimeIngest.test.ts:9). This gives full-fidelity coverage of
 * the actual handler logic, not a hand-duplicated re-implementation.
 */
import { describe, it, expect, vi } from "vitest";
import { remindersIngest, remindersRead } from "./remindersIngest";
import { calendarIngest, upsertCalendarBatchHandler } from "./calendarEvents";

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
// /reminders-ingest
// ---------------------------------------------------------------------------

describe("remindersIngest httpAction (REM-02, T-101-01)", () => {
  it("returns 204 for OPTIONS (no auth required for preflight)", async () => {
    const req = new Request("http://localhost/reminders-ingest", { method: "OPTIONS" });
    const res = await (remindersIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(204);
  });

  it("returns 401 without an Authorization header when a key is configured", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "reminders-key-abc");
    const req = jsonRequest("http://localhost/reminders-ingest", {
      op: "create",
      profileId: "personal",
      title: "Water plants",
    });
    const res = await (remindersIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 401 with a blank Authorization header (fails CLOSED)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "reminders-key-abc");
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { op: "create" },
      { Authorization: "" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("fails CLOSED when ASTRIDR_INGEST_API_KEY is unset (no silent anon open)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    const req = jsonRequest("http://localhost/reminders-ingest", { op: "create" });
    const res = await (remindersIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 400 when op is missing", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { profileId: "personal", title: "X" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 for op:create without title", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { op: "create", profileId: "personal" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 for op:create without profileId", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { op: "create", title: "Water plants" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("op:create passes source:'astridr' to reminders.create, ignoring any body.source (D-09)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runMutation = vi.fn().mockResolvedValue("newId123");
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { op: "create", profileId: "personal", title: "Water plants", source: "dashboard" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx({ runMutation }), req);
    expect(res.status).toBe(200);
    expect(runMutation).toHaveBeenCalledTimes(1);
    const [, args] = runMutation.mock.calls[0];
    expect(args.source).toBe("astridr"); // never "dashboard" — the endpoint is Ástríðr's own write path
    expect(args.profileId).toBe("personal");
    expect(args.title).toBe("Water plants");
    const body = await readJson(res);
    expect(body.ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns 400 for op:update without id", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { op: "update", title: "New title" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("op:update with id dispatches to reminders.update", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runMutation = vi.fn().mockResolvedValue(undefined);
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { op: "update", id: "abc123", title: "New title" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx({ runMutation }), req);
    expect(res.status).toBe(200);
    const [, args] = runMutation.mock.calls[0];
    expect(args.id).toBe("abc123");
    expect(args.title).toBe("New title");
    vi.unstubAllEnvs();
  });

  it("returns 400 for op:complete without id", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { op: "complete" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("op:complete with id dispatches to reminders.complete", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runMutation = vi.fn().mockResolvedValue(undefined);
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { op: "complete", id: "abc123" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx({ runMutation }), req);
    expect(res.status).toBe(200);
    expect(runMutation.mock.calls[0][1].id).toBe("abc123");
    vi.unstubAllEnvs();
  });

  it("returns 400 for an unknown op", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { op: "delete", id: "abc123" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toContain("Unknown op");
    vi.unstubAllEnvs();
  });

  it("returns 400 (not 500) when the mutation throws", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runMutation = vi.fn().mockRejectedValue(new Error("boom"));
    const req = jsonRequest(
      "http://localhost/reminders-ingest",
      { op: "create", profileId: "personal", title: "X" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersIngest as any)._handler(makeCtx({ runMutation }), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// /reminders-read (D-07 — authed read, never anonymous)
// ---------------------------------------------------------------------------

describe("remindersRead httpAction (REM-02, D-07)", () => {
  it("returns 204 for OPTIONS", async () => {
    const req = new Request("http://localhost/reminders-read", { method: "OPTIONS" });
    const res = await (remindersRead as any)._handler(makeCtx(), req);
    expect(res.status).toBe(204);
  });

  it("returns 401 without auth (reminders are never anonymously readable)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "reminders-key-abc");
    const req = jsonRequest("http://localhost/reminders-read", { profileId: "personal" });
    const res = await (remindersRead as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 401 with the wrong key", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "reminders-key-abc");
    const req = jsonRequest(
      "http://localhost/reminders-read",
      { profileId: "personal" },
      { Authorization: "Bearer wrong-key" }
    );
    const res = await (remindersRead as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("fails CLOSED when ASTRIDR_INGEST_API_KEY is unset", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    const req = jsonRequest("http://localhost/reminders-read", { profileId: "personal" });
    const res = await (remindersRead as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 400 when profileId is missing", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest("http://localhost/reminders-read", {}, { Authorization: "Bearer k" });
    const res = await (remindersRead as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 200 + the profile's reminders from reminders.listByProfile", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runQuery = vi.fn().mockResolvedValue([{ _id: "r1", title: "Water plants" }]);
    const req = jsonRequest(
      "http://localhost/reminders-read",
      { profileId: "business" },
      { Authorization: "Bearer k" }
    );
    const res = await (remindersRead as any)._handler(makeCtx({ runQuery }), req);
    expect(res.status).toBe(200);
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery.mock.calls[0][1].profileId).toBe("business");
    const body = await readJson(res);
    expect(body.ok).toBe(true);
    expect(body.reminders).toHaveLength(1);
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// /calendar-ingest (CAL-01, T-101-01) — dispatches to calendarEvents.upsertBatch
// ---------------------------------------------------------------------------

describe("calendarIngest httpAction (CAL-01, T-101-01)", () => {
  it("returns 204 for OPTIONS", async () => {
    const req = new Request("http://localhost/calendar-ingest", { method: "OPTIONS" });
    const res = await (calendarIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(204);
  });

  it("returns 401 without auth (fails CLOSED)", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "cal-key");
    const req = jsonRequest("http://localhost/calendar-ingest", {
      profileId: "personal",
      calendarAccount: "mandrasle@gmail.com",
      events: [],
      fetchedAt: 1,
    });
    const res = await (calendarIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("fails CLOSED when ASTRIDR_INGEST_API_KEY is unset", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    const req = jsonRequest("http://localhost/calendar-ingest", { profileId: "personal" });
    const res = await (calendarIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 400 when profileId/calendarAccount/events are missing", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "cal-key");
    const req = jsonRequest(
      "http://localhost/calendar-ingest",
      { profileId: "personal" },
      { Authorization: "Bearer cal-key" }
    );
    const res = await (calendarIngest as any)._handler(makeCtx(), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("dispatches the parsed body to calendarEvents.upsertBatch", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "cal-key");
    const runMutation = vi.fn().mockResolvedValue({ upserted: 1, pruned: 0 });
    const req = jsonRequest(
      "http://localhost/calendar-ingest",
      {
        profileId: "personal",
        calendarAccount: "mandrasle@gmail.com",
        events: [{ googleEventId: "g1", title: "Dentist", start: 100, end: 200, allDay: false }],
        fetchedAt: 555,
      },
      { Authorization: "Bearer cal-key" }
    );
    const res = await (calendarIngest as any)._handler(makeCtx({ runMutation }), req);
    expect(res.status).toBe(200);
    const [, args] = runMutation.mock.calls[0];
    expect(args.profileId).toBe("personal");
    expect(args.calendarAccount).toBe("mandrasle@gmail.com");
    expect(args.events).toHaveLength(1);
    expect(args.fetchedAt).toBe(555);
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// calendarEvents upsertCalendarBatchHandler — upsert-by-googleEventId +
// scoped stale prune (CAL-01/D-10). In-memory fake ctx.db mirroring
// convex/reminders.test.ts's makeFakeDb pattern.
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
    async delete(id: string) {
      rows.delete(id);
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

describe("calendarEvents upsertCalendarBatchHandler (CAL-01, D-10)", () => {
  it("inserts new events into an empty cache", async () => {
    const db = makeFakeDb();
    await upsertCalendarBatchHandler(
      { db },
      {
        profileId: "personal",
        calendarAccount: "mandrasle@gmail.com",
        events: [
          { googleEventId: "g1", title: "Dentist", start: 1000, end: 1100, allDay: false },
        ],
        fetchedAt: 500,
      }
    );
    const rows = Array.from(db.rows.values());
    expect(rows).toHaveLength(1);
    expect(rows[0].googleEventId).toBe("g1");
    expect(rows[0].title).toBe("Dentist");
    expect(rows[0].fetchedAt).toBe(500);
  });

  it("upserts by googleEventId: pushes 2 events (1 new, 1 existing-patched), drops 1 stale, leaves other accounts untouched", async () => {
    const db = makeFakeDb();
    // Seed 3 rows: 2 for (personal, mandrasle@gmail.com) — one will be
    // dropped, one will be patched — and 1 for a DIFFERENT account entirely.
    await db.insert("calendarEvents", {
      profileId: "personal",
      calendarAccount: "mandrasle@gmail.com",
      googleEventId: "g-keep",
      title: "Old title",
      start: 100,
      end: 200,
      allDay: false,
      fetchedAt: 1,
    });
    await db.insert("calendarEvents", {
      profileId: "personal",
      calendarAccount: "mandrasle@gmail.com",
      googleEventId: "g-drop",
      title: "Stale meeting",
      start: 300,
      end: 400,
      allDay: false,
      fetchedAt: 1,
    });
    await db.insert("calendarEvents", {
      profileId: "personal",
      calendarAccount: "lmandras@myprotectall.com", // different account, same profile
      googleEventId: "g-other-account",
      title: "Business call",
      start: 500,
      end: 600,
      allDay: false,
      fetchedAt: 1,
    });

    const result = await upsertCalendarBatchHandler(
      { db },
      {
        profileId: "personal",
        calendarAccount: "mandrasle@gmail.com",
        events: [
          { googleEventId: "g-keep", title: "Updated title", start: 100, end: 250, allDay: false },
          { googleEventId: "g-new", title: "New event", start: 700, end: 800, allDay: true },
        ],
        fetchedAt: 999,
      }
    );

    const rows = Array.from(db.rows.values());
    const byGoogleId = new Map(rows.map((r: any) => [r.googleEventId, r]));

    // g-drop was not in the push for this (profile, account) -> pruned.
    expect(byGoogleId.has("g-drop")).toBe(false);
    // g-keep was patched, not duplicated.
    expect(byGoogleId.get("g-keep").title).toBe("Updated title");
    expect(byGoogleId.get("g-keep").end).toBe(250);
    expect(byGoogleId.get("g-keep").fetchedAt).toBe(999);
    // g-new was inserted.
    expect(byGoogleId.get("g-new").title).toBe("New event");
    expect(byGoogleId.get("g-new").allDay).toBe(true);
    // The OTHER account's row for the same profile is completely untouched.
    expect(byGoogleId.get("g-other-account").title).toBe("Business call");
    expect(byGoogleId.get("g-other-account").fetchedAt).toBe(1);

    expect(rows).toHaveLength(3); // g-keep, g-new, g-other-account (g-drop pruned)
    expect(result.pruned).toBe(1);
    expect(result.upserted).toBe(2);
  });

  it("does not prune rows for a different profileId", async () => {
    const db = makeFakeDb();
    await db.insert("calendarEvents", {
      profileId: "business",
      calendarAccount: "lmandras@myprotectall.com",
      googleEventId: "g-business",
      title: "Business event",
      start: 100,
      end: 200,
      allDay: false,
      fetchedAt: 1,
    });

    await upsertCalendarBatchHandler(
      { db },
      {
        profileId: "personal",
        calendarAccount: "mandrasle@gmail.com",
        events: [],
        fetchedAt: 999,
      }
    );

    const rows = Array.from(db.rows.values());
    expect(rows).toHaveLength(1);
    expect(rows[0].googleEventId).toBe("g-business");
  });
});
