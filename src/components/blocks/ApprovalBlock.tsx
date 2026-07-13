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
  /**
   * Must resolve true iff the server ack'd the decision. The block only
   * commits its approved/rejected UI state on true — a false (or a throw)
   * leaves it pending so a server-rejected approval never renders as
   * "Approved" (T-96-03-01).
   */
  onApprove?: (requestId: string) => Promise<boolean>;
  onReject?: (requestId: string, reason?: string) => Promise<boolean>;
}

type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

function riskStripeClass(riskLevel: ApprovalBlockData["riskLevel"]): string {
  if (riskLevel === "high") return "border-l-4 border-(--status-error)";
  if (riskLevel === "medium") return "border-l-4 border-(--status-warn)";
  return "border-l-4 border-(--primary)";
}

export function ApprovalBlock({ block, onApprove, onReject }: ApprovalBlockProps) {
  const [status, setStatus] = useState<ApprovalStatus>("pending");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleApprove = async () => {
    if (!onApprove) {
      setStatus("approved");
      return;
    }
    setBusy(true);
    try {
      if (await onApprove(block.requestId)) setStatus("approved");
    } catch {
      // Callback contract is "resolve false on failure" (the shared
      // ApprovalActions hook already toasts) — treat a throw the same:
      // stay pending, never render a false "Approved".
    } finally {
      setBusy(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!onReject) {
      setStatus("rejected");
      setShowRejectInput(false);
      return;
    }
    setBusy(true);
    try {
      if (await onReject(block.requestId, rejectReason.trim() || undefined)) {
        setStatus("rejected");
        setShowRejectInput(false);
      }
    } catch {
      // See handleApprove — stay pending on a throwing callback.
    } finally {
      setBusy(false);
    }
  };

  // Local click resolution takes precedence once the user has actually
  // resolved the card (T-96-03-01: never revert a locally-committed
  // approve/reject). Until then, an externally-supplied wire status
  // (D-05 resolution `run.blocks` event carrying the same requestId) drives
  // the resolved view, so a server-side resolution flips the card in place
  // with the same visual states as a local click.
  const effectiveStatus: ApprovalStatus = status !== "pending" ? status : (block.status ?? "pending");

  if (effectiveStatus === "approved") {
    return (
      <p className="text-base text-(--muted-foreground)">
        Approved — sent to Ástríðr
      </p>
    );
  }

  if (effectiveStatus === "rejected") {
    return (
      <p className="text-base text-(--muted-foreground)">Rejected</p>
    );
  }

  if (effectiveStatus === "expired") {
    return (
      <p className="text-base text-(--muted-foreground)">Expired</p>
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
            className="min-h-[44px] px-4 text-base font-medium bg-(--status-ok) text-white disabled:opacity-50"
            onClick={handleApprove}
            disabled={busy}
          >
            Approve
          </button>
          <button
            className="min-h-[44px] px-4 text-base font-medium bg-(--destructive) text-white disabled:opacity-50"
            onClick={() => setShowRejectInput(true)}
            disabled={busy}
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
              className="min-h-[44px] px-4 text-base font-medium bg-(--destructive) text-white disabled:opacity-50"
              onClick={handleRejectSubmit}
              disabled={busy}
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
