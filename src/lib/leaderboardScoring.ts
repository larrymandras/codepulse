export interface LeaderboardRow {
  agentId: string;
  taskCount: number;
  completionRate: number;
  avgResponseTimeMs: number | null;
  inputTokens: number;
  outputTokens: number;
  dominantModel: string;
}

export interface ScoredRow extends LeaderboardRow {
  score: number;
  totalCost: number;
  normCompletion: number;
  normResponseTime: number;
  normCostEfficiency: number;
}

export type Weights = [number, number, number];

export const DEFAULT_WEIGHTS: Weights = [40, 30, 30];

export function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

export function computeScores(
  rows: LeaderboardRow[],
  weights: Weights,
  costFn: (input: number, output: number, model: string) => number,
): ScoredRow[] {
  if (rows.length === 0) return [];

  const costs = rows.map((r) =>
    costFn(r.inputTokens, r.outputTokens, r.dominantModel),
  );

  const completionRates = rows.map((r) => r.completionRate * 100);
  const responseTimes = rows.map((r) => r.avgResponseTimeMs ?? 0);

  const normCompletion = minMaxNormalize(completionRates);
  const normResponse = minMaxNormalize(responseTimes).map((v) => 100 - v);
  const normCost = minMaxNormalize(costs).map((v) => 100 - v);

  return rows
    .map((row, i) => ({
      ...row,
      totalCost: costs[i],
      normCompletion: normCompletion[i],
      normResponseTime: normResponse[i],
      normCostEfficiency: normCost[i],
      score: Math.round(
        (normCompletion[i] * weights[0] +
          normResponse[i] * weights[1] +
          normCost[i] * weights[2]) /
          100,
      ),
    }))
    .sort((a, b) => b.score - a.score);
}

export function redistributeWeights(
  weights: Weights,
  changedIndex: number,
  newValue: number,
): Weights {
  const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
  const delta = clamped - weights[changedIndex];
  const others = ([0, 1, 2] as const).filter((i) => i !== changedIndex);
  const otherTotal = others.reduce<number>((s, i) => s + weights[i], 0);

  const next: Weights = [...weights];
  next[changedIndex] = clamped;

  if (otherTotal === 0) {
    const each = Math.round(-delta / 2);
    others.forEach((i) => {
      next[i] = Math.max(0, weights[i] + each);
    });
  } else {
    others.forEach((i) => {
      next[i] = Math.max(0, Math.round(weights[i] - delta * (weights[i] / otherTotal)));
    });
  }

  const sum = next[0] + next[1] + next[2];
  const diff = 100 - sum;
  if (diff !== 0) {
    next[others[0]] = Math.max(0, next[others[0]] + diff);
  }

  return next;
}
