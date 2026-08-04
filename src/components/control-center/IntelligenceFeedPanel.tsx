/**
 * IntelligenceFeedPanel — panel (a), Phase 188 Plan 10 (D-18).
 *
 * Always-live rail of the governor inbox stream. Reuses the EXACT
 * all-profiles aggregate read `Inbox.tsx` already issues
 * (`api.inbox.listAll`, no args) — zero new backend query, server-ordered
 * newest-first (`by_createdAt` desc, `convex/inbox.ts::listAllHandler`).
 *
 * Row density: this panel writes a COMPACT row variant rather than
 * reusing `InboxCard` verbatim. `InboxCard` is built for the full-page
 * `/inbox` list (header row + line-clamp-2 body + risk badge + dismiss
 * button, ~90-120px per card) — too tall for a rail meant to show many
 * rows at once. The money/high stripe convention is still reused
 * VERBATIM (same token, same class string), just applied to a shorter row.
 *
 * Stripe convention (mirrors `InboxCard.tsx`'s `stripeClass`, but keyed off
 * the row's own `priority` field FIRST, per this plan's task text — the
 * governor inbox schema (`convex/schema.ts` `inbox` table) carries
 * `priority: "money" | "high" | "normal" | "low"`, a field `Inbox.tsx`'s own
 * `InboxRowDoc` type omits because Inbox.tsx never needed it):
 *   money/high  -> border-l-(--status-error)  (never a second money colour)
 *   card        -> border-l-(--status-info)
 *   held        -> border-l-(--muted-foreground)  (dimmest, D-15)
 *   else        -> border-l-(--primary)
 *   read (ackedAt set) -> no stripe
 *
 * Tolerates an `undefined` query result (Convex still loading) by rendering
 * the chrome + empty state rather than crashing (T-188-43) — a throwing
 * `useQuery` would otherwise unmount the whole tree.
 *
 * @see 188-UI-SPEC.md panel table row (a); 188-PATTERNS.md
 */
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { Radio } from "lucide-react";
import { api } from "../../../convex/_generated/api";

interface FeedRowDoc {
  _id: string;
  profileId: string;
  priority: string;
  title: string;
  body: string;
  createdAt: number; // seconds-epoch (mirrors Inbox.tsx's `row.createdAt * 1000` convention)
  ackedAt?: number;
  itemType: string;
  heldReason?: string;
  source?: string;
}

function relativeTime(tsMs: number): string {
  const diffMs = Date.now() - tsMs;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function stripeClass(row: FeedRowDoc): string {
  if (row.ackedAt != null) return "";
  if (row.priority === "money" || row.priority === "high") {
    return "border-l-2 border-l-(--status-error)";
  }
  if (row.itemType === "card") return "border-l-2 border-l-(--status-info)";
  if (row.itemType === "held") return "border-l-2 border-l-(--muted-foreground)";
  return "border-l-2 border-l-(--primary)";
}

export function IntelligenceFeedPanel() {
  const rows = (useQuery(api.inbox.listAll, {}) ?? []) as unknown as FeedRowDoc[];

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.createdAt - a.createdAt),
    [rows]
  );

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-5 flex flex-col gap-3 min-w-[240px]">
      <span className="font-mono text-sm tracking-[0.1em] text-muted-foreground flex items-center gap-2">
        <Radio className="w-4 h-4" aria-hidden="true" />
        INTELLIGENCE FEED
      </span>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing needs you right now.</p>
      ) : (
        <div
          // 188-14 live finding: a fixed max-height (not flex-1/min-h-0) is
          // deliberate — this panel sits in the command-center grid
          // alongside centerColumn, which needs its OWN natural (unbounded)
          // height so Control Center isn't squeezed. The two can't share
          // one grid-row-derived height cap, so this scroll region is
          // self-contained: it caps and scrolls regardless of what height
          // the row ends up being, on its own.
          className="max-h-[45vh] overflow-y-auto flex flex-col gap-2"
          aria-live="polite"
          aria-atomic="false"
        >
          {sorted.map((row) => (
            <div
              key={row._id}
              data-testid="feed-row"
              className={`bg-(--card) border border-(--border) rounded p-2 ${stripeClass(row)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold truncate text-(--foreground)">
                  {row.title}
                </span>
                <span className="text-sm text-(--muted-foreground) shrink-0">
                  {relativeTime(row.createdAt * 1000)}
                </span>
              </div>
              <p className="text-sm text-(--muted-foreground) line-clamp-1">{row.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default IntelligenceFeedPanel;
