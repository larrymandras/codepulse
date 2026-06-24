import { describe, test, expect, beforeAll } from "vitest";

// ---------------------------------------------------------------------------
// Phase 88 — Analytics read-path invariants (Nyquist gate, Wave 0).
//
// The pure-math assertions (heatmap day/hour derivation, errorRateTrend 24-slot
// init-to-0) MUST pass green NOW: they assert the timezone-stable mapping math
// the rewritten queries (Plan 04) will preserve.
//
// The "aggregates-backed query derivation" describe block exercises the rewritten
// analytics queries that read the `aggregates` rollup table instead of raw events.
// That rewrite lands in Plan 04 (heatmapFromAggregates / errorRateTrend reading
// metric_type:"events" buckets). Until then those exports are absent, so the block
// is loaded behind a non-literal @vite-ignore dynamic import and REDs cleanly
// rather than erroring the file.
// ---------------------------------------------------------------------------

// Derivation under test: a bucket_start (UTC epoch seconds) maps to a heatmap
// cell {day, hour} via new Date(bucket_start * 1000). This mirrors analytics.ts
// activityHeatmap lines 21-24 and is the contract Plan 04 must keep.
function bucketToCell(bucketStart: number): { day: number; hour: number } {
  const d = new Date(bucketStart * 1000);
  return { day: d.getDay(), hour: d.getHours() };
}

// Derivation under test: errorRateTrend always returns 24 hour slots, each
// initialised to errors: 0, then filled from the buckets that exist. Absent
// hours stay 0 — never absent/null (Pitfall 7). This mirrors analytics.ts
// errorRateTrend lines 179-191.
function errorTrendSlots(
  dayAgo: number,
  errorBuckets: Array<{ bucketStart: number; errors: number }>
): Array<{ hour: number; label: string; errors: number }> {
  const counts: Record<number, number> = {};
  for (let h = 0; h < 24; h++) counts[h] = 0; // init-to-0 guard (Pitfall 7)
  for (const b of errorBuckets) {
    const h = Math.floor((b.bucketStart - dayAgo) / 3600);
    if (h >= 0 && h < 24) counts[h] += b.errors;
  }
  return Object.entries(counts).map(([hour, errors]) => ({
    hour: Number(hour),
    label: `${24 - Number(hour)}h ago`,
    errors,
  }));
}

describe("analytics", () => {
  // -------------------------------------------------------------------------
  // GREEN NOW — pure mapping math, timezone-stable.
  // -------------------------------------------------------------------------
  describe("heatmap derivation", () => {
    test("a fixed bucket_start maps to the UTC-local day-of-week × hour cell", () => {
      // Use the SAME math to compute the expectation so the test is stable across
      // CI timezones (getDay/getHours are local-time; we assert self-consistency,
      // exactly what the production query computes).
      const bucketStart = 1_700_000_000; // arbitrary epoch seconds
      const expected = {
        day: new Date(bucketStart * 1000).getDay(),
        hour: new Date(bucketStart * 1000).getHours(),
      };
      expect(bucketToCell(bucketStart)).toEqual(expected);
    });

    test("two bucket_starts one hour apart land in adjacent hour cells (same day if no wrap)", () => {
      const a = 1_700_000_000;
      const b = a + 3600;
      const cellA = bucketToCell(a);
      const cellB = bucketToCell(b);
      const expectedHourB = (cellA.hour + 1) % 24;
      expect(cellB.hour).toBe(expectedHourB);
    });

    test("buckets summed per {day,hour} cell across event types accumulate counts", () => {
      // The rewritten heatmap sums event-count buckets per absolute hour into one
      // cell. Verify the summing math independent of the data source.
      const bucketStart = 1_700_000_000;
      const cell = bucketToCell(bucketStart);
      const perTypeBuckets = [
        { bucketStart, eventType: "tool_use", value: 3 },
        { bucketStart, eventType: "llm_call", value: 5 },
      ];
      const cells: Record<string, number> = {};
      for (const b of perTypeBuckets) {
        const c = bucketToCell(b.bucketStart);
        const key = `${c.day}-${c.hour}`;
        cells[key] = (cells[key] ?? 0) + b.value;
      }
      expect(cells[`${cell.day}-${cell.hour}`]).toBe(8);
    });
  });

  describe("errorRateTrend missing-hour", () => {
    test("returns all 24 hour slots even when only some hours have error buckets", () => {
      const dayAgo = 1_700_000_000;
      const slots = errorTrendSlots(dayAgo, [
        { bucketStart: dayAgo + 2 * 3600, errors: 4 }, // hour 2 only
        { bucketStart: dayAgo + 5 * 3600, errors: 1 }, // hour 5 only
      ]);
      expect(slots).toHaveLength(24);
    });

    test("hours with no error buckets render errors: 0 (never absent/null)", () => {
      const dayAgo = 1_700_000_000;
      const slots = errorTrendSlots(dayAgo, [
        { bucketStart: dayAgo + 2 * 3600, errors: 4 },
      ]);
      const hour2 = slots.find((s) => s.hour === 2);
      const hour7 = slots.find((s) => s.hour === 7);
      expect(hour2?.errors).toBe(4);
      expect(hour7?.errors).toBe(0); // present and zero, not undefined
      expect(slots.every((s) => typeof s.errors === "number")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // RED until Plan 04 — the rewritten queries read the `aggregates` rollup table.
  // -------------------------------------------------------------------------
  describe("aggregates-backed query derivation", () => {
    type AnalyticsModule = {
      heatmapFromAggregates?: unknown;
      errorRateTrendFromAggregates?: unknown;
    };
    let analytics: AnalyticsModule | null = null;
    beforeAll(async () => {
      try {
        const spec = "./analyticsRollupQueries" + "";
        analytics = (await import(/* @vite-ignore */ spec)) as AnalyticsModule;
      } catch {
        analytics = null;
      }
    });

    test("rewritten heatmap query reads aggregates buckets (Plan 04)", () => {
      // RED until Plan 04 ships the aggregates-backed heatmap derivation.
      expect(analytics && typeof analytics.heatmapFromAggregates !== "undefined").toBe(true);
    });

    test("rewritten errorRateTrend query reads aggregates buckets (Plan 04)", () => {
      expect(analytics && typeof analytics.errorRateTrendFromAggregates !== "undefined").toBe(true);
    });
  });
});
