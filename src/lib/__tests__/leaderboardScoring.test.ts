import { describe, it } from "vitest";

describe("minMaxNormalize", () => {
  it.todo("normalizes values to 0-100 range");
  it.todo("returns 50 for all values when min equals max");
  it.todo("handles single-element array");
  it.todo("handles empty array without error");
});

describe("computeScores", () => {
  it.todo("ranks agents by default weights 40/30/30");
  it.todo("inverts response time (lower is better)");
  it.todo("inverts cost (lower is better)");
  it.todo("re-ranks when weights change to 100/0/0");
  it.todo("returns score 50 for single agent");
});

describe("redistributeWeights", () => {
  it.todo("maintains sum of 100 after adjusting one slider");
  it.todo("distributes proportionally to other two sliders");
  it.todo("handles one other slider at 0");
  it.todo("clamps values to 0-100 range");
  it.todo("rounds to integers without drift from 100 total");
});
