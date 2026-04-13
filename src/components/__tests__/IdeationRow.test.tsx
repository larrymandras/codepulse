import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IdeationRow } from "@/components/IdeationRow";

// Mock StatusBadge to simplify rendering assertions
vi.mock("@/components/StatusBadge", () => ({
  StatusBadge: ({ status, label }: { status: string; label?: string }) => (
    <span data-testid="status-badge" data-status={status}>{label ?? status}</span>
  ),
}));

const baseFinding = {
  _id: "finding-abc",
  scanType: "static-analysis",
  severity: "medium",
  category: "code-quality",
  description: "Unused import in auth.ts",
  suggestedFix: "Remove the unused import statement",
  status: "open",
  dismissed: false,
  createdAt: Date.now() / 1000,
};

const noop = () => {};
const defaultProps = {
  finding: baseFinding,
  isSelected: false,
  onSelect: noop,
  onCreateTask: noop,
  onAcknowledge: noop,
  onDismiss: noop,
};

describe("IdeationRow", () => {
  test("renders checkbox, severity badge, and status badge", () => {
    render(<IdeationRow {...defaultProps} />);
    // Checkbox renders as a button with role="checkbox"
    expect(screen.getByRole("checkbox")).toBeDefined();
    // Severity badge text
    expect(screen.getByText("MEDIUM")).toBeDefined();
    // Status badge via mock
    expect(screen.getByTestId("status-badge")).toBeDefined();
  });

  test("maps severity to oklch color tokens", () => {
    const { container } = render(
      <IdeationRow {...defaultProps} finding={{ ...baseFinding, severity: "critical" }} />
    );
    const badge = container.querySelector(".bg-\\(--status-error\\)");
    expect(badge).toBeTruthy();
  });

  test("shows Create Task icon button in actions", () => {
    render(<IdeationRow {...defaultProps} />);
    expect(screen.getByRole("button", { name: /create task/i })).toBeDefined();
  });

  test("shows Acknowledge button for open findings", () => {
    render(<IdeationRow {...defaultProps} />);
    expect(screen.getByText("ACK")).toBeDefined();
  });

  test("shows Dismiss button", () => {
    render(<IdeationRow {...defaultProps} />);
    expect(screen.getByText("Dismiss")).toBeDefined();
  });

  test("applies 60% opacity for dismissed findings", () => {
    const { container } = render(
      <IdeationRow
        {...defaultProps}
        finding={{ ...baseFinding, status: "dismissed", dismissed: true }}
      />
    );
    const row = container.firstElementChild;
    expect(row?.className).toContain("opacity-60");
  });

  test("shows linked task status badge when taskId present", () => {
    render(
      <IdeationRow
        {...defaultProps}
        finding={{ ...baseFinding, taskId: "task-xyz" }}
      />
    );
    expect(screen.getByText("Task linked")).toBeDefined();
  });
});
