/**
 * EStopButton — 189-17 B6c.
 *
 * The button had been dead since it shipped: Ástríðr's WS auth is
 * connection-level, this app authenticates with the SERVICE key, and
 * estop.activate/deactivate are gated on the ADMIN key. Every click returned
 * "Command 'estop.activate' requires admin key".
 *
 * The fix is a per-command key typed at the moment of use. These tests pin the
 * two properties that matter: the key actually rides the command, and it never
 * outlives the dialog.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const sendCommand = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('../../contexts/AstridrWSContext', () => ({
  useAstridrWS: () => ({ sendCommand, status: 'connected' }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

import { EStopButton } from '../EStopButton';

const ADMIN_KEY = 'test-admin-key';

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Emergency Stop' }));
}

function typeKey(value: string) {
  fireEvent.change(screen.getByLabelText('Admin key'), { target: { value } });
}

describe('EStopButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendCommand.mockResolvedValue({ status: 'ok' });
  });

  it('does not send anything on the first click — the dialog opens instead', async () => {
    render(<EStopButton />);
    openDialog();

    expect(sendCommand).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends the typed admin key with estop.activate', async () => {
    render(<EStopButton />);
    openDialog();

    typeKey(ADMIN_KEY);
    fireEvent.click(screen.getByRole('button', { name: /Confirm E-Stop/ }));

    await waitFor(() =>
      expect(sendCommand).toHaveBeenCalledWith({
        type: 'estop.activate',
        admin_key: ADMIN_KEY,
      })
    );
  });

  it('sends estop.deactivate for release, with the same key', async () => {
    render(<EStopButton />);
    openDialog();

    typeKey(ADMIN_KEY);
    fireEvent.click(screen.getByRole('button', { name: /Release halt/ }));

    await waitFor(() =>
      expect(sendCommand).toHaveBeenCalledWith({
        type: 'estop.deactivate',
        admin_key: ADMIN_KEY,
      })
    );
  });

  it('cannot confirm with an empty key — both actions stay disabled', async () => {
    render(<EStopButton />);
    openDialog();

    expect(screen.getByRole('button', { name: /Confirm E-Stop/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Release halt/ })).toBeDisabled();
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('clears the key after a SUCCESSFUL send, not just on cancel', async () => {
    render(<EStopButton />);
    openDialog();
    typeKey(ADMIN_KEY);
    fireEvent.click(screen.getByRole('button', { name: /Confirm E-Stop/ }));
    await waitFor(() => expect(sendCommand).toHaveBeenCalled());

    // Reopen: the field must be empty. The success path is the one that is
    // easy to forget, and leaving the key in state there would defeat the
    // point of not baking it into the bundle.
    openDialog();
    expect(screen.getByLabelText('Admin key')).toHaveValue('');
  });

  it('clears the key on cancel', async () => {
    render(<EStopButton />);
    openDialog();
    typeKey(ADMIN_KEY);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    openDialog();
    expect(screen.getByLabelText('Admin key')).toHaveValue('');
  });

  it('surfaces the server error verbatim rather than a generic failure', async () => {
    // "none configured" means CODEPULSE_ADMIN_KEY is unset server-side, which
    // retyping will never fix — the operator has to be told which it is.
    sendCommand.mockResolvedValue({
      status: 'error',
      error: "Command 'estop.activate' requires admin key (none configured)",
    });
    render(<EStopButton />);
    openDialog();
    typeKey(ADMIN_KEY);
    fireEvent.click(screen.getByRole('button', { name: /Confirm E-Stop/ }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Command 'estop.activate' requires admin key (none configured)"
      )
    );
  });

  it('keeps the dialog open on failure so the key can be corrected', async () => {
    sendCommand.mockResolvedValue({ status: 'error', error: 'requires admin key' });
    render(<EStopButton />);
    openDialog();
    typeKey('wrong');
    fireEvent.click(screen.getByRole('button', { name: /Confirm E-Stop/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the key field as a password input', async () => {
    render(<EStopButton />);
    openDialog();

    expect(screen.getByLabelText('Admin key')).toHaveAttribute('type', 'password');
  });
});
