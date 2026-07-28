/**
 * BrainPickerRow.test.tsx — 103-03-T2.
 *
 * Mocks `convex/react`'s `useQuery` (consumed transitively via
 * `useProviderHealth` -> `useThrottledQuery`) so the row can render without a
 * live Convex runtime, following this repo's existing hook-mocking idiom.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  BrainPickerRow,
  quotaLevel,
  resolveHealthStatus,
} from "./BrainPickerRow";
import { STUB_CATALOGUE } from "@/lib/brainsFixtures";
import type { CatalogueEntry } from "@/lib/brainsApi";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { providerHealth: { latest: "providerHealth:latest" } },
}));

beforeEach(() => {
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue({});
});

// Radix Tooltip uses Popper internally — jsdom has no ResizeObserver.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function renderRow(overrides: Partial<React.ComponentProps<typeof BrainPickerRow>> = {}) {
  const onSelect = vi.fn();
  const onExpandChange = vi.fn();
  const props = {
    entry: STUB_CATALOGUE[0],
    isExpanded: false,
    onExpandChange,
    onSelect,
    ...overrides,
  };
  render(
    <TooltipProvider>
      <BrainPickerRow {...props} />
    </TooltipProvider>
  );
  return { onSelect, onExpandChange };
}

function findEntry(id: string): CatalogueEntry {
  const entry = STUB_CATALOGUE.find((e) => e.id === id);
  if (!entry) throw new Error(`fixture entry ${id} not found`);
  return entry;
}

function withQuota(entry: CatalogueEntry, quotaRemainingPct: number): CatalogueEntry {
  return { ...entry, quotaRemainingPct };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("quotaLevel", () => {
  it("returns ok at/above 0.20, warn between 0.05 and 0.20, error below 0.05", () => {
    expect(quotaLevel(0.5)).toBe("ok");
    expect(quotaLevel(0.2)).toBe("ok");
    expect(quotaLevel(0.1)).toBe("warn");
    expect(quotaLevel(0.02)).toBe("error");
    expect(quotaLevel(0.049)).toBe("error");
  });
});

describe("resolveHealthStatus", () => {
  it("prefers the catalogue entry's own health field over live provider health", () => {
    const entry = findEntry("antigravity-cli"); // health: "degraded"
    expect(resolveHealthStatus(entry, {})).toBe("degraded");
  });

  it("falls back to live provider health when the entry has no health field", () => {
    const entry: CatalogueEntry = { ...findEntry("ollama-llama3"), health: undefined };
    expect(resolveHealthStatus(entry, { ollama: { state: "open" } })).toBe("unreachable");
    expect(resolveHealthStatus(entry, { ollama: { authenticated: false } })).toBe("degraded");
    expect(resolveHealthStatus(entry, { ollama: { state: "closed", authenticated: true } })).toBe(
      "reachable"
    );
    expect(resolveHealthStatus(entry, {})).toBe("unreachable");
  });
});

// ---------------------------------------------------------------------------
// Quota bar thresholds (behavior)
// ---------------------------------------------------------------------------

describe("BrainPickerRow — quota bar", () => {
  it("renders the ok status token at 0.5 remaining", () => {
    renderRow({ entry: findEntry("openrouter-sonnet-5-dup") }); // quotaRemainingPct: 0.5
    const progress = document.querySelector('[data-slot="progress"]');
    expect(progress).not.toBeNull();
    expect(progress!.className).toContain("--status-ok");
  });

  it("renders the warn status token at 0.10 remaining", () => {
    renderRow({ entry: withQuota(findEntry("anthropic-sonnet-5"), 0.1) });
    const progress = document.querySelector('[data-slot="progress"]');
    expect(progress).not.toBeNull();
    expect(progress!.className).toContain("--status-warn");
  });

  it("renders the error status token at 0.02 remaining", () => {
    renderRow({ entry: findEntry("anthropic-opus-4-8") }); // quotaRemainingPct: 0.03
    const progress = document.querySelector('[data-slot="progress"]');
    expect(progress).not.toBeNull();
    expect(progress!.className).toContain("--status-error");
  });

  it("renders the infinity label instead of a Progress bar for a subscription row with no quota", () => {
    renderRow({ entry: findEntry("claude-cli-sonnet5") }); // billing: sub, no quotaRemainingPct
    expect(screen.getByLabelText("Unlimited quota")).toHaveTextContent("∞");
    expect(document.querySelector('[data-slot="progress"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Billing chip (behavior)
// ---------------------------------------------------------------------------

describe("BrainPickerRow — billing chip", () => {
  it("renders the literal text API for an api-billed entry with no accent/status color class", () => {
    renderRow({ entry: findEntry("anthropic-sonnet-5") });
    const chip = screen.getByText("API");
    expect(chip.className).not.toMatch(/primary/);
    expect(chip.className).not.toMatch(/--status/);
  });

  it("renders the literal text SUB for a subscription-billed entry with no accent/status color class", () => {
    renderRow({ entry: findEntry("claude-cli-sonnet5") });
    const chip = screen.getByText("SUB");
    expect(chip.className).not.toMatch(/primary/);
    expect(chip.className).not.toMatch(/--status/);
  });
});

// ---------------------------------------------------------------------------
// Health dot (behavior)
// ---------------------------------------------------------------------------

describe("BrainPickerRow — health dot", () => {
  it("renders a status-token dot whose tooltip reveals the health status word", async () => {
    renderRow({ entry: findEntry("antigravity-cli") }); // health: "degraded"
    const dot = screen.getByLabelText("Health: degraded");
    expect(dot.className).toContain("--status-warn");

    // Radix opens the tooltip on trigger focus (matches
    // SkillLifecycleMenu.test.tsx's established pattern for this repo).
    fireEvent.focus(dot);
    const matches = await screen.findAllByText("degraded");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("uses the error token and reachable/unreachable vocabulary for an unreachable entry", () => {
    const entry: CatalogueEntry = { ...findEntry("ollama-llama3"), health: "unreachable" };
    renderRow({ entry });
    const dot = screen.getByLabelText("Health: unreachable");
    expect(dot.className).toContain("--status-error");
  });
});

// ---------------------------------------------------------------------------
// Never-truncates regression guard (copied intent from BrainControl.test.tsx)
// ---------------------------------------------------------------------------

describe("BrainPickerRow — non-truncation regression guard", () => {
  it("renders the full engine name and carries no truncate class on the row", () => {
    const longNameEntry: CatalogueEntry = {
      ...findEntry("anthropic-sonnet-5"),
      name: "A Very Long Engine Name That Would Previously Have Been Truncated In The Old Row",
    };
    renderRow({ entry: longNameEntry });

    const nameEl = screen.getByText(longNameEntry.name);
    const row = nameEl.closest("button")!;
    expect(row.className).toContain("whitespace-normal");
    expect(row.className).toContain("break-words");
    expect(row.className).not.toContain("truncate");
  });
});

// ---------------------------------------------------------------------------
// Expensive/unknown-tier inline confirm (behavior)
// ---------------------------------------------------------------------------

describe("BrainPickerRow — expensive/unknown-tier inline confirm", () => {
  it("does not show the confirm affordance on first render, and shows it once expanded", () => {
    const expensiveEntry = findEntry("anthropic-opus-4-8"); // costTier: expensive
    const { onSelect, onExpandChange } = renderRow({
      entry: expensiveEntry,
      isExpanded: false,
    });

    expect(screen.queryByText("Confirm swap")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(onExpandChange).toHaveBeenCalledWith(true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows the confirm affordance once the parent marks the row expanded, and dispatches only on Confirm swap", () => {
    const expensiveEntry = findEntry("anthropic-opus-4-8");
    const onSelect = vi.fn();
    const onExpandChange = vi.fn();

    render(
      <TooltipProvider>
        <BrainPickerRow
          entry={expensiveEntry}
          isExpanded={true}
          onExpandChange={onExpandChange}
          onSelect={onSelect}
        />
      </TooltipProvider>
    );

    expect(screen.getByText("Confirm swap")).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Confirm swap"));
    expect(onSelect).toHaveBeenCalledWith(expensiveEntry);
  });

  it("dispatches immediately (no confirm step) for a normal-tier row", () => {
    const normalEntry = findEntry("anthropic-sonnet-5"); // costTier: normal
    const { onSelect, onExpandChange } = renderRow({ entry: normalEntry, isExpanded: false });

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(normalEntry);
    expect(onExpandChange).not.toHaveBeenCalled();
  });
});

