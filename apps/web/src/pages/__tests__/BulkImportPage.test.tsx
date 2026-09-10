import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BulkImportPage } from '../BulkImportPage';
import { getApi, postApi, postFormDataApi, downloadApi } from '../../api/client';
import { saveBlob } from '../../utils/download';

vi.mock('../../api/client', () => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
  postFormDataApi: vi.fn(),
  downloadApi: vi.fn(),
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
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
        'VACANCY_REQUEST_CREATE',
        'MASTER_DATA_MANAGE',
      ],
    },
  }),
}));

const mockJobs = [
  {
    id: 'job-101',
    fileName: 'candidates_batch_jan.xlsx',
    sheetName: 'Candidates',
    dataset: 'candidates',
    status: 'Review',
    totalRows: 25,
    validRows: 20,
    invalidRows: 3,
    duplicateRows: 2,
    unresolvedDuplicateRows: 2,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:01:00.000Z',
  },
];

const mockReviewJob = {
  id: 'job-101',
  fileName: 'candidates_batch_jan.xlsx',
  sheetName: 'Candidates',
  dataset: 'candidates',
  status: 'Review',
  totalRows: 2,
  validRows: 1,
  invalidRows: 0,
  duplicateRows: 1,
  unresolvedDuplicateRows: 1,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:01:00.000Z',
};

const mockReviewRows = {
  rows: [
    {
      id: 'row-1',
      jobId: 'job-101',
      rowNumber: 2,
      result: 'Valid',
      details: 'All required fields valid',
      data: {
        firstName: 'Sarah',
        lastName: 'Al-Mansoor',
        email: 'sarah.mansoor@example.com',
        currentTitle: 'Cardiologist',
        location: 'Riyadh',
      },
      decision: null,
    },
    {
      id: 'row-2',
      jobId: 'job-101',
      rowNumber: 3,
      result: 'Duplicate',
      details: 'Candidate with this email already exists',
      data: {
        firstName: 'Omar',
        lastName: 'Al-Harbi',
        email: 'omar.harbi@example.com',
        currentTitle: 'Registered Nurse',
        location: 'Jeddah',
      },
      decision: null,
    },
  ],
  total: 2,
};

describe('BulkImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApi).mockImplementation((url: string) => {
      if (url.includes('/rows')) {
        return Promise.resolve(mockReviewRows) as unknown as Promise<unknown>;
      }
      if (url.includes('/jobs/job-101')) {
        return Promise.resolve(mockReviewJob) as unknown as Promise<unknown>;
      }
      if (url.includes('/jobs')) {
        return Promise.resolve({ data: mockJobs }) as unknown as Promise<unknown>;
      }
      return Promise.resolve({}) as unknown as Promise<unknown>;
    });
    vi.mocked(postApi).mockResolvedValue({ success: true });
    vi.mocked(downloadApi).mockResolvedValue(new Blob(['mock-xlsx-content']));
  });

  describe('Landing Screen', () => {
    it('renders the bulk import center with dataset tabs and job history', async () => {
      render(
        <MemoryRouter initialEntries={['/import']}>
          <Routes>
            <Route path="/import" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Bulk Import Center')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /candidates/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /vacancy requests/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /branches/i })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /legal entities/i })).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('candidates_batch_jan.xlsx')).toBeInTheDocument();
      });
    });

    it('downloads the template for the currently selected dataset', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/import']}>
          <Routes>
            <Route path="/import" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      const downloadButton = screen.getByRole('button', { name: /download template/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(downloadApi).toHaveBeenCalledWith('/imports/candidates/template');
        expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'recruitflow-candidates-template.xlsx');
      });
    });

    it('inspects an uploaded file and stages it for review', async () => {
      const user = userEvent.setup();
      vi.mocked(postFormDataApi).mockImplementation((url: string) => {
        if (url.includes('/inspect')) {
          return Promise.resolve({
            sheets: [{ name: 'Candidates', rowCount: 15, columnCount: 6 }],
            warnings: [],
            columns: ['firstName', 'lastName', 'email'],
          }) as unknown as Promise<unknown>;
        }
        if (url.includes('/upload')) {
          return Promise.resolve({ jobId: 'job-102' }) as unknown as Promise<unknown>;
        }
        return Promise.resolve({}) as unknown as Promise<unknown>;
      });

      render(
        <MemoryRouter initialEntries={['/import']}>
          <Routes>
            <Route path="/import" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      const file = new File(['mock content'], 'test_candidates.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const input = screen.getByLabelText(/choose an excel workbook or csv/i, { selector: 'input' });
      await user.upload(input, file);

      await waitFor(() => {
        expect(postFormDataApi).toHaveBeenCalledWith(
          '/imports/candidates/inspect',
          expect.any(FormData),
        );
      });

      const stageButton = screen.getByRole('button', { name: /stage for review/i });
      expect(stageButton).toBeEnabled();
    });
  });

  describe('Review Screen', () => {
    it('renders the staged review summary and row items with status badges', async () => {
      render(
        <MemoryRouter initialEntries={['/import/candidates/job-101']}>
          <Routes>
            <Route path="/import/:dataset/:jobId" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Review candidates_batch_jan.xlsx')).toBeInTheDocument();
        expect(screen.getByText('Sarah')).toBeInTheDocument();
        expect(screen.getByText('sarah.mansoor@example.com')).toBeInTheDocument();
        expect(screen.getByText('Omar')).toBeInTheDocument();
        expect(screen.getByText('Duplicate')).toBeInTheDocument();
      });
    });

    it('allows deciding on duplicate row: clicking Update', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/import/candidates/job-101']}>
          <Routes>
            <Route path="/import/:dataset/:jobId" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
      });

      const updateButton = screen.getByRole('button', { name: 'Update' });
      await user.click(updateButton);

      await waitFor(() => {
        expect(postApi).toHaveBeenCalledWith(
          '/imports/candidates/jobs/job-101/rows/row-2/decision/Update',
        );
      });
    });

    it('downloads the error report workbook', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/import/candidates/job-101']}>
          <Routes>
            <Route path="/import/:dataset/:jobId" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /error report/i })).toBeInTheDocument();
      });

      const errorReportBtn = screen.getByRole('button', { name: /error report/i });
      await user.click(errorReportBtn);

      await waitFor(() => {
        expect(downloadApi).toHaveBeenCalledWith(
          '/imports/candidates/jobs/job-101/error-report',
        );
        expect(saveBlob).toHaveBeenCalledWith(
          expect.any(Blob),
          'recruitflow-candidates-import-errors-job-101.xlsx',
        );
      });
    });
  });
});
