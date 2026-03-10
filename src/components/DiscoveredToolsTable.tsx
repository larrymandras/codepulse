import { useState } from "react";
import { formatTimestamp } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

interface DiscoveredToolsTableProps {
  tools: any[];
  filter?: string;
}

type SortField = "name" | "source" | "usageCount" | "discoveredAt" | "lastUsedAt";
type SortDir = "asc" | "desc";

function sourceLabel(source: string) {
  switch (source) {
    case "mcp":
      return { color: "text-purple-400 bg-purple-500/10", label: "mcp" };
    case "builtin":
      return { color: "text-blue-400 bg-blue-500/10", label: "builtin" };
    case "plugin":
      return { color: "text-yellow-400 bg-yellow-500/10", label: "plugin" };
    default:
      return { color: "text-gray-400 bg-gray-700/50", label: source };
  }
}

export default function DiscoveredToolsTable({ tools, filter }: DiscoveredToolsTableProps) {
  const [sortField, setSortField] = useState<SortField>("usageCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(filter) ||
          (t.source ?? "").toLowerCase().includes(filter) ||
          (t.description ?? "").toLowerCase().includes(filter) ||
          (t.serverName ?? "").toLowerCase().includes(filter)
      )
    : tools;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" || field === "source" ? "asc" : "desc");
    }
  }

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortField] ?? 0;
    const bv = b[sortField] ?? 0;
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function arrow(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Discovered Tools
        <span className="ml-2 text-xs text-gray-500 font-normal">{filtered.length}</span>
        <InfoTooltip text="Core framework tools including base classes, task delegation, and pipeline execution. Click a row to see details." />
      </h2>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          {filter ? "No tools match your search" : "No tools discovered yet"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700/50">
                {([
                  ["name", "Tool Name"],
                  ["source", "Type"],
                  ["usageCount", "Uses"],
                  ["discoveredAt", "First Seen"],
                  ["lastUsedAt", "Last Used"],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    className="text-xs text-gray-500 uppercase px-3 py-2 cursor-pointer select-none hover:text-gray-300 transition-colors"
                  >
                    {label}
                    <span className="font-mono text-[10px]">{arrow(field)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t: any) => {
                const sl = sourceLabel(t.source);
                const isExpanded = expandedId === t._id;
                return (
                  <>
                    <tr
                      key={t._id}
                      onClick={() => setExpandedId(isExpanded ? null : t._id)}
                      className="border-b border-gray-800/30 hover:bg-gray-700/20 transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-gray-200">{t.name}</span>
                          {t.description && (
                            <span className="text-[11px] text-gray-500 truncate max-w-[200px] hidden lg:inline">
                              {t.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${sl.color}`}>
                          {sl.label}
                        </span>
                        {t.serverName && (
                          <span className="ml-1.5 text-[10px] text-gray-500">{t.serverName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-400">{t.usageCount}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                        {formatTimestamp(t.discoveredAt)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                        {t.lastUsedAt ? formatTimestamp(t.lastUsedAt) : "--"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${t._id}-detail`}>
                        <td colSpan={5} className="px-3 pb-3">
                          <div className="ml-3 bg-gray-900/80 border border-gray-700/40 rounded-lg px-4 py-3 text-xs">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
                              <div>
                                <span className="text-gray-500">Name</span>
                                <p className="text-gray-200 font-mono">{t.name}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Source</span>
                                <p className={sl.color.split(" ")[0]}>{t.source}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Category</span>
                                <p className="text-gray-300">{t.serverName ?? "Uncategorized"}</p>
                              </div>
                              {t.description && (
                                <div className="col-span-2 md:col-span-3">
                                  <span className="text-gray-500">Description</span>
                                  <p className="text-gray-300">{t.description}</p>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-500">Usage Count</span>
                                <p className="text-gray-300">{t.usageCount}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">First Discovered</span>
                                <p className="text-gray-300 font-mono">{formatTimestamp(t.discoveredAt)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Last Used</span>
                                <p className="text-gray-300 font-mono">
                                  {t.lastUsedAt ? formatTimestamp(t.lastUsedAt) : "Never"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
