/**
 * SwapBadge — top-bar READ-ONLY indicator for an active brain/voice hot-swap
 * (SWAP-01/SWAP-02, D-04/D-16).
 *
 * A forgotten swap must never be invisible: unlike StrictModeToggle/
 * ShareScreenToggle (both controlled TOGGLES the user can flip from here),
 * this component has no Switch/button — brain/voice swaps only happen via a
 * spoken/typed command (useAstridrVoice.ts's swap fast-path or a model-emitted
 * `[CTRL:swap_*]` tag), never a click here. It purely DISPLAYS the current
 * in-memory swap state (Chat.tsx seeds it via `swap.get_state` on mount and
 * keeps it live via the `swap.state` push) and renders nothing at all when
 * both brain and voice are at their default (Pitfall 6: this state is
 * runtime-only — it resets to null/hidden on every backend restart).
 *
 * @see 185-07-PLAN.md
 * @see codepulse/src/components/voice/StrictModeToggle.tsx (Tooltip + token-class template)
 */

import { Brain, AudioLines } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SwapBadgeProps {
  /** The active non-default model/brain name, or null/undefined at default. */
  modelOverride?: string | null;
  /** The active non-default voice name, or null/undefined at default. */
  voiceOverride?: string | null;
}

export function SwapBadge({ modelOverride, voiceOverride }: SwapBadgeProps) {
  if (!modelOverride && !voiceOverride) return null;

  return (
    <div className="flex items-center gap-1.5">
      {modelOverride && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 bg-primary/10 text-primary font-mono text-[10px] tracking-wide"
            >
              <Brain className="h-3 w-3" aria-hidden="true" />
              Brain: {modelOverride}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <p className="text-xs">
              Running on {modelOverride} instead of her usual brain — say
              "switch back to your usual brain" to restore.
            </p>
          </TooltipContent>
        </Tooltip>
      )}
      {voiceOverride && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 bg-primary/10 text-primary font-mono text-[10px] tracking-wide"
            >
              <AudioLines className="h-3 w-3" aria-hidden="true" />
              Voice: {voiceOverride}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <p className="text-xs">
              Speaking as {voiceOverride} instead of her usual voice — say
              "switch back to your usual voice" to restore.
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
