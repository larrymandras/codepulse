import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAllAgents } from "../hooks/useAgentTopology";
import { useAgentProfiles } from "../hooks/useAgentProfiles";
import { useAvatars } from "../hooks/useAvatars";
import AgentAvatar from "../components/AgentAvatar";
import AgentTopology from "../components/AgentTopology";
import AgentDetailPanel from "../components/AgentDetailPanel";
import AgentProfileEditor from "../components/AgentProfileEditor";
import MetricCard from "../components/MetricCard";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { formatDuration } from "../lib/formatters";
import type { AgentProfile, Avatar } from "../types";

type Tab = "registry" | "runtime" | "topology";
type StatusFilter = "all" | "running" | "completed" | "failed";

const STATUS_BADGE: Record<string, string> = {
  running: "bg-green-500/20 text-green-400",
  completed: "bg-yellow-500/20 text-yellow-400",
  failed: "bg-red-500/20 text-red-400",
};

const AVATAR_STATUS: Record<
  string,
  "active" | "working" | "idle" | "completed" | "error"
> = {
  running: "active",
  completed: "completed",
  failed: "error",
};

export default function Agents() {
  const allAgents = useAllAgents();
  const profiles = useAgentProfiles();
  const avatars = useAvatars();
  const seedTeams = useMutation(api.seedTeams.seed);

  const [tab, setTab] = useState<Tab>("registry");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<AgentProfile | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const seedInFlight = useRef(false);

  // Auto-seed teams on first load if no profiles exist
  useEffect(() => {
    if (profiles.length === 0 && !seedInFlight.current) {
      seedInFlight.current = true;
      setSeeding(true);
      seedTeams({})
        .then(() => setSeeding(false))
        .catch(() => setSeeding(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.length]);

  const counts = useMemo(() => {
    const c = { running: 0, completed: 0, failed: 0 };
    for (const a of allAgents) {
      const s = a.status as keyof typeof c;
      if (s in c) c[s]++;
    }
    return c;
  }, [allAgents]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? allAgents
        : allAgents.filter((a) => a.status === filter),
    [allAgents, filter],
  );

  // Avatar lookup
  const avatarMap = useMemo(() => {
    const map: Record<string, Avatar> = {};
    for (const a of avatars) {
      map[a._id] = a as Avatar;
    }
    return map;
  }, [avatars]);

  const now = Date.now() / 1000;

  const tabs: { label: string; value: Tab; count?: number }[] = [
    { label: "Registry", value: "registry", count: profiles.length },
    { label: "Runtime Agents", value: "runtime", count: allAgents.length },
    { label: "Topology", value: "topology" },
  ];

  const statusFilters: {
    label: string;
    value: StatusFilter;
    count: number;
    dot: string;
  }[] = [
    { label: "All", value: "all", count: allAgents.length, dot: "" },
    {
      label: "Running",
      value: "running",
      count: counts.running,
      dot: "bg-green-400",
    },
    {
      label: "Completed",
      value: "completed",
      count: counts.completed,
      dot: "bg-yellow-400",
    },
    {
      label: "Failed",
      value: "failed",
      count: counts.failed,
      dot: "bg-red-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Agents</h1>
          <p className="text-xs text-gray-500 mt-1">
            Agent registry, runtime instances, and coordination topology
          </p>
        </div>
        {tab === "registry" && !editingProfile && !creatingProfile && (
          <button
            onClick={() => setCreatingProfile(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs"
          >
            New Profile
          </button>
        )}
      </div>

      {/* Summary Metrics */}
      <SectionErrorBoundary name="Agent Metrics">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Registered Teams" value={profiles.length} />
          <MetricCard label="Runtime Agents" value={allAgents.length} />
          <MetricCard label="Running" value={counts.running} />
          <MetricCard label="Failed" value={counts.failed} />
        </div>
      </SectionErrorBoundary>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-700/50 pb-px">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === t.value
                ? "border-indigo-500 text-gray-100"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-[10px] text-gray-500">
                ({t.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* === REGISTRY TAB === */}
      {tab === "registry" && (
        <SectionErrorBoundary name="Agent Registry">
        <div className="space-y-4">
          {creatingProfile && (
            <AgentProfileEditor
              onSave={() => setCreatingProfile(false)}
              onCancel={() => setCreatingProfile(false)}
            />
          )}

          {editingProfile && (
            <AgentProfileEditor
              profile={editingProfile}
              onSave={() => setEditingProfile(null)}
              onCancel={() => setEditingProfile(null)}
            />
          )}

          {!creatingProfile && !editingProfile && (
            <>
              {seeding && profiles.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-400 text-sm">
                    Seeding Astridr build teams...
                  </p>
                </div>
              ) : profiles.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-500 text-sm">
                    No agent profiles registered yet
                  </p>
                  <button
                    onClick={() => {
                      setSeeding(true);
                      seedTeams({})
                        .then(() => setSeeding(false))
                        .catch(() => setSeeding(false));
                    }}
                    className="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Seed Default Teams
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {profiles.map((profile) => {
                    const avatar = profile.avatarId
                      ? avatarMap[profile.avatarId]
                      : null;

                    // Count runtime agents matching this profile
                    const runtimeCount = allAgents.filter(
                      (a) =>
                        a.agentType === profile.profileId ||
                        a.agentType === profile.name,
                    ).length;
                    const runningCount = allAgents.filter(
                      (a) =>
                        (a.agentType === profile.profileId ||
                          a.agentType === profile.name) &&
                        a.status === "running",
                    ).length;

                    return (
                      <div
                        key={profile._id}
                        className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition-colors group"
                      >
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-3">
                          <AgentAvatar
                            avatar={
                              avatar ?? { name: profile.name }
                            }
                            status={
                              runningCount > 0 ? "active" : "idle"
                            }
                            size="md"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-100 truncate">
                              {profile.displayName ?? profile.name}
                            </h3>
                            <p className="text-[10px] text-gray-500 font-mono">
                              {profile.profileId}
                            </p>
                          </div>
                          <button
                            onClick={() => setEditingProfile(profile)}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 text-xs transition-opacity"
                          >
                            Edit
                          </button>
                        </div>

                        {/* Model badge */}
                        {profile.model && (
                          <div className="mb-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400">
                              {profile.model}
                            </span>
                          </div>
                        )}

                        {/* Avatar description & capabilities */}
                        {avatar?.description && (
                          <p className="text-xs text-gray-400 mb-2">
                            {avatar.description}
                          </p>
                        )}

                        {avatar?.capabilities &&
                          avatar.capabilities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {avatar.capabilities.map(
                                (cap: string) => (
                                  <span
                                    key={cap}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700/40 text-gray-400"
                                  >
                                    {cap}
                                  </span>
                                ),
                              )}
                            </div>
                          )}

                        {/* Runtime stats */}
                        <div className="flex items-center gap-3 pt-2 border-t border-gray-700/30 text-[10px] text-gray-500">
                          <span>
                            {runtimeCount} instance
                            {runtimeCount !== 1 ? "s" : ""}
                          </span>
                          {runningCount > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                              {runningCount} active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        </SectionErrorBoundary>
      )}

      {/* === RUNTIME TAB === */}
      {tab === "runtime" && (
        <SectionErrorBoundary name="Runtime Agents">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-300">
              Runtime Instances
            </h2>
            <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-700/30 rounded-lg p-0.5">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors ${
                    filter === f.value
                      ? "bg-gray-700 text-gray-100"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {f.dot && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${f.dot}`}
                    />
                  )}
                  {f.label}
                  <span className="text-gray-500 text-[10px]">
                    ({f.count})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 text-sm">No agents found</p>
              <p className="text-gray-600 text-xs mt-1">
                Agents will appear here once Astridr starts processing
                sessions
              </p>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                {filtered.map((agent) => {
                  const dur =
                    agent.endedAt && agent.startedAt
                      ? formatDuration(
                          agent.endedAt - agent.startedAt,
                        )
                      : agent.startedAt
                        ? formatDuration(now - agent.startedAt)
                        : "—";
                  const isSelected =
                    selectedAgent === agent.agentId;

                  return (
                    <button
                      key={agent.agentId ?? agent._id}
                      onClick={() =>
                        setSelectedAgent((prev) =>
                          prev === agent.agentId
                            ? null
                            : agent.agentId,
                        )
                      }
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        isSelected
                          ? "bg-indigo-600/10 border border-indigo-500/30"
                          : "bg-gray-900/30 border border-transparent hover:bg-gray-900/60"
                      }`}
                    >
                      <AgentAvatar
                        avatar={{ name: agent.agentId }}
                        status={
                          AVATAR_STATUS[agent.status] ?? "idle"
                        }
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-200 truncate font-medium">
                            {agent.agentId}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                              STATUS_BADGE[agent.status] ??
                              "bg-gray-700/50 text-gray-400"
                            }`}
                          >
                            {agent.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                          <span>{agent.agentType}</span>
                          {agent.model && (
                            <>
                              <span>&middot;</span>
                              <span className="text-gray-400">
                                {agent.model}
                              </span>
                            </>
                          )}
                          <span>&middot;</span>
                          <span>{dur}</span>
                        </div>
                      </div>
                      <svg
                        className="w-4 h-4 text-gray-600 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  );
                })}
              </div>

              {selectedAgent && (
                <div className="shrink-0">
                  <AgentDetailPanel
                    agentId={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        </SectionErrorBoundary>
      )}

      {/* === TOPOLOGY TAB === */}
      {tab === "topology" && (
        <SectionErrorBoundary name="Agent Topology">
          <AgentTopology />
        </SectionErrorBoundary>
      )}
    </div>
  );
}
