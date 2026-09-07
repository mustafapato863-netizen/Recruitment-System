import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CandidatesPage } from '../CandidatesPage';
import { VacantListPage } from '../VacantListPage';
import { downloadApi, fetchApi, getApi } from '../../api/client';
import { saveBlob } from '../../utils/download';

vi.mock('../../api/client', () => ({
  fetchApi: vi.fn(),
  getApi: vi.fn(),
  postApi: vi.fn(),
  downloadApi: vi.fn(),
}));

vi.mock('../../utils/download', () => ({
  saveBlob: vi.fn(),
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

describe('Export XLSX Buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CandidatesPage Export', () => {
    it('triggers /candidates/export.xlsx download when Export XLSX is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(fetchApi).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
      vi.mocked(downloadApi).mockResolvedValue(new Blob(['mock-candidates-xlsx']));

      render(
        <MemoryRouter>
          <CandidatesPage />
        </MemoryRouter>,
      );

      const exportButton = await screen.findByRole('button', { name: /export candidates to excel/i });
      expect(exportButton).toBeInTheDocument();

      await user.click(exportButton);

      await waitFor(() => {
        expect(downloadApi).toHaveBeenCalledWith(expect.stringContaining('/candidates/export.xlsx'));
        expect(saveBlob).toHaveBeenCalledWith(
          expect.any(Blob),
          expect.stringMatching(/candidates-export-.*\.xlsx/),
        );
      });
    });
  });

  describe('VacantListPage Export', () => {
    it('triggers /vacancies/export.xlsx download when Export XLSX is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(getApi).mockResolvedValue([]);
      vi.mocked(downloadApi).mockResolvedValue(new Blob(['mock-vacancies-xlsx']));

      render(
        <MemoryRouter>
          <VacantListPage />
        </MemoryRouter>,
      );

      const exportButton = await screen.findByRole('button', { name: /export vacancies to excel/i });
      expect(exportButton).toBeInTheDocument();

      await user.click(exportButton);

      await waitFor(() => {
        expect(downloadApi).toHaveBeenCalledWith('/vacancies/export.xlsx');
        expect(saveBlob).toHaveBeenCalledWith(
          expect.any(Blob),
          expect.stringMatching(/vacancies-export-.*\.xlsx/),
        );
      });
    });
  });
});
