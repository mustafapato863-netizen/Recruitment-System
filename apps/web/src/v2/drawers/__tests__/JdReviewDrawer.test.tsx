import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JdCriteriaDefinition, VacancyDocumentItem } from '@recruitflow/contracts';

const atsApi = vi.hoisted(() => ({
  fetchVacancyJd: vi.fn(),
  uploadVacancyJd: vi.fn(),
  updateVacancyCriteria: vi.fn(),
}));

vi.mock('../../api/ats', () => atsApi);

import { JdReviewDrawer } from '../JdReviewDrawer';

describe('JdReviewDrawer', () => {
  const mockCriteria: JdCriteriaDefinition = {
    version: 1,
    isLocked: false,
    lockedAt: null,
    lockedById: null,
    minExperienceYears: 4,
    educationLevels: ['BACHELORS'],
    languages: [{ language: 'English', minProficiency: 'Professional' }],
    workMode: 'On-site',
    mustHaveSkills: [
      { id: 'must-1', name: 'ICU Care' },
      { id: 'must-2', name: 'Emergency Triage' },
    ],
    niceToHaveSkills: [
      { id: 'nice-1', name: 'Arabic' },
    ],
    knockoutRules: [
      {
        id: 'ko-exp',
        field: 'experienceYears',
        operator: 'GTE',
        value: 4,
        failureMessage: 'Requires at least 4 years experience.',
      },
    ],
    weights: { skills: 50, experience: 30, education: 10, languages: 10 },
  };

  const mockDoc: VacancyDocumentItem = {
    id: 'doc-1',
    documentType: 'JOB_DESCRIPTION',
    fileName: 'Senior_ICU_Specialist_JD.pdf',
    fileSize: 1024 * 45,
    mimeType: 'application/pdf',
    parserStatus: 'PARSED',
    createdAt: '2026-11-17T12:00:00Z',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    atsApi.fetchVacancyJd.mockResolvedValue({
      document: mockDoc,
      criteria: mockCriteria,
    });
    atsApi.updateVacancyCriteria.mockImplementation((_id, data) =>
      Promise.resolve({ ...mockCriteria, ...data }),
    );
  });

  it('renders existing JD document details and criteria chips', async () => {
    render(
      <JdReviewDrawer
        vacancyId="vac-100"
        vacancyTitle="Senior ICU Specialist"
        onClose={vi.fn()}
      />,
    );

    // Title & Subtitle
    expect(screen.getByText('Job Description & ATS Calibration')).toBeInTheDocument();
    expect(screen.getByText('Senior ICU Specialist')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Senior_ICU_Specialist_JD.pdf')).toBeInTheDocument();
      expect(screen.getByText('Extracted (PARSED)')).toBeInTheDocument();
    });

    expect(screen.getByText('ICU Care')).toBeInTheDocument();
    expect(screen.getByText('Emergency Triage')).toBeInTheDocument();
    expect(screen.getByText('Arabic')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
  });

  it('allows adding and removing must-have and nice-to-have skills', async () => {
    const user = userEvent.setup();

    render(
      <JdReviewDrawer
        vacancyId="vac-100"
        vacancyTitle="Senior ICU Specialist"
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('ICU Care')).toBeInTheDocument();
    });

    // Add a new must-have skill
    const mustInput = screen.getByPlaceholderText(/Add must-have skill/i);
    await user.type(mustInput, 'Ventilator Management{enter}');

    expect(screen.getByText('Ventilator Management')).toBeInTheDocument();

    // Remove an existing must-have skill
    const removeBtn = screen.getByTitle('Remove ICU Care');
    await user.click(removeBtn);
    expect(screen.queryByText('ICU Care')).not.toBeInTheDocument();

    // Add a new nice-to-have skill
    const niceInput = screen.getByPlaceholderText(/Add nice-to-have skill/i);
    await user.type(niceInput, 'French{enter}');
    expect(screen.getByText('French')).toBeInTheDocument();
  });

  it('saves draft criteria without locking', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(
      <JdReviewDrawer
        vacancyId="vac-100"
        vacancyTitle="Senior ICU Specialist"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Senior_ICU_Specialist_JD.pdf')).toBeInTheDocument();
    });

    const saveDraftBtn = screen.getByRole('button', { name: /Save Draft/i });
    await user.click(saveDraftBtn);

    expect(atsApi.updateVacancyCriteria).toHaveBeenCalledWith(
      'vac-100',
      expect.objectContaining({
        isLocked: false,
        minExperienceYears: 4,
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('locks criteria and triggers close when Lock & Calibrate ATS is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSaved = vi.fn();

    render(
      <JdReviewDrawer
        vacancyId="vac-100"
        vacancyTitle="Senior ICU Specialist"
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Senior_ICU_Specialist_JD.pdf')).toBeInTheDocument();
    });

    const lockBtn = screen.getByRole('button', { name: /Lock & Calibrate ATS/i });
    await user.click(lockBtn);

    expect(atsApi.updateVacancyCriteria).toHaveBeenCalledWith(
      'vac-100',
      expect.objectContaining({
        isLocked: true,
      }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('handles uploading a new JD file and extracts fresh criteria', async () => {
    const user = userEvent.setup();
    atsApi.fetchVacancyJd.mockResolvedValue({
      document: null,
      criteria: null,
    });

    const uploadedDoc: VacancyDocumentItem = {
      id: 'doc-new',
      documentType: 'JOB_DESCRIPTION',
      fileName: 'Uploaded_Nurse_JD.pdf',
      fileSize: 1024 * 20,
      mimeType: 'application/pdf',
      parserStatus: 'PARSED',
      createdAt: '2026-11-17T14:00:00Z',
    };

    const extractedCriteria: JdCriteriaDefinition = {
      ...mockCriteria,
      mustHaveSkills: [{ id: 'must-new', name: 'Critical Care' }],
    };

    atsApi.uploadVacancyJd.mockResolvedValue({
      document: uploadedDoc,
      criteria: extractedCriteria,
    });

    render(
      <JdReviewDrawer
        vacancyId="vac-100"
        vacancyTitle="Senior ICU Specialist"
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Upload Job Description/i)).toBeInTheDocument();
    });

    const file = new File(['dummy content'], 'Uploaded_Nurse_JD.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    expect(atsApi.uploadVacancyJd).toHaveBeenCalledWith('vac-100', file);

    await waitFor(() => {
      expect(screen.getByText('Uploaded_Nurse_JD.pdf')).toBeInTheDocument();
      expect(screen.getByText('Critical Care')).toBeInTheDocument();
    });
  });
});
