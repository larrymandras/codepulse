import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { RETENTION_DAYS } from "./retention";
import {
  COVERAGE_PRUNED,
  COVERAGE_BOUNDED_BY_CRON,
  COVERAGE_BOUNDED_INLINE,
  COVERAGE_KEEP_FOREVER,
  UNREVIEWED_TABLES,
  UNREVIEWED_CEILING,
} from "./retentionCoverage";

/**
 * The REVERSE of retention.test.ts.
 *
 * retention.test.ts asserts every RETENTION_DAYS key is a real schema table —
 * it catches a typo'd policy entry. It cannot catch the opposite and far more
 * expensive failure: a real table that was never given a retention decision at
 * all, or one whose bounding mechanism has quietly died.
 *
 * Both happened. Measured on the live backend 2026-08-21: graphSnapshotNodes +
 * graphSnapshotLinks held 502,636 docs (25.7% of the whole database) while their
 * only bound — the sweepGraphSnapshotVersions cron — had been commented out in
 * crons.ts since 2026-07-14. The nightly health check reported
 * "verdict=OK tables=21 all caught up" throughout, truthfully, because it only
 * inspects the 21 enrolled tables. An instrument that cannot see the failure
 * mode reports success right up until someone reads the disk.
 */

const schemaSource = readFileSync(resolve(process.cwd(), "convex/schema.ts"), "utf-8");
const cronsSource = readFileSync(resolve(process.cwd(), "convex/crons.ts"), "utf-8");

/** Every `someTable: defineTable({` declared in schema.ts. */
const schemaTables = new Set(
  Array.from(
    schemaSource.matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*defineTable\(/gm)
  ).map((m) => m[1])
);

/**
 * crons.ts with `//` comment lines removed.
 *
 * This is the whole point of the mechanism check: a disabled cron is not absent
 * from the file, it is COMMENTED OUT and still perfectly greppable. Matching
 * against raw source would have passed happily for all 29 days graphSnapshots
 * was unbounded.
 */
const cronsLive = cronsSource
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

const buckets: Array<[string, string[]]> = [
  ["COVERAGE_PRUNED", [...COVERAGE_PRUNED]],
  ["COVERAGE_BOUNDED_BY_CRON", Object.keys(COVERAGE_BOUNDED_BY_CRON)],
  ["COVERAGE_BOUNDED_INLINE", Object.keys(COVERAGE_BOUNDED_INLINE)],
  ["COVERAGE_KEEP_FOREVER", Object.keys(COVERAGE_KEEP_FOREVER)],
  ["UNREVIEWED_TABLES", [...UNREVIEWED_TABLES]],
];

describe("retention coverage — harness liveness", () => {
  it("parsed a plausible set of tables out of schema.ts", () => {
    // Guard the guard: if either regex stops matching, every assertion below
    // passes vacuously. Same discipline as retention.test.ts's own liveness check.
    expect(schemaTables.size).toBeGreaterThan(100);
    expect(schemaTables.has("events")).toBe(true);
    expect(schemaTables.has("graphSnapshotNodes")).toBe(true);
  });

  it("comment-stripping leaves real cron registrations intact", () => {
    // Known-present control: retention-prune is live and must survive stripping.
    expect(cronsLive).toContain("internal.retention.startNightlyPrune");
    // Known-absent control: markStaleArchived IS commented out, so stripping
    // must remove it. Without this the filter could be a no-op and nothing
    // downstream would reveal it.
    expect(cronsSource).toContain("internal.archival.markStaleArchived");
    expect(cronsLive).not.toContain("internal.archival.markStaleArchived");
  });
});

describe("retention coverage — every table is classified", () => {
  it("every schema table appears in exactly one coverage bucket", () => {
    const seen = new Map<string, string[]>();
    for (const [bucketName, tables] of buckets) {
      for (const t of tables) {
        seen.set(t, [...(seen.get(t) ?? []), bucketName]);
      }
    }

    const unclassified = [...schemaTables].filter((t) => !seen.has(t)).sort();
    expect(
      unclassified,
      `${unclassified.length} schema table(s) have NO retention decision. An ` +
        `unclassified table is unbounded by default, which is how graphSnapshots ` +
        `reached 25.7% of the database unnoticed. Add each to a bucket in ` +
        `convex/retentionCoverage.ts — RETENTION_DAYS if it should be pruned, ` +
        `KEEP_FOREVER with a reason if not.`
    ).toEqual([]);

    const duplicated = [...seen.entries()]
      .filter(([, b]) => b.length > 1)
      .map(([t, b]) => `${t} in ${b.join(" + ")}`);
    expect(duplicated, "a table must be in exactly one bucket").toEqual([]);
  });

  it("no coverage bucket names a table that does not exist in schema.ts", () => {
    const ghosts: string[] = [];
    for (const [bucketName, tables] of buckets) {
      for (const t of tables) {
        if (!schemaTables.has(t)) ghosts.push(`${t} (in ${bucketName})`);
      }
    }
    // A stale entry is a silent no-op in exactly the way a typo'd RETENTION_DAYS
    // key is — it makes coverage look complete while covering nothing.
    expect(ghosts).toEqual([]);
  });

  it("COVERAGE_PRUNED matches RETENTION_DAYS exactly", () => {
    // These are two hand-maintained lists of the same fact. If they drift, this
    // module's accounting silently stops describing what the pruner actually does.
    expect([...COVERAGE_PRUNED].sort()).toEqual(Object.keys(RETENTION_DAYS).sort());
  });
});

describe("retention coverage — bounding mechanisms are alive", () => {
  it("every BOUNDED_BY_CRON mechanism is wired to a LIVE cron", () => {
    const dead: string[] = [];
    for (const [table, fn] of Object.entries(COVERAGE_BOUNDED_BY_CRON)) {
      if (!cronsLive.includes(fn)) dead.push(`${table} -> ${fn}`);
    }
    expect(
      dead,
      `A table's only bounding mechanism is not registered as a live cron. This ` +
        `is the exact 2026-08-21 failure: the table was classified correctly and ` +
        `the MECHANISM had been commented out, so the table grew unbounded while ` +
        `every coverage list still looked complete.`
    ).toEqual([]);
  });

  it("every KEEP_FOREVER and BOUNDED_INLINE entry states a reason", () => {
    for (const [table, reason] of [
      ...Object.entries(COVERAGE_KEEP_FOREVER),
      ...Object.entries(COVERAGE_BOUNDED_INLINE),
    ]) {
      // An empty rationale is how "nobody decided" gets laundered into "decided".
      expect(reason.trim().length, `${table} needs a stated reason`).toBeGreaterThan(10);
    }
  });
});

describe("retention coverage — debt ratchet", () => {
  it("UNREVIEWED_TABLES never grows", () => {
    expect(
      UNREVIEWED_TABLES.length,
      `UNREVIEWED_TABLES is a frozen record of tables with no retention decision. ` +
        `It may only shrink. If you added a table here, classify it instead; if ` +
        `you genuinely intend to raise the ceiling, edit UNREVIEWED_CEILING ` +
        `deliberately so it shows up in review.`
    ).toBeLessThanOrEqual(UNREVIEWED_CEILING);
  });

  it("UNREVIEWED_TABLES has no duplicates", () => {
    expect(UNREVIEWED_TABLES.length).toBe(new Set(UNREVIEWED_TABLES).size);
  });
});
