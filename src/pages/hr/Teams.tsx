import { GlassPanel } from "@/components/GlassPanel";
import { UsersRound } from "lucide-react";

export default function Teams() {
  return (
    <div className="flex-1 overflow-auto">
      <GlassPanel className="m-6 p-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-foreground">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Compose team presets and launch war rooms with dynamic participants.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UsersRound className="h-4 w-4" />
            <span>Team composition with drag-and-drop and war room launch is coming in a later phase.</span>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
