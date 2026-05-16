import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Search, Wand2 } from "lucide-react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { groupByCategory, stripPrefix } from "../lib/skillCategories";
import { FrequentSkills } from "../components/skills/FrequentSkills";
import { SkillCategoryAccordion } from "../components/skills/SkillCategoryAccordion";

export default function Skills() {
  const skills = useQuery(api.registry.listSkills) ?? [];
  const recordLaunch = useMutation(api.registry.recordSkillLaunch);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const lowerSearch = search.toLowerCase().trim();

  const filteredGroups = useMemo(() => {
    const groups = groupByCategory(skills);
    if (!lowerSearch) return groups;

    return groups
      .map((group) => {
        const categoryMatch = group.category.toLowerCase().includes(lowerSearch);
        if (categoryMatch) return group;
        const filtered = group.skills.filter(
          (s) =>
            s.name.toLowerCase().includes(lowerSearch) ||
            (s.description ?? "").toLowerCase().includes(lowerSearch)
        );
        if (filtered.length === 0) return null;
        return { ...group, skills: filtered };
      })
      .filter(Boolean) as typeof groups;
  }, [skills, lowerSearch]);

  const searchExpandedCategories = useMemo(() => {
    if (!lowerSearch) return new Set<string>();
    return new Set(filteredGroups.map((g) => g.category));
  }, [filteredGroups, lowerSearch]);

  function toggleCategory(category: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function handleLaunchSkill(skillName: string) {
    recordLaunch({ name: skillName }).catch(() => {});
    navigate(`/chat?skill=${skillName}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white font-[Cinzel]">Skills</h1>
          {skills.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
              {skills.length}
            </span>
          )}
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      <SectionErrorBoundary name="Skills">
        {skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Wand2 className="w-10 h-10 mb-3 opacity-40" />
            <p>No skills discovered yet. Skills appear here after Astridr scans its skills directory.</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No skills match your search.
          </div>
        ) : (
          <>
            {!lowerSearch && (
              <FrequentSkills skills={skills} onLaunchSkill={handleLaunchSkill} />
            )}
            <div className="space-y-2">
              {filteredGroups.map((group) => (
                <SkillCategoryAccordion
                  key={group.category}
                  category={group.category}
                  skills={group.skills.map((s) => ({
                    name: s.name,
                    displayName: stripPrefix(s.name, group.prefix),
                    description: s.description,
                  }))}
                  isOpen={
                    openCategories.has(group.category) ||
                    searchExpandedCategories.has(group.category)
                  }
                  onToggle={() => toggleCategory(group.category)}
                  onLaunchSkill={handleLaunchSkill}
                />
              ))}
            </div>
          </>
        )}
      </SectionErrorBoundary>
    </div>
  );
}
