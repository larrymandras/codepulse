/**
 * ForgeJobList test (Phase 80, FI-07/FI-08) — jsdom render assertions.
 *
 * Covers (B3):
 *  (a) "Launch Job" button gated on isAuthenticated (fail-closed UI, FI-08)
 *  (b) a pending row whose resolvedForgeJobId matches a real job is filtered out
 *      (reconciliation — no duplicate render, T-80-13)
 *  (c) a failed pending row shows the destructive left border + error text (D-11)
 *
 * ForgeJobList is a pure-props component (no Convex calls), so no backend mock
 * is needed — it is rendered directly with controlled props.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ForgeJobList } from "./ForgeJobList";
import type { ForgeJobRow, ForgeCommandRow } from "@/hooks/useForge";

function makeJob(overrides: Partial<ForgeJobRow> = {}): ForgeJobRow {
  return {
    id: "job-1",
    agent: "codex",
    mode: "goal",
    prompt: "do the thing",
    workspaceId: "ws-1",
    status: "running",
    pid: 123,
    exitCode: null,
    startedAt: null,
    finishedAt: null,
    artifactCount: 0,
    capabilities: "{}",
    model: null,
    createdAt: new Date().toISOString(),
    hostId: "desktop",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeCommand(overrides: Partial<ForgeCommandRow> = {}): ForgeCommandRow {
  return {
    commandId: "cmd-1",
    commandType: "launch",
    status: "pending",
    agent: "codex",
    mode: "goal",
    prompt: "launch this",
    hostId: "desktop",
    resolvedForgeJobId: null,
    error: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

const baseProps = {
  jobs: [] as ForgeJobRow[],
  pendingCommands: [] as ForgeCommandRow[],
  loading: false,
  selectedKey: null,
  onSelect: () => {},
  onLaunchClick: () => {},
  isAuthenticated: false,
};

describe("ForgeJobList — Launch button gating (FI-08, fail-closed)", () => {
  it("does NOT render the Launch Job button when isAuthenticated is false", () => {
    render(<ForgeJobList {...baseProps} isAuthenticated={false} />);
    expect(screen.queryByText("Launch Job")).not.toBeInTheDocument();
  });

  it("renders the Launch Job button when isAuthenticated is true", () => {
    render(<ForgeJobList {...baseProps} isAuthenticated={true} />);
    expect(screen.getByText("Launch Job")).toBeInTheDocument();
  });
});

describe("ForgeJobList — pending row reconciliation (T-80-13)", () => {
  it("filters out a pending row whose resolvedForgeJobId matches a real job (no duplicate)", () => {
    const job = makeJob({ id: "job-42", prompt: "the real job" });
    const reconciled = makeCommand({
      commandId: "cmd-42",
      prompt: "the real job",
      resolvedForgeJobId: "job-42",
    });
    const { container } = render(
      <ForgeJobList
        {...baseProps}
        jobs={[job]}
        pendingCommands={[reconciled]}
      />
    );
    // The pending row must NOT be present...
    expect(
      container.querySelector('[data-pending-command="cmd-42"]')
    ).toBeNull();
    // ...and the real job appears exactly once.
    expect(screen.getAllByText("the real job")).toHaveLength(1);
  });

  it("keeps a pending row whose resolvedForgeJobId is not yet in jobs", () => {
    const unresolved = makeCommand({
      commandId: "cmd-99",
      resolvedForgeJobId: null,
    });
    const { container } = render(
      <ForgeJobList {...baseProps} pendingCommands={[unresolved]} />
    );
    expect(
      container.querySelector('[data-pending-command="cmd-99"]')
    ).not.toBeNull();
  });
});

describe("ForgeJobList — failed pending row (D-11)", () => {
  it("renders the destructive left border and error text for a failed pending row", () => {
    const failed = makeCommand({
      commandId: "cmd-fail",
      status: "failed",
      error: "Command failed: daemon rejected",
    });
    const { container } = render(
      <ForgeJobList {...baseProps} pendingCommands={[failed]} />
    );
    const row = container.querySelector(
      '[data-pending-command="cmd-fail"]'
    ) as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row!.className).toContain("border-destructive");
    expect(
      screen.getByText("Command failed: daemon rejected")
    ).toBeInTheDocument();
  });
});
