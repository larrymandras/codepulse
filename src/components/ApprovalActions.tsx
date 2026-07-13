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
 * ack. The REAL `AstridrWSContext.sendCommand` never resolves a non-ok ack —
 * it REJECTS the promise on every failure path (error ack, ack timeout,
 * queue-full while disconnected), so the hook catches that rejection,
 * surfaces `toast.error`, and returns `false`. A resolved non-ok ack is also
 * handled as belt-and-braces. No success toast is ever shown unless the
 * server confirmed the command — this is the fix for T-96-03-01, the
 * false-success repudiation bug that shipped in Chat.tsx.
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
 * optimistic state update (e.g. marking an inbox item read, or collapsing
 * an ApprovalBlock to its approved/rejected state).
 *
 * Failure handling is owned HERE (single owner of the sendCommand contract):
 * the live context rejects on error acks / timeouts / queue-full, so both
 * handlers catch, toast, and return false — they never throw.
 */
export function useApprovalActions(sendCommand: SendCommand): UseApprovalActionsReturn {
  const approve = async (requestId: string): Promise<boolean> => {
    const payload = {
      type: "approval.respond",
      request_id_target: requestId,
      decision: "approve",
    } satisfies ApprovalRespondPayload;
    let ack: AckResponse;
    try {
      ack = await sendCommand(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
      return false;
    }
    if (ack.status !== "ok") {
      // Belt-and-braces: the live context rejects instead of resolving a
      // non-ok ack, but a non-conforming sendCommand could still resolve one.
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
    let ack: AckResponse;
    try {
      ack = await sendCommand(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejection failed");
      return false;
    }
    if (ack.status !== "ok") {
      // Belt-and-braces — see approve() above.
      toast.error(ack.error ?? "Rejection failed");
      return false;
    }
    toast.success("Rejection sent.");
    return true;
  };

  return { approve, reject };
}
