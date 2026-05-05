import { useState, useMemo, useEffect, Fragment } from "react";
import { startOfWeek, addDays, format, isToday } from "date-fns";
import { CRON_SCHEDULES, estimateNextRun, type CronSchedule } from "../lib/cronSchedules";
import { useDailyRhythm } from "../hooks/useDailyRhythm";
import { categorizeRhythm, CATEGORY_COLORS, type RhythmCategory } from "../lib/rhythmCategories";
import InfoTooltip from "./InfoTooltip";

interface CalendarEntry {
  id: string;
  label: string;
  fullAction: string;
  hour: number;
  dayIndex: number;
  category: RhythmCategory;
  source: "rhythm" | "system";
  agentTypeId?: string;
  channel?: string;
}

function parseDays(days: string): number[] {
  const dayMap: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  if (days.includes("-")) {
    const [start, end] = days.split("-").map(d => dayMap[d.trim().toLowerCase()]);
    if (start !== undefined && end !== undefined) {
      const result: number[] = [];
      for (let i = start; i <= (end >= start ? end : end + 7); i++) result.push(i % 7);
      return result;
    }
  }
  return days.split(",").map(d => dayMap[d.trim().toLowerCase()]).filter((d): d is number => d !== undefined);
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max) + "…";
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function CronCalendarView() {
  const [showSystemCrons, setShowSystemCrons] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const rhythmEntries = useDailyRhythm();

  const { entries, slotMap, weekDays } = useMemo(() => {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const allEntries: CalendarEntry[] = [];

    // Process daily rhythm entries
    for (const entry of rhythmEntries) {
      const timeParts = (entry.time || "").split(":");
      const hour = parseInt(timeParts[0], 10);
      if (isNaN(hour)) continue;

      const dayIndexes = parseDays(entry.days || "");
      const category: RhythmCategory = (entry.category as RhythmCategory) ?? categorizeRhythm(entry.action);

      for (const dayIndex of dayIndexes) {
        allEntries.push({
          id: `rhythm-${entry.action}-${dayIndex}-${hour}`,
          label: truncate(entry.action, 8),
          fullAction: entry.action,
          hour,
          dayIndex,
          category,
          source: "rhythm",
          agentTypeId: entry.agentTypeId,
          channel: entry.channel,
        });
      }
    }

    // Process CRON_SCHEDULES - system crons
    for (const cron of CRON_SCHEDULES) {
      if (cron.dailyUTC) {
        const hour = cron.dailyUTC.hour;
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          allEntries.push({
            id: `system-${cron.jobName}-${dayIndex}`,
            label: truncate(cron.jobName, 8),
            fullAction: cron.label,
            hour,
            dayIndex,
            category: "system",
            source: "system",
          });
        }
      } else if (cron.intervalSeconds >= 86400) {
        const nextRunEpoch = estimateNextRun(cron);
        const nextRunDate = new Date(nextRunEpoch * 1000);
        const hour = nextRunDate.getUTCHours();
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          allEntries.push({
            id: `system-${cron.jobName}-${dayIndex}`,
            label: truncate(cron.jobName, 8),
            fullAction: cron.label,
            hour,
            dayIndex,
            category: "system",
            source: "system",
          });
        }
      } else {
        // Interval-based crons
        const runsPerDay = Math.floor(86400 / cron.intervalSeconds);
        const maxSlots = Math.min(runsPerDay, 24);
        const hoursPerRun = 24 / maxSlots;

        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const hoursSet = new Set<number>();
          for (let slot = 0; slot < maxSlots; slot++) {
            hoursSet.add(Math.floor(slot * hoursPerRun));
          }
          for (const hour of hoursSet) {
            allEntries.push({
              id: `system-${cron.jobName}-${dayIndex}-${hour}`,
              label: truncate(cron.jobName, 8),
              fullAction: cron.label,
              hour,
              dayIndex,
              category: "system",
              source: "system",
            });
          }
        }
      }
    }

    // Group by slot
    const slotMap = new Map<string, CalendarEntry[]>();
    for (const entry of allEntries) {
      const key = `${entry.dayIndex}-${entry.hour}`;
      if (!slotMap.has(key)) slotMap.set(key, []);
      slotMap.get(key)!.push(entry);
    }

    return { entries: allEntries, slotMap, weekDays };
  }, [rhythmEntries, now]);

  // Determine hour range to display
  const { minHour, maxHour } = useMemo(() => {
    let min = 5;
    let max = 22;
    for (const entry of entries) {
      if (entry.hour < min) min = entry.hour;
      if (entry.hour > max) max = entry.hour;
    }
    return { minHour: min, maxHour: max };
  }, [entries]);

  const hours = useMemo(() => {
    const result: number[] = [];
    for (let h = minHour; h <= maxHour; h++) result.push(h);
    return result;
  }, [minHour, maxHour]);

  // Next-up countdown
  const nextUp = useMemo(() => {
    const nowMs = now.getTime();
    let soonest: { label: string; countdown: string; ms: number } | null = null;

    for (const entry of entries) {
      if (entry.source === "system" && !showSystemCrons) continue;
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const entryDay = addDays(weekStart, entry.dayIndex);
      const entryDate = new Date(entryDay);
      entryDate.setHours(entry.hour, 0, 0, 0);
      const diff = entryDate.getTime() - nowMs;
      if (diff > 0 && (!soonest || diff < soonest.ms)) {
        soonest = {
          label: truncate(entry.fullAction, 30),
          countdown: formatCountdown(diff),
          ms: diff,
        };
      }
    }

    return soonest;
  }, [entries, now, showSystemCrons]);

  // Filter entries based on toggle
  const filteredSlotMap = useMemo(() => {
    if (showSystemCrons) return slotMap;
    const filtered = new Map<string, CalendarEntry[]>();
    for (const [key, slotEntries] of slotMap) {
      const nonSystem = slotEntries.filter(e => e.source !== "system");
      if (nonSystem.length > 0) filtered.set(key, nonSystem);
    }
    return filtered;
  }, [slotMap, showSystemCrons]);

  const entriesForSlot = selectedSlot ? (filteredSlotMap.get(selectedSlot) ?? []) : [];

  // Check for truly empty (no data sources at all)
  const isEmpty = rhythmEntries.length === 0 && CRON_SCHEDULES.length === 0;

  // Find today's column index
  const todayIndex = weekDays.findIndex(d => isToday(d));
  const minuteOffset = (now.getMinutes() / 60) * 48;
  const currentHour = now.getHours();

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-300">
            Cron Calendar -- 7 Days
            <InfoTooltip text="Combined view of Astridr daily_rhythm entries and Convex system cron jobs" />
          </h2>
          {nextUp && (
            <p className="text-[10px] text-gray-500 mt-0.5">
              Next: {nextUp.label} in {nextUp.countdown}
            </p>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showSystemCrons}
            onChange={() => setShowSystemCrons(prev => !prev)}
            className="rounded border-gray-600 bg-gray-800"
          />
          System crons
        </label>
      </div>

      {/* Empty state or Grid */}
      {isEmpty ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400">No scheduled tasks</p>
          <p className="text-xs text-gray-600 mt-1">Connect Astridr to sync daily_rhythm entries</p>
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px min-w-[700px]">
              {/* Day headers */}
              <div /> {/* Empty corner cell */}
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className={`text-[10px] text-center py-1 font-medium ${
                    isToday(day) ? "text-indigo-400" : "text-gray-500"
                  }`}
                >
                  {format(day, "EEE d")}
                </div>
              ))}

              {/* Hour rows */}
              {hours.map(hour => (
                <Fragment key={`row-${hour}`}>
                  {/* Hour label */}
                  <div className="text-[10px] text-gray-500 text-right pr-2 h-[48px] flex items-start pt-1">
                    {hour.toString().padStart(2, "0")}:00
                  </div>
                  {/* Day cells */}
                  {weekDays.map((_, dayIndex) => {
                    const key = `${dayIndex}-${hour}`;
                    const slotEntries = filteredSlotMap.get(key) ?? [];
                    const isSelected = selectedSlot === key;
                    const showIndicator = todayIndex === dayIndex && currentHour === hour;

                    return (
                      <div
                        key={key}
                        data-slot={key}
                        className={`relative h-[48px] border border-gray-800/50 px-0.5 py-0.5 hover:bg-gray-700/30 cursor-pointer transition-colors overflow-hidden ${
                          isSelected ? "bg-gray-700/40 ring-1 ring-indigo-500/50" : ""
                        }`}
                        onClick={() => setSelectedSlot(key === selectedSlot ? null : key)}
                      >
                        {/* Current time indicator */}
                        {showIndicator && (
                          <div
                            className="absolute left-0 right-0 border-t border-indigo-500 z-10 pointer-events-none"
                            style={{ top: `${minuteOffset}px` }}
                          />
                        )}
                        {/* Entry badges */}
                        <div className="flex flex-col gap-px overflow-hidden h-full">
                          {slotEntries.slice(0, 3).map(entry => (
                            <span
                              key={entry.id}
                              className={`text-[10px] px-1 py-0.5 rounded border truncate max-w-full ${CATEGORY_COLORS[entry.category]}`}
                            >
                              {entry.label}
                            </span>
                          ))}
                          {slotEntries.length > 3 && (
                            <span className="text-[9px] text-gray-500 px-1">
                              +{slotEntries.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Slot detail popover */}
          {selectedSlot && entriesForSlot.length > 0 && (
            <div
              className="mt-2 bg-gray-900/50 border border-gray-700/40 rounded-lg px-4 py-3 text-xs animate-in slide-in-from-top-2 duration-200"
              data-testid="slot-detail"
            >
              <h3 className="text-sm font-medium text-gray-200 mb-2">Slot Detail</h3>
              {entriesForSlot.map(entry => (
                <div key={entry.id} className="py-1 border-b border-gray-800 last:border-0">
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border mr-2 ${CATEGORY_COLORS[entry.category]}`}>
                    {entry.category}
                  </span>
                  <span className="text-gray-300">{entry.fullAction}</span>
                  {entry.source === "system" && <span className="text-gray-600 ml-1">(Convex)</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
