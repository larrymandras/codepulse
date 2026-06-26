/**
 * src/__mocks__/livekit-client.ts
 *
 * Manual mock for livekit-client (Phase 90 — Agent Room / War Room).
 * Provides deterministic Room / RoomEvent / Track / ConnectionState stubs
 * so War Room tests run in jsdom without WebRTC.
 *
 * Usage in test files:
 *   vi.mock('livekit-client');
 *
 * The matching vi.mock registration in src/test/setup.ts uses an inline factory
 * (same structure) so this file is the canonical reference / Plan-04 source of truth.
 */

import { vi } from 'vitest';

export const ConnectionState = {
  Disconnected: 'Disconnected',
  Connecting: 'Connecting',
  Connected: 'Connected',
  Reconnecting: 'Reconnecting',
  SignalReconnecting: 'SignalReconnecting',
} as const;

export const RoomEvent = {
  ConnectionStateChanged: 'connectionStateChanged',
  TrackSubscribed: 'trackSubscribed',
  TrackUnsubscribed: 'trackUnsubscribed',
  Disconnected: 'disconnected',
} as const;

export const Track = { Kind: { Audio: 'audio', Video: 'video' } } as const;

export class Room {
  connect = vi.fn(() => Promise.resolve());
  disconnect = vi.fn(() => Promise.resolve());
  localParticipant = {
    setMicrophoneEnabled: vi.fn(() => Promise.resolve()),
  };
  private _listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  on(event: string, handler: (...args: unknown[]) => void) {
    (this._listeners[event] ??= []).push(handler);
    return this;
  }

  off = vi.fn();

  /** Test helper: simulate a LiveKit event emission. */
  emit(event: string, ...args: unknown[]) {
    this._listeners[event]?.forEach(h => h(...args));
  }
}
