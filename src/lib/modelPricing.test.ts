import { describe, it, expect } from "vitest";
import { estimateCost } from "./modelPricing";

describe("modelPricing — GPT pricing", () => {
  it("GPT-4o uses $2.50/$10 per 1M", () => {
    const cost = estimateCost(1000, 1000, "gpt-4o");
    expect(cost).toBeCloseTo(0.0125, 8);
  });

  it("GPT-4o-mini uses $0.15/$0.60 per 1M", () => {
    const cost = estimateCost(1000, 1000, "gpt-4o-mini");
    expect(cost).toBeCloseTo(0.00075, 8);
  });
});

describe("modelPricing — Gemini pricing (D-11)", () => {
  it("Gemini 2.5 Pro uses $1.25/$10 per 1M", () => {
    const cost = estimateCost(1000, 1000, "gemini-2.5-pro");
    expect(cost).toBeCloseTo(0.01125, 8);
  });

  it("Gemini 2.5 Flash uses $0.30/$2.50 per 1M", () => {
    const cost = estimateCost(1000, 1000, "gemini-2.5-flash");
    expect(cost).toBeCloseTo(0.0028, 8);
  });
});

describe("modelPricing — billingType skip (D-12)", () => {
  it("subscription billing returns 0 regardless of model", () => {
    expect(estimateCost(1000, 1000, "gpt-4o", "subscription")).toBe(0);
  });

  it("api billing calculates normally", () => {
    const cost = estimateCost(1000, 1000, "gpt-4o", "api");
    expect(cost).toBeCloseTo(0.0125, 8);
  });

  it("undefined billingType calculates normally", () => {
    const cost = estimateCost(1000, 1000, "gpt-4o");
    expect(cost).toBeCloseTo(0.0125, 8);
  });
});

describe("modelPricing — fallback (D-13)", () => {
  it("unknown model uses default Sonnet rates ($3/$15 per 1M)", () => {
    const cost = estimateCost(1000, 1000, "unknown-model");
    // 1000 * 3.00/1M + 1000 * 15.00/1M = 0.018
    expect(cost).toBeCloseTo(0.018, 8);
  });
});
