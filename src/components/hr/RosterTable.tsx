import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import AgentAvatar from "@/components/AgentAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { RosterAgent } from "@/hooks/useRosterAgents";

interface RosterTableProps {
  agents: RosterAgent[];
  onAgentClick: (agentId: string) => void;
  sortBy: string | null;
  onSortChange: (field: string) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

const TIER_BADGE_COLOR: Record<string, string> = {
  command: "bg-purple-600 text-white",
  domain: "bg-blue-600 text-white",
  shared: "bg-gray-600 text-white",
};

function SortIcon({ field, sortBy }: { field: string; sortBy: string | null }) {
  if (!sortBy || !sortBy.startsWith(field)) {
    return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
  }
  return sortBy.endsWith("-desc") ? (
    <ArrowDown className="h-3 w-3 ml-1" />
  ) : (
    <ArrowUp className="h-3 w-3 ml-1" />
  );
}

export function RosterTable({
  agents,
  onAgentClick,
  sortBy,
  onSortChange,
  selectedIds,
  onSelectionChange,
}: RosterTableProps) {
  const allSelected =
    agents.length > 0 && selectedIds.length === agents.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(agents.map((a) => a.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSort = (field: string) => {
    onSortChange(field);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all agents"
            />
          </TableHead>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("name")}
          >
            <span className="flex items-center">
              Agent
              <SortIcon field="name" sortBy={sortBy} />
            </span>
          </TableHead>
          <TableHead
            className="w-[100px] cursor-pointer select-none"
            onClick={() => handleSort("tier")}
          >
            <span className="flex items-center">
              Tier
              <SortIcon field="tier" sortBy={sortBy} />
            </span>
          </TableHead>
          <TableHead
            className="w-[100px] cursor-pointer select-none"
            onClick={() => handleSort("status")}
          >
            <span className="flex items-center">
              Status
              <SortIcon field="status" sortBy={sortBy} />
            </span>
          </TableHead>
          <TableHead
            className="w-[100px] cursor-pointer select-none"
            onClick={() => handleSort("model")}
          >
            <span className="flex items-center">
              Model
              <SortIcon field="model" sortBy={sortBy} />
            </span>
          </TableHead>
          <TableHead
            className="w-[80px] cursor-pointer select-none"
            onClick={() => handleSort("budget_fraction")}
          >
            <span className="flex items-center">
              Budget
              <SortIcon field="budget_fraction" sortBy={sortBy} />
            </span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agents.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-12">
              <span className="text-sm text-muted-foreground">
                No agents match your filters.
              </span>
            </TableCell>
          </TableRow>
        )}
        {agents.map((agent) => {
          const isPending = agent.status === "pending";
          const avatarStatus =
            agent.status === "active"
              ? "active"
              : agent.status === "pending"
                ? "working"
                : "idle";

          return (
            <TableRow
              key={agent.id}
              className={`cursor-pointer ${isPending ? "bg-[var(--status-warn)]/10" : ""}`}
              onClick={() => onAgentClick(agent.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.includes(agent.id)}
                  onCheckedChange={() => toggleOne(agent.id)}
                  aria-label={`Select ${agent.name}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <AgentAvatar
                    avatar={agent.avatarData ?? { name: agent.name }}
                    status={avatarStatus as "active" | "working" | "idle"}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {agent.name}
                    </p>
                    {agent.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {agent.description}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${TIER_BADGE_COLOR[agent.tier] ?? TIER_BADGE_COLOR.shared}`}
                >
                  {agent.tier}
                </Badge>
              </TableCell>
              <TableCell>
                <StatusBadge status={agent.status} />
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {agent.model ?? "\u2014"}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {agent.budget_fraction > 0
                    ? `${Math.round(agent.budget_fraction * 100)}%`
                    : "\u2014"}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default RosterTable;
