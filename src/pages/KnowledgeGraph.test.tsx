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
import { render as rtlRender, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forwardRef, useImperativeHandle } from "react";
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
// so the toggle test can assert the 3D surface actually mounted. Wrapped in
// forwardRef (mirrors the real component's ref API) so the answer-sync tests
// can inspect zoomToFit/cameraPosition/refresh calls via the shared handle
// mock below — a plain function component would silently drop `ref`.
export const mockFgRef3dHandle = {
  cameraPosition: vi.fn(),
  zoomToFit: vi.fn(),
  refresh: vi.fn(),
  scene: vi.fn(),
  renderer: vi.fn(),
  d3Force: vi.fn(),
  d3ReheatSimulation: vi.fn(),
  pauseAnimation: vi.fn(),
  resumeAnimation: vi.fn(),
};

// Captures the most recent props passed to the mocked ForceGraph3D (187-05
// fix regression test) — used to call the real `colorFn` (colorFn3D) against
// a neighbor node id and prove litNodeIds/coloring stayed scoped to the real
// source even though zoomToFit's framing filter was widened to include it.
export const mockForceGraph3DProps: { current: Record<string, any> | null } = {
  current: null,
};

vi.mock("../components/graph/ForceGraph3D", () => ({
  ForceGraph3D: forwardRef((props: Record<string, any>, ref: any) => {
    useImperativeHandle(ref, () => mockFgRef3dHandle);
    mockForceGraph3DProps.current = props;
    return (
      <div
        data-testid="force-graph-3d"
        data-node-count={props.data?.nodes?.length ?? 0}
      />
    );
  }),
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
// convex/react + generated api — the answer-sync effect's only live Convex
// call (every other hook touching Convex is mocked wholesale above/below).
// mockLatestAnswerSync is Vitest's "mock"-prefix hoisting escape hatch (see
// docs: only const/function bindings prefixed "mock" may be referenced inside
// a vi.mock factory, since vi.mock calls are hoisted above module init).
// ---------------------------------------------------------------------------

export const mockLatestAnswerSync = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockLatestAnswerSync(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: { kg: { latestAnswerSync: "kg:latestAnswerSync" } },
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

// ---------------------------------------------------------------------------
// Answer-sync fixtures (Phase 187 Plan 05, GLXY-01) — sourceNodeIds must be
// UUID-shaped (V5/T-187-13), so these are canonical 8-4-4-4-12 hex strings,
// distinct from FIXTURE_NODE's non-UUID "org-1" id used by the color-ladder
// tests above.
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const NOT_A_UUID = "not-a-uuid";

// On-screen node (x/y already laid out) matching UUID_A — used for the D-07
// "all sources on-screen" primary path.
const ONSCREEN_NODE_A = {
  id: UUID_A,
  name: "Acme Corp",
  entityType: "organization",
  agentId: "agent-1",
  val: 2,
  degree: 0,
  color: "#3b82f6",
  attributes: [],
  synthetic: false,
  community: null,
  x: 10,
  y: 20,
  z: 0,
};

// A node NOT matching any lit id — used so graph.nodes is non-empty (the
// page renders its "No entities" placeholder instead of ForceGraph3D when
// graph.nodes is truly empty) while the lit source id is still off-screen.
const DISTRACTOR_NODE = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Unrelated Widget Co",
  entityType: "organization",
  agentId: "agent-1",
  val: 2,
  degree: 0,
  color: "#3b82f6",
  attributes: [],
  synthetic: false,
  community: null,
  x: 100,
  y: 200,
  z: 0,
};

// A second on-screen node, 1-hop-linked to ONSCREEN_NODE_A (UUID_A) but NOT
// itself a lit source id — used by the 187-05 neighbor-framing regression
// test (single-source fly should widen zoomToFit's filter to include this
// node while litNodeIds/coloring stays scoped to UUID_A only).
const ONSCREEN_NEIGHBOR_OF_A = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Neighbor Widget Co",
  entityType: "organization",
  agentId: "agent-1",
  val: 2,
  degree: 0,
  color: "#3b82f6",
  attributes: [],
  synthetic: false,
  community: null,
  x: 50,
  y: 60,
  z: 0,
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
    // No sync row (loading) — keeps the answer-sync effect a no-op for these
    // toggle-focused tests (SC#2 default).
    mockLatestAnswerSync.mockReturnValue(undefined);
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
// Answer-sync reaction tests (Phase 187 Plan 05, GLXY-01)
//
// requestAnimationFrame is stubbed deterministically (mirrors
// graph-center.test.ts's established precedent) — callbacks queue into
// `rafCbs` and are advanced manually via flushRaf(), so the D-09 poll's
// maxFrames=90 budget-expiry path is exercised without any real wall-clock
// wait.
// ---------------------------------------------------------------------------

describe("KnowledgeGraph — answer sync reaction (Phase 187 Plan 05, GLXY-01)", () => {
  let rafCbs: Array<() => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(idbGet).mockResolvedValue(undefined);
    vi.mocked(idbSet).mockResolvedValue(undefined);
    mockLatestAnswerSync.mockReturnValue(undefined);

    rafCbs = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      rafCbs.push(cb);
      return rafCbs.length;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const flushRaf = () => {
    const batch = rafCbs;
    rafCbs = [];
    batch.forEach((cb) => cb());
  };

  /** Mounts KnowledgeGraph already hydrated into 3D mode (idb key pre-seeded). */
  async function renderIn3D(overrides: Partial<ReturnType<typeof makeMockKg>> = {}) {
    mockKgReturn = makeMockKg(overrides);
    vi.mocked(idbGet).mockImplementation((key: unknown) =>
      key === "codepulse:kg-render-mode"
        ? Promise.resolve("3d")
        : Promise.resolve(undefined),
    );
    const result = render(<KnowledgeGraph />);
    await waitFor(() => {
      expect(screen.getByTestId("force-graph-3d")).toBeDefined();
    });
    return result;
  }

  it("SC#1: a new sync with all source ids on-screen calls zoomToFit(800, 60, filterFn) matching exactly the lit ids", async () => {
    mockLatestAnswerSync.mockReturnValue({
      turnId: "sess-1:1",
      sourceNodeIds: [UUID_A],
      primaryEntityName: "Acme Corp",
      updatedAt: 1,
    });

    await renderIn3D({
      graph: { nodes: [ONSCREEN_NODE_A], links: [], stats: EMPTY_STATS },
    });

    // The D-07 poll's first synchronous attempt can find fgRef3d.current
    // still null (the lazy ForceGraph3D hasn't mounted through its Suspense
    // boundary on this render yet) and queue a retry — flush the
    // deterministic rAF queue on every waitFor poll so that retry runs once
    // the ref (confirmed attached by renderIn3D's own waitFor) is noticed.
    await waitFor(() => {
      flushRaf();
      expect(mockFgRef3dHandle.zoomToFit).toHaveBeenCalledTimes(1);
    });
    const [ms, px, filterFn] = mockFgRef3dHandle.zoomToFit.mock.calls[0];
    expect(ms).toBe(800);
    expect(px).toBe(60);
    expect(filterFn({ id: UUID_A })).toBe(true);
    expect(filterFn({ id: UUID_B })).toBe(false);
  });

  it("187-05 neighbor framing: a single-source fly widens zoomToFit's filter to include the source's 1-hop neighbor, while litNodeIds/coloring stays scoped to the source only", async () => {
    mockLatestAnswerSync.mockReturnValue({
      turnId: "sess-neighbor:1",
      sourceNodeIds: [UUID_A],
      primaryEntityName: "Acme Corp",
      updatedAt: 1,
    });

    // A single lit source (UUID_A) with one loaded 1-hop neighbor and one
    // unrelated distractor with no edge to UUID_A — proves the widening is
    // genuinely neighbor-scoped, not "light everything on screen".
    // `as any`: makeMockKg's inferred `graph.links` defaults to `never[]`
    // (from its own `links: []` literal) since every other test overrides it
    // with another empty array — this is the first override with real link
    // objects, which `never[]` structurally rejects even though the runtime
    // shape (KgLink) is correct.
    await renderIn3D({
      graph: {
        nodes: [ONSCREEN_NODE_A, ONSCREEN_NEIGHBOR_OF_A, DISTRACTOR_NODE],
        links: [{ id: "l1", source: UUID_A, target: ONSCREEN_NEIGHBOR_OF_A.id, current: true }],
        stats: EMPTY_STATS,
      } as any,
    });

    await waitFor(() => {
      flushRaf();
      expect(mockFgRef3dHandle.zoomToFit).toHaveBeenCalledTimes(1);
    });
    const [ms, px, filterFn] = mockFgRef3dHandle.zoomToFit.mock.calls[0];
    expect(ms).toBe(800);
    expect(px).toBe(60);
    // Camera framing widens to source + its neighbor...
    expect(filterFn({ id: UUID_A })).toBe(true);
    expect(filterFn({ id: ONSCREEN_NEIGHBOR_OF_A.id })).toBe(true);
    // ...but NOT to an unrelated node with no edge to the source.
    expect(filterFn({ id: DISTRACTOR_NODE.id })).toBe(false);

    // litNodeIds/coloring stays scoped to the REAL source only — the neighbor
    // must never be colored/sized as "lit" even though it's in-frame.
    const colorFn3D = mockForceGraph3DProps.current?.colorFn;
    expect(colorFn3D).toBeTypeOf("function");
    expect(colorFn3D({ id: UUID_A, color: "#3b82f6" })).toBe("#10b981"); // lit
    expect(colorFn3D({ id: ONSCREEN_NEIGHBOR_OF_A.id, color: "#3b82f6" })).toBe("#3b82f6"); // NOT lit — normal color
  });

  it("SC#2: re-rendering with the SAME turnId never calls zoomToFit a second time (zero-motion no-op)", async () => {
    mockLatestAnswerSync.mockReturnValue({
      turnId: "sess-1:1",
      sourceNodeIds: [UUID_A],
      primaryEntityName: "Acme Corp",
      updatedAt: 1,
    });

    const { rerender } = await renderIn3D({
      graph: { nodes: [ONSCREEN_NODE_A], links: [], stats: EMPTY_STATS },
    });

    await waitFor(() => {
      flushRaf();
      expect(mockFgRef3dHandle.zoomToFit).toHaveBeenCalledTimes(1);
    });

    rerender(<KnowledgeGraph />);
    expect(mockFgRef3dHandle.zoomToFit).toHaveBeenCalledTimes(1);
  });

  it("SC#2: a sync row present but renderMode is 2D calls zoomToFit zero times", () => {
    mockLatestAnswerSync.mockReturnValue({
      turnId: "sess-1:1",
      sourceNodeIds: [UUID_A],
      primaryEntityName: "Acme Corp",
      updatedAt: 1,
    });
    mockKgReturn = makeMockKg({
      graph: { nodes: [ONSCREEN_NODE_A], links: [], stats: EMPTY_STATS },
    });
    // idbGet default resolves undefined -> stays 2D (no hydration override).
    render(<KnowledgeGraph />);

    expect(screen.getByTestId("force-graph-canvas")).toBeDefined();
    expect(screen.queryByTestId("force-graph-3d")).toBeNull();
    expect(mockFgRef3dHandle.zoomToFit).not.toHaveBeenCalled();
  });

  it("UUID-validation: a non-UUID id is dropped — the filter fn matches only the valid id", async () => {
    mockLatestAnswerSync.mockReturnValue({
      turnId: "sess-1:2",
      sourceNodeIds: [UUID_A, NOT_A_UUID],
      primaryEntityName: "Acme Corp",
      updatedAt: 1,
    });

    await renderIn3D({
      graph: { nodes: [ONSCREEN_NODE_A], links: [], stats: EMPTY_STATS },
    });

    await waitFor(() => {
      flushRaf();
      expect(mockFgRef3dHandle.zoomToFit).toHaveBeenCalledTimes(1);
    });
    const [, , filterFn] = mockFgRef3dHandle.zoomToFit.mock.calls[0];
    expect(filterFn({ id: UUID_A })).toBe(true);
    expect(filterFn({ id: NOT_A_UUID })).toBe(false);
  });

  it("UUID-validation: a payload with only invalid ids no-ops (zoomToFit never called)", async () => {
    mockLatestAnswerSync.mockReturnValue({
      turnId: "sess-1:3",
      sourceNodeIds: [NOT_A_UUID],
      primaryEntityName: "Acme Corp",
      updatedAt: 1,
    });

    await renderIn3D({
      graph: { nodes: [ONSCREEN_NODE_A], links: [], stats: EMPTY_STATS },
    });

    expect(mockFgRef3dHandle.zoomToFit).not.toHaveBeenCalled();
  });

  it("D-09 ego-lens fallback: an off-screen source triggers setLens('entity') + setFilter('entityName', ...) without an immediate zoomToFit", async () => {
    const setLens = vi.fn();
    const setFilter = vi.fn();
    mockLatestAnswerSync.mockReturnValue({
      turnId: "sess-2:1",
      sourceNodeIds: [UUID_A],
      primaryEntityName: "Acme Corp",
      updatedAt: 1,
    });

    // UUID_A is NOT present in graph.nodes (only a distractor is) -> off-screen
    // -> D-09 fallback. graph.nodes must stay non-empty or the page renders
    // its "No entities" placeholder instead of ForceGraph3D.
    await renderIn3D({
      graph: { nodes: [DISTRACTOR_NODE], links: [], stats: EMPTY_STATS },
      setLens,
      setFilter,
    });

    await waitFor(() => {
      expect(setLens).toHaveBeenCalledWith("entity");
    });
    expect(setFilter).toHaveBeenCalledWith("entityName", "Acme Corp");
    expect(setFilter).toHaveBeenCalledWith("hops", 1);
    // The poll hasn't resolved (the node never lays out in this test) — no
    // no-op fly to an unrendered node (SC#1 guarantee).
    expect(mockFgRef3dHandle.zoomToFit).not.toHaveBeenCalled();
  });

  it("stale-source degrade: partial resolution renders the amber banner and still flies to the resolved subset", async () => {
    mockLatestAnswerSync.mockReturnValue({
      turnId: "sess-3:1",
      sourceNodeIds: [UUID_A, UUID_B],
      primaryEntityName: "Acme Corp",
      updatedAt: 1,
    });

    // UUID_A resolves (on-screen with x/y); UUID_B never lays out.
    await renderIn3D({
      graph: { nodes: [ONSCREEN_NODE_A], links: [], stats: EMPTY_STATS },
    });

    // Not all-on-screen (UUID_B missing) -> D-09 fallback -> poll runs until
    // its maxFrames=90 budget expires, then flies to the resolved subset.
    await act(async () => {
      for (let i = 0; i < 90; i++) flushRaf();
    });

    expect(mockFgRef3dHandle.zoomToFit).toHaveBeenCalledTimes(1);
    const [, , filterFn] = mockFgRef3dHandle.zoomToFit.mock.calls[0];
    expect(filterFn({ id: UUID_A })).toBe(true);
    expect(filterFn({ id: UUID_B })).toBe(false);

    expect(
      screen.getByText(
        /Some grounded sources are no longer in the graph — showing 1 of 2\./,
      ),
    ).toBeDefined();
  });
});
