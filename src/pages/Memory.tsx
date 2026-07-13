import { useState, useRef } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { Skeleton } from "../components/ui/skeleton";
import MemoryIndexHealth from "../components/MemoryIndexHealth";
import InfoTooltip from "../components/InfoTooltip";
import MemoryQualityTab from "../components/MemoryQualityTab";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { SectionHeader } from "@/components/SectionHeader";
import { GlassPanel } from "@/components/GlassPanel";
import { StatusBadge } from "@/components/StatusBadge";
import MetricCard, { AnimatedNumber } from "@/components/MetricCard";
import { ObsidianGraph } from "../components/ObsidianGraph";
import { getStoredVaultDirectory, requestVaultDirectory, parseVault, GraphData } from "../lib/obsidian";
import { useEffect } from "react";
import { FactsTable } from "@/components/FactsTable";
import { PageHeader } from "@/components/PageHeader";

type TabId = "timeline" | "tiers" | "reflections" | "quality";
type MemoryTab = "episodic" | "preflight" | "durable" | "imports" | "obsidian";

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

function StatCard({ label, value }: { label: string; value: React.ReactNode | number | undefined }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <div className="text-2xl font-semibold text-foreground">
        {value === undefined ? <Skeleton className="h-8 w-16 bg-primary/10" /> : value}
      </div>
    </div>
  );
}

export default function Memory() {
  const [searchText, setSearchText] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterType, setFilterType] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("timeline");
  const [searchParams] = useSearchParams();
  const [durableSearch, setDurableSearch] = useState("");
  const [durableCategory, setDurableCategory] = useState("");

  const [obsidianData, setObsidianData] = useState<GraphData | null>(null);
  const [obsidianError, setObsidianError] = useState<string>("");
  const [isObsidianLoading, setIsObsidianLoading] = useState(false);
  const [vaultConnected, setVaultConnected] = useState(false);

  useEffect(() => {
    async function initObsidian() {
      try {
        const handle = await getStoredVaultDirectory();
        if (handle) {
          setVaultConnected(true);
          setIsObsidianLoading(true);
          const data = await parseVault(handle);
          setObsidianData(data);
        }
      } catch (err: any) {
        setObsidianError(err.message || "Failed to load stored vault.");
      } finally {
        setIsObsidianLoading(false);
      }
    }
    initObsidian();
  }, []);

  async function handleConnectVault() {
    try {
      setObsidianError("");
      setIsObsidianLoading(true);
      const handle = await requestVaultDirectory();
      setVaultConnected(true);
      const data = await parseVault(handle);
      setObsidianData(data);
    } catch (err: any) {
      setObsidianError(err.message || "Failed to connect vault.");
    } finally {
      setIsObsidianLoading(false);
    }
  }

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

  // Deep-link: ?event=<id> arrives from KG provenance links (KGDetailsPanel —
  // "Open the episodic memory that taught this fact"). Focus + scroll to that
  // event in the timeline so the cross-nav lands on the right memory.
  const focusEventId = searchParams.get("event");
  const focusedEventRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (focusEventId) setActiveTab("timeline");
  }, [focusEventId]);
  useEffect(() => {
    if (focusEventId && focusedEventRef.current) {
      focusedEventRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [focusEventId, displayEvents]);

  // Durable facts filtering
  const allDurableCategories = durableFacts
    ? [...new Set(durableFacts.map((f: any) => f.category).filter(Boolean))]
    : [];

  // Top memories from preflight records
  const topMemories = preflightData
    ? [...preflightData]
        .sort((a: any, b: any) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
        .slice(0, 10)
    : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
      <div className="md:col-span-12">
        <PageHeader title="Memory" />
      </div>

      <div className="md:col-span-12">
      <Tabs defaultValue="episodic">
        <TabsList>
          <TabsTrigger value="episodic">Episodic</TabsTrigger>
          <TabsTrigger value="preflight">Preflight</TabsTrigger>
          <TabsTrigger value="durable">Durable Facts</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
          <TabsTrigger value="obsidian">Obsidian</TabsTrigger>
        </TabsList>

        {/* === EPISODIC TAB (all existing content) === */}
        <TabsContent value="episodic">
          <div className="space-y-6 mt-4">
            {/* Index Health */}
            <MemoryIndexHealth />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Memories" value={overview === undefined ? undefined : (overview?.total ?? 0)} />
              <StatCard label="Event Types" value={overview === undefined ? undefined : eventTypes.length} />
              <StatCard label="Agents" value={overview === undefined ? undefined : agents.length} />
              <StatCard
                label="Recent (24h)"
                value={
                  overview === undefined ? undefined :
                  (overview?.recent?.filter(
                    (e: any) => e.timestamp > Date.now() / 1000 - 86400
                  ).length ?? 0)
                }
              />
            </div>

            {tierOverview === undefined ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Tiered Memories" value={undefined} />
                <StatCard label="Avg Token Savings" value={undefined} />
                <StatCard label="LLM Summarized" value={undefined} />
                <StatCard label="Heuristic" value={undefined} />
              </div>
            ) : tierOverview && tierOverview.totalMemories > 0 ? (
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
            ) : null}

            {/* Quality Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                label="Dedup Rate"
                value={quality === undefined ? undefined : `${((quality?.deduplicationRate ?? 0) * 100).toFixed(1)}%`}
              />
              <StatCard
                label="Stale Memories"
                value={quality === undefined ? undefined : (quality?.staleCount ?? 0)}
              />
              <StatCard
                label="Contradictions"
                value={quality === undefined ? undefined : (quality?.contradictionCount ?? 0)}
              />
            </div>

            {/* Tab Navigation (inner episodic tabs) */}
            <div className="flex gap-1 border-b border-border">
              {(
                ["timeline", "tiers", "reflections", "quality"] as TabId[]
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-base font-medium transition-colors border-b-2 ${
                    activeTab === tab
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-muted-foreground hover:text-foreground"
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
                    <span className="ml-1.5 text-sm bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 rounded-full">
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
                    className="bg-card border border-border rounded-lg px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 flex-1 min-w-[200px]"
                  />
                  <select
                    value={filterAgent}
                    onChange={(e) => setFilterAgent(e.target.value)}
                    className="bg-card border border-border rounded-lg px-3 py-2 text-base text-foreground focus:outline-none focus:border-indigo-500"
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
                    className="bg-card border border-border rounded-lg px-3 py-2 text-base text-foreground focus:outline-none focus:border-indigo-500"
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
                  <div className="bg-card border border-border rounded-xl p-4">
                    <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
                      By Type
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(overview.byType).map(([type, count]) => (
                        <button
                          key={type}
                          onClick={() =>
                            setFilterType(type === filterType ? "" : type)
                          }
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            type === filterType
                              ? "bg-indigo-600 text-white"
                              : "bg-muted text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {type}{" "}
                          <span className="text-muted-foreground ml-1">
                            {count as number}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-2">
                  <h2 className="text-base font-semibold text-muted-foreground">
                    {searchText.length >= 2 ? "Search Results" : "Timeline"}
                    <InfoTooltip text="Chronological log of episodic memory events — context snapshots, learnings, and agent observations" />
                  </h2>
                  {!displayEvents || displayEvents.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                      <p className="text-base text-muted-foreground">
                        {searchText.length >= 2
                          ? "No memories match your search."
                          : "No episodic events recorded yet."}
                      </p>
                    </div>
                  ) : (
                    <div className="relative max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                      {/* Vertical connector line */}
                      <div className="absolute left-[11px] top-4 bottom-4 w-px bg-indigo-500/20" />
                      
                      <div className="space-y-4">
                        {displayEvents.map((event: any) => {
                          const isFocused =
                            !!focusEventId && event._id === focusEventId;
                          return (
                          <div
                            key={event._id}
                            ref={isFocused ? focusedEventRef : undefined}
                            data-event-id={event._id}
                            data-focused={isFocused ? "true" : undefined}
                            className="relative pl-8 group"
                          >
                            {/* Dot on the timeline */}
                            <div className="absolute left-[11px] top-3.5 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-background group-hover:bg-indigo-400 group-hover:shadow-[0_0_8px_rgba(99,102,241,0.6)] transition-all" />

                            <div className={`bg-card border transition-colors rounded-lg p-3 ${
                              isFocused
                                ? "border-indigo-500 ring-2 ring-indigo-500/50"
                                : "border-border hover:bg-accent hover:border-indigo-500/30"
                            }`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-400 uppercase tracking-wider">
                                      {event.eventType}
                                    </span>
                                    {event.agentId && (
                                      <span className="text-sm text-muted-foreground font-mono">
                                        {event.agentId}
                                      </span>
                                    )}
                                    <span className="text-base text-foreground ml-1">
                                      {event.summary}
                                    </span>
                                  </div>
                                  {event.detail && (
                                    <pre className="mt-2 text-sm text-muted-foreground bg-background rounded p-2 overflow-x-auto font-mono whitespace-pre-wrap max-h-32 custom-scrollbar">
                                      {typeof event.detail === "string"
                                        ? event.detail
                                        : JSON.stringify(event.detail)}
                                    </pre>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 font-mono">
                                  {formatTimestamp(event.timestamp)}
                                </span>
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
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
                  <h2 className="text-base font-semibold text-muted-foreground">
                    Recent Tier Operations
                  </h2>
                  {!tierRecent || tierRecent.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                      <p className="text-base text-muted-foreground">
                        No tier stats recorded yet. Memories will show tier data
                        once the summarizer is active.
                      </p>
                    </div>
                  ) : (
                    tierRecent.map((stat: any) => (
                      <div
                        key={stat._id}
                        className="bg-card border border-border rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400">
                              {stat.tokenSavingsPercent.toFixed(1)}% saved
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {stat.contentLength} chars → L0: {stat.l0Length} /
                              L1: {stat.l1Length}
                            </span>
                            {stat.hadLlmSummarizer && (
                              <span className="text-sm px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400">
                                LLM
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
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
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
                        Category Breakdown
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(
                          reflectionOverview.categoryBreakdown
                        ).map(([cat, count]) => (
                          <span
                            key={cat}
                            className="px-3 py-1.5 rounded-lg text-sm bg-muted text-muted-foreground"
                          >
                            {cat}{" "}
                            <span className="text-muted-foreground ml-1">
                              {count as number}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Recent Reflections */}
                <div className="space-y-2">
                  <h2 className="text-base font-semibold text-muted-foreground">
                    Recent Reflections
                  </h2>
                  {!reflectionRecent || reflectionRecent.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                      <p className="text-base text-muted-foreground">
                        No reflections yet. The reflection engine will analyze
                        episodic events to extract durable insights.
                      </p>
                    </div>
                  ) : (
                    reflectionRecent.map((r: any) => (
                      <div
                        key={r._id}
                        className="bg-card border border-border rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-400">
                                {r.agentId}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {r.eventsAnalyzed} events →{" "}
                                {r.memoriesExtracted} memories
                              </span>
                              <span className="text-sm text-muted-foreground">
                                confidence: {r.avgConfidence.toFixed(2)}
                              </span>
                            </div>
                            {r.categories && (
                              <div className="flex gap-1 mt-1">
                                {Object.entries(r.categories).map(
                                  ([cat, count]) => (
                                    <span
                                      key={cat}
                                      className="text-sm px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                                    >
                                      {cat}: {count as number}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
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
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <p className="text-base text-muted-foreground">
                    No preflight data yet. Preflight activates once Memory
                    Intelligence is enabled and a conversation is processed.
                  </p>
                </div>
              ) : (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassPanel className="rounded-xl hover:scale-[1.01] transition-transform duration-300">
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
                    <GlassPanel className="rounded-xl hover:scale-[1.01] transition-transform duration-300">
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
                      <div className="bg-card border border-border rounded-xl p-6 text-center">
                        <p className="text-base text-muted-foreground">
                          No memory hit data yet.
                        </p>
                      </div>
                    ) : (
                      <GlassPanel className="rounded-xl overflow-hidden hover:scale-[1.01] transition-transform duration-300">
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
                                <TableCell className="font-mono text-sm text-muted-foreground truncate max-w-xs">
                                  {record.memoryId ?? record._id}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-base">
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
          <FactsTable
            facts={durableFacts}
            search={durableSearch}
            onSearchChange={setDurableSearch}
            category={durableCategory}
            onCategoryChange={setDurableCategory}
            categories={allDurableCategories as string[]}
            sectionName="Durable Facts"
          />
        </TabsContent>

        {/* === IMPORTS TAB === */}
        <TabsContent value="imports">
          <SectionErrorBoundary name="Conversation Imports">
            <div className="space-y-6 mt-4">
              {!imports || imports.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <p className="text-base text-muted-foreground">
                    No conversation imports yet. Importing ChatGPT, Claude
                    Code, or markdown exports requires an Ástríðr endpoint
                    that isn't available yet.
                  </p>
                </div>
              ) : (
                <GlassPanel className="rounded-xl overflow-hidden hover:scale-[1.01] transition-transform duration-300">
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
                          <TableCell className="font-mono text-sm text-muted-foreground max-w-[120px] truncate">
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
                          <TableCell className="text-right tabular-nums text-base">
                            {imp.conversationCount ?? 0}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-base">
                            {imp.memoriesCreated ?? 0}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
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

        {/* === OBSIDIAN TAB === */}
        <TabsContent value="obsidian">
          <SectionErrorBoundary name="Obsidian Graph">
            <div className="space-y-6 mt-4">
              {!vaultConnected ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">Connect your Obsidian Vault</h3>
                    <p className="text-base text-muted-foreground mt-2 max-w-md mx-auto">
                      Select your local Obsidian vault folder to visualize your notes as a fully interactive network graph directly in CodePulse. Everything stays local.
                    </p>
                  </div>
                  {obsidianError && (
                    <p className="text-base text-red-400">{obsidianError}</p>
                  )}
                  <Button onClick={handleConnectVault} disabled={isObsidianLoading} className="mt-2">
                    {isObsidianLoading ? "Connecting..." : "Select Folder"}
                  </Button>
                </div>
              ) : (
                <GlassPanel className="rounded-xl overflow-hidden p-0 relative hover:scale-[1.01] transition-transform duration-300">
                  <div className="absolute top-4 left-4 z-10 flex gap-2">
                    <Button variant="secondary" size="sm" onClick={handleConnectVault}>
                      Change Vault
                    </Button>
                  </div>
                  {isObsidianLoading && !obsidianData ? (
                    <div className="h-[600px] flex items-center justify-center">
                      <p className="text-muted-foreground animate-pulse">Parsing vault files...</p>
                    </div>
                  ) : obsidianData ? (
                    <ObsidianGraph data={obsidianData} />
                  ) : null}
                </GlassPanel>
              )}
            </div>
          </SectionErrorBoundary>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
