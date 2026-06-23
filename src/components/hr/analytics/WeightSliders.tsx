import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  type Weights,
  DEFAULT_WEIGHTS,
  redistributeWeights,
} from "@/lib/leaderboardScoring";

const LABELS = ["Completion", "Response Time", "Cost Efficiency"] as const;

interface WeightSlidersProps {
  weights: Weights;
  onWeightsChange: (weights: Weights) => void;
}

export function WeightSliders({ weights, onWeightsChange }: WeightSlidersProps) {
  return (
    <div className="flex flex-col gap-4">
      {LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground w-28 shrink-0">
            {label}
          </span>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[weights[i]]}
            onValueChange={(val) => {
              onWeightsChange(redistributeWeights(weights, i, val[0]));
            }}
            className="flex-1"
          />
          <span className="text-sm tabular-nums w-10 text-right">
            {weights[i]}%
          </span>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="self-end text-sm"
        onClick={() => onWeightsChange(DEFAULT_WEIGHTS)}
      >
        Reset to defaults
      </Button>
    </div>
  );
}
