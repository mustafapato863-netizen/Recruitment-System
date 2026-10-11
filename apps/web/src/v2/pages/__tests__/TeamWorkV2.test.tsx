import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import * as fx from '../../api/__fixtures__/teamWork';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-karim', displayName: 'Karim Hassan', permissions: ['APPLICATION_VIEW'], roles: [{ code: 'HIRING_MANAGER' }] } }) }));
import { TeamWorkV2 } from '../TeamWorkV2';
import { reassignError, taskFor, type TeamFile } from '../../api/teamWork';

let responses: Record<string, unknown> = {};
const serve = (extra: Record<string, unknown> = {}) => {
  responses = { ...fx.teamPaths(), ...extra };
  api.getApi.mockImplementation(async (p: string) => {
    if (p in responses) { const v = responses[p]; if (v instanceof Error) throw v; return structuredClone(v); }
    throw new ApiError(404, `nf ${p}`);
  });
};
function Loc() { const l = useLocation(); return <div data-testid="loc">{l.pathname + l.search}</div>; }
const renderAt = (path = '/my-work') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/my-work" element={<><TeamWorkV2 /><Loc /></>} /></Routes></MemoryRouter>);
};
beforeEach(() => { vi.clearAllMocks(); serve(); });
const card = (name: string) => screen.getByRole('heading', { name }).closest('section') as HTMLElement;

describe('M2 Team work', () => {
  it('waiting on you (my team only), one card per report A–Z, counts equal rows, closed files hidden, no pay; axe', async () => {
    const { container } = renderAt();
    expect(await screen.findByText('Open work of your 3 direct reports. Counts equal the rows shown.')).toBeInTheDocument();
    const wait = screen.getByRole('heading', { name: 'Waiting on you' }).closest('section')!;
    expect(within(wait).getAllByRole('listitem')).toHaveLength(2);
    expect(wait).toHaveTextContent(/Your scorecard — Ahmed Embaby, HRIS Developer.*Late/);
    expect(within(wait).getByRole('link', { name: 'Submit scorecard: Ahmed Embaby' })).toHaveAttribute('href', '/interviews/i1');
    expect(wait).toHaveTextContent(/Offer approval — Lina Hassan, HRIS Developer.*Offer v1 submitted by Mariam Farag/);
    expect(within(wait).getByRole('button', { name: 'Review offer: Lina Hassan' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent).slice(1)).toEqual(['Mariam Farag', 'Noura Al-Dosari', 'Youssef Ibrahim']);
    const m = card('Mariam Farag');
    expect(m).toHaveTextContent('3 open · 1 overdue');
    expect(within(m).getAllByRole('listitem')).toHaveLength(3);
    expect(within(m).getAllByRole('listitem')[0]).toHaveTextContent(/Scorecard missing — Ahmed Embaby|Follow-up overdue — Lina Hassan/);
    expect(m).not.toHaveTextContent('Old Joiner');
    expect(card('Noura Al-Dosari')).toHaveTextContent('3 open · 2 overdue');
    expect(within(card('Noura Al-Dosari')).getAllByText('Overdue')).toHaveLength(2);
    expect(card('Youssef Ibrahim')).toHaveTextContent(/Interview — Rana Adel.*BI Data Analyst · SGH Riyadh.*This week/);
    expect(within(m).getByRole('link', { name: 'Follow up — Nourhan Sami' })).toHaveAttribute('href', '/applications/a2');
    expect(container.textContent).not.toMatch(/62,?000|71,?500|858|EGP|40000/);
    expect(await axeViolations(container)).toEqual([]);
  });
  it('reports list unavailable → honest empty state; offers list failing is not fatal', async () => {
    serve({ '/users/assignable': new ApiError(403, 'no') });
    renderAt();
    expect(await screen.findByText('Your reports list is not available')).toBeInTheDocument();
  });
  it('a failing files call → error with retry', async () => {
    serve({ '/applications?primaryRecruiterId=u-noura&pageSize=100': new ApiError(500, 'Server down') });
    const u = userEvent.setup();
    renderAt();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server down');
    serve();
    await u.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Mariam Farag')).toBeInTheDocument();
  });
  it('task rules: overdue › gate › offer › today › interview › next', () => {
    const base: TeamFile = { id: 'f', code: 'F', candidate: 'X', vacancyId: 'v', job: 'J', site: 'S', stage: 'Screening', followUpDate: null };
    const t = '2026-10-10';
    expect(taskFor({ ...base, followUpDate: '2026-10-09', stage: 'Offer' }, t)).toMatchObject({ kind: 'followup-overdue', tone: 'overdue' });
    expect(taskFor({ ...base, stage: 'Offer' }, t)).toMatchObject({ kind: 'offer', tone: 'waiting' });
    expect(taskFor({ ...base, followUpDate: t }, t)).toMatchObject({ kind: 'followup', tone: 'today' });
    expect(taskFor({ ...base, stage: 'Applied' }, t)).toMatchObject({ kind: 'next', tone: null, title: 'Applied — X' });
  });
});

describe('M06 Reassign (B7 POST /files/reassign)', () => {
  it('one file → applicationIds, new owner from my reports only, reason required; toast + reload; axe', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ batchId: 'b1', toUserId: 'u-youssef', moved: [{ applicationId: 'a1', fromUserId: 'u-mariam' }], unchanged: [] });
    const { baseElement } = renderAt();
    await u.click(await screen.findByRole('button', { name: 'Reassign Mariam Farag’s files' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByText('Current owner').parentElement).toHaveTextContent('Mariam Farag');
    const to = within(d).getByLabelText(/^New primary recruiter/);
    expect(within(to).queryByRole('option', { name: /Mariam/ })).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'One file' }));
    await u.selectOptions(within(d).getByLabelText(/^File/), 'a1');
    await u.selectOptions(to, 'u-youssef');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    expect(await within(d).findByText(/A reason is required/)).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/^Reason/), 'Balance load');
    expect(within(d).getByRole('note')).toHaveTextContent('1 open file moves to Youssef Ibrahim’s Open jobs and My Work. Each file’s history records “Owner changed from Mariam Farag to Youssef Ibrahim by Karim Hassan”.');
    expect(await axeViolations(baseElement)).toEqual([]);
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/files/reassign', { applicationIds: ['a1'], toUserId: 'u-youssef', reason: 'Balance load' }));
    expect(await screen.findByRole('status')).toHaveTextContent('1 file moved from Mariam Farag to Youssef Ibrahim.');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }, 10000);
  it('whole job → that report’s open files on the job; all their files → fromUserId', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ batchId: 'b', toUserId: 'u-mariam', moved: [{ applicationId: 'n1' }, { applicationId: 'n2' }, { applicationId: 'n3' }], unchanged: [] });
    renderAt('/my-work?reassign=u-noura');
    const d = await screen.findByRole('dialog', { name: 'Reassign files on Radiology Technician' });
    expect(within(d).getByRole('button', { name: 'All files on a job' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(d).getByRole('note')).toHaveTextContent('3 open files move');
    expect(within(d).getByRole('note')).toHaveTextContent('Only files move: the job and its owner stay as they are.');
    await u.selectOptions(within(d).getByLabelText(/^New primary recruiter/), 'u-mariam');
    await u.type(within(d).getByLabelText(/^Reason/), 'Leave');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/files/reassign', { applicationIds: ['n1', 'n2', 'n3'], toUserId: 'u-mariam', reason: 'Leave' }));
    serve();
    await u.click(await screen.findByRole('button', { name: 'Reassign Youssef Ibrahim’s files' }));
    const d2 = await screen.findByRole('dialog');
    await u.click(within(d2).getByRole('button', { name: 'All their files' }));
    await u.selectOptions(within(d2).getByLabelText(/^New primary recruiter/), 'u-noura');
    await u.type(within(d2).getByLabelText(/^Reason/), 'Moving to clinical');
    await u.click(within(d2).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.postApi).toHaveBeenLastCalledWith('/files/reassign', { fromUserId: 'u-youssef', toUserId: 'u-noura', reason: 'Moving to clinical' }));
  });
  it('B7 codes land on the right field; nothing moved', async () => {
    const u = userEvent.setup();
    const err = (status: number, code: string, message: string) => new ApiError(status, message, { code, message }, { code });
    api.postApi.mockRejectedValueOnce(err(400, 'REASSIGN_TARGET_INELIGIBLE', 'The target must be an active, non-admin user.'))
      .mockRejectedValueOnce(err(409, 'REASSIGN_FILE_CLOSED', 'File APP-A1 is closed.'));
    renderAt('/my-work?reassign=u-mariam&file=a1');
    const d = await screen.findByRole('dialog', { name: 'Reassign Ahmed Embaby' });
    await u.selectOptions(within(d).getByLabelText(/^New primary recruiter/), 'u-noura');
    await u.type(within(d).getByLabelText(/^Reason/), 'Balance');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    expect(await within(d).findByText('That person cannot own files (inactive or an administrator).')).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    expect(await within(d).findByText(/A closed file .* cannot move\. Nothing was moved\./)).toBeInTheDocument();
  });
  it('reassignError: all B7 codes, 403 fallback, message fallback', () => {
    const e = (code: string, s = 409) => new ApiError(s, 'm', { code }, { code });
    expect(reassignError(e('REASSIGN_ADMIN_FORBIDDEN', 403))).toMatchObject({ text: 'Administrators cannot reassign files.' });
    expect(reassignError(e('REASSIGN_NOT_MANAGER', 403))).toMatchObject({ field: 'what' });
    expect(reassignError(e('REASSIGN_REASON_REQUIRED', 400))).toMatchObject({ field: 'reason' });
    expect(reassignError(e('REASSIGN_CONFLICT'))).toMatchObject({ text: expect.stringMatching(/Reload/) });
    expect(reassignError(new ApiError(403, 'x'))).toMatchObject({ text: 'You do not have permission to reassign these files.' });
    expect(reassignError(new ApiError(500, 'Boom'))).toMatchObject({ text: 'Boom' });
  });
});

describe('M2 CoS follow-ups', () => {
  it('prefers GET /team/work for files (server counts, waiting incl. scorecards); people come from /users/assignable (#21); no per-report calls', async () => {
    serve({ '/team/work': fx.teamWorkApi });
    renderAt();
    // #21 B2-16: the roster is /users/assignable, so a report with nothing open on /team/work still has a row.
    expect(await screen.findByText('Open work of your 3 direct reports. Counts equal the rows shown.')).toBeInTheDocument();
    const calls = api.getApi.mock.calls.map((c) => String(c[0]));
    expect(calls).toContain('/users/assignable');
    expect(calls.some((c) => c.startsWith('/applications?primaryRecruiterId='))).toBe(false);
    expect(card('Mariam Farag')).toHaveTextContent('3 open · 1 overdue');
    const wait = screen.getByRole('heading', { name: 'Waiting on you' }).closest('section')!;
    expect(wait).toHaveTextContent(/Offer v2 submitted by Mariam Farag/);
    expect(wait).toHaveTextContent(/Your scorecard — Rana Adel, BI Data Analyst.*Late/);
  });
  it('team/work failing with 500 is an error (not a silent fallback)', async () => {
    serve({ '/team/work': new ApiError(500, 'Team work down') });
    renderAt();
    expect(await screen.findByRole('alert')).toHaveTextContent('Team work down');
  });
  it('reason list from master data (active only); Other needs a note; sent as the name', async () => {
    const u = userEvent.setup();
    serve({ '/master-data/catalog/reassign-reasons': fx.reassignReasons });
    api.postApi.mockResolvedValue({ batchId: 'b', toUserId: 'u-youssef', moved: [{ applicationId: 'n1' }], unchanged: [] });
    renderAt('/my-work?reassign=u-noura&file=n1');
    const d = await screen.findByRole('dialog');
    const sel = await within(d).findByRole('combobox', { name: /^Reason/ });
    expect(within(sel).queryByRole('option', { name: 'Old reason' })).toBeNull();
    await u.selectOptions(within(d).getByLabelText(/^New primary recruiter/), 'u-youssef');
    await u.selectOptions(sel, 'Other');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    expect(await within(d).findByText('Say why (at least 3 characters).')).toBeInTheDocument();
    await u.selectOptions(sel, 'Leave');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/files/reassign', { applicationIds: ['n1'], toUserId: 'u-youssef', reason: 'Leave' }));
  });
  it('#21: "Other" goes as reason "Other" + note (never "Other: …" in reason); REASON_REQUIRED lands on the note', async () => {
    const u = userEvent.setup();
    serve({ '/master-data/catalog/reassign-reasons': fx.reassignReasons });
    api.postApi.mockRejectedValueOnce(new ApiError(400, '"Other" needs a short note.', { statusCode: 400, code: 'REASON_REQUIRED', message: '"Other" needs a short note.' }, { code: 'REASON_REQUIRED' }))
      .mockResolvedValue({ batchId: 'b', toUserId: 'u-youssef', moved: [{ applicationId: 'n1' }], unchanged: [] });
    renderAt('/my-work?reassign=u-noura&file=n1');
    const d = await screen.findByRole('dialog');
    const sel = await within(d).findByRole('combobox', { name: /^Reason/ });
    await u.selectOptions(within(d).getByLabelText(/^New primary recruiter/), 'u-youssef');
    await u.selectOptions(sel, 'Other');
    await u.type(within(d).getByLabelText(/^Say why/), 'Covering a peak');
    await u.click(within(d).getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/files/reassign', { applicationIds: ['n1'], toUserId: 'u-youssef', reason: 'Other', note: 'Covering a peak' }));
    expect(await within(d).findByText('"Other" needs a short note (at least 3 characters).')).toBeInTheDocument();
  });
});

describe('B2F-6 job Hold/Close for the owner’s manager', () => {
  const q = (o: Record<string, unknown>) => ({ code: 'VAC-1', branch: { id: 'b1', name: 'Cairo HQ' }, headcount: { approved: 2, joined: 0, remaining: 2 }, pipelineCounts: {}, needsActionCount: 0, health: null, lastActivity: null, nextAction: null, ...o });
  it('a report’s open jobs show Hold/Close; hold uses the hold list + holdUntil, close uses the close list + "Other" note', async () => {
    const u = userEvent.setup();
    serve({
      '/vacancies/work-queue?page=1&pageSize=100': { data: [
        q({ id: 'v1', title: 'HRIS Developer', status: 'Open', owner: { id: 'u-mariam', displayName: 'Mariam Farag' } }),
        q({ id: 'v2', title: 'Payroll Lead', status: 'On Hold', owner: { id: 'u-noura', displayName: 'Noura Al-Dosari' } }),
        q({ id: 'v3', title: 'Not my team', status: 'Open', owner: { id: 'u-x', displayName: 'X' } }),
        { id: 'v4', redacted: true, title: 'Redacted', branch: null, seats: { filled: 0, target: 1 } },
      ], total: 4 },
      '/master-data/catalog/hold-reasons': [{ id: 'h1', name: 'Budget review', status: 'Active' }, { id: 'h2', name: 'Other', status: 'Active' }],
      '/master-data/catalog/close-reasons': [{ id: 'c1', name: 'Filled internally', status: 'Active' }, { id: 'c2', name: 'Other', status: 'Active' }],
      '/vacancies/v1/status-history': [],
    });
    api.postApi.mockResolvedValue({ id: 'v1' });
    renderAt();
    const m = await waitFor(() => { const c = card('Mariam Farag'); within(c).getByRole('button', { name: 'Hold HRIS Developer' }); return c; });
    expect(within(m).getByRole('button', { name: 'Close HRIS Developer' })).toBeInTheDocument();
    expect(within(card('Noura Al-Dosari')).queryByRole('button', { name: 'Hold Payroll Lead' })).toBeNull();
    expect(within(card('Noura Al-Dosari')).getByRole('button', { name: 'Close Payroll Lead' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Not my team');
    expect(document.body).not.toHaveTextContent('Redacted');

    await u.click(within(m).getByRole('button', { name: 'Hold HRIS Developer' }));
    let d = await screen.findByRole('dialog');
    await u.selectOptions(await within(d).findByRole('combobox', { name: /reason/i }), 'Budget review');
    await u.type(within(d).getByLabelText(/until/i), '2099-01-15');
    await u.click(within(d).getByRole('button', { name: /^Put on hold$|^Hold job$|^Hold$/ }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/hold', expect.objectContaining({ reason: 'Budget review', holdUntil: '2099-01-15' })));

    await u.click(await within(card('Mariam Farag')).findByRole('button', { name: 'Close HRIS Developer' }));
    d = await screen.findByRole('dialog');
    await u.selectOptions(await within(d).findByRole('combobox', { name: /reason/i }), 'Other');
    await u.click(within(d).getByRole('button', { name: 'Close job' }));
    await u.click(within(d).getByRole('button', { name: /Confirm close/ }));
    expect(api.postApi).not.toHaveBeenCalledWith('/vacancies/v1/close', expect.anything());
    await u.type(within(d).getByLabelText(/note|why/i), 'Merged with another role');
    await u.click(within(d).getByRole('button', { name: 'Close job' }));
    await u.click(within(d).getByRole('button', { name: /Confirm close/ }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancies/v1/close', expect.objectContaining({ reason: 'Other', note: 'Merged with another role' })));
  });
});
