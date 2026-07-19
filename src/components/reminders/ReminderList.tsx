/**
 * ReminderList — grouped Overdue / Today / Upcoming / Done list with inline
 * quick actions (101-UI-SPEC.md "Reminder row"). All title/notes/tag text is
 * rendered as plain React text nodes — no raw-HTML injection APIs — so a
 * cached Google/agent string can never inject markup (T-101-03).
 *
 * Quick actions are optimistic: a local `overrides` map renders the assumed
 * end-state immediately, then reconciles once the Convex mutation resolves
 * (settles automatically once the realtime query reflects the server row);
 * a failed mutation rolls the override back and shows a toast.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Repeat,
  Bot,
  Pencil,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface ReminderRecurrence {
  freq: "daily" | "weekly" | "monthly";
  interval: number;
  byday?: string[];
  until?: number;
}

export interface ReminderDoc {
  _id: string;
  profileId: string;
  title: string;
  notes?: string;
  dueAt?: number;
  priority?: string;
  status: string; // "open" | "snoozed" | "done"
  recurrence?: ReminderRecurrence;
  tags?: string[];
  source: string; // "dashboard" | "astridr"
  snoozedUntil?: number;
  notifiedAt?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface ReminderOverride {
  status?: string;
  snoozedUntil?: number;
  title?: string;
  dueAt?: number;
  priority?: string;
}

interface ReminderListProps {
  reminders: ReminderDoc[];
  loading: boolean;
  accentVar: string;
  selectedDay: number | null;
  onClearDayFilter: () => void;
  onComplete: (id: string) => Promise<unknown>;
  onSnooze: (id: string, until: number) => Promise<unknown>;
  onEdit: (
    id: string,
    fields: { title?: string; dueAt?: number; priority?: string }
  ) => Promise<unknown>;
}

const DAY_SECONDS = 86400;

function startOfDaySeconds(epochSeconds: number): number {
  const d = new Date(epochSeconds * 1000);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/** Effective due date for grouping/display purposes — a snoozed reminder's
 * effective date is when the snooze wakes it back up, not the original due
 * date, so it lands in the right group once its snooze passes. */
function effectiveDueAt(r: ReminderDoc): number | undefined {
  if (r.status === "snoozed" && r.snoozedUntil !== undefined) return r.snoozedUntil;
  return r.dueAt;
}

function formatRelativeDue(dueAt: number, now: number): string {
  const diffSec = dueAt - now;
  const abs = Math.abs(diffSec);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const minutes = Math.max(1, Math.floor((abs % 3600) / 60));
  let unit: string;
  if (days >= 1) unit = `${days}d`;
  else if (hours >= 1) unit = `${hours}h`;
  else unit = `${minutes}m`;
  return diffSec < 0 ? `${unit} overdue` : `in ${unit}`;
}

const PRIORITY_VAR: Record<string, string> = {
  low: "--status-info",
  med: "--status-warn",
  high: "--status-error",
};

/** Respects prefers-reduced-motion (lazy-init + change listener, mirrors
 * resolveThemeColors' fresh-read pattern). Guarded for jsdom, where
 * window.matchMedia may be undefined. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return reduced;
}

function SnoozeMenu({
  onPick,
}: {
  onPick: (until: number) => void;
}) {
  const [custom, setCustom] = useState("");
  const now = Date.now() / 1000;

  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => onPick(now + 3600)}
      >
        1 hour
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => {
          const d = new Date();
          d.setHours(18, 0, 0, 0);
          if (d.getTime() / 1000 <= now) d.setDate(d.getDate() + 1);
          onPick(Math.floor(d.getTime() / 1000));
        }}
      >
        This evening
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => onPick(now + DAY_SECONDS)}
      >
        Tomorrow
      </Button>
      <div className="flex items-center gap-1 pt-1 border-t border-border mt-1">
        <Input
          type="datetime-local"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          aria-label="Custom snooze time"
          className="text-sm h-8"
        />
        <Button
          size="sm"
          disabled={!custom}
          onClick={() => custom && onPick(Math.round(new Date(custom).getTime() / 1000))}
        >
          Set
        </Button>
      </div>
    </div>
  );
}

function EditPopover({
  reminder,
  onSave,
}: {
  reminder: ReminderDoc;
  onSave: (fields: { title?: string; dueAt?: number; priority?: string }) => void;
}) {
  const [title, setTitle] = useState(reminder.title);
  const [priority, setPriority] = useState(reminder.priority ?? "med");
  const [dueAt, setDueAt] = useState(
    reminder.dueAt !== undefined
      ? new Date(reminder.dueAt * 1000).toISOString().slice(0, 16)
      : ""
  );

  return (
    <div className="flex flex-col gap-2 min-w-[220px]">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Edit title"
      />
      <Input
        type="datetime-local"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        aria-label="Edit due date"
      />
      <div className="flex items-center gap-1">
        {(["low", "med", "high"] as const).map((p) => (
          <Button
            key={p}
            type="button"
            size="xs"
            variant={priority === p ? "default" : "outline"}
            onClick={() => setPriority(p)}
          >
            {p}
          </Button>
        ))}
      </div>
      <Button
        size="sm"
        onClick={() =>
          onSave({
            title: title.trim() || reminder.title,
            dueAt: dueAt ? Math.round(new Date(dueAt).getTime() / 1000) : undefined,
            priority,
          })
        }
      >
        Save
      </Button>
    </div>
  );
}

function ReminderRow({
  reminder,
  accentVar,
  now,
  reduceMotion,
  isOverdue,
  onComplete,
  onSnooze,
  onEdit,
}: {
  reminder: ReminderDoc;
  accentVar: string;
  now: number;
  reduceMotion: boolean;
  isOverdue: boolean;
  onComplete: () => void;
  onSnooze: (until: number) => void;
  onEdit: (fields: { title?: string; dueAt?: number; priority?: string }) => void;
}) {
  const due = effectiveDueAt(reminder);
  const priorityVar = PRIORITY_VAR[reminder.priority ?? "med"] ?? "--status-warn";
  const isDone = reminder.status === "done";

  return (
    <div
      data-testid="reminder-row"
      data-status={reminder.status}
      data-overdue={isOverdue ? "true" : "false"}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-300 ${
        isDone ? "opacity-50" : ""
      } ${
        isOverdue && !reduceMotion
          ? "animate-pulse"
          : ""
      }`}
      style={{
        borderColor: isOverdue ? `var(${accentVar})` : "var(--border)",
        boxShadow: isOverdue
          ? `0 0 10px oklch(from var(${accentVar}) l c h / 0.25)`
          : undefined,
      }}
    >
      <button
        type="button"
        aria-label={isDone ? `${reminder.title} completed` : `Complete ${reminder.title}`}
        onClick={onComplete}
        disabled={isDone}
        className="shrink-0"
      >
        {isDone ? (
          <CheckCircle2 className="h-4 w-4" style={{ color: `var(${accentVar})` }} />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        )}
      </button>

      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: `var(${priorityVar})` }}
        aria-hidden="true"
      />
      <span className="sr-only">{reminder.priority ?? "med"} priority</span>

      <div className="flex-1 min-w-0">
        <p className={`text-base truncate ${isDone ? "line-through" : ""}`}>
          {reminder.title}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          {due !== undefined && <span>{formatRelativeDue(due, now)}</span>}
          {reminder.recurrence && (
            <span className="flex items-center gap-0.5" title="Recurring">
              <Repeat className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Recurring</span>
            </span>
          )}
          {reminder.source === "astridr" && (
            <span
              className="flex items-center gap-0.5"
              title="Created by Ástríðr"
              aria-label="Created by Ástríðr"
            >
              <Bot className="h-3 w-3" aria-hidden="true" />
            </span>
          )}
          {(reminder.tags ?? []).map((tag) => (
            <Badge key={tag} variant="outline" className="text-sm px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {!isDone && (
        <div className="flex items-center gap-1 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Snooze ${reminder.title}`}
              >
                <Clock className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-2">
              <SnoozeMenu onPick={onSnooze} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Edit ${reminder.title}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-2">
              <EditPopover reminder={reminder} onSave={onEdit} />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

function GroupHeader({
  label,
  count,
  accentVar,
  loud,
  reduceMotion,
}: {
  label: string;
  count: number;
  accentVar: string;
  loud?: boolean;
  reduceMotion: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <h2
        className="text-sm font-mono uppercase tracking-widest"
        style={{ color: loud ? `var(${accentVar})` : "var(--muted-foreground)" }}
      >
        {label}
      </h2>
      <Badge
        variant="outline"
        className={loud && count > 0 && !reduceMotion ? "animate-pulse" : ""}
        style={loud ? { borderColor: `var(${accentVar})`, color: `var(${accentVar})` } : undefined}
      >
        {count}
      </Badge>
    </div>
  );
}

export function ReminderList({
  reminders,
  loading,
  accentVar,
  selectedDay,
  onClearDayFilter,
  onComplete,
  onSnooze,
  onEdit,
}: ReminderListProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [overrides, setOverrides] = useState<Record<string, ReminderOverride>>({});
  const [doneOpen, setDoneOpen] = useState(false);
  const now = Date.now() / 1000;

  // Drop an override once the server row already reflects it (avoids
  // permanently-stuck optimistic state after a realtime update lands).
  useEffect(() => {
    setOverrides((prev) => {
      let changed = false;
      const next: Record<string, ReminderOverride> = {};
      for (const [id, override] of Object.entries(prev)) {
        const row = reminders.find((r) => r._id === id);
        if (row && override.status !== undefined && row.status === override.status) {
          changed = true;
          continue;
        }
        next[id] = override;
      }
      return changed ? next : prev;
    });
  }, [reminders]);

  const merged = useMemo(
    () =>
      reminders.map((r) => (overrides[r._id] ? { ...r, ...overrides[r._id] } : r)),
    [reminders, overrides]
  );

  const dayFiltered = useMemo(() => {
    if (selectedDay === null) return merged;
    return merged.filter((r) => {
      const due = effectiveDueAt(r);
      return due !== undefined && startOfDaySeconds(due) === selectedDay;
    });
  }, [merged, selectedDay]);

  const groups = useMemo(() => {
    const todayStart = startOfDaySeconds(now);
    const tomorrowStart = todayStart + DAY_SECONDS;
    const open = dayFiltered.filter((r) => r.status !== "done");
    const done = dayFiltered.filter((r) => r.status === "done");
    const overdue = open.filter((r) => {
      const due = effectiveDueAt(r);
      return due !== undefined && due < now;
    });
    const today = open.filter((r) => {
      const due = effectiveDueAt(r);
      return due !== undefined && due >= now && due < tomorrowStart;
    });
    const upcoming = open.filter((r) => {
      const due = effectiveDueAt(r);
      return due === undefined || due >= tomorrowStart;
    });
    return { overdue, today, upcoming, done };
  }, [dayFiltered, now]);

  async function handleComplete(id: string) {
    setOverrides((o) => ({ ...o, [id]: { ...o[id], status: "done" } }));
    try {
      await onComplete(id);
    } catch {
      setOverrides((o) => {
        const n = { ...o };
        delete n[id];
        return n;
      });
      toast.error("Failed to complete reminder.");
    }
  }

  async function handleSnooze(id: string, until: number) {
    setOverrides((o) => ({ ...o, [id]: { ...o[id], status: "snoozed", snoozedUntil: until } }));
    try {
      await onSnooze(id, until);
    } catch {
      setOverrides((o) => {
        const n = { ...o };
        delete n[id];
        return n;
      });
      toast.error("Failed to snooze reminder.");
    }
  }

  async function handleEdit(
    id: string,
    fields: { title?: string; dueAt?: number; priority?: string }
  ) {
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...fields } }));
    try {
      await onEdit(id, fields);
    } catch {
      toast.error("Failed to save reminder.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-base text-muted-foreground">
        Loading reminders...
      </div>
    );
  }

  const groupDefs: { key: keyof typeof groups; label: string; loud?: boolean }[] = [
    { key: "overdue", label: "Overdue", loud: true },
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto gap-4 pr-1">
      {selectedDay !== null && (
        <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-1.5 text-sm">
          <span className="text-muted-foreground">Filtered to selected day</span>
          <Button variant="ghost" size="xs" onClick={onClearDayFilter}>
            <X className="h-3 w-3" /> Clear
          </Button>
        </div>
      )}

      {groupDefs.map(({ key, label, loud }) => {
        const items = groups[key];
        return (
          <section key={key} aria-label={label}>
            <GroupHeader
              label={label}
              count={items.length}
              accentVar={accentVar}
              loud={loud}
              reduceMotion={reduceMotion}
            />
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1 py-2">
                {key === "overdue"
                  ? "No overdue reminders — nice."
                  : key === "today"
                    ? "Nothing due today."
                    : "Nothing upcoming."}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {items.map((r) => (
                  <ReminderRow
                    key={r._id}
                    reminder={r}
                    accentVar={accentVar}
                    now={now}
                    reduceMotion={reduceMotion}
                    isOverdue={key === "overdue"}
                    onComplete={() => handleComplete(r._id)}
                    onSnooze={(until) => handleSnooze(r._id, until)}
                    onEdit={(fields) => handleEdit(r._id, fields)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <Collapsible open={doneOpen} onOpenChange={setDoneOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-1 px-1 py-1 w-full text-left">
            {doneOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <GroupHeader
              label="Done"
              count={groups.done.length}
              accentVar={accentVar}
              reduceMotion={reduceMotion}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {groups.done.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1 py-2">Nothing completed yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {groups.done.map((r) => (
                <ReminderRow
                  key={r._id}
                  reminder={r}
                  accentVar={accentVar}
                  now={now}
                  reduceMotion={reduceMotion}
                  isOverdue={false}
                  onComplete={() => handleComplete(r._id)}
                  onSnooze={(until) => handleSnooze(r._id, until)}
                  onEdit={(fields) => handleEdit(r._id, fields)}
                />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
