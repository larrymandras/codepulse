/**
 * Token savings indicator for lean-ctx compression (per D-07, LCTX-01).
 * Shows estimated token reduction percentage on the Analytics page.
 */
import { TrendingDown } from "lucide-react";

interface TokenSavingsIndicatorProps {
  savedTokens?: number;
  totalTokens?: number;
  className?: string;
}

export function TokenSavingsIndicator({
  savedTokens = 0,
  totalTokens = 0,
  className = "",
}: TokenSavingsIndicatorProps) {
  const percentage = totalTokens > 0
    ? Math.round((savedTokens / totalTokens) * 100)
    : 0;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg ${className}`}>
      <TrendingDown className="w-4 h-4 text-emerald-600" />
      <div className="text-base">
        <span className="font-semibold text-emerald-700">{percentage}%</span>
        <span className="text-emerald-600 ml-1">token savings</span>
        {savedTokens > 0 && (
          <span className="text-emerald-500 text-sm ml-1">
            ({savedTokens.toLocaleString()} tokens saved via lean-ctx)
          </span>
        )}
      </div>
    </div>
  );
}
