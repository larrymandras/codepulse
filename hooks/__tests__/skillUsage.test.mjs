import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { normalizeSkillName, readSkillUsage, mergeUsage } from "../skillUsage.mjs";

describe("normalizeSkillName", () => {
  it("strips a plugin prefix", () => {
    expect(normalizeSkillName("superpowers:brainstorming")).toBe("brainstorming");
    expect(normalizeSkillName("code-review:code-review")).toBe("code-review");
  });
  it("leaves an unprefixed name alone", () => {
    expect(normalizeSkillName("wrap")).toBe("wrap");
  });
  it("tolerates junk", () => {
    expect(normalizeSkillName(undefined)).toBe("");
    expect(normalizeSkillName(42)).toBe("");
  });
});

describe("readSkillUsage", () => {
  let dir, file;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "usage-"));
    file = join(dir, "events.jsonl");
    writeFileSync(file, [
      '{"skill":"wrap","success":true,"ts":"2026-07-06T15:08:47.054Z"}',
      '{"skill":"wrap","success":false,"ts":"2026-07-09T20:58:44.038Z"}',
      '{"skill":"superpowers:brainstorming","success":true,"ts":"2026-07-08T10:00:00.000Z"}',
      "not json at all",
      '{"skill":"","success":true,"ts":"2026-07-08T10:00:00.000Z"}',
      '{"skill":"no-ts"}',
      '{"skill":"partial-line","success":true,"ts":"2026-07-0',  // torn append
    ].join("\n"), "utf8");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("counts every invocation, including failures", () => {
    const u = readSkillUsage(null, { path: file });
    expect(u.wrap.useCount).toBe(2);
  });

  it("takes the latest timestamp as lastUsedAt (epoch ms)", () => {
    const u = readSkillUsage(null, { path: file });
    expect(u.wrap.lastUsedAt).toBe(Date.parse("2026-07-09T20:58:44.038Z"));
  });

  it("strips plugin prefixes so names join to skill rows", () => {
    const u = readSkillUsage(null, { path: file });
    expect(u.brainstorming.useCount).toBe(1);
    expect(u["superpowers:brainstorming"]).toBeUndefined();
  });

  it("skips malformed lines, empty names, and a torn final line", () => {
    const u = readSkillUsage(null, { path: file });
    expect(u[""]).toBeUndefined();
    expect(u["partial-line"]).toBeUndefined();
    expect(u["no-ts"].useCount).toBe(1);
    expect(u["no-ts"].lastUsedAt).toBeUndefined();
  });

  it("returns {} when the log does not exist", () => {
    expect(readSkillUsage(null, { path: join(dir, "absent.jsonl") })).toEqual({});
  });
});

describe("mergeUsage", () => {
  it("attaches counts only to skills that were actually invoked", () => {
    const skills = [{ name: "wrap" }, { name: "never-used" }];
    mergeUsage(skills, { wrap: { useCount: 3, lastUsedAt: 123 } });
    expect(skills[0]).toEqual({ name: "wrap", useCount: 3, lastUsedAt: 123 });
    expect(skills[1]).toEqual({ name: "never-used" });
  });
  it("omits lastUsedAt when unknown", () => {
    const skills = [{ name: "a" }];
    mergeUsage(skills, { a: { useCount: 1, lastUsedAt: undefined } });
    expect(skills[0].lastUsedAt).toBeUndefined();
    expect(skills[0].useCount).toBe(1);
  });
});
