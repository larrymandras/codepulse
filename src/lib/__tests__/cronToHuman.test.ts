import { describe, test, expect } from "vitest";
import { cronToHuman, isValidCron } from "@/lib/cronToHuman";

describe("cronToHuman", () => {
  test("returns 'Every minute' for '* * * * *'", () => {
    expect(cronToHuman("* * * * *")).toBe("Every minute");
  });

  test("returns 'Every day at 3:00' for '0 3 * * *'", () => {
    expect(cronToHuman("0 3 * * *")).toBe("Every day at 3:00");
  });

  test("returns 'Every Monday at 9:00' for '0 9 * * 1'", () => {
    expect(cronToHuman("0 9 * * 1")).toBe("Every Monday at 9:00");
  });

  test("returns 'Every hour at minute 30' for '30 * * * *'", () => {
    expect(cronToHuman("30 * * * *")).toBe("Every hour at minute 30");
  });

  test("returns 'Invalid expression' for malformed input", () => {
    expect(cronToHuman("bad input")).toBe("Invalid expression");
  });
});

describe("isValidCron", () => {
  test("returns true for valid 5-field expression", () => {
    expect(isValidCron("0 3 * * *")).toBe(true);
  });

  test("returns false for 6-field expression", () => {
    expect(isValidCron("0 3 * * * *")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isValidCron("")).toBe(false);
  });
});
