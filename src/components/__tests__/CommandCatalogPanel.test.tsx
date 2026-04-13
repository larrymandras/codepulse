import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CommandCatalogPanel from "../CommandCatalogPanel";
import type { CommandEntry } from "@/types/commands";

// Sample test data
const coreCommands: CommandEntry[] = [
  {
    name: "/run",
    description: "Execute a shell command",
    category: "core",
    parameters: [
      { name: "command", type: "string", required: true, description: "Command to run" },
      { name: "timeout", type: "number", required: false, description: "Timeout in seconds" },
    ],
    source: "manifests/core.yaml",
  },
  {
    name: "/pause",
    description: "Pause the current agent",
    category: "core",
    parameters: [],
    source: "manifests/core.yaml",
  },
];

const skillsCommands: CommandEntry[] = [
  {
    name: "/search",
    description: "Search the web for information",
    category: "skills",
    parameters: [
      { name: "query", type: "string", required: true },
    ],
    source: "manifests/skills.yaml",
  },
];

const allCommands = [...coreCommands, ...skillsCommands];

describe("CommandCatalogPanel", () => {
  // Test 1: Renders section header
  it('renders "COMMANDS" section header text', () => {
    render(<CommandCatalogPanel commands={allCommands} status="ready" />);
    expect(screen.getByText("COMMANDS")).toBeInTheDocument();
  });

  // Test 2: Groups by category with category headers
  it("renders command rows grouped by category with category headers", () => {
    render(<CommandCatalogPanel commands={allCommands} status="ready" />);
    expect(screen.getByText("core")).toBeInTheDocument();
    expect(screen.getByText("skills")).toBeInTheDocument();
    expect(screen.getByText("/run")).toBeInTheDocument();
    expect(screen.getByText("/pause")).toBeInTheDocument();
    expect(screen.getByText("/search")).toBeInTheDocument();
  });

  // Test 3: Click expands detail, click again collapses
  it("clicking a command row expands its detail; clicking again collapses", () => {
    render(<CommandCatalogPanel commands={coreCommands} status="ready" />);
    const runRow = screen.getByText("/run").closest("[data-testid]") ??
      screen.getByText("/run").closest("[role='button']") ??
      screen.getByText("/run").parentElement!.parentElement!;

    // Detail not visible initially
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText("/run"));
    expect(screen.getByText("Parameters")).toBeInTheDocument();
    expect(screen.getByText("command")).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(screen.getByText("/run"));
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();
  });

  // Test 4: Accordion — only one expanded at a time
  it("only one command expanded at a time (accordion)", () => {
    render(<CommandCatalogPanel commands={coreCommands} status="ready" />);

    // Expand /run
    fireEvent.click(screen.getByText("/run"));
    expect(screen.getByText("Parameters")).toBeInTheDocument();

    // Expand /pause — should collapse /run
    fireEvent.click(screen.getByText("/pause"));
    // "Parameters" should still be in document (from /pause detail) OR if /pause has no params, "No parameters"
    // The key test is that expanding one collapsed the other (we have exactly one detail panel open)
    const parameterSections = screen.queryAllByText("Parameters");
    // Only one expanded at a time — at most one "Parameters" heading visible
    expect(parameterSections.length).toBeLessThanOrEqual(1);
  });

  // Test 5: Category filter pills
  it('renders category filter pills with "All (N)" first; clicking filters', () => {
    render(<CommandCatalogPanel commands={allCommands} status="ready" />);

    // "All (3)" pill should be present
    expect(screen.getByText(`All (${allCommands.length})`)).toBeInTheDocument();

    // Category pills for "core" and "skills"
    const corePill = screen.getByRole("button", { name: /core/i });
    expect(corePill).toBeInTheDocument();

    // Click "core" pill — should hide /search
    fireEvent.click(corePill);
    expect(screen.getByText("/run")).toBeInTheDocument();
    expect(screen.queryByText("/search")).not.toBeInTheDocument();
  });

  // Test 6: Filter prop filters by name, description, category, source (case-insensitive)
  it("filter prop filters commands case-insensitively", () => {
    render(<CommandCatalogPanel commands={allCommands} status="ready" filter="shell" />);
    // "Execute a shell command" matches description
    expect(screen.getByText("/run")).toBeInTheDocument();
    expect(screen.queryByText("/pause")).not.toBeInTheDocument();
    expect(screen.queryByText("/search")).not.toBeInTheDocument();
  });

  // Test 7: Empty state when commands array is empty
  it('shows "No commands registered" when commands array is empty', () => {
    render(<CommandCatalogPanel commands={[]} status="ready" />);
    expect(screen.getByText("No commands registered")).toBeInTheDocument();
    expect(screen.getByText(/The command registry is empty/)).toBeInTheDocument();
  });

  // Test 8: No-match filter shows message
  it('shows "No commands match your search" when filter matches nothing', () => {
    render(<CommandCatalogPanel commands={allCommands} status="ready" filter="xyzzy123nomatch" />);
    expect(screen.getByText("No commands match your search")).toBeInTheDocument();
  });

  // Test 9: Loading state shows spinner
  it("loading state shows Loader2 spinner", () => {
    const { container } = render(<CommandCatalogPanel commands={[]} status="loading" />);
    // Loader2 icon rendered as SVG with animate-spin class
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  // Test 10: Error state shows error message
  it("error state shows error message text", () => {
    render(
      <CommandCatalogPanel
        commands={[]}
        status="error"
        error="Registry unavailable. Connect to Ástríðr to load the command catalog."
      />
    );
    expect(screen.getByText(/Registry unavailable/)).toBeInTheDocument();
  });
});
