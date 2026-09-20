import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ImportJobDescriptionModal } from '../ImportJobDescriptionModal';
import { patchApi, postApi } from '../../../api/client';
import * as jdParser from '../../../utils/jdParser';

vi.mock('../../../api/client', () => ({
  fetchApi: vi.fn(),
  getApi: vi.fn(),
  postApi: vi.fn(),
  patchApi: vi.fn(),
  downloadApi: vi.fn(),
}));

describe('ImportJobDescriptionModal', () => {
  const mockPostApi = vi.mocked(postApi);
  const mockPatchApi = vi.mocked(patchApi);
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload zone and target vacancy selection when open', () => {
    render(
      <ImportJobDescriptionModal
        isOpen={true}
        onClose={mockOnClose}
        targetVacancy={{
          id: 'vac-101',
          title: 'Senior Staff Nurse',
          department: 'Nursing',
          location: 'Jeddah Hospital',
          status: 'Pending Activation',
        }}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText(/Upload Job Description/i)).toBeInTheDocument();
    expect(screen.getByText(/Drop your Job Description/i)).toBeInTheDocument();
    expect(screen.getByText(/Browse file from computer/i)).toBeInTheDocument();
  });

  it('populates fields when a file is parsed and allows adding/removing skill chips', async () => {
    const user = userEvent.setup();

    vi.spyOn(jdParser, 'parseJobDescriptionFile').mockResolvedValueOnce({
      title: 'HRIS Performance Specialist',
      department: 'Human Resources',
      location: 'SGH, UAE',
      minExperienceYears: 3,
      jobSummary: 'Develop and maintain HR systems and digital solutions.',
      requiredSkills: ['SQL Database Development', 'Power Platform', 'Full-Stack Web Development'],
      qualifications: "Bachelor's degree in Computer Science or IT",
      rawText: 'Mock raw text',
      responsibilities: 'Build HR workflows and reports',
      languages: ['English', 'Arabic'],
    });

    render(
      <ImportJobDescriptionModal
        isOpen={true}
        onClose={mockOnClose}
        targetVacancy={{
          id: 'vac-101',
          title: 'Pending HR Position',
          status: 'Pending Activation',
        }}
        onSuccess={mockOnSuccess}
      />
    );

    // Simulate file selection
    const file = new File(['fake docx content'], 'HRIS performance Specialist.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    await user.upload(fileInput, file);

    // Wait for parse results to render
    await waitFor(() => {
      expect(screen.getByDisplayValue('HRIS Performance Specialist')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Human Resources')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bachelor's degree in Computer Science or IT")).toBeInTheDocument();
    expect(screen.getByDisplayValue('Build HR workflows and reports')).toBeInTheDocument();
    expect(screen.getByText('SQL Database Development')).toBeInTheDocument();
    expect(screen.getByText('Power Platform')).toBeInTheDocument();
    expect(screen.getByText('Full-Stack Web Development')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Arabic')).toBeInTheDocument();

    // Remove one skill chip ('Power Platform')
    const removeBtn = screen.getByTitle('Remove Power Platform');
    await user.click(removeBtn);
    expect(screen.queryByText('Power Platform')).not.toBeInTheDocument();

    // Add a new skill chip
    const newSkillInput = screen.getByPlaceholderText(/Add another skill and press Enter/i);
    await user.type(newSkillInput, 'TypeScript{enter}');
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('commits Master Data sync and updates target vacancy on submit without overwriting database location', async () => {
    const user = userEvent.setup();

    vi.spyOn(jdParser, 'parseJobDescriptionFile').mockResolvedValueOnce({
      title: 'HRIS Performance Specialist',
      department: 'Human Resources',
      location: 'SGH, UAE',
      minExperienceYears: 3,
      jobSummary: 'Develop and maintain HR systems and digital solutions.',
      requiredSkills: ['SQL Database Development', 'Full-Stack Web Development'],
      qualifications: "Bachelor's degree in Computer Science",
      rawText: 'Mock raw text',
      responsibilities: 'Build HR workflows',
      languages: ['English'],
    });

    mockPatchApi.mockResolvedValueOnce({ id: 'vac-101', status: 'Pending Activation' });
    mockPostApi.mockResolvedValue({ success: true });

    render(
      <ImportJobDescriptionModal
        isOpen={true}
        onClose={mockOnClose}
        targetVacancy={{
          id: 'vac-101',
          title: 'Pending HR Position',
          status: 'Pending Activation',
        }}
        onSuccess={mockOnSuccess}
      />
    );

    const file = new File(['fake docx content'], 'HRIS performance Specialist.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByDisplayValue('HRIS Performance Specialist')).toBeInTheDocument();
    });

    // Click commit button
    const submitBtn = screen.getByRole('button', { name: /Apply to Requisition & Sync Master Data/i });
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockPostApi).toHaveBeenCalledWith('/master-data/catalog/skills/batch', {
        rows: expect.arrayContaining([
          expect.objectContaining({ name: 'SQL Database Development' }),
          expect.objectContaining({ name: 'Full-Stack Web Development' }),
        ]),
      });
      expect(mockPostApi).toHaveBeenCalledWith('/master-data/catalog/departments/batch', {
        rows: [{ name: 'Human Resources', status: 'Active' }],
      });
      expect(mockPatchApi).toHaveBeenCalledWith('/vacancies/vac-101', {
        title: 'HRIS Performance Specialist',
        department: 'Human Resources',
        minExperienceYears: 3,
        approvedHeadcount: 1,
        jobSummary: 'Develop and maintain HR systems and digital solutions.',
        requiredSkills: ['SQL Database Development', 'Full-Stack Web Development'],
        qualifications: "Bachelor's degree in Computer Science",
        responsibilities: 'Build HR workflows',
      });
      expect(mockOnSuccess).toHaveBeenCalledWith(expect.objectContaining({
        updatedTitle: 'HRIS Performance Specialist',
        vacancyId: 'vac-101',
        isNewRequisition: false,
      }));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
