/**
 * bifrost.ts — link ordering (Phase 117).
 *
 * `compareLinks` is the only real logic in the module; everything else is a
 * db call. Its subtle rule is that an ABSENT `order` must sort after every
 * explicit one. Coercing `undefined` to 0 — the obvious-looking
 * `a.order ?? 0` — would make a never-ordered link leap to the front of its
 * category, which reads as a reordering bug rather than a default.
 */
import { describe, test, expect } from "vitest";
import { compareLinks, recordOpenHandler, createLinkHandler } from "../bifrost";

type L = { title: string; pinned?: boolean; order?: number; createdAt: number };

const sortTitles = (links: L[]) =>
  [...links].sort(compareLinks).map((l) => l.title);

describe("compareLinks", () => {
  test("pinned links come first regardless of order or age", () => {
    const links: L[] = [
      { title: "plain", order: 0, createdAt: 100 },
      { title: "pinned", pinned: true, order: 99, createdAt: 1 },
    ];
    expect(sortTitles(links)).toEqual(["pinned", "plain"]);
  });

  test("explicit order ascending within the same pinned state", () => {
    const links: L[] = [
      { title: "third", order: 3, createdAt: 1 },
      { title: "first", order: 1, createdAt: 1 },
      { title: "second", order: 2, createdAt: 1 },
    ];
    expect(sortTitles(links)).toEqual(["first", "second", "third"]);
  });

  test("an absent order sorts AFTER every explicit one, never as 0", () => {
    const links: L[] = [
      { title: "unordered", createdAt: 500 },
      { title: "ordered-5", order: 5, createdAt: 1 },
      { title: "ordered-0", order: 0, createdAt: 1 },
    ];
    expect(sortTitles(links)).toEqual(["ordered-0", "ordered-5", "unordered"]);
  });

  test("ties break on newest createdAt", () => {
    const links: L[] = [
      { title: "older", order: 1, createdAt: 100 },
      { title: "newer", order: 1, createdAt: 200 },
    ];
    expect(sortTitles(links)).toEqual(["newer", "older"]);
  });

  test("two unordered links still tie-break on newest, not arbitrarily", () => {
    const links: L[] = [
      { title: "older", createdAt: 100 },
      { title: "newer", createdAt: 200 },
    ];
    expect(sortTitles(links)).toEqual(["newer", "older"]);
  });

  test("pinned + unordered still beats unpinned + ordered", () => {
    const links: L[] = [
      { title: "unpinned-first", order: 0, createdAt: 999 },
      { title: "pinned-unordered", pinned: true, createdAt: 1 },
    ];
    expect(sortTitles(links)).toEqual(["pinned-unordered", "unpinned-first"]);
  });
});

// ---------------------------------------------------------------------------
// recordOpen — usage tracking that feeds the palette's launcher ranking.
//
// Assertions read STORED ROWS out of an in-memory fake `ctx.db`, following the
// handler-extraction pattern convex/__tests__/galdr.test.ts established
// (`convex-test` is deliberately not installed in this repo). Only get/patch
// are exercised, so the fake is a fraction of Galdr's table-aware one.
// ---------------------------------------------------------------------------

function makeFakeDb(seed: Record<string, any> = {}) {
  const rows = new Map<string, any>(Object.entries(seed));
  return {
    rows,
    async get(id: string) {
      return rows.get(id) ?? null;
    },
    async patch(id: string, patch: Record<string, unknown>) {
      const existing = rows.get(id);
      if (existing) rows.set(id, { ...existing, ...patch });
    },
  };
}

const NOW = 1_700_000_000_000;

function linkRow(over: Record<string, any> = {}) {
  return {
    _id: "link_1",
    title: "Ástríðr API",
    url: "http://localhost:8181",
    category: "local services",
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

describe("recordOpenHandler", () => {
  test("an absent usageCount starts at 1, not NaN", async () => {
    const db = makeFakeDb({ link_1: linkRow() });
    await recordOpenHandler({ db } as any, "link_1", NOW);
    expect(db.rows.get("link_1").usageCount).toBe(1);
  });

  test("an existing count increments", async () => {
    const db = makeFakeDb({ link_1: linkRow({ usageCount: 41 }) });
    await recordOpenHandler({ db } as any, "link_1", NOW);
    expect(db.rows.get("link_1").usageCount).toBe(42);
  });

  test("lastUsedAt is stamped with the supplied clock", async () => {
    const db = makeFakeDb({ link_1: linkRow() });
    await recordOpenHandler({ db } as any, "link_1", NOW);
    expect(db.rows.get("link_1").lastUsedAt).toBe(NOW);
  });

  test("updatedAt is NOT touched — an open is not an edit", async () => {
    const db = makeFakeDb({ link_1: linkRow({ updatedAt: 1 }) });
    await recordOpenHandler({ db } as any, "link_1", NOW);
    const row = db.rows.get("link_1");
    // The control: the write DID land, so an unchanged updatedAt is a
    // deliberate omission rather than a patch that silently never happened.
    expect(row.usageCount).toBe(1);
    expect(row.updatedAt).toBe(1);
  });

  test("a missing link is a no-op, not a throw", async () => {
    const db = makeFakeDb({ link_1: linkRow() });
    await expect(
      recordOpenHandler({ db } as any, "link_gone", NOW)
    ).resolves.toBeUndefined();
    expect(db.rows.get("link_1").usageCount).toBeUndefined();
  });

  test("an archived link is never counted", async () => {
    const db = makeFakeDb({ link_1: linkRow({ archived: true, usageCount: 5 }) });
    await recordOpenHandler({ db } as any, "link_1", NOW);
    expect(db.rows.get("link_1").usageCount).toBe(5);
    expect(db.rows.get("link_1").lastUsedAt).toBeUndefined();
  });

  test("archived:false is a live link and IS counted", async () => {
    // Control for the case above: proves the guard keys on the archived FLAG
    // and not merely on the field's presence.
    const db = makeFakeDb({ link_1: linkRow({ archived: false }) });
    await recordOpenHandler({ db } as any, "link_1", NOW);
    expect(db.rows.get("link_1").usageCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// createLink — idempotent by normalized URL.
//
// This is what makes a repeated `apply` safe, and unlike the scanner's
// check-then-write it also holds under concurrency: the lookup and the insert
// happen inside one transactional Convex mutation.
// ---------------------------------------------------------------------------

function makeCreateDb(seed: any[] = []) {
  let n = 0;
  const rows = new Map<string, any>();
  for (const r of seed) rows.set(r._id, r);
  return {
    rows,
    async insert(_table: string, doc: Record<string, unknown>) {
      const id = `new_${n++}`;
      rows.set(id, { _id: id, ...doc });
      return id;
    },
    async get(id: string) {
      return rows.get(id) ?? null;
    },
    async patch(id: string, patch: Record<string, unknown>) {
      const e = rows.get(id);
      if (e) rows.set(id, { ...e, ...patch });
    },
    query(_table: string) {
      return { collect: async () => Array.from(rows.values()) };
    },
  };
}

const CREATE_ARGS = {
  title: "Convex backend",
  url: "http://localhost:3210",
  category: "infrastructure",
};

describe("createLinkHandler — idempotency", () => {
  test("a fresh hub inserts", async () => {
    const db = makeCreateDb();
    const id = await createLinkHandler({ db } as any, CREATE_ARGS, NOW);
    expect(db.rows.size).toBe(1);
    expect(db.rows.get(id).url).toBe("http://localhost:3210");
  });

  test("adding the same URL twice writes ONE row and returns the same id", async () => {
    const db = makeCreateDb();
    const first = await createLinkHandler({ db } as any, CREATE_ARGS, NOW);
    const second = await createLinkHandler({ db } as any, CREATE_ARGS, NOW + 5);
    expect(second).toBe(first);
    expect(db.rows.size).toBe(1);
  });

  test("it RETURNS rather than throws — the Add-link dialog has no error path", async () => {
    const db = makeCreateDb();
    await createLinkHandler({ db } as any, CREATE_ARGS, NOW);
    await expect(
      createLinkHandler({ db } as any, CREATE_ARGS, NOW + 5)
    ).resolves.toBeTruthy();
  });

  test("matching is by NORMALIZED url, not the raw string", async () => {
    const db = makeCreateDb();
    const first = await createLinkHandler({ db } as any, CREATE_ARGS, NOW);
    // Same destination, three different spellings.
    for (const url of [
      "http://127.0.0.1:3210",
      "http://localhost:3210/",
      "https://localhost:3210",
    ]) {
      const again = await createLinkHandler(
        { db } as any,
        { ...CREATE_ARGS, url },
        NOW + 5
      );
      expect(again).toBe(first);
    }
    expect(db.rows.size).toBe(1);
  });

  test("a DIFFERENT url still inserts — control", async () => {
    // Without this the handler could return the first row for everything and
    // satisfy every assertion above.
    const db = makeCreateDb();
    await createLinkHandler({ db } as any, CREATE_ARGS, NOW);
    await createLinkHandler(
      { db } as any,
      { ...CREATE_ARGS, url: "http://localhost:3211" },
      NOW + 5
    );
    expect(db.rows.size).toBe(2);
  });

  test("an ARCHIVED link does not suppress a re-add", async () => {
    // Archiving is an explicit "remove this"; adding the URL again later is new
    // intent, and must not silently resurrect the old row's stale title.
    const db = makeCreateDb([
      {
        _id: "old",
        title: "Stale name",
        url: "http://localhost:3210",
        category: "old",
        archived: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    const id = await createLinkHandler({ db } as any, CREATE_ARGS, NOW);
    expect(id).not.toBe("old");
    expect(db.rows.size).toBe(2);
    expect(db.rows.get(id).title).toBe("Convex backend");
  });

  test("an existing row is never mutated by a duplicate add", async () => {
    const db = makeCreateDb();
    const first = await createLinkHandler({ db } as any, CREATE_ARGS, NOW);
    const before = { ...db.rows.get(first) };
    await createLinkHandler(
      { db } as any,
      { title: "Totally different name", url: "http://localhost:3210/", category: "x" },
      NOW + 999
    );
    expect(db.rows.get(first)).toEqual(before);
  });

  test("still rejects an empty title or url", async () => {
    const db = makeCreateDb();
    await expect(
      createLinkHandler({ db } as any, { ...CREATE_ARGS, title: "  " }, NOW)
    ).rejects.toThrow("MISSING_TITLE");
    await expect(
      createLinkHandler({ db } as any, { ...CREATE_ARGS, url: "  " }, NOW)
    ).rejects.toThrow("MISSING_URL");
  });
});
