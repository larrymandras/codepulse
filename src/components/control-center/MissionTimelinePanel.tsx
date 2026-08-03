/**
 * MissionTimelinePanel — panel (c), Phase 188 Plan 10 (D-18).
 *
 * The one panel with no existing layout analog in codepulse
 * (188-PATTERNS.md "No Analog Found") — only `ControlCenterPanel`'s chrome
 * is reused; the horizontal scan-strip layout is net-new, deliberately kept
 * simple (a `flex` row of `shrink-0` markers) rather than a canvas or a
 * virtualized scroller, per the plan's action text.
 *
 * Sources (both already-live, zero new Convex function per D-18):
 *  - `api.reminders.listByProfile` — called once per profile in `PROFILES`
 *    (personal/business/consulting), the EXACT query `Reminders.tsx`
 *    already issues per-profile. There is no cross-profile reminders read,
 *    so the three per-profile results are merged client-side.
 *  - `useRecentEvents()` — the cross-profile build+runtime event feed
 *    (`api.events.listRecentUnified`), the "other timeline source" per this
 *    plan's read_first list.
 *
 * Merged + time-sorted (oldest -> newest, left to right) with `useMemo`,
 * then capped at MAX_MARKERS so a long-running instance cannot render an
 * unbounded strip (T-188-42, Denial of Service — unbounded stream growth).
 *
 * @see 188-UI-SPEC.md panel table row (c); 188-PATTERNS.md "No Analog Found"
 */
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { History, Bell, Activity } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useRecentEvents } from "@/hooks/useRecentEvents";
import { PROFILES } from "@/lib/profiles";

// Explicit cap (T-188-42): bounds the DOM even if a long-running instance
// accumulates many reminders/events between visits. Kept small since this
// is a footer scan-strip, not a full list.
const MAX_MARKERS = 40;

interface ReminderRow {
  _id: string;
  title: string;
  notifiedAt?: number;
}

interface EventRow {
  _id: string;
  eventType?: string;
  toolName?: string;
  timestamp: number;
}

type MarkerKind = "reminder" | "event";

interface Marker {
  id: string;
  label: string;
  timestamp: number; // ms
  kind: MarkerKind;
}

// Static class strings (not template-built) so Tailwind's JIT scanner can
// see them — a dynamically-concatenated class name would silently fail to
// compile (RiskBadge in InboxCard.tsx follows the same pattern).
const MARKER_ACCENT: Record<MarkerKind, string> = {
  reminder: "text-(--status-ok)",
  event: "text-(--status-info)",
};

function normalizeMs(ts: number): number {
  // Ástríðr timestamps are frequently seconds-epoch (~1.78e9); Date.now()
  // is ms-epoch (~1.78e12). Same defensive normalization BlackboardPanel/
  // JobsPanel already use.
  return ts < 1e12 ? ts * 1000 : ts;
}

function relativeTime(tsMs: number): string {
  const diffMs = Date.now() - tsMs;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function MissionTimelinePanel() {
  // One call per profile (unrolled, not `.map()`, to keep hook-call count
  // static per React's rules-of-hooks) — mirrors listByProfile's existing
  // per-profile-only contract (no aggregate reminders read exists).
  const personalReminders = (useQuery(api.reminders.listByProfile, {
    profileId: PROFILES[0].id,
  }) ?? []) as unknown as ReminderRow[];
  const businessReminders = (useQuery(api.reminders.listByProfile, {
    profileId: PROFILES[1].id,
  }) ?? []) as unknown as ReminderRow[];
  const consultingReminders = (useQuery(api.reminders.listByProfile, {
    profileId: PROFILES[2].id,
  }) ?? []) as unknown as ReminderRow[];

  const { events } = useRecentEvents();

  const markers = useMemo<Marker[]>(() => {
    const reminderMarkers: Marker[] = [
      ...personalReminders,
      ...businessReminders,
      ...consultingReminders,
    ]
      .filter((r) => r.notifiedAt != null)
      .map((r) => ({
        id: `reminder-${r._id}`,
        label: r.title,
        timestamp: normalizeMs(r.notifiedAt as number),
        kind: "reminder" as const,
      }));

    const eventMarkers: Marker[] = (events as unknown as EventRow[]).map((e) => ({
      id: `event-${e._id}`,
      label: e.toolName ?? e.eventType ?? "Event",
      timestamp: normalizeMs(e.timestamp),
      kind: "event" as const,
    }));

    return [...reminderMarkers, ...eventMarkers]
      .sort((a, b) => a.timestamp - b.timestamp) // oldest -> newest, left to right
      .slice(-MAX_MARKERS); // keep the most recent MAX_MARKERS after sorting
  }, [personalReminders, businessReminders, consultingReminders, events]);

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-5 flex flex-col gap-3 min-w-[240px]">
      <span className="font-mono text-sm tracking-[0.1em] text-muted-foreground flex items-center gap-2">
        <History className="w-4 h-4" aria-hidden="true" />
        MISSION TIMELINE
      </span>

      {markers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No mission activity yet.</p>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto"
          aria-live="polite"
          aria-atomic="false"
        >
          {markers.map((m) => {
            const Icon = m.kind === "reminder" ? Bell : Activity;
            return (
              <div
                key={m.id}
                data-testid="timeline-marker"
                className="shrink-0 flex flex-col items-center gap-1 w-28"
              >
                <Icon className={`w-3.5 h-3.5 ${MARKER_ACCENT[m.kind]}`} aria-hidden="true" />
                <span className="text-sm text-foreground truncate w-full text-center">
                  {m.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {relativeTime(m.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MissionTimelinePanel;
