import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseFrontmatter, repoKey, collectClaudeCodeSkills } from "../skillScan.mjs";

describe("parseFrontmatter", () => {
  it("extracts name and description", () => {
    const fm = parseFrontmatter('---\nname: deep-research\ndescription: "Do research"\n---\nbody');
    expect(fm.name).toBe("deep-research");
    expect(fm.description).toBe("Do research");
  });
  it("returns {} when no frontmatter", () => {
    expect(parseFrontmatter("no frontmatter here")).toEqual({});
  });
});

describe("repoKey", () => {
  it("is stable and case-normalized on win32", () => {
    const a = repoKey("C:/Users/x/Repo", "win32");
    const b = repoKey("c:\\users\\x\\repo\\", "win32");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });
  it("is case-sensitive off win32", () => {
    expect(repoKey("/home/x/Repo", "linux")).not.toBe(repoKey("/home/x/repo", "linux"));
  });
});

describe("collectClaudeCodeSkills", () => {
  let home, cwd;
  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), "home-"));
    cwd = mkdtempSync(join(tmpdir(), "repo-"));
    mkdirSync(join(home, ".claude", "skills", "deep-research"), { recursive: true });
    writeFileSync(join(home, ".claude", "skills", "deep-research", "SKILL.md"),
      "---\nname: deep-research\ndescription: Research\n---\n");
    mkdirSync(join(home, ".claude", "plugins", "cache", "p", "1.0.0", "skills", "brainstorm"), { recursive: true });
    writeFileSync(join(home, ".claude", "plugins", "cache", "p", "1.0.0", "skills", "brainstorm", "SKILL.md"),
      "---\nname: brainstorm\ndescription: Ideas\n---\n");
    mkdirSync(join(cwd, ".git"), { recursive: true });
    mkdirSync(join(cwd, ".claude", "skills", "repo-skill"), { recursive: true });
    writeFileSync(join(cwd, ".claude", "skills", "repo-skill", "SKILL.md"),
      "---\nname: repo-skill\ndescription: Local\n---\n");
  });
  afterAll(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  it("collects personal + plugin as claude-code and project as claude-code:project:<key>", () => {
    const skills = collectClaudeCodeSkills({ home, cwd, platform: "linux" });
    const byName = Object.fromEntries(skills.map((s) => [s.name, s]));
    expect(byName["deep-research"].origin).toBe("claude-code");
    expect(byName["brainstorm"].origin).toBe("claude-code");
    expect(byName["repo-skill"].origin).toBe(`claude-code:project:${repoKey(cwd, "linux")}`);
    expect(byName["deep-research"].description).toBe("Research");
  });
});
