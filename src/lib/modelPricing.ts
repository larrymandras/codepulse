const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-5":       { input: 15.00 / 1_000_000, output: 75.00 / 1_000_000 },
  "claude-sonnet-4-5":     { input:  3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  "claude-haiku-3-5":      { input:  0.80 / 1_000_000, output:  4.00 / 1_000_000 },
  "gpt-4o":                { input:  2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  "gpt-4o-mini":           { input:  0.15 / 1_000_000, output:  0.60 / 1_000_000 },
  "gemini-2.5-pro":        { input:  1.25 / 1_000_000, output: 10.00 / 1_000_000 },
  "gemini-2.5-flash":      { input:  0.30 / 1_000_000, output:  2.50 / 1_000_000 },
  "default":               { input:  3.00 / 1_000_000, output: 15.00 / 1_000_000 },
};

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  billingType?: "api" | "subscription"
): number {
  if (billingType === "subscription") return 0;  // D-12: subscription providers have no per-call cost
  const rates = PRICING[model] ?? PRICING["default"];
  return inputTokens * rates.input + outputTokens * rates.output;
}
