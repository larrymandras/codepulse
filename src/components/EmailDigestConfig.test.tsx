import { describe, it, expect } from "vitest";

describe("EmailDigestConfig", () => {
  it("exports EmailDigestConfig component", async () => {
    const mod = await import("./EmailDigestConfig");
    expect(typeof mod.EmailDigestConfig).toBe("function");
  });

  it("renders without crashing when imported", async () => {
    // Verify the module compiles and exports correctly
    const mod = await import("./EmailDigestConfig");
    expect(mod.EmailDigestConfig).toBeDefined();
  });
});
