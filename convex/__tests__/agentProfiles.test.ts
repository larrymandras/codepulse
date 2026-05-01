import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as agentProfiles from "../agentProfiles";

const src = readFileSync(resolve(__dirname, "../agentProfiles.ts"), "utf-8");

describe("agentProfiles create mutation (DQAL-02)", () => {
  it("create mutation is exported and defined", () => {
    expect(agentProfiles.create).toBeDefined();
  });

  it("create handler applies displayName default from args.name", () => {
    expect(src).toMatch(/displayName:\s*args\.displayName\s*\?\?\s*args\.name/);
  });

  it("create handler calls requireAuth", () => {
    expect(src).toContain("requireAuth");
  });

  it("update mutation is exported and defined", () => {
    expect(agentProfiles.update).toBeDefined();
  });
});

describe("AgentProfileEditor fallback strings (DQAL-02)", () => {
  it("does not use hardcoded 'agent' string in createAvatar calls", () => {
    const editorSrc = readFileSync(
      resolve(__dirname, "../../src/components/AgentProfileEditor.tsx"),
      "utf-8"
    );
    const avatarCallMatches = editorSrc.match(/createAvatar\(\{[\s\S]*?\}\)/g) ?? [];
    for (const callBlock of avatarCallMatches) {
      expect(callBlock).not.toMatch(/name:\s*\w+\s*\|\|\s*"agent"/);
    }
  });
});
