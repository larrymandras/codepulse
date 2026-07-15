import { describe, it, expect } from "vitest";
import {
  extractSkillPaths,
  parseTreeResponse,
  classifyScanError,
  extractOwnerRepoRef,
  ScanError,
} from "./githubTree";

describe("extractSkillPaths", () => {
  it("returns only blob-type SKILL.md paths, case-insensitive, any depth, excluding non-SKILL.md blobs and tree entries", () => {
    const tree = [
      { type: "blob", path: "SKILL.md" },
      { type: "blob", path: "skills/foo/SKILL.md" },
      { type: "blob", path: "skills/foo/NOTSKILL.md" },
      { type: "tree", path: "skills" },
    ];
    expect(extractSkillPaths(tree)).toEqual(["SKILL.md", "skills/foo/SKILL.md"]);
  });

  it("matches case-insensitively", () => {
    const tree = [{ type: "blob", path: "skills/foo/skill.md" }];
    expect(extractSkillPaths(tree)).toEqual(["skills/foo/skill.md"]);
  });

  it("returns empty array when no SKILL.md present", () => {
    expect(extractSkillPaths([{ type: "blob", path: "README.md" }])).toEqual([]);
  });
});

describe("parseTreeResponse", () => {
  it("returns truncated: true when the response explicitly sets it", () => {
    const tree = [{ type: "blob", path: "SKILL.md" }];
    expect(parseTreeResponse({ tree, truncated: true })).toEqual({
      skillPaths: ["SKILL.md"],
      truncated: true,
    });
  });

  it("returns truncated: false when the key is absent entirely (never inferred from array length)", () => {
    const tree = [{ type: "blob", path: "SKILL.md" }];
    expect(parseTreeResponse({ tree })).toEqual({
      skillPaths: ["SKILL.md"],
      truncated: false,
    });
  });

  it("returns truncated: false when the key is explicitly false", () => {
    const tree = [{ type: "blob", path: "SKILL.md" }];
    expect(parseTreeResponse({ tree, truncated: false })).toEqual({
      skillPaths: ["SKILL.md"],
      truncated: false,
    });
  });

  it("throws on malformed input (no tree array)", () => {
    expect(() => parseTreeResponse({})).toThrow("Malformed GitHub tree response");
    expect(() => parseTreeResponse(null)).toThrow("Malformed GitHub tree response");
    expect(() => parseTreeResponse("not an object")).toThrow("Malformed GitHub tree response");
  });
});

describe("classifyScanError", () => {
  it("returns distinct strings for 403, 404, and 0 (network sentinel)", () => {
    const s403 = classifyScanError(403);
    const s404 = classifyScanError(404);
    const s0 = classifyScanError(0);
    expect(s403).not.toBe(s404);
    expect(s403).not.toBe(s0);
    expect(s404).not.toBe(s0);
  });

  it("returns a fallback string for any other status", () => {
    expect(classifyScanError(500)).toBe("an unexpected error");
  });
});

describe("ScanError", () => {
  it("carries the status and a message referencing it", () => {
    const err = new ScanError(403);
    expect(err.status).toBe(403);
    expect(err.message).toContain("403");
  });
});

describe("extractOwnerRepoRef", () => {
  it("parses a bare repo URL with ref defaulting to HEAD", () => {
    expect(extractOwnerRepoRef("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
      ref: "HEAD",
    });
  });

  it("parses a /tree/{ref}/... URL, extracting the ref segment", () => {
    expect(
      extractOwnerRepoRef("https://github.com/owner/repo/tree/main/skills/foo"),
    ).toEqual({ owner: "owner", repo: "repo", ref: "main" });
  });

  it("parses the owner/repo shorthand form", () => {
    expect(extractOwnerRepoRef("owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
      ref: "HEAD",
    });
  });

  it("returns null for a non-matching input", () => {
    expect(extractOwnerRepoRef("not a url")).toBeNull();
  });

  it("returns null for a non-github https URL", () => {
    expect(extractOwnerRepoRef("https://example.com/owner/repo")).toBeNull();
  });
});
