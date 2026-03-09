import { useEffect, useRef, useCallback } from "react";
import {
  useAmbient,
  type AlertType,
  type EventType,
} from "../contexts/AmbientContext";

// Custom event name used across the app
const AUDIO_EVENT = "codepulse:audio-event";

interface AudioEventDetail {
  category: "alert" | "event";
  type: string;
}

/** Dispatch an audio event from anywhere in the app */
export function dispatchAudioEvent(
  category: "alert" | "event",
  type: string,
) {
  window.dispatchEvent(
    new CustomEvent<AudioEventDetail>(AUDIO_EVENT, {
      detail: { category, type },
    }),
  );
}

// Map of event type strings to their audio function names
const ALERT_MAP: Record<string, AlertType> = {
  approval_required: "approval",
  escalation: "escalation",
  healing_failed: "healingFailed",
  context_overflow: "contextOverflow",
  security_alert: "securityPing",
  error_spike: "errorSpike",
  error: "errorSpike",
};

const EVENT_MAP: Record<string, EventType> = {
  tool_use: "toolTick",
  tool_call: "toolTick",
  agent_spawn: "agentSpawn",
  agent_complete: "agentComplete",
  compaction: "compaction",
  memory_flush: "flush",
  failover: "failover",
  tool_discovered: "toolDiscovered",
};

/**
 * Hook that listens for custom audio events and plays the appropriate sound.
 * Call this once near the top of the component tree (e.g., in DashboardLayout).
 */
export function useAudioEvents(): void {
  const { playAlert, playEvent, enabled } = useAmbient();
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const handleEvent = useCallback(
    (e: Event) => {
      if (!enabledRef.current) return;
      const { category, type } = (e as CustomEvent<AudioEventDetail>).detail;

      if (category === "alert" && ALERT_MAP[type]) {
        playAlert(ALERT_MAP[type]);
      } else if (category === "event" && EVENT_MAP[type]) {
        playEvent(EVENT_MAP[type]);
      }
    },
    [playAlert, playEvent],
  );

  useEffect(() => {
    window.addEventListener(AUDIO_EVENT, handleEvent);
    return () => window.removeEventListener(AUDIO_EVENT, handleEvent);
  }, [handleEvent]);
}
