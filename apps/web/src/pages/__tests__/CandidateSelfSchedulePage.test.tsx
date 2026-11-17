import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CandidateSelfSchedulePage } from '../CandidateSelfSchedulePage';
import * as client from '../../api/client';

describe('CandidateSelfSchedulePage', () => {
  const mockToken = 'mock.token123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state then displays available slots and candidate details', async () => {
    const mockView = {
      valid: true,
      candidateName: 'Dr. Tariq Al-Amri',
      positionTitle: 'Consultant Cardiologist',
      interviewTitle: 'Clinical Peer Review',
      interviewType: 'Technical',
      durationMinutes: 45,
      timezone: 'Asia/Riyadh',
      availableSlots: [
        {
          start: '2026-09-10T07:00:00.000Z',
          end: '2026-09-10T07:45:00.000Z',
          formattedTime: 'Thu, Sep 10 • 10:00 AM AST',
        },
        {
          start: '2026-09-10T08:00:00.000Z',
          end: '2026-09-10T08:45:00.000Z',
          formattedTime: 'Thu, Sep 10 • 11:00 AM AST',
        },
      ],
      expiresAt: '2026-09-15T00:00:00.000Z',
    };

    vi.spyOn(client, 'getApi').mockResolvedValue(mockView);

    render(
      <MemoryRouter initialEntries={[`/schedule/${mockToken}`]}>
        <Routes>
          <Route path="/schedule/:token" element={<CandidateSelfSchedulePage />} />
        </Routes>
      </MemoryRouter>
    );

    // Shows loading indicator initially
    expect(screen.getByText(/Loading Available Time Slots/i)).toBeInTheDocument();

    // Resolves and displays candidate greeting and position
    await waitFor(() => {
      expect(screen.getByText(/Schedule Your Clinical Peer Review/i)).toBeInTheDocument();
      expect(screen.getByText(/Dr. Tariq Al-Amri/i)).toBeInTheDocument();
      expect(screen.getByText(/Consultant Cardiologist/i)).toBeInTheDocument();
    });

    // Displays available slot buttons
    expect(screen.getByText(/10:00 AM AST/i)).toBeInTheDocument();
    expect(screen.getByText(/11:00 AM AST/i)).toBeInTheDocument();
  });

  it('allows candidate to select slot and confirms appointment', async () => {
    const mockView = {
      valid: true,
      candidateName: 'Dr. Tariq Al-Amri',
      positionTitle: 'Consultant Cardiologist',
      interviewTitle: 'Clinical Peer Review',
      interviewType: 'Technical',
      durationMinutes: 45,
      timezone: 'Asia/Riyadh',
      availableSlots: [
        {
          start: '2026-09-10T07:00:00.000Z',
          end: '2026-09-10T07:45:00.000Z',
          formattedTime: 'Thu, Sep 10 • 10:00 AM AST',
        },
      ],
      expiresAt: '2026-09-15T00:00:00.000Z',
    };

    vi.spyOn(client, 'getApi').mockResolvedValue(mockView);
    const postSpy = vi.spyOn(client, 'postApi').mockResolvedValue({
      success: true,
      interviewId: 'int-uuid-1',
      interviewCode: 'INT-2026-042',
      scheduledStart: '2026-09-10T07:00:00.000Z',
      scheduledEnd: '2026-09-10T07:45:00.000Z',
      message: 'Interview booked successfully!',
    });

    render(
      <MemoryRouter initialEntries={[`/schedule/${mockToken}`]}>
        <Routes>
          <Route path="/schedule/:token" element={<CandidateSelfSchedulePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/10:00 AM AST/i)).toBeInTheDocument();
    });

    // Click on time slot
    await userEvent.click(screen.getByText(/10:00 AM AST/i));

    // Submit booking
    const bookButton = screen.getByRole('button', { name: /Confirm & Book Appointment/i });
    expect(bookButton).toBeEnabled();
    await userEvent.click(bookButton);

    // Verify post API called
    expect(postSpy).toHaveBeenCalledWith(`/public/interviews/schedule/${mockToken}`, {
      selectedSlot: '2026-09-10T07:00:00.000Z',
      timezone: 'Asia/Riyadh',
      candidateNotes: undefined,
    });

    // Shows confirmation screen
    await waitFor(() => {
      expect(screen.getByText(/Appointment Confirmed/i)).toBeInTheDocument();
      expect(screen.getByText(/INT-2026-042/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add to Calendar \(\.ics\)/i })).toBeInTheDocument();
    });
  });

  it('displays error state when token is expired or invalid', async () => {
    vi.spyOn(client, 'getApi').mockRejectedValue(new Error('This self-scheduling invitation link has expired.'));

    render(
      <MemoryRouter initialEntries={[`/schedule/${mockToken}`]}>
        <Routes>
          <Route path="/schedule/:token" element={<CandidateSelfSchedulePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Unable to Schedule/i)).toBeInTheDocument();
      expect(screen.getByText(/This self-scheduling invitation link has expired/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      expect(screen.getByText(/talent team/i)).toBeInTheDocument();
    });
  });

  it('recovers from a conflicting slot by refreshing the available times', async () => {
    const mockView = {
      valid: true,
      candidateName: 'Dr. Tariq Al-Amri',
      positionTitle: 'Consultant Cardiologist',
      interviewTitle: 'Clinical Peer Review',
      interviewType: 'Technical',
      durationMinutes: 45,
      timezone: 'Asia/Riyadh',
      availableSlots: [
        {
          start: '2026-09-10T07:00:00.000Z',
          end: '2026-09-10T07:45:00.000Z',
          formattedTime: 'Thu, Sep 10 • 10:00 AM AST',
        },
      ],
      expiresAt: '2026-09-15T00:00:00.000Z',
    };
    const getSpy = vi.spyOn(client, 'getApi').mockResolvedValue(mockView);
    vi.spyOn(client, 'postApi').mockRejectedValue(new client.ApiError(
      409,
      'The selected slot is no longer available as an interviewer became occupied. Please select another time slot.',
    ));

    render(
      <MemoryRouter initialEntries={[`/schedule/${mockToken}`]}>
        <Routes>
          <Route path="/schedule/:token" element={<CandidateSelfSchedulePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/10:00 AM AST/i)).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText(/10:00 AM AST/i));
    await userEvent.click(screen.getByRole('button', { name: /Confirm & Book Appointment/i }));

    const refresh = await screen.findByRole('button', { name: 'Refresh available slots' });
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
    expect(screen.queryByText(/Unable to Schedule/i)).not.toBeInTheDocument();

    getSpy.mockResolvedValueOnce({
      ...mockView,
      availableSlots: [
        {
          start: '2026-09-11T09:00:00.000Z',
          end: '2026-09-11T09:45:00.000Z',
          formattedTime: 'Fri, Sep 11 • 12:00 PM AST',
        },
      ],
    });
    await userEvent.click(refresh);

    await waitFor(() => {
      expect(screen.getByText(/12:00 PM AST/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Confirm & Book Appointment/i })).toBeDisabled();
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(getSpy).toHaveBeenLastCalledWith(`/public/interviews/schedule/${mockToken}`);
  });

  it('confirms the booking without claiming a calendar email was sent', async () => {
    const mockView = {
      valid: true,
      candidateName: 'Dr. Tariq Al-Amri',
      positionTitle: 'Consultant Cardiologist',
      interviewTitle: 'Clinical Peer Review',
      interviewType: 'Technical',
      durationMinutes: 45,
      timezone: 'Asia/Riyadh',
      availableSlots: [
        {
          start: '2026-09-10T07:00:00.000Z',
          end: '2026-09-10T07:45:00.000Z',
          formattedTime: 'Thu, Sep 10 • 10:00 AM AST',
        },
      ],
      expiresAt: '2026-09-15T00:00:00.000Z',
    };
    vi.spyOn(client, 'getApi').mockResolvedValue(mockView);
    vi.spyOn(client, 'postApi').mockResolvedValue({
      success: true,
      interviewId: 'int-uuid-1',
      interviewCode: 'INT-2026-042',
      scheduledStart: '2026-09-10T07:00:00.000Z',
      scheduledEnd: '2026-09-10T07:45:00.000Z',
      message: '',
    });

    render(
      <MemoryRouter initialEntries={[`/schedule/${mockToken}`]}>
        <Routes>
          <Route path="/schedule/:token" element={<CandidateSelfSchedulePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/10:00 AM AST/i)).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText(/10:00 AM AST/i));
    await userEvent.click(screen.getByRole('button', { name: /Confirm & Book Appointment/i }));

    await waitFor(() => {
      expect(screen.getByText('Download the calendar file (.ics) above to save this appointment.')).toBeInTheDocument();
    });
    expect(screen.queryByText(/calendar invitation email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dispatched/i)).not.toBeInTheDocument();
  });
});
