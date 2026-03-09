import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchAudioEvent } from './useAudioEvents';

describe('dispatchAudioEvent', () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it('dispatches a CustomEvent on the window', () => {
    dispatchAudioEvent('alert', 'error_spike');

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('codepulse:audio-event');
    expect(event.detail).toEqual({ category: 'alert', type: 'error_spike' });
  });

  it('dispatches event category events', () => {
    dispatchAudioEvent('event', 'tool_use');

    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.category).toBe('event');
    expect(event.detail.type).toBe('tool_use');
  });

  it('dispatches with arbitrary type strings', () => {
    dispatchAudioEvent('alert', 'custom_type');

    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ category: 'alert', type: 'custom_type' });
  });

  it('can be received by a window listener', () => {
    const handler = vi.fn();
    window.addEventListener('codepulse:audio-event', handler);

    dispatchAudioEvent('event', 'agent_spawn');

    expect(handler).toHaveBeenCalledTimes(1);
    const received = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(received).toEqual({ category: 'event', type: 'agent_spawn' });

    window.removeEventListener('codepulse:audio-event', handler);
  });
});
