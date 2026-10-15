import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import type { WorkflowImpact, WorkflowPosition } from '../configApi';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const auth = vi.hoisted(() => ({ perms: ['MASTER_DATA_VIEW', 'MASTER_DATA_MANAGE'] as string[] }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-admin', displayName: 'Omar Khalil', permissions: auth.perms, roles: [] } }) }));

import { PipelineV2 } from '../PipelineV2';

const dev: WorkflowPosition = { id: 'dev-1', code: 'POS-DEV', title: 'HRIS Developer', profile: 'technical', vacancies: [{ code: 'VAC-2026-100', status: 'Open' }] };
const nurse: WorkflowPosition = { id: 'nur-1', code: 'POS-NUR', title: 'Staff Nurse — ICU', profile: 'clinical', vacancies: [{ code: 'VAC-2026-011', status: 'Partially Filled' }] };
const reception: WorkflowPosition = { id: 'open-1', code: 'POS-REC', title: 'Reception', profile: null, vacancies: [] };
const seed = [nurse, dev, reception];

let currentPositions = seed;
let refreshGate: { promise: Promise<void>; resolve: () => void } | null = null;

function gate<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}
function snapshot(rows = currentPositions): WorkflowPosition[] {
  return rows.map((row) => ({ ...row, vacancies: row.vacancies.map((vacancy) => ({ ...vacancy })) }));
}
function impactFor(positionId: string, profile: 'technical' | 'clinical'): WorkflowImpact {
  const row = currentPositions.find((item) => item.id === positionId) ?? dev;
  const protectedCode = row.vacancies.find((vacancy) => vacancy.code === 'VAC-2026-011')?.code;
  return {
    positionId,
    positionTitle: row.title,
    currentProfile: row.profile,
    proposedProfile: profile,
    applyAllowed: !protectedCode,
    protectedVacancyCodes: protectedCode ? [protectedCode] : [],
    preservedSnapshots: 1,
    openCasesAdoptingProfile: [{ code: 'APP-2', vacancyCode: protectedCode ?? row.vacancies[0]?.code ?? 'VAC-2026-100', stage: 'Applied' }],
    vacancies: row.vacancies.map((vacancy) => ({ code: vacancy.code, status: vacancy.status, approvedHeadcount: 2, joinedHeadcount: 1, protected: vacancy.code === 'VAC-2026-011' })),
    message: protectedCode ? `This position includes ${protectedCode}. This stays a preview.` : `${row.title} can take the profile.`,
  };
}
function applyCalls() {
  return api.postApi.mock.calls.filter((call) => call[0] === '/workflow-rules/apply');
}
function ruleGets() {
  return api.getApi.mock.calls.filter((call) => call[0] === '/workflow-rules');
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.perms = ['MASTER_DATA_VIEW', 'MASTER_DATA_MANAGE'];
  currentPositions = snapshot(seed);
  refreshGate = null;
  document.documentElement.setAttribute('data-ui', 'v2');
  api.getApi.mockImplementation(async (path: string) => {
    if (path === '/pipeline-templates') return [];
    if (path === '/workflow-rules') {
      if (refreshGate) await refreshGate.promise;
      return { positions: snapshot() };
    }
    throw new ApiError(404, `no ${path}`);
  });
  api.postApi.mockImplementation(async (path: string, body: { positionId: string; profile: 'technical' | 'clinical' }) => {
    if (path === '/workflow-rules/preview' || path === '/workflow-rules/apply') return impactFor(body.positionId, body.profile);
    throw new ApiError(404, path);
  });
});

describe('joining rule review and save', () => {
  it('starts from each position’s stored profile and explains both checklists', async () => {
    const user = userEvent.setup();
    render(<PipelineV2 />);
    const job = await screen.findByLabelText('Job');
    expect(job).toHaveValue('nur-1');
    expect(screen.getByLabelText('Checklist profile')).toHaveValue('clinical');
    expect(screen.getByText(/Stored checklist: Clinical — ID, signed contract and SCFHS licence/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();

    const region = screen.getByRole('region', { name: 'Joining checks by job' });
    expect(region).toHaveTextContent('ID and a signed contract');
    expect(region).toHaveTextContent('SCFHS licence');
    expect(region).toHaveTextContent('Final hiring approval stays required for every hire');
    expect(region).toHaveTextContent('Assigned licence checks only');
    expect(region).toHaveTextContent('Accepted cases keep their recorded checklist');
    expect(within(region).queryByRole('checkbox')).toBeNull();
    expect(within(region).queryByRole('combobox', { name: /licence/i })).toBeNull();

    await user.selectOptions(job, 'dev-1');
    expect(screen.getByLabelText('Checklist profile')).toHaveValue('technical');
    expect(screen.getByText(/Stored checklist: Standard — ID and signed contract/)).toBeInTheDocument();

    await user.selectOptions(job, 'open-1');
    const checklist = screen.getByLabelText('Checklist profile');
    expect(checklist).toHaveValue('');
    expect(checklist).toHaveDisplayValue('Choose profile');
    expect(screen.getByText(/Stored checklist: none yet. New cases keep the historical checks until a profile is saved/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a checklist profile before reviewing the impact.');
    expect(api.postApi).not.toHaveBeenCalled();

    await user.selectOptions(job, 'nur-1');
    expect(screen.getByLabelText('Checklist profile')).toHaveValue('clinical');
  });

  it('lets a viewer preview an allowed job and keeps save behind master-data manage', async () => {
    auth.perms = ['MASTER_DATA_VIEW'];
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.selectOptions(await screen.findByLabelText('Job'), 'dev-1');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    expect(within(dialog).queryByRole('button', { name: 'Confirm rule change' })).toBeNull();
    expect(within(dialog).getByText('You can review this impact. Saving needs the master-data manage permission.')).toBeInTheDocument();
    expect(within(dialog).getByText('Required for every hire · unchanged')).toBeInTheDocument();
    expect(within(dialog).getByRole('cell', { name: 'Status and seats unchanged' })).toBeInTheDocument();
    expect(api.postApi).toHaveBeenCalledTimes(1);
    expect(api.postApi).toHaveBeenCalledWith('/workflow-rules/preview', { positionId: 'dev-1', profile: 'technical' });
  });

  it('keeps a protected job preview-only for someone who can manage master data', async () => {
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.click(await screen.findByRole('button', { name: 'Review impact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    expect(within(dialog).queryByRole('button', { name: 'Confirm rule change' })).toBeNull();
    expect(within(dialog).getByText('This position includes VAC-2026-011. This stays a preview.')).toBeInTheDocument();
    expect(within(dialog).getByRole('cell', { name: 'Preview only' })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Saving needs the master-data manage permission/)).toBeNull();
    expect(applyCalls()).toHaveLength(0);
  });

  it('drops a reviewed profile when the job changes and saves only the new selection', async () => {
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.selectOptions(await screen.findByLabelText('Job'), 'dev-1');
    await user.selectOptions(screen.getByLabelText('Checklist profile'), 'clinical');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    const first = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    expect(within(first).getByText('ID · Signed contract · SCFHS licence')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Job'), 'open-1');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Checklist profile')).toHaveDisplayValue('Choose profile');

    await user.selectOptions(screen.getByLabelText('Job'), 'dev-1');
    expect(screen.getByLabelText('Checklist profile')).toHaveValue('technical');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    const again = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    expect(within(again).getByText('ID · Signed contract')).toBeInTheDocument();
    await user.type(within(again).getByLabelText(/Reason/), '  Keep the standard checklist  ');
    await user.click(within(again).getByRole('button', { name: 'Confirm rule change' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Joining rule saved for HRIS Developer. Stored checklist is Standard.');
    expect(api.postApi).toHaveBeenNthCalledWith(1, '/workflow-rules/preview', { positionId: 'dev-1', profile: 'clinical' });
    expect(api.postApi).toHaveBeenNthCalledWith(2, '/workflow-rules/preview', { positionId: 'dev-1', profile: 'technical' });
    expect(api.postApi).toHaveBeenNthCalledWith(3, '/workflow-rules/apply', { positionId: 'dev-1', profile: 'technical', reason: 'Keep the standard checklist' });
  });

  it('discards an in-flight preview when the checklist changes before it returns', async () => {
    const pending = gate<WorkflowImpact>();
    api.postApi.mockImplementation(async (path: string) => {
      if (path === '/workflow-rules/preview') return pending.promise;
      throw new Error(`unexpected ${path}`);
    });
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.selectOptions(await screen.findByLabelText('Job'), 'dev-1');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    await user.selectOptions(screen.getByLabelText('Checklist profile'), 'clinical');
    await act(async () => { pending.resolve(impactFor('dev-1', 'technical')); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.postApi).toHaveBeenCalledWith('/workflow-rules/preview', { positionId: 'dev-1', profile: 'technical' });
    expect(applyCalls()).toHaveLength(0);
  });

  it('requires a non-empty bounded reason before apply', async () => {
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.selectOptions(await screen.findByLabelText('Job'), 'dev-1');
    await user.selectOptions(screen.getByLabelText('Checklist profile'), 'clinical');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rule change' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a reason.');
    await user.type(within(dialog).getByLabelText(/Reason/), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rule change' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a reason.');
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'x'.repeat(501) } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rule change' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Use 500 characters or fewer.');
    expect(applyCalls()).toHaveLength(0);
  });

  it('shows saved only after the refreshed positions carry the new profile', async () => {
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.selectOptions(await screen.findByLabelText('Job'), 'dev-1');
    await user.selectOptions(screen.getByLabelText('Checklist profile'), 'clinical');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Require the SCFHS licence');
    refreshGate = gate();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rule change' }));
    expect(screen.queryByText(/Joining rule saved/)).toBeNull();
    expect(screen.getByText(/Stored checklist: Standard — ID and signed contract/)).toBeInTheDocument();
    expect(applyCalls()).toEqual([['/workflow-rules/apply', { positionId: 'dev-1', profile: 'clinical', reason: 'Require the SCFHS licence' }]]);

    currentPositions = snapshot().map((row) => (row.id === 'dev-1' ? { ...row, profile: 'clinical' } : row));
    await act(async () => { refreshGate?.resolve(); });
    expect(await screen.findByRole('status')).toHaveTextContent('Joining rule saved for HRIS Developer. Stored checklist is Licence-required.');
    expect(screen.getByText(/Stored checklist: Clinical — ID, signed contract and SCFHS licence/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not show saved when the refresh still has the previous checklist', async () => {
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.selectOptions(await screen.findByLabelText('Job'), 'dev-1');
    await user.selectOptions(screen.getByLabelText('Checklist profile'), 'clinical');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Require the SCFHS licence');
    refreshGate = gate();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rule change' }));
    await act(async () => { refreshGate?.resolve(); });
    expect(await screen.findByRole('alert')).toHaveTextContent('The joining rule was not saved. The position still shows its previous checklist.');
    expect(screen.queryByText(/Joining rule saved/)).toBeNull();
    expect(screen.getByText(/Stored checklist: Standard — ID and signed contract/)).toBeInTheDocument();
  });

  it('does not show saved when the refresh after apply fails', async () => {
    let loads = 0;
    let failRefresh = true;
    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/pipeline-templates') return [];
      if (path === '/workflow-rules') {
        loads += 1;
        if (loads > 1 && failRefresh) throw new ApiError(503, 'positions unavailable');
        return { positions: snapshot().map((row) => (row.id === 'dev-1' && loads > 1 ? { ...row, profile: 'clinical' } : row)) };
      }
      throw new ApiError(404, `no ${path}`);
    });
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.selectOptions(await screen.findByLabelText('Job'), 'dev-1');
    await user.selectOptions(screen.getByLabelText('Checklist profile'), 'clinical');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Require the SCFHS licence');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rule change' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The joining rule could not be confirmed from the saved positions. It is not shown as saved.');
    expect(screen.queryByText(/Joining rule saved/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm rule change' })).toBeNull();
    expect(applyCalls()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Check saved result' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The joining rule could not be confirmed from the saved positions. It is not shown as saved.');
    expect(screen.queryByRole('button', { name: 'Confirm rule change' })).toBeNull();
    expect(applyCalls()).toHaveLength(1);

    failRefresh = false;
    await user.click(screen.getByRole('button', { name: 'Check saved result' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Joining rule saved for HRIS Developer. Stored checklist is Licence-required.');
    expect(screen.getByText(/Stored checklist: Clinical — ID, signed contract and SCFHS licence/)).toBeInTheDocument();
    expect(applyCalls()).toHaveLength(1);
  });

  it('shows a different saved profile on the page after Cancel and Check saved result', async () => {
    let loads = 0;
    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/pipeline-templates') return [];
      if (path === '/workflow-rules') {
        loads += 1;
        if (loads === 2) throw new ApiError(503, 'positions unavailable');
        return { positions: snapshot() };
      }
      throw new ApiError(404, `no ${path}`);
    });
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.selectOptions(await screen.findByLabelText('Job'), 'dev-1');
    await user.selectOptions(screen.getByLabelText('Checklist profile'), 'clinical');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Require the SCFHS licence');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rule change' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The joining rule could not be confirmed from the saved positions. It is not shown as saved.');
    expect(applyCalls()).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const page = screen.getByRole('region', { name: 'Joining checks by job' });
    expect(within(page).getByRole('alert')).toHaveTextContent('The joining rule could not be confirmed from the saved positions. It is not shown as saved.');
    await user.click(within(page).getByRole('button', { name: 'Check saved result' }));

    expect(await within(page).findByRole('alert')).toHaveTextContent('The joining rule was not saved. The position still shows its previous checklist.');
    expect(within(page).queryByText(/could not be confirmed/)).toBeNull();
    expect(within(page).queryByText(/Joining rule saved/)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(page).getByText(/Stored checklist: Standard — ID and signed contract/)).toBeInTheDocument();
    expect(applyCalls()).toHaveLength(1);
  });

  it('shows the server refusal and does not reload or show saved', async () => {
    const refusal = 'This position includes VAC-2026-011. This stays a preview.';
    api.postApi.mockImplementation(async (path: string, body: { positionId: string; profile: 'technical' | 'clinical' }) => {
      if (path === '/workflow-rules/preview') return impactFor(body.positionId, body.profile);
      throw new ApiError(409, refusal, { statusCode: 409, code: 'CONFLICT', message: refusal }, { code: 'CONFLICT' });
    });
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.selectOptions(await screen.findByLabelText('Job'), 'dev-1');
    await user.selectOptions(screen.getByLabelText('Checklist profile'), 'clinical');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Require the SCFHS licence');
    const reads = ruleGets().length;
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rule change' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(refusal);
    expect(screen.queryByText(/Joining rule saved/)).toBeNull();
    expect(ruleGets()).toHaveLength(reads);
    expect(screen.getByRole('dialog', { name: 'Review joining-rule changes' })).toBeInTheDocument();
  });

  it('sends one apply when confirm is clicked again while the first save is in flight', async () => {
    const pending = gate<WorkflowImpact>();
    api.postApi.mockImplementation(async (path: string, body: { positionId: string; profile: 'technical' | 'clinical' }) => {
      if (path === '/workflow-rules/preview') return impactFor(body.positionId, body.profile);
      return pending.promise;
    });
    const user = userEvent.setup();
    render(<PipelineV2 />);
    await user.selectOptions(await screen.findByLabelText('Job'), 'dev-1');
    await user.selectOptions(screen.getByLabelText('Checklist profile'), 'clinical');
    await user.click(screen.getByRole('button', { name: 'Review impact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review joining-rule changes' });
    await user.type(within(dialog).getByLabelText(/Reason/), 'Require the SCFHS licence');
    const confirm = within(dialog).getByRole('button', { name: 'Confirm rule change' });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('dialog', { name: 'Review joining-rule changes' })).toBeInTheDocument();
    expect(applyCalls()).toHaveLength(1);
    currentPositions = snapshot().map((row) => (row.id === 'dev-1' ? { ...row, profile: 'clinical' } : row));
    await act(async () => { pending.resolve(impactFor('dev-1', 'clinical')); });
    expect(await screen.findByRole('status')).toHaveTextContent('Joining rule saved for HRIS Developer. Stored checklist is Licence-required.');
  });

  it('shows a joining-rule load failure with retry and keeps an empty list separate', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/pipeline-templates') return [];
      if (path === '/workflow-rules') throw new ApiError(503, 'Joining rules are unavailable.');
      throw new ApiError(404, `no ${path}`);
    });
    const user = userEvent.setup();
    render(<PipelineV2 />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Joining rules are unavailable.');
    expect(screen.queryByText(/No positions are available/)).toBeNull();
    expect(screen.queryByLabelText('Job')).toBeNull();

    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/pipeline-templates') return [];
      if (path === '/workflow-rules') return { positions: [] };
      throw new ApiError(404, `no ${path}`);
    });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No positions are available for a joining rule/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByLabelText('Job')).toBeNull();
  });
});
