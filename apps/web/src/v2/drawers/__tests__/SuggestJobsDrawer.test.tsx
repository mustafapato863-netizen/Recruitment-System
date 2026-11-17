import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CandidateJobRecommendation } from '@recruitflow/contracts';

const atsApi = vi.hoisted(() => ({
  fetchCandidateJobRecommendations: vi.fn(),
}));

const clientApi = vi.hoisted(() => ({
  postApi: vi.fn(),
}));

vi.mock('../../api/ats', () => atsApi);
vi.mock('../../../api/client', async () => ({
  ...(await vi.importActual<object>('../../../api/client')),
  postApi: clientApi.postApi,
}));

import { SuggestJobsDrawer } from '../SuggestJobsDrawer';

describe('SuggestJobsDrawer', () => {
  const mockRecommendations: CandidateJobRecommendation[] = [
    {
      vacancyId: 'vac-1',
      vacancyCode: 'JOB-001',
      title: 'Senior ICU Specialist',
      department: 'Clinical',
      branchName: 'Riyadh Hospital',
      atsScore: 94.5,
      mustHaveMatched: true,
      matchedSkillsCount: 4,
      totalRequiredSkillsCount: 4,
      alreadyApplied: false,
    },
    {
      vacancyId: 'vac-2',
      vacancyCode: 'JOB-002',
      title: 'Triage Nurse',
      department: 'Emergency',
      branchName: 'Jeddah Hospital',
      atsScore: 78.0,
      mustHaveMatched: false,
      matchedSkillsCount: 2,
      totalRequiredSkillsCount: 3,
      alreadyApplied: true,
      existingApplicationId: 'app-999',
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    atsApi.fetchCandidateJobRecommendations.mockResolvedValue(mockRecommendations);
    clientApi.postApi.mockResolvedValue({ id: 'app-new-123' });
  });

  it('renders recommendation list with ATS scores, roles, and branch names', async () => {
    render(
      <MemoryRouter>
        <SuggestJobsDrawer
          candidateId="cand-1"
          candidateName="Sarah Ahmed"
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    // Header check
    expect(screen.getByText('Suggest Active Roles')).toBeInTheDocument();
    expect(screen.getByText(/ATS recommended opportunities for Sarah Ahmed/)).toBeInTheDocument();

    // Recommendations rendered
    await waitFor(() => {
      expect(screen.getByText('Senior ICU Specialist')).toBeInTheDocument();
      expect(screen.getByText('Triage Nurse')).toBeInTheDocument();
    });

    expect(screen.getByText(/94\.5% Match/i)).toBeInTheDocument();
    expect(screen.getByText(/78% Match/i)).toBeInTheDocument();
    expect(screen.getByText(/Riyadh Hospital/)).toBeInTheDocument();
    expect(screen.getByText('4/4 skills matched')).toBeInTheDocument();
    expect(screen.getByText('2/3 skills matched')).toBeInTheDocument();
  });

  it('allows applying an unapplied candidate to a recommended job', async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();

    render(
      <MemoryRouter>
        <SuggestJobsDrawer
          candidateId="cand-1"
          candidateName="Sarah Ahmed"
          onClose={vi.fn()}
          onApplied={onApplied}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Senior ICU Specialist')).toBeInTheDocument();
    });

    const applyBtn = screen.getByRole('button', { name: /Apply Candidate/i });
    await user.click(applyBtn);

    expect(clientApi.postApi).toHaveBeenCalledWith('/applications', {
      vacancyId: 'vac-1',
      candidateId: 'cand-1',
      source: 'Recruiter ATS Suggestion',
    });

    await waitFor(() => {
      const links = screen.getAllByRole('link', { name: /Open File/i });
      expect(links.some((l) => l.getAttribute('href') === '/applications/app-new-123')).toBe(true);
    });
    expect(onApplied).toHaveBeenCalled();
  });

  it('shows existing application link for already applied role', async () => {
    render(
      <MemoryRouter>
        <SuggestJobsDrawer
          candidateId="cand-1"
          candidateName="Sarah Ahmed"
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Triage Nurse')).toBeInTheDocument();
    });

    const viewFileLink = screen.getByRole('link', { name: /Open File/i });
    expect(viewFileLink).toHaveAttribute('href', '/applications/app-999');
  });

  it('shows empty state when no matching jobs are found', async () => {
    atsApi.fetchCandidateJobRecommendations.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <SuggestJobsDrawer
          candidateId="cand-empty"
          candidateName="New Candidate"
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No open opportunities match')).toBeInTheDocument();
    });
  });
});
