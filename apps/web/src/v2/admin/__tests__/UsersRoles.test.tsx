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
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      displayName: 'Admin User',
      email: 'admin@sgh.com',
      roles: [{ id: 'r1', name: 'Administrator', code: 'ADMINISTRATOR' }],
      permissions: ['USERS_VIEW', 'USERS_MANAGE'],
    },
  }),
}));
import { RolesRoute, UsersRoute } from '../AdminRoutes';
import { buildTree, flatten, isDescendant, ownedWork } from '../usersApi';

let paths: Record<string, unknown> = {};
const serve = (extra: Record<string, unknown> = {}) => {
  paths = { '/users?directory=1&page=1&pageSize=100': fx.users, '/roles': fx.roles, '/roles/permissions': fx.perms, ...extra };
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
    renderAt();
    const table = await screen.findByRole('table', { name: 'Users' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(9);
    expect(rows[0]).toHaveTextContent(/Ahmed Fathy.*ahmed\.fathy@recruitflow\.app.*Employee.*Hala Mostafa.*—.*Active/);
    expect(rows[8]).toHaveTextContent(/Old Leaver.*Inactive/);
    expect(within(table).getByRole('row', { name: /Omar Khalil/ })).toHaveTextContent(/omar\.khalil@recruitflow\.app.*Admin.*Active/);
    expect(within(table).getByRole('row', { name: /Rasha Nabil/ })).toHaveTextContent('Invited');
    await u.selectOptions(screen.getByLabelText('Role filter'), 'manager');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await u.selectOptions(screen.getByLabelText('Role filter'), 'all');
    await u.type(screen.getByLabelText('Search users'), 'noura');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).queryByRole('columnheader', { name: 'Email' })).toBeNull();
    expect(within(table).getByRole('columnheader', { name: 'Branch' })).toBeInTheDocument();
    expect(screen.getByText('Showing 1–1 of 1 users')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Visual Org Chart & Reporting Tree/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reporting tree' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Invite user' })).toBeInTheDocument();
    expect(screen.getByText(/Interviewer is not a role/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
  it('keeps the users directory accessible', async () => {
    const { container } = renderAt();
    await screen.findByRole('table', { name: 'Users' });
    expect(await axeViolations(container)).toEqual([]);
  });
  it('paginates without clipping the directory rows', async () => {
    const u = userEvent.setup();
    serve({
      '/users?directory=1&page=1&pageSize=100': fx.users.map((user, index) => ({
        ...user,
        id: `page-${index}`,
        displayName: `Page User ${index + 1}`,
        email: `page${index + 1}@recruitflow.app`,
        managerId: null,
      })).concat([
        { ...fx.users[0], id: 'page-extra', displayName: 'Page User 10', email: 'page10@recruitflow.app', managerId: null },
        { ...fx.users[1], id: 'page-eleven', displayName: 'Page User 11', email: 'page11@recruitflow.app', managerId: null },
      ]),
    });
    renderAt();
    const table = await screen.findByRole('table', { name: 'Users' });
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText('Showing 1–10 of 11 users')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Next' }));
    const lastPageRows = within(table).getAllByRole('row');
    expect(lastPageRows).toHaveLength(2);
    expect(lastPageRows[1]).toHaveTextContent('Page User');
    expect(screen.getByText('Showing 11–11 of 11 users')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
  it('filters by branch and status and warns when an active Employee has no manager', async () => {
    const u = userEvent.setup();
    serve({
      '/users?directory=1&page=1&pageSize=100': [
        { ...fx.users[0], branchId: 'b-jeddah', branchName: 'Jeddah' },
        { ...fx.users[6], managerId: null, branchId: 'b-cairo', branchName: 'Cairo' },
        { ...fx.users[7], branchId: 'b-jeddah', branchName: 'Jeddah' },
      ],
      '/master-data/catalog/branches': [
        { id: 'b-cairo', name: 'Cairo', status: 'Active' },
        { id: 'b-jeddah', name: 'Jeddah', status: 'Active' },
      ],
    });
    renderAt();
    const table = await screen.findByRole('table', { name: 'Users' });
    expect(within(table).getByText('Unassigned manager')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Branch filter')).not.toBeDisabled());
    await u.selectOptions(screen.getByLabelText('Branch filter'), 'b-jeddah');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('row', { name: /Rasha Nabil/ })).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Status filter'), 'Active');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByRole('row', { name: /Omar Khalil/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 1–1 of 1 users')).toBeInTheDocument();
  });
  it('keeps unsaved role and status edits available after a failed save', async () => {
    const u = userEvent.setup();
    serve({
      '/master-data/catalog/branches': [{ id: 'b-cairo', name: 'Cairo', status: 'Active' }],
    });
    api.patchApi.mockRejectedValueOnce(new ApiError(500, 'Server unavailable'));
    renderAt();
    const table = await screen.findByRole('table', { name: 'Users' });
    await u.click(within(within(table).getByRole('row', { name: /Ahmed Fathy/ })).getByRole('button', { name: 'Edit Ahmed Fathy' }));
    const d = await screen.findByRole('dialog', { name: 'Edit Ahmed Fathy' });
    const recruiter = await within(d).findByRole('checkbox', { name: /Employee · Recruiter/ });
    const hiringManager = within(d).getByRole('checkbox', { name: /Manager · Hiring Manager/ });
    expect(recruiter).toBeChecked();
    await waitFor(() => expect(within(d).getByLabelText('Branch')).not.toBeDisabled());
    await u.click(recruiter);
    await u.click(hiringManager);
    await u.selectOptions(within(d).getByLabelText('Branch'), 'b-cairo');
    await u.selectOptions(within(d).getByLabelText('Status'), 'Inactive');
    await u.click(within(d).getByRole('button', { name: 'Save changes' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Server unavailable');
    expect(hiringManager).toBeChecked();
    expect(recruiter).not.toBeChecked();
    expect(within(d).getByLabelText('Status')).toHaveValue('Inactive');
    expect(api.patchApi).toHaveBeenCalledWith('/users/u-ahmed', {
      managerId: 'u-hala', branchId: 'b-cairo', status: 'Inactive', roleIds: ['r-hm'],
    });
  });
  it('saves seat role, manager, branch, and status through one user update', async () => {
    const u = userEvent.setup();
    serve({
      '/master-data/catalog/branches': [{ id: 'b-cairo', name: 'Cairo', status: 'Active' }],
    });
    api.patchApi.mockResolvedValue({});
    renderAt();
    const table = await screen.findByRole('table', { name: 'Users' });
    await u.click(within(within(table).getByRole('row', { name: /Ahmed Fathy/ })).getByRole('button', { name: 'Edit Ahmed Fathy' }));
    const d = await screen.findByRole('dialog', { name: 'Edit Ahmed Fathy' });
    const recruiter = await within(d).findByRole('checkbox', { name: /Employee · Recruiter/ });
    await u.click(recruiter);
    await u.click(within(d).getByRole('checkbox', { name: /Manager · Hiring Manager/ }));
    await waitFor(() => expect(within(d).getByLabelText('Branch')).not.toBeDisabled());
    await u.selectOptions(within(d).getByLabelText('Reports to'), 'u-karim');
    await u.selectOptions(within(d).getByLabelText('Branch'), 'b-cairo');
    await u.selectOptions(within(d).getByLabelText('Status'), 'Inactive');
    await u.click(within(d).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/users/u-ahmed', {
      managerId: 'u-karim', branchId: 'b-cairo', status: 'Inactive', roleIds: ['r-hm'],
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Ahmed Fathy updated.');
  });
  it('guards closing the edit drawer when changes are unsaved', async () => {
    const u = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt();
    const table = await screen.findByRole('table', { name: 'Users' });
    await u.click(within(within(table).getByRole('row', { name: /Ahmed Fathy/ })).getByRole('button', { name: 'Edit Ahmed Fathy' }));
    const d = await screen.findByRole('dialog', { name: 'Edit Ahmed Fathy' });
    await u.click(await within(d).findByRole('checkbox', { name: /Manager · Hiring Manager/ }));
    await u.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalledWith('Discard your unsaved user changes?');
    expect(screen.getByRole('dialog', { name: 'Edit Ahmed Fathy' })).toBeInTheDocument();
    confirm.mockReturnValue(true);
    await u.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    confirm.mockRestore();
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
    await u.type(within(block).getByLabelText(/^Reason/), 'Le');
    await u.click(within(block).getByRole('button', { name: 'Reassign 3 files' }));
    expect(within(block).getByText(/at least 3 characters/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.type(within(block).getByLabelText(/^Reason/), 'aving on 31 Oct');
    await u.click(within(block).getByRole('button', { name: 'Reassign 3 files' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/admin/overrides/file-reassign', { fromUserId: 'u-mariam', toUserId: 'u-youssef', reason: 'Leaving on 31 Oct' }));
    expect(api.postApi).not.toHaveBeenCalledWith('/files/reassign', expect.anything());
    expect(await within(d).findByRole('status')).toHaveTextContent('Files moved to Youssef Ibrahim (admin override, in Audit). Deactivate again.');
  });
  it('B2R #13: reason from reassign-reasons; "Other" sends note; REASSIGN_TARGET_INELIGIBLE lands on the person', async () => {
    const u = userEvent.setup();
    serve({ '/master-data/catalog/reassign-reasons': [{ name: 'Leaving the company', status: 'Active' }, { name: 'Other', status: 'Active' }] });
    api.patchApi.mockRejectedValue(new ApiError(409, 'x', { code: 'USER_OWNS_OPEN_WORK', counts: { openApplicationsPrimary: 1 } }, { code: 'USER_OWNS_OPEN_WORK' }));
    api.postApi.mockRejectedValueOnce(new ApiError(400, 'The new owner must be an active, non-admin user in this organization.', { code: 'REASSIGN_TARGET_INELIGIBLE' }, { code: 'REASSIGN_TARGET_INELIGIBLE' })).mockResolvedValue({});
    renderAt('/users?user=u-mariam');
    const d = await screen.findByRole('dialog', { name: 'Mariam Farag' });
    await u.click(within(d).getByRole('button', { name: 'Deactivate' }));
    await u.click(within(d).getByRole('button', { name: 'Confirm deactivate' }));
    const block = await within(d).findByRole('alert', { name: 'Open work blocks deactivation' });
    await u.selectOptions(within(block).getByLabelText(/Move their open files to/), 'u-youssef');
    const reason = await within(block).findByRole('combobox', { name: /^Reason/ });
    await u.selectOptions(reason, 'Other');
    await u.click(within(block).getByRole('button', { name: 'Reassign 1 file' }));
    expect(within(block).getByText('"Other" needs a short note (at least 3 characters).')).toBeInTheDocument();
    await u.type(within(block).getByLabelText(/^Say why/), 'Team merge');
    await u.click(within(block).getByRole('button', { name: 'Reassign 1 file' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/admin/overrides/file-reassign', { fromUserId: 'u-mariam', toUserId: 'u-youssef', reason: 'Other', note: 'Team merge' }));
    expect(await within(block).findByText('That person cannot own files (inactive or an administrator).')).toBeInTheDocument();
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
  it('shows the branch name, otherwise nested branch.name, otherwise the legacy site, otherwise an em dash', async () => {
    serve({
      '/users?directory=1&page=1&pageSize=100': [
        { ...fx.users[6], branchName: 'SGH Cairo', site: 'Ignored' },
        { ...fx.users[1], branchName: null, branch: { id: 'b-dubai', name: 'SGH Dubai Hospital' }, site: null },
        { ...fx.users[0], branchName: '', site: 'Jeddah' },
        { ...fx.users[8], branchName: null, site: null },
      ],
    });
    renderAt();
    const table = await screen.findByRole('table', { name: 'Users' });
    const site = (name: RegExp) => within(within(table).getByRole('row', { name })).getAllByRole('cell')[2];
    expect(site(/Ahmed Fathy/)).toHaveTextContent('SGH Cairo');
    expect(site(/Ahmed Fathy/)).not.toHaveTextContent('Ignored');
    expect(site(/Karim Hassan/)).toHaveTextContent('SGH Dubai Hospital');
    expect(within(table).getByRole('row', { name: /Ahmed Fathy/ })).toHaveTextContent('ahmed.fathy@recruitflow.app');
    expect(site(/Omar Khalil/)).toHaveTextContent('Jeddah');
    expect(site(/Old Leaver/)).toHaveTextContent('—');
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
  it('helpers: cycles are cut, descendants detected, ownedWork reads counts', () => {
    const cyc = [{ ...fx.users[1], managerId: 'u-mariam' }, { ...fx.users[3], managerId: 'u-karim' }] as never[];
    expect(flatten(buildTree(cyc))).toHaveLength(2);
    expect(isDescendant(fx.users as never[], 'u-hala', 'u-mariam')).toBe(true);
    expect(isDescendant(fx.users as never[], 'u-mariam', 'u-hala')).toBe(false);
    expect(ownedWork(new ApiError(409, 'x', { code: 'USER_OWNS_OPEN_WORK' }, { code: 'USER_OWNS_OPEN_WORK' }))).toEqual({ openApplicationsPrimary: 0, openApplicationsTaskOwner: 0, openJobsPrimary: 0, openRequisitions: 0, countsUnknown: true });
    expect(ownedWork(new ApiError(409, 'x', { code: 'OTHER' }, { code: 'OTHER' }))).toBeNull();
  });

  it('navigates to visual org chart from table orphan button', async () => {
    const u = userEvent.setup();
    serve({
      '/users?directory=1&page=1&pageSize=100': [
        { ...fx.users[0] },
        { ...fx.users[1] },
        { ...fx.users[6], managerId: null },
      ],
    });
    renderAt();
    const table = await screen.findByRole('table', { name: 'Users' });
    const orphanBtn = within(table).getByRole('button', { name: /Assign manager for Ahmed Fathy/ });
    expect(orphanBtn).toBeInTheDocument();
    await u.click(orphanBtn);
    expect(await screen.findByRole('heading', { name: /Users & Reporting Hierarchy/i })).toBeInTheDocument();
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
    expect(api.postApi).not.toHaveBeenCalled();
    const grant = await screen.findByRole('dialog', { name: /6 users have the Recruiter role\. Change this capability\?/ });
    await u.click(within(grant).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/roles/r-rec/permissions/p-int'));
    const hmAfter = within(screen.getByRole('list', { name: 'Interviewer by role' })).getByLabelText('Hiring Manager');
    await u.click(hmAfter);
    expect(api.deleteApi).not.toHaveBeenCalled();
    const revoke = await screen.findByRole('dialog', { name: /2 users have the Hiring Manager role\. Change this capability\?/ });
    await u.click(within(revoke).getByRole('button', { name: 'Confirm' }));
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
  it('cancel closes the confirm and leaves the capability unchanged', async () => {
    const u = userEvent.setup();
    serve({ '/users?directory=1&page=1&pageSize=100': [fx.users[1]] });
    renderAt('/roles');
    const interviewer = await screen.findByRole('list', { name: 'Interviewer by role' });
    const hm = within(interviewer).getByLabelText('Hiring Manager');
    expect(hm).toBeChecked();
    await u.click(hm);
    const dialog = await screen.findByRole('dialog', { name: '1 user has the Hiring Manager role. Change this capability?' });
    expect(api.postApi).not.toHaveBeenCalled();
    expect(api.deleteApi).not.toHaveBeenCalled();
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.postApi).not.toHaveBeenCalled();
    expect(api.deleteApi).not.toHaveBeenCalled();
    expect(within(interviewer).getByLabelText('Hiring Manager')).toBeChecked();
  });
  it('shows the directory error and does not change the capability', async () => {
    const u = userEvent.setup();
    serve({ '/users?directory=1&page=1&pageSize=100': new ApiError(500, 'Directory down') });
    renderAt('/roles');
    const interviewer = await screen.findByRole('list', { name: 'Interviewer by role' });
    await u.click(within(interviewer).getByLabelText('Recruiter'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Directory down');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.postApi).not.toHaveBeenCalled();
    expect(api.deleteApi).not.toHaveBeenCalled();
    expect(within(interviewer).getByLabelText('Recruiter')).not.toBeChecked();
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
