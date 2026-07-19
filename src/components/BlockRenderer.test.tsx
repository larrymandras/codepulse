/**
 * BlockRenderer.test.tsx — guards the run.blocks → chat rendering contract.
 *
 * Regression: astridr emits TextBlock ("text") + ToolUseBlock ("tool_use") in
 * run.blocks on tool-call turns (agent/loop.py). The frontend union had no
 * cases for these, so BlockRenderer's default dumped them as raw JSON into the
 * chat bubble. These tests pin that both render human-readably, never as JSON.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlockRenderer } from "./BlockRenderer";
import type { GenerativeBlock } from "@/types/generative-blocks";

describe("BlockRenderer", () => {
  it("renders a 'text' block as prose, not JSON", () => {
    const block = {
      type: "text",
      text: "The weather in Cumming, Georgia is overcast.",
    } as unknown as GenerativeBlock;

    render(<BlockRenderer block={block} />);

    expect(
      screen.getByText(/The weather in Cumming, Georgia is overcast\./)
    ).toBeInTheDocument();
    // Must NOT leak the block wrapper as JSON.
    expect(screen.queryByText(/"type": "text"/)).not.toBeInTheDocument();
  });

  it("renders a 'tool_use' block as a compact chip (name), not raw JSON", () => {
    const block = {
      type: "tool_use",
      name: "weather",
      arguments: { location: "Cumming, GA", forecast_days: 2 },
    } as unknown as GenerativeBlock;

    render(<BlockRenderer block={block} />);

    // The tool name shows as a chip...
    expect(screen.getByText("weather")).toBeInTheDocument();
    // ...and the raw block JSON never appears in the bubble.
    expect(screen.queryByText(/"type": "tool_use"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/"arguments"/)).not.toBeInTheDocument();
  });

  it("exposes tool arguments on hover (title) without rendering them inline", () => {
    const block = {
      type: "tool_use",
      name: "weather",
      arguments: { location: "Cumming, GA" },
    } as unknown as GenerativeBlock;

    render(<BlockRenderer block={block} />);

    const chip = screen.getByText("weather").closest("span");
    expect(chip).toHaveAttribute("title", expect.stringContaining("Cumming, GA"));
  });

  it("still falls back to a JSON fence for genuinely unknown block types", () => {
    const block = {
      type: "totally_unknown_kind",
      foo: "bar",
    } as unknown as GenerativeBlock;

    render(<BlockRenderer block={block} />);

    expect(screen.getByText(/totally_unknown_kind/)).toBeInTheDocument();
  });
});
