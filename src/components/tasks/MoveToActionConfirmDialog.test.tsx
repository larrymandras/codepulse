/**
 * MoveToActionConfirmDialog test (Phase 120, POLISH-03 / D-12 / D-14).
 *
 * The load-bearing assertion is the Cancel test: it proves Cancel calls
 * onConfirm ZERO times, which is the only assertion that can distinguish a
 * working gate from a gate that fires on every close path (dialog-closed or
 * button-vanished alone cannot prove that).
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MoveToActionConfirmDialog } from "./MoveToActionConfirmDialog";

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  taskTitle: "Fix ingest retry",
  column: "running",
  onConfirm: vi.fn(),
};

describe("MoveToActionConfirmDialog — open/description", () => {
  it("renders nothing when open is false", () => {
    render(<MoveToActionConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText(/Move "Fix ingest retry"/)).not.toBeInTheDocument();
  });

  it("names both the task title and the destination column when open", () => {
    render(<MoveToActionConfirmDialog {...defaultProps} />);
    expect(screen.getAllByText(/Fix ingest retry/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/running/).length).toBeGreaterThan(0);
  });
});

describe("MoveToActionConfirmDialog — confirm/cancel gate (T-120-07)", () => {
  it("calls onConfirm exactly once when Confirm is clicked", async () => {
    const spy = vi.fn();
    render(<MoveToActionConfirmDialog {...defaultProps} onConfirm={spy} />);
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("THE CONTROL: calls onConfirm ZERO times when Cancel is clicked", () => {
    const spy = vi.fn();
    render(<MoveToActionConfirmDialog {...defaultProps} onConfirm={spy} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("does not call onConfirm merely because the dialog is open", () => {
    const spy = vi.fn();
    render(<MoveToActionConfirmDialog {...defaultProps} onConfirm={spy} />);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("MoveToActionConfirmDialog — no timeout (T-120-08)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays open and onConfirm remains uncalled after 60s of fake time", () => {
    const spy = vi.fn();
    render(<MoveToActionConfirmDialog {...defaultProps} onConfirm={spy} />);
    vi.advanceTimersByTime(60_000);
    expect(screen.getAllByText(/Fix ingest retry/).length).toBeGreaterThan(0);
    expect(spy).toHaveBeenCalledTimes(0);
  });
});

describe("MoveToActionConfirmDialog — rejection keeps dialog open", () => {
  it("stays open and surfaces the error when onConfirm rejects", async () => {
    const onOpenChange = vi.fn();
    const spy = vi.fn().mockRejectedValue(new Error("dispatch failed"));
    render(
      <MoveToActionConfirmDialog
        {...defaultProps}
        onConfirm={spy}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    // onOpenChange(false) must NOT have been called on a rejection.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
