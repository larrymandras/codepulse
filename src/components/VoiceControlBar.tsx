/**
 * VoiceControlBar — Bottom-docked voice controls for War Room detail view.
 *
 * Pre-join state: shows "Join Voice" CTA + "You'll join muted" sub-label (Surface B).
 * Joined state: slides up with Surface A connection-state indicator (left region),
 *   mute toggle (amber for first 5 s, Surface B), and leave / confirm leave.
 *
 * Phase 72 Plan 03 original; extended in Phase 90 Plan 04 (ROOM-03).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Loader2, AlertCircle } from "lucide-react";

export interface VoiceControlBarProps {
  isJoined: boolean;
  isMuted: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  /** Live connection state while joined. Undefined = connected (backward compat). */
  connectionState?: "connecting" | "connected" | "reconnecting" | "failed";
  /** Called when user clicks "Retry Connection" in the failed state. */
  onRetry?: () => void;
}

export function VoiceControlBar({
  isJoined,
  isMuted,
  onJoin,
  onLeave,
  onToggleMute,
  connectionState,
  onRetry,
}: VoiceControlBarProps) {
  const shouldReduce = useReducedMotion();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Surface B: amber muted-highlight for the first 5 s after joining.
  const [showMutedHint, setShowMutedHint] = useState(false);
  const mutedHintTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Start / reset the 5-second muted-hint timer whenever join state changes.
  useEffect(() => {
    if (isJoined) {
      setShowMutedHint(true);
      mutedHintTimerRef.current = setTimeout(() => setShowMutedHint(false), 5000);
    } else {
      clearTimeout(mutedHintTimerRef.current);
      setShowMutedHint(false);
    }
    return () => clearTimeout(mutedHintTimerRef.current);
  }, [isJoined]);

  // Clean up on unmount.
  useEffect(() => () => {
    clearTimeout(confirmTimerRef.current);
    clearTimeout(mutedHintTimerRef.current);
  }, []);

  // Reset confirm state when leaving.
  useEffect(() => {
    if (!isJoined) setConfirmLeave(false);
  }, [isJoined]);

  function handleLeave() {
    if (!confirmLeave) {
      setConfirmLeave(true);
      confirmTimerRef.current = setTimeout(() => setConfirmLeave(false), 3000);
      return;
    }
    clearTimeout(confirmTimerRef.current);
    onLeave();
  }

  // Clear the muted hint on first toggle interaction (Surface B spec).
  const handleToggleMute = useCallback(() => {
    setShowMutedHint(false);
    clearTimeout(mutedHintTimerRef.current);
    onToggleMute();
  }, [onToggleMute]);

  // Controls disabled during connecting or failed states.
  const controlsDisabled =
    connectionState === "connecting" || connectionState === "failed";
  const disabledCls = controlsDisabled ? "opacity-50 pointer-events-none" : "";

  // Pre-join state.
  if (!isJoined) {
    return (
      <div className="h-16 px-6 flex flex-col items-center justify-center gap-1 border-t border-(--border)">
        <Button onClick={onJoin}>Join Voice</Button>
        {/* Surface B pre-join sub-label */}
        <p className="text-sm text-muted-foreground">You&apos;ll join muted</p>
      </div>
    );
  }

  // ── Surface A: connection-state indicator ────────────────────────────────────
  const effectiveState = connectionState ?? "connected";

  function ConnectionStateIndicator() {
    switch (effectiveState) {
      case "connecting":
        return (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            {shouldReduce ? (
              <Loader2 className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Connecting to voice…
          </div>
        );

      case "reconnecting":
        return (
          <div className="flex items-center gap-2 text-sm">
            <span
              className={
                shouldReduce
                  ? "w-2 h-2 rounded-full bg-(--status-warn)"
                  : "w-2 h-2 rounded-full bg-(--status-warn) animate-pulse"
              }
            />
            <span className="text-muted-foreground">Reconnecting…</span>
          </div>
        );

      case "failed":
        return (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-(--status-error)" />
            <span className="text-(--status-error)">
              Connection failed — check your network and try again
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-7 px-2 text-xs"
              onClick={() => onRetry?.()}
            >
              Retry Connection
            </Button>
          </div>
        );

      case "connected":
      default:
        return (
          <span className="w-2 h-2 rounded-full bg-(--status-ok)" aria-label="Connected" />
        );
    }
  }

  // ── Mute icon color (Surface B post-join) ────────────────────────────────────
  // First 5 s: amber MicOff to signal "you're muted".
  // After 5 s: standard colors (amber MicOff → foreground MicOff, or status-ok Mic).
  const muteIconCls = isMuted
    ? showMutedHint
      ? "text-(--status-warn)"
      : "" // default foreground
    : "text-(--status-ok)";

  return (
    <motion.div
      initial={shouldReduce ? {} : { y: 64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={shouldReduce ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
      className="h-16 px-6 flex items-center justify-between border-t border-(--border) bg-(--card)/80 backdrop-blur-sm"
    >
      {/* Surface A: connection state (left flex-1 region) */}
      <div className="flex-1 flex items-center">
        <ConnectionStateIndicator />
      </div>

      {/* Mute toggle */}
      <Button
        variant="ghost"
        size="icon"
        className={`h-11 w-11 ${muteIconCls} ${disabledCls}`}
        onClick={handleToggleMute}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        title={showMutedHint && isMuted ? "Click to unmute" : undefined}
        disabled={controlsDisabled}
      >
        {isMuted ? <MicOff /> : <Mic />}
      </Button>

      {/* Leave button with 3-second inline confirm (Copywriting Contract) */}
      <Button
        variant="destructive"
        onClick={handleLeave}
        className={disabledCls}
        disabled={controlsDisabled}
        aria-label="Leave voice session"
      >
        <PhoneOff className="h-4 w-4 mr-2" />
        {confirmLeave ? "Confirm Leave" : "Leave Room"}
      </Button>
    </motion.div>
  );
}
