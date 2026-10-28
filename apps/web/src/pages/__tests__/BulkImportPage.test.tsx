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

const authState = vi.hoisted(() => ({
  user: {
    id: 'usr-1',
    displayName: 'System Admin',
    email: 'admin@hospital.sa',
    roles: [{ id: 'r1', name: 'ADMIN', code: 'ADMIN' }],
    permissions: [
      'CANDIDATE_CREATE',
      'CANDIDATE_VIEW',
      'CANDIDATE_EDIT',
      'VACANCY_REQUEST_CREATE',
      'VACANCY_REQUEST_VIEW',
      'MASTER_DATA_MANAGE',
      'MASTER_DATA_VIEW',
    ],
  },
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
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
    authState.user = {
      id: 'usr-1',
      displayName: 'System Admin',
      email: 'admin@hospital.sa',
      roles: [{ id: 'r1', name: 'ADMIN', code: 'ADMIN' }],
      permissions: [
        'CANDIDATE_CREATE',
        'CANDIDATE_VIEW',
        'CANDIDATE_EDIT',
        'VACANCY_REQUEST_CREATE',
        'VACANCY_REQUEST_VIEW',
        'MASTER_DATA_MANAGE',
        'MASTER_DATA_VIEW',
      ],
    };
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
      expect(document.getElementById('import-history')).not.toBeNull();
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

    it('inspects an uploaded file and stages it for review when both view and create permissions are held', async () => {
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

    it('allows read-only history viewing with CANDIDATE_VIEW while disabling upload and staging', async () => {
      authState.user.permissions = ['CANDIDATE_VIEW'];
      render(
        <MemoryRouter initialEntries={['/import#import-history']}>
          <Routes>
            <Route path="/import" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Read-only import history')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /candidates/i })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /vacancy requests/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /branches/i })).not.toBeInTheDocument();

      await waitFor(() => {
        expect(getApi).toHaveBeenCalledWith('/imports/candidates/jobs?page=1&pageSize=8');
        expect(screen.getByText('candidates_batch_jan.xlsx')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /download template/i })).toBeEnabled();
      expect(screen.getByLabelText(/choose an excel workbook or csv/i, { selector: 'input' })).toBeDisabled();
      expect(screen.getByRole('button', { name: /stage for review/i })).toBeDisabled();
    });

    it.each([
      {
        label: 'candidates create-only',
        permissions: ['CANDIDATE_CREATE'],
        expectedReadPerm: 'CANDIDATE_VIEW',
      },
      {
        label: 'vacancy-requests create-only',
        permissions: ['VACANCY_REQUEST_CREATE'],
        expectedReadPerm: 'VACANCY_REQUEST_VIEW',
      },
      {
        label: 'master-data manage-only',
        permissions: ['MASTER_DATA_MANAGE'],
        expectedReadPerm: 'MASTER_DATA_VIEW',
      },
    ])(
      'prevents $label users from inspecting, uploading, or staging batches and explains that $expectedReadPerm is required',
      async ({ permissions, expectedReadPerm }) => {
        const user = userEvent.setup();
        authState.user.permissions = permissions;
        render(
          <MemoryRouter initialEntries={['/import']}>
            <Routes>
              <Route path="/import" element={<BulkImportPage />} />
            </Routes>
          </MemoryRouter>,
        );

        expect(screen.getByText('Read permission required to complete imports')).toBeInTheDocument();
        expect(screen.getAllByText(new RegExp(expectedReadPerm)).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('History view restricted')).toBeInTheDocument();

        const fileInput = screen.getByLabelText(/choose an excel workbook or csv/i, { selector: 'input' });
        const stageButton = screen.getByRole('button', { name: /stage for review/i });
        const templateButton = screen.getByRole('button', { name: /download template/i });
        const refreshButton = screen.getByRole('button', { name: /refresh/i });

        expect(fileInput).toBeDisabled();
        expect(stageButton).toBeDisabled();
        expect(templateButton).toBeDisabled();
        expect(refreshButton).toBeDisabled();

        const file = new File(['mock content'], 'blocked.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        await user.upload(fileInput, file);

        expect(postFormDataApi).not.toHaveBeenCalled();
        expect(getApi).not.toHaveBeenCalled();
        expect(downloadApi).not.toHaveBeenCalled();
      },
    );
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

    it('supports read-only batch review and legacy ?jobId= URLs, explaining separate CANDIDATE_CREATE and CANDIDATE_EDIT requirements when neither is held', async () => {
      authState.user.permissions = ['CANDIDATE_VIEW'];
      vi.mocked(getApi).mockImplementation((url: string) => {
        if (url.includes('/rows')) {
          return Promise.resolve(mockReviewRows) as unknown as Promise<unknown>;
        }
        if (url.includes('/jobs/job-101')) {
          return Promise.resolve({ ...mockReviewJob, duplicateRows: 0, unresolvedDuplicateRows: 0 }) as unknown as Promise<unknown>;
        }
        return Promise.resolve({}) as unknown as Promise<unknown>;
      });

      render(
        <MemoryRouter initialEntries={['/import?jobId=job-101']}>
          <Routes>
            <Route path="/import" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Review candidates_batch_jan.xlsx')).toBeInTheDocument();
      });

      expect(screen.getByText('Read-only batch view')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Confirming this import requires CANDIDATE_CREATE, and resolving duplicate rows requires CANDIDATE_EDIT\./i,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /error report/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /confirm import/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled();
      expect(postApi).not.toHaveBeenCalled();
    });

    it('supports legacy query-based batch review for vacancy-requests and master-data datasets with matching view permissions and dataset-specific read-only copy', async () => {
      authState.user.permissions = ['VACANCY_REQUEST_VIEW'];
      const { unmount } = render(
        <MemoryRouter initialEntries={['/import?jobId=job-101&dataset=vacancy-requests']}>
          <Routes>
            <Route path="/import" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(getApi).toHaveBeenCalledWith('/imports/vacancy-requests/jobs/job-101');
        expect(screen.getByText('Review candidates_batch_jan.xlsx')).toBeInTheDocument();
      });
      expect(screen.getByText('Read-only batch view')).toBeInTheDocument();
      expect(
        screen.getByText(/Confirming this import and resolving duplicate rows require VACANCY_REQUEST_CREATE\./i),
      ).toBeInTheDocument();
      unmount();

      vi.clearAllMocks();
      authState.user.permissions = ['MASTER_DATA_VIEW'];
      render(
        <MemoryRouter initialEntries={['/import?jobId=job-101&dataset=branches']}>
          <Routes>
            <Route path="/import" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(getApi).toHaveBeenCalledWith('/imports/master-data/branches/jobs/job-101');
        expect(screen.getByText('Review candidates_batch_jan.xlsx')).toBeInTheDocument();
      });
      expect(screen.getByText('Read-only batch view')).toBeInTheDocument();
      expect(
        screen.getByText(/Confirming this import and resolving duplicate rows require MASTER_DATA_MANAGE\./i),
      ).toBeInTheDocument();
    });

    it('explains that CANDIDATE_EDIT is required for unresolved duplicates when user has CANDIDATE_VIEW + CANDIDATE_CREATE, without calling the batch read-only', async () => {
      authState.user.permissions = ['CANDIDATE_VIEW', 'CANDIDATE_CREATE'];
      render(
        <MemoryRouter initialEntries={['/import/candidates/job-101']}>
          <Routes>
            <Route path="/import/:dataset/:jobId" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Review candidates_batch_jan.xlsx')).toBeInTheDocument();
      });

      expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument();
      expect(screen.getByText('Duplicate resolution permission required')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Resolving duplicate rows requires CANDIDATE_EDIT\. You may confirm this import with CANDIDATE_CREATE after all duplicate rows are resolved and if the batch is otherwise eligible\./i,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled();
      expect(screen.getByRole('button', { name: /confirm import/i })).toBeDisabled();
    });

    it('allows confirming a candidate batch with no unresolved duplicates when user has CANDIDATE_VIEW + CANDIDATE_CREATE without CANDIDATE_EDIT, with no read-only notice', async () => {
      const user = userEvent.setup();
      authState.user.permissions = ['CANDIDATE_VIEW', 'CANDIDATE_CREATE'];
      vi.mocked(getApi).mockImplementation((url: string) => {
        if (url.includes('/rows')) {
          return Promise.resolve({ rows: [mockReviewRows.rows[0]], total: 1 }) as unknown as Promise<unknown>;
        }
        if (url.includes('/jobs/job-101')) {
          return Promise.resolve({
            ...mockReviewJob,
            totalRows: 1,
            validRows: 1,
            duplicateRows: 0,
            unresolvedDuplicateRows: 0,
          }) as unknown as Promise<unknown>;
        }
        return Promise.resolve({}) as unknown as Promise<unknown>;
      });

      render(
        <MemoryRouter initialEntries={['/import/candidates/job-101']}>
          <Routes>
            <Route path="/import/:dataset/:jobId" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Review candidates_batch_jan.xlsx')).toBeInTheDocument();
      });

      expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Duplicate resolution permission required')).not.toBeInTheDocument();
      expect(screen.queryByText('Confirmation permission required')).not.toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /confirm import/i });
      expect(confirmButton).toBeEnabled();
      await user.click(confirmButton);

      await waitFor(() => {
        expect(postApi).toHaveBeenCalledWith('/imports/candidates/jobs/job-101/confirm');
      });
    });

    it('allows duplicate row decisions and explains that CANDIDATE_CREATE is required to confirm when user has CANDIDATE_VIEW + CANDIDATE_EDIT without CANDIDATE_CREATE', async () => {
      const user = userEvent.setup();
      authState.user.permissions = ['CANDIDATE_VIEW', 'CANDIDATE_EDIT'];
      vi.mocked(getApi).mockImplementation((url: string) => {
        if (url.includes('/rows')) {
          return Promise.resolve(mockReviewRows) as unknown as Promise<unknown>;
        }
        if (url.includes('/jobs/job-101')) {
          return Promise.resolve({ ...mockReviewJob, duplicateRows: 1, unresolvedDuplicateRows: 0 }) as unknown as Promise<unknown>;
        }
        return Promise.resolve({}) as unknown as Promise<unknown>;
      });

      render(
        <MemoryRouter initialEntries={['/import/candidates/job-101']}>
          <Routes>
            <Route path="/import/:dataset/:jobId" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Review candidates_batch_jan.xlsx')).toBeInTheDocument();
      });

      expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument();
      expect(screen.getByText('Confirmation permission required')).toBeInTheDocument();
      expect(
        screen.getByText(
          /You can inspect validation rows, download the error report, and resolve duplicate rows with CANDIDATE_EDIT\. Confirming this import requires CANDIDATE_CREATE\./i,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm import/i })).toBeDisabled();

      const updateButton = screen.getByRole('button', { name: 'Update' });
      const skipButton = screen.getByRole('button', { name: 'Skip' });
      expect(updateButton).toBeEnabled();
      expect(skipButton).toBeEnabled();

      await user.click(updateButton);
      await waitFor(() => {
        expect(postApi).toHaveBeenCalledWith(
          '/imports/candidates/jobs/job-101/rows/row-2/decision/Update',
        );
      });
    });

    it('enforces dataset-specific read permissions and rejects unauthorized or unsupported datasets without API calls', async () => {
      authState.user.permissions = ['VACANCY_REQUEST_VIEW'];
      const { unmount: unmountUnauthorizedPath } = render(
        <MemoryRouter initialEntries={['/import/candidates/job-101']}>
          <Routes>
            <Route path="/import/:dataset/:jobId" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(getApi).not.toHaveBeenCalled();
      unmountUnauthorizedPath();

      authState.user.permissions = ['CANDIDATE_VIEW'];
      const { unmount: unmountUnauthorizedQuery } = render(
        <MemoryRouter initialEntries={['/import?jobId=job-101&dataset=vacancy-requests']}>
          <Routes>
            <Route path="/import" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(getApi).not.toHaveBeenCalled();
      unmountUnauthorizedQuery();

      const { unmount: unmountUnsupportedPath } = render(
        <MemoryRouter initialEntries={['/import/legal-entities/job-101']}>
          <Routes>
            <Route path="/import/:dataset/:jobId" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Unsupported import dataset')).toBeInTheDocument();
      expect(getApi).not.toHaveBeenCalled();
      unmountUnsupportedPath();

      authState.user.roles = [{ id: 'r1', name: 'ADMINISTRATOR', code: 'ADMINISTRATOR' }];
      const { unmount: unmountUnsupportedQuery } = render(
        <MemoryRouter initialEntries={['/import?jobId=job-101&dataset=legal-entities']}>
          <Routes>
            <Route path="/import" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Unsupported import dataset')).toBeInTheDocument();
      expect(getApi).not.toHaveBeenCalled();
      unmountUnsupportedQuery();

      render(
        <MemoryRouter initialEntries={['/import?jobId=&dataset=candidates']}>
          <Routes>
            <Route path="/import" element={<BulkImportPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Import batch not found')).toBeInTheDocument();
      expect(getApi).not.toHaveBeenCalled();
    });
  });
});
