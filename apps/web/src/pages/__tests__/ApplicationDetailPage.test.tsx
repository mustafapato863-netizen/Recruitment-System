import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApplicationDetailPage } from '../ApplicationDetailPage';
import { ToastProvider } from '../../components/ui/ToastContext';

// ── Router helpers ──────────────────────────────────────────────────────────
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Auth mock ───────────────────────────────────────────────────────────────
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-rec-1',
      displayName: 'Fatima Al-Zahrani',
      email: 'fatima@hospital.sa',
      roles: [{ id: 'r1', name: 'RECRUITER', code: 'RECRUITER' }],
      permissions: ['APPLICATION_VIEW', 'APPLICATION_MOVE_STAGE', 'CANDIDATE_EDIT', 'VACANCY_VIEW'],
    },
  }),
}));

vi.mock('../../context/BreadcrumbContext', () => ({
  useSetBreadcrumbTitle: vi.fn(),
}));

vi.mock('../../quickguide', () => ({
  QuickGuideTrigger: () => null,
}));

vi.mock('../PageEnhancementsV2.css', () => ({}));

// ── API fixture ──────────────────────────────────────────────────────────────
const baseApplication = {
  id: 'app-abc-001',
  stage: 'Screening',
  version: 2,
  positionTitle: 'ICU Registered Nurse',
  candidateId: 'cand-1',
  candidate: {
    id: 'cand-1',
    firstName: 'Mona',
    lastName: 'AlHarbi',
    email: 'mona@example.sa',
    phone: '+966512345678',
    location: 'Riyadh',
    skills: ['ACLS', 'BLS'],
  },
  allowedTransitions: ['Interview', 'Rejected'],
  status: 'Active',
  source: 'Portal',
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
};

const mockPatchApi = vi.fn();
const mockGetApi = vi.fn();
const mockPostApi = vi.fn();

vi.mock('../../api/client', () => ({
  getApi: (...args: unknown[]) => mockGetApi(...args),
  patchApi: (...args: unknown[]) => mockPatchApi(...args),
  postApi: (...args: unknown[]) => mockPostApi(...args),
  ApiError: class ApiError extends Error {
    statusCode: number;
    code?: string;
    constructor(message: string, statusCode: number, code?: string) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

function renderPage(appId = 'app-abc-001') {
  return render(
    <MemoryRouter initialEntries={[`/applications/${appId}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/applications/:id" element={<ApplicationDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetApi.mockImplementation((url: string) => {
    if (url === `/applications/app-abc-001`) return Promise.resolve(baseApplication);
    if (url.includes('/history')) return Promise.resolve([]);
    if (url.includes('/notes')) return Promise.resolve([]);
    if (url.includes('/screening')) return Promise.resolve([]);
    if (url.includes('/interviews')) return Promise.resolve([]);
    if (url.includes('candidateId=')) return Promise.resolve({ data: [], total: 0 });
    return Promise.resolve(null);
  });
});

describe('ApplicationDetailPage — stage transitions', () => {
  it('renders the candidate name and current stage after successful load', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryAllByText(/Mona AlHarbi/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/Screening/i).length).toBeGreaterThan(0);
  });

  it('renders persisted workspace stages and actionable transition requirements', async () => {
    const workspace = {
      application: baseApplication,
      templateId: 'pipeline-default',
      templateName: 'Default hiring track',
      stages: [
        {
          id: 'stage-applied',
          name: 'Applied',
          stageType: 'Screening',
          sortOrder: 0,
          required: false,
          isCurrent: true,
          isCompleted: false,
          isNext: false,
          isAvailable: true,
          requirements: [],
        },
        {
          id: 'stage-screening',
          name: 'Screening',
          stageType: 'Screening',
          sortOrder: 1,
          required: true,
          isCurrent: false,
          isCompleted: false,
          isNext: true,
          isAvailable: true,
          requirements: [
            {
              id: 'stage-screening:entry:0',
              code: 'screening',
              label: 'Passed screening',
              kind: 'entry',
              required: true,
              complete: false,
              blocking: true,
              reason: 'Save a Passed screening result.',
              actionLabel: 'Open Screening',
              actionTab: 'Screening',
            },
          ],
        },
      ],
      nextStage: 'Screening',
      nextStageRequirements: [
        {
          id: 'stage-screening:entry:0',
          code: 'screening',
          label: 'Passed screening',
          kind: 'entry',
          required: true,
          complete: false,
          blocking: true,
          reason: 'Save a Passed screening result.',
          actionLabel: 'Open Screening',
          actionTab: 'Screening',
        },
      ],
      canAdvance: false,
      summary: {
        screeningOutcome: null,
        interviewCount: 0,
        completedInterviewCount: 0,
        offerStatus: null,
        hiringStatus: null,
        actualJoiningDate: null,
        documentCount: 0,
      },
    };
    mockGetApi.mockImplementation((url: string) => {
      if (url === `/applications/${baseApplication.id}`) return Promise.resolve(baseApplication);
      if (url.endsWith('/workspace')) return Promise.resolve(workspace);
      if (url.includes('/history') || url.includes('/notes') || url.includes('/screening') || url.includes('/interviews')) return Promise.resolve([]);
      if (url.includes('candidateId=')) return Promise.resolve({ data: [], total: 0 });
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('region', { name: /Applicant pipeline stages/i })).toBeInTheDocument());
    expect(within(screen.getByRole('region', { name: /Applicant pipeline stages/i })).getByRole('tab', { name: /Screening/ })).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Complete required items before advancing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Screening/i })).toBeInTheDocument();
  });

  it('sends PATCH /applications/:id/stage with optimistic lock fields on stage move', async () => {
    const user = userEvent.setup();
    const updatedApp = { ...baseApplication, stage: 'Interview', version: 3 };
    mockPatchApi.mockResolvedValueOnce(updatedApp);

    renderPage();
    await waitFor(() => expect(screen.queryAllByText(/Mona AlHarbi/i).length).toBeGreaterThan(0));

    const workspace = screen.getByRole('region', { name: 'Unified applicant stage workspace' });
    await user.click(within(workspace).getByRole('button', { name: 'Advance Stage' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Move' }));
    await waitFor(() => {
      expect(mockPatchApi).toHaveBeenCalledWith(
        expect.stringContaining('/stage'),
        expect.objectContaining({
          expectedStage: 'Screening',
          expectedVersion: 2,
        })
      );
    });
  });

  it('shows conflict alert and re-fetches application on 409 response', async () => {
    const user = userEvent.setup();
    // First patchApi call throws conflict error
    const conflictErr = Object.assign(new Error('Conflict'), {
      statusCode: 409,
      code: 'CONFLICT',
    });
    mockPatchApi.mockRejectedValueOnce(conflictErr);
    // getApi after conflict returns refreshed version
    const refreshed = { ...baseApplication, version: 5 };
    mockGetApi.mockImplementation((url: string) => {
      if (url === `/applications/app-abc-001`) return Promise.resolve(refreshed);
      return Promise.resolve([]);
    });

    renderPage();
    await waitFor(() => expect(screen.queryAllByText(/Mona AlHarbi/i).length).toBeGreaterThan(0));

    const workspace = screen.getByRole('region', { name: 'Unified applicant stage workspace' });
    await user.click(within(workspace).getByRole('button', { name: 'Advance Stage' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Move' }));
    await waitFor(() => {
      expect(screen.getAllByText(/updated by someone else/i).length).toBeGreaterThan(0);
    });
  });

  it('renders an error/not-found state when API returns a rejection', async () => {
    mockGetApi.mockRejectedValue(new Error('404 Not Found'));
    renderPage();
    await waitFor(() => {
      const el =
        screen.queryByText(/not found/i) ||
        screen.queryByText(/error/i) ||
        screen.queryByText(/forbidden/i);
      expect(el).toBeTruthy();
    });
  });

  it('calls POST /applications/:id/notes with content when saving a note', async () => {
    mockPostApi.mockResolvedValueOnce({
      id: 'note-new-1',
      content: 'SCFHS verification pending',
      createdAt: new Date().toISOString(),
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.queryAllByText(/Mona AlHarbi/i).length).toBeGreaterThan(0));

    const workspace = screen.getByRole('region', { name: 'Unified applicant stage workspace' });
    await user.click(within(workspace).getByRole('button', { name: 'Add Note' }));
    const dialog = await screen.findByRole('dialog', { name: /add internal note/i });
    const textarea = within(dialog).getByPlaceholderText('Type candidate observations...');
    fireEvent.change(textarea, { target: { value: 'SCFHS verification pending' } });
    const saveNote = within(dialog).getByRole('button', { name: 'Save Note' });
    await waitFor(() => expect(saveNote).toBeEnabled());
    await user.click(saveNote);
    await waitFor(() => {
      expect(mockPostApi).toHaveBeenCalledWith(
        expect.stringContaining('/notes'),
        expect.objectContaining({ content: 'SCFHS verification pending' })
      );
    });
  });
});
