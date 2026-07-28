// A green run in this file proves CONTRACT CONFORMANCE and UI HONESTY only — it is NOT live
// BSC-05 verification. It proves the stub adapter matches 103-CONTRACT.md's shapes and that
// malformed commands are rejected client-side; it proves nothing about whether Ástríðr's real
// gateway.model.set endpoint exists or actually changes the resolved model on a real backend
// (103-RESEARCH.md "Validation Architecture" — What CAN and CANNOT be proven with a stub).

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateGatewayModelSet,
  createStubBrainsAdapter,
  createLiveBrainsAdapter,
  stubBrainsAdapter,
  type GatewayModelSetCommand,
  type BrainsAdapter,
} from "./brainsApi";
import { STUB_CATALOGUE, makeStubFailureSet } from "./brainsFixtures";

function validCommand(overrides: Partial<GatewayModelSetCommand> = {}): GatewayModelSetCommand {
  return {
    type: "gateway.model.set",
    request_id: "req-1",
    scope: "profile",
    profile_id: "assistant-default",
    model: "anthropic-sonnet-5",
    mode: "session",
    restore: false,
    ...overrides,
  };
}

describe("validateGatewayModelSet", () => {
  it("returns an error ack (not a throw) for a missing profile_id", () => {
    const result = validateGatewayModelSet(validCommand({ profile_id: "" }));
    expect(result).not.toBeNull();
    expect(result?.status).toBe("error");
    expect(result?.type).toBe("ack");
  });

  it('returns an error ack for scope other than "profile"', () => {
    // @ts-expect-error — deliberately malformed to exercise the runtime guard
    const result = validateGatewayModelSet(validCommand({ scope: "global" }));
    expect(result).not.toBeNull();
    expect(result?.status).toBe("error");
  });

  it("returns an error ack when model is missing and restore is false", () => {
    const result = validateGatewayModelSet(validCommand({ model: undefined, restore: false }));
    expect(result).not.toBeNull();
    expect(result?.status).toBe("error");
  });

  it("returns an error ack for an invalid mode", () => {
    // @ts-expect-error — deliberately malformed to exercise the runtime guard
    const result = validateGatewayModelSet(validCommand({ mode: "sticky" }));
    expect(result).not.toBeNull();
    expect(result?.status).toBe("error");
  });

  it("passes a well-formed command through as null (valid)", () => {
    expect(validateGatewayModelSet(validCommand())).toBeNull();
  });

  it("allows a missing model when restore is true", () => {
    expect(
      validateGatewayModelSet(validCommand({ model: undefined, restore: true }))
    ).toBeNull();
  });
});

describe("stubBrainsAdapter.getCatalogue()", () => {
  it("resolves entries matching the CatalogueEntry contract shape", async () => {
    const entries = await stubBrainsAdapter.getCatalogue();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(["subscription", "api", "local"]).toContain(entry.group);
      expect(["api", "sub"]).toContain(entry.billing);
      expect(["normal", "expensive", "unknown"]).toContain(entry.costTier);
    }
  });

  it("keeps catalogue ids unique even though two entries share a display name", () => {
    const names = STUB_CATALOGUE.map((e) => e.name);
    expect(names.filter((n) => n === "Sonnet 5").length).toBeGreaterThanOrEqual(2);

    const ids = STUB_CATALOGUE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("stubBrainsAdapter.dispatchSwap — partial-failure deny-list", () => {
  it("returns an error ack for a profileId in the failure set and an ok ack otherwise", async () => {
    const adapter = createStubBrainsAdapter(makeStubFailureSet(["consulting"]));

    const failing = await adapter.dispatchSwap(
      validCommand({ profile_id: "consulting", request_id: "r-fail" })
    );
    expect(failing.status).toBe("error");
    expect(failing.request_id).toBe("r-fail");

    const succeeding = await adapter.dispatchSwap(
      validCommand({ profile_id: "assistant-default", request_id: "r-ok" })
    );
    expect(succeeding.status).toBe("ok");
    expect(succeeding.request_id).toBe("r-ok");
  });

  it("rejects a malformed command with an error ack before consulting the failure set", async () => {
    const adapter = createStubBrainsAdapter(makeStubFailureSet([]));
    const result = await adapter.dispatchSwap(validCommand({ profile_id: "" }));
    expect(result.status).toBe("error");
  });
});

describe("stub and live adapters satisfy the same BrainsAdapter interface", () => {
  it("expose the same method names with matching arity", () => {
    const mockSender = vi.fn().mockResolvedValue({ type: "ack", request_id: "r1", status: "ok" });
    const live: BrainsAdapter = createLiveBrainsAdapter(mockSender);
    const stub: BrainsAdapter = stubBrainsAdapter;

    const methodNames: (keyof BrainsAdapter)[] = ["getCatalogue", "dispatchSwap", "getDefaultProfileId"];
    for (const name of methodNames) {
      expect(typeof stub[name]).toBe("function");
      expect(typeof live[name]).toBe("function");
      expect((live[name] as (...args: unknown[]) => unknown).length).toBe(
        (stub[name] as (...args: unknown[]) => unknown).length
      );
    }
    expect(typeof stub.isStub).toBe("boolean");
    expect(typeof live.isStub).toBe("boolean");
    expect(stub.isStub).toBe(true);
    expect(live.isStub).toBe(false);
  });

  it("live adapter dispatches the exact gateway.model.set command shape to the injected sender", async () => {
    const mockSender = vi.fn().mockResolvedValue({ type: "ack", request_id: "req-1", status: "ok" });
    const live = createLiveBrainsAdapter(mockSender);

    const cmd = validCommand();
    await live.dispatchSwap(cmd);

    expect(mockSender).toHaveBeenCalledWith(cmd);
  });

  it("live adapter never dispatches a malformed command to the sender", async () => {
    const mockSender = vi.fn();
    const live = createLiveBrainsAdapter(mockSender);

    const result = await live.dispatchSwap(validCommand({ profile_id: "" }));
    expect(result.status).toBe("error");
    expect(mockSender).not.toHaveBeenCalled();
  });
});

describe("BRAINS_STUB_ACTIVE", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is false when VITE_BRAINS_STUB is unset", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const mod = await import("./brainsApi");
    expect(mod.BRAINS_STUB_ACTIVE).toBe(false);
  });

  it('is true only for the exact string "true"', async () => {
    vi.stubEnv("VITE_BRAINS_STUB", "true");
    vi.resetModules();
    const modTrue = await import("./brainsApi");
    expect(modTrue.BRAINS_STUB_ACTIVE).toBe(true);

    vi.stubEnv("VITE_BRAINS_STUB", "false");
    vi.resetModules();
    const modFalse = await import("./brainsApi");
    expect(modFalse.BRAINS_STUB_ACTIVE).toBe(false);

    vi.stubEnv("VITE_BRAINS_STUB", "yes");
    vi.resetModules();
    const modYes = await import("./brainsApi");
    expect(modYes.BRAINS_STUB_ACTIVE).toBe(false);
  });
});
