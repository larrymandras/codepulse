/**
 * VoiceControl — read + write voice selector for the control center (D-17,
 * plan 186-09). Same pattern as `BrainControl.tsx`, sourced from the live
 * ElevenLabs voice catalogue (`swap.catalogue` {target:"voice"}).
 *
 * Unlike `SwapBadge`'s voice pill (hidden entirely until a swap is active),
 * this row is ALWAYS visible — UI-SPEC's explicit "so Larry can see 'what
 * voices exist' per his verbatim ask, not just when one is already active."
 * `ControlCenterPanel.tsx` mounts this unconditionally where it previously
 * only rendered a VOICE box when `swapVoiceOverride` was truthy.
 *
 * Selecting an entry (or "Restore usual voice" when an override is active)
 * dispatches `swap.set` — the SAME `swap_voice` `ControlVerb.execute` a
 * spoken "switch your voice to X" resolves to, never a parallel path.
 *
 * CHECKPOINT ROUND 1 (Larry, live screenshots — see 186-09-SUMMARY.md
 * "Deviations"): widened popover (`w-64` -> `w-96`) + rows switched to a
 * wrapping `<button>` so ElevenLabs' long descriptive names ("Roger -
 * Laid-Back, Casual, Resonant") wrap gracefully instead of ellipsizing, and
 * a type-to-filter `Input` was added (backend now sorts entries
 * alphabetically too).
 *
 * @see 186-UI-SPEC.md "Control Center (D-17)" — VoiceControl row
 * @see codepulse/src/components/control-center/BrainControl.tsx (identical pattern)
 *
 * `variant="chip"` (188-14 live finding, compact control strip): same
 * trigger-only visual swap as `BrainControl`'s `variant="chip"` — see its
 * docstring.
 */

import { useCallback, useMemo, useState } from "react";
import { AudioLines, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import type { CatalogueEntry } from "./BrainControl";

export interface VoiceControlProps {
  /** The active voice override name, or null/undefined at default (Auto). */
  override?: string | null;
  /** Trigger visual: full labeled row (default, calm layout) or a compact
   * icon+value chip (command-center strip). Popover/dispatch logic is
   * identical in both. */
  variant?: "row" | "chip";
}

export function VoiceControl({ override, variant = "row" }: VoiceControlProps) {
  const { sendCommand } = useAstridrWS();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CatalogueEntry[] | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [pending, setPending] = useState(false);
  const [filter, setFilter] = useState("");

  const label = override ?? "Auto";

  const fetchCatalogue = useCallback(async () => {
    setFetchError(false);
    setEntries(null);
    setFilter("");
    try {
      // Never client-cached across opens -- same TTL-refetch contract as
      // BrainControl.tsx.
      const ack = await sendCommand({ type: "swap.catalogue", target: "voice" });
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
          target: "voice",
          value: restore ? undefined : value,
          restore,
        });
      } catch (err) {
        console.warn("Failed to dispatch manual voice swap:", err);
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
    return entries.filter((e) => e.name.toLowerCase().includes(needle));
  }, [entries, filter]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {variant === "chip" ? (
          <button
            type="button"
            aria-label="Choose voice"
            title="Voice"
            className={`flex items-center gap-1.5 h-7 px-2 rounded-md border font-mono text-sm whitespace-nowrap ${
              override
                ? "border-primary/30 bg-primary/10 text-primary font-semibold"
                : "border-border/60 bg-muted/30 text-foreground/90"
            }`}
          >
            <AudioLines className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {label}
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Choose voice"
            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
              override ? "border-primary/30 bg-primary/10" : "border-border/60 bg-muted/30"
            }`}
          >
            <span className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
              <AudioLines className="w-4 h-4" aria-hidden="true" />
              VOICE
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
        )}
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
              Restore usual voice
            </Button>
          )}

          {entries !== null && !fetchError && entries.length > 0 && (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter voices…"
              aria-label="Filter voice catalogue"
              className="h-8 text-sm"
            />
          )}

          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {entries === null && !fetchError && (
              <div className="flex flex-col gap-1.5 p-1" aria-label="Loading voice catalogue">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            )}
            {fetchError && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Couldn't load the voice catalogue — try again in a moment.
              </p>
            )}
            {entries !== null && entries.length === 0 && !fetchError && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No voices available right now.
              </p>
            )}
            {entries !== null && entries.length > 0 && filtered?.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No voices match "{filter}".
              </p>
            )}
            {filtered?.map((entry) => (
              <button
                key={entry.id}
                type="button"
                disabled={pending}
                onClick={() => void dispatchSelection(entry.id)}
                className="flex w-full items-start whitespace-normal break-words rounded-md px-2 py-1.5 text-left font-mono text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                {entry.name}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
