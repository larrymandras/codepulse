import { useState } from "react";
import InfoTooltip from "./InfoTooltip";
import OriginBadge from "./OriginBadge";

interface PluginPanelProps {
  plugins: any[];
  filter?: string;
}

export default function PluginPanel({ plugins, filter }: PluginPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter
    ? plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(filter) ||
          (p.version ?? "").toLowerCase().includes(filter) ||
          JSON.stringify(p.config ?? {}).toLowerCase().includes(filter)
      )
    : plugins;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Plugins
        <span className="ml-2 text-sm text-gray-500 font-normal">{filtered.length}</span>
        <InfoTooltip text="Internal extensions that add memory, moderation, and other capabilities. Click a plugin to see configuration details." />
      </h2>
      {filtered.length === 0 ? (
        <p className="text-base text-gray-500 py-6 text-center">
          {filter ? "No plugins match your search" : "No plugins installed"}
        </p>
      ) : (
        <div className="space-y-1 max-h-[420px] overflow-y-auto">
          {filtered.map((p: any) => {
            const isExpanded = expandedId === p._id;
            const config = p.config as Record<string, any> | undefined;
            const description = config?.description;
            const category = config?.category;

            return (
              <div key={p._id}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : p._id)}
                  className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-sm px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                        p.enabled
                          ? "bg-green-400/10 text-green-400"
                          : "bg-gray-700/50 text-gray-500"
                      }`}
                    >
                      {p.enabled ? "ON" : "OFF"}
                    </span>
                    <span className="text-base font-mono text-gray-200 truncate">
                      {p.name}
                    </span>
                    <OriginBadge origin={p.origin} />
                    {p.version && (
                      <span className="text-sm text-gray-500 flex-shrink-0">v{p.version}</span>
                    )}
                    {category && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 flex-shrink-0">
                        {category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    {description && (
                      <span className="text-sm text-gray-500 truncate max-w-[200px] hidden md:inline">
                        {description}
                      </span>
                    )}
                    <span className="text-sm text-gray-500 font-mono">
                      {new Date(p.installedAt * 1000).toLocaleDateString()}
                    </span>
                    <span className="text-gray-600 text-sm">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-5 mt-1 mb-2 bg-gray-900/80 border border-gray-700/40 rounded-lg px-4 py-3 space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      <div>
                        <span className="text-gray-500">Name</span>
                        <p className="text-gray-200 font-mono">{p.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status</span>
                        <p className={p.enabled ? "text-green-400" : "text-gray-500"}>
                          {p.enabled ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                      {description && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Description</span>
                          <p className="text-gray-300">{description}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Version</span>
                        <p className="text-gray-300 font-mono">{p.version ?? "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Category</span>
                        <p className="text-gray-300">{category ?? "General"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Installed</span>
                        <p className="text-gray-300 font-mono">
                          {new Date(p.installedAt * 1000).toLocaleString()}
                        </p>
                      </div>
                      {p.origin && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground w-24">Origin</span>
                          <OriginBadge origin={p.origin} />
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Record ID</span>
                        <p className="text-gray-500 font-mono truncate">{p._id}</p>
                      </div>
                    </div>
                    {config && Object.keys(config).length > 0 && (
                      <div>
                        <span className="text-gray-500">Configuration</span>
                        <pre className="mt-1 text-sm text-gray-400 bg-gray-950/50 rounded p-2 overflow-x-auto">
                          {JSON.stringify(config, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
