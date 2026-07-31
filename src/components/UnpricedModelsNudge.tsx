/**
 * UnpricedModelsNudge — persistent "N models need pricing rates" affordance.
 * Phase 104 Plan 09 (D-03).
 *
 * Reads the exact same `costDerived.unpricedModels` query
 * `ModelPricingAdmin`'s suggestion list reads (plan 104-07), so the two
 * surfaces can never disagree about which models need a rate. The count is
 * always the live query result — no local caching and no persisted
 * dismissal flag of any kind, so it can never go stale while the gap
 * exists. Renders nothing while the count is genuinely zero (or the query
 * hasn't resolved yet) — a nudge that flashes on every page load is noise.
 */

import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useUnpricedModels } from "../hooks/useCostDerived";

// D-03: status-warn token via color-mix, matching MetricCard.tsx's
// severityConfig convention — no hardcoded hex.
const BANNER_CLASS =
  "flex items-center justify-between gap-3 flex-wrap rounded-lg border border-[var(--status-warn)]/40 bg-[color-mix(in_oklab,var(--status-warn)_10%,transparent)] px-4 py-2.5";

export default function UnpricedModelsNudge() {
  const { count } = useUnpricedModels(24);

  // Loading (useUnpricedModels collapses `undefined` to count: 0) and the
  // genuine "nothing unpriced" case both render nothing — neither is worth
  // interrupting the operator.
  if (count === 0) return null;

  return (
    <div className={BANNER_CLASS} role="status">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 text-[var(--status-warn)] shrink-0" />
        <p className="text-sm text-foreground">
          <strong className="font-semibold">{count} models</strong> need pricing rates — their
          cost isn't in the total above.
        </p>
      </div>
      <Button asChild type="button" size="sm" variant="outline">
        <Link to="/settings">Add rates</Link>
      </Button>
    </div>
  );
}
