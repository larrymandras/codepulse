import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchSummary,
  fetchOverview,
  fetchEntity,
  fetchContradictions,
  fetchSearch,
} from "./kgApi";
import { AstridrApiError } from "./astridrApi";

// We stub the global fetch and assert on the URL/params/headers each fetcher
// builds, plus parse + error behavior. VITE_ASTRIDR_API_URL is unset in tests,
// so the base resolves against window.location.origin (jsdom: http://localhost).

const okJson = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as Response;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function lastUrl(): URL {
  const arg = fetchMock.mock.calls.at(-1)![0] as string;
  return new URL(arg);
}
function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)![1] as RequestInit;
}

describe("kgApi — fetchSummary", () => {
  it("GETs /api/kg/summary with the auth content-type header and parses the body", async () => {
    const body = {
      entitiesByType: { person: 3 },
      currentTripleCount: 10,
      historicalTripleCount: 25,
      contradictionCount: 1,
      lastExtractionAt: "2026-06-09T12:00:00+00:00",
    };
    fetchMock.mockResolvedValue(okJson(body));

    const out = await fetchSummary();
    expect(lastUrl().pathname).toBe("/api/kg/summary");
    // authHeaders always sets Content-Type; Authorization only when key present (unset here).
    const headers = lastInit().headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(out.currentTripleCount).toBe(10);
    expect(out.entitiesByType.person).toBe(3);
  });
});

describe("kgApi — fetchOverview", () => {
  it("builds the correct query params (limit, entity_type, agent_id, asOf)", async () => {
    fetchMock.mockResolvedValue(
      okJson({ entities: [], count: 0, total: 0, truncated: false, asOf: null }),
    );
    await fetchOverview({
      limit: 100,
      entityType: "person",
      agentId: "skuld",
      asOf: "2026-01-01T00:00:00Z",
    });
    const url = lastUrl();
    expect(url.pathname).toBe("/api/kg/overview");
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("entity_type")).toBe("person");
    expect(url.searchParams.get("agent_id")).toBe("skuld");
    expect(url.searchParams.get("asOf")).toBe("2026-01-01T00:00:00Z");
  });

  it("omits null/empty params", async () => {
    fetchMock.mockResolvedValue(
      okJson({ entities: [], count: 0, total: 0, truncated: false, asOf: null }),
    );
    await fetchOverview({ limit: 50, entityType: null, agentId: "" });
    const url = lastUrl();
    expect(url.searchParams.has("entity_type")).toBe(false);
    expect(url.searchParams.has("agent_id")).toBe(false);
    expect(url.searchParams.get("limit")).toBe("50");
  });
});

describe("kgApi — fetchEntity", () => {
  it("passes name, hops, and asOf", async () => {
    fetchMock.mockResolvedValue(
      okJson({ entity: { id: "a", name: "Larry" }, triples: [], hops: 2, asOf: null }),
    );
    await fetchEntity({ name: "Larry", hops: 2, asOf: "2026-01-01T00:00:00Z" });
    const url = lastUrl();
    expect(url.pathname).toBe("/api/kg/entity");
    expect(url.searchParams.get("name")).toBe("Larry");
    expect(url.searchParams.get("hops")).toBe("2");
    expect(url.searchParams.get("asOf")).toBe("2026-01-01T00:00:00Z");
  });
});

describe("kgApi — fetchContradictions", () => {
  it("GETs /api/kg/contradictions and parses the list", async () => {
    fetchMock.mockResolvedValue(okJson({ contradictions: [], count: 0 }));
    const out = await fetchContradictions();
    expect(lastUrl().pathname).toBe("/api/kg/contradictions");
    expect(out.count).toBe(0);
  });
});

describe("kgApi — error handling", () => {
  it("throws AstridrApiError with the FastAPI detail message on non-2xx", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ detail: "Missing bearer token" }),
    } as unknown as Response);

    await expect(fetchSummary()).rejects.toMatchObject({
      name: "AstridrApiError",
      status: 401,
      message: "Missing bearer token",
    });
  });

  it("falls back to statusText when no detail is present", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    } as unknown as Response);

    await expect(fetchOverview()).rejects.toMatchObject({
      status: 500,
      message: "Internal Server Error",
    });
  });

  it("propagates a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchSummary()).rejects.toThrow("Failed to fetch");
  });
});

describe("kgApi — fetchSearch", () => {
  const searchResponse = {
    results: [
      {
        subjectName: "Larry",
        subjectId: "e-larry",
        predicate: "knows",
        snippet: "Larry knows the architecture",
        matchedTerm: "architecture",
        confidence: 0.9,
      },
    ],
    count: 1,
    query: "architecture",
  };

  it("GETs /api/kg/search with query + entity_type + agent_id params", async () => {
    fetchMock.mockResolvedValue(okJson(searchResponse));
    await fetchSearch({
      query: "architecture",
      entity_type: "person",
      agent_id: "skuld",
    });
    const url = lastUrl();
    expect(url.pathname).toBe("/api/kg/search");
    expect(url.searchParams.get("query")).toBe("architecture");
    expect(url.searchParams.get("entity_type")).toBe("person");
    expect(url.searchParams.get("agent_id")).toBe("skuld");
  });

  it("includes the Bearer Authorization header via authHeaders()", async () => {
    fetchMock.mockResolvedValue(okJson(searchResponse));
    await fetchSearch({ query: "test" });
    const headers = lastInit().headers as Record<string, string>;
    // authHeaders() always sets Content-Type; Authorization only when key present (unset in tests).
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("omits null/empty optional params", async () => {
    fetchMock.mockResolvedValue(okJson(searchResponse));
    await fetchSearch({ query: "facts", entity_type: null, agent_id: "" });
    const url = lastUrl();
    expect(url.searchParams.has("entity_type")).toBe(false);
    expect(url.searchParams.has("agent_id")).toBe(false);
    expect(url.searchParams.get("query")).toBe("facts");
  });

  it("passes limit when provided", async () => {
    fetchMock.mockResolvedValue(okJson(searchResponse));
    await fetchSearch({ query: "test", limit: 20 });
    expect(lastUrl().searchParams.get("limit")).toBe("20");
  });

  it("throws AstridrApiError with status 404 on a 404 response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "endpoint not deployed" }),
    } as unknown as Response);
    const err = await fetchSearch({ query: "test" }).catch((e) => e);
    expect(err).toBeInstanceOf(AstridrApiError);
    expect(err.status).toBe(404);
  });

  it("throws AstridrApiError with status 501 on a 501 response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 501,
      statusText: "Not Implemented",
      json: async () => ({ detail: "search not implemented" }),
    } as unknown as Response);
    const err = await fetchSearch({ query: "test" }).catch((e) => e);
    expect(err).toBeInstanceOf(AstridrApiError);
    expect(err.status).toBe(501);
  });

  it("parses and returns the KgSearchResponse on 200", async () => {
    fetchMock.mockResolvedValue(okJson(searchResponse));
    const out = await fetchSearch({ query: "architecture" });
    expect(out.count).toBe(1);
    expect(out.results[0].subjectName).toBe("Larry");
    expect(out.results[0].predicate).toBe("knows");
  });
});

// Sanity: AstridrApiError is the shared error type, not a bespoke one.
describe("kgApi — error type", () => {
  it("uses AstridrApiError from astridrApi", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "nope" }),
    } as unknown as Response);
    const err = await fetchEntity({ name: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(AstridrApiError);
  });
});
