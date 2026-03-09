import { describe, it, expect } from 'vitest';
import { getEventIcon, getEventColor } from '../eventIcons';

describe('getEventIcon', () => {
  it('returns the correct icon for known event types', () => {
    expect(getEventIcon('SessionStart')).toBe('▶');
    expect(getEventIcon('ToolUse')).toBe('🔧');
    expect(getEventIcon('llm_call')).toBe('🧠');
    expect(getEventIcon('docker_status')).toBe('🐳');
  });

  it('returns fallback icon for unknown event types', () => {
    expect(getEventIcon('unknown_event')).toBe('📋');
    expect(getEventIcon('')).toBe('📋');
  });
});

describe('getEventColor', () => {
  it('returns the correct color for known event types', () => {
    expect(getEventColor('SessionStart')).toBe('text-green-400');
    expect(getEventColor('SessionEnd')).toBe('text-red-400');
    expect(getEventColor('ToolUse')).toBe('text-blue-400');
    expect(getEventColor('security_event')).toBe('text-red-500');
  });

  it('returns fallback color for unknown event types', () => {
    expect(getEventColor('unknown_event')).toBe('text-gray-400');
    expect(getEventColor('')).toBe('text-gray-400');
  });
});
