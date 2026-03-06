import { describe, it, expect } from 'vitest';
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

  it('renders up trend indicator', () => {
    render(<MetricCard label="Requests" value="1.2k" trend="up" />);
    expect(screen.getByText('^')).toBeInTheDocument();
    expect(screen.getByText('^').className).toContain('text-green-400');
  });

  it('renders down trend indicator', () => {
    render(<MetricCard label="Errors" value="3" trend="down" />);
    expect(screen.getByText('v')).toBeInTheDocument();
    expect(screen.getByText('v').className).toContain('text-red-400');
  });

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
});
