import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CandidateDocumentsPage } from '../CandidateDocumentsPage';

const access = vi.hoisted(() => ({ editor: true }));
const api = vi.hoisted(() => ({
  getApi: vi.fn(), postApi: vi.fn(), postFormDataApi: vi.fn(), downloadApi: vi.fn(),
}));
const saveBlob = vi.hoisted(() => vi.fn());

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', roles: [{ code: 'RECRUITER' }],
      permissions: access.editor ? ['CANDIDATE_VIEW', 'CANDIDATE_EDIT'] : ['CANDIDATE_VIEW'] },
  }),
}));
vi.mock('../../api/client', async () => ({ ...(await vi.importActual<object>('../../api/client')), ...api }));
vi.mock('../../utils/download', () => ({ saveBlob }));

const person = { id: 'c1', firstName: 'Mariam', lastName: 'Essam', currentTitle: 'Recruiter', candidateCode: 'C-1' };
const doc = {
  id: 'd1', candidateId: 'c1', documentType: 'CV', fileName: 'mariam.pdf', fileSize: 2048,
  createdAt: '2026-11-18T12:00:00Z', scanStatus: 'Clean', hasFile: true,
  consentStatus: 'Granted', retentionExpiresAt: null,
};
function renderPage() {
  return render(<MemoryRouter initialEntries={['/candidates/c1/documents?returnTo=%2Fcandidates%3Ftab%3Dbank']}>
    <Routes><Route path="/candidates/:id/documents" element={<CandidateDocumentsPage />} /></Routes>
  </MemoryRouter>);
}
beforeEach(() => {
  access.editor = true;
  for (const mock of Object.values(api)) mock.mockReset();
  saveBlob.mockReset();
  api.getApi.mockImplementation(async (path: string) => {
    if (path === '/candidates/c1') return person;
    if (path === '/documents/candidate/c1') return [doc];
    throw new Error('Unexpected API call: ' + path);
  });
  api.postFormDataApi.mockResolvedValue({ id: 'd2' });
  api.postApi.mockResolvedValue({});
  api.downloadApi.mockResolvedValue(new Blob(['file'], { type: 'application/pdf' }));
});

describe('native V2 candidate document vault', () => {
  it('shows server-backed files, status, permissions and return navigation', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Document Vault — Mariam Essam' })).toBeInTheDocument();
    expect(screen.getByText('mariam.pdf')).toBeInTheDocument();
    expect(screen.getByText('Clean')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to profile' }).getAttribute('href')).toContain('returnTo=');
    expect(screen.getByRole('button', { name: 'Add document record' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download mariam.pdf' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Archive mariam.pdf' })).toBeInTheDocument();
  });

  it('does not invent a file or metadata-only document and uploads a real binary', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('mariam.pdf');
    await user.click(screen.getByRole('button', { name: 'Add document record' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Document Record' });
    expect(within(dialog).getByRole('button', { name: 'Upload document' })).toBeDisabled();
    expect(api.postFormDataApi).not.toHaveBeenCalled();
    await user.upload(within(dialog).getByLabelText('Document file *'), new File(['real data'], 'new-cv.pdf', { type: 'application/pdf' }));
    expect(within(dialog).getByRole('button', { name: 'Upload document' })).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Upload document' }));
    await waitFor(() => expect(api.postFormDataApi).toHaveBeenCalledWith('/documents/upload', expect.any(FormData)));
    const body = api.postFormDataApi.mock.calls[0][1] as FormData;
    expect(body.get('candidateId')).toBe('c1');
    expect(body.get('documentType')).toBe('CV');
    expect((body.get('file') as File).name).toBe('new-cv.pdf');
    expect(body.has('fileSize')).toBe(false);
    expect(api.postApi).toHaveBeenCalledWith('/candidates/c1/fill-from-cv', { documentId: 'd2' });
  });

  it('protects viewers from upload and archiving while allowing an eligible download', async () => {
    access.editor = false;
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('mariam.pdf');
    expect(screen.queryByRole('button', { name: 'Add document record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive mariam.pdf' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download mariam.pdf' }));
    await waitFor(() => expect(api.downloadApi).toHaveBeenCalledWith('/documents/d1/download'));
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'mariam.pdf');
  });

  it('does not offer downloads when scan, consent or file status forbids it', async () => {
    api.getApi.mockImplementation(async (path: string) => path === '/candidates/c1' ? person : [
      { ...doc, scanStatus: 'Quarantined' },
      { ...doc, id: 'd2', fileName: 'withdrawn.pdf', consentStatus: 'Withdrawn' },
      { ...doc, id: 'd3', fileName: 'missing.pdf', hasFile: false },
    ]);
    renderPage();
    await screen.findByText('withdrawn.pdf');
    expect(screen.getByRole('button', { name: 'Download mariam.pdf' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download withdrawn.pdf' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download missing.pdf' })).toBeDisabled();
    expect(api.downloadApi).not.toHaveBeenCalled();
  });

  it('requires an audit reason to archive and never permanently deletes files', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('mariam.pdf');
    await user.click(screen.getByRole('button', { name: 'Archive mariam.pdf' }));
    const dialog = screen.getByRole('dialog', { name: 'Archive document' });
    expect(within(dialog).getByRole('button', { name: 'Archive document' })).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: /Reason for archiving/ }), 'Newer verified CV received');
    await user.click(within(dialog).getByRole('button', { name: 'Archive document' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/documents/d1/archive', { reason: 'Newer verified CV received' }));
    expect(screen.getByText(/Document archived/)).toBeInTheDocument();
  });

  it('keeps the profile and offers retry if only the documents API fails', async () => {
    let reads = 0;
    api.getApi.mockImplementation(async (path: string) => {
      if (path === '/candidates/c1') return person;
      reads++;
      if (reads === 1) throw new Error('Documents are unavailable.');
      return [doc];
    });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Documents are unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Document Vault — Mariam Essam' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('mariam.pdf')).toBeInTheDocument();
  });
});
