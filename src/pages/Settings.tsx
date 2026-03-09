import { useState } from "react";
import { useAgentProfiles } from "../hooks/useAgentProfiles";
import { useAvatars } from "../hooks/useAvatars";
import { usePrivacy } from "../contexts/PrivacyContext";
import { useAmbient } from "../contexts/AmbientContext";
import AgentAvatar from "../components/AgentAvatar";
import AgentProfileEditor from "../components/AgentProfileEditor";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function Toggle({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full py-1.5 group"
    >
      <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
        {label}
      </span>
      <div
        className={`w-9 h-5 rounded-full transition-colors relative ${
          enabled ? "bg-indigo-600" : "bg-gray-700"
        }`}
      >
        <div
          className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
            enabled ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </div>
    </button>
  );
}

export default function Settings() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "Not configured";
  const profiles = useAgentProfiles();
  const avatars = useAvatars();
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const privacy = usePrivacy();
  const ambient = useAmbient();
  const [crtEnabled, setCrtEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("codepulse-crt") ?? "false");
    } catch {
      return false;
    }
  });

  const getAvatar = (avatarId?: string) => {
    if (!avatarId) return null;
    return avatars.find((a: any) => a._id === avatarId) ?? null;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Authentication */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Authentication</h2>
        {CLERK_KEY ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Provider</span>
              <span className="text-gray-300 text-xs">Clerk</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Connected
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Auth not configured. Set <code className="text-gray-400 bg-gray-900/50 px-1.5 py-0.5 rounded text-xs font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> in <code className="text-gray-400 bg-gray-900/50 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code> to enable.
            </p>
          </div>
        )}
      </div>

      {/* Privacy Masking */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Privacy Masking</h2>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              privacy.enabled
                ? "bg-indigo-600/20 text-indigo-400"
                : "bg-gray-700/50 text-gray-500"
            }`}
          >
            {privacy.enabled ? "ACTIVE" : "OFF"}
          </span>
        </div>
        <div className="space-y-1">
          <Toggle
            enabled={privacy.enabled}
            onToggle={privacy.toggle}
            label="Enable privacy mode"
          />
          {privacy.enabled && (
            <div className="pl-3 border-l border-gray-700 ml-1 space-y-1 mt-2">
              <Toggle
                enabled={privacy.maskPaths}
                onToggle={() => privacy.setSetting("maskPaths", !privacy.maskPaths)}
                label="Mask file paths"
              />
              <Toggle
                enabled={privacy.maskEmails}
                onToggle={() => privacy.setSetting("maskEmails", !privacy.maskEmails)}
                label="Mask email addresses"
              />
              <Toggle
                enabled={privacy.maskKeys}
                onToggle={() => privacy.setSetting("maskKeys", !privacy.maskKeys)}
                label="Mask API keys & secrets"
              />
              <Toggle
                enabled={privacy.maskIps}
                onToggle={() => privacy.setSetting("maskIps", !privacy.maskIps)}
                label="Mask IP addresses"
              />
            </div>
          )}
        </div>
        <p className="text-[10px] text-gray-600 mt-3">
          When active, sensitive data is redacted across all dashboard views. Stored data is not modified.
        </p>
          <div className="mt-3 pt-3 border-t border-gray-700">
            <span className="text-sm text-gray-400 mb-2 block">Privacy Level</span>
            <div className="flex gap-2">
              {(["off", "demo", "screenshot"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => privacy.setLevel(level)}
                  className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                    privacy.level === level
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-2">
              Demo: blurs sensitive values. Screenshot: hides all data.
            </p>
          </div>
      </div>

      {/* Ambient Audio */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Ambient Audio</h2>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              ambient.enabled
                ? "bg-emerald-600/20 text-emerald-400"
                : "bg-gray-700/50 text-gray-500"
            }`}
          >
            {ambient.enabled ? "PLAYING" : "MUTED"}
          </span>
        </div>
        <div className="space-y-3">
          <Toggle
            enabled={ambient.enabled}
            onToggle={ambient.toggle}
            label="Enable ambient soundscape"
          />
          {ambient.enabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Volume</span>
                <span className="text-xs text-gray-500 font-mono">
                  {Math.round(ambient.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(ambient.volume * 100)}
                onChange={(e) => ambient.setVolume(Number(e.target.value) / 100)}
                className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          )}
        </div>
        <p className="text-[10px] text-gray-600 mt-3">
          Generative soundscape that responds to system health. Green = consonant, Yellow = tense, Red = dissonant.
        </p>
      </div>

      {/* CRT Overlay */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">CRT Overlay</h2>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              crtEnabled
                ? "bg-green-600/20 text-green-400"
                : "bg-gray-700/50 text-gray-500"
            }`}
          >
            {crtEnabled ? "ON" : "OFF"}
          </span>
        </div>
        <Toggle
          enabled={crtEnabled}
          onToggle={() => {
            const next = !crtEnabled;
            setCrtEnabled(next);
            localStorage.setItem("codepulse-crt", JSON.stringify(next));
            if (next) {
              document.body.classList.add("crt-active");
            } else {
              document.body.classList.remove("crt-active");
              const el = document.querySelector(".crt-overlay");
              if (el) el.remove();
            }
            window.dispatchEvent(new Event("codepulse-crt-toggle"));
          }}
          label="Enable CRT scanline effect"
        />
        <p className="text-[10px] text-gray-600 mt-3">
          Adds a retro CRT monitor scanline overlay effect across the entire dashboard.
        </p>
      </div>

      {/* Connection */}
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
          <p>Phase 1–6 — Full Dashboard + Auth + Privacy + Audio</p>
        </div>
      </div>
    </div>
  );
}
