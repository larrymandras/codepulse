/**
 * StrictModeToggle — top-bar Strict Mode toggle (CONV-02).
 *
 * Controlled component: no internal state, mirrors `MicToggle`'s controlled-
 * prop + Tooltip composition, but renders a shadcn `Switch` (28×16px) with a
 * Lucide `Lock`/`LockOpen` icon (h-3.5 w-3.5) instead of a raw `<button>`.
 *
 * Both the manual click here and a spoken "strict mode on/off" command
 * (VoiceModePanel, 183-03) converge on the single `strictMode` boolean owned
 * by `DashboardLayout` (183-04) — this component is purely presentational.
 *
 * @see 183-PATTERNS.md §"StrictModeToggle.tsx" (MicToggle analog)
 * @see 183-UI-SPEC.md §"Strict Mode control" + §"Copywriting Contract"
 */

import { Lock, LockOpen } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface StrictModeToggleProps {
  /** Whether Strict Mode is currently enabled. */
  enabled: boolean;
  /** Called with the next boolean value when the switch is toggled. */
  onToggle: (v: boolean) => void;
}

export function StrictModeToggle({ enabled, onToggle }: StrictModeToggleProps) {
  const ariaLabel = enabled ? "Disable strict mode" : "Enable strict mode";
  const tooltipText = enabled
    ? "Strict mode — every reply requires 'Hey Ástríðr' again"
    : "Strict mode off — a follow-up within 14s needs no wake word";
  const Icon = enabled ? Lock : LockOpen;
  const iconClassName = enabled
    ? "h-3.5 w-3.5 text-primary"
    : "h-3.5 w-3.5 text-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-center">
          <Icon className={iconClassName} aria-hidden="true" />
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            aria-label={ariaLabel}
            className="ml-1 data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <p className="text-xs">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
