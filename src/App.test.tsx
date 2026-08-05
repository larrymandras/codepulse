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
const CONVERTED_ROUTES: Array<{
  path: string;
  fallback: string;
  heading: string;
}> = [
  { path: '/', fallback: 'Loading Dashboard...', heading: 'Dashboard' },
  { path: '/sessions/abc123', fallback: 'Loading Session Detail...', heading: 'Session Detail' },
  { path: '/capabilities', fallback: 'Loading Capabilities...', heading: 'Capabilities Registry' },
  { path: '/alerts', fallback: 'Loading Alerts...', heading: 'Alerts' },
  { path: '/infrastructure', fallback: 'Loading Infrastructure...', heading: 'Infrastructure' },
  { path: '/security', fallback: 'Loading Security...', heading: 'Security Dashboard' },
  { path: '/self-healing', fallback: 'Loading Self-Healing...', heading: 'Self-Healing' },
  { path: '/build', fallback: 'Loading Build Progress...', heading: 'Build Progress' },
  { path: '/settings', fallback: 'Loading Settings...', heading: 'Settings' },
  { path: '/memory', fallback: 'Loading Memory...', heading: 'Memory' },
  { path: '/briefings', fallback: 'Loading Briefings...', heading: 'Briefings' },
  { path: '/automation', fallback: 'Loading Automation...', heading: 'Automation' },
  { path: '/executions', fallback: 'Loading Executions...', heading: 'Execution History' },
  { path: '/ideation', fallback: 'Loading Ideation...', heading: 'Ideation' },
];

// Each case really does transform and import a whole page tree on demand, which
// under a loaded full-suite run comfortably exceeds testing-library's 1s default
// wait. The window is widened; the assertion itself is unchanged.
const LAZY_ROUTE_WAIT_MS = 20_000;

describe('App lazy routes (Phase 106 Plan 04, DEBT-03)', () => {
  it.each(CONVERTED_ROUTES)(
    'resolves $path past its lazy boundary and renders the page',
    async ({ path, fallback, heading }) => {
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
      expect(screen.queryByText(fallback)).not.toBeInTheDocument();
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
          screen.queryByText('Loading Dashboard...'),
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
      screen.queryByText('Loading Dashboard...'),
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

  it('wraps every converted route element in a Suspense boundary', () => {
    // Deterministic counterpart to the runtime route tests: a lazy component
    // rendered without a Suspense ancestor throws at runtime, and the runtime
    // tests cannot observe the transient fallback reliably (see note above).
    for (const { fallback } of CONVERTED_ROUTES) {
      expect(appSource).toContain(
        `<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">${fallback}</div>}>`,
      );
    }
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
