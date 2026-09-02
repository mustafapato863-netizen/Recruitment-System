import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

describe('Drawer component', () => {
  it('renders title, subtitle, content, and footer when open', () => {
    render(
      <Drawer
        isOpen={true}
        onClose={vi.fn()}
        title="Candidate Quick Profile"
        subtitle="Application Ref-4092"
        footer={<button type="button">Save Notes</button>}
      >
        <div>Candidate Evaluation Body</div>
      </Drawer>
    );

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('Candidate Quick Profile')).toBeVisible();
    expect(screen.getByText('Application Ref-4092')).toBeVisible();
    expect(screen.getByText('Candidate Evaluation Body')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Notes' })).toBeVisible();
  });

  it('does not render when isOpen is false', () => {
    render(
      <Drawer isOpen={false} onClose={vi.fn()} title="Hidden Drawer">
        <div>Hidden Content</div>
      </Drawer>
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('calls onClose when close button is clicked or Escape key is pressed', async () => {
    const onClose = vi.fn();
    render(
      <Drawer isOpen={true} onClose={onClose} title="Candidate Profile">
        <div>Body Content</div>
      </Drawer>
    );

    const closeBtn = screen.getByRole('button', { name: 'Close drawer' });
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
