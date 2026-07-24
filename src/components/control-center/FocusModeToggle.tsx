/**
 * FocusModeToggle — control-center Focus Mode toggle (D-04, GOV-01).
 *
 * Exact structural clone of `StrictModeToggle`: controlled component (no
 * internal state), shadcn `Switch` (28×16px) + Lucide icon pair + `Tooltip`.
 * Both this manual click and the "focus mode on/off" spoken verb (Plan 03's
 * `focus_mode.py`) converge on the single server-persisted `proactive-prefs`
 * `focus_mode` boolean owned by `ControlCenterPanel` — this component is
 * purely presentational.
 *
 * @see 186-UI-SPEC.md "Control Center (D-17)" + "Copywriting Contract"
 * @see codepulse/src/components/voice/StrictModeToggle.tsx (clone target)
 */

import { Focus, Circle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface FocusModeToggleProps {
  /** Whether Focus Mode is currently enabled. */
  enabled: boolean;
  /** Called with the next boolean value when the switch is toggled. */
  onToggle: (v: boolean) => void;
}

export function FocusModeToggle({ enabled, onToggle }: FocusModeToggleProps) {
  const ariaLabel = enabled ? "Disable focus mode" : "Enable focus mode";
  const tooltipText = enabled
    ? "Focus mode — non-urgent updates are held until you exit"
    : "Focus mode off — updates come through as they happen";
  // 186-UI-SPEC Open Question 1 [DEFAULT]: `Focus` (ON) vs a neutral outline
  // glyph (OFF) — `Circle` reads distinctly next to Lock/LockOpen two pills
  // over and never collides visually with StrictModeToggle's icon pair.
  const Icon = enabled ? Focus : Circle;
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
