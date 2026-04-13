import { describe, test, expect } from "vitest";
import { findingToTaskDefaults } from "@/lib/findingToTask";

const baseFinding = {
  _id: "finding-123",
  description: "Unused import in auth.ts",
  suggestedFix: "Remove the unused import statement",
  severity: "medium",
  category: "code-quality",
  scanType: "static-analysis",
};

describe("findingToTaskDefaults", () => {
  test("maps critical severity to high priority", () => {
    const result = findingToTaskDefaults({ ...baseFinding, severity: "critical" });
    expect(result.priority).toBe("high");
  });

  test("maps high severity to high priority", () => {
    const result = findingToTaskDefaults({ ...baseFinding, severity: "high" });
    expect(result.priority).toBe("high");
  });

  test("maps medium severity to medium priority", () => {
    const result = findingToTaskDefaults({ ...baseFinding, severity: "medium" });
    expect(result.priority).toBe("medium");
  });

  test("maps low severity to low priority", () => {
    const result = findingToTaskDefaults({ ...baseFinding, severity: "low" });
    expect(result.priority).toBe("low");
  });

  test("maps unknown severity to medium priority", () => {
    const result = findingToTaskDefaults({ ...baseFinding, severity: "unknown" });
    expect(result.priority).toBe("medium");
  });

  test("sets finding description as task title", () => {
    const result = findingToTaskDefaults(baseFinding);
    expect(result.title).toBe("Unused import in auth.ts");
  });

  test("sets suggestedFix as task description", () => {
    const result = findingToTaskDefaults(baseFinding);
    expect(result.description).toBe("Remove the unused import statement");
  });

  test("includes category and scanType as labels", () => {
    const result = findingToTaskDefaults(baseFinding);
    expect(result.labels).toContain("code-quality");
    expect(result.labels).toContain("static-analysis");
  });

  test("sets findingId from finding._id", () => {
    const result = findingToTaskDefaults(baseFinding);
    expect(result.findingId).toBe("finding-123");
  });
});
