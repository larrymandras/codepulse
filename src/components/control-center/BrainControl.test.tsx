import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSendCommand = vi.fn();

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: vi.fn(() => ({
    status: "connected",
    sendCommand: mockSendCommand,
    subscribe: vi.fn(() => vi.fn()),
    subscribeEvent: vi.fn(() => vi.fn()),
    reconnect: vi.fn(),
  })),
}));

import { BrainControl } from "./BrainControl";

describe("BrainControl", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
  });

  it("fetches the live catalogue via swap.catalogue when opened", async () => {
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "r1",
      status: "ok",
      target: "brain",
      entries: [{ id: "x-ai/grok-4.5", name: "Grok 4.5", vendor: "x-ai" }],
    });

    render(<BrainControl override={null} lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    await waitFor(() =>
      expect(mockSendCommand).toHaveBeenCalledWith({ type: "swap.catalogue", target: "brain" })
    );
    expect(await screen.findByText("Grok 4.5")).toBeInTheDocument();
  });

  it("shows a loading skeleton while the catalogue fetch is in flight", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    mockSendCommand.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    render(<BrainControl override={null} lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    expect(await screen.findByLabelText("Loading brain catalogue")).toBeInTheDocument();

    resolveFetch({
      type: "ack",
      request_id: "r1",
      status: "ok",
      target: "brain",
      entries: [],
    });
    await waitFor(() =>
      expect(screen.queryByLabelText("Loading brain catalogue")).not.toBeInTheDocument()
    );
  });

  it("renders understated error copy when the catalogue fetch fails", async () => {
    mockSendCommand.mockRejectedValue(new Error("boom"));

    render(<BrainControl override={null} lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    expect(
      await screen.findByText("Couldn't load the brain catalogue — try again in a moment.")
    ).toBeInTheDocument();
  });

  it("selecting a catalogue entry dispatches swap.set with the chosen value", async () => {
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "swap.catalogue") {
        return {
          type: "ack",
          request_id: "r1",
          status: "ok",
          target: "brain",
          entries: [{ id: "x-ai/grok-4.5", name: "Grok 4.5", vendor: "x-ai" }],
        };
      }
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<BrainControl override={null} lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    const entry = await screen.findByText("Grok 4.5");
    fireEvent.click(entry);

    await waitFor(() =>
      expect(mockSendCommand).toHaveBeenCalledWith({
        type: "swap.set",
        target: "brain",
        value: "x-ai/grok-4.5",
        restore: false,
      })
    );
  });

  it('shows a "Restore usual brain" row only when an override is active', async () => {
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "r1",
      status: "ok",
      target: "brain",
      entries: [],
    });

    const { rerender } = render(<BrainControl override={null} lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalled());
    expect(screen.queryByText("Restore usual brain")).not.toBeInTheDocument();

    // Popover is already open from the click above (rerender does not
    // remount/close it) -- an override going active should surface the
    // Restore row immediately, without a second click.
    rerender(<BrainControl override="grok-4.5" lastTurnModel={null} />);
    expect(await screen.findByText("Restore usual brain")).toBeInTheDocument();
  });

  it('dispatches swap.set with restore=true when "Restore usual brain" is clicked', async () => {
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "swap.catalogue") {
        return { type: "ack", request_id: "r1", status: "ok", target: "brain", entries: [] };
      }
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<BrainControl override="grok-4.5" lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    const restoreRow = await screen.findByText("Restore usual brain");
    fireEvent.click(restoreRow);

    await waitFor(() =>
      expect(mockSendCommand).toHaveBeenCalledWith({
        type: "swap.set",
        target: "brain",
        value: undefined,
        restore: true,
      })
    );
  });

  it("shows the override label when active, falling back to lastTurnModel then Auto", () => {
    const { rerender } = render(<BrainControl override={null} lastTurnModel={null} />);
    expect(screen.getByText("Auto")).toBeInTheDocument();

    rerender(<BrainControl override={null} lastTurnModel="claude-sonnet-5" />);
    expect(screen.getByText("claude-sonnet-5")).toBeInTheDocument();

    rerender(<BrainControl override="grok-4.5" lastTurnModel="claude-sonnet-5" />);
    expect(screen.getByText("grok-4.5")).toBeInTheDocument();
    expect(screen.queryByText("claude-sonnet-5")).not.toBeInTheDocument();
  });
});
