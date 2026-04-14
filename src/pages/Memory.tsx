import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import MemoryIndexHealth from "../components/MemoryIndexHealth";
import InfoTooltip from "../components/InfoTooltip";
import MemoryQualityTab from "../components/MemoryQualityTab";
import SectionErrorBoundary from "../components/SectionErrorBoundary";

type TabId = "timeline" | "tiers" | "reflections" | "quality";

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
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

  const displayEvents = searchText.length >= 2 ? searchResults : timeline;
  const agents = overview ? Object.keys(overview.byAgent) : [];
  const eventTypes = overview ? Object.keys(overview.byType) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Memory Browser</h1>

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
          <StatCard label="Tiered Memories" value={tierOverview.totalMemories} />
          <StatCard label="Avg Token Savings" value={`${tierOverview.avgTokenSavings}%`} />
          <StatCard label="LLM Summarized" value={tierOverview.llmSummarized} />
          <StatCard label="Heuristic" value={tierOverview.heuristicSummarized} />
        </div>
      )}

      {/* Quality Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Dedup Rate" value={`${((quality?.deduplicationRate ?? 0) * 100).toFixed(1)}%`} />
        <StatCard label="Stale Memories" value={quality?.staleCount ?? 0} />
        <StatCard label="Contradictions" value={quality?.contradictionCount ?? 0} />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-700/50">
        {(["timeline", "tiers", "reflections", "quality"] as TabId[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "timeline" ? "Timeline" : tab === "tiers" ? "Tier Stats" : tab === "reflections" ? "Reflections" : "Quality"}
            {tab === "reflections" && reflectionOverview?.totalReflections ? (
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
              <h2 className="text-sm font-semibold text-gray-300 mb-3">By Type</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(overview.byType).map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type === filterType ? "" : type)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      type === filterType
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-700/50 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {type}{" "}
                    <span className="text-gray-500 ml-1">{count as number}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-300">
              {searchText.length >= 2 ? "Search Results" : "Timeline"}<InfoTooltip text="Chronological log of episodic memory events — context snapshots, learnings, and agent observations" />
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
                      <p className="text-sm text-gray-200">{event.summary}</p>
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
            <StatCard label="Tiered Memories" value={tierOverview?.totalMemories ?? 0} />
            <StatCard label="Avg Token Savings" value={`${tierOverview?.avgTokenSavings ?? 0}%`} />
            <StatCard label="LLM Summarized" value={tierOverview?.llmSummarized ?? 0} />
            <StatCard label="Heuristic Fallback" value={tierOverview?.heuristicSummarized ?? 0} />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-300">Recent Tier Operations</h2>
            {!tierRecent || tierRecent.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                <p className="text-sm text-gray-500">No tier stats recorded yet. Memories will show tier data once the summarizer is active.</p>
              </div>
            ) : (
              tierRecent.map((stat: any) => (
                <div key={stat._id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400">
                        {stat.tokenSavingsPercent.toFixed(1)}% saved
                      </span>
                      <span className="text-xs text-gray-400">
                        {stat.contentLength} chars → L0: {stat.l0Length} / L1: {stat.l1Length}
                      </span>
                      {stat.hadLlmSummarizer && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400">LLM</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-600">{formatTimestamp(stat.timestamp)}</span>
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
            <StatCard label="Total Reflections" value={reflectionOverview?.totalReflections ?? 0} />
            <StatCard label="Memories Extracted" value={reflectionOverview?.totalMemoriesExtracted ?? 0} />
            <StatCard label="Avg Confidence" value={reflectionOverview?.avgConfidence?.toFixed(2) ?? "0"} />
            <StatCard
              label="Last Reflection"
              value={reflectionOverview?.lastReflectionAt ? formatTimestamp(reflectionOverview.lastReflectionAt) : "Never"}
            />
          </div>

          {/* Category Breakdown */}
          {reflectionOverview?.categoryBreakdown && Object.keys(reflectionOverview.categoryBreakdown).length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Category Breakdown</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(reflectionOverview.categoryBreakdown).map(([cat, count]) => (
                  <span key={cat} className="px-3 py-1.5 rounded-lg text-xs bg-gray-700/50 text-gray-300">
                    {cat} <span className="text-gray-500 ml-1">{count as number}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Reflections */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-300">Recent Reflections</h2>
            {!reflectionRecent || reflectionRecent.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
                <p className="text-sm text-gray-500">No reflections yet. The reflection engine will analyze episodic events to extract durable insights.</p>
              </div>
            ) : (
              reflectionRecent.map((r: any) => (
                <div key={r._id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-400">
                          {r.agentId}
                        </span>
                        <span className="text-xs text-gray-400">
                          {r.eventsAnalyzed} events → {r.memoriesExtracted} memories
                        </span>
                        <span className="text-xs text-gray-500">
                          confidence: {r.avgConfidence.toFixed(2)}
                        </span>
                      </div>
                      {r.categories && (
                        <div className="flex gap-1 mt-1">
                          {Object.entries(r.categories).map(([cat, count]) => (
                            <span key={cat} className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                              {cat}: {count as number}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 whitespace-nowrap">
                      {formatTimestamp(r.timestamp)} ({r.reflectionDurationMs}ms)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
