/**
 * GraphsHub tests (Phase 84, plan 03, GH-03)
 *
 * Behaviors under test:
 *   1. Three MetricCard summary tiles render (KG Explorer, Tool Galaxy, MCP Inventory)
 *   2. Clicking each tile navigates to its route (/knowledge-graph, /tool-galaxy, /mcp-inventory)
 */

import { describe, it, vi, beforeEach, afterEach, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks — declared before component import
// ---------------------------------------------------------------------------

// Mock convex/react — GraphsHub tiles derive counts from Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    graphSnapshots: {
      getProjectGraph: "graphSnapshots:getProjectGraph",
    },
    kg: {
      latestSummary: "kg:latestSummary",
    },
    registry: {
      listAllTools: "registry:listAllTools",
      listMcpServers: "registry:listMcpServers",
      summary: "registry:summary",
    },
    memory: {
      overview: "memory:overview",
    },
    swarmTasks: {
      listGoals: "swarmTasks:listGoals",
    },
    callGraphEdges: {
      listEdges: "callGraphEdges:listEdges",
    },
    kits: {
      listKits: "kits:listKits",
    },
    toolGovernance: {
      listGovernance: "toolGovernance:listGovernance",
    },
  },
}));

// Capture the navigate mock so we can assert calls
const mockNavigate = vi.fn();

// Mock react-router navigate — GraphsHub tiles call useNavigate on click
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock CodeVaultGraph — plan 02 implements it; plan 03 tests hub around it
vi.mock("@/components/graph/CodeVaultGraph", () => ({
  CodeVaultGraph: () => (
    <div data-testid="code-vault-graph-stub" />
  ),
  default: () => (
    <div data-testid="code-vault-graph-stub" />
  ),
}));

// Mock ForceGraphCanvas — canvas not available in jsdom
vi.mock("@/components/graph/ForceGraphCanvas", () => ({
  ForceGraphCanvas: () => (
    <div data-testid="force-graph-canvas-stub" />
  ),
}));

// ---------------------------------------------------------------------------
// Import the component under test (after mocks)
// ---------------------------------------------------------------------------

import GraphsHub from "./GraphsHub";
import { useQuery } from "convex/react";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * D-14 (122-14): each tile now declares an explicit MetricCard `state`, and
 * MetricCard only omits the label text in the "loading" state (every other
 * state — ready/empty/unavailable/error — still renders it). So the
 * per-tile "resolved" fixtures below must return non-`undefined` values for
 * every query these six tiles read, or every tile would render its loading
 * skeleton (no label) instead of the content these tests assert on — which
 * is exactly the T-122-14-A defect this plan exists to remove, not a
 * regression to work around.
 */
function resolvedUseQuery(ref: unknown) {
  switch (ref) {
    case "registry:listAllTools":
    case "registry:listMcpServers":
    case "callGraphEdges:listEdges":
    case "kits:listKits":
    case "toolGovernance:listGovernance":
    case "swarmTasks:listGoals":
      return [];
    case "kg:latestSummary":
      return {
        entitiesByType: {},
        totalEntities: 0,
        currentTripleCount: 0,
        historicalTripleCount: 0,
        contradictionCount: 0,
        updatedAt: Date.now(),
      };
    case "registry:summary":
      return { mcpServers: 0, plugins: 0, skills: 0, tools: 0, hooks: 0 };
    case "memory:overview":
      return { total: 0, byAgent: {}, byType: {} };
    default:
      return undefined;
  }
}

describe("GraphsHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default: every query this page's six tiles read resolves to a real
    // (if empty) value, so every tile renders its "ready"/"empty" content
    // rather than a loading skeleton. Individual tests override this via
    // `vi.mocked(useQuery).mockReturnValue(undefined)` where a loading case
    // is what's under test.
    vi.mocked(useQuery).mockImplementation((...args: unknown[]) => resolvedUseQuery(args[0]));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders six MetricCard summary tiles, one per graph surface", () => {
    render(<GraphsHub />);

    // All six tile labels must appear (MetricCard renders label as uppercase text)
    expect(screen.getByText("TOOL GALAXY")).toBeTruthy();
    expect(screen.getByText("MCP INVENTORY")).toBeTruthy();
    expect(screen.getByText("KG EXPLORER")).toBeTruthy();
    expect(screen.getByText("CAPABILITIES")).toBeTruthy();
    expect(screen.getByText("3D MEMORY GALAXY")).toBeTruthy();
    expect(screen.getByText("HIVE / SWARM")).toBeTruthy();
  });

  it("clicking the Tool Galaxy tile navigates to /tool-galaxy", () => {
    render(<GraphsHub />);

    // MetricCard renders label in a <p> with onClick on parent div
    // Click the card element containing the "TOOL GALAXY" label
    const labelEl = screen.getByText("TOOL GALAXY");
    // Walk up to the clickable card container (the glow-card div)
    const card = labelEl.closest(".glow-card") ?? labelEl.parentElement!;
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/tool-galaxy");
  });

  it("clicking the MCP Inventory tile navigates to /mcp-inventory", () => {
    render(<GraphsHub />);

    const labelEl = screen.getByText("MCP INVENTORY");
    const card = labelEl.closest(".glow-card") ?? labelEl.parentElement!;
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/mcp-inventory");
  });

  it("clicking the KG Explorer tile navigates to /knowledge-graph", () => {
    render(<GraphsHub />);

    const labelEl = screen.getByText("KG EXPLORER");
    const card = labelEl.closest(".glow-card") ?? labelEl.parentElement!;
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/knowledge-graph");
  });

  it("clicking the Capabilities tile navigates to /capabilities", () => {
    render(<GraphsHub />);

    const labelEl = screen.getByText("CAPABILITIES");
    const card = labelEl.closest(".glow-card") ?? labelEl.parentElement!;
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/capabilities");
  });

  it("clicking the 3D Memory Galaxy tile navigates to /memory", () => {
    render(<GraphsHub />);

    const labelEl = screen.getByText("3D MEMORY GALAXY");
    const card = labelEl.closest(".glow-card") ?? labelEl.parentElement!;
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/memory");
  });

  it("clicking the Hive / Swarm tile navigates to /hive", () => {
    render(<GraphsHub />);

    const labelEl = screen.getByText("HIVE / SWARM");
    const card = labelEl.closest(".glow-card") ?? labelEl.parentElement!;
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith("/hive");
  });
});
