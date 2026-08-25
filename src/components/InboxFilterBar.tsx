/**
 * InboxFilterBar — horizontal tab row for filtering the Inbox by item type.
 *
 * Active tab: 2px primary bottom border + foreground text.
 * Inactive: muted-foreground text.
 * Each tab shows unread count in parentheses when > 0.
 *
 * Phase 56, Plan 03: CPCC-02 Inbox panel.
 * Phase 186, Plan 07: Cards + Held tabs (D-14/D-15, GOV-01/WATCH-01).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type InboxFilter =
  | "all"
  | "approvals"
  | "alerts"
  | "notifications"
  | "cards"
  | "held";

interface InboxFilterBarProps {
  filter: InboxFilter;
  counts: Record<InboxFilter, number>;
  onChange: (filter: InboxFilter) => void;
  /** A KNOWN true total for a tab's count -- renders "{count} of {total}"
   * instead of the bare count (126-06, D-02). Omit a key when no free true
   * total exists for that tab. */
  totals?: Partial<Record<InboxFilter, number>>;
  /** The tab's count is a floor, not a total -- renders the generic "{count}+"
   * marker (126-06, D-01/D-04). Ignored for a tab that also has a `totals`
   * entry, since a precise "of M" is strictly more informative than a floor. */
  truncated?: Partial<Record<InboxFilter, boolean>>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TABS: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "approvals", label: "Approvals" },
  { id: "alerts", label: "Alerts" },
  { id: "notifications", label: "Notifications" },
  { id: "cards", label: "Cards" },
  { id: "held", label: "Held" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function InboxFilterBar({
  filter,
  counts,
  onChange,
  totals,
  truncated,
}: InboxFilterBarProps) {
  return (
    <div className="flex items-center gap-1 px-4 border-b border-(--border) shrink-0">
      {TABS.map((tab) => {
        const isActive = filter === tab.id;
        const count = counts[tab.id] ?? 0;
        // D-02: a precise "of M" beats a generic floor marker whenever a
        // known true total exists -- only render it when the total actually
        // exceeds the shown count, so an untruncated tab never shows "9 of 9".
        const total = totals?.[tab.id];
        const hasPreciseTotal = total !== undefined && total > count;
        const isFloor = !hasPreciseTotal && truncated?.[tab.id] === true;

        return (
          <button
            key={tab.id}
            className={[
              "text-base px-3 py-2.5 transition-colors",
              isActive
                ? "border-b-2 border-(--primary) text-(--foreground) font-medium"
                : "text-(--muted-foreground) hover:text-(--foreground) border-b-2 border-transparent",
            ].join(" ")}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {count > 0 && (
              <span
                className="ml-1.5 text-sm bg-(--muted) text-(--foreground) px-1.5 py-0.5 rounded-full"
                {...(hasPreciseTotal
                  ? { "aria-label": `${count} of ${total} total` }
                  : isFloor
                    ? { "aria-label": `at least ${count}, more may exist beyond the shown list` }
                    : {})}
              >
                {hasPreciseTotal ? `${count} of ${total}` : isFloor ? `${count}+` : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
