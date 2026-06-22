import { describe, it, expect } from "vitest";
import {
  buildFocusUrl,
  normalizeFocusKey,
  focusKeysMatch,
  encodeFromParam,
  decodeFromParam,
} from "./focus-url";

// ---------------------------------------------------------------------------
// buildFocusUrl
// ---------------------------------------------------------------------------

describe("buildFocusUrl — graphs surface", () => {
  it("emits the correct /graphs URL with encoded nodeId", () => {
    const url = buildFocusUrl({ surface: "graphs", nodeId: "graphify:codepulse:App" });
    expect(url).toBe("/graphs?focus=graphify%3Acodepulse%3AApp");
  });

  it("appends &from when fromUrl is provided", () => {
    const from = "/tool-galaxy?focus=tool%3ARead";
    const url = buildFocusUrl({ surface: "graphs", nodeId: "AgentX" }, from);
    expect(url).toContain("&from=" + encodeURIComponent(from));
  });
});

describe("buildFocusUrl — tool-galaxy surface", () => {
  it("emits the correct /tool-galaxy URL with encoded nodeId", () => {
    const url = buildFocusUrl({ surface: "tool-galaxy", nodeId: "agent:skuld" });
    expect(url).toBe("/tool-galaxy?focus=agent%3Askuld");
  });
});

describe("buildFocusUrl — knowledge-graph surface", () => {
  it("emits /knowledge-graph URL with lens=entity and default hops=1", () => {
    const url = buildFocusUrl({ surface: "knowledge-graph", entityName: "AgentX" });
    expect(url).toBe("/knowledge-graph?focus=AgentX&lens=entity&hops=1");
  });

  it("uses the provided hops value when specified", () => {
    const url = buildFocusUrl({ surface: "knowledge-graph", entityName: "AgentX", hops: 2 });
    expect(url).toMatch(/&hops=2$/);
  });

  it("appends &from when fromUrl is provided", () => {
    const from = "/tool-galaxy?focus=tool%3ARead";
    const url = buildFocusUrl(
      { surface: "knowledge-graph", entityName: "AgentX" },
      from,
    );
    expect(url).toContain("&from=" + encodeURIComponent(from));
  });
});

// ---------------------------------------------------------------------------
// normalizeFocusKey
// ---------------------------------------------------------------------------

describe("normalizeFocusKey", () => {
  it("strips graphify:<repo>: prefix", () => {
    expect(normalizeFocusKey("graphify:codepulse:Skuld")).toBe("skuld");
  });

  it("strips vault: prefix", () => {
    expect(normalizeFocusKey("vault:Skuld")).toBe("skuld");
  });

  it("trims whitespace and lowercases", () => {
    expect(normalizeFocusKey("  Skuld ")).toBe("skuld");
  });

  it("does NOT strip agent: prefix (caller responsibility)", () => {
    // agent: is a Galaxy-internal namespace — normalizeFocusKey must not touch it
    expect(normalizeFocusKey("agent:Skuld")).toBe("agent:skuld");
  });

  it("does NOT strip tool: prefix (caller responsibility)", () => {
    expect(normalizeFocusKey("tool:Read")).toBe("tool:read");
  });
});

// ---------------------------------------------------------------------------
// focusKeysMatch
// ---------------------------------------------------------------------------

describe("focusKeysMatch", () => {
  it("returns true when both keys normalize to the same value", () => {
    // After stripping graphify:codepulse: → 'skuld'; after stripping vault: → 'skuld'
    expect(focusKeysMatch("graphify:codepulse:Skuld", "vault:Skuld")).toBe(true);
  });

  it("returns false for non-matching keys — no substring/fuzzy fallback", () => {
    expect(focusKeysMatch("Skuld", "SkuldX")).toBe(false);
  });

  it("returns false for case-different names after normalization (they would have matched)", () => {
    // 'AgentX' normalized === 'agentx'; 'agentX' normalized === 'agentx' → true
    expect(focusKeysMatch("AgentX", "agentX")).toBe(true);
  });

  it("returns false for truly different names", () => {
    expect(focusKeysMatch("AgentX", "AgentY")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// encodeFromParam / decodeFromParam round-trip
// ---------------------------------------------------------------------------

describe("encodeFromParam / decodeFromParam", () => {
  it("encodeFromParam URL-encodes the origin URL for embedding in a query param", () => {
    const original = "/graphs?focus=x";
    expect(encodeFromParam(original)).toBe(encodeURIComponent(original));
  });

  // The router (useSearchParams().get) applies the matching single decode at
  // read time, so the embed→read pair round-trips; decodeFromParam itself only
  // validates the already-decoded path (CR-01 — no second decode).
  it("encode→router-decode→validate round-trips an in-app path", () => {
    const original = "/tool-galaxy?focus=tool%3ARead";
    const routerDecoded = decodeURIComponent(encodeFromParam(original));
    expect(decodeFromParam(routerDecoded)).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// decodeFromParam — same-origin guard (T-85-01)
// ---------------------------------------------------------------------------

// Inputs here are already once-decoded (as the router delivers them via
// useSearchParams().get) — decodeFromParam validates without decoding again.
describe("decodeFromParam — same-origin guard", () => {
  it("returns a valid in-app path unchanged (inner focus stays encoded)", () => {
    const result = decodeFromParam("/tool-galaxy?focus=tool%3ARead");
    expect(result).toBe("/tool-galaxy?focus=tool%3ARead");
  });

  it("preserves an inner focus value containing & without corruption (CR-01)", () => {
    // The inner focus is percent-encoded; a second decode would split on the
    // literal & and corrupt the value. Validate-only keeps it intact.
    const result = decodeFromParam("/tool-galaxy?focus=tool%3Aa%26b");
    expect(result).toBe("/tool-galaxy?focus=tool%3Aa%26b");
  });

  it("returns null for an absolute https URL", () => {
    expect(decodeFromParam("https://evil.com")).toBeNull();
  });

  it("returns null for a protocol-relative URL (//evil.com)", () => {
    expect(decodeFromParam("//evil.com")).toBeNull();
  });

  it("returns null for a backslash protocol-relative escape (/\\evil.com)", () => {
    expect(decodeFromParam("/\\evil.com")).toBeNull();
  });

  it("returns null for a javascript: scheme URL", () => {
    expect(decodeFromParam("javascript:alert(1)")).toBeNull();
  });

  it("returns null for a data: scheme URL", () => {
    expect(decodeFromParam("data:text/html,<h1>x</h1>")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(decodeFromParam(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeFromParam("")).toBeNull();
  });

  it("returns null for a relative path without leading slash", () => {
    expect(decodeFromParam("tool-galaxy")).toBeNull();
  });
});
