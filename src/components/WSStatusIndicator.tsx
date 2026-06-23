/**
 * WSStatusIndicator — 8px status dot + label showing WebSocket connection state.
 *
 * Colors:
 *   connected     → green dot + "Connected"
 *   reconnecting  → yellow dot (animated pulse) + "Reconnecting..."
 *   disconnected  → red dot + "Disconnected"
 *
 * Phase 56: used in all 5 new command center panels.
 */

import type { WSStatus } from "../contexts/AstridrWSContext";

const statusConfig: Record<
  WSStatus,
  { dotClass: string; label: string }
> = {
  connected: {
    dotClass: "bg-(--status-ok)",
    label: "Connected",
  },
  reconnecting: {
    dotClass: "bg-(--status-warn) animate-pulse",
    label: "Reconnecting...",
  },
  disconnected: {
    dotClass: "bg-(--status-error)",
    label: "Disconnected",
  },
};

export function WSStatusIndicator({ status }: { status: WSStatus }) {
  const { dotClass, label } = statusConfig[status];
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
