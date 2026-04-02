interface StatusBadgeProps {
  status: string;
}

type StatusConfig = {
  dot: string;
  text: string;
  bg: string;
  label: string;
};

const statusMap: Record<string, StatusConfig> = {
  queued: {
    dot: "bg-gray-400",
    text: "text-gray-400",
    bg: "bg-gray-600/10",
    label: "QUEUED",
  },
  running: {
    dot: "bg-indigo-400 animate-pulse",
    text: "text-indigo-300",
    bg: "bg-indigo-500/20",
    label: "RUNNING",
  },
  completed: {
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    bg: "bg-emerald-600/10",
    label: "DONE",
  },
  failed: {
    dot: "bg-red-400",
    text: "text-red-300",
    bg: "bg-red-600/10",
    label: "FAILED",
  },
  cancelled: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    bg: "bg-amber-600/10",
    label: "CANCELLED",
  },
  timed_out: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    bg: "bg-amber-600/10",
    label: "TIMEOUT",
  },
};

const defaultConfig: StatusConfig = {
  dot: "bg-gray-400",
  text: "text-gray-400",
  bg: "bg-gray-600/10",
  label: "UNKNOWN",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] ?? defaultConfig;

  return (
    <span className={`inline-flex items-center gap-1 ${config.bg} rounded px-1.5 py-1`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className={`text-[10px] uppercase tracking-wider font-semibold ${config.text}`}>
        {config.label}
      </span>
    </span>
  );
}
