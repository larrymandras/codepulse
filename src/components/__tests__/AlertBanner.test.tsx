import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../hooks/useAlerts', () => ({
  useAlertCounts: vi.fn(),
}));

import { useAlertCounts } from '../../hooks/useAlerts';
import AlertBanner from '../AlertBanner';

const mockUseAlertCounts = vi.mocked(useAlertCounts);

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('AlertBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when there are critical alerts', () => {
    mockUseAlertCounts.mockReturnValue({ info: 0, warning: 0, error: 0, critical: 2 });
    renderWithRouter(<AlertBanner />);
    expect(screen.getByText(/2 active alerts/)).toBeInTheDocument();
    expect(screen.getByText(/2 critical/)).toBeInTheDocument();
  });

  it('renders when there are error alerts', () => {
    mockUseAlertCounts.mockReturnValue({ info: 0, warning: 0, error: 3, critical: 0 });
    renderWithRouter(<AlertBanner />);
    expect(screen.getByText(/3 active alerts/)).toBeInTheDocument();
    expect(screen.getByText(/3 errors/)).toBeInTheDocument();
  });

  it('renders correct count with mixed critical and error', () => {
    mockUseAlertCounts.mockReturnValue({ info: 1, warning: 2, error: 1, critical: 1 });
    renderWithRouter(<AlertBanner />);
    expect(screen.getByText(/2 active alerts/)).toBeInTheDocument();
  });

  it('shows singular "alert" for count of 1', () => {
    mockUseAlertCounts.mockReturnValue({ info: 0, warning: 0, error: 1, critical: 0 });
    renderWithRouter(<AlertBanner />);
    expect(screen.getByText(/1 active alert(?!s)/)).toBeInTheDocument();
  });

  it('does not render when urgentCount is zero', () => {
    mockUseAlertCounts.mockReturnValue({ info: 5, warning: 3, error: 0, critical: 0 });
    const { container } = renderWithRouter(<AlertBanner />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('does not render when all counts are zero', () => {
    mockUseAlertCounts.mockReturnValue({ info: 0, warning: 0, error: 0, critical: 0 });
    const { container } = renderWithRouter(<AlertBanner />);
    expect(container.querySelector('button')).toBeNull();
  });
});
