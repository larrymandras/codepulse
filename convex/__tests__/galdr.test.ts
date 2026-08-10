/**
 * Phase 116 (Galdr Prompt Library), plan 116-03 — row-level assertions for
 * D-05, D-06, D-14, D-15, D-16 against an in-memory fake `ctx.db`.
 *
 * `convex-test` is deliberately NOT installed in this repo (see
 * `convex/reminders.test.ts:140`); the handler-extraction + fake-db pattern
 * this file follows is the established substitute, driving the `*Handler`
 * functions exported from `convex/galdr.ts` directly.
 *
 * Every assertion here reads STORED ROWS out of the fake, never source text
 * — a guard that only exists in a comment cannot fail this suite.
 */
import { describe, it, expect } from "vitest";
import {
  PROMPT_VERSION_CAP,
  listHandler,
  lookupHandler,
  listVersionsHandler,
  createPromptHandler,
  updatePromptHandler,
  restoreVersionHandler,
  archivePromptHandler,
  recordUsageHandler,
} from "../galdr";

// ---------------------------------------------------------------------------
// makeFakeDb — adapted from convex/reminders.test.ts:146-192, with two
// required changes for Galdr:
//   - TABLE-AWARE: one Map per table name, so a `promptVersions` count
//     assertion can never silently include `prompts` rows (or vice versa).
//   - ORDERABLE: the object returned by withIndex(...) supports
//     .order("asc" | "desc") before .collect()/.first(), ordering by
//     insertion sequence via a monotonically increasing `_creationTime`.
//     `pruneVersions` (convex/galdr.ts) depends on `.order("desc")`.
// ---------------------------------------------------------------------------

function makeFakeDb() {
  let idCounter = 0;
  let creationCounter = 0;
  const tables = new Map<string, Map<string, any>>();

  function tableMap(name: string): Map<string, any> {
    let m = tables.get(name);
    if (!m) {
      m = new Map();
      tables.set(name, m);
    }
    return m;
  }

  function findAnyTable(id: string): Map<string, any> | null {
    for (const m of tables.values()) {
      if (m.has(id)) return m;
    }
    return null;
  }

  function makeResult(rows: any[]): {
    collect: () => Promise<any[]>;
    first: () => Promise<any | null>;
    order: (direction: "asc" | "desc") => ReturnType<typeof makeResult>;
  } {
    return {
      collect: async () => rows,
      first: async () => rows[0] ?? null,
      order(direction: "asc" | "desc") {
        const sorted = [...rows].sort((a, b) =>
          direction === "desc"
            ? b._creationTime - a._creationTime
            : a._creationTime - b._creationTime
        );
        return makeResult(sorted);
      },
    };
  }

  return {
    tables,
    async insert(table: string, doc: Record<string, unknown>) {
      const id = `id_${idCounter++}`;
      const _creationTime = creationCounter++;
      tableMap(table).set(id, { _id: id, _creationTime, ...doc });
      return id;
    },
    async get(id: string) {
      const m = findAnyTable(id);
      return m ? m.get(id) : null;
    },
    async patch(id: string, patch: Record<string, unknown>) {
      const m = findAnyTable(id);
      if (m) m.set(id, { ...m.get(id), ...patch });
    },
    async delete(id: string) {
      const m = findAnyTable(id);
      if (m) m.delete(id);
    },
    query(table: string) {
      const list = () => Array.from(tableMap(table).values());
      return {
        collect: async () => list(),
        first: async () => list()[0] ?? null,
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
          return makeResult(filtered);
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Harness liveness — MUST run first. Without this, every count assertion
// below could pass vacuously against a broken (non-table-aware) fake.
// ---------------------------------------------------------------------------

describe("makeFakeDb harness liveness", () => {
  it("is table-aware: promptVersions rows never leak into a prompts count or vice versa", async () => {
    const db = makeFakeDb();
    await db.insert("prompts", { title: "A" });
    await db.insert("prompts", { title: "B" });
    await db.insert("promptVersions", { promptId: "whatever", body: "v1", savedAt: 1 });

    const promptRows = await db.query("prompts").collect();
    const versionRows = await db.query("promptVersions").collect();
    expect(promptRows).toHaveLength(2);
    expect(versionRows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// D-06 — slug collision on save is refused, never overwritten
// ---------------------------------------------------------------------------

describe("D-06 slug collision", () => {
  it("refuses a second create with the same derived slug, leaving the prompts row count and stored body unchanged", async () => {
    const db = makeFakeDb();
    const firstId = await createPromptHandler(
      { db },
      { title: "Competitor Analysis", body: "Analyze {{company}}", category: "research" },
      1000
    );
    const countBefore = (await db.query("prompts").collect()).length;
    const bodyBefore = (await db.get(firstId)).body;

    let caught: any = null;
    try {
      await createPromptHandler(
        { db },
        { title: "Competitor Analysis", body: "OVERWRITE ATTEMPT", category: "research" },
        2000
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught.data.code).toBe("SLUG_COLLISION");

    const countAfter = (await db.query("prompts").collect()).length;
    expect(countAfter).toBe(countBefore);
    expect((await db.get(firstId)).body).toBe(bodyBefore);
  });

  it("collides on a differently-typed title that slugifies identically, and the error carries the existing title/updatedAt", async () => {
    const db = makeFakeDb();
    const firstId = await createPromptHandler(
      { db },
      { title: "Competitor Analysis", body: "v1", category: "research" },
      1000
    );
    const stored = await db.get(firstId);

    let caught: any = null;
    try {
      await createPromptHandler(
        { db },
        { title: "competitor analysis", body: "v2", category: "research" },
        2000
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught.data.code).toBe("SLUG_COLLISION");
    expect(caught.data.existingTitle).toBe(stored.title);
    expect(caught.data.existingUpdatedAt).toBe(stored.updatedAt);
  });

  it("rejects an all-punctuation title with EMPTY_SLUG", async () => {
    const db = makeFakeDb();
    let caught: any = null;
    try {
      await createPromptHandler(
        { db },
        { title: "!!! --- ???", body: "x", category: "misc" },
        1000
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught.data.code).toBe("EMPTY_SLUG");
  });
});

// ---------------------------------------------------------------------------
// D-14 — promptVersions capped at PROMPT_VERSION_CAP newest rows per prompt
// ---------------------------------------------------------------------------

describe("D-14 count cap", () => {
  it("caps at PROMPT_VERSION_CAP, keeps only the newest rows, and never sweeps a second prompt's versions", async () => {
    const db = makeFakeDb();

    // Isolation control: created (and given 3 versions) BEFORE the main
    // prompt's 25-update loop runs, so we can prove the prune is scoped to
    // one promptId and never becomes a table sweep.
    const controlId = await createPromptHandler(
      { db },
      { title: "Control Prompt", body: "control v0", category: "misc" },
      100
    );
    await updatePromptHandler({ db }, { promptId: controlId, body: "control v1" }, 200);
    await updatePromptHandler({ db }, { promptId: controlId, body: "control v2" }, 300);

    const promptId = await createPromptHandler(
      { db },
      { title: "Versioned Prompt", body: "body 0", category: "misc" },
      1000
    );

    for (let i = 1; i <= 25; i++) {
      await updatePromptHandler({ db }, { promptId, body: `body ${i}` }, 1000 + i);
    }

    const versions = await listVersionsHandler({ db }, promptId);
    expect(versions).toHaveLength(PROMPT_VERSION_CAP);

    // 26 total writes (1 create + 25 updates) => newest PROMPT_VERSION_CAP
    // survive => oldest surviving is write number (26 - PROMPT_VERSION_CAP).
    const oldestSurvivingUpdateNumber = 26 - PROMPT_VERSION_CAP;
    const survivingBodies = versions.map((v: any) => v.body);
    expect(survivingBodies).not.toContain("body 0");
    expect(survivingBodies).toContain(`body ${oldestSurvivingUpdateNumber}`);
    expect(survivingBodies).not.toContain(`body ${oldestSurvivingUpdateNumber - 1}`);

    const controlVersions = await listVersionsHandler({ db }, controlId);
    expect(controlVersions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// D-15 — every body-changing write appends exactly one snapshot; restore
// appends forward rather than rewinding
// ---------------------------------------------------------------------------

describe("D-15 append-only versions", () => {
  it("a same-body update appends nothing", async () => {
    const db = makeFakeDb();
    const promptId = await createPromptHandler(
      { db },
      { title: "Same Body", body: "unchanged", category: "misc" },
      1000
    );
    const before = (await listVersionsHandler({ db }, promptId)).length;
    await updatePromptHandler({ db }, { promptId, body: "unchanged" }, 2000);
    const after = (await listVersionsHandler({ db }, promptId)).length;
    expect(after).toBe(before);
  });

  it("a title-only update appends nothing", async () => {
    const db = makeFakeDb();
    const promptId = await createPromptHandler(
      { db },
      { title: "Title Only", body: "body", category: "misc" },
      1000
    );
    const before = (await listVersionsHandler({ db }, promptId)).length;
    await updatePromptHandler({ db }, { promptId, title: "New Title" }, 2000);
    const after = (await listVersionsHandler({ db }, promptId)).length;
    expect(after).toBe(before);
  });

  it("restoreVersion appends exactly one snapshot, sets the prompt body, and leaves the restored-from row in place", async () => {
    const db = makeFakeDb();
    const promptId = await createPromptHandler(
      { db },
      { title: "Restorable", body: "v0", category: "misc" },
      1000
    );
    await updatePromptHandler({ db }, { promptId, body: "v1" }, 2000);

    const versionsBeforeRestore = await listVersionsHandler({ db }, promptId);
    const v0Version = versionsBeforeRestore.find((v: any) => v.body === "v0");
    expect(v0Version).toBeDefined();
    const countBefore = versionsBeforeRestore.length;

    await restoreVersionHandler({ db }, { promptId, versionId: v0Version._id }, 3000);

    const versionsAfter = await listVersionsHandler({ db }, promptId);
    expect(versionsAfter.length).toBe(countBefore + 1);

    const prompt = await db.get(promptId);
    expect(prompt.body).toBe("v0");

    const restoredFromStillPresent = versionsAfter.some((v: any) => v._id === v0Version._id);
    expect(restoredFromStillPresent).toBe(true);
  });

  it("rejects restoring a versionId that belongs to a different prompt, and changes neither prompt's body", async () => {
    const db = makeFakeDb();
    const promptA = await createPromptHandler(
      { db },
      { title: "Prompt A", body: "a-body", category: "misc" },
      1000
    );
    const promptB = await createPromptHandler(
      { db },
      { title: "Prompt B", body: "b-body", category: "misc" },
      1000
    );
    const versionsA = await listVersionsHandler({ db }, promptA);

    let caught: any = null;
    try {
      await restoreVersionHandler(
        { db },
        { promptId: promptB, versionId: versionsA[0]._id },
        2000
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught.data.code).toBe("NOT_FOUND");
    expect((await db.get(promptA)).body).toBe("a-body");
    expect((await db.get(promptB)).body).toBe("b-body");
  });
});

// ---------------------------------------------------------------------------
// D-16 — archive hides from list/lookup; versions untouched
// ---------------------------------------------------------------------------

describe("D-16 archive", () => {
  it("archivePrompt hides the row from list and lookup while a control prompt stays visible; versions are untouched", async () => {
    const db = makeFakeDb();
    const archivedId = await createPromptHandler(
      { db },
      { title: "Archive Me", body: "body", category: "misc" },
      1000
    );
    const controlId = await createPromptHandler(
      { db },
      { title: "Stay Visible", body: "body", category: "misc" },
      1000
    );
    const archivedSlug = (await db.get(archivedId)).slug;
    const versionCountBefore = (await listVersionsHandler({ db }, archivedId)).length;

    await archivePromptHandler({ db }, { promptId: archivedId }, 2000);

    expect((await db.get(archivedId)).archived).toBe(true);

    const list = await listHandler({ db });
    expect(list.some((p: any) => p._id === archivedId)).toBe(false);
    expect(list.some((p: any) => p._id === controlId)).toBe(true);

    const archivedLookup = await lookupHandler({ db }, "Archive Me");
    expect(archivedLookup.match).toBeNull();
    expect(archivedLookup.candidates.some((c: any) => c.slug === archivedSlug)).toBe(false);

    const controlLookup = await lookupHandler({ db }, "Stay Visible");
    expect(controlLookup.match).not.toBeNull();

    const versionCountAfter = (await listVersionsHandler({ db }, archivedId)).length;
    expect(versionCountAfter).toBe(versionCountBefore);
  });
});

// ---------------------------------------------------------------------------
// D-05 — a fuzzy lookup never auto-injects
// ---------------------------------------------------------------------------

describe("D-05 fuzzy lookup never auto-injects", () => {
  it("an exact slug query returns a non-null match whose body is present", async () => {
    const db = makeFakeDb();
    await createPromptHandler(
      { db },
      { title: "Exact Match Prompt", body: "the real body {{x}}", category: "misc" },
      1000
    );
    const result = await lookupHandler({ db }, "Exact Match Prompt");
    expect(result.match).not.toBeNull();
    expect(result.match!.body).toBe("the real body {{x}}");
  });

  it("a partial-word query that hits exactly one prompt returns match: null and one candidate", async () => {
    const db = makeFakeDb();
    await createPromptHandler(
      { db },
      { title: "Unique Widget Prompt", body: "body", category: "misc" },
      1000
    );
    const result = await lookupHandler({ db }, "widget");
    expect(result.match).toBeNull();
    expect(result.candidates).toHaveLength(1);
  });

  it("a candidate object never carries a body key", async () => {
    const db = makeFakeDb();
    await createPromptHandler(
      { db },
      { title: "Sensitive Body Prompt", body: "SECRET BODY", category: "misc" },
      1000
    );
    const result = await lookupHandler({ db }, "sensitive");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).not.toHaveProperty("body");
    expect(Object.keys(result.candidates[0]).sort()).toEqual(
      ["category", "slug", "title", "usageCount"].sort()
    );
  });

  it("candidates are capped at 10 when 12 prompts match", async () => {
    const db = makeFakeDb();
    for (let i = 0; i < 12; i++) {
      await createPromptHandler(
        { db },
        { title: `Shared Keyword Prompt ${i}`, body: "body", category: "misc" },
        1000 + i
      );
    }
    const result = await lookupHandler({ db }, "shared keyword");
    expect(result.match).toBeNull();
    expect(result.candidates).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// recordUsage — bumps usageCount/lastUsedAt only, never updatedAt, never a
// version
// ---------------------------------------------------------------------------

describe("recordUsage", () => {
  it("increments usageCount and sets lastUsedAt, leaving updatedAt and the version count unchanged", async () => {
    const db = makeFakeDb();
    const promptId = await createPromptHandler(
      { db },
      { title: "Usage Prompt", body: "body", category: "misc" },
      1000
    );
    const before = await db.get(promptId);
    const versionsBefore = (await listVersionsHandler({ db }, promptId)).length;

    await recordUsageHandler({ db }, { slug: before.slug }, 5000);

    const after = await db.get(promptId);
    expect(after.usageCount).toBe(1);
    expect(after.lastUsedAt).toBe(5000);
    expect(after.updatedAt).toBe(before.updatedAt);

    const versionsAfter = (await listVersionsHandler({ db }, promptId)).length;
    expect(versionsAfter).toBe(versionsBefore);
  });

  it("is a no-op for a slug that does not exist — throws nothing, mutates no row", async () => {
    const db = makeFakeDb();
    await createPromptHandler(
      { db },
      { title: "Only Prompt", body: "body", category: "misc" },
      1000
    );
    const beforeCount = (await db.query("prompts").collect()).length;

    await recordUsageHandler({ db }, { slug: "does-not-exist" }, 2000);

    const afterCount = (await db.query("prompts").collect()).length;
    expect(afterCount).toBe(beforeCount);
  });
});
