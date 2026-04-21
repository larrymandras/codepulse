const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-5":       { input: 15.00 / 1_000_000, output: 75.00 / 1_000_000 },
  "claude-sonnet-4-5":     { input:  3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  "claude-haiku-3-5":      { input:  0.80 / 1_000_000, output:  4.00 / 1_000_000 },
  "default":               { input:  3.00 / 1_000_000, output: 15.00 / 1_000_000 },
};

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const rates = PRICING[model] ?? PRICING["default"];
  return inputTokens * rates.input + outputTokens * rates.output;
}
