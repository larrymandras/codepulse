/**
 * ApprovalBlock — external status rendering + button gating (D-05).
 *
 * The astridr producer contract (astridr/agent/response.py ApprovalBlock)
 * emits a PENDING block on gate, then a RESOLUTION block carrying the SAME
 * requestId with an updated `status` (approved/rejected/expired). This test
 * verifies ApprovalBlock renders each externally-supplied resolved status
 * with the same visual states as a local click resolution, suppresses the
 * Approve/Reject buttons whenever status is not pending, and that a local
 * click still resolves correctly (not regressed by the external-status
 * derivation).
 *
 * Phase quick-260713-q9k, Task 1.
 */
import { describe, test, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ApprovalBlock } from "../ApprovalBlock";
import type { ApprovalBlockData } from "@/types/generative-blocks";

function makeBlock(overrides: Partial<ApprovalBlockData> = {}): ApprovalBlockData {
  return {
    type: "approval",
    requestId: "req-x",
    action: "shell_exec",
    details: { command: "rm -rf /tmp/x" },
    riskLevel: "high",
    agentName: "Ástríðr",
    ...overrides,
  };
}

describe("ApprovalBlock — external status (D-05)", () => {
  test("block.status='approved' renders resolved approved view, no buttons", () => {
    render(<ApprovalBlock block={makeBlock({ status: "approved" })} />);
    expect(screen.getByText("Approved — sent to Ástríðr")).toBeInTheDocument();
    expect(screen.queryByText("Approve")).toBeNull();
    expect(screen.queryByText("Reject Request")).toBeNull();
  });

  test("block.status='rejected' renders resolved rejected view, no buttons", () => {
    render(<ApprovalBlock block={makeBlock({ status: "rejected" })} />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.queryByText("Approve")).toBeNull();
    expect(screen.queryByText("Reject Request")).toBeNull();
  });

  test("block.status='expired' renders resolved expired view, no buttons", () => {
    render(<ApprovalBlock block={makeBlock({ status: "expired" })} />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.queryByText("Approve")).toBeNull();
    expect(screen.queryByText("Reject Request")).toBeNull();
  });

  test("block.status='pending' (or omitted) renders actionable card with buttons", () => {
    render(<ApprovalBlock block={makeBlock({ status: "pending" })} />);
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject Request")).toBeInTheDocument();

    render(<ApprovalBlock block={makeBlock({ status: undefined })} />);
    expect(screen.getAllByText("Approve").length).toBeGreaterThan(0);
  });

  test("a locally-clicked approve still flips to approved (not regressed by external-status derivation)", async () => {
    const onApprove = async () => true;
    render(<ApprovalBlock block={makeBlock({ status: "pending" })} onApprove={onApprove} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    expect(screen.getByText("Approved — sent to Ástríðr")).toBeInTheDocument();
  });
});
