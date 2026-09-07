import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicJobDetailPage } from '../PublicJobDetailPage';
import * as client from '../../api/client';
import type { PublicJob } from '@recruitflow/contracts';

function buildJob(overrides: Partial<PublicJob> = {}): PublicJob {
  return {
    vacancyCode: 'VAC-2026-001',
    organizationCode: 'sgh',
    organizationName: 'Saudi German Health',
    positionTitle: 'Senior ICU Nurse',
    description: 'Critical care nursing in a 24-bed unit.',
    jobSummary: 'Senior ICU nurse for Jeddah.',
    responsibilities: 'Deliver bedside critical care.',
    qualifications: 'Valid SCFHS classification.',
    benefits: 'Tax-free package plus housing.',
    branchName: 'Jeddah',
    location: 'Jeddah',
    employmentType: 'Full-time',
    requiredSkills: ['Critical Care'],
    minExperienceYears: 3,
    targetStartDate: '2026-10-01',
    publishedAt: '2026-09-01T00:00:00.000Z',
    detailPath: '/careers/sgh/jobs/VAC-2026-001',
    applyPath: '/careers/sgh/jobs/VAC-2026-001/apply',
    ...overrides,
  };
}

function renderDetail() {
  render(
    <MemoryRouter initialEntries={['/careers/sgh/jobs/VAC-2026-001']}>
      <Routes>
        <Route path="/careers/:organizationCode/jobs/:vacancyCode" element={<PublicJobDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicJobDetailPage job description sections', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders responsibilities, qualifications, and benefits sections', async () => {
    vi.spyOn(client, 'getApi').mockResolvedValue(buildJob());
    renderDetail();

    await waitFor(() => {
      expect(screen.getByText(/Senior ICU Nurse/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Key responsibilities/i)).toBeInTheDocument();
    expect(screen.getByText(/Deliver bedside critical care/i)).toBeInTheDocument();
    expect(screen.getByText(/Required qualifications/i)).toBeInTheDocument();
    expect(screen.getByText(/Valid SCFHS classification/i)).toBeInTheDocument();
    expect(screen.getByText(/Benefits & highlights/i)).toBeInTheDocument();
    expect(screen.getByText(/Tax-free package plus housing/i)).toBeInTheDocument();
  });

  it('hides empty sections and keeps the fallback description', async () => {
    vi.spyOn(client, 'getApi').mockResolvedValue(
      buildJob({
        description: null,
        responsibilities: null,
        qualifications: null,
        benefits: null,
      })
    );
    renderDetail();

    await waitFor(() => {
      expect(screen.getByText(/Senior ICU Nurse/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Key responsibilities/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Required qualifications/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Benefits & highlights/i)).not.toBeInTheDocument();
    expect(screen.getByText(/has not added a role description yet/i)).toBeInTheDocument();
  });
});
