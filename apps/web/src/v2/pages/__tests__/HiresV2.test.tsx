import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApi } from '../../../api/client';
import { HiresV2 } from '../HiresV2';

vi.mock('../../../api/client', () => ({ getApi: vi.fn() }));
const fetchHires = vi.mocked(getApi);
const cases = [
  { id: 'h1', candidateName: 'Nora Ali', positionTitle: 'ICU Nurse', branchName: 'Main Site', plannedJoiningDate: null, status: 'Pending Final Approval' },
  { id: 'h2', candidateName: 'Adam Selim', positionTitle: 'Developer', branchName: 'Giza Site', plannedJoiningDate: '2026-12-01T00:00:00Z', status: 'Awaiting Joining' },
];
const show = (path = '/hires') => render(<MemoryRouter initialEntries={[path]}><HiresV2 /></MemoryRouter>);

describe('HiresV2', () => {
  beforeEach(() => fetchHires.mockReset());

  it('lists every hiring status and preserves deep links to the existing authorized case actions', async () => {
    fetchHires.mockResolvedValue(cases);
    show();
    const table = await screen.findByRole('table', { name: 'Hiring cases' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Review approval' })).toHaveAttribute('href', '/hires/h1');
    expect(screen.getByRole('link', { name: 'Confirm joining' })).toHaveAttribute('href', '/hires/h2#checklist');
    expect(fetchHires).toHaveBeenCalledExactlyOnceWith('/hiring');
  });

  it('filters status using URL query and never invents joined candidates', async () => {
    const user = userEvent.setup();
    fetchHires.mockResolvedValue(cases);
    show('/hires?status=Joined');
    expect(await screen.findByText('No hiring cases found')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /All cases/ }));
    expect(screen.getByText('Nora Ali')).toBeInTheDocument();
    expect(screen.getByText('Adam Selim')).toBeInTheDocument();
  });

  it('keeps API failures explicit and recovers with retry', async () => {
    const user = userEvent.setup();
    fetchHires.mockRejectedValueOnce(new Error('Hiring data unavailable')).mockResolvedValueOnce(cases);
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Hiring data unavailable');
    expect(screen.queryByText('No hiring cases found')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Review approval' })).toBeInTheDocument());
  });
});
