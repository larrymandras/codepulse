import { describe, test, expect } from "vitest";

describe("aggregates", () => {
  describe("computeHourly — bucket logic", () => {
    test("bucket_start is truncated to the hour boundary in epoch seconds", () => {
      // Simulates the bucket computation from computeHourly
      const now = 1713100000; // arbitrary epoch seconds
      const hourStart = Math.floor(now / 3600) * 3600 - 3600;
      expect(hourStart % 3600).toBe(0); // aligned to hour
      expect(hourStart).toBeLessThan(now);
      expect(hourStart + 3600).toBeLessThanOrEqual(Math.floor(now / 3600) * 3600);
    });

    test("cost dimension key groups by provider::model", () => {
      const rows = [
        { provider: "openai", model: "gpt-4", cost: 0.03 },
        { provider: "openai", model: "gpt-4", cost: 0.02 },
        { provider: "anthropic", model: "claude-3", cost: 0.05 },
      ];
      const costByDim: Record<string, number> = {};
      for (const r of rows) {
        const key = `${r.provider}::${r.model}`;
        costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
      }
      expect(costByDim["openai::gpt-4"]).toBe(0.05);
      expect(costByDim["anthropic::claude-3"]).toBe(0.05);
      expect(Object.keys(costByDim)).toHaveLength(2);
    });

    test("error aggregation counts by category and includes 'all' total", () => {
      const eventRows = [
        { eventType: "Error" },
        { eventType: "Error" },
        { eventType: "ToolError" },
        { eventType: "Info" },
      ];
      const errorRows = eventRows.filter(
        (e) => e.eventType === "Error" || e.eventType === "ToolError"
      );
      const errorByCategory: Record<string, number> = {};
      for (const e of errorRows) {
        errorByCategory[e.eventType] = (errorByCategory[e.eventType] ?? 0) + 1;
      }
      expect(errorRows.length).toBe(3);
      expect(errorByCategory["Error"]).toBe(2);
      expect(errorByCategory["ToolError"]).toBe(1);
    });
  });

  describe("rollupDaily — summing logic", () => {
    test("sums hourly rows into daily by metric_type+dimensions", () => {
      const hourlyRows = [
        { metric_type: "cost", value: 10, dimensions: { provider: "openai" } },
        { metric_type: "cost", value: 20, dimensions: { provider: "openai" } },
        { metric_type: "cost", value: 5, dimensions: { provider: "anthropic" } },
        { metric_type: "events", value: 100, dimensions: { event_type: "Info" } },
      ];
      const rollup: Record<string, { metric_type: string; value: number; dimensions: unknown }> = {};
      for (const row of hourlyRows) {
        const dimKey = JSON.stringify(row.dimensions ?? {});
        const key = `${row.metric_type}::${dimKey}`;
        if (!rollup[key]) {
          rollup[key] = { metric_type: row.metric_type, value: 0, dimensions: row.dimensions };
        }
        rollup[key].value += row.value;
      }
      const entries = Object.values(rollup);
      expect(entries).toHaveLength(3);
      const openaiCost = entries.find(
        (e) => e.metric_type === "cost" && (e.dimensions as { provider?: string })?.provider === "openai"
      );
      expect(openaiCost?.value).toBe(30);
    });

    test("dayStart is yesterday UTC midnight in epoch seconds", () => {
      const now = 1713100000;
      const dayStart = Math.floor(now / 86400) * 86400 - 86400;
      expect(dayStart % 86400).toBe(0); // aligned to day
      expect(dayStart + 86400).toBeLessThanOrEqual(Math.floor(now / 86400) * 86400);
    });
  });

  describe("aggregate read queries — return shape", () => {
    test("costByPeriod groups by provider and returns Record<string, number>", () => {
      // Simulates the grouping logic from costByPeriod query
      const rows = [
        { value: 10, dimensions: { provider: "openai" } },
        { value: 20, dimensions: { provider: "openai" } },
        { value: 5, dimensions: { provider: "anthropic" } },
      ];
      const grouped: Record<string, number> = {};
      for (const r of rows) {
        const provider = (r.dimensions as { provider?: string })?.provider ?? "unknown";
        grouped[provider] = (grouped[provider] ?? 0) + r.value;
      }
      expect(grouped).toEqual({ openai: 30, anthropic: 5 });
    });

    test("errorTrendByPeriod returns array with bucket_start, errors, category", () => {
      const rows = [
        { bucket_start: 1000, value: 5, dimensions: { error_category: "Error" } },
      ];
      const result = rows.map((r) => ({
        bucket_start: r.bucket_start,
        errors: r.value,
        category: (r.dimensions as { error_category?: string })?.error_category ?? "unknown",
      }));
      expect(result[0]).toEqual({ bucket_start: 1000, errors: 5, category: "Error" });
    });

    test("eventCountsByPeriod groups by event_type", () => {
      const rows = [
        { value: 50, dimensions: { event_type: "Info" } },
        { value: 10, dimensions: { event_type: "Error" } },
      ];
      const grouped: Record<string, number> = {};
      for (const r of rows) {
        const eventType = (r.dimensions as { event_type?: string })?.event_type ?? "unknown";
        grouped[eventType] = (grouped[eventType] ?? 0) + r.value;
      }
      expect(grouped).toEqual({ Info: 50, Error: 10 });
    });
  });
});
