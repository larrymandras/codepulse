interface SkillLike {
  name: string;
  description?: string;
  useCount?: number;
  lastUsedAt?: number;
  [key: string]: unknown;
}

export interface CategoryGroup<T extends SkillLike = SkillLike> {
  category: string;
  prefix: string;
  skills: T[];
}

export function titleCase(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function stripPrefix(skillName: string, prefix: string): string {
  if (skillName === prefix) return titleCase(skillName);
  const suffix = skillName.slice(prefix.length + 1);
  return suffix
    .split("-")
    .map(titleCase)
    .join(" ");
}

function getPrefix(name: string): string {
  const idx = name.indexOf("-");
  return idx === -1 ? name : name.slice(0, idx);
}

export function groupByCategory<T extends SkillLike>(skills: T[]): CategoryGroup<T>[] {
  if (skills.length === 0) return [];

  const map = new Map<string, T[]>();
  for (const skill of skills) {
    const prefix = getPrefix(skill.name);
    const existing = map.get(prefix);
    if (existing) {
      existing.push(skill);
    } else {
      map.set(prefix, [skill]);
    }
  }

  return Array.from(map.entries())
    .map(([prefix, groupSkills]) => ({
      category: titleCase(prefix),
      prefix,
      skills: groupSkills,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
