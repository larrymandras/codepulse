/**
 * Inbox — unified feed of HITL approvals, alerts, system notifications, and
 * the governor's proactive pulse cards + held/suppressed record.
 *
 * Data sources:
 *   approvals     — WS approval_request events (accumulated in state)
 *   alerts        — Convex alerts.listActive query
 *   notifications — Convex notifications.bellAll query
 *   cards/held    — Convex inbox.listAll aggregate ALL-PROFILES read (D-12,
 *                   Plan 02/07, GOV-01/WATCH-01) — NOT a per-profile read.
 *                   Inbox.tsx has no profileId state and none is added; each
 *                   row carries its own profileId and renders a per-card
 *                   profile badge (InboxCard), so business/consulting rows
 *                   are never dropped and no profile switcher is needed.
 *
 * Approve/Reject sends approval.respond command via WS with request_id_target
 * (the HITL UUID, NOT the WS correlation request_id — T-56-08 mitigated).
 *
 * Actions are click-driven, one per card: approvals show Approve/Reject, alerts
 * show acknowledge/mute (AlertInlineActions), and notifications/cards/held show
 * a Dismiss button (routes to inbox.dismiss or notifications.markRead). The old
 * keyboard-nav layer (arrow-focus + Enter/A/R shortcuts) was removed 2026-07-27
 * — it advertised actions that no-op'd on this content and read as broken.
 *
 * Phase 56, Plan 03: CPCC-02.
 * Phase 186, Plan 07: card/held merge from the aggregate inbox read (D-12).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { InboxCard, type InboxItem, type InboxItemType } from "../components/InboxCard";
import { InboxFilterBar, type InboxFilter } from "../components/InboxFilterBar";
import { useApprovalActions } from "@/components/ApprovalActions";
import { PageHeader } from "@/components/PageHeader";
import type { ProfileId } from "@/lib/profiles";

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

// ─── Governor inbox aggregate row → InboxItem (D-12, Plan 02/07) ──────────────
// Sourced from api.inbox.listAll — the ALL-profiles aggregate read, not a
// per-profile query. Every row already carries its own profileId, so the
// merged stream is self-labelling (InboxCard renders the per-card badge).

function isProfileId(value: unknown): value is ProfileId {
  return value === "personal" || value === "business" || value === "consulting";
}

interface InboxRowDoc {
  _id: string;
  profileId: string;
  title: string;
  body: string;
  createdAt: number;
  ackedAt?: number;
  itemType: string;
  heldReason?: string;
  source?: string;
}

function inboxRowToInboxItem(row: InboxRowDoc): InboxItem {
  const type: InboxItemType =
    row.itemType === "card" || row.itemType === "held"
      ? row.itemType
      : ("notification" as InboxItemType);
  return {
    id: row._id,
    type,
    title: row.title,
    message: row.body,
    timestamp: row.createdAt * 1000,
    read: row.ackedAt != null,
    profileId: isProfileId(row.profileId) ? row.profileId : undefined,
    heldReason:
      row.heldReason === "focus" || row.heldReason === "quiet-hours"
        ? row.heldReason
        : undefined,
    source: row.source === "calendar" ? "calendar" : "mail",
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
  const { approve, reject } = useApprovalActions(sendCommand);

  const [filter, setFilter] = useState<InboxFilter>("all");
  const [approvalItems, setApprovalItems] = useState<InboxItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  // Optimistically hidden on Dismiss (the persistent mutation fires too, but
  // bellAll keeps read notifications, so we hide locally for instant feedback).
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // ─── Convex data ──────────────────────────────────────────────────────────
  const alertRecords = useQuery(api.alerts.listActive) ?? [];
  const notificationRecords = useQuery(api.notifications.bellAll) ?? [];
  const markNotificationRead = useMutation(api.notifications.markRead);
  const dismissInboxRow = useMutation(api.inbox.dismiss);
  // D-12: aggregate ALL-profiles read (Plan 02's listAll), not a per-profile
  // inboxRead — this is the ONE merged stream cards/held come from.
  // Cast per the Reminders.tsx precedent (listByProfile ctx is typed
  // `{ db } | any` for convex-test-free unit testing, which widens the
  // generated query's return type to `any` — explicit cast restores the
  // known Doc shape at the call site rather than editing the shared module).
  const inboxRecords = (useQuery(api.inbox.listAll, {}) ??
    []) as unknown as InboxRowDoc[];

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
      };

      setApprovalItems((prev) => {
        // Deduplicate by id
        if (prev.some((p) => p.id === item.id)) return prev;
        return [item, ...prev];
      });
      triggerFlash();
    });

    return unsub;
  }, [subscribeEvent, triggerFlash]);

  // ─── Approve/Reject handlers ──────────────────────────────────────────────
  // Delegate to the shared ApprovalActions hook (D-11) — sole owner of the
  // { request_id_target, decision } payload shape and ack-checked toasts.
  // request_id_target is the HITL UUID — NOT the WS correlation request_id
  // (sendCommand auto-generates its own for ack tracking; T-56-08 mitigated).
  const handleApprove = useCallback(
    async (requestId: string): Promise<boolean> => {
      const ok = await approve(requestId);
      if (!ok) return false;
      setApprovalItems((prev) =>
        prev.map((item) =>
          item.requestId === requestId ? { ...item, read: true } : item
        )
      );
      return true;
    },
    [approve]
  );

  const handleReject = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      const ok = await reject(requestId, note);
      if (!ok) return false;
      setApprovalItems((prev) =>
        prev.map((item) =>
          item.requestId === requestId ? { ...item, read: true } : item
        )
      );
      return true;
    },
    [reject]
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

  // ─── Dismiss handler — clear an item from the inbox ──────────────────────
  // Routes to the persistent mutation by type (cards/held -> inbox.dismiss
  // stamps ackedAt; notifications -> markRead) and hides it optimistically.
  const handleDismiss = useCallback(
    (item: InboxItem) => {
      setDismissedIds((prev) => new Set([...prev, item.id]));
      try {
        if (item.type === "card" || item.type === "held") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          void dismissInboxRow({ id: item.id as any });
        } else if (item.type === "notification") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          void markNotificationRead({ id: item.id as any });
        }
      } catch {
        // Non-Convex id or transient error — the optimistic hide still holds.
      }
    },
    [dismissInboxRow, markNotificationRead]
  );

  // ─── Build item lists ─────────────────────────────────────────────────────
  const alertItems = alertRecords.map(alertToInboxItem);
  const notifItems = notificationRecords.map(notificationToInboxItem).map(
    (item) => (readIds.has(item.id) ? { ...item, read: true } : item)
  );
  // D-12: aggregate all-profiles inbox rows — cards + held (+ any other
  // itemType the governor writes) from personal, business, AND consulting
  // in one merged stream. Each card/held item renders its own profile badge.
  const inboxItems = inboxRecords.map(inboxRowToInboxItem);
  const cardItems = inboxItems.filter((i) => i.type === "card");
  const heldItems = inboxItems.filter((i) => i.type === "held");

  const allItems = useMemo(
    () =>
      sortItems(
        [...approvalItems, ...alertItems, ...notifItems, ...inboxItems].filter(
          (i) => !dismissedIds.has(i.id)
        )
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approvalItems, alertRecords, notificationRecords, readIds, inboxRecords, dismissedIds]
  );

  const filteredItems = useMemo(
    () =>
      filter === "all"
        ? allItems
        : allItems.filter((item) => {
            if (filter === "approvals") return item.type === "approval";
            if (filter === "alerts") return item.type === "alert";
            if (filter === "notifications") return item.type === "notification";
            if (filter === "cards") return item.type === "card";
            if (filter === "held") return item.type === "held";
            return true;
          }),
    [filter, allItems]
  );

  // ─── Unread counts for filter badges ─────────────────────────────────────
  const unreadApprovals = approvalItems.filter((i) => !i.read).length;
  const unreadAlerts = alertItems.filter((i) => !i.read).length;
  const unreadNotifs = notifItems.filter((i) => !i.read).length;
  const unreadCards = cardItems.filter((i) => !i.read).length;
  const unreadHeld = heldItems.filter((i) => !i.read).length;
  const counts: Record<InboxFilter, number> = {
    all: unreadApprovals + unreadAlerts + unreadNotifs + unreadCards + unreadHeld,
    approvals: unreadApprovals,
    alerts: unreadAlerts,
    notifications: unreadNotifs,
    cards: unreadCards,
    held: unreadHeld,
  };

  // ─── Empty state copy ─────────────────────────────────────────────────────
  const emptyText: Record<InboxFilter, string> = {
    all: "No items. Inbox is clear.",
    approvals: "No pending approvals.",
    alerts: "No active alerts.",
    notifications: "No notifications.",
    cards: "No cards yet — the hourly scan hasn't found anything that needs you.",
    held: "Nothing held. Focus mode and quiet hours are both off, or nothing came in while they were on.",
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-(--border) shrink-0">
        <PageHeader title="Inbox" actions={<WSStatusIndicator status={status} />} />
      </div>

      {/* Offline banner */}
      {status !== "connected" && (
        <div className="px-4 py-2 bg-(--muted) border-b border-(--border) shrink-0">
          <p className="text-sm text-(--muted-foreground)">
            Offline. Approval actions unavailable until reconnected.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <InboxFilterBar filter={filter} counts={counts} onChange={setFilter} />

      {/* Card list */}
      <div ref={flashRef} className="flex-1 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-base text-(--muted-foreground) text-center">
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
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
