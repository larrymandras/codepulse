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

import { BrainControl, formatVendorLabel, groupByVendor, type CatalogueEntry } from "./BrainControl";

describe("formatVendorLabel", () => {
  it("maps known vendor slugs to their human-readable label", () => {
    expect(formatVendorLabel("anthropic")).toBe("Anthropic");
    expect(formatVendorLabel("x-ai")).toBe("xAI");
    expect(formatVendorLabel("moonshotai")).toBe("Moonshot");
    expect(formatVendorLabel("google")).toBe("Google");
  });

  it("titleizes an unknown vendor slug rather than showing it raw", () => {
    expect(formatVendorLabel("poolside")).toBe("Poolside");
    expect(formatVendorLabel("thinkingmachines")).toBe("Thinkingmachines");
    expect(formatVendorLabel("inclusion-ai")).toBe("Inclusion Ai");
  });
});

describe("groupByVendor", () => {
  it("partitions an already-sorted list into contiguous vendor groups", () => {
    const entries: CatalogueEntry[] = [
      { id: "claude-opus-4-8", name: "Claude Opus 4.8", vendor: "anthropic" },
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", vendor: "anthropic" },
      { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash", vendor: "google" },
      { id: "x-ai/grok-4.5", name: "Grok 4.5", vendor: "x-ai" },
    ];
    const groups = groupByVendor(entries);
    expect(groups.map((g) => g.label)).toEqual(["Anthropic", "Google", "xAI"]);
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[1].entries).toHaveLength(1);
    expect(groups[2].entries).toHaveLength(1);
  });

  it("groups entries with no vendor into a single trailing Other group", () => {
    const entries: CatalogueEntry[] = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    const groups = groupByVendor(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Other");
    expect(groups[0].entries).toHaveLength(2);
  });
});

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

  // ── 103-15: hardened coverage for the pre-existing restore path ─────────
  // (103-15-PLAN's premise that this branch was unreachable does not hold
  // for this file -- see 103-15-SUMMARY.md "Deviations". The affordance and
  // its dispatch/gating tests above predate this plan (186-09, commit
  // 6cc040d3). These three tests close the specific coverage gaps the plan
  // called out: no-double-fire, disabled-while-pending, and the D-14
  // no-self-asserted-success guard.)

  it("dispatches exactly one swap.set command per Restore-usual-brain activation (no double-fire)", async () => {
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

    await waitFor(() => {
      const swapSetCalls = mockSendCommand.mock.calls.filter(
        ([cmd]) => (cmd as Record<string, unknown>).type === "swap.set"
      );
      expect(swapSetCalls).toHaveLength(1);
    });
  });

  it("disables the Restore usual brain row while its dispatch is pending", async () => {
    let resolveSwapSet: (value: unknown) => void = () => {};
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "swap.catalogue") {
        return { type: "ack", request_id: "r1", status: "ok", target: "brain", entries: [] };
      }
      return new Promise((resolve) => {
        resolveSwapSet = resolve;
      });
    });

    render(<BrainControl override="grok-4.5" lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    const restoreRow = await screen.findByText("Restore usual brain");
    fireEvent.click(restoreRow);

    await waitFor(() => expect(restoreRow.closest("button")).toBeDisabled());

    resolveSwapSet({ type: "ack", request_id: "r1", status: "ok" });
    await waitFor(() =>
      expect(mockSendCommand).toHaveBeenCalledWith(
        expect.objectContaining({ type: "swap.set", restore: true })
      )
    );
  });

  it("never self-asserts the override was cleared -- label reflects only the override prop (D-14)", async () => {
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "swap.catalogue") {
        return { type: "ack", request_id: "r1", status: "ok", target: "brain", entries: [] };
      }
      // Ack only -- ACCEPTED, not SWITCHED (D-14). BrainControl must not
      // treat this as proof the override was cleared.
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    const { rerender } = render(<BrainControl override="grok-4.5" lastTurnModel={null} />);
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

    // The ack alone must not flip the label -- BrainControl carries no local
    // "cleared" state; it renders `override` verbatim until the parent
    // re-renders with a new value fed by the swap.state readback
    // (useResolvedBrain). No self-asserted success text is ever rendered.
    expect(screen.getByText("grok-4.5")).toBeInTheDocument();
    expect(screen.queryByText(/clear/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Auto")).not.toBeInTheDocument();

    // Only once the parent re-renders with the readback-confirmed value does
    // the label change.
    rerender(<BrainControl override={null} lastTurnModel={null} />);
    expect(screen.getByText("Auto")).toBeInTheDocument();
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

  // ── Checkpoint round 1 (Larry): truncation + missing-models fixes ───────

  it("never truncates a catalogue entry's name (no truncate class on the row)", async () => {
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "r1",
      status: "ok",
      target: "brain",
      entries: [{ id: "x-ai/grok-4.5", name: "Grok 4.5", vendor: "x-ai" }],
    });

    render(<BrainControl override={null} lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    const nameEl = await screen.findByText("Grok 4.5");
    // The row wraps rather than truncates -- assert the wrapping classes
    // are present and the old single-line "truncate" utility is gone.
    const row = nameEl.closest("button")!;
    expect(row.className).toContain("whitespace-normal");
    expect(row.className).toContain("break-words");
    expect(row.className).not.toContain("truncate");
  });

  it("filters the catalogue by name as the user types", async () => {
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "r1",
      status: "ok",
      target: "brain",
      entries: [
        { id: "x-ai/grok-4.5", name: "Grok 4.5", vendor: "x-ai" },
        { id: "moonshotai/kimi-k3", name: "Kimi K3", vendor: "moonshotai" },
      ],
    });

    render(<BrainControl override={null} lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    await screen.findByText("Grok 4.5");
    expect(screen.getByText("Kimi K3")).toBeInTheDocument();

    const filterInput = screen.getByLabelText("Filter brain catalogue");
    fireEvent.change(filterInput, { target: { value: "kimi" } });

    expect(screen.queryByText("Grok 4.5")).not.toBeInTheDocument();
    expect(screen.getByText("Kimi K3")).toBeInTheDocument();
  });

  it("shows a no-match message when the filter matches nothing", async () => {
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "r1",
      status: "ok",
      target: "brain",
      entries: [{ id: "x-ai/grok-4.5", name: "Grok 4.5", vendor: "x-ai" }],
    });

    render(<BrainControl override={null} lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    await screen.findByText("Grok 4.5");
    fireEvent.change(screen.getByLabelText("Filter brain catalogue"), {
      target: { value: "nonexistent-vendor" },
    });

    expect(await screen.findByText('No brains match "nonexistent-vendor".')).toBeInTheDocument();
  });

  it("re-fetches the catalogue on every open rather than caching client-side", async () => {
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "r1",
      status: "ok",
      target: "brain",
      entries: [{ id: "x-ai/grok-4.5", name: "Grok 4.5", vendor: "x-ai" }],
    });

    render(<BrainControl override={null} lastTurnModel={null} />);
    const trigger = screen.getByRole("button", { name: "Choose brain" });

    fireEvent.click(trigger); // open
    await screen.findByText("Grok 4.5");
    fireEvent.click(trigger); // close
    fireEvent.click(trigger); // re-open

    await waitFor(() => {
      const catalogueCalls = mockSendCommand.mock.calls.filter(
        ([cmd]) => (cmd as Record<string, unknown>).type === "swap.catalogue"
      );
      expect(catalogueCalls.length).toBe(2);
    });
  });

  // ── Checkpoint round 3 (Larry): provider grouping ────────────────────────

  it("renders a provider section header per vendor, Anthropic first", async () => {
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "r1",
      status: "ok",
      target: "brain",
      entries: [
        { id: "claude-opus-4-8", name: "Claude Opus 4.8", vendor: "anthropic" },
        { id: "claude-sonnet-5", name: "Claude Sonnet 5", vendor: "anthropic" },
        { id: "x-ai/grok-4.5", name: "Grok 4.5", vendor: "x-ai" },
      ],
    });

    render(<BrainControl override={null} lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    await screen.findByText("Claude Opus 4.8");
    const headers = screen.getAllByText(/^(Anthropic|xAI)$/);
    expect(headers.map((h) => h.textContent)).toEqual(["Anthropic", "xAI"]);
    // Anthropic header appears before the xAI header in document order.
    expect(headers[0].compareDocumentPosition(headers[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hides a group's header entirely once filtering empties it", async () => {
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "r1",
      status: "ok",
      target: "brain",
      entries: [
        { id: "claude-opus-4-8", name: "Claude Opus 4.8", vendor: "anthropic" },
        { id: "x-ai/grok-4.5", name: "Grok 4.5", vendor: "x-ai" },
      ],
    });

    render(<BrainControl override={null} lastTurnModel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose brain" }));

    await screen.findByText("Claude Opus 4.8");
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText("xAI")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter brain catalogue"), {
      target: { value: "grok" },
    });

    expect(screen.queryByText("Anthropic")).not.toBeInTheDocument();
    expect(screen.getByText("xAI")).toBeInTheDocument();
  });
});
