import { useState, useEffect } from "react";
import { useAgentProfileMutations } from "../hooks/useAgentProfiles";
import { useAvatarMutations, useAvatars } from "../hooks/useAvatars";
import AvatarGallery from "./AvatarGallery";
import AvatarUploader from "./AvatarUploader";
import AgentAvatar from "./AgentAvatar";
import type { Id } from "../../convex/_generated/dataModel";
import type { AgentProfile } from "../types";

const MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "gpt-4o",
  "other",
];

interface AgentProfileEditorProps {
  profile?: AgentProfile;
  onSave: () => void;
  onCancel: () => void;
}

export default function AgentProfileEditor({ profile, onSave, onCancel }: AgentProfileEditorProps) {
  const avatars = useAvatars();

  // Profile fields
  const [profileId, setProfileId] = useState(profile?.profileId ?? "");
  const [name, setName] = useState(profile?.name ?? "");
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [model, setModel] = useState(profile?.model ?? "claude-sonnet-4-6");
  const [avatarId, setAvatarId] = useState<Id<"avatars"> | undefined>(profile?.avatarId);

  // Avatar fields
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [capabilities, setCapabilities] = useState("");

  const [showGallery, setShowGallery] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [saving, setSaving] = useState(false);

  const { create, update, remove } = useAgentProfileMutations();
  const { create: createAvatar, update: updateAvatar, saveImage } = useAvatarMutations();

  const isNew = !profile;

  // Load current avatar data when avatarId changes
  useEffect(() => {
    if (avatarId) {
      const avatar = avatars.find((a) => a._id === avatarId);
      if (avatar) {
        setEmoji(avatar.emoji ?? "");
        setColor(avatar.color ?? "");
        setDescription(avatar.description ?? "");
        setCapabilities((avatar.capabilities ?? []).join(", "));
      }
    }
  }, [avatarId, avatars]);

  const handleImageUpload = async (storageId: string) => {
    // If we already have an avatar, update it with the image
    if (avatarId) {
      await saveImage({ id: avatarId, storageId: storageId as Id<"_storage"> });
    } else {
      // Create a new avatar with the image
      const id = await createAvatar({
        name: name || "agent",
        emoji: emoji || undefined,
        color: color || undefined,
        imageStorageId: storageId as Id<"_storage">,
      });
      setAvatarId(id);
    }
    setShowUploader(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      let finalAvatarId = avatarId;

      // If we have an existing avatar, update it
      if (finalAvatarId) {
        const capsArray = capabilities
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        await updateAvatar({
          id: finalAvatarId,
          name,
          emoji: emoji || undefined,
          color: color || undefined,
          description: description || undefined,
          capabilities: capsArray.length > 0 ? capsArray : undefined,
        });
      }

      if (isNew) {
        // If no avatar yet, create one with the fields
        if (!finalAvatarId && (emoji || description)) {
          const capsArray = capabilities
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
          finalAvatarId = await createAvatar({
            name,
            emoji: emoji || undefined,
            color: color || undefined,
            description: description || undefined,
            capabilities: capsArray.length > 0 ? capsArray : undefined,
          });
        }
        await create({
          profileId: profileId || name.toLowerCase().replace(/\s+/g, "-"),
          name,
          model,
          avatarId: finalAvatarId,
          displayName: displayName || undefined,
        });
      } else {
        await update({
          id: profile._id,
          name,
          model,
          avatarId: finalAvatarId,
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

  const handleCreateWithEmoji = async (selectedEmoji: string) => {
    const capsArray = capabilities
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const id = await createAvatar({
      name: name || "agent",
      emoji: selectedEmoji,
      color: color || undefined,
      description: description || undefined,
      capabilities: capsArray.length > 0 ? capsArray : undefined,
    });
    setAvatarId(id);
    setEmoji(selectedEmoji);
    setShowGallery(false);
  };

  const currentAvatar = avatarId ? avatars.find((a) => a._id === avatarId) : undefined;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-300">
        {isNew ? "New Agent Profile" : "Edit Profile"}
      </h3>

      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-2">
          <button onClick={() => { setShowGallery(!showGallery); setShowUploader(false); }} title="Pick emoji avatar">
            <AgentAvatar
              avatar={currentAvatar ?? { name: name || "?", emoji: emoji || undefined }}
              size="lg"
            />
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => { setShowGallery(!showGallery); setShowUploader(false); }}
              className="text-[9px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors"
              title="Pick emoji"
            >
              Emoji
            </button>
            <button
              onClick={() => { setShowUploader(!showUploader); setShowGallery(false); }}
              className="text-[9px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors"
              title="Upload image"
            >
              Upload
            </button>
          </div>
        </div>
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

      {/* Image Uploader */}
      {showUploader && (
        <div className="border border-gray-700/50 rounded-lg p-3">
          <AvatarUploader
            onUpload={handleImageUpload}
            onCancel={() => setShowUploader(false)}
          />
        </div>
      )}

      {/* Emoji Gallery */}
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

      {/* Avatar Properties */}
      <div className="space-y-2 border-t border-gray-700/50 pt-3">
        <label className="text-xs text-gray-400 block">Avatar Properties</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Emoji</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="⚡"
              className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Color</label>
            <div className="flex gap-2">
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#FBBF24"
                className="flex-1 bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600"
              />
              {color && (
                <div
                  className="w-9 h-9 rounded-lg border border-gray-600/50 flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this agent does..."
            rows={2}
            className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">
            Capabilities (comma-separated)
          </label>
          <input
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
            placeholder="Code review, API design, GitHub"
            className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600"
          />
        </div>
      </div>

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
