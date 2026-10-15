import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getApi: vi.fn() }));
vi.mock('../PageEnhancementsV2.css', () => ({}));
vi.mock('../../api/client', async () => ({ ...(await vi.importActual<object>('../../api/client')), ...api }));

import { JoiningManagementPage } from '../JoiningManagementPage';

const rows = [
  {
    id: '61db6a86-3e02-42f6-a672-0541850992d9',
    candidateName: 'Phase5 ExpiredLicence',
    positionTitle: 'Nurse',
    branchName: 'Riyadh',
    plannedJoiningDate: null,
    status: 'Awaiting Joining',
    ownerUserId: null,
    approvedHeadcount: 2,
    joinedHeadcount: 1,
    complianceRequirements: [
      { id: 'lic-1', type: 'License', name: 'SCFHS licence', isRequired: true, status: 'Verified', expiryDate: '2026-01-01T00:00:00.000Z' },
    ],
  },
  {
    id: 'clear-joining-1',
    candidateName: 'Clear Joiner',
    positionTitle: 'Analyst',
    branchName: 'Jeddah',
    plannedJoiningDate: null,
    status: 'Awaiting Joining',
    ownerUserId: null,
    approvedHeadcount: 2,
    joinedHeadcount: 1,
    complianceRequirements: [
      { id: 'doc-1', type: 'Document', name: 'National ID', isRequired: true, status: 'Verified', expiryDate: null },
    ],
  },
];

function surfaces(name: string): HTMLElement[] {
  return [...screen.getAllByRole('article'), ...screen.getAllByRole('row')]
    .filter((node) => within(node).queryByText(name));
}

describe('Joining list blockers', () => {
  beforeEach(() => {
    api.getApi.mockReset();
    api.getApi.mockResolvedValue(rows);
  });

  it('withholds Confirm joining when a required licence is expired and keeps it for a clear row', async () => {
    render(<MemoryRouter><JoiningManagementPage /></MemoryRouter>);

    expect((await screen.findAllByText('Phase5 ExpiredLicence')).length).toBeGreaterThan(0);
    const expired = surfaces('Phase5 ExpiredLicence');
    const clear = surfaces('Clear Joiner');
    expect(expired.length).toBeGreaterThan(0);
    expect(clear.length).toBeGreaterThan(0);

    for (const node of expired) {
      expect(within(node).getByText('The required licence is expired.')).toBeInTheDocument();
      expect(within(node).queryByRole('link', { name: 'Confirm joining' })).not.toBeInTheDocument();
    }
    for (const node of clear) {
      expect(within(node).getByRole('link', { name: 'Confirm joining' })).toHaveAttribute('href', '/hires/clear-joining-1#checklist');
      expect(within(node).queryByText('The required licence is expired.')).not.toBeInTheDocument();
    }
  });
});
