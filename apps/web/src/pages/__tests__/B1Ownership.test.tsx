/**
 * B1 (pairs with backend PR #4): redacted jobs and 403 Forbidden on v1 surfaces.
 * Fixtures mirror #4's shapes (RedactedVacancy; 403 {code: JOB_NOT_OWNED|FILE_NOT_OWNED}).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forbidden, jobNotOwnedBody, redactedJob } from '../../test/fixtures/b1';
import type * as ClientModule from '../../api/client';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual<object>('react-router-dom')), useNavigate: () => mockNavigate }));
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'recruiter-1', displayName: 'Ahmad Recruiter', email: 'a@x.test',
      roles: [{ id: 'r', name: 'RECRUITER', code: 'RECRUITER' }],
      permissions: ['VACANCY_VIEW', 'APPLICATION_VIEW', 'VACANCY_ASSIGN', 'APPLICATION_CREATE', 'CANDIDATE_VIEW'],
    },
    hasPermission: () => true,
  }),
}));
vi.mock('../../context/BreadcrumbContext', () => ({ useSetBreadcrumbTitle: vi.fn() }));
vi.mock('../../quickguide', () => ({ QuickGuideTrigger: () => null }));
vi.mock('../PageEnhancementsV2.css', () => ({}));

type Handler = (path: string, init?: unknown) => unknown;
const api = vi.hoisted(() => ({ handler: (() => []) as (path: string, init?: unknown) => unknown }));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof ClientModule>('../../api/client');
  const call = (path: string, init?: unknown) => {
    try { return Promise.resolve(api.handler(path, init)); } catch (e) { return Promise.reject(e); }
  };
  return {
    ...actual,
    getApi: vi.fn((p: string) => call(p)),
    fetchApi: vi.fn((p: string, init?: unknown) => call(p, init)),
    postApi: vi.fn((p: string, b?: unknown) => call(p, { method: 'POST', body: b })),
    patchApi: vi.fn((p: string, b?: unknown) => call(p, { method: 'PATCH', body: b })),
  };
});
const setApi = (h: Handler) => { api.handler = h; };

const fullJob = {
  id: 'vac-1', vacancyCode: 'VAC-101', title: 'Senior ICU Specialist', position: { id: 'p1', title: 'Senior ICU Specialist', code: 'ICU' },
  branch: { id: 'br-ruh', name: 'SGH Riyadh' }, status: 'Open', approvedHeadcount: 3, joinedHeadcount: 1,
  assignments: [{ isActive: true, assignmentKind: 'PRIMARY', userId: 'recruiter-1', user: { displayName: 'Ahmad Recruiter' } }],
  recruiter: { id: 'recruiter-1', displayName: 'Ahmad Recruiter' }, primaryRecruiterId: 'recruiter-1',
};

const empty = (path: string) => (path.includes('?') || /\/(interviews|offers|users|applications)(\b|$)/.test(path) ? { data: [], total: 0 } : []);

beforeEach(() => { mockNavigate.mockReset(); });

describe('Jobs list (VacantListPage)', () => {
  it('shows redacted jobs read-only, separate from actionable jobs', async () => {
    setApi((p) => (p === '/vacancies' ? [fullJob, redactedJob] : empty(p)));
    const { VacantListPage } = await import('../VacantListPage');
    render(<MemoryRouter initialEntries={['/vacancies?tab=requisitions']}><VacantListPage /></MemoryRouter>);
    const section = await screen.findByRole('region', { name: "Other recruiters' jobs" });
    expect(within(section).getByText('Staff Nurse – ER')).toBeInTheDocument();
    expect(within(section).getByText('Owned by another recruiter')).toBeInTheDocument();
    expect(within(section).queryAllByRole('button')).toHaveLength(0);
    // the actionable grid never renders the redacted job
    const cards = screen.getAllByText('Senior ICU Specialist');
    expect(cards.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Staff Nurse – ER')).toHaveLength(1);
  });
});

describe('Work queue (RecruitmentCommandCenter)', () => {
  it('excludes redacted jobs and says so', async () => {
    setApi((p) => (p === '/vacancies' ? [fullJob, redactedJob] : []));
    const { RecruitmentCommandCenter } = await import('../RecruitmentCommandCenter');
    render(<MemoryRouter><RecruitmentCommandCenter /></MemoryRouter>);
    expect(await screen.findByTestId('redacted-queue-note')).toHaveTextContent('1 job is not in your queue (owned by another recruiter)');
    expect(screen.queryByText('Staff Nurse – ER')).not.toBeInTheDocument();
  });
});

describe('Job detail (VacancyOverviewPage)', () => {
  const renderAt = async () => {
    const { VacancyOverviewPage } = await import('../VacancyOverviewPage');
    render(<MemoryRouter initialEntries={['/vacancies/vac-other-1']}><Routes><Route path="/vacancies/:id" element={<VacancyOverviewPage />} /></Routes></MemoryRouter>);
  };
  it('a redacted job renders title/site/seats only, with no actions', async () => {
    setApi((p) => (p === '/vacancies/vac-other-1' ? redactedJob : empty(p)));
    await renderAt();
    const view = await screen.findByTestId('redacted-job-detail');
    expect(within(view).getByText('Staff Nurse – ER')).toBeInTheDocument();
    expect(within(view).getByText('SGH Jeddah')).toBeInTheDocument();
    expect(within(view).getAllByRole('button').map((b) => b.textContent)).toEqual(['Back to Job Positions']);
  });
  it('a 403 on a direct link shows Forbidden, not "not found" or a redirect', async () => {
    setApi((p) => { if (p === '/vacancies/vac-other-1') throw forbidden(jobNotOwnedBody); return empty(p); });
    await renderAt();
    expect(await screen.findByText('You do not have access to this job')).toBeInTheDocument();
    expect(screen.queryByText('Job position not found')).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('Application detail (direct link to another owner\'s file)', () => {
  it('shows Forbidden on 403 FILE_NOT_OWNED', async () => {
    setApi((p) => { if (p.startsWith('/applications/app-x') || p.startsWith('/screening/')) throw forbidden(); return empty(p); });
    const { ApplicationDetailPage } = await import('../ApplicationDetailPage');
    const { ToastProvider } = await import('../../components/ui/ToastContext');
    render(<ToastProvider><MemoryRouter initialEntries={['/applications/app-x']}><Routes><Route path="/applications/:id" element={<ApplicationDetailPage />} /></Routes></MemoryRouter></ToastProvider>);
    expect(await screen.findByText('You do not have access to this application')).toBeInTheDocument();
    expect(screen.queryByText('Application not found')).not.toBeInTheDocument();
  });
});

describe('Interview and offer detail', () => {
  it('interview 403 → Forbidden', async () => {
    setApi((p) => { if (p === '/interviews/int-x') throw forbidden(); return empty(p); });
    const { InterviewDetailPage } = await import('../InterviewDetailPage');
    render(<MemoryRouter initialEntries={['/interviews/int-x']}><Routes><Route path="/interviews/:id" element={<InterviewDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('You do not have access to this interview')).toBeInTheDocument();
  });
  it('offer 403 → Forbidden', async () => {
    setApi((p) => { if (p === '/offers/off-x') throw forbidden(); return empty(p); });
    const { OfferDetailPage } = await import('../OfferDetailPage');
    render(<MemoryRouter initialEntries={['/offers/off-x']}><Routes><Route path="/offers/:id" element={<OfferDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('You do not have access to this offer')).toBeInTheDocument();
  });
});

describe('Add-to-job picker (AddApplicationModal)', () => {
  it('lists redacted jobs disabled with the reason; a 403 on submit shows the ownership message', async () => {
    const user = userEvent.setup();
    setApi((p, init) => {
      if (p === '/vacancies') return [fullJob, redactedJob];
      if (p.startsWith('/candidates')) return { data: [{ id: 'c1', firstName: 'Layla', lastName: 'M', email: 'l@x.test' }], total: 1 };
      if (p === '/applications' && (init as { method?: string })?.method === 'POST') throw forbidden(jobNotOwnedBody);
      return empty(p);
    });
    const { AddApplicationModal } = await import('../../components/candidate/AddApplicationModal');
    render(<MemoryRouter><AddApplicationModal isOpen onClose={() => {}} onSuccess={() => {}} /></MemoryRouter>);
    const opt = await screen.findByRole('option', { name: /Staff Nurse – ER · SGH Jeddah \(owned by another recruiter\)/ });
    expect(opt).toBeDisabled();
    const select = opt.closest('select')!;
    await waitFor(() => expect(select).toHaveValue('vac-1'));
    const candidate = await screen.findByText(/Layla/);
    await user.click(candidate);
    const submit = screen.getAllByRole('button').find((b) => /add|create|submit/i.test(b.textContent ?? '') && b.getAttribute('type') === 'submit');
    expect(submit).toBeDefined();
    await user.click(submit!);
    expect(await screen.findByText('Access denied: this job belongs to another owner.')).toBeInTheDocument();
  });
});
