import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HotReloadBar from "../HotReloadBar";

describe("HotReloadBar", () => {
  it("shows 'Sending...' with spinner in pending state", () => {
    const { container } = render(<HotReloadBar status="pending" />);
    expect(screen.getByText("Sending...")).toBeInTheDocument();
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows 'Validating...' with spinner in validating state", () => {
    const { container } = render(<HotReloadBar status="validating" />);
    expect(screen.getByText("Validating...")).toBeInTheDocument();
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows 'Applied.' in applied state with ok color", () => {
    render(<HotReloadBar status="applied" />);
    expect(screen.getByText("Applied.")).toBeInTheDocument();
  });

  it("shows 'Confirmed by Astrid.' with checkmark in confirmed state", () => {
    render(<HotReloadBar status="confirmed" />);
    expect(screen.getByText("Confirmed by Astrid.")).toBeInTheDocument();
  });

  it("shows error message with XCircle in error state", () => {
    render(<HotReloadBar status="error" errorMessage="Bad YAML" />);
    expect(screen.getByText("Apply failed: Bad YAML")).toBeInTheDocument();
  });

  it("renders nothing when status is null", () => {
    const { container } = render(<HotReloadBar status={null} />);
    expect(container.firstChild).toBeNull();
  });
});
