/**
 * Inbox — unified feed of HITL approvals, alerts, and system notifications.
 *
 * Data sources:
 *   approvals     — WS approval_request events (accumulated in state)
 *   alerts        — Convex alerts.listActive query
 *   notifications — Convex notifications.bellAll query
 *
 * Approve/Reject sends approval.respond command via WS with request_id_target
 * (the HITL UUID, NOT the WS correlation request_id — T-56-08 mitigated).
 *
 * Phase 56, Plan 03: CPCC-02.
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { InboxCard, type InboxItem, type InboxItemType } from "../components/InboxCard";
import { InboxFilterBar, type InboxFilter } from "../components/InboxFilterBar";
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
  createdAt: number;
}): InboxItem {
  return {
    id: alert._id,
    type: "alert" as InboxItemType,
    title: `[${alert.severity.toUpperCase()}] ${alert.source}`,
    message: alert.message,
    timestamp: alert.createdAt * 1000,
    read: alert.acknowledged,
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

  const [filter, setFilter] = useState<InboxFilter>("all");
  const [approvalItems, setApprovalItems] = useState<InboxItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // ─── Convex data ──────────────────────────────────────────────────────────
  const alertRecords = useQuery(api.alerts.listActive) ?? [];
  const notificationRecords = useQuery(api.notifications.bellAll) ?? [];
  const markNotificationRead = useMutation(api.notifications.markRead);

  // ─── WS: accumulate approval_request events ───────────────────────────────
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
      if (!data?.id) return;

      const action = data.action ?? "unknown";
      const riskLevel = inferRiskLevel(action);
      const agentName =
        (data.details?.agent_name as string | undefined) ??
        (data.profile_id as string | undefined) ??
        "Ástríðr";

      const item: InboxItem = {
        id: data.id,
        type: "approval",
        title: action,
        message: data.details ? JSON.stringify(data.details) : "",
        timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
        read: false,
        agentName,
        action,
        riskLevel,
        requestId: data.id,
      };

      setApprovalItems((prev) => {
        // Deduplicate by id
        if (prev.some((p) => p.id === item.id)) return prev;
        return [item, ...prev];
      });
    });

    return unsub;
  }, [subscribeEvent]);

  // ─── Approve handler ──────────────────────────────────────────────────────
  const handleApprove = useCallback(
    async (requestId: string) => {
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
      setApprovalItems((prev) =>
        prev.map((item) =>
          item.requestId === requestId ? { ...item, read: true } : item
        )
      );
    },
    [sendCommand]
  );

  // ─── Reject handler ───────────────────────────────────────────────────────
  const handleReject = useCallback(
    async (requestId: string, note?: string) => {
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
      setApprovalItems((prev) =>
        prev.map((item) =>
          item.requestId === requestId ? { ...item, read: true } : item
        )
      );
    },
    [sendCommand]
  );

  // ─── Mark-read handler ────────────────────────────────────────────────────
  const handleMarkRead = useCallback(
    (id: string) => {
      setReadIds((prev) => new Set([...prev, id]));
      // Try to mark notification in Convex if the id looks like a Convex id
      // (Convex ids are opaque strings — attempt and ignore errors)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void markNotificationRead({ id: id as any });
      } catch {
        // Not a notifications Convex id — ignore
      }
    },
    [markNotificationRead]
  );

  // ─── Build item lists ─────────────────────────────────────────────────────
  const alertItems = alertRecords.map(alertToInboxItem);
  const notifItems = notificationRecords.map(notificationToInboxItem).map(
    (item) => (readIds.has(item.id) ? { ...item, read: true } : item)
  );

  const allItems = sortItems([...approvalItems, ...alertItems, ...notifItems]);

  const filteredItems =
    filter === "all"
      ? allItems
      : allItems.filter((item) => {
          if (filter === "approvals") return item.type === "approval";
          if (filter === "alerts") return item.type === "alert";
          if (filter === "notifications") return item.type === "notification";
          return true;
        });

  // ─── Unread counts for filter badges ─────────────────────────────────────
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

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-(--muted-foreground) text-center">
              {emptyText[filter]}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <InboxCard
                key={item.id}
                item={item}
                onApprove={item.type === "approval" ? handleApprove : undefined}
                onReject={item.type === "approval" ? handleReject : undefined}
                onMarkRead={handleMarkRead}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
