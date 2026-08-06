/**
 * VoiceStatusPanel — panel (f), Phase 188 Plan 12 (D-18).
 *
 * Inline 6-chip voice-state strip bound directly to the same `avatarState`
 * value `Chat.tsx` already computes and passes to `ControlCenterPanel` as
 * `voiceState` (188-UI-SPEC.md panel table row (f)). Renders as an INLINE
 * subpanel — not a separately-bordered box — per UI-SPEC § Open Questions
 * item 2 [DEFAULT: inline]: a second bordered "status" box sitting directly
 * beside `ReadinessPill` would be redundant, since `ReadinessPill` already
 * shows a compact version of this same signal. This default is overridable;
 * it is noted here so a future reader knows it was a deliberate choice, not
 * an oversight.
 *
 * D-08 (engine-agnostic by construction): both ear paths — the 183
 * recognizer and the duplex realtime engine — dispatch these same six
 * reducer states identically, so this strip cannot and must not reveal
 * which one is active. There is no per-engine variant of any chip here;
 * adding a recognizer/duplex/realtime/fallback indicator to this file would
 * violate D-08 and stays out of scope for every future edit, not just this
 * one.
 *
 * Chip colour + once-per-transition `aria-live` pattern copied verbatim from
 * `ReadinessPill.tsx:60-90` (STATE_META map + prevStateRef guard).
 *
 * Takes `state: VoiceState` as its only required prop and holds no state
 * machine of its own — it reads the type only, never the reducer.
 *
 * @see 188-UI-SPEC.md panel table row (f); 188-CONTEXT.md D-08
 */

import { useEffect, useRef, useState } from "react";
import { AudioLines } from "lucide-react";
import type { VoiceState } from "@/components/voice/voiceState";

export interface VoiceStatusPanelProps {
  /** The current avatar/voice state — the exact same value Chat.tsx computes. */
  state: VoiceState;
  /** 188.1-04 (D-04): session-scoped count of finals the plausibility gate
   *  dropped (wake-phrase-only utterances + sub-floor-duration bursts) —
   *  `useAstridrVoice`'s `filteredCount`. Rendered ALWAYS, including at zero
   *  (188.1-UI-SPEC.md Part 5) — never conditionally hidden. */
  filteredCount: number;
  className?: string;
}

const CHIP_ORDER: VoiceState[] = [
  "idle",
  "listening",
  "transcribing",
  "processing",
  "speaking",
  "error-disabled",
];

const STATE_LABELS: Record<VoiceState, string> = {
  idle: "IDLE",
  listening: "LISTENING",
  transcribing: "TRANSCRIBING",
  processing: "PROCESSING",
  speaking: "SPEAKING",
  "error-disabled": "ERROR",
};

const CHIP_BASE =
  "font-mono text-sm tracking-wide px-2 py-1 rounded-full border transition-colors";
const CHIP_ACTIVE = `${CHIP_BASE} bg-primary/10 border-primary/30 text-primary`;
const CHIP_INACTIVE = `${CHIP_BASE} border-transparent text-muted-foreground`;

export function VoiceStatusPanel({ state, filteredCount, className }: VoiceStatusPanelProps) {
  // Fire the aria-live announcement once per transition, not per render
  // (ReadinessPill.tsx:82-90 pattern).
  const [announcement, setAnnouncement] = useState(STATE_LABELS[state]);
  const prevStateRef = useRef<VoiceState>(state);
  useEffect(() => {
    if (prevStateRef.current !== state) {
      prevStateRef.current = state;
      setAnnouncement(STATE_LABELS[state]);
    }
  }, [state]);

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <span className="font-mono text-sm tracking-[0.1em] text-muted-foreground flex items-center gap-2">
        <AudioLines className="w-4 h-4" aria-hidden="true" />
        VOICE STATUS
        {/* 188.1-04 (D-04): the quiet "N FILTERED" disclosure — same flex
            row as the label above, right-aligned via `ml-auto` (the ONE
            utility added beyond the label span's own typography/color
            classes, which are reused byte-identically otherwise). Always
            rendered, including at zero; never inside the aria-live span
            below (188.1-UI-SPEC.md Part 5: [DEFAULT: excluded] — announcing
            every filtered-junk increment would be noisy for a screen-reader
            user in an otherwise-silent feature). text-muted-foreground
            always, never a status-warn/error token: D-03's fail-toward-
            sending posture means a low nonzero count is expected and
            correct, not an alert. */}
        <span className="font-mono text-sm tracking-[0.1em] text-muted-foreground ml-auto">
          {filteredCount} FILTERED
        </span>
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Voice status">
        {CHIP_ORDER.map((chipState) => (
          <span
            key={chipState}
            data-testid={`voice-status-chip-${chipState}`}
            className={chipState === state ? CHIP_ACTIVE : CHIP_INACTIVE}
          >
            {STATE_LABELS[chipState]}
          </span>
        ))}
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}

export default VoiceStatusPanel;
