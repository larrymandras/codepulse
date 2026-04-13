import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BlockRenderer from "@/components/BlockRenderer";

describe("BlockRenderer", () => {
  test("renders MetricCard for block type 'metric' with label, value, trend props", () => {
    render(
      <BlockRenderer
        block={{ type: "metric", label: "Cost", value: 42.5, trend: "up" }}
      />
    );
    expect(screen.getByText("Cost")).toBeInTheDocument();
    expect(screen.getByText("42.5")).toBeInTheDocument();
  });

  test("renders TableBlock for block type 'table' with columns and rows", () => {
    render(
      <BlockRenderer
        block={{ type: "table", columns: ["Name", "Value"], rows: [["a", 1]] }}
      />
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("a")).toBeInTheDocument();
  });

  test("renders ChartBlock (FlexBarChart) for block type 'chart' with data array", () => {
    render(
      <BlockRenderer
        block={{ type: "chart", data: [{ label: "X", value: 10 }], title: "My Chart" }}
      />
    );
    expect(screen.getByText("My Chart")).toBeInTheDocument();
  });

  test("renders CodeBlock for block type 'code' with language and content", () => {
    const { container } = render(
      <BlockRenderer
        block={{ type: "code", language: "typescript", content: "const x = 1" }}
      />
    );
    // SyntaxHighlighter splits tokens into spans — check the pre element exists
    // and that the full text content is present somewhere in the container
    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain("const");
    expect(pre?.textContent).toContain("x");
    expect(pre?.textContent).toContain("1");
  });

  test("renders CodeBlock for block type 'diff' with before, after, language", () => {
    render(
      <BlockRenderer
        block={{ type: "diff", before: "old code", after: "new code" }}
      />
    );
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
  });

  test("renders ApprovalBlock for block type 'approval' with requestId, action, riskLevel", () => {
    render(
      <BlockRenderer
        block={{
          type: "approval",
          requestId: "r1",
          action: "deploy",
          details: {},
          riskLevel: "medium",
        }}
      />
    );
    expect(screen.getByText("deploy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
  });

  test("renders markdown content for block type 'markdown'", () => {
    render(
      <BlockRenderer block={{ type: "markdown", content: "# Hello" }} />
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  test("renders fallback markdown for unknown block type per D-06", () => {
    render(
      <BlockRenderer block={{ type: "custom", foo: "bar" } as never} />
    );
    // Should render JSON content inside a code block
    expect(screen.getByText(/foo/)).toBeInTheDocument();
  });
});
