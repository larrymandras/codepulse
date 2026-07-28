/**
 * GlobalSwapModal.test.tsx — 103-04-T2. Proves D-09 (informational-only confirm friction),
 * D-11 (pinned-default overwrite count + mode-preserving revert), and D-12 (honest per-profile
 * partial-failure result, never showing the attempted target on a failed row) against real
 * fixture data, not a render-without-error smoke test.
 *
 * `useCommandDispatch` is mocked directly (asserts the live `swap.set` axis); `brainsApi` is
 * mocked directly (asserts the per-profile `gateway.model.set` fan-out axis) — this lets every
 * dispatched command shape be asserted exactly via `toHaveBeenCalledWith`, so any drift from
 * 103-CONTRACT.md fails here. A configurable per-profile-id failure map on the `brainsApi` mock
 * constructs the partial-failure scenario D-12 requires; a stub that always succeeds could not
 * exercise it at all.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { CatalogueEntry, GatewayModelSetCommand } from "@/lib/brainsApi";
import { GlobalSwapModal, type GlobalSwapProfile } from "./GlobalSwapModal";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn();
vi.mock("@/hooks/useCommandDispatch", () => ({
  useCommandDispatch: () => ({
    dispatch: (...args: unknown[]) => mockDispatch(...args),
    isConnected: true,
  }),
}));

const mockDispatchSwap = vi.fn();
let stubActive = true;
vi.mock("@/lib/brainsApi", () => ({
  brainsApi: {
    isStub: true,
    dispatchSwap: (...args: unknown[]) => mockDispatchSwap(...args),
  },
  get BRAINS_STUB_ACTIVE() {
    return stubActive;
  },
}));

const mockToastFn = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(
    (...args: unknown[]) => mockToastFn(...args),
    { success: vi.fn(), error: vi.fn() }
  ),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TARGET_NORMAL: CatalogueEntry = {
  id: "anthropic-sonnet-5",
  name: "Sonnet 5",
  vendor: "anthropic_direct",
  group: "api",
  billing: "api",
  costTier: "normal",
};

const TARGET_EXPENSIVE: CatalogueEntry = {
  id: "anthropic-opus-4-8",
  name: "Opus 4.8",
  vendor: "anthropic_direct",
  group: "api",
  billing: "api",
  costTier: "expensive",
};

const THREE_PROFILES: GlobalSwapProfile[] = [
  {
    profileId: "assistant-default",
    displayName: "Assistant",
    currentModel: "claude-cli-sonnet5",
    currentModelDisplayName: "Sonnet 5 (CLI)",
    mode: "pinned",
  },
  {
    profileId: "consulting",
    displayName: "Consulting",
    currentModel: "ollama-llama3",
    currentModelDisplayName: "Llama 3 (local)",
    mode: "inherited",
  },
  {
    profileId: "personal",
    displayName: "Personal",
    currentModel: "codex-cli",
    currentModelDisplayName: "Codex CLI",
    mode: "session",
  },
];

const TWO_OF_THREE_PINNED: GlobalSwapProfile[] = [
  { ...THREE_PROFILES[0], mode: "pinned" },
  { ...THREE_PROFILES[1], mode: "pinned" },
  { ...THREE_PROFILES[2], mode: "inherited" },
];

const ALL_PINNED: GlobalSwapProfile[] = THREE_PROFILES.map((p) => ({ ...p, mode: "pinned" }));
const NONE_PINNED: GlobalSwapProfile[] = THREE_PROFILES.map((p) => ({ ...p, mode: "inherited" }));

const PINNED_AND_INHERITED_PAIR: GlobalSwapProfile[] = [
  {
    profileId: "assistant-default",
    displayName: "Assistant",
    currentModel: "claude-cli-sonnet5",
    currentModelDisplayName: "Sonnet 5 (CLI)",
    mode: "pinned",
  },
  {
    profileId: "consulting",
    displayName: "Consulting",
    currentModel: "ollama-llama3",
    currentModelDisplayName: "Llama 3 (local)",
    mode: "inherited",
  },
];

function rowContainerFor(text: string): HTMLElement {
  const el = screen.getByText(text);
  const row = el.closest("div");
  if (!row) throw new Error(`No row container found for "${text}"`);
  return row;
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockDispatch.mockReset();
  mockDispatch.mockResolvedValue({ type: "ack", request_id: "", status: "ok" });
  mockDispatchSwap.mockReset();
  mockDispatchSwap.mockImplementation(async (cmd: GatewayModelSetCommand) => ({
    type: "ack",
    request_id: cmd.request_id,
    status: "ok",
  }));
  mockToastFn.mockReset();
  stubActive = true;
});

// ─── Confirm state ────────────────────────────────────────────────────────────

describe("GlobalSwapModal confirm state", () => {
  it("renders one row per affected profile with current -> new engine", () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        onOpenChange={() => {}}
      />
    );

    for (const p of THREE_PROFILES) {
      const row = rowContainerFor(p.displayName!);
      expect(row.textContent).toContain(p.currentModelDisplayName);
      expect(row.textContent).toContain(TARGET_NORMAL.name);
    }
  });

  it("renders the pinned-default warning with a computed count of 2 when 2 of 3 profiles are pinned", () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={TWO_OF_THREE_PINNED}
        open
        onOpenChange={() => {}}
      />
    );

    expect(
      screen.getByText("2 profiles have a pinned default that will be overwritten.")
    ).toBeInTheDocument();
  });

  it("computes the pinned-default count rather than hardcoding it — 'all pinned' and 'none pinned' fixtures produce different output", () => {
    const { rerender } = render(
      <GlobalSwapModal target={TARGET_NORMAL} profiles={ALL_PINNED} open onOpenChange={() => {}} />
    );
    expect(
      screen.getByText("3 profiles have a pinned default that will be overwritten.")
    ).toBeInTheDocument();

    rerender(
      <GlobalSwapModal target={TARGET_NORMAL} profiles={NONE_PINNED} open onOpenChange={() => {}} />
    );
    expect(
      screen.queryByText(/pinned default that will be overwritten/)
    ).not.toBeInTheDocument();
  });

  it("renders the expensive-tier cost warning with no second confirmation surface", () => {
    render(
      <GlobalSwapModal
        target={TARGET_EXPENSIVE}
        profiles={THREE_PROFILES}
        open
        onOpenChange={() => {}}
      />
    );

    expect(
      screen.getByText(
        "This model may be expensive per token — 3 profiles will be switched to it."
      )
    ).toBeInTheDocument();
    // The frictions do not stack — no per-row inline "Confirm swap" ritual (BrainPickerRow's
    // expensive-tier expansion) appears inside the global-swap modal.
    expect(screen.queryByText("Confirm swap")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Swap all profiles to/ })).toHaveLength(1);
  });

  it("renders no text input — the row list is the friction, not type-to-confirm", () => {
    const { container } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        onOpenChange={() => {}}
      />
    );
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });
});

// ─── Dispatch (confirm -> result) ─────────────────────────────────────────────

describe("GlobalSwapModal dispatch", () => {
  it("fires the live swap.set global override and the per-profile gateway.model.set fan-out with exact shapes", async () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` }));

    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "swap.set",
        target: "brain",
        value: TARGET_NORMAL.id,
        restore: false,
      })
    );

    for (const p of PINNED_AND_INHERITED_PAIR) {
      await waitFor(() =>
        expect(mockDispatchSwap).toHaveBeenCalledWith({
          type: "gateway.model.set",
          request_id: "",
          scope: "profile",
          profile_id: p.profileId,
          model: TARGET_NORMAL.id,
          mode: "default",
        })
      );
    }
  });

  it("shows a failed row with the original engine and reason, and a succeeded row with the new engine", async () => {
    mockDispatchSwap.mockImplementation(async (cmd: GatewayModelSetCommand) => {
      if (cmd.profile_id === "consulting") {
        return {
          type: "ack",
          request_id: cmd.request_id,
          status: "error",
          error: 'No credentials configured for profile "consulting"',
        };
      }
      return { type: "ack", request_id: cmd.request_id, status: "ok" };
    });

    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` }));

    const succeededRow = await screen.findByText(`Assistant: switched to ${TARGET_NORMAL.name}`);
    expect(succeededRow).toBeInTheDocument();

    const failedRow = await screen.findByText(
      (content) =>
        content.startsWith("Consulting: failed") &&
        content.includes('No credentials configured for profile "consulting"') &&
        content.includes("still on Llama 3 (local)")
    );
    expect(failedRow).toBeInTheDocument();
  });

  it("never renders the attempted target engine name as if it landed on a failed row", async () => {
    mockDispatchSwap.mockImplementation(async (cmd: GatewayModelSetCommand) => {
      if (cmd.profile_id === "consulting") {
        return {
          type: "ack",
          request_id: cmd.request_id,
          status: "error",
          error: 'No credentials configured for profile "consulting"',
        };
      }
      return { type: "ack", request_id: cmd.request_id, status: "ok" };
    });

    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` }));

    const failedRow = await screen.findByText(
      (content) =>
        content.startsWith("Consulting: failed") &&
        content.includes('No credentials configured for profile "consulting"') &&
        content.includes("still on Llama 3 (local)")
    );
    expect(failedRow.textContent).not.toContain(TARGET_NORMAL.name);

    const succeededRow = screen.getByText(`Assistant: switched to ${TARGET_NORMAL.name}`);
    expect(succeededRow).toBeInTheDocument();
  });

  it("appends a STUB chip to per-profile result rows when the stub adapter is active", async () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` }));

    await screen.findByText(`Assistant: switched to ${TARGET_NORMAL.name}`);
    expect(screen.getAllByText("STUB").length).toBeGreaterThan(0);
  });
});

// ─── Dismiss / revert ─────────────────────────────────────────────────────────

describe("GlobalSwapModal dismiss and revert", () => {
  it("fires a summary toast with a 'Revert global swap' action when the result is dismissed", async () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` }));
    await screen.findByText(`Assistant: switched to ${TARGET_NORMAL.name}`);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(mockToastFn).toHaveBeenCalledWith(
      `2 of 2 profiles switched to ${TARGET_NORMAL.name}.`,
      expect.objectContaining({
        action: expect.objectContaining({ label: "Revert global swap" }),
      })
    );
  });

  it("invoking Revert dispatches swap.set with restore:true and restores each profile's snapshot model with its snapshot mode preserved", async () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` }));
    await screen.findByText(`Assistant: switched to ${TARGET_NORMAL.name}`);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    const [, toastOptions] = mockToastFn.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    mockDispatch.mockClear();
    mockDispatchSwap.mockClear();

    toastOptions.action.onClick();

    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "swap.set",
        target: "brain",
        restore: true,
      })
    );

    // Pinned profile ("Assistant") restores via mode: "default", model preserved.
    await waitFor(() =>
      expect(mockDispatchSwap).toHaveBeenCalledWith({
        type: "gateway.model.set",
        request_id: "",
        scope: "profile",
        profile_id: "assistant-default",
        model: "claude-cli-sonnet5",
        mode: "default",
        restore: false,
      })
    );

    // Inherited profile ("Consulting") restores by clearing the pinned default the fan-out
    // set — restore:true, model omitted — never re-pinned to its old model value.
    await waitFor(() =>
      expect(mockDispatchSwap).toHaveBeenCalledWith({
        type: "gateway.model.set",
        request_id: "",
        scope: "profile",
        profile_id: "consulting",
        mode: "default",
        restore: true,
      })
    );

    await screen.findByText(`Assistant: switched to Sonnet 5 (CLI)`);
    await screen.findByText(`Consulting: switched to Llama 3 (local)`);
  });
});
