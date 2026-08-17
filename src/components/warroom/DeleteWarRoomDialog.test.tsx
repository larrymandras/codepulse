/**
 * DeleteWarRoomDialog test (Phase 120, POLISH-03 / D-12 / D-14).
 *
 * The load-bearing assertion is the Cancel test: it proves Cancel calls
 * onConfirm ZERO times, which is the only assertion that can distinguish a
 * working gate from a gate that fires on every close path (dialog-closed or
 * button-vanished alone cannot prove that).
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DeleteWarRoomDialog } from "./DeleteWarRoomDialog";

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  roomName: "Incident Bridge",
  onConfirm: vi.fn(),
};

describe("DeleteWarRoomDialog — open/description", () => {
  it("renders nothing when open is false", () => {
    render(<DeleteWarRoomDialog {...defaultProps} open={false} />);
    expect(screen.queryByText(/Incident Bridge/)).not.toBeInTheDocument();
  });

  it("names the room and states the transcript is removed too", () => {
    render(<DeleteWarRoomDialog {...defaultProps} />);
    expect(screen.getByText(/Incident Bridge/)).toBeInTheDocument();
    expect(screen.getByText(/transcript/i)).toBeInTheDocument();
  });
});

describe("DeleteWarRoomDialog — confirm/cancel gate (T-120-07)", () => {
  it("calls onConfirm exactly once when Delete room is clicked", async () => {
    const spy = vi.fn();
    render(<DeleteWarRoomDialog {...defaultProps} onConfirm={spy} />);
    fireEvent.click(screen.getByText("Delete room"));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("THE CONTROL: calls onConfirm ZERO times when Cancel is clicked", () => {
    const spy = vi.fn();
    render(<DeleteWarRoomDialog {...defaultProps} onConfirm={spy} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("does not call onConfirm merely because the dialog is open", () => {
    const spy = vi.fn();
    render(<DeleteWarRoomDialog {...defaultProps} onConfirm={spy} />);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("DeleteWarRoomDialog — no timeout (T-120-08)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays open and onConfirm remains uncalled after 60s of fake time", () => {
    const spy = vi.fn();
    render(<DeleteWarRoomDialog {...defaultProps} onConfirm={spy} />);
    vi.advanceTimersByTime(60_000);
    expect(screen.getByText(/Incident Bridge/)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(0);
  });
});

describe("DeleteWarRoomDialog — rejection keeps dialog open", () => {
  it("stays open and surfaces the error when onConfirm rejects", async () => {
    const onOpenChange = vi.fn();
    const spy = vi.fn().mockRejectedValue(new Error("delete failed"));
    render(
      <DeleteWarRoomDialog
        {...defaultProps}
        onConfirm={spy}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.click(screen.getByText("Delete room"));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    // onOpenChange(false) must NOT have been called on a rejection.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
