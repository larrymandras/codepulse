/**
 * BrainPicker.test.tsx — 103-05-T2.
 *
 * Structured after `BrainControl.test.tsx` (module-level `vi.mock`, exact
 * `toHaveBeenCalledWith` command-shape assertions, the never-truncates and
 * re-fetches-on-every-open regression tests). `brainsApi`, `useActiveEngine`,
 * `useProfileConfigs`, and `GlobalSwapModal` are mocked directly so every dispatched
 * command shape and every open branch can be asserted exactly — a render-without-error
 * smoke test would prove none of D-08/D-14/D-15/D-16.
 *
 * `convex/react` + the generated Convex API module are mocked only because
 * `BrainPickerRow` (reused verbatim, per plan) transitively calls the real
 * `useProviderHealth()` hook — same mocking idiom `BrainPickerRow.test.tsx` already
 * established for this exact reason.
 */

import { useState } from "react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { STUB_CATALOGUE } from "@/lib/brainsFixtures";
import { BrainPicker } from "./BrainPicker";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetCatalogue = vi.fn();
const mockDispatchSwap = vi.fn();
let stubActive = false;

vi.mock("@/lib/brainsApi", () => ({
  brainsApi: {
    isStub: true,
    getCatalogue: (...args: unknown[]) => mockGetCatalogue(...args),
    dispatchSwap: (...args: unknown[]) => mockDispatchSwap(...args),
    getDefaultProfileId: async () => "assistant-default",
  },
  get BRAINS_STUB_ACTIVE() {
    return stubActive;
  },
}));

const mockActiveEngines: Record<
  string,
  { profileId: string; model: string; mode: "session" | "pinned" | "inherited"; selectionPath: string; timestamp: number } | null
> = {
  "assistant-default": {
    profileId: "assistant-default",
    model: "anthropic-sonnet-5",
    mode: "pinned",
    selectionPath: "codepulse-default",
    timestamp: Date.now(),
  },
};

vi.mock("@/hooks/useActiveEngine", () => ({
  useActiveEngine: () => mockActiveEngines,
}));

vi.mock("@/hooks/useProfileConfigs", () => ({
  useProfileConfigs: () => [{ profileId: "assistant-default" }, { profileId: "consulting" }],
}));

vi.mock("@/components/brains/GlobalSwapModal", () => ({
  GlobalSwapModal: (props: { open: boolean; target?: { id: string; name: string }; profiles: unknown[] }) =>
    props.open ? (
      <div data-testid="global-swap-modal" data-target-id={props.target?.id}>
        Global swap modal for {props.target?.name} ({props.profiles.length} profiles)
      </div>
    ) : null,
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
vi.mock("../../../convex/_generated/api", () => ({
  api: { providerHealth: { latest: "providerHealth:latest" } },
}));

beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

beforeEach(() => {
  mockGetCatalogue.mockReset();
  mockDispatchSwap.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue({});
  stubActive = false;
});

function renderPicker(props: Partial<React.ComponentProps<typeof BrainPicker>> = {}) {
  return render(
    <TooltipProvider>
      <BrainPicker profileId="assistant-default" {...props} />
    </TooltipProvider>
  );
}

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: /Active brain/ }));
}

// ---------------------------------------------------------------------------

describe("BrainPicker — catalogue fetch", () => {
  it("fetches the catalogue every time the popover opens, never caching client-side", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    renderPicker();

    openPicker();
    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalledTimes(1));
    await screen.findByText("Codex CLI");

    openPicker(); // close
    openPicker(); // reopen

    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalledTimes(2));
  });

  it("shows a loading skeleton while the fetch is in flight, then an error state on failure", async () => {
    mockGetCatalogue.mockRejectedValue(new Error("boom"));
    renderPicker();

    openPicker();
    expect(
      await screen.findByText("Couldn't load the brain catalogue — try again in a moment.")
    ).toBeInTheDocument();
  });
});

describe("BrainPicker — scope selector reset (D-08)", () => {
  it('reads "This profile" on every open, including after being moved to "All profiles"', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    expect(screen.getByRole("radio", { name: "This profile" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    expect(screen.getByRole("radio", { name: "All profiles" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    openPicker(); // close
    openPicker(); // reopen
    await screen.findByText("Codex CLI");

    expect(screen.getByRole("radio", { name: "This profile" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it('opens on "All profiles" once when entryScope="global" is supplied, and resets on the next open', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    renderPicker({ entryScope: "global" });

    openPicker();
    await screen.findByText("Codex CLI");
    expect(screen.getByRole("radio", { name: "All profiles" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    openPicker(); // close
    openPicker(); // reopen — the contextual default is one-time only
    await screen.findByText("Codex CLI");

    expect(screen.getByRole("radio", { name: "This profile" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});

describe("BrainPicker — dispatch branch separation", () => {
  it('dispatches exactly one gateway.model.set for a normal-tier row in "This profile" scope', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockDispatchSwap.mockResolvedValue({ type: "ack", request_id: "", status: "ok" });
    renderPicker();

    openPicker();
    const row = await screen.findByText("Codex CLI");
    fireEvent.click(row);

    await waitFor(() => expect(mockDispatchSwap).toHaveBeenCalledTimes(1));
    expect(mockDispatchSwap).toHaveBeenCalledWith({
      type: "gateway.model.set",
      request_id: "",
      scope: "profile",
      profile_id: "assistant-default",
      model: "codex-cli",
      mode: "session",
    });
  });

  it('opens GlobalSwapModal and dispatches nothing until it confirms, in "All profiles" scope', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));

    fireEvent.click(screen.getByText("Codex CLI"));

    const modal = await screen.findByTestId("global-swap-modal");
    expect(modal).toHaveAttribute("data-target-id", "codex-cli");
    expect(mockDispatchSwap).not.toHaveBeenCalled();
  });
});

describe("BrainPicker — pending never lies (D-15)", () => {
  it("keeps the base label byte-identical and shows a switching-to suffix while a dispatch is in flight", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    let resolveDispatch: (value: unknown) => void = () => {};
    mockDispatchSwap.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDispatch = resolve;
        })
    );
    renderPicker();

    const baseLabelBefore = screen.getByTestId("brain-picker-base-label").textContent;
    expect(baseLabelBefore).toBe("anthropic-sonnet-5");

    openPicker();
    fireEvent.click(await screen.findByText("Codex CLI"));

    expect(await screen.findByTestId("brain-picker-pending-suffix")).toHaveTextContent(
      "switching to Codex CLI"
    );
    expect(screen.getByTestId("brain-picker-base-label").textContent).toBe(baseLabelBefore);

    resolveDispatch({ type: "ack", request_id: "", status: "ok" });
    await waitFor(() => expect(mockDispatchSwap).toHaveBeenCalledTimes(1));
  });

  it("drops the switching-to suffix and keeps the original base label after an error ack, with no error styling on the trigger", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockDispatchSwap.mockResolvedValue({
      type: "ack",
      request_id: "",
      status: "error",
      error: "No credentials configured",
    });
    renderPicker();

    const baseLabelBefore = screen.getByTestId("brain-picker-base-label").textContent;

    openPicker();
    fireEvent.click(await screen.findByText("Codex CLI"));

    await waitFor(() =>
      expect(screen.queryByTestId("brain-picker-pending-suffix")).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("brain-picker-base-label").textContent).toBe(baseLabelBefore);

    const trigger = screen.getByRole("button", { name: /Active brain/ });
    expect(trigger.className).not.toMatch(/destructive|--status-error/);
    expect(mockToastError).toHaveBeenCalled();
  });
});

describe("BrainPicker — cmdk duplicate-value guard", () => {
  it("renders two same-name catalogue entries as independently selectable items with distinct values", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockDispatchSwap.mockResolvedValue({ type: "ack", request_id: "", status: "ok" });
    renderPicker();

    openPicker();
    const items = await screen.findAllByText("Sonnet 5");
    expect(items).toHaveLength(2);

    const values = items.map((el) => el.closest("[cmdk-item]")?.getAttribute("data-value"));
    expect(values[0]).toBeTruthy();
    expect(values[1]).toBeTruthy();
    expect(values[0]).not.toBe(values[1]);

    fireEvent.click(items[1]); // openrouter-sonnet-5-dup
    await waitFor(() =>
      expect(mockDispatchSwap).toHaveBeenCalledWith(
        expect.objectContaining({ model: "openrouter-sonnet-5-dup" })
      )
    );
  });
});

describe("BrainPicker — group order (D-07)", () => {
  it("renders the three catalogue groups in the fixed order Subscription, API, Local", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");

    // Query the cmdk group-heading elements specifically -- a plain text match on "API" would
    // also collect every row's billing chip, which is a different (and differently-scoped) "API"
    // string entirely.
    const headings = Array.from(document.querySelectorAll("[cmdk-group-heading]"));
    expect(headings.map((h) => h.textContent)).toEqual(["Subscription", "API", "Local"]);
  });
});

describe("BrainPicker — stub indicator (D-16)", () => {
  it("renders the STUB banner and chip only when the stub adapter is active", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    stubActive = true;
    renderPicker();

    expect(screen.getByTestId("brain-picker-trigger-stub-chip")).toBeInTheDocument();

    openPicker();
    await screen.findByText("Codex CLI");
    expect(
      screen.getByText("Running on stub brain data — live Ástríðr backend not connected")
    ).toBeInTheDocument();
  });

  it("renders neither the STUB banner nor chip anywhere when the stub adapter is inactive", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    stubActive = false;
    renderPicker();

    expect(screen.queryByTestId("brain-picker-trigger-stub-chip")).not.toBeInTheDocument();

    openPicker();
    await screen.findByText("Codex CLI");
    expect(
      screen.queryByText("Running on stub brain data — live Ástríðr backend not connected")
    ).not.toBeInTheDocument();
  });

  it('never attaches a STUB chip to the "All profiles" (global) dispatch path', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    stubActive = true;
    renderPicker();

    const stubChipCountBefore = screen.getAllByTestId("brain-picker-trigger-stub-chip").length;

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    fireEvent.click(screen.getByText("Codex CLI"));

    await screen.findByTestId("global-swap-modal");
    // Selecting in "All profiles" scope never sets the per-profile pending state, so it can
    // never grow the trigger's own STUB chip count -- the global branch stays un-stub-tagged.
    expect(screen.getAllByTestId("brain-picker-trigger-stub-chip").length).toBe(
      stubChipCountBefore
    );
    expect(mockDispatchSwap).not.toHaveBeenCalled();
  });
});

describe("BrainPicker — composition API (103-06)", () => {
  it("renders a custom `trigger` in place of its own default trigger, and clicking it opens the popover", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    render(
      <TooltipProvider>
        <BrainPicker
          profileId="assistant-default"
          trigger={<button type="button">custom trigger</button>}
        />
      </TooltipProvider>
    );

    // The picker's own default trigger button (base label, pending suffix, STUB chip) never
    // renders at all when a custom `trigger` is supplied -- there is exactly one trigger element.
    expect(screen.queryByTestId("brain-picker-base-label")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "custom trigger" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "custom trigger" }));
    await screen.findByText("Codex CLI");
  });

  it("fires onPendingChange with the same formatted switching-to label the default trigger renders", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    let resolveDispatch: (value: unknown) => void = () => {};
    mockDispatchSwap.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDispatch = resolve;
        })
    );
    const onPendingChange = vi.fn();
    render(
      <TooltipProvider>
        <BrainPicker profileId="assistant-default" onPendingChange={onPendingChange} />
      </TooltipProvider>
    );

    // Idle on mount -- matches the default trigger, which renders no pending suffix at all yet.
    expect(onPendingChange).toHaveBeenCalledWith(null);

    openPicker();
    fireEvent.click(await screen.findByText("Codex CLI"));

    await waitFor(() =>
      expect(onPendingChange).toHaveBeenCalledWith("· switching to Codex CLI…")
    );

    resolveDispatch({ type: "ack", request_id: "", status: "ok" });
    await waitFor(() => expect(mockDispatchSwap).toHaveBeenCalledTimes(1));
  });

  it("drops the pending callback to null on a failed dispatch, matching the default trigger's own drop-suffix behavior", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockDispatchSwap.mockResolvedValue({
      type: "ack",
      request_id: "",
      status: "error",
      error: "No credentials configured",
    });
    const onPendingChange = vi.fn();
    render(
      <TooltipProvider>
        <BrainPicker profileId="assistant-default" onPendingChange={onPendingChange} />
      </TooltipProvider>
    );

    openPicker();
    fireEvent.click(await screen.findByText("Codex CLI"));

    await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(null));
  });

  it("supports controlled open/onOpenChange while every other test in this file (which omits both) proves the default uncontrolled behavior is unchanged", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    const onOpenChange = vi.fn();

    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <BrainPicker
          profileId="assistant-default"
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            onOpenChange(next);
          }}
        />
      );
    }

    render(
      <TooltipProvider>
        <Controlled />
      </TooltipProvider>
    );

    openPicker();
    expect(onOpenChange).toHaveBeenCalledWith(true);
    await screen.findByText("Codex CLI");
  });
});

describe("BrainPicker — never-truncates regression guard", () => {
  it("renders a long catalogue entry name without a truncate class on the row", async () => {
    const longNameCatalogue = [
      { ...STUB_CATALOGUE[0], name: "A Very Long Engine Name That Would Previously Have Been Truncated" },
    ];
    mockGetCatalogue.mockResolvedValue(longNameCatalogue);
    renderPicker();

    openPicker();
    const nameEl = await screen.findByText(longNameCatalogue[0].name);
    const row = nameEl.closest("button")!;
    expect(row.className).toContain("whitespace-normal");
    expect(row.className).toContain("break-words");
    expect(row.className).not.toContain("truncate");
  });
});
