import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  onLaunchWarRoom: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  onLaunchWarRoom,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base font-medium text-foreground">
            {selectedCount} agent{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
        </div>
        <Button
          className="bg-red-600 hover:bg-red-700 text-white"
          size="sm"
          onClick={onLaunchWarRoom}
        >
          <Zap className="h-4 w-4 mr-1" />
          Launch War Room with {selectedCount} agent
          {selectedCount !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}

export default BulkActionBar;
