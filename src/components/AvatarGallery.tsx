import { useState } from "react";
import { useAvatars } from "../hooks/useAvatars";
import AgentAvatar from "./AgentAvatar";
import AvatarUploader from "./AvatarUploader";

const PRESET_EMOJIS = [
  "\uD83E\uDD16", "\uD83E\uDDE0", "\u26A1", "\uD83D\uDD27",
  "\uD83D\uDEE1\uFE0F", "\uD83C\uDFAF", "\uD83D\uDCBB", "\uD83D\uDD2E",
  "\uD83C\uDF1F", "\uD83E\uDDBE", "\uD83C\uDFD7\uFE0F", "\uD83D\uDCE1",
];

interface AvatarGalleryProps {
  selectedId?: string;
  onSelect: (avatarId: string) => void;
  onCreateWithEmoji?: (emoji: string) => void;
}

export default function AvatarGallery({ selectedId, onSelect, onCreateWithEmoji }: AvatarGalleryProps) {
  const avatars = useAvatars();
  const [showUploader, setShowUploader] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-2">
        {avatars.map((avatar: any) => (
          <button
            key={avatar._id}
            onClick={() => onSelect(avatar._id)}
            className={`p-1 rounded-full transition-all ${
              selectedId === avatar._id
                ? "ring-2 ring-indigo-500 bg-indigo-500/10"
                : "hover:bg-gray-700/30"
            }`}
          >
            <AgentAvatar avatar={avatar} size="md" />
          </button>
        ))}
        <button
          onClick={() => setShowUploader(true)}
          className="w-10 h-10 rounded-full border-2 border-dashed border-gray-600/50 flex items-center justify-center text-gray-500 hover:border-gray-500/50 hover:text-gray-300 transition-colors"
        >
          +
        </button>
      </div>

      {showUploader && (
        <AvatarUploader
          onUpload={(storageId) => {
            setShowUploader(false);
            onSelect(storageId);
          }}
          onCancel={() => setShowUploader(false)}
        />
      )}

      {onCreateWithEmoji && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Quick emoji avatar</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onCreateWithEmoji(emoji)}
                className="w-8 h-8 rounded-full bg-gray-700/50 hover:bg-gray-600/50 flex items-center justify-center text-sm transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
