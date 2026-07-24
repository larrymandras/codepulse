/**
 * BrainControl — read + write brain selector for the control center (D-17,
 * plan 186-09).
 *
 * Visuals are the exact bordered/labeled BRAIN box `ControlCenterPanel.tsx`
 * (Plan 08) already ships — no restyle — now wrapped in a `Popover` trigger
 * with a `ChevronDown` affordance (UI-SPEC "pill visuals unchanged, only a
 * chevron affordance added"; Plan 08's own docstring documents that its BRAIN
 * row replaced a tiny `SwapBadge` chip with this bigger box per live
 * feedback, so this component wraps THAT box rather than `SwapBadge` itself
 * — same underlying data, same live-feedback-driven shape).
 *
 * Opening the popover fetches the live catalogue via `swap.catalogue`
 * (read-only WS command, 186-09 Task 1 Rule 2 addition) — NOT a hardcoded
 * list. Selecting an entry (or the "Restore usual brain" row, shown only
 * when an override is active) dispatches `swap.set` — the SAME
 * `swap_model` `ControlVerb.execute` a spoken "try on X" resolves to
 * (astridr/api/ws_commands.py's `_handle_swap_set`), never a parallel
 * mutation. The panel's existing `swap.state` live push (Plan 07/185)
 * updates `override`/`lastTurnModel` upstream in `Chat.tsx` once the swap
 * lands — this component does not locally guess the new state.
 *
 * CHECKPOINT ROUND 1 (Larry, live screenshots — see 186-09-SUMMARY.md
 * "Deviations" for the full record): the live OpenRouter catalogue is
 * ~300+ entries, so (a) the popover widened (`w-64` -> `w-96`) and rows
 * switched from a fixed-height `Button` to a wrapping `<button>` so model
 * names NEVER truncate, and (b) a type-to-filter `Input` was added — the
 * backend already sorts the raw catalogue (`ws_commands.py`), but at this
 * scale a filter is the primary navigation aid, not scrolling.
 *
 * @see 186-UI-SPEC.md "Control Center (D-17)" — BrainControl row
 * @see codepulse/src/components/reminders/ReminderList.tsx (SnoozeMenu/
 *   EditPopover Popover idiom this component follows)
 */

import { useCallback, useMemo, useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAstridrWS } from "@/contexts/AstridrWSContext";

export interface CatalogueEntry {
  id: string;
  name: string;
  vendor?: string;
}

export interface BrainControlProps {
  /** The active model override, or null/undefined at default (Auto). */
  override?: string | null;
  /** The resolved model of the last completed turn — shown when no override is active. */
  lastTurnModel?: string | null;
}

export function BrainControl({ override, lastTurnModel }: BrainControlProps) {
  const { sendCommand } = useAstridrWS();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CatalogueEntry[] | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [pending, setPending] = useState(false);
  const [filter, setFilter] = useState("");

  const label = override ?? lastTurnModel ?? "Auto";

  const fetchCatalogue = useCallback(async () => {
    setFetchError(false);
    setEntries(null);
    setFilter("");
    try {
      // Never client-cached across opens -- every open re-fetches, so a
      // new model surfaces without a deploy as soon as the backend's own
      // ~1h TTL (OpenRouterProvider.get_models()) rolls over.
      const ack = await sendCommand({ type: "swap.catalogue", target: "brain" });
      if (ack.status === "ok" && Array.isArray(ack.entries)) {
        setEntries(ack.entries as CatalogueEntry[]);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    }
  }, [sendCommand]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void fetchCatalogue();
  };

  const dispatchSelection = useCallback(
    async (value: string, restore = false) => {
      setPending(true);
      try {
        await sendCommand({
          type: "swap.set",
          target: "brain",
          value: restore ? undefined : value,
          restore,
        });
      } catch (err) {
        console.warn("Failed to dispatch manual brain swap:", err);
      } finally {
        setPending(false);
        setOpen(false);
      }
    },
    [sendCommand]
  );

  const filtered = useMemo(() => {
    if (!entries) return entries;
    const needle = filter.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(
      (e) => e.name.toLowerCase().includes(needle) || e.vendor?.toLowerCase().includes(needle)
    );
  }, [entries, filter]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Choose brain"
          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
            override ? "border-primary/30 bg-primary/10" : "border-border/60 bg-muted/30"
          }`}
        >
          <span className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
            <Brain className="w-4 h-4" aria-hidden="true" />
            BRAIN
          </span>
          <span className="flex items-center gap-1">
            <span
              className={`font-mono text-sm ${
                override ? "text-primary font-semibold" : "text-foreground/90"
              }`}
            >
              {label}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-2">
        <div className="flex flex-col gap-2">
          {override && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              disabled={pending}
              onClick={() => void dispatchSelection("", true)}
            >
              Restore usual brain
            </Button>
          )}

          {entries !== null && !fetchError && entries.length > 0 && (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter brains…"
              aria-label="Filter brain catalogue"
              className="h-8 text-sm"
            />
          )}

          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {entries === null && !fetchError && (
              <div className="flex flex-col gap-1.5 p-1" aria-label="Loading brain catalogue">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            )}
            {fetchError && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Couldn't load the brain catalogue — try again in a moment.
              </p>
            )}
            {entries !== null && entries.length === 0 && !fetchError && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No brains available right now.
              </p>
            )}
            {entries !== null && entries.length > 0 && filtered?.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No brains match "{filter}".
              </p>
            )}
            {filtered?.map((entry) => (
              <button
                key={entry.id}
                type="button"
                disabled={pending}
                onClick={() => void dispatchSelection(entry.id)}
                className="flex w-full flex-col items-start gap-0.5 whitespace-normal break-words rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="font-mono">{entry.name}</span>
                {entry.vendor && (
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    {entry.vendor}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
