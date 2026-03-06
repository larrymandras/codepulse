interface PluginPanelProps {
  plugins: any[];
}

export default function PluginPanel({ plugins }: PluginPanelProps) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Plugins</h2>
      {plugins.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          No plugins installed
        </p>
      ) : (
        <div className="space-y-1">
          {plugins.map((p: any) => (
            <div
              key={p._id}
              className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    p.enabled
                      ? "bg-green-400/10 text-green-400"
                      : "bg-gray-700/50 text-gray-500"
                  }`}
                >
                  {p.enabled ? "ON" : "OFF"}
                </span>
                <span className="text-sm font-mono text-gray-200">
                  {p.name}
                </span>
                {p.version && (
                  <span className="text-xs text-gray-500">v{p.version}</span>
                )}
              </div>
              <span className="text-xs text-gray-500 font-mono">
                {new Date(p.installedAt * 1000).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
