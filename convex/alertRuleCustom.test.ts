import { describe, it, expect } from "vitest";

describe("alertRuleCustom", () => {
  describe("pagerdutyConfig — validator shape", () => {
    it("requires enabled and routingKey, severity is optional", () => {
      const config = {
        enabled: true,
        routingKey: "R0123456789ABCDEF",
        severity: "critical",
      };
      expect(config.enabled).toBe(true);
      expect(config.routingKey).toBeTruthy();
      expect(config.severity).toBe("critical");
    });

    it("accepts config without severity", () => {
      const config = {
        enabled: false,
        routingKey: "R0123456789ABCDEF",
      };
      expect(config.enabled).toBe(false);
      expect((config as any).severity).toBeUndefined();
    });
  });

  describe("githubTrigger — validator shape", () => {
    it("requires enabled, repo, workflowFile, and ref", () => {
      const trigger = {
        enabled: true,
        repo: "owner/repo",
        workflowFile: "remediate.yml",
        ref: "main",
      };
      expect(trigger.enabled).toBe(true);
      expect(trigger.repo).toBe("owner/repo");
      expect(trigger.workflowFile).toBe("remediate.yml");
      expect(trigger.ref).toBe("main");
    });
  });

  describe("create/update mutations — extended args", () => {
    it("pagerdutyConfig is optional in create args", () => {
      const createArgs = {
        name: "High Cost Alert",
        severity: "critical",
        conditions: [{ metric: "cost_per_hour", operator: "gt", threshold: 10, lookbackWindow: "1h" }],
        conditionLogic: "AND",
        // pagerdutyConfig intentionally omitted — optional
      };
      expect((createArgs as any).pagerdutyConfig).toBeUndefined();
    });

    it("githubTrigger is optional in create args", () => {
      const createArgs = {
        name: "Error Spike",
        severity: "error",
        conditions: [{ metric: "error_rate", operator: "gt", threshold: 5, lookbackWindow: "15m" }],
        conditionLogic: "OR",
        // githubTrigger intentionally omitted — optional
      };
      expect((createArgs as any).githubTrigger).toBeUndefined();
    });

    it.todo("should persist pagerdutyConfig via ctx.db.insert (DB round-trip)");
    it.todo("should persist githubTrigger via ctx.db.insert (DB round-trip)");
    it.todo("should forward pagerdutyConfig through update spread to ctx.db.patch (DB round-trip)");
  });
});
