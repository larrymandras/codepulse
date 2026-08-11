import { describe, it, expect } from "vitest";
import { isPluginSourcePath } from "../migrations";

describe("isPluginSourcePath (DEBT-05, D-04)", () => {
  it("matches a Windows-style plugin cache path", () => {
    expect(
      isPluginSourcePath(
        "C:\\Users\\mandr\\.claude\\plugins\\cache\\p\\1.1.0\\skills\\x\\SKILL.md"
      )
    ).toBe(true);
  });

  it("does not match a personal (non-plugin) skills path", () => {
    expect(
      isPluginSourcePath("C:\\Users\\mandr\\.claude\\skills\\deep-research\\SKILL.md")
    ).toBe(false);
  });

  it("matches astridr's container-style plugin cache path — the documented trap", () => {
    // This predicate ALONE cannot tell astridr's native-origin plugin-cache rows apart
    // from the ~57 claude-code-origin rows this migration targets: both are
    // plugin-shaped paths. `reoriginPluginSkills` guards against this by ALSO
    // requiring `origin === "claude-code"` before patching — see the origin-filter
    // test below, which is what actually excludes rows like this one.
    expect(
      isPluginSourcePath("/home/astridr/.claude/plugins/cache/foo/skills/y/SKILL.md")
    ).toBe(true);
  });

  it("is false for undefined and empty-string source", () => {
    expect(isPluginSourcePath(undefined)).toBe(false);
    expect(isPluginSourcePath("")).toBe(false);
  });

  it("is false for null source", () => {
    expect(isPluginSourcePath(null)).toBe(false);
  });

  it("matches forward-slash paths identically to backslash paths", () => {
    expect(
      isPluginSourcePath("/Users/mandr/.claude/plugins/cache/p/1.1.0/skills/x/SKILL.md")
    ).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(
      isPluginSourcePath("C:\\Users\\mandr\\.CLAUDE\\PLUGINS\\cache\\p\\skills\\x\\SKILL.md")
    ).toBe(true);
    expect(
      isPluginSourcePath("c:\\users\\mandr\\.claude\\Plugins\\Cache\\p\\skills\\x\\skill.md")
    ).toBe(true);
  });

  it("is false for a plugins-shaped substring that is not the .claude/plugins/ segment", () => {
    // Guards against a naive substring check on just "plugins/" without the ".claude/" prefix.
    expect(isPluginSourcePath("C:\\Users\\mandr\\myplugins\\cache\\skills\\x\\SKILL.md")).toBe(
      false
    );
  });
});

describe("reoriginPluginSkills origin-filter documentation (DEBT-05, D-04)", () => {
  // reoriginPluginSkills itself needs a Convex ctx and is not unit-testable here (per this
  // file's no-Convex-ctx pure-import pattern, matching skillSync.test.ts). This test instead
  // pins the CLAIM that makes the trap non-theoretical: the predicate returns `true` for BOTH
  // an astridr native-origin row's path AND a claude-code-origin row's path, so origin alone —
  // not the path — is what the mutation's filter must rely on to keep them apart.
  it("returns true for both an astridr-shaped path and a claude-code-shaped plugin path", () => {
    const astridrPath = "/home/astridr/.claude/plugins/cache/foo/skills/y/SKILL.md";
    const claudeCodePath =
      "C:\\Users\\mandr\\.claude\\plugins\\cache\\p\\1.1.0\\skills\\x\\SKILL.md";
    expect(isPluginSourcePath(astridrPath)).toBe(true);
    expect(isPluginSourcePath(claudeCodePath)).toBe(true);
    // Because both are true, `reoriginPluginSkills`'s live filter
    // `(r.origin ?? "unknown") === "claude-code" && isPluginSourcePath(r.source)` depends on
    // the origin comparison — not this predicate — to exclude the astridr row.
  });
});
