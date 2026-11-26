import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { CompareV2 } from '../CompareV2';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), postFormDataApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', displayName: 'Mariam Farag' } }),
}));
const shell = vi.hoisted(() => ({ value: null as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));

function Loc() {
  const l = useLocation();
  return <output data-testid="loc" hidden>{l.pathname + l.search}</output>;
}

function renderCompare(path = '/candidates/compare') {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/candidates/compare" element={<><CompareV2 /><Loc /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const JOB_ID = 'job-live-1';
const CAND_A = 'cand-a';
const CAND_B = 'cand-b';

const liveWorkQueue = {
  data: [
    {
      id: JOB_ID,
      code: 'VAC-2026-010',
      title: 'ICU Nurse',
      status: 'Open',
      branch: { id: 'b1', name: 'SGH Riyadh' },
      department: 'Critical Care',
      owner: { id: 'me', displayName: 'Mariam Farag' },
      headcount: { approved: 3, joined: 0, remaining: 3 },
      pipelineCounts: { Applied: 1 },
      needsActionCount: 1,
      dueDate: '2026-12-01',
    },
  ],
  total: 1,
};

const liveCandidates = {
  data: [
    {
      id: CAND_A,
      candidateCode: 'CND-101',
      firstName: 'Heba',
      lastName: 'Salem',
      currentTitle: 'Senior ICU Nurse',
      location: 'Riyadh',
      experienceYears: 7,
      certifications: ['BLS', 'ACLS'],
      languages: ['Arabic', 'English'],
      status: 'Active',
    },
    {
      id: CAND_B,
      candidateCode: 'CND-102',
      firstName: 'Tariq',
      lastName: 'Mansour',
      currentTitle: null,
      location: null,
      experienceYears: null,
      certifications: [],
      languages: [],
      status: 'Active',
    },
  ],
  total: 2,
};

const liveCompareResponse = {
  vacancyId: JOB_ID,
  nationalityPreference: [],
  candidates: [
    { id: CAND_A, code: 'CND-101', name: 'Heba Salem', currentTitle: 'Senior ICU Nurse', location: 'Riyadh', nationality: 'Egyptian' },
    { id: CAND_B, code: 'CND-102', name: 'Tariq Mansour', currentTitle: null, location: null, nationality: null },
  ],
  rows: [
    {
      skill: { id: 'sk-1', name: 'ICU Care' },
      cells: [
        { candidateId: CAND_A, status: 'evidence', evidence: [{ id: 'ev-1', sourceType: 'CV_TEXT', sourceRef: null, snippet: '7 years ICU Care', addedBy: null, addedAt: '2026-11-01T10:00:00Z' }] },
        { candidateId: CAND_B, status: 'missing', evidence: [] },
      ],
    },
  ],
  infoRows: [
    {
      key: 'notice-period',
      label: 'Notice period',
      cells: [
        { candidateId: CAND_A, value: 30, source: 'screening' },
        { candidateId: CAND_B, value: null, source: null },
      ],
    },
  ],
};

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.postApi.mockResolvedValue({ id: 'app-new' });
  api.getApi.mockImplementation(async (path: string) => {
    if (path.startsWith('/vacancies/work-queue')) return structuredClone(liveWorkQueue);
    if (path.startsWith('/candidates?')) return structuredClone(liveCandidates);
    if (path.startsWith(`/vacancies/${JOB_ID}/compare`)) return structuredClone(liveCompareResponse);
    if (path.startsWith('/applications?')) return { data: [], total: 0 };
    throw new ApiError(404, 'not found');
  });
});

describe('Ticket 15 — Compare candidates uses only real backend data', () => {
  it('renders live backend candidates, never shows hardcoded sample names, and marks missing fields as Not recorded', async () => {
    renderCompare();

    expect(await screen.findByRole('button', { name: 'Select Heba Salem for shortlist' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Tariq Mansour for shortlist' })).toBeInTheDocument();
    expect(screen.queryByText(/Nabil Ahmed|Sara Ahmed|Mariam Fathy|Omar Ali/)).toBeNull();
    expect(screen.getByText('100% (1/1 evidenced)')).toBeInTheDocument();
    expect(screen.getByText('0% (0/1 evidenced)')).toBeInTheDocument();
    expect(screen.getByText('BLS, ACLS')).toBeInTheDocument();
    expect(screen.getAllByText(/Not recorded/i).length).toBeGreaterThan(0);
  });

  it('includes unmapped requirements in the evidenced percentage', async () => {
    const response = { ...liveCompareResponse, unmappedRequiredSkills: ['Unmapped skill'] };
    const defaults = api.getApi.getMockImplementation()!;
    api.getApi.mockImplementation(async (path: string) =>
      path.startsWith(`/vacancies/${JOB_ID}/compare`) ? response : defaults(path));
    renderCompare();
    expect(await screen.findByText('50% (1/2 evidenced)')).toBeInTheDocument();
  });

  it('shows Requirements needed instead of 0% when the vacancy has no required skills', async () => {
    api.getApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/vacancies/work-queue')) return structuredClone(liveWorkQueue);
      if (path.startsWith('/candidates?')) return structuredClone(liveCandidates);
      if (path.startsWith(`/vacancies/${JOB_ID}/compare`)) return { ...structuredClone(liveCompareResponse), rows: [] };
      if (path.startsWith('/applications?')) return { data: [], total: 0 };
      throw new ApiError(404, 'not found');
    });

    renderCompare();
    expect(await screen.findAllByText('Requirements needed')).not.toHaveLength(0);
    expect(screen.queryByText('0% (0/0 evidenced)')).toBeNull();
  });

  it('shows a retryable error state when loading fails and never falls back to fake sample data', async () => {
    api.getApi.mockRejectedValue(new ApiError(500, 'Backend unavailable'));
    renderCompare();

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend unavailable');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText(/Nabil Ahmed|Sara Ahmed|Registered Nurse/)).toBeNull();
  });

  it('shortlist and move to pipeline call addToJob with real (vacancyId, candidateId) and confirm on success', async () => {
    renderCompare();
    const shortlistBtn = await screen.findByRole('button', { name: 'Shortlist selected candidate' });
    fireEvent.click(shortlistBtn);

    expect(api.postApi).toHaveBeenCalledWith('/applications', {
      vacancyId: JOB_ID,
      candidateId: CAND_A,
      source: 'Suggested from bank',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Heba Salem shortlisted for ICU Nurse (VAC-2026-010).');

    const tariqCard = screen.getByRole('button', { name: 'Select Tariq Mansour for shortlist' });
    fireEvent.click(tariqCard);
    expect(within(screen.getByText('Selected:').closest('p')!).getByText('Tariq Mansour')).toBeInTheDocument();
  });

  it('has a single Add candidate picker pill in the selection strip with no redundant blue Add candidates button', async () => {
    renderCompare();
    await screen.findByRole('button', { name: 'Select Heba Salem for shortlist' });

    expect(screen.queryByRole('button', { name: /add candidates/i })).toBeNull();
    const addButtons = screen.getAllByRole('button', { name: /add candidate/i });
    expect(addButtons).toHaveLength(1);

    fireEvent.click(addButtons[0]);
    const listbox = screen.getByRole('listbox', { name: 'Select candidates to compare' });
    expect(within(listbox).getByRole('option', { name: /Heba Salem/i })).toHaveAttribute('aria-selected', 'true');
  });
});
