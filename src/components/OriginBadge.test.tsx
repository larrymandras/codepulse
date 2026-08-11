import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import OriginBadge from "./OriginBadge";

describe("OriginBadge — plugin origin parity (D-17)", () => {
  it("renders a distinct badge for the plugin origin (not null)", () => {
    const { container, getByText } = render(<OriginBadge origin="claude-code:plugin" />);
    expect(container.firstChild).not.toBeNull();
    expect(getByText("Plugin")).toBeInTheDocument();
  });

  it("still renders 'Claude Code' for the personal origin — unchanged", () => {
    const { getByText } = render(<OriginBadge origin="claude-code" />);
    expect(getByText("Claude Code")).toBeInTheDocument();
  });

  it("still renders the project style for a project origin — the startsWith branch is undisturbed", () => {
    const { getByText } = render(<OriginBadge origin="claude-code:project:abc123" />);
    expect(getByText("Project")).toBeInTheDocument();
  });

  it("CONTROL: an unrecognized origin still renders nothing — the null path is intact", () => {
    const { container } = render(<OriginBadge origin="some-unknown-origin-9x7q2" />);
    expect(container.firstChild).toBeNull();
  });
});
