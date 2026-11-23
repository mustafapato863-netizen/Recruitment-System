import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditPositionRequirementsModal } from '../../components/vacancy/EditPositionRequirementsModal';
import { TalentPoolPage } from '../TalentPoolPage';

const api = vi.hoisted(() => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
  patchApi: vi.fn(),
  fetchVacancyList: vi.fn(),
}));

const toast = vi.hoisted(() => ({ show: vi.fn() }));

const auth = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    permissions: [] as string[],
    roles: [{ id: 'role-1', code: 'RECRUITER', name: 'Recruiter' }],
  },
}));

vi.mock('../../api/client', () => ({
  getApi: api.getApi,
  postApi: api.postApi,
  patchApi: api.patchApi,
}));
vi.mock('../../utils/vacancyAccess', () => ({ fetchVacancyList: api.fetchVacancyList }));
vi.mock('../../components/ui/ToastContext', () => ({ useToast: () => ({ show: toast.show }) }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: auth.user, isLoading: false }) }));
vi.mock('../../hooks/useMasterDataOptions', () => ({
  useMasterDataOptions: () => ({ options: [], isLoading: false, error: null }),
}));

const job = {
  id: 'v1',
  vacancyCode: 'TEST-JOB',
  title: 'Software Developer',
  status: 'Open',
  requiredSkills: ['SQL', 'React'],
  minExperienceYears: 3,
  location: 'Cairo',
  department: 'Engineering',
  qualifications: 'BSc',
  jobSummary: 'Build internal tools.',
};

function person(id: string, firstName: string) {
  return {
    id,
    firstName,
    lastName: 'Synthetic',
    candidateCode: id,
    status: 'Active',
    skills: [],
    certifications: [],
    currentTitle: 'Accounts assistant',
    experienceYears: 0,
    location: null,
    summary: null,
  };
}

const people = [
  person('a', 'Alpha'),
  person('b', 'Beta'),
  person('c', 'Cara'),
  person('d', 'Dani'),
  person('e', 'Eden'),
];

function QueryProbe() {
  const [params] = useSearchParams();
  return <div data-testid="query">{params.toString()}</div>;
}

function mount(path = '/sourcing-match') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TalentPoolPage />
      <QueryProbe />
    </MemoryRouter>,
  );
}

async function row(name: string) {
  const heading = await screen.findByRole('heading', { name: `${name} Synthetic` });
  const card = heading.closest('article');
  if (!card) throw new Error(`No candidate card for ${name}`);
  return card;
}

describe('TalentPoolPage employee actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user.permissions = [];
    auth.user.roles = [{ id: 'role-1', code: 'RECRUITER', name: 'Recruiter' }];
    api.fetchVacancyList.mockResolvedValue({ full: [job], redacted: [] });
    api.getApi.mockImplementation((url: string) => {
      if (String(url).includes('/suggestions')) return Promise.resolve(null);
      return Promise.resolve({ data: people });
    });
    api.postApi.mockResolvedValue({ id: 'app-new' });
    api.patchApi.mockResolvedValue({});
  });

  it('creates an application at Applied and saves an optional note separately', async () => {
    const user = userEvent.setup();
    mount();
    const card = await row('Alpha');
    await user.click(within(card).getByRole('button', { name: 'Add to pipeline' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to pipeline' });
    expect(within(dialog).getByText('Entry stage: Applied')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Stage')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Note'), 'Bring SQL samples');
    await user.click(within(dialog).getByRole('button', { name: 'Add to job' }));

    await waitFor(() => {
      expect(api.postApi).toHaveBeenNthCalledWith(1, '/applications', { candidateId: 'a', vacancyId: 'v1' });
      expect(api.postApi).toHaveBeenNthCalledWith(2, '/applications/app-new/notes', { content: 'Bring SQL samples' });
    });
    const updated = await row('Alpha');
    expect(within(updated).getByRole('link', { name: 'Open application (Applied)' })).toHaveAttribute('href', '/applications/app-new');
    expect(within(updated).queryByRole('button', { name: 'Add to pipeline' })).not.toBeInTheDocument();
  });

  it('does not post a note when the note is blank', async () => {
    const user = userEvent.setup();
    mount();
    const card = await row('Alpha');
    await user.click(within(card).getByRole('button', { name: 'Add to pipeline' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Add to pipeline' })).getByRole('button', { name: 'Add to job' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledTimes(1));
    expect(api.postApi).toHaveBeenCalledWith('/applications', { candidateId: 'a', vacancyId: 'v1' });
  });

  it('marks the candidate in the pipeline when the application already exists', async () => {
    const user = userEvent.setup();
    api.postApi.mockRejectedValueOnce(Object.assign(new Error('Already applied.'), { statusCode: 409, code: 'APPLICATION_EXISTS' }));
    mount();
    const card = await row('Alpha');
    await user.click(within(card).getByRole('button', { name: 'Add to pipeline' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Add to pipeline' })).getByRole('button', { name: 'Add to job' }));
    expect(await within(await row('Alpha')).findByRole('button', { name: 'Already in pipeline (Applied)' })).toBeDisabled();
    expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'info',
      title: 'Already in pipeline',
    }));
  });

  it('disables add to pipeline when the job is not accepting applications', async () => {
    for (const status of ['On Hold', 'Closed', 'Cancelled']) {
      api.fetchVacancyList.mockResolvedValue({ full: [{ ...job, status }], redacted: [] });
      mount();
      const button = within(await row('Alpha')).getByRole('button', { name: 'Add to pipeline' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Job is not accepting new applications');
      cleanup();
    }

    api.fetchVacancyList.mockResolvedValue({ full: [{ ...job, status: 'Partially Filled' }], redacted: [] });
    mount();
    expect(within(await row('Alpha')).getByRole('button', { name: 'Add to pipeline' })).toBeEnabled();
  });

  it('compares two to four selected candidates and clears the selection', async () => {
    const user = userEvent.setup();
    mount();
    await row('Alpha');
    expect(screen.queryByRole('region', { name: 'Selected candidates' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha Synthetic' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compare selected (1)' })).toBeDisabled();
    expect(screen.getByText('Select 2 to 4 candidates to compare')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select Beta Synthetic' }));
    expect(screen.getByRole('link', { name: 'Compare selected (2)' })).toHaveAttribute(
      'href',
      '/candidates/compare?vacancyId=v1&ids=a,b',
    );
    expect(screen.queryByText('Select 2 to 4 candidates to compare')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('region', { name: 'Selected candidates' })).not.toBeInTheDocument();
  });

  it('disables compare when more than four candidates are selected', async () => {
    const user = userEvent.setup();
    mount();
    await row('Alpha');
    for (const name of ['Alpha', 'Beta', 'Cara', 'Dani', 'Eden']) {
      await user.click(screen.getByRole('checkbox', { name: `Select ${name} Synthetic` }));
    }
    expect(screen.getByRole('button', { name: 'Compare selected (5)' })).toBeDisabled();
    expect(screen.getByText('Select 2 to 4 candidates to compare')).toBeInTheDocument();
  });

  it('clears the selection when the matched job changes', async () => {
    const user = userEvent.setup();
    api.fetchVacancyList.mockResolvedValue({
      full: [job, { ...job, id: 'v2', vacancyCode: 'OTHER', title: 'Other role' }],
      redacted: [],
    });
    mount();
    await row('Alpha');
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha Synthetic' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Job to match against'), 'v2');
    expect(screen.queryByRole('region', { name: 'Selected candidates' })).not.toBeInTheDocument();
  });

  it('keeps the job, search, tier, and sort in the page URL', async () => {
    const user = userEvent.setup();
    mount('/sourcing-match?vacancyId=v1&q=alpha&tier=low&sort=name');
    expect(await screen.findByLabelText('Search candidates by name, skill, or keyword')).toHaveValue('alpha');
    expect(screen.getByRole('tab', { name: /Low match/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Sort candidates')).toHaveValue('name');

    const search = screen.getByLabelText('Search candidates by name, skill, or keyword');
    await user.clear(search);
    await user.type(search, 'beta');
    await user.click(screen.getByRole('tab', { name: /Good match/ }));
    await user.selectOptions(screen.getByLabelText('Sort candidates'), 'exp');

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('query').textContent ?? '');
      expect(params.get('vacancyId')).toBe('v1');
      expect(params.get('q')).toBe('beta');
      expect(params.get('tier')).toBe('good');
      expect(params.get('sort')).toBe('exp');
    });
  });

  it('shows a retry when server matching fails instead of a local score', async () => {
    const user = userEvent.setup();
    api.getApi.mockImplementation((url: string) => {
      if (String(url).includes('/suggestions')) {
        return Promise.reject(Object.assign(new Error('Matcher unavailable'), { status: 500 }));
      }
      return Promise.resolve({
        data: [{ ...person('b', 'Beta'), skills: ['SQL', 'React'] }],
      });
    });
    mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Matcher unavailable');
    expect(screen.queryByRole('img', { name: '100% Excellent match' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '— Match unavailable' })).toBeInTheDocument();
    const before = api.getApi.mock.calls.filter((call) => String(call[0]).includes('/suggestions')).length;
    await user.click(screen.getByRole('button', { name: 'Retry matching' }));
    await waitFor(() => {
      const after = api.getApi.mock.calls.filter((call) => String(call[0]).includes('/suggestions')).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it('sends only required skills when an employee recruiter saves job requirements', async () => {
    const user = userEvent.setup();
    render(
      <EditPositionRequirementsModal
        isOpen
        onClose={() => undefined}
        vacancyId="v1"
        positionTitle="Software Developer"
        initialSkills={['SQL', 'React']}
        initialMinExp={3}
        initialLocation="Cairo"
        initialDepartment="Engineering"
        initialQualifications="BSc"
        initialJobSummary="Build internal tools."
        onSaved={() => undefined}
      />,
    );

    expect(screen.getByText('Managed by Hiring Manager / Admin — you can edit Required Skills below')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Job Summary/)).not.toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Requirements' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/vacancies/v1', {
      requiredSkills: ['SQL', 'React'],
    }));
  });

  it('sends the full benchmark when the user can manage vacancies', async () => {
    const user = userEvent.setup();
    auth.user.permissions = ['VACANCY_MANAGE'];
    auth.user.roles = [{ id: 'role-1', code: 'HIRING_MANAGER', name: 'Hiring Manager' }];
    render(
      <EditPositionRequirementsModal
        isOpen
        onClose={() => undefined}
        vacancyId="v1"
        positionTitle="Software Developer"
        initialSkills={['SQL', 'React']}
        initialMinExp={3}
        initialLocation="Cairo"
        initialDepartment="Engineering"
        initialQualifications="BSc"
        initialJobSummary="Build internal tools."
        onSaved={() => undefined}
      />,
    );

    expect(screen.queryByText(/Managed by Hiring Manager/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Requirements' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/vacancies/v1', {
      requiredSkills: ['SQL', 'React'],
      minExperienceYears: 3,
      location: 'Cairo',
      department: 'Engineering',
      qualifications: 'BSc',
      jobSummary: 'Build internal tools.',
    }));
  });

  it('paginates candidates at 15 rows per page, syncs page in URL, resets on filter change, and caches next page', async () => {
    const user = userEvent.setup();
    const manyPeople = Array.from({ length: 35 }, (_, idx) =>
      person(`cand-${idx + 1}`, `Candidate${String(idx + 1).padStart(2, '0')}`),
    );
    api.getApi.mockImplementation((url: string) => {
      if (String(url).includes('/suggestions')) return Promise.resolve(null);
      return Promise.resolve({ data: manyPeople, total: 35 });
    });

    mount();
    await screen.findByRole('heading', { name: 'Candidate01 Synthetic' });

    // Page 1 caps rendered rows at 15 and pre-caches next page
    expect(screen.getAllByRole('article')).toHaveLength(15);
    expect(screen.getByText('15 per page')).toBeInTheDocument();
    expect(screen.getByText('Next page cached')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Candidate16 Synthetic' })).not.toBeInTheDocument();

    // Go to Page 2
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByRole('heading', { name: 'Candidate16 Synthetic' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(15);
    expect(new URLSearchParams(screen.getByTestId('query').textContent ?? '').get('page')).toBe('2');

    // Go to Page 3 (remaining 5 rows)
    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(await screen.findByRole('heading', { name: 'Candidate31 Synthetic' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

    // Changing search resets back to page 1
    await user.type(screen.getByLabelText('Search candidates by name, skill, or keyword'), 'Candidate02');
    expect(await screen.findByRole('heading', { name: 'Candidate02 Synthetic' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(new URLSearchParams(screen.getByTestId('query').textContent ?? '').get('page')).toBeNull();
  });

  it('caches per-vacancy server suggestions when switching jobs back and prefetches next server batch near end', async () => {
    const user = userEvent.setup();
    api.fetchVacancyList.mockResolvedValue({
      full: [job, { ...job, id: 'v2', vacancyCode: 'JOB-2', title: 'Backend Engineer' }],
      redacted: [],
    });
    const batch1 = Array.from({ length: 100 }, (_, idx) => person(`b1-${idx + 1}`, `BatchOne${idx + 1}`));
    const batch2 = Array.from({ length: 20 }, (_, idx) => person(`b2-${idx + 1}`, `BatchTwo${idx + 1}`));

    api.getApi.mockImplementation((url: string) => {
      const path = String(url);
      if (path === '/vacancies/v1/suggestions') {
        return Promise.resolve({ vacancyId: 'v1', requiredSkills: [{ id: 's1', name: 'SQL' }], unmappedRequiredSkills: [], suggestions: [] });
      }
      if (path === '/vacancies/v2/suggestions') {
        return Promise.resolve({ vacancyId: 'v2', requiredSkills: [{ id: 's1', name: 'SQL' }], unmappedRequiredSkills: [], suggestions: [] });
      }
      if (path.includes('page=2')) {
        return Promise.resolve({ data: batch2, total: 120 });
      }
      return Promise.resolve({ data: batch1, total: 120 });
    });

    mount();
    await screen.findByRole('heading', { name: 'BatchOne1 Synthetic' });
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/vacancies/v1/suggestions'));

    // Switch to v2 then back to v1 — v1 suggestions served from cache without duplicate request
    await user.selectOptions(screen.getByLabelText('Job to match against'), 'v2');
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/vacancies/v2/suggestions'));
    await user.selectOptions(screen.getByLabelText('Job to match against'), 'v1');
    const v1Calls = api.getApi.mock.calls.filter(([u]) => u === '/vacancies/v1/suggestions').length;
    expect(v1Calls).toBe(1);

    // Jump near end of batch 1 (page 7 -> rows 91–100) triggers background prefetch for server page 2
    await user.click(screen.getByRole('button', { name: 'Page 7' }));
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/candidates?pageSize=100&page=2'));
    expect(await screen.findByRole('button', { name: 'Page 8' })).toBeInTheDocument();
  });
});
