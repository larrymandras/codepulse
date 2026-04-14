/**
 * CommandCatalogPanel — displays Ástríðr's command registry grouped by category.
 *
 * Receives commands from the WebSocket catalog payload (via useCommandCatalog hook).
 * Three connection states: loading (spinner), ready (grouped list), error (message).
 * Accordion expand/collapse per row. Category filter pills. Search filter prop.
 */

import { useState, useMemo } from "react";
import { Loader2, ChevronDown, ChevronUp, Check } from "lucide-react";
import type { CommandEntry } from "@/types/commands";

interface CommandCatalogPanelProps {
  commands: CommandEntry[];
  filter?: string;
  status: "loading" | "ready" | "error";
  error?: string;
}

export default function CommandCatalogPanel({
  commands,
  filter,
  status,
  error,
}: CommandCatalogPanelProps) {
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Derive unique categories with counts
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const cmd of commands) {
      cats.set(cmd.category, (cats.get(cmd.category) ?? 0) + 1);
    }
    return Array.from(cats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [commands]);

  // Apply text filter (case-insensitive match against name, description, category, source)
  const filtered = useMemo(() => {
    let result = commands;
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(q) ||
          cmd.description.toLowerCase().includes(q) ||
          cmd.category.toLowerCase().includes(q) ||
          (cmd.source ?? "").toLowerCase().includes(q)
      );
    }
    if (activeCategory) {
      result = result.filter((cmd) => cmd.category === activeCategory);
    }
    return result;
  }, [commands, filter, activeCategory]);

  // Group filtered commands by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandEntry[]>();
    for (const cmd of filtered) {
      if (!map.has(cmd.category)) map.set(cmd.category, []);
      map.get(cmd.category)!.push(cmd);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function handleRowClick(name: string) {
    setExpandedName((prev) => (prev === name ? null : name));
  }

  function handleCategoryClick(cat: string) {
    setActiveCategory((prev) => (prev === cat ? null : cat));
    setExpandedName(null);
  }

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="bg-(--card) p-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          COMMANDS
        </div>
        <div className="h-px bg-(--border) mb-4" />
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="bg-(--card) p-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          COMMANDS
        </div>
        <div className="h-px bg-(--border) mb-4" />
        <p className="text-sm text-muted-foreground py-4 text-center">
          {error ?? "Registry unavailable. Connect to Ástríðr to load the command catalog."}
        </p>
      </div>
    );
  }

  // ─── Ready state ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-(--card) p-4">
      {/* Section header */}
      <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        COMMANDS
      </div>
      <div className="h-px bg-(--border) mb-4" />

      {/* Category filter pills */}
      {commands.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-2.5 py-1 rounded-sm text-xs transition-colors ${
              activeCategory === null
                ? "bg-(--primary) text-(--primary-foreground)"
                : "bg-(--muted) text-(--muted-foreground) hover:bg-(--accent)"
            }`}
          >
            All ({commands.length})
          </button>
          {categories.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`px-2.5 py-1 rounded-sm text-xs transition-colors ${
                activeCategory === cat
                  ? "bg-(--primary) text-(--primary-foreground)"
                  : "bg-(--muted) text-(--muted-foreground) hover:bg-(--accent)"
              }`}
            >
              {cat} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {commands.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm font-semibold text-muted-foreground">No commands registered</p>
          <p className="text-xs text-muted-foreground mt-1">
            The command registry is empty. No slash commands were loaded from manifests.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No commands match your search
        </p>
      ) : (
        /* Grouped command list */
        <div className="space-y-4 max-h-[480px] overflow-y-auto">
          {grouped.map(([cat, catCommands]) => (
            <div key={cat}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <span className="w-1 h-1 rounded-full bg-(--muted-foreground) flex-shrink-0" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {cat}
                </h3>
                <span className="text-xs text-muted-foreground opacity-50">
                  {catCommands.length}
                </span>
              </div>

              {/* Command rows */}
              <div className="space-y-px">
                {catCommands.map((cmd) => {
                  const isExpanded = expandedName === cmd.name;
                  return (
                    <div key={cmd.name}>
                      {/* Row */}
                      <div
                        onClick={() => handleRowClick(cmd.name)}
                        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-(--muted)"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1 h-1 rounded-full bg-(--muted-foreground) flex-shrink-0" />
                          <span className="font-mono text-sm truncate">{cmd.name}</span>
                          {cmd.description && (
                            <span className="text-xs text-muted-foreground truncate hidden lg:inline">
                              {cmd.description}
                            </span>
                          )}
                        </div>
                        <span className="flex-shrink-0 ml-2 text-muted-foreground">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="mx-3 mb-2 bg-(--muted) border border-(--border) px-4 py-3 text-xs">
                          {/* Full description */}
                          <p className="text-sm text-(--foreground) mb-3">{cmd.description}</p>

                          {/* Parameters table */}
                          <div className="mb-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                              Parameters
                            </p>
                            {!cmd.parameters || cmd.parameters.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No parameters</p>
                            ) : (
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-(--border)">
                                    <th className="text-left text-xs text-muted-foreground pb-1 pr-4">
                                      Name
                                    </th>
                                    <th className="text-left text-xs text-muted-foreground pb-1 pr-4">
                                      Type
                                    </th>
                                    <th className="text-left text-xs text-muted-foreground pb-1">
                                      Required
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cmd.parameters.map((param) => (
                                    <tr key={param.name} className="border-b border-(--border)/50">
                                      <td className="font-mono text-xs py-1 pr-4">{param.name}</td>
                                      <td className="font-mono text-xs text-muted-foreground py-1 pr-4">
                                        {param.type}
                                      </td>
                                      <td className="py-1">
                                        {param.required ? (
                                          <Check className="h-4 w-4 text-(--status-ok)" />
                                        ) : (
                                          <span className="text-muted-foreground">--</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* Source */}
                          {cmd.source && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                Source
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {cmd.source}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
