import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import * as mfx from '../../api/__fixtures__/matching';
import { fetchActiveApplications } from '../../api/matching';
import { CandidatesV2 } from '../CandidatesV2';

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
    expect(screen.getByRole('link', { name: 'Import history' })).toHaveAttribute('href', '/import#import-history');
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

  it('restores the bank tab and its search', async () => {
    renderAt('/candidates?tab=bank&search=heba');
    expect(await screen.findByText('Heba Mansour')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bank' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Search people')).toHaveValue('heba');
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/candidates?pageSize=100&page=1&status=Active&search=heba'));
    expect(screen.getByRole('link', { name: 'Talent pools' })).toHaveAttribute('href', '/talent-pools');
  });

  it('puts the current candidates query on a new file and on the existing file', async () => {
    const u = userEvent.setup();
    const here = '/candidates?tab=bank&search=Heba';
    api.postApi.mockResolvedValueOnce({ id: 'made-1' });
    const view = renderAt(here);
    await screen.findByRole('option', { name: 'VAC-1 · HRIS Developer' });
    await u.click(screen.getByRole('radio', { name: 'Choose Heba Mansour for a job' }));
    await u.selectOptions(screen.getByLabelText('Open job'), 'v1');
    await u.click(screen.getByRole('button', { name: 'Add the chosen person to this job' }));
    const created = await screen.findByRole('link', { name: 'Open the application' });
    expect(created.getAttribute('href')).toContain('/applications/made-1');
    expect(returnToOf(created.getAttribute('href'))).toBe(here);
    view.unmount();

    api.postApi.mockRejectedValueOnce(new ApiError(409, 'exists', { code: 'APPLICATION_EXISTS', message: 'exists' }, { code: 'APPLICATION_EXISTS' }));
    renderAt(here);
    await screen.findByRole('option', { name: 'VAC-1 · HRIS Developer' });
    await u.click(screen.getByRole('radio', { name: 'Choose Heba Mansour for a job' }));
    await u.selectOptions(screen.getByLabelText('Open job'), 'v1');
    await u.click(screen.getByRole('button', { name: 'Add the chosen person to this job' }));
    const existing = await screen.findByRole('link', { name: 'Open the application' });
    expect(existing.getAttribute('href')).toContain('/applications/app-heba');
    expect(returnToOf(existing.getAttribute('href'))).toBe(here);
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

  it('shows a failed load instead of an empty list', async () => {
    api.getApi.mockRejectedValue(new ApiError(500, 'Applications are unavailable.'));
    renderAt('/candidates');
    expect(await screen.findByRole('alert')).toHaveTextContent('Applications are unavailable.');
    expect(screen.queryByText('No active applications')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
