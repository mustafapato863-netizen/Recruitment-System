/** QA r4: R4-1 (admins never see Claim on Board cards) and R4-2 (draft scorecards are not feedback). */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('../../components/whatsapp/SendWhatsAppDialog', () => ({ SendWhatsAppDialog: () => null }));

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

const empty = (path: string) => (path.includes('?') || /\/(interviews|offers|users|applications)(\b|$)/.test(path) ? { data: [], total: 0 } : []);

import { ApplicationKanbanCard } from '../../components/candidate/ApplicationKanbanCard';

const card = { id: 'a1', applicationCode: 'APP-1', candidateName: 'Hassan Ali', positionTitle: 'Nurse', stage: 'Screening', nextAction: 'Review', matchScore: 70,
  owner: { name: 'Unassigned', initials: '—', color: 'bg-slate-400' }, primaryRecruiterId: null } as never;
const noop = () => {};
const renderCard = (canClaim?: boolean) => render(<ApplicationKanbanCard card={card} canClaim={canClaim} onOpen={noop} onAddNote={noop} onMoveStage={noop}
  onAssignToMe={noop} onDragStart={noop} onSignalChange={noop} />);

describe('R4-1: Board card Claim', () => {
  it('is hidden for admins (canClaim=false) and the card says Unassigned', () => {
    renderCard(false);
    expect(screen.queryByRole('button', { name: /Claim/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
  });
  it('is kept for recruiters', () => {
    renderCard();
    expect(screen.getByRole('button', { name: /Claim/ })).toBeInTheDocument();
  });
});

const interview = {
  id: 'int-1', applicationId: 'app-1', candidateName: 'Maya', positionTitle: 'Nurse', status: 'Completed', scheduledStart: '2026-10-08T07:00:00Z', scheduledEnd: '2026-10-08T08:00:00Z',
  attendees: [
    { id: 't1', userId: 'u-maya', userName: 'Maya Lead', role: 'Lead', response: 'Accepted' },
    { id: 't2', userId: 'u-ivan', userName: 'Ivan Interviewer', role: 'Panelist', response: 'Accepted' },
  ],
  scorecards: [
    { id: 's1', interviewerId: 'u-maya', interviewerName: 'Maya Lead', overallRating: 4, recommendation: 'Hire', isLocked: true },
    { id: 's2', interviewerId: 'u-ivan', interviewerName: 'Ivan Interviewer', overallRating: 2, recommendation: 'No Hire', isLocked: false },
  ],
};

describe('R4-2: InterviewDetailPage', () => {
  it('shows a draft as Draft, counts only submitted feedback', async () => {
    setApi((p) => (p === '/interviews/int-1' ? interview : empty(p)));
    const { InterviewDetailPage } = await import('../InterviewDetailPage');
    render(<MemoryRouter initialEntries={['/interviews/int-1']}><Routes><Route path="/interviews/:id" element={<InterviewDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Draft')).toBeInTheDocument();
    expect(screen.getAllByText('Feedback submitted')).toHaveLength(1);
    expect(screen.getByText(/1 panel member has not submitted feedback/)).toBeInTheDocument();
    expect(screen.queryByText(/Based on 2 of/)).not.toBeInTheDocument();
  });
});
