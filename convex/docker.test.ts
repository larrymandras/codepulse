import { describe, test, expect } from "vitest";
import { pollHealth } from "./docker";

// ---------------------------------------------------------------------------
// Phase: docker-health-cleanup OCC retry storm.
//
// `pollHealth` used to read the WHOLE `dockerContainers` table
// (`.order("desc").take(50)`, no index) into its OCC read set, while every
// reporting container concurrently rewrites its own row via `recordStatus`.
// On self-hosted Convex a single concurrent status write therefore invalidated
// the entire scan; the mutation failed "on every subsequent retry", surfaced as
// `application::cron_jobs: System error executing job ... docker-health-cleanup`,
// and the failed cron then retried on its own backoff — which
// `convex/crons.ts` already documents as starving ingest mutations
// (2026-07-14 self-hosted migration incident).
//
// Measured live 2026-08-21: 37 cron System errors and 85 OCC conflicts across
// 19 distinct dockerContainers docs in one 90-minute window, with ingest
// mutations degrading to a ~998 ms median and 28% of requests dying as HTTP 499
// (client gave up) — against a table holding only 19 rows.
//
// The property under test is therefore READ-SET WIDTH, not output: the handler
// must not pull rows it can never modify into its transaction. Fresh rows are
// exactly the rows `recordStatus` is continuously writing, so every fresh row
// left in the read set is a collision waiting to happen.
// ---------------------------------------------------------------------------

type FakeDoc = Record<string, any>;

/**
 * Minimal ctx supporting the ops pollHealth needs — query/withIndex/order/take,
 * plus patch and delete (which the shared `makeAggregatesCtx` helper
 * deliberately throws on, because its own call paths must be insert-only).
 *
 * `readRows` records every row the handler actually pulled out of the database.
 * That set IS the OCC read set, which is the thing this test exists to bound.
 */
function makeDockerCtx(rows: FakeDoc[]) {
  const table: FakeDoc[] = rows.map((r, i) => ({ _id: `doc${i}`, ...r }));
  const readRows: FakeDoc[] = [];
  const patched: Array<{ id: string; fields: FakeDoc }> = [];
  const deleted: string[] = [];

  function query(_table: string) {
    const predicates: Array<(r: FakeDoc) => boolean> = [];
    let dir: "asc" | "desc" = "asc";

    const chain: any = {
      withIndex(_index: string, cb?: (q: any) => any) {
        if (cb) {
          const q: any = {};
          for (const op of ["eq", "gte", "gt", "lte", "lt"] as const) {
            q[op] = (field: string, value: unknown) => {
              predicates.push((r) => {
                const v = r[field];
                if (op === "eq") return v === value;
                if (op === "gte") return v >= (value as number);
                if (op === "gt") return v > (value as number);
                if (op === "lte") return v <= (value as number);
                return v < (value as number);
              });
              return q;
            };
          }
          cb(q);
        }
        return chain;
      },
      order(direction: "asc" | "desc") {
        dir = direction;
        return chain;
      },
      async take(n: number) {
        const filtered = table.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        const out = ordered.slice(0, n);
        readRows.push(...out);
        return out;
      },
      async collect() {
        const filtered = table.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        readRows.push(...ordered);
        return ordered;
      },
    };
    return chain;
  }

  const ctx = {
    db: {
      query,
      async patch(id: string, fields: FakeDoc) {
        patched.push({ id, fields });
        const row = table.find((r) => r._id === id);
        if (row) Object.assign(row, fields);
      },
      async delete(id: string) {
        deleted.push(id);
        const i = table.findIndex((r) => r._id === id);
        if (i >= 0) table.splice(i, 1);
      },
    },
  };

  return { ctx, table, readRows, patched, deleted };
}

const NOW = Date.now() / 1000;

/** One genuinely stale running container, plus `n` freshly-reporting ones. */
function fixture(freshCount: number) {
  const rows: FakeDoc[] = [
    {
      containerId: "stale-one",
      name: "stale-one",
      status: "running",
      health: "healthy",
      updatedAt: NOW - 600, // 10 min old — past the 5 min stale threshold
    },
  ];
  for (let i = 0; i < freshCount; i++) {
    rows.push({
      containerId: `fresh-${i}`,
      name: `fresh-${i}`,
      status: "running",
      health: "healthy",
      updatedAt: NOW - 10, // reported 10s ago — recordStatus rewrites these
    });
  }
  return rows;
}

describe("docker.pollHealth read-set width (cron retry storm)", () => {
  test("does not pull freshly-reporting containers into its OCC read set", async () => {
    // 18 fresh + 1 stale mirrors the live table (19 rows) at the time of the
    // 2026-08-21 storm.
    const { ctx, readRows } = makeDockerCtx(fixture(18));

    await (pollHealth as any)._handler(ctx);

    const freshRead = readRows.filter((r) => r.containerId.startsWith("fresh-"));
    expect(
      freshRead.map((r) => r.containerId),
      "pollHealth read freshly-updated rows it can never modify. Every one of " +
        "those rows is concurrently written by recordStatus, so each is an OCC " +
        "conflict that fails this cron and triggers its retry-backoff storm."
    ).toEqual([]);
  });

  test("still marks a genuinely stale running container", async () => {
    const { ctx, patched } = makeDockerCtx(fixture(18));

    await (pollHealth as any)._handler(ctx);

    // Control: narrowing the read set must not cost the cron its actual job.
    expect(patched).toHaveLength(1);
    expect(patched[0].fields.status).toBe("unknown");
    expect(patched[0].fields.health).toBe("stale");
  });

  test("read set stays flat as the number of healthy containers grows", async () => {
    // Control on the control: if the read set tracked table size, this would
    // grow with freshCount. It must not — that growth IS the bug.
    const small = makeDockerCtx(fixture(5));
    await (pollHealth as any)._handler(small.ctx);

    const large = makeDockerCtx(fixture(200));
    await (pollHealth as any)._handler(large.ctx);

    expect(large.readRows.length).toBe(small.readRows.length);
  });
});
