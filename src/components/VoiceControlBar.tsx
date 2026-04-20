/**
 * VoiceControlBar — Bottom-docked voice controls for War Room detail view.
 *
 * Pre-join state: shows "Join Voice" CTA button.
 * Joined state: slides up with mute toggle + leave (3s confirm) controls.
 *
 * Phase 72, Plan 03: D-02
 */

import { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff } from "lucide-react";

export interface VoiceControlBarProps {
  isJoined: boolean;
  isMuted: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
}

export function VoiceControlBar({
  isJoined,
  isMuted,
  onJoin,
  onLeave,
  onToggleMute,
}: VoiceControlBarProps) {
  const shouldReduce = useReducedMotion();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleLeave() {
    if (!confirmLeave) {
      setConfirmLeave(true);
      confirmTimerRef.current = setTimeout(() => setConfirmLeave(false), 3000);
      return;
    }
    clearTimeout(confirmTimerRef.current);
    onLeave();
  }

  // Cleanup on unmount
  useEffect(() => () => { clearTimeout(confirmTimerRef.current); }, []);

  // Reset confirm state when leaving
  useEffect(() => {
    if (!isJoined) setConfirmLeave(false);
  }, [isJoined]);

  if (!isJoined) {
    return (
      <div className="h-16 px-6 flex items-center justify-center border-t border-(--border)">
        <Button onClick={onJoin}>Join Voice</Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={shouldReduce ? {} : { y: 64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={shouldReduce ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
      className="h-16 px-6 flex items-center justify-between border-t border-(--border) bg-(--card)/80 backdrop-blur-sm"
    >
      {/* Mute toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        onClick={onToggleMute}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
      >
        {isMuted ? <MicOff /> : <Mic />}
      </Button>

      {/* Leave button with 3s confirm */}
      <Button
        variant="destructive"
        onClick={handleLeave}
        aria-label="Leave voice session"
      >
        <PhoneOff className="h-4 w-4 mr-2" />
        {confirmLeave ? "Confirm Leave" : "Leave"}
      </Button>
    </motion.div>
  );
}
