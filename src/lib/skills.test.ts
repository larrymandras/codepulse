import { describe, it, expect } from "vitest";
import {
  DORMANT_ORIGIN,
  isDormant,
  isShadowing,
  hasDormantCopy,
  projectNameFromSource,
  originLabel,
  originOptions,
  skillInvocation,
  hasKnownUpstream,
  topSkills,
  deckSkills,
} from "./skills";

const proj = (h: string) => `claude-code:project:${h}`;

describe("isDormant / isShadowing", () => {
  it("dormant when every origin is cold storage", () => {
    expect(isDormant({ name: "a", origins: [DORMANT_ORIGIN] })).toBe(true);
  });
  it("not dormant when also active", () => {
    const s = { name: "a", origins: [DORMANT_ORIGIN, "claude-code"] };
    expect(isDormant(s)).toBe(false);
    expect(isShadowing(s)).toBe(true);
  });
  it("not dormant with no origins", () => {
    expect(isDormant({ name: "a", origins: [] })).toBe(false);
  });
});

describe("hasDormantCopy (98-REVIEW WR-04)", () => {
  it("true for a purely dormant skill", () => {
    expect(hasDormantCopy({ name: "a", origins: [DORMANT_ORIGIN] })).toBe(true);
  });
  it("true for a SHADOWED skill (dormant copy + active copy) — the cold copy must stay reachable", () => {
    expect(hasDormantCopy({ name: "a", origins: [DORMANT_ORIGIN, "claude-code"] })).toBe(true);
  });
  it("false for an active-only skill and for no origins", () => {
    expect(hasDormantCopy({ name: "a", origins: ["claude-code"] })).toBe(false);
    expect(hasDormantCopy({ name: "a", origins: [] })).toBe(false);
    expect(hasDormantCopy({ name: "a" })).toBe(false);
  });
});

describe("projectNameFromSource", () => {
  it("recovers the repo folder from a windows path", () => {
    expect(projectNameFromSource("C:\\Users\\mandr\\codepulse\\.claude\\skills\\x\\SKILL.md")).toBe("codepulse");
  });
  it("recovers the repo folder from a posix path", () => {
    expect(projectNameFromSource("/home/l/astridr-repo/.claude/skills/x/SKILL.md")).toBe("astridr-repo");
  });
  it("returns null for a non-project path", () => {
    expect(projectNameFromSource("/home/l/.claude/skills/x/SKILL.md")).toBe("l");
    expect(projectNameFromSource(undefined)).toBeNull();
    expect(projectNameFromSource("no-claude-dir/SKILL.md")).toBeNull();
  });
});

describe("originLabel", () => {
  it("labels dormant and active", () => {
    expect(originLabel(DORMANT_ORIGIN)).toBe("Dormant (cold storage)");
    expect(originLabel("claude-code")).toBe("Claude Code");
  });
  it("names the project when known, else shows a hash stub", () => {
    expect(originLabel(proj("abc123def456"), "codepulse")).toBe("Project · codepulse");
    expect(originLabel(proj("abc123def456"))).toBe("Project · abc123d");
  });
  it("passes through unknown origins", () => {
    expect(originLabel("bridge")).toBe("bridge");
  });
});

describe("originOptions", () => {
  it("gives five distinct labels for five project origins (regression: all read 'Project')", () => {
    const skills = [
      { name: "a", origins: [proj("h1")], source: "C:/r/codepulse/.claude/skills/a/SKILL.md" },
      { name: "b", origins: [proj("h2")], source: "C:/r/astridr-repo/.claude/skills/b/SKILL.md" },
      { name: "c", origins: [proj("h3")], source: "C:/r/sfx-video-library/.claude/skills/c/SKILL.md" },
      { name: "d", origins: [proj("h4")], source: "C:/r/protectall/.claude/skills/d/SKILL.md" },
      { name: "e", origins: [proj("h5")], source: "C:/r/Mandras/.claude/skills/e/SKILL.md" },
    ];
    const labels = originOptions(skills).map((o) => o.label);
    expect(new Set(labels).size).toBe(5);
    expect(labels).toContain("Project · codepulse");
    expect(labels).toContain("Project · astridr-repo");
  });

  it("disambiguates two repos sharing a folder name", () => {
    const skills = [
      { name: "a", origins: [proj("aaaaaaa1")], source: "C:/x/app/.claude/skills/a/SKILL.md" },
      { name: "b", origins: [proj("bbbbbbb2")], source: "D:/y/app/.claude/skills/b/SKILL.md" },
    ];
    const labels = originOptions(skills).map((o) => o.label);
    expect(new Set(labels).size).toBe(2);
    expect(labels.every((l) => l.startsWith("Project · app"))).toBe(true);
  });

  it("ignores the source of a multi-origin skill when naming a project", () => {
    // `shared` lives in both the global dir and the vault repo; grouping keeps only one
    // source. Naming the project from it would yield "mandr" instead of "Mandras".
    const skills = [
      { name: "shared", origins: ["claude-code", proj("v1")], source: "C:/Users/mandr/.claude/skills/shared/SKILL.md" },
      { name: "vault-only", origins: [proj("v1")], source: "C:/Users/mandr/Mandras/.claude/skills/vault-only/SKILL.md" },
    ];
    const labels = originOptions(skills).map((o) => o.label);
    expect(labels).toContain("Project · Mandras");
    expect(labels).not.toContain("Project · mandr");
  });

  it("falls back to a hash stub when every skill in a project origin is multi-origin", () => {
    const skills = [
      { name: "shared", origins: ["claude-code", proj("abc1234def")], source: "C:/Users/mandr/.claude/skills/shared/SKILL.md" },
    ];
    const labels = originOptions(skills).map((o) => o.label);
    expect(labels).toContain("Project · abc1234");
  });

  it("dedupes one origin shared by many skills", () => {
    const skills = [
      { name: "a", origins: ["claude-code"] },
      { name: "b", origins: ["claude-code"] },
      { name: "c", origins: [DORMANT_ORIGIN] },
    ];
    expect(originOptions(skills)).toHaveLength(2);
  });
});

describe("skillInvocation", () => {
  it("uses an explicit command and strips arg placeholders", () => {
    expect(skillInvocation({ name: "legal-nda", command: "/legal nda <description or file>" })).toBe("/legal nda");
  });
  it("falls back to /<name>", () => {
    expect(skillInvocation({ name: "deep-research" })).toBe("/deep-research");
  });
  it("ignores a blank command", () => {
    expect(skillInvocation({ name: "x", command: "   " })).toBe("/x");
  });
});

describe("hasKnownUpstream", () => {
  it("treats the literal 'unknown' as no upstream", () => {
    expect(hasKnownUpstream({ name: "a", upstream: "unknown" })).toBe(false);
    expect(hasKnownUpstream({ name: "a" })).toBe(false);
    expect(hasKnownUpstream({ name: "a", upstream: "https://github.com/anthropics/skills" })).toBe(true);
  });
});

describe("topSkills", () => {
  it("ranks by useCount, then recency", () => {
    const out = topSkills([
      { name: "a", origins: ["claude-code"], useCount: 2, lastUsedAt: 1 },
      { name: "b", origins: ["claude-code"], useCount: 9, lastUsedAt: 1 },
      { name: "c", origins: ["claude-code"], useCount: 2, lastUsedAt: 50 },
    ]);
    expect(out.map((s) => s.name)).toEqual(["b", "c", "a"]);
  });
  it("excludes dormant skills — copying their command would do nothing", () => {
    const out = topSkills([
      { name: "cold", origins: [DORMANT_ORIGIN], useCount: 99 },
      { name: "warm", origins: ["claude-code"], useCount: 1 },
    ]);
    expect(out.map((s) => s.name)).toEqual(["warm"]);
  });
  it("excludes hidden and never-used skills", () => {
    expect(topSkills([{ name: "a", origins: ["claude-code"], useCount: 0 }])).toEqual([]);
    expect(topSkills([{ name: "b", origins: ["claude-code"], useCount: 3, hidden: true }])).toEqual([]);
  });
  it("respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `s${i}`, origins: ["claude-code"], useCount: i + 1 }));
    expect(topSkills(many, 8)).toHaveLength(8);
  });
});

describe("deckSkills", () => {
  const base = { origins: ["claude-code"] };
  it("pins favorites first (by useCount), then fills with most-used non-favorites", () => {
    const deck = deckSkills([
      { ...base, name: "big", useCount: 50, favorite: false },
      { ...base, name: "fav-low", useCount: 2, favorite: true },
      { ...base, name: "fav-high", useCount: 9, favorite: true },
      { ...base, name: "mid", useCount: 5, favorite: false },
    ]);
    expect(deck.map((s) => s.name)).toEqual(["fav-high", "fav-low", "big", "mid"]);
  });

  it("includes a never-used favorite but not a never-used non-favorite", () => {
    const deck = deckSkills([
      { ...base, name: "fav-unused", useCount: 0, favorite: true },
      { ...base, name: "unused", useCount: 0, favorite: false },
    ]);
    expect(deck.map((s) => s.name)).toEqual(["fav-unused"]);
  });

  it("excludes dormant skills even when favorited, and hidden skills", () => {
    const deck = deckSkills([
      { name: "cold-fav", origins: [DORMANT_ORIGIN], useCount: 99, favorite: true },
      { ...base, name: "ghost", useCount: 99, favorite: true, hidden: true },
      { ...base, name: "alive", useCount: 1, favorite: false },
    ]);
    expect(deck.map((s) => s.name)).toEqual(["alive"]);
  });

  it("never duplicates a favorite in the most-used fill and caps at limit", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...base, name: `s${i}`, useCount: 20 - i, favorite: i < 3,
    }));
    const deck = deckSkills(many, 10);
    expect(deck).toHaveLength(10);
    expect(new Set(deck.map((s) => s.name)).size).toBe(10);
    expect(deck.slice(0, 3).every((s) => s.favorite)).toBe(true);
  });
});
