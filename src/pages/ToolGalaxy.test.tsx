import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import type {
  CallGraphEdge,
  DiscoveredTool,
  Kit,
  McpServer,
} from "../lib/tool-galaxy";

/**
 * ForceGraph2D paints to a <canvas> jsdom can't run. Mock it (per ObsidianGraph
 * convention) capturing the props the page computes, so we can assert the
 * node-color / orphan logic and graphData passthrough without a real canvas.
 * The live render is covered by browser UAT.
 */
const h = vi.hoisted(() => ({ props: null as Record<string, any> | null }));
vi.mock("react-force-graph-2d", () => ({
  default: (props: Record<string, any>) => {
    h.props = props;
    return null;
  },
}));

// Drive the page off fixed sources instead of Convex.
const sources = vi.hoisted(() => ({
  tools: [] as DiscoveredTool[],
  mcpServers: [] as McpServer[],
  edges: [] as CallGraphEdge[],
  kits: [] as Kit[],
  loading: false,
}));
vi.mock("../hooks/useToolGalaxy", () => ({
  useToolGalaxySources: () => sources,
}));

// useProjectGraph (added in Phase 85) calls Convex useQuery — stub it so the
// test doesn't need a ConvexProvider. null → no code/vault nodes, so the
// cross-graph owning-agent link simply doesn't resolve (SC#3-safe degrade).
vi.mock("../hooks/useProjectGraph", () => ({
  useProjectGraph: () => null,
}));

import ToolGalaxy from "./ToolGalaxy";

// Render inside a Router so router hooks (useNavigate/useSearchParams) resolve.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

const tool = (name: string, extra: Partial<DiscoveredTool> = {}): DiscoveredTool => ({
  _id: `t-${name}`,
  name,
  source: "mcp",
  usageCount: 0,
  discoveredAt: 1,
  ...extra,
});
const edge = (agentId: string, toolName: string, extra: Partial<CallGraphEdge> = {}): CallGraphEdge => ({
  _id: `e-${agentId}-${toolName}`,
  agentId,
  toolName,
  sessionId: "s",
  callCount: 5,
  lastCallAt: Date.now() / 1000,
  errorCount: 0,
  status: "healthy",
  ...extra,
});

beforeEach(() => {
  h.props = null;
  sources.tools = [];
  sources.mcpServers = [];
  sources.edges = [];
  sources.kits = [];
  sources.loading = false;
});

describe("ToolGalaxy page", () => {
  it("shows a loading state while sources load (no graph rendered)", () => {
    sources.loading = true;
    render(<ToolGalaxy />);
    expect(screen.getByText(/Assembling capability galaxy/i)).toBeInTheDocument();
    expect(h.props).toBeNull();
  });

  it("renders an empty state when there is no telemetry", () => {
    render(<ToolGalaxy />);
    expect(
      screen.getByText(/No capabilities match the current filters/i),
    ).toBeInTheDocument();
    expect(h.props).toBeNull();
  });

  it("passes assembled graphData to the force graph", () => {
    sources.tools = [tool("Read")];
    sources.edges = [edge("skuld", "Read")];
    render(<ToolGalaxy />);
    expect(h.props).not.toBeNull();
    const ids = h.props!.graphData.nodes.map((n: any) => n.id);
    expect(ids).toContain("tool:Read");
    expect(ids).toContain("agent:skuld");
  });

  it("colors an orphan tool amber and a healthy tool emerald-ish", () => {
    sources.tools = [tool("Used"), tool("Unused")];
    sources.edges = [edge("skuld", "Used")];
    render(<ToolGalaxy />);
    const color = h.props!.nodeColor as (n: any) => string;
    const nodes: any[] = h.props!.graphData.nodes;
    const used = nodes.find((n) => n.id === "tool:Used");
    const unused = nodes.find((n) => n.id === "tool:Unused");
    expect(color(unused)).toBe("#eab308"); // orphan amber
    expect(color(used)).toMatch(/^rgb\(/); // emerald-derived
  });

  it("colors agent and server nodes with their kind colors", () => {
    sources.tools = [tool("ci", { serverName: "github" })];
    sources.mcpServers = [
      { _id: "s1", name: "github", status: "connected", lastSeenAt: 1 },
    ];
    sources.edges = [edge("skuld", "ci")];
    render(<ToolGalaxy />);
    const color = h.props!.nodeColor as (n: any) => string;
    expect(color({ kind: "agent", name: "skuld" })).toBe("#3b82f6");
    expect(color({ kind: "mcpServer", name: "github" })).toBe("#a78bfa");
  });

  it("renders kit nodes from the kits source and colors them distinctly", () => {
    sources.tools = [tool("Read")];
    sources.edges = [edge("skuld", "Read")];
    sources.kits = [
      { _id: "k1", name: "io", tools: ["Read"], updatedAt: 1 },
    ];
    render(<ToolGalaxy />);
    expect(h.props).not.toBeNull();
    const ids = h.props!.graphData.nodes.map((n: any) => n.id);
    expect(ids).toContain("kit:io");
    const color = h.props!.nodeColor as (n: any) => string;
    expect(color({ kind: "kit", name: "io" })).toBe("#f472b6");
    // kit -> tool membership link is present
    const hasMembership = h.props!.graphData.links.some(
      (l: any) => l.kind === "kit-tool",
    );
    expect(hasMembership).toBe(true);
  });
});
