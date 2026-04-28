import { describe, it, expect } from "vitest";
import { requireAuth } from "../lib/auth";

/**
 * Unit tests for the shared requireAuth(ctx) helper (D-03, AUTH-01).
 *
 * Since requireAuth calls ctx.auth.getUserIdentity() which is a Convex
 * runtime function, tests mock the ctx object with a duck-typed shape.
 */

function mockCtx(identity: any) {
  return { auth: { getUserIdentity: async () => identity } };
}

describe("requireAuth (D-03, AUTH-01)", () => {
  it("throws ConvexError('Unauthenticated') when no identity", async () => {
    await expect(requireAuth(mockCtx(null))).rejects.toThrow("Unauthenticated");
  });

  it("resolves without throwing when identity present", async () => {
    await expect(
      requireAuth(mockCtx({ subject: "user_123", issuer: "clerk" }))
    ).resolves.toBeUndefined();
  });

  it("works with minimal identity object (duck-typed)", async () => {
    await expect(
      requireAuth(mockCtx({ subject: "user_456" }))
    ).resolves.toBeUndefined();
  });
});
