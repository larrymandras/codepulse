/**
 * useWarRoomVoice — LiveKit voice hook for the War Room page (Phase 90).
 *
 * Lifecycle:
 *   - Room object created on mount so toggleMute() can reach localParticipant
 *     before join() is called (required by ROOM-03 test contract).
 *   - join(roomName): fetches POST /api/war-room/{room}/token with Bearer auth
 *     (T-90-AUTH), then calls room.connect() WITHOUT enabling the mic (D-03 /
 *     T-90-MIC — join muted). Token is never logged (T-90-TOK).
 *   - leave(): disconnects and clears any attached audio elements.
 *   - toggleMute(): toggles the LiveKit mic and updates isMuted state.
 *   - Unmount cleanup disconnects the room.
 *
 * Auth: uses authHeaders() + astridrApiBase() from @/lib/astridrApi per CLAUDE.md.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';
import { authHeaders, astridrApiBase } from '@/lib/astridrApi';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapConnectionState(state: ConnectionState): VoiceConnectionState {
  switch (state) {
    case ConnectionState.Connecting:
      return 'connecting';
    case ConnectionState.Connected:
      return 'connected';
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      return 'reconnecting';
    case ConnectionState.Disconnected:
    default:
      return 'disconnected';
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWarRoomVoice(): UseWarRoomVoiceReturn {
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>('disconnected');
  const [isMuted, setIsMuted] = useState(false);

  // Store Room in a ref (never state) — avoids spurious re-renders from LiveKit
  // object identity changes (Anti-pattern from 90-RESEARCH).
  const roomRef = useRef<Room | null>(null);

  // Accumulate audio elements for cleanup on Disconnected / leave.
  const audioElsRef = useRef<HTMLAudioElement[]>([]);

  // Create the Room eagerly on mount so toggleMute() and toggleMute tests can
  // reach localParticipant even before join() is called. connect() is only
  // called inside join().
  useEffect(() => {
    const room = new Room({ adaptiveStream: true, dynacast: true });

    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      setConnectionState(mapConnectionState(state));
    });

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        document.body.appendChild(el);
        audioElsRef.current.push(el as HTMLAudioElement);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
    });

    room.on(RoomEvent.Disconnected, () => {
      audioElsRef.current.forEach(el => el.remove());
      audioElsRef.current = [];
    });

    roomRef.current = room;

    return () => {
      void room.disconnect();
    };
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Fetch a join token from the Ástríðr backend (T-90-AUTH), then connect the
   * LiveKit Room WITHOUT enabling the microphone (D-03 / T-90-MIC: join muted).
   *
   * Gate: no-op if not currently disconnected (prevents double-connect on rapid
   * clicks — Anti-pattern N5 from 90-PATTERNS).
   */
  const join = useCallback(async (roomName: string): Promise<void> => {
    if (connectionState !== 'disconnected') return;

    setConnectionState('connecting');

    try {
      // T-90-AUTH: fetch token with Authorization: Bearer via authHeaders().
      const res = await fetch(
        `${astridrApiBase()}/api/war-room/${encodeURIComponent(roomName)}/token`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ identity: 'operator' }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error((err as { detail?: string }).detail ?? `Token fetch failed: ${res.status}`);
      }

      // T-90-TOK: destructure token to use but never log it.
      const { token, url } = (await res.json()) as { token: string; url: string };

      if (roomRef.current) {
        await roomRef.current.connect(url, token);
        // D-03 / T-90-MIC: join muted — do NOT call setMicrophoneEnabled(true).
        // The operator explicitly unmutes via toggleMute().
        setIsMuted(true);
      }
    } catch {
      setConnectionState('failed');
    }
  }, [connectionState]);

  /**
   * Disconnect from the room and clean up all attached audio elements.
   * Also called by the unmount effect and on room change in WarRoom.tsx.
   */
  const leave = useCallback(async (): Promise<void> => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
    }
    audioElsRef.current.forEach(el => el.remove());
    audioElsRef.current = [];
    setConnectionState('disconnected');
    setIsMuted(false);
  }, []);

  /**
   * Toggle the operator's microphone.
   *
   * setMicrophoneEnabled(true)  → mic on  (not muted)
   * setMicrophoneEnabled(false) → mic off (muted)
   *
   * When isMuted=true (currently muted), we enable the mic (pass true).
   * When isMuted=false (currently active), we disable the mic (pass false).
   * Hence setMicrophoneEnabled(isMuted) is the correct argument.
   */
  const toggleMute = useCallback(async (): Promise<void> => {
    const newMuted = !isMuted;
    if (roomRef.current) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(isMuted);
    }
    setIsMuted(newMuted);
  }, [isMuted]);

  return { connectionState, isMuted, join, leave, toggleMute };
}
