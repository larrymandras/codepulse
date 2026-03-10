import { useState } from "react";
import { useAgentProfiles } from "../hooks/useAgentProfiles";
import { useAvatars } from "../hooks/useAvatars";
import { usePrivacy } from "../contexts/PrivacyContext";
import { useAmbient, type PresetName, type Category } from "../contexts/AmbientContext";
import AgentAvatar from "../components/AgentAvatar";
import AgentProfileEditor from "../components/AgentProfileEditor";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";
import type { AgentProfile } from "../types";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL ?? "";
const CONVEX_DEPLOYMENT = CONVEX_URL ? new URL(CONVEX_URL).hostname.split(".")[0] : "unknown";

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
  const profiles = useAgentProfiles();
  const avatars = useAvatars();
  const [editingProfile, setEditingProfile] = useState<AgentProfile | null>(null);
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
    return avatars.find((a) => a._id === avatarId) ?? null;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Connection Status */}
      <SectionErrorBoundary name="Connection Status">
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Connection Status<InfoTooltip text="Backend connection details and environment configuration" />
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Backend</span>
            <span className="text-gray-300 text-xs">Convex</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Deployment</span>
            <span className="text-gray-300 text-xs font-mono">{CONVEX_DEPLOYMENT}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">URL</span>
            <span className="text-gray-300 text-xs font-mono truncate max-w-[280px]">{CONVEX_URL || "Not configured"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Status</span>
            {CONVEX_URL ? (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Not configured
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Environment</span>
            <span className="text-gray-300 text-xs">{import.meta.env.MODE}</span>
          </div>
        </div>
      </div>
      </SectionErrorBoundary>

      {/* Privacy Masking */}
      <SectionErrorBoundary name="Privacy Masking">
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Privacy Masking<InfoTooltip text="Control data masking levels for screenshots and demos — hides sensitive session IDs, file paths, and values" /></h2>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              privacy.level === "demo"
                ? "bg-amber-600/20 text-amber-400"
                : privacy.level === "screenshot"
                  ? "bg-red-600/20 text-red-400"
                  : privacy.enabled
                    ? "bg-indigo-600/20 text-indigo-400"
                    : "bg-gray-700/50 text-gray-500"
            }`}
          >
            {privacy.level === "demo"
              ? "DEMO MODE"
              : privacy.level === "screenshot"
                ? "SCREENSHOT"
                : privacy.enabled
                  ? "ACTIVE"
                  : "OFF"}
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
            <div className="mt-2 space-y-0.5">
              <p className={`text-[10px] ${privacy.level === "off" ? "text-gray-400" : "text-gray-600"}`}>
                <span className="font-medium">Off:</span> Normal view — all data visible
              </p>
              <p className={`text-[10px] ${privacy.level === "demo" ? "text-amber-400/80" : "text-gray-600"}`}>
                <span className="font-medium">Demo:</span> Demo mode — sensitive values blurred for presentations
              </p>
              <p className={`text-[10px] ${privacy.level === "screenshot" ? "text-red-400/80" : "text-gray-600"}`}>
                <span className="font-medium">Screenshot:</span> Screenshot safe — all data hidden
              </p>
            </div>
          </div>
      </div>
      </SectionErrorBoundary>

      {/* Ambient Audio */}
      <SectionErrorBoundary name="Ambient Audio">
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Ambient Audio<InfoTooltip text="Background audio presets for focus and immersion — choose from ambient, lofi, nature, and synth categories" /></h2>
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
            <div className="space-y-4">
              {/* Preset Selector */}
              <div>
                <span className="text-sm text-gray-400 mb-2 block">Soundscape</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "forge", label: "Forge" },
                      { value: "deepSpace", label: "Deep Space" },
                      { value: "rain", label: "Rain" },
                      { value: "serverRoom", label: "Server Room" },
                      { value: "lofi", label: "Lo-fi" },
                      { value: "silent", label: "Silent" },
                    ] as { value: PresetName; label: string }[]
                  ).map((p) => (
                    <button
                      key={p.value}
                      onClick={() => ambient.setPreset(p.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        ambient.preset === p.value
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Volume */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Master Volume</span>
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

              {/* Category Volumes */}
              <div>
                <span className="text-sm text-gray-400 mb-2 block">Channel Volumes</span>
                <div className="space-y-2 pl-3 border-l border-gray-700 ml-1">
                  {(
                    [
                      { cat: "alerts" as Category, label: "Alerts" },
                      { cat: "ambience" as Category, label: "Ambience" },
                      { cat: "events" as Category, label: "Events" },
                      { cat: "transitions" as Category, label: "Transitions" },
                    ]
                  ).map(({ cat, label }) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{label}</span>
                        <span className="text-[10px] text-gray-600 font-mono">
                          {Math.round(ambient.categoryVolumes[cat] * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(ambient.categoryVolumes[cat] * 100)}
                        onChange={(e) =>
                          ambient.setCategoryVolume(cat, Number(e.target.value) / 100)
                        }
                        className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="text-[10px] text-gray-600 mt-3">
          Generative soundscape that responds to system health. Green = consonant, Yellow = tense, Red = dissonant.
        </p>
      </div>
      </SectionErrorBoundary>

      {/* CRT Overlay */}
      <SectionErrorBoundary name="CRT Overlay">
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">CRT Overlay<InfoTooltip text="Retro CRT monitor effect with scanlines, glow, and flicker — purely cosmetic" /></h2>
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
      </SectionErrorBoundary>

      {/* Agent Profiles Section */}
      <SectionErrorBoundary name="Agent Profiles">
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Agent Profiles<InfoTooltip text="Manage registered agent team profiles — edit names, models, avatars, and capabilities" /></h2>
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
              profiles.map((p) => (
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
      </SectionErrorBoundary>

      <SectionErrorBoundary name="Hooks">
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
      </SectionErrorBoundary>

      <SectionErrorBoundary name="About">
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">About</h2>
        <div className="space-y-1 text-sm text-gray-500">
          <p>CodePulse v0.1.0</p>
          <p>Phase 1–6 — Full Dashboard + Auth + Privacy + Audio</p>
        </div>
      </div>
      </SectionErrorBoundary>
    </div>
  );
}
