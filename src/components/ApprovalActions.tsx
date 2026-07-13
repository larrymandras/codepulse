/**
 * ApprovalActions — shared approve/reject affordance for the Ástríðr HITL
 * approval gate (`approval.respond`).
 *
 * Consumed by BOTH Chat.tsx and Inbox.tsx (D-11) so there is exactly one
 * place that knows the server's `ApprovalRespondCommand` shape:
 *
 *   { type: "approval.respond", request_id_target: string,
 *     decision: "approve" | "reject", comment?: string }
 *
 * `request_id_target` is the HITL UUID — NOT the WS correlation `request_id`
 * (sendCommand auto-injects that one). Both approve() and reject() await the
 * ack and branch on `ack.status`: an error surfaces `toast.error` and returns
 * `false` (no success toast is ever shown when the server rejected the
 * command — this is the fix for T-96-03-01, the false-success repudiation
 * bug that shipped in Chat.tsx).
 *
 * Phase 96, Plan 03: F6 (payload fix) + D-11 (shared approval component).
 */

import { toast } from "sonner";
import type { AckResponse } from "@/contexts/AstridrWSContext";

// ─── Wire type — mirrors astridr/api/ws_commands.py::ApprovalRespondCommand ───
// A compile-time mirror of the Pydantic model (T-96-03-03): a future shape
// drift on either side fails the build, not silently at runtime.

export interface ApprovalRespondPayload {
  type: "approval.respond";
  request_id_target: string;
  decision: "approve" | "reject";
  comment?: string;
}

export type SendCommand = (cmd: Record<string, unknown>) => Promise<AckResponse>;

export interface UseApprovalActionsReturn {
  /** Sends decision:"approve". Resolves true iff ack.status === "ok". */
  approve: (requestId: string) => Promise<boolean>;
  /** Sends decision:"reject" (optional comment). Resolves true iff ack.status === "ok". */
  reject: (requestId: string, comment?: string) => Promise<boolean>;
}

/**
 * Shared approve/reject hook. Both handlers await the ack and only toast
 * success when the server actually confirmed (`ack.status === "ok"`);
 * otherwise they toast.error and return false so callers can skip any
 * optimistic state update (e.g. marking an inbox item read).
 */
export function useApprovalActions(sendCommand: SendCommand): UseApprovalActionsReturn {
  const approve = async (requestId: string): Promise<boolean> => {
    const payload = {
      type: "approval.respond",
      request_id_target: requestId,
      decision: "approve",
    } satisfies ApprovalRespondPayload;
    const ack = await sendCommand(payload);
    if (ack.status !== "ok") {
      toast.error(ack.error ?? "Approval failed");
      return false;
    }
    toast.success("Approval sent.");
    return true;
  };

  const reject = async (requestId: string, comment?: string): Promise<boolean> => {
    const payload = {
      type: "approval.respond",
      request_id_target: requestId,
      decision: "reject",
      ...(comment ? { comment } : {}),
    } satisfies ApprovalRespondPayload;
    const ack = await sendCommand(payload);
    if (ack.status !== "ok") {
      toast.error(ack.error ?? "Rejection failed");
      return false;
    }
    toast.success("Rejection sent.");
    return true;
  };

  return { approve, reject };
}
