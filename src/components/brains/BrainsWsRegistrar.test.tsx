/**
 * BrainsWsRegistrar.test.tsx — 103-08 scope addition.
 *
 * Proves the dangling-wire fix directly: mounting the provider tree's registrar actually calls
 * `registerBrainsWsSender` with the live `sendCommand` function, exactly once per mount, and never
 * with a stale reference across re-renders.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render } from "@testing-library/react";
import { BrainsWsRegistrar } from "./BrainsWsRegistrar";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSendCommand = vi.fn();
let mockUseAstridrWS: Mock;

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: (...args: unknown[]) => mockUseAstridrWS(...args),
}));

const mockRegisterBrainsWsSender = vi.fn();
vi.mock("@/lib/brainsApi", () => ({
  registerBrainsWsSender: (...args: unknown[]) => mockRegisterBrainsWsSender(...args),
}));

beforeEach(() => {
  mockSendCommand.mockReset();
  mockRegisterBrainsWsSender.mockReset();
  mockUseAstridrWS = vi.fn(() => ({
    status: "connected",
    sendCommand: mockSendCommand,
    subscribe: vi.fn(() => vi.fn()),
    subscribeEvent: vi.fn(() => vi.fn()),
    reconnect: vi.fn(),
  }));
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BrainsWsRegistrar", () => {
  it("renders nothing (headless)", () => {
    const { container } = render(<BrainsWsRegistrar />);
    expect(container.firstChild).toBeNull();
  });

  it("registers the live sendCommand with brainsApi's registration seam on mount", () => {
    render(<BrainsWsRegistrar />);
    expect(mockRegisterBrainsWsSender).toHaveBeenCalledTimes(1);
    expect(mockRegisterBrainsWsSender).toHaveBeenCalledWith(mockSendCommand);
  });

  it("does not re-register on a re-render that keeps the same sendCommand reference", () => {
    const { rerender } = render(<BrainsWsRegistrar />);
    expect(mockRegisterBrainsWsSender).toHaveBeenCalledTimes(1);

    rerender(<BrainsWsRegistrar />);
    // useAstridrWS() is a plain mock returning a fresh object each call, but sendCommand itself
    // (mockSendCommand) is the SAME function reference both times -- matching the real provider,
    // where sendCommand is a useCallback([]) and therefore stable across renders. The effect's
    // dependency array is [sendCommand], so it must not fire again.
    expect(mockRegisterBrainsWsSender).toHaveBeenCalledTimes(1);
  });

  it("re-registers with the new sendCommand if the provider ever hands over a different reference", () => {
    const { rerender } = render(<BrainsWsRegistrar />);
    expect(mockRegisterBrainsWsSender).toHaveBeenCalledWith(mockSendCommand);

    const newSendCommand = vi.fn();
    mockUseAstridrWS.mockReturnValue({
      status: "connected",
      sendCommand: newSendCommand,
      subscribe: vi.fn(() => vi.fn()),
      subscribeEvent: vi.fn(() => vi.fn()),
      reconnect: vi.fn(),
    });
    rerender(<BrainsWsRegistrar />);

    expect(mockRegisterBrainsWsSender).toHaveBeenCalledTimes(2);
    expect(mockRegisterBrainsWsSender).toHaveBeenLastCalledWith(newSendCommand);
  });
});
