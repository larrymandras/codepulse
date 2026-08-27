/**
 * loom.test.ts — coverage for the Loom curated-pipelines domain module.
 *
 * One of the three gaps recorded in
 * `.planning/milestones/v14.0-phases/119-loom-curated-pipelines/119-VALIDATION.md`.
 * `loomHttp.test.ts` already covers the bearer gate on the HTTP route; this
 * covers the module the route calls.
 *
 * `loom.ts` deliberately splits every operation into a plain exported handler
 * plus a thin query/mutation wrapper (mirroring `galdr.ts`), so the handlers
 * test directly without the Convex runtime. The fake db below models the two
 * index semantics the handlers actually depend on:
 *   - `by_slug` is ["slug"], so `.first()` after an `eq` is a point lookup.
 *   - `by_pipelineSlug` is ["pipelineSlug"] (schema.ts:2493), so `.order("desc")`
 *     within it orders by _creationTime descending — i.e. reverse insertion
 *     order. `recordStepEventHandler`'s "newest run" depends on exactly that,
 *     so the fake must reproduce it rather than sorting by `startedAt`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  isLoomEvent,
  appendBounded,
  deriveStatus,
  listPipelinesHandler,
  listRunsHandler,
  upsertPipelineHandler,
  recordStepEventHandler,
  LOOM_EVENTS,
  LOOM_STEP_EVENT_CAP,
} from "./loom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// Fake db
// ============================================================

interface FakeDb {
  db: any;
  tables: Record<string, any[]>;
  takes: number[];
}

function makeDb(seed: Partial<Record<string, any[]>> = {}): FakeDb {
  const tables: Record<string, any[]> = {
    pipelines: [...(seed.pipelines ?? [])],
    pipelineRuns: [...(seed.pipelineRuns ?? [])],
  };
  const takes: number[] = [];
  let idCounter = 0;

  const db = {
    query(table: string) {
      let rows = () => tables[table] ?? [];
      let descending = false;
      const eqs: Array<[string, unknown]> = [];

      const chain: any = {
        withIndex(_index: string, cb?: (q: any) => any) {
          if (cb) {
            const q: any = {};
            for (const op of ["eq", "gte", "gt", "lte", "lt"]) {
              q[op] = (field: string, value: unknown) => {
                if (op === "eq") eqs.push([field, value]);
                return q;
              };
            }
            cb(q);
          }
          return chain;
        },
        order(dir: "asc" | "desc") {
          descending = dir === "desc";
          return chain;
        },
        filter() {
          return chain;
        },
        resolve() {
          let out = rows().filter((r) =>
            eqs.every(([f, v]) => (r as any)[f] === v)
          );
          // Insertion order IS creation order here; desc reverses it.
          if (descending) out = [...out].reverse();
          return out;
        },
        async collect() {
          return chain.resolve();
        },
        async first() {
          return chain.resolve()[0] ?? null;
        },
        async take(n: number) {
          takes.push(n);
          return chain.resolve().slice(0, n);
        },
      };
      return chain;
    },
    async insert(table: string, doc: any) {
      const _id = `${table}-${++idCounter}`;
      tables[table].push({ _id, ...doc });
      return _id;
    },
    async patch(id: string, fields: any) {
      for (const t of Object.keys(tables)) {
        const row = tables[t].find((r) => r._id === id);
        if (row) Object.assign(row, fields);
      }
    },
  };

  return { db, tables, takes };
}

function pipeline(overrides: Partial<any> = {}) {
  return {
    _id: "pipelines-seed",
    slug: "nightly-build",
    name: "Nightly Build",
    steps: [
      { id: "fetch", name: "Fetch" },
      { id: "build", name: "Build" },
      { id: "ship", name: "Ship" },
    ],
    enabled: true,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ============================================================
// isLoomEvent — the vocabulary gate
// ============================================================

describe("isLoomEvent", () => {
  it("accepts every event in LOOM_EVENTS (derived from the constant, not retyped)", () => {
    for (const e of LOOM_EVENTS) {
      expect(isLoomEvent(e)).toBe(true);
    }
    // Control: the vocabulary is not empty, so the loop above asserted something.
    expect(LOOM_EVENTS.length).toBeGreaterThan(0);
  });

  it("refuses anything outside it", () => {
    for (const e of ["", "START", "started", "done", "finish", "__proto__"]) {
      expect(isLoomEvent(e)).toBe(false);
    }
  });
});

// ============================================================
// appendBounded — D-05's cap
// ============================================================

describe("appendBounded", () => {
  it("appends without truncating while under the cap", () => {
    const out = appendBounded([1, 2], 3);
    expect(out).toEqual([1, 2, 3]);
  });

  it("does not mutate the input array", () => {
    const input = [1, 2];
    appendBounded(input, 3);
    expect(input).toEqual([1, 2]);
  });

  it("holds exactly the cap once full", () => {
    const full = Array.from({ length: LOOM_STEP_EVENT_CAP }, (_, i) => i);
    const out = appendBounded(full, 999);
    expect(out).toHaveLength(LOOM_STEP_EVENT_CAP);
  });

  it("keeps the NEWEST, dropping from the head", () => {
    // The direction is the whole point: a run's tail is what you read when it
    // fails, so truncating the head must never lose the error that ended it.
    const full = Array.from({ length: LOOM_STEP_EVENT_CAP }, (_, i) => i);
    const out = appendBounded(full, 999);
    expect(out[out.length - 1]).toBe(999);
    expect(out[0]).toBe(1); // the original 0 fell off the head
    expect(out).not.toContain(0);
  });

  it("trims an already-oversized array back to the cap", () => {
    const over = Array.from({ length: LOOM_STEP_EVENT_CAP + 50 }, (_, i) => i);
    const out = appendBounded(over, 999);
    expect(out).toHaveLength(LOOM_STEP_EVENT_CAP);
    expect(out[out.length - 1]).toBe(999);
  });
});

// ============================================================
// deriveStatus — sticky error
// ============================================================

describe("deriveStatus", () => {
  it("is running while steps remain incomplete", () => {
    expect(
      deriveStatus([{ event: "start", stepId: "a" } as any], 3)
    ).toBe("running");
  });

  it("is complete once every step has a complete event", () => {
    const events = [
      { event: "complete", stepId: "a" },
      { event: "complete", stepId: "b" },
      { event: "complete", stepId: "c" },
    ] as any;
    expect(deriveStatus(events, 3)).toBe("complete");
  });

  it("counts DISTINCT steps, so repeats of one step do not fake completion", () => {
    const events = [
      { event: "complete", stepId: "a" },
      { event: "complete", stepId: "a" },
      { event: "complete", stepId: "a" },
    ] as any;
    expect(deriveStatus(events, 3)).toBe("running");
  });

  it("error is STICKY — a later complete does not rescue a partially-failed run", () => {
    // Without this, a run that errored on step 2 and then finished step 3
    // reports success.
    const events = [
      { event: "complete", stepId: "a" },
      { event: "error", stepId: "b" },
      { event: "complete", stepId: "b" },
      { event: "complete", stepId: "c" },
    ] as any;
    expect(deriveStatus(events, 3)).toBe("error");
  });

  it("error wins even when every step completed", () => {
    const events = [
      { event: "error", stepId: "a" },
      { event: "complete", stepId: "a" },
      { event: "complete", stepId: "b" },
    ] as any;
    expect(deriveStatus(events, 2)).toBe("error");
  });

  it("a zero-step pipeline stays running rather than completing vacuously", () => {
    // `completed.size >= stepCount` is true for 0 >= 0, so the stepCount > 0
    // guard is what stops an empty pipeline reporting complete on no evidence.
    expect(deriveStatus([], 0)).toBe("running");
  });

  it("warn and action do not advance status", () => {
    const events = [
      { event: "action", stepId: "a" },
      { event: "warn", stepId: "a" },
    ] as any;
    expect(deriveStatus(events, 1)).toBe("running");
  });
});

// ============================================================
// Read paths
// ============================================================

describe("listPipelinesHandler", () => {
  it("returns pipelines whose enabled flag is absent (optional field, not disabled)", async () => {
    const { db } = makeDb({
      pipelines: [pipeline({ _id: "p1", enabled: undefined })],
    });
    const out = await listPipelinesHandler({ db });
    expect(out).toHaveLength(1);
  });

  it("excludes only pipelines explicitly disabled", async () => {
    const { db } = makeDb({
      pipelines: [
        pipeline({ _id: "p1", slug: "on", enabled: true }),
        pipeline({ _id: "p2", slug: "off", enabled: false }),
        pipeline({ _id: "p3", slug: "unset", enabled: undefined }),
      ],
    });
    const out = await listPipelinesHandler({ db });
    expect(out.map((p: any) => p.slug)).toEqual(["on", "unset"]);
  });
});

describe("listRunsHandler", () => {
  it("returns only the requested pipeline's runs", async () => {
    const { db } = makeDb({
      pipelineRuns: [
        { _id: "r1", pipelineSlug: "a", status: "complete" },
        { _id: "r2", pipelineSlug: "b", status: "complete" },
        { _id: "r3", pipelineSlug: "a", status: "running" },
      ],
    });
    const out = await listRunsHandler({ db }, "a");
    expect(out.map((r: any) => r._id).sort()).toEqual(["r1", "r3"]);
  });

  it("returns newest first", async () => {
    const { db } = makeDb({
      pipelineRuns: [
        { _id: "older", pipelineSlug: "a" },
        { _id: "newer", pipelineSlug: "a" },
      ],
    });
    const out = await listRunsHandler({ db }, "a");
    expect(out[0]._id).toBe("newer");
  });

  it("bounds the read at 20 — never an unbounded collect on a growing run table", async () => {
    const { db, takes } = makeDb({
      pipelineRuns: Array.from({ length: 50 }, (_, i) => ({
        _id: `r${i}`,
        pipelineSlug: "a",
      })),
    });
    const out = await listRunsHandler({ db }, "a");
    expect(takes).toEqual([20]);
    expect(out).toHaveLength(20);
  });
});

// ============================================================
// upsertPipelineHandler
// ============================================================

describe("upsertPipelineHandler", () => {
  const args = {
    slug: "nightly-build",
    name: "Nightly Build",
    steps: [{ id: "fetch", name: "Fetch" }],
  };

  it("inserts a new pipeline enabled, stamping both timestamps", async () => {
    const { db, tables } = makeDb();
    const id = await upsertPipelineHandler({ db }, args, 5000);

    expect(tables.pipelines).toHaveLength(1);
    const row = tables.pipelines[0];
    expect(row._id).toBe(id);
    expect(row.enabled).toBe(true);
    expect(row.createdAt).toBe(5000);
    expect(row.updatedAt).toBe(5000);
  });

  it("patches an existing pipeline instead of inserting a duplicate", async () => {
    const { db, tables } = makeDb({
      pipelines: [pipeline({ _id: "existing", createdAt: 1000 })],
    });
    const id = await upsertPipelineHandler(
      { db },
      { ...args, name: "Renamed" },
      9000
    );

    expect(id).toBe("existing");
    expect(tables.pipelines).toHaveLength(1);
    expect(tables.pipelines[0].name).toBe("Renamed");
  });

  it("preserves createdAt across an update while moving updatedAt", async () => {
    const { db, tables } = makeDb({
      pipelines: [pipeline({ _id: "existing", createdAt: 1000, updatedAt: 1000 })],
    });
    await upsertPipelineHandler({ db }, args, 9000);

    expect(tables.pipelines[0].createdAt).toBe(1000);
    expect(tables.pipelines[0].updatedAt).toBe(9000);
  });

  it("does not re-enable a deliberately disabled pipeline on update", async () => {
    // The insert path sets `enabled: true`; the patch path must not, or
    // disabling a pipeline would be undone by the next authoring run.
    const { db, tables } = makeDb({
      pipelines: [pipeline({ _id: "existing", enabled: false })],
    });
    await upsertPipelineHandler({ db }, args, 9000);
    expect(tables.pipelines[0].enabled).toBe(false);
  });

  it("keys on slug, so a different slug inserts rather than patches", async () => {
    const { db, tables } = makeDb({
      pipelines: [pipeline({ _id: "existing", slug: "other" })],
    });
    await upsertPipelineHandler({ db }, args, 9000);
    expect(tables.pipelines).toHaveLength(2);
  });
});

// ============================================================
// recordStepEventHandler
// ============================================================

describe("recordStepEventHandler — refusals (D-06)", () => {
  it("refuses an unknown pipelineSlug rather than implicitly creating one", async () => {
    // An auto-created pipeline from a typo'd emit would sit on the board
    // looking curated.
    const { db, tables } = makeDb();
    const out = await recordStepEventHandler(
      { db },
      { pipelineSlug: "typo", stepId: "fetch", event: "start" },
      1
    );

    expect(out).toEqual({ ok: false, error: "UNKNOWN_PIPELINE" });
    expect(tables.pipelines).toHaveLength(0);
    expect(tables.pipelineRuns).toHaveLength(0);
  });

  it("refuses an event outside the vocabulary, writing nothing", async () => {
    const { db, tables } = makeDb({ pipelines: [pipeline()] });
    const out = await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "fetch", event: "finished" },
      1
    );

    expect(out).toEqual({ ok: false, error: "UNKNOWN_EVENT" });
    expect(tables.pipelineRuns).toHaveLength(0);
  });

  it("checks the pipeline BEFORE the event, so a typo'd slug is not masked", async () => {
    const { db } = makeDb();
    const out = await recordStepEventHandler(
      { db },
      { pipelineSlug: "typo", stepId: "fetch", event: "bogus" },
      1
    );
    expect(out).toEqual({ ok: false, error: "UNKNOWN_PIPELINE" });
  });
});

describe("recordStepEventHandler — opening a run", () => {
  it("opens the first run when none exists", async () => {
    const { db, tables } = makeDb({ pipelines: [pipeline()] });
    const out: any = await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "fetch", event: "start" },
      7000
    );

    expect(out.ok).toBe(true);
    expect(tables.pipelineRuns).toHaveLength(1);
    const run = tables.pipelineRuns[0];
    expect(run.status).toBe("running");
    expect(run.startedAt).toBe(7000);
    expect(run.currentStep).toBe("fetch");
    expect(run.stepEvents).toEqual([
      { stepId: "fetch", event: "start", text: undefined, at: 7000 },
    ]);
  });

  it("opens a NEW run when a `start` lands on the first step while one is running", async () => {
    // Otherwise every run of the same pipeline accumulates into one row.
    const { db, tables } = makeDb({
      pipelines: [pipeline()],
      pipelineRuns: [
        {
          _id: "run-1",
          pipelineSlug: "nightly-build",
          status: "running",
          startedAt: 1,
          stepEvents: [{ stepId: "fetch", event: "start", at: 1 }],
        },
      ],
    });
    await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "fetch", event: "start" },
      7000
    );

    expect(tables.pipelineRuns).toHaveLength(2);
    expect(tables.pipelineRuns[1].startedAt).toBe(7000);
  });

  it("opens a new run when the latest run is already finished", async () => {
    const { db, tables } = makeDb({
      pipelines: [pipeline()],
      pipelineRuns: [
        {
          _id: "run-1",
          pipelineSlug: "nightly-build",
          status: "complete",
          startedAt: 1,
          stepEvents: [],
        },
      ],
    });
    await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "build", event: "action" },
      7000
    );
    expect(tables.pipelineRuns).toHaveLength(2);
  });

  it("does NOT open a new run for a `start` on a later step", async () => {
    // Only the FIRST step's start opens a run; a mid-pipeline start is just
    // that step beginning.
    const { db, tables } = makeDb({
      pipelines: [pipeline()],
      pipelineRuns: [
        {
          _id: "run-1",
          pipelineSlug: "nightly-build",
          status: "running",
          startedAt: 1,
          stepEvents: [{ stepId: "fetch", event: "start", at: 1 }],
        },
      ],
    });
    const out: any = await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "build", event: "start" },
      7000
    );

    expect(tables.pipelineRuns).toHaveLength(1);
    expect(out.runId).toBe("run-1");
  });

  it("extends the NEWEST run, not the oldest, when several exist", async () => {
    const { db, tables } = makeDb({
      pipelines: [pipeline()],
      pipelineRuns: [
        {
          _id: "old",
          pipelineSlug: "nightly-build",
          status: "complete",
          startedAt: 1,
          stepEvents: [],
        },
        {
          _id: "new",
          pipelineSlug: "nightly-build",
          status: "running",
          startedAt: 2,
          stepEvents: [],
        },
      ],
    });
    const out: any = await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "build", event: "action" },
      7000
    );

    expect(out.runId).toBe("new");
    expect(tables.pipelineRuns).toHaveLength(2);
    expect(tables.pipelineRuns.find((r) => r._id === "new")!.stepEvents).toHaveLength(1);
  });
});

describe("recordStepEventHandler — extending a run", () => {
  function running(stepEvents: any[] = []) {
    return {
      pipelines: [pipeline()],
      pipelineRuns: [
        {
          _id: "run-1",
          pipelineSlug: "nightly-build",
          status: "running",
          startedAt: 1,
          stepEvents,
        },
      ],
    };
  }

  it("appends the event and advances currentStep", async () => {
    const { db, tables } = makeDb(
      running([{ stepId: "fetch", event: "start", at: 1 }])
    );
    await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "build", event: "action", text: "compiling" },
      7000
    );

    const run = tables.pipelineRuns[0];
    expect(run.currentStep).toBe("build");
    expect(run.stepEvents).toHaveLength(2);
    expect(run.stepEvents[1]).toEqual({
      stepId: "build",
      event: "action",
      text: "compiling",
      at: 7000,
    });
  });

  it("leaves endedAt unset while the run is still running", async () => {
    const { db, tables } = makeDb(running([]));
    await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "build", event: "action" },
      7000
    );
    expect(tables.pipelineRuns[0].endedAt).toBeUndefined();
    expect(tables.pipelineRuns[0].status).toBe("running");
  });

  it("stamps endedAt and flips to error on an error event", async () => {
    const { db, tables } = makeDb(running([]));
    await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "build", event: "error", text: "boom" },
      7000
    );

    const run = tables.pipelineRuns[0];
    expect(run.status).toBe("error");
    expect(run.endedAt).toBe(7000);
  });

  it("stamps endedAt and flips to complete when the last step completes", async () => {
    const { db, tables } = makeDb(
      running([
        { stepId: "fetch", event: "complete", at: 1 },
        { stepId: "build", event: "complete", at: 2 },
      ])
    );
    await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "ship", event: "complete" },
      7000
    );

    const run = tables.pipelineRuns[0];
    expect(run.status).toBe("complete");
    expect(run.endedAt).toBe(7000);
  });

  it("applies the D-05 cap to a run whose trail is already full", async () => {
    const seeded = Array.from({ length: LOOM_STEP_EVENT_CAP }, (_, i) => ({
      stepId: "build",
      event: "action",
      at: i,
    }));
    const { db, tables } = makeDb(running(seeded));
    await recordStepEventHandler(
      { db },
      { pipelineSlug: "nightly-build", stepId: "ship", event: "action" },
      7000
    );

    const events = tables.pipelineRuns[0].stepEvents;
    expect(events).toHaveLength(LOOM_STEP_EVENT_CAP);
    expect(events[events.length - 1].at).toBe(7000);
    expect(events[0].at).toBe(1); // the oldest fell off the head
  });
});

// ============================================================
// INT-03 — the write paths must not be client-callable
// ============================================================

describe("INT-03 — upsertPipeline and recordStepEvent are internalMutation", () => {
  const loomPath = path.resolve(__dirname, "./loom.ts");

  /** Strip full-line comments so a docstring that legitimately says
   * "mutation" cannot satisfy or pollute these assertions. Same helper
   * messageRoutes.test.ts uses. */
  function stripCommentLines(source: string): string {
    return source
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
  }

  it("declares both writes with internalMutation and no public mutation builder", () => {
    // A plain `mutation` lands in the client-callable `api.` namespace, making
    // loomHttp.ts's bearer gate bypassable — any holder of the shipped
    // VITE_CONVEX_URL could call the same write from devtools. That is the
    // v14.0 audit finding INT-03.
    const source = stripCommentLines(readFileSync(loomPath, "utf-8"));

    expect(source).toMatch(/upsertPipeline\s*=\s*internalMutation\(/);
    expect(source).toMatch(/recordStepEvent\s*=\s*internalMutation\(/);
    expect(source).not.toMatch(/=\s*mutation\(/);

    const internalMutations = source.match(/=\s*internalMutation\(/g) ?? [];
    expect(internalMutations).toHaveLength(2);
  });

  it("the stripping is not what makes the negative assertion pass (control)", () => {
    // The raw file DOES contain the word "mutation" in prose. Without this,
    // `not.toMatch(/= mutation\(/)` could be passing vacuously.
    const raw = readFileSync(loomPath, "utf-8");
    expect(raw).toMatch(/mutation/i);
  });

  it("the read paths stay public queries", () => {
    const source = stripCommentLines(readFileSync(loomPath, "utf-8"));
    expect(source).toMatch(/listPipelines\s*=\s*query\(/);
    expect(source).toMatch(/listRuns\s*=\s*query\(/);
  });
});
