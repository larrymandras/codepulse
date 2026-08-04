import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ToolBreakdown from "./ToolBreakdown";

// D-15 — this file exists purely to assert the "View in Tools ->" cross-link
// added by 105-08. ToolBreakdown had no prior test file (grep-confirmed
// before this plan); its own chart/counting behavior is out of this plan's
// scope and is left uncovered here, matching the plan's own instruction.
function renderBreakdown(events: Array<{ toolName?: string }>) {
  return render(
    <MemoryRouter>
      <ToolBreakdown events={events} />
    </MemoryRouter>
  );
}

describe("ToolBreakdown (Phase 105 D-15)", () => {
  it("renders a 'View in Tools ->' link pointing at /tools", () => {
    renderBreakdown([{ toolName: "Bash" }]);

    const link = screen.getByRole("link", { name: /View in Tools/ });
    expect(link).toHaveAttribute("href", "/tools");
  });

  it("still renders the empty state when there is no tool data", () => {
    renderBreakdown([]);

    expect(screen.getByText("No tool data yet")).toBeInTheDocument();
  });
});
