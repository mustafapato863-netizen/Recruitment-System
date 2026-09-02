import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('announces the current page and invokes the existing page setter with adjacent pages', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={4} onPageChange={onPageChange} summary="Showing 20 of 64 candidates" />);

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByText('Showing 20 of 64 candidates')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('prevents navigation outside the known page range', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={1} onPageChange={onPageChange} />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByText('Page 1 of 1', { selector: '.rf-pagination__summary' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'page');
  });
});
