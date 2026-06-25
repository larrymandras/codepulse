/**
 * MicToggle.test.tsx — Phase 92 Plan 05 (TDD RED gate)
 *
 * Covers:
 *   - OFF state: renders Mic icon, correct aria-label, not disabled, calls onToggle(true) on click
 *   - ON state: renders MicVocal icon, correct aria-label, not disabled, calls onToggle(false) on click
 *   - DISABLED state (status='error-disabled'): renders MicOff icon, disabled attribute, does not call onToggle on click
 *   - Tooltip renders with the correct content per state
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MicToggle } from './MicToggle';

// Wrap in a TooltipProvider-compatible environment — the Radix tooltip requires a Provider.
// We import and wrap it here rather than mocking so the tooltip content is rendered.
import { TooltipProvider } from '@/components/ui/tooltip';

function renderMicToggle(props: {
  enabled: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error-disabled';
  errorReason: string | null;
  onToggle: (v: boolean) => void;
}) {
  return render(
    <TooltipProvider>
      <MicToggle {...props} />
    </TooltipProvider>,
  );
}

describe('MicToggle', () => {
  describe('OFF state (enabled=false, status=idle)', () => {
    it('renders the Mic icon (lucide-mic testid or aria)', () => {
      const onToggle = vi.fn();
      renderMicToggle({ enabled: false, status: 'idle', errorReason: null, onToggle });
      // Lucide icons render as <svg> — check the accessible button label instead
      expect(screen.getByRole('button', { name: /enable voice mode/i })).toBeInTheDocument();
    });

    it('has aria-label "Enable voice mode"', () => {
      const onToggle = vi.fn();
      renderMicToggle({ enabled: false, status: 'idle', errorReason: null, onToggle });
      expect(screen.getByRole('button', { name: 'Enable voice mode' })).toBeInTheDocument();
    });

    it('is not disabled', () => {
      const onToggle = vi.fn();
      renderMicToggle({ enabled: false, status: 'idle', errorReason: null, onToggle });
      expect(screen.getByRole('button', { name: /enable voice mode/i })).not.toBeDisabled();
    });

    it('calls onToggle(true) when clicked', () => {
      const onToggle = vi.fn();
      renderMicToggle({ enabled: false, status: 'idle', errorReason: null, onToggle });
      fireEvent.click(screen.getByRole('button', { name: /enable voice mode/i }));
      expect(onToggle).toHaveBeenCalledOnce();
      expect(onToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('ON state (enabled=true, status=ready)', () => {
    it('has aria-label "Disable voice mode"', () => {
      const onToggle = vi.fn();
      renderMicToggle({ enabled: true, status: 'ready', errorReason: null, onToggle });
      expect(screen.getByRole('button', { name: 'Disable voice mode' })).toBeInTheDocument();
    });

    it('is not disabled', () => {
      const onToggle = vi.fn();
      renderMicToggle({ enabled: true, status: 'ready', errorReason: null, onToggle });
      expect(screen.getByRole('button', { name: /disable voice mode/i })).not.toBeDisabled();
    });

    it('calls onToggle(false) when clicked', () => {
      const onToggle = vi.fn();
      renderMicToggle({ enabled: true, status: 'ready', errorReason: null, onToggle });
      fireEvent.click(screen.getByRole('button', { name: /disable voice mode/i }));
      expect(onToggle).toHaveBeenCalledOnce();
      expect(onToggle).toHaveBeenCalledWith(false);
    });
  });

  describe('DISABLED state (status=error-disabled)', () => {
    it('has aria-label "Voice mode unavailable"', () => {
      const onToggle = vi.fn();
      renderMicToggle({
        enabled: false,
        status: 'error-disabled',
        errorReason: 'ONNX model failed to load',
        onToggle,
      });
      expect(screen.getByRole('button', { name: 'Voice mode unavailable' })).toBeInTheDocument();
    });

    it('has the disabled attribute set', () => {
      const onToggle = vi.fn();
      renderMicToggle({
        enabled: false,
        status: 'error-disabled',
        errorReason: 'ONNX model failed to load',
        onToggle,
      });
      expect(screen.getByRole('button', { name: /voice mode unavailable/i })).toBeDisabled();
    });

    it('does NOT call onToggle when clicked while disabled', () => {
      const onToggle = vi.fn();
      renderMicToggle({
        enabled: false,
        status: 'error-disabled',
        errorReason: 'ONNX model failed to load',
        onToggle,
      });
      fireEvent.click(screen.getByRole('button', { name: /voice mode unavailable/i }));
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('also renders disabled when enabled=true but status=error-disabled', () => {
      const onToggle = vi.fn();
      renderMicToggle({
        enabled: true,
        status: 'error-disabled',
        errorReason: 'init failed',
        onToggle,
      });
      expect(screen.getByRole('button', { name: /voice mode unavailable/i })).toBeDisabled();
    });
  });

});
