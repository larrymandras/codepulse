import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import KGViewsPopover from "./KGViewsPopover";
import type { SavedKgView } from "../../hooks/useSavedViews";
import type { Id } from "../../../convex/_generated/dataModel";

// Radix UI Popover uses ResizeObserver internally; jsdom doesn't provide it.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const makeView = (overrides: Partial<SavedKgView> = {}): SavedKgView => ({
  _id: "sv1" as Id<"savedKgViews">,
  _creationTime: Date.now(),
  name: "My View",
  lens: "entity",
  filters: { entityType: null, predicate: null, agentId: null, hops: 1, asOf: null, limit: 100 },
  focus: "Alice",
  hops: 1,
  shareToken: "tok-abc-123",
  createdAt: Date.now() - 7200000, // 2h ago
  ...overrides,
});

function renderPopover(overrides: {
  views?: SavedKgView[];
  activeViewId?: string | null;
  onLoadView?: (view: SavedKgView) => void;
  onDeleteView?: (id: Id<"savedKgViews">) => void;
  onCopyLink?: (shareToken: string) => void;
  onSaveView?: (name: string) => void;
} = {}) {
  const props = {
    views: overrides.views ?? [],
    activeViewId: overrides.activeViewId ?? null,
    onLoadView: overrides.onLoadView ?? vi.fn(),
    onDeleteView: overrides.onDeleteView ?? vi.fn(),
    onCopyLink: overrides.onCopyLink ?? vi.fn(),
    onSaveView: overrides.onSaveView ?? vi.fn(),
  };
  return render(<KGViewsPopover {...props} />);
}

describe("KGViewsPopover — empty state", () => {
  it("renders 'No saved views yet' when views array is empty", () => {
    renderPopover({ views: [] });
    // Open the popover first
    const trigger = screen.getByRole("button", { name: /Views/i });
    fireEvent.click(trigger);
    expect(screen.getByText(/No saved views yet/i)).toBeTruthy();
  });

  it("renders the empty state body copy", () => {
    renderPopover({ views: [] });
    const trigger = screen.getByRole("button", { name: /Views/i });
    fireEvent.click(trigger);
    expect(
      screen.getByText(/Save the current lens, filters, and focus as a named view/i),
    ).toBeTruthy();
  });
});

describe("KGViewsPopover — view list", () => {
  it("clicking a view row calls onLoadView with that view", () => {
    const view = makeView();
    const onLoadView = vi.fn();
    renderPopover({ views: [view], onLoadView });
    fireEvent.click(screen.getByRole("button", { name: /Views/i }));
    // Click the view row (role="button" div) — use exact aria-label
    const rowEl = screen.getByRole("button", { name: view.name });
    fireEvent.click(rowEl);
    expect(onLoadView).toHaveBeenCalledWith(view);
  });

  it("clicking the trash icon calls onDeleteView and does NOT call onLoadView (stopPropagation)", () => {
    const view = makeView();
    const onDeleteView = vi.fn();
    const onLoadView = vi.fn();
    renderPopover({ views: [view], onDeleteView, onLoadView });
    fireEvent.click(screen.getByRole("button", { name: /Views/i }));
    const trashBtn = screen.getByRole("button", {
      name: new RegExp(`Delete view ${view.name}`, "i"),
    });
    fireEvent.click(trashBtn);
    expect(onDeleteView).toHaveBeenCalledWith(view._id);
    expect(onLoadView).not.toHaveBeenCalled();
  });

  it("clicking the Copy link button calls onCopyLink with the row's shareToken", () => {
    const view = makeView({ shareToken: "tok-xyz-999" });
    const onCopyLink = vi.fn();
    renderPopover({ views: [view], onCopyLink });
    fireEvent.click(screen.getByRole("button", { name: /Views/i }));
    const copyBtn = screen.getByRole("button", {
      name: new RegExp(`Copy link for ${view.name}`, "i"),
    });
    fireEvent.click(copyBtn);
    expect(onCopyLink).toHaveBeenCalledWith("tok-xyz-999");
  });
});

describe("KGViewsPopover — save-name inline expand", () => {
  it("confirming the save-name input with a non-empty name calls onSaveView(name)", () => {
    const onSaveView = vi.fn();
    renderPopover({ onSaveView });
    // Click the Save view expand button
    const saveBtn = screen.getByRole("button", { name: /Save view/i });
    fireEvent.click(saveBtn);
    // Input should appear
    const input = screen.getByPlaceholderText(/Name this view…/i);
    fireEvent.change(input, { target: { value: "My Analysis" } });
    // Confirm via Enter
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSaveView).toHaveBeenCalledWith("My Analysis");
  });

  it("confirming the save-name input with an EMPTY name does NOT call onSaveView", () => {
    const onSaveView = vi.fn();
    renderPopover({ onSaveView });
    const saveBtn = screen.getByRole("button", { name: /Save view/i });
    fireEvent.click(saveBtn);
    const input = screen.getByPlaceholderText(/Name this view…/i);
    // Leave name empty and press Enter
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSaveView).not.toHaveBeenCalled();
  });
});
