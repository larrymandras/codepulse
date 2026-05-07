import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import DaemonStatusBadge from "@/components/design-studio/DaemonStatusBadge";
import IframeEmbed from "@/components/design-studio/IframeEmbed";
import NativeWorkflow from "@/components/design-studio/NativeWorkflow";
import ProjectGallery from "@/components/design-studio/ProjectGallery";
import ZipImportDialog from "@/components/design-studio/ZipImportDialog";
import MetricCard from "@/components/MetricCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useDesignProjects } from "@/hooks/useDesignProjects";

export default function DesignStudio() {
  const [activeTab, setActiveTab] = useState("embedded");
  const [syncing, setSyncing] = useState(false);
  const [zipImportOpen, setZipImportOpen] = useState(false);

  const projects = useDesignProjects();
  const syncProjects = useAction(api.designProjects.syncFromDaemon);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncProjects();
    } finally {
      setSyncing(false);
    }
  }, [syncProjects]);

  // Auto-sync on mount — fires once (useCallback stabilizes the dependency)
  useEffect(() => {
    void handleSync();
  }, [handleSync]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[Cinzel]">Design Studio</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setZipImportOpen(true)}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Import ZIP
          </button>
          <DaemonStatusBadge />
        </div>
      </div>

      {/* Metric summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Projects" value={projects.length} />
        <MetricCard
          label="Active"
          value={projects.filter((p) => p.status === "active").length}
        />
      </div>

      {/* Mode Tabs per D-02 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="embedded">Embedded Studio</TabsTrigger>
          <TabsTrigger value="native">Native UI</TabsTrigger>
        </TabsList>

        <TabsContent value="embedded">
          <SectionErrorBoundary name="Embedded Studio">
            <IframeEmbed />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="native">
          <SectionErrorBoundary name="Native Workflow">
            <NativeWorkflow />
          </SectionErrorBoundary>

          <Separator className="my-6" />

          <SectionErrorBoundary name="Project Gallery">
            <ProjectGallery
              projects={projects}
              onSync={handleSync}
              syncing={syncing}
            />
          </SectionErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* ZIP import dialog */}
      <ZipImportDialog
        open={zipImportOpen}
        onOpenChange={setZipImportOpen}
        onImportComplete={handleSync}
      />
    </div>
  );
}
