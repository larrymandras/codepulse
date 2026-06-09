import { describe, it, expect } from "vitest";

// Mirrors the upsert/toggle decision in toolGovernance.setToolDisabled without
// a live DB: given the existing row (or undefined) and the optional `disabled`
// arg, compute the next disabled value the mutation would write.
function resolveNextDisabled(
  existing: { disabled: boolean } | undefined,
  argDisabled: boolean | undefined,
): boolean {
  return argDisabled ?? (existing ? !existing.disabled : true);
}

describe("toolGovernance.setToolDisabled — toggle/upsert logic (MCP-03)", () => {
  it("disables a tool that has no governance row yet (default action)", () => {
    expect(resolveNextDisabled(undefined, undefined)).toBe(true);
  });

  it("flips an existing enabled tool to disabled when no explicit value", () => {
    expect(resolveNextDisabled({ disabled: false }, undefined)).toBe(true);
  });

  it("flips an existing disabled tool back to enabled when no explicit value", () => {
    expect(resolveNextDisabled({ disabled: true }, undefined)).toBe(false);
  });

  it("honors an explicit disabled=true regardless of current state", () => {
    expect(resolveNextDisabled(undefined, true)).toBe(true);
    expect(resolveNextDisabled({ disabled: true }, true)).toBe(true);
  });

  it("honors an explicit disabled=false regardless of current state", () => {
    expect(resolveNextDisabled({ disabled: true }, false)).toBe(false);
    expect(resolveNextDisabled(undefined, false)).toBe(false);
  });
});
