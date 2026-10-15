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
import { ReportsRoute } from '../../pages/ReportsRoute';
import { AuditRoute, IntegrationsRoute } from '../AdminRoutes';
import { AuditV2 } from '../AuditV2';
import { ALLOWED_PROVIDERS, auditArea, namedAuditText, overrideError, toCsv } from '../opsApi';
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
    '/vacancies/work-queue?page=1&pageSize=100': { data: jobs }, '/users?directory=1&page=1&pageSize=100': ufx.users,
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
    <Route path="/reports" element={<ReportsRoute />} /><Route path="/audit-log" element={<AuditRoute />} /><Route path="/integrations" element={<IntegrationsRoute />} />
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
  it('#21 2ced190: hold sends {reason: list value, note when Other, holdUntil}; no free-text "why" with a list', async () => {
    const u = userEvent.setup();
    serve({ '/master-data/catalog/hold-reasons': [{ name: 'Budget freeze', status: 'Active' }, { name: 'Other', status: 'Active' }, { name: 'Old', status: 'Inactive' }] });
    api.postApi.mockResolvedValue({ action: 'job.hold', entityId: 'v1', from: 'Open', to: 'On Hold' });
    renderAt('/reports?override=v1');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: 'Put on hold' }));
    const pick = await within(d).findByLabelText(/^Hold reason/);
    expect(within(pick).queryByRole('option', { name: 'Old' })).toBeNull();
    expect(within(d).queryByLabelText(/^Why you are overriding/)).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    expect(within(d).getByText('Pick a reason from the list.')).toBeInTheDocument();
    await u.selectOptions(pick, 'Other');
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    expect(within(d).getByText('"Other" needs a short note (at least 3 characters).')).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/^Other reason/), 'Site audit');
    await u.type(within(d).getByLabelText(/^Hold until/), '2099-01-15');
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/admin/overrides', { action: 'job.hold', entityId: 'v1', reason: 'Other', note: 'Site audit', holdUntil: '2099-01-15' }));
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
  it('exports an area that is not on the current page', async () => {
    const u = userEvent.setup();
    const offer = (id: string) => ({ id, actorUserId: 'u-omar', actorDisplayName: 'Omar Khalil', action: 'OFFER_DECISION', entityType: 'Offer', entityId: `${id}-ent`, result: 'Success', reason: 'offer-reason', createdAt: new Date().toISOString() });
    const page1 = Array.from({ length: 100 }, (_, i) => offer(`p1-${i}`));
    const page2 = [{ id: 'later-file', actorUserId: 'u-karim', actorDisplayName: 'Karim Hassan', action: 'APPLICATION_STAGE_MOVE', entityType: 'Application', entityId: 'later-file-ent', result: 'Success', reason: 'later-only-file', createdAt: new Date().toISOString() }];
    api.getApi.mockImplementation(async (p: string) => {
      if (p.startsWith('/users')) return { data: ufx.users, total: ufx.users.length };
      if (p.startsWith('/audit?')) {
        const page = Number(new URLSearchParams(p.split('?')[1]).get('page'));
        if (page === 1) return { data: page1, total: 101 };
        if (page === 2) return { data: page2, total: 101 };
        return { data: [], total: 101 };
      }
      throw new ApiError(404, 'no');
    });
    const blobs: Blob[] = [];
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((value: Blob | MediaSource) => { blobs.push(value as Blob); return 'blob:audit'; });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    try {
      render(<MemoryRouter><AuditV2 /></MemoryRouter>);
      await screen.findByRole('table', { name: 'Audit log' });
      await u.selectOptions(screen.getByLabelText('Who'), 'u-omar');
      await screen.findByRole('table', { name: 'Audit log' });
      await u.selectOptions(screen.getByLabelText('Area'), 'File');
      expect(screen.getByRole('table', { name: 'Audit log' })).not.toHaveTextContent('later-only-file');
      expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
      const before = api.getApi.mock.calls.length;
      await u.click(screen.getByRole('button', { name: 'Export' }));
      await waitFor(() => expect(blobs).toHaveLength(1));
      const csv = await blobs[0].text();
      const calls = api.getApi.mock.calls.slice(before).map((c) => String(c[0]));
      expect(calls.some((p) => /^\/audit\?page=2&pageSize=100&from=\d{4}-\d{2}-\d{2}&actor=u-omar$/.test(p))).toBe(true);
      expect(csv).toContain('later-only-file');
      expect(csv).not.toContain('offer-reason');
    } finally {
      create.mockRestore();
      revoke.mockRestore();
      anchorClick.mockRestore();
    }
  });
  it('opens read-only evidence for one entry and includes correlation id when present', async () => {
    const u = userEvent.setup();
    const iso = '2026-10-14T22:30:00.000Z';
    const fmtDay = (value: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date(value));
    const fmtTime = (value: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date(value));
    const withCorrelation = { id: 'a-corr', actorUserId: 'u-karim', actorDisplayName: 'Karim Hassan', action: 'OFFER_DECISION', entityType: 'Offer', entityId: 'o1-aaaaaaaa-full-id', result: 'Success', reason: 'Approved v2', createdAt: iso, correlationId: 'corr-77', ipAddress: '203.0.113.9' };
    const withoutCorrelation = { id: 'a-plain', actorUserId: 'u-omar', actorDisplayName: 'Omar Khalil', action: 'USER_UPDATE', entityType: 'User', entityId: 'user-99', result: 'Failure', reason: null, createdAt: iso, ipAddress: '203.0.113.10' };
    api.getApi.mockImplementation(async (p: string) => {
      if (p.startsWith('/users')) return { data: ufx.users, total: ufx.users.length };
      if (p.startsWith('/audit?')) return { data: [withCorrelation, withoutCorrelation], total: 2 };
      throw new ApiError(404, 'no');
    });
    render(<MemoryRouter><AuditV2 /></MemoryRouter>);
    await u.click(await screen.findByRole('button', { name: 'Open evidence a-corr' }));
    const dialog = await screen.findByRole('dialog', { name: 'Audit entry' });
    expect(dialog).toHaveTextContent(`${fmtDay(iso)} ${fmtTime(iso)}`);
    expect(dialog).toHaveTextContent('Karim Hassan');
    expect(dialog).toHaveTextContent('Offer');
    expect(dialog).toHaveTextContent('Offer decision');
    expect(dialog).toHaveTextContent('Approved v2');
    expect(dialog).toHaveTextContent('Success');
    expect(dialog).toHaveTextContent('o1-aaaaaaaa-full-id');
    expect(dialog).toHaveTextContent('Correlation id');
    expect(dialog).toHaveTextContent('corr-77');
    expect(dialog).not.toHaveTextContent('203.0.113.9');
    expect(dialog).not.toHaveTextContent(/Before|After/);
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    await u.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Open evidence a-plain' }));
    const plain = await screen.findByRole('dialog', { name: 'Audit entry' });
    expect(plain).toHaveTextContent('Omar Khalil');
    expect(plain).toHaveTextContent('User update');
    expect(plain).toHaveTextContent('Failure');
    expect(plain).toHaveTextContent('user-99');
    expect(plain).not.toHaveTextContent('Correlation id');
    expect(plain).not.toHaveTextContent('203.0.113.10');
    expect(document.body).not.toHaveTextContent('203.0.113.9');
  });
  it('helpers: area mapping and CSV escaping (formula-safe)', () => {
    expect(auditArea({ entityType: 'User', action: 'USER_UPDATE' })).toBe('Users');
    expect(auditArea({ entityType: 'MasterDataValue', action: 'MASTER_DATA_BATCH_SAVE' })).toBe('Settings');
    expect(toCsv(['a', 'b'], [['x,y', '=SUM(1)'], ['he said "hi"', null]])).toBe('a,b\r\n"x,y","\'=SUM(1)"\r\n"he said ""hi""",');
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
    api.postApi.mockResolvedValueOnce({ success: false, verified: false, message: 'Mail delivery is not verified. A saved provider setting is not a connection, and this server does not send to candidates.' }).mockRejectedValueOnce(new ApiError(502, 'Careers site did not answer.'));
    const { container } = renderAt('/integrations');
    const mail = await screen.findByRole('region', { name: 'Mail (SMTP)' });
    expect(screen.getByRole('region', { name: 'Careers site' })).toHaveTextContent(/Connected.*Last sync.*Fri 9 Oct 2026, 08:45/);
    expect(screen.queryByText(/Calendar/)).toBeNull();
    expect(mail).toHaveTextContent(/Available.*Never/);
    await u.click(within(mail).getByRole('button', { name: 'Test connection: Mail (SMTP)' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/integrations/i2/test'));
    expect(await within(mail).findByRole('alert')).toHaveTextContent(/Mail delivery is not verified/);
    expect(mail).not.toHaveTextContent(/\bSent\b/);
    const careers = screen.getByRole('region', { name: 'Careers site' });
    await u.click(within(careers).getByRole('button', { name: 'Test connection: Careers site' }));
    expect(await within(careers).findByRole('alert')).toHaveTextContent('Careers site did not answer.');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('saves careers URL and SMTP settings without a send or a connected mail status', async () => {
    const u = userEvent.setup();
    const secret = 'cipher-blob-9f3a';
    serve({
      '/integrations': [
        { id: 'i1', name: 'Careers site publishing', provider: 'careers_site', category: 'Publishing', status: 'Connected', lastSyncAt: '2026-10-09T05:45:00.000Z', careersUrl: 'https://careers.example.com/jobs', apiKeyEncrypted: secret, configJson: { apiKeyEncrypted: secret, clientSecret: 'client-secret-plain' } },
        { id: 'i2', name: 'Email Provider', provider: 'smtp', category: 'Communication', status: 'Connected', lastSyncAt: null, smtpHost: 'mail.internal', fromAddress: 'recruiting@recruitflow.local', port: 25, refreshToken: 'refresh-token-plain', accessToken: 'access-token-plain', clientSecretEncrypted: 'client-cipher' },
        { id: 'i3', name: 'WhatsApp Business', provider: 'whatsapp', category: 'x', status: 'Connected' },
        { id: 'i4', name: 'Google Calendar', provider: 'google_calendar', category: 'x', status: 'Connected' },
        { id: 'i5', name: 'Google Meet', provider: 'google_meet', category: 'x', status: 'Connected' },
      ],
    });
    api.patchApi.mockImplementation(async (path: string, body: { configJson?: Record<string, unknown> }) => ({
      id: String(path).endsWith('i2') ? 'i2' : 'i1',
      name: String(path).endsWith('i2') ? 'Email Provider' : 'Careers site publishing',
      provider: String(path).endsWith('i2') ? 'smtp' : 'careers_site',
      category: String(path).endsWith('i2') ? 'Communication' : 'Publishing',
      status: 'Connected',
      ...(body?.configJson ?? {}),
      apiKeyEncrypted: secret,
      clientSecret: 'client-secret-plain',
      refreshToken: 'refresh-token-plain',
      accessToken: 'access-token-plain',
    }));
    renderAt('/integrations');
    const careers = await screen.findByRole('region', { name: 'Careers site' });
    const mail = screen.getByRole('region', { name: 'Mail (SMTP)' });
    expect(ALLOWED_PROVIDERS).toEqual(['careers_site', 'smtp']);
    expect(screen.getAllByRole('region')).toHaveLength(2);
    expect(screen.queryByRole('region', { name: /WhatsApp|Calendar|Meet/ })).toBeNull();
    expect(within(careers).getByLabelText(/Careers URL/)).toHaveValue('https://careers.example.com/jobs');
    expect(within(mail).getByLabelText(/SMTP host/)).toHaveValue('mail.internal');
    expect(within(mail).getByLabelText(/From address/)).toHaveValue('recruiting@recruitflow.local');
    expect(within(mail).getByLabelText(/^Port/)).toHaveValue(25);
    expect(mail).toHaveTextContent('Not verified');
    expect(mail).not.toHaveTextContent(/\bConnected\b/);
    const secretInFields = () => [...screen.queryAllByRole('textbox'), ...screen.queryAllByRole('spinbutton')].map((el) => (el as HTMLInputElement).value).join('\n');
    for (const hidden of [secret, 'client-secret-plain', 'refresh-token-plain', 'access-token-plain', 'client-cipher']) {
      expect(document.body.innerHTML).not.toContain(hidden);
      expect(document.body.textContent).not.toContain(hidden);
      expect(secretInFields()).not.toContain(hidden);
    }

    await u.clear(within(careers).getByLabelText(/Careers URL/));
    await u.click(within(careers).getByRole('button', { name: 'Save settings' }));
    expect(within(careers).getByText('Enter the careers URL.')).toBeInTheDocument();
    expect(api.patchApi).not.toHaveBeenCalled();
    await u.type(within(careers).getByLabelText(/Careers URL/), 'https://jobs.example.com/careers');
    await u.click(within(careers).getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/integrations/i1', { configJson: { careersUrl: 'https://jobs.example.com/careers' } }));
    expect(await within(careers).findByText('Settings saved. This does not send mail or mark the provider connected.')).toBeInTheDocument();
    expect(within(careers).getByRole('status')).not.toHaveTextContent(/\bSent\b/);

    await u.clear(within(mail).getByLabelText(/SMTP host/));
    await u.type(within(mail).getByLabelText(/SMTP host/), 'smtp.internal');
    await u.clear(within(mail).getByLabelText(/^Port/));
    await u.type(within(mail).getByLabelText(/^Port/), '587');
    await u.click(within(mail).getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/integrations/i2', { configJson: { smtpHost: 'smtp.internal', fromAddress: 'recruiting@recruitflow.local', port: 587 } }));
    expect(await within(mail).findByText('Settings saved. This does not send mail or mark the provider connected.')).toBeInTheDocument();
    expect(within(mail).getByRole('status')).not.toHaveTextContent(/\bSent\b/);
    expect(mail).not.toHaveTextContent(/\bConnected\b/);
    expect(api.patchApi.mock.calls.every((call) => call[1] && !Object.prototype.hasOwnProperty.call(call[1] as object, 'status'))).toBe(true);

    api.postApi.mockResolvedValueOnce({ success: true, message: 'Sent' });
    await u.click(within(mail).getByRole('button', { name: 'Test connection: Mail (SMTP)' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/integrations/i2/test'));
    const testResult = await within(mail).findByRole('alert');
    expect(testResult).toHaveTextContent(/not verified/i);
    expect(testResult).not.toHaveTextContent(/\bSent\b/);
    const urls = [...api.getApi.mock.calls, ...api.patchApi.mock.calls, ...api.postApi.mock.calls, ...api.deleteApi.mock.calls].map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes('/send') || /smtp\.|mail\.|gmail|outlook|sendgrid|mailgun|amazonaws|office365/i.test(url))).toEqual([]);
    for (const hidden of [secret, 'client-secret-plain', 'refresh-token-plain', 'access-token-plain', 'client-cipher']) {
      expect(document.body.innerHTML).not.toContain(hidden);
    }
  });
});

describe('#21/#23 override errors', () => {
  it('close with a list reason (not Other) sends no note; reopen keeps free text', async () => {
    const u = userEvent.setup();
    serve({ '/master-data/catalog/close-reasons': [{ name: 'Filled internally', status: 'Active' }, { name: 'Other', status: 'Active' }] });
    api.postApi.mockResolvedValue({ action: 'job.close', entityId: 'v1', from: 'Open', to: 'Closed' });
    renderAt('/reports?override=v1');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: 'Close job' }));
    await u.selectOptions(await within(d).findByLabelText(/^Close reason/), 'Filled internally');
    await u.click(within(d).getByRole('button', { name: 'Apply override' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/admin/overrides', { action: 'job.close', entityId: 'v1', reason: 'Filled internally' }));
  });
  it('400 fields map to the override inputs; REASON_REQUIRED goes on the "Other" note', async () => {
    const { overrideError } = await import('../opsApi');
    const { ApiError } = await import('../../../api/client');
    const fields = { holdUntil: ['holdUntil must be a valid ISO 8601 date string'] };
    expect(overrideError(new ApiError(400, 'x', { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', field: 'holdUntil', fields }, { code: 'VALIDATION_ERROR', fields })))
      .toEqual({ field: 'holdUntil', text: 'holdUntil must be a valid ISO 8601 date string' });
    expect(overrideError(new ApiError(400, '"Other" needs a short note.', { statusCode: 400, code: 'REASON_REQUIRED', message: '"Other" needs a short note.' }, { code: 'REASON_REQUIRED' })))
      .toEqual({ field: 'note', text: '"Other" needs a short note.' });
  });
});
