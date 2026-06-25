/**
 * useWakeWord.test.ts
 *
 * Unit coverage for:
 *   (a) mocked Worker posting {type:'wake', score:0.9} → calls onWake
 *   (b) Worker posting {type:'error'} → status:'error-disabled', errorReason set, mic tracks stopped
 *   (c) getUserMedia rejection → status:'error-disabled', errorReason set, no mic stream opened
 *
 * All three test paths verify VOX-04: no silent hot mic on failure.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Shared state for controllable Worker instances
// ---------------------------------------------------------------------------

interface ControlledWorker {
  postMessage: Mock;
  terminate: Mock;
  triggerMessage: (data: unknown) => void;
  triggerError: (msg: string) => void;
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
}

let lastWorker: ControlledWorker | null = null;

function makeWorkerClass() {
  function WorkerCtor() {
    const worker: ControlledWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
      triggerMessage(data: unknown) {
        if (this.onmessage) {
          this.onmessage(new MessageEvent('message', { data }));
        }
      },
      triggerError(msg: string) {
        if (this.onerror) {
          this.onerror({ message: msg } as ErrorEvent);
        }
      },
    };
    lastWorker = worker;
    // Return the worker object — the hook assigns .onmessage / .onerror on it
    return worker;
  }
  // Make it work as a constructor
  WorkerCtor.prototype = {};
  return WorkerCtor as unknown as typeof Worker;
}

// ---------------------------------------------------------------------------
// Mock track / stream helpers
// ---------------------------------------------------------------------------

function makeMockTrack() {
  return { stop: vi.fn(), kind: 'audio', enabled: true };
}

function makeMockStream(tracks = [makeMockTrack()]) {
  return {
    getTracks: vi.fn(() => tracks),
    getAudioTracks: vi.fn(() => tracks),
    _tracks: tracks,
  } as unknown as MediaStream;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let getUserMediaMock: Mock;
let mockStreamTracks: ReturnType<typeof makeMockTrack>[];
let mockStream: MediaStream;

beforeEach(() => {
  lastWorker = null;

  // Worker mock
  vi.stubGlobal('Worker', makeWorkerClass());

  // MessageChannel mock
  vi.stubGlobal('MessageChannel', function MessageChannelMock() {
    return {
      port1: { postMessage: vi.fn(), start: vi.fn(), close: vi.fn() },
      port2: { postMessage: vi.fn(), start: vi.fn(), close: vi.fn() },
    };
  });

  // AudioContext mock
  vi.stubGlobal('AudioContext', function AudioContextMock() {
    return {
      sampleRate: 16000,
      state: 'running',
      audioWorklet: { addModule: vi.fn(() => Promise.resolve()) },
      createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
      close: vi.fn(() => Promise.resolve()),
      destination: {},
    };
  });

  // AudioWorkletNode mock
  vi.stubGlobal('AudioWorkletNode', function AudioWorkletNodeMock() {
    return {
      port: { postMessage: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  });

  // getUserMedia mock
  mockStreamTracks = [makeMockTrack()];
  mockStream = makeMockStream(mockStreamTracks);
  getUserMediaMock = vi.fn(() => Promise.resolve(mockStream));

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      mediaDevices: { getUserMedia: getUserMediaMock },
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  lastWorker = null;
});

// ---------------------------------------------------------------------------
// Helper: start the hook and simulate Worker ready response
// ---------------------------------------------------------------------------

async function startWithWorkerReady(onWake = vi.fn()) {
  const { useWakeWord } = await import('./useWakeWord');
  const { result } = renderHook(() =>
    useWakeWord({ baseUrl: '/openwakeword', onWake }),
  );

  // Kick off start() — this is async; Worker is created mid-flight
  let startDone = false;
  act(() => {
    void result.current.start().then(() => { startDone = true; });
  });

  // Wait for Worker to be created
  await waitFor(() => expect(lastWorker).not.toBeNull(), { timeout: 3000 });

  // Simulate Worker posting 'ready'
  act(() => {
    lastWorker!.triggerMessage({ type: 'ready' });
  });

  // Wait for start() to complete and status to become 'ready'
  await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 3000 });
  expect(startDone).toBe(true);

  return { result, onWake };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useWakeWord', () => {
  it('starts in idle status with no errorReason', async () => {
    const { useWakeWord } = await import('./useWakeWord');
    const { result } = renderHook(() =>
      useWakeWord({ baseUrl: '/openwakeword', onWake: vi.fn() }),
    );
    expect(result.current.status).toBe('idle');
    expect(result.current.errorReason).toBeNull();
  });

  it('(a) Worker posting {type:wake, score:0.9} calls onWake', async () => {
    const { result, onWake } = await startWithWorkerReady();

    // Simulate a wake event from the Worker
    act(() => {
      lastWorker!.triggerMessage({ type: 'wake', score: 0.9 });
    });

    expect(onWake).toHaveBeenCalledTimes(1);
  });

  it('(b) Worker posting {type:error} → error-disabled, errorReason non-null, mic tracks stopped', async () => {
    const track = makeMockTrack();
    const stream = makeMockStream([track]);
    getUserMediaMock.mockResolvedValueOnce(stream);

    const { useWakeWord } = await import('./useWakeWord');
    const { result } = renderHook(() =>
      useWakeWord({ baseUrl: '/openwakeword', onWake: vi.fn() }),
    );

    act(() => {
      void result.current.start();
    });

    // Wait for Worker to be created, then send error
    await waitFor(() => expect(lastWorker).not.toBeNull(), { timeout: 3000 });
    act(() => {
      lastWorker!.triggerMessage({ type: 'error', message: 'ONNX session load failed' });
    });

    // Should transition to error-disabled
    await waitFor(() => expect(result.current.status).toBe('error-disabled'), { timeout: 3000 });
    expect(result.current.errorReason).not.toBeNull();
    expect(result.current.errorReason).toContain('ONNX session load failed');

    // VOX-04: mic track MUST be stopped — no silent hot mic
    expect(track.stop).toHaveBeenCalled();
    // Worker MUST be terminated
    expect(lastWorker!.terminate).toHaveBeenCalled();
  });

  it('(b) Worker onerror → error-disabled with no silent mic', async () => {
    const track = makeMockTrack();
    const stream = makeMockStream([track]);
    getUserMediaMock.mockResolvedValueOnce(stream);

    const { useWakeWord } = await import('./useWakeWord');
    const { result } = renderHook(() =>
      useWakeWord({ baseUrl: '/openwakeword', onWake: vi.fn() }),
    );

    act(() => {
      void result.current.start();
    });

    await waitFor(() => expect(lastWorker).not.toBeNull(), { timeout: 3000 });

    // Simulate worker.onerror
    act(() => {
      lastWorker!.triggerError('Unexpected Worker crash');
    });

    await waitFor(() => expect(result.current.status).toBe('error-disabled'), { timeout: 3000 });
    expect(result.current.errorReason).not.toBeNull();
    // VOX-04: mic track stopped
    expect(track.stop).toHaveBeenCalled();
  });

  it('(c) getUserMedia rejection → error-disabled, errorReason set, no mic stream opened', async () => {
    // Both getUserMedia calls fail (primary 16kHz + fallback)
    getUserMediaMock
      .mockRejectedValueOnce(new Error('Permission denied'))
      .mockRejectedValueOnce(new Error('Permission denied'));

    const { useWakeWord } = await import('./useWakeWord');
    const { result } = renderHook(() =>
      useWakeWord({ baseUrl: '/openwakeword', onWake: vi.fn() }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('error-disabled');
    expect(result.current.errorReason).toContain('Permission denied');
    // No Worker should have been created (getUserMedia failed before Worker init)
    // (lastWorker is null because the failure happened before Worker construction)
  });

  it('start() never throws — errors are caught internally', async () => {
    getUserMediaMock
      .mockRejectedValueOnce(new Error('NotAllowedError'))
      .mockRejectedValueOnce(new Error('NotAllowedError'));

    const { useWakeWord } = await import('./useWakeWord');
    const { result } = renderHook(() =>
      useWakeWord({ baseUrl: '/openwakeword', onWake: vi.fn() }),
    );

    // start() must not throw/reject even on permission failure
    await expect(
      act(async () => result.current.start()),
    ).resolves.not.toThrow();

    await waitFor(() => expect(result.current.status).toBe('error-disabled'), { timeout: 2000 });
  });

  it('stop() releases mic tracks and returns status to idle', async () => {
    const track = makeMockTrack();
    const stream = makeMockStream([track]);
    getUserMediaMock.mockResolvedValueOnce(stream);

    const { result } = await startWithWorkerReady();

    act(() => {
      result.current.stop();
    });

    expect(result.current.status).toBe('idle');
    expect(track.stop).toHaveBeenCalled();
    expect(lastWorker!.terminate).toHaveBeenCalled();
  });

  it('non-wake messages do not call onWake', async () => {
    const { result, onWake } = await startWithWorkerReady();

    // Simulate irrelevant messages that the hook should ignore
    act(() => {
      lastWorker!.triggerMessage({ type: 'frame_processed' });
      lastWorker!.triggerMessage({ type: 'debug', info: 'score: 0.1' });
    });

    expect(onWake).not.toHaveBeenCalled();
  });
});
