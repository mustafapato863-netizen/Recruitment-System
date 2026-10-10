import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
import { JobStatusDrawer } from '../../drawers/JobStatusDrawer';

describe('job history renders the server reason as-is (no client prefix)', () => {
  it('a requisition-cancel close shows exactly the server text', async () => {
    api.getApi.mockImplementation(async (p: string) => (p.endsWith('/status-history')
      ? [{ id: 'h1', fromStatus: 'Open', toStatus: 'Closed', reason: 'Budget cut', changedById: 'u1', createdAt: '2026-10-10T08:00:00Z' }]
      : []));
    render(<MemoryRouter><JobStatusDrawer job={{ id: 'v1', vacancyCode: 'VAC-1', status: 'Closed', title: 'HRIS Developer', approvedHeadcount: 1, joinedHeadcount: 0, targetStartDate: null }} onClose={() => {}} onDone={() => {}} /></MemoryRouter>);
    expect(await screen.findByText(/Budget cut/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Requisition cancelled:/);
  });
});
