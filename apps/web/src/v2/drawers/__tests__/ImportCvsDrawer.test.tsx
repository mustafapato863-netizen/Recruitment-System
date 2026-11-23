import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { jobDetail, noDup } from '../../api/__fixtures__/jobs';

const api = vi.hoisted(() => ({ postFormDataApi: vi.fn(), postApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
import { ImportCvsDrawer } from '../ImportCvsDrawer';

beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); api.postApi.mockResolvedValue(noDup); });

it.each([500, 503])('reports HTTP %s as a processing failure and retries the same file successfully', async (status) => {
  const u = userEvent.setup();
  api.postFormDataApi.mockRejectedValueOnce(new ApiError(status, 'Processing is temporarily unavailable.', undefined,
    { code: status === 503 ? 'INTEGRATION_UNAVAILABLE' : 'INTERNAL_ERROR', retryable: true }))
    .mockResolvedValueOnce({ firstName: 'Test', lastName: 'Applicant', email: 'test@example.com' });
  render(<MemoryRouter><ImportCvsDrawer job={{ ...jobDetail(), status: 'Open', assignments: [] }} onClose={vi.fn()} onDone={vi.fn()} /></MemoryRouter>);
  const d = screen.getByRole('dialog');
  await u.upload(within(d).getByLabelText(/Drop CVs or/), new File(['synthetic'], 'synthetic.pdf', { type: 'application/pdf' }));
  const row = await within(d).findByRole('listitem');
  await waitFor(() => expect(row).toHaveTextContent('Failed'));
  expect(row).not.toHaveTextContent('Unreadable');
  expect(within(row).getByRole('alert')).toHaveTextContent('Processing is temporarily unavailable.');
  await u.click(within(row).getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(row).toHaveTextContent('Parsed'));
  expect(within(d).getByRole('button', { name: 'Import 1 to Applied' })).toBeEnabled();
  expect(api.postFormDataApi).toHaveBeenCalledTimes(2);
  expect(api.postApi.mock.calls.every(([path]) => path === '/candidates/duplicate-check')).toBe(true);
});

it('keeps a real invalid-file response distinct from a processing outage', async () => {
  const u = userEvent.setup();
  api.postFormDataApi.mockRejectedValueOnce(new ApiError(400, 'No readable text. Upload a text PDF.', undefined, { code: 'FILE_INVALID' }));
  render(<MemoryRouter><ImportCvsDrawer job={{ ...jobDetail(), status: 'Open', assignments: [] }} onClose={vi.fn()} onDone={vi.fn()} /></MemoryRouter>);
  const d = screen.getByRole('dialog');
  await u.upload(within(d).getByLabelText(/Drop CVs or/), new File(['synthetic'], 'scan.pdf', { type: 'application/pdf' }));
  await waitFor(() => expect(within(d).getByRole('listitem')).toHaveTextContent('Unreadable'));
  expect(within(d).getByRole('button', { name: 'Import 0 to Applied' })).toBeDisabled();
});

it('evaluates role fit without %, allows inline editing of extracted fields & skills, and submits validated payload', async () => {
  const u = userEvent.setup();
  api.postFormDataApi
    .mockResolvedValueOnce({
      firstName: 'Salma',
      lastName: 'Mansour',
      email: 'salma.mansour@example.com',
      phone: '+971501234567',
      title: 'ICU Registered Nurse',
      experienceYears: 5,
      skills: ['icu', 'ecg', 'Critical Care'],
      clinicalDomain: 'Critical Care & ICU',
      parsingQuality: 'high',
      parserSource: 'local',
    })
    .mockResolvedValueOnce({ id: 'doc-1' });
  api.postApi.mockImplementation(async (path: string) => {
    if (path === '/candidates/duplicate-check') return noDup;
    if (path === '/candidates') return { id: 'cand-new-1' };
    if (path === '/applications') return { id: 'app-new-1' };
    return {};
  });

  const jobWithCriteria = {
    ...jobDetail(),
    status: 'Open' as const,
    assignments: [],
    minExperienceYears: 3,
    requiredSkills: ['ICU', 'ACLS', 'Critical Care'],
  };

  render(<MemoryRouter><ImportCvsDrawer job={jobWithCriteria} onClose={vi.fn()} onDone={vi.fn()} /></MemoryRouter>);
  const d = screen.getByRole('dialog');

  // Target job criteria visible before upload
  expect(d).toHaveTextContent('Matching Criteria');
  expect(d).toHaveTextContent('3+ yrs exp');

  await u.upload(within(d).getByLabelText(/Drop CVs or/), new File(['synthetic'], 'salma-icu.pdf', { type: 'application/pdf' }));
  const row = await within(d).findByRole('listitem');
  await waitFor(() => expect(row).toHaveTextContent('Role Fit Evaluation'));

  // Zero numeric percentage anywhere in drawer
  expect(d.textContent).not.toMatch(/\d\s?%/);
  expect(row).toHaveTextContent('✓ ICU');
  expect(row).toHaveTextContent('− ACLS');

  // Inline edit extracted name + verify acronym normalization (ICU, ECG) + one-click missing skill + comma-separated add
  await u.click(within(row).getByRole('button', { name: 'Edit detected data' }));
  expect(row).toHaveTextContent('Skills & competencies');
  expect(row).toHaveTextContent('ECG');

  const firstNameInput = within(row).getByLabelText('First name');
  await u.clear(firstNameInput);
  await u.type(firstNameInput, 'Dr. Salma');

  // One-click missing role skill suggestion (+ ACLS)
  await u.click(within(row).getByRole('button', { name: 'ACLS' }));

  // Comma-separated multi-skill addition
  const addSkillInput = within(row).getByLabelText('Add skill');
  await u.type(addSkillInput, 'bls, Ventilator Care');
  await u.click(within(row).getByRole('button', { name: 'Add' }));

  // Role fit recalculates live: ACLS moves from missing to matched and achieves Strong fit
  await waitFor(() => expect(row).toHaveTextContent('✓ ACLS'));
  expect(row).toHaveTextContent('BLS');
  expect(row).toHaveTextContent('Ventilator Care');
  expect(row).toHaveTextContent('Strong fit');
  expect(d.textContent).not.toMatch(/\d\s?%/);

  await u.click(within(d).getByRole('button', { name: 'Import 1 to Applied' }));
  await waitFor(() => expect(row).toHaveTextContent('Added to Applied'));

  const createCall = api.postApi.mock.calls.find(([path]) => path === '/candidates');
  expect(createCall).toBeTruthy();
  expect(createCall?.[1]).toMatchObject({
    firstName: 'Dr. Salma',
    lastName: 'Mansour',
    email: 'salma.mansour@example.com',
    skills: expect.arrayContaining(['ICU', 'ECG', 'Critical Care', 'ACLS', 'BLS', 'Ventilator Care']),
  });
});
