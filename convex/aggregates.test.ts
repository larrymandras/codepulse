import { describe, test, expect } from "vitest";
import { getBillingType } from "./lib/providers";

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

    test("cost dimension key groups by provider::model::billingType", () => {
      // Phase 67: billingType added to dimension key
      const rows = [
        { provider: "openrouter", model: "gpt-4", cost: 0.03, billingType: undefined as string | undefined },
        { provider: "openrouter", model: "gpt-4", cost: 0.02, billingType: undefined as string | undefined },
        { provider: "codex", model: "claude-3", cost: 0.00, billingType: undefined as string | undefined },
      ];
      const costByDim: Record<string, number> = {};
      for (const r of rows) {
        const billingType = r.billingType ?? getBillingType(r.provider);
        const key = `${r.provider}::${r.model}::${billingType}`;
        costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
      }
      expect(costByDim["openrouter::gpt-4::api"]).toBe(0.05);
      expect(costByDim["codex::claude-3::subscription"]).toBe(0);
      expect(Object.keys(costByDim)).toHaveLength(2);
    });

    test("idempotency guard uses per-dimension-key check (not simple first())", () => {
      // Phase 67: With billingType, multiple rows per hour bucket exist.
      // The idempotency guard must check per dimension key, not just "any row exists."
      const existingCostRows = [
        { dimensions: { provider: "openrouter", model: "gpt-4", billingType: "api" } },
      ];
      const existingKeys = new Set(
        existingCostRows.map((r) => {
          const dims = r.dimensions as { provider?: string; model?: string; billingType?: string };
          return `${dims?.provider ?? "unknown"}::${dims?.model ?? "unknown"}::${dims?.billingType ?? "api"}`;
        })
      );

      // A new dimension key should NOT be blocked
      expect(existingKeys.has("openrouter::gpt-4::api")).toBe(true);
      expect(existingKeys.has("codex::claude-3::subscription")).toBe(false);
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

    test("costByPeriod with billingType='api' returns only API-billed rows", () => {
      // Phase 67: billingType filter on costByPeriod
      const rows = [
        { value: 10, dimensions: { provider: "openrouter", billingType: "api" } },
        { value: 5, dimensions: { provider: "codex", billingType: "subscription" } },
        { value: 20, dimensions: { provider: "claude-sdk", billingType: "api" } },
      ];
      const billingTypeFilter = "api";
      const filtered = rows.filter((r) => {
        const bt = (r.dimensions as { billingType?: string })?.billingType ?? "api";
        return bt === billingTypeFilter;
      });
      const grouped: Record<string, number> = {};
      for (const r of filtered) {
        const provider = (r.dimensions as { provider?: string })?.provider ?? "unknown";
        grouped[provider] = (grouped[provider] ?? 0) + r.value;
      }
      expect(grouped).toEqual({ openrouter: 10, "claude-sdk": 20 });
    });

    test("costByPeriod with billingType='subscription' returns only subscription rows", () => {
      const rows = [
        { value: 10, dimensions: { provider: "openrouter", billingType: "api" } },
        { value: 5, dimensions: { provider: "codex", billingType: "subscription" } },
        { value: 3, dimensions: { provider: "antigravity", billingType: "subscription" } },
      ];
      const billingTypeFilter = "subscription";
      const filtered = rows.filter((r) => {
        const bt = (r.dimensions as { billingType?: string })?.billingType ?? "api";
        return bt === billingTypeFilter;
      });
      const grouped: Record<string, number> = {};
      for (const r of filtered) {
        const provider = (r.dimensions as { provider?: string })?.provider ?? "unknown";
        grouped[provider] = (grouped[provider] ?? 0) + r.value;
      }
      expect(grouped).toEqual({ codex: 5, antigravity: 3 });
    });

    test("costByPeriod without billingType returns all rows (backward compat)", () => {
      const rows = [
        { value: 10, dimensions: { provider: "openrouter", billingType: "api" } },
        { value: 5, dimensions: { provider: "codex", billingType: "subscription" } },
      ];
      const billingTypeFilter: string | undefined = undefined;
      const filtered = billingTypeFilter
        ? rows.filter((r) => {
            const bt = (r.dimensions as { billingType?: string })?.billingType ?? "api";
            return bt === billingTypeFilter;
          })
        : rows;
      const grouped: Record<string, number> = {};
      for (const r of filtered) {
        const provider = (r.dimensions as { provider?: string })?.provider ?? "unknown";
        grouped[provider] = (grouped[provider] ?? 0) + r.value;
      }
      expect(grouped).toEqual({ openrouter: 10, codex: 5 });
    });

    test("legacy rows without billingType dimension are treated as 'api'", () => {
      // Phase 67: backward compat — legacy rows (no billingType) default to "api"
      const rows = [
        { value: 10, dimensions: { provider: "anthropic_direct" } }, // no billingType field
        { value: 5, dimensions: { provider: "codex", billingType: "subscription" } },
      ];
      const billingTypeFilter = "api";
      const filtered = rows.filter((r) => {
        const bt = (r.dimensions as { billingType?: string })?.billingType ?? "api";
        return bt === billingTypeFilter;
      });
      expect(filtered).toHaveLength(1);
      expect((filtered[0].dimensions as { provider?: string })?.provider).toBe("anthropic_direct");
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
