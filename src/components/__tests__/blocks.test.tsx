import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextBlock } from "../blocks/TextBlock";
import { ErrorBlock } from "../blocks/ErrorBlock";

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
