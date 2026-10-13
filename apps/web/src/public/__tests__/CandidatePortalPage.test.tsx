import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '../../api/client';
import * as client from '../../api/client';
import { CandidatePortalPage } from '../CandidatePortalPage';
import { PublicApplyPage } from '../PublicApplyPage';
import type { PublicJob } from '@recruitflow/contracts';

const job = {
  vacancyCode: 'VAC-2026-P8',
  organizationCode: 'SGH',
  organizationName: 'Sample Health',
  positionTitle: 'Phase 8 Sample',
  description: null,
  jobSummary: null,
  responsibilities: null,
  qualifications: null,
  benefits: null,
  branchName: 'Head Office',
  location: null,
  employmentType: null,
  requiredSkills: [],
  minExperienceYears: null,
  targetStartDate: null,
  publishedAt: '2026-10-13T00:00:00.000Z',
  detailPath: '/careers/SGH/jobs/VAC-2026-P8',
  applyPath: '/careers/SGH/jobs/VAC-2026-P8/apply',
} satisfies PublicJob;

describe('PublicApplyPage consent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('keeps submit disabled until privacy consent is accepted', async () => {
    vi.spyOn(client, 'getApi').mockResolvedValue(job);
    render(
      <MemoryRouter initialEntries={['/careers/SGH/jobs/VAC-2026-P8/apply']}>
        <Routes>
          <Route path="/careers/:organizationCode/jobs/:vacancyCode/apply" element={<PublicApplyPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const submit = await screen.findByRole('button', { name: /Submit application/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/An application without it is not received/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
  });
});

describe('CandidatePortalPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not open an application from a reference number', async () => {
    render(
      <MemoryRouter initialEntries={['/my-applications']}>
        <Routes>
          <Route path="/my-applications" element={<CandidatePortalPage />} />
          <Route path="/portal/applications/:token" element={<CandidatePortalPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/Receipt link/i), 'APP-2026-802');
    await userEvent.click(screen.getByRole('button', { name: /Open application/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/does not open an application/i);
    expect(screen.queryByText('APP-2026-802')).not.toBeInTheDocument();
  });

  it('shows one candidate\'s application and not the other person\'s reference', async () => {
    vi.spyOn(client, 'getApi').mockResolvedValue({
      applicationCode: 'APP-2026-801',
      stage: 'Applied',
      positionTitle: 'Phase 8 Sample',
      vacancyCode: 'VAC-2026-P8',
      vacancyStatus: 'Open',
      organizationCode: 'SGH',
      organizationName: 'Sample Health',
      candidateFirstName: 'One',
      requests: [],
      documents: [],
    });
    render(
      <MemoryRouter initialEntries={['/portal/applications/aaa.bbb']}>
        <Routes>
          <Route path="/portal/applications/:token" element={<CandidatePortalPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('APP-2026-801')).toBeInTheDocument();
    expect(screen.queryByText('APP-2026-802')).not.toBeInTheDocument();
    expect(screen.queryByText(/My Work/i)).not.toBeInTheDocument();
  });

  it('an expired link offers contact and does not reveal another file', async () => {
    vi.spyOn(client, 'getApi').mockRejectedValue(new ApiError(400, 'This link has expired or was revoked. Ask the hiring team for a new link. This page does not open another person\'s application.'));
    const post = vi.spyOn(client, 'postApi').mockResolvedValue({ received: true, message: 'We received your note. It does not open an application.' });
    render(
      <MemoryRouter initialEntries={['/portal/applications/expired.token']}>
        <Routes>
          <Route path="/portal/applications/:token" element={<CandidatePortalPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /no longer available/i })).toBeInTheDocument();
    expect(screen.queryByText(/phase8-other.pdf/i)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Your name/i), 'Phase Eight');
    await userEvent.type(screen.getByLabelText(/Message/i), 'Please send a new link.');
    await userEvent.click(screen.getByRole('button', { name: /Send note/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/public/portal/contact', {
      name: 'Phase Eight',
      message: 'Please send a new link.',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('We received your note. It does not open an application.');
  });
});
