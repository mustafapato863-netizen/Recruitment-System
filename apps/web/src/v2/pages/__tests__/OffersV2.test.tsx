import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Offer } from '@recruitflow/contracts';
import { getApi } from '../../../api/client';
import { OffersV2 } from '../OffersV2';

vi.mock('../../../api/client', () => ({ getApi: vi.fn() }));
const getOffers = vi.mocked(getApi);

const rows: Offer[] = [
  {
    id: 'offer-1', organizationId: 'org-1', applicationId: 'app-1',
    vacancyId: 'vac-1', offerCode: 'OFF-001', status: 'Pending Approval',
    candidateName: 'Nora Candidate', positionTitle: 'Registered Nurse',
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z',
  },
  {
    id: 'offer-2', organizationId: 'org-1', applicationId: 'app-2',
    vacancyId: 'vac-2', offerCode: 'OFF-002', status: 'Accepted',
    candidateName: 'Adam Candidate', positionTitle: 'Software Engineer',
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-11-15T00:00:00Z',
  },
];

function show(path = '/offers') {
  return render(<MemoryRouter initialEntries={[path]}><OffersV2 /></MemoryRouter>);
}

describe('OffersV2', () => {
  beforeEach(() => { getOffers.mockReset(); });

  it('loads persisted offers without exposing compensation and keeps offer-to-file deep links', async () => {
    getOffers.mockResolvedValue({ data: rows });
    show();
    expect(await screen.findByRole('link', { name: 'OFF-001' })).toHaveAttribute('href', '/offers/offer-1');
    expect(screen.getByRole('link', { name: 'OFF-002' })).toHaveAttribute('href', '/offers/offer-2');
    expect(within(screen.getByRole('table', { name: 'Offers' })).getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByText('99999')).not.toBeInTheDocument();
    expect(getOffers).toHaveBeenCalledExactlyOnceWith('/offers');
  });

  it('filters by status, search and vacancy from the URL', async () => {
    const user = userEvent.setup();
    getOffers.mockResolvedValue(rows);
    show('/offers?vacancyId=vac-1');
    expect(await screen.findByRole('link', { name: 'OFF-001' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'OFF-002' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Accepted/ }));
    expect(screen.getByText('No offers found')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /All offers/ }));
    expect(screen.getByRole('link', { name: 'OFF-001' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search offers' }), 'missing');
    expect(screen.getByText('No offers found')).toBeInTheDocument();
  });

  it('fails visibly and offers a retry rather than silently showing an empty list', async () => {
    const user = userEvent.setup();
    getOffers.mockRejectedValueOnce(new Error('Offers service unavailable')).mockResolvedValueOnce(rows);
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Offers service unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'OFF-001' })).toBeInTheDocument());
  });
});
