import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FastScorecardModal } from '../FastScorecardModal';
import * as client from '../../../api/client';
import type { Interview } from '@recruitflow/contracts';

describe('FastScorecardModal', () => {
  const mockInterview: Interview = {
    id: 'int-123',
    organizationId: 'org-1',
    interviewCode: 'INT-2026-007',
    applicationId: 'app-1',
    candidateName: 'Dr. Mona Al-Zahrani',
    positionTitle: 'Specialist Pediatrician',
    title: 'Clinical Assessment Panel',
    interviewType: 'Technical',
    scheduledStart: '2026-09-08T10:00:00.000Z',
    scheduledEnd: '2026-09-08T10:45:00.000Z',
    timezone: 'Asia/Riyadh',
    status: 'Scheduled',
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
  };

  it('renders modal with interview details, recommendation choices, and immutable notice', () => {
    render(
      <FastScorecardModal
        isOpen={true}
        onClose={vi.fn()}
        interview={mockInterview}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/Submit Scorecard: Clinical Assessment Panel/i)).toBeInTheDocument();
    expect(screen.getByText(/Dr. Mona Al-Zahrani/i)).toBeInTheDocument();
    expect(screen.getByText(/Specialist Pediatrician/i)).toBeInTheDocument();
    expect(screen.getByText(/Immutable Record:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Strong Hire$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Hire$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^No Hire$/i })).toBeInTheDocument();
  });

  it('submits scorecard and locks evaluation', async () => {
    const postSpy = vi.spyOn(client, 'postApi').mockResolvedValue({
      id: 'sc-1',
      overallRating: 5,
      recommendation: 'Strong Hire',
      isLocked: true,
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <FastScorecardModal
        isOpen={true}
        onClose={onClose}
        interview={mockInterview}
        onSuccess={onSuccess}
      />
    );

    // Select 5 stars
    await userEvent.click(screen.getByRole('button', { name: /★ 5/i }));

    // Select Strong Hire
    await userEvent.click(screen.getByRole('button', { name: /^Strong Hire$/i }));

    await userEvent.type(screen.getByLabelText(/Interviewer Results & Notes/i), 'Strong technical evidence and clear communication.');

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /Submit & Lock Scorecard/i }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/interviews/int-123/scorecard', {
        overallRating: 5,
        recommendation: 'Strong Hire',
        strengths: undefined,
        concerns: undefined,
        notes: 'Strong technical evidence and clear communication.',
      });
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
