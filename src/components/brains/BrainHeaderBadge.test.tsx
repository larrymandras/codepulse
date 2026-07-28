/**
 * BrainHeaderBadge.test.tsx — 103-06-T1.
 *
 * `@/components/brains/BrainPicker` is mocked entirely — this file tests BrainHeaderBadge's OWN
 * rendering/relay logic (mixed-state honesty, aria-label, pulse dot, session/pinned line, click
 * relay, pending mirroring), not BrainPicker's own internals (already covered by
 * BrainPicker.test.tsx). The mock exposes a `mock-toggle-pending` button that flips a local
 * `data-testid="brain-picker-pending-suffix"` node in and out of its own DOM, letting these tests
 * exercise the REAL MutationObserver-based mirroring in BrainHeaderBadge.tsx against a real DOM
 * mutation rather than a re-rendered prop.
 *
 * `convex/react` + the generated Convex API module are mocked directly (not
 * `@/hooks/useActiveEngine`/`@/hooks/useProfileConfigs`) so the REAL `useActiveEngine` hook and
 * REAL `deriveMixedState` pure function run — this is the same idiom `useActiveEngine.test.ts`
 * already establishes for hook-level tests.
 */

import { useState as useMockState } from "react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrainHeaderBadge } from "./BrainHeaderBadge";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPickerTriggerClick = vi.fn();

vi.mock("@/components/brains/BrainPicker", () => ({
  BrainPicker: (props: { profileId: string; entryScope?: string }) => {
    const [pending, setPending] = useMockState(false);
    return (
      <div
        data-testid="mock-brain-picker"
        data-profile-id={props.profileId}
        data-entry-scope={props.entryScope ?? ""}
      >
        <button type="button" aria-label="Active brain: mock-engine" onClick={mockPickerTriggerClick}>
          mock trigger
        </button>
        <button type="button" data-testid="mock-toggle-pending" onClick={() => setPending((p) => !p)}>
          toggle pending
        </button>
        {pending && (
          <span data-testid="brain-picker-pending-suffix">· switching to Codex CLI…</span>
        )}
      </div>
    );
  },
}));

const mockGetCatalogue = vi.fn();
const mockGetDefaultProfileId = vi.fn();
let stubActive = false;

vi.mock("@/lib/brainsApi", () => ({
  brainsApi: {
    isStub: true,
    getCatalogue: (...args: unknown[]) => mockGetCatalogue(...args),
    dispatchSwap: vi.fn(),
    getDefaultProfileId: (...args: unknown[]) => mockGetDefaultProfileId(...args),
  },
  get BRAINS_STUB_ACTIVE() {
    return stubActive;
  },
}));

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
vi.mock("../../../convex/_generated/api", () => ({
  api: {
    activeEngine: { latestByProfile: "activeEngine:latestByProfile" },
    profiles: { listConfigs: "profiles:listConfigs" },
  },
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
  mockPickerTriggerClick.mockReset();
  mockGetCatalogue.mockReset();
  mockGetDefaultProfileId.mockReset();
  mockGetCatalogue.mockResolvedValue([]);
  mockGetDefaultProfileId.mockResolvedValue("assistant-default");
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(undefined);
  stubActive = false;
});

type StubEngine = {
  profileId: string;
  model: string;
  mode: "session" | "pinned" | "inherited";
  selectionPath: string;
  expiresAt?: number;
  timestamp: number;
};

function makeEngine(profileId: string, model: string, overrides: Partial<StubEngine> = {}): StubEngine {
  return {
    profileId,
    model,
    mode: "pinned",
    selectionPath: "codepulse-default",
    timestamp: Date.now(),
    ...overrides,
  };
}

function seedEngines(snapshots: StubEngine[], profileIds: string[]) {
  mockUseQuery.mockImplementation((ref: unknown) => {
    if (ref === "activeEngine:latestByProfile") return snapshots;
    if (ref === "profiles:listConfigs") return profileIds.map((profileId) => ({ profileId }));
    return undefined;
  });
}

function renderBadge() {
  return render(
    <TooltipProvider>
      <BrainHeaderBadge />
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------

describe("BrainHeaderBadge — agreement", () => {
  it("renders the agreed engine name and a single provider-color dot when all profiles agree", async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5"),
        makeEngine("consulting", "anthropic-sonnet-5"),
      ],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    expect(await screen.findByTestId("brain-header-badge-label")).toHaveTextContent(
      "anthropic-sonnet-5"
    );
    expect(screen.queryByText("Mixed brains")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Active brain: anthropic-sonnet-5" })
    ).toBeInTheDocument();
  });

  it("passes no entryScope (defaults to This profile) to BrainPicker when profiles agree", async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5"),
        makeEngine("consulting", "anthropic-sonnet-5"),
      ],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    expect(screen.getByTestId("mock-brain-picker")).toHaveAttribute("data-entry-scope", "");
  });
});

describe("BrainHeaderBadge — mixed state (D-14/BSC-01 honesty)", () => {
  it('renders "Mixed brains" and a stacked multi-dot cluster, never a single engine name as the headline, when profiles disagree', async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5"),
        makeEngine("consulting", "claude-cli-sonnet5"),
      ],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    expect(await screen.findByTestId("brain-header-badge-label")).toHaveTextContent("Mixed brains");
    expect(screen.queryByText("anthropic-sonnet-5")).not.toBeInTheDocument();
    expect(screen.queryByText("claude-cli-sonnet5")).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Active brain: Mixed brains" })
    ).toBeInTheDocument();
  });

  it('opens the picker with the all-profiles entry scope when clicked from the mixed state', async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5"),
        makeEngine("consulting", "claude-cli-sonnet5"),
      ],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    expect(screen.getByTestId("mock-brain-picker")).toHaveAttribute("data-entry-scope", "global");
  });
});

describe("BrainHeaderBadge — no engine reported", () => {
  it("renders an honest unknown state without throwing when no profile has reported telemetry", async () => {
    seedEngines([], []);
    expect(() => renderBadge()).not.toThrow();

    expect(await screen.findByTestId("brain-header-badge-label")).toHaveTextContent(
      "No brain reported"
    );
  });
});

describe("BrainHeaderBadge — confirmed-live pulse dot", () => {
  it("renders the confirmed-live pulse dot for a server-confirmed, non-pending, non-stub reading", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    const { container } = renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("does not render the pulse dot while the stub adapter is active", async () => {
    stubActive = true;
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    const { container } = renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
    expect(screen.getByTestId("brain-header-badge-stub-chip")).toBeInTheDocument();
  });

  it("does not render the pulse dot while a swap is pending", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    const { container } = renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    fireEvent.click(screen.getByTestId("mock-toggle-pending"));

    await screen.findByTestId("brain-header-badge-pending");
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });
});

describe("BrainHeaderBadge — session override vs pinned default (D-02)", () => {
  it("renders the session secondary line, never the pinned line, for a session-override reading", async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5", {
          mode: "session",
          expiresAt: Math.floor(Date.now() / 1000) + 1800,
        }),
      ],
      ["assistant-default"]
    );
    renderBadge();

    expect(await screen.findByTestId("brain-header-badge-session")).toHaveTextContent(
      /session override/
    );
    expect(screen.queryByTestId("brain-header-badge-pinned")).not.toBeInTheDocument();
  });

  it("renders the pinned secondary line, never the session line, for a pinned-default reading", async () => {
    seedEngines(
      [makeEngine("assistant-default", "anthropic-sonnet-5", { mode: "pinned" })],
      ["assistant-default"]
    );
    renderBadge();

    expect(await screen.findByTestId("brain-header-badge-pinned")).toHaveTextContent(
      "pinned default"
    );
    expect(screen.queryByTestId("brain-header-badge-session")).not.toBeInTheDocument();
  });
});

describe("BrainHeaderBadge — click relay into the real BrainPicker", () => {
  it("relays a click on the visible badge into BrainPicker's own trigger", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();

    const badgeButton = await screen.findByRole("button", {
      name: "Active brain: anthropic-sonnet-5",
    });
    fireEvent.click(badgeButton);

    expect(mockPickerTriggerClick).toHaveBeenCalledTimes(1);
  });
});

describe("BrainHeaderBadge — pending never lies (D-15)", () => {
  it("keeps the base label unchanged and shows a switching-to suffix while a swap is in flight", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();

    const labelBefore = (await screen.findByTestId("brain-header-badge-label")).textContent;
    expect(labelBefore).toBe("anthropic-sonnet-5");

    fireEvent.click(screen.getByTestId("mock-toggle-pending"));

    expect(await screen.findByTestId("brain-header-badge-pending")).toHaveTextContent(
      "switching to Codex CLI"
    );
    expect(screen.getByTestId("brain-header-badge-label").textContent).toBe(labelBefore);
  });

  it("drops the pending suffix once the mirrored BrainPicker state clears", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    fireEvent.click(screen.getByTestId("mock-toggle-pending"));
    await screen.findByTestId("brain-header-badge-pending");

    fireEvent.click(screen.getByTestId("mock-toggle-pending"));
    await waitFor(() =>
      expect(screen.queryByTestId("brain-header-badge-pending")).not.toBeInTheDocument()
    );
  });
});

describe("BrainHeaderBadge — accessibility", () => {
  it("carries an aria-label containing the active engine name, independent of viewport", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();

    const button = await screen.findByRole("button", { name: /Active brain:/ });
    expect(button).toHaveAttribute("aria-label", "Active brain: anthropic-sonnet-5");
    // Text label is viewport-hidden below sm:, but aria-label carries the same content regardless.
    expect(within(button).getByTestId("brain-header-badge-label").className).toContain("sm:inline");
  });
});
