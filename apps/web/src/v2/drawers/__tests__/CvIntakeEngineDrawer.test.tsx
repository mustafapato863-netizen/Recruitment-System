import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CvIntakeEngineDrawer } from '../CvIntakeEngineDrawer';

const api = vi.hoisted(() => ({
  getApi: vi.fn(),
  postApi: vi.fn(),
  postFormDataApi: vi.fn(),
}));

vi.mock('../../../api/client', async () => ({
  ...(await vi.importActual<object>('../../../api/client')),
  ...api,
}));

const OPEN_VACANCIES = [
  {
    id: 'vac-icu',
    vacancyCode: 'VAC-ICU-01',
    status: 'Open',
    department: 'Critical Care',
    position: { id: 'p1', title: 'Senior ICU Nurse' },
    branch: { id: 'b1', name: 'SGH Dubai Hospital' },
    requiredSkills: ['ICU', 'ACLS', 'Ventilator Management'],
    minExperienceYears: 4,
    qualifications: 'BSN ICU Critical Care',
  },
  {
    id: 'vac-fin',
    vacancyCode: 'VAC-FIN-02',
    status: 'Open',
    department: 'Finance',
    position: { id: 'p2', title: 'Senior Accountant' },
    branch: { id: 'b1', name: 'SGH Dubai Hospital' },
    requiredSkills: ['IFRS', 'Auditing', 'Taxation'],
    minExperienceYears: 5,
    qualifications: 'CPA Accounting',
  },
];

function renderDrawer(props?: Partial<React.ComponentProps<typeof CvIntakeEngineDrawer>>) {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(
    <MemoryRouter>
      <CvIntakeEngineDrawer
        open
        onClose={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('CvIntakeEngineDrawer (4-Step CV Intake & Job Fit Engine)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/vacancies')) return { data: OPEN_VACANCIES };
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it('detects data, validates missing contact, recalculates open-job fit when skills change, checks duplicates, and applies to recommended job', async () => {
    const user = userEvent.setup();
    const onCompleted = vi.fn();

    api.postFormDataApi.mockImplementation(async (path: string) => {
      if (path === '/resume/parse') {
        return {
          firstName: 'Nadia',
          lastName: 'Kamel',
          email: '',
          phone: '',
          title: 'ICU Staff Nurse',
          currentCompany: 'Cairo Medical Center',
          experienceYears: 6,
          location: 'Dubai',
          clinicalDomain: 'Critical Care',
          skills: ['ICU', 'ACLS'],
          certifications: ['ACLS'],
          rawText: 'Nadia Kamel ICU Staff Nurse 6 years Critical Care ACLS',
          parsingQuality: 'high',
          parserSource: 'affinda',
        };
      }
      if (path === '/documents/upload') {
        return { id: 'doc-nadia' };
      }
      throw new Error(`Unexpected multipart POST ${path}`);
    });

    api.postApi.mockImplementation(async (path: string, body: unknown) => {
      if (path === '/candidates/duplicate-check') {
        return { normalized: { email: 'nadia.kamel@sgh.test', phone: null }, isDuplicate: false, matches: [] };
      }
      if (path === '/candidates') {
        return { id: 'cand-nadia', candidateCode: 'CAN-901', ...(body as object) };
      }
      if (path === '/applications') {
        return { id: 'app-nadia', ...(body as object) };
      }
      throw new Error(`Unexpected POST ${path}`);
    });

    renderDrawer({ onCompleted });

    // Step 1: Upload CV
    const fileInput = screen.getByLabelText('Choose CV file for intake engine') as HTMLInputElement;
    const cvFile = new File(['%PDF-1.4 nadia cv'], 'nadia-kamel-cv.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, cvFile);

    // Step 2: Validate & Edit
    expect(await screen.findByRole('heading', { name: 'Validate & Edit Detected Data' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nadia')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kamel')).toBeInTheDocument();
    expect(screen.getByText('Email or Phone required')).toBeInTheDocument();

    // Validation blocks proceeding without email or phone
    await user.click(screen.getByRole('button', { name: /Validate & View Job Fit/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid Email address or Phone number/i);

    // Add missing email + add an extra skill to boost match for Senior ICU Nurse
    await user.type(screen.getByLabelText('Email'), 'nadia.kamel@sgh.test');
    const addSkillInput = screen.getByLabelText('Add skill');
    await user.type(addSkillInput, 'Ventilator Management');
    await user.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    expect(screen.getByText('Ventilator Management')).toBeInTheDocument();

    // Proceed to Step 3: Duplicate Check & Open-Job Recommendations
    await user.click(screen.getByRole('button', { name: /Validate & View Job Fit/i }));
    expect(await screen.findByRole('heading', { name: 'Duplicate Check & Open-Job Recommendations' })).toBeInTheDocument();

    await waitFor(() => {
      expect(api.postApi).toHaveBeenCalledWith('/candidates/duplicate-check', { email: 'nadia.kamel@sgh.test' });
    });
    expect(await screen.findByText('Verified unique')).toBeInTheDocument();

    // Senior ICU Nurse is ranked #1 and recommended ahead of Senior Accountant
    const recGroup = screen.getByRole('radiogroup', { name: 'Choose open job or CV bank' });
    const items = within(recGroup).getAllByRole('radio');
    expect(items[0]).toBeChecked(); // Auto-selected top matching job (Senior ICU Nurse)
    expect(within(recGroup).getByText('Senior ICU Nurse')).toBeInTheDocument();
    expect(within(recGroup).getByText('Recommended')).toBeInTheDocument();
    expect(within(recGroup).getByText('✓ Ventilator Management')).toBeInTheDocument();

    // Confirm & Apply
    await user.click(screen.getByRole('button', { name: /Confirm & Apply to Senior ICU Nurse/i }));

    // Step 4: Confirmed
    expect(await screen.findByRole('heading', { name: 'Candidate Saved & Assigned' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Candidate Profile/i })).toHaveAttribute('href', '/candidates/cand-nadia');
    expect(screen.getByRole('link', { name: /Open Application File/i })).toHaveAttribute('href', '/applications/app-nadia');

    expect(api.postApi).toHaveBeenCalledWith('/candidates', expect.objectContaining({
      firstName: 'Nadia',
      lastName: 'Kamel',
      email: 'nadia.kamel@sgh.test',
      skills: ['ICU', 'ACLS', 'Ventilator Management'],
    }));
    expect(api.postApi).toHaveBeenCalledWith('/applications', {
      vacancyId: 'vac-icu',
      candidateId: 'cand-nadia',
      source: 'CV Intake Upload',
    });
    expect(api.postFormDataApi).toHaveBeenCalledWith('/documents/upload', expect.any(FormData));
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('detects existing duplicate candidate by email and links & enriches instead of creating a second identity', async () => {
    const user = userEvent.setup();

    api.postFormDataApi.mockImplementation(async (path: string) => {
      if (path === '/resume/parse') {
        return {
          firstName: 'Mariam',
          lastName: 'Essam',
          email: 'mariam@sgh.test',
          title: 'ICU Nurse',
          experienceYears: 5,
          skills: ['ICU', 'ACLS'],
          rawText: 'Mariam Essam ICU Nurse ACLS',
          parsingQuality: 'high',
          parserSource: 'legacy',
        };
      }
      if (path === '/documents/upload') return { id: 'doc-dup-1' };
      throw new Error(`Unexpected multipart POST ${path}`);
    });

    api.postApi.mockImplementation(async (path: string) => {
      if (path === '/candidates/duplicate-check') {
        return {
          normalized: { email: 'mariam@sgh.test', phone: null },
          isDuplicate: true,
          matches: [
            { candidateId: 'cand-existing', candidateCode: 'CAN-010', name: 'Mariam Essam', status: 'Active', matchedBy: ['email'] },
          ],
        };
      }
      if (path === '/candidates/cand-existing/fill-from-cv') {
        return { filled: ['skills'], conflicts: [], compared: true };
      }
      throw new Error(`Unexpected POST ${path}`);
    });

    renderDrawer();

    await user.upload(
      screen.getByLabelText('Choose CV file for intake engine'),
      new File(['%PDF-1.4 mariam'], 'mariam.pdf', { type: 'application/pdf' }),
    );
    await screen.findByRole('heading', { name: 'Validate & Edit Detected Data' });
    await user.click(screen.getByRole('button', { name: /Validate & View Job Fit/i }));

    expect(await screen.findByText('Existing match found')).toBeInTheDocument();
    expect(screen.getByText(/CAN-010/)).toBeInTheDocument();

    // Save to CV Bank only
    await user.click(screen.getByLabelText(/Save to CV Bank only/i));
    await user.click(screen.getByRole('button', { name: /Confirm & Save to CV Bank/i }));

    expect(await screen.findByText('Candidate linked & CV stored')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalledWith('/candidates', expect.anything());
    expect(api.postApi).toHaveBeenCalledWith('/candidates/cand-existing/fill-from-cv', expect.objectContaining({ documentId: 'doc-dup-1' }));
  });
});
