import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CandidatesPage } from '../CandidatesPage';
import { VacantListPage } from '../VacantListPage';
import { ToastProvider } from '../../components/ui/ToastContext';
import { downloadApi, fetchApi, getApi } from '../../api/client';

vi.mock('../../api/client', () => ({
  fetchApi: vi.fn(),
  getApi: vi.fn(),
  postApi: vi.fn(),
  downloadApi: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-1',
      displayName: 'System Admin',
      email: 'admin@hospital.sa',
      roles: [{ id: 'r1', name: 'ADMIN', code: 'ADMIN' }],
      permissions: [
        'CANDIDATE_CREATE',
        'CANDIDATE_VIEW',
        'VACANCY_VIEW',
        'VACANCY_REQUEST_CREATE',
      ],
    },
  }),
}));

describe('No Excel export actions in the V2 migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not advertise or invoke Excel export from the retired candidate listing', async () => {
    vi.mocked(fetchApi).mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 });
    render(<MemoryRouter><ToastProvider><CandidatesPage /></ToastProvider></MemoryRouter>);
    await waitFor(() => expect(fetchApi).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /export candidates to excel|export xlsx/i })).not.toBeInTheDocument();
    expect(downloadApi).not.toHaveBeenCalled();
  });

  it('keeps other vacancy actions but offers no Export XLSX entry', async () => {
    const user = userEvent.setup();
    vi.mocked(getApi).mockResolvedValue([]);
    render(<MemoryRouter><VacantListPage /></MemoryRouter>);
    await user.click(screen.getByText('More actions'));
    expect(screen.getByText('Upload job description')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export xlsx|export.*excel/i })).not.toBeInTheDocument();
    expect(downloadApi).not.toHaveBeenCalled();
  });
});
