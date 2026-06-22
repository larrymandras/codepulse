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
import { makeProjectGraphFixture } from "@/test/projectGraphFixture";

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

// Mock react-router-dom navigate — GraphsHub tiles call useNavigate on click
vi.mock("react-router-dom", () => ({
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
// Fixture
// ---------------------------------------------------------------------------

const _defaultFixture = makeProjectGraphFixture();
void _defaultFixture;

// ---------------------------------------------------------------------------
// Import the component under test (after mocks)
// ---------------------------------------------------------------------------

import GraphsHub from "./GraphsHub";
import { useQuery } from "convex/react";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GraphsHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default: useQuery returns undefined (loading) for all hooks
    vi.mocked(useQuery).mockReturnValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders three MetricCard summary tiles: KG Explorer, Tool Galaxy, MCP Inventory", () => {
    render(<GraphsHub />);

    // All three tile labels must appear (MetricCard renders label as uppercase text)
    expect(screen.getByText("TOOL GALAXY")).toBeTruthy();
    expect(screen.getByText("MCP INVENTORY")).toBeTruthy();
    expect(screen.getByText("KG EXPLORER")).toBeTruthy();
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
});
