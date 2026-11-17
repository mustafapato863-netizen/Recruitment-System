import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const OMAR = ['VACANCY_VIEW', 'LICENSE_CHECK', 'DOWNLOAD_DOCUMENTS', 'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS'];
const auth = vi.hoisted(() => ({ perms: [] as string[] }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-omar', displayName: 'Omar', roles: [{ id: 'r', code: 'LICENSE_SPECIALIST', name: 'LS' }], permissions: auth.perms } }) }));
vi.mock('../../context/BreadcrumbContext', () => ({ useSetBreadcrumbTitle: vi.fn() }));
vi.mock('../PageEnhancementsV2.css', () => ({}));
const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn() }));
vi.mock('../../api/client', async () => ({ ...(await vi.importActual<object>('../../api/client')), ...api }));
import { ApiError } from '../../api/client';
import { HiringCasePage } from '../HiringCasePage';
import { LicenseManagementPage } from '../LicenseManagementPage';
import { isLicenseCheckOnly, LICENSE_SCOPE_TEXT } from '../../utils/licenseCheck';

const hc = {
  id: 'hc1', applicationId: 'a1', candidateName: 'Rania', positionTitle: 'Nurse', status: 'Pending Compliance', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', approvals: [], offerId: 'o1',
  complianceRequirements: [
    { id: 'lic1', type: 'License', name: 'Nursing license', isRequired: true, status: 'Pending', verifiedAt: null },
    { id: 'doc1', type: 'Document', name: 'Passport copy', isRequired: true, status: 'Pending', verifiedAt: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getApi.mockImplementation(async (url: string) => (url === '/hiring' ? [hc] : hc));
});

describe('#34 LICENSE_CHECK-only (Omar)', () => {
  it('isLicenseCheckOnly: LICENSE_CHECK without CANDIDATE_EDIT; never for admins', () => {
    expect(isLicenseCheckOnly(OMAR)).toBe(true);
    expect(isLicenseCheckOnly([...OMAR, 'CANDIDATE_EDIT'])).toBe(false);
    expect(isLicenseCheckOnly(OMAR, true)).toBe(false);
  });

  it('licences page lists licence items only', async () => {
    auth.perms = OMAR;
    render(<MemoryRouter><LicenseManagementPage /></MemoryRouter>);
    expect((await screen.findAllByText('Nursing license')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Passport copy')).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Review case' }).every((link) => link.getAttribute('href') === '/applications/a1?drawer=prehire')).toBe(true);
  });

  it('opens the permitted case when a licence-only response omits application identity', async () => {
    auth.perms = OMAR;
    const { applicationId: _applicationId, ...narrowCase } = hc;
    api.getApi.mockResolvedValue([narrowCase]);
    render(<MemoryRouter><LicenseManagementPage /></MemoryRouter>);
    expect((await screen.findAllByText('Nursing license')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Review case' }).every((link) => link.getAttribute('href') === '/hires/hc1')).toBe(true);
  });

  it('hiring case: only licence items, no submit/approve/joining; the file opens on the pre-hire drawer', async () => {
    auth.perms = OMAR;
    api.patchApi.mockRejectedValueOnce(new ApiError(403, 'LICENSE_CHECK only covers license requirements.', { code: 'LICENSE_CHECK_SCOPE' }, { code: 'LICENSE_CHECK_SCOPE' }));
    render(<MemoryRouter initialEntries={['/hires/hc1']}><Routes><Route path="/hires/:id" element={<HiringCasePage />} /></Routes></MemoryRouter>);
    expect((await screen.findAllByText('Nursing license')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Passport copy')).toBeNull();
    expect(screen.queryByRole('button', { name: /Submit approval/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Confirm Joining/ })).toBeNull();
    expect(screen.queryByText('Invalid Date')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Application' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open pre-hire file' })).toHaveAttribute('href', '/applications/a1?drawer=prehire');
    const toggle = screen.getAllByRole('checkbox')[0] ?? screen.getAllByRole('button', { name: /Nursing license|verify|mark/i })[0];
    await userEvent.click(toggle);
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/hiring/hc1/compliance/lic1', { status: 'Verified' }));
    expect(await screen.findByText(LICENSE_SCOPE_TEXT)).toBeInTheDocument();
  });

  it('staff with CANDIDATE_EDIT keep every item and the case actions', async () => {
    auth.perms = ['APPLICATION_VIEW', 'CANDIDATE_EDIT', 'LICENSE_CHECK'];
    render(<MemoryRouter initialEntries={['/hires/hc1']}><Routes><Route path="/hires/:id" element={<HiringCasePage />} /></Routes></MemoryRouter>);
    expect((await screen.findAllByText('Passport copy')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Application' })).toHaveAttribute('href', '/applications/a1');
  });
});
