import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatTimestamp } from "../lib/formatters";
import { usePrivacyMask } from "../hooks/usePrivacyMask";

interface BashLogProps {
  sessionId: string;
}

export default function BashLog({ sessionId }: BashLogProps) {
  const commands = useQuery(api.events.listBashCommands, { sessionId }) ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const { mask } = usePrivacyMask();

  const filtered = search
    ? commands.filter((cmd: any) => {
        const text = cmd.payload?.command ?? cmd.payload?.description ?? "";
        return text.toLowerCase().includes(search.toLowerCase());
      })
    : commands;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">
          Bash Commands ({filtered.length}{search ? ` / ${commands.length}` : ""})
        </h2>
        <input
          type="text"
          placeholder="Filter commands..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-900/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 w-48 focus:outline-none focus:border-gray-600"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No bash commands recorded</p>
      ) : (
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700/50">
                <th className="text-left py-2 px-2 font-medium">Time</th>
                <th className="text-left py-2 px-2 font-medium">Command</th>
                <th className="text-left py-2 px-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cmd: any) => {
                const id = cmd._id;
                const command =
                  cmd.payload?.command ?? cmd.payload?.description ?? "—";
                const exitCode = cmd.payload?.exitCode;
                const output = cmd.payload?.output ?? cmd.payload?.stdout;
                const isExpanded = expanded.has(id);

                return (
                  <tr key={id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                    <td className="py-2 px-2 text-gray-500 font-mono whitespace-nowrap align-top">
                      {formatTimestamp(cmd.timestamp)}
                    </td>
                    <td className="py-2 px-2 align-top">
                      <button
                        onClick={() => toggle(id)}
                        className="text-left w-full"
                      >
                        <span className="font-mono text-gray-200 break-all">
                          {mask(isExpanded ? command : command.slice(0, 120) + (command.length > 120 ? "..." : ""))}
                        </span>
                      </button>
                      {isExpanded && output && (
                        <pre className="mt-2 p-2 bg-gray-900/60 rounded text-gray-400 font-mono text-[11px] max-h-48 overflow-auto whitespace-pre-wrap break-all">
                          {mask(typeof output === "string" ? output : JSON.stringify(output, null, 2))}
                        </pre>
                      )}
                    </td>
                    <td className="py-2 px-2 align-top whitespace-nowrap">
                      {exitCode !== undefined ? (
                        <span
                          className={`font-mono ${
                            exitCode === 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {exitCode}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
