import { GlassPanel } from "@/components/GlassPanel";
import { Wand2 } from "lucide-react";

export default function Onboarding() {
  return (
    <div className="flex-1 overflow-auto">
      <GlassPanel className="m-6 p-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-foreground">Onboard Agent</h1>
          <p className="text-sm text-muted-foreground">
            Create a new agent using a guided step-by-step wizard.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wand2 className="h-4 w-4" />
            <span>The full onboarding wizard with template selection and auto-save is coming in a later phase.</span>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
