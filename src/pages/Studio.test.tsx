/**
 * Studio page — the honest-empty-state distinction and the filter chip's
 * actual filtering effect (Phase 118, plan 118-10).
 *
 * Phase 114's code review caught a real bug of exactly this shape: a
 * permanent loading skeleton sat next to a canvas correctly reporting "no
 * data" because the loading/empty signals were collapsed. Every assertion
 * below is paired with the OTHER state so a check that would look identical
 * if the distinction were broken is not evidence (2026-08 verification
 * discipline).
 *
 * Radix `Tabs.Content` unmounts inactive panels by default (no
 * `forceMount`), so only the active tab's `useQuery` call is live at a
 * given render — a single static mock return per test is sufficient; no
 * per-query discrimination against the `api` proxy is needed here.
 */
import { describe, test, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const h = vi.hoisted(() => ({ queryResult: undefined as unknown }));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => h.queryResult,
}));

import Studio from "./Studio";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: "m1",
    filename: "sunset.webp",
    absPath: "C:\\media-vault\\gen\\sunset.webp",
    mediaType: "image",
    kind: "gen",
    hasProvenance: true,
    thumbnailUrl: "https://example.test/thumb.webp",
    createdAt: 1000,
    ...overrides,
  };
}

describe("Studio Gallery — loading vs loaded-but-empty", () => {
  test("loading (query undefined) shows skeletons, never the empty-state copy", () => {
    h.queryResult = undefined;
    render(<Studio />);
    expect(screen.getByTestId("studio-loading-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("No media yet")).not.toBeInTheDocument();
  });

  test("loaded but genuinely empty shows 'No media yet' and ZERO skeletons", () => {
    h.queryResult = { rows: [], cap: 500 };
    render(<Studio />);
    expect(screen.getByText("No media yet")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-loading-skeleton")).not.toBeInTheDocument();
  });
});

describe("Studio Gallery — zero-match vs table-empty are different states", () => {
  test("rows exist but the search matches none: zero-match, NOT 'No media yet'", () => {
    h.queryResult = { rows: [makeRow()], cap: 500 };
    render(<Studio />);
    fireEvent.change(screen.getByLabelText("Search media"), {
      target: { value: "zzz-does-not-exist-anywhere" },
    });
    expect(screen.getByText("[ NO MEDIA MATCHES ]")).toBeInTheDocument();
    expect(screen.queryByText("No media yet")).not.toBeInTheDocument();
  });

  test("CONTROL: the same rows with no search render the grid, not either empty state", () => {
    h.queryResult = { rows: [makeRow()], cap: 500 };
    render(<Studio />);
    expect(screen.getByTestId("studio-media-card-m1")).toBeInTheDocument();
    expect(screen.queryByText("[ NO MEDIA MATCHES ]")).not.toBeInTheDocument();
    expect(screen.queryByText("No media yet")).not.toBeInTheDocument();
  });
});

describe("Studio Trash — loading/empty/zero-match mirrors Gallery", () => {
  test("loaded but genuinely empty shows 'Trash is empty'", () => {
    h.queryResult = { rows: [], cap: 500 };
    render(<Studio />);
    // Radix's TabsTrigger activates on mousedown, not click (`onMouseDown`
    // calls `context.onValueChange`; a bare `fireEvent.click` never fires it).
    fireEvent.mouseDown(screen.getByTestId("studio-tab-trash"));
    expect(screen.getByText("Trash is empty")).toBeInTheDocument();
  });

  test("trashed rows exist but the search matches none: zero-match, NOT 'Trash is empty'", () => {
    h.queryResult = { rows: [makeRow({ deletedAt: 2000, daysUntilPurge: 10 })], cap: 500 };
    render(<Studio />);
    // Radix's TabsTrigger activates on mousedown, not click (`onMouseDown`
    // calls `context.onValueChange`; a bare `fireEvent.click` never fires it).
    fireEvent.mouseDown(screen.getByTestId("studio-tab-trash"));
    fireEvent.change(screen.getByLabelText("Search media"), {
      target: { value: "zzz-does-not-exist-anywhere" },
    });
    expect(screen.getByText("[ NO MEDIA MATCHES ]")).toBeInTheDocument();
    expect(screen.queryByText("Trash is empty")).not.toBeInTheDocument();
  });
});

describe("Studio Gallery — the Missing Provenance chip actually changes the rendered content", () => {
  test("clicking the chip removes the complete-recipe card and keeps the provenance-absent one", () => {
    h.queryResult = {
      rows: [
        makeRow({ _id: "complete", hasProvenance: true }),
        makeRow({ _id: "no-prov", hasProvenance: false }),
      ],
      cap: 500,
    };
    render(<Studio />);

    // CONTROL: before clicking, both cards are present.
    expect(screen.getByTestId("studio-media-card-complete")).toBeInTheDocument();
    expect(screen.getByTestId("studio-media-card-no-prov")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("studio-chip-missing-provenance"));

    expect(screen.queryByTestId("studio-media-card-complete")).not.toBeInTheDocument();
    expect(screen.getByTestId("studio-media-card-no-prov")).toBeInTheDocument();
  });
});
