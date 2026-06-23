/**
 * ApprovalBlock — inline approval card with approve/reject buttons.
 *
 * Mirrors the InboxCard pattern but is self-contained (no WS context dependency).
 * Callbacks (onApprove/onReject) are provided by BlockRenderer's caller.
 *
 * Risk-level stripe:
 *   high   → border-l-4 border-(--status-error)
 *   medium → border-l-4 border-(--status-warn)
 *   low    → border-l-4 border-(--primary)
 *
 * Phase 03, Plan 02: IL-04 approval block (D-05).
 */

import { useState } from "react";
import type { ApprovalBlockData } from "@/types/generative-blocks";

interface ApprovalBlockProps {
  block: ApprovalBlockData;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string, reason?: string) => void;
}

type ApprovalStatus = "pending" | "approved" | "rejected";

function riskStripeClass(riskLevel: ApprovalBlockData["riskLevel"]): string {
  if (riskLevel === "high") return "border-l-4 border-(--status-error)";
  if (riskLevel === "medium") return "border-l-4 border-(--status-warn)";
  return "border-l-4 border-(--primary)";
}

export function ApprovalBlock({ block, onApprove, onReject }: ApprovalBlockProps) {
  const [status, setStatus] = useState<ApprovalStatus>("pending");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = () => {
    onApprove?.(block.requestId);
    setStatus("approved");
  };

  const handleRejectSubmit = () => {
    onReject?.(block.requestId, rejectReason.trim() || undefined);
    setStatus("rejected");
    setShowRejectInput(false);
  };

  if (status === "approved") {
    return (
      <p className="text-base text-(--muted-foreground)">
        Approved — sent to Ástríðr
      </p>
    );
  }

  if (status === "rejected") {
    return (
      <p className="text-base text-(--muted-foreground)">Rejected</p>
    );
  }

  return (
    <div
      className={`bg-(--card) border border-(--border) p-4 ${riskStripeClass(block.riskLevel)}`}
    >
      {/* Header */}
      <p className="text-base font-semibold text-(--foreground) mb-1">
        {block.action}
      </p>
      {block.agentName && (
        <p className="text-sm text-(--muted-foreground) mb-3">
          {block.agentName}
        </p>
      )}

      {/* Details key-value pairs */}
      {Object.keys(block.details).length > 0 && (
        <div className="mb-3 space-y-1">
          {Object.entries(block.details).map(([key, val]) => (
            <div key={key} className="flex gap-2 text-base">
              <span className="text-(--muted-foreground) font-medium">{key}:</span>
              <span className="text-(--foreground)">{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {!showRejectInput && (
        <div className="flex gap-2">
          <button
            className="min-h-[44px] px-4 text-base font-medium bg-(--status-ok) text-white"
            onClick={handleApprove}
          >
            Approve
          </button>
          <button
            className="min-h-[44px] px-4 text-base font-medium bg-(--destructive) text-white"
            onClick={() => setShowRejectInput(true)}
          >
            Reject Request
          </button>
        </div>
      )}

      {/* Inline reject textarea */}
      {showRejectInput && (
        <div className="flex flex-col gap-2 mt-2">
          <textarea
            className="w-full text-base bg-(--muted) border border-(--border) p-2 text-(--foreground) placeholder:text-(--muted-foreground) resize-none focus:outline-none focus:ring-1 focus:ring-(--primary)"
            rows={3}
            placeholder="Optional: explain rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              className="min-h-[44px] px-4 text-base font-medium bg-(--destructive) text-white"
              onClick={handleRejectSubmit}
            >
              Submit Rejection
            </button>
            <button
              className="text-base px-4 text-(--muted-foreground) hover:text-(--foreground)"
              onClick={() => {
                setShowRejectInput(false);
                setRejectReason("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
