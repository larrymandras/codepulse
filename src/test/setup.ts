import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Voice browser-API stubs — Phase 92 (Voice-Activated Command Palette)
// Each stub guards with an "only install if undefined" check to avoid
// clobbering any real jsdom implementation.
// ---------------------------------------------------------------------------

// 1. SpeechRecognition / webkitSpeechRecognition
//    Needed by useSpeechRecognition and downstream voice hook tests.
if (typeof window !== 'undefined' && !window.SpeechRecognition && !window.webkitSpeechRecognition) {
  const mockRecognitionInstance = {
    continuous: false,
    interimResults: false,
    lang: '',
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    onresult: null as ((event: unknown) => void) | null,
    onend: null as (() => void) | null,
    onerror: null as ((event: unknown) => void) | null,
  };
  const SpeechRecognitionMock = vi.fn(() => mockRecognitionInstance);
  // @ts-expect-error — jsdom does not define SpeechRecognition
  window.SpeechRecognition = SpeechRecognitionMock;
  // @ts-expect-error — webkit prefix for Safari compat testing
  window.webkitSpeechRecognition = SpeechRecognitionMock;
}

// 2. window.Audio (HTMLAudioElement constructor)
//    Needed by useTtsPlayback tests (play/pause/onended lifecycle).
//    Also patches HTMLAudioElement.prototype.play so jsdom does not throw
//    "Not implemented" on audio playback attempts.
if (typeof window !== 'undefined' && !window.Audio) {
  const mockAudioInstance = {
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    onended: null as (() => void) | null,
  };
  // @ts-expect-error — jsdom does not implement Audio constructor
  window.Audio = vi.fn(() => mockAudioInstance);
}

// Patch HTMLAudioElement.prototype.play unconditionally — jsdom defines the
// constructor but leaves play() throwing "Not implemented".
if (typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype) {
  HTMLAudioElement.prototype.play = vi.fn(() => Promise.resolve());
}

// 3. Worker — minimal stub so hooks that spin up Web Workers can mount.
//    The stub stores onmessage and exposes postMessage/terminate as vi.fn().
if (typeof window !== 'undefined' && typeof Worker === 'undefined') {
  class WorkerMock {
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor(_url: string | URL, _options?: WorkerOptions) {}
  }
  // @ts-expect-error — jsdom does not implement Worker in this env
  globalThis.Worker = WorkerMock;
}

// 4. AudioWorkletNode + AudioContext.prototype.audioWorklet.addModule
//    Needed by useWakeWord mount paths in jsdom where AudioWorklet is absent.
if (typeof window !== 'undefined' && typeof AudioWorkletNode === 'undefined') {
  class AudioWorkletNodeMock {
    port = {
      postMessage: vi.fn(),
      onmessage: null as ((event: MessageEvent) => void) | null,
    };
    disconnect = vi.fn();
    connect = vi.fn();
    constructor(_context: unknown, _name: string, _options?: unknown) {}
  }
  // @ts-expect-error — AudioWorkletNode not in jsdom
  globalThis.AudioWorkletNode = AudioWorkletNodeMock;
}

// Patch AudioContext.prototype.audioWorklet.addModule to resolve immediately.
// Guards with instanceof check so it only applies when AudioContext exists.
if (typeof AudioContext !== 'undefined') {
  const proto = AudioContext.prototype as unknown as {
    audioWorklet?: { addModule?: (url: string) => Promise<void> };
  };
  if (proto.audioWorklet && !proto.audioWorklet.addModule) {
    proto.audioWorklet.addModule = vi.fn(() => Promise.resolve());
  }
}

// 5. livekit-client stub — Phase 90 (Agent Room / War Room voice integration)
//    Provides deterministic Room/RoomEvent/Track/ConnectionState stubs so
//    War Room tests (useWarRoomVoice, AgentVoiceCard, WarRoom page) run in
//    jsdom without any WebRTC / media-device APIs.
vi.mock('livekit-client', () => ({
  ConnectionState: {
    Disconnected: 'Disconnected',
    Connecting: 'Connecting',
    Connected: 'Connected',
    Reconnecting: 'Reconnecting',
    SignalReconnecting: 'SignalReconnecting',
  },
  RoomEvent: {
    ConnectionStateChanged: 'connectionStateChanged',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    Disconnected: 'disconnected',
  },
  Track: { Kind: { Audio: 'audio', Video: 'video' } },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Room: class MockRoom {
    connect = vi.fn(() => Promise.resolve());
    disconnect = vi.fn(() => Promise.resolve());
    localParticipant = {
      setMicrophoneEnabled: vi.fn(() => Promise.resolve()),
    };
    _listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    on(event: string, handler: (...args: unknown[]) => void) {
      (this._listeners[event] ??= []).push(handler);
      return this;
    }
    off = vi.fn();
    emit(event: string, ...args: unknown[]) {
      this._listeners[event]?.forEach(h => h(...args));
    }
  },
}));
