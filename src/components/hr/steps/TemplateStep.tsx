import { useState } from "react";
import { useFormContext } from "react-hook-form";
import CatalogBrowser from "@/components/hr/CatalogBrowser";
import type { CatalogEntry } from "@/lib/astridrApi";
import { getCatalogEntry } from "@/lib/astridrApi";
import type { WizardFormData } from "@/lib/wizardSchemas";
import { RefreshCw } from "lucide-react";

export default function TemplateStep() {
  const form = useFormContext<WizardFormData>();
  const selectedId = form.watch("template.catalogEntryId");
  const selectedName = form.watch("template.catalogEntryName");
  const [loading, setLoading] = useState(false);

  const handleSelect = async (entry: CatalogEntry) => {
    if (entry.id === "__blank__") {
      form.setValue("template.catalogEntryId", undefined);
      form.setValue("template.catalogEntryName", undefined);
      // Clear pre-fills
      form.setValue("identity.displayName", "");
      form.setValue("identity.description", "");
      form.setValue("personality.content", "");
      form.setValue("personality.mode", "custom");
      return;
    }

    form.setValue("template.catalogEntryId", entry.id);
    form.setValue("template.catalogEntryName", entry.name);

    // Fetch full detail for pre-fill
    setLoading(true);
    try {
      const detail = await getCatalogEntry(entry.id);
      form.setValue("identity.displayName", detail.name);
      form.setValue("identity.description", detail.description);

      // Map category to tier
      const tierMap: Record<string, "command" | "domain" | "shared"> = {
        command: "command",
        domain: "domain",
        shared: "shared",
      };
      const tier = tierMap[detail.category.toLowerCase()] ?? "shared";
      form.setValue("identity.tier", tier);

      if (detail.body) {
        form.setValue("personality.content", detail.body);
        form.setValue("personality.mode", "template");
      }
    } catch (err) {
      console.error("Failed to fetch catalog detail:", err);
    } finally {
      setLoading(false);
    }
  };

  if (selectedId) {
    return (
      <div className="space-y-4">
        <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Selected Template
              </p>
              <h3 className="text-base font-medium text-foreground">
                {selectedName || selectedId}
              </h3>
            </div>
            <button
              onClick={() => {
                form.setValue("template.catalogEntryId", undefined);
                form.setValue("template.catalogEntryName", undefined);
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Change Template
            </button>
          </div>
        </div>
        {loading && (
          <p className="text-sm text-muted-foreground">
            Loading template details...
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Click "Next" to continue configuring this agent, or change the
          template above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-medium text-foreground">
          Choose a Template
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select an archetype to pre-fill the wizard, or start from scratch.
        </p>
      </div>
      <CatalogBrowser embedded onSelectEntry={handleSelect} />
    </div>
  );
}
