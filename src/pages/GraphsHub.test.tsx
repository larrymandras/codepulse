import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { GraphSnapshot } from "../lib/graph-snapshot";

/**
 * ForceGraph2D paints to a <canvas> jsdom can't run. Mock it (per the
 * ToolGalaxy / ObsidianGraph convention), capturing the `data` the page feeds
 * it so we can assert source filtering without a real canvas. The live render
 * is covered by browser UAT.
 */
const h = vi.hoisted(() => ({ props: null as Record<string, any> | null }));
vi.mock("react-force-graph-2d", () => ({
  default: (props: Record<string, any>) => {
    h.props = props;
    return null;
  },
}));

// Drive the page off a fixed snapshot list instead of Convex.
const src = vi.hoisted(() => ({
  snapshots: [] as GraphSnapshot[],
  loading: false,
}));
vi.mock("../hooks/useGraphSnapshot", () => ({
  useGraphSnapshots: () => src,
}));

import GraphsHub from "./GraphsHub";

const renderHub = () =>
  render(
    <MemoryRouter>
      <GraphsHub />
    </MemoryRouter>,
  );

const snapshot = (over: Partial<GraphSnapshot> = {}): GraphSnapshot => ({
  snapshotId: "astridr-project-graph",
  snapshotTimestamp: 1700,
  nodes: [
    { id: "a", label: "Module A", type: "module", source: "graphify:codepulse:" },
    { id: "b", label: "Module B", type: "module", source: "graphify:codepulse:" },
    { id: "n1", label: "Note 1", type: "note", source: "vault:" },
    { id: "n2", label: "Note 2", type: "note", source: "vault:" },
  ],
  links: [
    { source: "a", target: "b", relation: "imports" },
    { source: "n1", target: "n2", relation: "wikilink" },
  ],
  ...over,
});

beforeEach(() => {
  h.props = null;
  src.snapshots = [];
  src.loading = false;
});

describe("GraphsHub page", () => {
  it("always renders the four navigable hub tiles (HUB-02)", () => {
    renderHub();
    expect(screen.getByText("Tool Galaxy")).toBeInTheDocument();
    expect(screen.getByText("KG Explorer")).toBeInTheDocument();
    expect(screen.getByText("Capabilities")).toBeInTheDocument();
    expect(screen.getByText("MCP Inventory")).toBeInTheDocument();
    // tiles link to real routes
    const galaxy = screen.getByText("Tool Galaxy").closest("a");
    expect(galaxy).toHaveAttribute("href", "/tool-galaxy");
  });

  it("shows a loading state while snapshots load (no graph rendered)", () => {
    src.loading = true;
    renderHub();
    expect(screen.getByText(/Loading graph snapshots/i)).toBeInTheDocument();
    expect(h.props).toBeNull();
  });

  it("shows the no-telemetry banner when there is no snapshot (HUB-01)", () => {
    renderHub();
    const banner = screen.getByText(/No graph snapshot yet/i).closest("div");
    expect(banner).toBeInTheDocument();
    // the banner mentions the Ástríðr cron + event explicitly
    expect(screen.getAllByText(/graph:snapshot/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/graph_snapshot/i)).toBeInTheDocument();
    expect(h.props).toBeNull();
  });

  it("renders the snapshot through the shared force graph (HUB-01)", () => {
    src.snapshots = [snapshot()];
    renderHub();
    expect(h.props).not.toBeNull();
    // ForceGraphCanvas passes the page's `data` to ForceGraph2D as `graphData`.
    const ids = h.props!.graphData.nodes.map((n: any) => n.id);
    expect(ids.sort()).toEqual(["a", "b", "n1", "n2"]);
    expect(h.props!.graphData.links).toHaveLength(2);
  });

  it("filters out a source family when its chip is toggled off", () => {
    src.snapshots = [snapshot()];
    renderHub();
    // Toggle off "Code repos" → only vault nodes remain, and the cross-source
    // graphify-internal link is pruned.
    fireEvent.click(screen.getByRole("button", { name: /Code repos/i }));
    const ids = h.props!.graphData.nodes.map((n: any) => n.id).sort();
    expect(ids).toEqual(["n1", "n2"]);
    expect(h.props!.graphData.links).toEqual([
      { source: "n1", target: "n2", relation: "wikilink" },
    ]);
  });
});
