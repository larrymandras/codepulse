import { useLlmMetrics } from "../../hooks/useLlmMetrics";
import MetricCard from "../MetricCard";
import type { MetricState } from "../../lib/metricState";

/**
 * LLM Calls + Total Tokens summary cards. Self-fetching: owns useLlmMetrics (a
 * usePaginatedQuery, not useQuery). One component for both cards because both
 * derive from the same paginated subscription — splitting them would open a
 * second usePaginatedQuery for no isolation gain.
 *
 * Behaviour change from the pre-move page: these counts now reflect this
 * component's own first page and no longer grow when the user clicks "Load
 * more" in the Recent LLM Calls table below, which is now a separate
 * subscription (RecentLlmCallsPanel). Both before and after, the figure counts
 * loaded rows rather than a true 30-day total — the change is that it is now
 * stable instead of drifting as the page's other paginated query loaded more.
 *
 * No error handling here (D-02) — relies entirely on the error-boundary
 * wrapper its parent supplies. Renders a fragment (no wrapper div) so the
 * page can drop both cards straight into the existing 4-column grid.
 */
export default function LlmVolumeCards() {
  const { calls: llmCalls, status } = useLlmMetrics();
  const totalTokens = llmCalls.reduce((s: number, c: any) => s + (c.totalTokens ?? 0), 0);

  // D-14: `usePaginatedQuery`'s own `status` is a genuine, undefaulted
  // signal -- "LoadingFirstPage" means no data has arrived yet, which is
  // distinct from a resolved page that happens to hold zero calls.
  const state: MetricState =
    status === "LoadingFirstPage" ? "loading" : llmCalls.length === 0 ? "empty" : "ready";

  return (
    <>
      <MetricCard label="LLM Calls" value={llmCalls.length} state={state} />
      <MetricCard label="Total Tokens" value={totalTokens.toLocaleString()} state={state} />
    </>
  );
}
