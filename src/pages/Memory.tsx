import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import MemoryIndexHealth from "../components/MemoryIndexHealth";

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
          {searchText.length >= 2 ? "Search Results" : "Timeline"}
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
    </div>
  );
}
