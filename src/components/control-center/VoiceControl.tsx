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
 * @see 186-UI-SPEC.md "Control Center (D-17)" — VoiceControl row
 * @see codepulse/src/components/control-center/BrainControl.tsx (identical pattern)
 */

import { useCallback, useState } from "react";
import { AudioLines, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import type { CatalogueEntry } from "./BrainControl";

export interface VoiceControlProps {
  /** The active voice override name, or null/undefined at default (Auto). */
  override?: string | null;
}

export function VoiceControl({ override }: VoiceControlProps) {
  const { sendCommand } = useAstridrWS();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CatalogueEntry[] | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [pending, setPending] = useState(false);

  const label = override ?? "Auto";

  const fetchCatalogue = useCallback(async () => {
    setFetchError(false);
    setEntries(null);
    try {
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

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
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
          {entries?.map((entry) => (
            <Button
              key={entry.id}
              variant="ghost"
              size="sm"
              className="justify-start"
              disabled={pending}
              onClick={() => void dispatchSelection(entry.id)}
            >
              <span className="truncate">{entry.name}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
