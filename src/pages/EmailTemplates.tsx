import { useState } from "react";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LayoutTemplate, FileText, UserCircle } from "lucide-react";
import { useEmailLayouts } from "@/hooks/useEmailLayouts";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useAgentDefaults } from "@/hooks/useAgentDefaults";
import { LayoutSheet } from "@/components/email/LayoutSheet";
import { TemplateSheet } from "@/components/email/TemplateSheet";
import { AgentDefaultSheet } from "@/components/email/AgentDefaultSheet";
import { AssetGallery } from "@/components/email/AssetGallery";
import type { AgentEmailDefaults } from "@/lib/astridrApi";

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

  // Templates data + sheet state
  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    reload: reloadTemplates,
  } = useEmailTemplates();
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [templateSheetMode, setTemplateSheetMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingTemplateSlug, setEditingTemplateSlug] = useState<string | null>(
    null,
  );

  // Agent defaults data + sheet state
  const {
    agents,
    loading: agentsLoading,
    error: agentsError,
    reload: reloadAgents,
  } = useAgentDefaults();
  const [agentSheetOpen, setAgentSheetOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<{
    id: string;
    name: string;
    defaults: AgentEmailDefaults | null;
  } | null>(null);

  // Layouts tab sheet openers
  const openCreateLayoutSheet = () => {
    setLayoutSheetMode("create");
    setEditingLayoutSlug(null);
    setLayoutSheetOpen(true);
  };

  const openEditLayoutSheet = (slug: string) => {
    setLayoutSheetMode("edit");
    setEditingLayoutSlug(slug);
    setLayoutSheetOpen(true);
  };

  // Templates tab sheet openers
  const openCreateTemplateSheet = () => {
    setTemplateSheetMode("create");
    setEditingTemplateSlug(null);
    setTemplateSheetOpen(true);
  };

  const openEditTemplateSheet = (slug: string) => {
    setTemplateSheetMode("edit");
    setEditingTemplateSlug(slug);
    setTemplateSheetOpen(true);
  };

  // Agent defaults sheet opener
  const openAgentSheet = (
    id: string,
    name: string,
    defaults: AgentEmailDefaults | null,
  ) => {
    setEditingAgent({ id, name, defaults });
    setAgentSheetOpen(true);
  };

  // Look up layout name from layouts array by id
  const layoutNameById = (id: string | null) => {
    if (!id) return null;
    return layouts.find((l) => l.id === id)?.name ?? null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[Cinzel]">Email Templates</h1>
        {/* Primary CTA changes per tab */}
        {activeTab === "layouts" && (
          <Button onClick={openCreateLayoutSheet}>New Layout</Button>
        )}
        {activeTab === "templates" && (
          <Button onClick={openCreateTemplateSheet}>New Template</Button>
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
                <Button onClick={openCreateLayoutSheet}>New Layout</Button>
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
                        onClick={() => openEditLayoutSheet(layout.slug)}
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

        {/* Templates tab */}
        <TabsContent value="templates">
          <SectionErrorBoundary name="Templates">
            {/* Loading */}
            {templatesLoading && (
              <div className="space-y-2 pt-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}

            {/* Error */}
            {templatesError && !templatesLoading && (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-sm text-destructive">{templatesError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void reloadTemplates()}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Empty */}
            {!templatesLoading && !templatesError && templates.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <h2 className="text-base font-semibold">No templates yet</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Templates define the content body of an email. Start by
                  creating a layout first.
                </p>
                <Button onClick={openCreateTemplateSheet}>New Template</Button>
              </div>
            )}

            {/* Templates list */}
            {!templatesLoading && !templatesError && templates.length > 0 && (
              <div className="mt-4 rounded-md border border-border overflow-hidden">
                {templates.map((template) => {
                  const varCount = Object.keys(template.variables ?? {}).length;
                  const layoutName = layoutNameById(template.layout_id);
                  return (
                    <div
                      key={template.slug}
                      className="flex items-center justify-between bg-card border-b border-border px-4 py-3 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{template.name}</p>
                          {layoutName && (
                            <Badge variant="outline" className="text-xs">
                              {layoutName}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {varCount} {varCount === 1 ? "var" : "vars"}
                          </Badge>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          {template.slug}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditTemplateSheet(template.slug)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionErrorBoundary>
        </TabsContent>

        {/* Agent Defaults tab */}
        <TabsContent value="agent-defaults">
          <SectionErrorBoundary name="Agent Defaults">
            {/* Loading */}
            {agentsLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            )}

            {/* Error */}
            {agentsError && !agentsLoading && (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-sm text-destructive">{agentsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void reloadAgents()}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Empty */}
            {!agentsLoading && !agentsError && agents.length === 0 && (
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
            )}

            {/* Agent card grid */}
            {!agentsLoading && !agentsError && agents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {agents.map((agent) => {
                  const defaults = agent.emailDefaults;
                  const avatarUrl =
                    defaults?.avatar_storage_path
                      ? defaults.avatar_storage_path.startsWith("http")
                        ? defaults.avatar_storage_path
                        : `${import.meta.env.VITE_ASTRIDR_API_URL ?? ""}/api/email-assets/public/${defaults.avatar_storage_path}`
                      : null;
                  const displayName = defaults?.signature_name || agent.name;
                  const displayTitle = defaults?.signature_title || "No title set";
                  const assignedLayout = layoutNameById(defaults?.default_layout_id ?? null);

                  return (
                    <div
                      key={agent.id}
                      className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/30 transition-colors"
                      onClick={() =>
                        openAgentSheet(agent.id, agent.name, defaults)
                      }
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar or initials */}
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="w-12 h-12 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <span className="text-sm font-semibold text-muted-foreground">
                              {agent.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{displayTitle}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {assignedLayout
                              ? `Layout: ${assignedLayout}`
                              : "No layout assigned"}
                          </p>
                          {!defaults && (
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              No email defaults configured
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

      {/* TemplateSheet: create/edit */}
      <TemplateSheet
        templateSlug={editingTemplateSlug}
        mode={templateSheetMode}
        open={templateSheetOpen}
        onOpenChange={setTemplateSheetOpen}
        onSaved={() => {
          void reloadTemplates();
        }}
        layouts={layouts}
      />

      {/* AgentDefaultSheet: edit agent email defaults */}
      <AgentDefaultSheet
        agentId={editingAgent?.id ?? null}
        agentName={editingAgent?.name ?? ""}
        existingDefaults={editingAgent?.defaults ?? null}
        layouts={layouts}
        open={agentSheetOpen}
        onOpenChange={setAgentSheetOpen}
        onSaved={() => {
          void reloadAgents();
        }}
      />
    </div>
  );
}
