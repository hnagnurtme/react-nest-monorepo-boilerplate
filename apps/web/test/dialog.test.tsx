import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDialog, Dialog } from '@/shared/ui';

afterEach(() => {
  cleanup();
});

describe('Dialog', () => {
  it('moves focus into the panel and returns it to the trigger on close', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
            }}
          >
            Open
          </button>
          {isOpen ? (
            <Dialog
              title="Settings"
              closeLabel="Close"
              onClose={() => {
                setIsOpen(false);
              }}
            >
              <button type="button">Inside</button>
            </Dialog>
          ) : null}
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    // The close button is the first focusable element inside the panel.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('closes on Escape and on a click outside the panel', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <Dialog title="Settings" closeLabel="Close" onClose={onClose}>
        <p>Body</p>
      </Dialog>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    const scrim = container.querySelector('button[aria-hidden="true"]');
    expect(scrim).not.toBeNull();
    if (scrim) await user.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not offer a scrim to close when the caller forbids it', () => {
    const { container } = render(
      <Dialog title="Settings" closeLabel="Close" onClose={vi.fn()} closeOnOverlayClick={false}>
        <p>Body</p>
      </Dialog>,
    );

    expect(container.querySelector('button[aria-hidden="true"]')).toBeNull();
  });

  it('locks page scrolling while open and restores it afterwards', () => {
    const { unmount } = render(
      <Dialog title="Settings" closeLabel="Close" onClose={vi.fn()}>
        <p>Body</p>
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps the lock until the last nested dialog closes', () => {
    const outer = render(
      <Dialog title="Outer" closeLabel="Close" onClose={vi.fn()}>
        <p>Body</p>
      </Dialog>,
    );
    const inner = render(
      <Dialog title="Inner" closeLabel="Close" onClose={vi.fn()}>
        <p>Body</p>
      </Dialog>,
    );

    inner.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    outer.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('ConfirmDialog', () => {
  const labels = {
    title: 'Delete user',
    message: 'Delete user a@b.c? This cannot be undone.',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    closeLabel: 'Close',
  };

  it('reports the choice the user made', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<ConfirmDialog {...labels} onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText(labels.message)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocks both buttons while the request is in flight', () => {
    render(<ConfirmDialog {...labels} isPending onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });
});
