/**
 * Tests for convex/costBudgets.ts — UTC period-boundary helpers (D-10) and
 * CRUD validation + the Clerk identity gate (T-104-13).
 *
 * Mutation handlers are exercised via `._handler`, the raw function
 * Convex's mutation()/query() wrappers expose — the same convention
 * established in convex/modelPricing.test.ts.
 */
import { describe, it, expect } from "vitest";
import {
  periodStartFor,
  periodEndFor,
  periodHours,
  create,
  update,
  seedFromLegacyCaps,
} from "./costBudgets";

// ---------------------------------------------------------------------------
// periodStartFor / periodEndFor / periodHours — UTC anchoring (D-10)
// ---------------------------------------------------------------------------

describe("costBudgets.periodStartFor — weekly", () => {
  it("lands on Monday 00:00 UTC for three probe timestamps", () => {
    const probes = [
      Date.UTC(2026, 6, 31, 13, 9, 0) / 1000, // Friday
      Date.UTC(2026, 0, 1, 0, 0, 0) / 1000, // Thursday, New Year's Day
      Date.UTC(2026, 11, 25, 23, 59, 0) / 1000, // Friday, near year end
    ];
    for (const nowSec of probes) {
      const start = periodStartFor("weekly", nowSec);
      const d = new Date(start * 1000);
      expect(d.getUTCDay()).toBe(1);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
      expect(d.getUTCSeconds()).toBe(0);
      expect(start).toBeLessThanOrEqual(nowSec);
    }
  });
});

describe("costBudgets.periodStartFor / periodEndFor — monthly", () => {
  it("lands on real UTC month boundaries across a 31-day month, a 28-day month, and a Dec->Jan rollover", () => {
    // July 2026 — 31 days
    const julyProbe = Date.UTC(2026, 6, 15, 12, 0, 0) / 1000;
    expect(periodStartFor("monthly", julyProbe)).toBe(Date.UTC(2026, 6, 1) / 1000);
    expect(periodEndFor("monthly", julyProbe)).toBe(Date.UTC(2026, 7, 1) / 1000);

    // February 2027 — 28 days (not a leap year)
    const febProbe = Date.UTC(2027, 1, 10, 0, 0, 0) / 1000;
    expect(periodStartFor("monthly", febProbe)).toBe(Date.UTC(2027, 1, 1) / 1000);
    expect(periodEndFor("monthly", febProbe)).toBe(Date.UTC(2027, 2, 1) / 1000);

    // December 2026 -> January 2027 rollover
    const decProbe = Date.UTC(2026, 11, 31, 23, 0, 0) / 1000;
    expect(periodStartFor("monthly", decProbe)).toBe(Date.UTC(2026, 11, 1) / 1000);
    expect(periodEndFor("monthly", decProbe)).toBe(Date.UTC(2027, 0, 1) / 1000);
  });
});

describe("costBudgets.periodHours — monthly", () => {
  it("returns 744 for a 31-day month and 672 for a 28-day month", () => {
    const julyProbe = Date.UTC(2026, 6, 15, 12, 0, 0) / 1000;
    expect(periodHours("monthly", julyProbe)).toBe(744);

    const febProbe = Date.UTC(2027, 1, 10, 0, 0, 0) / 1000;
    expect(periodHours("monthly", febProbe)).toBe(672);
  });
});

// ---------------------------------------------------------------------------
// Fake ctx — generalizes convex/modelPricing.test.ts's ._handler-exercising
// pattern to a composite 3-field index (scope, scopeKey, period) and a
// second table (agentConfigs, used by seedFromLegacyCaps in Task 2's tests).
// ---------------------------------------------------------------------------

type FakeRow = Record<string, unknown> & { _id: string };

function makeCtx(
  overrides: {
    identity?: unknown;
    costBudgets?: FakeRow[];
    agentConfigs?: FakeRow[];
  } = {}
) {
  const costBudgets: FakeRow[] = overrides.costBudgets ?? [];
  const agentConfigs: FakeRow[] = overrides.agentConfigs ?? [];
  const tables: Record<string, FakeRow[]> = { costBudgets, agentConfigs };
  let nextId = 1;
  let deleteCalls = 0;
  let patchCalls = 0;

  const ctx = {
    auth: {
      getUserIdentity: async () => overrides.identity ?? null,
    },
    db: {
      query(table: string) {
        const rows = tables[table] ?? [];
        return {
          withIndex(_index: string, cb: (q: any) => any) {
            void _index;
            const eqs: Record<string, unknown> = {};
            const q = {
              eq(field: string, value: unknown) {
                eqs[field] = value;
                return q;
              },
            };
            cb(q);
            const matches = rows.filter((r) =>
              Object.entries(eqs).every(([field, value]) => r[field] === value)
            );
            return {
              async first() {
                return matches[0] ?? null;
              },
              async collect() {
                return matches;
              },
            };
          },
          async collect() {
            return rows;
          },
        };
      },
      async get(id: string) {
        return costBudgets.find((r) => r._id === id) ?? agentConfigs.find((r) => r._id === id) ?? null;
      },
      async insert(table: string, doc: Record<string, unknown>) {
        const _id = `${table}_${nextId++}`;
        const row = { ...doc, _id } as FakeRow;
        (tables[table] ??= []).push(row);
        return _id;
      },
      async patch(id: string, patch: Record<string, unknown>) {
        patchCalls++;
        for (const table of Object.values(tables)) {
          const row = table.find((r) => r._id === id);
          if (row) Object.assign(row, patch);
        }
      },
      async delete(id: string) {
        deleteCalls++;
        for (const key of Object.keys(tables)) {
          tables[key] = tables[key].filter((r) => r._id !== id);
        }
      },
    },
  };

  return {
    ctx,
    costBudgets,
    agentConfigs,
    callCounts: () => ({ deleteCalls, patchCalls }),
  };
}

// ---------------------------------------------------------------------------
// create — identity gate + validation (T-104-13)
// ---------------------------------------------------------------------------

describe("costBudgets.create — identity gate + validation", () => {
  it("throws 'Unauthenticated' when ctx.auth.getUserIdentity() resolves to null", async () => {
    const { ctx } = makeCtx({ identity: null });
    await expect(
      (create as any)._handler(ctx, { scope: "global", period: "daily", limit: 5 })
    ).rejects.toThrow("Unauthenticated");
  });

  it("stores unit: 'quota_pct' for scope 'quota' even though unit is not a caller argument", async () => {
    const { ctx } = makeCtx({ identity: { subject: "user_1" } });
    const id = await (create as any)._handler(ctx, {
      scope: "quota",
      scopeKey: "claude-cli",
      period: "daily",
      limit: 50,
    });
    const row = await ctx.db.get(id);
    expect(row?.unit).toBe("quota_pct");
  });

  it("rejects warnFraction: 1.2", async () => {
    const { ctx } = makeCtx({ identity: { subject: "user_1" } });
    await expect(
      (create as any)._handler(ctx, {
        scope: "global",
        period: "daily",
        limit: 5,
        warnFraction: 1.2,
      })
    ).rejects.toThrow(/warnFraction/);
  });

  it("rejects a limit of 0", async () => {
    const { ctx } = makeCtx({ identity: { subject: "user_1" } });
    await expect(
      (create as any)._handler(ctx, { scope: "global", period: "daily", limit: 0 })
    ).rejects.toThrow(/limit/i);
  });

  it("rejects a global scope with a non-empty scopeKey", async () => {
    const { ctx } = makeCtx({ identity: { subject: "user_1" } });
    await expect(
      (create as any)._handler(ctx, {
        scope: "global",
        scopeKey: "claude-sonnet-5",
        period: "daily",
        limit: 5,
      })
    ).rejects.toThrow(/scopeKey/);
  });

  it("rejects a duplicate (scope, scopeKey, period)", async () => {
    const { ctx } = makeCtx({ identity: { subject: "user_1" } });
    await (create as any)._handler(ctx, { scope: "global", period: "daily", limit: 5 });
    await expect(
      (create as any)._handler(ctx, { scope: "global", period: "daily", limit: 10 })
    ).rejects.toThrow(/already exists/i);
  });
});

// ---------------------------------------------------------------------------
// update — immutability of scope/scopeKey/period
// ---------------------------------------------------------------------------

describe("costBudgets.update — immutability of scope/scopeKey/period", () => {
  it("rejects an attempt to change period", async () => {
    const { ctx } = makeCtx({ identity: { subject: "user_1" } });
    const id = await (create as any)._handler(ctx, { scope: "global", period: "daily", limit: 5 });
    await expect((update as any)._handler(ctx, { id, period: "weekly" })).rejects.toThrow(
      /immutable/i
    );
  });
});

// ---------------------------------------------------------------------------
// seedFromLegacyCaps — D-12/D-19 migration, idempotent + additive-only
// ---------------------------------------------------------------------------

describe("costBudgets.seedFromLegacyCaps", () => {
  it("running the handler twice produces exactly one daily row and one monthly row", async () => {
    const { ctx, costBudgets } = makeCtx({
      agentConfigs: [{ _id: "ac_1", configKey: "intelligence.budget_cap", value: 120 }],
    });

    const first = await (seedFromLegacyCaps as any)._handler(ctx);
    expect(first.seededDaily).toBe(true);
    expect(first.seededMonthly).toBe(true);
    expect(costBudgets.filter((r) => r.period === "daily")).toHaveLength(1);
    expect(costBudgets.filter((r) => r.period === "monthly")).toHaveLength(1);

    const second = await (seedFromLegacyCaps as any)._handler(ctx);
    expect(second.seededDaily).toBe(false);
    expect(second.seededMonthly).toBe(false);
    expect(costBudgets.filter((r) => r.period === "daily")).toHaveLength(1);
    expect(costBudgets.filter((r) => r.period === "monthly")).toHaveLength(1);
  });

  it("the daily row's limit is 5 and warnFraction is 0.8", async () => {
    const { ctx, costBudgets } = makeCtx();
    await (seedFromLegacyCaps as any)._handler(ctx);

    const daily = costBudgets.find((r) => r.period === "daily");
    expect(daily?.limit).toBe(5);
    expect(daily?.warnFraction).toBe(0.8);
  });

  it("with no agentConfigs row present, seededMonthly is false, monthlySkippedReason is non-empty, and no monthly row is inserted", async () => {
    const { ctx, costBudgets } = makeCtx();
    const result = await (seedFromLegacyCaps as any)._handler(ctx);

    expect(result.seededMonthly).toBe(false);
    expect(typeof result.monthlySkippedReason).toBe("string");
    expect(result.monthlySkippedReason.length).toBeGreaterThan(0);
    expect(costBudgets.some((r) => r.period === "monthly")).toBe(false);
  });

  it("with an agentConfigs row whose value is 120, the monthly row's limit is 120", async () => {
    const { ctx, costBudgets } = makeCtx({
      agentConfigs: [{ _id: "ac_1", configKey: "intelligence.budget_cap", value: 120 }],
    });
    const result = await (seedFromLegacyCaps as any)._handler(ctx);

    expect(result.seededMonthly).toBe(true);
    const monthly = costBudgets.find((r) => r.period === "monthly");
    expect(monthly?.limit).toBe(120);
  });

  it("issues no db.delete and no db.patch call", async () => {
    const { ctx, callCounts } = makeCtx({
      agentConfigs: [{ _id: "ac_1", configKey: "intelligence.budget_cap", value: 120 }],
    });
    await (seedFromLegacyCaps as any)._handler(ctx);
    await (seedFromLegacyCaps as any)._handler(ctx);

    expect(callCounts()).toEqual({ deleteCalls: 0, patchCalls: 0 });
  });
});

export { makeCtx };
