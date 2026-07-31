/**
 * Tests for convex/costBudgetEval.ts.
 *
 * Task 1: pure projection (D-13) + classification (D-11) + message-copy
 * (D-16 honesty / UI-SPEC copywriting contract) tests — no ctx needed.
 * Task 2 (dedup + fire path) and Task 3 (cron tail-append) extend this file.
 */
import { describe, test, expect } from "vitest";
import {
  projectPeriodEndSpend,
  classifyBudgetLevel,
  buildAlertMessage,
  containsForbiddenEnforcementWord,
} from "./costBudgetEval";
import { projectDayEndSpend, DAILY_CAP } from "../src/components/SDKSpendGuard";

// ---------------------------------------------------------------------------
// projectPeriodEndSpend (D-13)
// ---------------------------------------------------------------------------

describe("projectPeriodEndSpend", () => {
  test("reproduces projectDayEndSpend's exact numbers when periodHours === 24 and periodStartSec is a UTC day start", () => {
    const dayStart = Math.floor(Date.now() / 1000 / 86400) * 86400;
    const spend = 2.4;
    const elapsedHours = 6;

    const legacy = projectDayEndSpend(spend, elapsedHours);
    const generalized = projectPeriodEndSpend(spend, elapsedHours, 24, DAILY_CAP, dayStart);

    expect(generalized.projectedTotal).toBeCloseTo(legacy.projectedTotal, 10);
    expect(generalized.willExceed).toBe(legacy.willExceedCap);
    if (legacy.projectedHitTime === null) {
      expect(generalized.projectedHitTime).toBeNull();
    } else {
      expect(generalized.projectedHitTime).not.toBeNull();
      expect(generalized.projectedHitTime!.getTime()).toBeCloseTo(legacy.projectedHitTime.getTime(), -2);
    }
  });

  test("a monthly period (periodHours=744) projects proportionally and lands the hit time inside the month", () => {
    const monthStart = Date.UTC(2026, 6, 1) / 1000; // July 2026, 00:00 UTC
    const monthEnd = Date.UTC(2026, 7, 1) / 1000;
    // 5 days elapsed (120h), $40 spent -> hourly rate $0.333/h -> monthly projection ~$248
    const result = projectPeriodEndSpend(40, 120, 744, 100, monthStart);

    expect(result.willExceed).toBe(true);
    expect(result.projectedTotal).toBeCloseTo((40 / 120) * 744, 6);
    expect(result.projectedHitTime).not.toBeNull();
    const hitSec = result.projectedHitTime!.getTime() / 1000;
    expect(hitSec).toBeGreaterThanOrEqual(monthStart);
    expect(hitSec).toBeLessThan(monthEnd);
  });

  test("elapsedHours === 0 returns the zero result rather than dividing by zero", () => {
    const result = projectPeriodEndSpend(10, 0, 24, 5, 0);
    expect(result).toEqual({ projectedTotal: 0, willExceed: false, projectedHitTime: null });
  });
});

// ---------------------------------------------------------------------------
// classifyBudgetLevel (D-11 + D-13 spike)
// ---------------------------------------------------------------------------

describe("classifyBudgetLevel", () => {
  test("returns 'error' at exactly spend === limitValue", () => {
    expect(classifyBudgetLevel(100, 0, 100, 0.8)).toBe("error");
  });

  test("returns 'warning' at exactly spend === warnFraction * limitValue", () => {
    expect(classifyBudgetLevel(80, 0, 100, 0.8)).toBe("warning");
  });

  test("returns 'warning' for the D-13 spike case: spend below warn fraction but projection exceeds the limit", () => {
    expect(classifyBudgetLevel(10, 150, 100, 0.8)).toBe("warning");
  });

  test("returns null when spend and projection are both under", () => {
    expect(classifyBudgetLevel(10, 20, 100, 0.8)).toBeNull();
  });

  test("breach takes precedence over a simultaneous spike signal", () => {
    expect(classifyBudgetLevel(100, 500, 100, 0.8)).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// buildAlertMessage (D-16 honesty / UI-SPEC copywriting contract)
// ---------------------------------------------------------------------------

describe("buildAlertMessage", () => {
  test("omits the projection clause when projectedHitTime is null", () => {
    const message = buildAlertMessage({
      scopeLabel: "Global daily",
      spend: 4,
      limitValue: 5,
      unit: "usd",
      projectedTotal: 4.5,
      projectedHitTime: null,
      unpricedTokens: 0,
    });
    expect(message).not.toMatch(/projected/i);
    expect(message).toContain("Global daily budget at 80% ($4.0000 of $5.0000).");
  });

  test("includes a projection clause when projectedHitTime is present", () => {
    const hitTime = new Date("2026-08-01T15:40:00Z");
    const message = buildAlertMessage({
      scopeLabel: "Global daily",
      spend: 4.5,
      limitValue: 5,
      unit: "usd",
      projectedTotal: 6,
      projectedHitTime: hitTime,
      unpricedTokens: 0,
    });
    expect(message).toContain("— projected to hit $5.0000 by ~");
  });

  test("renders % and no $ when unit === 'quota_pct'", () => {
    const message = buildAlertMessage({
      scopeLabel: "Quota claude-cli daily",
      spend: 85,
      limitValue: 100,
      unit: "quota_pct",
      projectedTotal: 90,
      projectedHitTime: null,
      unpricedTokens: 0,
    });
    expect(message).not.toContain("$");
    expect(message).toContain("85.0%");
    expect(message).toContain("100.0%");
  });

  test("appends the unpriced-tokens honesty clause when unpricedTokens > 0", () => {
    const message = buildAlertMessage({
      scopeLabel: "Global daily",
      spend: 4,
      limitValue: 5,
      unit: "usd",
      projectedTotal: 4.5,
      projectedHitTime: null,
      unpricedTokens: 1234,
    });
    expect(message).toContain("1234 tokens in this window are unpriced and are not included.");
  });

  test("never contains any of the forbidden enforcement words, in any generated message", () => {
    const messages = [
      buildAlertMessage({
        scopeLabel: "Global daily",
        spend: 5,
        limitValue: 5,
        unit: "usd",
        projectedTotal: 5,
        projectedHitTime: new Date(),
        unpricedTokens: 0,
      }),
      buildAlertMessage({
        scopeLabel: "Model claude-opus-5 monthly",
        spend: 90,
        limitValue: 100,
        unit: "usd",
        projectedTotal: 120,
        projectedHitTime: new Date(),
        unpricedTokens: 500,
      }),
      buildAlertMessage({
        scopeLabel: "Quota claude-cli daily",
        spend: 95,
        limitValue: 100,
        unit: "quota_pct",
        projectedTotal: 100,
        projectedHitTime: null,
        unpricedTokens: 0,
      }),
    ];
    for (const message of messages) {
      expect(containsForbiddenEnforcementWord(message)).toBe(false);
    }
  });

  test("containsForbiddenEnforcementWord itself detects each forbidden word", () => {
    for (const word of ["throttle", "swap", "stop", "block", "disable", "cap enforced"]) {
      expect(containsForbiddenEnforcementWord(`this budget will ${word} something`)).toBe(true);
    }
    expect(containsForbiddenEnforcementWord("Global daily budget at 80% ($4.0000 of $5.0000).")).toBe(false);
  });
});
