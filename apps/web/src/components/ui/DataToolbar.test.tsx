import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataToolbar } from './DataToolbar';

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
});
