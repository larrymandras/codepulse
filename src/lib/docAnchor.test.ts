import { describe, it, expect } from "vitest";
import { relocateAnchor, captureAnchorFromSelection } from "./docAnchor";
import type { Anchor } from "./docCommentsApi";

const A = (o: Partial<Anchor>): Anchor => ({
  quote: "", prefix: "", suffix: "", start: 0, end: 0, line_start: 1, line_end: 1, ...o,
});

describe("relocateAnchor (parity with backend)", () => {
  it("position match when offsets still hold", () => {
    const src = "alpha bravo charlie";
    expect(relocateAnchor(src, A({ quote: "bravo", start: 6, end: 11 })))
      .toMatchObject({ status: "located", start: 6, end: 11, reason: "position_match" });
  });
  it("context match after a shift", () => {
    const src = "XX alpha bravo charlie";
    const r = relocateAnchor(src, A({ quote: "bravo", prefix: "alpha ", suffix: " charlie", start: 6, end: 11 }));
    expect(r).toMatchObject({ status: "located", reason: "context_match" });
    expect(src.slice(r.start!, r.end!)).toBe("bravo");
  });
  it("unique-quote fallback (context changed, bare quote still unique)", () => {
    const src = "the bravo is here";
    expect(relocateAnchor(src, A({ quote: "bravo", prefix: "XXX", suffix: "YYY", start: 999, end: 1000 })))
      .toMatchObject({ status: "located", reason: "quote_unique" });
    // needle "XXXbravoYYY" is absent; bare "bravo" occurs once -> quote_unique
  });
  it("empty-context unique quote reports context_match (backend parity)", () => {
    const src = "the bravo is here";
    expect(relocateAnchor(src, A({ quote: "bravo", start: 999, end: 1000 })))
      .toMatchObject({ status: "located", reason: "context_match" });
  });
  it("ambiguous quote → stale", () => {
    const src = "bravo and bravo";
    expect(relocateAnchor(src, A({ quote: "bravo", start: 999, end: 1000 })))
      .toMatchObject({ status: "stale" });
  });
  it("missing → stale", () => {
    expect(relocateAnchor("nothing here", A({ quote: "zzz", start: 0, end: 3 })))
      .toMatchObject({ status: "stale" });
  });
});

describe("captureAnchorFromSelection", () => {
  it("builds a source-coordinate anchor with correct offsets + line numbers", () => {
    const src = "line one\nalpha bravo charlie\nline three";
    const a = captureAnchorFromSelection(src, "bravo", "alpha ", " charlie");
    expect(a).not.toBeNull();
    expect(src.slice(a!.start, a!.end)).toBe("bravo");
    expect(a!.line_start).toBe(2);
    expect(a!.quote).toBe("bravo");
  });
  it("returns null when the quote cannot be uniquely located", () => {
    expect(captureAnchorFromSelection("bravo bravo", "bravo", "", "")).toBeNull();
  });
  it("emits CODEPOINT offsets (not UTF-16 offsets) when an astral char precedes the quote", () => {
    const src = "\u{1F600} alpha bravo"; // 😀 alpha bravo — emoji is 2 UTF-16 units, 1 codepoint
    const a = captureAnchorFromSelection(src, "bravo", "alpha ", "");
    expect(a).not.toBeNull();
    const utf16Start = src.indexOf("bravo");
    const expectedCpStart = Array.from(src.slice(0, utf16Start)).length;
    expect(a!.start).toBe(expectedCpStart);
    // UTF-16 index and codepoint index diverge here because of the emoji.
    expect(a!.start).not.toBe(utf16Start);
    expect(Array.from(src).slice(a!.start, a!.end).join("")).toBe("bravo");
  });
});

describe("relocateAnchor codepoint offsets (parity with backend over astral input)", () => {
  it("position_match succeeds when anchor.start/end are codepoint offsets past an emoji", () => {
    const src = "\u{1F600} alpha bravo charlie"; // 😀 alpha bravo charlie
    const utf16Start = src.indexOf("bravo");
    const cpStart = Array.from(src.slice(0, utf16Start)).length;
    const cpEnd = cpStart + "bravo".length;
    const r = relocateAnchor(src, A({ quote: "bravo", start: cpStart, end: cpEnd }));
    expect(r).toMatchObject({ status: "located", reason: "position_match", start: cpStart, end: cpEnd });
  });
});
