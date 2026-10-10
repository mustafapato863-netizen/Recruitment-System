import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import * as fx from '../__fixtures__';

const api = vi.hoisted(() => ({ getApi: vi.fn(), patchApi: vi.fn(), postApi: vi.fn(), deleteApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'admin' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../../../pages/UsersRolesPage', () => ({ UsersRolesPage: () => <p>v1 users</p> }));
import { RolesRoute, UsersRoute } from '../AdminRoutes';
import { buildTree, flatten, isDescendant, ownedWork } from '../usersApi';

let paths: Record<string, unknown> = {};
const serve = (extra: Record<string, unknown> = {}) => {
  paths = { '/users?page=1&pageSize=100': fx.users, '/roles': fx.roles, '/roles/permissions': fx.perms, ...extra };
  api.getApi.mockImplementation(async (p: string) => { const v = paths[p]; if (v instanceof Error) throw v; if (v === undefined) throw new ApiError(404, `no ${p}`); return v; });
};
const Loc = () => <div data-testid="loc">{useLocation().search}</div>;
const renderAt = (path = '/users') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Suspense fallback="…"><Routes><Route path="/users" element={<><UsersRoute /><Loc /></>} /><Route path="/roles" element={<RolesRoute />} /></Routes></Suspense></MemoryRouter>);
};
beforeEach(() => { vi.clearAllMocks(); shell.value = { seat: 'admin' }; serve(); });

describe('A02 Users', () => {
  it('lists users with seat, reports-to and status; inactive last; search + role filter; axe', async () => {
    const u = userEvent.setup();
    const { container } = renderAt();
    const table = await screen.findByRole('table', { name: 'Users' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(9);
    expect(rows[0]).toHaveTextContent(/Ahmed Fathy.*Employee · Recruiter-clinical.*Employee.*Hala Mostafa.*Active/);
    expect(rows[8]).toHaveTextContent(/Old Leaver.*Inactive/);
    expect(within(table).getByRole('row', { name: /Omar Khalil/ })).toHaveTextContent(/Admin · HR Systems.*Admin—Active/);
    expect(within(table).getByRole('row', { name: /Rasha Nabil/ })).toHaveTextContent('Invited');
    await u.selectOptions(screen.getByLabelText('Role filter'), 'manager');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await u.selectOptions(screen.getByLabelText('Role filter'), 'all');
    await u.type(screen.getByLabelText('Search users'), 'noura');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText(/Interviewer is not a role/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });
  it('non-admin seats keep v1', async () => {
    shell.value = { seat: 'manager' };
    renderAt();
    expect(await screen.findByText('v1 users')).toBeInTheDocument();
  });
  it('deactivate is PATCH {status:Inactive} (never DELETE), two-step confirm', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({});
    renderAt('/users?user=u-ahmed');
    const d = await screen.findByRole('dialog', { name: 'Ahmed Fathy' });
    await u.click(within(d).getByRole('button', { name: 'Deactivate' }));
    await u.click(within(d).getByRole('button', { name: 'Confirm deactivate' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/users/u-ahmed', { status: 'Inactive' }));
    expect(api.deleteApi).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Ahmed Fathy deactivated. History stays.');
  });
  it('reactivates an inactive user', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({});
    renderAt('/users?user=u-old');
    const d = await screen.findByRole('dialog', { name: 'Old Leaver' });
    await u.click(within(d).getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/users/u-old', { status: 'Active' }));
  });
  it('B2-9: 409 USER_OWNS_OPEN_WORK shows the counts and reassigns the files via the B9 override', async () => {
    const u = userEvent.setup();
    api.patchApi.mockRejectedValue(new ApiError(409, 'Mariam owns open work. Reassign it before deactivating the user.', { code: 'USER_OWNS_OPEN_WORK', counts: { openApplicationsPrimary: 2, openApplicationsTaskOwner: 1, openJobsPrimary: 1, openRequisitions: 0 } }, { code: 'USER_OWNS_OPEN_WORK' }));
    api.postApi.mockResolvedValue({ moved: [] });
    renderAt('/users?user=u-mariam');
    const d = await screen.findByRole('dialog', { name: 'Mariam Farag' });
    await u.click(within(d).getByRole('button', { name: 'Deactivate' }));
    await u.click(within(d).getByRole('button', { name: 'Confirm deactivate' }));
    const block = await within(d).findByRole('alert', { name: 'Open work blocks deactivation' });
    expect(block).toHaveTextContent(/2 open files as primary recruiter.*1 open file as task owner.*1 open job as owner/);
    expect(block).not.toHaveTextContent('open requisition');
    const to = within(block).getByLabelText(/Move their open files to/);
    expect(within(to).queryByRole('option', { name: /Omar Khalil/ })).toBeNull();
    await u.click(within(block).getByRole('button', { name: 'Reassign 3 files' }));
    expect(within(block).getByText('Pick who takes the files.')).toBeInTheDocument();
    await u.selectOptions(to, 'u-youssef');
    await u.type(within(block).getByLabelText(/^Reason/), 'Leaving');
    await u.click(within(block).getByRole('button', { name: 'Reassign 3 files' }));
    expect(within(block).getByText(/at least 10 characters/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.type(within(block).getByLabelText(/^Reason/), ' on 31 Oct');
    await u.click(within(block).getByRole('button', { name: 'Reassign 3 files' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/admin/overrides', { action: 'file.reassign', entityId: 'u-mariam', toUserId: 'u-youssef', reason: 'Leaving on 31 Oct' }));
    expect(api.postApi).not.toHaveBeenCalledWith('/files/reassign', expect.anything());
    expect(await within(d).findByRole('status')).toHaveTextContent('Files moved to Youssef Ibrahim (admin override, in Audit). Deactivate again.');
  });
  it('override not enabled yet (OVERRIDE_NOT_ALLOWED) → server message + the manager who can', async () => {
    const u = userEvent.setup();
    api.patchApi.mockRejectedValue(new ApiError(409, 'x', { code: 'USER_OWNS_OPEN_WORK', counts: { openApplicationsPrimary: 1 } }, { code: 'USER_OWNS_OPEN_WORK' }));
    api.postApi.mockRejectedValue(new ApiError(400, 'file.reassign override is not available on this build.', { code: 'OVERRIDE_NOT_ALLOWED' }, { code: 'OVERRIDE_NOT_ALLOWED' }));
    renderAt('/users?user=u-mariam');
    const d = await screen.findByRole('dialog', { name: 'Mariam Farag' });
    await u.click(within(d).getByRole('button', { name: 'Deactivate' }));
    await u.click(within(d).getByRole('button', { name: 'Confirm deactivate' }));
    const block = await within(d).findByRole('alert', { name: 'Open work blocks deactivation' });
    await u.selectOptions(within(block).getByLabelText(/Move their open files to/), 'u-youssef');
    await u.type(within(block).getByLabelText(/^Reason/), 'Leaving the company');
    await u.click(within(block).getByRole('button', { name: 'Reassign 1 file' }));
    expect(await within(block).findByText(/file\.reassign override is not available on this build\. Meanwhile Karim Hassan \(their manager\) can move them from Team work/)).toBeInTheDocument();
  });
  it('B2-9: a 409 without the code/counts (today\'s normalizer) still opens the reassign path', async () => {
    const u = userEvent.setup();
    api.patchApi.mockRejectedValue(new ApiError(409, 'This user still owns open work. Reassign it first.', { code: 'CONFLICT', message: 'This user still owns open work. Reassign it first.' }, { code: 'CONFLICT' }));
    renderAt('/users?user=u-mariam');
    const d = await screen.findByRole('dialog', { name: 'Mariam Farag' });
    await u.click(within(d).getByRole('button', { name: 'Deactivate' }));
    await u.click(within(d).getByRole('button', { name: 'Confirm deactivate' }));
    const block = await within(d).findByRole('alert', { name: 'Open work blocks deactivation' });
    expect(block).toHaveTextContent('no counts');
    expect(within(block).getByRole('button', { name: 'Reassign all open files' })).toBeInTheDocument();
  });
  it('invite: validates, then POST /users/invitations with the picked role', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ id: 'i1' });
    renderAt('/users?drawer=invite');
    const d = await screen.findByRole('dialog', { name: 'Invite user' });
    await u.click(within(d).getByRole('button', { name: 'Send invitation' }));
    expect(within(d).getByText('Enter a name.')).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/^Name/), 'Sara Ali');
    await u.type(within(d).getByLabelText(/^Email/), 'sara@recruitflow.app');
    await waitFor(() => expect(within(within(d).getByLabelText('Role')).getByRole('option', { name: 'Recruiter' })).toBeInTheDocument());
    await u.selectOptions(within(d).getByLabelText('Role'), 'r-rec');
    await u.click(within(d).getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/users/invitations', { displayName: 'Sara Ali', email: 'sara@recruitflow.app', roleIds: ['r-rec'] }));
  });
});

describe('#23 400 fields inline (admin forms)', () => {
  it('invite: fields.email lands on Email; nothing left for the banner', async () => {
    const u = userEvent.setup();
    const fields = { email: ['A user with this email already exists.'] };
    api.postApi.mockRejectedValue(new ApiError(400, 'x', { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', field: 'email', fields }, { code: 'VALIDATION_ERROR', fields }));
    renderAt('/users?drawer=invite');
    const d = await screen.findByRole('dialog', { name: 'Invite user' });
    await u.type(within(d).getByLabelText(/^Name/), 'Sara Ali');
    await u.type(within(d).getByLabelText(/^Email/), 'sara@recruitflow.app');
    await u.click(within(d).getByRole('button', { name: 'Send invitation' }));
    expect(await within(d).findByText('A user with this email already exists.')).toBeInTheDocument();
    expect(within(d).getByLabelText(/^Email/)).toHaveAttribute('aria-invalid', 'true');
    expect(within(d).queryByText('Please correct the highlighted fields.')).toBeNull();
  });
});

describe('A03 Reporting tree', () => {
  it('builds the tree (inactive hidden), edits one line via PATCH managerId; no loops offered', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({});
    const { baseElement } = renderAt('/users?drawer=tree');
    const d = await screen.findByRole('dialog', { name: 'Who reports to whom' });
    const items = within(within(d).getByRole('list', { name: 'Reporting tree' })).getAllByRole('button').map((b) => b.textContent);
    expect(items.map((t) => t!.slice(2).split('Employee')[0].split('Manager')[0].split('Admin')[0])).toEqual(['Hala Mostafa', 'Ahmed Fathy', 'Karim Hassan', 'Mariam Farag', 'Noura Al-Dosari', 'Youssef Ibrahim', 'Rasha Nabil', 'Omar Khalil']);
    expect(within(d).getByRole('button', { name: /Karim Hassan/ })).toHaveTextContent('3 direct reports');
    expect(within(d).getByRole('button', { name: 'Save reporting line' })).toBeDisabled();
    await u.click(within(d).getByRole('button', { name: /^Hala Mostafa/ }));
    expect(within(within(d).getByLabelText('Hala Mostafa reports to')).queryByRole('option', { name: /Karim Hassan/ })).toBeNull();
    await u.click(within(d).getByRole('button', { name: /^Mariam Farag/ }));
    const sel = within(d).getByLabelText('Mariam Farag reports to');
    expect(sel).toHaveValue('u-karim');
    await u.selectOptions(sel, 'u-hala');
    await u.click(within(d).getByRole('button', { name: 'Save reporting line' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/users/u-mariam', { managerId: 'u-hala' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Mariam Farag now reports to Hala Mostafa.');
    expect(baseElement).toBeTruthy();
  });
  it('helpers: cycles are cut, descendants detected, ownedWork reads counts', () => {
    const cyc = [{ ...fx.users[1], managerId: 'u-mariam' }, { ...fx.users[3], managerId: 'u-karim' }] as never[];
    expect(flatten(buildTree(cyc))).toHaveLength(2);
    expect(isDescendant(fx.users as never[], 'u-hala', 'u-mariam')).toBe(true);
    expect(isDescendant(fx.users as never[], 'u-mariam', 'u-hala')).toBe(false);
    expect(ownedWork(new ApiError(409, 'x', { code: 'USER_OWNS_OPEN_WORK' }, { code: 'USER_OWNS_OPEN_WORK' }))).toEqual({ openApplicationsPrimary: 0, openApplicationsTaskOwner: 0, openJobsPrimary: 0, openRequisitions: 0, countsUnknown: true });
    expect(ownedWork(new ApiError(409, 'x', { code: 'OTHER' }, { code: 'OTHER' }))).toBeNull();
  });
});

describe('A04 Roles', () => {
  it('policy matrix + capability grants as permissions; toggling posts/deletes the role permission; axe', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({}); api.deleteApi.mockResolvedValue({});
    const { container } = renderAt('/roles');
    const m = await screen.findByRole('table', { name: 'What each role can do' });
    expect(within(m).getByRole('row', { name: /See pay and grade band/ })).toHaveTextContent(/Hidden.*Team offers.*Hidden.*Hidden/);
    expect(within(m).getByRole('row', { name: /Delete anything/ })).toHaveTextContent(/Not available.*Not available.*Not available.*Not available/);
    const interviewer = await screen.findByRole('list', { name: 'Interviewer by role' });
    expect(within(interviewer).queryByLabelText('Interviewer')).toBeNull();
    const hm = within(interviewer).getByLabelText('Hiring Manager');
    expect(hm).toBeChecked();
    await u.click(within(interviewer).getByLabelText('Recruiter'));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/roles/r-rec/permissions/p-int'));
    await u.click(hm);
    await waitFor(() => expect(api.deleteApi).toHaveBeenCalledWith('/roles/r-hm/permissions/p-int'));
    expect(screen.getByRole('list', { name: 'Licence check by role' })).toBeInTheDocument();
    const map = screen.getByRole('table', { name: 'Production roles' });
    expect(within(map).getByRole('row', { name: /Ops custom/ })).toHaveTextContent('Not mapped');
    expect(await axeViolations(container)).toEqual([]);
  });
  it('capability permission not on the server → names the stand-in role, no toggles', async () => {
    serve({ '/roles/permissions': fx.perms.slice(0, 2) });
    renderAt('/roles');
    expect(await screen.findByText(/INTERVIEW_PARTICIPATE is not on this server yet\. Today this is the “Interviewer” role/)).toBeInTheDocument();
    expect(screen.getByText(/LICENSE_CHECK is not on this server yet\. Today this is the “License Specialist” role/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('non-admin /roles goes back to /users (v1)', async () => {
    shell.value = null;
    renderAt('/roles');
    expect(await screen.findByText('v1 users')).toBeInTheDocument();
  });
});

describe('B2-22: list calls stay within pageSize 100', () => {
  it('fetchAllPages walks pages of 100 until the total', async () => {
    const { fetchAllPages } = await import('../../api/paged');
    const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: `u${from + i}` }));
    api.getApi.mockReset();
    api.getApi.mockImplementation(async (p: string) => (p.includes('page=1&') ? { data: rows(100), total: 130 } : p.includes('page=2&') ? { data: rows(30, 100), total: 130 } : { data: [] }));
    const out = await fetchAllPages<{ id: string }>('/users');
    expect(out).toHaveLength(130);
    expect(api.getApi.mock.calls.map((c) => c[0])).toEqual(['/users?page=1&pageSize=100', '/users?page=2&pageSize=100']);
  });
});
