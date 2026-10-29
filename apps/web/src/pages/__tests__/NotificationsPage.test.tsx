import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationRecord, PaginatedResult } from '@recruitflow/contracts';

const api = vi.hoisted(() => ({ getApi: vi.fn(), patchApi: vi.fn(), postApi: vi.fn(), deleteApi: vi.fn() }));
const auth = vi.hoisted(() => ({
  user: {
    id: 'u1',
    displayName: 'Mariam Farag',
    roles: [{ code: 'RECRUITER' }],
    permissions: ['CANDIDATE_VIEW', 'APPLICATION_VIEW', 'NOTIFICATION_VIEW'],
  },
}));
vi.mock('../../api/client', async () => ({ ...(await vi.importActual<object>('../../api/client')), ...api }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../context/BreadcrumbContext', () => ({ useSetBreadcrumbTitle: vi.fn() }));
vi.mock('../PageEnhancementsV2.css', () => ({}));

import { CandidateDetailPage } from '../CandidateDetailPage';
import { CandidateDocumentsPage } from '../CandidateDocumentsPage';
import { NotificationsPage } from '../NotificationsPage';

const unread: NotificationRecord = {
  id: 'n1',
  organizationId: 'org-1',
  recipientUserId: 'u1',
  type: 'ApplicationUpdated',
  title: 'Screen Nour Ali',
  message: 'A file is waiting on your decision.',
  entityType: 'Application',
  entityId: '20000000-0000-4000-8000-000000000510',
  readAt: null,
  createdAt: '2026-10-27T08:00:00.000Z',
  applicationId: '20000000-0000-4000-8000-000000000510',
};

function pageOf(rows: NotificationRecord[], total = rows.length): PaginatedResult<NotificationRecord> {
  return { data: rows, total, page: 1, pageSize: 20 };
}

function mockFeed(rows: NotificationRecord[], unreadCount: number) {
  api.getApi.mockImplementation(async (url: string) => {
    if (url.startsWith('/notifications/unread-count')) return { unreadCount };
    if (url.includes('unreadOnly=true')) return pageOf(rows.filter((row) => !row.readAt));
    return pageOf(rows);
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <NotificationsPage />
    </MemoryRouter>,
  );
}

describe('Notification Center desk', () => {
  beforeEach(() => {
    api.getApi.mockReset();
    api.patchApi.mockReset();
    api.postApi.mockReset();
    api.deleteApi.mockReset();
    auth.user = {
      id: 'u1',
      displayName: 'Mariam Farag',
      roles: [{ code: 'RECRUITER' }],
      permissions: ['CANDIDATE_VIEW', 'APPLICATION_VIEW', 'NOTIFICATION_VIEW'],
    };
  });

  it('keeps the filters, refresh, and notification actions', async () => {
    const candidateNote: NotificationRecord = {
      ...unread,
      id: 'n2',
      title: 'Candidate profile updated',
      entityType: 'Candidate',
      entityId: 'c1',
      applicationId: null,
    };
    mockFeed([unread, candidateNote], 2);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Screen Nour Ali' })).toBeInTheDocument();
    expect(screen.queryByText('Stay updated with cross-system alerts, approvals, and workflow events')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Notification Center' })).not.toBeInTheDocument();

    expect(screen.getByRole('tab', { name: 'All Notifications 2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Unread Only 2' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'System Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pending Approvals 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh notifications' })).toBeInTheDocument();

    const detailLinks = screen.getAllByRole('link', { name: /Open details/ });
    expect(detailLinks[0]).toHaveAttribute('href', '/applications/20000000-0000-4000-8000-000000000510?returnTo=%2Fnotifications');
    expect(detailLinks[1]).toHaveAttribute('href', '/candidates/c1?returnTo=%2Fnotifications');
    expect(screen.getAllByRole('button', { name: 'Mark as read' })[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark all as read/ })).toBeInTheDocument();
  });

  it('keeps the empty sentences when a view has no rows', async () => {
    const user = userEvent.setup();
    mockFeed([], 0);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'No notifications in this view' })).toBeInTheDocument();
    expect(screen.getByText('New approvals, system alerts, and workflow events will appear here.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Notification Center' })).not.toBeInTheDocument();
    expect(screen.queryByText('Stay updated with cross-system alerts, approvals, and workflow events')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Unread Only/ }));

    expect(await screen.findByRole('heading', { name: 'You’re all caught up!' })).toBeInTheDocument();
    expect(screen.getByText('There are no unread updates waiting for your review.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all notifications' })).toBeInTheDocument();
  });
});

describe('CandidateDetailPage returnTo contract', () => {
  function Loc() {
    const l = useLocation();
    return <output data-testid="loc">{l.pathname + l.search}</output>;
  }

  function mockCandidateDetail() {
    api.getApi.mockImplementation(async (url: string) => {
      if (url === '/candidates/c1') {
        return {
          id: 'c1',
          candidateCode: 'CAN-001',
          firstName: 'Ahmed',
          lastName: 'Embaby',
          status: 'Active',
          email: 'ahmed@example.com',
          skills: ['HRIS'],
        };
      }
      if (url.startsWith('/candidates/c1/activities')) {
        return {
          completed: 0,
          completedByMe: 0,
          pending: 0,
          overdue: 0,
          lastActivityAt: null,
          nextFollowUpAt: null,
          byKind: {},
          byRecruiter: [],
          entries: [],
          totalEntries: 0,
          page: 1,
          pageSize: 10,
          totalPages: 0,
        };
      }
      if (url.startsWith('/applications?candidateId=c1')) {
        return {
          data: [
            {
              id: 'app-1',
              candidateId: 'c1',
              vacancyId: 'v1',
              positionTitle: 'HRIS Developer',
              stage: 'Interview',
              appliedAt: '2026-10-01T00:00:00.000Z',
              createdAt: '2026-10-01T00:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 100,
        };
      }
      if (url.startsWith('/interviews?candidateId=c1')) return [];
      if (url.startsWith('/offers?candidateId=c1')) {
        return [
          {
            id: 'off-1',
            offerCode: 'OFF-001',
            status: 'Draft',
            positionTitle: 'HRIS Developer',
            createdAt: '2026-10-02T00:00:00.000Z',
          },
        ];
      }
      return { data: [], total: 0 };
    });
  }

  it('validates an authorized returnTo and appends it to Back, application, and offer links while preserving candidate ID', async () => {
    const u = userEvent.setup();
    mockCandidateDetail();
    render(
      <MemoryRouter initialEntries={['/candidates/c1?returnTo=%2Fnotifications']}>
        <Routes>
          <Route path="/candidates/:id" element={<CandidateDetailPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Loc />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Ahmed Embaby' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back/i })).toHaveAttribute('href', '/notifications');
    expect(screen.getByRole('link', { name: /Documents/i })).toHaveAttribute('href', '/candidates/c1/documents?returnTo=%2Fnotifications');
    expect(screen.getByRole('link', { name: 'Review application' })).toHaveAttribute(
      'href',
      '/applications/app-1?returnTo=%2Fnotifications',
    );

    await u.click(screen.getByRole('tab', { name: /Applications/i }));
    expect(screen.getAllByRole('link', { name: 'View application' })[0]).toHaveAttribute(
      'href',
      '/applications/app-1?returnTo=%2Fnotifications',
    );

    await u.click(screen.getByRole('tab', { name: /Offers/i }));
    expect(screen.getByRole('link', { name: 'View offer' })).toHaveAttribute(
      'href',
      '/offers/off-1?returnTo=%2Fnotifications',
    );
  });

  it('uses an authorized returnTo for error/not-found back navigation and drops unauthorized or external returnTo', async () => {
    const u = userEvent.setup();
    mockCandidateDetail();
    // Actor lacks VACANCY_VIEW, so /vacancies/v1 is unauthorized as a return target
    const { unmount } = render(
      <MemoryRouter initialEntries={['/candidates/c1?returnTo=%2Fvacancies%2Fv1']}>
        <Routes>
          <Route path="/candidates/:id" element={<CandidateDetailPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Loc />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Ahmed Embaby' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back/i })).toHaveAttribute('href', '/candidates');
    expect(screen.getByRole('link', { name: 'Review application' })).toHaveAttribute('href', '/applications/app-1');
    unmount();

    api.getApi.mockRejectedValueOnce(new Error('404 Not found'));
    render(
      <MemoryRouter initialEntries={['/candidates/c-missing?returnTo=%2Fsearch%3Fq%3DAhmed']}>
        <Routes>
          <Route path="/candidates/:id" element={<CandidateDetailPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Loc />
      </MemoryRouter>,
    );

    const actionBtn = await screen.findByRole('button', { name: 'Back to Candidates' });
    await u.click(actionBtn);
    expect(screen.getByTestId('loc')).toHaveTextContent('/search?q=Ahmed');
  });

  it('keeps the authorized source through profile, documents and explicit Back', async () => {
    const u = userEvent.setup();
    mockCandidateDetail();
    const existing = api.getApi.getMockImplementation()!;
    api.getApi.mockImplementation(async (url: string) => url === '/documents/candidate/c1' ? [] : existing(url));
    render(<MemoryRouter initialEntries={['/candidates/c1?returnTo=%2Fcandidates%3Ftab%3Dbank%26search%3DAhmed']}><Routes>
      <Route path="/candidates/:id" element={<CandidateDetailPage />} />
      <Route path="/candidates/:id/documents" element={<CandidateDocumentsPage />} />
    </Routes><Loc /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Ahmed Embaby' });
    await u.click(screen.getByRole('link', { name: /Documents/i }));
    expect(await screen.findByRole('heading', { name: /Document Vault/ })).toBeInTheDocument();
    await u.click(screen.getByRole('link', { name: 'Back to profile' }));
    await screen.findByRole('heading', { name: 'Ahmed Embaby' });
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/candidates?tab=bank&search=Ahmed');
  });

  it('keeps document edits unavailable to read-only users and does not report failed reads as zero', async () => {
    const u = userEvent.setup();
    auth.user.permissions = ['CANDIDATE_VIEW'];
    api.postApi.mockClear();
    mockCandidateDetail();
    const existing = api.getApi.getMockImplementation()!;
    let fail = true;
    api.getApi.mockImplementation(async (url: string) => {
      if (url === '/documents/candidate/c1') {
        if (fail) throw new Error('Documents are unavailable');
        return [];
      }
      return existing(url);
    });
    render(<MemoryRouter initialEntries={['/candidates/c1/documents']}><Routes>
      <Route path="/candidates/:id/documents" element={<CandidateDocumentsPage />} />
    </Routes></MemoryRouter>);
    await screen.findByText('Document list unavailable');
    expect(screen.queryByRole('button', { name: 'Add document record' })).not.toBeInTheDocument();
    for (const label of ['Total Documents', 'Verified Files', 'Pending Review']) {
      expect(screen.getByText(label).closest('article')).toHaveTextContent('—');
    }
    expect(screen.queryByText('No document records')).not.toBeInTheDocument();
    fail = false;
    await u.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    expect(await screen.findByText('No document records')).toBeInTheDocument();
    expect(screen.getByText('Total Documents').closest('article')).toHaveTextContent('0');
    expect(api.postApi).not.toHaveBeenCalled();
  });
  it('allows an editor to open the document form', async () => {
    auth.user.permissions = ['CANDIDATE_VIEW', 'CANDIDATE_EDIT'];
    mockCandidateDetail();
    const existing = api.getApi.getMockImplementation()!;
    api.getApi.mockImplementation(async (url: string) => url === '/documents/candidate/c1' ? [] : existing(url));
    render(<MemoryRouter initialEntries={['/candidates/c1/documents']}><Routes>
      <Route path="/candidates/:id/documents" element={<CandidateDocumentsPage />} />
    </Routes></MemoryRouter>);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Add document record' }));
    expect(screen.getByRole('dialog', { name: 'Add Document Record' })).toBeInTheDocument();
  });
});
