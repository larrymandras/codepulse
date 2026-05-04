import { useRateLimitState } from "../hooks/useRateLimitState";

const BADGE_CONFIG = {
  ok: { color: "#6b7280", label: null, pulse: false },
  warning: { color: "#eab308", label: "WARN", pulse: false },
  hit: { color: "#ef4444", label: "RATE LIM", pulse: true },
} as const;

export default function RateLimitBadge({ provider }: { provider: string }) {
  const state = useRateLimitState(provider);
  const config = BADGE_CONFIG[state];

  return (
    <div className="flex items-center gap-1">
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{
              backgroundColor: config.color,
              animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) 3",
            }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: config.color }}
        />
      </span>
      {config.label && (
        <span
          className="text-[9px] uppercase tracking-wide font-medium"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}
