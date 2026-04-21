import { useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import CatalogBrowser from "@/components/hr/CatalogBrowser";
import type { CatalogEntry } from "@/lib/astridrApi";

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
    <div className="flex-1 overflow-auto">
      <GlassPanel className="m-6 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">
            Agent Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse archetypes from the Astridhr catalog and start onboarding.
          </p>
        </div>
        <CatalogBrowser onSelectEntry={handleSelect} />
      </GlassPanel>
    </div>
  );
}
