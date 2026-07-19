/**
 * Reminders — profile-segmented command center: reminders list + read-only
 * Google Calendar overlay. UI-01 / UI-02 / CAL-02 (Phase 101 Plan 06).
 *
 * Convex is the source of truth (D-01); reminders + calendar both stream via
 * useQuery so an Ástríðr-created reminder or a fresh calendar-cron push
 * appears here without a manual refresh (realtime, REM-01/CAL-02). The
 * calendar pane is READ-ONLY (D-02) — nothing on this page ever writes to
 * Google, and no calendarEvents mutation is imported here.
 */
import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { QuickAdd, type NewReminderInput } from "@/components/reminders/QuickAdd";
import { ReminderList, type ReminderDoc } from "@/components/reminders/ReminderList";
import { CalendarOverlay, type CalendarEventDoc } from "@/components/reminders/CalendarOverlay";

export type ProfileId = "personal" | "business" | "consulting";

// Per-profile accent — reuses existing semantic status tokens (never a
// hardcoded hex) so accents stay theme-aware across all 5 data-theme
// variants (101-UI-SPEC.md "Non-negotiable house style"). Mirrors the
// green/amber/blue triad already used for these three profiles in
// ProfileCard.tsx's PROFILE_META, recast as CSS custom properties.
export const PROFILES: { id: ProfileId; label: string; accentVar: string }[] = [
  { id: "personal", label: "Personal", accentVar: "--status-ok" },
  { id: "business", label: "Business", accentVar: "--status-warn" },
  { id: "consulting", label: "Consulting", accentVar: "--status-info" },
];

const STORAGE_KEY = "codepulse-reminders-profile";

function isProfileId(value: string | null): value is ProfileId {
  return value === "personal" || value === "business" || value === "consulting";
}

function loadStoredProfile(): ProfileId {
  if (typeof window === "undefined") return "personal";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isProfileId(stored) ? stored : "personal";
}

/** Quiet segmented control — accent only on the active segment (mirrors
 * Tasks.tsx's ViewToggle), each segment tinted by its profile accent. */
function ProfileSwitch({
  value,
  onChange,
}: {
  value: ProfileId;
  onChange: (id: ProfileId) => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5"
      role="tablist"
      aria-label="Profile"
    >
      {PROFILES.map((p) => {
        const active = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p.id)}
            className={`px-2.5 py-1 text-sm rounded-md font-mono uppercase tracking-wide transition-all duration-300 ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              active
                ? {
                    color: `var(${p.accentVar})`,
                    boxShadow: `0 0 8px oklch(from var(${p.accentVar}) l c h / 0.35)`,
                  }
                : undefined
            }
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Reminders() {
  const [profileId, setProfileId] = useState<ProfileId>(loadStoredProfile);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Persist last-selected profile (UI-SPEC: "Default to the last-selected
  // profile"); clear the calendar day filter on profile switch so a stale
  // filter from a different profile's calendar can't hide the new list.
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, profileId);
    setSelectedDay(null);
  }, [profileId]);

  const accentVar = PROFILES.find((p) => p.id === profileId)?.accentVar ?? "--primary";

  // ─── Realtime data (D-01) ──────────────────────────────────────────────
  const remindersRaw = useQuery(api.reminders.listByProfile, { profileId });
  const eventsRaw = useQuery(api.calendarEvents.listByProfile, { profileId });
  const reminders = (remindersRaw ?? []) as unknown as ReminderDoc[];
  const events = (eventsRaw ?? []) as unknown as CalendarEventDoc[];

  // ─── Mutations (optimistic — reconciled by children, UI-02) ───────────
  const createReminder = useMutation(api.reminders.create);
  const completeReminder = useMutation(api.reminders.complete);
  const snoozeReminder = useMutation(api.reminders.snooze);
  const updateReminder = useMutation(api.reminders.update);

  const handleAdd = useCallback(
    async (input: NewReminderInput) => {
      try {
        await createReminder({ ...input, profileId, source: "dashboard" });
      } catch {
        toast.error("Failed to add reminder.");
      }
    },
    [createReminder, profileId]
  );

  const handleComplete = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (id: string) => completeReminder({ id: id as any }),
    [completeReminder]
  );

  const handleSnooze = useCallback(
    (id: string, until: number) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      snoozeReminder({ id: id as any, until }),
    [snoozeReminder]
  );

  const handleEdit = useCallback(
    (id: string, fields: { title?: string; dueAt?: number; priority?: string }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateReminder({ id: id as any, ...fields }),
    [updateReminder]
  );

  return (
    <div className="flex flex-col h-full px-4 py-3 overflow-hidden">
      <PageHeader
        title="Reminders"
        actions={<ProfileSwitch value={profileId} onChange={setProfileId} />}
      />

      <QuickAdd profileId={profileId} accentVar={accentVar} onAdd={handleAdd} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 mt-3 min-h-0 overflow-hidden">
        <SectionErrorBoundary name="Reminder List">
          <ReminderList
            reminders={reminders}
            loading={remindersRaw === undefined}
            accentVar={accentVar}
            selectedDay={selectedDay}
            onClearDayFilter={() => setSelectedDay(null)}
            onComplete={handleComplete}
            onSnooze={handleSnooze}
            onEdit={handleEdit}
          />
        </SectionErrorBoundary>

        <SectionErrorBoundary name="Calendar Overlay">
          <CalendarOverlay
            events={events}
            reminders={reminders}
            loading={eventsRaw === undefined}
            accentVar={accentVar}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
