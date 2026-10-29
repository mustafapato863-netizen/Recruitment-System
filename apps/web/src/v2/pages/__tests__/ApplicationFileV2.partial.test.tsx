import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { fileResponses, type Scenario } from '../../api/__fixtures__/applicationFile';
import { loadApproverFile, loadLicenseFile } from '../../api/applicationFile';
import { ApplicationFileV2 } from '../ApplicationFileV2';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), putApi: vi.fn() }));
const authState = vi.hoisted(() => ({ user: { id: 'u-mariam', displayName: 'Mariam Farag', permissions: [] as string[] } }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: authState.user }) }));

const MESSAGES_EMPTY = { destination: 'local-test@recruitflow.local', templates: [], followUpDate: null, attempts: [] as unknown[] };
let responses: Record<string, unknown> = {};

function serve(scenario: Scenario, extra: Record<string, unknown> = {}) {
  responses = {
    ...fileResponses(scenario),
    '/users/interviewers': [{ id: 'u-karim', displayName: 'Karim Hassan', email: 'k@x', jobTitle: 'Hiring manager', roles: [] }],
    '/screening/application/a1/draft': null,
    '/applications/a1/messages': MESSAGES_EMPTY,
    ...extra,
  };
  api.getApi.mockImplementation(async (path: string) => {
    const bare = path.split('?')[0];
    if (bare in responses) {
      const value = responses[bare];
      if (value instanceof Error) throw value;
      if (value instanceof Promise) return value;
      return structuredClone(value);
    }
    throw new ApiError(404, 'not found');
  });
}

function renderFile(path = '/applications/a1') {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/applications/:id" element={<ApplicationFileV2 />} />
      </Routes>
    </MemoryRouter>,
  );
}

function Jump() {
  const nav = useNavigate();
  const { id } = useParams();
  const next = id === 'a1' ? 'a2' : 'a1';
  return <button type="button" onClick={() => nav(`/applications/${next}`)}>Open {next}</button>;
}

beforeEach(() => {
  authState.user.permissions = [];
  Object.values(api).forEach((fn) => fn.mockReset());
  api.postApi.mockResolvedValue({ id: 'n1' });
  api.patchApi.mockResolvedValue({ version: 8 });
  api.putApi.mockResolvedValue({ id: 'draft' });
});

describe('partial application file', () => {
  it('shows a successful empty file as empty and still offers Log screen', async () => {
    serve('applied', { '/applications/a1/notes': [] });
    renderFile();
    expect(await screen.findByText('No screening note or fit evidence is recorded on this file yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log screen' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded|could not be found|not available for this role|No attempts yet/i)).not.toBeInTheDocument();
    expect(screen.getByText(/local-test@recruitflow.local/)).toBeInTheDocument();
  });

  it('blocks the next action for two failed sections, retries only the chosen read, and keeps a note draft', async () => {
    const user = userEvent.setup();
    serve('applied', {
      '/screening/application/a1': new ApiError(500, 'Screening store timed out.'),
      '/applications/a1/documents': new ApiError(403, 'Documents are not available for this role.'),
    });
    renderFile();
    expect(await screen.findByRole('button', { name: 'Action unavailable' })).toBeDisabled();
    expect(screen.getByText('Screening could not be loaded. Try again.')).toBeInTheDocument();
    expect(screen.getByText('Documents is not available for this role.')).toBeInTheDocument();
    expect(screen.getByText('Notice: could not be checked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log screen' })).not.toBeInTheDocument();
    expect(screen.queryByText('No screening note or fit evidence is recorded on this file yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled();
    const note = screen.getByLabelText('Add a note');
    await user.type(note, 'Keep this draft');
    api.getApi.mockClear();
    api.postApi.mockClear();
    api.patchApi.mockClear();
    api.putApi.mockClear();
    responses['/screening/application/a1'] = [];
    await user.click(screen.getByRole('button', { name: 'Retry screening' }));
    expect(await screen.findByRole('button', { name: 'Log screen' })).toBeEnabled();
    expect(screen.getByText('Documents is not available for this role.')).toBeInTheDocument();
    expect(note).toHaveValue('Keep this draft');
    expect(api.getApi.mock.calls.map(([path]) => path)).toEqual(['/screening/application/a1']);
    expect(api.postApi).not.toHaveBeenCalled();
    expect(api.patchApi).not.toHaveBeenCalled();
    expect(api.putApi).not.toHaveBeenCalled();
  });

  it('does not offer Draft offer or an enabled pre-hire move while the offer read failed', async () => {
    serve('offer-sent', { '/offers': new ApiError(500, 'Offer list failed.') });
    renderFile();
    expect(await screen.findByRole('button', { name: 'Action unavailable' })).toBeDisabled();
    expect(screen.getByText('The offer could not be loaded. Try again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Draft offer' })).not.toBeInTheDocument();
    expect(screen.queryByText('Draft the offer')).not.toBeInTheDocument();
    const actions = screen.getByRole('group', { name: 'Smart actions' });
    expect(within(actions).getByRole('button', { name: 'Offer' })).toBeDisabled();
    expect(within(actions).getByRole('button', { name: 'Pre-hire' })).toBeDisabled();
    expect(within(screen.getByRole('list', { name: 'Gate to Pre-hire' })).getByText(/Offer accepted/).closest('li')).toHaveAttribute('data-ok', 'unknown');
  });

  it('does not describe a failed joining-check read as a job with no checks', async () => {
    serve('prehire', { '/applications/a1/joining-checks': new ApiError(500, 'Checks failed.') });
    renderFile();
    expect(await screen.findByText('Joining checks could not be loaded. Try again.')).toBeInTheDocument();
    expect(screen.queryByText(/No required checks are on the file yet/)).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Smart actions' })).getByRole('button', { name: 'Pre-hire' })).toBeDisabled();
  });

  it('does not treat a failed or empty message read as missing attempts', async () => {
    serve('interview', { '/applications/a1/messages': new ApiError(500, 'Messages down.') });
    const failed = renderFile();
    expect(await screen.findByText('Messages could not be loaded. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('No attempts yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('Message history is not available on this file.')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Chatter' })).toHaveTextContent('Screening logged');
    expect(screen.getByRole('button', { name: 'Retry messages' })).toBeInTheDocument();
    failed.unmount();

    serve('interview', { '/applications/a1/messages': MESSAGES_EMPTY });
    renderFile();
    expect(await screen.findByText(/local-test@recruitflow.local/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('No attempts yet.')).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument();
  });

  it('does not say scorecards are missing when the scorecard read failed', async () => {
    serve('interview', { '/interviews/iv1/scorecard': new ApiError(500, 'Scorecard down.') });
    renderFile();
    expect(await screen.findByText(/Scorecard could not be checked/)).toBeInTheDocument();
    expect(screen.queryByText(/0 scorecards submitted/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open scorecard' })).not.toBeInTheDocument();
    const actions = screen.getByRole('group', { name: 'Smart actions' });
    expect(within(actions).getByRole('button', { name: 'Scorecard' })).toBeDisabled();
    expect(within(actions).getByRole('button', { name: 'Offer' })).toBeDisabled();
  });

  it('does not request sensitive sections for approver and licence seats', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    api.getApi.mockImplementation(async (path: string) => {
      seen.push(path);
      if (path === '/applications/a1') {
        return { id: 'a1', applicationCode: 'APP-1', vacancyId: 'v1', candidateId: 'c1', stage: 'Pre-hire', allowedTransitions: [], version: 3, positionTitle: 'Nurse', primaryRecruiterName: 'Mariam Farag', candidate: { id: 'c1', fullName: 'Rania Otaibi' }, appliedAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
      }
      if (path === '/documents/candidate/c1') return [{ id: 'd1', documentType: 'CV', fileName: 'rania-cv.pdf', createdAt: '2026-10-01T00:00:00.000Z' }];
      throw new Error(`unexpected ${path}`);
    });
    const approver = render(
      <MemoryRouter initialEntries={['/applications/a1']}>
        <Routes>
          <Route path="/applications/:id" element={<ApplicationFileV2 mode="approver" load={loadApproverFile} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Rania Otaibi' })).toBeInTheDocument();
    expect(seen.sort()).toEqual(['/applications/a1', '/documents/candidate/c1']);
    expect(screen.getByText(/Not requested for this role:/)).toBeInTheDocument();
    expect(screen.getByText('Notice: not available for this role')).toBeInTheDocument();
    expect(screen.queryByText('No screening note or fit evidence is recorded on this file yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No submitted scorecards yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No documents yet.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Documents' }));
    expect(screen.getByText('rania-cv.pdf')).toBeInTheDocument();
    approver.unmount();

    seen.length = 0;
    api.getApi.mockImplementation(async (path: string) => {
      seen.push(path);
      if (path === '/hiring?applicationId=a1') {
        return [{ id: 'h1', applicationId: 'a1', offerId: 'o1', status: 'In Progress', candidateName: 'Omar Licence', positionTitle: 'Nurse', complianceRequirements: [{ id: 'lic', type: 'License', name: 'SCFHS licence', status: 'Pending', isRequired: true }] }];
      }
      throw new Error(`unexpected ${path}`);
    });
    render(
      <MemoryRouter initialEntries={['/applications/a1']}>
        <Routes>
          <Route path="/applications/:id" element={<ApplicationFileV2 mode="licence" load={loadLicenseFile} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Omar Licence' })).toBeInTheDocument();
    expect(seen).toEqual(['/hiring?applicationId=a1']);
    expect(screen.getByText(/Not requested for this role:/)).toBeInTheDocument();
    expect(screen.queryByText(/salary|currentSalary|expectedSalary/i)).not.toBeInTheDocument();
    expect(screen.queryByText('No screening note or fit evidence is recorded on this file yet.')).not.toBeInTheDocument();
  });

  it('ignores a stale file load and a stale section retry after navigation', async () => {
    const user = userEvent.setup();
    const base = fileResponses('applied');
    let releaseA1: (value: unknown) => void = () => undefined;
    const a1Workspace = new Promise((resolve) => { releaseA1 = resolve; });
    const workspaceFor = (id: string, first: string, last: string) => {
      const workspace = structuredClone(base['/applications/a1/workspace']) as { application: { id: string; candidate: { firstName: string; lastName: string; fullName?: string } } };
      workspace.application.id = id;
      workspace.application.candidate.firstName = first;
      workspace.application.candidate.lastName = last;
      workspace.application.candidate.fullName = `${first} ${last}`;
      return workspace;
    };
    api.getApi.mockImplementation(async (path: string) => {
      const id = path.includes('/a2') || path.includes('=a2') ? 'a2' : 'a1';
      if (path === `/applications/${id}/workspace`) return id === 'a1' ? a1Workspace : workspaceFor('a2', 'Second', 'Person');
      if (path.endsWith('/messages')) return MESSAGES_EMPTY;
      const bare = path.split('?')[0].replaceAll(id, 'a1');
      if (bare in base) return structuredClone(base[bare]);
      throw new ApiError(404, 'not found');
    });
    render(
      <MemoryRouter initialEntries={['/applications/a1']}>
        <Routes>
          <Route path="/applications/:id" element={<><ApplicationFileV2 /><Jump /></>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Open a2' }));
    expect(await screen.findByRole('heading', { name: 'Second Person' })).toBeInTheDocument();
    await act(async () => {
      releaseA1(workspaceFor('a1', 'First', 'Person'));
      await a1Workspace;
    });
    expect(screen.getByRole('heading', { name: 'Second Person' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Person' })).not.toBeInTheDocument();
  });

  it('drops a late section retry that belongs to the previous application', async () => {
    const user = userEvent.setup();
    serve('applied', { '/screening/application/a1': new ApiError(500, 'Screening store timed out.') });
    const base = { ...responses };
    render(
      <MemoryRouter initialEntries={['/applications/a1']}>
        <Routes>
          <Route path="/applications/:id" element={<><ApplicationFileV2 /><Jump /></>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Retry screening' })).toBeInTheDocument();
    let releaseScreening: (value: unknown) => void = () => undefined;
    const screening = new Promise((resolve) => { releaseScreening = resolve; });
    api.getApi.mockImplementation(async (path: string) => {
      const id = path.includes('/a2') || path.includes('=a2') ? 'a2' : 'a1';
      if (path === '/screening/application/a1') return screening;
      if (path === `/applications/${id}/workspace`) {
        const workspace = structuredClone(base['/applications/a1/workspace']) as { application: { id: string; candidate: { firstName: string; lastName: string; fullName?: string } } };
        workspace.application.id = id;
        workspace.application.candidate.firstName = id === 'a1' ? 'First' : 'Second';
        workspace.application.candidate.lastName = 'Person';
        workspace.application.candidate.fullName = `${workspace.application.candidate.firstName} Person`;
        return workspace;
      }
      if (path.endsWith('/messages')) return MESSAGES_EMPTY;
      const bare = path.split('?')[0].replaceAll(id, 'a1');
      if (bare in base) return structuredClone(base[bare]);
      throw new ApiError(404, 'not found');
    });
    await user.click(screen.getByRole('button', { name: 'Retry screening' }));
    await user.click(screen.getByRole('button', { name: 'Open a2' }));
    expect(await screen.findByRole('heading', { name: 'Second Person' })).toBeInTheDocument();
    await act(async () => {
      releaseScreening([{ id: 's-stale', outcome: 'Passed', notes: 'Stale from a1', screenerName: 'Mariam Farag', screenedAt: '2026-10-02T10:00:00.000Z' }]);
      await screening;
    });
    expect(screen.queryByText('Stale from a1')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Second Person' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Person' })).not.toBeInTheDocument();
  });

  it('keeps saving off after a failed screening draft and allows it again after an empty draft', async () => {
    const user = userEvent.setup();
    serve('applied', { '/screening/application/a1/draft': new ApiError(500, 'Draft store failed.') });
    renderFile('/applications/a1?drawer=screen');
    expect(await screen.findByText(/Saving stays off until this read succeeds/)).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save and move to Interview' });
    expect(save).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(api.postApi).not.toHaveBeenCalled();
    responses['/screening/application/a1/draft'] = null;
    await user.click(screen.getByRole('button', { name: 'Retry screening draft' }));
    expect(await screen.findByRole('button', { name: 'Save and move to Interview' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save and move to Interview' }));
    expect(await screen.findByText(/Write the screen note/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
  });

  it('blocks screening writes while the draft GET is pending, preserves edited fields across retries and late responses, and writes after resolution', async () => {
    const user = userEvent.setup();
    let releaseDraft: (value: unknown) => void = () => undefined;
    const draftPending = new Promise((resolve) => { releaseDraft = resolve; });
    serve('applied', { '/screening/application/a1/draft': draftPending });
    renderFile('/applications/a1?drawer=screen');

    const dialog = await screen.findByRole('dialog', { name: /Log screen/ });
    expect(within(dialog).getByText('Loading screening draft. Saving stays off until this read finishes.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Retry screening draft' })).not.toBeInTheDocument();

    const savePrimary = within(dialog).getByRole('button', { name: 'Save and move to Interview' });
    const saveDraftBtn = within(dialog).getByRole('button', { name: 'Save draft' });
    expect(savePrimary).toBeDisabled();
    expect(saveDraftBtn).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Screen note/), 'Typed while draft was pending.');
    await user.type(within(dialog).getByLabelText(/Evidence source/), 'Live phone screen');

    await user.click(saveDraftBtn);
    await user.click(savePrimary);
    fireEvent.submit(dialog.querySelector('form')!);
    expect(api.postApi).not.toHaveBeenCalled();
    expect(api.putApi).not.toHaveBeenCalled();
    expect(api.patchApi).not.toHaveBeenCalled();

    await act(async () => {
      releaseDraft({
        id: 'draft-server',
        applicationId: 'a1',
        organizationId: 'o',
        userId: 'u-mariam',
        outcome: 'Passed',
        notes: 'Older server draft note.',
        noticePeriodDays: 14,
        method: 'Video',
        evidenceSource: 'Older server source',
        nextStep: 'Keep in screening',
        moveToInterview: true,
        createdAt: '2026-10-15T10:00:00.000Z',
        updatedAt: '2026-10-15T10:00:00.000Z',
      });
      await draftPending;
    });

    expect(within(dialog).queryByText(/Loading screening draft/)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Screen note/)).toHaveValue('Typed while draft was pending.');
    expect(within(dialog).getByLabelText(/Evidence source/)).toHaveValue('Live phone screen');
    expect(within(dialog).getByLabelText(/^Next step/)).toHaveValue('Keep in screening');
    expect(within(dialog).getByLabelText(/Notice period/)).toHaveValue(14);
    expect(savePrimary).toBeEnabled();
    expect(saveDraftBtn).toBeEnabled();
    expect(api.postApi).not.toHaveBeenCalled();
    expect(api.putApi).not.toHaveBeenCalled();

    await user.click(saveDraftBtn);
    await waitFor(() => expect(api.putApi).toHaveBeenCalledWith('/screening/application/a1/draft', {
      outcome: 'Passed',
      notes: 'Typed while draft was pending.',
      noticePeriodDays: 14,
      method: 'Video',
      evidenceSource: 'Live phone screen',
      nextStep: 'Keep in screening',
      moveToInterview: true,
    }));
    expect(api.postApi).not.toHaveBeenCalled();

    await user.click(savePrimary);
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/screening', {
      applicationId: 'a1',
      outcome: 'Passed',
      notes: 'Typed while draft was pending.',
      noticePeriodDays: 14,
      method: 'Video',
      evidenceSource: 'Live phone screen',
      nextStep: 'Keep in screening',
    }));
  });

  it('reconciles dependent scorecards after interview retry for empty and non-empty interviews', async () => {
    const user = userEvent.setup();
    serve('interview', { '/interviews': new ApiError(500, 'Interviews could not be listed.') });
    const emptyRecovery = renderFile();
    expect(await screen.findByRole('button', { name: 'Action unavailable' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retry interviews' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry scorecards' })).not.toBeInTheDocument();

    responses['/interviews'] = [];
    api.getApi.mockClear();
    await user.click(screen.getByRole('button', { name: 'Retry interviews' }));
    expect(await screen.findByRole('button', { name: 'Schedule interview' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Action unavailable' })).not.toBeInTheDocument();
    expect(api.getApi.mock.calls.map(([path]) => path)).toEqual(['/interviews?applicationId=a1']);
    emptyRecovery.unmount();

    serve('scored', { '/interviews': new ApiError(500, 'Interviews could not be listed.') });
    renderFile();
    expect(await screen.findByRole('button', { name: 'Action unavailable' })).toBeDisabled();
    responses['/interviews'] = fileResponses('scored')['/interviews'];
    api.getApi.mockClear();
    await user.click(screen.getByRole('button', { name: 'Retry interviews' }));
    expect(await screen.findByRole('button', { name: 'Draft offer' })).toBeEnabled();
    expect(within(screen.getByRole('list', { name: 'Gate to Offer' })).getByText(/Scorecard submitted/).closest('li')).toHaveAttribute('data-ok', 'true');
    expect(screen.getByRole('list', { name: 'Interviews' })).toHaveTextContent('1 scorecard submitted');
    expect(api.getApi.mock.calls.map(([path]) => path)).toEqual(['/interviews?applicationId=a1', '/interviews/iv1/scorecard']);
  });

  it('shows failed-section blocker and targeted retry for manager view without exposing owner actions or hiding offer review', async () => {
    const user = userEvent.setup();
    serve('offer-pending', { '/offers': new ApiError(500, 'Offer list failed.') });
    const blockedManager = render(
      <MemoryRouter initialEntries={['/applications/a1']}>
        <Routes>
          <Route path="/applications/:id" element={<ApplicationFileV2 mode="manager" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Action unavailable' })).toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent('The offer could not be loaded. Try again.');
    expect(screen.getAllByRole('button', { name: 'Retry the offer' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Retry the offer' })).toBeEnabled();
    for (const forbidden of ['Log screen', 'Schedule', 'Scorecard', 'Offer', 'Pre-hire', 'Reject', 'Note']) {
      expect(screen.queryByRole('button', { name: (value) => value === forbidden })).not.toBeInTheDocument();
    }

    responses['/offers'] = fileResponses('offer-pending')['/offers'];
    api.getApi.mockClear();
    await user.click(screen.getByRole('button', { name: 'Retry the offer' }));
    expect(await screen.findByRole('button', { name: 'Review offer' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Action unavailable' })).not.toBeInTheDocument();
    expect(api.getApi.mock.calls.map(([path]) => path)).toEqual(['/offers?applicationId=a1', '/offers/o1']);
    blockedManager.unmount();

    const pendingOffer = fileResponses('offer-pending')['/offers/o1'];
    serve('prehire', { '/offers': [pendingOffer], '/offers/o1': pendingOffer, '/hiring': new ApiError(500, 'Hiring case failed.') });
    const blockedWithOffer = render(
      <MemoryRouter initialEntries={['/applications/a1']}>
        <Routes>
          <Route path="/applications/:id" element={<ApplicationFileV2 mode="manager" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Action unavailable' })).toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Hiring could not be loaded. Try again.');
    expect(screen.getAllByRole('button', { name: 'Retry hiring' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Review offer' })).toBeEnabled();
    for (const forbidden of ['Log screen', 'Schedule', 'Scorecard', 'Offer', 'Pre-hire', 'Reject', 'Note']) {
      expect(screen.queryByRole('button', { name: (value) => value === forbidden })).not.toBeInTheDocument();
    }
    responses['/hiring'] = fileResponses('prehire')['/hiring'];
    api.getApi.mockClear();
    await user.click(screen.getByRole('button', { name: 'Retry hiring' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Action unavailable' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Review offer' })).toBeEnabled();
    expect(api.getApi.mock.calls.map(([path]) => path)).toEqual(['/hiring?applicationId=a1']);
    blockedWithOffer.unmount();

    serve('offer-pending', { '/screening/application/a1': new ApiError(500, 'Screening timed out.') });
    render(
      <MemoryRouter initialEntries={['/applications/a1']}>
        <Routes>
          <Route path="/applications/:id" element={<ApplicationFileV2 mode="manager" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Review offer' })).toBeEnabled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Screening could not be loaded. Try again.');
    expect(screen.getAllByRole('button', { name: 'Retry screening' })).toHaveLength(1);
    responses['/screening/application/a1'] = fileResponses('offer-pending')['/screening/application/a1'];
    api.getApi.mockClear();
    await user.click(screen.getByRole('button', { name: 'Retry screening' }));
    expect(await screen.findByText('Notice: 30 days')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review offer' })).toBeEnabled();
    expect(api.getApi.mock.calls.map(([path]) => path)).toEqual(['/screening/application/a1']);
  });

  it('connects document history retry, loading, error, and request controls to the parent documents section', async () => {
    const user = userEvent.setup();
    serve('interview', {
      '/applications/a1/documents': new ApiError(500, 'Documents down.'),
      '/applications/a1/document-history': {
        documents: [{ id: 'd1', type: 'CV', name: 'Ahmed_Embaby_CV.pdf', uploadedAt: '2026-10-01T09:00:00.000Z', uploadedBy: { id: 'u-mariam', name: 'Mariam Farag' }, hasFile: true, version: 2 }],
        requests: [{ id: 'req-1', documentType: 'Passport', at: '2026-10-05T09:00:00.000Z' }],
      },
    });
    const parentFailed = renderFile('/applications/a1?tab=documents');
    expect(await screen.findByText('Documents could not be loaded. Try again.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry documents' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Request this document' })).toBeDisabled();
    expect(api.getApi.mock.calls.some(([path]) => String(path).endsWith('/document-history'))).toBe(false);

    responses['/applications/a1/documents'] = fileResponses('interview')['/applications/a1/documents'];
    api.getApi.mockClear();
    await user.click(screen.getByRole('button', { name: 'Retry documents' }));
    expect(await screen.findByText(/File stored · Version 2/)).toBeInTheDocument();
    expect(screen.getByText(/Passport requested/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request this document' })).toBeEnabled();
    expect(api.getApi.mock.calls.map(([path]) => path)).toEqual(['/applications/a1/documents', '/applications/a1/document-history']);
    parentFailed.unmount();

    serve('interview', { '/applications/a1/document-history': new ApiError(500, 'History down.') });
    const historyFailed = renderFile('/applications/a1?tab=documents');
    expect(await screen.findByText('Document history could not be loaded. Try again.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry documents' })).toHaveLength(1);
    expect(screen.getByText('Ahmed_Embaby_CV.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request this document' })).toBeDisabled();

    responses['/applications/a1/document-history'] = {
      documents: [{ id: 'd1', type: 'CV', name: 'Ahmed_Embaby_CV.pdf', uploadedAt: '2026-10-01T09:00:00.000Z', uploadedBy: { id: 'u-mariam', name: 'Mariam Farag' }, hasFile: true, version: 3 }],
      requests: [],
    };
    api.getApi.mockClear();
    await user.click(screen.getByRole('button', { name: 'Retry documents' }));
    expect(await screen.findByText(/File stored · Version 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request this document' })).toBeEnabled();
    expect(api.getApi.mock.calls.map(([path]) => path)).toEqual(['/applications/a1/document-history']);
    historyFailed.unmount();

    serve('interview', { '/applications/a1/documents': new ApiError(403, 'Forbidden') });
    api.getApi.mockClear();
    renderFile('/applications/a1?tab=documents');
    expect(await screen.findByText('Documents is not available for this role.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry documents' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request this document' })).not.toBeInTheDocument();
    expect(api.getApi.mock.calls.some(([path]) => String(path).endsWith('/document-history'))).toBe(false);
    expect(api.postApi).not.toHaveBeenCalled();
  });

  it('treats document-history 404 and 403 as explicit failures even when parent documents are known or other sections are role-unavailable', async () => {
    const user = userEvent.setup();
    serve('interview', {
      '/applications/a1/documents': [],
      '/applications/a1/document-history': new ApiError(404, 'Application not found.'),
    });
    const emptyParent404 = renderFile('/applications/a1?tab=documents');
    expect(await screen.findByRole('alert')).toHaveTextContent('Document history could not be found for this file.');
    expect(screen.queryByText('No documents yet.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry documents' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Request this document' })).toBeDisabled();

    responses['/applications/a1/document-history'] = { documents: [], requests: [] };
    api.getApi.mockClear();
    await user.click(screen.getByRole('button', { name: 'Retry documents' }));
    expect(await screen.findByText('No documents yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request this document' })).toBeEnabled();
    expect(api.getApi.mock.calls.map(([path]) => path)).toEqual(['/applications/a1/document-history']);
    emptyParent404.unmount();

    serve('interview', {
      '/applications/a1/document-history': new ApiError(404, 'Application not found.'),
    });
    const fallbackParent404 = renderFile('/applications/a1?tab=documents');
    expect(await screen.findByRole('alert')).toHaveTextContent('Document history could not be found for this file.');
    expect(screen.getByText('Ahmed_Embaby_CV.pdf')).toBeInTheDocument();
    expect(screen.queryByText('No documents yet.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry documents' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Request this document' })).toBeDisabled();
    fallbackParent404.unmount();

    serve('interview', {
      '/applications/a1/notes': new ApiError(403, 'Forbidden'),
      '/screening/application/a1': new ApiError(403, 'Forbidden'),
      '/applications/a1/document-history': new ApiError(403, 'Forbidden'),
    });
    api.getApi.mockClear();
    renderFile('/applications/a1?tab=documents');
    expect(await screen.findByText('Not requested for this role: Notes, Screening.')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Document history is not available for this role.');
    expect(screen.getByText('Ahmed_Embaby_CV.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry documents' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request this document' })).not.toBeInTheDocument();
  });

  it('clears the previous application and its actions immediately while a new route id is loading', async () => {
    const user = userEvent.setup();
    const base = fileResponses('applied');
    let releaseA2: (value: unknown) => void = () => undefined;
    const a2Workspace = new Promise((resolve) => { releaseA2 = resolve; });
    const workspaceFor = (id: string, first: string, last: string) => {
      const workspace = structuredClone(base['/applications/a1/workspace']) as { application: { id: string; candidate: { firstName: string; lastName: string; fullName?: string } } };
      workspace.application.id = id;
      workspace.application.candidate.firstName = first;
      workspace.application.candidate.lastName = last;
      workspace.application.candidate.fullName = `${first} ${last}`;
      return workspace;
    };
    api.getApi.mockImplementation(async (path: string) => {
      const id = path.includes('/a2') || path.includes('=a2') ? 'a2' : 'a1';
      if (path === `/applications/${id}/workspace`) return id === 'a2' ? a2Workspace : workspaceFor('a1', 'First', 'Person');
      if (path.endsWith('/messages')) return MESSAGES_EMPTY;
      const bare = path.split('?')[0].replaceAll(id, 'a1');
      if (bare in base) return structuredClone(base[bare]);
      throw new ApiError(404, 'not found');
    });
    render(
      <MemoryRouter initialEntries={['/applications/a1']}>
        <Routes>
          <Route path="/applications/:id" element={<><ApplicationFileV2 /><Jump /></>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'First Person' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log screen' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Open a2' }));
    expect(screen.getByLabelText('Loading the application file…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Person' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log screen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Smart actions' })).not.toBeInTheDocument();

    await act(async () => {
      releaseA2(workspaceFor('a2', 'Second', 'Person'));
      await a2Workspace;
    });
    expect(await screen.findByRole('heading', { name: 'Second Person' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log screen' })).toBeEnabled();
  });

  it('blocks direct ?drawer=screen writes and stage advancement when the screening section failed', async () => {
    const user = userEvent.setup();
    serve('applied', {
      '/screening/application/a1': new ApiError(500, 'Screening store timed out.'),
      '/screening/application/a1/draft': null,
    });
    renderFile('/applications/a1?drawer=screen');
    const dialog = await screen.findByRole('dialog', { name: /Log screen/ });
    expect(within(dialog).getByText('Screening could not be checked. Saving is turned off so a failed read is not replaced.')).toBeInTheDocument();
    const savePrimary = within(dialog).getByRole('button', { name: 'Save and move to Interview' });
    const saveDraftBtn = within(dialog).getByRole('button', { name: 'Save draft' });
    expect(savePrimary).toBeDisabled();
    expect(saveDraftBtn).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Screen note/), 'Attempted direct write');
    await user.type(within(dialog).getByLabelText(/Evidence source/), 'Phone call');
    await user.selectOptions(within(dialog).getByLabelText(/^Next step/), 'Move to interview');
    await user.click(saveDraftBtn);
    await user.click(savePrimary);
    fireEvent.submit(dialog.querySelector('form')!);
    expect(api.postApi).not.toHaveBeenCalled();
    expect(api.putApi).not.toHaveBeenCalled();
    expect(api.patchApi).not.toHaveBeenCalled();
  });

  it('blocks stage actions and shows retry when a required section or scorecard returns a malformed 200 payload', async () => {
    const user = userEvent.setup();
    serve('interview', {
      '/interviews/iv1/scorecard': { malformed: true },
    });
    const view = renderFile('/applications/a1');
    expect(await screen.findByRole('button', { name: 'Action unavailable' })).toBeDisabled();
    expect(screen.getAllByText('Scorecards could not be read.').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Submit scorecard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Draft offer' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry scorecards' }).length).toBeGreaterThan(0);

    responses['/interviews/iv1/scorecard'] = [];
    api.getApi.mockClear();
    await user.click(screen.getAllByRole('button', { name: 'Retry scorecards' })[0]);
    expect(await screen.findByText("Waiting on Karim Hassan's scorecard")).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Scorecard' })[0]).toBeEnabled();
    expect(api.getApi.mock.calls.map(([path]) => path)).toEqual(['/interviews/iv1/scorecard']);
    view.unmount();

    serve('interview', {
      '/applications/a1/document-history': { documents: [], requests: 'malformed' },
    });
    const malformedHistory = renderFile('/applications/a1?tab=documents');
    expect(await screen.findByRole('alert')).toHaveTextContent('Document history could not be read.');
    expect(screen.getByRole('button', { name: 'Request this document' })).toBeDisabled();
    malformedHistory.unmount();

    serve('interview', {
      '/interviews': [{}],
      '/applications/a1/documents': [{}],
    });
    const malformedRows = renderFile('/applications/a1?tab=documents');
    expect(await screen.findByRole('button', { name: 'Action unavailable' })).toBeDisabled();
    expect(screen.getAllByText('Interviews could not be read.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Documents could not be read.').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Submit scorecard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Draft offer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request this document' })).toBeDisabled();

    const baseScored = fileResponses('scored');
    responses['/interviews'] = baseScored['/interviews'];
    responses['/interviews/iv1/scorecard'] = baseScored['/interviews/iv1/scorecard'];
    responses['/applications/a1/documents'] = baseScored['/applications/a1/documents'];
    responses['/applications/a1/document-history'] = { documents: baseScored['/applications/a1/documents'], requests: [] };
    api.getApi.mockClear();
    await user.click(screen.getAllByRole('button', { name: 'Retry interviews' })[0]);
    expect(await screen.findByRole('button', { name: 'Draft offer' })).toBeEnabled();
    await user.click(screen.getAllByRole('button', { name: 'Retry documents' })[0]);
    expect(await screen.findByText('Ahmed_Embaby_CV.pdf')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Request this document' })).toBeEnabled());
    malformedRows.unmount();

    serve('interview', {
      '/applications/a1/document-history': { documents: [{}], requests: [] },
    });
    renderFile('/applications/a1?tab=documents');
    expect(await screen.findByRole('alert')).toHaveTextContent('Document history could not be read.');
    expect(screen.getByRole('button', { name: 'Request this document' })).toBeDisabled();
  });
});
