/**
 * __mocks__/livekit-client.ts  (project root — adjacent to node_modules)
 *
 * Manual mock for livekit-client consumed by Vitest when a test calls
 * `vi.mock('livekit-client')` without a factory.  Must live at the ROOT
 * of the project (not inside src/) for Vitest to discover it as a package
 * mock — see Vitest docs on manual mocks for Node modules.
 *
 * Room is a vi.fn() with mockImplementation so:
 *   - Room.mock.instances tracks every `new Room()` call (required by
 *     T-90-MIC and ROOM-03 test assertions)
 *   - Each instance has connect / disconnect / localParticipant.setMicrophoneEnabled
 *     as vi.fn() stubs
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Room = vi.fn().mockImplementation(function(this: any) {
  this.connect = vi.fn(() => Promise.resolve());
  this.disconnect = vi.fn(() => Promise.resolve());
  this.localParticipant = {
    setMicrophoneEnabled: vi.fn(() => Promise.resolve()),
  };
  this._listeners = {} as Record<string, ((...args: unknown[]) => void)[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  this.on = function(this: any, event: string, handler: (...args: unknown[]) => void) {
    (this._listeners[event] ??= []).push(handler);
    return this;
  };
  this.off = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  this.emit = function(this: any, event: string, ...args: unknown[]) {
    (this._listeners[event] ?? []).forEach((h: (...a: unknown[]) => void) => h(...args));
  };
});
