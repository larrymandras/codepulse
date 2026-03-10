import { useState, useMemo } from "react";
import { formatTimestamp } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

interface DiscoveredToolsTableProps {
  tools: any[];
  filter?: string;
}

type SortField = "name" | "serverName" | "usageCount" | "discoveredAt" | "lastUsedAt";
type SortDir = "asc" | "desc";
type ViewMode = "grouped" | "table";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  core:           { bg: "bg-blue-500/10",    text: "text-blue-400",    dot: "bg-blue-400" },
  infrastructure: { bg: "bg-cyan-500/10",    text: "text-cyan-400",    dot: "bg-cyan-400" },
  media:          { bg: "bg-pink-500/10",    text: "text-pink-400",    dot: "bg-pink-400" },
  workspace:      { bg: "bg-indigo-500/10",  text: "text-indigo-400",  dot: "bg-indigo-400" },
  data:           { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  social:         { bg: "bg-orange-500/10",  text: "text-orange-400",  dot: "bg-orange-400" },
  memory:         { bg: "bg-purple-500/10",  text: "text-purple-400",  dot: "bg-purple-400" },
  productivity:   { bg: "bg-yellow-500/10",  text: "text-yellow-400",  dot: "bg-yellow-400" },
  iot:            { bg: "bg-teal-500/10",    text: "text-teal-400",    dot: "bg-teal-400" },
};

const DEFAULT_CAT = { bg: "bg-gray-700/50", text: "text-gray-400", dot: "bg-gray-400" };

function catStyle(category: string | undefined) {
  return CATEGORY_COLORS[category ?? ""] ?? DEFAULT_CAT;
}

export default function DiscoveredToolsTable({ tools, filter }: DiscoveredToolsTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");

  // Derive unique categories
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const t of tools) {
      const c = t.serverName ?? "uncategorized";
      cats.set(c, (cats.get(c) ?? 0) + 1);
    }
    return Array.from(cats.entries()).sort((a, b) => b[1] - a[1]);
  }, [tools]);

  // Apply text filter + category filter
  const filtered = useMemo(() => {
    let result = tools;
    if (filter) {
      result = result.filter(
        (t: any) =>
          t.name.toLowerCase().includes(filter) ||
          (t.description ?? "").toLowerCase().includes(filter) ||
          (t.serverName ?? "").toLowerCase().includes(filter)
      );
    }
    if (activeCategory) {
      result = result.filter((t: any) => (t.serverName ?? "uncategorized") === activeCategory);
    }
    return result;
  }, [tools, filter, activeCategory]);

  // Sort
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" || field === "serverName" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";
      const cmp = typeof av === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  // Group by category for grouped view
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of sorted) {
      const cat = t.serverName ?? "uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [sorted]);

  function arrow(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  }

  function renderToolRow(t: any) {
    const cs = catStyle(t.serverName);
    const isExpanded = expandedId === t._id;
    return (
      <div key={t._id}>
        <div
          onClick={() => setExpandedId(isExpanded ? null : t._id)}
          className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-gray-700/30 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cs.dot}`} />
            <span className="text-sm font-mono text-gray-200 truncate">{t.name}</span>
            {t.description && (
              <span className="text-[11px] text-gray-500 truncate max-w-[280px] hidden lg:inline">
                {t.description}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
            {t.usageCount > 0 && (
              <span className="text-[10px] text-gray-500">{t.usageCount} uses</span>
            )}
            <span className="text-gray-600 text-xs">{isExpanded ? "\u25B2" : "\u25BC"}</span>
          </div>
        </div>
        {isExpanded && (
          <div className="ml-5 mt-1 mb-2 bg-gray-900/80 border border-gray-700/40 rounded-lg px-4 py-3 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
              <div>
                <span className="text-gray-500">Name</span>
                <p className="text-gray-200 font-mono">{t.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Category</span>
                <p className={cs.text}>{t.serverName ?? "Uncategorized"}</p>
              </div>
              <div>
                <span className="text-gray-500">Source</span>
                <p className="text-gray-300">{t.source}</p>
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
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">
          Tool Catalog
          <span className="ml-2 text-xs text-gray-500 font-normal">{filtered.length}</span>
          <InfoTooltip text="All Ástríðr Python tool scripts organized by category. Click any tool to see full details." />
        </h2>
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-gray-900/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("grouped")}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              viewMode === "grouped"
                ? "bg-gray-700 text-gray-200"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Grouped
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              viewMode === "table"
                ? "bg-gray-700 text-gray-200"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-2.5 py-1 rounded-full text-[11px] transition-colors ${
            activeCategory === null
              ? "bg-gray-600 text-gray-100"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
          }`}
        >
          All ({tools.length})
        </button>
        {categories.map(([cat, count]) => {
          const cs = catStyle(cat);
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? null : cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] transition-colors flex items-center gap-1.5 ${
                isActive
                  ? `${cs.bg} ${cs.text} ring-1 ring-current`
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cs.dot}`} />
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          {filter || activeCategory ? "No tools match your filters" : "No tools discovered yet"}
        </p>
      ) : viewMode === "grouped" ? (
        /* ---- GROUPED VIEW ---- */
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {grouped.map(([cat, catTools]) => {
            const cs = catStyle(cat);
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className={`w-2 h-2 rounded-full ${cs.dot}`} />
                  <h3 className={`text-xs font-semibold uppercase tracking-wider ${cs.text}`}>
                    {cat}
                  </h3>
                  <span className="text-[10px] text-gray-600">{catTools.length}</span>
                </div>
                <div className="space-y-1">
                  {catTools.map(renderToolRow)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ---- TABLE VIEW ---- */
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-gray-800/90 backdrop-blur-sm z-10">
              <tr className="border-b border-gray-700/50">
                {([
                  ["name", "Tool Name"],
                  ["serverName", "Category"],
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
                const cs = catStyle(t.serverName);
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
                            <span className="text-[11px] text-gray-500 truncate max-w-[200px] hidden xl:inline">
                              {t.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${cs.bg} ${cs.text}`}>
                          {t.serverName ?? "uncategorized"}
                        </span>
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
                                <span className="text-gray-500">Category</span>
                                <p className={cs.text}>{t.serverName ?? "Uncategorized"}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Source</span>
                                <p className="text-gray-300">{t.source}</p>
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
