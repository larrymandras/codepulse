import { useState, useMemo } from "react";
import { formatTimestamp } from "../lib/formatters";

interface ComponentRow {
  _id: string;
  component: string;
  phase: string;
  status: string;
  progress?: number;
  updatedAt: number;
}

type SortKey = "component" | "phase" | "status" | "progress" | "updatedAt";

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-400/10 text-green-400",
  in_progress: "bg-blue-400/10 text-blue-400",
  pending: "bg-gray-400/10 text-gray-400",
  failed: "bg-red-400/10 text-red-400",
};

export default function ComponentTable({ components }: { components: ComponentRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return components;
    const lc = filter.toLowerCase();
    return components.filter(
      (c) =>
        c.component.toLowerCase().includes(lc) ||
        c.phase.toLowerCase().includes(lc) ||
        c.status.toLowerCase().includes(lc)
    );
  }, [components, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = a[sortKey] ?? "";
      let bv: string | number = b[sortKey] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const colHeader = (label: string, key: SortKey) => (
    <th
      className="text-left text-xs text-gray-400 uppercase tracking-wide py-2 px-3 cursor-pointer hover:text-gray-200 select-none"
      onClick={() => handleSort(key)}
    >
      {label} {sortKey === key ? (sortAsc ? "^" : "v") : ""}
    </th>
  );

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Components</h3>
        <input
          type="text"
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-1 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 w-48"
        />
      </div>
      {sorted.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-4">No components found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700/50">
                {colHeader("Component", "component")}
                {colHeader("Phase", "phase")}
                {colHeader("Status", "status")}
                {colHeader("Progress", "progress")}
                {colHeader("Last Updated", "updatedAt")}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c._id}
                  className="border-b border-gray-700/30 hover:bg-gray-700/20"
                >
                  <td className="py-2 px-3 text-sm font-mono text-gray-200">
                    {c.component}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-400">{c.phase}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[c.status] ?? STATUS_BADGE.pending}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-700/50 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${c.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">
                        {c.progress ?? 0}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-xs text-gray-500">
                    {formatTimestamp(c.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
