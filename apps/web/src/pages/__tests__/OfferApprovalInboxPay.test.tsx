import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn() }));
vi.mock('../../api/client', async () => ({ ...(await vi.importActual<object>('../../api/client')), ...api }));
vi.mock('../../hooks/useFeedback', () => ({ useFeedback: () => ({ showSuccess: vi.fn(), showError: vi.fn(), notify: vi.fn() }) }));
import { OfferApprovalInboxPage } from '../OfferApprovalInboxPage';

const row = { id: 'a1', offerId: 'o1', offerVersionId: 'v1', offerCode: 'OFF-1', candidateName: 'Lina', positionTitle: 'HRIS', branchName: 'HO', versionNumber: 1, roleCode: 'HR', status: 'Pending', step: 1 };

describe('#23 monthlyPackage is omitted without OFFER_PAY_VIEW', () => {
  it('a missing monthlyPackage reads as Restricted, never as zero or a dash', async () => {
    api.getApi.mockResolvedValue([row]);
    render(<MemoryRouter><OfferApprovalInboxPage /></MemoryRouter>);
    expect((await screen.findAllByText('Restricted')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/AED 0\b/)).toBeNull();
  });
});
