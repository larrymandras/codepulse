/**
 * CalendarOverlay — read-only month/week grid showing cached Google Calendar
 * events beside due-dated reminders as day chips (101-UI-SPEC.md "Calendar
 * overlay", CAL-02). READ-ONLY (D-02): this file imports only
 * `api.calendarEvents.listByProfile` — no calendarEvents mutation, no
 * create/edit handler, no Google client anywhere in this repo. Clicking a
 * day filters the reminder list to that day via onSelectDay.
 */
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReminderDoc } from "./ReminderList";

export interface CalendarEventDoc {
  _id: string;
  profileId: string;
  calendarAccount: string;
  googleEventId: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  location?: string;
  fetchedAt: number;
}

interface CalendarOverlayProps {
  events: CalendarEventDoc[];
  reminders: ReminderDoc[];
  loading: boolean;
  accentVar: string;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
}

type ViewMode = "month" | "week";

function effectiveDueAt(r: ReminderDoc): number | undefined {
  if (r.status === "snoozed" && r.snoozedUntil !== undefined) return r.snoozedUntil;
  return r.dueAt;
}

function startOfDaySeconds(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

// Chips a single day cell shows before collapsing to "+N more". Week cells are
// far taller than month cells, so they carry more.
const MAX_CHIPS_MONTH = 4;
const MAX_CHIPS_WEEK = 10;

const PRIORITY_VAR: Record<string, string> = {
  low: "--status-info",
  med: "--status-warn",
  high: "--status-error",
};

export function CalendarOverlay({
  events,
  reminders,
  loading,
  accentVar,
  selectedDay,
  onSelectDay,
}: CalendarOverlayProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [mode, setMode] = useState<ViewMode>("month");

  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(viewDate);
      return eachDayOfInterval({ start, end: endOfWeek(viewDate) });
    }
    const start = startOfWeek(startOfMonth(viewDate));
    const end = endOfWeek(endOfMonth(viewDate));
    return eachDayOfInterval({ start, end });
  }, [viewDate, mode]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEventDoc[]>();
    for (const ev of events) {
      const key = startOfDaySeconds(new Date(ev.start * 1000));
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const remindersByDay = useMemo(() => {
    const map = new Map<number, ReminderDoc[]>();
    for (const r of reminders) {
      const due = effectiveDueAt(r);
      if (due === undefined) continue;
      const key = startOfDaySeconds(new Date(due * 1000));
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [reminders]);

  function goPrev() {
    setViewDate((d) => (mode === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
  }
  function goNext() {
    setViewDate((d) => (mode === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  }

  function handleDayClick(day: Date) {
    const key = startOfDaySeconds(day);
    onSelectDay(selectedDay === key ? null : key);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-base text-muted-foreground">
        Loading calendar...
      </div>
    );
  }

  // Week rows in the current view (5 or 6 for a month, 1 for a week). Drives the
  // grid's row template so cells divide the available height instead of sitting
  // at a fixed 64px and leaving the rest of the page empty.
  const weekRows = Math.max(1, Math.ceil(days.length / 7));

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
            {format(viewDate, mode === "week" ? "'Week of' MMM d" : "MMMM yyyy")}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            aria-pressed={mode === "month"}
            onClick={() => setMode("month")}
          >
            Month
          </Button>
          <Button
            variant="ghost"
            size="xs"
            aria-pressed={mode === "week"}
            onClick={() => setMode("week")}
          >
            Week
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Previous" onClick={goPrev}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Next" onClick={goNext}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 grid grid-cols-7 gap-1 text-sm w-full min-w-0"
        style={{ gridTemplateRows: `auto repeat(${weekRows}, minmax(0, 1fr))` }}
      >
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-muted-foreground text-sm font-mono pb-1">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = startOfDaySeconds(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const dayReminders = remindersByDay.get(key) ?? [];
          const dimmed = mode === "month" && !isSameMonth(day, viewDate);
          const selected = selectedDay === key;

          // Budget chips across BOTH lists together, then derive the overflow
          // count from what was actually rendered. The previous code sliced each
          // list to 2 but gated "+N more" on a combined `> 4`, so e.g. 3 events
          // and 0 reminders silently dropped the third with no indicator.
          const chipBudget = mode === "week" ? MAX_CHIPS_WEEK : MAX_CHIPS_MONTH;
          const shownEvents = dayEvents.slice(0, chipBudget);
          const shownReminders = dayReminders.slice(
            0,
            Math.max(0, chipBudget - shownEvents.length)
          );
          const hiddenCount =
            dayEvents.length + dayReminders.length - shownEvents.length - shownReminders.length;

          return (
            <button
              type="button"
              key={key}
              onClick={() => handleDayClick(day)}
              aria-label={format(day, "PPPP")}
              aria-pressed={selected}
              className={`flex flex-col items-start gap-0.5 rounded-md border p-1.5 min-h-[64px] h-full overflow-hidden text-left transition-colors ${
                dimmed ? "opacity-40" : ""
              } ${selected ? "border-2" : "border-border"}`}
              style={
                selected
                  ? { borderColor: `var(${accentVar})`, boxShadow: `0 0 8px oklch(from var(${accentVar}) l c h / 0.3)` }
                  : undefined
              }
            >
              <span
                className={`text-sm font-mono ${isToday(day) ? "font-bold" : "text-muted-foreground"}`}
                style={isToday(day) ? { color: `var(${accentVar})` } : undefined}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5 w-full min-h-0 overflow-hidden">
                {shownEvents.map((ev) => (
                  <span
                    key={ev._id}
                    data-testid="calendar-event-chip"
                    title={ev.title}
                    className="text-[11px] leading-tight rounded border border-muted-foreground/50 text-muted-foreground px-1 truncate"
                  >
                    {ev.title}
                  </span>
                ))}
                {shownReminders.map((r) => {
                  const priorityVar = PRIORITY_VAR[r.priority ?? "med"] ?? "--status-warn";
                  return (
                    <span
                      key={r._id}
                      data-testid="calendar-reminder-chip"
                      title={r.title}
                      className="text-[11px] leading-tight rounded px-1 truncate text-white"
                      style={{ backgroundColor: `var(${priorityVar})` }}
                    >
                      {r.title}
                    </span>
                  );
                })}
                {hiddenCount > 0 && (
                  <span className="text-[11px] text-muted-foreground">+{hiddenCount} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
