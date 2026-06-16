/**
 * Convex auth provider configuration.
 *
 * Bridges Clerk-issued JWTs to Convex identity so `ctx.auth.getUserIdentity()`
 * resolves on authenticated requests (e.g. the Phase 80 Clerk-gated
 * enqueueLaunch / enqueueStop mutations, D-13 fail-closed).
 *
 * `domain` is the Clerk Frontend API / issuer URL, supplied via the
 * CLERK_JWT_ISSUER_DOMAIN Convex env var (not hardcoded — different
 * deployments can point at different Clerk apps). `applicationID` MUST match
 * the Clerk JWT template name ("convex").
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
