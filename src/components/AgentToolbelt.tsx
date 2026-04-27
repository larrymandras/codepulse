import { useState } from "react";
import { Badge } from "./ui/badge";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { useAgentToolbelt } from "../hooks/useToolAssignments";

interface AgentToolbeltProps {
  agentId: string;
}

export function AgentToolbelt({ agentId }: AgentToolbeltProps) {
  const toolbelt = useAgentToolbelt(agentId);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

  if (!toolbelt) return null;

  const toggleTag = (tag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Wrench className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-200">Toolbelt</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {toolbelt.kits.map((kit) => (
          <Badge key={kit} variant="outline" className="text-xs border-blue-500/40 text-blue-400">
            {kit.replace("-kit", "")}
          </Badge>
        ))}
      </div>

      <div className="space-y-1">
        {Object.entries(toolbelt.byTag)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([tag, tools]) => (
            <div key={tag}>
              <button
                onClick={() => toggleTag(tag)}
                className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-xs text-gray-300 hover:bg-gray-700/50"
              >
                {expandedTags.has(tag) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span className="font-medium">{tag}</span>
                <span className="text-gray-500">({tools.length})</span>
              </button>
              {expandedTags.has(tag) && (
                <div className="ml-5 space-y-0.5">
                  {tools.map((tool) => (
                    <div key={tool.toolId} className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="truncate">{tool.toolId}</span>
                      {tool.source === "override" && (
                        <Badge className="h-4 bg-amber-500/20 text-amber-400 text-[10px]">+</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>

      {toolbelt.overrides.length > 0 && (
        <div className="mt-2 border-t border-gray-700/30 pt-2">
          <span className="text-[10px] text-gray-500">
            {toolbelt.overrides.length} override{toolbelt.overrides.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div className="mt-2 text-[10px] text-gray-500">
        {toolbelt.toolCount} tools total
      </div>
    </div>
  );
}
