import { ConvexError } from "convex/values";

/**
 * Shared auth guard for sensitive Convex queries and mutations.
 * Call on line 1 of every sensitive handler per D-03.
 * Throws ConvexError("Unauthenticated") if no Clerk identity present.
 *
 * Uses a duck-typed AuthCapableCtx instead of importing MutationCtx | QueryCtx
 * from _generated/server — this avoids Convex codegen coupling and makes the
 * helper testable with plain mock objects. The real MutationCtx and QueryCtx
 * both satisfy this shape.
 */
type AuthCapableCtx = { auth: { getUserIdentity: () => Promise<any> } };

export async function requireAuth(ctx: AuthCapableCtx): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthenticated");
}
