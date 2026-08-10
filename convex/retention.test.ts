/**
 * Tests for convex/retention.ts's RETENTION_DAYS policy table.
 *
 * The prune loop does `ctx.db.query(table as any)` off the KEYS of this object,
 * with the table name cast away. That means a key which is not a real schema
 * table is a permanent, SILENT no-op: the nightly run deletes nothing for it,
 * forever, and nothing surfaces the mismatch. These tests make that class of
 * typo fail at CI time instead of being discovered by an OOM crash-loop.
 *
 * Source-level schema parsing (rather than importing the schema object) keeps
 * this test free of the Convex codegen/runtime, matching the precedent in
 * runtimeIngest.test.ts and activeEngine.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RETENTION_DAYS, PRUNE_PREDICATES } from "./retention";

const schemaSource = readFileSync(resolve(process.cwd(), "convex/schema.ts"), "utf-8");

/** Every `someTable: defineTable({` declared in schema.ts. */
const schemaTables = new Set(
  Array.from(schemaSource.matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*defineTable\(/gm)).map(
    (m) => m[1]
  )
);

describe("RETENTION_DAYS", () => {
  it("parsed a plausible set of tables out of schema.ts (harness liveness check)", () => {
    // Guard the guard: if the regex ever stops matching, every assertion below
    // would pass vacuously against an empty set.
    expect(schemaTables.size).toBeGreaterThan(20);
    expect(schemaTables.has("alerts")).toBe(true);
    expect(schemaTables.has("llmMetrics")).toBe(true);
  });

  it("every pruned table name is a real table in schema.ts (silent-no-op guard)", () => {
    const unknown = Object.keys(RETENTION_DAYS).filter((t) => !schemaTables.has(t));
    expect(unknown).toEqual([]);
  });

  it("every retention window is a positive whole number of days", () => {
    for (const [table, days] of Object.entries(RETENTION_DAYS)) {
      expect(days, `${table} retention`).toBeGreaterThan(0);
      expect(Number.isInteger(days), `${table} retention must be whole days`).toBe(true);
    }
  });

  it("bounds gatewayQuotaSnapshots, which D-20 revived from a permanently-empty table (WR-01)", () => {
    // Phase 104 D-20 repointed the dead 5-minute quota poller at the CLI-gateway
    // sidecar. Before that fix the table never grew, so its absence here was
    // harmless; afterwards it accrues ~288 rows/provider/day forever.
    expect(RETENTION_DAYS.gatewayQuotaSnapshots).toBe(30);
  });

  // Post-execution gap closure (adversarial mutation-testing pass, 2026-08-07): deleting the
  // `controlVerbSwaps: 30` entry from RETENTION_DAYS outright was caught by nothing above — the
  // existing tests only assert generic properties (every key is a real schema table, every
  // window is positive, gatewayQuotaSnapshots specifically, a narrowed keep-forever list —
  // Phase 110 D-03 dropped `aggregates` from it, since `aggregates` is now itself a
  // RETENTION_DAYS key protected by a predicate rather than by absence) and never
  // asserted these two Phase 108 tables are present at all. A table silently becoming unbounded
  // is the exact class of defect CLAUDE.md records as having caused a real OOM crash-loop on
  // this self-hosted instance. Unlike the CR-01/scope-filter guards elsewhere in this repo, this
  // one needs no source-level regex workaround — RETENTION_DAYS is a plain object, so this is a
  // full behavioral assertion against the live values, not a stand-in for one.
  it("bounds controlVerbSwaps (D-14) and activeEngineSnapshots (D-10) at 30 days — Phase 108 tables must not silently become unbounded", () => {
    expect(RETENTION_DAYS).toHaveProperty("controlVerbSwaps", 30);
    expect(RETENTION_DAYS).toHaveProperty("activeEngineSnapshots", 30);
  });

  it("prompts and promptVersions are exempt by design (Phase 116 D-13)", () => {
    // Absence assertions alone would pass vacuously against an empty or
    // mis-imported RETENTION_DAYS — controlVerbSwaps is a known-present
    // control in the same assertion style.
    expect(Object.keys(RETENTION_DAYS)).not.toContain("prompts");
    expect(Object.keys(RETENTION_DAYS)).not.toContain("promptVersions");
    expect(Object.keys(RETENTION_DAYS)).toContain("controlVerbSwaps");

    // Prove the absence above is a real exemption of real tables, not a typo:
    // both tables actually exist in schema.ts.
    expect(schemaTables.has("prompts")).toBe(true);
    expect(schemaTables.has("promptVersions")).toBe(true);

    // The exemption must be documented in place, not merely absent — read
    // convex/retention.ts's own source the same way this file already reads
    // convex/schema.ts's source above.
    const retentionSource = readFileSync(resolve(process.cwd(), "convex/retention.ts"), "utf-8");
    expect(retentionSource).toContain("D-13");
    expect(retentionSource).toContain("prompts");
    expect(retentionSource).toContain("promptVersions");
  });

  it("still keeps the cost/trend tables forever — pruning these would break dashboards", () => {
    // Phase 110 D-01/D-03 narrowed this list: `aggregates` now IS a RETENTION_DAYS
    // key (90 days) — its `period:"hourly"` rows are prunable. `period:"daily"`
    // rows are protected instead by PRUNE_PREDICATES.aggregates (asserted in the
    // dedicated positive guard below), not by absence from this map. llmMetrics,
    // sessions, and alerts remain outright absent from RETENTION_DAYS; pruning
    // them would silently destroy re-priceable cost history (D-04) or break
    // trend dashboards.
    for (const keepForever of ["llmMetrics", "sessions", "alerts"]) {
      expect(
        Object.keys(RETENTION_DAYS),
        `${keepForever} must NOT be pruned`
      ).not.toContain(keepForever);
    }
  });

  it("the aggregates predicate can never delete a period:daily row (D-01/D-03/D-04)", () => {
    // Known-present control so this cannot pass vacuously against an empty or
    // mis-imported RETENTION_DAYS/PRUNE_PREDICATES.
    expect(RETENTION_DAYS.aggregates).toBe(90);
    expect(PRUNE_PREDICATES.aggregates).toBeDefined();
    expect(PRUNE_PREDICATES.aggregates!({ period: "daily" })).toBe(false);
    expect(PRUNE_PREDICATES.aggregates!({ period: "hourly" })).toBe(true);

    // The decision rationale must be documented in place, not merely absent —
    // read convex/retention.ts's own source the same way this file already
    // reads convex/schema.ts's source above (D-13 exemption test precedent).
    const retentionSource = readFileSync(resolve(process.cwd(), "convex/retention.ts"), "utf-8");
    expect(retentionSource).toContain("D-01");
    expect(retentionSource).toContain("PRUNE_PREDICATES");
  });

  it("every PRUNE_PREDICATES key is a real, pruned table (silent-no-op guard)", () => {
    // A predicate for a table that is never pruned (absent from RETENTION_DAYS)
    // or that doesn't exist in schema.ts is a silent no-op of the same class the
    // table-existence guard above was written to catch.
    for (const key of Object.keys(PRUNE_PREDICATES)) {
      expect(schemaTables.has(key), `${key} must be a real schema table`).toBe(true);
      expect(
        Object.keys(RETENTION_DAYS),
        `${key} must also be a RETENTION_DAYS key`
      ).toContain(key);
    }
  });
});
