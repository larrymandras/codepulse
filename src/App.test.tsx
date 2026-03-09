import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
  ConvexProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ConvexReactClient: vi.fn(),
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

describe('App smoke test', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
    // The app should have rendered something inside the container
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
