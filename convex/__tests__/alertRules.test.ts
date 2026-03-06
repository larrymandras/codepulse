import { describe, it, expect } from 'vitest';
import { alertRules as ALERT_RULES } from '../alertRules';

describe('ALERT_RULES', () => {
  it('exports an array of rules', () => {
    expect(Array.isArray(ALERT_RULES)).toBe(true);
  });

  it('contains at least 60 rules', () => {
    expect(ALERT_RULES.length).toBeGreaterThanOrEqual(60);
  });

  it('has unique IDs for every rule', () => {
    const ids = ALERT_RULES.map((r: any) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('has required fields on every rule', () => {
    const requiredFields = ['id', 'name', 'severity', 'source', 'category', 'message'];
    for (const rule of ALERT_RULES) {
      for (const field of requiredFields) {
        expect((rule as any)[field], `Rule "${(rule as any).id ?? 'unknown'}" missing field "${field}"`).toBeDefined();
      }
    }
  });

  it('uses valid severity values', () => {
    const validSeverities = ['info', 'warning', 'error', 'critical'];
    for (const rule of ALERT_RULES) {
      expect(
        validSeverities,
        `Rule "${(rule as any).id}" has invalid severity "${(rule as any).severity}"`
      ).toContain((rule as any).severity);
    }
  });

  it('uses valid category values', () => {
    const validCategories = [
      'standard',
      'discovery',
      'infrastructure',
      'llm',
      'security',
      'self-healing',
    ];
    for (const rule of ALERT_RULES) {
      expect(
        validCategories,
        `Rule "${(rule as any).id}" has invalid category "${(rule as any).category}"`
      ).toContain((rule as any).category);
    }
  });

  it('has non-empty string values for all fields', () => {
    for (const rule of ALERT_RULES) {
      const r = rule as any;
      expect(r.id.length).toBeGreaterThan(0);
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.message.length).toBeGreaterThan(0);
      expect(r.source.length).toBeGreaterThan(0);
    }
  });
});
