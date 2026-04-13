import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApprovalBlock } from "@/components/blocks/ApprovalBlock";
import type { ApprovalBlockData } from "@/types/generative-blocks";

const mockBlock: ApprovalBlockData = {
  type: "approval",
  requestId: "req-123",
  action: "Deploy staging build",
  details: { version: "1.2.3" },
  riskLevel: "medium",
  agentName: "Builder",
};

describe("ApprovalBlock", () => {
  test("renders action description and agent name", () => {
    render(<ApprovalBlock block={mockBlock} />);
    expect(screen.getByText("Deploy staging build")).toBeInTheDocument();
    expect(screen.getByText("Builder")).toBeInTheDocument();
  });

  test("renders approve button with 'Approve' label", () => {
    render(<ApprovalBlock block={mockBlock} />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  test("renders reject button with 'Reject Request' label", () => {
    render(<ApprovalBlock block={mockBlock} />);
    expect(screen.getByRole("button", { name: "Reject Request" })).toBeInTheDocument();
  });

  test("applies border-l-4 style for medium risk", () => {
    const { container } = render(<ApprovalBlock block={mockBlock} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-l-4");
  });

  test("applies border-l-4 style for high risk", () => {
    const highRiskBlock: ApprovalBlockData = { ...mockBlock, riskLevel: "high" };
    const { container } = render(<ApprovalBlock block={highRiskBlock} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-l-4");
  });

  test("calls onApprove with requestId when approve clicked", () => {
    const onApprove = vi.fn();
    render(<ApprovalBlock block={mockBlock} onApprove={onApprove} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith("req-123");
  });

  test("collapses to 'Approved — sent to Ástríðr' after approve", () => {
    render(<ApprovalBlock block={mockBlock} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText("Approved — sent to Ástríðr")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  test("clicking reject shows textarea with correct placeholder", () => {
    render(<ApprovalBlock block={mockBlock} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject Request" }));
    expect(
      screen.getByPlaceholderText("Optional: explain rejection...")
    ).toBeInTheDocument();
  });

  test("calls onReject with requestId and collapses to 'Rejected' after reject submitted", () => {
    const onReject = vi.fn();
    render(<ApprovalBlock block={mockBlock} onReject={onReject} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject Request" }));
    const textarea = screen.getByPlaceholderText("Optional: explain rejection...");
    fireEvent.change(textarea, { target: { value: "Not ready" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Rejection" }));
    expect(onReject).toHaveBeenCalledWith("req-123", "Not ready");
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Rejection" })).toBeNull();
  });
});
