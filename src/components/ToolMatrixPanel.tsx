import { useState } from "react";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Check, AlertTriangle, Minus, Search, Grid } from "lucide-react";
import { useToolMatrix, useUnassignedTools, useRecentAssignmentChanges } from "../hooks/useToolAssignments";

type AgentRow = { agentId: string; agentName: string; kits: string[]; tags: string[]; toolCount: number };
type UnassignedTool = { _id: string; toolId: string; status: string };
type ChangeRow = { _id: string; action: string; toolId: string; tags: string[] };

export function ToolMatrixPanel() {
  const matrix = useToolMatrix();
  const unassigned = useUnassignedTools();
  const changes = useRecentAssignmentChanges(5);
  const [search, setSearch] = useState("");

  if (!matrix) {
    return (
      <Card className="border-gray-700/50 bg-gray-800/50">
        <CardContent className="flex items-center justify-center py-12 text-gray-500">
          No tool assignment data yet. Waiting for sync...
        </CardContent>
      </Card>
    );
  }

  const filteredTags = search
    ? matrix.allTags.filter((t: string) => t.toLowerCase().includes(search.toLowerCase()))
    : matrix.allTags;

  return (
    <div className="space-y-4">
      <Card className="border-gray-700/50 bg-gray-800/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Grid className="h-4 w-4" />
              Tool Matrix
            </CardTitle>
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
              <Input
                placeholder="Filter tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-gray-900/50 border-gray-700"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="pb-2 pr-4 text-left font-medium text-gray-400">Tag</th>
                  {matrix.agents.map((agent: AgentRow) => (
                    <th key={agent.agentId} className="pb-2 px-3 text-center font-medium text-gray-400">
                      {agent.agentName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTags.map((tag: string) => (
                  <tr key={tag} className="border-b border-gray-700/20 hover:bg-gray-700/20">
                    <td className="py-1.5 pr-4 text-gray-300">{tag}</td>
                    {matrix.agents.map((agent: AgentRow) => (
                      <td key={agent.agentId} className="py-1.5 px-3 text-center">
                        {agent.tags.includes(tag) ? (
                          <Check className="mx-auto h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <Minus className="mx-auto h-3.5 w-3.5 text-gray-600" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-500">
            {matrix.agents.map((a: AgentRow) => (
              <span key={a.agentId}>
                {a.agentName}: {a.toolCount} tools
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {unassigned.length > 0 && (
        <Card className="border-amber-500/30 bg-gray-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Pending Classification ({unassigned.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {unassigned.map((tool: UnassignedTool) => (
                <div key={tool.toolId} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">{tool.toolId}</span>
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                    {tool.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {changes.length > 0 && (
        <Card className="border-gray-700/50 bg-gray-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {changes.map((change: ChangeRow) => (
                <div key={change._id} className="flex items-center gap-2 text-xs text-gray-400">
                  <Badge className="h-4 text-[10px]" variant="outline">
                    {change.action}
                  </Badge>
                  <span className="text-gray-300">{change.toolId}</span>
                  <span className="text-gray-500">→</span>
                  <span>{change.tags.join(", ")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
