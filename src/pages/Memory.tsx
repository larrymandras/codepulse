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
import MemoryIndexHealth from "../components/MemoryIndexHealth";
import InfoTooltip from "../components/InfoTooltip";
import MemoryQualityTab from "../components/MemoryQualityTab";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { SectionHeader } from "@/components/SectionHeader";
import { GlassPanel } from "@/components/GlassPanel";
import { StatusBadge } from "@/components/StatusBadge";
import MetricCard, { AnimatedNumber } from "@/components/MetricCard";

type TabId = "timeline" | "tiers" | "reflections" | "quality";
type MemoryTab = "episodic" | "preflight" | "durable" | "imports";

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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-100">{value}</p>
    </div>
  );
}

export default function Memory() {
  const [searchText, setSearchText] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterType, setFilterType] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("timeline");
  const [durableSearch, setDurableSearch] = useState("");
  const [durableCategory, setDurableCategory] = useState("");

  // Existing episodic queries
  const overview = useQuery(api.memory.overview);
  const timeline = useQuery(api.memory.timeline, {
    agentId: filterAgent || undefined,
    eventType: filterType || undefined,
    limit: 100,
  });
  const searchResults = useQuery(
    api.memory.search,
    searchText.length >= 2 ? { searchText, limit: 50 } : "skip"
  );
  const tierOverview = useQuery(api.memoryTiers.overview);
  const tierRecent = useQuery(api.memoryTiers.recent, { limit: 30 });
  const reflectionOverview = useQuery(api.reflections.overview);
  const reflectionRecent = useQuery(api.reflections.recent, { limit: 20 });
  const quality = useQuery(api.memoryQuality.getLatestQuality);

  // New v6.0 queries
  const preflightData = useQuery(api.memoryPreflight.recent, { limit: 20 });
  const preflightStats = useQuery(api.memoryPreflight.stats);
  const durableFacts = useQuery(api.dreaming.recentFacts, { limit: 100 });
  const imports = useQuery(api.conversationImports.recent, { limit: 20 });

  const displayEvents = searchText.length >= 2 ? searchResults : timeline;
  const agents = overview ? Object.keys(overview.byAgent) : [];
  const eventTypes = overview ? Object.keys(overview.byType) : [];

  // Durable facts filtering
  const allDurableCategories = durableFacts
    ? [...new Set(durableFacts.map((f: any) => f.category).filter(Boolean))]
    : [];

  const filteredDurableFacts = (durableFacts ?? []).filter((f: any) => {
    const matchesSearch =
      !durableSearch ||
      (f.factText ?? "").toLowerCase().includes(durableSearch.toLowerCase());
    const matchesCategory =
      !durableCategory || f.category === durableCategory;
    return matchesSearch && matchesCategory;
  });

  // Top memories from preflight records
  const topMemories = preflightData
    ? [...preflightData]
        .sort((a: any, b: any) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
        .slice(0, 10)
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Memory Browser</h1>

      <Tabs defaultValue="episodic">
        <TabsList>
          <TabsTrigger value="episodic">Episodic</TabsTrigger>
          <TabsTrigger value="preflight">Preflight</TabsTrigger>
          <TabsTrigger value="durable">Durable Facts</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
        </TabsList>

        {/* === EPISODIC TAB (all existing content) === */}
        <TabsContent value="episodic">
          <div className="space-y-6 mt-4">
            {/* Index Health */}
            <MemoryIndexHealth />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Memories" value={overview?.total ?? 0} />
              <StatCard label="Event Types" value={eventTypes.length} />
              <StatCard label="Agents" value={agents.length} />
              <StatCard
                label="Recent (24h)"
                value={
                  overview?.recent?.filter(
                    (e: any) => e.timestamp > Date.now() / 1000 - 86400
                  ).length ?? 0
                }
              />
            </div>

            {/* Tier Stats Summary */}
            {tierOverview && tierOverview.totalMemories > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Tiered Memories"
                  value={tierOverview.totalMemories}
                />
                <StatCard
                  label="Avg Token Savings"
                  value={`${tierOverview.avgTokenSavings}%`}
                />
                <StatCard
                  label="LLM Summarized"
                  value={tierOverview.llmSummarized}
                />
                <StatCard
                  label="Heuristic"
                  value={tierOverview.heuristicSummarized}
                />
              </div>
            )}

            {/* Quality Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                label="Dedup Rate"
                value={`${((quality?.deduplicationRate ?? 0) * 100).toFixed(1)}%`}
              />
              <StatCard
                label="Stale Memories"
                value={quality?.staleCount ?? 0}
              />
              <StatCard
                label="Contradictions"
                value={quality?.contradictionCount ?? 0}
              />
            </div>

            {/* Tab Navigation (inner episodic tabs) */}
            <div className="flex gap-1 border-b border-gray-700/50">
              {(
                ["timeline", "tiers", "reflections", "quality"] as TabId[]
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab === "timeline"
                    ? "Timeline"
                    : tab === "tiers"
                      ? "Tier Stats"
                      : tab === "reflections"
                        ? "Reflections"
                        : "Quality"}
                  {tab === "reflections" &&
                  reflectionOverview?.totalReflections ? (
                    <span className="ml-1.5 text-xs bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 rounded-full">
                      {reflectionOverview.totalReflections}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {/* === TIMELINE TAB === */}
            {activeTab === "timeline" && (
              <>
                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                  <input
                    type="text"
                    placeholder="Search memories..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 flex-1 min-w-[200px]"
                  />
                  <select
                    value={filterAgent}
                    onChange={(e) => setFilterAgent(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">All Agents</option>
                    {agents.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">All Types</option>
                    {eventTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type Breakdown */}
                {overview && Object.keys(overview.byType).length > 0 && (
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-gray-300 mb-3">
                      By Type
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(overview.byType).map(([type, count]) => (
                        <button
                          key={type}
                          onClick={() =>
                            setFilterType(type === filterType ? "" : type)
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            type === filterType
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-700/50 text-gray-400 hover:bg-gray-700"
                          }`}
                        >
                          {type}{" "}
                          <span className="text-gray-500 ml-1">
                            {count as number}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-gray-300">
                    {searchText.length >= 2 ? "Search Results" : "Timeline"}
                    <InfoTooltip text="Chronological log of episodic memory events — context snapshots, learnings, and agent observations" />
                  </h2>
                  {!displayEvents || displayEvents.length === 0 ? (
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                      <p className="text-sm text-gray-500">
                        {searchText.length >= 2
                          ? "No memories match your search."
                          : "No episodic events recorded yet."}
                      </p>
                    </div>
                  ) : (
                    displayEvents.map((event: any) => (
                      <div
                        key={event._id}
                        className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-400">
                                {event.eventType}
                              </span>
                              {event.agentId && (
                                <span className="text-xs text-gray-500">
                                  {event.agentId}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-200">
                              {event.summary}
                            </p>
                            {event.detail && (
                              <pre className="mt-2 text-xs text-gray-500 bg-gray-900/50 rounded-lg p-2 overflow-x-auto font-mono">
                                {typeof event.detail === "string"
                                  ? event.detail
                                  : JSON.stringify(event.detail, null, 2)}
                              </pre>
                            )}
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* === TIER STATS TAB === */}
            {activeTab === "tiers" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Tiered Memories"
                    value={tierOverview?.totalMemories ?? 0}
                  />
                  <StatCard
                    label="Avg Token Savings"
                    value={`${tierOverview?.avgTokenSavings ?? 0}%`}
                  />
                  <StatCard
                    label="LLM Summarized"
                    value={tierOverview?.llmSummarized ?? 0}
                  />
                  <StatCard
                    label="Heuristic Fallback"
                    value={tierOverview?.heuristicSummarized ?? 0}
                  />
                </div>

                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-gray-300">
                    Recent Tier Operations
                  </h2>
                  {!tierRecent || tierRecent.length === 0 ? (
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                      <p className="text-sm text-gray-500">
                        No tier stats recorded yet. Memories will show tier data
                        once the summarizer is active.
                      </p>
                    </div>
                  ) : (
                    tierRecent.map((stat: any) => (
                      <div
                        key={stat._id}
                        className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400">
                              {stat.tokenSavingsPercent.toFixed(1)}% saved
                            </span>
                            <span className="text-xs text-gray-400">
                              {stat.contentLength} chars → L0: {stat.l0Length} /
                              L1: {stat.l1Length}
                            </span>
                            {stat.hadLlmSummarizer && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400">
                                LLM
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-600">
                            {formatTimestamp(stat.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* === QUALITY TAB === */}
            {activeTab === "quality" && (
              <SectionErrorBoundary name="Memory Quality">
                <MemoryQualityTab />
              </SectionErrorBoundary>
            )}

            {/* === REFLECTIONS TAB === */}
            {activeTab === "reflections" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Reflections"
                    value={reflectionOverview?.totalReflections ?? 0}
                  />
                  <StatCard
                    label="Memories Extracted"
                    value={reflectionOverview?.totalMemoriesExtracted ?? 0}
                  />
                  <StatCard
                    label="Avg Confidence"
                    value={
                      reflectionOverview?.avgConfidence?.toFixed(2) ?? "0"
                    }
                  />
                  <StatCard
                    label="Last Reflection"
                    value={
                      reflectionOverview?.lastReflectionAt
                        ? formatTimestamp(reflectionOverview.lastReflectionAt)
                        : "Never"
                    }
                  />
                </div>

                {/* Category Breakdown */}
                {reflectionOverview?.categoryBreakdown &&
                  Object.keys(reflectionOverview.categoryBreakdown).length >
                    0 && (
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                      <h2 className="text-sm font-semibold text-gray-300 mb-3">
                        Category Breakdown
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(
                          reflectionOverview.categoryBreakdown
                        ).map(([cat, count]) => (
                          <span
                            key={cat}
                            className="px-3 py-1.5 rounded-lg text-xs bg-gray-700/50 text-gray-300"
                          >
                            {cat}{" "}
                            <span className="text-gray-500 ml-1">
                              {count as number}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Recent Reflections */}
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-gray-300">
                    Recent Reflections
                  </h2>
                  {!reflectionRecent || reflectionRecent.length === 0 ? (
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                      <p className="text-sm text-gray-500">
                        No reflections yet. The reflection engine will analyze
                        episodic events to extract durable insights.
                      </p>
                    </div>
                  ) : (
                    reflectionRecent.map((r: any) => (
                      <div
                        key={r._id}
                        className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-400">
                                {r.agentId}
                              </span>
                              <span className="text-xs text-gray-400">
                                {r.eventsAnalyzed} events →{" "}
                                {r.memoriesExtracted} memories
                              </span>
                              <span className="text-xs text-gray-500">
                                confidence: {r.avgConfidence.toFixed(2)}
                              </span>
                            </div>
                            {r.categories && (
                              <div className="flex gap-1 mt-1">
                                {Object.entries(r.categories).map(
                                  ([cat, count]) => (
                                    <span
                                      key={cat}
                                      className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400"
                                    >
                                      {cat}: {count as number}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {formatTimestamp(r.timestamp)} ({r.reflectionDurationMs}
                            ms)
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* === PREFLIGHT TAB === */}
        <TabsContent value="preflight">
          <SectionErrorBoundary name="Memory Preflight">
            <div className="space-y-6 mt-4">
              {!preflightStats ||
              (preflightStats.totalRecords === 0 &&
                (!preflightData || preflightData.length === 0)) ? (
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No preflight data yet. Preflight activates once Memory
                    Intelligence is enabled and a conversation is processed.
                  </p>
                </div>
              ) : (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassPanel className="rounded-xl">
                      <MetricCard
                        label="Hit Rate"
                        value={`${((preflightStats?.hitRate ?? 0) * 100).toFixed(1)}%`}
                        numericValue={(preflightStats?.hitRate ?? 0) * 100}
                        format={(v) => `${v.toFixed(1)}%`}
                        threshold={{
                          ok: 70,
                          warn: 40,
                          invertDirection: true,
                        }}
                      />
                    </GlassPanel>
                    <GlassPanel className="rounded-xl">
                      <MetricCard
                        label="Avg Latency (ms)"
                        value={`${(preflightStats?.avgLatencyMs ?? 0).toFixed(0)}ms`}
                        numericValue={preflightStats?.avgLatencyMs ?? 0}
                        format={(v) => `${v.toFixed(0)}ms`}
                        threshold={{ ok: 100, warn: 300 }}
                      />
                    </GlassPanel>
                  </div>

                  {/* Top 10 matched memories */}
                  <div className="space-y-2">
                    <SectionHeader title="Top Matched Memories" />
                    {topMemories.length === 0 ? (
                      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          No memory hit data yet.
                        </p>
                      </div>
                    ) : (
                      <GlassPanel className="rounded-xl overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">Rank</TableHead>
                              <TableHead>Memory ID</TableHead>
                              <TableHead className="text-right">
                                Hit Count
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {topMemories.map((record: any, i: number) => (
                              <TableRow key={record._id}>
                                <TableCell className="text-muted-foreground tabular-nums">
                                  {i + 1}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-gray-300 truncate max-w-xs">
                                  {record.memoryId ?? record._id}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm">
                                  {record.hitCount ?? 0}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </GlassPanel>
                    )}
                  </div>
                </>
              )}
            </div>
          </SectionErrorBoundary>
        </TabsContent>

        {/* === DURABLE FACTS TAB === */}
        <TabsContent value="durable">
          <SectionErrorBoundary name="Durable Facts">
            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-3">
                <Input
                  placeholder="Search durable facts..."
                  value={durableSearch}
                  onChange={(e) => setDurableSearch(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                {allDurableCategories.length > 0 && (
                  <select
                    value={durableCategory}
                    onChange={(e) => setDurableCategory(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">All Categories</option>
                    {allDurableCategories.map((cat) => (
                      <option key={cat as string} value={cat as string}>
                        {cat as string}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {!durableFacts || durableFacts.length === 0 ? (
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No durable facts extracted yet. Run a dreaming cycle to
                    extract long-term facts from your conversation history.
                  </p>
                </div>
              ) : filteredDurableFacts.length === 0 ? (
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
                      {filteredDurableFacts.map((fact: any) => (
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

        {/* === IMPORTS TAB === */}
        <TabsContent value="imports">
          <SectionErrorBoundary name="Conversation Imports">
            <div className="space-y-6 mt-4">
              <div className="flex justify-end">
                {/* Requires Astridr endpoint — non-functional in Phase 63 */}
                <Button disabled className="cursor-not-allowed opacity-60">
                  Import Conversations
                </Button>
              </div>

              {!imports || imports.length === 0 ? (
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No conversation imports yet. Use Import Conversations to
                    bring in ChatGPT, Claude Code, or markdown exports.
                  </p>
                </div>
              ) : (
                <GlassPanel className="rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Import ID</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">
                          Conversations
                        </TableHead>
                        <TableHead className="text-right">
                          Memories Created
                        </TableHead>
                        <TableHead className="text-right">Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {imports.map((imp: any) => (
                        <TableRow key={imp._id}>
                          <TableCell className="font-mono text-xs text-gray-300 max-w-[120px] truncate">
                            {imp._id}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status="idle"
                              label={(imp.source ?? "unknown").toUpperCase()}
                            />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={imp.status ?? "idle"} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {imp.conversationCount ?? 0}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {imp.memoriesCreated ?? 0}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                            {imp.timestamp
                              ? formatRelative(imp.timestamp)
                              : formatRelative(
                                  imp._creationTime / 1000
                                )}
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
      </Tabs>
    </div>
  );
}
