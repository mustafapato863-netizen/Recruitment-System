import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtsEvaluationResult } from '@recruitflow/contracts';

const atsApi = vi.hoisted(() => ({
  fetchApplicationAts: vi.fn(),
}));

vi.mock('../../api/ats', () => atsApi);

import { AtsMatchCard } from '../AtsMatchCard';

describe('AtsMatchCard', () => {
  const mockResult: AtsEvaluationResult = {
    applicationId: 'app-100',
    candidateId: 'cand-100',
    vacancyId: 'vac-100',
    atsScore: 85,
    atsKnockoutPass: true,
    breakdown: {
      mustHaveSkillsPassed: true,
      mustHaveMatchedCount: 2,
      mustHaveTotalCount: 2,
      niceToHaveMatchedCount: 1,
      niceToHaveTotalCount: 2,
      knockoutsPassed: true,
      knockoutFailures: [],
      missingKeywords: ['Kubernetes'],
      overallScore: 85,
      semanticSkillMatchPct: 85,
      experienceMatch: { actualYears: 5, requiredYears: 5, passed: true },
      educationMatch: { actual: ['BACHELORS'], required: ['BACHELORS'], passed: true },
      languagesMatch: { actual: ['English'], required: ['English'], passed: true },
      calculatedAt: '2026-11-17T12:00:00Z',
      skillBreakdown: [
        {
          skillName: 'TypeScript',
          isMustHave: true,
          matched: true,
          evidenceSnippet: '5 years developing backend services in TypeScript.',
        },
        {
          skillName: 'PostgreSQL',
          isMustHave: true,
          matched: true,
          evidenceSnippet: 'Designed high-throughput PostgreSQL schemas.',
        },
      ],
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    atsApi.fetchApplicationAts.mockResolvedValue(mockResult);
  });

  it('renders loading state and then ATS fit analysis', async () => {
    render(<AtsMatchCard applicationId="app-100" />);

    expect(screen.getByText(/Evaluating candidate qualifications/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/ATS Fit & Requirement Analysis/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/85% — Strong Fit/i)).toBeInTheDocument();
    expect(screen.getByText(/Mandatory criteria passed/i)).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
  });

  it('displays knockout warning banner when knockout criteria fail', async () => {
    atsApi.fetchApplicationAts.mockResolvedValueOnce({
      ...mockResult,
      atsScore: 45,
      atsKnockoutPass: false,
      breakdown: {
        ...mockResult.breakdown,
        knockoutsPassed: false,
        knockoutFailures: ['Requires minimum 5 years experience.'],
      },
    });

    render(<AtsMatchCard applicationId="app-100" />);

    await waitFor(() => {
      expect(screen.getByText(/Knockout criteria flagged for human review/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Requires minimum 5 years experience/i)).toBeInTheDocument();
    expect(screen.getByText(/45% \(Knockout Flagged\)/i)).toBeInTheDocument();
  });

  it('toggles verbatim CV evidence snippets on click', async () => {
    const user = userEvent.setup();
    render(<AtsMatchCard applicationId="app-100" />);

    await waitFor(() => {
      expect(screen.getByText(/Verbatim CV Evidence/i)).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /Verbatim CV Evidence/i });
    await user.click(toggleBtn);

    expect(screen.getByText(/"5 years developing backend services in TypeScript."/i)).toBeInTheDocument();
  });

  it('calls onSuggestJobs when suggest roles button is clicked', async () => {
    const user = userEvent.setup();
    const onSuggest = vi.fn();
    render(<AtsMatchCard applicationId="app-100" onSuggestJobs={onSuggest} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Suggest Other Open Roles/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Suggest Other Open Roles/i }));
    expect(onSuggest).toHaveBeenCalledTimes(1);
  });
});
