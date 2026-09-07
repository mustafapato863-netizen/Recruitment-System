import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InterviewCalendarPage } from '../InterviewCalendarPage';
import * as client from '../../api/client';
import * as authContext from '../../auth/AuthContext';

describe('InterviewCalendarPage', () => {
  const mockUser = {
    id: 'user-recruiter-1',
    displayName: 'Sara Al-Otaibi',
    email: 'sara@sghgroup.sa',
    roles: ['HR_RECRUITER'],
    permissions: ['APPLICATION_MOVE_STAGE'],
    currentRole: 'HR_RECRUITER',
    organizationId: 'sgh-main',
  };

  const mockInterviews = [
    {
      id: 'int-101',
      interviewCode: 'INT-2026-101',
      title: 'Clinical Peer Review',
      interviewType: 'Technical',
      candidateName: 'Dr. Tariq Al-Amri',
      positionTitle: 'Consultant Cardiologist',
      status: 'Scheduled',
      scheduledStart: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
      scheduledEnd: new Date(new Date().setHours(10, 45, 0, 0)).toISOString(),
      locationUrl: 'https://teams.microsoft.com/l/meetup-join/sgh-cardio',
      attendees: [
        {
          id: 'att-1',
          interviewId: 'int-101',
          userId: 'user-recruiter-1',
          userName: 'Sara Al-Otaibi',
          role: 'Lead Evaluator',
          response: 'Accepted',
        },
      ],
    },
    {
      id: 'int-102',
      interviewCode: 'INT-2026-102',
      title: 'Nursing Leadership Screening',
      interviewType: 'Screening',
      candidateName: 'Nurse Mona Mansour',
      positionTitle: 'Head Nurse ICU',
      status: 'Scheduled',
      scheduledStart: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
      scheduledEnd: new Date(new Date().setHours(10, 30, 0, 0)).toISOString(),
      locationUrl: 'https://meet.google.com/xyz-rec-sgh',
      attendees: [
        {
          id: 'att-2',
          interviewId: 'int-102',
          userId: 'user-hod-2',
          userName: 'Dr. Hassan Ali',
          role: 'Department Head',
          response: 'Pending',
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
      hasPermission: () => true,
      hasRole: () => true,
    } as unknown as ReturnType<typeof authContext.useAuth>);
  });

  it('renders calendar controls and loads interviews into side-by-side cards', async () => {
    vi.spyOn(client, 'getApi').mockResolvedValue(mockInterviews);

    render(
      <MemoryRouter>
        <InterviewCalendarPage />
      </MemoryRouter>
    );

    // Initial loading indicator
    expect(screen.getByText(/Loading interview calendar/i)).toBeInTheDocument();

    // Resolves and displays toolbar and interview cards
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Interview Calendar/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Today/i })).toBeInTheDocument();
      expect(screen.getByText(/All \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText(/(?:Mine|My Interviews) \(1\)/i)).toBeInTheDocument();
    });

    // Verify side-by-side event cards are rendered
    await waitFor(() => {
      expect(screen.getByText('Dr. Tariq Al-Amri')).toBeInTheDocument();
      expect(screen.getByText('Nurse Mona Mansour')).toBeInTheDocument();
    });

    // Check platform badges
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('Google Meet')).toBeInTheDocument();
  });

  it('opens Quick-View Event Modal when an interview card is clicked', async () => {
    vi.spyOn(client, 'getApi').mockResolvedValue(mockInterviews);

    render(
      <MemoryRouter>
        <InterviewCalendarPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dr. Tariq Al-Amri')).toBeInTheDocument();
    });

    // Click the card
    const card = screen.getByText('Dr. Tariq Al-Amri').closest('button');
    expect(card).not.toBeNull();
    await userEvent.click(card!);

    // Modal opens with full details
    await waitFor(() => {
      expect(screen.getByText(/Interview Dossier & Meeting/i)).toBeInTheDocument();
      expect(screen.getByText('Consultant Cardiologist')).toBeInTheDocument();
      expect(screen.getByText('INT-2026-101')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Join Meeting/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export \.ics/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit Scorecard/i })).toBeInTheDocument();
    });
  });

  it('opens FastScorecardModal directly from Quick-View Modal', async () => {
    vi.spyOn(client, 'getApi').mockResolvedValue(mockInterviews);

    render(
      <MemoryRouter>
        <InterviewCalendarPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dr. Tariq Al-Amri')).toBeInTheDocument();
    });

    const card = screen.getByText('Dr. Tariq Al-Amri').closest('button');
    await userEvent.click(card!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Submit Scorecard/i })).toBeInTheDocument();
    });

    // Click Submit Scorecard
    await userEvent.click(screen.getByRole('button', { name: /Submit Scorecard/i }));

    // FastScorecardModal opens
    await waitFor(() => {
      expect(screen.getByText(/Submit Scorecard: Clinical Peer Review/i)).toBeInTheDocument();
      expect(screen.getByText(/Immutable Record:/i)).toBeInTheDocument();
    });
  });
});
