/**
 * CompactControlStrip — single-row, ~44px control strip for command-center
 * mode only (188-14 live finding, mockup: "Compact Control Strip — Direction
 * Mockup"). Same five controls as `ControlCenterPanel` (Brain, Voice, Strict
 * Mode, Focus Mode, Share Screen) and the same click targets, laid out as
 * one dense row of chips/icon buttons instead of five stacked labeled rows
 * — Control Center's ~230px stacked height was crowding Voice Status +
 * the rest of the center column out of the viewport in grid mode.
 *
 * NO-PARALLEL-PATH (186-09 rule, see `QuickCommandsPanel.tsx`): the Brain/
 * Voice chips ARE `BrainControl`/`VoiceControl` rendered with
 * `variant="chip"` — a trigger-only visual change, their `swap.catalogue`/
 * `swap.set` popover logic is untouched. The Strict/Focus/Share icon
 * buttons dispatch the SAME `onStrictModeChange` / `onFocusModeChange` /
 * `onScreenShareStart` / `onScreenShareStop` callbacks `ControlCenterPanel`
 * and `QuickCommandsPanel` already use — this component defines no handler
 * logic and issues no WS command of its own. Focus mode reads/writes
 * through the same shared `useProactivePrefs()` hook every other
 * command-center consumer uses (188-13).
 *
 * The calm-layout `ControlCenterPanel` (Larry's already-approved, more
 * legible stacked layout) is untouched — this is a second, purpose-built
 * component mounted only when `commandCenter` is true (`Chat.tsx`
 * centerColumn).
 */

import { Lock, LockOpen, Focus, Circle, ScreenShare, ScreenShareOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrainControl } from "./BrainControl";
import { VoiceControl } from "./VoiceControl";
import { useProactivePrefs } from "@/hooks/useProactivePrefs";
import type { ScreenShareState } from "@/hooks/useScreenShare";

export interface CompactControlStripProps {
  swapModelOverride: string | null;
  swapVoiceOverride: string | null;
  lastTurnModel: string | null;
  strictMode: boolean;
  onStrictModeChange: (v: boolean) => void;
  screenShareState: ScreenShareState;
  onScreenShareStart: () => unknown;
  onScreenShareStop: () => void;
}

export function CompactControlStrip({
  swapModelOverride,
  swapVoiceOverride,
  lastTurnModel,
  strictMode,
  onStrictModeChange,
  screenShareState,
  onScreenShareStart,
  onScreenShareStop,
}: CompactControlStripProps) {
  // Same shared hook ControlCenterPanel and QuickCommandsContainer already
  // use — one server-persisted focus_mode boolean, never a second copy.
  const { prefs, onFocusModeChange } = useProactivePrefs();

  const sharing = screenShareState === "active";
  const StrictIcon = strictMode ? Lock : LockOpen;
  const FocusIcon = prefs.focus_mode ? Focus : Circle;
  const ShareIcon = sharing ? ScreenShare : ScreenShareOff;

  return (
    <div
      className="flex items-center gap-1.5 h-11 px-2.5 rounded-xl border border-border/50 bg-card/60 backdrop-blur-md"
      data-testid="compact-control-strip"
    >
      <BrainControl variant="chip" override={swapModelOverride} lastTurnModel={lastTurnModel} />
      <VoiceControl variant="chip" override={swapVoiceOverride} />

      <div className="w-px h-5 bg-border/60 mx-0.5 shrink-0" aria-hidden="true" />

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title={
          strictMode
            ? "Strict mode — every reply requires 'Hey Ástríðr' again"
            : "Strict mode off — a follow-up within 14s needs no wake word"
        }
        aria-label={strictMode ? "Disable strict mode" : "Enable strict mode"}
        aria-pressed={strictMode}
        onClick={() => onStrictModeChange(!strictMode)}
        className={strictMode ? "text-primary border-primary/30 bg-primary/10" : "text-muted-foreground"}
      >
        <StrictIcon aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title={
          prefs.focus_mode
            ? "Focus mode — non-urgent updates are held until you exit"
            : "Focus mode off — updates come through as they happen"
        }
        aria-label={prefs.focus_mode ? "Disable focus mode" : "Enable focus mode"}
        aria-pressed={prefs.focus_mode}
        onClick={() => onFocusModeChange(!prefs.focus_mode)}
        className={prefs.focus_mode ? "text-primary border-primary/30 bg-primary/10" : "text-muted-foreground"}
      >
        <FocusIcon aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title={sharing ? "Sharing your screen — click to stop" : "Share your screen so I can see it"}
        aria-label={sharing ? "Stop sharing your screen" : "Share your screen"}
        aria-pressed={sharing}
        onClick={() => (sharing ? onScreenShareStop() : void onScreenShareStart())}
        className={
          sharing ? "text-(--status-ok) border-(--status-ok)/30 bg-(--status-ok)/10" : "text-muted-foreground"
        }
      >
        <ShareIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

export default CompactControlStrip;
