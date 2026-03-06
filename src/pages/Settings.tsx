import { useState } from "react";
import { useAgentProfiles } from "../hooks/useAgentProfiles";
import { useAvatars } from "../hooks/useAvatars";
import AgentAvatar from "../components/AgentAvatar";
import AgentProfileEditor from "../components/AgentProfileEditor";

export default function Settings() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "Not configured";
  const profiles = useAgentProfiles();
  const avatars = useAvatars();
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);

  const getAvatar = (avatarId?: string) => {
    if (!avatarId) return null;
    return avatars.find((a: any) => a._id === avatarId) ?? null;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Connection</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Convex URL</span>
            <span className="font-mono text-gray-300 text-xs">{convexUrl}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Deployment</span>
            <span className="font-mono text-gray-300 text-xs">dev:ideal-sandpiper-297</span>
          </div>
        </div>
      </div>

      {/* Agent Profiles Section */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Agent Profiles</h2>
          {!creatingProfile && !editingProfile && (
            <button
              onClick={() => setCreatingProfile(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs"
            >
              New Profile
            </button>
          )}
        </div>

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
          <div className="space-y-2">
            {profiles.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No agent profiles yet. Create one to get started.
              </p>
            ) : (
              profiles.map((p: any) => (
                <div
                  key={p._id}
                  className="flex items-center gap-3 bg-gray-900/30 rounded-lg px-3 py-2"
                >
                  <AgentAvatar avatar={getAvatar(p.avatarId)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">
                      {p.displayName || p.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {p.profileId} {p.model ? `/ ${p.model}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingProfile(p)}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded-lg text-xs"
                  >
                    Edit
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Hooks</h2>
        <p className="text-sm text-gray-500">
          Configure Claude Code hooks to point to CodePulse for live telemetry.
        </p>
        <pre className="mt-3 bg-gray-900/50 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto font-mono">{`// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [{ "command": "node hooks/dispatch.mjs" }],
    "PostToolUse": [{ "command": "node hooks/dispatch.mjs" }],
    "SessionStart": [{ "command": "node hooks/scanner.mjs" }]
  }
}`}</pre>
      </div>

      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">About</h2>
        <div className="space-y-1 text-sm text-gray-500">
          <p>CodePulse v0.1.0</p>
          <p>Phase 1 + 2 — Foundation + Dashboard Components</p>
        </div>
      </div>
    </div>
  );
}
