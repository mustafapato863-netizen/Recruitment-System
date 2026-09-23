import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataToolbar } from './DataToolbar';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DataToolbar component', () => {
  it('renders search, filters, actions, and active filter slots', () => {
    render(
      <DataToolbar
        search={<input placeholder="Search records..." />}
        filters={<select aria-label="Department"><option>All</option></select>}
        actions={<button type="button">Export XLSX</button>}
        activeFilters={<div>Active: 2 applied</div>}
      >
        <span>Extra Toolbar Item</span>
      </DataToolbar>
    );

    expect(screen.getByPlaceholderText('Search records...')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Department' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Export XLSX' })).toBeVisible();
    expect(screen.getByText('Active: 2 applied')).toBeVisible();
    expect(screen.getByText('Extra Toolbar Item')).toBeVisible();
  });

  it('collapses filters into a bottom sheet below md and announces the active count', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('767'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));
    const user = userEvent.setup();
    render(
      <DataToolbar
        search={<input placeholder="Search records..." />}
        filters={<select aria-label="Department"><option>All</option></select>}
        activeFilterCount={2}
      />,
    );

    const filters = await screen.findByRole('button', { name: 'Filters, 2 active' });
    expect(filters).toHaveAttribute('aria-expanded', 'false');
    expect(filters).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Department' })).not.toBeInTheDocument();
    await user.click(filters);
    expect(screen.getByRole('dialog')).toHaveClass('is-sheet');
    expect(screen.getByRole('combobox', { name: 'Department' })).toBeVisible();
  });
});
