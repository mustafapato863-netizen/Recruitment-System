import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import * as fx from '../../api/__fixtures__/requisitions';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'manager' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
const auth = vi.hoisted(() => ({ perms: ['VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_MANAGE'] }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-karim', displayName: 'Karim Hassan', permissions: auth.perms, roles: [{ code: 'HIRING_MANAGER' }] } }) }));
vi.mock('../../../pages/VacancyRequestsPage', () => ({ VacancyRequestsPage: () => <p>v1 requisitions</p> }));
import { RequisitionsV2 } from '../RequisitionsV2';
import { RequisitionsRoute } from '../RequisitionsRoute';
import { draftActivateRefused, mineOrTeam, reqError, TARGET_UPDATE_LIVE } from '../../api/requisitions';
import { TargetDrawer } from '../../drawers/RequisitionDrawers';

let responses: Record<string, unknown> = {};
const serve = (extra: Record<string, unknown> = {}) => {
  responses = { '/vacancy-requests': fx.requisitions, '/vacancy-requests/context': fx.context, '/users/assignable': fx.assignable, '/master-data/catalog/grades': fx.grades, ...extra };
  api.getApi.mockImplementation(async (p: string) => {
    if (p in responses) { const v = responses[p]; if (v instanceof Error) throw v; return structuredClone(v); }
    throw new ApiError(404, 'nf');
  });
};
function Loc() { const l = useLocation(); return <div data-testid="loc">{l.pathname + l.search}</div>; }
const renderAt = (path = '/vacancy-requests') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/vacancy-requests" element={<><RequisitionsV2 /><Loc /></>} /></Routes></MemoryRouter>);
};
beforeEach(() => { vi.clearAllMocks(); serve(); shell.value = { seat: 'manager' }; auth.perms = ['VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_MANAGE']; });

describe('M1 requisitions list', () => {
  it('my team only, titles/sites from context, target text, owner names, no budget; axe', async () => {
    const { container } = renderAt();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5); // other team hidden
    expect(rows[4]).toHaveTextContent('REQ-IT-0398 · cancelled · budget moved to FY27');
    expect(rows[0]).toHaveTextContent(/HRIS Developer.*REQ-IT-0412 · target 1 of 3.*Offshore Cairo.*3.*19 Oct 2026.*Mariam Farag.*Job active/);
    expect(rows[3]).toHaveTextContent(/Payroll Systems Analyst.*REQ-IT-0421 · no target yet.*SGH Riyadh.*—.*Youssef Ibrahim.*Draft/);
    expect(within(rows[2]).getByRole('button', { name: 'Edit target: BI Data Analyst' })).toBeInTheDocument();
    expect(within(rows[3]).getByRole('button', { name: 'Add target: Payroll Systems Analyst' })).toBeInTheDocument();
    expect(within(rows[0]).queryByRole('button', { name: /target/ })).toBeNull();
    expect(container.textContent).not.toMatch(/30000|42000|EGP|NICU/);
    expect(await axeViolations(container)).toEqual([]);
  });
  it('filters: cancelled with reason; search', async () => {
    const u = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    await u.selectOptions(screen.getByLabelText('Status'), 'closed');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('table')).toHaveTextContent('REQ-IT-0398 · cancelled · budget moved to FY27');
    await u.selectOptions(screen.getByLabelText('Status'), 'open');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    await u.selectOptions(screen.getByLabelText('Status'), 'all');
    await u.type(screen.getByLabelText('Search requisitions'), 'riyadh');
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
  it('no create access → no New requisition; context 403 still lists', async () => {
    auth.perms = ['VACANCY_REQUEST_VIEW'];
    serve({ '/vacancy-requests/context': new ApiError(403, 'no') });
    renderAt();
    expect(await screen.findByRole('table')).toHaveTextContent('REQ-IT-0412');
    expect(screen.queryByRole('button', { name: 'New requisition' })).toBeNull();
  });
  it('403 → forbidden; 500 → retry', async () => {
    serve({ '/vacancy-requests': new ApiError(403, 'no') });
    const { unmount } = renderAt();
    expect(await screen.findByText(/does not include requisitions/)).toBeInTheDocument();
    unmount();
    const u = userEvent.setup();
    serve({ '/vacancy-requests': new ApiError(500, 'boom') });
    renderAt();
    await screen.findByText('Could not load requisitions');
    serve();
    await u.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
  it('scope helper: requester or my reports; unknown reports → as returned', () => {
    const p = [{ id: 'u-mariam', name: 'M' }];
    expect(mineOrTeam(fx.requisitions as never, 'u-karim', p).map((r) => r.id)).not.toContain('r-other');
    expect(mineOrTeam(fx.requisitions as never, 'u-karim', null)).toHaveLength(fx.requisitions.length);
  });
});

describe('M03 requisition drawer', () => {
  it('new: due date required (Save disabled), saves a draft without budget, then submit sends for approval', async () => {
    const u = userEvent.setup();
    api.postApi.mockImplementation(async (p: string) => (p === '/vacancy-requests' ? { ...fx.requisitions[3], id: 'r-new' } : { id: 'r-new', status: 'Pending Approval' }));
    const { baseElement } = renderAt();
    await u.click(await screen.findByRole('button', { name: 'New requisition' }));
    const d = await screen.findByRole('dialog', { name: 'New requisition' });
    expect(within(d).getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(within(d).getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
    await u.selectOptions(within(d).getByLabelText(/^Title/), 'p-payroll');
    await u.selectOptions(within(d).getByLabelText(/^Site/), 'b-riyadh');
    await u.selectOptions(within(d).getByLabelText(/^Grade/), 'g7');
    expect(within(d).queryByRole('option', { name: 'Grade 9 (old)' })).toBeNull();
    await u.type(within(d).getByLabelText(/^Due date/), '2099-11-20');
    await u.selectOptions(within(d).getByLabelText(/^Primary recruiter/), 'u-youssef');
    expect(within(d).queryByRole('option', { name: /Old Recruiter/ })).toBeNull();
    expect(await axeViolations(baseElement)).toEqual([]);
    await u.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests/r-new/submit', {}));
    expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests', { positionId: 'p-payroll', branchId: 'b-riyadh', requestedHeadcount: 1, dueDate: '2099-11-20', gradeId: 'g7', assignedEmployeeId: 'u-youssef', justification: null });
    expect(await screen.findByRole('status')).toHaveTextContent('Payroll Systems Analyst sent for approval. Activate it once it is approved.');
  });
  it('draft edit → PATCH; DUE_DATE_REQUIRED by code lands on the field', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ id: 'r421' });
    api.postApi.mockRejectedValue(new ApiError(400, 'Request REQ-IT-0421 needs a due date', { code: 'DUE_DATE_REQUIRED', message: 'Request REQ-IT-0421 needs a due date (dueDate / targetFillDate) before it can leave Draft.' }, { code: 'DUE_DATE_REQUIRED' }));
    renderAt('/vacancy-requests?req=r421');
    const d = await screen.findByRole('dialog', { name: 'Payroll Systems Analyst' });
    expect(within(d).getByLabelText(/^Notes/)).toHaveValue('Backfill for Payroll HRIS support. Arabic and English. Oracle HCM payroll a must.');
    await u.type(within(d).getByLabelText(/^Due date/), '2099-11-20');
    await u.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/vacancy-requests/r421', expect.objectContaining({ dueDate: '2099-11-20', gradeId: 'g7', assignedEmployeeId: 'u-youssef' })));
    expect(await within(d).findByText(/needs a due date/)).toBeInTheDocument();
  });
  it('approved: Activate job assigns the owner in one call; ASSIGNEE_NOT_ELIGIBLE by code', async () => {
    const u = userEvent.setup();
    api.postApi.mockRejectedValueOnce(new ApiError(400, 'x', { code: 'ASSIGNEE_NOT_ELIGIBLE', message: 'The assigned employee must be an active user.' }, { code: 'ASSIGNEE_NOT_ELIGIBLE' }))
      .mockResolvedValueOnce({ request: { id: 'r420', status: 'Converted to Vacancy' }, vacancy: { id: 'v9' } });
    renderAt('/vacancy-requests?req=r420');
    const d = await screen.findByRole('dialog', { name: 'BI Data Analyst' });
    expect(within(d).getByLabelText(/^Seats/)).toBeDisabled();
    await u.click(within(d).getByRole('button', { name: 'Activate job' }));
    expect(await within(d).findByText('The assigned employee must be an active user.')).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Activate job' }));
    await waitFor(() => expect(api.postApi).toHaveBeenLastCalledWith('/vacancy-requests/r420/activate', { assignedEmployeeId: 'u-youssef' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Job active — BI Data Analyst is now in Youssef Ibrahim’s Open jobs.');
  });
  it('without VACANCY_MANAGE an approved requisition cannot be activated', async () => {
    auth.perms = ['VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE'];
    renderAt('/vacancy-requests?req=r420');
    const d = await screen.findByRole('dialog', { name: 'BI Data Analyst' });
    expect(within(d).queryByRole('button', { name: 'Activate job' })).toBeNull();
    expect(d).toHaveTextContent('Activating needs job management access.');
  });
  it('cancel: reason required, two-step confirm, live job closed message', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ request: { id: 'r412', status: 'Cancelled' }, closedJob: true, rejectedApplications: 3 });
    renderAt('/vacancy-requests?req=r412');
    const d = await screen.findByRole('dialog', { name: 'HRIS Developer' });
    expect(d).toHaveTextContent('Cancelling closes the live job and rejects its open files');
    await u.click(within(d).getByRole('button', { name: 'Cancel requisition' }));
    await u.click(within(d).getByRole('button', { name: /Confirm cancel/ }));
    expect(await within(d).findByText(/A reason is required/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.type(within(d).getByLabelText(/^Reason to cancel/), 'Budget moved to FY27');
    await u.click(within(d).getByRole('button', { name: 'Cancel requisition' }));
    await u.click(within(d).getByRole('button', { name: /Confirm cancel/ }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests/r412/cancel', { reason: 'Budget moved to FY27' }));
    expect(await screen.findByRole('status')).toHaveTextContent('REQ-IT-0412 cancelled. Its job was closed and 3 open files rejected.');
  });
});

describe('M04 add target', () => {
  it('draft: seats + due + owner → PATCH; preview chip; due required', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ id: 'r421' });
    const { baseElement } = renderAt('/vacancy-requests?req=r421&drawer=target');
    const d = await screen.findByRole('dialog', { name: 'Add target — Payroll Systems Analyst' });
    expect(within(d).getByRole('button', { name: 'Save target' })).toBeDisabled();
    await u.clear(within(d).getByLabelText(/^Seats/)); await u.type(within(d).getByLabelText(/^Seats/), '3');
    await u.type(within(d).getByLabelText(/^Due date/), '2026-10-19');
    expect(within(d).getByRole('region', { name: /Preview — Youssef Ibrahim’s My Work/ })).toHaveTextContent('Payroll Systems AnalystOwner: Youssef Ibrahim0 of 3 · due 19 Oct');
    expect(await axeViolations(baseElement)).toEqual([]);
    await u.click(within(d).getByRole('button', { name: 'Save target' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/vacancy-requests/r421', { requestedHeadcount: 3, dueDate: '2026-10-19', assignedEmployeeId: 'u-youssef' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Target saved — it appears on Youssef Ibrahim’s My Work as “0 of 3 · due 19 Oct”');
  });
  it('approved: seats/due locked; Save target and activate', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ request: { id: 'r420' } });
    renderAt('/vacancy-requests?req=r420&drawer=target');
    const d = await screen.findByRole('dialog', { name: 'Edit target — BI Data Analyst' });
    expect(within(d).getByLabelText(/^Seats/)).toBeDisabled();
    await u.selectOptions(within(d).getByLabelText(/^Assign to/), 'u-mariam');
    await u.click(within(d).getByRole('button', { name: 'Save target and activate' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests/r420/activate', { assignedEmployeeId: 'u-mariam' }));
  });
  it('reports list unavailable → honest disabled picker', async () => {
    serve({ '/users/assignable': new ApiError(403, 'no') });
    renderAt('/vacancy-requests?req=r421&drawer=target');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByLabelText(/^Assign to/)).toBeDisabled();
    expect(d).toHaveTextContent('Your reports list is not available to you');
  });
});

describe('/vacancy-requests route', () => {
  it('v1 outside the Manager v2 seat', async () => {
    shell.value = { seat: 'employee' };
    render(<MemoryRouter><RequisitionsRoute /></MemoryRouter>);
    expect(await screen.findByText('v1 requisitions')).toBeInTheDocument();
    shell.value = null;
  });
  it('reqError: codes, 403, message fallback', () => {
    expect(reqError(new ApiError(400, 'm', { code: 'ASSIGNEE_REQUIRED', message: 'needs owner' }, { code: 'ASSIGNEE_REQUIRED' }))).toEqual({ field: 'assignee', text: 'needs owner' });
    expect(reqError(new ApiError(403, 'x', undefined, { code: 'FORBIDDEN' })).text).toMatch(/permission/);
    expect(reqError(new ApiError(409, 'Request REQ-1 cannot be updated from Approved.', undefined, { code: 'CONFLICT' })).text).toBe('Request REQ-1 cannot be updated from Approved.');
  });
});

describe('M1 CoS follow-ups', () => {
  it('own draft with a due date: Activate job saves then activates; today’s refusal is explained and Submit stays', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ id: 'r421' });
    api.postApi.mockRejectedValueOnce(new ApiError(409, 'Request REQ-IT-0421 must be approved before activation.'));
    renderAt('/vacancy-requests?req=r421');
    const d = await screen.findByRole('dialog', { name: 'Payroll Systems Analyst' });
    expect(within(d).queryByRole('button', { name: 'Activate job' })).toBeNull();
    await u.type(within(d).getByLabelText(/^Due date/), '2099-11-20');
    await u.click(within(d).getByRole('button', { name: 'Activate job' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests/r421/activate', { assignedEmployeeId: 'u-youssef' }));
    expect(api.patchApi).toHaveBeenCalledWith('/vacancy-requests/r421', expect.objectContaining({ dueDate: '2099-11-20' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Activating a draft directly is not live yet — your changes are saved. Submit it for approval');
    expect(within(d).getByRole('button', { name: 'Submit for approval' })).toBeEnabled();
    api.postApi.mockResolvedValueOnce({ request: { id: 'r421' } });
    await u.click(within(d).getByRole('button', { name: 'Activate job' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Job active — Payroll Systems Analyst is now in Youssef Ibrahim’s Open jobs.');
  });
  it('someone else’s draft never offers Activate', async () => {
    serve({ '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r421' ? { ...r, requesterId: 'u-other', dueDate: '2099-11-20', targetFillDate: '2099-11-20' } : r)) });
    renderAt('/vacancy-requests?req=r421');
    const d = await screen.findByRole('dialog');
    expect(within(d).queryByRole('button', { name: 'Activate job' })).toBeNull();
    expect(within(d).getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
  });
  it('refusal helper: 409/403 without a known code', () => {
    expect(draftActivateRefused(new ApiError(409, 'must be approved'))).toBe(true);
    expect(draftActivateRefused(new ApiError(403, 'no'))).toBe(true);
    expect(draftActivateRefused(new ApiError(400, 'x', { code: 'DUE_DATE_REQUIRED' }, { code: 'DUE_DATE_REQUIRED' }))).toBe(false);
  });
  it('server names and department win; department shows only when the API has it, and is sent', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ id: 'r-new' });
    serve({
      '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r412' ? { ...r, positionTitle: 'HRIS Developer II', branchName: 'Cairo HQ', assignedEmployeeName: 'M. Farag', departmentName: 'IT Applications' } : r)),
      '/vacancy-requests/context': { ...fx.context, departments: [{ id: 'd-it', name: 'IT Applications' }] },
    });
    renderAt();
    const rows = within(await screen.findByRole('table')).getAllByRole('row');
    expect(rows[0]).toHaveTextContent('Department');
    expect(rows[1]).toHaveTextContent(/HRIS Developer II.*IT Applications.*Cairo HQ.*M\. Farag/);
    await u.click(screen.getByRole('button', { name: 'New requisition' }));
    const d = await screen.findByRole('dialog', { name: 'New requisition' });
    await u.selectOptions(within(d).getByLabelText(/^Department/), 'd-it');
    await u.selectOptions(within(d).getByLabelText(/^Title/), 'p-payroll');
    await u.selectOptions(within(d).getByLabelText(/^Site/), 'b-riyadh');
    await u.type(within(d).getByLabelText(/^Due date/), '2099-11-20');
    await u.click(within(d).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests', expect.objectContaining({ departmentId: 'd-it' })));
  });
  it('no department from the API → no column, no field, not sent', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ id: 'r-new' });
    renderAt();
    expect(within(await screen.findByRole('table')).getAllByRole('row')[0]).not.toHaveTextContent('Department');
    await u.click(screen.getByRole('button', { name: 'New requisition' }));
    const d = await screen.findByRole('dialog', { name: 'New requisition' });
    expect(within(d).queryByLabelText(/^Department/)).toBeNull();
  });
  it('live target update is hidden until the endpoint exists; typed adapter posts seats, due and reason', async () => {
    expect(TARGET_UPDATE_LIVE).toBe(false);
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ id: 'r412' });
    const onDone = vi.fn();
    const live = fx.requisitions[0] as never;
    const { unmount } = render(<TargetDrawer req={live} people={null} canActivate onClose={() => {}} onDone={onDone} />);
    expect(screen.getByLabelText(/^Seats/)).toBeDisabled();
    expect(screen.queryByLabelText(/^Reason for the change/)).toBeNull();
    unmount();
    render(<TargetDrawer req={live} people={null} canActivate targetUpdate onClose={() => {}} onDone={onDone} />);
    await u.clear(screen.getByLabelText(/^Seats/)); await u.type(screen.getByLabelText(/^Seats/), '4');
    await u.click(screen.getByRole('button', { name: 'Save target' }));
    expect(await screen.findByText(/Say why the target changes/)).toBeInTheDocument();
    await u.type(screen.getByLabelText(/^Reason for the change/), 'Second shift approved');
    await u.click(screen.getByRole('button', { name: 'Save target' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/vacancy-requests/r412/target', { requestedHeadcount: 4, dueDate: '2026-10-19', reason: 'Second shift approved' }));
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('1 of 4'));
  });
  it('Changes requested drafts never offer Activate, even with a due date', async () => {
    serve({ '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r421' ? { ...r, status: 'Changes Requested', dueDate: '2099-11-20', targetFillDate: '2099-11-20' } : r)) });
    renderAt('/vacancy-requests?req=r421');
    const d = await screen.findByRole('dialog');
    expect(within(d).queryByRole('button', { name: 'Activate job' })).toBeNull();
    expect(within(d).getByRole('button', { name: 'Submit for approval' })).toBeEnabled();
  });
});
