/**
 * QuickCommandsPanel — panel (g), Phase 188 Plan 12 (D-18).
 *
 * NO-PARALLEL-PATH RULE (186-09): this panel dispatches ONLY the handler
 * props its parent supplies — the exact same handler references
 * `ControlCenterPanel` already receives and wires to `StrictModeToggle` /
 * `FocusModeToggle` / `ShareScreenToggle` / the barge-in interrupt path. It
 * defines no handler logic of its own, issues no WS command, calls no
 * Convex write, and makes no network request of its own. A spoken control
 * verb and a click here must always reach the SAME executor. Introducing a
 * Convex mutation hook, a WS command sender, a browser network call, a
 * Convex query hook, or a generated backend-client reference into this
 * file is a 186-09 rule violation — do not add one, no matter how small.
 *
 * "Stop" is an interrupt (barge-in posture, 183), not a destructive action —
 * no confirmation dialog, matching 183's no-confirm barge-in posture
 * (188-UI-SPEC.md § Copywriting Contract).
 *
 * @see 188-UI-SPEC.md panel table row (g); 188-CONTEXT.md D-13/D-18
 */

import {
  Terminal,
  Lock,
  LockOpen,
  Focus,
  Circle,
  ScreenShare,
  ScreenShareOff,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScreenShareState } from "@/hooks/useScreenShare";

export interface QuickCommandsPanelProps {
  strictMode: boolean;
  onStrictModeChange: (v: boolean) => void;
  focusMode: boolean;
  onFocusModeChange: (v: boolean) => void;
  screenShareState: ScreenShareState;
  onScreenShareStart: () => unknown;
  onScreenShareStop: () => void;
  onStop: () => void;
  className?: string;
}

export function QuickCommandsPanel({
  strictMode,
  onStrictModeChange,
  focusMode,
  onFocusModeChange,
  screenShareState,
  onScreenShareStart,
  onScreenShareStop,
  onStop,
  className,
}: QuickCommandsPanelProps) {
  const sharing = screenShareState === "active";
  const StrictIcon = strictMode ? Lock : LockOpen;
  const FocusIcon = focusMode ? Focus : Circle;
  const ShareIcon = sharing ? ScreenShare : ScreenShareOff;

  return (
    <div
      className={`rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-5 flex flex-col gap-3 min-w-[240px] ${className ?? ""}`}
      data-testid="quick-commands-panel"
    >
      <span className="font-mono text-sm tracking-[0.1em] text-muted-foreground flex items-center gap-2">
        <Terminal className="w-4 h-4" aria-hidden="true" />
        QUICK COMMANDS
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          aria-pressed={strictMode}
          onClick={() => onStrictModeChange(!strictMode)}
        >
          <StrictIcon aria-hidden="true" />
          Strict Mode
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-pressed={focusMode}
          onClick={() => onFocusModeChange(!focusMode)}
        >
          <FocusIcon aria-hidden="true" />
          Focus Mode
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-pressed={sharing}
          onClick={() => (sharing ? onScreenShareStop() : void onScreenShareStart())}
        >
          <ShareIcon aria-hidden="true" />
          Share Screen
        </Button>
        <Button type="button" variant="outline" onClick={onStop}>
          <Square aria-hidden="true" />
          Stop
        </Button>
      </div>
    </div>
  );
}

export default QuickCommandsPanel;
