/**
 * InboxFilterBar — horizontal tab row for filtering the Inbox by item type.
 *
 * Active tab: 2px primary bottom border + foreground text.
 * Inactive: muted-foreground text.
 * Each tab shows unread count in parentheses when > 0.
 *
 * Phase 56, Plan 03: CPCC-02 Inbox panel.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type InboxFilter = "all" | "approvals" | "alerts" | "notifications";

interface InboxFilterBarProps {
  filter: InboxFilter;
  counts: Record<InboxFilter, number>;
  onChange: (filter: InboxFilter) => void;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TABS: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "approvals", label: "Approvals" },
  { id: "alerts", label: "Alerts" },
  { id: "notifications", label: "Notifications" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function InboxFilterBar({ filter, counts, onChange }: InboxFilterBarProps) {
  return (
    <div className="flex items-center gap-1 px-4 border-b border-(--border) shrink-0">
      {TABS.map((tab) => {
        const isActive = filter === tab.id;
        const count = counts[tab.id] ?? 0;

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
              <span className="ml-1.5 text-sm bg-(--muted) text-(--foreground) px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
