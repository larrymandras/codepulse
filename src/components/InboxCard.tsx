/**
 * InboxCard — single inbox item card with approve/reject/mark-read actions.
 *
 * Supports three item types:
 *   approval     — HITL approval request; Approve + inline-textarea Reject
 *   alert        — system alert; click-to-read
 *   notification — system notification; click-to-read
 *
 * Left stripe color per UI-SPEC:
 *   approval pending  → border-l-(--status-warn)
 *   alert unread      → border-l-(--status-error)
 *   notification unread → border-l-(--primary)
 *   read items        → no left stripe
 *
 * Phase 56, Plan 03: CPCC-02 Inbox panel.
 * Phase 86, Plan 03: DATA-03/DATA-04 HITL REST approval integration.
 *   - hitlStatus: "pending" | "approved" | "rejected" — drives card state machine
 *   - decidedBy: channel that resolved the request (for cross-channel badge)
 *   - ResolutionBadge: shown when hitlStatus !== "pending"
 */

import { useState } from "react";
import { Check, ExternalLink, Loader2, MessageCircle, Monitor, X } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { type Id } from "../../convex/_generated/dataModel";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { MuteDurationPicker } from "./MuteDurationPicker";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InboxItemType = "approval" | "alert" | "notification";

export interface InboxItem {
  id: string;
  type: InboxItemType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  // Approval-specific
  agentName?: string;
  action?: string;
  riskLevel?: "high" | "medium" | "low";
  requestId?: string; // HITL UUID sent in approval.respond
  // Alert-specific
  alertId?: Id<"alerts">;
  // HITL REST approval fields (Phase 86)
  hitlStatus?: "pending" | "approved" | "rejected";
  decidedBy?: string; // "telegram" | "dashboard" | "codepulse" | etc.
}

interface InboxCardProps {
  item: InboxItem;
  onApprove?: (requestId: string) => Promise<void>;
  onReject?: (requestId: string, note?: string) => Promise<void>;
  onMarkRead?: (id: string, type?: InboxItemType) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

type RiskLevel = "high" | "medium" | "low";

function RiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    high: "bg-(--status-error) text-(--foreground)",
    medium: "bg-(--status-warn) text-(--foreground)",
    low: "bg-(--status-ok) text-(--foreground)",
  };
  const labels: Record<RiskLevel, string> = {
    high: "High Risk",
    medium: "Medium Risk",
    low: "Low Risk",
  };
  return (
    <span
      className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded ${styles[level]}`}
    >
      {labels[level]}
    </span>
  );
}

// ─── Left stripe helper ───────────────────────────────────────────────────────

function stripeClass(item: InboxItem): string {
  if (item.read) return "";
  if (item.type === "approval") return "border-l-2 border-l-(--status-warn)";
  if (item.type === "alert") return "border-l-2 border-l-(--status-error)";
  return "border-l-2 border-l-(--primary)";
}

// ─── ResolutionBadge ─────────────────────────────────────────────────────────

/**
 * ResolutionBadge — shows how a HITL request was resolved.
 *
 * For self-resolved (decidedBy === "dashboard" or "codepulse"):
 *   Shows "Approved" or "Rejected" with Check/X icon, --status-ok/--status-error tint.
 *
 * For cross-channel (decidedBy === "telegram" or other):
 *   Shows "Resolved via {Channel} — {Decision}" with channel icon, --muted tint.
 *
 * Per UI-SPEC: inline-flex, items-center, gap-1, px-2 py-1, text-xs font-semibold.
 */
function ResolutionBadge({
  status,
  decidedBy,
}: {
  status: "approved" | "rejected";
  decidedBy?: string;
}) {
  const by = decidedBy?.toLowerCase() ?? "dashboard";
  const isSelf = by === "dashboard" || by === "codepulse";

  if (isSelf) {
    // Self-resolved: simple approved/rejected badge
    const approved = status === "approved";
    const Icon = approved ? Check : X;
    const colorClass = approved
      ? "bg-(--status-ok)/10 text-(--status-ok)"
      : "bg-(--status-error)/10 text-(--status-error)";
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded ${colorClass}`}
      >
        <Icon size={12} />
        {approved ? "Approved" : "Rejected"}
      </span>
    );
  }

  // Cross-channel resolution
  const channelLabel =
    by.charAt(0).toUpperCase() + by.slice(1); // e.g. "Telegram"
  const decisionLabel = status === "approved" ? "Approved" : "Rejected";

  let Icon: typeof MessageCircle;
  if (by === "telegram") Icon = MessageCircle;
  else if (by === "dashboard" || by === "codepulse") Icon = Monitor;
  else Icon = ExternalLink;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-(--muted) text-(--muted-foreground)">
      <Icon size={12} />
      {`Resolved via ${channelLabel} — ${decisionLabel}`}
    </span>
  );
}

// ─── Alert inline actions ─────────────────────────────────────────────────────

function AlertInlineActions({ alertId }: { alertId: Id<"alerts"> }) {
  const acknowledgeAlert = useMutation(api.alertLifecycle.acknowledgeAlert);
  const muteTarget = useMutation(api.alertMutes.muteTarget);

  function handleAcknowledge() {
    void acknowledgeAlert({ alertId, acknowledgedBy: "operator" });
  }

  function handleMuteSelect(duration: string) {
    void muteTarget({ targetType: "alert", targetId: alertId, duration, mutedBy: "operator" });
  }

  return (
    <div className="flex items-center gap-1 mt-2">
      <button
        className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
        onClick={handleAcknowledge}
      >
        Acknowledge
      </button>
      <MuteDurationPicker
        onSelect={handleMuteSelect}
        trigger={
          <button className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors">
            Mute
          </button>
        }
      />
    </div>
  );
}

// ─── InboxCard ────────────────────────────────────────────────────────────────

export function InboxCard({
  item,
  onApprove,
  onReject,
  onMarkRead,
}: InboxCardProps) {
  const { status } = useAstridrWS();
  const wsConnected = status === "connected";

  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectPending, setRejectPending] = useState(false);

  // HITL items use REST and don't need WS connectivity for actions
  const isHitlItem = item.hitlStatus !== undefined;

  // HITL card state machine: server status overrides local state
  // pending      -> show buttons
  // approved     -> show ResolutionBadge (hide buttons)
  // rejected     -> show ResolutionBadge (hide buttons)
  const hitlResolved =
    isHitlItem &&
    (item.hitlStatus === "approved" || item.hitlStatus === "rejected");

  const handleApprove = async () => {
    if (!item.requestId || !onApprove) return;
    setApproving(true);
    try {
      await onApprove(item.requestId);
      setApproved(true);
    } finally {
      setApproving(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!item.requestId || !onReject) return;
    setRejectPending(true);
    try {
      await onReject(item.requestId, rejectNote.trim() || undefined);
      setRejected(true);
      setShowRejectInput(false);
    } finally {
      setRejectPending(false);
    }
  };

  const handleCardClick = () => {
    if (item.type !== "approval" && !item.read && onMarkRead) {
      onMarkRead(item.id, item.type);
    }
  };

  // isActioned: local state for WS-based approvals; hitlResolved: server state for HITL
  const isActioned = approved || rejected || hitlResolved;
  const cardOpacity = isActioned ? "opacity-60" : "opacity-100";

  return (
    <div
      className={`bg-(--card) border border-(--border) rounded p-4 transition-opacity duration-300 ${stripeClass(item)} ${cardOpacity} ${item.type !== "approval" ? "cursor-pointer" : ""}`}
      onClick={item.type !== "approval" ? handleCardClick : undefined}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className={`text-sm font-semibold truncate ${item.read ? "text-(--muted-foreground)" : "text-(--foreground)"}`}
          >
            {item.title}
          </span>
          {item.agentName && (
            <span className="text-xs text-(--muted-foreground)">
              {item.agentName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.riskLevel && <RiskBadge level={item.riskLevel} />}
          <span className="text-xs text-(--muted-foreground)">
            {relativeTime(item.timestamp)}
          </span>
        </div>
      </div>

      {/* Message body */}
      <p className="text-sm text-(--muted-foreground) mb-3 line-clamp-2">
        {item.message}
      </p>

      {/* Alert inline actions */}
      {item.type === "alert" && item.alertId && (
        <AlertInlineActions alertId={item.alertId} />
      )}

      {/* Approval action buttons — only for pending items */}
      {item.type === "approval" && !isActioned && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-(--primary) text-(--primary-foreground) rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={approving || rejectPending || (!isHitlItem && !wsConnected)}
              onClick={handleApprove}
            >
              {approving && <Loader2 className="h-4 w-4 animate-spin" />}
              {approving ? "Approving…" : "Approve"}
            </button>
            <button
              className="text-xs px-3 py-1.5 border border-(--destructive) text-(--destructive) rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={approving || rejectPending || (!isHitlItem && !wsConnected)}
              onClick={() => setShowRejectInput((v) => !v)}
            >
              Reject
            </button>
            {/* WS offline warning only for non-HITL items */}
            {!isHitlItem && !wsConnected && (
              <span className="text-xs text-(--muted-foreground)">
                Offline — unavailable
              </span>
            )}
          </div>

          {/* Inline reject textarea — NOT a Dialog */}
          {showRejectInput && (
            <div className="flex flex-col gap-2 mt-1">
              <textarea
                className="text-xs w-full bg-(--muted) border border-(--border) rounded p-2 text-(--foreground) placeholder:text-(--muted-foreground) resize-none focus:outline-none focus:ring-1 focus:ring-(--primary)"
                rows={2}
                placeholder="Reason (optional)"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleRejectSubmit();
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-(--destructive) text-(--destructive) rounded disabled:opacity-50"
                  disabled={rejectPending}
                  onClick={() => void handleRejectSubmit()}
                >
                  {rejectPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {rejectPending ? "Rejecting…" : "Reject"}
                </button>
                <button
                  className="text-xs px-3 py-1.5 text-(--muted-foreground) rounded hover:text-(--foreground)"
                  onClick={() => {
                    setShowRejectInput(false);
                    setRejectNote("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HITL resolution badge — shown when resolved via any channel */}
      {hitlResolved && item.hitlStatus && (
        <ResolutionBadge
          status={item.hitlStatus as "approved" | "rejected"}
          decidedBy={item.decidedBy}
        />
      )}

      {/* Post-action indicator — for WS-based (non-HITL) approvals */}
      {!hitlResolved && isActioned && (
        <p className="text-xs text-(--muted-foreground) italic">
          {approved ? "Approved" : "Rejected"}
        </p>
      )}
    </div>
  );
}
