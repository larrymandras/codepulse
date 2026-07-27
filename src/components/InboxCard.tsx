/**
 * InboxCard — single inbox item card with approve/reject/mark-read actions.
 *
 * Supports five item types:
 *   approval     — HITL approval request; Approve + inline-textarea Reject
 *   alert        — system alert; click-to-read
 *   notification — system notification; click-to-read
 *   card         — pulse-scan output (D-14, GOV-01/WATCH-01); ambient, silent,
 *                  no approve/reject; renders PulseCardBody (profile badge +
 *                  needs-you summary + Mail/Calendar source icon)
 *   held         — focus/quiet-hours-suppressed record (D-07/D-15); dimmest
 *                  stripe by design — never upgraded even for an underlying
 *                  high-priority event; shows what was held + why + profile badge
 *
 * Left stripe color per UI-SPEC:
 *   approval pending  → border-l-(--status-warn)
 *   alert unread      → border-l-(--status-error)
 *   notification unread → border-l-(--primary)
 *   card unread       → border-l-(--status-info)      (calm/ambient, Plan 07)
 *   held unread       → border-l-(--muted-foreground)  (dimmest, Plan 07)
 *   read items        → no left stripe
 *
 * Phase 56, Plan 03: CPCC-02 Inbox panel.
 * Phase 186, Plan 07: card + held item types, per-card profile badge (D-12).
 */

import { useState, useEffect } from "react";
import { Loader2, Mail, Calendar, X } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { type Id } from "../../convex/_generated/dataModel";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { MuteDurationPicker } from "./MuteDurationPicker";
import { PROFILES, type ProfileId } from "@/lib/profiles";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InboxItemType = "approval" | "alert" | "notification" | "card" | "held";

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
  // Card/held-specific (Plan 07, D-12) — every merged-stream row carries its
  // own profileId so a card/held item is self-labelling with no profile
  // switcher needed.
  profileId?: ProfileId;
  // Held-specific (D-07) — why the event was suppressed.
  heldReason?: "focus" | "quiet-hours";
  // Card-specific (D-14) — source icon hint for the pulse-scan summary.
  source?: "mail" | "calendar";
}

interface InboxCardProps {
  item: InboxItem;
  /**
   * Must resolve true iff the server ack'd the decision. The card only
   * commits its approved UI state on true — a false (or a throw) leaves
   * it pending so a server-rejected approval never renders as "Approved"
   * (mirrors ApprovalBlock.tsx, T-96-13-01).
   */
  onApprove?: (requestId: string) => Promise<boolean>;
  onReject?: (requestId: string, note?: string) => Promise<boolean>;
  onMarkRead?: (id: string) => void;
  /** Clear this item from the inbox (notifications / cards / held). */
  onDismiss?: (item: InboxItem) => void;
  /**
   * Bumped by the parent each time the keyboard `R` shortcut targets this card
   * — opens the reject-reason input (approvals only). A monotonic nonce so a
   * repeated `R` re-opens after a cancel; `undefined` for non-targeted cards.
   */
  rejectSignal?: number;
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
      className={`inline-block text-sm font-semibold px-1.5 py-0.5 rounded ${styles[level]}`}
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
  if (item.type === "card") return "border-l-2 border-l-(--status-info)";
  // held: deliberately the dimmest stripe available — never upgraded to a
  // louder color even if the underlying event would have been high-priority
  // had it not been suppressed. The muted stripe IS the "intentionally
  // quiet" signal (D-15).
  if (item.type === "held") return "border-l-2 border-l-(--muted-foreground)";
  return "border-l-2 border-l-(--primary)";
}

// ─── Per-card profile badge (D-12) ─────────────────────────────────────────────
// Reuses Reminders.tsx's exact PROFILES accent-var mapping so a card's
// profile origin reads consistently with the Reminders page a user already
// knows. Every card/held row in the merged all-profiles stream carries its
// own profileId — there is no profile switcher.

function ProfileBadge({ profileId }: { profileId?: ProfileId }) {
  if (!profileId) return null;
  const profile = PROFILES.find((p) => p.id === profileId);
  if (!profile) return null;
  return (
    <span
      className="inline-block text-sm font-medium px-1.5 py-0.5 rounded bg-(--muted)"
      style={{ color: `var(${profile.accentVar})` }}
    >
      {profile.label}
    </span>
  );
}

// ─── Pulse card body (D-14) ────────────────────────────────────────────────────
// Rendered only for type:"card" — ambient, silent-by-default pulse-scan
// output. No approve/reject; the profile badge + needs-you summary + a
// Mail/Calendar source icon are the entire "why did this appear" surface.

function PulseCardBody({ item }: { item: InboxItem }) {
  const SourceIcon = item.source === "calendar" ? Calendar : Mail;
  return (
    <div className="flex items-center gap-2 mt-1">
      <SourceIcon className="h-4 w-4 text-(--muted-foreground) shrink-0" />
      <ProfileBadge profileId={item.profileId} />
    </div>
  );
}

// ─── Held item body (D-07/D-15) ────────────────────────────────────────────────
// Rendered only for type:"held" — the concrete "suppressed never means
// lost" record. Shows what was held, when, and why (focus vs quiet hours),
// plus the same per-card profile badge as a pulse card (D-12).

function heldReasonCopy(reason?: "focus" | "quiet-hours"): string {
  if (reason === "quiet-hours") return "held during quiet hours";
  if (reason === "focus") return "held during focus mode";
  return "held";
}

function HeldItemBody({ item }: { item: InboxItem }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-sm text-(--muted-foreground) italic">
        {heldReasonCopy(item.heldReason)}
      </span>
      <ProfileBadge profileId={item.profileId} />
    </div>
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
        className="text-sm px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
        onClick={handleAcknowledge}
      >
        Acknowledge
      </button>
      <MuteDurationPicker
        onSelect={handleMuteSelect}
        trigger={
          <button className="text-sm px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors">
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
  onDismiss,
  rejectSignal,
}: InboxCardProps) {
  const { status } = useAstridrWS();
  const wsConnected = status === "connected";

  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectPending, setRejectPending] = useState(false);

  // Keyboard `R` (from the Inbox page) opens the reject input on approvals.
  useEffect(() => {
    if (rejectSignal !== undefined && item.type === "approval") {
      setShowRejectInput(true);
    }
  }, [rejectSignal, item.type]);

  const handleApprove = async () => {
    if (!item.requestId || !onApprove) return;
    setApproving(true);
    try {
      if (await onApprove(item.requestId)) setApproved(true);
    } catch {
      // Stay pending on a throwing callback — never render a false
      // "Approved" (mirrors ApprovalBlock.tsx handleApprove).
    } finally {
      setApproving(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!item.requestId || !onReject) return;
    setRejectPending(true);
    try {
      if (await onReject(item.requestId, rejectNote.trim() || undefined)) {
        setRejected(true);
        setShowRejectInput(false);
      }
    } catch {
      // Stay pending on a throwing callback — see handleApprove above.
    } finally {
      setRejectPending(false);
    }
  };

  const handleCardClick = () => {
    if (item.type !== "approval" && !item.read && onMarkRead) {
      onMarkRead(item.id);
    }
  };

  const isActioned = approved || rejected;
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
            className={`text-base font-semibold truncate ${item.read ? "text-(--muted-foreground)" : "text-(--foreground)"}`}
          >
            {item.title}
          </span>
          {item.agentName && (
            <span className="text-sm text-(--muted-foreground)">
              {item.agentName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.riskLevel && <RiskBadge level={item.riskLevel} />}
          <span className="text-sm text-(--muted-foreground)">
            {relativeTime(item.timestamp)}
          </span>
        </div>
      </div>

      {/* Message body */}
      <p className="text-base text-(--muted-foreground) mb-3 line-clamp-2">
        {item.message}
      </p>

      {/* Pulse card body (D-14) — needs-you summary + source icon + profile badge */}
      {item.type === "card" && <PulseCardBody item={item} />}

      {/* Held item body (D-07/D-15) — what was held, why, + profile badge */}
      {item.type === "held" && <HeldItemBody item={item} />}

      {/* Alert inline actions */}
      {item.type === "alert" && item.alertId && (
        <AlertInlineActions alertId={item.alertId} />
      )}

      {/* Dismiss — visible clear action for items with no other action */}
      {(item.type === "notification" || item.type === "card" || item.type === "held") &&
        onDismiss && (
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(item);
              }}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-(--border) text-(--muted-foreground) rounded hover:text-(--foreground) hover:border-(--primary) transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Dismiss
            </button>
          </div>
        )}

      {/* Approval action buttons */}
      {item.type === "approval" && !isActioned && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-(--primary) text-(--primary-foreground) rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={approving || rejectPending || !wsConnected}
              onClick={handleApprove}
            >
              {approving && <Loader2 className="h-4 w-4 animate-spin" />}
              {approving ? "Approving…" : "Approve"}
            </button>
            <button
              className="text-sm px-3 py-1.5 border border-(--destructive) text-(--destructive) rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={approving || rejectPending || !wsConnected}
              onClick={() => setShowRejectInput((v) => !v)}
            >
              Reject
            </button>
            {!wsConnected && (
              <span className="text-sm text-(--muted-foreground)">
                Offline — unavailable
              </span>
            )}
          </div>

          {/* Inline reject textarea — NOT a Dialog */}
          {showRejectInput && (
            <div className="flex flex-col gap-2 mt-1">
              <textarea
                className="text-sm w-full bg-(--muted) border border-(--border) rounded p-2 text-(--foreground) placeholder:text-(--muted-foreground) resize-none focus:outline-none focus:ring-1 focus:ring-(--primary)"
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
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-(--destructive) text-(--destructive) rounded disabled:opacity-50"
                  disabled={rejectPending}
                  onClick={() => void handleRejectSubmit()}
                >
                  {rejectPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {rejectPending ? "Rejecting…" : "Reject"}
                </button>
                <button
                  className="text-sm px-3 py-1.5 text-(--muted-foreground) rounded hover:text-(--foreground)"
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

      {/* Post-action indicator */}
      {isActioned && (
        <p className="text-sm text-(--muted-foreground) italic">
          {approved ? "Approved" : "Rejected"}
        </p>
      )}
    </div>
  );
}
