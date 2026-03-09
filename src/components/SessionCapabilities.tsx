import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface SessionCapabilitiesProps {
  sessionId: string;
}

export default function SessionCapabilities({ sessionId }: SessionCapabilitiesProps) {
  const [expanded, setExpanded] = useState(false);
  const result = useQuery(api.registry.getSessionSnapshot, { sessionId });

  if (result === undefined) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <p className="text-xs text-gray-500 text-center py-2">Loading capabilities...</p>
      </div>
    );
  }

  if (result === null) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <p className="text-xs text-gray-500 text-center py-2">No capabilities snapshot for this session</p>
      </div>
    );
  }

  const snap = result.snapshot as Record<string, any>;

  const os = snap.os ?? snap.platform ?? snap.osVersion;
  const shell = snap.shell;
  const model = snap.model;
  const platform = snap.platform ?? snap.os;
  const mcpServers: any[] = Array.isArray(snap.mcpServers) ? snap.mcpServers : [];
  const tools: any[] = Array.isArray(snap.tools) ? snap.tools : [];
  const plugins: any[] = Array.isArray(snap.plugins) ? snap.plugins : [];
  const skills: any[] = Array.isArray(snap.skills) ? snap.skills : [];
  const hooks: any[] = Array.isArray(snap.hooks) ? snap.hooks : [];
  const slashCommands: any[] = Array.isArray(snap.slashCommands) ? snap.slashCommands : [];

  const scannedDate = new Date(result.scannedAt * 1000).toLocaleString();

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-700/20 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-300">Session Capabilities</span>
          <span className="text-xs text-gray-500">Scanned {scannedDate}</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Environment info */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {os && (
              <Field label="OS" value={os} />
            )}
            {platform && platform !== os && (
              <Field label="Platform" value={platform} />
            )}
            {shell && (
              <Field label="Shell" value={shell} />
            )}
            {model && (
              <Field label="Model" value={model} />
            )}
            {snap.cwd && (
              <Field label="CWD" value={snap.cwd} />
            )}
            {snap.nodeVersion && (
              <Field label="Node" value={snap.nodeVersion} />
            )}
          </div>

          {/* MCP Servers */}
          {mcpServers.length > 0 && (
            <Section title={`MCP Servers (${mcpServers.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {mcpServers.map((s: any, i: number) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-blue-400/10 text-blue-300 border border-blue-400/20"
                    title={s.url}
                  >
                    {s.name}
                    {s.status && s.status !== "connected" && (
                      <span className="ml-1 text-gray-500">({s.status})</span>
                    )}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Tools */}
          {tools.length > 0 && (
            <Section title={`Tools (${tools.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {tools.map((t: any, i: number) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-purple-400/10 text-purple-300 border border-purple-400/20"
                  >
                    {typeof t === "string" ? t : t.name ?? t.toolName ?? JSON.stringify(t)}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Plugins */}
          {plugins.length > 0 && (
            <Section title={`Plugins (${plugins.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {plugins.map((p: any, i: number) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-emerald-400/10 text-emerald-300 border border-emerald-400/20"
                  >
                    {p.name}{p.version ? ` v${p.version}` : ""}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <Section title={`Skills (${skills.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s: any, i: number) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20"
                    title={s.description}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Hooks */}
          {hooks.length > 0 && (
            <Section title={`Hooks (${hooks.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {hooks.map((h: any, i: number) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-rose-400/10 text-rose-300 border border-rose-400/20"
                  >
                    {h.hookType}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Slash Commands */}
          {slashCommands.length > 0 && (
            <Section title={`Slash Commands (${slashCommands.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {slashCommands.map((c: any, i: number) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-cyan-400/10 text-cyan-300 border border-cyan-400/20"
                    title={c.description}
                  >
                    /{c.name}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Raw snapshot toggle */}
          <RawSnapshot data={snap} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xs font-mono text-gray-300 mt-0.5 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function RawSnapshot({ data }: { data: Record<string, any> }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <button
        onClick={() => setShow(!show)}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {show ? "Hide" : "Show"} raw snapshot
      </button>
      {show && (
        <pre className="mt-2 p-3 bg-gray-900/60 rounded-lg text-xs text-gray-400 font-mono max-h-64 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
