/**
 * MicToggle — top-bar mic toggle button (OFF / ON / DISABLED).
 *
 * Three states driven by `enabled` + `status`:
 *   OFF  — enabled=false, any non-error status: Mic icon, transparent bg
 *   ON   — enabled=true,  status=ready:          MicVocal icon, primary/10 bg + glow
 *   DISABLED — status='error-disabled':           MicOff icon, disabled attribute, opacity-40
 *
 * Wrapped in a shadcn Tooltip; the tooltip text differs per state.
 *
 * Pattern source: CrtToggle button shape (DashboardLayout.tsx lines 505-518) +
 *                 EStopButton disabled pattern (EStopButton.tsx lines 39-53).
 * @see 92-PATTERNS.md §MicToggle.tsx (lines 430-472)
 * @see 92-UI-SPEC.md §"Top-Bar Mic Toggle + Listening Indicator"
 */

import { Mic, MicVocal, MicOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { WakeWordStatus } from '@/hooks/useWakeWord';

interface MicToggleProps {
  /** Whether voice mode is currently enabled by the user */
  enabled: boolean;
  /** Current wake-word engine status */
  status: WakeWordStatus;
  /** Error reason string when status is 'error-disabled' */
  errorReason: string | null;
  /** Called with the next boolean value when the toggle is clicked */
  onToggle: (v: boolean) => void;
}

export function MicToggle({ enabled, status, errorReason, onToggle }: MicToggleProps) {
  const isDisabled = status === 'error-disabled';
  const isOn = enabled && !isDisabled;

  // --- Derived values per state ---
  let ariaLabel: string;
  let tooltipText: string;
  let buttonClassName: string;
  let Icon: typeof Mic;

  if (isDisabled) {
    ariaLabel = 'Voice mode unavailable';
    tooltipText = `Voice mode unavailable: ${errorReason ?? 'unknown error'}`;
    buttonClassName =
      'w-9 h-9 rounded-md flex items-center justify-center transition-colors bg-transparent opacity-40 cursor-not-allowed disabled:opacity-40 disabled:cursor-not-allowed';
    Icon = MicOff;
  } else if (isOn) {
    ariaLabel = 'Disable voice mode';
    tooltipText = "Voice mode active — click to disable";
    buttonClassName =
      'w-9 h-9 rounded-md flex items-center justify-center transition-colors bg-primary/10 border border-primary/30 shadow-[var(--glow-xs)]';
    Icon = MicVocal;
  } else {
    ariaLabel = 'Enable voice mode';
    tooltipText = "Voice mode — say ‘Hey Ástríðr’";
    buttonClassName =
      'w-9 h-9 rounded-md flex items-center justify-center transition-colors bg-transparent hover:bg-accent/50';
    Icon = Mic;
  }

  // --- Icon class per state ---
  const iconClassName = isDisabled
    ? 'h-4 w-4 text-muted-foreground'
    : isOn
      ? 'h-4 w-4 text-primary'
      : 'h-4 w-4 text-muted-foreground';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => {
            if (!isDisabled) {
              onToggle(!enabled);
            }
          }}
          disabled={isDisabled}
          aria-label={ariaLabel}
          className={buttonClassName}
        >
          <Icon className={iconClassName} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <p className="text-xs">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
