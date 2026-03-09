import { usePrivacy } from "../contexts/PrivacyContext";

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
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {enabled || level !== "off" ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
          />
        )}
      </svg>
      {level === "demo" && (
        <span className="text-[10px] font-medium">DEMO</span>
      )}
      {level === "screenshot" && (
        <span className="text-[10px] font-medium">SAFE</span>
      )}
    </button>
  );
}
