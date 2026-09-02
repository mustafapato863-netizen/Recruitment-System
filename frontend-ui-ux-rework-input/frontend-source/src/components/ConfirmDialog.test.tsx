import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog component', () => {
  it('renders title, description, and action buttons', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Archive Branch"
        description="Are you sure you want to archive this branch location?"
        confirmLabel="Archive"
        cancelLabel="Keep Active"
        tone="danger"
      />
    );

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getAllByRole('heading', { name: 'Archive Branch' })[0]).toBeVisible();
    expect(screen.getByText('Are you sure you want to archive this branch location?')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Keep Active' })).toBeVisible();
  });

  it('calls onConfirm with optional comment when submitted', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Reject Application"
        withComment={true}
        commentLabel="Rejection Reason"
        commentPlaceholder="Explain reason..."
      />
    );

    const textarea = screen.getByPlaceholderText('Explain reason...');
    await userEvent.type(textarea, 'Position filled by another candidate.');
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    await userEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledWith('Position filled by another candidate.');
  });
});
