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

// Use the SHARED helper, which takes EPOCH SECONDS. This component previously
// carried its own local copy that did `Date.now() - ts` — i.e. it expected
// MILLISECONDS. Every producer of `webhookDeliveredAt` writes seconds
// (`convex/webhookDelivery.ts` sets it from `Date.now() / 1000`, and the schema
// stores that verbatim), so subtracting a seconds value from a millisecond
// `Date.now()` yielded ~1.785e12 ms and the badge rendered "Delivered 20645d
// ago" — a 1970 date — on a webhook delivered seconds earlier.
//
// The giveaway was that the alert's OWN timestamp one line above rendered
// correctly ("17m ago"): Alerts.tsx feeds the same kind of seconds value to a
// seconds-based helper. 14 of the repo's 15 epoch-based `relativeTime` copies
// are seconds-based; this was one of the odd ones out.
// Found 2026-07-31 at Phase 104's live gate, on the first real budget alert.
import { relativeTime } from "@/lib/formatters";

interface WebhookStatusBadgeProps {
  status?: string;
  /** Epoch SECONDS (matches `alerts.webhookDeliveredAt`), never milliseconds. */
  deliveredAt?: number;
  attempts?: number;
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
