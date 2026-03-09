import { useEffect } from "react";
import { useAmbient } from "../contexts/AmbientContext";
import { useHeroStats } from "../hooks/useHeroStats";

export default function AmbientAudioPlayer() {
  const { enabled, toggle, setHealth } = useAmbient();
  const stats = useHeroStats();

  // Sync system health → audio engine
  useEffect(() => {
    setHealth(stats.health);
  }, [stats.health, setHealth]);

  return (
    <button
      onClick={toggle}
      title={enabled ? "Ambient audio ON — click to mute" : "Ambient audio OFF — click to enable"}
      className={`p-1.5 rounded-lg transition-colors text-xs ${
        enabled
          ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
          : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
      }`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {enabled ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6zm5.07-1.536a9 9 0 010 11.072"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
          />
        )}
      </svg>
    </button>
  );
}
