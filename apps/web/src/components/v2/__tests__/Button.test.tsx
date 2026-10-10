import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Plus } from 'lucide-react';
import { ButtonV2, DangerConfirmButton } from '..';
import type { ButtonV2Kind } from '..';
import { axeViolations } from './axe';

const kinds: ButtonV2Kind[] = ['primary', 'secondary', 'tertiary', 'danger', 'danger-outline'];

describe('ButtonV2', () => {
  it.each(kinds)('renders kind %s with icon, class and no axe violations', async (kind) => {
    const { container } = render(<ButtonV2 kind={kind} icon={<Plus />}>Save</ButtonV2>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toHaveClass('rf2-btn', `rf2-btn--${kind}`, 'rf2-btn--md');
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn.querySelector('svg')).not.toBeNull();
    expect(btn.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('sizes map to classes', () => {
    render(<><ButtonV2 size="sm">S</ButtonV2><ButtonV2 size="lg">L</ButtonV2></>);
    expect(screen.getByRole('button', { name: 'S' })).toHaveClass('rf2-btn--sm');
    expect(screen.getByRole('button', { name: 'L' })).toHaveClass('rf2-btn--lg');
  });

  it('is keyboard operable and focusable', async () => {
    const onClick = vi.fn();
    render(<ButtonV2 onClick={onClick}>Go</ButtonV2>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Go' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('disabled state blocks clicks', async () => {
    const onClick = vi.fn();
    render(<ButtonV2 disabled onClick={onClick}>No</ButtonV2>);
    const btn = screen.getByRole('button', { name: 'No' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading state: aria-busy, disabled, announced label, spinner', async () => {
    const { container } = render(<ButtonV2 loading loadingLabel="Saving note">Save</ButtonV2>);
    const btn = screen.getByRole('button', { name: /Save/ });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saving note');
    expect(btn.querySelector('.rf2-spin')).not.toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('selected state uses aria-pressed', () => {
    render(<><ButtonV2 selected>Today</ButtonV2><ButtonV2 selected={false}>Tomorrow</ButtonV2><ButtonV2>Plain</ButtonV2></>);
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tomorrow' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Plain' })).not.toHaveAttribute('aria-pressed');
  });
});

describe('DangerConfirmButton', () => {
  it('is outlined until confirmed, then filled; second click confirms', async () => {
    const onConfirm = vi.fn();
    render(<DangerConfirmButton confirmLabel="Confirm reject" onConfirm={onConfirm}>Reject</DangerConfirmButton>);
    const btn = screen.getByRole('button', { name: 'Reject' });
    expect(btn).toHaveClass('rf2-btn--danger-outline');
    await userEvent.click(btn);
    expect(btn).toHaveClass('rf2-btn--danger');
    expect(btn).toHaveTextContent('Confirm reject');
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(btn).toHaveClass('rf2-btn--danger-outline');
  });

  it('Escape disarms', async () => {
    const onConfirm = vi.fn();
    render(<DangerConfirmButton confirmLabel="Confirm" onConfirm={onConfirm}>Delete</DangerConfirmButton>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    await userEvent.click(btn);
    await userEvent.keyboard('{Escape}');
    expect(btn).toHaveTextContent('Delete');
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
