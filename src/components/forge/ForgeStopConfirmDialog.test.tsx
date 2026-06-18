/**
 * ForgeStopConfirmDialog test (Phase 80, FI-07, D-03) — jsdom render assertions.
 *
 * Asserts the confirm-gate contract:
 *  - The Stop trigger button renders
 *  - onConfirmedStop is NOT called on initial render (no one-click stop, D-03)
 *  - The warning copy mentions "discarded" and "cannot be undone" (D-02)
 *  - Clicking "Yes, stop the job" invokes onConfirmedStop once
 *  - When isStopping=true the button shows "Stopping…" and is disabled (D-04)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ForgeStopConfirmDialog } from "./ForgeStopConfirmDialog";

const defaultProps = {
  jobId: "job-1",
  hostId: "desktop",
  isStopping: false,
  onConfirmedStop: vi.fn(),
};

describe("ForgeStopConfirmDialog — trigger + confirm gate (D-03)", () => {
  it("renders the Stop trigger button", () => {
    render(<ForgeStopConfirmDialog {...defaultProps} />);
    expect(screen.getByRole("button", { name: /stop job/i })).toBeInTheDocument();
  });

  it("does NOT call onConfirmedStop on initial render (no one-click stop)", () => {
    const spy = vi.fn();
    render(<ForgeStopConfirmDialog {...defaultProps} onConfirmedStop={spy} />);
    expect(spy).not.toHaveBeenCalled();
  });

  it("opens the dialog when the Stop trigger is clicked", () => {
    render(<ForgeStopConfirmDialog {...defaultProps} />);
    const trigger = screen.getByRole("button", { name: /stop job/i });
    fireEvent.click(trigger);
    expect(screen.getByText("Stop this job?")).toBeInTheDocument();
  });

  it('calls onConfirmedStop once when "Yes, stop the job" is clicked', () => {
    const spy = vi.fn();
    render(<ForgeStopConfirmDialog {...defaultProps} onConfirmedStop={spy} />);
    // Open the dialog
    const trigger = screen.getByRole("button", { name: /stop job/i });
    fireEvent.click(trigger);
    // Click the confirm action
    const confirm = screen.getByText("Yes, stop the job");
    fireEvent.click(confirm);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onConfirmedStop when Cancel is clicked instead", () => {
    const spy = vi.fn();
    render(<ForgeStopConfirmDialog {...defaultProps} onConfirmedStop={spy} />);
    const trigger = screen.getByRole("button", { name: /stop job/i });
    fireEvent.click(trigger);
    const cancel = screen.getByText("Cancel");
    fireEvent.click(cancel);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("ForgeStopConfirmDialog — warning copy (D-01/D-02)", () => {
  it('description contains "discarded" (D-02)', () => {
    render(<ForgeStopConfirmDialog {...defaultProps} />);
    const trigger = screen.getByRole("button", { name: /stop job/i });
    fireEvent.click(trigger);
    expect(screen.getByText(/discarded/i)).toBeInTheDocument();
  });

  it('description contains "cannot be undone" (D-02)', () => {
    render(<ForgeStopConfirmDialog {...defaultProps} />);
    const trigger = screen.getByRole("button", { name: /stop job/i });
    fireEvent.click(trigger);
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('description contains "taskkill" (D-01 — hard-kill surfaced)', () => {
    render(<ForgeStopConfirmDialog {...defaultProps} />);
    const trigger = screen.getByRole("button", { name: /stop job/i });
    fireEvent.click(trigger);
    expect(screen.getByText(/taskkill/i)).toBeInTheDocument();
  });
});

describe("ForgeStopConfirmDialog — Stopping… state (D-04)", () => {
  it('shows "Stopping…" text when isStopping is true', () => {
    render(<ForgeStopConfirmDialog {...defaultProps} isStopping={true} />);
    expect(screen.getByText(/stopping…/i)).toBeInTheDocument();
  });

  it("button is disabled when isStopping is true", () => {
    render(<ForgeStopConfirmDialog {...defaultProps} isStopping={true} />);
    const btn = screen.getByRole("button", { name: /stop job/i });
    expect(btn).toBeDisabled();
  });

  it('shows "Stop" (active text) when isStopping is false', () => {
    render(<ForgeStopConfirmDialog {...defaultProps} isStopping={false} />);
    expect(screen.getByRole("button", { name: /stop job/i })).toHaveTextContent("Stop");
  });

  it("button is NOT disabled when isStopping is false", () => {
    render(<ForgeStopConfirmDialog {...defaultProps} isStopping={false} />);
    const btn = screen.getByRole("button", { name: /stop job/i });
    expect(btn).not.toBeDisabled();
  });
});
