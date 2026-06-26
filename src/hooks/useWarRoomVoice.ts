/**
 * useWarRoomVoice — LiveKit voice hook for the War Room page (Phase 90).
 *
 * SKELETON ONLY — join / leave / toggleMute reject with "not implemented".
 * Real implementation ships in Plan 04.
 *
 * This file exists so:
 *   1. Import paths in downstream tests resolve (no transform error).
 *   2. TypeScript has the full interface contract to validate against.
 *   3. RED tests can assert on join/muted/toggle behavior that the skeleton
 *      does not yet provide.
 *
 * Contract (from 90-RESEARCH Pattern 2):
 *   - connectionState starts as 'disconnected'
 *   - isMuted starts as false
 *   - join(roomName): fetches POST /api/war-room/{room}/token with Bearer auth,
 *     then connects Room. Does NOT enable mic on join (D-03, T-90-MIC).
 *   - leave(): disconnects and cleans up audio elements.
 *   - toggleMute(): calls room.localParticipant.setMicrophoneEnabled().
 */

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface UseWarRoomVoiceReturn {
  connectionState: VoiceConnectionState;
  isMuted: boolean;
  join: (roomName: string) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWarRoomVoice(): UseWarRoomVoiceReturn {
  const [connectionState] =
    useState<VoiceConnectionState>('disconnected');
  const [isMuted] = useState(false);

  const join = async (_roomName: string): Promise<void> => {
    throw new Error('useWarRoomVoice.join: not implemented (Plan 04)');
  };

  const leave = async (): Promise<void> => {
    throw new Error('useWarRoomVoice.leave: not implemented (Plan 04)');
  };

  const toggleMute = async (): Promise<void> => {
    throw new Error('useWarRoomVoice.toggleMute: not implemented (Plan 04)');
  };

  return { connectionState, isMuted, join, leave, toggleMute };
}
