import { describe, it, expect } from "vitest";
import { stripToolCallSyntax } from "./ChatBubble";

describe("stripToolCallSyntax", () => {
  it("strips a leaked <invoke> block but keeps the prose after it", () => {
    // The exact leak from the live chat: a memory tool call written as text.
    const input =
      '<invoke name="memory"> <parameter name="command">view</parameter> ' +
      '<parameter name="path">/memories</parameter> </invoke>\n\n' +
      "It's overcast and already 81 degrees.";
    expect(stripToolCallSyntax(input)).toBe("It's overcast and already 81 degrees.");
  });

  it("strips a full <function_calls> wrapper", () => {
    const input =
      '<function_calls><invoke name="x"><parameter name="p">1</parameter></invoke></function_calls>Done.';
    expect(stripToolCallSyntax(input)).toBe("Done.");
  });

  it("drops an unclosed block still arriving mid-stream", () => {
    expect(stripToolCallSyntax('Here you go<invoke name="memory"><parameter name="command">vi')).toBe(
      "Here you go"
    );
  });

  it("removes orphan close tags", () => {
    expect(stripToolCallSyntax("answer</invoke>")).toBe("answer");
  });

  it("leaves ordinary text (and legit angle brackets) untouched", () => {
    expect(stripToolCallSyntax("no tags here")).toBe("no tags here");
    expect(stripToolCallSyntax("2 < 3 and 5 > 4")).toBe("2 < 3 and 5 > 4");
    expect(stripToolCallSyntax("")).toBe("");
  });
});
