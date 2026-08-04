import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks (must precede the component import) ───────────────────────────────
// Trivial stubs so this page test does not re-test ToolUsagePanel's or
// ToolPolicyFeed's own internals (105-06/105-07 already own that coverage).
// A module-level flag lets one test flip ToolUsagePanel into a throwing
// component to prove the two SectionErrorBoundary wraps are independent
// (D-16 / the 3b31c9f4 isolation control).
let usagePanelShouldThrow = false;

vi.mock("../components/ToolUsagePanel", () => ({
  default: () => {
    if (usagePanelShouldThrow) {
      throw new Error("Tool Usage query timed out");
    }
    return <div data-testid="tool-usage-panel-stub">Tool Usage Panel Stub</div>;
  },
}));

vi.mock("../components/ToolPolicyFeed", () => ({
  default: () => <div data-testid="tool-policy-feed-stub">Tool Policy Feed Stub</div>,
}));

import Tools from "./Tools";

function renderTools() {
  return render(
    <MemoryRouter>
      <Tools />
    </MemoryRouter>
  );
}

describe("Tools page (Phase 105 D-13/D-14/D-16)", () => {
  beforeEach(() => {
    usagePanelShouldThrow = false;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders both section boundaries' children when both child components render normally", () => {
    renderTools();

    expect(screen.getByTestId("tool-usage-panel-stub")).toBeInTheDocument();
    expect(screen.getByTestId("tool-policy-feed-stub")).toBeInTheDocument();
  });

  it("renders the usage section before the policy section (D-16 order)", () => {
    const { container } = renderTools();
    const html = container.innerHTML;
    expect(html.indexOf("tool-usage-panel-stub")).toBeLessThan(
      html.indexOf("tool-policy-feed-stub")
    );
  });

  it("boundary isolation: when ToolUsagePanel throws, the policy feed still renders", () => {
    usagePanelShouldThrow = true;

    renderTools();

    expect(screen.getByText("Tool Usage failed to load")).toBeInTheDocument();
    expect(screen.getByTestId("tool-policy-feed-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("tool-usage-panel-stub")).not.toBeInTheDocument();
  });

  it("renders no tab-role element", () => {
    renderTools();

    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryAllByRole("tablist")).toHaveLength(0);
  });

  it("renders a page title and a cross-link out to the session Trace view", () => {
    renderTools();

    expect(screen.getByRole("heading", { name: "Tools" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute("href", "/");
  });
});
