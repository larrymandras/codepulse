import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { SectionHeader } from "@/components/SectionHeader";
import { GlassPanel } from "@/components/GlassPanel";
import { ExtractionFunnel } from "@/components/ExtractionFunnel";
import { StatusBadge } from "@/components/StatusBadge";
import MetricCard, { AnimatedNumber } from "@/components/MetricCard";

type DreamingTab = "timeline" | "facts" | "cost";

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function formatRelative(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Dreaming() {
  const [factSearch, setFactSearch] = useState("");
  const [factCategory, setFactCategory] = useState("");

  const cycles = useQuery(api.dreaming.recentCycles, { limit: 50 });
  const facts = useQuery(api.dreaming.recentFacts, { limit: 100 });
  const costData = useQuery(api.dreaming.costSummary);

  const latestCycle = cycles?.[0];

  const funnelSteps = latestCycle
    ? [
        { label: "Raw", count: latestCycle.rawCount ?? 0 },
        { label: "Candidates", count: latestCycle.candidateCount ?? 0 },
        { label: "Extracted", count: latestCycle.extractedCount ?? 0 },
        { label: "Deduped", count: latestCycle.dedupedCount ?? 0 },
        { label: "Stored", count: latestCycle.storedCount ?? 0 },
      ]
    : [
        { label: "Raw", count: 0 },
        { label: "Candidates", count: 0 },
        { label: "Extracted", count: 0 },
        { label: "Deduped", count: 0 },
        { label: "Stored", count: 0 },
      ];

  const allCategories = facts
    ? [...new Set(facts.map((f: any) => f.category).filter(Boolean))]
    : [];

  const filteredFacts = (facts ?? []).filter((f: any) => {
    const matchesSearch =
      !factSearch ||
      (f.factText ?? "").toLowerCase().includes(factSearch.toLowerCase());
    const matchesCategory = !factCategory || f.category === factCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dreaming</h1>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="facts">Facts</TabsTrigger>
          <TabsTrigger value="cost">Cost</TabsTrigger>
        </TabsList>

        {/* === TIMELINE TAB === */}
        <TabsContent value="timeline">
          <SectionErrorBoundary name="Dreaming Timeline">
            <div className="space-y-6 mt-4">
              {/* Extraction Funnel */}
              <GlassPanel className="rounded-xl p-4">
                <SectionHeader title="Latest Cycle Funnel" />
                <ExtractionFunnel steps={funnelSteps} />
              </GlassPanel>

              {/* Cycle History */}
              <div className="space-y-2">
                <SectionHeader title="Cycle History" />
                {!cycles || cycles.length === 0 ? (
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No dreaming cycles recorded yet. Cycles run nightly --
                      check back tomorrow, or trigger a backfill run.
                    </p>
                  </div>
                ) : (
                  cycles.map((cycle: any) => (
                    <GlassPanel key={cycle._id} className="rounded-xl">
                      <details>
                        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
                          <div className="flex items-center gap-3">
                            <StatusBadge status={cycle.status ?? "idle"} />
                            <span className="text-sm text-gray-200">
                              {formatTimestamp(cycle.runDate ?? cycle._creationTime / 1000)}
                            </span>
                            {cycle.isBackfill && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-400">
                                Backfill
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="tabular-nums">
                              {cycle.storedCount ?? 0} stored
                            </span>
                            {cycle.costUsd != null && (
                              <span className="tabular-nums">
                                ${cycle.costUsd.toFixed(4)}
                              </span>
                            )}
                            {cycle.durationMs != null && (
                              <span className="tabular-nums">
                                {cycle.durationMs}ms
                              </span>
                            )}
                          </div>
                        </summary>
                        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-5 gap-3 border-t border-border pt-3">
                          {[
                            ["Raw", cycle.rawCount],
                            ["Candidates", cycle.candidateCount],
                            ["Extracted", cycle.extractedCount],
                            ["Deduped", cycle.dedupedCount],
                            ["Stored", cycle.storedCount],
                          ].map(([label, val]) => (
                            <div key={label as string}>
                              <p className="text-xs text-muted-foreground">{label}</p>
                              <p className="text-base font-semibold tabular-nums">
                                {val ?? 0}
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>
                    </GlassPanel>
                  ))
                )}
              </div>
            </div>
          </SectionErrorBoundary>
        </TabsContent>

        {/* === FACTS TAB === */}
        <TabsContent value="facts">
          <SectionErrorBoundary name="Dreaming Facts">
            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-3">
                <Input
                  placeholder="Search facts..."
                  value={factSearch}
                  onChange={(e) => setFactSearch(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                {allCategories.length > 0 && (
                  <select
                    value={factCategory}
                    onChange={(e) => setFactCategory(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">All Categories</option>
                    {allCategories.map((cat) => (
                      <option key={cat as string} value={cat as string}>
                        {cat as string}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {!facts || facts.length === 0 ? (
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No durable facts extracted yet. Run a dreaming cycle to
                    extract long-term facts from your conversation history.
                  </p>
                </div>
              ) : filteredFacts.length === 0 ? (
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No facts match your search.
                  </p>
                </div>
              ) : (
                <GlassPanel className="rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fact</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                        <TableHead className="text-right">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFacts.map((fact: any) => (
                        <TableRow key={fact._id}>
                          <TableCell className="text-sm text-gray-200 max-w-md">
                            {fact.factText}
                          </TableCell>
                          <TableCell>
                            {fact.category && (
                              <StatusBadge
                                status="idle"
                                label={fact.category.toUpperCase()}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {fact.confidence != null
                              ? `${(fact.confidence * 100).toFixed(0)}%`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                            {fact.timestamp
                              ? formatRelative(fact.timestamp)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </GlassPanel>
              )}
            </div>
          </SectionErrorBoundary>
        </TabsContent>

        {/* === COST TAB === */}
        <TabsContent value="cost">
          <SectionErrorBoundary name="Dreaming Cost">
            <div className="space-y-6 mt-4">
              {/* Total cost card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassPanel className="rounded-xl">
                  <MetricCard
                    label="Total Cost (USD)"
                    value={`$${(costData?.totalCostUsd ?? 0).toFixed(4)}`}
                    numericValue={costData?.totalCostUsd ?? 0}
                    format={(v) => `$${v.toFixed(4)}`}
                  />
                </GlassPanel>
                <GlassPanel className="rounded-xl">
                  <MetricCard
                    label="Cycles Tracked"
                    value={costData?.totalCycles ?? 0}
                    numericValue={costData?.totalCycles ?? 0}
                  />
                </GlassPanel>
                <GlassPanel className="rounded-xl">
                  <MetricCard
                    label="Cycles with Cost"
                    value={costData?.cyclesWithCost ?? 0}
                    numericValue={costData?.cyclesWithCost ?? 0}
                  />
                </GlassPanel>
              </div>

              {/* Per-run spend table */}
              <div className="space-y-2">
                <SectionHeader title="Per-Run Spend" />
                {!cycles || cycles.length === 0 ? (
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No cycle data available yet.
                    </p>
                  </div>
                ) : (
                  <GlassPanel className="rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Run Date</TableHead>
                          <TableHead className="text-right">Cost (USD)</TableHead>
                          <TableHead className="text-right">Stored</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cycles.map((cycle: any) => (
                          <TableRow key={cycle._id}>
                            <TableCell className="text-sm text-gray-200 whitespace-nowrap">
                              {formatTimestamp(
                                cycle.runDate ?? cycle._creationTime / 1000
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {cycle.costUsd != null
                                ? `$${cycle.costUsd.toFixed(4)}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {cycle.storedCount ?? 0}
                            </TableCell>
                            <TableCell>
                              {cycle.isBackfill ? (
                                <StatusBadge status="warn" label="BACKFILL" />
                              ) : (
                                <StatusBadge status="idle" label="NIGHTLY" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </GlassPanel>
                )}
              </div>
            </div>
          </SectionErrorBoundary>
        </TabsContent>

      </Tabs>
    </div>
  );
}
