/**
 * KnowledgeGraph.tsx tests (Phase 187 Plan 04, GLXY-01)
 *
 * Covers this plan's two behaviors (187-04-PLAN.md must_haves):
 *   1. The 2D<->3D render-mode toggle persists under a KG-DISTINCT idb key
 *      ("codepulse:kg-render-mode") — isolated from /graphs' own
 *      "codepulse:render-mode" (T-187-11), so the two pages' toggle state
 *      never cross-clobbers.
 *   2. The 5-state colorFn3D/nodeValFn3D priority ladder (selected > hovered >
 *      lit > dimmed > normal), with the lit state (D-08) exempt from dimming
 *      even under an active ego-lens filter.
 *
 * The color-ladder assertions call the pure, exported computeColorFn3D /
 * computeNodeValFn3D functions directly (see KnowledgeGraph.tsx) rather than
 * mounting the page and driving litNodeIds through the UI — litNodeIds has no
 * external setter in this plan (Plan 05 wires it from the kg_answer_sync
 * subscription), so this is the only way to exercise the "lit" priority
 * branch before Plan 05 lands.
 *
 * describe("answer sync", ...) — Plan 05 adds the sync-reaction test cases
 * here (litNodeIds population from useQuery(api.kg.latestAnswerSync) +
 * camera fly-to). Not implemented by this plan.
 */

import { describe, it, vi, beforeEach, expect, afterEach } from "vitest";
import { render as rtlRender, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

// ---------------------------------------------------------------------------
// Module mocks — declared before component import
// ---------------------------------------------------------------------------

// useThemeColors resolves CSS custom properties via getComputedStyle, which
// jsdom returns as empty strings for — stub with known Matrix Emerald values
// (mirrors CodeVaultGraph.test.tsx's harness).
vi.mock("../hooks/useThemeColors", () => ({
  useThemeColors: () => ({
    primary: "#10b981",
    primaryAlpha18: "rgba(16, 185, 129, 0.18)",
    primaryAlpha55: "rgba(16, 185, 129, 0.55)",
    accent: "#059669",
    vaultNode: "#8b5cf6",
    vaultNodeAlpha18: "rgba(139, 92, 246, 0.18)",
    chartBar: "#10b981",
    chartBarAccent: "#059669",
    statusOk: "#10b981",
    statusWarn: "#f59e0b",
    statusError: "#ef4444",
    statusInfo: "#3b82f6",
  }),
}));

// idb-keyval — IndexedDB is absent in jsdom. Default get -> undefined so
// renderMode stays "2d" unless a test explicitly overrides idbGet's mock.
vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
}));

// ForceGraph3D — stub the lazy 3D surface (no WebGL in jsdom). Captures props
// so the toggle test can assert the 3D surface actually mounted.
vi.mock("../components/graph/ForceGraph3D", () => ({
  ForceGraph3D: (props: Record<string, any>) => (
    <div
      data-testid="force-graph-3d"
      data-node-count={props.data?.nodes?.length ?? 0}
    />
  ),
}));

// ForceGraphCanvas — heavy canvas dep not available in jsdom.
vi.mock("../components/graph/ForceGraphCanvas", () => ({
  ForceGraphCanvas: (props: Record<string, any>) => (
    <div
      data-testid="force-graph-canvas"
      data-node-count={props.data?.nodes?.length ?? 0}
    />
  ),
}));

// Heavy KG sub-components not under test here — stub as trivial placeholders
// so mounting the page doesn't pull in their own Convex/hook dependencies.
vi.mock("../components/kg/KGSummaryCards", () => ({
  default: () => <div data-testid="kg-summary-cards" />,
}));
vi.mock("../components/kg/KGControls", () => ({
  default: () => <div data-testid="kg-controls" />,
}));
vi.mock("../components/kg/KGDetailsPanel", () => ({
  default: () => <div data-testid="kg-details-panel" />,
}));
vi.mock("../components/kg/KGSearchResults", () => ({
  default: () => <div data-testid="kg-search-results" />,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// useKnowledgeGraph — mocked so tests control graph/selection state directly
// without touching a real /api/kg fetch or idb persistence.
// ---------------------------------------------------------------------------

const EMPTY_STATS = {
  nodeCount: 0,
  edgeCount: 0,
  attributeCount: 0,
  currentEdges: 0,
  supersededEdges: 0,
  contradictionEdges: 0,
};

// A single non-"person" entity (organization, #3b82f6) — deliberately avoids
// the entityTypeColor("person") === "#10b981" collision (RESEARCH Pitfall 5)
// so the lit-color assertion below is unambiguous.
const FIXTURE_NODE = {
  id: "org-1",
  name: "Acme Corp",
  entityType: "organization",
  agentId: "agent-1",
  val: 2,
  degree: 0,
  color: "#3b82f6",
  attributes: [],
  synthetic: false,
  community: null,
};

let mockKgReturn: any;

vi.mock("../hooks/useKnowledgeGraph", () => ({
  useKnowledgeGraph: () => mockKgReturn,
}));

vi.mock("../hooks/useSavedViews", () => ({
  useSavedViews: () => ({
    views: [],
    isLoading: false,
    saveView: vi.fn(),
    deleteView: vi.fn(),
    buildShareUrl: vi.fn().mockReturnValue(""),
  }),
}));

vi.mock("../hooks/useKgDiff", () => ({
  useKgDiff: () => ({
    diff: null,
    graphB: null,
    loading: false,
    error: null,
    compare: vi.fn(),
  }),
}));

vi.mock("../hooks/useKgAnimation", () => ({
  useKgAnimation: () => ({
    frames: [],
    currentFrameIndex: 0,
    currentGraph: null,
    isPlaying: false,
    fps: 1,
    frameError: null,
    play: vi.fn(),
    pause: vi.fn(),
    stepForward: vi.fn(),
    stepBack: vi.fn(),
    setFrameIndex: vi.fn(),
    setFps: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import KnowledgeGraph, { computeColorFn3D, computeNodeValFn3D } from "./KnowledgeGraph";
import { get as idbGet, set as idbSet } from "idb-keyval";

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

function makeMockKg(overrides: Partial<typeof mockKgReturn> = {}) {
  return {
    lens: "overview",
    setLens: vi.fn(),
    filters: {
      entityType: null,
      predicate: null,
      agentId: null,
      entityName: "",
      hops: 1,
      asOf: null,
      limit: 100,
      searchQuery: "",
    },
    setFilter: vi.fn(),
    graph: { nodes: [FIXTURE_NODE], links: [], stats: EMPTY_STATS },
    rawGraph: { nodes: [FIXTURE_NODE], links: [], stats: EMPTY_STATS },
    loading: false,
    error: null,
    truncated: null,
    refresh: vi.fn(),
    selectedNodeId: null,
    selectedEdgeId: null,
    selectNode: vi.fn(),
    selectEdge: vi.fn(),
    focusSet: null,
    predicates: [],
    entityTypes: ["organization"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KnowledgeGraph — 2D<->3D render-mode toggle idb-key isolation (T-187-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(idbGet).mockResolvedValue(undefined);
    vi.mocked(idbSet).mockResolvedValue(undefined);
    mockKgReturn = makeMockKg();
  });

  afterEach(() => cleanup());

  it("renders the 2D canvas by default", () => {
    render(<KnowledgeGraph />);
    expect(screen.getByTestId("force-graph-canvas")).toBeDefined();
    expect(screen.queryByTestId("force-graph-3d")).toBeNull();
  });

  it("clicking the 3D chip switches the render surface and persists under codepulse:kg-render-mode", async () => {
    render(<KnowledgeGraph />);

    const toggle3d = screen.getByRole("button", { name: "3D" });
    fireEvent.click(toggle3d);

    await waitFor(() => {
      expect(screen.getByTestId("force-graph-3d")).toBeDefined();
    });
    expect(screen.queryByTestId("force-graph-canvas")).toBeNull();

    expect(idbSet).toHaveBeenCalledWith("codepulse:kg-render-mode", "3d");
    // Never touches /graphs' own key — cross-clobber guard (T-187-11).
    expect(idbSet).not.toHaveBeenCalledWith("codepulse:render-mode", expect.anything());
  });

  it("clicking back to 2D never reads/writes the /graphs idb key either", async () => {
    render(<KnowledgeGraph />);

    fireEvent.click(screen.getByRole("button", { name: "3D" }));
    await waitFor(() => expect(screen.getByTestId("force-graph-3d")).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "2D" }));
    await waitFor(() => expect(screen.getByTestId("force-graph-canvas")).toBeDefined());

    for (const call of vi.mocked(idbSet).mock.calls) {
      expect(call[0]).toBe("codepulse:kg-render-mode");
    }
    expect(idbGet).toHaveBeenCalledWith("codepulse:kg-render-mode");
    expect(idbGet).not.toHaveBeenCalledWith("codepulse:render-mode");
  });

  it("hydrating with codepulse:kg-render-mode === '3d' starts in 3D", async () => {
    vi.mocked(idbGet).mockImplementation((key: unknown) =>
      key === "codepulse:kg-render-mode"
        ? Promise.resolve("3d")
        : Promise.resolve(undefined),
    );

    render(<KnowledgeGraph />);

    await waitFor(() => {
      expect(screen.getByTestId("force-graph-3d")).toBeDefined();
    });
  });

  it("toggle chips carry the required ARIA contract (role, aria-label, aria-pressed)", () => {
    render(<KnowledgeGraph />);

    const group = screen.getByRole("group", { name: "Render mode" });
    expect(group).toBeDefined();

    const chip2d = screen.getByRole("button", { name: "2D" });
    const chip3d = screen.getByRole("button", { name: "3D" });
    expect(chip2d.getAttribute("aria-pressed")).toBe("true");
    expect(chip3d.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(chip3d);
    expect(chip3d.getAttribute("aria-pressed")).toBe("true");
    expect(chip2d.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("KnowledgeGraph — colorFn3D/nodeValFn3D 5-state priority ladder (D-08 lit, dim-exempt)", () => {
  // An ego-lens filter/selection is active and org-1 (used below) is NOT a
  // member of the focus set — this is what triggers the priority-4 "dimmed"
  // branch absent a higher-priority match.
  const activeFocusSet = new Set(["neighbor-1"]);

  it("priority 1: selected wins over lit, hovered, and dimmed", () => {
    expect(
      computeColorFn3D({
        node: { id: "org-1", color: "#3b82f6" },
        selectedNodeId: "org-1",
        hoveredNodeId: null,
        litNodeIds: new Set(["org-1"]),
        focusSet: activeFocusSet,
      }),
    ).toBe("#ffffff");
  });

  it("priority 2: hovered wins over lit and dimmed", () => {
    expect(
      computeColorFn3D({
        node: { id: "org-1", color: "#3b82f6" },
        selectedNodeId: null,
        hoveredNodeId: "org-1",
        litNodeIds: new Set(["org-1"]),
        focusSet: activeFocusSet,
      }),
    ).toBe("#ffffff");
  });

  it("priority 3: a lit non-person entity returns #10b981 even while an ego-lens filter is active (dim-exempt)", () => {
    expect(
      computeColorFn3D({
        node: { id: "org-1", color: "#3b82f6" },
        selectedNodeId: null,
        hoveredNodeId: null,
        litNodeIds: new Set(["org-1"]),
        focusSet: activeFocusSet, // org-1 is NOT in the focus set — would dim, but lit wins
      }),
    ).toBe("#10b981");
  });

  it("priority 4: a dimmed non-lit node under an active filter returns #27272a", () => {
    expect(
      computeColorFn3D({
        node: { id: "org-1", color: "#3b82f6" },
        selectedNodeId: null,
        hoveredNodeId: null,
        litNodeIds: new Set(), // not lit
        focusSet: activeFocusSet,
      }),
    ).toBe("#27272a");
  });

  it("priority 4 does not apply when a lit id sits alongside a dimmed one under the same filter (co-filtered)", () => {
    const litId = computeColorFn3D({
      node: { id: "org-1", color: "#3b82f6" },
      selectedNodeId: null,
      hoveredNodeId: null,
      litNodeIds: new Set(["org-1"]),
      focusSet: activeFocusSet,
    });
    const dimmedId = computeColorFn3D({
      node: { id: "other-non-lit", color: "#3b82f6" },
      selectedNodeId: null,
      hoveredNodeId: null,
      litNodeIds: new Set(["org-1"]),
      focusSet: activeFocusSet,
    });
    expect(litId).toBe("#10b981");
    expect(dimmedId).toBe("#27272a");
  });

  it("priority 5: normal — returns the node's precomputed color when nothing else applies", () => {
    // neighbor-1 IS in the focus set (not dimmed) and not lit/selected/hovered.
    expect(
      computeColorFn3D({
        node: { id: "neighbor-1", color: "#3b82f6" },
        selectedNodeId: null,
        hoveredNodeId: null,
        litNodeIds: new Set(),
        focusSet: activeFocusSet,
      }),
    ).toBe("#3b82f6");
  });

  it("priority 5: no active filter (focusSet null) never dims — returns the precomputed color", () => {
    expect(
      computeColorFn3D({
        node: { id: "org-1", color: "#3b82f6" },
        selectedNodeId: null,
        hoveredNodeId: null,
        litNodeIds: new Set(),
        focusSet: null,
      }),
    ).toBe("#3b82f6");
  });

  it("nodeValFn3D: selected -> x3 (wins over lit)", () => {
    expect(
      computeNodeValFn3D({
        node: { id: "org-1", val: 2 },
        selectedNodeId: "org-1",
        litNodeIds: new Set(["org-1"]),
        litSizeMultiplier: 1.8,
      }),
    ).toBe(6);
  });

  it("nodeValFn3D: lit -> x1.8 (steady resting size, UI-SPEC D-08)", () => {
    expect(
      computeNodeValFn3D({
        node: { id: "org-1", val: 2 },
        selectedNodeId: null,
        litNodeIds: new Set(["org-1"]),
        litSizeMultiplier: 1.8,
      }),
    ).toBeCloseTo(3.6);
  });

  it("nodeValFn3D: normal -> unchanged", () => {
    expect(
      computeNodeValFn3D({
        node: { id: "org-1", val: 2 },
        selectedNodeId: null,
        litNodeIds: new Set(),
        litSizeMultiplier: 1.8,
      }),
    ).toBe(2);
  });

  it("nodeValFn3D: missing val defaults to 1 before multiplying", () => {
    expect(
      computeNodeValFn3D({
        node: { id: "org-1" },
        selectedNodeId: null,
        litNodeIds: new Set(["org-1"]),
        litSizeMultiplier: 1.8,
      }),
    ).toBeCloseTo(1.8);
  });
});

// ---------------------------------------------------------------------------
// Plan 05 extends this file with answer-sync reaction cases:
//   describe("answer sync", () => { ... litNodeIds population from
//   useQuery(api.kg.latestAnswerSync), D-07 zoomToFit camera fly, D-09
//   ego-lens fallback ... })
// Not implemented by this plan (187-04) — litNodeIds stays dormant/empty.
// ---------------------------------------------------------------------------
