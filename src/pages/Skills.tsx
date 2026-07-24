import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Search, Archive, Boxes } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { CategoryGrid } from "@/components/skills/CategoryGrid";
import { ScopeRail } from "@/components/skills/ScopeRail";
import { SkillsInCategory } from "@/components/skills/SkillsInCategory";
import { AllSkillsOverview } from "@/components/skills/AllSkillsOverview";
import { ColdStorageView } from "@/components/skills/ColdStorageView";
import { QuickDeck } from "@/components/skills/QuickDeck";
import { SkillCommandPalette } from "@/components/skills/SkillCommandPalette";
import { SkillLaunchProvider } from "@/components/skills/SkillLaunchProvider";
import { NewSkillsBanner } from "@/components/skills/NewSkillsBanner";
import { SkillReviewDrawer } from "@/components/skills/SkillReviewDrawer";
import { SkillEditPopover } from "@/components/skills/SkillEditPopover";
import { CategoryEditPopover } from "@/components/skills/CategoryEditPopover";
import { IntakeModal } from "@/components/skills/IntakeModal";
import { IntakeStrip } from "@/components/skills/IntakeStrip";
import { IntakeSheet } from "@/components/skills/IntakeSheet";
import { SkillVaultView } from "@/components/skills/vault/SkillVaultView";
import { MoveToProjectDialog } from "@/components/skills/MoveToProjectDialog";
import { resolveHostId } from "@/components/skills/SkillLifecycleMenu";
import { useForgeHostsRaw } from "@/hooks/useForge";
import { lifecycleRefusalMessage } from "@/hooks/useLifecycle";
import {
  SkillControlSurfaceProvider,
  useSkillControlSurface,
} from "@/hooks/usePendingLifecycleMoves";
import { useIntakeFeed } from "@/hooks/useIntakeFeed";
import { Button } from "@/components/ui/button";
import {
  originOptions,
  hasDormantCopy,
  resolveScopeDrop,
  resolveLifecycleActions,
} from "@/lib/skills";
import type { Doc } from "../../convex/_generated/dataModel";

function SkillsBody() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [coldStorageView, setColdStorageView] = useState(false);
  const [vaultView, setVaultView] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Doc<"skillCategories"> | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Independent from `dropTarget` (category rail) — never shared (Pitfall 5).
  const [dropTargetScope, setDropTargetScope] = useState<string | null>(null);
  const [scopeMoveDialog, setScopeMoveDialog] = useState<{
    skillName: string;
    sourceOrigin: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [reviewing, setReviewing] = useState(false);
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [intakeSheetOpen, setIntakeSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { beginPending, clearPending, draggingLane } = useSkillControlSurface();
  const hostsRaw = useForgeHostsRaw();
  const host = resolveHostId(hostsRaw ?? [], undefined);

  const enrichedSkills = useQuery(api.skillCategories.getSkillsWithOverrides) ?? [];
  const categories = useQuery(api.skillCategories.listCategories) ?? [];
  const feed = useIntakeFeed();

  const updateOverride = useMutation(api.skillCategories.updateSkillOverride);
  const updateCat = useMutation(api.skillCategories.updateCategory);
  const createCat = useMutation(api.skillCategories.createCategory);
  const deleteCat = useMutation(api.skillCategories.deleteCategory);
  const toggleFav = useMutation(api.skillCategories.toggleFavorite);
  const bulkAccept = useMutation(api.skillCategories.bulkAcceptAutoAssigned);
  const seedAll = useMutation(api.skillCategories.seedExistingSkills);
  const enqueueLifecycle = useMutation(api.forge.enqueueLifecycle);

  // Distinct, distinguishable labels — five repos must not all render as "Project".
  const originChoices = useMemo(() => originOptions(enrichedSkills), [enrichedSkills]);

  const reviewSkills = useMemo(
    () => enrichedSkills.filter((s) => s.isAutoAssigned && !s.hidden),
    [enrichedSkills]
  );

  const visibleSkills = useMemo(() => {
    return enrichedSkills.filter(
      (s) =>
        !s.hidden &&
        (originFilter === "all" || (s.origins ?? []).includes(originFilter))
    );
  }, [enrichedSkills, originFilter]);

  // One filter bar, both views: applies to the overview AND the drilled-in
  // category (the old rail input only pretended to search "all skills").
  const filteredSkills = useMemo(() => {
    if (!search) return visibleSkills;
    const q = search.toLowerCase();
    return visibleSkills.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.overrideDescription ?? "").toLowerCase().includes(q)
    );
  }, [visibleSkills, search]);

  const skillCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of visibleSkills) {
      if (s.categoryName) {
        counts[s.categoryName] = (counts[s.categoryName] ?? 0) + 1;
      }
    }
    return counts;
  }, [visibleSkills]);

  const categorySkills = useMemo(() => {
    if (!selectedCategory) return [];
    return filteredSkills.filter((s) => s.categoryName === selectedCategory);
  }, [filteredSkills, selectedCategory]);

  // Dormant skills are only reachable via the origin dropdown otherwise — this
  // rail entry + view make Cold Storage discoverable on its own. hasDormantCopy
  // (not isDormant) so a SHADOWED skill's dormant copy stays reachable too
  // (98-REVIEW WR-04): the registry merges origins into one row, and filtering
  // by isDormant hid the cold copy of any name that was also active.
  const dormantCount = useMemo(
    () => enrichedSkills.filter((s) => !s.hidden && hasDormantCopy(s)).length,
    [enrichedSkills]
  );

  const coldStorageSkills = useMemo(
    () => filteredSkills.filter((s) => hasDormantCopy(s)),
    [filteredSkills]
  );

  const handleSelectCategory = (name: string | null) => {
    setSelectedCategory(name);
    setColdStorageView(false);
  };

  const handleSelectColdStorage = () => {
    setColdStorageView(true);
    setSelectedCategory(null);
  };

  const selectedCategoryData = useMemo(() => {
    if (!selectedCategory) return null;
    const cat = categories.find((c) => c.name === selectedCategory);
    if (!cat) return null;
    return { name: cat.name, displayName: cat.displayName, icon: cat.icon, color: cat.color };
  }, [selectedCategory, categories]);

  const handleReassignSkill = async (skillName: string, newCategoryName: string) => {
    await updateOverride({ skillName, categoryName: newCategoryName });
  };

  const handleDropOnCategory = async (categoryName: string, e?: React.DragEvent) => {
    const skillName = e?.dataTransfer.getData("text/plain");
    if (!skillName) return;
    await updateOverride({ skillName, categoryName });
    setDropTarget(null);
  };

  // Independent scope-lane drop surface (Global/Project/Cold) — dispatches
  // through the shared resolveScopeDrop matrix (Plan 01): no-op / visible
  // reject (ScopeRail already painted the invalid state during dragover) /
  // open MoveToProjectDialog for a Project target (no enqueue at drop time,
  // Pitfall 2/4) / direct enqueueLifecycle with paint-before-await + a
  // .catch() that clears the pending entry for a LAYER-1 synchronous refusal
  // (Pitfall 3 — no forgeCommands row is ever created for that case).
  const handleDropOnScope = (scope: string, e: React.DragEvent) => {
    const skillName = e.dataTransfer.getData("text/plain");
    setDropTargetScope(null);
    if (!skillName) return;
    const skill = enrichedSkills.find((s) => s.name === skillName);
    if (!skill) return; // Tampering guard — an unrecognized name no-ops.

    // draggingLane (set by SkillRow.onDragStart) decides shadowed-row semantics:
    // a shadowed row dragged from Cold Storage must resolve as dormant, not as
    // its active copy — otherwise dropping it back on Cold Storage would archive
    // the live active copy (CR-02). Defaults "active" for active-lane drags.
    const result = resolveScopeDrop(
      skill,
      scope as "global" | "project" | "cold",
      draggingLane
    );

    if (result.kind === "noop" || result.kind === "reject") return;

    if (result.kind === "dialog") {
      const activeOrigin = resolveLifecycleActions(skill).activeOrigin!;
      setScopeMoveDialog({ skillName, sourceOrigin: activeOrigin });
      return;
    }

    const commandId = crypto.randomUUID();
    beginPending(skillName, {
      commandId,
      action: result.action,
      destination: result.destination,
    });
    enqueueLifecycle({
      hostId: host,
      commandId,
      skillName,
      workspaceId: null,
      action: result.action,
      sourceOrigin: result.sourceOrigin,
      destination: result.destination,
    }).catch((err: unknown) => {
      // Match-gated by commandId: if the user already re-dragged this skill
      // (a newer commandId now owns the pending slot), don't wipe its paint (CR-01).
      clearPending(skillName, commandId);
      toast.error(lifecycleRefusalMessage(err));
    });
  };

  const handleSaveSkillOverride = async (updates: {
    displayName: string;
    description: string;
    categoryName: string;
    hidden: boolean;
    favorite: boolean;
  }) => {
    if (!editingSkill) return;
    const { favorite, ...overrideUpdates } = updates;
    await updateOverride({ skillName: editingSkill, ...overrideUpdates });
    const currentSkill = enrichedSkills.find((s) => s.name === editingSkill);
    if (currentSkill && currentSkill.favorite !== favorite) {
      await toggleFav({ skillName: editingSkill });
    }
    setEditingSkill(null);
  };

  const handleSaveCategory = async (updates: {
    displayName: string;
    description: string;
    icon: string;
    color: string;
  }) => {
    if (editingCategory) {
      await updateCat({ id: editingCategory._id, ...updates });
      setEditingCategory(null);
    }
  };

  const handleCreateCategory = async (data: {
    displayName: string;
    description: string;
    icon: string;
    color: string;
  }) => {
    const name = data.displayName.toLowerCase().replace(/\s+/g, "-");
    await createCat({ name, ...data, sortOrder: Date.now() });
    setCreatingCategory(false);
  };

  const handleDeleteCategory = async () => {
    if (!editingCategory) return;
    await deleteCat({ id: editingCategory._id });
    setEditingCategory(null);
  };

  const needsSeed = enrichedSkills.length > 0 && categories.length === 0;

  const editingSkillData = editingSkill
    ? enrichedSkills.find((s) => s.name === editingSkill)
    : null;

  const editingCategorySkillCount = editingCategory
    ? enrichedSkills.filter((s) => s.categoryName === editingCategory.name).length
    : 0;

  const categoryOptions = categories.map((c) => ({
    name: c.name,
    displayName: c.displayName,
    icon: c.icon,
    color: c.color,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Skills"
        className="mb-6"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open skill palette"
            >
              <Search className="w-4 h-4" />
              <span className="font-mono text-xs text-muted-foreground">Ctrl+Shift+K</span>
            </Button>
            <Button
              variant={vaultView ? "default" : "outline"}
              onClick={() => setVaultView((v) => !v)}
              aria-pressed={vaultView}
              aria-label="Toggle 3D vault view"
              className="gap-1.5"
            >
              <Boxes className="w-4 h-4" />
              Vault
            </Button>
            <Button onClick={() => setIntakeModalOpen(true)}>Install skill</Button>
          </div>
        }
      />

      {reviewSkills.length > 0 && (
        <NewSkillsBanner
          // Count what REVIEW will actually show, so the banner and the drawer
          // never disagree. countAutoAssigned includes hidden skills; this doesn't.
          count={reviewSkills.length}
          onReview={() => setReviewing(true)}
          onAcceptAll={() => bulkAccept()}
        />
      )}

      <IntakeStrip
        rows={feed.rows}
        activeCount={feed.activeCount}
        labelFor={feed.labelFor}
        onOpen={() => setIntakeSheetOpen(true)}
      />

      <SkillLaunchProvider>
      {vaultView ? (
        <SkillVaultView
          skills={enrichedSkills}
          onClose={() => setVaultView(false)}
          initialQuery={search}
        />
      ) : (
      <>
      <QuickDeck
        skills={enrichedSkills}
        onToggleFavorite={(name) => toggleFav({ skillName: name })}
      />

      {needsSeed && (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground mb-3">
            Skills found but no categories set up yet.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => seedAll()}>Auto-Classify</Button>
            <Button variant="secondary" onClick={() => setCreatingCategory(true)}>
              Set Up Manually
            </Button>
          </div>
        </div>
      )}

      {!needsSeed && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left rail: categories navigation. Sticky + viewport-bounded so the
              Scope drop lanes + nav stay visible during a drag (Chrome does not
              reliably auto-scroll nested overflow containers mid-DnD); the long
              category list scrolls internally instead of pushing them off-screen. */}
          <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden">
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-2 py-1.5 text-base text-foreground"
              aria-label="Filter by origin"
            >
              <option value="all">All origins</option>
              {originChoices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <div className="flex flex-col gap-2 lg:flex-1 lg:min-h-0">
              <h2 className="text-xs font-mono font-bold text-primary/70 uppercase tracking-[0.2em] flex items-center gap-2 pl-2 flex-shrink-0">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[var(--glow-xs)]" />
                Categories
              </h2>
              {/* Only the category list scrolls — Scope lanes + nav below stay pinned/visible. */}
              <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                <CategoryGrid
                  categories={categories}
                  skillCounts={skillCounts}
                  onSelectCategory={handleSelectCategory}
                  onEditCategory={setEditingCategory}
                  onAddCategory={() => setCreatingCategory(true)}
                  dropTargetCategory={dropTarget}
                  onDragOverCategory={(name) => setDropTarget(name)}
                  onDragLeaveCategory={() => setDropTarget(null)}
                  onDropOnCategory={(name, e) => handleDropOnCategory(name, e)}
                  selectedCategory={selectedCategory}
                />
              </div>
            </div>

            <div className="flex-shrink-0">
              <ScopeRail
                dropTargetScope={dropTargetScope}
                onDragOverScope={setDropTargetScope}
                onDragLeaveScope={() => setDropTargetScope(null)}
                onDropOnScope={handleDropOnScope}
              />
            </div>

            <div className="mt-4 pt-4 border-t border-primary/20 flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => handleSelectCategory(null)}
                className={`w-full text-left px-3 py-2 text-sm font-mono font-bold uppercase tracking-widest rounded transition-all ${
                  !selectedCategory && !coldStorageView
                    ? "bg-primary/20 text-primary border border-primary/50"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary border border-transparent"
                }`}
              >
                Overview / All
              </button>

              {dormantCount > 0 && (
                <button
                  data-testid="cold-storage-nav-toggle"
                  onClick={handleSelectColdStorage}
                  className={`w-full text-left px-3 py-2 text-sm font-mono font-bold uppercase tracking-widest rounded transition-all flex items-center justify-between gap-2 ${
                    coldStorageView
                      ? "bg-primary/20 text-primary border border-primary/50"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                    Cold Storage
                  </span>
                  <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-current/30 flex-shrink-0">
                    {dormantCount}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <input
              type="text"
              placeholder="Filter skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-primary/20 rounded px-4 py-2 text-sm font-mono text-primary placeholder:text-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all shadow-[var(--glow-xs)]"
            />

            {coldStorageView && (
              <ColdStorageView
                skills={coldStorageSkills}
                onEdit={setEditingSkill}
                onToggleFavorite={(name) => toggleFav({ skillName: name })}
              />
            )}

            {!coldStorageView && !selectedCategory && (
              <AllSkillsOverview
                skills={filteredSkills}
                categories={categoryOptions}
                onSelectCategory={handleSelectCategory}
                onEdit={setEditingSkill}
                onToggleFavorite={(name) => toggleFav({ skillName: name })}
              />
            )}

            {!coldStorageView && selectedCategory && selectedCategoryData && (
              <SkillsInCategory
                categoryName={selectedCategoryData.name}
                categoryDisplayName={selectedCategoryData.displayName}
                categoryIcon={selectedCategoryData.icon}
                categoryColor={selectedCategoryData.color}
                skills={categorySkills}
                categories={categoryOptions}
                onBack={() => {
                  setSelectedCategory(null);
                  setSearch("");
                }}
                onEditSkill={setEditingSkill}
                onReassignSkill={handleReassignSkill}
                onToggleFavorite={(name) => toggleFav({ skillName: name })}
              />
            )}
          </div>
        </div>
      )}
      </>
      )}

      <SkillCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        skills={enrichedSkills}
        categories={categoryOptions}
      />
      </SkillLaunchProvider>

      <MoveToProjectDialog
        open={!!scopeMoveDialog}
        skillName={scopeMoveDialog?.skillName ?? ""}
        sourceOrigin={scopeMoveDialog?.sourceOrigin ?? ""}
        hostId={host}
        onOpenChange={(o) => !o && setScopeMoveDialog(null)}
        onMoved={(commandId) => {
          // The pending paint begins HERE (dialog confirm), never at drop
          // time — the Project lane never enqueues until the workspace is
          // chosen and confirmed (D-03, Pitfall 2/4).
          if (scopeMoveDialog) {
            beginPending(scopeMoveDialog.skillName, {
              commandId,
              action: "move",
              destination: "project",
            });
          }
        }}
      />

      <IntakeSheet open={intakeSheetOpen} onOpenChange={setIntakeSheetOpen} feed={feed} />

      <IntakeModal
        open={intakeModalOpen}
        onClose={() => setIntakeModalOpen(false)}
        onEnqueued={(row) => {
          feed.handleEnqueued(row);
          // Immediate feedback: show the new row in context.
          setIntakeSheetOpen(true);
        }}
        onEnqueueFailed={feed.handleEnqueueFailed}
      />

      {reviewing && (
        <SkillReviewDrawer
          skills={reviewSkills}
          categories={categories.map((c) => ({
            name: c.name,
            displayName: c.displayName,
            icon: c.icon,
          }))}
          onAccept={(skillName) => {
            // updateSkillOverride always clears isAutoAssigned. Re-send the existing
            // category so "accept" confirms the guess; an uncategorized skill still
            // accepts (category stays null) rather than silently doing nothing.
            const s = enrichedSkills.find((x) => x.name === skillName);
            void updateOverride(
              s?.categoryName ? { skillName, categoryName: s.categoryName } : { skillName }
            );
          }}
          onMove={(skillName, categoryName) => void updateOverride({ skillName, categoryName })}
          onHide={(skillName) => void updateOverride({ skillName, hidden: true })}
          onAcceptAll={() => {
            void bulkAccept();
            setReviewing(false);
          }}
          onClose={() => setReviewing(false)}
        />
      )}

      {/* ── Modals ── */}
      {editingSkillData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SkillEditPopover
            skillName={editingSkillData.name}
            displayName={editingSkillData.displayName}
            originalDescription={editingSkillData.description ?? ""}
            description={editingSkillData.overrideDescription ?? ""}
            categoryName={editingSkillData.categoryName ?? "uncategorized"}
            hidden={editingSkillData.hidden}
            favorite={editingSkillData.favorite}
            categories={categories.map((c) => ({
              name: c.name,
              displayName: c.displayName,
              icon: c.icon,
            }))}
            onSave={handleSaveSkillOverride}
            onCancel={() => setEditingSkill(null)}
          />
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <CategoryEditPopover
            displayName={editingCategory.displayName}
            description={editingCategory.description}
            icon={editingCategory.icon}
            color={editingCategory.color}
            onSave={handleSaveCategory}
            onCancel={() => setEditingCategory(null)}
            onDelete={handleDeleteCategory}
            canDelete={editingCategorySkillCount === 0}
          />
        </div>
      )}

      {creatingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <CategoryEditPopover
            displayName=""
            description=""
            icon="⚡"
            color="gray"
            onSave={handleCreateCategory}
            onCancel={() => setCreatingCategory(false)}
            onDelete={() => {}}
            canDelete={false}
            isNew
          />
        </div>
      )}
    </div>
  );
}

export default function Skills() {
  return (
    <SkillControlSurfaceProvider>
      <SkillsBody />
    </SkillControlSurfaceProvider>
  );
}
