import { describe, it, expect } from 'vitest';
import { formatTimestamp, formatDuration, formatCost, truncatePath } from '../formatters';

describe('formatTimestamp', () => {
  it('returns a time string for a unix timestamp', () => {
    const result = formatTimestamp(1700000000);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('formats different timestamps to different strings', () => {
    const a = formatTimestamp(1700000000);
    const b = formatTimestamp(1700003600);
    expect(a).not.toBe(b);
  });

  it('handles zero timestamp', () => {
    const result = formatTimestamp(0);
    expect(result).toBeTruthy();
  });
});

describe('formatDuration', () => {
  it('formats seconds only for values under 60', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('rounds fractional seconds', () => {
    expect(formatDuration(30.4)).toBe('30s');
    expect(formatDuration(30.6)).toBe('31s');
  });

  it('formats minutes and seconds for values under 3600', () => {
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(120)).toBe('2m 0s');
    expect(formatDuration(3599)).toBe('59m 59s');
  });

  it('formats hours and minutes for values >= 3600', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3661)).toBe('1h 1m');
    expect(formatDuration(7200)).toBe('2h 0m');
  });
});

describe('formatCost', () => {
  it('formats cost with dollar sign and 4 decimal places', () => {
    expect(formatCost(0)).toBe('$0.0000');
    expect(formatCost(1)).toBe('$1.0000');
    expect(formatCost(0.0001)).toBe('$0.0001');
    expect(formatCost(12.3456)).toBe('$12.3456');
  });

  it('rounds to 4 decimal places', () => {
    expect(formatCost(0.00005)).toBe('$0.0001');
    expect(formatCost(0.00004)).toBe('$0.0000');
  });
});

describe('truncatePath', () => {
  it('returns short paths unchanged', () => {
    expect(truncatePath('src/index.ts')).toBe('src/index.ts');
    expect(truncatePath('')).toBe('');
  });

  it('truncates long paths with leading ellipsis', () => {
    const longPath = '/home/user/projects/my-app/src/components/deeply/nested/Component.tsx';
    const result = truncatePath(longPath);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.startsWith('...')).toBe(true);
    expect(result.endsWith('Component.tsx')).toBe(true);
  });

  it('respects custom maxLen', () => {
    const path = 'abcdefghijklmnopqrstuvwxyz';
    const result = truncatePath(path, 10);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.startsWith('...')).toBe(true);
  });

  it('returns path as-is when exactly at maxLen', () => {
    const path = 'a'.repeat(40);
    expect(truncatePath(path)).toBe(path);
  });
});
