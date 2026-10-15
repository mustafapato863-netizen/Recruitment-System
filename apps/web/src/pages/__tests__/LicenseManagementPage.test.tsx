import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getApi: vi.fn(), patchApi: vi.fn() }));
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u-recruiter',
      displayName: 'Sara',
      roles: [{ id: 'r', code: 'RECRUITER', name: 'Recruiter' }],
      permissions: ['APPLICATION_VIEW'],
    },
  }),
}));
vi.mock('../PageEnhancementsV2.css', () => ({}));
vi.mock('../../api/client', async () => ({ ...(await vi.importActual<object>('../../api/client')), ...api }));

import { LicenseManagementPage } from '../LicenseManagementPage';

function cairoOffsetIso(dayOffset: number): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month, day] = today.split('-').map(Number);
  return new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, (day ?? 1) + dayOffset, 12, 0, 0)).toISOString();
}

const hiringCases = [{
  id: 'hc-1',
  candidateName: 'Rania Otaibi',
  ownerUserId: 'owner-1',
  complianceRequirements: [
    { id: 'pastlic1-aaaa', type: 'License', name: 'Past licence', isRequired: true, status: 'Verified', expiryDate: cairoOffsetIso(-1), verifiedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'nowlic02-bbbb', type: 'License', name: 'Current licence', isRequired: true, status: 'Verified', expiryDate: cairoOffsetIso(0), verifiedAt: '2026-10-01T00:00:00.000Z' },
  ],
}];

function surfaces(name: string): HTMLElement[] {
  return [...screen.getAllByRole('article'), ...screen.getAllByRole('row')]
    .filter((node) => within(node).queryByText(name));
}

describe('License management expiry', () => {
  beforeEach(() => {
    api.getApi.mockReset();
    api.patchApi.mockReset();
    api.getApi.mockResolvedValue(hiringCases);
  });

  it('shows an expired licence as Expired and leaves it out of the verified total', async () => {
    render(<MemoryRouter><LicenseManagementPage /></MemoryRouter>);

    expect((await screen.findAllByText('Past licence')).length).toBeGreaterThan(0);
    const past = surfaces('Past licence');
    const current = surfaces('Current licence');
    expect(past.length).toBeGreaterThan(0);
    expect(current.length).toBeGreaterThan(0);
    for (const node of past) {
      expect(within(node).getByText('Expired')).toBeInTheDocument();
      expect(within(node).queryByText('Verified')).not.toBeInTheDocument();
    }
    for (const node of current) {
      expect(within(node).getByText('Verified')).toBeInTheDocument();
    }

    const verified = screen.getByText('Verified Licenses').closest('article');
    expect(verified?.querySelector('strong')?.textContent).toBe('1');
    expect(api.patchApi).not.toHaveBeenCalled();
    expect(api.getApi).toHaveBeenCalledWith('/hiring');
  });
});
