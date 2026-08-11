/**
 * Galdr page — the "Recently used" chip contract (Phase 116, plan 116-08 Task 2).
 *
 * The plan defines this chip's semantics precisely because they are easy to get
 * subtly wrong: it selects exactly the prompts that have EVER been delivered,
 * newest first, with no time window and no cap — and a never-used prompt is
 * ABSENT rather than sorted to the end.
 *
 * Assertions land on rendered DOM order, not on the filter function in isolation.
 * The ordering override only matters if it survives into the DOM, and a filter
 * tested in isolation can be correct while the component ignores its output.
 */
import { describe, test, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const NEVER_USED = {
  _id: "p1",
  title: "Never used prompt",
  slug: "never-used",
  body: "no variables here",
  category: "planning",
  usageCount: 0,
  updatedAt: 3_000,
  variables: [],
};
const OLDER = {
  _id: "p2",
  title: "Older used prompt",
  slug: "older-used",
  body: "body b",
  category: "planning",
  usageCount: 5,
  lastUsedAt: 1_000,
  updatedAt: 2_000,
  variables: [],
};
const NEWER = {
  _id: "p3",
  title: "Newer used prompt",
  slug: "newer-used",
  body: "body c",
  category: "writing",
  usageCount: 1,
  lastUsedAt: 9_000,
  updatedAt: 1_000,
  variables: [],
};

vi.mock("@/hooks/useGaldrPrompts", () => ({
  useGaldrPromptsState: () => ({
    prompts: [NEVER_USED, OLDER, NEWER],
    isLoading: false,
  }),
  // `useGaldrPrompts` key dropped 2026-08-11 (v14.0 audit INT-06) — the real
  // export was removed as dead code, so mocking it here would assert a module
  // shape that no longer exists.
  useGaldrPromptVersions: () => [],
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => mockNavigate };
});

import Galdr from "./Galdr";

/** Titles in the order they actually appear in the document. */
function renderedTitles(): string[] {
  return screen
    .getAllByText(/prompt$/)
    .map((el) => el.textContent ?? "")
    .filter((t) => t.endsWith("prompt"));
}

describe("Galdr — Recently used chip", () => {
  test("CONTROL: the All chip renders all three prompts", () => {
    render(<Galdr />);
    const titles = renderedTitles();
    expect(titles).toContain("Never used prompt");
    expect(titles).toContain("Older used prompt");
    expect(titles).toContain("Newer used prompt");
  });

  test("Recently used excludes the never-used prompt and orders newest first", () => {
    render(<Galdr />);

    act(() => {
      fireEvent.click(screen.getByTestId("galdr-chip-recent"));
    });

    const titles = renderedTitles();

    // A prompt that has never been delivered has no lastUsedAt and is absent.
    expect(titles).not.toContain("Never used prompt");

    expect(titles).toContain("Older used prompt");
    expect(titles).toContain("Newer used prompt");

    // Ordering asserted on the DOM, not on the filter's return value.
    expect(titles.indexOf("Newer used prompt")).toBeLessThan(
      titles.indexOf("Older used prompt")
    );
  });
});
