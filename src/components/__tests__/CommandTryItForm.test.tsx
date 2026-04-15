import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
}));

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: "connected",
    sendCommand: vi.fn().mockResolvedValue({ status: "ok" }),
    subscribeEvent: vi.fn(() => () => {}),
  }),
}));

describe("CommandTryItForm (CPUX-10)", () => {
  test.todo("renders form fields from JSON Schema definition");
  test.todo("string fields render text input");
  test.todo("boolean fields render toggle");
  test.todo("enum fields render dropdown select");
  test.todo("submit sends command via WebSocket sendCommand");
  test.todo("response displays in collapsible result panel");
});
