import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CategoryGrid } from "@/components/skills/CategoryGrid";
import { SkillsInCategory } from "@/components/skills/SkillsInCategory";
import { UncategorizedSkills } from "@/components/skills/UncategorizedSkills";
import { FavoriteSkills } from "@/components/skills/FavoriteSkills";
import { FrequentSkills } from "@/components/skills/FrequentSkills";
import { NewSkillsBanner } from "@/components/skills/NewSkillsBanner";
import { SkillEditPopover } from "@/components/skills/SkillEditPopover";
import { CategoryEditPopover } from "@/components/skills/CategoryEditPopover";
import type { Doc } from "../../convex/_generated/dataModel";

export default function Skills() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Doc<"skillCategories"> | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const enrichedSkills = useQuery(api.skillCategories.getSkillsWithOverrides) ?? [];
  const categories = useQuery(api.skillCategories.listCategories) ?? [];
  const autoAssignedCount = useQuery(api.skillCategories.countAutoAssigned) ?? 0;

  const recordLaunch = useMutation(api.registry.recordSkillLaunch);
  const updateOverride = useMutation(api.skillCategories.updateSkillOverride);
  const updateCat = useMutation(api.skillCategories.updateCategory);
  const createCat = useMutation(api.skillCategories.createCategory);
  const deleteCat = useMutation(api.skillCategories.deleteCategory);
  const toggleFav = useMutation(api.skillCategories.toggleFavorite);
  const bulkAccept = useMutation(api.skillCategories.bulkAcceptAutoAssigned);
  const seedAll = useMutation(api.skillCategories.seedExistingSkills);

  const visibleSkills = useMemo(() => {
    return enrichedSkills.filter((s) => !s.hidden);
  }, [enrichedSkills]);

  const skillCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of visibleSkills) {
      if (s.categoryName) {
        counts[s.categoryName] = (counts[s.categoryName] ?? 0) + 1;
      }
    }
    return counts;
  }, [visibleSkills]);

  const uncategorizedSkills = useMemo(() => {
    return visibleSkills.filter((s) => !s.categoryName);
  }, [visibleSkills]);

  const categorySkills = useMemo(() => {
    if (!selectedCategory) return [];
    let filtered = visibleSkills.filter((s) => s.categoryName === selectedCategory);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.displayName.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          (s.overrideDescription ?? "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [visibleSkills, selectedCategory, search]);

  const selectedCategoryData = useMemo(() => {
    if (!selectedCategory) return null;
    const cat = categories.find((c) => c.name === selectedCategory);
    if (!cat) return null;
    return { name: cat.name, displayName: cat.displayName, icon: cat.icon, color: cat.color };
  }, [selectedCategory, categories]);

  const handleLaunch = async (skillName: string) => {
    await recordLaunch({ name: skillName });
    navigate(`/chat?skill=${encodeURIComponent(skillName)}`);
  };

  const handleReassignSkill = async (skillName: string, newCategoryName: string) => {
    await updateOverride({ skillName, categoryName: newCategoryName });
  };

  const handleDropOnCategory = async (categoryName: string, e?: React.DragEvent) => {
    const skillName = e?.dataTransfer.getData("text/plain");
    if (!skillName) return;
    await updateOverride({ skillName, categoryName });
    setDropTarget(null);
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-mono tracking-widest uppercase font-bold text-primary mb-6">
        Skills Database
      </h1>

      {needsSeed && (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground mb-3">
            Skills found but no categories set up yet.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => seedAll()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors text-sm"
            >
              Auto-Classify
            </button>
            <button
              onClick={() => setCreatingCategory(true)}
              className="bg-muted text-foreground px-4 py-2 rounded-lg hover:bg-accent transition-colors text-sm"
            >
              Set Up Manually
            </button>
          </div>
        </div>
      )}

      {!needsSeed && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Sidebar: Categories Navigation */}
          <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-4">
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Search all skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-primary/20 rounded px-4 py-2 text-xs font-mono text-primary placeholder-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all shadow-[inset_0_0_10px_rgba(16,185,129,0.05)]"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <h2 className="text-[10px] font-mono font-bold text-primary/70 uppercase tracking-[0.2em] flex items-center gap-2 pl-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                Categories
              </h2>
              <CategoryGrid
                categories={categories}
                skillCounts={skillCounts}
                onSelectCategory={setSelectedCategory}
                onEditCategory={setEditingCategory}
                onAddCategory={() => setCreatingCategory(true)}
                dropTargetCategory={dropTarget}
                onDragOverCategory={(name) => setDropTarget(name)}
                onDragLeaveCategory={() => setDropTarget(null)}
                onDropOnCategory={(name, e) => handleDropOnCategory(name, e)}
                selectedCategory={selectedCategory}
              />
            </div>
            
            <div className="mt-4 pt-4 border-t border-primary/20">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-widest rounded transition-all ${
                  !selectedCategory ? 'bg-primary/20 text-primary border border-primary/50' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary border border-transparent'
                }`}
              >
                Overview / All
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            {autoAssignedCount > 0 && (
              <NewSkillsBanner
                count={autoAssignedCount}
                onReview={() => {}}
                onAcceptAll={() => bulkAccept()}
              />
            )}

            {/* Always show priority assets unless inside a specific category view that hides them. Actually, keep them visible to act as a top dock. */}
            {!selectedCategory && (
              <>
                <FavoriteSkills
                  skills={enrichedSkills}
                  onLaunch={handleLaunch}
                  onToggleFavorite={(name) => toggleFav({ skillName: name })}
                />
                <FrequentSkills skills={enrichedSkills} onLaunch={handleLaunch} />
                
                {/* Aggregate overview when no category is selected */}
                {uncategorizedSkills.length > 0 && (
                  <div className="border-t border-border pt-6">
                    <UncategorizedSkills
                      skills={uncategorizedSkills}
                      onLaunch={handleLaunch}
                      onEditSkill={setEditingSkill}
                    />
                  </div>
                )}
              </>
            )}

            {selectedCategory && selectedCategoryData && (
              <SkillsInCategory
                categoryName={selectedCategoryData.name}
                categoryDisplayName={selectedCategoryData.displayName}
                categoryIcon={selectedCategoryData.icon}
                categoryColor={selectedCategoryData.color}
                skills={categorySkills}
                categories={categories.map((c) => ({
                  name: c.name,
                  displayName: c.displayName,
                  icon: c.icon,
                  color: c.color,
                }))}
                onBack={() => { setSelectedCategory(null); setSearch(""); }}
                onLaunch={handleLaunch}
                onEditSkill={setEditingSkill}
                onReassignSkill={handleReassignSkill}
                onToggleFavorite={(name) => toggleFav({ skillName: name })}
              />
            )}
          </div>
        </div>
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
