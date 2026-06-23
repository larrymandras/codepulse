/**
 * WebhookStatusBadge — delivery status indicator for alert rows.
 *
 * Shows a colored dot + caption for webhook delivery state:
 *   delivered → green dot + "Delivered {relative time}"
 *   failed    → red dot + "Failed after 3 attempts"
 *   pending   → yellow dot + "Retrying ({attempts}/3)"
 *   undefined → renders nothing
 *
 * Phase 06-05: ALR-06 alert lifecycle UI
 */

interface WebhookStatusBadgeProps {
  status?: string;
  deliveredAt?: number;
  attempts?: number;
}

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

export function WebhookStatusBadge({
  status,
  deliveredAt,
  attempts = 0,
}: WebhookStatusBadgeProps) {
  if (!status) return null;

  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[var(--status-ok)] shrink-0" />
        <span className="text-sm text-muted-foreground">
          {deliveredAt ? `Delivered ${relativeTime(deliveredAt)}` : "Delivered"}
        </span>
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[var(--status-error)] shrink-0" />
        <span className="text-sm text-muted-foreground">
          Failed after 3 attempts
        </span>
      </span>
    );
  }

  if (status === "pending" || status === "retrying") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[var(--status-warn)] shrink-0" />
        <span className="text-sm text-muted-foreground">
          Retrying ({attempts}/3)
        </span>
      </span>
    );
  }

  return null;
}
