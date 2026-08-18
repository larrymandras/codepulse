/**
 * Analytics page fault-injection tests (Phase 121 Plan 04, DEBT-08 criteria 1
 * and 3).
 *
 * Proves the property `Analytics.tsx` exists to guarantee: forcing exactly
 * one relocated query to throw leaves every sibling panel rendering its own
 * real content, with exactly one error affordance on the page. Modeled on
 * `src/pages/WorkspaceMap.test.tsx`'s `vi.hoisted` throw-flag +
 * `importOriginal`-wrapped mock pattern (Phase 114), extended to eight
 * components instead of two.
 *
 * Per the assertion-discipline rules in `121-VALIDATION.md` ("Assertion
 * Discipline"), every isolation case asserts the OBSERVABLE OUTCOME —
 * sibling panels rendering real, distinguishing content — never a
 * self-reported internal flag, a claim that nothing was thrown, or the mere
 * absence of an error string.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// ---------------------------------------------------------------------------
// Module mocks — declared before component import
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({ throwIn: null as string | null }));

/**
 * `usePaginatedQuery` is destructured directly (`const { results, status,
 * loadMore } = usePaginatedQuery(...)`) by `useLlmMetrics` — a bare
 * `undefined` default would throw "Cannot destructure property 'results' of
 * undefined" for every component that uses it, independent of the fault
 * being tested. Must always return a valid shape.
 */
function mockUsePaginatedQuery(ref: unknown) {
  if (ref === "llm:recentCallsPaginated") {
    return { results: LLM_CALLS_FIXTURE, status: "Exhausted" as const, loadMore: vi.fn() };
  }
  return { results: [], status: "Exhausted" as const, loadMore: vi.fn() };
}

function mockUseQuery(ref: unknown) {
  switch (ref) {
    case "aggregates:eventCountsByPeriod":
      return { "2026-08-18": 55 };
    case "anomalyDetection:getActiveAnomalies":
      return {};
    case "llm:cacheStats":
      return CACHE_STATS_FIXTURE;
    case "costDerived:billedOverTime":
      return API_SPEND_FIXTURE;
    case "advisorEvents:executionDepthHistogram":
      return DEPTH_FIXTURE;
    case "advisorEvents:savingsSummary":
      return { totalSavings: 99.5 };
    case "advisorEvents:recent":
      return ADVISOR_RECENT_FIXTURE;
    // Every other query this page's non-relocated siblings read (forecasts,
    // costBudgets, sessions, apiErrors, gatewayQuota, ...) is intentionally
    // left undefined here — each of those components already handles a
    // loading/undefined query result on its own (verified by reading every
    // one before writing this file: all fall back via `?? []`/`?? {}` or an
    // explicit `data === undefined` loading branch), so an unmatched ref
    // renders a harmless loading state rather than throwing.
    default:
      return undefined;
  }
}

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(args[0]),
  usePaginatedQuery: (...args: unknown[]) => mockUsePaginatedQuery(args[0]),
}));

/**
 * Stable string sentinels for the queries this test drives fixtures for.
 * `moduleProxy` falls back to a synthesized `"module:prop"` string for any
 * other function on that module (e.g. `llm.providerBreakdown`, `llm.costByModel`,
 * `costDerived.costBreakdown`) so every OTHER component on the page still
 * gets *some* string ref — never `undefined.someFn`, which would throw
 * before the mock even runs. `mockUseQuery`'s `default` case turns every one
 * of those synthesized refs into `undefined`, matching the real loading
 * state those components already render correctly.
 */
function moduleProxy(known: Record<string, string>, moduleName: string) {
  return new Proxy(known, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return `${moduleName}:${prop}`;
    },
  });
}

vi.mock("../../convex/_generated/api", () => {
  const known = {
    events: moduleProxy({ listRecentUnified: "events:listRecentUnified" }, "events"),
    aggregates: moduleProxy(
      { eventCountsByPeriod: "aggregates:eventCountsByPeriod" },
      "aggregates"
    ),
    anomalyDetection: moduleProxy(
      { getActiveAnomalies: "anomalyDetection:getActiveAnomalies" },
      "anomalyDetection"
    ),
    llm: moduleProxy(
      {
        recentCallsPaginated: "llm:recentCallsPaginated",
        cacheStats: "llm:cacheStats",
      },
      "llm"
    ),
    costDerived: moduleProxy(
      { billedOverTime: "costDerived:billedOverTime" },
      "costDerived"
    ),
    advisorEvents: moduleProxy(
      {
        executionDepthHistogram: "advisorEvents:executionDepthHistogram",
        savingsSummary: "advisorEvents:savingsSummary",
        recent: "advisorEvents:recent",
      },
      "advisorEvents"
    ),
  };
  const api = new Proxy(known as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return moduleProxy({}, prop);
    },
  });
  return { api };
});

// The eight self-fetching components each become a boundary-throw switch,
// wrapping the REAL component via importOriginal — not a full stub — so the
// all-healthy control and the seven-sibling assertions in every isolation
// case still exercise genuine rendered output. Only the one component named
// by `h.throwIn` actually throws.
vi.mock("../components/analytics/TotalEventsCard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../components/analytics/TotalEventsCard")>();
  return {
    ...actual,
    default: () => {
      if (h.throwIn === "TotalEventsCard") throw new Error("boom-TotalEventsCard");
      return <actual.default />;
    },
  };
});
vi.mock("../components/analytics/LlmVolumeCards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../components/analytics/LlmVolumeCards")>();
  return {
    ...actual,
    default: () => {
      if (h.throwIn === "LlmVolumeCards") throw new Error("boom-LlmVolumeCards");
      return <actual.default />;
    },
  };
});
vi.mock("../components/analytics/CacheHitRateCard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../components/analytics/CacheHitRateCard")>();
  return {
    ...actual,
    default: () => {
      if (h.throwIn === "CacheHitRateCard") throw new Error("boom-CacheHitRateCard");
      return <actual.default />;
    },
  };
});
vi.mock("../components/analytics/ApiSpendCard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../components/analytics/ApiSpendCard")>();
  return {
    ...actual,
    default: () => {
      if (h.throwIn === "ApiSpendCard") throw new Error("boom-ApiSpendCard");
      return <actual.default />;
    },
  };
});
vi.mock("../components/analytics/PromptCachePanel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../components/analytics/PromptCachePanel")>();
  return {
    ...actual,
    default: () => {
      if (h.throwIn === "PromptCachePanel") throw new Error("boom-PromptCachePanel");
      return <actual.default />;
    },
  };
});
vi.mock("../components/analytics/RecentLlmCallsPanel", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../components/analytics/RecentLlmCallsPanel")>();
  return {
    ...actual,
    default: () => {
      if (h.throwIn === "RecentLlmCallsPanel") throw new Error("boom-RecentLlmCallsPanel");
      return <actual.default />;
    },
  };
});
vi.mock("../components/analytics/ExecutionDepthPanel", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../components/analytics/ExecutionDepthPanel")>();
  return {
    ...actual,
    default: () => {
      if (h.throwIn === "ExecutionDepthPanel") throw new Error("boom-ExecutionDepthPanel");
      return <actual.default />;
    },
  };
});
vi.mock("../components/analytics/AdvisorStrategyPanel", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../components/analytics/AdvisorStrategyPanel")>();
  return {
    ...actual,
    default: () => {
      if (h.throwIn === "AdvisorStrategyPanel") throw new Error("boom-AdvisorStrategyPanel");
      return <actual.default />;
    },
  };
});

import Analytics from "./Analytics";
import { PrivacyProvider } from "../contexts/PrivacyContext";

// ---------------------------------------------------------------------------
// Fixtures — distinctive values so each component's real output is
// unambiguous, and shared with mockUseQuery/mockUsePaginatedQuery above.
// ---------------------------------------------------------------------------

const LLM_CALLS_FIXTURE = [
  {
    _id: "call-fixture-1",
    model: "llm-fixture-model",
    timestamp: 1755000000000,
    cost: 0.05,
    latencyMs: 420,
    cacheReadInputTokens: 10,
    sessionId: "session-fixture-1",
    totalTokens: 4242,
  },
];

const CACHE_STATS_FIXTURE = {
  overall: { hitRate: 0.42 },
  byModel: [
    {
      model: "cache-fixture-model",
      calls: 7,
      hitRate: 0.5,
      cacheReadInputTokens: 100,
      totalPromptTokens: 200,
    },
  ],
};

const API_SPEND_FIXTURE = {
  buckets: [{ billedUsd: 12.34 }],
};

const DEPTH_FIXTURE = [{ label: "depth-fixture-bucket", count: 3 }];

const ADVISOR_RECENT_FIXTURE = [
  {
    provider: "advisor-fixture-provider",
    costUsd: 1,
    standardCostUsd: 2,
    used: true,
  },
];

// ---------------------------------------------------------------------------
// Component registry — boundary name + a piece of text unique to that
// component's real (non-error) rendered output. Some content strings equal
// their own boundary name (Recent LLM Calls, Advisor Strategy, API Spend,
// Total Events) — safe because a component's real content and its own
// boundary's "failed to load" fallback are never both present at once (the
// component that throws never reaches its own JSX).
// ---------------------------------------------------------------------------

const COMPONENTS = [
  { key: "TotalEventsCard", boundary: "Total Events", content: /Total Events/ },
  // Exact-anchored: "LLM Calls" (unanchored) is a substring of "Recent LLM
  // Calls" (RecentLlmCallsPanel's header), which would falsely double-match.
  { key: "LlmVolumeCards", boundary: "LLM Volume", content: /^LLM Calls$/ },
  { key: "CacheHitRateCard", boundary: "Cache Hit Rate", content: /Cache Hit Rate \(24h\)/ },
  { key: "ApiSpendCard", boundary: "API Spend", content: /API Spend/ },
  { key: "PromptCachePanel", boundary: "Prompt Cache", content: /Prompt Cache by Model/ },
  { key: "RecentLlmCallsPanel", boundary: "Recent LLM Calls", content: /Recent LLM Calls/ },
  {
    key: "ExecutionDepthPanel",
    boundary: "Execution Depth",
    content: /Execution Depth Distribution/,
  },
  { key: "AdvisorStrategyPanel", boundary: "Advisor Strategy", content: /Total Savings/ },
] as const;

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderPage() {
  localStorage.setItem(
    "codepulse-privacy",
    JSON.stringify({
      enabled: false,
      maskPaths: true,
      maskEmails: true,
      maskKeys: true,
      maskIps: true,
      level: "off",
    })
  );
  return render(
    <MemoryRouter initialEntries={["/analytics"]}>
      <PrivacyProvider>
        <Analytics />
      </PrivacyProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  h.throwIn = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  h.throwIn = null;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Error isolation (DEBT-08 criteria 1 and 3)
// ---------------------------------------------------------------------------

/**
 * Shared assertion for "every OTHER relocated component still renders its
 * own real content" (criterion 1) — looked up from `COMPONENTS` so a typo in
 * one case's sibling list can't silently drop coverage. Each of the eight
 * `it()` blocks below still carries its OWN literal "failed to load" regex
 * (not a shared template), so the isolation and the exactly-one-failure
 * assertions are independent per case, not generated by a loop.
 */
function expectAllOtherSiblingsRenderRealContent(excludeKey: string) {
  for (const sibling of COMPONENTS) {
    if (sibling.key === excludeKey) continue;
    expect(screen.getByText(sibling.content)).toBeInTheDocument();
  }
}

describe("error isolation (DEBT-08 criteria 1 and 3)", () => {
  it("all-healthy control: every component renders real content and no boundary fires", () => {
    renderPage();

    for (const c of COMPONENTS) {
      expect(screen.getByText(c.content)).toBeInTheDocument();
    }
    expect(screen.queryAllByText(/failed to load/i)).toHaveLength(0);
  });

  it('a fault in TotalEventsCard costs only the "Total Events" panel — every sibling still renders real content', () => {
    h.throwIn = "TotalEventsCard";
    renderPage();
    expect(screen.getByText(/Total Events failed to load/i)).toBeInTheDocument();
    expect(screen.getAllByText(/failed to load/i)).toHaveLength(1);
    expectAllOtherSiblingsRenderRealContent("TotalEventsCard");
  });

  it('a fault in LlmVolumeCards costs only the "LLM Volume" panel — every sibling still renders real content', () => {
    h.throwIn = "LlmVolumeCards";
    renderPage();
    expect(screen.getByText(/LLM Volume failed to load/i)).toBeInTheDocument();
    expect(screen.getAllByText(/failed to load/i)).toHaveLength(1);
    expectAllOtherSiblingsRenderRealContent("LlmVolumeCards");
  });

  it('a fault in CacheHitRateCard costs only the "Cache Hit Rate" panel — every sibling still renders real content', () => {
    h.throwIn = "CacheHitRateCard";
    renderPage();
    expect(screen.getByText(/Cache Hit Rate failed to load/i)).toBeInTheDocument();
    expect(screen.getAllByText(/failed to load/i)).toHaveLength(1);
    expectAllOtherSiblingsRenderRealContent("CacheHitRateCard");
  });

  it('a fault in ApiSpendCard costs only the "API Spend" panel — every sibling still renders real content', () => {
    h.throwIn = "ApiSpendCard";
    renderPage();
    expect(screen.getByText(/API Spend failed to load/i)).toBeInTheDocument();
    expect(screen.getAllByText(/failed to load/i)).toHaveLength(1);
    expectAllOtherSiblingsRenderRealContent("ApiSpendCard");
  });

  it('a fault in PromptCachePanel costs only the "Prompt Cache" panel — every sibling still renders real content', () => {
    h.throwIn = "PromptCachePanel";
    renderPage();
    expect(screen.getByText(/Prompt Cache failed to load/i)).toBeInTheDocument();
    expect(screen.getAllByText(/failed to load/i)).toHaveLength(1);
    expectAllOtherSiblingsRenderRealContent("PromptCachePanel");
  });

  it('a fault in RecentLlmCallsPanel costs only the "Recent LLM Calls" panel — every sibling still renders real content', () => {
    h.throwIn = "RecentLlmCallsPanel";
    renderPage();
    expect(screen.getByText(/Recent LLM Calls failed to load/i)).toBeInTheDocument();
    expect(screen.getAllByText(/failed to load/i)).toHaveLength(1);
    expectAllOtherSiblingsRenderRealContent("RecentLlmCallsPanel");
  });

  it('a fault in ExecutionDepthPanel costs only the "Execution Depth" panel — every sibling still renders real content', () => {
    h.throwIn = "ExecutionDepthPanel";
    renderPage();
    expect(screen.getByText(/Execution Depth failed to load/i)).toBeInTheDocument();
    expect(screen.getAllByText(/failed to load/i)).toHaveLength(1);
    expectAllOtherSiblingsRenderRealContent("ExecutionDepthPanel");
  });

  it('a fault in AdvisorStrategyPanel costs only the "Advisor Strategy" panel — every sibling still renders real content', () => {
    h.throwIn = "AdvisorStrategyPanel";
    renderPage();
    expect(screen.getByText(/Advisor Strategy failed to load/i)).toBeInTheDocument();
    expect(screen.getAllByText(/failed to load/i)).toHaveLength(1);
    expectAllOtherSiblingsRenderRealContent("AdvisorStrategyPanel");
  });
});
