/**
 * galdrHttp.ts — Phase 116 (Galdr Prompt Library), plan 116-04.
 *
 * The four bearer-authed HTTP routes that expose `convex/galdr.ts` (116-03)
 * to the Claude Code skills over `GET /galdr/prompt`, `GET /galdr/list`,
 * `POST /galdr/prompt`, and `POST /galdr/usage`.
 *
 * D-04 (agent/CLI only, no CORS involvement): unlike every other ingest
 * route family in this repo, these routes deliberately do NOT import
 * `getCorsHeaders`/`getCorsHeadersWithAllowlist` and do NOT register an
 * `OPTIONS` handler anywhere. Browser writes already go through the
 * existing Clerk-authed Convex mutation path (design doc §3 auth note), so
 * the UI never needs these routes, and a browser calling one directly gets
 * a response with no `Access-Control-Allow-Origin` header — the browser
 * itself blocks the read before the body is usable. `convex/health.ts`
 * already ships a GET with zero CORS involvement; these routes follow that
 * precedent, not the POST+OPTIONS pairing convention the other 56 routes in
 * `convex/http.ts` use. A future editor adding an OPTIONS pair here "for
 * consistency" would be reversing a locked decision — don't.
 *
 * Each handler is written as a plain, named, exported async function
 * `(ctx, request) => Promise<Response>` and separately wrapped in
 * `httpAction(...)` for the export the router consumes. An
 * `httpAction`-wrapped value cannot be invoked directly from vitest, and
 * the D-04 header-absence assertion (convex/__tests__/galdrHttp.test.ts)
 * has to run against a real `Response` object — so the plain function is
 * the thing under test, and the wrapped constant is the thing `http.ts`
 * routes to. This mirrors the handler-extraction shape `convex/galdr.ts`
 * uses for query/mutation registrations.
 */
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { validateGaldrAuth, unauthorizedResponse } from "./ingestAuth";

/**
 * The one place the response header object is constructed for every galdr
 * route — deliberately narrow (`Content-Type` only, no CORS headers) so
 * there is exactly one place to audit for a CORS regression.
 */
function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ============================================================
// GET /galdr/prompt — fetch by exact slug or fuzzy search terms
// ============================================================

/**
 * D-01: fail-closed auth is the first executable statement of every handler
 * in this file. D-05's exact-vs-fuzzy contract lives entirely inside
 * `api.galdr.lookup` (116-03) — this handler does not re-derive or collapse
 * it, it just forwards the query string and returns the result verbatim.
 *
 * The `slug` query parameter carries either an exact slug or free search
 * terms (the name is a slight misnomer inherited from D-01's route naming,
 * not a promise that the value is always a real slug).
 *
 * The bearer key travels only in the `Authorization` header — never echo it
 * into the response body or the URL.
 */
export async function galdrPromptGetHandler(
  ctx: any,
  request: Request
): Promise<Response> {
  if (!validateGaldrAuth(request)) return unauthorizedResponse();

  const query = new URL(request.url).searchParams.get("slug");
  if (!query) {
    return jsonResponse({ error: "MISSING_SLUG" }, 400);
  }

  const result = await ctx.runQuery(api.galdr.lookup, { query });
  return jsonResponse(result, 200);
}

export const galdrPromptGet = httpAction(galdrPromptGetHandler);

// ============================================================
// GET /galdr/list — D-08's bare `/galdr` listing: categories + favorites
// ============================================================

export async function galdrListGetHandler(
  ctx: any,
  request: Request
): Promise<Response> {
  if (!validateGaldrAuth(request)) return unauthorizedResponse();

  const result = await ctx.runQuery(api.galdr.listCategories, {});
  return jsonResponse(result, 200);
}

export const galdrListGet = httpAction(galdrListGetHandler);

// ============================================================
// POST /galdr/prompt — save (create). Collision refuses, never overwrites.
// ============================================================

/**
 * D-06 on the wire: a slug collision maps to a 409 carrying the existing
 * prompt's identity, taken from the `ConvexError`'s `.data` (a
 * `ConvexError`'s `.data` survives Convex's client-side redaction of plain
 * `Error` messages; see `convex/galdr.ts` `createPromptHandler`). Nothing is
 * silently overwritten and nothing is silently auto-suffixed.
 */
export async function galdrPromptPostHandler(
  ctx: any,
  request: Request
): Promise<Response> {
  if (!validateGaldrAuth(request)) return unauthorizedResponse();

  const body = (await request.json()) as Record<string, unknown>;
  const title = body.title;
  const promptBody = body.body;
  const category =
    typeof body.category === "string" && body.category !== ""
      ? body.category
      : "uncategorized";
  const tags = Array.isArray(body.tags) ? (body.tags as string[]) : undefined;

  if (typeof title !== "string" || title === "") {
    return jsonResponse({ error: "MISSING_FIELD", field: "title" }, 400);
  }
  if (typeof promptBody !== "string" || promptBody === "") {
    return jsonResponse({ error: "MISSING_FIELD", field: "body" }, 400);
  }

  try {
    const promptId = await ctx.runMutation(api.galdr.createPrompt, {
      title,
      body: promptBody,
      category,
      tags,
    });
    // slugify(title) is the one derivation (convex/galdrSlug.ts, via
    // createPromptHandler) — re-deriving it here would risk drifting from
    // that single source, so the mutation's own args.title is echoed back
    // only where it was already accepted; slug itself is not returned by
    // createPrompt today, so it is intentionally omitted from this body
    // rather than guessed.
    return jsonResponse({ ok: true, promptId }, 201);
  } catch (err: any) {
    const data = err?.data;
    if (data?.code === "SLUG_COLLISION") {
      return jsonResponse(
        {
          error: "SLUG_COLLISION",
          existingSlug: data.existingSlug,
          existingTitle: data.existingTitle,
          existingUpdatedAt: data.existingUpdatedAt,
          existingArchived: data.existingArchived,
        },
        409
      );
    }
    if (data?.code === "EMPTY_SLUG") {
      return jsonResponse({ error: "EMPTY_SLUG" }, 400);
    }
    return jsonResponse({ error: "SAVE_FAILED" }, 500);
  }
}

export const galdrPromptPost = httpAction(galdrPromptPostHandler);

// ============================================================
// POST /galdr/usage — bump usage only, never a version-append path
// ============================================================

/**
 * A separate, narrow route rather than a flag on the save route: bumping
 * usage is NOT a body-changing write and must never be able to reach D-15's
 * version-append path. Keeping it on its own route, calling only
 * `api.galdr.recordUsage`, makes that impossible by construction rather
 * than by a conditional inside a shared handler.
 */
export async function galdrUsagePostHandler(
  ctx: any,
  request: Request
): Promise<Response> {
  if (!validateGaldrAuth(request)) return unauthorizedResponse();

  const body = (await request.json()) as Record<string, unknown>;
  const slug = body.slug;
  if (typeof slug !== "string" || slug === "") {
    return jsonResponse({ error: "MISSING_FIELD", field: "slug" }, 400);
  }

  await ctx.runMutation(api.galdr.recordUsage, { slug });
  return jsonResponse({ ok: true }, 200);
}

export const galdrUsagePost = httpAction(galdrUsagePostHandler);
