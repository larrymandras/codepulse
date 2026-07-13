import { useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import CatalogBrowser from "@/components/hr/CatalogBrowser";
import type { CatalogEntry } from "@/lib/astridrApi";
import { PageHeader } from "@/components/PageHeader";

export default function Catalog() {
  const navigate = useNavigate();

  const handleSelect = (entry: CatalogEntry) => {
    if (entry.id === "__blank__") {
      navigate("/hr/onboarding");
    } else {
      navigate(`/hr/onboarding/${encodeURIComponent(entry.id)}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <GlassPanel className="m-6 p-6 flex-1 flex flex-col min-h-0 overflow-y-auto relative hover:scale-[1.01] transition-transform duration-300">
        <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none animate-scanline mix-blend-overlay" />
        <div className="mb-6 flex flex-col items-start relative z-10">
          <PageHeader title="Agent Catalog" />
          <p className="text-base font-mono tracking-widest text-muted-foreground/80 mt-1 uppercase">
            Browse archetypes from the Astridhr catalog and start onboarding.
          </p>
        </div>
        <div className="flex-1 min-h-0 relative z-10">
          <CatalogBrowser onSelectEntry={handleSelect} />
        </div>
      </GlassPanel>
    </div>
  );
}
