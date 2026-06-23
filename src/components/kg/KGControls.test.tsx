import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import KGControls from "./KGControls";
import type { KgLens, KgFilters } from "../../hooks/useKnowledgeGraph";

// Radix UI Slider uses ResizeObserver internally; jsdom doesn't provide it.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const defaultFilters: KgFilters = {
  entityType: null,
  predicate: null,
  agentId: null,
  entityName: "",
  hops: 1,
  asOf: null,
  limit: 100,
  searchQuery: "",
};

function renderControls(
  overrides: Partial<{
    lens: KgLens;
    filters: KgFilters;
    onLens: (l: KgLens) => void;
    setFilter: <K extends keyof KgFilters>(key: K, value: KgFilters[K]) => void;
  }> = {},
) {
  const props = {
    lens: (overrides.lens ?? "overview") as KgLens,
    onLens: overrides.onLens ?? vi.fn(),
    filters: overrides.filters ?? defaultFilters,
    setFilter: overrides.setFilter ?? vi.fn(),
    entityTypes: ["person", "organization"],
    predicates: ["knows", "works_at"],
    loading: false,
    onRefresh: vi.fn(),
    // Saved-views surface (KG-10) — defaults for existing tests
    views: [],
    activeViewId: null,
    onLoadView: vi.fn(),
    onDeleteView: vi.fn(),
    onCopyLink: vi.fn(),
    onSaveView: vi.fn(),
  };
  return render(<KGControls {...props} />);
}

describe("KGControls — lens tabs", () => {
  it("renders all 5 lens tabs including the 5th Search tab", () => {
    renderControls();
    expect(screen.getByRole("button", { name: /Overview/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Entity \(ego\)/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Temporal/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Contradictions/i })).toBeTruthy();
    // 5th lens — KG-08
    expect(screen.getByRole("button", { name: /^Search$/i })).toBeTruthy();
  });

  it("calls onLens with 'search' when the Search tab is clicked", () => {
    const onLens = vi.fn();
    renderControls({ onLens });
    fireEvent.click(screen.getByRole("button", { name: /^Search$/i }));
    expect(onLens).toHaveBeenCalledWith("search");
  });

  it("marks the Search tab as active (aria-pressed=true) when lens=search", () => {
    renderControls({ lens: "search" });
    const searchTab = screen.getByRole("button", { name: /^Search$/i });
    expect(searchTab.getAttribute("aria-pressed")).toBe("true");
  });

  it("marks the Overview tab as active when lens=overview", () => {
    renderControls({ lens: "overview" });
    const overviewTab = screen.getByRole("button", { name: /Overview/i });
    expect(overviewTab.getAttribute("aria-pressed")).toBe("true");
    const searchTab = screen.getByRole("button", { name: /^Search$/i });
    expect(searchTab.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("KGControls — SC#1: search input mutual exclusivity", () => {
  it("renders the full-text input ONLY when lens=search (not for entity)", () => {
    renderControls({ lens: "search" });
    // The full-text search input has this placeholder (UI-SPEC Copywriting Contract)
    const fullTextInput = screen.getByPlaceholderText(
      /Search facts & relationships…/i,
    );
    expect(fullTextInput).toBeTruthy();
    // The entity-name input must NOT be visible
    const entityInput = screen.queryByPlaceholderText(/Search entity by name…/i);
    expect(entityInput).toBeNull();
  });

  it("renders the entity-name input ONLY when lens=entity (not for search)", () => {
    renderControls({ lens: "entity" });
    const entityInput = screen.getByPlaceholderText(/Search entity by name…/i);
    expect(entityInput).toBeTruthy();
    // The full-text search input must NOT be visible
    const fullTextInput = screen.queryByPlaceholderText(
      /Search facts & relationships…/i,
    );
    expect(fullTextInput).toBeNull();
  });

  it("renders neither entity-name nor full-text input when lens=overview", () => {
    renderControls({ lens: "overview" });
    expect(
      screen.queryByPlaceholderText(/Search entity by name…/i),
    ).toBeNull();
    expect(
      screen.queryByPlaceholderText(/Search facts & relationships…/i),
    ).toBeNull();
  });

  it("renders neither input when lens=contradiction", () => {
    renderControls({ lens: "contradiction" });
    expect(
      screen.queryByPlaceholderText(/Search entity by name…/i),
    ).toBeNull();
    expect(
      screen.queryByPlaceholderText(/Search facts & relationships…/i),
    ).toBeNull();
  });
});

describe("KGControls — Search full-text input behavior", () => {
  it("calls setFilter('searchQuery', value) when the full-text input changes", () => {
    const setFilter = vi.fn();
    renderControls({ lens: "search", setFilter });
    const input = screen.getByPlaceholderText(/Search facts & relationships…/i);
    fireEvent.change(input, { target: { value: "architecture" } });
    expect(setFilter).toHaveBeenCalledWith("searchQuery", "architecture");
  });

  it("reflects the current searchQuery value in the full-text input", () => {
    renderControls({
      lens: "search",
      filters: { ...defaultFilters, searchQuery: "temporal memory" },
    });
    const input = screen.getByPlaceholderText(
      /Search facts & relationships…/i,
    ) as HTMLInputElement;
    expect(input.value).toBe("temporal memory");
  });

  it("full-text input has the correct placeholder per UI-SPEC Copywriting Contract", () => {
    renderControls({ lens: "search" });
    expect(
      screen.getByPlaceholderText("Search facts & relationships…"),
    ).toBeTruthy();
  });
});

describe("KGControls — Search lens hint tooltip", () => {
  it("Search tab has the correct hint tooltip matching the UI-SPEC", () => {
    renderControls();
    const searchTab = screen.getByRole("button", { name: /^Search$/i });
    expect(searchTab.getAttribute("title")).toBe(
      "Full-text across fact text + relationship labels",
    );
  });
});
