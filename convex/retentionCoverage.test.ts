import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { RETENTION_DAYS } from "./retention";
import {
  COVERAGE_PRUNED,
  COVERAGE_BOUNDED_BY_CRON,
  COVERAGE_BOUNDED_INLINE,
  COVERAGE_KEEP_FOREVER,
  COVERAGE_PRUNE_PROPOSED,
  COVERAGE_ORPHANED_NO_SCHEMA,
} from "./retentionCoverage";

/**
 * The REVERSE of retention.test.ts.
 *
 * retention.test.ts asserts every RETENTION_DAYS key is a real schema table —
 * it catches a typo'd policy entry. It cannot catch the opposite and far more
 * expensive failures: a real table that was never given a retention decision at
 * all, or one whose stated bounding mechanism has quietly died.
 *
 * Both were live. Measured 2026-08-21: graphSnapshotNodes + graphSnapshotLinks
 * held 502,636 docs (25.7% of the whole database) while their only bound — the
 * sweepGraphSnapshotVersions cron — had been commented out since 2026-07-14. The
 * nightly health check reported "verdict=OK tables=21 all caught up" throughout,
 * truthfully, because it only inspects the 21 enrolled tables. An instrument that
 * cannot see the failure mode reports success right up until someone reads disk.
 */

const schemaSource = readFileSync(resolve(process.cwd(), "convex/schema.ts"), "utf-8");
const cronsSource = readFileSync(resolve(process.cwd(), "convex/crons.ts"), "utf-8");

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

/** Buckets that together must cover every schema table, exactly once. */
const buckets: Array<[string, string[]]> = [
  ["COVERAGE_PRUNED", [...COVERAGE_PRUNED]],
  ["COVERAGE_BOUNDED_BY_CRON", Object.keys(COVERAGE_BOUNDED_BY_CRON)],
  ["COVERAGE_BOUNDED_INLINE", Object.keys(COVERAGE_BOUNDED_INLINE)],
  ["COVERAGE_KEEP_FOREVER", Object.keys(COVERAGE_KEEP_FOREVER)],
  ["COVERAGE_PRUNE_PROPOSED", Object.keys(COVERAGE_PRUNE_PROPOSED)],
];

describe("retention coverage — harness liveness", () => {
  it("parsed a plausible set of tables out of schema.ts", () => {
    // Guard the guard: if the regex stops matching, every assertion below passes
    // vacuously. Same discipline as retention.test.ts's own liveness check.
    expect(schemaTables.size).toBeGreaterThan(100);
    expect(schemaTables.has("events")).toBe(true);
    expect(schemaTables.has("graphSnapshotNodes")).toBe(true);
  });

  it("comment-stripping keeps live crons and drops disabled ones", () => {
    // Known-present control: retention-prune is live and must survive stripping.
    expect(cronsLive).toContain("internal.retention.startNightlyPrune");
    // Known-absent control: markStaleArchived IS commented out, so stripping must
    // remove it. Without this the filter could be a no-op and nothing downstream
    // would reveal it — the probe must be shown to discriminate in BOTH directions.
    expect(cronsSource).toContain("internal.archival.markStaleArchived");
    expect(cronsLive).not.toContain("internal.archival.markStaleArchived");
  });
});

describe("retention coverage — every table is classified", () => {
  it("every schema table appears in exactly one coverage bucket", () => {
    const seen = new Map<string, string[]>();
    for (const [bucketName, tables] of buckets) {
      for (const t of tables) seen.set(t, [...(seen.get(t) ?? []), bucketName]);
    }

    const unclassified = [...schemaTables].filter((t) => !seen.has(t)).sort();
    expect(
      unclassified,
      `${unclassified.length} schema table(s) have NO retention decision. An ` +
        `unclassified table is unbounded by default, which is how graphSnapshots ` +
        `reached 25.7% of the database unnoticed. Classify each in ` +
        `convex/retentionCoverage.ts.`
    ).toEqual([]);

    const duplicated = [...seen.entries()]
      .filter(([, b]) => b.length > 1)
      .map(([t, b]) => `${t} in ${b.join(" + ")}`);
    expect(duplicated, "a table must be in exactly one bucket").toEqual([]);
  });

  it("no coverage bucket names a table that does not exist in schema.ts", () => {
    // A stale entry is a silent no-op in exactly the way a typo'd RETENTION_DAYS
    // key is: it makes coverage look complete while covering nothing.
    const ghosts: string[] = [];
    for (const [bucketName, tables] of buckets) {
      for (const t of tables) if (!schemaTables.has(t)) ghosts.push(`${t} (in ${bucketName})`);
    }
    expect(ghosts).toEqual([]);
  });

  it("COVERAGE_PRUNED matches RETENTION_DAYS exactly", () => {
    // Two hand-maintained lists of the same fact. If they drift, this module's
    // accounting silently stops describing what the pruner actually does.
    expect([...COVERAGE_PRUNED].sort()).toEqual(Object.keys(RETENTION_DAYS).sort());
  });

  it("a proposed table is never already enrolled", () => {
    // Enrolling means moving the key OUT of PRUNE_PROPOSED. Leaving it in both
    // makes the proposal list read as outstanding work that is already done.
    const both = Object.keys(COVERAGE_PRUNE_PROPOSED).filter(
      (t) => t in RETENTION_DAYS
    );
    expect(both, "already in RETENTION_DAYS — remove from COVERAGE_PRUNE_PROPOSED").toEqual([]);
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
        `the MECHANISM had been commented out, so it grew unbounded while every ` +
        `coverage list still looked complete.`
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

describe("retention coverage — proposals are actionable", () => {
  it("every proposal carries a usable window and a note", () => {
    for (const [table, p] of Object.entries(COVERAGE_PRUNE_PROPOSED)) {
      expect(Number.isInteger(p.proposedDays), `${table}: proposedDays must be a whole number`).toBe(true);
      expect(p.proposedDays, `${table}: proposedDays must be positive`).toBeGreaterThan(0);
      expect(p.proposedDays, `${table}: proposedDays over a year is not a retention policy`).toBeLessThanOrEqual(365);
      expect(p.note.trim().length, `${table} needs a note explaining the shape`).toBeGreaterThan(10);
      if (p.rowsPerDay !== null) {
        expect(p.rowsPerDay, `${table}: measured rate cannot be negative`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("proposed windows use the tiers retention.ts already established", () => {
    // 14d firehose / 30d snapshots / 90d history. A one-off window here would
    // silently widen the policy surface the nightly prune has to reason about.
    const allowed = new Set([14, 30, 90]);
    const odd = Object.entries(COVERAGE_PRUNE_PROPOSED)
      .filter(([, p]) => !allowed.has(p.proposedDays))
      .map(([t, p]) => `${t}=${p.proposedDays}d`);
    expect(odd, "use 14 / 30 / 90 to match RETENTION_DAYS' existing tiers").toEqual([]);
  });
});

describe("retention coverage — orphaned live tables", () => {
  it("orphaned tables are genuinely absent from schema.ts", () => {
    // These exist in the live DB with no defineTable anywhere in convex/. If one
    // reappears in schema.ts it has been revived, and it then needs a real
    // retention decision rather than sitting in this inert record.
    const revived = Object.keys(COVERAGE_ORPHANED_NO_SCHEMA).filter((t) => schemaTables.has(t));
    expect(
      revived,
      `re-declared in schema.ts — move it into a real coverage bucket and remove ` +
        `it from COVERAGE_ORPHANED_NO_SCHEMA`
    ).toEqual([]);
  });
});
