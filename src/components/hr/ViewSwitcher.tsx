import { Network, LayoutGrid, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ViewSwitcherProps {
  value: "chart" | "grid" | "table";
  onChange: (mode: "chart" | "grid" | "table") => void;
}

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as "chart" | "grid" | "table");
      }}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value="chart" aria-label="Org chart view">
        <Network className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label="Card grid view">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="table" aria-label="Table view">
        <List className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
