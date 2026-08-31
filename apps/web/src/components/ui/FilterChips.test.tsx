import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterChip } from './FilterChips';

describe('FilterChip', () => {
  it('keeps optional toggle and remove actions as sibling controls', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(<FilterChip label="Stage: Interview" isActive onClick={onClick} onRemove={onRemove} />);

    const toggle = screen.getByRole('button', { name: 'Stage: Interview' });
    const remove = screen.getByRole('button', { name: 'Remove filter' });
    expect(toggle).not.toContainElement(remove);

    await user.click(remove);
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();

    await user.click(toggle);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
