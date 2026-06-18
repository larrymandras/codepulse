/**
 * ForgeLogPane tests (Phase 81, plan 03, FI-10)
 *
 * Tests the tail-style live log pane:
 * (1) renders one monospace line per chunk line in order
 * (2) empty chunks → "Waiting for logs…" shown, no throw
 * (3) scroll-up past threshold sets pill visible (JumpToLatestPill receives visible=true)
 * (4) clicking jump-to-latest hides the pill and scrolls to bottom
 *
 * useForgeJobLogs is mocked — no Convex backend needed.
 * JumpToLatestPill is mocked — asserts visible prop without animation dep.
 *
 * jsdom does not lay out — scrollHeight/clientHeight/scrollTop are 0 by default.
 * We manually set them on the viewport element to simulate scroll state.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useForgeJobLogs from the hook module
const mockUseForgeJobLogs = vi.fn();
vi.mock("@/hooks/useForge", () => ({
  useForgeJobLogs: (...args: unknown[]) => mockUseForgeJobLogs(...args),
}));

// Mock JumpToLatestPill — capture the visible prop for assertions
const mockJumpToLatestPill = vi.fn(
  ({ visible, onClick }: { visible: boolean; onClick: () => void }) => (
    visible ? (
      <button data-testid="jump-pill" onClick={onClick}>
        Jump to latest
      </button>
    ) : null
  )
);
vi.mock("@/components/JumpToLatestPill", () => ({
  JumpToLatestPill: (props: { visible: boolean; onClick: () => void }) =>
    mockJumpToLatestPill(props),
}));

import { ForgeLogPane } from "./ForgeLogPane";
import type { ForgeLogChunk } from "@/hooks/useForge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChunk(overrides: Partial<ForgeLogChunk> = {}): ForgeLogChunk {
  return {
    id: "chunk-1",
    seq: 0,
    lines: ["line one"],
    sentAt: null,
    ...overrides,
  };
}

const DEFAULT_PROPS = { hostId: "host-1", forgeJobId: "job-42" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ForgeLogPane — line rendering", () => {
  beforeEach(() => {
    mockUseForgeJobLogs.mockReset();
    mockJumpToLatestPill.mockClear();
  });

  it("renders one monospace line per chunk.lines entry in order", () => {
    const chunks: ForgeLogChunk[] = [
      makeChunk({ id: "c1", seq: 0, lines: ["alpha", "beta"] }),
      makeChunk({ id: "c2", seq: 1, lines: ["gamma"] }),
    ];
    mockUseForgeJobLogs.mockReturnValue(chunks);

    render(<ForgeLogPane {...DEFAULT_PROPS} />);

    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("gamma")).toBeInTheDocument();
  });

  it("lines appear in document order (alpha before beta before gamma)", () => {
    const chunks: ForgeLogChunk[] = [
      makeChunk({ id: "c1", seq: 0, lines: ["alpha", "beta"] }),
      makeChunk({ id: "c2", seq: 1, lines: ["gamma"] }),
    ];
    mockUseForgeJobLogs.mockReturnValue(chunks);

    render(<ForgeLogPane {...DEFAULT_PROPS} />);

    const all = screen.getAllByText(/alpha|beta|gamma/);
    expect(all[0]).toHaveTextContent("alpha");
    expect(all[1]).toHaveTextContent("beta");
    expect(all[2]).toHaveTextContent("gamma");
  });
});

describe("ForgeLogPane — empty state", () => {
  beforeEach(() => {
    mockUseForgeJobLogs.mockReset();
    mockJumpToLatestPill.mockClear();
  });

  it("shows 'Waiting for logs…' when chunks is empty, no throw", () => {
    mockUseForgeJobLogs.mockReturnValue([]);

    expect(() => render(<ForgeLogPane {...DEFAULT_PROPS} />)).not.toThrow();
    expect(screen.getByText(/Waiting for logs/i)).toBeInTheDocument();
  });
});

describe("ForgeLogPane — auto-follow / pause-on-scroll-up", () => {
  beforeEach(() => {
    mockUseForgeJobLogs.mockReset();
    mockJumpToLatestPill.mockClear();
  });

  it("shows JumpToLatestPill after scroll-up past 100px threshold", () => {
    const chunks: ForgeLogChunk[] = [
      makeChunk({ id: "c1", seq: 0, lines: ["line 1"] }),
    ];
    mockUseForgeJobLogs.mockReturnValue(chunks);

    const { container } = render(<ForgeLogPane {...DEFAULT_PROPS} />);

    // Find the scroll viewport (the inner div with onScroll)
    const viewport = container.querySelector(
      "[data-testid='forge-log-viewport']"
    ) as HTMLElement;
    expect(viewport).not.toBeNull();

    // Simulate scroll-up past threshold:
    // scrollTop + clientHeight < scrollHeight - 100
    // Set scrollHeight=600, clientHeight=400, scrollTop=50
    // 50 + 400 = 450 < 600 - 100 = 500 → paused
    Object.defineProperty(viewport, "scrollHeight", { value: 600, configurable: true });
    Object.defineProperty(viewport, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(viewport, "scrollTop", { value: 50, configurable: true, writable: true });

    fireEvent.scroll(viewport);

    // JumpToLatestPill should be visible now
    expect(screen.getByTestId("jump-pill")).toBeInTheDocument();
  });

  it("hides JumpToLatestPill when near bottom (within 100px threshold)", () => {
    const chunks: ForgeLogChunk[] = [
      makeChunk({ id: "c1", seq: 0, lines: ["line 1"] }),
    ];
    mockUseForgeJobLogs.mockReturnValue(chunks);

    const { container } = render(<ForgeLogPane {...DEFAULT_PROPS} />);
    const viewport = container.querySelector(
      "[data-testid='forge-log-viewport']"
    ) as HTMLElement;

    // First scroll up to show pill
    Object.defineProperty(viewport, "scrollHeight", { value: 600, configurable: true });
    Object.defineProperty(viewport, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(viewport, "scrollTop", { value: 50, configurable: true, writable: true });
    fireEvent.scroll(viewport);
    expect(screen.getByTestId("jump-pill")).toBeInTheDocument();

    // Now scroll back to near-bottom: 200 + 400 = 600 = 600 - 0 → >= 600-100=500 → resume
    Object.defineProperty(viewport, "scrollTop", { value: 200, configurable: true, writable: true });
    fireEvent.scroll(viewport);

    // Pill should be gone
    expect(screen.queryByTestId("jump-pill")).not.toBeInTheDocument();
  });
});

describe("ForgeLogPane — jump-to-latest", () => {
  beforeEach(() => {
    mockUseForgeJobLogs.mockReset();
    mockJumpToLatestPill.mockClear();
  });

  it("clicking jump-to-latest hides the pill and sets scrollTop to scrollHeight", () => {
    const chunks: ForgeLogChunk[] = [
      makeChunk({ id: "c1", seq: 0, lines: ["line 1"] }),
    ];
    mockUseForgeJobLogs.mockReturnValue(chunks);

    const { container } = render(<ForgeLogPane {...DEFAULT_PROPS} />);
    const viewport = container.querySelector(
      "[data-testid='forge-log-viewport']"
    ) as HTMLElement;

    // Scroll up to show pill
    Object.defineProperty(viewport, "scrollHeight", { value: 600, configurable: true });
    Object.defineProperty(viewport, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(viewport, "scrollTop", { value: 50, configurable: true, writable: true });
    fireEvent.scroll(viewport);
    expect(screen.getByTestId("jump-pill")).toBeInTheDocument();

    // Click the pill
    fireEvent.click(screen.getByTestId("jump-pill"));

    // Pill hidden
    expect(screen.queryByTestId("jump-pill")).not.toBeInTheDocument();

    // scrollTop set to scrollHeight (600)
    expect(viewport.scrollTop).toBe(600);
  });
});
