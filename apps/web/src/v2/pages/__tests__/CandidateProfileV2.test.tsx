import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { CandidateProfileV2 } from '../CandidateProfileV2';

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

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), deleteApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));

const emptyActivities = {
  completed: 0, completedByMe: 0, pending: 0, overdue: 0,
  lastActivityAt: null, nextFollowUpAt: null, byKind: {}, byRecruiter: [],
  entries: [], totalEntries: 0, page: 1, pageSize: 20,
};

const skillNames = Array.from({ length: 20 }, (_, i) => `Skill ${String(i + 1).padStart(2, '0')}`);

function candidate(skills: string[]) {
  return {
    id: 'c1',
    firstName: 'Test',
    lastName: 'Candidate',
    status: 'Active',
    candidateCode: 'CND-2026-999',
    currentTitle: 'Nurse',
    currentCompany: 'SGH',
    location: 'Cairo',
    email: 't@x.test',
    phone: '+20 100',
    source: 'Referral',
    consentStatus: 'Given',
    createdAt: '2026-01-01T00:00:00.000Z',
    skills,
  };
}

function serveCandidate(skills: string[]) {
  api.getApi.mockImplementation(async (path: string) => {
    if (path === '/candidates/c1') return candidate(skills);
    if (path.startsWith('/applications?candidateId=c1')) return { data: [], total: 0 };
    if (path === '/interviews?candidateId=c1') return [];
    if (path === '/offers?candidateId=c1') return [];
    if (path === '/documents/candidate/c1') return [];
    if (path === '/vacancies') return [];
    if (path === '/candidates/c1/activities?page=1') return emptyActivities;
    throw new ApiError(404, 'not found');
  });
}

function renderProfile() {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(
    <MemoryRouter initialEntries={['/candidates/c1']}>
      <Routes>
        <Route path="/candidates/:id" element={<CandidateProfileV2 />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
});

describe('candidate profile skills list', () => {
  it('shows only the first 12 skills with a Show all control, and expands/collapses', async () => {
    serveCandidate(skillNames);
    renderProfile();

    await screen.findByText('Skill 01');
    // Collapsed by default: the first 12 are visible, the rest are not.
    expect(screen.getByText('Skill 12')).toBeInTheDocument();
    expect(screen.queryByText('Skill 13')).not.toBeInTheDocument();
    expect(screen.queryByText('Skill 20')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show all 20 skills' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByText('Skill 20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show fewer skills' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Show fewer skills' }));
    expect(screen.queryByText('Skill 13')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all 20 skills' })).toBeInTheDocument();
  });

  it('does not show a toggle when the candidate has 12 or fewer skills', async () => {
    serveCandidate(skillNames.slice(0, 5));
    renderProfile();

    await screen.findByText('Skill 01');
    expect(screen.getByText('Skill 05')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show all \d+ skills/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show fewer skills' })).not.toBeInTheDocument();
  });

  it('adding a skill expands the list so the new skill is visible', async () => {
    serveCandidate(skillNames);
    api.patchApi.mockImplementation(async (_path: string, body: unknown) => {
      const skills = (body as { skills: string[] }).skills;
      return candidate(skills);
    });
    renderProfile();

    await screen.findByText('Skill 01');
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. React, Python, Project Management'), {
      target: { value: 'Skill 21' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));

    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/candidates/c1', { skills: [...skillNames, 'Skill 21'] }));
    expect(await screen.findByText('Skill 21')).toBeInTheDocument();
    expect(screen.getByText('Skill 20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show fewer skills' })).toBeInTheDocument();
  });
});
