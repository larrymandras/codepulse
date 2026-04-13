import { describe, it, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricCard from '../MetricCard';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="CPU Usage" value="85%" />);
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renders numeric value', () => {
    render(<MetricCard label="Sessions" value={42} />);
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  // Old ASCII arrow tests removed — superseded by Lucide icon design (UI-02)
  // it('renders up trend indicator', () => { ... });
  // it('renders down trend indicator', () => { ... });

  it('does not render trend indicator when trend is not provided', () => {
    const { container } = render(<MetricCard label="Count" value="10" />);
    expect(container.querySelector('.text-green-400')).toBeNull();
    expect(container.querySelector('.text-red-400')).toBeNull();
  });

  it('does not render trend arrow for neutral trend', () => {
    const { container } = render(<MetricCard label="Steady" value="5" trend="neutral" />);
    expect(screen.queryByText('^')).toBeNull();
    expect(screen.queryByText('v')).toBeNull();
  });

  // UI-02 borderless redesign stubs — implemented in Plan 01-01
  test.todo("renders value with tabular-nums class");
  test.todo("renders TrendingUp icon when trend is up");
  test.todo("renders TrendingDown icon when trend is down");
  test.todo("does not render border or rounded corners");
  test.todo("does not render bg-gray background");
  test.todo("uses --status-ok color for up trend");
  test.todo("uses --status-error color for down trend");
});
