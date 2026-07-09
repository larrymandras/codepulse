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
  it("parses every key in a CRLF file, not just the last one", () => {
    const fm = parseFrontmatter('---\r\nname: sales-icp\r\ndescription: "Build an ICP"\r\nupstream: unknown\r\n---\r\nbody');
    expect(fm.name).toBe("sales-icp");
    expect(fm.description).toBe("Build an ICP");
    expect(fm.upstream).toBe("unknown");
  });
  it("folds a CRLF block scalar", () => {
    const fm = parseFrontmatter('---\r\nname: legal\r\ndescription: >\r\n  Two\r\n  words.\r\n---\r\n');
    expect(fm.description).toBe("Two words.");
  });
  it("tolerates a UTF-8 BOM before the opening fence", () => {
    const fm = parseFrontmatter('﻿---\nname: x\ndescription: Y\n---\n');
    expect(fm.name).toBe("x");
    expect(fm.description).toBe("Y");
  });
  it("folds a `>` block scalar instead of yielding a literal '>'", () => {
    const fm = parseFrontmatter('---\nname: legal-nda\ndescription: >\n  Generate custom NDAs\n  with triage.\n---\nbody');
    expect(fm.description).toBe("Generate custom NDAs with triage.");
  });
  it("folds a `|` block scalar", () => {
    const fm = parseFrontmatter('---\nname: x\ndescription: |\n  Line one\n  Line two\n---\n');
    expect(fm.description).toBe("Line one Line two");
  });
  it("folds a plain multiline value whose key line is empty", () => {
    const fm = parseFrontmatter('---\nname: rn\ndescription:\n  React Native best\n  practices.\nlicense: MIT\n---\n');
    expect(fm.description).toBe("React Native best practices.");
    expect(fm.license).toBe("MIT");
  });
  it("strips a trailing YAML comment from a scalar", () => {
    const fm = parseFrontmatter('---\nadded: 2026-06-04  # entered cold storage\n---\n');
    expect(fm.added).toBe("2026-06-04");
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
    // Two cached versions of the same plugin; only 1.1.0 is installed.
    for (const [ver, desc] of [["1.0.0", "Ideas OLD"], ["1.1.0", "Ideas NEW"]]) {
      mkdirSync(join(home, ".claude", "plugins", "cache", "p", ver, "skills", "brainstorm"), { recursive: true });
      writeFileSync(join(home, ".claude", "plugins", "cache", "p", ver, "skills", "brainstorm", "SKILL.md"),
        `---\nname: brainstorm\ndescription: ${desc}\n---\n`);
    }
    writeFileSync(join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({
      version: 2,
      plugins: { "p@official": [{ installPath: join(home, ".claude", "plugins", "cache", "p", "1.1.0") }] },
    }));
    mkdirSync(join(home, ".claude", "skills-available", "sales-icp"), { recursive: true });
    writeFileSync(join(home, ".claude", "skills-available", "sales-icp", "SKILL.md"),
      "---\nname: sales-icp\ndescription: Build an ICP\nupstream: unknown\n---\n");
    // a non-directory sibling must not be mistaken for a skill
    writeFileSync(join(home, ".claude", "skills-available", "CATALOG.md"), "# catalog\n");
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

  it("collects cold storage under a distinct claude-code:available origin", () => {
    const skills = collectClaudeCodeSkills({ home, cwd, platform: "linux" });
    const icp = skills.find((s) => s.name === "sales-icp");
    expect(icp).toBeDefined();
    expect(icp.origin).toBe("claude-code:available");
    expect(icp.description).toBe("Build an ICP");
  });

  it("does not treat a loose file in skills-available as a skill", () => {
    const skills = collectClaudeCodeSkills({ home, cwd, platform: "linux" });
    expect(skills.some((s) => s.name === "CATALOG.md")).toBe(false);
  });

  it("keeps one row per (name, origin), preferring the personal skills dir over a plugin", () => {
    // The plugin cache also ships a `deep-research`; the personal dir must win.
    const pluginSkill = join(home, ".claude", "plugins", "cache", "p", "1.1.0", "skills", "deep-research");
    mkdirSync(pluginSkill, { recursive: true });
    writeFileSync(join(pluginSkill, "SKILL.md"), "---\nname: deep-research\ndescription: FROM PLUGIN\n---\n");

    const skills = collectClaudeCodeSkills({ home, cwd, platform: "linux" });
    const rows = skills.filter((s) => s.name === "deep-research" && s.origin === "claude-code");
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("Research"); // the personal dir's copy
    rmSync(pluginSkill, { recursive: true, force: true });
  });

  it("emits only the INSTALLED version of a plugin skill, not every cached version", () => {
    const skills = collectClaudeCodeSkills({ home, cwd, platform: "linux" });
    const brainstorm = skills.filter((s) => s.name === "brainstorm");
    expect(brainstorm).toHaveLength(1);
    expect(brainstorm[0].description).toBe("Ideas NEW");
    expect(brainstorm[0].source).toContain("1.1.0");
  });

  it("does not re-emit global skills as project skills when cwd is the home dir", () => {
    // findRepoRoot(home) returns home (no .git above it), so <root>/.claude/skills
    // IS the global dir. Without the guard, every global skill appears twice.
    const skills = collectClaudeCodeSkills({ home, cwd: home, platform: "linux" });
    const project = skills.filter((s) => s.origin.startsWith("claude-code:project:"));
    expect(project).toEqual([]);
    expect(skills.filter((s) => s.name === "deep-research")).toHaveLength(1);
  });

  it("keeps dormant skills separate from active ones sharing a name", () => {
    const skills = collectClaudeCodeSkills({ home, cwd, platform: "linux" });
    const origins = skills.filter((s) => s.origin === "claude-code:available");
    expect(origins.every((s) => s.origin !== "claude-code")).toBe(true);
  });
});
