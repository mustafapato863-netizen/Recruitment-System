import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TalentPoolPage } from '../TalentPoolPage';

const api = vi.hoisted(() => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
  fetchVacancyList: vi.fn(),
}));

vi.mock('../../api/client', () => ({ getApi: api.getApi, postApi: api.postApi }));
vi.mock('../../utils/vacancyAccess', () => ({ fetchVacancyList: api.fetchVacancyList }));
vi.mock('../../components/ui/ToastContext', () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock('../../components/vacancy/EditPositionRequirementsModal', () => ({ EditPositionRequirementsModal: () => null }));

const job = {
  id: 'v1',
  vacancyCode: 'TEST-JOB',
  title: 'Software Developer',
  status: 'Open',
  requiredSkills: ['SQL', 'React'],
  minExperienceYears: 3,
  location: 'Cairo',
  department: 'Engineering',
  jobSummary: 'Build internal tools.',
};

function person(
  id: string,
  firstName: string,
  skills: string[] = [],
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    firstName,
    lastName: 'Synthetic',
    candidateCode: id,
    status: 'Active',
    skills,
    certifications: [],
    currentTitle: 'Accounts assistant',
    experienceYears: 0,
    location: null,
    summary: null,
    ...extra,
  };
}

function mount() {
  return render(
    <MemoryRouter>
      <TalentPoolPage />
    </MemoryRouter>,
  );
}

async function row(name: string) {
  const heading = await screen.findByRole('heading', { name: `${name} Synthetic` });
  const card = heading.closest('article');
  if (!card) throw new Error(`No candidate card for ${name}`);
  return card;
}

describe('TalentPoolPage match trust', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchVacancyList.mockResolvedValue({ full: [job], redacted: [] });
    api.getApi.mockResolvedValue({
      data: [person('a', 'Alpha'), person('b', 'Beta', ['SQL', 'React'])],
    });
  });

  it('shows 0% and No evidence found when the candidate has no matching skills', async () => {
    mount();
    const card = await row('Alpha');
    expect(within(card).getByRole('img', { name: '0% No evidence found' })).toBeInTheDocument();
    expect(within(card).getByText('0%')).toBeInTheDocument();
    expect(within(card).getByText('No evidence found')).toBeInTheDocument();
    expect(within(card).queryByText('95%')).not.toBeInTheDocument();
    expect(within(card).getByText(/Matched skills/)).toHaveTextContent('(0/2)');
    expect(within(card).getByRole('button', { name: 'Add to pipeline' })).toBeEnabled();
  });

  it('keeps each candidate score when the API returns candidates in a different order', async () => {
    mount();
    expect(within(await row('Alpha')).getByRole('img', { name: '0% No evidence found' })).toBeInTheDocument();
    expect(within(await row('Beta')).getByRole('img', { name: '100% Excellent match' })).toBeInTheDocument();
    cleanup();

    api.getApi.mockResolvedValue({
      data: [person('b', 'Beta', ['SQL', 'React']), person('a', 'Alpha')],
    });
    mount();

    expect(within(await row('Alpha')).getByRole('img', { name: '0% No evidence found' })).toBeInTheDocument();
    expect(within(await row('Beta')).getByRole('img', { name: '100% Excellent match' })).toBeInTheDocument();
    expect(within(await row('Alpha')).queryByText('88%')).not.toBeInTheDocument();
    expect(within(await row('Beta')).queryByText('95%')).not.toBeInTheDocument();
  });

  it('does not substitute nursing skills when the job has no required skills', async () => {
    api.fetchVacancyList.mockResolvedValue({ full: [{ ...job, requiredSkills: [] }], redacted: [] });
    mount();
    await row('Alpha');
    const context = screen.getByRole('region', { name: 'Target job specification' });
    expect(within(context).queryByText('Patient Care')).not.toBeInTheDocument();
    expect(within(context).queryByText('Medication Administration')).not.toBeInTheDocument();
    expect(context).toHaveTextContent(
      'No required skills defined for this job yet. Finish job requirements to calculate skill matches.',
    );
    expect(context).not.toHaveTextContent('Registered Nurse');
    expect(context).not.toHaveTextContent('CND-SGH-001');
    expect(context).not.toHaveTextContent('SGH Dubai Hospital');
    expect(context).not.toHaveTextContent('8 seats');
    expect(context).toHaveTextContent('Seats not specified');
    expect(within(await row('Alpha')).getByRole('img', { name: '— Requirements needed' })).toBeInTheDocument();
    expect(within(context).getByRole('button', { name: 'Add / Edit skills' })).toBeEnabled();
  });

  it('keeps short license requirements verbatim', async () => {
    api.fetchVacancyList.mockResolvedValue({
      full: [{ ...job, requiredSkills: ['DHA', 'MOH'] }],
      redacted: [],
    });
    mount();
    await row('Alpha');
    const context = screen.getByRole('region', { name: 'Target job specification' });
    expect(within(context).getByText('DHA')).toBeInTheDocument();
    expect(within(context).getByText('MOH')).toBeInTheDocument();
    expect(within(context).queryByText('Patient Care')).not.toBeInTheDocument();
    expect(within(context).queryByText('Clinical Documentation')).not.toBeInTheDocument();
  });

  it('does not synthesize a redacted job or enable requirement editing', async () => {
    api.fetchVacancyList.mockResolvedValue({
      full: [],
      redacted: [{ id: 'v-hidden', redacted: true, title: 'Restricted software role', site: null, seats: null }],
    });
    mount();
    const card = await row('Alpha');
    const context = screen.getByRole('region', { name: 'Target job specification' });
    expect(context).toHaveTextContent('Restricted software role');
    expect(context).toHaveTextContent('Restricted location');
    expect(context).toHaveTextContent('Restricted access');
    expect(context).not.toHaveTextContent('SGH Dubai Hospital');
    expect(context).not.toHaveTextContent('Nursing');
    expect(context).not.toHaveTextContent('8 seats');
    expect(context).not.toHaveTextContent('CND-SGH-001');
    expect(context).not.toHaveTextContent('Posted 15 Oct 2026');
    expect(context).not.toHaveTextContent('Registered Nurse');
    expect(within(context).getByRole('button', { name: 'Add / Edit skills' })).toBeDisabled();
    expect(within(card).getByRole('button', { name: 'Add to pipeline' })).toBeDisabled();
    expect(within(card).getByRole('img', { name: '— Requirements needed' })).toBeInTheDocument();
  });

  it('shows no match percentage when no job is selectable', async () => {
    api.fetchVacancyList.mockResolvedValue({ full: [], redacted: [] });
    mount();
    const card = await row('Alpha');
    expect(within(card).getByRole('img', { name: '— No requirements' })).toBeInTheDocument();
    expect(within(card).queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Target job specification' })).toHaveTextContent('No job selected');
    expect(within(card).getByRole('button', { name: 'Add to pipeline' })).toBeDisabled();
  });

  it('renders missing candidate facts and real availability instead of invented defaults', async () => {
    api.getApi.mockResolvedValue({
      data: [
        person('a', 'Alpha', [], {
          currentTitle: null,
          location: null,
          experienceYears: null,
          availability: null,
        }),
        person('b', 'Beta', [], {
          availability: 'Immediate',
          location: 'Cairo',
          experienceYears: 6,
          currentTitle: 'Analyst',
        }),
        person('c', 'Cara', [], {
          availability: null,
          metadata: { availability: '30 days notice' },
        }),
      ],
    });
    mount();

    const alpha = await row('Alpha');
    expect(within(alpha).getByText('Title not specified')).toBeInTheDocument();
    expect(within(alpha).getByText('Location not specified')).toBeInTheDocument();
    expect(within(alpha).getByText('Experience not specified')).toBeInTheDocument();
    expect(within(alpha).getByText('Availability not specified')).toBeInTheDocument();
    expect(within(alpha).queryByText('Dubai')).not.toBeInTheDocument();
    expect(within(alpha).queryByText('4 years')).not.toBeInTheDocument();
    expect(within(alpha).queryByText('Software Developer')).not.toBeInTheDocument();

    expect(within(await row('Beta')).getByText('• Available')).toBeInTheDocument();
    expect(within(await row('Cara')).getByText('Notice period')).toBeInTheDocument();

    cleanup();
    api.getApi.mockResolvedValue({
      data: [
        person('c', 'Cara', [], { availability: null, metadata: { availability: '30 days notice' } }),
        person('b', 'Beta', [], { availability: 'Immediate', location: 'Cairo', experienceYears: 6, currentTitle: 'Analyst' }),
        person('a', 'Alpha', [], { currentTitle: null, location: null, experienceYears: null, availability: null }),
      ],
    });
    mount();
    expect(within(await row('Beta')).getByText('• Available')).toBeInTheDocument();
    expect(within(await row('Cara')).getByText('Notice period')).toBeInTheDocument();
    expect(within(await row('Alpha')).getByText('Availability not specified')).toBeInTheDocument();
  });

  function suggestionPayload(vacancyId: string, unmapped: string[], suggestions: Array<Record<string, unknown>>) {
    return {
      vacancyId,
      requiredSkills: [{ id: 's-sql', name: 'SQL' }, { id: 's-react', name: 'React' }],
      unmappedRequiredSkills: unmapped,
      orderedBy: ['required skills with at least one piece of evidence (more first)'],
      suggestions,
    };
  }

  it('merges server evidence, unmapped skills, and application status into the match list', async () => {
    api.getApi.mockImplementation((url: string) => {
      if (String(url).includes('/suggestions')) {
        return Promise.resolve(suggestionPayload('v1', ['Legacy COBOL'], [
          {
            candidate: { id: 'a', code: 'a', name: 'Alpha Synthetic', currentTitle: null, location: null },
            matchedSkills: [],
            missingSkills: [{ id: 's-sql', name: 'SQL' }, { id: 's-react', name: 'React' }],
            applicationId: 'app-alpha',
            alreadyOnJob: true,
            stage: 'Screening',
            addable: false,
          },
          {
            candidate: { id: 'b', code: 'b', name: 'Beta Synthetic', currentTitle: null, location: null },
            matchedSkills: [{
              skill: { id: 's-sql', name: 'SQL' },
              hasEvidence: true,
              evidence: [{ id: 'e1', sourceType: 'CV_TEXT', sourceRef: null, snippet: 'Built SQL reports', addedBy: null, addedAt: '2026-01-01T00:00:00.000Z' }],
            }],
            missingSkills: [{ id: 's-react', name: 'React' }],
            applicationId: null,
            alreadyOnJob: false,
            stage: null,
            addable: true,
          },
        ]));
      }
      return Promise.resolve({ data: [person('a', 'Alpha'), person('b', 'Beta', ['SQL', 'React'])] });
    });

    mount();
    const context = await screen.findByRole('region', { name: 'Target job specification' });
    expect(await within(context).findByText(/Not in the active skill library: Legacy COBOL/)).toBeInTheDocument();

    const alpha = await row('Alpha');
    expect(within(alpha).getByRole('link', { name: 'Open application (Screening)' })).toHaveAttribute('href', '/applications/app-alpha');
    expect(within(alpha).queryByRole('button', { name: 'Add to pipeline' })).not.toBeInTheDocument();
    expect(within(alpha).getByRole('img', { name: '0% No evidence found' })).toBeInTheDocument();

    const beta = await row('Beta');
    expect(within(beta).getByText('Built SQL reports')).toBeInTheDocument();
    expect(within(beta).getByRole('img', { name: '33% Low match' })).toBeInTheDocument();
    expect(within(beta).getByText(/Matched skills/)).toHaveTextContent('(1/3)');
    expect(within(beta).getByText('Legacy COBOL')).toBeInTheDocument();
    expect(within(beta).getByRole('button', { name: 'Add to pipeline' })).toBeEnabled();
  });

  it('zeros a candidate the server did not match instead of keeping the local score', async () => {
    api.getApi.mockImplementation((url: string) => {
      if (String(url).includes('/suggestions')) {
        return Promise.resolve(suggestionPayload('v1', [], [
          {
            candidate: { id: 'a', code: 'a', name: 'Alpha Synthetic', currentTitle: null, location: null },
            matchedSkills: [],
            missingSkills: [{ id: 's-sql', name: 'SQL' }, { id: 's-react', name: 'React' }],
            applicationId: null,
            alreadyOnJob: false,
            stage: null,
            addable: true,
          },
        ]));
      }
      return Promise.resolve({ data: [person('a', 'Alpha'), person('b', 'Beta', ['SQL', 'React'])] });
    });

    mount();
    expect(await within(await row('Beta')).findByRole('img', { name: '0% No evidence found' })).toBeInTheDocument();
    expect(within(await row('Beta')).queryByRole('img', { name: '100% Excellent match' })).not.toBeInTheDocument();
    expect(within(await row('Beta')).getByText(/Matched skills/)).toHaveTextContent('(0/2)');
  });

  it('ignores a forbidden suggestions response and keeps the local match', async () => {
    api.getApi.mockImplementation((url: string) => {
      if (String(url).includes('/suggestions')) {
        return Promise.reject(Object.assign(new Error('forbidden'), { statusCode: 403 }));
      }
      return Promise.resolve({ data: [person('a', 'Alpha'), person('b', 'Beta', ['SQL', 'React'])] });
    });

    mount();
    expect(within(await row('Alpha')).getByRole('img', { name: '0% No evidence found' })).toBeInTheDocument();
    expect(within(await row('Beta')).getByRole('img', { name: '100% Excellent match' })).toBeInTheDocument();
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/vacancies/v1/suggestions'));
    expect(screen.queryByText(/Not in the active skill library/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(within(await row('Beta')).getByRole('button', { name: 'Add to pipeline' })).toBeEnabled();
  });

  it('ignores a missing suggestions route and keeps the local match', async () => {
    api.getApi.mockImplementation((url: string) => {
      if (String(url).includes('/suggestions')) {
        return Promise.reject(Object.assign(new Error('missing'), { status: 404 }));
      }
      return Promise.resolve({ data: [person('a', 'Alpha'), person('b', 'Beta', ['SQL', 'React'])] });
    });

    mount();
    expect(within(await row('Beta')).getByRole('img', { name: '100% Excellent match' })).toBeInTheDocument();
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/vacancies/v1/suggestions'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('discards a stale suggestions response after the selected job changes', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    const firstJob = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    api.fetchVacancyList.mockResolvedValue({
      full: [job, { ...job, id: 'v2', vacancyCode: 'OTHER', title: 'Other role', requiredSkills: ['SQL', 'React'] }],
      redacted: [],
    });
    api.getApi.mockImplementation((url: string) => {
      const path = String(url);
      if (path === '/vacancies/v1/suggestions') return firstJob;
      if (path === '/vacancies/v2/suggestions') {
        return Promise.resolve(suggestionPayload('v2', ['Python Toolkit'], []));
      }
      return Promise.resolve({ data: [person('a', 'Alpha'), person('b', 'Beta', ['SQL', 'React'])] });
    });

    mount();
    await screen.findByRole('heading', { name: 'Alpha Synthetic' });
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/vacancies/v1/suggestions'));
    fireEvent.change(screen.getByLabelText('Job to match against'), { target: { value: 'v2' } });
    expect(await screen.findByText(/Not in the active skill library: Python Toolkit/)).toBeInTheDocument();

    await act(async () => {
      resolveFirst(suggestionPayload('v1', ['Stale Procedure'], []));
      await Promise.resolve();
    });

    expect(screen.queryByText(/Stale Procedure/)).not.toBeInTheDocument();
    expect(screen.getByText(/Python Toolkit/)).toBeInTheDocument();
    expect(screen.getByLabelText('Job to match against')).toHaveValue('v2');
  });

  it('discards a stale candidate load when a newer job query finishes first', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    let candidateCalls = 0;
    api.fetchVacancyList.mockResolvedValue({
      full: [
        { ...job, id: 'v1', title: 'First role', vacancyCode: 'FIRST' },
        { ...job, id: 'v2', title: 'Second role', vacancyCode: 'SECOND' },
      ],
      redacted: [],
    });
    api.getApi.mockImplementation((url: string) => {
      const path = String(url);
      if (path.includes('/suggestions')) return Promise.resolve({ vacancyId: 'ignored' });
      candidateCalls += 1;
      if (candidateCalls === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve({ data: [person('b', 'Beta', ['SQL', 'React'])] });
    });

    function QuerySwitch() {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate('/sourcing-match?vacancyId=v2')}>Switch job query</button>;
    }

    render(
      <MemoryRouter initialEntries={['/sourcing-match?vacancyId=v1']}>
        <TalentPoolPage />
        <QuerySwitch />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch job query' }));
    expect(await screen.findByRole('heading', { name: 'Beta Synthetic' })).toBeInTheDocument();
    expect(screen.getByLabelText('Job to match against')).toHaveValue('v2');

    await act(async () => {
      resolveFirst({ data: [person('z', 'Stale', ['SQL', 'React'])] });
      await Promise.resolve();
    });

    expect(screen.queryByRole('heading', { name: 'Stale Synthetic' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Beta Synthetic' })).toBeInTheDocument();
    expect(screen.getByLabelText('Job to match against')).toHaveValue('v2');
  });
});
