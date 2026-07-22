/**
 * SwapBadge — top-bar READ-ONLY indicator for the active brain (always) and
 * an active voice hot-swap (SWAP-01/SWAP-02, D-04/D-16).
 *
 * A forgotten swap must never be invisible: unlike StrictModeToggle/
 * ShareScreenToggle (both controlled TOGGLES the user can flip from here),
 * this component has no Switch/button — brain/voice swaps only happen via a
 * spoken/typed command (useAstridrVoice.ts's swap fast-path or a model-emitted
 * `[CTRL:swap_*]` tag), never a click here. It purely DISPLAYS the current
 * in-memory swap state (Chat.tsx seeds it via `swap.get_state` on mount and
 * keeps it live via the `swap.state` push).
 *
 * The BRAIN pill is persistent (185-08 request): with no override it shows
 * "Brain: Auto" in muted styling — honest, because the unswapped brain is
 * task-category routing that varies per turn, not one fixed model. An active
 * override flips it to accent styling with the pinned model name. The VOICE
 * pill stays swap-only (per-persona defaults make an idle voice pill noise).
 * Swap state is runtime-only (Pitfall 6) — an override pill resets to Auto
 * on every backend restart.
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
  /**
   * The resolved model of the last completed turn (from run.completed's
   * `model` field, 185-08). Shown muted when no override is pinned, so the
   * pill reads what actually answered instead of the "Auto" umbrella.
   */
  lastModel?: string | null;
}

export function SwapBadge({ modelOverride, voiceOverride, lastModel }: SwapBadgeProps) {
  const brainLabel = modelOverride ?? lastModel ?? "Auto";
  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={
              modelOverride
                ? "gap-1 border-primary/30 bg-primary/10 text-primary font-mono text-[10px] tracking-wide"
                : "gap-1 border-border bg-muted/30 text-muted-foreground font-mono text-[10px] tracking-wide"
            }
          >
            <Brain className="h-3 w-3" aria-hidden="true" />
            Brain: {brainLabel}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          <p className="text-xs">
            {modelOverride
              ? `Running on ${modelOverride} instead of her usual brain — say
              "switch back to your usual brain" to restore.`
              : lastModel
                ? `Last reply ran on ${lastModel}, picked by adaptive routing. Say "try on grok" (or another model) to pin one.`
                : 'Adaptive routing — her brain is picked per task. Say "try on grok" (or another model) to pin one.'}
          </p>
        </TooltipContent>
      </Tooltip>
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
