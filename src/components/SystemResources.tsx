import InfoTooltip from "./InfoTooltip";

interface SystemResourcesProps {
  data?: {
    cpu?: number;
    ram?: { used: number; total: number };
    disk?: { used: number; total: number };
  };
}

function barColor(percent: number): string {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 80) return "bg-orange-500";
  if (percent >= 60) return "bg-yellow-500";
  return "bg-green-500";
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function ResourceBar({
  label,
  percent,
  valueLabel,
}: {
  label: string;
  percent: number;
  valueLabel: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-10 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-gray-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-24 text-right shrink-0">
        {valueLabel}
      </span>
    </div>
  );
}

export default function SystemResources({ data }: SystemResourcesProps) {
  const hasData = data && (data.cpu != null || data.ram || data.disk);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        System Resources<InfoTooltip text="System resource utilization: CPU, RAM, and disk usage" />
      </h2>
      {!hasData ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          Waiting for data...
        </p>
      ) : (
        <div className="space-y-3">
          {data.cpu != null && (
            <ResourceBar
              label="CPU"
              percent={data.cpu}
              valueLabel={`${data.cpu.toFixed(1)}%`}
            />
          )}
          {data.ram && (
            <ResourceBar
              label="RAM"
              percent={(data.ram.used / data.ram.total) * 100}
              valueLabel={`${formatBytes(data.ram.used)} / ${formatBytes(data.ram.total)}`}
            />
          )}
          {data.disk && (
            <ResourceBar
              label="Disk"
              percent={(data.disk.used / data.disk.total) * 100}
              valueLabel={`${formatBytes(data.disk.used)} / ${formatBytes(data.disk.total)}`}
            />
          )}
        </div>
      )}
    </div>
  );
}
