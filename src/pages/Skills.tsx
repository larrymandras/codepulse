import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CategoryTabs } from "@/components/skills/CategoryTabs";
import { ViewToggle, type SkillsView } from "@/components/skills/ViewToggle";
import { EditModeToggle } from "@/components/skills/EditModeToggle";
import { SkillGrid } from "@/components/skills/SkillGrid";
import { SkillList } from "@/components/skills/SkillList";
import { FrequentSkills } from "@/components/skills/FrequentSkills";
import { NewSkillsBanner } from "@/components/skills/NewSkillsBanner";
import { SkillEditPopover } from "@/components/skills/SkillEditPopover";
import { CategoryEditPopover } from "@/components/skills/CategoryEditPopover";
import type { Doc } from "../../convex/_generated/dataModel";

function getStoredView(): SkillsView {
  return (localStorage.getItem("codepulse-skills-view") as SkillsView) ?? "grid";
}

export default function Skills() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [view, setView] = useState<SkillsView>(getStoredView);
  const [editMode, setEditMode] = useState(false);
  const [manualSetup, setManualSetup] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Doc<"skillCategories"> | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const enrichedSkills = useQuery(api.skillCategories.getSkillsWithOverrides) ?? [];
  const categories = useQuery(api.skillCategories.listCategories) ?? [];
  const autoAssignedCount = useQuery(api.skillCategories.countAutoAssigned) ?? 0;

  const recordLaunch = useMutation(api.registry.recordSkillLaunch);
  const updateOverride = useMutation(api.skillCategories.updateSkillOverride);
  const updateCat = useMutation(api.skillCategories.updateCategory);
  const createCat = useMutation(api.skillCategories.createCategory);
  const deleteCat = useMutation(api.skillCategories.deleteCategory);
  const bulkAccept = useMutation(api.skillCategories.bulkAcceptAutoAssigned);
  const seedAll = useMutation(api.skillCategories.seedExistingSkills);

  const visibleSkills = useMemo(() => {
    let filtered = enrichedSkills.filter((s) => !s.hidden);
    if (activeCategory) {
      filtered = filtered.filter((s) => s.categoryName === activeCategory);
    }
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
  }, [enrichedSkills, activeCategory, search]);

  const handleLaunch = async (skillName: string) => {
    await recordLaunch({ name: skillName });
    navigate(`/chat?skill=${encodeURIComponent(skillName)}`);
  };

  const handleViewChange = (v: SkillsView) => {
    setView(v);
    localStorage.setItem("codepulse-skills-view", v);
  };

  const handleSaveSkillOverride = async (updates: {
    displayName: string;
    description: string;
    categoryName: string;
    hidden: boolean;
  }) => {
    if (!editingSkill) return;
    await updateOverride({
      skillName: editingSkill,
      ...updates,
    });
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
    await createCat({
      name,
      ...data,
      sortOrder: Date.now(),
    });
    setCreatingCategory(false);
  };

  const handleDeleteCategory = async () => {
    if (!editingCategory) return;
    await deleteCat({ id: editingCategory._id });
    setEditingCategory(null);
  };

  const handleReviewNew = () => {
    setEditMode(true);
  };

  const needsSeed = enrichedSkills.length > 0 && categories.length === 0 && !manualSetup;

  const editingSkillData = editingSkill
    ? enrichedSkills.find((s) => s.name === editingSkill)
    : null;

  const editingCategorySkillCount = editingCategory
    ? enrichedSkills.filter((s) => s.categoryName === editingCategory.name).length
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white font-heading">
          Skills
        </h1>
        {editMode && (
          <span className="text-xs text-indigo-400 bg-indigo-900/30 px-2 py-1 rounded">
            Edit Mode
          </span>
        )}
      </div>

      {needsSeed && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 text-center">
          <p className="text-gray-300 mb-3">
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
              onClick={() => { setManualSetup(true); setEditMode(true); }}
              className="bg-gray-700 text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              Set Up Manually
            </button>
          </div>
        </div>
      )}

      {!needsSeed && (
        <>
          <input
            type="text"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />

          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <CategoryTabs
                categories={categories}
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
                editMode={editMode}
                onEditCategory={setEditingCategory}
                onAddCategory={() => setCreatingCategory(true)}
              />
            </div>
            <ViewToggle view={view} onChange={handleViewChange} />
            <EditModeToggle
              editMode={editMode}
              onToggle={() => setEditMode(!editMode)}
            />
          </div>

          {autoAssignedCount > 0 && (
            <NewSkillsBanner
              count={autoAssignedCount}
              onReview={handleReviewNew}
              onAcceptAll={() => bulkAccept()}
            />
          )}

          <FrequentSkills skills={enrichedSkills} onLaunch={handleLaunch} />

          {view === "grid" ? (
            <SkillGrid
              skills={visibleSkills}
              editMode={editMode}
              onLaunch={handleLaunch}
              onEditSkill={setEditingSkill}
            />
          ) : (
            <SkillList
              skills={visibleSkills}
              categories={categories}
              editMode={editMode}
              onLaunch={handleLaunch}
              onEditSkill={setEditingSkill}
            />
          )}
        </>
      )}

      {editingSkillData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SkillEditPopover
            skillName={editingSkillData.name}
            displayName={editingSkillData.displayName}
            description={
              editingSkillData.overrideDescription ??
              editingSkillData.description ??
              ""
            }
            categoryName={editingSkillData.categoryName ?? "uncategorized"}
            hidden={editingSkillData.hidden}
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
          />
        </div>
      )}
    </div>
  );
}
