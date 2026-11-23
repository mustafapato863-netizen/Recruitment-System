import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CVBankPage } from '../CVBankPage';

const toastShow = vi.fn();
const permissionState = vi.hoisted(() => ({
  permissions: ['CANDIDATE_VIEW', 'CANDIDATE_CREATE', 'CANDIDATE_EDIT', 'DOWNLOAD_DOCUMENTS'],
}));

vi.mock('../../components/ui/ToastContext', () => ({
  useToast: () => ({ show: toastShow }),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u-rec',
      displayName: 'Sarah Ahmed',
      email: 'sarah@sgh.test',
      seat: 'employee',
      roles: [{ code: 'RECRUITER', name: 'Recruiter' }],
      permissions: permissionState.permissions,
    },
    isLoading: false,
  }),
}));

const api = vi.hoisted(() => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
  patchApi: vi.fn(),
  postFormDataApi: vi.fn(),
  downloadApi: vi.fn(),
}));

vi.mock('../../api/client', async () => ({
  ...(await vi.importActual<object>('../../api/client')),
  ...api,
}));

function Loc() {
  const location = useLocation();
  return <output data-testid="loc" hidden>{location.pathname + location.search}</output>;
}

function renderCvBank(initialPath = '/cv-bank') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/cv-bank" element={<><CVBankPage /><Loc /></>} />
        <Route path="/candidates/:candidateId" element={<p>Candidate profile</p>} />
        <Route path="/import" element={<><p>Bulk import screen</p><Loc /></>} />
        <Route path="/import/:dataset/:jobId" element={<><p>Job bulk import screen</p><Loc /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CVBankPage uploader and intake recovery', () => {
  let storedDocs: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    permissionState.permissions = ['CANDIDATE_VIEW', 'CANDIDATE_CREATE', 'CANDIDATE_EDIT', 'DOWNLOAD_DOCUMENTS'];
    toastShow.mockReset();
    api.getApi.mockReset();
    api.postApi.mockReset();
    api.patchApi.mockReset();
    api.postFormDataApi.mockReset();
    api.downloadApi.mockReset();

    storedDocs = [
      {
        id: 'doc-initial',
        candidateId: 'cand-1',
        candidateName: 'Mariam Essam',
        documentType: 'CV',
        fileName: 'mariam-essam-cv.pdf',
        fileSize: 102400,
        mimeType: 'application/pdf',
        scanStatus: 'Clean',
        consentStatus: 'Granted',
        hasFile: true,
        createdAt: '2026-10-30T09:00:00.000Z',
        updatedAt: '2026-10-30T09:00:00.000Z',
      },
    ];

    api.getApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/documents/cv-bank/backup-status')) {
        return {
          totalDocuments: storedDocs.length,
          storedFiles: storedDocs.filter((d) => d.hasFile).length,
          pendingFiles: 0,
          metadataOnly: 0,
        };
      }
      if (path.startsWith('/documents/cv-bank')) {
        return {
          data: [...storedDocs],
          total: storedDocs.length,
          page: 1,
          pageSize: 25,
        };
      }
      if (path.startsWith('/candidates')) {
        return { data: [], total: 0, page: 1, pageSize: 100 };
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it('shows CV records but hides upload actions from view-only users', async () => {
    permissionState.permissions = ['CANDIDATE_VIEW'];
    renderCvBank();
    expect(await screen.findByRole('heading', { name: 'CV Bank' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload CVs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bulk upload' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Upload CV files')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
  });

  it('allows a document editor to attach a CV to an existing candidate without advertising new-candidate import', async () => {
    permissionState.permissions = ['CANDIDATE_VIEW', 'CANDIDATE_EDIT'];
    renderCvBank('/cv-bank?candidateId=cand-1');
    expect(await screen.findByRole('button', { name: 'Upload CVs' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bulk upload' })).not.toBeInTheDocument();
  });

  it('archives a CV only after an editor supplies an audit reason and confirms', async () => {
    const user = userEvent.setup();
    api.postApi.mockImplementation(async (path: string) => {
      if (path === '/documents/doc-initial/archive') {
        storedDocs = [];
        return { status: 'Archived' };
      }
      return {};
    });
    renderCvBank();
    const actions = await screen.findByRole('button', { name: 'More actions for Mariam Essam' });
    await user.click(actions);
    await user.click(within(screen.getByRole('menu', { name: 'Actions for Mariam Essam' })).getByRole('menuitem', { name: 'Archive CV' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/audited and reversible/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Archive CV' })).toBeDisabled();
    expect(api.postApi).not.toHaveBeenCalled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason for archiving' }), 'Outdated CV replaced');
    await user.click(within(dialog).getByRole('button', { name: 'Archive CV' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith(
      '/documents/doc-initial/archive', { reason: 'Outdated CV replaced' },
    ));
    expect(toastShow).toHaveBeenCalledWith(expect.objectContaining({ title: 'CV archived', tone: 'success' }));
  });

  it('does not offer archive or upload to viewers without candidate editing rights', async () => {
    const user = userEvent.setup();
    permissionState.permissions = ['CANDIDATE_VIEW'];
    renderCvBank();
    const actions = await screen.findByRole('button', { name: 'More actions for Mariam Essam' });
    await user.click(actions);
    expect(within(screen.getByRole('menu', { name: 'Actions for Mariam Essam' })).queryByRole('menuitem', { name: 'Archive CV' })).not.toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
  });

  it('parses, creates candidate, attaches to scoped job, uploads CV binary, and reads back into the CV Bank list', async () => {
    const user = userEvent.setup();

    api.postFormDataApi.mockImplementation(async (path: string) => {
      if (path === '/resume/parse') {
        return {
          firstName: 'Yousef',
          lastName: 'Magdy',
          email: 'yousef.magdy@sgh.test',
          phone: '+971501234567',
          title: 'Radiology Technician',
          experienceYears: 5,
          skills: ['PACS', 'MRI'],
          rawText: 'Yousef Magdy Radiology Technician PACS MRI',
        };
      }
      if (path === '/documents/upload') {
        const createdDoc = {
          id: 'doc-yousef',
          candidateId: 'cand-yousef',
          candidateName: 'Yousef Magdy',
          documentType: 'CV',
          fileName: 'yousef-magdy-cv.pdf',
          fileSize: 204800,
          mimeType: 'application/pdf',
          scanStatus: 'Clean',
          consentStatus: 'Granted',
          hasFile: true,
          createdAt: '2026-10-31T12:00:00.000Z',
          updatedAt: '2026-10-31T12:00:00.000Z',
        };
        storedDocs = [createdDoc, ...storedDocs];
        return createdDoc;
      }
      throw new Error(`Unexpected multipart POST ${path}`);
    });

    api.postApi.mockImplementation(async (path: string, body: unknown) => {
      if (path === '/candidates/duplicate-check') {
        return { normalized: { email: 'yousef.magdy@sgh.test', phone: '+971501234567' }, isDuplicate: false, matches: [] };
      }
      if (path === '/candidates') {
        return { id: 'cand-yousef', ...(body as object) };
      }
      if (path === '/applications') {
        return { id: 'app-yousef', ...(body as object) };
      }
      throw new Error(`Unexpected POST ${path}`);
    });

    renderCvBank('/cv-bank?job=job-rad-1');

    expect(await screen.findByText('Mariam Essam')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bulk upload/i })).toBeInTheDocument();

    const fileInput = screen.getByLabelText('Upload CV files') as HTMLInputElement;
    const syntheticCv = new File(['%PDF-1.4 synthetic cv content'], 'yousef-magdy-cv.pdf', { type: 'application/pdf' });

    await user.upload(fileInput, syntheticCv);

    expect(await screen.findByText('Yousef Magdy')).toBeInTheDocument();
    expect(screen.getByText('yousef-magdy-cv.pdf')).toBeInTheDocument();

    expect(api.postFormDataApi).toHaveBeenCalledWith('/resume/parse', expect.any(FormData));
    expect(api.postApi).toHaveBeenCalledWith('/candidates/duplicate-check', {
      email: 'yousef.magdy@sgh.test',
      phone: '+971501234567',
    });
    expect(api.postApi).toHaveBeenCalledWith('/candidates', expect.objectContaining({
      firstName: 'Yousef',
      lastName: 'Magdy',
      email: 'yousef.magdy@sgh.test',
      source: 'CV import',
    }));
    expect(api.postApi).toHaveBeenCalledWith('/applications', {
      vacancyId: 'job-rad-1',
      candidateId: 'cand-yousef',
      source: 'CV import',
    });
    expect(api.postFormDataApi).toHaveBeenCalledWith('/documents/upload', expect.any(FormData));
    expect(toastShow).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'success',
      title: 'CV uploaded and parsed',
    }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/cv-bank?job=job-rad-1');
  });

  it('surfaces upload failures explicitly without showing a fake success toast', async () => {
    const user = userEvent.setup();
    api.postFormDataApi.mockRejectedValueOnce(new Error('Resume parser service unavailable.'));

    renderCvBank('/cv-bank');
    expect(await screen.findByText('Mariam Essam')).toBeInTheDocument();

    const fileInput = screen.getByLabelText('Upload CV files') as HTMLInputElement;
    const syntheticCv = new File(['%PDF-1.4 broken'], 'broken-cv.pdf', { type: 'application/pdf' });

    await user.upload(fileInput, syntheticCv);

    await waitFor(() => {
      expect(toastShow).toHaveBeenCalledWith(expect.objectContaining({
        tone: 'error',
        title: 'CV upload failed',
      }));
    });
    expect(screen.getByText(/broken-cv\.pdf: Resume parser service unavailable\./i)).toBeInTheDocument();
  });

  it('restores Bulk upload button and preserves job and returnTo context on navigation', async () => {
    const user = userEvent.setup();
    renderCvBank('/cv-bank?job=job-icu-2');

    expect(await screen.findByText('Mariam Essam')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Bulk upload/i }));

    expect(await screen.findByText('Job bulk import screen')).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent('/import/candidates/job-icu-2?returnTo=%2Fcv-bank%3Fjob%3Djob-icu-2');
  });
});

function doc(partial: Record<string, unknown>) {
  return {
    documentType: 'CV',
    fileSize: 1024,
    mimeType: 'application/pdf',
    consentStatus: 'Granted',
    hasFile: true,
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    ...partial,
  };
}

function person(partial: Record<string, unknown>) {
  return {
    email: null,
    phone: null,
    currentTitle: null,
    location: null,
    skills: [],
    status: 'Active',
    candidateCode: partial.id,
    metadata: {},
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    ...partial,
  };
}

function recordRow(name: string) {
  const link = screen.getByRole('link', { name });
  const row = link.closest('tr');
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

describe('CV Bank truthful records', () => {
  beforeEach(() => {
    toastShow.mockReset();
    api.getApi.mockReset();
    api.postApi.mockReset();
    api.patchApi.mockReset();
    api.downloadApi.mockReset();
    api.postApi.mockResolvedValue({ candidateId: 'cand-1', found: [] });
    api.patchApi.mockResolvedValue({});
    api.downloadApi.mockRejectedValue(new Error('blob download should not run when a signed URL is returned'));
  });

  function mockBank(documents: Array<Record<string, unknown>>, people: Array<Record<string, unknown>>) {
    api.getApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/documents/cv-bank/backup-status')) {
        return {
          totalDocuments: documents.length,
          storedFiles: documents.filter((item) => item.hasFile && item.scanStatus === 'Clean').length,
          pendingFiles: 9,
          metadataOnly: 0,
        };
      }
      if (path.includes('/download')) {
        return { downloadUrl: 'https://files.example/cv.pdf' };
      }
      if (path.startsWith('/documents/cv-bank')) {
        return { data: documents, total: documents.length, page: 1, pageSize: 100 };
      }
      if (path.startsWith('/candidates')) {
        return { data: people, total: people.length, page: 1, pageSize: 100 };
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  }

  it('separates scan state from extraction and does not offer a local delete', async () => {
    const user = userEvent.setup();
    mockBank(
      [
        doc({ id: 'doc-mariam', candidateId: 'cand-1', candidateName: 'Mariam Essam', fileName: 'mariam.pdf', scanStatus: 'Clean' }),
        doc({ id: 'doc-nabil', candidateId: 'cand-2', candidateName: 'Nabil Adel', fileName: 'nabil.pdf', scanStatus: 'Pending' }),
        doc({ id: 'doc-omar', candidateId: 'cand-3', candidateName: 'Omar Said', fileName: 'omar.pdf', scanStatus: 'Quarantined', hasFile: false }),
        doc({ id: 'doc-lina', candidateId: 'cand-4', candidateName: 'Lina Mostafa', fileName: 'lina.pdf', scanStatus: 'Clean' }),
        doc({ id: 'doc-hana', candidateId: 'cand-5', candidateName: 'Hana Saleh', fileName: 'hana.pdf', scanStatus: 'Clean' }),
      ],
      [
        person({ id: 'cand-1', firstName: 'Mariam', lastName: 'Essam', currentTitle: 'Nurse', skills: ['ICU'], email: 'mariam@sgh.test', phone: '+971500000001', location: 'Dubai' }),
        person({ id: 'cand-2', firstName: 'Nabil', lastName: 'Adel', currentTitle: 'Technician', skills: ['Lab'] }),
        person({ id: 'cand-3', firstName: 'Omar', lastName: 'Said', currentTitle: 'Analyst', skills: ['Excel'] }),
        person({ id: 'cand-4', firstName: 'Lina', lastName: 'Mostafa' }),
        person({ id: 'cand-5', firstName: 'Hana', lastName: 'Saleh', currentTitle: 'Pharmacist', skills: ['Dispensing'], metadata: { cvExtractionStatus: 'Failed' } }),
        person({ id: 'cand-6', firstName: 'Sara', lastName: 'Nasser' }),
      ],
    );

    renderCvBank();
    expect(await screen.findByRole('link', { name: 'Mariam Essam' })).toBeInTheDocument();

    expect(recordRow('Mariam Essam')).toHaveTextContent('Parsed');
    expect(recordRow('Mariam Essam')).toHaveTextContent('Stored');
    expect(recordRow('Nabil Adel')).toHaveTextContent('Pending');
    expect(recordRow('Nabil Adel')).toHaveTextContent('Scanning');
    expect(recordRow('Omar Said')).toHaveTextContent('Failed');
    expect(recordRow('Omar Said')).toHaveTextContent('Quarantined');
    expect(recordRow('Lina Mostafa')).toHaveTextContent('Needs review');
    expect(recordRow('Lina Mostafa')).toHaveTextContent('Stored');
    expect(recordRow('Hana Saleh')).toHaveTextContent('Failed');
    expect(recordRow('Hana Saleh')).toHaveTextContent('Stored');
    expect(recordRow('Sara Nasser')).toHaveTextContent('Needs review');
    expect(recordRow('Sara Nasser')).toHaveTextContent('No file');

    const pendingCard = screen.getByText('Pending review').closest('.rf2-cvb__kpi');
    expect(pendingCard).not.toBeNull();
    expect(pendingCard).toHaveTextContent('3');

    await user.click(screen.getByRole('button', { name: 'More actions for Mariam Essam' }));
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete record' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Review parsed details' })).toBeInTheDocument();
    expect(toastShow).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/removed/i) }));

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'Needs review');
    expect(screen.getByRole('link', { name: 'Lina Mostafa' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sara Nasser' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mariam Essam' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Needs review' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Failed' })).toBeInTheDocument();
  });

  it('previews a stored CV, saves reviewed fields, and retries extraction', async () => {
    const user = userEvent.setup();
    mockBank(
      [doc({ id: 'doc-mariam', candidateId: 'cand-1', candidateName: 'Mariam Essam', fileName: 'mariam.pdf', scanStatus: 'Clean' })],
      [person({ id: 'cand-1', firstName: 'Mariam', lastName: 'Essam', currentTitle: 'Nurse', skills: ['ICU'], email: 'mariam@sgh.test', phone: '+971500000001', location: 'Dubai' })],
    );
    renderCvBank();
    await user.click(await screen.findByRole('button', { name: 'View CV' }));

    const dialog = await screen.findByRole('dialog', { name: /CV review — Mariam Essam/ });
    expect(await within(dialog).findByTitle('CV preview for Mariam Essam')).toHaveAttribute('src', 'https://files.example/cv.pdf');
    expect(within(dialog).getByRole('link', { name: 'Open / Download CV file' })).toHaveAttribute('href', 'https://files.example/cv.pdf');
    expect(api.getApi).toHaveBeenCalledWith('/documents/doc-mariam/download');

    const title = within(dialog).getByLabelText('Current title');
    await user.clear(title);
    await user.type(title, 'Senior Nurse');
    await user.click(within(dialog).getByRole('button', { name: 'Save reviewed details' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/candidates/cand-1', {
      firstName: 'Mariam',
      lastName: 'Essam',
      email: 'mariam@sgh.test',
      phone: '+971500000001',
      currentTitle: 'Senior Nurse',
      location: 'Dubai',
      skills: ['ICU'],
    }));
    expect(toastShow).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success', title: 'Reviewed details saved' }));

    await user.click(within(dialog).getByRole('button', { name: 'Retry extraction' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/candidates/cand-1/skills/derive-evidence', {}));

    await user.click(within(dialog).getByRole('button', { name: 'Open full candidate profile' }));
    expect(await screen.findByText('Candidate profile')).toBeInTheDocument();
  });

  it('explains a missing preview and skips the download call for a candidate without a file', async () => {
    const user = userEvent.setup();
    mockBank([], [person({ id: 'cand-6', firstName: 'Sara', lastName: 'Nasser' })]);
    renderCvBank();
    await user.click(await screen.findByRole('button', { name: 'View CV' }));
    expect(await screen.findByText('No CV file is stored for this candidate.')).toBeInTheDocument();
    expect(api.getApi).not.toHaveBeenCalledWith(expect.stringContaining('/download'));
    expect(screen.getByRole('button', { name: 'Retry extraction' })).toBeInTheDocument();
  });

  it('shows the real page offset in the record footer', async () => {
    const user = userEvent.setup();
    const documents = Array.from({ length: 30 }, (_, index) => {
      const n = String(index + 1).padStart(2, '0');
      return doc({
        id: `doc-${n}`,
        candidateId: `cand-${n}`,
        candidateName: `Candidate ${n}`,
        fileName: `cv-${n}.pdf`,
        scanStatus: 'Clean',
      });
    });
    mockBank(documents, []);
    renderCvBank();
    expect(await screen.findByText('Showing 1–25 of 30 candidates')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Candidate 01' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Candidate 26' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Showing 26–30 of 30 candidates')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Candidate 26' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Candidate 01' })).not.toBeInTheDocument();
  });

  it('shows ATS extracted keywords, duplicate verification, and best-fit open positions with keyword reasons after upload', async () => {
    const user = userEvent.setup();
    const seededDoc = doc({
      id: 'doc-1',
      candidateId: 'cand-1',
      candidateName: 'Mariam Essam',
      fileName: 'mariam-cv.pdf',
      scanStatus: 'Clean',
    });
    const seededPerson = person({
      id: 'cand-1',
      firstName: 'Mariam',
      lastName: 'Essam',
      currentTitle: 'Senior ICU Nurse',
      skills: ['ICU', 'ACLS'],
      email: 'mariam@sgh.test',
      phone: '+971500000001',
    });
    api.getApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/candidates/cand-1/job-recommendations')) {
        return [
          {
            vacancyId: 'vac-icu-1',
            vacancyCode: 'VAC-ICU-01',
            title: 'Senior ICU Nurse',
            department: 'Critical Care',
            branchName: 'Cairo Hospital',
            atsScore: 92,
            mustHaveMatched: true,
            matchedSkillsCount: 2,
            totalRequiredSkillsCount: 2,
            alreadyApplied: false,
            matchedKeywords: ['ICU', 'ACLS'],
            missingKeywords: [],
            fitReasons: ['Matched main keywords: ICU, ACLS'],
          },
        ];
      }
      if (path.startsWith('/documents/cv-bank/backup-status')) {
        return { storedFiles: 1, totalDocuments: 1, quarantinedFiles: 0, pendingFiles: 0, lastBackupAt: '2026-10-31T10:00:00.000Z', retentionPolicyDays: 365 };
      }
      if (path.startsWith('/documents/cv-bank')) {
        return { data: [seededDoc], total: 1, page: 1, pageSize: 100 };
      }
      if (path.startsWith('/candidates')) {
        return { data: [seededPerson], total: 1, page: 1, pageSize: 100 };
      }
      throw new Error(`Unexpected GET ${path}`);
    });
    api.postFormDataApi.mockImplementation(async (path: string) => {
      if (path === '/resume/parse') {
        return {
          firstName: 'Mariam',
          lastName: 'Essam',
          email: 'mariam@sgh.test',
          phone: '+971500000001',
          title: 'Senior ICU Nurse',
          clinicalDomain: 'Critical Care',
          experienceYears: 6,
          skills: ['ICU', 'ACLS'],
          parsingQuality: 'high',
          parserSource: 'affinda',
          rawText: 'Mariam Essam Senior ICU Nurse ICU ACLS',
        };
      }
      if (path === '/documents/upload') {
        return seededDoc;
      }
      throw new Error(`Unexpected multipart POST ${path}`);
    });
    api.postApi.mockImplementation(async (path: string) => {
      if (path === '/candidates/duplicate-check') {
        return {
          normalized: { email: 'mariam@sgh.test', phone: '+971500000001' },
          isDuplicate: true,
          matches: [{ candidateId: 'cand-1', candidateCode: 'CAN-001', name: 'Mariam Essam', status: 'Active', matchedBy: ['email'] }],
        };
      }
      if (path === '/candidates/cand-1/fill-from-cv') {
        return { filled: ['skills'], conflicts: [], compared: true };
      }
      throw new Error(`Unexpected POST ${path}`);
    });

    renderCvBank();
    expect(await screen.findByText('Mariam Essam')).toBeInTheDocument();

    const fileInput = screen.getByLabelText('Upload CV files') as HTMLInputElement;
    await user.upload(fileInput, new File(['%PDF-1.4 cv'], 'mariam-cv.pdf', { type: 'application/pdf' }));

    const report = await screen.findByRole('region', { name: 'ATS CV extraction and job fit results' });
    expect(within(report).getByText(/Duplicate verified/i)).toBeInTheDocument();
    expect(within(report).getByText(/CAN-001/)).toBeInTheDocument();
    expect(within(report).getByText('Senior ICU Nurse')).toBeInTheDocument();
    expect(within(report).getByText('92% Match')).toBeInTheDocument();
    expect(within(report).getByText('Matched main keywords: ICU, ACLS')).toBeInTheDocument();
  });
});

