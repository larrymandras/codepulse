import { GlassPanel } from "@/components/GlassPanel";
import { Users } from "lucide-react";

export default function Roster() {
  return (
    <div className="flex-1 overflow-auto">
      <GlassPanel className="m-6 p-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-foreground">Agent Roster</h1>
          <p className="text-sm text-muted-foreground">
            View and manage all active agents across tiers and profiles.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Full roster with org chart, card grid, and table views coming in a later phase.</span>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
