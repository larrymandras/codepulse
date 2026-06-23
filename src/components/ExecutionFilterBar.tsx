interface FilterState {
  status: string | null;
  channel: string | null;
  profile: string | null;
  origin: string | null;
}

interface ExecutionFilterBarProps {
  filters: FilterState;
  onFilterChange: (key: string, value: string | null) => void;
  profiles: string[];
}

const STATUS_OPTIONS = ["queued", "running", "completed", "failed", "cancelled", "timed_out"];
const CHANNEL_OPTIONS = ["telegram", "slack", "email", "web", "voice"];
const ORIGIN_OPTIONS = ["user_request", "pipeline", "internal", "cli"];

function FilterGroup({
  label,
  options,
  activeValue,
  filterKey,
  onFilterChange,
}: {
  label: string;
  options: string[];
  activeValue: string | null;
  filterKey: string;
  onFilterChange: (key: string, value: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold shrink-0">
        {label}
      </span>
      <button
        onClick={() => onFilterChange(filterKey, null)}
        className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
          activeValue === null
            ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
            : "bg-gray-700/30 text-gray-400 border border-transparent hover:border-gray-600/50"
        }`}
      >
        All
      </button>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onFilterChange(filterKey, activeValue === opt ? null : opt)}
          className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
            activeValue === opt
              ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
              : "bg-gray-700/30 text-gray-400 border border-transparent hover:border-gray-600/50"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function ExecutionFilterBar({
  filters,
  onFilterChange,
  profiles,
}: ExecutionFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterGroup
        label="Status"
        options={STATUS_OPTIONS}
        activeValue={filters.status}
        filterKey="status"
        onFilterChange={onFilterChange}
      />
      <FilterGroup
        label="Channel"
        options={CHANNEL_OPTIONS}
        activeValue={filters.channel}
        filterKey="channel"
        onFilterChange={onFilterChange}
      />
      <FilterGroup
        label="Profile"
        options={profiles}
        activeValue={filters.profile}
        filterKey="profile"
        onFilterChange={onFilterChange}
      />
      <FilterGroup
        label="Origin"
        options={ORIGIN_OPTIONS}
        activeValue={filters.origin}
        filterKey="origin"
        onFilterChange={onFilterChange}
      />
    </div>
  );
}
