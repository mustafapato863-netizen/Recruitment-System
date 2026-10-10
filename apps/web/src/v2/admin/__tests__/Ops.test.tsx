import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import * as ufx from '../__fixtures__';

const api = vi.hoisted(() => ({ getApi: vi.fn(), patchApi: vi.fn(), postApi: vi.fn(), deleteApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'admin' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../../../pages/ReportsPage', () => ({ ReportsPage: () => <p>v1 reports</p> }));
vi.mock('../../../pages/AuditLogPage', () => ({ AuditLogPage: () => <p>v1 audit</p> }));
import { ReportsRoute } from '../../pages/ReportsRoute';
import { AuditRoute, IntegrationsRoute } from '../AdminRoutes';
import { AuditV2 } from '../AuditV2';
import { auditArea, namedAuditText, overrideError, toCsv } from '../opsApi';
import { cairoMonth } from '../../api/myResult';

const M = cairoMonth();
const q = (id: string, title: string, site: string, owner: string, status: string, filled: number, target: number, due: string, counts: Record<string, number>) =>
  ({ id, code: id, title, branch: { id: site, name: site }, status, owner: { id: owner, displayName: owner }, headcount: { approved: target, joined: filled, remaining: target - filled }, pipelineCounts: counts, needsActionCount: 0, health: null, lastActivity: null, nextAction: null, dueDate: due, salaryMax: 99999 });
const jobs = [
  q('v1', 'HRIS Developer', 'Offshore Cairo', 'Mariam Farag', 'Open', 1, 3, '2026-10-19', { Applied: 4, Screening: 3, Interview: 2, Offer: 1, Joined: 1 }),
  q('v2', 'Medical Coder', 'SGH Riyadh', 'Mariam Farag', 'On Hold', 1, 2, '2026-10-25', { Applied: 6 }),
  q('v3', 'Old job', 'SGH Riyadh', 'Mariam Farag', 'Closed', 2, 2, '2026-09-01', {}),
  { id: 'v4', redacted: true, title: 'Redacted job', site: { id: 'x', name: 'SGH Jeddah' }, seats: { filled: 0, target: 1 } },
];
const tile = (value: number, of: number, sampleSize: number, tooFewToJudge: boolean) => ({ value, of, sampleSize, detail: '', tooFewToJudge });
const res = (n: number, few: boolean) => ({ scope: 'org', month: M, range: { from: '', to: '' }, filters: { vacancyId: null, managerId: null }, people: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
  tiles: { seats: tile(4, 8, 3, false), overdueFollowUps: tile(3, 24, 24, false), screensReachedInterview: tile(5, 10, 10, false), offersAccepted: tile(3, 5, few ? 4 : 5, few) } });
const audit = [
  { id: 'a1', actorUserId: 'u-karim', actorDisplayName: 'Karim Hassan', action: 'OFFER_DECISION', entityType: 'Offer', entityId: 'o1-aaaaaaaa', result: 'Success', reason: 'Approved v2', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'a2', actorUserId: 'u-omar', actorDisplayName: 'Omar Khalil', action: 'ADMIN_OVERRIDE', entityType: 'Vacancy', entityId: 'v2-bbbbbbbb', result: 'Success', reason: 'Hiring manager on leave', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'a3', actorUserId: 'u-mariam', actorDisplayName: 'Mariam Farag', action: 'APPLICATION_STAGE_MOVE', entityType: 'Application', entityId: 'ap-cccccccc', result: 'Success', reason: null, createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
];
let paths: Record<string, unknown> = {};
const serve = (extra: Record<string, unknown> = {}) => {
  paths = {
    '/vacancies/work-queue?page=1&pageSize=100': { data: jobs }, '/users?page=1&pageSize=100': ufx.users,
    '/offers?status=Pending+Approval&page=1&pageSize=100': { data: [{ id: 'o1', status: 'Pending Approval', candidateName: 'Lina Hassan', positionTitle: 'HRIS Developer', approvers: [{ id: null, name: 'OFFER_APPROVER' }, { id: 'u-karim', name: 'Karim Hassan' }], versions: [{ id: 'ov1', versionNumber: 1, createdAt: new Date(Date.now() - 86400000).toISOString(), baseSalary: 62000 }] }] },
    [`/results/org?month=${M}&managerId=u-hala`]: res(2, true), [`/results/org?month=${M}&managerId=u-karim`]: res(3, false),
    '/audit-logs?page=1&pageSize=100': { data: audit, total: 3 },
    '/integrations': [{ id: 'i1', name: 'Careers site publishing', provider: 'careers_site', category: 'Publishing', status: 'Connected', lastSyncAt: '2026-10-09T05:45:00.000Z' }, { id: 'i2', name: 'Email Provider', provider: 'smtp', category: 'Communication', status: 'Available', lastSyncAt: null }, { id: 'i3', name: 'Calendar', provider: 'google_calendar', category: 'x', status: 'Connected' }],
    ...extra,
  };
  api.getApi.mockImplementation(async (p: string) => {
    if (p.startsWith('/reports/overview')) { const v = paths['/reports/overview']; if (v instanceof Error) throw v; return v ?? { funnel: [{ name: 'Applied', count: 10, percent: 100 }, { name: 'Screening', count: 6, percent: 60 }, { name: 'Pre-Hire', count: 1, percent: 10 }] }; }
    const v = paths[p]; if (v instanceof Error) throw v; if (v === undefined) throw new ApiError(404, `no ${p}`); return v;
  });
};
const renderAt = (path: string) => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Suspense fallback="…"><Routes>
    <Route path="/reports" element={<ReportsRoute />} /><Route path="/audit-log" element={<AuditRoute />} /><Route path="/integrations" element={<IntegrationsRoute v1={<p>v1 integrations</p>} />} />
  </Routes></Suspense></MemoryRouter>);
};
beforeEach(() => { vi.clearAllMocks(); shell.value = { seat: 'admin' }; serve(); });

describe('A08 Reports (Admin)', () => {
  it('open jobs (closed hidden, redacted kept), stage counts, offers waiting (no pay), hiring report by team; axe', async () => {
    const { container } = renderAt('/reports');
    const oj = await screen.findByRole('table', { name: 'Open jobs' });
    const rows = within(oj).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('.rf2-jtable__name')!.textContent)).toEqual(['HRIS Developer', 'Medical Coder', 'Redacted job']);
    expect(rows[0]).toHaveTextContent(/Offshore Cairo.*Mariam Farag.*1 of 3.*19 Oct 2026.*10.*Open/);
    expect(within(rows[2]).queryByRole('button', { name: /Override/ })).toBeNull();
    expect(screen.getByRole('list', { name: 'Files by stage' })).toHaveTextContent(/Applied10.*Screening6.*Pre-hire1/);
    expect(screen.getByText(/Time in stage \(median days\) needs a backend field/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Offers waiting' })).toHaveTextContent(/Lina Hassan · HRIS Developer.*Offer v1.*Waiting on Karim Hassan · 1 day/); // approver named, role code skipped
    expect(api.getApi.mock.calls.map((c) => String(c[0])).filter((p) => /pageSize=\d/.test(p)).every((p) => Number(/pageSize=(\d+)/.exec(p)![1]) <= 100)).toBe(true); // B2-22
    const tr = screen.getByRole('table', { name: 'Hiring report by team' });
    expect(within(tr).getAllByRole('row')).toHaveLength(3);
    expect(within(tr).getByRole('row', { name: /Talent/ })).toHaveTextContent(/Hala Mostafa’s 2 direct reports.*Too few to judge.*4 of 8.*3.*5 of 10.*3 of 5/);
    expect(within(tr).getByRole('row', { name: /^IT/ })).not.toHaveTextContent('Too few');
    expect(container).not.toHaveTextContent(/62,?000|99,?999|salary/i);
    expect(screen.getByText(/No previous period/)).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
  it('site filter narrows open jobs; employee seat keeps v1', async () => {
    const u = userEvent.setup();
    renderAt('/reports');
    await screen.findByRole('table', { name: 'Open jobs' });
    await u.selectOptions(screen.getByLabelText('Site filter'), 'SGH Riyadh');
    expect(within(screen.getByRole('table', { name: 'Open jobs' })).getAllByRole('row')).toHaveLength(2);
  });
  it('/results/org missing → says so (no fake rows)', async () => {
    serve({ [`/results/org?month=${M}&managerId=u-hala`]: new ApiError(404, 'x'), [`/results/org?month=${M}&managerId=u-karim`]: new ApiError(404, 'x') });
    renderAt('/reports');
    expect(await screen.findByText('Monthly results (/results/org) are not on this server yet.')).toBeInTheDocument();
  });
});

describe('A5 Admin override', () => {
  it('CoS: with the B3 lists, hold sends the list reason and holdUntil; Other needs a note', async () => {
    const u = userEvent.setup();
    serve({ '/master-data/catalog/hold-reasons': [{ name: 'Budget freeze', status: 'Active' }, { name: 'Other', status: 'Active' }, { name: 'Old', status: 'Inactive' }] });
    api.postApi.mockResolvedValue({ action: 'job.hold', entityId: 'v1', from: 'Open', to: 'On Hold' });
    renderAt('/reports?override=v1');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: 'Put on hold' }));
    const pick = await within(d).findByLabelText(/^Hold reason/);
    expect(within(pick).queryByRole('option', { name: 'Old' })).toBeNull();
    await u.type(within(d).getByLabelText(/^Why you are overriding/), 'Owner on sick leave');
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    expect(within(d).getByText('Pick a reason from the list.')).toBeInTheDocument();
    await u.selectOptions(pick, 'Other');
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    expect(within(d).getByText('Say what the other reason is.')).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/^Other reason/), 'Site audit');
    await u.type(within(d).getByLabelText(/^Hold until/), '2099-01-15');
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/admin/overrides', { action: 'job.hold', entityId: 'v1', reason: 'Owner on sick leave', statusReason: 'Other', statusNote: 'Site audit', holdUntil: '2099-01-15' }));
  });
  it('hold an Open job: actions by status, reason ≥ 10, POST /admin/overrides; audited note', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ action: 'job.hold', entityId: 'v1', from: 'Open', to: 'On Hold', reason: 'Owner on sick leave' });
    renderAt('/reports');
    await u.click(await screen.findByRole('button', { name: 'Override HRIS Developer' }));
    const d = screen.getByRole('dialog', { name: 'HRIS Developer' });
    expect(within(d).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['job.hold', 'job.close']);
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    expect(within(d).getByText('Pick what to do.')).toBeInTheDocument();
    await u.click(within(d).getByRole('radio', { name: 'Put on hold' }));
    await u.type(within(d).getByLabelText(/^Why you are overriding/), 'too short');
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    expect(within(d).getByText('An override needs a reason (at least 10 characters).')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.clear(within(d).getByLabelText(/^Why you are overriding/)); await u.type(within(d).getByLabelText(/^Why you are overriding/), 'Owner on sick leave');
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/admin/overrides', { action: 'job.hold', entityId: 'v1', reason: 'Owner on sick leave' }));
    expect(await screen.findByRole('status')).toHaveTextContent('HRIS Developer: Open → On Hold. Logged in Audit as an admin override.');
  });
  it('On Hold offers reopen/close; server OVERRIDE_NOT_ALLOWED and REASON_REQUIRED codes shown', async () => {
    const u = userEvent.setup();
    api.postApi.mockRejectedValueOnce(new ApiError(409, 'job.reopen is not allowed from Closed.', { code: 'OVERRIDE_NOT_ALLOWED' }, { code: 'OVERRIDE_NOT_ALLOWED' }))
      .mockRejectedValueOnce(new ApiError(400, 'x', { code: 'OVERRIDE_REASON_REQUIRED' }, { code: 'OVERRIDE_REASON_REQUIRED' }));
    renderAt('/reports?override=v2');
    const d = await screen.findByRole('dialog', { name: 'Medical Coder' });
    expect(within(d).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['job.reopen', 'job.close']);
    await u.click(within(d).getByRole('radio', { name: 'Reopen' }));
    await u.type(within(d).getByLabelText(/^Why you are overriding/), 'Manager is back from leave');
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    expect(await within(d).findByText('job.reopen is not allowed from Closed.')).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    expect(await within(d).findByText('An override needs a reason (at least 10 characters).')).toBeInTheDocument();
  });
});

describe('A09 Audit', () => {
  it('read-only log, newest first, last 7 days by default; who/area filters; areas; axe', async () => {
    const u = userEvent.setup();
    const { container } = renderAt('/audit-log');
    const table = () => screen.findByRole('table', { name: 'Audit log' });
    let t = await table();
    let rows = within(t).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/Karim Hassan.*Offer.*Offer decision — Approved v2.*Offer · o1-aaaaa/);
    expect(rows[1]).toHaveTextContent(/Omar Khalil.*Override.*Admin override — Hiring manager on leave/);
    expect(screen.getByText('2 entries')).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Period'), 'all');
    t = await table();
    expect(within(t).getAllByRole('row')).toHaveLength(4);
    await u.selectOptions(screen.getByLabelText('Area'), 'File');
    rows = within(t).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    await u.selectOptions(screen.getByLabelText('Area'), 'all');
    await u.selectOptions(screen.getByLabelText('Who'), 'u-omar');
    t = await table();
    expect(within(t).getAllByRole('row')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /delete|edit/i })).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });
  it('CoS: server-side filters and paging via GET /audit when present (pageSize 100)', async () => {
    const u = userEvent.setup();
    const calls: string[] = [];
    api.getApi.mockImplementation(async (p: string) => {
      calls.push(p);
      if (p.startsWith('/audit?')) {
        const q = new URLSearchParams(p.split('?')[1]);
        const page = Number(q.get('page'));
        const rows = q.get('actor') === 'u-omar' ? [audit[1]] : page === 1 ? audit.slice(0, 2) : [audit[2]];
        return { data: rows, total: q.get('actor') ? 1 : 150 };
      }
      throw new ApiError(404, 'no');
    });
    render(<MemoryRouter><AuditV2 /></MemoryRouter>);
    expect(await screen.findByText(/page 1 of 2 \(150 in total\)/)).toBeInTheDocument();
    expect(calls.find((c) => c.startsWith('/audit'))).toMatch(/^\/audit\?page=1&pageSize=100&from=\d{4}-\d{2}-\d{2}$/);
    await u.click(screen.getByRole('button', { name: 'Older' }));
    expect(await screen.findByText(/page 2 of 2/)).toBeInTheDocument();
    expect(calls.at(-1)).toMatch(/page=2&pageSize=100/);
    await u.selectOptions(screen.getByLabelText('Who'), 'u-omar');
    await waitFor(() => expect(calls.at(-1)).toMatch(/page=1&pageSize=100&from=.*&actor=u-omar/));
    expect(calls.every((c) => !/pageSize=(\d{3,})/.test(c) || Number(/pageSize=(\d+)/.exec(c)![1]) <= 100)).toBe(true);
  });
  it('B2F-12: user ids in audit text show as names (FILE_REASSIGN "<from> -> <to>: reason")', async () => {
    const a = '9c5d717d-2b38-4ad2-a423-8531564e4ce2'; const b = '1b96bd13-61bf-4581-ad17-56136e15f850';
    api.getApi.mockImplementation(async (p: string) => {
      if (p.startsWith('/users')) return { data: [{ id: a, displayName: 'Mariam Farag', email: 'm@x', status: 'Active', managerId: null, roles: [] }, { id: b, displayName: 'Youssef Ibrahim', email: 'y@x', status: 'Active', managerId: null, roles: [] }], total: 2 };
      if (p.startsWith('/audit?')) return { data: [{ id: 'z1', actorUserId: 'u-karim', actorDisplayName: 'Karim Hassan', action: 'FILE_REASSIGN', entityType: 'Application', entityId: 'edc827c3-4007', result: 'SUCCESS', reason: `${a} -> ${b}: Owner leaving`, createdAt: new Date().toISOString() }], total: 1 };
      throw new ApiError(404, 'no');
    });
    render(<MemoryRouter><AuditV2 /></MemoryRouter>);
    expect(await screen.findByText(/File reassign — Mariam Farag → Youssef Ibrahim: Owner leaving/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(a);
    expect(namedAuditText(`${a} -> ffffffff-2b38-4ad2-a423-8531564e4ce2: x`, new Map([[a, 'Mariam Farag']]))).toBe('Mariam Farag → ffffffff…: x');
  });
  it('B2F-4: an override 403 (owner check) shows the server’s reason, not "Only an administrator"', () => {
    const t = overrideError(new ApiError(403, 'Access denied: you do not have permission to perform this action.', { code: 'FORBIDDEN', message: 'Only the job owner or their manager can change job status.' }, { code: 'FORBIDDEN' })).text;
    expect(t).toMatch(/Only the job owner or their manager can change job status/);
    expect(t).not.toMatch(/Only an administrator/);
  });
  it('helpers: area mapping and CSV escaping (formula-safe)', () => {
    expect(auditArea({ entityType: 'User', action: 'USER_UPDATE' })).toBe('Users');
    expect(auditArea({ entityType: 'MasterDataValue', action: 'MASTER_DATA_BATCH_SAVE' })).toBe('Settings');
    expect(toCsv(['a', 'b'], [['x,y', '=SUM(1)'], ['he said "hi"', null]])).toBe('a,b\r\n"x,y","\'=SUM(1)"\r\n"he said ""hi""",');
  });
  it('non-admin keeps v1 audit; error state retries', async () => {
    shell.value = { seat: 'manager' };
    renderAt('/audit-log');
    expect(await screen.findByText('v1 audit')).toBeInTheDocument();
  });
  it('error → Try again', async () => {
    const u = userEvent.setup();
    serve({ '/audit-logs?page=1&pageSize=100': new ApiError(500, 'Audit down') });
    render(<MemoryRouter><AuditV2 /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Audit down');
    serve();
    await u.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Audit log' })).toBeInTheDocument();
  });
});

describe('A10 Integrations', () => {
  it('only careers + mail (others hidden), status text + icon; test connection posts and reports; axe', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValueOnce({ success: true, message: 'SMTP handshake OK.' }).mockRejectedValueOnce(new ApiError(502, 'Careers site did not answer.'));
    const { container } = renderAt('/integrations');
    const mail = await screen.findByRole('region', { name: 'Mail (SMTP)' });
    expect(screen.getByRole('region', { name: 'Careers site' })).toHaveTextContent(/Connected.*Last sync.*Fri 9 Oct 2026, 08:45/);
    expect(screen.queryByText(/Calendar/)).toBeNull();
    expect(mail).toHaveTextContent(/Available.*Never/);
    await u.click(within(mail).getByRole('button', { name: 'Test connection: Mail (SMTP)' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/integrations/i2/test'));
    expect(await within(mail).findByRole('status')).toHaveTextContent('SMTP handshake OK.');
    const careers = screen.getByRole('region', { name: 'Careers site' });
    await u.click(within(careers).getByRole('button', { name: 'Test connection: Careers site' }));
    expect(await within(careers).findByRole('alert')).toHaveTextContent('Careers site did not answer.');
    expect(await axeViolations(container)).toEqual([]);
  });
  it('non-admin keeps v1', async () => {
    shell.value = null;
    renderAt('/integrations');
    expect(await screen.findByText('v1 integrations')).toBeInTheDocument();
  });
});

describe('#21/#23 override errors', () => {
  it('400 fields map to the override inputs; REASON_REQUIRED goes on the "Other" note', async () => {
    const { overrideError } = await import('../opsApi');
    const { ApiError } = await import('../../../api/client');
    const fields = { holdUntil: ['holdUntil must be a valid ISO 8601 date string'] };
    expect(overrideError(new ApiError(400, 'x', { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', field: 'holdUntil', fields }, { code: 'VALIDATION_ERROR', fields })))
      .toEqual({ field: 'holdUntil', text: 'holdUntil must be a valid ISO 8601 date string' });
    expect(overrideError(new ApiError(400, '"Other" needs a short note.', { statusCode: 400, code: 'REASON_REQUIRED', message: '"Other" needs a short note.' }, { code: 'REASON_REQUIRED' })))
      .toEqual({ field: 'statusNote', text: '"Other" needs a short note.' });
  });
});
