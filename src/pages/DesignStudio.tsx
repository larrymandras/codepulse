import { useState } from "react";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import DaemonStatusBadge from "@/components/design-studio/DaemonStatusBadge";
import IframeEmbed from "@/components/design-studio/IframeEmbed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DesignStudio() {
  const [activeTab, setActiveTab] = useState("embedded");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[Cinzel]">Design Studio</h1>
        <DaemonStatusBadge />
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
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Native UI workflow — available in next update
            </div>
          </SectionErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
