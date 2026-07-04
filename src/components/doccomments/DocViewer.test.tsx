import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocViewer } from "./DocViewer";

describe("DocViewer", () => {
  it("renders markdown as sanitized HTML (headings become <h1>, no raw script)", () => {
    render(<DocViewer source={"# Title\n\n<script>alert(1)</script>"} comments={[]}
      onSelectAnchor={vi.fn()} onCommentClick={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Title");
    // react-markdown without rehype-raw renders the <script> as text, never executes it
    expect(document.querySelector("script")).toBeNull();
  });
});
