import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// ── convex/react mocks ──────────────────────────────────────────────────────
// `useQuery` backs the direct `recentSkills` call; `useConvexConnectionState`
// is the reactive hook this plan binds the Convex dot to. Mutable so each
// test can flip the connection state and re-render.
let mockConnectionState: { isWebSocketConnected: boolean } = {
  isWebSocketConnected: true,
};
const mockUseConvexConnectionState = vi.fn(() => mockConnectionState);

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useConvexConnectionState: () => mockUseConvexConnectionState(),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    skillCategories: {
      getRecentlyUsedSkills: "skillCategories:getRecentlyUsedSkills",
    },
  },
}));

// ── domain hook mocks — VitalsRail composes seven of these; each returns a
// minimal, render-safe empty/undefined shape so the component mounts without
// crashing and without asserting on data this plan does not own. ───────────
vi.mock("@/hooks/useSystemResources", () => ({
  useSystemResources: vi.fn(() => undefined),
}));
vi.mock("@/hooks/useLlmMetrics", () => ({
  useLlmMetrics: vi.fn(() => ({ calls: [] })),
}));
vi.mock("@/hooks/useDockerHealth", () => ({
  useDockerHealth: vi.fn(() => []),
}));
vi.mock("@/hooks/useMcpHealth", () => ({
  useMcpHealthSources: vi.fn(() => ({
    mcpServers: [],
    tools: [],
    edges: [],
    governance: [],
    loading: false,
  })),
}));
vi.mock("@/hooks/useAlerts", () => ({
  useActiveAlerts: vi.fn(() => []),
}));
vi.mock("@/hooks/useActiveSessions", () => ({
  useActiveSessions: vi.fn(() => []),
}));
vi.mock("@/hooks/useRecentEvents", () => ({
  useRecentEvents: vi.fn(() => ({ events: [] })),
}));

import VitalsRail from "./VitalsRail";

function renderRail(disconnected: boolean) {
  return render(
    <MemoryRouter>
      <VitalsRail lastTurnModel={null} disconnected={disconnected} />
    </MemoryRouter>
  );
}

// The Convex dot lives inside the "Open Infrastructure" link, three lines
// below the Ástríðr dot (see VitalsRail.tsx:240-260). "Ástríðr"/"Convex" are
// bare text nodes inside their own wrapping <span>, so `getByText` returns
// that wrapper — the dot is its FIRST element child, not a sibling.
function getDotClass(label: "Ástríðr" | "Convex"): string {
  const wrapper = screen.getByText(label);
  const dot = wrapper.querySelector("span");
  if (!dot) throw new Error(`no dot child found inside "${label}" wrapper`);
  return dot.className;
}

beforeEach(() => {
  mockConnectionState = { isWebSocketConnected: true };
  mockUseConvexConnectionState.mockClear();
  cleanup();
});

describe("VitalsRail — Convex health dot", () => {
  it("renders the connected treatment when the WebSocket is connected", () => {
    mockConnectionState = { isWebSocketConnected: true };
    renderRail(false);
    expect(getDotClass("Convex")).toContain("--status-ok");
    expect(getDotClass("Convex")).not.toContain("--status-error");
  });

  it("renders the disconnected treatment when the WebSocket is not connected", () => {
    mockConnectionState = { isWebSocketConnected: false };
    renderRail(false);
    expect(getDotClass("Convex")).toContain("--status-error");
    expect(getDotClass("Convex")).not.toContain("--status-ok");
  });

  it("REACTIVITY PROOF: re-renders the dot's treatment when the mocked connection state flips", () => {
    mockConnectionState = { isWebSocketConnected: true };
    const { rerender } = renderRail(false);
    const connectedClass = getDotClass("Convex");
    expect(connectedClass).toContain("--status-ok");

    // Flip the mock's return value and re-render the SAME tree — a snapshot
    // binding (read once during the initial render) could never pick this up;
    // only a subscription re-renders on a changed value.
    mockConnectionState = { isWebSocketConnected: false };
    rerender(
      <MemoryRouter>
        <VitalsRail lastTurnModel={null} disconnected={false} />
      </MemoryRouter>
    );
    const disconnectedClass = getDotClass("Convex");
    expect(disconnectedClass).toContain("--status-error");

    // CONTROL: the assertion above only means something if the two strings
    // actually differ — print both and assert inequality directly.
    // eslint-disable-next-line no-console
    console.log("connected class:", connectedClass, "| disconnected class:", disconnectedClass);
    expect(connectedClass).not.toBe(disconnectedClass);
  });

  it("leaves the Ástríðr sibling dot's behaviour unchanged by the Convex connection state", () => {
    mockConnectionState = { isWebSocketConnected: true };
    renderRail(true); // Astridr disconnected, Convex connected
    expect(getDotClass("Ástríðr")).toContain("--status-error");
    expect(getDotClass("Convex")).toContain("--status-ok");
  });

  it("contains no unconditional health-asserting colour class on the Convex dot", () => {
    // A truly unconditional class (e.g. a bare "bg-(--status-ok)" with no
    // ternary) would be IDENTICAL across both connection states. Proving the
    // class differs by state (as the reactivity test above does) already
    // proves it is conditional; this test asserts the negative directly.
    mockConnectionState = { isWebSocketConnected: true };
    const { unmount } = renderRail(false);
    const connectedClass = getDotClass("Convex");
    unmount();

    mockConnectionState = { isWebSocketConnected: false };
    renderRail(false);
    const disconnectedClass = getDotClass("Convex");

    expect(connectedClass).not.toBe(disconnectedClass);
  });
});
