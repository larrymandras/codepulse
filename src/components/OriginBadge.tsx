const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  native: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Native" },
  bridge: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Bridge" },
  cc: { bg: "bg-amber-500/10", text: "text-amber-400", label: "CC" },
  catalog: { bg: "bg-gray-500/10", text: "text-gray-500", label: "Catalog" },
  "claude-code": { bg: "bg-purple-500/10", text: "text-purple-400", label: "Claude Code" },
  unknown: { bg: "bg-gray-500/10", text: "text-gray-500", label: "Unknown" },
};

const PROJECT_STYLE = { bg: "bg-cyan-500/10", text: "text-cyan-400", label: "Project" };

function styleFor(origin: string) {
  if (origin.startsWith("claude-code:project:")) return PROJECT_STYLE;
  return BADGE_STYLES[origin];
}

interface OriginBadgeProps {
  origin?: string | null;
}

export default function OriginBadge({ origin }: OriginBadgeProps) {
  if (!origin) return null;
  const style = styleFor(origin);
  if (!style) return null;

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}
