import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextBlock } from "../blocks/TextBlock";
import { ErrorBlock } from "../blocks/ErrorBlock";
import { ThinkingBlock } from "../blocks/ThinkingBlock";

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
