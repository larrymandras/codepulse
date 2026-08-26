/**
 * `bifrost:list` runs on EVERY ROUTE — `useCommandPaletteSearch` feeds the command
 * palette, which `DashboardLayout` renders unconditionally. `convex/bifrost.ts:60-82`
 * records that it WAS an unbounded `.collect()` over a soft-delete-only table, i.e.
 * archived rows accumulated forever and were read on every route. That is the same
 * defect class Phase 126's SWEEP-01 removed from the Inbox badge.
 *
 * The bound was applied 2026-08-25 and had NO test. Found by phase 117's retroactive
 * Nyquist audit (117-VALIDATION.md, 2026-08-26): `grep -rln "LINK_LIST_SCAN_CAP"` hit
 * only `convex/bifrost.ts` and `convex/schema.ts` — no test file. Control: the same
 * grep for `ALERT_COUNT_SCAN_CAP` finds `convex/alertsCountBounded.test.ts`, so the
 * check discriminates "bound with a guard" from "bound without one".
 *
 * This file follows `convex/alertsCountBounded.test.ts`'s reasoning: assert on the
 * RECORDED query (was a limit passed at all), not on the returned rows. A surviving
 * `.collect()` returns identical links on a small fixture, so results cannot tell the
 * two apart — only the recorded limit can.
 */
import { describe, it, expect } from "vitest";
import { listHandler, LINK_LIST_SCAN_CAP } from "./bifrost";

interface QueryUse {
  table: string;
  limit: number | null;
}

function makeRecordingDb(rows: unknown[]) {
  const uses: QueryUse[] = [];
  return {
    uses,
    query(table: string) {
      const use: QueryUse = { table, limit: null };
      const chain: any = {
        withIndex() {
          return chain;
        },
        filter() {
          return chain;
        },
        order() {
          return chain;
        },
        async take(n: number) {
          use.limit = n;
          uses.push(use);
          return rows.slice(0, n);
        },
        async collect() {
          // An unbounded read records a null limit — exactly the shape this
          // test must fail on.
          uses.push(use);
          return rows;
        },
      };
      return chain;
    },
  };
}

function link(i: number, over: Record<string, unknown> = {}) {
  return {
    _id: `l${i}`,
    label: `link-${i}`,
    url: `http://localhost/${i}`,
    category: "tools",
    order: i,
    ...over,
  };
}

describe("bifrost:list — the every-route read must stay BOUNDED (SWEEP-01 class)", () => {
  it("passes a numeric limit to the database, never an unbounded collect", async () => {
    const db = makeRecordingDb([link(1), link(2)]);
    await listHandler({ db } as any);

    expect(db.uses).toHaveLength(1);
    const use = db.uses[0];
    expect(use.table).toBe("links");

    // The assertion that actually fails if `.take()` is swapped back to
    // `.collect()`: an unbounded read leaves limit null.
    expect(use.limit).not.toBeNull();
    expect(typeof use.limit).toBe("number");
  });

  it("reads CAP + 1, so 'more remain' is detectable rather than silently swallowed", async () => {
    const db = makeRecordingDb([link(1)]);
    await listHandler({ db } as any);

    // take(CAP) would make truncation undetectable — the house no-silent-caps
    // rule (D-01). take(CAP + 1) is what makes `truncated` knowable at all.
    expect(db.uses[0].limit).toBe(LINK_LIST_SCAN_CAP + 1);
  });

  it("reports truncated: true when the scan hits the cap (boundary, over side)", async () => {
    const rows = Array.from({ length: LINK_LIST_SCAN_CAP + 1 }, (_, i) => link(i));
    const db = makeRecordingDb(rows);
    const out = await listHandler({ db } as any);

    expect(out.truncated).toBe(true);
    expect(out.links).toHaveLength(LINK_LIST_SCAN_CAP);
  });

  it("reports truncated: false below the cap — the CONTROL for the test above", async () => {
    const rows = Array.from({ length: LINK_LIST_SCAN_CAP - 1 }, (_, i) => link(i));
    const db = makeRecordingDb(rows);
    const out = await listHandler({ db } as any);

    // Without this side, a handler that hardcoded `truncated: true` would pass.
    expect(out.truncated).toBe(false);
    expect(out.links).toHaveLength(LINK_LIST_SCAN_CAP - 1);
  });

  it("still filters archived rows and returns real links (control)", async () => {
    const db = makeRecordingDb([
      link(1),
      link(2, { archived: true }),
      link(3),
    ]);
    const out = await listHandler({ db } as any);

    // Without this, a handler that read nothing would satisfy every bound
    // assertion above.
    expect(out.links.map((l: any) => l._id)).toEqual(["l1", "l3"]);
  });
});
