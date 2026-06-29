/**
 * ForceGraph3D — Wave 0 Nyquist RED scaffold (Phase 91, Plan 01)
 *
 * Tests cover:
 *   SC#1 — toggle restore: 2D→3D toggle shows force-graph-3d; clicking 2D restores
 *           force-graph-canvas
 *   SC#4 — disposal mock: toggling 3D→2D unmounts force-graph-3d without throwing
 *   SC#5 — colorFn hex: nodeColor fn returns colors.primary / colors.vaultNode
 *           (plain hex, no rgba — Three.js Color drops rgba alpha silently)
 *
 * These tests RED-fail until the Wave 1/2 implementation lands in Plans 02-03.
 * Do NOT stub the implementation to make them pass — RED is the intended state.
 */

import { describe, it, vi, beforeEach, expect, afterEach } from "vitest";
import {
  render as rtlRender,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import {
  makeProjectGraphFixture,
  mockGetProjectGraph,
} from "@/test/projectGraphFixture";

// ---------------------------------------------------------------------------
// Module mocks — declared before component import (Vitest hoisting)
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

// useThemeColors (Phase 89) — verbatim from CodeVaultGraph.test.tsx L49-64
// primary "#10b981" and vaultNode "#8b5cf6" are the hex values asserted in SC#5
vi.mock("../../hooks/useThemeColors", () => ({
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

// useKnowledgeGraph (Phase 85) — stub so cross-graph KG link gate sees no entities
vi.mock("../../hooks/useKnowledgeGraph", () => ({
  useKnowledgeGraph: () => ({
    setLens: vi.fn(),
    setFilter: vi.fn(),
    loading: false,
    error: null,
    graph: { nodes: [], links: [] },
  }),
}));

// Capture last props passed to ForceGraph3D for nodeColor/nodeVal assertions (SC#5)
let lastForceGraph3DProps: Record<string, any> = {};

// Mock react-force-graph-3d — heavy WebGL/Three.js dep not available in jsdom.
// Returns a div with data-testid="force-graph-3d" so SC#1/SC#4 can assert presence.
// Captures all props (including nodeColor, nodeVal callbacks) for SC#5 assertions.
vi.mock("react-force-graph-3d", () => ({
  default: (props: Record<string, any>) => {
    lastForceGraph3DProps = props;
    return (
      <div
        data-testid="force-graph-3d"
        data-node-count={props.graphData?.nodes?.length ?? 0}
      />
    );
  },
}));

// Mock idb-keyval — IndexedDB unavailable in jsdom.
// Wired by Plan 02 implementation (render-mode persistence key "codepulse:render-mode").
// Default resolved value undefined → stays "2d" until a 3D toggle commit is tested.
vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
}));

// Mock ForceGraphCanvas — heavy canvas dep not available in jsdom.
// Returns the testid div so SC#1 can assert the 2D surface reappears after toggling back.
vi.mock("@/components/graph/ForceGraphCanvas", () => ({
  ForceGraphCanvas: (props: Record<string, any>) => (
    <div
      data-testid="force-graph-canvas"
      data-node-count={props.data?.nodes?.length ?? 0}
    />
  ),
}));

// Mock shadcn Tooltip — not relevant to behavior assertions
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => (asChild ? <>{children}</> : <div>{children}</div>),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Import component after mocks (Vitest hoists vi.mock calls above this)
// ---------------------------------------------------------------------------

import { CodeVaultGraph } from "./CodeVaultGraph";

// Render inside a Router so react-router-dom hooks resolve
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ForceGraph3D — Wave 0 RED scaffold (SC#1 / SC#4 / SC#5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastForceGraph3DProps = {};
  });

  afterEach(() => {
    cleanup();
  });

  // ── SC#1: toggle-restore ─────────────────────────────────────────────────
  // Clicking "3D" shows the 3D surface; clicking "2D" restores ForceGraphCanvas.
  // RED: The render-mode toggle (aria-label="Render mode" group) does not exist
  // until Plans 02-03 land — getByRole("button", { name: "3D" }) throws here.

  it("SC#1: clicking '3D' toggle shows force-graph-3d; clicking '2D' restores force-graph-canvas", async () => {
    const fixture = makeProjectGraphFixture();
    mockGetProjectGraph(fixture);

    render(<CodeVaultGraph />);

    // Initial 2D state — the 2D canvas surface should be present
    expect(screen.getByTestId("force-graph-canvas")).toBeDefined();

    // Find the render-mode toggle and click "3D"
    // RED: throws "Unable to find an accessible element with the role 'button'
    // and name '3D'" until the toggle UI is added in Plan 02
    const toggle3D = screen.getByRole("button", { name: "3D" });
    await act(async () => {
      fireEvent.click(toggle3D);
    });

    // The lazy 3D component should appear after clicking; Suspense resolves
    // synchronously in jsdom when the module is mocked
    const fg3d = await screen.findByTestId("force-graph-3d");
    expect(fg3d).toBeDefined();

    // The 2D canvas should be gone while 3D is active
    expect(screen.queryByTestId("force-graph-canvas")).toBeNull();

    // Click "2D" to restore the 2D surface
    const toggle2D = screen.getByRole("button", { name: "2D" });
    await act(async () => {
      fireEvent.click(toggle2D);
    });

    // The 2D canvas should be back and 3D surface should be unmounted
    expect(screen.getByTestId("force-graph-canvas")).toBeDefined();
    expect(screen.queryByTestId("force-graph-3d")).toBeNull();
  });

  // ── SC#4: disposal-mock ──────────────────────────────────────────────────
  // Toggling 3D→2D unmounts the 3D component; the library's _destructor fires
  // automatically on React unmount (renderer.dispose(), emptyObject(scene), etc.).
  // RED: same "button 3D not found" failure as SC#1.

  it("SC#4: toggling back to 2D unmounts force-graph-3d without throwing (disposal mock)", async () => {
    const fixture = makeProjectGraphFixture();
    mockGetProjectGraph(fixture);

    render(<CodeVaultGraph />);

    // Switch to 3D — RED: button "3D" does not exist until Plan 02
    const toggle3D = screen.getByRole("button", { name: "3D" });
    await act(async () => {
      fireEvent.click(toggle3D);
    });

    // Verify 3D surface is mounted
    await screen.findByTestId("force-graph-3d");

    // Switch back to 2D — the 3D component unmounts; library _destructor fires
    const toggle2D = screen.getByRole("button", { name: "2D" });
    await act(async () => {
      fireEvent.click(toggle2D);
    });

    // 3D surface should be gone (unmounted → WebGL context disposed)
    expect(screen.queryByTestId("force-graph-3d")).toBeNull();
  });

  // ── SC#5: colorFn-hex ────────────────────────────────────────────────────
  // The nodeColor prop passed to react-force-graph-3d must be a function returning
  // plain hex strings (not rgba — Three.js Color ignores rgba alpha, producing
  // black nodes). Mocked useThemeColors returns primary "#10b981", vaultNode "#8b5cf6".
  // RED: same "button 3D not found" failure as SC#1.

  it("SC#5: nodeColor returns colors.primary (hex) for code nodes and colors.vaultNode (hex) for vault nodes", async () => {
    const fixture = makeProjectGraphFixture();
    mockGetProjectGraph(fixture);

    render(<CodeVaultGraph />);

    // Switch to 3D so LazyForceGraph3D receives props — RED: button "3D" does not
    // exist until Plan 02; lastForceGraph3DProps stays empty and assertion fails
    const toggle3D = screen.getByRole("button", { name: "3D" });
    await act(async () => {
      fireEvent.click(toggle3D);
    });

    // Wait for the 3D component to mount and capture props
    await screen.findByTestId("force-graph-3d");

    const capturedColorFn = lastForceGraph3DProps.nodeColor;
    expect(typeof capturedColorFn).toBe("function");

    // Code node (graphify: id prefix, bare "codepulse" source) → colors.primary hex
    const codeNode = { source: "codepulse", id: "graphify:codepulse:src/a.ts" };
    expect(capturedColorFn(codeNode)).toBe("#10b981");

    // Vault node (vault: id prefix, bare "vault" source) → colors.vaultNode hex
    const vaultNode = { source: "vault", id: "vault:Note.md" };
    expect(capturedColorFn(vaultNode)).toBe("#8b5cf6");
  });
});
