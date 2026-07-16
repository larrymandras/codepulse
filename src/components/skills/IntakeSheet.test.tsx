import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntakeSheet } from "./IntakeSheet";
import type { IntakeFeed } from "@/hooks/useIntakeFeed";
import type { IntakeCommandRow } from "@/hooks/useIntake";

// IntakeReportView reaches into useForgeWorkspace (Convex useQuery) — stub it
// so this file can exercise IntakeSheet's own row-list logic without a
// ConvexProvider, mirroring IntakePanel.test.tsx's identical stub.
vi.mock("@/components/skills/IntakeReportView", () => ({
  IntakeReportView: ({ row }: { row: IntakeCommandRow }) => (
    <div data-testid={`intake-report-view-${row.commandId}`}>
      report for {row.commandId}
    </div>
  ),
}));

const row = (over: Partial<IntakeCommandRow> = {}): IntakeCommandRow => ({
  commandId: "cmd-1",
  status: "queued",
  hostId: "h1",
  destination: "global",
  workspaceId: null,
  storageId: null,
  githubUrl: "https://github.com/acme/repo",
  subpath: null,
  fileName: null,
  report: null,
  error: null,
  createdAt: 1000,
  expiresAt: 999999,
  ...over,
});

const feed = (over: Partial<IntakeFeed> = {}): IntakeFeed => ({
  rows: [],
  isLoading: false,
  now: 0,
  activeCount: 0,
  labelFor: (r) => r.fileName ?? "acme/repo",
  handleEnqueued: vi.fn(),
  handleEnqueueFailed: vi.fn(),
  ...over,
});

function renderSheet(f: IntakeFeed) {
  return render(<IntakeSheet open onOpenChange={vi.fn()} feed={f} />);
}

describe("IntakeSheet", () => {
  it("renders Skeleton placeholder rows while loading, never the empty-state copy", () => {
    // SheetContent portals into document.body (a sibling of the render
    // container, per Radix Dialog.Portal), so portaled content must be
    // queried from baseElement, not the scoped `container`.
    const { baseElement } = renderSheet(feed({ isLoading: true }));
    expect(baseElement.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("No intake commands yet")).toBeNull();
  });

  it("renders the locked empty-state copy once resolved to []", () => {
    renderSheet(feed());
    expect(screen.getByText("No intake commands yet")).toBeInTheDocument();
    expect(screen.getByText(/Drop a SKILL\.md or paste a GitHub URL/)).toBeInTheDocument();
  });

  it("renders the expired-row copy verbatim, with the Phase 8 secondary line", () => {
    renderSheet(feed({ rows: [row({ status: "expired" })] }));
    expect(screen.getByText("Expired — no daemon claimed this command.")).toBeInTheDocument();
    expect(screen.getByText(/Intake execution ships with the Forge daemon \(Phase 8\)\./)).toBeInTheDocument();
  });

  it("renders a failed row's error reason", () => {
    renderSheet(feed({ rows: [row({ status: "failed", error: "boom" })] }));
    expect(screen.getByText("Failed: boom")).toBeInTheDocument();
  });

  it("renders DestinationBadge for every row regardless of status", () => {
    renderSheet(feed({ rows: [row(), row({ commandId: "c2", status: "done", destination: "cold" })] }));
    expect(screen.getByText(/global/i)).toBeInTheDocument();
    expect(screen.getByText(/cold/i)).toBeInTheDocument();
  });

  it("clicking a done row's trigger toggles the report open", () => {
    renderSheet(
      feed({ rows: [row({ status: "done", report: { verdict: "approved" } })] })
    );
    const trigger = screen.getByRole("button", { name: /acme\/repo/ });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("data-state")).toBe("open");
  });

  it("shows the queued countdown from feed.now inside aria-live=off", () => {
    const { baseElement } = renderSheet(
      feed({ rows: [row({ status: "queued", expiresAt: 125000 })], now: 0 })
    );
    expect(screen.getByText(/Expires in 2:05/)).toBeInTheDocument();
    const off = baseElement.querySelector('[aria-live="off"]');
    expect(off?.textContent).toContain("2:05");
  });
});
