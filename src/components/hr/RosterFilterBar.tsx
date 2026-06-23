import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RosterFilterBarProps {
  filters: { tier: string; status: string; profile: string };
  search: string;
  onFiltersChange: (filters: { tier: string; status: string; profile: string }) => void;
  onSearchChange: (search: string) => void;
  profiles: string[];
}

export function RosterFilterBar({
  filters,
  search,
  onFiltersChange,
  onSearchChange,
  profiles,
}: RosterFilterBarProps) {
  const hasActiveFilters =
    filters.tier !== "all" ||
    filters.status !== "all" ||
    filters.profile !== "all" ||
    search.length > 0;

  const clearAll = () => {
    onFiltersChange({ tier: "all", status: "all", profile: "all" });
    onSearchChange("");
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Tier filter */}
      <Select
        value={filters.tier}
        onValueChange={(v) => onFiltersChange({ ...filters, tier: v })}
      >
        <SelectTrigger className="w-[130px] h-9 text-sm">
          <SelectValue placeholder="Tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tiers</SelectItem>
          <SelectItem value="command">Command</SelectItem>
          <SelectItem value="domain">Domain</SelectItem>
          <SelectItem value="shared">Shared</SelectItem>
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={filters.status}
        onValueChange={(v) => onFiltersChange({ ...filters, status: v })}
      >
        <SelectTrigger className="w-[130px] h-9 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="idle">Idle</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>

      {/* Profile filter */}
      <Select
        value={filters.profile}
        onValueChange={(v) => onFiltersChange({ ...filters, profile: v })}
      >
        <SelectTrigger className="w-[130px] h-9 text-sm">
          <SelectValue placeholder="Profile" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Profiles</SelectItem>
          {profiles.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-[280px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search agents..."
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-9 text-sm text-muted-foreground"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
