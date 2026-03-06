import { useState } from "react";
import { useAgentProfileMutations } from "../hooks/useAgentProfiles";
import { useAvatarMutations } from "../hooks/useAvatars";
import AvatarGallery from "./AvatarGallery";
import AgentAvatar from "./AgentAvatar";
import type { Id } from "../../convex/_generated/dataModel";

const MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "gpt-4o",
  "other",
];

interface AgentProfileEditorProps {
  profile?: any;
  onSave: () => void;
  onCancel: () => void;
}

export default function AgentProfileEditor({ profile, onSave, onCancel }: AgentProfileEditorProps) {
  const [profileId, setProfileId] = useState(profile?.profileId ?? "");
  const [name, setName] = useState(profile?.name ?? "");
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [model, setModel] = useState(profile?.model ?? "claude-sonnet-4-6");
  const [avatarId, setAvatarId] = useState<Id<"avatars"> | undefined>(profile?.avatarId);
  const [showGallery, setShowGallery] = useState(false);
  const [saving, setSaving] = useState(false);

  const { create, update, remove } = useAgentProfileMutations();
  const { create: createAvatar } = useAvatarMutations();

  const isNew = !profile;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        await create({
          profileId: profileId || name.toLowerCase().replace(/\s+/g, "-"),
          name,
          model,
          avatarId,
          displayName: displayName || undefined,
        });
      } else {
        await update({
          id: profile._id,
          name,
          model,
          avatarId,
          displayName: displayName || undefined,
        });
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!profile) return;
    await remove({ id: profile._id });
    onSave();
  };

  const handleCreateWithEmoji = async (emoji: string) => {
    const id = await createAvatar({ name: name || "agent", emoji });
    setAvatarId(id);
    setShowGallery(false);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-300">
        {isNew ? "New Agent Profile" : "Edit Profile"}
      </h3>

      <div className="flex items-center gap-4">
        <button onClick={() => setShowGallery(!showGallery)}>
          <AgentAvatar
            avatar={avatarId ? { name: name || "?", emoji: undefined } : { name: name || "?" }}
            size="lg"
          />
        </button>
        <div className="flex-1 space-y-2">
          {isNew && (
            <input
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="Profile ID (e.g. main-agent)"
              className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600"
            />
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600"
          />
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (optional)"
            className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600"
          />
        </div>
      </div>

      {showGallery && (
        <AvatarGallery
          selectedId={avatarId}
          onSelect={(id) => {
            setAvatarId(id as Id<"avatars">);
            setShowGallery(false);
          }}
          onCreateWithEmoji={handleCreateWithEmoji}
        />
      )}

      <div>
        <label className="text-xs text-gray-400 block mb-1">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200"
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
        >
          {saving ? "Saving..." : isNew ? "Create" : "Update"}
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm"
        >
          Cancel
        </button>
        {!isNew && (
          <button
            onClick={handleDelete}
            className="ml-auto bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-lg text-sm"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
