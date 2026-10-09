import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ButtonV2, DrawerV2, InputV2 } from '..';
import type { DrawerStatus } from '..';
import { axeViolations } from './axe';

function Harness({ guard, status = 'ready' }: { guard?: () => boolean; status?: DrawerStatus }) {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <button type="button" onClick={() => setOpen(true)}>Open drawer</button>
      <DrawerV2
        open={open}
        onClose={() => setOpen(false)}
        kicker="Interview · HRIS Developer"
        title="Schedule interview"
        subtitle="Ahmed Embaby"
        status={status}
        confirmClose={guard}
        secondaryAction={<ButtonV2 kind="secondary">Cancel</ButtonV2>}
        primaryAction={<ButtonV2>Schedule</ButtonV2>}
      >
        <InputV2 label="Date" />
        <InputV2 label="Room URL" />
      </DrawerV2>
    </main>
  );
}

async function openIt() {
  await userEvent.click(screen.getByRole('button', { name: 'Open drawer' }));
  return screen.getByRole('dialog');
}

describe('DrawerV2', () => {
  it('is a labelled modal dialog with kicker, title, subtitle, one primary in the footer; no axe violations', async () => {
    render(<Harness />);
    const dialog = await openIt();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Schedule interview');
    expect(dialog).toHaveAccessibleDescription('Ahmed Embaby');
    expect(screen.getByText('Interview · HRIS Developer')).toBeInTheDocument();
    const footer = dialog.querySelector('footer')!;
    expect(footer.querySelectorAll('[data-kind="primary"]')).toHaveLength(1);
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it('sets initial focus in the body, traps Tab both ways, returns focus to the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open drawer' });
    await openIt();
    expect(screen.getByLabelText('Date')).toHaveFocus();
    // forward wrap: last focusable is the primary button
    screen.getByRole('button', { name: 'Schedule' }).focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    // backward wrap
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Schedule' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on backdrop click and on the close button', async () => {
    render(<Harness />);
    await openIt();
    fireEvent.mouseDown(screen.getByTestId('rf2-drawer-scrim'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await openIt();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('unsaved-changes guard blocks Escape, backdrop and close when it returns false', async () => {
    const guard = vi.fn(() => false);
    render(<Harness guard={guard} />);
    await openIt();
    await userEvent.keyboard('{Escape}');
    fireEvent.mouseDown(screen.getByTestId('rf2-drawer-scrim'));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(guard).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('locks body scroll while open and restores it', async () => {
    document.body.style.overflow = 'auto';
    render(<Harness />);
    await openIt();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body).toHaveAttribute('data-rf2-scroll-locked');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body).not.toHaveAttribute('data-rf2-scroll-locked');
  });

  it.each([
    ['loading', 'status'],
    ['forbidden', 'alert'],
    ['error', 'alert'],
  ] as const)('%s state replaces the body and hides the footer actions', async (status, role) => {
    render(<Harness status={status} />);
    const dialog = await openIt();
    expect(dialog.querySelector('footer')).toBeNull();
    expect(screen.getByRole(role)).toBeInTheDocument();
    if (status === 'loading') expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await act(async () => { expect(await axeViolations(document.body)).toEqual([]); });
  });
});
