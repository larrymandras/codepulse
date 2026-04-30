/**
 * Inbox — unified feed of HITL approvals, alerts, and system notifications.
 *
 * Data sources:
 *   hitlApprovals — REST polling via useHitlApprovals (GET /api/hitl/pending, 10s interval)
 *   approvals     — WS approval_request events (accumulated in state) for non-HITL agent approvals
 *   alerts        — Convex alerts.listActive query
 *   notifications — Convex notifications.bellAll query
 *
 * HITL items use REST POST /api/hitl/{id}/approve|reject.
 * Non-HITL items use WS approval.respond command via sendCommand.
 *
 * Items are merged and deduplicated by id. HITL items take precedence for
 * status display (server state via REST poll overrides local state).
 *
 * Keyboard navigation (D-13):
 *   ArrowDown/ArrowUp — move focus between cards
 *   Enter             — expand/collapse focused card
 *   A                 — approve focused approval item (REST for HITL, WS for others)
 *   R                 — start reject flow on focused approval item
 *   Escape            — clear keyboard focus
 *
 * Phase 56, Plan 03: CPCC-02.
 * Phase 03, Plan 04: IL-03 keyboard navigation.
 * Phase 86, Plan 03: DATA-03/DATA-04 HITL REST approval integration.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { InboxCard, type InboxItem, type InboxItemType } from "../components/InboxCard";
import { InboxFilterBar, type InboxFilter } from "../components/InboxFilterBar";
import { useHitlApprovals } from "../hooks/useHitlApprovals";
import { toast } from "sonner";

// ─── Risk inference ────────────────────────────────────────────────────────────

function inferRiskLevel(action: string): "high" | "medium" | "low" {
  const a = action.toLowerCase();
  if (a.includes("file_delete") || a.includes("shell_exec") || a.includes("rm ")) {
    return "high";
  }
  if (a.includes("email_send") || a.includes("send_email") || a.includes("post")) {
    return "medium";
  }
  return "low";
}

// ─── Convex record → InboxItem mappers ────────────────────────────────────────

function alertToInboxItem(alert: {
  _id: string;
  severity: string;
  source: string;
  message: string;
  acknowledged: boolean;
  status?: string;
  createdAt: number;
}): InboxItem {
  const isRead =
    alert.acknowledged ||
    alert.status === "acknowledged" ||
    alert.status === "resolved";
  return {
    id: alert._id,
    type: "alert" as InboxItemType,
    title: `[${alert.severity.toUpperCase()}] ${alert.source}`,
    message: alert.message,
    timestamp: alert.createdAt * 1000,
    read: isRead,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    alertId: alert._id as any,
  };
}

function notificationToInboxItem(n: {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
}): InboxItem {
  return {
    id: n._id,
    type: "notification" as InboxItemType,
    title: n.title,
    message: n.message,
    timestamp: n.createdAt * 1000,
    read: n.read,
  };
}

function hitlApprovalToInboxItem(hitl: {
  id: string;
  action: string;
  details: Record<string, unknown>;
  profile_id: string;
  channel_id: string;
  timestamp: number;
  status: "pending" | "approved" | "rejected";
  decided_by?: string;
  decided_at?: number;
}): InboxItem {
  const agentName =
    (hitl.details.agent_name as string | undefined) ?? hitl.profile_id ?? "Ástríðr";
  return {
    id: hitl.id,
    type: "approval" as InboxItemType,
    title: hitl.action,
    message: hitl.details ? JSON.stringify(hitl.details) : "",
    timestamp: hitl.timestamp * 1000,
    read: hitl.status !== "pending",
    agentName,
    action: hitl.action,
    riskLevel: inferRiskLevel(hitl.action),
    requestId: hitl.id,
    // HITL-specific fields (Phase 86)
    hitlStatus: hitl.status,
    decidedBy: hitl.decided_by,
  };
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortItems(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => {
    // Unread before read
    if (!a.read && b.read) return -1;
    if (a.read && !b.read) return 1;
    // Approvals: high risk first
    if (a.type === "approval" && b.type === "approval") {
      const ra = RISK_ORDER[a.riskLevel ?? "low"] ?? 2;
      const rb = RISK_ORDER[b.riskLevel ?? "low"] ?? 2;
      if (ra !== rb) return ra - rb;
    }
    return b.timestamp - a.timestamp;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Inbox() {
  const { status, subscribeEvent, sendCommand } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  const [filter, setFilter] = useState<InboxFilter>("all");
  const [wsApprovalItems, setWsApprovalItems] = useState<InboxItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // ─── HITL REST approvals ──────────────────────────────────────────────────
  const {
    approvals: hitlApprovals,
    approve: hitlApprove,
    reject: hitlReject,
  } = useHitlApprovals();

  // ─── Keyboard navigation state ────────────────────────────────────────────
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ─── Convex data ──────────────────────────────────────────────────────────
  const alertRecords = useQuery(api.alerts.listActive) ?? [];
  const notificationRecords = useQuery(api.notifications.bellAll) ?? [];
  const markNotificationRead = useMutation(api.notifications.markRead);

  // ─── WS: accumulate approval_request events (non-HITL agent approvals) ───
  // HITL items are fetched via REST in useHitlApprovals. WS events that match
  // an existing HITL id are ignored here — REST is the source of truth for HITL.
  useEffect(() => {
    const unsub = subscribeEvent("approval_request", (event) => {
      const data = event.data as {
        action?: string;
        details?: Record<string, unknown>;
        profile_id?: string;
        channel_id?: string;
        id?: string;
        timestamp?: number;
      } | undefined;

      // Support both envelope shape (event.data) and flat shape (event itself)
      const flat = event as {
        action?: string;
        details?: Record<string, unknown>;
        profile_id?: string;
        id?: string;
        timestamp?: number;
      };
      const payload = data ?? flat;

      if (!payload?.id) return;

      // Skip if this id is already tracked via HITL REST polling
      if (hitlApprovals.some((h) => h.id === payload.id)) return;

      const action = payload.action ?? "unknown";
      const riskLevel = inferRiskLevel(action);
      const agentName =
        (payload.details?.agent_name as string | undefined) ??
        (payload.profile_id as string | undefined) ??
        "Ástríðr";

      const item: InboxItem = {
        id: payload.id,
        type: "approval",
        title: action,
        message: payload.details ? JSON.stringify(payload.details) : "",
        timestamp: payload.timestamp ? payload.timestamp * 1000 : Date.now(),
        read: false,
        agentName,
        action,
        riskLevel,
        requestId: payload.id,
        // No hitlStatus — WS-based approvals use the legacy WS flow
      };

      setWsApprovalItems((prev) => {
        // Deduplicate by id
        if (prev.some((p) => p.id === item.id)) return prev;
        return [item, ...prev];
      });
      triggerFlash();
    });

    return unsub;
  }, [subscribeEvent, triggerFlash, hitlApprovals]);

  // ─── Approve handler ──────────────────────────────────────────────────────
  // Routes to HITL REST if the item is a HITL approval, otherwise WS command.
  const handleApprove = useCallback(
    async (requestId: string) => {
      // Check if this is a HITL item (tracked via REST polling)
      const isHitl = hitlApprovals.some((h) => h.id === requestId);

      if (isHitl) {
        try {
          await hitlApprove(requestId);
          toast.success("Approval sent.");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Approval failed"
          );
        }
        return;
      }

      // Non-HITL: WS approval.respond command
      // CRITICAL: request_id_target is the HITL UUID — NOT the WS correlation id.
      // sendCommand auto-generates its own request_id for the WS ack tracking.
      const ack = await sendCommand({
        type: "approval.respond",
        request_id_target: requestId,
        decision: "approve",
      });
      if (ack.status !== "ok") {
        toast.error(ack.error ?? "Approval failed");
        return;
      }
      toast.success("Approval sent.");
      setWsApprovalItems((prev) =>
        prev.map((item) =>
          item.requestId === requestId ? { ...item, read: true } : item
        )
      );
    },
    [sendCommand, hitlApprove, hitlApprovals]
  );

  // ─── Reject handler ───────────────────────────────────────────────────────
  // Routes to HITL REST if the item is a HITL approval, otherwise WS command.
  const handleReject = useCallback(
    async (requestId: string, note?: string) => {
      const isHitl = hitlApprovals.some((h) => h.id === requestId);

      if (isHitl) {
        try {
          await hitlReject(requestId, note);
          toast.success("Rejection sent.");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Rejection failed"
          );
        }
        return;
      }

      // Non-HITL: WS approval.respond command
      const ack = await sendCommand({
        type: "approval.respond",
        request_id_target: requestId,
        decision: "reject",
        ...(note ? { comment: note } : {}),
      });
      if (ack.status !== "ok") {
        toast.error(ack.error ?? "Rejection failed");
        return;
      }
      toast.success("Rejection sent.");
      setWsApprovalItems((prev) =>
        prev.map((item) =>
          item.requestId === requestId ? { ...item, read: true } : item
        )
      );
    },
    [sendCommand, hitlReject, hitlApprovals]
  );

  // ─── Mark-read handler ────────────────────────────────────────────────────
  const handleMarkRead = useCallback(
    (id: string, type?: InboxItemType) => {
      setReadIds((prev) => new Set([...prev, id]));
      if (type === "notification") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void markNotificationRead({ id: id as any });
      }
    },
    [markNotificationRead]
  );

  // ─── Build item lists ─────────────────────────────────────────────────────
  const alertItems = alertRecords.map(alertToInboxItem);
  const notifItems = notificationRecords.map(notificationToInboxItem).map(
    (item) => (readIds.has(item.id) ? { ...item, read: true } : item)
  );

  // Merge HITL REST items with WS-based approval items.
  // HITL items from REST take precedence. WS items that share an id with a
  // HITL item are excluded (REST is the source of truth for HITL status).
  const hitlItems = hitlApprovals.map(hitlApprovalToInboxItem);
  const hitlIds = new Set(hitlItems.map((i) => i.id));
  const wsItems = wsApprovalItems.filter((i) => !hitlIds.has(i.id));
  const approvalItems = [...hitlItems, ...wsItems];

  const allItems = useMemo(
    () => sortItems([...approvalItems, ...alertItems, ...notifItems]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approvalItems, alertRecords, notificationRecords, readIds]
  );

  const filteredItems = useMemo(
    () =>
      filter === "all"
        ? allItems
        : allItems.filter((item) => {
            if (filter === "approvals") return item.type === "approval";
            if (filter === "alerts") return item.type === "alert";
            if (filter === "notifications") return item.type === "notification";
            return true;
          }),
    [filter, allItems]
  );

  // ─── Clamp focus index and prune stale cardRefs when list shrinks ────────
  useEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, filteredItems.length);
    setFocusedIndex((prev) => {
      if (prev === null) return null;
      return prev >= filteredItems.length ? Math.max(0, filteredItems.length - 1) : prev;
    });
  }, [filteredItems.length]);

  // ─── Keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Guard: skip if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const items = filteredItems;
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev === null ? 0 : Math.min(prev + 1, items.length - 1)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev === null ? 0 : Math.max(prev - 1, 0)));
      }
      if (e.key === "Enter" && focusedIndex !== null) {
        e.preventDefault();
        const item = items[focusedIndex];
        setExpandedId((prev) => (prev === item.id ? null : item.id));
      }
      if (e.key === "Escape") {
        setFocusedIndex(null);
      }
      if (e.key === "a" && focusedIndex !== null) {
        const item = items[focusedIndex];
        if (item.type === "approval" && item.requestId) {
          e.preventDefault();
          void handleApprove(item.requestId);
        }
      }
      if (e.key === "r" && focusedIndex !== null) {
        const item = items[focusedIndex];
        if (item.type === "approval" && item.requestId) {
          e.preventDefault();
          // Expand the card so the user can fill in a reason and confirm,
          // rather than submitting an immediate rejection with no reason.
          setExpandedId(item.id);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [focusedIndex, filteredItems, handleApprove, handleReject]);

  // Scroll focused card into view
  useEffect(() => {
    const el = focusedIndex !== null ? cardRefs.current[focusedIndex] : null;
    if (!el) return;
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
    if (typeof el.focus === "function") {
      el.focus();
    }
  }, [focusedIndex]);

  // ─── Unread counts for filter badges ─────────────────────────────────────
  // Only pending HITL items count as unread approvals
  const unreadApprovals = approvalItems.filter((i) => !i.read).length;
  const unreadAlerts = alertItems.filter((i) => !i.read).length;
  const unreadNotifs = notifItems.filter((i) => !i.read).length;
  const counts: Record<InboxFilter, number> = {
    all: unreadApprovals + unreadAlerts + unreadNotifs,
    approvals: unreadApprovals,
    alerts: unreadAlerts,
    notifications: unreadNotifs,
  };

  // ─── Empty state copy ─────────────────────────────────────────────────────
  const emptyText: Record<InboxFilter, string> = {
    all: "No items. Inbox is clear.",
    approvals: "No pending approvals.",
    alerts: "No active alerts.",
    notifications: "No notifications.",
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-(--border) shrink-0">
        <h1 className="text-xl font-semibold text-(--foreground)">Inbox</h1>
        <WSStatusIndicator status={status} />
      </div>

      {/* Offline banner */}
      {status !== "connected" && (
        <div className="px-4 py-2 bg-(--muted) border-b border-(--border) shrink-0">
          <p className="text-xs text-(--muted-foreground)">
            Offline. Approval actions unavailable until reconnected.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <InboxFilterBar filter={filter} counts={counts} onChange={setFilter} />

      {/* Keyboard hints caption */}
      <p className="text-xs text-(--muted-foreground) px-4 mt-1">
        ↑↓ navigate · Enter expand · A approve · R reject
      </p>

      {/* Card list */}
      <div ref={flashRef} className="flex-1 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-(--muted-foreground) text-center">
              {emptyText[filter]}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item, idx) => (
              <div
                key={item.id}
                ref={(el) => { cardRefs.current[idx] = el; }}
                tabIndex={0}
                className={focusedIndex === idx ? "ring-2 ring-ring ring-offset-1" : ""}
              >
                <InboxCard
                  item={item}
                  onApprove={item.type === "approval" ? handleApprove : undefined}
                  onReject={item.type === "approval" ? handleReject : undefined}
                  onMarkRead={handleMarkRead}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
