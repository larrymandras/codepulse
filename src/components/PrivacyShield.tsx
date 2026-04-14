import { usePrivacy } from "../contexts/PrivacyContext";
import { Lock, LockOpen } from "lucide-react";

export default function PrivacyShield() {
  const { enabled, level, toggle } = usePrivacy();

  const titleText =
    level === "demo"
      ? "Demo mode — click to toggle privacy"
      : level === "screenshot"
        ? "Screenshot mode — click to toggle privacy"
        : enabled
          ? "Privacy mode ON — click to disable"
          : "Privacy mode OFF — click to enable";

  return (
    <button
      onClick={toggle}
      aria-label={titleText}
      title={titleText}
      className={`p-1.5 rounded-lg transition-colors text-xs font-mono flex items-center gap-1.5 ${
        level === "demo"
          ? "bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
          : level === "screenshot"
            ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
            : enabled
              ? "bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30"
              : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
      }`}
    >
      {enabled || level !== "off" ? (
        <Lock className="h-4 w-4" />
      ) : (
        <LockOpen className="h-4 w-4" />
      )}
      {level === "demo" && (
        <span className="text-[10px] font-medium">DEMO</span>
      )}
      {level === "screenshot" && (
        <span className="text-[10px] font-medium">SAFE</span>
      )}
    </button>
  );
}
