import { useState } from "react";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutTemplate, FileText, UserCircle } from "lucide-react";
import { useEmailLayouts } from "@/hooks/useEmailLayouts";
import { LayoutSheet } from "@/components/email/LayoutSheet";
import { AssetGallery } from "@/components/email/AssetGallery";

export default function EmailTemplates() {
  const [activeTab, setActiveTab] = useState("layouts");

  // Layouts data + sheet state
  const {
    layouts,
    loading: layoutsLoading,
    error: layoutsError,
    reload: reloadLayouts,
  } = useEmailLayouts();
  const [layoutSheetOpen, setLayoutSheetOpen] = useState(false);
  const [layoutSheetMode, setLayoutSheetMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingLayoutSlug, setEditingLayoutSlug] = useState<string | null>(
    null,
  );

  const openCreateSheet = () => {
    setLayoutSheetMode("create");
    setEditingLayoutSlug(null);
    setLayoutSheetOpen(true);
  };

  const openEditSheet = (slug: string) => {
    setLayoutSheetMode("edit");
    setEditingLayoutSlug(slug);
    setLayoutSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[Cinzel]">Email Templates</h1>
        {/* Primary CTA changes per tab */}
        {activeTab === "layouts" && (
          <Button onClick={openCreateSheet}>New Layout</Button>
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

        {/* Layouts tab */}
        <TabsContent value="layouts">
          <SectionErrorBoundary name="Layouts">
            {/* Loading */}
            {layoutsLoading && (
              <div className="space-y-2 pt-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}

            {/* Error */}
            {layoutsError && !layoutsLoading && (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-sm text-destructive">{layoutsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void reloadLayouts()}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Empty */}
            {!layoutsLoading && !layoutsError && layouts.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <LayoutTemplate className="h-12 w-12 text-muted-foreground" />
                <h2 className="text-base font-semibold">No layouts yet</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Create a layout to define the outer structure of your emails
                  — header, footer, and CSS.
                </p>
                <Button onClick={openCreateSheet}>New Layout</Button>
              </div>
            )}

            {/* Layout list */}
            {!layoutsLoading && !layoutsError && layouts.length > 0 && (
              <div className="mt-4 rounded-md border border-border overflow-hidden">
                {layouts.map((layout) => (
                  <div
                    key={layout.slug}
                    className="flex items-center justify-between bg-card border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{layout.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {layout.slug}
                      </p>
                      {layout.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-md">
                          {layout.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditSheet(layout.slug)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionErrorBoundary>
        </TabsContent>

        {/* Templates tab (placeholder — Plan 04) */}
        <TabsContent value="templates">
          <SectionErrorBoundary name="Templates">
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-base font-semibold">No templates yet</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Templates define the content body of an email. Start by
                creating a layout first.
              </p>
              <Button>New Template</Button>
            </div>
          </SectionErrorBoundary>
        </TabsContent>

        {/* Agent Defaults tab (placeholder — Plan 05) */}
        <TabsContent value="agent-defaults">
          <SectionErrorBoundary name="Agent Defaults">
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <UserCircle className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-base font-semibold">
                No agent defaults configured
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Agent defaults let each AI persona have its own signature and
                email style.
              </p>
            </div>
          </SectionErrorBoundary>
        </TabsContent>

        {/* Assets tab — wired to AssetGallery */}
        <TabsContent value="assets">
          <SectionErrorBoundary name="Assets">
            <div className="pt-4">
              <AssetGallery />
            </div>
          </SectionErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* LayoutSheet: create/edit */}
      <LayoutSheet
        layoutSlug={editingLayoutSlug}
        mode={layoutSheetMode}
        open={layoutSheetOpen}
        onOpenChange={setLayoutSheetOpen}
        onSaved={() => {
          void reloadLayouts();
        }}
      />
    </div>
  );
}
