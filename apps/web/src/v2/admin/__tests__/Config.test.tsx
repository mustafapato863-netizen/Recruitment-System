import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';

const api = vi.hoisted(() => ({ getApi: vi.fn(), patchApi: vi.fn(), postApi: vi.fn(), deleteApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'admin' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
const auth = vi.hoisted(() => ({ perms: ['MASTER_DATA_VIEW'] as string[] }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-admin', displayName: 'Omar Khalil', permissions: auth.perms, roles: [] } }) }));
import { MasterDataRoute, PipelineRoute, TemplatesRoute } from '../AdminRoutes';

const st = (id: string, name: string, stageType: string, sortOrder: number) => ({ id, name, stageType, sortOrder, status: 'Active' });
const stages = [st('s1', 'Applied', 'applied', 1), st('s3', 'Interview', 'interview', 3), st('s2', 'Screening', 'screening', 2), st('s4', 'Offer', 'offer', 4), st('s5', 'Pre-hire', 'pre_hire', 5), st('s6', 'Joined', 'hired', 6), st('s7', 'Rejected', 'rejected', 7), st('s8', 'Withdrawn', 'withdrawn', 8), { ...st('s9', 'Old', 'custom', 9), status: 'Archived' }];
const tpl = { id: 't1', name: 'Default pipeline', isDefault: true, status: 'Active', stageCount: 8 };
const email = [
  { id: 'e1', name: 'Interview invite', category: 'stage_auto', subject: 'Interview for {{positionTitle}}', bodyTemplate: 'Dear {{candidateName}}, see you.', isDefault: true, status: 'Active' },
  { id: 'e2', name: 'Rejection — polite', category: 'notification', subject: 'Your application', bodyTemplate: 'Dear {{candidateName}}', isDefault: false, status: 'Active' },
  { id: 'e3', name: 'Archived one', category: 'misc', subject: 'x', bodyTemplate: 'x', isDefault: false, status: 'Archived' },
];
const wa = [{ id: 'w1', name: 'Interview reminder', category: 'interview_invite', interviewType: 'any', bodyTemplate: 'Hi {{candidateName}}', isDefault: true, status: 'Active' }];
const v = (id: string, name: string, status = 'Active') => ({ id, name, status, version: 1 });
let paths: Record<string, unknown> = {};
const serve = (extra: Record<string, unknown> = {}) => {
  paths = {
    '/pipeline-templates': [tpl], '/pipeline-templates/t1': { ...tpl, stages }, '/email-templates': email, '/whatsapp-templates': wa,
    '/master-data/catalog/skills': [v('k1', 'SQL'), v('k2', 'Laravel'), v('k3', 'COBOL', 'Archived')],
    '/master-data/catalog/departments': [v('d1', 'IT — HR Systems')],
    '/master-data/catalog/rejection-reasons': [v('r1', 'Skills gap (write the evidence)'), v('r2', 'Terms not aligned')],
    '/master-data/catalog/hold-reasons': [v('h1', 'Hiring manager on leave')], '/master-data/catalog/close-reasons': [v('c1', 'Filled')],
    '/master-data/catalog/reassign-reasons': new ApiError(404, 'Unknown category'),
    '/master-data/catalog/grades': [v('g8', 'Grade 8')], '/master-data/catalog/branches': [v('b1', 'Offshore Cairo'), v('b2', 'SGH Riyadh')],
    '/master-data/grade-bands': [{ id: 'gb1', grade: { id: 'g8', name: 'Grade 8' }, site: { id: 'b1', name: 'Offshore Cairo' }, currency: 'EGP', status: 'Active', minMonthlyBase: null, maxMonthlyBase: null }],
    ...extra,
  };
  api.getApi.mockImplementation(async (p: string) => { const x = paths[p]; if (x instanceof Error) throw x; if (x === undefined) throw new ApiError(404, `no ${p}`); return x; });
};
const renderAt = (path: string) => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Suspense fallback="…"><Routes>
    <Route path="/pipeline-settings" element={<PipelineRoute />} />
    <Route path="/email-templates" element={<TemplatesRoute />} />
    <Route path="/whatsapp-templates" element={<TemplatesRoute channel="whatsapp" />} />
    <Route path="/master-data" element={<MasterDataRoute />} />
  </Routes></Suspense></MemoryRouter>);
};
beforeEach(() => { vi.clearAllMocks(); shell.value = { seat: 'admin' }; serve(); });

describe('A05 Pipeline template (single)', () => {
  it('shows the one template: stages in order with drawers, gates; exits apart; no new/duplicate/delete; axe', async () => {
    const { container } = renderAt('/pipeline-settings');
    const sec = await screen.findByRole('region', { name: 'Stages' });
    const names = within(sec).getAllByRole('listitem').map((li) => li.querySelector('.rf2-jtable__name')!.textContent);
    expect(names).toEqual(['Applied', 'Screening', 'Interview', 'Offer', 'Pre-hire', 'Joined']);
    expect(sec).toHaveTextContent('Gate: scorecard submitted before Offer');
    expect(sec).toHaveTextContent('Gate: ID, contract and SCFHS licence checked');
    expect(within(screen.getByRole('region', { name: 'Exits' })).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /new template|duplicate|delete/i })).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });
  it('rename a stage via PATCH stages/:id', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({});
    renderAt('/pipeline-settings');
    await u.click(await screen.findByRole('button', { name: 'Edit Screening' }));
    const d = screen.getByRole('dialog', { name: 'Edit Screening' });
    const f = within(d).getByLabelText(/Stage name/);
    await u.clear(f); await u.type(f, 'Phone screen');
    await u.click(within(d).getByRole('button', { name: 'Save stage' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/pipeline-templates/t1/stages/s2', { name: 'Phone screen' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Stage renamed to “Phone screen”.');
  });
  it('no template → Create; 409 SINGLE_PIPELINE_TEMPLATE says one exists and reloads', async () => {
    const u = userEvent.setup();
    serve({ '/pipeline-templates': [] });
    api.postApi.mockRejectedValue(new ApiError(409, 'There is one pipeline template.', { code: 'SINGLE_PIPELINE_TEMPLATE' }, { code: 'SINGLE_PIPELINE_TEMPLATE' }));
    renderAt('/pipeline-settings');
    await u.click(await screen.findByRole('button', { name: 'Create the template' }));
    expect(api.postApi).toHaveBeenCalledWith('/pipeline-templates', { name: 'Default pipeline', isDefault: true });
    expect(await screen.findByRole('status')).toHaveTextContent('There is already one pipeline template — showing it.');
  });
});

describe('A07 Templates (admin-only)', () => {
  it('email list (archived hidden), editor with preview; insert variable; save PATCH; axe', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({ id: 'e1' });
    const { container } = renderAt('/email-templates');
    const nav = await screen.findByRole('navigation', { name: 'Email templates' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['New', 'Interview inviteStage email (sent on a move)', 'Rejection — politeNotification']);
    expect(screen.getByLabelText('Preview')).toHaveTextContent('Interview for HRIS Developer');
    expect(screen.getByLabelText('Preview')).toHaveTextContent('Dear Ahmed Embaby, see you.');
    const body = screen.getByLabelText(/^Body/) as HTMLTextAreaElement;
    body.setSelectionRange(body.value.length, body.value.length);
    await u.click(screen.getByRole('button', { name: '{{organizationName}}' }));
    await u.type(screen.getByLabelText(/^Body/), ' {{{{meet_link}}');
    expect(screen.getByText(/Not filled by the server, sent as typed: \{\{meet_link\}\}/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/email-templates/e1', { name: 'Interview invite', category: 'stage_auto', bodyTemplate: 'Dear {{candidateName}}, see you.{{organizationName}} {{meet_link}}', subject: 'Interview for {{positionTitle}}' }));
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });
  it('New validates, then POSTs; WhatsApp has no subject', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ id: 'w2' });
    renderAt('/whatsapp-templates');
    const nav = await screen.findByRole('navigation', { name: 'WhatsApp templates' });
    await u.click(within(nav).getByRole('button', { name: 'New' }));
    expect(screen.queryByLabelText(/^Subject/)).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Create template' }));
    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    await u.type(screen.getByLabelText(/^Name/), 'Document request');
    await u.type(screen.getByLabelText(/^Body/), 'Hi, please send your ID');
    await u.click(screen.getByRole('button', { name: 'Create template' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/whatsapp-templates', { name: 'Document request', category: 'interview_invite', bodyTemplate: 'Hi, please send your ID' }));
  });
  it('B2F-8: Archive (two-step) DELETEs = soft-archive; the template leaves the list; New drafts have no Archive', async () => {
    const u = userEvent.setup();
    api.deleteApi.mockResolvedValue({ id: 'e1', status: 'Archived' });
    renderAt('/email-templates');
    await screen.findByRole('navigation', { name: 'Email templates' });
    await u.click(screen.getByRole('button', { name: 'Archive' }));
    expect(api.deleteApi).not.toHaveBeenCalled();
    const before = api.getApi.mock.calls.length;
    await u.click(screen.getByRole('button', { name: 'Confirm archive' }));
    await waitFor(() => expect(api.deleteApi).toHaveBeenCalledWith('/email-templates/e1'));
    expect(await screen.findByRole('status')).toHaveTextContent('“Interview invite” archived.');
    await waitFor(() => expect(api.getApi.mock.calls.length).toBeGreaterThan(before));
    await u.click(within(screen.getByRole('navigation', { name: 'Email templates' })).getByRole('button', { name: 'New' }));
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  });
});

describe('A06 Master data', () => {
  it('cards per list (missing list says so), inactive hidden behind a toggle; axe', async () => {
    const u = userEvent.setup();
    const { container } = renderAt('/master-data');
    const skills = await screen.findByRole('list', { name: 'Skills' });
    expect(within(skills).getAllByRole('listitem').map((li) => li.firstChild!.textContent)).toEqual(['Laravel', 'SQL']);
    await u.click(screen.getByRole('button', { name: 'Show 1 inactive' }));
    expect(within(skills).getAllByRole('listitem')).toHaveLength(3);
    expect(within(screen.getByRole('region', { name: 'Reassign reasons' })).getByText('This list is not on this server yet.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Rejection reasons' })).toHaveTextContent('Terms not aligned');
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });
  it('add via batch; deactivate via PATCH {status:Inactive} (CoS), never DELETE', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({});
    renderAt('/master-data');
    await screen.findByRole('list', { name: 'Skills' });
    await u.click(screen.getByRole('button', { name: 'Add to Skills' }));
    await u.type(screen.getByLabelText('New skill'), 'cobol');
    await u.click(within(screen.getByRole('region', { name: 'Skills' })).getByRole('button', { name: 'Save' }));
    expect(screen.getByText('“cobol” is already on the list (inactive — reactivate it).')).toBeInTheDocument();
    await u.clear(screen.getByLabelText('New skill')); await u.type(screen.getByLabelText('New skill'), 'Power BI{Enter}');
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/master-data/catalog/skills/batch', { rows: [{ name: 'Power BI' }] }));
    await u.click(screen.getByRole('button', { name: 'Deactivate Terms not aligned' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/master-data/catalog/rejection-reasons/r2', { status: 'Inactive' }));
    expect(api.deleteApi).not.toHaveBeenCalled();
  });
  it('B2R-7: non-reason lists (departments) archive via DELETE, never PATCH Inactive', async () => {
    const u = userEvent.setup();
    api.deleteApi.mockResolvedValue({ id: 'd1', deactivated: true, status: 'Archived' });
    renderAt('/master-data');
    const region = await screen.findByRole('region', { name: 'Departments' });
    const btn = within(region).getAllByRole('button', { name: /^Deactivate / })[0];
    await u.click(btn);
    await waitFor(() => expect(api.deleteApi).toHaveBeenCalledWith(expect.stringMatching(/^\/master-data\/catalog\/departments\//)));
    expect(api.patchApi).not.toHaveBeenCalledWith(expect.stringContaining('/departments/'), { status: 'Inactive' });
  });
  it('#21 B2-21: a skill deactivates as Archived (DELETE archives it); an archived skill reactivates with PATCH Active', async () => {
    const u = userEvent.setup();
    api.deleteApi.mockResolvedValue({ id: 'k1', deactivated: true, status: 'Archived' });
    renderAt('/master-data');
    const skills = await screen.findByRole('list', { name: 'Skills' });
    await u.click(within(skills).getByRole('button', { name: 'Deactivate SQL' }));
    await waitFor(() => expect(api.deleteApi).toHaveBeenCalledWith('/master-data/catalog/skills/k1'));
    expect(api.patchApi).not.toHaveBeenCalledWith('/master-data/catalog/skills/k1', expect.anything());
    expect(await screen.findByText('“SQL” deactivated (archived).')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Show 1 inactive' }));
    expect(within(skills).getByText('Archived')).toBeInTheDocument();
    await u.click(within(skills).getByRole('button', { name: 'Reactivate COBOL' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/master-data/catalog/skills/k3', { status: 'Active' }));
  });
  it('#23: a 400 on the grade band lands on Min/Max inline', async () => {
    const u = userEvent.setup();
    auth.perms = ['MASTER_DATA_VIEW', 'MASTER_DATA_MANAGE'];
    const fields = { minMonthlyBase: ['minMonthlyBase must be a positive number'] };
    api.postApi.mockRejectedValue(new ApiError(400, 'x', { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', field: 'minMonthlyBase', fields }, { code: 'VALIDATION_ERROR', fields }));
    renderAt('/master-data');
    const card = await screen.findByRole('region', { name: 'Grade bands' });
    await u.click(await within(card).findByRole('button', { name: 'Add band' }));
    const d = await screen.findByRole('dialog');
    await waitFor(() => expect(within(d).getAllByRole('option').length).toBeGreaterThan(2));
    const grade = within(d).getByLabelText(/^Grade/); const site = within(d).getByLabelText(/^Site/);
    await u.selectOptions(grade, within(grade).getAllByRole('option')[1]);
    await u.selectOptions(site, within(site).getAllByRole('option')[1]);
    await u.type(within(d).getByLabelText(/^Min monthly/), '100');
    await u.type(within(d).getByLabelText(/^Max monthly/), '200');
    await u.click(within(d).getByRole('button', { name: 'Add band' }));
    expect(await within(d).findByText('minMonthlyBase must be a positive number')).toBeInTheDocument();
    expect(within(d).queryByText('Please correct the highlighted fields.')).toBeNull();
  });
  it('grade bands: an Admin with MASTER_DATA_MANAGE is told amounts come once the server returns them', async () => {
    auth.perms = ['MASTER_DATA_VIEW', 'MASTER_DATA_MANAGE'];
    renderAt('/master-data');
    const card = await screen.findByRole('region', { name: 'Grade bands' });
    expect(await within(card).findByText(/Admins with MASTER_DATA_MANAGE will see them/)).toBeInTheDocument();
    auth.perms = ['MASTER_DATA_VIEW'];
  });
  it('grade bands: amounts hidden note for Admin; add band validates and POSTs; deactivate via PATCH status', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({}); api.patchApi.mockResolvedValue({});
    renderAt('/master-data');
    const card = await screen.findByRole('region', { name: 'Grade bands' });
    expect(await within(card).findByText(/Amounts are hidden: you need MASTER_DATA_MANAGE/)).toBeInTheDocument();
    await u.click(within(card).getByRole('button', { name: 'Add band' }));
    const d = screen.getByRole('dialog', { name: 'Add grade band' });
    await u.click(within(d).getByRole('button', { name: 'Add band' }));
    expect(within(d).getByText('Pick a grade.')).toBeInTheDocument();
    await waitFor(() => expect(within(within(d).getByLabelText(/^Site/)).getByRole('option', { name: 'SGH Riyadh' })).toBeInTheDocument());
    await u.selectOptions(within(d).getByLabelText(/^Grade/), 'g8');
    await u.selectOptions(within(d).getByLabelText(/^Site/), 'b2');
    await u.selectOptions(within(d).getByLabelText('Currency'), 'SAR');
    await u.type(within(d).getByLabelText(/^Min monthly/), '14000');
    await u.type(within(d).getByLabelText(/^Max monthly/), '9000');
    await u.click(within(d).getByRole('button', { name: 'Add band' }));
    expect(within(d).getByText('Maximum must be at least the minimum.')).toBeInTheDocument();
    await u.clear(within(d).getByLabelText(/^Min monthly/)); await u.type(within(d).getByLabelText(/^Min monthly/), '9000');
    await u.clear(within(d).getByLabelText(/^Max monthly/)); await u.type(within(d).getByLabelText(/^Max monthly/), '14000');
    await u.click(within(d).getByRole('button', { name: 'Add band' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/master-data/grade-bands', { gradeId: 'g8', branchId: 'b2', currency: 'SAR', minMonthlyBase: 9000, maxMonthlyBase: 14000 }));
    await u.click(within(card).getByRole('button', { name: /Edit Grade 8 Offshore Cairo/ }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/master-data/grade-bands/gb1', { status: 'Inactive' }));
  });
});
