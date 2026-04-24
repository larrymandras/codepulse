import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { TextBlock } from "../blocks/TextBlock";
import { ErrorBlock } from "../blocks/ErrorBlock";
import { ThinkingBlock } from "../blocks/ThinkingBlock";
import { ToolCallBlock } from "../blocks/ToolCallBlock";

describe("TextBlock", () => {
  it("renders text content", () => {
    render(<TextBlock block={{ type: "text", text: "Hello world" }} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders empty string when text is missing", () => {
    const { container } = render(<TextBlock block={{ type: "text" }} />);
    expect(container.querySelector("p")).toBeInTheDocument();
  });
});

describe("ErrorBlock", () => {
  it("renders error type and message", () => {
    render(
      <ErrorBlock
        block={{ type: "error", error_type: "TimeoutError", message: "Request timed out" }}
      />
    );
    expect(screen.getByText("TimeoutError")).toBeInTheDocument();
    expect(screen.getByText("Request timed out")).toBeInTheDocument();
  });

  it("renders fallback when error_type is missing", () => {
    render(<ErrorBlock block={{ type: "error", message: "Something broke" }} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});

describe("ThinkingBlock", () => {
  it("renders round number badge", () => {
    render(
      <ThinkingBlock
        block={{ type: "thinking", round_num: 3, thinking_text: "Analyzing..." }}
        streaming={false}
      />
    );
    expect(screen.getByText("Round 3")).toBeInTheDocument();
  });

  it("renders thinking text preview collapsed by default", () => {
    render(
      <ThinkingBlock
        block={{ type: "thinking", round_num: 1, thinking_text: "Deep analysis of the problem" }}
        streaming={false}
      />
    );
    const details = screen.getByRole("group");
    expect(details).not.toHaveAttribute("open");
  });

  it("has amber left stripe", () => {
    const { container } = render(
      <ThinkingBlock
        block={{ type: "thinking", round_num: 1, thinking_text: "Thinking..." }}
        streaming={false}
      />
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("border-l-(--status-warn)");
  });

  it("shows pulse animation when streaming", () => {
    const { container } = render(
      <ThinkingBlock
        block={{ type: "thinking", round_num: 1, thinking_text: "Thinking..." }}
        streaming={true}
      />
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("does not pulse when not streaming", () => {
    const { container } = render(
      <ThinkingBlock
        block={{ type: "thinking", round_num: 1, thinking_text: "Done thinking" }}
        streaming={false}
      />
    );
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});

describe("ToolCallBlock", () => {
  const block = {
    type: "tool_call",
    tool_name: "web_search",
    arguments: { query: "test query", limit: 10 },
    result: "Found 3 results for test query",
    status: "success",
  };

  it("renders tool name as header", () => {
    render(<ToolCallBlock block={block} />);
    expect(screen.getByText("web_search")).toBeInTheDocument();
  });

  it("has blue left stripe", () => {
    const { container } = render(<ToolCallBlock block={block} />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("border-l-(--primary)");
  });

  it("shows green indicator for success status", () => {
    const { container } = render(<ToolCallBlock block={block} />);
    expect(container.querySelector(".bg-green-500")).not.toBeNull();
  });

  it("shows red indicator for error status", () => {
    const { container } = render(
      <ToolCallBlock block={{ ...block, status: "error" }} />
    );
    expect(container.querySelector(".bg-red-500")).not.toBeNull();
  });

  it("shows arguments when expanded", () => {
    render(<ToolCallBlock block={block} />);
    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);
    expect(screen.getByText(/"query": "test query"/)).toBeInTheDocument();
  });

  it("shows result when expanded", () => {
    render(<ToolCallBlock block={block} />);
    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);
    expect(screen.getByText(/Found 3 results/)).toBeInTheDocument();
  });

  it("shows args summary when collapsed", () => {
    render(<ToolCallBlock block={block} />);
    expect(screen.getByText(/query.*test query/)).toBeInTheDocument();
  });
});
