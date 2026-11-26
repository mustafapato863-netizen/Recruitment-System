import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Briefcase, Code2, FlaskConical, HeartPulse, Pill, ScanLine, Users } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import * as jdParser from '../../../utils/jdParser';
import * as fx from '../../api/__fixtures__/requisitions';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'manager' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
const auth = vi.hoisted(() => ({ perms: ['VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_MANAGE'] }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-karim', displayName: 'Karim Hassan', permissions: auth.perms, roles: [{ code: 'HIRING_MANAGER' }] } }) }));
import { RequisitionsV2, requisitionFamily, requisitionSubline } from '../RequisitionsV2';
import { draftActivateRefused, mineOrTeam, ownerOf, reqError, TARGET_UPDATE_LIVE, type Requisition } from '../../api/requisitions';
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

describe('requisition row mapping', () => {
  const row = (title: string, extra: Partial<Requisition> = {}): Requisition => ({
    ...fx.requisitions[0],
    positionTitle: title,
    position: { title },
    departmentName: null,
    specialty: null,
    ...extra,
  } as Requisition);

  it('maps nurse, imaging, pharmacy, coding, counsel, and lab icons, and leaves other titles as a briefcase', () => {
    expect(requisitionFamily(null, 'Radiology Technician').Icon).toBe(ScanLine);
    expect(requisitionFamily('Imaging', 'Staff').Icon).toBe(ScanLine);
    expect(requisitionFamily(null, 'X-Ray Technologist').Icon).toBe(ScanLine);
    expect(requisitionFamily(null, 'Registered Nurse').Icon).toBe(HeartPulse);
    expect(requisitionFamily('Nursing', 'Charge Nurse').Icon).toBe(HeartPulse);
    expect(requisitionFamily(null, 'Pharmacist').Icon).toBe(Pill);
    expect(requisitionFamily(null, 'Medical Coder').Icon).toBe(Code2);
    expect(requisitionFamily(null, 'Revenue Cycle Specialist').Icon).toBe(Code2);
    expect(requisitionFamily(null, 'Mental Health Counselor').Icon).toBe(Users);
    expect(requisitionFamily(null, 'Lab Technician').Icon).toBe(FlaskConical);
    expect(requisitionFamily(null, 'HRIS Developer').Icon).toBe(Briefcase);
    expect(requisitionFamily(null, 'Laravel Backend Engineer').Icon).not.toBe(Code2);
    expect(requisitionFamily(null, 'Radiology Technician').Icon).not.toBe(Code2);
  });

  it('shows Department · Position when the payload has either, and omits a line that only repeats the title', () => {
    expect(requisitionSubline(fx.requisitions[0] as Requisition, fx.context)).toBeNull();
    expect(requisitionSubline(row('HRIS Developer', { departmentName: 'Information Technology' }), fx.context)).toBe('Information Technology · HRIS Developer');
    expect(requisitionSubline(row('Registered Nurse', { departmentName: 'Nursing' }), fx.context)).toBe('Nursing · Registered Nurse');
    expect(requisitionSubline(row('Radiology Technician', { specialty: 'Imaging' }), fx.context)).toBe('Imaging');
    expect(requisitionSubline(row('HRIS Developer', { specialty: 'HRIS Developer' }), fx.context)).toBeNull();
  });
});

describe('M1 requisitions list', () => {
  it('my team only, titles/sites from context, target text, owner names, no budget; axe', async () => {
    const { container } = renderAt();
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Progress' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Due date' })).toBeInTheDocument();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5); // other team hidden
    expect(rows[4]).toHaveTextContent('REQ-IT-0398');
    expect(rows[4]).toHaveTextContent('Cancelled · budget moved to FY27');
    expect(rows[0]).toHaveTextContent('HRIS Developer');
    expect(rows[0]).toHaveTextContent('REQ-IT-0412');
    expect(rows[0]).toHaveTextContent('1 of 3 (33%)');
    expect(rows[0]).toHaveTextContent('Offshore Cairo');
    expect(rows[0]).toHaveTextContent('19 Oct 2026');
    expect(rows[0]).toHaveTextContent('Mariam Farag');
    expect(rows[0]).toHaveTextContent('Job active');
    expect(within(rows[0]).getAllByRole('cell')[3]).toHaveTextContent('3');
    expect(rows[3]).toHaveTextContent('Payroll Systems Analyst');
    expect(rows[3]).toHaveTextContent('REQ-IT-0421');
    expect(rows[3]).toHaveTextContent('SGH Riyadh');
    expect(rows[3]).toHaveTextContent('Youssef Ibrahim');
    expect(rows[3]).toHaveTextContent('Draft');
    expect(within(rows[3]).getAllByRole('cell')[7]).toHaveTextContent('—');
    expect(within(rows[2]).getByRole('button', { name: 'View details: BI Data Analyst' })).toBeInTheDocument();
    expect(within(rows[3]).getByRole('button', { name: 'Continue draft: Payroll Systems Analyst' })).toBeInTheDocument();
    expect(within(rows[0]).getByRole('button', { name: 'Update target: HRIS Developer' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/30000|42000|EGP|NICU/);
    expect(await axeViolations(container)).toEqual([]);
  });
  it('a requisition row shows requested seats and the due date on the same record as the title', async () => {
    renderAt();
    const title = await screen.findByRole('button', { name: 'HRIS Developer' });
    const record = title.closest('tr')!;
    expect(record).toHaveTextContent('HRIS Developer');
    expect(record).toHaveTextContent('Job active');
    expect(within(record).getAllByRole('cell')[3]).toHaveTextContent('3');
    expect(record).toHaveTextContent('19 Oct 2026');
    expect(record).toHaveTextContent('Mariam Farag');
    expect(record).toHaveTextContent('1 of 3 (33%)');
    await userEvent.setup().click(title);
    const drawer = await screen.findByRole('dialog', { name: 'HRIS Developer' });
    expect(drawer).toHaveTextContent('One record for the request and its hiring goal.');
    expect(within(drawer).getByLabelText(/^Seats/)).toHaveValue(3);
    expect(within(drawer).getByLabelText(/^Due date/)).toHaveValue('2026-10-19');
  });
  it('filters: cancelled with reason; search', async () => {
    const u = userEvent.setup();
    renderAt();
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('HRIS Developer');
    await u.selectOptions(screen.getByLabelText('Status'), 'Cancelled');
    expect(screen.getByTestId('loc')).toHaveTextContent('status=Cancelled');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('table')).toHaveTextContent('REQ-IT-0398');
    expect(screen.getByRole('table')).toHaveTextContent('Cancelled · budget moved to FY27');
    await u.selectOptions(screen.getByLabelText('Status'), 'Approved');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('table')).toHaveTextContent('BI Data Analyst');
    await u.selectOptions(screen.getByLabelText('Status'), 'all');
    await u.selectOptions(screen.getByLabelText('Site'), 'SGH Riyadh');
    expect(screen.getByTestId('loc')).toHaveTextContent('site=SGH+Riyadh');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    await u.selectOptions(screen.getByLabelText('Site'), '');
    await u.type(screen.getByLabelText('Search requisitions'), 'riyadh');
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
  // Meeting notes 2026-11-25 (item 1): opening-type + employment-type filters.
  it('filters by opening type and employment type', async () => {
    const u = userEvent.setup();
    serve({
      // The fixture defaults every row to employmentType 'Full-time'; give each
      // row a distinct value so the filters can be told apart.
      '/vacancy-requests': fx.requisitions.map((r) =>
        r.id === 'r412'
          ? { ...r, openingType: 'Replacement', employmentType: 'Contract' }
          : r.id === 'r415'
            ? { ...r, openingType: 'New position', employmentType: 'Full-time' }
            : r.id === 'r420'
              ? { ...r, openingType: 'New position', employmentType: 'Part-time' }
              : r.id === 'r421'
                ? { ...r, openingType: 'New position', employmentType: 'Temporary' }
                : { ...r, openingType: 'New position', employmentType: 'Part-time' },
      ),
    });
    renderAt();
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    await u.selectOptions(screen.getByLabelText('Opening type'), 'Replacement');
    expect(screen.getByTestId('loc')).toHaveTextContent('opening=Replacement');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('table')).toHaveTextContent('HRIS Developer');
    await u.selectOptions(screen.getByLabelText('Opening type'), '');
    await u.selectOptions(screen.getByLabelText('Employment type'), 'Contract');
    expect(screen.getByTestId('loc')).toHaveTextContent('employment=Contract');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('table')).toHaveTextContent('HRIS Developer');
    await u.selectOptions(screen.getByLabelText('Employment type'), 'Full-time');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('table')).toHaveTextContent('Laravel Backend Engineer');
  });
  it('sorts due date, newest, and title from the address', async () => {
    const earliest = renderAt('/vacancy-requests?sort=due');
    const earlyRows = within(await screen.findByRole('table')).getAllByRole('row').slice(1);
    expect(earlyRows[0]).toHaveTextContent('HRIS Developer');
    expect(earlyRows[1]).toHaveTextContent('Laravel Backend Engineer');
    expect(screen.getByLabelText('Sort')).toHaveValue('due');
    earliest.unmount();
    const latest = renderAt('/vacancy-requests?sort=due-desc');
    const lateRows = within(await screen.findByRole('table')).getAllByRole('row').slice(1);
    expect(lateRows[0]).toHaveTextContent('Laravel Backend Engineer');
    expect(lateRows[2]).toHaveTextContent('HRIS Developer');
    expect(lateRows[4]).toHaveTextContent('Integration Engineer');
    latest.unmount();
    const titledRun = renderAt('/vacancy-requests?sort=title');
    const titled = within(await screen.findByRole('table')).getAllByRole('row').slice(1);
    expect(titled.map((row) => within(row).getAllByRole('cell')[0].textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'BI Data Analyst', 'HRIS Developer', 'Integration Engineer', 'Laravel Backend Engineer', 'Payroll Systems Analyst',
    ]);
    titledRun.unmount();
    serve({
      '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r398' ? { ...r, createdAt: '2026-11-01T09:00:00Z' } : r)),
    });
    renderAt('/vacancy-requests?sort=created');
    expect(within(await screen.findByRole('table')).getAllByRole('row')[1]).toHaveTextContent('Integration Engineer');
    expect(screen.getByLabelText('Sort')).toHaveValue('created');
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
  it('B2F-5 new: due date required (Save/Activate disabled), no Submit for approval; Activate creates then activates', async () => {
    const u = userEvent.setup();
    api.postApi.mockImplementation(async (p: string) => (p === '/vacancy-requests' ? { ...fx.requisitions[3], id: 'r-new' } : { request: { id: 'r-new', status: 'Converted to Vacancy' } }));
    const { baseElement } = renderAt();
    await u.click(await screen.findByRole('button', { name: 'New requisition' }));
    const d = await screen.findByRole('dialog', { name: 'New requisition' });
    expect(within(d).getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(within(d).getByRole('button', { name: 'Activate job' })).toBeDisabled();
    expect(within(d).queryByRole('button', { name: /Submit for approval/ })).toBeNull();
    await u.selectOptions(within(d).getByLabelText(/^Title/), 'p-payroll');
    await u.selectOptions(within(d).getByLabelText(/^Site/), 'b-riyadh');
    await u.selectOptions(within(d).getByLabelText(/^Grade/), 'g7');
    expect(within(d).queryByRole('option', { name: 'Grade 9 (old)' })).toBeNull();
    await u.type(within(d).getByLabelText(/^Due date/), '2099-11-20');
    await u.selectOptions(within(d).getByLabelText(/^Primary recruiter/), 'u-youssef');
    expect(within(d).queryByRole('option', { name: /Old Recruiter/ })).toBeNull();
    expect(await axeViolations(baseElement)).toEqual([]);
    await u.click(within(d).getByRole('button', { name: 'Activate job' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests/r-new/activate', { assignedEmployeeId: 'u-youssef' }));
    // Meeting notes 2026-11-25 (item 1): the drawer now sends the opening details too.
    expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests', { positionId: 'p-payroll', branchId: 'b-riyadh', requestedHeadcount: 1, dueDate: '2099-11-20', gradeId: 'g7', assignedEmployeeId: 'u-youssef', justification: null, openingType: 'New position', replacedEmployeeId: null, employmentType: null, reason: null, reasonNote: null, nationalityPreference: [] });
    expect(api.postApi).not.toHaveBeenCalledWith(expect.stringMatching(/\/submit$/), expect.anything());
    expect(await screen.findByRole('status')).toHaveTextContent('Job active — Payroll Systems Analyst is now in Youssef Ibrahim’s Open jobs.');
  });
  it('draft edit → PATCH; DUE_DATE_REQUIRED by code lands on the field', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ id: 'r421' });
    api.postApi.mockRejectedValue(new ApiError(400, 'Request REQ-IT-0421 needs a due date', { code: 'DUE_DATE_REQUIRED', message: 'Request REQ-IT-0421 needs a due date (dueDate / targetFillDate) before it can leave Draft.' }, { code: 'DUE_DATE_REQUIRED' }));
    renderAt('/vacancy-requests?req=r421');
    const d = await screen.findByRole('dialog', { name: 'Payroll Systems Analyst' });
    expect(within(d).getByLabelText(/^Notes/)).toHaveValue('Backfill for Payroll HRIS support. Arabic and English. Oracle HCM payroll a must.');
    await u.type(within(d).getByLabelText(/^Due date/), '2099-11-20');
    await u.click(within(d).getByRole('button', { name: 'Activate job' }));
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
  it('reqError: codes, 403, message fallback', () => {
    expect(reqError(new ApiError(400, 'm', { code: 'ASSIGNEE_REQUIRED', message: 'needs owner' }, { code: 'ASSIGNEE_REQUIRED' }))).toEqual({ field: 'assignee', text: 'needs owner' });
    expect(reqError(new ApiError(403, 'x', undefined, { code: 'FORBIDDEN' })).text).toMatch(/permission/);
    expect(reqError(new ApiError(409, 'Request REQ-1 cannot be updated from Approved.', undefined, { code: 'CONFLICT' })).text).toBe('Request REQ-1 cannot be updated from Approved.');
  });
});

describe('M1 CoS follow-ups', () => {
  it('draft with a due date: Activate job saves then activates; a refusal is explained, never “submit”', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ id: 'r421' });
    api.postApi.mockRejectedValueOnce(new ApiError(409, 'Request REQ-IT-0421 must be approved before activation.'));
    renderAt('/vacancy-requests?req=r421');
    const d = await screen.findByRole('dialog', { name: 'Payroll Systems Analyst' });
    expect(within(d).getByRole('button', { name: 'Activate job' })).toBeDisabled();
    await u.type(within(d).getByLabelText(/^Due date/), '2099-11-20');
    await u.click(within(d).getByRole('button', { name: 'Activate job' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests/r421/activate', { assignedEmployeeId: 'u-youssef' }));
    expect(api.patchApi).toHaveBeenCalledWith('/vacancy-requests/r421', expect.objectContaining({ dueDate: '2099-11-20' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('could not be activated — your changes are saved as a draft. Request REQ-IT-0421 must be approved before activation.');
    expect(within(d).queryByRole('button', { name: /Submit for approval/ })).toBeNull();
    api.postApi.mockResolvedValueOnce({ request: { id: 'r421' } });
    await u.click(within(d).getByRole('button', { name: 'Activate job' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Job active — Payroll Systems Analyst is now in Youssef Ibrahim’s Open jobs.');
  });
  it('B2F-5: a team member’s draft with a due date activates too (HM and TM); no Submit anywhere', async () => {
    serve({ '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r421' ? { ...r, requesterId: 'u-other', dueDate: '2099-11-20', targetFillDate: '2099-11-20' } : r)) });
    renderAt('/vacancy-requests?req=r421');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('button', { name: 'Activate job' })).toBeEnabled();
    expect(within(d).queryByRole('button', { name: /Submit for approval/ })).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('Draft → Pending approval → Job active');
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
    const table = await screen.findByRole('table');
    expect(within(table).queryByRole('columnheader', { name: 'Department' })).toBeNull();
    const rows = within(table).getAllByRole('row');
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
  it('live target update posts seats, due and reason, and refuses a cut below joined hires', async () => {
    expect(TARGET_UPDATE_LIVE).toBe(true);
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ id: 'r412' });
    const onDone = vi.fn();
    const live = fx.requisitions[0] as never;
    const { unmount } = render(<TargetDrawer req={live} people={null} canActivate targetUpdate={false} onClose={() => {}} onDone={onDone} />);
    expect(screen.getByLabelText(/^Seats/)).toBeDisabled();
    expect(screen.queryByLabelText(/^Reason for the change/)).toBeNull();
    unmount();
    const blocked = { ...fx.requisitions[0], targetChip: { ...fx.requisitions[0].targetChip, filled: 2 } } as never;
    const { unmount: unmountBlocked } = render(<TargetDrawer req={blocked} people={null} canActivate onClose={() => {}} onDone={onDone} />);
    await u.clear(screen.getByLabelText(/^Seats/));
    await u.type(screen.getByLabelText(/^Seats/), '1');
    expect(screen.getByText(/cannot drop below 2 already joined/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Save target' }));
    expect(api.patchApi).not.toHaveBeenCalled();
    unmountBlocked();
    render(<TargetDrawer req={live} people={null} canActivate onClose={() => {}} onDone={onDone} />);
    await u.clear(screen.getByLabelText(/^Seats/)); await u.type(screen.getByLabelText(/^Seats/), '4');
    await u.click(screen.getByRole('button', { name: 'Save target' }));
    expect(await screen.findByText(/Say why the target changes/)).toBeInTheDocument();
    await u.type(screen.getByLabelText(/^Reason for the change/), 'Second shift approved');
    await u.click(screen.getByRole('button', { name: 'Save target' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/vacancy-requests/r412/target', { seats: 4, dueDate: '2026-10-19', reason: 'Second shift approved' }));
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('1 of 4'));
  });
  it('changes requested resubmits and does not activate', async () => {
    const u = userEvent.setup();
    serve({ '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r421' ? { ...r, status: 'Changes Requested', dueDate: '2099-11-20', targetFillDate: '2099-11-20' } : r)) });
    api.patchApi.mockResolvedValue({ id: 'r421' });
    api.postApi.mockResolvedValue({ id: 'r421', status: 'Pending Approval' });
    renderAt('/vacancy-requests?req=r421');
    const d = await screen.findByRole('dialog');
    expect(within(d).queryByRole('button', { name: 'Activate job' })).toBeNull();
    expect(within(d).queryByRole('button', { name: /Submit for approval/ })).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'Resubmit' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests/r421/submit', {}));
    expect(api.postApi).not.toHaveBeenCalledWith(expect.stringMatching(/\/activate$/), expect.anything());
  });
  it('pending approval is decided only with VACANCY_REQUEST_APPROVE', async () => {
    const u = userEvent.setup();
    serve({ '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r421' ? { ...r, status: 'Pending Approval', dueDate: '2099-11-20', targetFillDate: '2099-11-20' } : r)) });
    const { unmount } = renderAt('/vacancy-requests?req=r421');
    const waiting = await screen.findByRole('dialog');
    expect(waiting).toHaveTextContent('Waiting on approval');
    expect(within(waiting).queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(within(waiting).queryByRole('button', { name: 'Activate job' })).toBeNull();
    unmount();
    auth.perms = ['VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_MANAGE', 'VACANCY_REQUEST_APPROVE'];
    api.postApi.mockResolvedValue({ id: 'r421', status: 'Changes Requested' });
    renderAt('/vacancy-requests?req=r421');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Request changes' }));
    expect(await within(d).findByText(/at least 3 characters/)).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/^Decision note/), 'Need a later due date');
    await u.click(within(d).getByRole('button', { name: 'Request changes' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests/r421/request-changes', { comment: 'Need a later due date' }));
  });
  it('cancellation stays disabled while an interview, offer, or joining commitment is open', async () => {
    serve({
      '/vacancy-requests/r412/cancel-impact': {
        canClose: false,
        commitments: [{ kind: 'interview', id: 'i1', label: 'Sample interview', status: 'Scheduled', applicationId: 'a1' }],
        activeApplications: 2,
        joinedApplications: 1,
        message: 'Resolve 1 interview before this job can close. 1 joined hire stays, and history stays.',
      },
    });
    renderAt('/vacancy-requests?req=r412');
    const d = await screen.findByRole('dialog', { name: 'HRIS Developer' });
    expect(await within(d).findByText(/Resolve 1 interview/)).toBeInTheDocument();
    expect(within(d).getByRole('link', { name: 'Sample interview' })).toHaveAttribute('href', '/applications/a1');
    expect(within(d).getByRole('button', { name: 'Cancel requisition' })).toBeDisabled();
  });
  it('a requisition outside the team does not open', async () => {
    renderAt('/vacancy-requests?req=r-other');
    expect(await screen.findByText(/not in your team or organization/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('B2F-6 / #23 2d76bdd: cancel sends {reason: close-list value, note} — "Other" needs a note; no "Other: text" string', async () => {
    const u = userEvent.setup();
    serve({ '/master-data/catalog/close-reasons': [{ id: 'c1', name: 'Budget cut', status: 'Active' }, { id: 'c2', name: 'Other', status: 'Active' }, { id: 'c3', name: 'Old', status: 'Archived' }] });
    api.postApi.mockResolvedValue({ request: { id: 'r412', status: 'Cancelled' }, closedJob: true, rejectedApplications: 0 });
    renderAt('/vacancy-requests?req=r412');
    const d = await screen.findByRole('dialog', { name: 'HRIS Developer' });
    const pick = await within(d).findByRole('combobox', { name: /^Reason to cancel/ });
    expect(within(pick).queryByRole('option', { name: 'Old' })).toBeNull();
    await u.selectOptions(pick, 'Other');
    await u.click(within(d).getByRole('button', { name: 'Cancel requisition' }));
    await u.click(within(d).getByRole('button', { name: /Confirm cancel/ }));
    expect(await within(d).findByText(/"Other" needs a short note/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.type(within(d).getByLabelText(/^Say why/), 'Merged into REQ-9');
    await u.click(within(d).getByRole('button', { name: 'Cancel requisition' }));
    await u.click(within(d).getByRole('button', { name: /Confirm cancel/ }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/vacancy-requests/r412/cancel', { reason: 'Other', note: 'Merged into REQ-9' }));
  });
});

describe('Backend #21/#23 batch 2', () => {
  it('#21 B2-16: primaryRecruiter{id,name} names the owner; no client fill when the server sends it', () => {
    const r = { ...fx.requisitions[0], assignedEmployeeId: 'u-mariam', primaryRecruiter: { id: 'u-noura', name: 'Noura Al-Dosari' } } as never;
    expect(ownerOf(r, [{ id: 'u-mariam', name: 'Mariam Farag' }])).toBe('Noura Al-Dosari');
    expect(ownerOf({ ...fx.requisitions[0], assignedEmployeeId: 'u-mariam', primaryRecruiter: null } as never, [{ id: 'u-mariam', name: 'Mariam Farag' }])).toBe('—');
    expect(ownerOf({ ...fx.requisitions[0], assignedEmployeeId: 'u-mariam' } as never, [{ id: 'u-mariam', name: 'Mariam Farag' }])).toBe('Mariam Farag');
    expect(mineOrTeam([{ ...fx.requisitions[5], primaryRecruiter: { id: 'u-mariam', name: 'Mariam Farag' } } as never], 'u-karim', [{ id: 'u-mariam', name: 'Mariam Farag' }])).toHaveLength(1);
  });
  it('#23: a 400 with fields lands on Seats and Due date; the banner stays empty', async () => {
    const u = userEvent.setup();
    const fields = { requestedHeadcount: ['requestedHeadcount must not be greater than 500'], dueDate: ['dueDate must be a valid ISO 8601 date string'] };
    api.postApi.mockRejectedValue(new ApiError(400, 'x', { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', field: 'requestedHeadcount', fields }, { code: 'VALIDATION_ERROR', fields }));
    renderAt();
    await u.click(await screen.findByRole('button', { name: 'New requisition' }));
    const d = await screen.findByRole('dialog', { name: 'New requisition' });
    await u.selectOptions(within(d).getByLabelText(/^Title/), 'p-payroll');
    await u.selectOptions(within(d).getByLabelText(/^Site/), 'b-riyadh');
    await u.type(within(d).getByLabelText(/^Due date/), '2099-11-20');
    await u.click(within(d).getByRole('button', { name: 'Save draft' }));
    expect(await within(d).findByText('requestedHeadcount must not be greater than 500')).toBeInTheDocument();
    expect(within(d).getByText('dueDate must be a valid ISO 8601 date string')).toBeInTheDocument();
    expect(within(d).getByLabelText(/^Seats/)).toHaveAttribute('aria-invalid', 'true');
    expect(within(d).queryByText('Please correct the highlighted fields.')).toBeNull();
  });
});

describe('M05–M09 requisition cluster', () => {
  it('lists details and edit actions, and explains the rules, without a second approval note', async () => {
    const u = userEvent.setup();
    renderAt();
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('button', { name: 'Update target: HRIS Developer' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Continue draft: Payroll Systems Analyst' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    await u.click(within(table).getByRole('button', { name: 'More actions: HRIS Developer' }));
    expect(screen.getByRole('menuitem', { name: 'View details: HRIS Developer' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit requisition: HRIS Developer' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Close requisition: HRIS Developer' })).toBeInTheDocument();
    const rules = screen.getByText('Learn activation and approval rules').closest('details');
    expect(rules).toHaveTextContent('activate directly under policy');
    expect(rules).toHaveTextContent('stay Pending approval until approved');
    expect(rules).toHaveTextContent('"0 of X" operational fill progress is distinct from "No target"');
    expect(screen.getAllByRole('note')).toHaveLength(1);
    expect(screen.getByRole('note')).toHaveTextContent('Requisitions follow an approval flow: Draft → Pending approval → Job active.');
  });

  it('clears search, status, site, owner, due, and sort together', async () => {
    const u = userEvent.setup();
    renderAt('/vacancy-requests?status=Draft&q=pay&site=SGH+Riyadh&owner=Mariam+Farag&due=2026-11-01&sort=title');
    await u.click(await screen.findByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/vacancy-requests');
    expect(screen.getByTestId('loc').textContent).not.toMatch(/status|q=|site=|owner=|due=|sort=/);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('keeps ?req= on the requisition drawer, and opens detail or edit only for those modes', async () => {
    const u = userEvent.setup();
    const { unmount } = renderAt('/vacancy-requests?req=r412');
    expect(await screen.findByRole('dialog', { name: 'HRIS Developer' })).toBeInTheDocument();
    unmount();
    const detail = renderAt('/vacancy-requests?req=r412&view=detail');
    expect(await screen.findByRole('heading', { level: 2, name: 'HRIS Developer' })).toBeInTheDocument();
    expect(screen.getAllByText('3 requested seats').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 of 3 filled').length).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    detail.unmount();
    const editing = renderAt('/vacancy-requests?req=r421&mode=edit');
    expect(await screen.findByRole('region', { name: 'Change impact' })).toHaveTextContent('Editing primary recruiter on a requisition changes job ownership only.');
    expect(screen.queryByRole('dialog')).toBeNull();
    await u.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    await u.click(await screen.findByRole('button', { name: 'Payroll Systems Analyst' }));
    expect(await screen.findByRole('dialog', { name: 'Payroll Systems Analyst' })).toBeInTheDocument();
    editing.unmount();
  });

  it('detail tabs stay truthful, and close opens the existing cancel drawer', async () => {
    const u = userEvent.setup();
    const { unmount } = renderAt('/vacancy-requests?req=r412&drawer=detail');
    expect(await screen.findByRole('heading', { level: 2, name: 'HRIS Developer' })).toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: 'Hiring progress' }));
    const progress = screen.getByRole('tabpanel');
    for (const stage of ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-hire', 'Joined']) expect(progress).toHaveTextContent(stage);
    expect(progress).toHaveTextContent('These counts are 0');
    expect(progress).not.toHaveTextContent('%');
    await u.click(screen.getByRole('tab', { name: 'Team & ownership' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Mariam Farag');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Karim Hassan');
    expect(screen.getByRole('link', { name: 'Team work' })).toHaveAttribute('href', '/my-work');
    await u.click(screen.getByRole('tab', { name: 'Activity & approvals' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Activated');
    await u.click(screen.getByRole('button', { name: 'Close / cancel requisition' }));
    expect(await screen.findByRole('dialog', { name: 'HRIS Developer' })).toHaveTextContent('Reason to cancel');
    unmount();
    renderAt('/vacancy-requests?req=r398&drawer=detail');
    await u.click(await screen.findByRole('tab', { name: 'Activity & approvals' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('budget moved to FY27');
    expect(screen.queryByRole('button', { name: 'Close / cancel requisition' })).toBeNull();
  });

  it('saves an editable requisition and restores the last saved values', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ id: 'r421' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
    renderAt('/vacancy-requests?req=r421&drawer=edit');
    const impact = await screen.findByRole('region', { name: 'Change impact' });
    expect(impact).toHaveTextContent('No unsaved changes.');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await u.clear(screen.getByLabelText(/^Seats/));
    await u.type(screen.getByLabelText(/^Seats/), '2');
    await u.type(screen.getByLabelText(/^Due date/), '2099-11-20');
    expect(impact).toHaveTextContent('Seats: 1 → 2');
    await u.click(screen.getByRole('button', { name: 'Reset to last saved' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText(/^Seats/)).toHaveValue(1);
    expect(screen.getByLabelText(/^Due date/)).toHaveValue('');
    await u.clear(screen.getByLabelText(/^Seats/));
    await u.type(screen.getByLabelText(/^Seats/), '2');
    await u.type(screen.getByLabelText(/^Due date/), '2099-11-20');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/vacancy-requests/r421', expect.objectContaining({
      positionId: 'p-payroll', branchId: 'b-riyadh', requestedHeadcount: 2, dueDate: '2099-11-20', assignedEmployeeId: 'u-youssef',
    })));
    expect(await screen.findByRole('status')).toHaveTextContent('Payroll Systems Analyst changes saved.');
    } finally {
      confirm.mockRestore();
    }
  });

  it('a live job edit stays locked', async () => {
    renderAt('/vacancy-requests?req=r412&drawer=edit');
    const impact = await screen.findByRole('region', { name: 'Change impact' });
    expect(impact).toHaveTextContent('No fields are editable while the status is Job active.');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('create checklist resets a dirty draft and never offers submit', async () => {
    const u = userEvent.setup();
    renderAt();
    await u.click(await screen.findByRole('button', { name: 'New requisition' }));
    const d = await screen.findByRole('dialog', { name: 'New requisition' });
    const progress = within(d).getByRole('region', { name: 'Requisition progress' });
    expect(progress).toHaveTextContent('Draft → Pending approval → Approved / Changes requested / Declined → Job active (or direct activation when policy allows)');
    expect(progress).toHaveTextContent('Needed — Title selected');
    expect(progress).toHaveTextContent('Done — Seats >= 1');
    expect(within(d).queryByRole('button', { name: 'Reset form' })).toBeNull();
    expect(within(d).queryByRole('button', { name: /Submit for approval/ })).toBeNull();
    await u.selectOptions(within(d).getByLabelText(/^Title/), 'p-payroll');
    expect(progress).toHaveTextContent('Done — Title selected');
    await u.click(within(d).getByRole('button', { name: 'Reset form' }));
    expect(within(d).getByLabelText(/^Title/)).toHaveValue('');
    expect(within(d).queryByRole('button', { name: 'Reset form' })).toBeNull();
  });

  it('target summary, milestone preview, and reset stay out of the save payload', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ id: 'r421' });
    const { unmount } = renderAt('/vacancy-requests?req=r421&drawer=target');
    const add = await screen.findByRole('dialog', { name: 'Add target — Payroll Systems Analyst' });
    expect(add).toHaveTextContent('Payroll Systems Analyst · REQ-IT-0421 · 1 requested seats · 0 filled');
    expect(add).toHaveTextContent('Current target: Not set');
    expect(within(add).queryByRole('button', { name: 'Reset' })).toBeNull();
    await u.clear(within(add).getByLabelText(/^Seats/));
    await u.type(within(add).getByLabelText(/^Seats/), '3');
    await u.type(within(add).getByLabelText(/^Due date/), '2026-10-19');
    await u.type(within(add).getByLabelText(/^Milestone note/), 'First screen by Friday');
    expect(within(add).getByRole('region', { name: /Preview — Youssef Ibrahim’s My Work/ })).toHaveTextContent('Milestone: First screen by Friday');
    await u.click(within(add).getByRole('button', { name: 'Save target' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/vacancy-requests/r421', { requestedHeadcount: 3, dueDate: '2026-10-19', assignedEmployeeId: 'u-youssef' }));
    unmount();
    renderAt('/vacancy-requests?req=r420&drawer=target');
    const edit = await screen.findByRole('dialog', { name: 'Edit target — BI Data Analyst' });
    expect(edit).toHaveTextContent('Current target: 0 of 1 by 30 Oct 2026');
    expect(edit).toHaveTextContent('Target updates are recorded in the requisition audit trail.');
    await u.selectOptions(within(edit).getByLabelText(/^Assign to/), 'u-mariam');
    await u.click(within(edit).getByRole('button', { name: 'Reset' }));
    expect(within(edit).getByLabelText(/^Assign to/)).toHaveValue('u-youssef');
  });
});

describe('M05 to M06, M07, M08, and M09', () => {
  it('walks create, requisition details, edit impact, and target preview', async () => {
    const u = userEvent.setup();
    const list = renderAt();
    await u.click(await screen.findByRole('button', { name: 'New requisition' }));
    const created = await screen.findByRole('dialog', { name: 'New requisition' });
    expect(within(created).getByRole('region', { name: 'Requisition progress' })).toHaveTextContent('Draft → Pending approval');
    expect(within(created).queryByRole('button', { name: /Submit for approval/ })).toBeNull();
    list.unmount();

    const detail = renderAt('/vacancy-requests?req=r412&drawer=detail');
    expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getAllByText('3 requested seats').length).toBeGreaterThan(0);
    await u.click(screen.getByRole('tab', { name: 'Hiring progress' }));
    expect(screen.getByRole('heading', { name: 'Hiring progress' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('These counts are 0');
    await u.click(screen.getByRole('tab', { name: 'Team & ownership' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Mariam Farag');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('primary recruiter');
    expect(screen.getByRole('link', { name: 'Team work' })).toHaveAttribute('href', '/my-work');
    await u.click(screen.getByRole('tab', { name: 'Activity & approvals' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Activated');
    detail.unmount();

    const editing = renderAt('/vacancy-requests?req=r421&drawer=edit');
    const impact = await screen.findByRole('region', { name: 'Change impact' });
    expect(impact).toHaveTextContent('Editing primary recruiter on a requisition changes job ownership only.');
    expect(impact).toHaveTextContent('Open candidate application files remain with their current primary recruiter until reassigned in Team work (M04).');
    editing.unmount();

    const adding = renderAt('/vacancy-requests?req=r421&drawer=target');
    const add = await screen.findByRole('dialog', { name: 'Add target — Payroll Systems Analyst' });
    expect(within(add).queryByRole('button', { name: 'Reset' })).toBeNull();
    await u.clear(within(add).getByLabelText(/^Seats/));
    await u.type(within(add).getByLabelText(/^Seats/), '3');
    await u.type(within(add).getByLabelText(/^Due date/), '2026-10-19');
    await u.type(within(add).getByLabelText(/^Milestone note/), 'First screen by Friday');
    expect(within(add).getByRole('region', { name: /Preview — Youssef Ibrahim’s My Work/ })).toHaveTextContent('Milestone: First screen by Friday');
    adding.unmount();

    renderAt('/vacancy-requests?req=r420&drawer=target');
    const edit = await screen.findByRole('dialog', { name: 'Edit target — BI Data Analyst' });
    await u.selectOptions(within(edit).getByLabelText(/^Assign to/), 'u-mariam');
    await u.click(within(edit).getByRole('button', { name: 'Reset' }));
    expect(within(edit).getByLabelText(/^Assign to/)).toHaveValue('u-youssef');
  });
});

describe('Requisition summary, filters, and row actions', () => {
  it('counts the manager’s visible requisitions, including an empty pending card', async () => {
    renderAt();
    expect(await screen.findByRole('button', { name: 'Total requisitions, 5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Active (job active), 2' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Pending approval, 0' }).querySelector('[data-tone="danger"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filled, 0' })).toBeInTheDocument();
    expect(screen.getByText('5 requisitions')).toBeInTheDocument();
  });

  it('clicking Pending approval filters the rows and leaves the total on the full list', async () => {
    const u = userEvent.setup();
    serve({ '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r421' ? { ...r, status: 'Pending Approval' } : r)) });
    renderAt();
    const card = await screen.findByRole('button', { name: 'Pending approval, 1' });
    expect(card.querySelector('[data-tone="danger"]')).not.toBeNull();
    await u.click(card);
    expect(screen.getByTestId('loc')).toHaveTextContent('status=Pending+Approval');
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Payroll Systems Analyst');
    expect(rows[0]).toHaveTextContent('Pending approval');
    expect(screen.getByRole('button', { name: 'Total requisitions, 5' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 requisition')).toBeInTheDocument();
  });

  it('counts a met hiring target as filled and filters to that requisition', async () => {
    const u = userEvent.setup();
    serve({
      '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r412' ? { ...r, targetChip: { ...r.targetChip!, filled: 3, target: 3, label: '3 of 3' } } : r)),
    });
    renderAt();
    expect(await screen.findByRole('button', { name: 'Filled, 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active (job active), 2' })).toBeInTheDocument();
    const filled = within(screen.getByRole('table')).getAllByRole('row').slice(1)[0];
    expect(filled).toHaveTextContent('Filled');
    expect(filled).toHaveTextContent('3 of 3 (100%)');
    await u.click(screen.getByRole('button', { name: 'Filled, 1' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('status=Filled');
    expect(within(screen.getByRole('table')).getAllByRole('row').slice(1)).toHaveLength(1);
    expect(screen.getByRole('table')).toHaveTextContent('HRIS Developer');
    expect(screen.getByRole('button', { name: 'Total requisitions, 5' })).toBeInTheDocument();
  });

  it('applies status, site, owner, search, and sort together', async () => {
    const u = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    await u.selectOptions(screen.getByLabelText('Status'), 'Converted to Vacancy');
    await u.selectOptions(screen.getByLabelText('Site'), 'Offshore Cairo');
    await u.selectOptions(screen.getByLabelText('Owner'), 'Mariam Farag');
    await u.selectOptions(screen.getByLabelText('Sort'), 'title');
    await u.type(screen.getByLabelText('Search requisitions'), 'laravel');
    expect(screen.getByTestId('loc').textContent).toMatch(/status=Converted\+to\+Vacancy/);
    expect(screen.getByTestId('loc').textContent).toMatch(/site=Offshore\+Cairo/);
    expect(screen.getByTestId('loc').textContent).toMatch(/owner=Mariam\+Farag/);
    expect(screen.getByTestId('loc').textContent).toMatch(/sort=title/);
    expect(screen.getByTestId('loc').textContent).toMatch(/q=laravel/);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Laravel Backend Engineer');
    expect(screen.getByText('1 requisition')).toBeInTheDocument();
  });

  it('shows progress text and percent from the hiring target', async () => {
    renderAt();
    const table = await screen.findByRole('table');
    const hris = within(table).getByRole('progressbar', { name: 'Hiring progress for HRIS Developer' });
    expect(hris).toHaveAttribute('aria-valuenow', '33');
    expect(hris).toHaveAttribute('aria-valuetext', '1 of 3 (33%)');
    const laravel = within(table).getByRole('progressbar', { name: 'Hiring progress for Laravel Backend Engineer' });
    expect(laravel).toHaveAttribute('aria-valuenow', '0');
    expect(laravel).toHaveAttribute('aria-valuetext', '0 of 2 (0%)');
    expect(laravel.parentElement).toHaveTextContent('0 of 2 (0%)');
    const payroll = within(table).getAllByRole('row').find((row) => within(row).queryByRole('button', { name: 'Payroll Systems Analyst' }))!;
    expect(within(payroll).queryByRole('progressbar')).toBeNull();
    expect(within(payroll).getAllByRole('cell')[7]).toHaveTextContent('—');
  });

  it('opens the contextual action for each status in the matching drawer', async () => {
    const u = userEvent.setup();
    serve({
      '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r415' ? { ...r, dueDate: null, targetFillDate: null, targetChip: { ...r.targetChip!, dueDate: null } } : r)),
    });
    const add = renderAt();
    await u.click(await screen.findByRole('button', { name: 'Add target: Laravel Backend Engineer' }));
    expect(await screen.findByRole('dialog', { name: 'Add target — Laravel Backend Engineer' })).toBeInTheDocument();
    add.unmount();

    serve();
    const update = renderAt();
    await u.click(await screen.findByRole('button', { name: 'Update target: HRIS Developer' }));
    expect(await screen.findByRole('dialog', { name: 'Edit target — HRIS Developer' })).toBeInTheDocument();
    update.unmount();

    serve({ '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r421' ? { ...r, status: 'Pending Approval' } : r)) });
    const pending = renderAt();
    await u.click(await screen.findByRole('button', { name: 'View request: Payroll Systems Analyst' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Payroll Systems Analyst' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    pending.unmount();

    serve({ '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r421' ? { ...r, status: 'Changes Requested' } : r)) });
    const changes = renderAt();
    await u.click(await screen.findByRole('button', { name: 'Continue draft: Payroll Systems Analyst' }));
    expect(await screen.findByRole('region', { name: 'Change impact' })).toBeInTheDocument();
    changes.unmount();

    serve();
    renderAt();
    await u.click(await screen.findByRole('button', { name: 'View details: Integration Engineer' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Integration Engineer' })).toBeInTheDocument();
  });

  it('offers an empty filtered list a way to clear filters', async () => {
    const u = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    await u.type(screen.getByLabelText('Search requisitions'), 'zzzz-no-match');
    expect(await screen.findByRole('heading', { name: 'No requisitions match these filters' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('table')).toHaveTextContent('HRIS Developer');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    expect(screen.getByText('5 requisitions')).toBeInTheDocument();
  });

  it('puts the contextual action and overflow on one row, and shows a sub-line and letter initials', async () => {
    serve({
      '/vacancy-requests': fx.requisitions.map((r) => (r.id === 'r412'
        ? { ...r, departmentName: 'Information Technology', primaryRecruiter: { id: 'u-zenah', name: 'Zenah (Recruiter)' } }
        : r.id === 'r415'
          ? { ...r, positionTitle: 'Radiology Technician', position: { title: 'Radiology Technician' } }
          : r)),
    });
    renderAt();
    const title = await screen.findByRole('button', { name: 'HRIS Developer' });
    const sub = title.parentElement?.querySelector('.rf2-reqs__sub');
    expect(sub).toHaveTextContent('Information Technology · HRIS Developer');
    expect(sub).toHaveAttribute('title', 'Information Technology · HRIS Developer');
    const row = title.closest('tr')!;
    expect(row.querySelector('.rf2-avatar')).toHaveTextContent('Z');
    expect(row.querySelector('.rf2-avatar')?.textContent).not.toMatch(/[^A-Z?]/);
    expect(row.querySelector('.rf2-reqs__tile svg')).toHaveClass('lucide-briefcase');
    const imaging = screen.getByRole('button', { name: 'Radiology Technician' });
    expect(imaging.closest('td')?.querySelector('.rf2-reqs__tile svg')).toHaveClass('lucide-scan-line');
    const acts = row.querySelector('.rf2-reqs__acts') as HTMLElement;
    expect(within(acts).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Update target: HRIS Developer',
      'More actions: HRIS Developer',
    ]);
  });

  it('stacks each requisition as a card below 768px and keeps the same action names', async () => {
    const real = window.matchMedia;
    window.matchMedia = ((query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      return {
        matches: max ? Number(max[1]) >= 767 : false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
        onchange: null,
        addListener() {},
        removeListener() {},
      };
    }) as unknown as typeof window.matchMedia;
    try {
      renderAt();
      expect(await screen.findByRole('button', { name: 'Update target: HRIS Developer' })).toBeInTheDocument();
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.getByRole('button', { name: 'More actions: HRIS Developer' })).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: 'Hiring progress for Laravel Backend Engineer' })).toHaveAttribute('aria-valuetext', '0 of 2 (0%)');
      const card = screen.getByRole('button', { name: 'HRIS Developer' }).closest('li')!;
      expect(card).toHaveTextContent('REQ-IT-0412 · Offshore Cairo');
      expect(card).toHaveTextContent('3 seats · 19 Oct 2026');
      const acts = card.querySelector('.rf2-reqs__acts') as HTMLElement;
      expect(within(acts).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
        'Update target: HRIS Developer',
        'More actions: HRIS Developer',
      ]);
    } finally {
      window.matchMedia = real;
    }
  });
});

describe('Jobs and requisitions desk', () => {
  it('keeps every requisition status on one list instead of an Open jobs tab', async () => {
    const u = userEvent.setup();
    renderAt('/vacancy-requests?desk=jobs');
    const table = await screen.findByRole('table');
    expect(screen.queryByRole('tab', { name: 'Open jobs' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Requests' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Closed' })).toBeNull();
    expect(table).toHaveTextContent('HRIS Developer');
    expect(table).toHaveTextContent('Payroll Systems Analyst');
    expect(table).toHaveTextContent('Integration Engineer');
    expect(screen.queryByText('Job list is not available')).toBeNull();
    expect(screen.queryByText('This is not zero jobs')).toBeNull();
    await u.selectOptions(screen.getByLabelText('Status'), 'Converted to Vacancy');
    expect(screen.getByRole('table')).toHaveTextContent('HRIS Developer');
    expect(screen.getByRole('table')).not.toHaveTextContent('Payroll Systems Analyst');
    await u.selectOptions(screen.getByLabelText('Status'), 'Cancelled');
    expect(screen.getByRole('table')).toHaveTextContent('Integration Engineer');
    expect(screen.getByRole('table')).not.toHaveTextContent('HRIS Developer');
  });

  it('does not replace requisitions with work-queue jobs', async () => {
    serve({
      '/vacancies/work-queue?page=1&pageSize=100': {
        data: [
          { id: 'v1', code: 'VAC-1', title: 'Ward Nurse', status: 'Open', branch: { id: 'b', name: 'SGH Jeddah' }, owner: { id: 'u-mariam', displayName: 'Mariam Farag' }, headcount: { approved: 2, joined: 1, remaining: 1 }, pipelineCounts: {}, needsActionCount: 0, health: null, lastActivity: null, nextAction: null },
          { id: 'v2', code: 'VAC-2', title: 'Someone else', status: 'Open', branch: { id: 'b', name: 'SGH Jeddah' }, owner: { id: 'u-other', displayName: 'Other' }, headcount: { approved: 1, joined: 0, remaining: 1 }, pipelineCounts: {}, needsActionCount: 0, health: null, lastActivity: null, nextAction: null },
        ],
        total: 2,
      },
    });
    renderAt('/vacancy-requests?desk=jobs');
    const table = await screen.findByRole('table');
    expect(table).toHaveTextContent('HRIS Developer');
    expect(table).toHaveTextContent('Payroll Systems Analyst');
    expect(screen.queryByRole('link', { name: 'Ward Nurse' })).toBeNull();
    expect(screen.queryByText('Someone else')).toBeNull();
    expect(screen.queryByText('Staff Nurse NICU')).toBeNull();
  });

  it('extracts requirements from JD file, auto-matches title/site, allows adding/removing skills, and syncs on save', async () => {
    const u = userEvent.setup();
    vi.spyOn(jdParser, 'parseJobDescriptionFile').mockResolvedValueOnce({
      title: 'HRIS Developer',
      department: 'Information Technology',
      location: 'SGH Riyadh',
      minExperienceYears: 4,
      requiredSkills: ['SQL Database Development', 'Power Platform', 'Full-Stack Web Development'],
      qualifications: "Bachelor's degree in Computer Science or IT",
      responsibilities: 'Build HR workflows and reports',
      jobSummary: 'Develop and maintain HR systems and digital solutions.',
      languages: ['English', 'Arabic'],
      rawText: 'Mock raw text',
    });

    api.postApi.mockImplementation(async (p: string) => {
      if (p === '/vacancy-requests') {
        return { ...fx.requisitions[3], id: 'r-extracted', positionId: 'p-hris', branchId: 'b-riyadh' };
      }
      if (p === '/master-data/catalog/skills/batch') {
        return { count: 3 };
      }
      return {};
    });

    const { baseElement } = renderAt('/vacancy-requests');
    await u.click(await screen.findByRole('button', { name: 'New requisition' }));

    const drawer = await screen.findByRole('dialog', { name: 'New requisition' });
    expect(within(drawer).getByText('Extract requirements from JD')).toBeInTheDocument();
    expect(within(drawer).getByText('Word (.docx) · PDF (.pdf) · Text')).toBeInTheDocument();

    const fileInput = drawer.querySelector('#req-jd-file-input') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const file = new File(['dummy content'], 'HRIS_Job_Description.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await u.upload(fileInput, file);

    expect(await within(drawer).findByText(/Extracted from: HRIS_Job_Description.docx/)).toBeInTheDocument();
    expect(within(drawer).getByText(/Matched Master Data title:/)).toBeInTheDocument();

    // Check Title & Site auto-selected
    expect(within(drawer).getByLabelText(/^Title/)).toHaveValue('p-hris');
    expect(within(drawer).getByLabelText(/^Site/)).toHaveValue('b-riyadh');

    // Check skills chips rendered
    expect(within(drawer).getByText('SQL Database Development')).toBeInTheDocument();
    expect(within(drawer).getByText('Power Platform')).toBeInTheDocument();
    expect(within(drawer).getByText('Full-Stack Web Development')).toBeInTheDocument();

    // Remove a skill chip
    await u.click(within(drawer).getByRole('button', { name: 'Remove skill Power Platform' }));
    expect(within(drawer).queryByText('Power Platform')).toBeNull();

    // Add a custom skill
    const skillInput = within(drawer).getByLabelText('Add competency or skill');
    await u.type(skillInput, 'Oracle HR');
    await u.click(within(drawer).getByRole('button', { name: 'Add' }));
    expect(within(drawer).getByText('Oracle HR')).toBeInTheDocument();

    // Fill required Due date
    await u.type(within(drawer).getByLabelText(/^Due date/), '2026-12-15');

    // Save draft
    await u.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => {
      expect(api.postApi).toHaveBeenCalledWith(
        '/vacancy-requests',
        expect.objectContaining({
          positionId: 'p-hris',
          branchId: 'b-riyadh',
          dueDate: '2026-12-15',
        }),
      );
    });

    expect(await axeViolations(baseElement)).toEqual([]);
  });
});
