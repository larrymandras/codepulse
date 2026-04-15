import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: new Proxy({}, {
    get: () => new Proxy({}, { get: () => "mock-fn-ref" }),
  }),
}));

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: "connected",
    sendCommand: vi.fn(),
    subscribeEvent: vi.fn(() => () => {}),
  }),
}));

describe("Memory Page (CPUX-06)", () => {
  test.todo("renders 4 tabs: Episodic, Preflight, Durable Facts, Imports");
  test.todo("default tab is Episodic showing existing memory content");
  test.todo("switching to Preflight tab shows preflight data");
  test.todo("switching to Imports tab shows conversation imports");
});
