import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/useResolvedBrain", () => ({
  useResolvedBrain: vi.fn(),
}));
vi.mock("@/hooks/useProviderHealth", () => ({
  useProviderHealth: vi.fn(),
}));
vi.mock("@/hooks/useLlmMetrics", () => ({
  useLlmMetrics: vi.fn(),
}));

import { useResolvedBrain } from "@/hooks/useResolvedBrain";
import { useProviderHealth } from "@/hooks/useProviderHealth";
import { useLlmMetrics } from "@/hooks/useLlmMetrics";
import { LlmStatusPanel, resolveChipState } from "./LlmStatusPanel";
import { ALL_PROVIDERS } from "@/lib/providers";

const mockUseResolvedBrain = vi.mocked(useResolvedBrain);
const mockUseProviderHealth = vi.mocked(useProviderHealth);
const mockUseLlmMetrics = vi.mocked(useLlmMetrics);

function resolvedNone() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { source: "none", model: null, distinctModels: [] } as any;
}

function getChip(providerId: string) {
  return screen
    .getAllByTestId("llm-status-chip")
    .find((el) => el.getAttribute("data-provider") === providerId);
}

describe("resolveChipState (pure)", () => {
  it("returns idle when there is no health data yet", () => {
    expect(resolveChipState("claude-cli", undefined, null)).toBe("idle");
  });

  it("returns warn when the circuit is open (tripped/cooldown)", () => {
    expect(resolveChipState("claude-cli", { state: "open" }, "claude-cli")).toBe("warn");
  });

  it("returns warn when unauthenticated, even if it is the reported winner", () => {
    expect(
      resolveChipState("claude-cli", { state: "closed", authenticated: false }, "claude-cli")
    ).toBe("warn");
  });

  it("returns routing when the circuit is half_open", () => {
    expect(resolveChipState("codex", { state: "half_open" }, null)).toBe("routing");
  });

  it("returns winner when this provider handled the most recent call", () => {
    expect(
      resolveChipState("claude-cli", { state: "closed", authenticated: true }, "claude-cli")
    ).toBe("winner");
  });

  it("returns idle for a healthy provider that is not the current winner", () => {
    expect(
      resolveChipState("codex", { state: "closed", authenticated: true }, "claude-cli")
    ).toBe("idle");
  });
});

describe("LlmStatusPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProviderHealth.mockReturnValue({});
    mockUseLlmMetrics.mockReturnValue({ calls: [], status: "Exhausted", loadMore: vi.fn() });
  });

  it('renders the chrome header "LLM STATUS"', () => {
    mockUseResolvedBrain.mockReturnValue(resolvedNone());
    render(<LlmStatusPanel />);
    expect(screen.getByText("LLM STATUS")).toBeInTheDocument();
  });

  it('falls back to "Auto" with no override and no last-turn model', () => {
    mockUseResolvedBrain.mockReturnValue(resolvedNone());
    render(<LlmStatusPanel />);
    expect(screen.getByText("Auto")).toBeInTheDocument();
  });

  it("shows the resolved brain label when one is reported", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseResolvedBrain.mockReturnValue({
      source: "global",
      model: "claude-opus-5",
      distinctModels: [],
    } as any);
    render(<LlmStatusPanel />);
    expect(screen.getByText("claude-opus-5")).toBeInTheDocument();
  });

  it("renders one chip per configured provider, never blank, while health data is loading", () => {
    mockUseResolvedBrain.mockReturnValue(resolvedNone());
    mockUseProviderHealth.mockReturnValue({});
    render(<LlmStatusPanel />);

    const chips = screen.getAllByTestId("llm-status-chip");
    expect(chips).toHaveLength(ALL_PROVIDERS.length);
    for (const chip of chips) {
      expect(chip.getAttribute("data-state")).toBe("idle");
      expect(chip.className).toContain("text-muted-foreground");
    }
  });

  it("renders a degraded/cooldown provider with the warn class", () => {
    mockUseResolvedBrain.mockReturnValue(resolvedNone());
    mockUseProviderHealth.mockReturnValue({
      "claude-cli": { state: "open", authenticated: true },
    });
    render(<LlmStatusPanel />);

    const chip = getChip("claude-cli");
    expect(chip).toBeDefined();
    expect(chip?.getAttribute("data-state")).toBe("warn");
    expect(chip?.className).toContain("status-warn");
  });

  it("renders the resolved winner provider with the primary class", () => {
    mockUseResolvedBrain.mockReturnValue(resolvedNone());
    mockUseProviderHealth.mockReturnValue({
      "claude-cli": { state: "closed", authenticated: true },
    });
    mockUseLlmMetrics.mockReturnValue({
      calls: [{ provider: "claude-cli" }],
      status: "Exhausted",
      loadMore: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    render(<LlmStatusPanel />);

    const chip = getChip("claude-cli");
    expect(chip).toBeDefined();
    expect(chip?.getAttribute("data-state")).toBe("winner");
    expect(chip?.className).toContain("text-primary");
  });

  it("renders a half_open provider with the routing/info class", () => {
    mockUseResolvedBrain.mockReturnValue(resolvedNone());
    mockUseProviderHealth.mockReturnValue({
      codex: { state: "half_open", authenticated: true },
    });
    render(<LlmStatusPanel />);

    const chip = getChip("codex");
    expect(chip).toBeDefined();
    expect(chip?.getAttribute("data-state")).toBe("routing");
    expect(chip?.className).toContain("status-info");
  });
});
