import { useState } from "react";
import { formatTimestamp } from "../lib/formatters";

interface DiscoveredToolsTableProps {
  tools: any[];
}

type SortField = "name" | "source" | "usageCount" | "discoveredAt" | "lastUsedAt";
type SortDir = "asc" | "desc";

export default function DiscoveredToolsTable({ tools }: DiscoveredToolsTableProps) {
  const [sortField, setSortField] = useState<SortField>("usageCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" || field === "source" ? "asc" : "desc");
    }
  }

  const sorted = [...tools].sort((a, b) => {
    const av = a[sortField] ?? 0;
    const bv = b[sortField] ?? 0;
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function arrow(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ^" : " v";
  }

  function sourceLabel(source: string) {
    switch (source) {
      case "mcp":
        return "text-purple-400";
      case "builtin":
        return "text-blue-400";
      case "plugin":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Discovered Tools</h2>
      {tools.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          No tools discovered yet
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
                    <span className="font-mono">{arrow(field)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t: any) => (
                <tr
                  key={t._id}
                  className="border-b border-gray-800/30 hover:bg-gray-700/20 transition-colors"
                >
                  <td className="px-3 py-2 text-sm font-mono text-gray-200">
                    {t.name}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded bg-gray-700/50 ${sourceLabel(t.source)}`}
                    >
                      {t.source}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-400">
                    {t.usageCount}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                    {formatTimestamp(t.discoveredAt)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                    {t.lastUsedAt ? formatTimestamp(t.lastUsedAt) : "--"}
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
