import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadCvPageV2 } from '../UploadCvPageV2';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), postFormDataApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', displayName: 'Mariam Farag', roles: [{ code: 'RECRUITER' }] } }),
}));

const jobPayload = {
  id: 'v-icu',
  vacancyCode: 'VAC-2026-099',
  status: 'Open',
  approvedHeadcount: 2,
  joinedHeadcount: 0,
  department: 'Critical Care',
  branch: { id: 'b1', name: 'SGH Riyadh' },
  position: { id: 'p1', title: 'ICU Nurse' },
  requiredSkills: ['ICU Care', 'Ventilator Management'],
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getApi.mockImplementation(async (path: string) => {
    if (path === '/vacancies/v-icu') return structuredClone(jobPayload);
    if (path.startsWith('/applications?')) return { data: [], total: 0 };
    return {};
  });
});

describe('Ticket 10 — Full-page CV Upload (/vacancies/:id/upload-cv)', () => {
  it('shows 4-step pipeline, extracts & edits certifications, handles mixed batch, and saves certifications', async () => {
    const u = userEvent.setup();
    api.postFormDataApi.mockImplementation(async (path: string) => {
      if (path === '/resume/parse') {
        return {
          firstName: 'Laila',
          lastName: 'Nasser',
          email: 'laila@example.com',
          phone: '+966501234567',
          title: 'ICU Nurse',
          experienceYears: 5,
          skills: ['ICU Care'],
          certifications: ['BLS — AHA (2025)'],
          rawText: 'ICU Care BLS AHA 2025',
        };
      }
      if (path === '/documents/upload') return { id: 'doc-1' };
      return {};
    });
    api.postApi.mockImplementation(async (path: string) => {
      if (path === '/candidates/duplicate-check') return { normalized: { email: 'laila@example.com', phone: '+966501234567' }, isDuplicate: false, matches: [] };
      if (path === '/candidates') return { id: 'cand-new' };
      if (path === '/applications') return { id: 'app-new' };
      return {};
    });

    document.documentElement.setAttribute('data-ui', 'v2');
    render(
      <MemoryRouter initialEntries={['/vacancies/v-icu/upload-cv']}>
        <Routes>
          <Route path="/vacancies/:id/upload-cv" element={<UploadCvPageV2 />} />
          <Route path="/vacancies/:id" element={<p>Back on pipeline</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /Upload CVs — ICU Nurse/i })).toBeInTheDocument();
    expect(screen.getByText('1. ATS extraction')).toBeInTheDocument();
    expect(screen.getByText('2. Duplicate check')).toBeInTheDocument();
    expect(screen.getByText('3. Skills match')).toBeInTheDocument();
    expect(screen.getByText('4. Review & add to Applied')).toBeInTheDocument();

    const fileInput = document.getElementById('cv-files') as HTMLInputElement;
    const validFile = new File(['cv bytes'], 'laila.pdf', { type: 'application/pdf' });
    const badFile = new File(['zip'], 'archive.zip', { type: 'application/zip' });
    fireEvent.change(fileInput, { target: { files: [validFile, badFile] } });

    expect(await screen.findByText('BLS — AHA (2025)')).toBeInTheDocument();
    expect(screen.getByText(/Not a PDF or Word file/i)).toBeInTheDocument();

    // Edit and add a certification before commit
    await u.click(screen.getByRole('button', { name: /Edit detected data/i }));
    await u.type(screen.getByLabelText(/^Add certification/i), 'ACLS — 2026');
    await u.click(screen.getByRole('button', { name: 'Add certification' }));
    expect(screen.getAllByText('ACLS — 2026').length).toBeGreaterThan(0);

    await u.click(screen.getByRole('button', { name: /Import 1 to Applied/i }));
    await waitFor(() => {
      expect(api.postApi).toHaveBeenCalledWith(
        '/candidates',
        expect.objectContaining({
          certifications: ['BLS — AHA (2025)', 'ACLS — 2026'],
        }),
      );
    });
  });
});
