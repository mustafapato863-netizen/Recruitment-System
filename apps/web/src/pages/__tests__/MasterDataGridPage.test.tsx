import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MasterDataGridPage } from '../MasterDataGridPage';
import { deleteApi, downloadApi, fetchApi, postFormDataApi } from '../../api/client';
import { saveBlob } from '../../utils/download';

vi.mock('../../api/client', () => ({
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  fetchApi: vi.fn(),
  deleteApi: vi.fn(),
  downloadApi: vi.fn(),
  postFormDataApi: vi.fn(),
}));

vi.mock('../../utils/download', () => ({ saveBlob: vi.fn() }));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-admin',
      organizationId: 'org-1',
      permissions: ['MASTER_DATA_VIEW', 'MASTER_DATA_MANAGE'],
    },
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/master-data']}>
      <Routes>
        <Route path="/master-data" element={<MasterDataGridPage />} />
        <Route path="/import/:dataset/:jobId" element={<div>Import review route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MasterDataGridPage Excel actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchApi).mockResolvedValue([]);
    vi.mocked(downloadApi).mockResolvedValue(new Blob(['xlsx']));
  });

  it('downloads the template for the active Master Data tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /download template/i }));

    await waitFor(() => {
      expect(downloadApi).toHaveBeenCalledWith('/imports/master-data/branches/template');
      expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'recruitflow-branches-template.xlsx');
    });
  });

  it('inspects and stages an uploaded workbook from Master Data', async () => {
    const user = userEvent.setup();
    vi.mocked(postFormDataApi).mockImplementation((path: string) => {
      if (path.endsWith('/inspect')) {
        return Promise.resolve({
          fileName: 'branches.xlsx',
          fileSize: 1200,
          dataset: 'branches',
          requiredColumns: ['Name'],
          optionalColumns: ['Code', 'Country', 'City', 'Status'],
          warnings: [],
          sheets: [{ name: 'Branches', headers: ['Code', 'Name', 'Country', 'City', 'Status'], rowCount: 2 }],
        });
      }
      return Promise.resolve({ jobId: 'job-123' });
    });
    renderPage();

    const file = new File(['workbook'], 'branches.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await user.upload(screen.getByLabelText(/upload branches workbook/i), file);

    await waitFor(() => expect(screen.getByText('branches.xlsx')).toBeInTheDocument());
    expect(postFormDataApi).toHaveBeenCalledWith('/imports/master-data/branches/inspect', expect.any(FormData));

    await user.click(screen.getByRole('button', { name: /review import/i }));

    await waitFor(() => {
      expect(postFormDataApi).toHaveBeenCalledWith('/imports/master-data/branches/upload?sheetName=Branches', expect.any(FormData));
      expect(screen.getByText('Import review route')).toBeInTheDocument();
    });
  });

  it('removes a new unsaved row without calling the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /add row/i }));
    expect(screen.getByRole('button', { name: /remove unsaved row/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove unsaved row/i }));

    expect(screen.queryByRole('button', { name: /remove unsaved row/i })).not.toBeInTheDocument();
    expect(deleteApi).not.toHaveBeenCalled();
  });

  it('confirms deletion of a saved row and uses the legacy branch endpoint', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchApi).mockImplementation((path: string) => {
      if (path === '/master-data/catalog/branches') {
        return Promise.resolve([{
          id: 'branch-1', organizationId: 'org-1', category: 'branches', code: 'BR-1', name: 'Cairo',
          country: 'EGY', city: 'Cairo', status: 'Active', version: 1,
        }]);
      }
      return Promise.resolve([]);
    });
    vi.mocked(deleteApi).mockResolvedValue({ deleted: true });
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Cairo' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Delete Cairo' }));
    expect(screen.getAllByText('Delete Master Data row')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Delete row' }));

    await waitFor(() => expect(deleteApi).toHaveBeenCalledWith('/branches/branch-1'));
    expect(screen.queryByRole('button', { name: 'Delete Cairo' })).not.toBeInTheDocument();
  });
});
