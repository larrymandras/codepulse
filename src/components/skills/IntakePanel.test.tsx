/**
 * IntakePanel test (Phase 07-02) — jsdom render assertions.
 *
 * Mocks @/hooks/useIntake's useIntakeCommandsRaw so tests can control
 * loading/empty/populated fixture arrays directly, and mocks the child
 * IntakeModal/IntakeReportView components (their own behavior is covered by
 * IntakeModal.test.tsx / Task 3's own test suite) so this file can exercise
 * IntakePanel's own optimistic-merge/dedupe/reconciliation/expansion logic
 * in isolation.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useIntakeCommandsRaw } from "@/hooks/useIntake";
import type { IntakeCommandRow } from "@/hooks/useIntake";

const { pendingRowFixture } = vi.hoisted(() => ({
  pendingRowFixture: {
    commandId: "cmd-pending-1",
    status: "pending",
    hostId: "desktop",
    destination: "global",
    workspaceId: null,
    storageId: null,
    githubUrl: "https://github.com/owner/repo",
    subpath: null,
    fileName: null,
    report: null,
    error: null,
    createdAt: 1_700_000_000_000,
    expiresAt: 1_700_000_000_000 + 5 * 60 * 1000,
  },
}));

vi.mock("@/hooks/useIntake", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useIntake")>(
    "@/hooks/useIntake"
  );
  return {
    ...actual,
    useIntakeCommandsRaw: vi.fn(() => undefined),
  };
});

vi.mock("@/components/skills/IntakeModal", () => ({
  IntakeModal: ({
    open,
    onEnqueued,
    onEnqueueFailed,
  }: {
    open: boolean;
    onClose: () => void;
    onEnqueued: (row: IntakeCommandRow) => void;
    onEnqueueFailed: (commandId: string, message: string) => void;
  }) => (
    <div data-testid="intake-modal-stub" data-open={open}>
      <button
        type="button"
        onClick={() => onEnqueued(pendingRowFixture as IntakeCommandRow)}
      >
        trigger-enqueue
      </button>
      <button
        type="button"
        onClick={() => onEnqueueFailed(pendingRowFixture.commandId, "boom")}
      >
        trigger-enqueue-failed
      </button>
    </div>
  ),
}));

vi.mock("@/components/skills/IntakeReportView", () => ({
  IntakeReportView: ({ row }: { row: IntakeCommandRow }) => (
    <div data-testid={`intake-report-view-${row.commandId}`}>
      report for {row.commandId}
    </div>
  ),
}));

import { IntakePanel } from "./IntakePanel";

function makeRow(overrides: Partial<IntakeCommandRow>): IntakeCommandRow {
  return {
    commandId: "cmd-1",
    status: "queued",
    hostId: "desktop",
    destination: "global",
    workspaceId: null,
    storageId: null,
    githubUrl: "https://github.com/owner/repo",
    subpath: null,
    fileName: null,
    report: null,
    error: null,
    createdAt: 1_700_000_000_000,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

function renderPanel() {
  const onModalOpenChange = vi.fn();
  const utils = render(
    <IntakePanel modalOpen={false} onModalOpenChange={onModalOpenChange} />
  );
  return { ...utils, onModalOpenChange };
}

describe("IntakePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIntakeCommandsRaw).mockReturnValue(undefined);
  });

  it("renders Skeleton placeholder rows while loading, never the empty-state copy", () => {
    vi.mocked(useIntakeCommandsRaw).mockReturnValue(undefined);
    const { container } = renderPanel();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("No intake commands yet")).not.toBeInTheDocument();
  });

  it("renders the exact locked empty-state copy once resolved to []", () => {
    vi.mocked(useIntakeCommandsRaw).mockReturnValue([]);
    renderPanel();
    expect(screen.getByText("No intake commands yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        'Drop a SKILL.md or paste a GitHub URL with "Validate skill" — reports appear here.'
      )
    ).toBeInTheDocument();
  });

  it("prepends a row to the list immediately when handleEnqueued fires (before any server round-trip)", () => {
    vi.mocked(useIntakeCommandsRaw).mockReturnValue([]);
    renderPanel();
    expect(screen.queryByText("owner/repo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("trigger-enqueue"));

    expect(screen.getByText("owner/repo")).toBeInTheDocument();
  });

  it("flips a pendingLocal row to failed with the reason when handleEnqueueFailed fires", () => {
    vi.mocked(useIntakeCommandsRaw).mockReturnValue([]);
    renderPanel();
    fireEvent.click(screen.getByText("trigger-enqueue"));
    fireEvent.click(screen.getByText("trigger-enqueue-failed"));

    expect(screen.getByText("Failed: boom")).toBeInTheDocument();
  });

  it("drops the matching pendingLocal row once a server row with the same commandId appears (no duplicate)", () => {
    vi.mocked(useIntakeCommandsRaw).mockReturnValue([]);
    const { rerender, onModalOpenChange } = renderPanel();
    fireEvent.click(screen.getByText("trigger-enqueue"));
    expect(screen.getAllByText("owner/repo")).toHaveLength(1);

    // Server now echoes back the same commandId as a "done" row.
    vi.mocked(useIntakeCommandsRaw).mockReturnValue([
      makeRow({ commandId: pendingRowFixture.commandId, status: "done" }),
    ]);
    rerender(<IntakePanel modalOpen={false} onModalOpenChange={onModalOpenChange} />);

    expect(screen.getAllByText("owner/repo")).toHaveLength(1);
  });

  it('renders the expired-row copy verbatim, with the Phase 8 secondary line', () => {
    vi.mocked(useIntakeCommandsRaw).mockReturnValue([
      makeRow({ commandId: "cmd-expired", status: "expired" }),
    ]);
    renderPanel();
    expect(
      screen.getByText("Expired — no daemon claimed this command.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Intake execution ships with the Forge daemon (Phase 8).")
    ).toBeInTheDocument();
  });

  it("renders DestinationBadge for every row regardless of status", () => {
    vi.mocked(useIntakeCommandsRaw).mockReturnValue([
      makeRow({ commandId: "cmd-queued", status: "queued", destination: "global" }),
      makeRow({ commandId: "cmd-done", status: "done", destination: "cold" }),
      makeRow({ commandId: "cmd-failed", status: "failed", destination: "project", error: "nope" }),
    ]);
    const { container } = renderPanel();
    const destBadges = container.querySelectorAll('[data-status="global"], [data-status="cold"], [data-status="project"]');
    expect(destBadges.length).toBe(3);
  });

  it("clicking a done row's trigger toggles the Collapsible open/closed", () => {
    vi.mocked(useIntakeCommandsRaw).mockReturnValue([
      makeRow({ commandId: "cmd-done-2", status: "done", report: { verdict: "reject" } }),
    ]);
    const { container } = renderPanel();

    const trigger = container.querySelector('[data-slot="collapsible-trigger"]') as HTMLElement;
    expect(trigger).toBeTruthy();

    expect(screen.queryByTestId("intake-report-view-cmd-done-2")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByTestId("intake-report-view-cmd-done-2")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByTestId("intake-report-view-cmd-done-2")).not.toBeInTheDocument();
  });

  it("caps the rendered list at 20 rows after merging pendingLocal and server rows", () => {
    const serverRows = Array.from({ length: 25 }, (_, i) =>
      makeRow({ commandId: `cmd-${i}`, status: "queued", fileName: `skill-${i}.md` })
    );
    vi.mocked(useIntakeCommandsRaw).mockReturnValue(serverRows);
    const { container } = renderPanel();

    // Row-list items are direct children of the row-list container (one per row).
    const rows = container.querySelectorAll('[data-slot="skeleton"]');
    expect(rows.length).toBe(0); // not loading
    expect(screen.getAllByText(/^skill-\d+\.md$/).length).toBe(20);
  });

  it("mounts IntakeModal with the modalOpen/onModalOpenChange props wired", () => {
    vi.mocked(useIntakeCommandsRaw).mockReturnValue([]);
    renderPanel();
    expect(screen.getByTestId("intake-modal-stub")).toBeInTheDocument();
  });
});
