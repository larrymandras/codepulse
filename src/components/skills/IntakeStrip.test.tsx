import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntakeStrip } from "./IntakeStrip";
import type { IntakeCommandRow } from "@/hooks/useIntake";

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

const labelFor = () => "acme/repo";

describe("IntakeStrip", () => {
  it("renders nothing when there are no rows", () => {
    const { container } = render(
      <IntakeStrip rows={[]} activeCount={0} labelFor={labelFor} onOpen={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the latest row's label, an active count, and opens on click", () => {
    const onOpen = vi.fn();
    render(
      <IntakeStrip
        rows={[row(), row({ commandId: "cmd-2", status: "done" })]}
        activeCount={1}
        labelFor={labelFor}
        onOpen={onOpen}
      />
    );
    expect(screen.getByText("acme/repo")).toBeInTheDocument();
    expect(screen.getByText("1 active")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open intake history/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("wraps the status chip in an aria-live=polite region (locked contract)", () => {
    const { container } = render(
      <IntakeStrip rows={[row()]} activeCount={1} labelFor={labelFor} onOpen={vi.fn()} />
    );
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.textContent).toContain("Queued");
  });

  it("omits the active count when nothing is active", () => {
    render(
      <IntakeStrip rows={[row({ status: "done" })]} activeCount={0} labelFor={labelFor} onOpen={vi.fn()} />
    );
    expect(screen.queryByText(/active/)).toBeNull();
  });
});
