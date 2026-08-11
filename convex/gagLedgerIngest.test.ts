/**
 * Tests for convex/gagLedgerIngest.ts — /gag-ledger-ingest httpAction
 * (Phase 189 Plan 10, DIAL-01, D-21, T-189-44/46).
 *
 * Convex's httpAction() wrapper exposes the raw handler as `._handler` (see
 * node_modules/convex/dist/cjs/server/impl/registration_impl.js), so it can
 * be invoked directly with a hand-built ctx and a real Request, without
 * convex-test (not installed in this repo — see convex/runtimeIngest.test.ts:9).
 *
 * The default ctx wires runMutation/runQuery to the REAL gagLedger.ts
 * handler functions (matched by `ref === api.gagLedger.<fn>` identity,
 * since `api` is imported for real here, not mocked) against an in-memory
 * fake db, with a mutable `clock` object so tests can simulate advancing
 * time between calls — this is what makes the cooldown positive/negative
 * pair test possible without waiting on a real clock.
 */
import { describe, it, expect, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { gagLedgerIngest } from "./gagLedgerIngest";
import {
  proposeGagHandler,
  confirmGagHandler,
  retireGagHandler,
  listGagsHandler,
  eligibleGagsHandler,
  markUsedGagHandler,
} from "./gagLedger";

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
          };
        },
      };
    },
  };
}

/** clockRef is a mutable box: `clockRef.now` can be reassigned mid-test to
 * simulate time advancing past a cooldown window. */
function makeCtx(
  db: ReturnType<typeof makeFakeDb>,
  clockRef: { now: number },
  overrides: Partial<{ runMutation: any; runQuery: any }> = {}
) {
  const runMutation =
    overrides.runMutation ??
    (async (ref: any, args: any) => {
      const name = getFunctionName(ref);
      if (name === "gagLedger:propose") return proposeGagHandler({ db }, args, clockRef.now);
      if (name === "gagLedger:confirm") return confirmGagHandler({ db }, args.id, clockRef.now);
      if (name === "gagLedger:retire") return retireGagHandler({ db }, args.id, clockRef.now);
      if (name === "gagLedger:markUsed") return markUsedGagHandler({ db }, args.id, clockRef.now);
      throw new Error(`makeCtx: unmocked runMutation ref ${name}`);
    });
  const runQuery =
    overrides.runQuery ??
    (async (ref: any, args: any) => {
      const name = getFunctionName(ref);
      if (name === "gagLedger:list") return listGagsHandler({ db }, args.profileId);
      if (name === "gagLedger:eligible") return eligibleGagsHandler({ db }, args, clockRef.now);
      throw new Error(`makeCtx: unmocked runQuery ref ${name}`);
    });
  return { runMutation, runQuery };
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

const NOW = 1700000000;

describe("gagLedgerIngest httpAction (DIAL-01, T-189-43)", () => {
  it("returns 204 for OPTIONS (no auth required for preflight)", async () => {
    const req = new Request("http://localhost/gag-ledger-ingest", { method: "OPTIONS" });
    const res = await (gagLedgerIngest as any)._handler(makeCtx(makeFakeDb(), { now: NOW }), req);
    expect(res.status).toBe(204);
  });

  it("returns 401 without auth when a key is configured, and NO mutation runs", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "gag-key-abc");
    const runMutation = vi.fn();
    const req = jsonRequest("http://localhost/gag-ledger-ingest", {
      op: "propose",
      profileId: "personal",
      text: "the printer incident",
    });
    const res = await (gagLedgerIngest as any)._handler(
      makeCtx(makeFakeDb(), { now: NOW }, { runMutation }),
      req
    );
    expect(res.status).toBe(401);
    expect(runMutation).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("fails CLOSED when ASTRIDR_INGEST_API_KEY is unset", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    const req = jsonRequest("http://localhost/gag-ledger-ingest", { op: "list", profileId: "personal" });
    const res = await (gagLedgerIngest as any)._handler(makeCtx(makeFakeDb(), { now: NOW }), req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 400 when op is missing", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest("http://localhost/gag-ledger-ingest", {}, { Authorization: "Bearer k" });
    const res = await (gagLedgerIngest as any)._handler(makeCtx(makeFakeDb(), { now: NOW }), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 for an unknown op", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/gag-ledger-ingest",
      { op: "delete", id: "abc" },
      { Authorization: "Bearer k" }
    );
    const res = await (gagLedgerIngest as any)._handler(makeCtx(makeFakeDb(), { now: NOW }), req);
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toContain("Unknown op");
    vi.unstubAllEnvs();
  });

  it("returns 400 (not 500) when the mutation throws", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const runMutation = vi.fn().mockRejectedValue(new Error("boom"));
    const req = jsonRequest(
      "http://localhost/gag-ledger-ingest",
      { op: "propose", profileId: "personal", text: "x" },
      { Authorization: "Bearer k" }
    );
    const res = await (gagLedgerIngest as any)._handler(
      makeCtx(makeFakeDb(), { now: NOW }, { runMutation }),
      req
    );
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // D-21/T-189-44: propose can only ever create a "proposed" row, and
  // source is always hardcoded "astridr" — a caller cannot self-confirm or
  // forge provenance no matter what the body says.
  // -------------------------------------------------------------------------

  it("returns 400 for propose without profileId/text", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/gag-ledger-ingest",
      { op: "propose", profileId: "personal" },
      { Authorization: "Bearer k" }
    );
    const res = await (gagLedgerIngest as any)._handler(makeCtx(makeFakeDb(), { now: NOW }), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("propose with status:'confirmed' in the body still stores 'proposed' — the caller cannot self-confirm", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    const req = jsonRequest(
      "http://localhost/gag-ledger-ingest",
      { op: "propose", profileId: "personal", text: "the printer incident", status: "confirmed" },
      { Authorization: "Bearer k" }
    );
    const res = await (gagLedgerIngest as any)._handler(makeCtx(db, { now: NOW }), req);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.gag.status).toBe("proposed");
    const stored = Array.from(db.rows.values())[0] as any;
    expect(stored.status).toBe("proposed");
    vi.unstubAllEnvs();
  });

  it("propose with source:'dashboard' in the body still stores 'astridr' — server hardcodes source", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    const req = jsonRequest(
      "http://localhost/gag-ledger-ingest",
      { op: "propose", profileId: "personal", text: "the printer incident", source: "dashboard" },
      { Authorization: "Bearer k" }
    );
    const res = await (gagLedgerIngest as any)._handler(makeCtx(db, { now: NOW }), req);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.gag.source).toBe("astridr");
    const stored = Array.from(db.rows.values())[0] as any;
    expect(stored.source).toBe("astridr");
    vi.unstubAllEnvs();
  });

  it("confirm flips proposed -> confirmed and stamps confirmedAt", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    const proposeRes = await (gagLedgerIngest as any)._handler(
      makeCtx(db, { now: NOW }),
      jsonRequest(
        "http://localhost/gag-ledger-ingest",
        { op: "propose", profileId: "personal", text: "the printer incident" },
        { Authorization: "Bearer k" }
      )
    );
    const proposed = (await readJson(proposeRes)).gag;

    const confirmRes = await (gagLedgerIngest as any)._handler(
      makeCtx(db, { now: NOW }),
      jsonRequest(
        "http://localhost/gag-ledger-ingest",
        { op: "confirm", id: proposed._id },
        { Authorization: "Bearer k" }
      )
    );
    expect(confirmRes.status).toBe(200);
    const confirmed = (await readJson(confirmRes)).gag;
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.confirmedAt).toBe(NOW);
    vi.unstubAllEnvs();
  });

  it("confirming an already-confirmed entry is a no-op, not an error", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    const proposed = (
      await readJson(
        await (gagLedgerIngest as any)._handler(
          makeCtx(db, { now: NOW }),
          jsonRequest(
            "http://localhost/gag-ledger-ingest",
            { op: "propose", profileId: "personal", text: "x" },
            { Authorization: "Bearer k" }
          )
        )
      )
    ).gag;
    await (gagLedgerIngest as any)._handler(
      makeCtx(db, { now: NOW }),
      jsonRequest(
        "http://localhost/gag-ledger-ingest",
        { op: "confirm", id: proposed._id },
        { Authorization: "Bearer k" }
      )
    );
    // second confirm, later clock — must NOT move confirmedAt again.
    const secondRes = await (gagLedgerIngest as any)._handler(
      makeCtx(db, { now: NOW + 500 }),
      jsonRequest(
        "http://localhost/gag-ledger-ingest",
        { op: "confirm", id: proposed._id },
        { Authorization: "Bearer k" }
      )
    );
    expect(secondRes.status).toBe(200);
    const row = db.rows.get(proposed._id);
    expect(row.confirmedAt).toBe(NOW);
    vi.unstubAllEnvs();
  });

  it("retiring an entry means it is never eligible again", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    db.rows.set("g-retired", {
      _id: "g-retired",
      profileId: "personal",
      text: "old bit",
      status: "confirmed",
      source: "astridr",
      proposedAt: NOW - 100,
      useCount: 0,
    });
    const retireRes = await (gagLedgerIngest as any)._handler(
      makeCtx(db, { now: NOW }),
      jsonRequest(
        "http://localhost/gag-ledger-ingest",
        { op: "retire", id: "g-retired" },
        { Authorization: "Bearer k" }
      )
    );
    expect(retireRes.status).toBe(200);
    expect((await readJson(retireRes)).gag.status).toBe("retired");
    expect(db.rows.get("g-retired").retiredAt).toBe(NOW);
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // T-189-46: eligible is index-bounded (by_last_used) and discriminates in
  // both directions — all five cases from the plan's acceptance criteria.
  // -------------------------------------------------------------------------

  it("eligible excludes proposed/retired/cooldown/stale, includes confirmed+cool+fresh — all five cases", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    const cooldownSeconds = 3600;
    const stalenessSeconds = 86400;

    db.rows.set("g-proposed", {
      _id: "g-proposed",
      profileId: "personal",
      text: "not yet confirmed",
      status: "proposed",
      source: "astridr",
      proposedAt: NOW - 100,
      useCount: 0,
    });
    db.rows.set("g-retired", {
      _id: "g-retired",
      profileId: "personal",
      text: "retired bit",
      status: "retired",
      source: "astridr",
      proposedAt: NOW - 100,
      useCount: 0,
    });
    db.rows.set("g-cooldown", {
      _id: "g-cooldown",
      profileId: "personal",
      text: "used recently",
      status: "confirmed",
      source: "astridr",
      proposedAt: NOW - 100,
      lastUsedAt: NOW - 10, // well within the 3600s cooldown
      useCount: 1,
    });
    db.rows.set("g-stale", {
      _id: "g-stale",
      profileId: "personal",
      text: "proposed too long ago",
      status: "confirmed",
      source: "astridr",
      proposedAt: NOW - stalenessSeconds - 100, // past the staleness horizon
      useCount: 0,
    });
    db.rows.set("g-eligible", {
      _id: "g-eligible",
      profileId: "personal",
      text: "the printer incident",
      status: "confirmed",
      source: "astridr",
      proposedAt: NOW - 1000, // fresh
      lastUsedAt: NOW - 7200, // cool — outside the 3600s cooldown
      useCount: 3,
    });

    const req = jsonRequest(
      "http://localhost/gag-ledger-ingest",
      { op: "eligible", profileId: "personal", cooldownSeconds, stalenessSeconds },
      { Authorization: "Bearer k" }
    );
    const res = await (gagLedgerIngest as any)._handler(makeCtx(db, { now: NOW }), req);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    const ids = body.gags.map((g: any) => g._id);
    expect(ids).toEqual(["g-eligible"]);
    vi.unstubAllEnvs();
  });

  it("markUsed then eligible returns empty for that entry, then advancing the clock past the cooldown returns it again", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    const cooldownSeconds = 3600;
    const stalenessSeconds = 86400;
    db.rows.set("g-1", {
      _id: "g-1",
      profileId: "personal",
      text: "the printer incident",
      status: "confirmed",
      source: "astridr",
      proposedAt: NOW - 1000,
      useCount: 0,
    });

    const clockRef = { now: NOW };

    // markUsed stamps lastUsedAt = NOW.
    const markRes = await (gagLedgerIngest as any)._handler(
      makeCtx(db, clockRef),
      jsonRequest(
        "http://localhost/gag-ledger-ingest",
        { op: "markUsed", id: "g-1" },
        { Authorization: "Bearer k" }
      )
    );
    expect(markRes.status).toBe(200);
    expect((await readJson(markRes)).gag.useCount).toBe(1);

    // Immediately after: still within cooldown -> excluded.
    const eligibleDuring = await (gagLedgerIngest as any)._handler(
      makeCtx(db, clockRef),
      jsonRequest(
        "http://localhost/gag-ledger-ingest",
        { op: "eligible", profileId: "personal", cooldownSeconds, stalenessSeconds },
        { Authorization: "Bearer k" }
      )
    );
    expect((await readJson(eligibleDuring)).gags).toHaveLength(0);

    // Advance the clock past the cooldown window.
    clockRef.now = NOW + cooldownSeconds + 1;
    const eligibleAfter = await (gagLedgerIngest as any)._handler(
      makeCtx(db, clockRef),
      jsonRequest(
        "http://localhost/gag-ledger-ingest",
        { op: "eligible", profileId: "personal", cooldownSeconds, stalenessSeconds },
        { Authorization: "Bearer k" }
      )
    );
    const afterBody = await readJson(eligibleAfter);
    expect(afterBody.gags).toHaveLength(1);
    expect(afterBody.gags[0]._id).toBe("g-1");
    vi.unstubAllEnvs();
  });

  it("returns 400 for eligible missing cooldownSeconds/stalenessSeconds", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const req = jsonRequest(
      "http://localhost/gag-ledger-ingest",
      { op: "eligible", profileId: "personal" },
      { Authorization: "Bearer k" }
    );
    const res = await (gagLedgerIngest as any)._handler(makeCtx(makeFakeDb(), { now: NOW }), req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("list returns every entry for a profile regardless of status", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "k");
    const db = makeFakeDb();
    db.rows.set("g-1", { _id: "g-1", profileId: "personal", status: "proposed", text: "a", source: "astridr", proposedAt: NOW, useCount: 0 });
    db.rows.set("g-2", { _id: "g-2", profileId: "personal", status: "confirmed", text: "b", source: "astridr", proposedAt: NOW, useCount: 0 });
    db.rows.set("g-3", { _id: "g-3", profileId: "other-profile", status: "confirmed", text: "c", source: "astridr", proposedAt: NOW, useCount: 0 });
    const req = jsonRequest(
      "http://localhost/gag-ledger-ingest",
      { op: "list", profileId: "personal" },
      { Authorization: "Bearer k" }
    );
    const res = await (gagLedgerIngest as any)._handler(makeCtx(db, { now: NOW }), req);
    const body = await readJson(res);
    expect(body.gags).toHaveLength(2);
    vi.unstubAllEnvs();
  });
});
