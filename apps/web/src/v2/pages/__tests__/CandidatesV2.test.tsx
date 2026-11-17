import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import * as mfx from '../../api/__fixtures__/matching';
import { fetchActiveApplications } from '../../api/matching';
import { CandidatesV2 } from '../CandidatesV2';
import { CandidateDetailPage } from '../../../pages/CandidateDetailPage';
import { CandidateDocumentsPage } from '../../../pages/CandidateDocumentsPage';

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'me',
      displayName: 'Mariam Farag',
      email: 'mariam@x.test',
      seat: 'employee',
      roles: [{ code: 'RECRUITER', name: 'Recruiter' }],
      permissions: ['CANDIDATE_VIEW', 'CANDIDATE_EDIT', 'APPLICATION_VIEW', 'APPLICATION_CREATE', 'VACANCY_VIEW'],
    },
    isLoading: false,
    login: async () => {},
    logout: async () => {},
    refreshUser: async () => {},
  }),
}));

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));

const openJob = {
  id: 'v1', code: 'VAC-1', title: 'HRIS Developer', status: 'Open',
  branch: { id: 'b1', name: 'Cairo' }, department: 'HR', owner: { displayName: 'Mariam Farag' },
  headcount: { joined: 0, approved: 1 }, dueDate: null, holdUntil: null, pipelineCounts: {},
};

function rawApp(i: number, stage = 'Applied') {
  return {
    id: `a${i}`, candidateId: `c${i}`, vacancyId: 'v1', stage, source: 'LinkedIn', positionTitle: 'HRIS Developer',
    primaryRecruiterName: 'Mariam Farag', lastActivityLabel: null, nextFollowUpAt: null,
    candidate: { firstName: 'P', lastName: String(i), currentTitle: 'Nurse', experienceYears: 3, email: `p${i}@x.test`, phone: '+20 100' },
  };
}

function pageOf(count: number, start: number, total: number) {
  return { data: Array.from({ length: count }, (_, i) => rawApp(start + i)), total };
}

function defaultGet(path: string) {
  const [p, qs = ''] = path.split('?');
  const query = new URLSearchParams(qs);
  if (p === '/applications' && query.get('candidateId')) {
    return { data: [{ id: 'app-heba', candidateId: query.get('candidateId'), vacancyId: query.get('vacancyId') }], total: 1 };
  }
  if (p === '/applications') return structuredClone(mfx.myApplications);
  if (p === '/candidates') return structuredClone(mfx.bank);
  if (p === '/vacancies/work-queue') return { data: [openJob], total: 1 };
  throw new ApiError(404, 'not found');
}

function Loc() { const l = useLocation(); return <output data-testid="loc" hidden>{l.pathname + l.search + l.hash}</output>; }
function renderAt(path: string) {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/candidates" element={<><CandidatesV2 /><Loc /></>} />
    <Route path="/candidates/:id/documents" element={<><CandidateDocumentsPage /><Loc /></>} />
    <Route path="/candidates/:id" element={<><CandidateDetailPage /><Loc /></>} />
    <Route path="/applications/:id" element={<p>File</p>} />
  </Routes></MemoryRouter>);
}
function returnToOf(href: string | null) {
  return new URLSearchParams(href?.split('?')[1] ?? '').get('returnTo');
}
const applicationCalls = () => api.getApi.mock.calls.map((call) => String(call[0])).filter((path) => path.startsWith('/applications'));

beforeEach(() => {
  api.getApi.mockReset();
  api.postApi.mockReset();
  api.getApi.mockImplementation(async (path: string) => defaultGet(path));
});

describe('active list paging', () => {
  it('stops on a short page, drops closed stages, and keeps contact fields off the row', async () => {
    api.getApi.mockResolvedValue({ data: [rawApp(1), { ...rawApp(2), stage: 'Joined' }, { ...rawApp(3), stage: 'Rejected' }], total: 3 });
    const result = await fetchActiveApplications();
    expect(api.getApi).toHaveBeenCalledTimes(1);
    expect(api.getApi).toHaveBeenCalledWith('/applications?pageSize=100&page=1&sortBy=updatedAt&sortDirection=desc');
    expect(result.truncated).toBe(false);
    expect(result.rows.map((row) => row.applicationId)).toEqual(['a1']);
    expect(JSON.stringify(result)).not.toMatch(/email|phone|@x\.test/);
  });

  it('stops when total is reached, including a 10th page that completes the list', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
      return pageOf(100, (page - 1) * 100, 1000);
    });
    const result = await fetchActiveApplications();
    expect(api.getApi).toHaveBeenCalledTimes(10);
    expect(result.truncated).toBe(false);
    expect(result.loaded).toBe(1000);
    expect(result.total).toBe(1000);
  });

  it('flags truncation after 10 full pages when total is larger, and does not request page 11', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
      return pageOf(100, (page - 1) * 100, 1234);
    });
    const result = await fetchActiveApplications();
    expect(applicationCalls().some((path) => path.includes('search='))).toBe(false);
    expect(api.getApi).toHaveBeenCalledTimes(10);
    expect(api.getApi.mock.calls.some((call) => String(call[0]).includes('page=11'))).toBe(false);
    expect(result.truncated).toBe(true);
    expect(result.loaded).toBe(1000);
    expect(result.total).toBe(1234);
    expect(result.rows).toHaveLength(1000);
  });

  it('rejects when a later page fails instead of returning a short list', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      const page = new URLSearchParams(path.split('?')[1]).get('page');
      if (page === '2') throw new ApiError(500, 'Page two failed.');
      return pageOf(100, 0, 250);
    });
    await expect(fetchActiveApplications()).rejects.toThrow('Page two failed.');
  });
});

describe('Candidates page', () => {
  it('keeps the five-row fixture as 5 people and does not send search', async () => {
    renderAt('/candidates');
    expect(await screen.findByText('5 people')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Import history' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Talent pools' })).not.toBeInTheDocument();
    expect(applicationCalls()).toEqual(['/applications?pageSize=100&page=1&sortBy=updatedAt&sortDirection=desc']);
  });

  it('filters by stage and drops selections that the filter hides', async () => {
    const u = userEvent.setup();
    renderAt('/candidates');
    await screen.findByRole('table');
    await u.click(screen.getByRole('checkbox', { name: 'Select Ahmed Embaby (HRIS Developer)' }));
    await u.click(screen.getByRole('checkbox', { name: 'Select Nourhan Sami (HRIS Developer)' }));
    expect(screen.getByRole('link', { name: 'Compare 2 on skills' })).toHaveAttribute('href', '/candidates/compare?job=v1&ids=c-a7,c-a4');
    await u.selectOptions(screen.getByLabelText('Stage'), 'Offer');
    expect(screen.getByTestId('loc')).toHaveTextContent('stage=Offer');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Lina Hassan')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Compare \d on skills/ })).not.toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Stage'), '');
    expect(screen.getByRole('checkbox', { name: 'Select Ahmed Embaby (HRIS Developer)' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Nourhan Sami (HRIS Developer)' })).not.toBeChecked();
    expect(screen.getByText('5 people')).toBeInTheDocument();
  });

  it('restores search, job, source, and stage from the query', async () => {
    const here = '/candidates?search=Ahmed&job=v1&source=LinkedIn&stage=Interview';
    renderAt(here);
    const table = await screen.findByRole('table');
    expect(screen.getByLabelText('Search people')).toHaveValue('Ahmed');
    expect(screen.getByLabelText('Job')).toHaveValue('v1');
    expect(screen.getByLabelText('Source')).toHaveValue('LinkedIn');
    expect(screen.getByLabelText('Stage')).toHaveValue('Interview');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Ahmed Embaby');
    const nameHref = within(rows[0]).getByRole('link', { name: 'Ahmed Embaby' }).getAttribute('href');
    const openHref = within(rows[0]).getByRole('link', { name: 'Open Ahmed Embaby' }).getAttribute('href');
    expect(nameHref).toContain('/applications/a7');
    expect(openHref).toBe(nameHref);
    expect(returnToOf(nameHref)).toBe(here);
  });

  it('sanitizes returnTo and restores filters and selected candidates across Compare', async () => {
    const u = userEvent.setup();
    renderAt('/candidates?search=HRIS&job=v1&stage=Screening&ids=c-a4,c-a6&returnTo=%2Fsettings&junk=1');
    await screen.findByRole('table');
    expect(screen.getByLabelText('Search people')).toHaveValue('HRIS');
    expect(screen.getByLabelText('Job')).toHaveValue('v1');
    expect(screen.getByLabelText('Stage')).toHaveValue('Screening');
    expect(screen.getByRole('checkbox', { name: 'Select Nourhan Sami (HRIS Developer)' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Salma Adel (HRIS Developer)' })).toBeChecked();
    expect(screen.getByText('2 people · 2 selected')).toBeInTheDocument();
    const compareLink = screen.getByRole('link', { name: 'Compare 2 on skills' });
    expect(compareLink).toHaveAttribute(
      'href',
      '/candidates/compare?job=v1&ids=c-a4,c-a6&search=HRIS&stage=Screening',
    );
    const nameHref = screen.getByRole('link', { name: 'Nourhan Sami' }).getAttribute('href');
    expect(returnToOf(nameHref)).toBe('/candidates?search=HRIS&job=v1&stage=Screening&ids=c-a4,c-a6');
    await u.click(screen.getByRole('checkbox', { name: 'Select Salma Adel (HRIS Developer)' }));
    expect(returnToOf(screen.getByRole('link', { name: 'Nourhan Sami' }).getAttribute('href'))).toBe(
      '/candidates?search=HRIS&job=v1&stage=Screening&ids=c-a4',
    );
  });

  it('restores the bank tab and its search', async () => {
    renderAt('/candidates?tab=bank&search=heba');
    expect(await screen.findByText('Heba Mansour')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bank' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Search people')).toHaveValue('heba');
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/candidates?pageSize=100&page=1&status=Active&search=heba'));
    expect(screen.getByRole('link', { name: 'CV bank' })).toHaveAttribute('href', '/cv-bank');
    expect(screen.getByRole('link', { name: 'Match Skills' })).toHaveAttribute('href', '/sourcing-match');
    expect(screen.queryByRole('link', { name: 'Review a workbook' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Talent pools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to the bank' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add the chosen person to this job' })).not.toBeInTheDocument();
  });

  it('says the list is incomplete when the page bound is reached', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
      return pageOf(100, (page - 1) * 100, 1234);
    });
    renderAt('/candidates');
    expect(await screen.findByText(/This list is incomplete/)).toBeInTheDocument();
    expect(screen.getByText(/Loaded 1000 of 1234 applications/)).toBeInTheDocument();
    expect(screen.getByText('1000 people shown')).toBeInTheDocument();
    expect(screen.queryByText('1000 people')).not.toBeInTheDocument();
    expect(api.getApi).toHaveBeenCalledTimes(10);
  }, 20000);

  it('reaches record 1001 on a truncated active list when narrowed by search and exposes bank truncation metadata', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (path: string) => {
      const [p, qs = ''] = String(path).split('?');
      const query = new URLSearchParams(qs);
      if (p === '/applications') {
        if (query.get('search')) {
          expect(query.get('includeEmail')).toBe('false');
          return query.get('search') === 'Record1001'
            ? { data: [{ ...rawApp(1001), candidate: { firstName: 'Record1001', lastName: 'Person', currentTitle: 'Specialist', experienceYears: 8 } }], total: 1 }
            : { data: [], total: 0 };
        }
        const page = Number(query.get('page'));
        return pageOf(100, (page - 1) * 100, 1234);
      }
      if (p === '/candidates') {
        const page = Number(query.get('page'));
        return {
          data: Array.from({ length: 100 }, (_, i) => ({
            id: `b-${(page - 1) * 100 + i}`,
            candidateCode: `CND-${(page - 1) * 100 + i}`,
            firstName: 'Bank',
            lastName: `Person ${(page - 1) * 100 + i}`,
            currentTitle: 'Nurse',
            location: 'Cairo',
            experienceYears: 4,
            status: 'Active',
          })),
          total: 1200,
        };
      }
      return defaultGet(path);
    });
    renderAt('/candidates');
    expect(await screen.findByText(/Loaded 1000 of 1234 applications/)).toBeInTheDocument();
    await u.type(screen.getByLabelText('Search people'), 'Record1001');
    expect(await screen.findByText('Record1001 Person')).toBeInTheDocument();
    expect(screen.getByText('1 people')).toBeInTheDocument();
  }, 45000);

  it('shows the next workflow step and never a past event in Next action', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      if (String(path).split('?')[0] === '/applications') {
        return {
          data: [
            { id: 'n1', candidateId: 'c1', vacancyId: 'v1', stage: 'Screening', source: 'LinkedIn', positionTitle: 'HRIS Developer', primaryRecruiterName: 'Mariam Farag', lastActivityLabel: 'Note added', candidate: { firstName: 'Nour', lastName: 'Ali', currentTitle: 'Nurse', experienceYears: 4 }, gates: [{ gate: 'screen-note', code: 'SCREEN_NOTE', met: false, missing: ['note'] }] },
            { id: 'n2', candidateId: 'c2', vacancyId: 'v1', stage: 'Interview', source: 'LinkedIn', positionTitle: 'HRIS Developer', primaryRecruiterName: 'Mariam Farag', lastActivityLabel: 'Moved to Screening', candidate: { firstName: 'Heba', lastName: 'Salah', currentTitle: 'Nurse', experienceYears: 5 }, gates: [{ gate: 'scorecard', code: 'SCORECARD', met: false, missing: [] }] },
            { id: 'n3', candidateId: 'c3', vacancyId: 'v1', stage: 'Offer', source: 'LinkedIn', positionTitle: 'HRIS Developer', primaryRecruiterName: 'Mariam Farag', lastActivityLabel: 'Application updated', candidate: { firstName: 'Lina', lastName: 'Hassan', currentTitle: 'Analyst', experienceYears: 6 }, gates: [] },
          ],
          total: 3,
        };
      }
      return defaultGet(path);
    });
    renderAt('/candidates');
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Log screen');
    expect(rows[1]).toHaveTextContent('Schedule interview');
    expect(rows[2]).toHaveTextContent('Draft offer');
    expect(table).not.toHaveTextContent('Note added');
    expect(table).not.toHaveTextContent('Moved to Screening');
    expect(table).not.toHaveTextContent('Application updated');
  });

  it('shows a failed load instead of an empty list', async () => {
    api.getApi.mockRejectedValue(new ApiError(500, 'Applications are unavailable.'));
    renderAt('/candidates');
    expect(await screen.findByRole('alert')).toHaveTextContent('Applications are unavailable.');
    expect(screen.queryByText('No active applications')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

const bankReturn = '/candidates?tab=bank&search=Heba';

function emptyActivity() {
  return {
    completed: 0, completedByMe: 0, pending: 0, overdue: 0, lastActivityAt: null, nextFollowUpAt: null,
    byKind: {}, byRecruiter: [], entries: [], totalEntries: 0, page: 1, pageSize: 20,
  };
}

function hebaPerson() {
  return {
    id: 'c-heba', organizationId: 'org', candidateCode: 'CAN-2026-0031', firstName: 'Heba', lastName: 'Mansour',
    email: 'heba@x.test', phone: '+20 1', currentTitle: 'Payroll Specialist', currentCompany: 'Elsewedy',
    location: 'Cairo', experienceYears: 7, skills: ['Payroll'], source: 'Bank', status: 'Active',
    consentStatus: 'Granted', expectedSalary: 50000, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

const cvRecord = {
  id: 'd1', fileName: 'heba-cv.pdf', documentType: 'CV', scanStatus: 'verified', fileSize: 1200,
  mimeType: 'application/pdf', organizationId: 'org', candidateId: 'c-heba',
  createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
};

function installPersonApi(options: { applications: Array<Record<string, unknown>>; documents: 'fail' | Array<Record<string, unknown>>; offers?: Array<Record<string, unknown>> }) {
  let documentAttempts = 0;
  api.getApi.mockImplementation(async (path: string) => {
    const [p, qs = ''] = path.split('?');
    if (p === '/candidates/c-heba') return hebaPerson();
    if (p.startsWith('/candidates/c-heba/activities')) return emptyActivity();
    if (p === '/documents/candidate/c-heba') {
      documentAttempts += 1;
      if (options.documents === 'fail' && documentAttempts === 1) throw new ApiError(500, 'Documents are unavailable.');
      return options.documents === 'fail' ? [cvRecord] : options.documents;
    }
    if (p === '/applications') {
      const candidateId = new URLSearchParams(qs).get('candidateId');
      if (candidateId === 'c-heba') return { data: options.applications, total: options.applications.length };
      return { data: [{ id: 'secret', candidateId: 'other', positionTitle: 'Ward Clerk Secret', stage: 'Applied', vacancyCode: 'VAC-SECRET', primaryRecruiterName: 'Other Owner', lastActivityLabel: 'Hidden history' }], total: 1 };
    }
    if (p === '/interviews') return [];
    if (p === '/offers') return options.offers ?? [];
    if (p === '/vacancies') return { data: [] };
    return defaultGet(path);
  });
}

describe('Ticket 09 person identity', () => {
  it('keeps a bank person profile and document link on the filtered bank', async () => {
    const u = userEvent.setup();
    installPersonApi({ applications: [], documents: [cvRecord] });
    renderAt(bankReturn);
    const person = await screen.findByRole('link', { name: 'Heba Mansour' });
    const docs = screen.getByRole('link', { name: 'Documents for Heba Mansour' });
    expect(person.getAttribute('href')).toContain('/candidates/c-heba');
    expect(person.getAttribute('href')).not.toContain('/documents');
    expect(returnToOf(person.getAttribute('href'))).toBe(bankReturn);
    expect(docs.getAttribute('href')).toContain('/candidates/c-heba/documents');
    expect(returnToOf(docs.getAttribute('href'))).toBe(bankReturn);

    await u.click(docs);
    const backToBank = await screen.findByRole('link', { name: 'Back to candidates' });
    const backToProfile = screen.getByRole('link', { name: 'Back to profile' });
    expect(backToBank).toHaveAttribute('href', bankReturn);
    expect(backToProfile.getAttribute('href')).toContain('/candidates/c-heba');
    expect(backToProfile.getAttribute('href')).not.toContain('/documents');
    expect(returnToOf(backToProfile.getAttribute('href'))).toBe(bankReturn);

    await u.click(backToProfile);
    expect(await screen.findByRole('heading', { name: 'Heba Mansour' })).toBeInTheDocument();
    expect(screen.getAllByText('heba@x.test').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Payroll').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Candidate activity' })).toBeInTheDocument();
    expect((await screen.findAllByText('No applications')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('This person is not on a job yet.').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Assign to job' }).length).toBeGreaterThan(0);
    expect(await screen.findByText('heba-cv.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Pipeline progress' })).not.toBeInTheDocument();
    expect(screen.queryByText('50000')).not.toBeInTheDocument();
    const manage = screen.getByRole('link', { name: 'Documents' });
    expect(manage.getAttribute('href')).toContain('/candidates/c-heba/documents');
    expect(returnToOf(manage.getAttribute('href'))).toBe(bankReturn);
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', bankReturn);

    await u.click(screen.getByRole('link', { name: 'Back' }));
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(bankReturn));
    expect(screen.getByRole('tab', { name: 'Bank' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Search people')).toHaveValue('Heba');
  });

  it('shows each application on its own when one of them is rejected', async () => {
    installPersonApi({
      documents: [cvRecord],
      offers: [{ id: 'off-1', offerCode: 'OFF-9', status: 'Draft', positionTitle: 'ICU Nurse', createdAt: '2026-10-01T00:00:00.000Z', annualFixed: 80000, currency: 'SAR', salary: 80000 }],
      applications: [
        { id: 'app-icu', candidateId: 'c-heba', vacancyId: 'v-icu', vacancyCode: 'VAC-ICU', positionTitle: 'ICU Nurse', stage: 'Interview', primaryRecruiterName: 'Mariam Farag', lastActivityLabel: 'Scorecard submitted', expectedSalary: 90000, salary: 90000 },
        { id: 'app-hr', candidateId: 'c-heba', vacancyId: 'v-hr', vacancyCode: 'VAC-HR', positionTitle: 'HRIS Developer', stage: 'Rejected', primaryRecruiterName: null, lastActivityLabel: null, offeredSalary: 120000 },
      ],
    });
    renderAt(`/candidates/c-heba?returnTo=${encodeURIComponent(bankReturn)}`);
    const heading = await screen.findByRole('heading', { name: 'Heba Mansour' });
    const pageHeader = heading.closest('header');
    expect(pageHeader).toHaveTextContent('Active');
    expect(pageHeader).not.toHaveTextContent('Closed');
    expect(screen.queryByRole('region', { name: 'Pipeline progress' })).not.toBeInTheDocument();

    const apps = await screen.findByRole('region', { name: 'Applications' });
    expect(within(apps).getAllByText('ICU Nurse').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('VAC-ICU').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('Interview').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('Mariam Farag').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('Scorecard submitted').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('HRIS Developer').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('VAC-HR').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('Rejected').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('Unassigned').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('Application submitted').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('Closed').length).toBeGreaterThan(0);
    expect(within(apps).getAllByText('Active').length).toBeGreaterThan(0);

    const hrefs = within(apps).getAllByRole('link', { name: 'View application' }).map((link) => link.getAttribute('href'));
    expect(hrefs.some((href) => href?.includes('/applications/app-icu'))).toBe(true);
    expect(hrefs.some((href) => href?.includes('/applications/app-hr'))).toBe(true);
    expect(hrefs.every((href) => returnToOf(href) === bankReturn)).toBe(true);
    expect(screen.queryByText('Ward Clerk Secret')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden history')).not.toBeInTheDocument();
    expect(screen.queryByText('90000')).not.toBeInTheDocument();
    expect(screen.queryByText('120000')).not.toBeInTheDocument();
    expect(screen.queryByText('80000')).not.toBeInTheDocument();
    expect(screen.queryByText('50000')).not.toBeInTheDocument();
    expect(screen.queryByText('SAR')).not.toBeInTheDocument();
    const calls = api.getApi.mock.calls.map((call) => String(call[0]));
    expect(calls).toContain('/applications?candidateId=c-heba&page=1&pageSize=100');
    expect(calls).toContain('/interviews?candidateId=c-heba');
    expect(calls).toContain('/offers?candidateId=c-heba');
    expect(calls).toContain('/documents/candidate/c-heba');
    expect(calls.some((path) => path.startsWith('/applications') && !path.includes('candidateId='))).toBe(false);
  });

  it('keeps the profile when the document read fails, and retries that read on its own', async () => {
    const u = userEvent.setup();
    installPersonApi({ applications: [], documents: 'fail' });
    renderAt(`/candidates/c-heba?returnTo=${encodeURIComponent(bankReturn)}`);
    expect(await screen.findByRole('heading', { name: 'Heba Mansour' })).toBeInTheDocument();
    expect(await screen.findByText('Documents are unavailable.')).toBeInTheDocument();
    expect(screen.getAllByText('No applications').length).toBeGreaterThan(0);
    expect(screen.queryByText('heba-cv.pdf')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('heba-cv.pdf')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Heba Mansour' })).toBeInTheDocument();
    expect(screen.queryByText('Documents are unavailable.')).not.toBeInTheDocument();
  });
});

describe('Ticket 10 intake', () => {
  it('forwards job, candidateId, and returnTo on Upload CVs and omits manual bank forms and retired links', async () => {
    const here = '/candidates?tab=bank&job=v1&candidateId=c-heba';
    renderAt(here);
    expect(await screen.findByText('Heba Mansour')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Upload CVs/i })).toHaveAttribute(
      'href',
      `/cv-bank?job=v1&candidateId=c-heba&returnTo=${encodeURIComponent('/candidates?tab=bank&job=v1')}`,
    );
    expect(screen.queryByRole('link', { name: 'Review a workbook' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Talent pools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Import history' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Open job')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to the bank' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add the chosen person to this job' })).not.toBeInTheDocument();
  });
});
