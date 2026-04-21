import { GlassPanel } from "@/components/GlassPanel";
import { BookOpen } from "lucide-react";

export default function Catalog() {
  return (
    <div className="flex-1 overflow-auto">
      <GlassPanel className="m-6 p-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-foreground">Agent Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Browse archetypes from the Astridhr catalog and start onboarding.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span>Searchable archetype catalog with tier, domain, and capability filters coming in a later phase.</span>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
