import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock Clerk — AuthGuard reads VITE_CLERK_PUBLISHABLE_KEY from import.meta.env.
// With no key set, AuthGuard renders children directly (dev mode).
vi.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock all Convex hooks used transitively by pages/components
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useConvexConnectionState: vi.fn(() => ({ isWebSocketConnected: true })),
  ConvexProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ConvexReactClient: vi.fn(),
  // Phase 106 Plan 04: routes are now actually navigated to in this file, so
  // every convex/react hook the page tree reaches has to exist. These two are
  // the remaining exports used anywhere in src/ -- an absent one surfaces as a
  // page-level TypeError, not as a missing-mock message.
  usePaginatedQuery: vi.fn(() => ({
    results: [],
    status: 'Exhausted',
    isLoading: false,
    loadMore: vi.fn(),
  })),
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock('../convex/_generated/api', () => ({
  api: new Proxy({}, {
    get: () => new Proxy({}, { get: () => 'mock-fn-ref' }),
  }),
}));

// Mock the AmbientContext to avoid Tone.js initialization in tests
vi.mock('./contexts/AmbientContext', () => ({
  useAmbient: vi.fn(() => ({
    enabled: false,
    toggle: vi.fn(),
    preset: 'silent',
    setPreset: vi.fn(),
    setHealth: vi.fn(),
    playAlert: vi.fn(),
    playEvent: vi.fn(),
  })),
  AmbientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock PrivacyContext
vi.mock('./contexts/PrivacyContext', () => ({
  usePrivacy: vi.fn(() => ({
    level: 'none',
    maskNames: false,
    maskPaths: false,
    maskTokens: false,
    toggle: vi.fn(),
    setSetting: vi.fn(),
    setLevel: vi.fn(),
  })),
  PrivacyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock react-globe.gl which requires WebGL
vi.mock('react-globe.gl', () => ({
  default: () => <div data-testid="mock-globe" />,
}));

// react-force-graph-2d (1.7MB on disk) reaches this file through the /memory
// lazy route: Memory.tsx -> ObsidianGraph -> ForceGraphCanvas. It was the only
// heavy render library NOT mocked here while five others were, which is the
// inconsistency this closes. ForceGraphCanvas guards its ref use
// (`if (!fg) return`, ForceGraphCanvas.tsx:163), so a stub that never sets the
// ref is safe.
vi.mock('react-force-graph-2d', () => ({
  default: () => <div data-testid="mock-force-graph-2d" />,
}));

// Mock Three.js / R3F to avoid WebGL issues
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-canvas">{children}</div>,
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ gl: {}, scene: {}, camera: {} })),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Stars: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Recharts to avoid SVG rendering issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Bar: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
}));

// Mock @xyflow/react
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-flow">{children}</div>,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  useReactFlow: () => ({ fitView: vi.fn() }),
  MarkerType: { ArrowClosed: 'arrowclosed' },
}));

import App from './App';

// Phase 106 Plan 04 (DEBT-03): the fourteen pages that used to be plain
// top-level imports are now lazy routes. `heading` is the page's own <h1>,
// which only exists once the lazy chunk has resolved and the real page has
// mounted -- the app shell renders no <h1> of its own.
//
// The transient Suspense fallback is deliberately NOT asserted at runtime: in
// vitest the dynamic import often resolves inside the act() flush that
// render() already performs, so whether the fallback is ever committed is a
// race against module-cache state and fails intermittently on a different
// route each run. The boundary's existence is instead asserted deterministically
// against the source in the "App source shape" block below.
//
// 122-15: every route's Suspense fallback is now the same shared
// `<LoadingState shape="page" />` skeleton (no more per-route "Loading
// X..." text -- design law: never render the word "Loading"), so there is
// no longer a per-route fallback STRING to assert against at runtime. The
// `component` field (the lazy const's own name in App.tsx) replaces the old
// `fallback` field and drives the source-shape check below instead.
const CONVERTED_ROUTES: Array<{
  path: string;
  component: string;
  heading: string;
}> = [
  { path: '/', component: 'Dashboard', heading: 'Dashboard' },
  { path: '/sessions/abc123', component: 'SessionDetail', heading: 'Session Detail' },
  { path: '/capabilities', component: 'Capabilities', heading: 'Capabilities Registry' },
  { path: '/alerts', component: 'Alerts', heading: 'Alerts' },
  { path: '/infrastructure', component: 'Infrastructure', heading: 'Infrastructure' },
  { path: '/security', component: 'Security', heading: 'Security Dashboard' },
  { path: '/self-healing', component: 'SelfHealing', heading: 'Self-Healing' },
  { path: '/build', component: 'BuildProgress', heading: 'Build Progress' },
  { path: '/settings', component: 'Settings', heading: 'Settings' },
  { path: '/memory', component: 'Memory', heading: 'Memory' },
  { path: '/briefings', component: 'Briefings', heading: 'Briefings' },
  { path: '/automation', component: 'Automation', heading: 'Automation' },
  { path: '/executions', component: 'Executions', heading: 'Execution History' },
  { path: '/ideation', component: 'Ideation', heading: 'Ideation' },
];

// The shared skeleton's own testid (LoadingState.tsx's PageSkeleton) --
// what a route's Suspense fallback renders while resolving, and what must
// be gone once the real page has mounted.
const PAGE_SKELETON_TESTID = 'loading-skeleton-page';

// Each case really does transform and import a whole page tree on demand, which
// under a loaded full-suite run comfortably exceeds testing-library's 1s default
// wait. The window is widened; the assertion itself is unchanged.
const LAZY_ROUTE_WAIT_MS = 20_000;

describe('App lazy routes (Phase 106 Plan 04, DEBT-03)', () => {
  it.each(CONVERTED_ROUTES)(
    'resolves $path past its lazy boundary and renders the page',
    async ({ path, heading }) => {
      window.history.pushState({}, '', path);
      render(<App />);
      expect(
        await screen.findByRole(
          'heading',
          { level: 1, name: heading },
          { timeout: LAZY_ROUTE_WAIT_MS },
        ),
      ).toBeInTheDocument();
      // A boundary that resolved is a boundary that is no longer showing.
      expect(screen.queryByTestId(PAGE_SKELETON_TESTID)).not.toBeInTheDocument();
    },
    LAZY_ROUTE_WAIT_MS + 5_000,
  );
});

describe('App smoke test', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('renders without crashing', async () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
    // The app should have rendered something inside the container
    expect(container.innerHTML.length).toBeGreaterThan(0);
    // Dashboard is lazy now; wait it out so the assertion above cannot be
    // satisfied by a Suspense fallback alone.
    await waitFor(
      () =>
        expect(
          screen.queryByTestId(PAGE_SKELETON_TESTID),
        ).not.toBeInTheDocument(),
      { timeout: LAZY_ROUTE_WAIT_MS },
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  }, LAZY_ROUTE_WAIT_MS + 5_000);

  it('still renders the Dashboard page at /', async () => {
    render(<App />);
    // The page's own <h1> -- the sidebar's "Dashboard" nav link is an anchor,
    // so a heading query cannot be satisfied by the app shell alone.
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Dashboard' },
        { timeout: LAZY_ROUTE_WAIT_MS },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(PAGE_SKELETON_TESTID),
    ).not.toBeInTheDocument();
  }, LAZY_ROUTE_WAIT_MS + 5_000);
});

describe('App source shape (DEBT-03 regression guard)', () => {
  // Read from disk, not via import: this test guards the *source shape* of
  // App.tsx, which a module import would erase.
  const appSource = readFileSync(
    resolve(process.cwd(), 'src/App.tsx'),
    'utf8',
  );

  it('statically imports zero page modules', () => {
    const staticPageImports =
      appSource.match(/^import .+ from "\.\/pages\/.+";$/gm) ?? [];
    expect(staticPageImports).toEqual([]);
  });

  it('wraps every converted route element in a Suspense boundary using the shared page-shaped skeleton', () => {
    // Deterministic counterpart to the runtime route tests: a lazy component
    // rendered without a Suspense ancestor throws at runtime, and the runtime
    // tests cannot observe the transient fallback reliably (see note above).
    // 122-15: the fallback is now the shared `LoadingState` skeleton, not a
    // per-route "Loading X..." string -- see design-law note above.
    for (const { component } of CONVERTED_ROUTES) {
      expect(appSource).toContain(
        `<Suspense fallback={<LoadingState shape="page" />}><${component} /></Suspense>`,
      );
    }
  });

  it('imports LoadingState and renders no bare "Loading" text anywhere in its source', () => {
    expect(appSource).toContain('import LoadingState from "./components/LoadingState";');
    expect(appSource).not.toMatch(/>Loading/);
  });

  it('declares a lazy loader for every converted route', () => {
    for (const name of [
      'Dashboard',
      'SessionDetail',
      'Capabilities',
      'Alerts',
      'Infrastructure',
      'Security',
      'SelfHealing',
      'BuildProgress',
      'Settings',
      'Memory',
      'Briefings',
      'Automation',
      'Executions',
      'Ideation',
    ]) {
      expect(appSource).toContain(
        `const ${name} = lazy(() => import("./pages/${name}"));`,
      );
    }
  });
});
