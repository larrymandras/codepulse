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
  needsCostConfirm,
  quotaLevel,
  resolveHealthStatus,
} from "./BrainPickerRow";
import type { CatalogueEntry } from "@/lib/brainsApi";

// Phase 109 Plan 03 (D-01): the D-16 stub seam's fixture module was deleted along with the stub
// adapter it existed to serve. `BrainPickerRow` itself is a pure presentational component with no
// dependency on that seam — it only needs `CatalogueEntry`-shaped data — so this file now owns its
// own small, self-contained fixture set covering exactly the same cost-tier/quota/billing/health
// branches the original stub fixtures covered (mirrors the coverage notes the deleted module used
// to carry).
const TEST_CATALOGUE: CatalogueEntry[] = [
  {
    id: "claude-cli-sonnet5",
    name: "Sonnet 5 (CLI)",
    vendor: "claude-cli",
    group: "subscription",
    billing: "sub",
    costTier: "normal",
    health: "reachable",
    // no quotaRemainingPct — subscription CLI brains render "∞"
  },
  {
    id: "antigravity-cli",
    name: "Antigravity CLI",
    vendor: "antigravity",
    group: "subscription",
    billing: "sub",
    costTier: "unknown",
    health: "degraded",
  },
  {
    id: "anthropic-opus-4-8",
    name: "Opus 4.8",
    vendor: "anthropic_direct",
    group: "api",
    billing: "api",
    costTier: "expensive",
    quotaRemainingPct: 0.03, // below the 0.05 error threshold
    health: "reachable",
  },
  {
    id: "anthropic-sonnet-5",
    name: "Sonnet 5",
    vendor: "anthropic_direct",
    group: "api",
    billing: "api",
    costTier: "normal",
    quotaRemainingPct: 0.35, // at/above the 0.20 ok threshold
    health: "reachable",
  },
  {
    id: "openrouter-sonnet-5-dup",
    name: "Sonnet 5",
    vendor: "openrouter",
    group: "api",
    billing: "api",
    costTier: "normal",
    quotaRemainingPct: 0.5,
    health: "reachable",
  },
  {
    id: "ollama-llama3",
    name: "Llama 3 (local)",
    vendor: "ollama",
    group: "local",
    billing: "sub",
    costTier: "normal",
    health: "reachable",
    // no quotaRemainingPct — local brains have no quota concept either
  },
  {
    // D-09/D-13 (Phase 109 Plan 07): a genuinely unclassified entry — the shape
    // `mapCatalogueVendorToBilling` returns for an empty/missing vendor.
    id: "mystery-model",
    name: "Mystery Model",
    vendor: "",
    group: "unclassified",
    billing: "api",
    costTier: "unknown",
    health: "reachable",
  },
];

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
  const entry = overrides.entry ?? TEST_CATALOGUE[0];
  const props = {
    entry,
    isExpanded: false,
    // Phase 109 Plan 07: `needsConfirm` is now a REQUIRED prop the real `BrainPicker.tsx` computes
    // via its hoisted `shouldConfirmCost`. This file tests `BrainPickerRow` in isolation, so the
    // default here reproduces the pre-Plan-07 local computation (`needsCostConfirm(entry)`) exactly
    // — every existing test below that doesn't explicitly override `needsConfirm` keeps its prior
    // behavior unchanged.
    needsConfirm: needsCostConfirm(entry),
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
  const entry = TEST_CATALOGUE.find((e) => e.id === id);
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

describe("needsCostConfirm", () => {
  it("is true for expensive and unknown cost tiers, false for normal", () => {
    expect(needsCostConfirm(findEntry("anthropic-opus-4-8"))).toBe(true); // costTier: expensive
    expect(needsCostConfirm(findEntry("antigravity-cli"))).toBe(true); // costTier: unknown
    expect(needsCostConfirm(findEntry("anthropic-sonnet-5"))).toBe(false); // costTier: normal
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

  it('renders the deliberately-irregular full-word "UNCLASSIFIED" chip (dashed --status-warn border) for an unclassified entry, instead of the ordinary API/SUB chip', () => {
    renderRow({ entry: findEntry("mystery-model") });
    expect(screen.queryByText("API")).not.toBeInTheDocument();
    expect(screen.queryByText("SUB")).not.toBeInTheDocument();
    const chip = screen.getByText("UNCLASSIFIED");
    expect(chip.className).toContain("border-dashed");
    expect(chip.className).toContain("--status-warn");
    // Same sizing as every other chip — only color and text differ.
    expect(chip.className).toContain("text-xs");
    expect(chip.className).toContain("px-1");
    expect(chip.className).toContain("py-0");
  });

  it("renders the ordinary API chip (not UNCLASSIFIED) for a mapped api-billed control entry", () => {
    renderRow({ entry: findEntry("anthropic-sonnet-5") });
    expect(screen.queryByText("UNCLASSIFIED")).not.toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Health dot (behavior)
// ---------------------------------------------------------------------------

describe("BrainPickerRow — health dot (WR-03: presentational, no nested tab stop)", () => {
  it("renders a status-token dot that is aria-hidden and carries no tabIndex", () => {
    renderRow({ entry: findEntry("antigravity-cli") }); // health: "degraded"
    const dot = screen.getByTestId("health-dot");
    expect(dot.className).toContain("--status-warn");
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).not.toHaveAttribute("tabIndex");
  });

  it("announces the health word via the row button's own accessible name, not the dot", () => {
    renderRow({ entry: findEntry("antigravity-cli") }); // health: "degraded"
    const row = screen.getByRole("button");
    expect(row).toHaveAccessibleName(expect.stringContaining("degraded"));
  });

  it("uses the error token and reachable/unreachable vocabulary for an unreachable entry, announced via the button", () => {
    const entry: CatalogueEntry = { ...findEntry("ollama-llama3"), health: "unreachable" };
    renderRow({ entry });
    const dot = screen.getByTestId("health-dot");
    expect(dot.className).toContain("--status-error");

    const row = screen.getByRole("button");
    expect(row).toHaveAccessibleName(expect.stringContaining("unreachable"));
  });

  it("announces the reachable health word via the button for a reachable entry", () => {
    renderRow({ entry: findEntry("anthropic-sonnet-5") }); // health: "reachable"
    const row = screen.getByRole("button");
    expect(row).toHaveAccessibleName(expect.stringContaining("reachable"));
  });

  it("still surfaces the health word on hover/focus discovery via the Tooltip now wrapping the row button", async () => {
    renderRow({ entry: findEntry("antigravity-cli") }); // health: "degraded"
    const row = screen.getByRole("button");

    // Radix opens the tooltip on trigger focus (matches SkillLifecycleMenu.test.tsx's
    // established pattern for this repo) -- the Tooltip now wraps the row's button directly,
    // not a separately-focusable nested span.
    fireEvent.focus(row);
    const matches = await screen.findAllByText("degraded");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("exposes exactly one focusable element in the row", () => {
    const { container } = render(
      <TooltipProvider>
        <BrainPickerRow
          entry={findEntry("anthropic-sonnet-5")}
          isExpanded={false}
          needsConfirm={false}
          onExpandChange={vi.fn()}
          onSelect={vi.fn()}
        />
      </TooltipProvider>
    );
    const focusable = container.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    expect(focusable.length).toBe(1);
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
          needsConfirm={true}
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

