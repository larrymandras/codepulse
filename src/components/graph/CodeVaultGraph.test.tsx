/**
 * CodeVaultGraph tests (Phase 84, plan 02, GH-02)
 *
 * All 9 behaviors from 84-VALIDATION.md are asserted here.
 * The fullscreen ESC/viewport-fill and simulation warmup behaviors are MANUAL-ONLY
 * per 84-VALIDATION.md — not asserted in jsdom.
 *
 * Behaviors under test (9 rows from 84-VALIDATION.md):
 *   1. Render with data — canvas region present, legend visible
 *   2. Loading state on undefined (Convex resolving)
 *   3. Empty state on null (no snapshot ingested, D-12)
 *   4. Source filter drops vault nodes + dangling links when "code" selected
 *   5. Truncation header "X of Y nodes" + truncated badge
 *   6. Stale badge when generatedAt*1000 > 36 h ago
 *   7. Integrity warning when storedNodeCount < nodeCount
 *   8. Detail panel on node click (id/label/type/source/community/neighbors)
 *   9. colorFn → #10b981 for code-source nodes, #8b5cf6 for vault-source nodes
 */

import { describe, it, vi, beforeEach, expect, afterEach } from "vitest";
import { render as rtlRender, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import {
  makeProjectGraphFixture,
  mockGetProjectGraph,
} from "@/test/projectGraphFixture";

// ---------------------------------------------------------------------------
// Module mocks — declared before component import
// ---------------------------------------------------------------------------

// Mock convex/react so useProjectGraph never hits a real Convex backend
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    graphSnapshots: {
      getProjectGraph: "graphSnapshots:getProjectGraph",
    },
  },
}));

// useKnowledgeGraph (added in Phase 85) persists via idb-keyval — IndexedDB is
// absent in jsdom. Stub it so the cross-graph KG link gate sees zero entities
// (no link section renders — SC#3-safe degrade) without touching IndexedDB.
vi.mock("../../hooks/useKnowledgeGraph", () => ({
  useKnowledgeGraph: () => ({
    setLens: vi.fn(),
    setFilter: vi.fn(),
    loading: false,
    error: null,
    graph: { nodes: [], links: [] },
  }),
}));

// Capture last props passed to ForceGraphCanvas for colorFn assertions
let lastForceGraphProps: Record<string, any> = {};

// Mock ForceGraphCanvas — heavy canvas dep not available in jsdom.
// Captures props for colorFn/labelFn/onNodeClick assertions.
vi.mock("@/components/graph/ForceGraphCanvas", () => ({
  ForceGraphCanvas: (props: Record<string, any>) => {
    lastForceGraphProps = props;
    return (
      <div
        data-testid="force-graph-canvas"
        data-node-count={props.data?.nodes?.length ?? 0}
        onClick={() => {
          // Allow tests to simulate a node click by firing the canvas click
          // with a synthetic node (tests can also call onNodeClick directly)
        }}
      />
    );
  },
}));

// Mock shadcn Tooltip (not relevant to behavior assertions).
// Must export TooltipProvider — the component supplies its own local provider
// (the missing-provider runtime crash is covered by CodeVaultGraph.tooltip.test.tsx).
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { CodeVaultGraph } from "./CodeVaultGraph";

// Render inside a Router so router hooks (useNavigate/useSearchParams) resolve.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CodeVaultGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastForceGraphProps = {};
  });

  afterEach(() => {
    cleanup();
  });

  // ── Test 1: render with data ─────────────────────────────────────────────

  it("renders nodes and legend when snapshot data is available (render-with-data)", () => {
    const fixture = makeProjectGraphFixture();
    mockGetProjectGraph(fixture);

    render(<CodeVaultGraph />);

    // Canvas region present
    expect(screen.getByTestId("force-graph-canvas")).toBeDefined();

    // Legend entries visible
    expect(screen.getByText("Code (graphify)")).toBeDefined();
    expect(screen.getByText("Vault (Obsidian)")).toBeDefined();

    // "Showing X of Y nodes" header
    expect(screen.getByText(/Showing \d+ of \d+ nodes/)).toBeDefined();
  });

  // ── Test 2: loading state ────────────────────────────────────────────────

  it("shows loading pulse when useQuery returns undefined (loading state)", () => {
    mockGetProjectGraph(undefined);

    render(<CodeVaultGraph />);

    // Loading pulse text present
    expect(screen.getByText("Loading graph snapshot…")).toBeDefined();

    // No canvas in loading state
    expect(screen.queryByTestId("force-graph-canvas")).toBeNull();
  });

  // ── Test 3: empty/explainer state ────────────────────────────────────────

  it("shows empty/explainer state when useQuery returns null (no snapshot, D-12)", () => {
    mockGetProjectGraph(null);

    render(<CodeVaultGraph />);

    // D-12 explainer heading
    expect(screen.getByText("No graph snapshot received yet")).toBeDefined();

    // D-12 explainer body mentions the cron
    expect(screen.getByText(/nightly graph_snapshot cron/)).toBeDefined();

    // No canvas in empty state
    expect(screen.queryByTestId("force-graph-canvas")).toBeNull();
  });

  // ── Test 4: source filter drops vault nodes + dangling links ─────────────

  it("source filter 'code' drops vault nodes and removes dangling links from data passed to ForceGraphCanvas", () => {
    // Fixture has 2 graphify nodes + 1 vault node + a cross-source link (a.ts → Note.md)
    const fixture = makeProjectGraphFixture();
    mockGetProjectGraph(fixture);

    render(<CodeVaultGraph />);

    // Initially "Both" — all 3 nodes passed to canvas
    const canvasBefore = screen.getByTestId("force-graph-canvas");
    expect(canvasBefore.getAttribute("data-node-count")).toBe("3");

    // Click the "Code" filter chip
    const codeChip = screen.getByRole("button", { name: "Code" });
    fireEvent.click(codeChip);

    // After filter: only 2 graphify nodes; vault node and cross-source link dropped
    const canvasAfter = screen.getByTestId("force-graph-canvas");
    expect(canvasAfter.getAttribute("data-node-count")).toBe("2");

    // Verify no vault node in the filtered data. Vault nodes are discriminated
    // by the `vault:` id prefix (source is a bare name like "vault"/"codepulse").
    const filteredNodes: any[] = lastForceGraphProps.data?.nodes ?? [];
    expect(filteredNodes.every((n: any) => !n.id.startsWith("vault:"))).toBe(true);

    // Verify no dangling link (the cross-source link source=a.ts target=Note.md should be gone)
    const filteredLinks: any[] = lastForceGraphProps.data?.links ?? [];
    const keptIds = new Set(filteredNodes.map((n: any) => n.id));
    const hasDangling = filteredLinks.some(
      (l: any) => !keptIds.has(l.source) || !keptIds.has(l.target)
    );
    expect(hasDangling).toBe(false);
  });

  // ── Test 4b: Vault filter shows vault nodes (UAT-84 regression) ───────────

  it("source filter 'vault' keeps only the vault node (bare 'vault' source, not 'vault:')", () => {
    // Real getProjectGraph emits node.source as a BARE name ("vault"), with the
    // `vault:` prefix only on the node id. A startsWith("vault:") check on
    // node.source matched nothing → Vault filter showed "0 of 3 nodes" in UAT.
    const fixture = makeProjectGraphFixture();
    mockGetProjectGraph(fixture);

    render(<CodeVaultGraph />);

    fireEvent.click(screen.getByRole("button", { name: "Vault" }));

    const canvas = screen.getByTestId("force-graph-canvas");
    expect(canvas.getAttribute("data-node-count")).toBe("1");

    const filteredNodes: any[] = lastForceGraphProps.data?.nodes ?? [];
    expect(filteredNodes).toHaveLength(1);
    expect(filteredNodes[0].id).toBe("vault:Note.md");
    expect(filteredNodes[0].source).toBe("vault");
  });

  // ── Test 5: truncation header ─────────────────────────────────────────────

  it("truncation header shows 'X of Y nodes' when sources[].truncated is true or emittedNodeCount > nodeCount", () => {
    // truncated=true → the graphify source entry has emittedNodeCount=2, nodeCount=5, truncated=true
    const fixture = makeProjectGraphFixture({ truncated: true });
    mockGetProjectGraph(fixture);

    render(<CodeVaultGraph />);

    // "X of Y nodes" summary line (X = filteredData.nodes.length = 3, Y = nodeCount = 3)
    expect(screen.getByText(/Showing \d+ of \d+ nodes/)).toBeDefined();

    // Per-source chip shows emittedNodeCount / nodeCount ("emitted / total").
    // For the graphify source (truncated): emittedNodeCount=2, nodeCount=5 → "codepulse: 2 / 5"
    expect(screen.getByText(/codepulse:\s*2\s*\/\s*5/)).toBeDefined();

    // "truncated" badge appears
    expect(screen.getAllByText("truncated").length).toBeGreaterThan(0);
  });

  // ── Test 6: freshness / stale badge ──────────────────────────────────────

  it("stale freshness badge renders when generatedAt*1000 is more than 36 hours ago", () => {
    // staleGeneratedAt: 48 hours ago in Unix seconds
    const staleTs = (Date.now() - 48 * 60 * 60 * 1000) / 1000;
    const staleFixture = makeProjectGraphFixture({ staleGeneratedAt: staleTs });
    mockGetProjectGraph(staleFixture);

    const { unmount } = render(<CodeVaultGraph />);

    // "stale" badge renders
    expect(screen.getByText("stale")).toBeDefined();
    unmount();
  });

  it("fresh snapshot does not render the stale badge", () => {
    // Fresh fixture (generatedAt = now) — should NOT show stale badge
    const freshFixture = makeProjectGraphFixture();
    mockGetProjectGraph(freshFixture);

    const { unmount } = render(<CodeVaultGraph />);
    expect(screen.queryByText("stale")).toBeNull();
    unmount();
  });

  // ── Test 7: integrity warning ─────────────────────────────────────────────

  it("integrity warning renders when storedNodeCount < nodeCount or storedLinkCount < linkCount (D-08)", () => {
    // storedNodeCountOverride=2, nodeCount=3 → storedNodeCount(2) < nodeCount(3)
    const integrityFixture = makeProjectGraphFixture({ storedNodeCountOverride: 2 });
    mockGetProjectGraph(integrityFixture);

    const { unmount } = render(<CodeVaultGraph />);

    // Nodes-only discrepancy must report nodes — not a misleading "links" message (WR-01).
    // storedNodeCount=2, nodeCount=3 → "1 node dropped during ingest"
    expect(screen.getByText(/1 node dropped during ingest/)).toBeDefined();
    expect(screen.queryByText(/link[s]? dropped/)).toBeNull();
    unmount();
  });

  it("integrity warning reports links when only links were dropped (WR-01)", () => {
    // storedLinkCountOverride=0, linkCount=2 → links-only discrepancy
    const linkFixture = makeProjectGraphFixture({ storedLinkCountOverride: 0 });
    mockGetProjectGraph(linkFixture);

    const { unmount } = render(<CodeVaultGraph />);
    expect(screen.getByText(/2 links dropped during ingest/)).toBeDefined();
    expect(screen.queryByText(/node[s]? dropped/)).toBeNull();
    unmount();
  });

  it("integrity warning does not render when stored counts match emitted counts", () => {
    // Default fixture: storedNodeCount === nodeCount, storedLinkCount === linkCount
    const cleanFixture = makeProjectGraphFixture();
    mockGetProjectGraph(cleanFixture);

    const { unmount } = render(<CodeVaultGraph />);
    expect(screen.queryByText(/dropped during ingest/)).toBeNull();
    unmount();
  });

  // ── Test 8: detail panel on node click ────────────────────────────────────

  it("clicking a node opens the detail panel showing id, label, type, source, community, and neighbors", () => {
    const fixture = makeProjectGraphFixture();
    mockGetProjectGraph(fixture);

    render(<CodeVaultGraph />);

    // Panel is not open initially (no node selected)
    expect(screen.queryByRole("button", { name: "Close node details" })).toBeNull();

    // Simulate a node click via the captured onNodeClick prop
    const nodeA = fixture.nodes[0]; // graphify:codepulse:src/a.ts
    expect(typeof lastForceGraphProps.onNodeClick).toBe("function");
    act(() => {
      lastForceGraphProps.onNodeClick(nodeA);
    });

    // Panel should now be open
    expect(screen.getByRole("button", { name: "Close node details" })).toBeDefined();
    expect(screen.getByLabelText("Node details")).toBeDefined();

    // Panel shows the node's id (truncated text)
    expect(screen.getByTitle(nodeA.id)).toBeDefined();

    // Panel shows the label
    expect(screen.getByText(nodeA.label)).toBeDefined();

    // Panel shows the type as a badge
    expect(screen.getByText(nodeA.type)).toBeDefined();

    // Panel shows source label
    expect(screen.getByText("codepulse")).toBeDefined();

    // Panel shows community
    expect(screen.getByText(/community:/)).toBeDefined();

    // Panel shows neighbors section (a.ts has neighbors: b.ts and Note.md)
    expect(screen.getByText(/Neighbors/)).toBeDefined();

    // Close panel
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Close node details" }));
    });
    expect(screen.queryByRole("button", { name: "Close node details" })).toBeNull();
  });

  // ── Test 9: colorFn returns correct colors ─────────────────────────────────

  it("colorFn returns #10b981 for code nodes and #8b5cf6 for vault nodes (by id prefix, bare source)", () => {
    const fixture = makeProjectGraphFixture();
    mockGetProjectGraph(fixture);

    render(<CodeVaultGraph />);

    // The colorFn was passed to ForceGraphCanvas — call it with test nodes.
    // Node shapes mirror real getProjectGraph: bare `source`, prefixed `id`.
    const capturedColorFn = lastForceGraphProps.colorFn;
    expect(typeof capturedColorFn).toBe("function");

    // code node (graphify: id prefix, bare "codepulse" source) → #10b981
    const codeNode = { source: "codepulse", id: "graphify:codepulse:src/a.ts" };
    expect(capturedColorFn(codeNode)).toBe("#10b981");

    // vault node (vault: id prefix, bare "vault" source) → #8b5cf6
    const vaultNode = { source: "vault", id: "vault:Note.md" };
    expect(capturedColorFn(vaultNode)).toBe("#8b5cf6");
  });
});
