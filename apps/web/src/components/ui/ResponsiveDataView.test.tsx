import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResponsiveDataView, type ResponsiveDataColumn } from './ResponsiveDataView';

interface Row { id: string; name: string; status: string }

const columns: ResponsiveDataColumn<Row>[] = [
  { key: 'name', header: 'Name', priority: 'primary', render: (row) => row.name },
  { key: 'status', header: 'Status', priority: 'secondary', render: (row) => row.status },
];

describe('ResponsiveDataView', () => {
  it('renders mobile cards and a semantic desktop table from the same typed rows', async () => {
    const onRowClick = vi.fn();
    const user = userEvent.setup();
    render(<ResponsiveDataView rows={[{ id: '1', name: 'Sara Ahmed', status: 'Active' }]} columns={columns} rowKey={(row) => row.id} label="Candidates" onRowClick={onRowClick} />);
    expect(screen.getByRole('list', { name: 'Candidates' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sara ahmed/i }));
    expect(onRowClick).toHaveBeenCalledTimes(1);

    const desktopRow = screen.getByRole('row', { name: /sara ahmed active/i });
    expect(desktopRow).toHaveAttribute('tabindex', '0');
    desktopRow.focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('renders an empty state outside table markup', () => {
    render(<ResponsiveDataView rows={[]} columns={columns} rowKey={(row) => row.id} label="Candidates" emptyState={<div>No records</div>} />);
    expect(screen.getByText('No records')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
