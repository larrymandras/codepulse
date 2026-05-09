import { useState } from "react";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LayoutTemplate, FileText, UserCircle, ImageOff } from "lucide-react";

export default function EmailTemplates() {
  const [activeTab, setActiveTab] = useState("layouts");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[Cinzel]">Email Templates</h1>
        {/* Primary CTA changes per tab */}
        {activeTab === "layouts" && (
          <Button>New Layout</Button>
        )}
        {activeTab === "templates" && (
          <Button>New Template</Button>
        )}
        {activeTab === "assets" && (
          <Button>Upload Image</Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="layouts">Layouts</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="agent-defaults">Agent Defaults</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="layouts">
          <SectionErrorBoundary name="Layouts">
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <LayoutTemplate className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-base font-semibold">No layouts yet</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Create a layout to define the outer structure of your emails — header, footer, and CSS.
              </p>
              <Button>New Layout</Button>
            </div>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="templates">
          <SectionErrorBoundary name="Templates">
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-base font-semibold">No templates yet</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Templates define the content body of an email. Start by creating a layout first.
              </p>
              <Button>New Template</Button>
            </div>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="agent-defaults">
          <SectionErrorBoundary name="Agent Defaults">
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <UserCircle className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-base font-semibold">No agent defaults configured</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Agent defaults let each AI persona have its own signature and email style.
              </p>
            </div>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="assets">
          <SectionErrorBoundary name="Assets">
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <ImageOff className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-base font-semibold">No assets uploaded</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Upload logos and avatar images to use across your email layouts.
              </p>
              <Button>Upload Image</Button>
            </div>
          </SectionErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
