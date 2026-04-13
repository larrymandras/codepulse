import { describe, test } from "vitest";

describe("BlockRenderer", () => {
  test.todo("renders MetricCard for block type 'metric' with label, value, trend props");
  test.todo("renders TableBlock for block type 'table' with columns and rows");
  test.todo("renders ChartBlock (FlexBarChart) for block type 'chart' with data array");
  test.todo("renders CodeBlock for block type 'code' with language and content");
  test.todo("renders CodeBlock for block type 'diff' with before, after, language");
  test.todo("renders ApprovalBlock for block type 'approval' with requestId, action, riskLevel");
  test.todo("renders markdown content for block type 'markdown'");
  test.todo("renders fallback markdown for unknown block type per D-06");
});
