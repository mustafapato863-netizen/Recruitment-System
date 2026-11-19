import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { canUseMyInterviews } from '../../auth/interviewer';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), downloadFileApi: vi.fn() }));
vi.mock('../../api/client', async () => ({ ...(await vi.importActual<object>('../../api/client')), ...api }));
import { listMyInterviews, pickInterview } from '../../api/myInterviews';
import { MyInterviewsPage } from '../MyInterviewsPage';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'iv1', title: 'Technical interview', interviewType: 'Technical', scheduledStart: '2026-10-13T07:00:00Z', scheduledEnd: '2026-10-13T08:00:00Z',
  timezone: 'Africa/Cairo', candidateName: 'Ahmed Embaby', positionTitle: 'HRIS Developer', locationUrl: 'https://rooms.example.test/sg-4', roomName: 'Room SG-4',
  myResponse: 'Pending', scorecardStatus: 'missing', status: 'Scheduled', ...over,
});
const renderPage = () => render(<MemoryRouter><MyInterviewsPage /></MemoryRouter>);

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn(); });
afterEach(() => vi.restoreAllMocks());

describe('adapter (provisional GET /me/interviews)', () => {
  it('calls the provisional path and whitelists fields (no PII/pay/file data)', async () => {
    api.getApi.mockResolvedValue({ data: [row({ candidateEmail: 'a@x.com', phone: '+20', expectedSalary: 9000, applicationId: 'app1', notes: 'secret' })] });
    const r = await listMyInterviews();
    expect(api.getApi).toHaveBeenCalledWith('/me/interviews?scope=upcoming');
    expect(r.available && Object.keys(r.items[0]).sort()).toEqual(['candidateName', 'id', 'interviewType', 'locationUrl', 'myResponse', 'positionTitle', 'roomName', 'scheduledEnd', 'scheduledStart', 'scorecardStatus', 'status', 'timezone', 'title']);
  });
  it.each([404, 405, 501])('%i → not available yet', async (s) => {
    api.getApi.mockRejectedValue(new ApiError(s, 'x'));
    expect(await listMyInterviews()).toEqual({ available: false });
  });
  it('403 is a real error', async () => {
    api.getApi.mockRejectedValue(new ApiError(403, 'no'));
    await expect(listMyInterviews()).rejects.toBeInstanceOf(ApiError);
  });
  it('pickInterview defaults', () => {
    expect(pickInterview({ id: 'x' })).toMatchObject({ title: 'Interview', candidateName: 'Candidate', myResponse: 'Pending', scorecardStatus: 'missing' });
  });
});

describe('My interviews page', () => {
  it('lists interviews with only name, job, time, room, RSVP and scorecard status', async () => {
    api.getApi.mockResolvedValue({ data: [row({ candidateEmail: 'ahmed@x.com', expectedSalary: 9000 })] });
    const { container } = renderPage();
    const card = await screen.findByTestId('my-interview');
    expect(within(card).getByRole('heading', { name: /Ahmed Embaby.*HRIS Developer/ })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Room link' })).toHaveAttribute('href', 'https://rooms.example.test/sg-4');
    expect(within(card).getByText('Not answered')).toBeInTheDocument();
    expect(within(card).getByText('Scorecard due')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/ahmed@x\.com|9000|salary|notes|offer/i);
    expect(container.querySelector('a[href^="/applications"]')).toBeNull();
  });

  it('404 list → "Not available yet"', async () => {
    api.getApi.mockRejectedValue(new ApiError(404, 'Not found'));
    renderPage();
    expect(await screen.findByText('Not available yet')).toBeInTheDocument();
  });

  it('empty list', async () => {
    api.getApi.mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText('No upcoming interviews')).toBeInTheDocument();
  });

  it('Download CV uses GET /interviews/:id/cv and the Content-Disposition filename', async () => {
    const u = userEvent.setup();
    api.getApi.mockResolvedValue({ data: [row()] });
    api.downloadFileApi.mockResolvedValue({ blob: new Blob(['%PDF']), filename: 'Ahmed Embaby CV.pdf' });
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Download CV for Ahmed Embaby' }));
    expect(api.downloadFileApi).toHaveBeenCalledWith('/interviews/iv1/cv', 'cv');
    expect(await screen.findByRole('status')).toHaveTextContent('Downloaded Ahmed Embaby CV.pdf');
  });

  it.each([
    [new ApiError(404, 'This candidate has no CV on file.'), 'This candidate has no CV on file yet.'],
    [new ApiError(403, 'Access denied: this file belongs to another owner.', undefined, { code: 'FILE_NOT_OWNED' }), "You can't download this CV. Access denied: this file belongs to another owner."],
  ])('CV download errors are explained', async (error, text) => {
    const u = userEvent.setup();
    api.getApi.mockResolvedValue({ data: [row()] });
    api.downloadFileApi.mockRejectedValue(error);
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Download CV for Ahmed Embaby' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('RSVP accept/decline posts UpdateInterviewResponseDto and updates the badge', async () => {
    const u = userEvent.setup();
    api.getApi.mockResolvedValue({ data: [row()] });
    api.postApi.mockResolvedValue({});
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Accept' }));
    expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/response', { response: 'Confirmed' });
    expect(await screen.findByText('Accepted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Decline' }));
    expect(api.postApi).toHaveBeenLastCalledWith('/interviews/iv1/response', { response: 'Declined' });
  });

  it('.ics uses GET /interviews/:id/ics', async () => {
    const u = userEvent.setup();
    api.getApi.mockResolvedValue({ data: [row()] });
    api.downloadFileApi.mockResolvedValue({ blob: new Blob(['BEGIN:VCALENDAR']), filename: 'INT-1.ics' });
    renderPage();
    await u.click(await screen.findByRole('button', { name: /Add to calendar/ }));
    expect(api.downloadFileApi).toHaveBeenCalledWith('/interviews/iv1/ics', 'interview.ics');
  });

  it('scorecard: validates, then POSTs SubmitScorecardDto', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) => (p.endsWith('/scorecard') ? [] : { data: [row()] }));
    api.postApi.mockResolvedValue({ id: 's1', interviewId: 'iv1', interviewerId: 'me', overallRating: 4, recommendation: 'Hire', notes: 'Built payroll exports', status: 'Submitted', submittedAt: '2026-10-13T09:00:00Z' });
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Fill scorecard' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Overall rating');
    await u.click(screen.getByRole('button', { name: 'Submit scorecard' }));
    expect(await within(dialog).findByText('Choose a rating from 1 to 5.')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.click(within(dialog).getByRole('radio', { name: '4' }));
    await u.type(within(dialog).getByRole('textbox', { name: /Written evidence/ }), 'Built payroll exports');
    await u.click(screen.getByRole('button', { name: 'Submit scorecard' }));
    expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/scorecard', { overallRating: 4, recommendation: 'Hire', notes: 'Built payroll exports' });
    expect(await within(dialog).findByTestId('my-scorecard')).toHaveTextContent('4 of 5');
    await waitFor(() => expect(screen.getByText('Scorecard submitted')).toBeInTheDocument());
  });

  it('scorecard: shows my submitted scorecard read-only (GET /interviews/:id/scorecard)', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) => (p.endsWith('/scorecard')
      ? [{ id: 's1', interviewId: 'iv1', interviewerId: 'me', overallRating: 5, recommendation: 'Strong Hire', notes: 'Great', status: 'Submitted', submittedAt: '2026-10-13T09:00:00Z' }]
      : { data: [row({ scorecardStatus: 'submitted' })] }));
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'View my scorecard' }));
    expect(await screen.findByTestId('my-scorecard')).toHaveTextContent('Strong Hire');
    expect(api.getApi).toHaveBeenCalledWith('/interviews/iv1/scorecard');
    expect(screen.queryByRole('button', { name: 'Submit scorecard' })).not.toBeInTheDocument();
  });
});

describe('draft scorecard + room name', () => {
  it('pickInterview keeps roomName; status is missing|draft|submitted', () => {
    expect(pickInterview({ id: 'x', roomName: 'Room 4B', scorecardStatus: 'draft' })).toMatchObject({ roomName: 'Room 4B', scorecardStatus: 'draft' });
  });
  it('shows the room name next to the room link', async () => {
    api.getApi.mockResolvedValue({ data: [row()] });
    renderPage();
    expect(await screen.findByTestId('room-name')).toHaveTextContent('Room SG-4');
    expect(screen.getByRole('link', { name: 'Room link' })).toBeInTheDocument();
  });
  it('draft: badge "Draft saved", the form reopens prefilled and can be submitted', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) => (p.endsWith('/scorecard')
      ? [{ id: 's1', interviewId: 'iv1', interviewerId: 'me', overallRating: 3, recommendation: 'Neutral', notes: 'Half done', status: 'Draft', submittedAt: '2026-10-13T09:00:00Z' }]
      : { data: [row({ scorecardStatus: 'draft' })] }));
    api.postApi.mockResolvedValue({ id: 's1', interviewId: 'iv1', interviewerId: 'me', overallRating: 3, recommendation: 'Neutral', notes: 'Half done, finished', status: 'Submitted', submittedAt: '2026-10-13T10:00:00Z' });
    renderPage();
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Continue scorecard' }));
    expect(await screen.findByTestId('draft-note')).toBeInTheDocument();
    const evidence = screen.getByLabelText(/Written evidence/);
    expect(evidence).toHaveValue('Half done');
    await u.type(evidence, ', finished');
    await u.click(await screen.findByRole('button', { name: 'Submit scorecard' }));
    expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/scorecard', { overallRating: 3, recommendation: 'Neutral', notes: 'Half done, finished' });
    await waitFor(() => expect(screen.getByText('Scorecard submitted')).toBeInTheDocument());
  });
});

describe('r3: #4 cards carry isLocked, no status (R3-1 / R3-2)', () => {
  const card = (over: Record<string, unknown>) => ({ id: 's1', interviewId: 'iv1', interviewerId: 'me', overallRating: 3, recommendation: 'Neutral', notes: 'Half done', submittedAt: '2026-10-13T09:00:00Z', ...over });

  it('R3-1: a locked card with no status opens read-only (submitted), even if the list says draft', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) => (p.endsWith('/scorecard') ? [card({ isLocked: true })] : { data: [row({ scorecardStatus: 'draft' })] }));
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Continue scorecard' }));
    expect(await screen.findByTestId('my-scorecard')).toBeInTheDocument();
    expect(screen.queryByTestId('draft-note')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit scorecard' })).not.toBeInTheDocument();
  });

  it('R3-1: an unlocked card with no status stays an editable draft', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) => (p.endsWith('/scorecard') ? [card({ isLocked: false })] : { data: [row({ scorecardStatus: 'draft' })] }));
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Continue scorecard' }));
    expect(await screen.findByTestId('draft-note')).toBeInTheDocument();
    expect(screen.getByLabelText(/Written evidence/)).toHaveValue('Half done');
  });

  it('R3-2: after submitting a draft the dialog switches to Submitted and hides Submit, without a reload', async () => {
    // Deterministic (TEST-1): every async step is awaited on the state it produces; no timers, no sleeps.
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) => {
      if (p.endsWith('/scorecard')) return [card({ isLocked: false })];
      if (p === '/me/interviews?scope=upcoming') return { data: [row({ scorecardStatus: 'draft' })] };
      return { data: [] };
    });
    // #4 echoes the saved card without `status` (and here without isLocked either).
    api.postApi.mockResolvedValue(card({ notes: 'Half done, finished', submittedAt: '2026-10-13T10:00:00Z' }));
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Continue scorecard' }));
    // The draft has loaded once its text is in the form; only then is the form final.
    const evidence = await screen.findByDisplayValue('Half done');
    const submit = await screen.findByRole('button', { name: 'Submit scorecard' });
    await u.type(evidence, ', finished');
    await u.click(submit);
    expect(await screen.findByTestId('my-scorecard')).toHaveTextContent('Half done, finished');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Submit scorecard' })).not.toBeInTheDocument());
    expect(screen.queryByTestId('draft-note')).not.toBeInTheDocument();
    expect(screen.getByText('Scorecard submitted')).toBeInTheDocument();
    expect(api.getApi.mock.calls.filter(([p]) => p === '/me/interviews?scope=upcoming')).toHaveLength(1);
  });
});

describe('who sees My interviews', () => {
  it('INTERVIEWER role or INTERVIEW_PARTICIPATE, plus VACANCY_VIEW', () => {
    expect(canUseMyInterviews({ roles: [{ id: 'r', code: 'INTERVIEWER', name: 'Interviewer' }], permissions: ['VACANCY_VIEW'] })).toBe(true);
    expect(canUseMyInterviews({ roles: [], permissions: ['INTERVIEW_PARTICIPATE', 'VACANCY_VIEW'] })).toBe(true);
    expect(canUseMyInterviews({ roles: [{ id: 'r', code: 'RECRUITER', name: 'Recruiter' }], permissions: ['VACANCY_VIEW'] })).toBe(false);
    expect(canUseMyInterviews({ roles: [{ id: 'r', code: 'INTERVIEWER', name: 'Interviewer' }], permissions: [] })).toBe(false);
    expect(canUseMyInterviews(null)).toBe(false);
  });
});

describe('PR33-2 submitted scorecards stay findable', () => {
  it('an ended interview with my submitted card is listed read-only and the /interviews/:id deep link opens it', async () => {
    api.getApi.mockImplementation(async (p: string) => {
      if (p === '/me/interviews?scope=upcoming') return { data: [] };
      if (p === '/me/interviews?scope=past') return { data: [row({ id: 'p9', candidateName: 'Done Person', scorecardStatus: 'submitted' })] };
      if (p.endsWith('/scorecard')) return [{ id: 's1', interviewId: 'p9', interviewerId: 'me', overallRating: 4, recommendation: 'Hire', notes: 'Solid', submittedAt: '2026-10-10T10:00:00Z', status: 'submitted' }];
      return [];
    });
    render(<MemoryRouter initialEntries={['/my-interviews?interview=p9&scorecard=1']}><MyInterviewsPage /></MemoryRouter>);
    const done = await screen.findByRole('list', { name: 'Ended interviews with my submitted scorecard' });
    expect(within(done).getByRole('button', { name: 'View my scorecard' })).toBeInTheDocument();
    expect(await screen.findByTestId('my-scorecard')).toHaveTextContent('Solid');
    expect(screen.queryByRole('button', { name: 'Submit scorecard' })).toBeNull();
  });
});

describe('B2V-1 ended interviews that still need my scorecard', () => {
  it('lists past interviews with a missing/draft scorecard (not submitted or cancelled); the deep link opens one', async () => {
    api.getApi.mockImplementation(async (p: string) => {
      if (p === '/me/interviews?scope=upcoming') return { data: [row({ id: 'up1', candidateName: 'Future Person' })] };
      if (p === '/me/interviews?scope=past') return { data: [
        row({ id: 'p1', candidateName: 'Nourhan Sami', scorecardStatus: 'missing' }),
        row({ id: 'p2', candidateName: 'Draft Person', scorecardStatus: 'draft' }),
        row({ id: 'p3', candidateName: 'Done Person', scorecardStatus: 'submitted' }),
        row({ id: 'p4', candidateName: 'Cancelled Person', status: 'Cancelled' }),
      ] };
      return [];
    });
    render(<MemoryRouter initialEntries={['/my-interviews?interview=p1&scorecard=1']}><MyInterviewsPage /></MemoryRouter>);
    const due = await screen.findByRole('list', { name: 'Ended interviews needing my scorecard' });
    expect(within(due).getAllByTestId('my-interview').map((c) => c.textContent)).toEqual([expect.stringContaining('Nourhan Sami'), expect.stringContaining('Draft Person')]);
    expect(screen.queryByText(/Cancelled Person/)).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Ended interviews with my submitted scorecard' })).getByText(/Done Person/)).toBeInTheDocument();
    expect(screen.getByText(/Future Person/)).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: /Scorecard — Nourhan Sami/ })).toBeInTheDocument();
  });
  it('a failing past list still shows upcoming', async () => {
    api.getApi.mockImplementation(async (p: string) => {
      if (p === '/me/interviews?scope=upcoming') return { data: [row()] };
      throw new ApiError(500, 'down');
    });
    renderPage();
    expect(await screen.findByTestId('my-interview')).toHaveTextContent('Ahmed Embaby');
  });
});

describe('B2F-3 deep link from My Work', () => {
  it('?interview=<id>&scorecard=1 opens that interview’s scorecard; ?interview alone marks the card', async () => {
    api.getApi.mockImplementation(async (p: string) => (p.startsWith('/me/interviews') ? { data: [row(), row({ id: 'iv2', candidateName: 'Nourhan Sami' })] } : []));
    const { unmount } = render(<MemoryRouter initialEntries={['/my-interviews?interview=iv2&scorecard=1']}><MyInterviewsPage /></MemoryRouter>);
    expect(await screen.findByRole('dialog', { name: /Scorecard — Nourhan Sami/ })).toBeInTheDocument();
    unmount();
    render(<MemoryRouter initialEntries={['/my-interviews?interview=iv2']}><MyInterviewsPage /></MemoryRouter>);
    const cards = await screen.findAllByTestId('my-interview');
    expect(cards[1]).toHaveAttribute('aria-current', 'true');
    expect(cards[0]).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});


describe('Interview screens functional review fixes (P1 & P2)', () => {
  it('P1: disables RSVP Accept/Decline and hides Request reschedule on Completed interviews', async () => {
    api.getApi.mockImplementation(async (p: string) =>
      p === '/me/interviews?scope=past'
        ? { data: [row({ id: 'past-1', status: 'Completed', scorecardStatus: 'submitted' })] }
        : { data: [] },
    );
    renderPage();
    const card = await screen.findByTestId('my-interview');
    expect(within(card).getByRole('button', { name: /^Accept$/ })).toBeDisabled();
    expect(within(card).getByRole('button', { name: /^Decline$/ })).toBeDisabled();
    expect(within(card).queryByRole('button', { name: /Request reschedule/i })).toBeNull();
  });

  it('P1: surfaces partial-load alert and retry button when past interview read fails', async () => {
    const u = userEvent.setup();
    let calls = 0;
    api.getApi.mockImplementation(async (p: string) => {
      if (p === '/me/interviews?scope=upcoming') return { data: [] };
      calls += 1;
      if (calls === 1) throw new ApiError(500, 'Synthetic past read failed');
      return { data: [row({ id: 'p-due', candidateName: 'Recovered Candidate', scorecardStatus: 'missing' })] };
    });
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Synthetic past read failed');
    const retryBtn = screen.getByRole('button', { name: /Retry ended interviews/i });
    await u.click(retryBtn);
    expect(await screen.findByText(/Recovered Candidate/)).toBeInTheDocument();
  });

  it('P1 & P2: future interview offers Prepare scorecard with Save draft enabled and Submit scorecard disabled with explanation', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) =>
      p.endsWith('/scorecard')
        ? []
        : p === '/me/interviews?scope=upcoming'
          ? { data: [row({ id: 'fut-1', scheduledStart: '2099-10-31T08:00:00Z', scheduledEnd: '2099-10-31T09:00:00Z' })] }
          : { data: [] },
    );
    api.postApi.mockResolvedValue({
      id: 'd1',
      interviewId: 'fut-1',
      interviewerId: 'me',
      overallRating: 4,
      recommendation: 'Hire',
      notes: 'Prepared clinical questions and initial CV notes',
      status: 'Draft',
      submittedAt: '2026-10-31T10:00:00Z',
    });
    renderPage();
    const prepBtn = await screen.findByRole('button', { name: 'Prepare scorecard' });
    await u.click(prepBtn);
    const dialog = await screen.findByRole('dialog');
    const submitBtn = within(dialog).getByRole('button', { name: 'Submit scorecard' });
    expect(submitBtn).toBeDisabled();
    expect(within(dialog).getByText(/Final submission unlocks once the interview starts/i)).toBeInTheDocument();

    const saveDraftBtn = within(dialog).getByRole('button', { name: 'Save draft' });
    expect(saveDraftBtn).toBeEnabled();
    await u.click(within(dialog).getByRole('radio', { name: '4' }));
    await u.type(within(dialog).getByRole('textbox', { name: /Written evidence/ }), 'Prepared clinical questions and initial CV notes');
    await u.click(saveDraftBtn);
    expect(api.postApi).toHaveBeenCalledWith('/interviews/fut-1/scorecard', {
      overallRating: 4,
      recommendation: 'Hire',
      notes: 'Prepared clinical questions and initial CV notes',
      status: 'Draft',
    });
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
  });

  it('P2: supports Request reschedule with required reason', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) =>
      p === '/me/interviews?scope=upcoming' ? { data: [row({ id: 'iv-resched' })] } : { data: [] },
    );
    api.postApi.mockResolvedValue({ id: 'iv-resched', response: 'Reschedule Requested' });
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Request reschedule' }));
    await u.click(screen.getByRole('button', { name: 'Send reschedule request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please include a reason when requesting a reschedule.');
    expect(api.postApi).not.toHaveBeenCalled();

    await u.type(screen.getByLabelText(/Reason for reschedule request/i), 'On-call ICU shift conflict');
    await u.click(screen.getByRole('button', { name: 'Send reschedule request' }));
    expect(api.postApi).toHaveBeenCalledWith('/interviews/iv-resched/response', {
      response: 'Reschedule Requested',
      note: 'On-call ICU shift conflict',
    });
    expect(await screen.findByText('Reschedule requested')).toBeInTheDocument();
  });

  it('P2: supports Revise scorecard on a submitted scorecard with a required reason', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) =>
      p.endsWith('/scorecard')
        ? [{ id: 's1', interviewId: 'iv1', interviewerId: 'me', overallRating: 4, recommendation: 'Hire', notes: 'Initial notes', status: 'Submitted', submittedAt: '2026-10-13T09:00:00Z' }]
        : p === '/me/interviews?scope=upcoming'
          ? { data: [row({ scorecardStatus: 'submitted' })] }
          : { data: [] },
    );
    api.postApi.mockResolvedValue({
      id: 's2',
      interviewId: 'iv1',
      interviewerId: 'me',
      overallRating: 5,
      recommendation: 'Strong Hire',
      notes: 'Updated notes after panel debrief',
      status: 'Submitted',
      submittedAt: '2026-10-13T10:00:00Z',
    });
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'View my scorecard' }));
    const revBtn = await screen.findByRole('button', { name: 'Revise scorecard' });
    await u.click(revBtn);

    await u.click(screen.getByRole('button', { name: 'Submit revision' }));
    expect(await screen.findByText(/Enter a reason for revising this scorecard/i)).toBeInTheDocument();

    await u.click(screen.getByRole('radio', { name: '5' }));
    await u.type(screen.getByLabelText(/Reason for revision/i), 'Panel debrief clarified practical coding test');
    await u.click(screen.getByRole('button', { name: 'Submit revision' }));
    expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/scorecard/revisions', {
      overallRating: 5,
      recommendation: 'Hire',
      notes: 'Initial notes',
      reason: 'Panel debrief clarified practical coding test',
    });
    expect(await screen.findByTestId('my-scorecard')).toHaveTextContent('5 of 5');
  });

  it('P2: immediately moves an ended interview from Scorecard due to Submitted scorecards upon submission', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) => {
      if (p === '/me/interviews?scope=upcoming') return { data: [] };
      if (p === '/me/interviews?scope=past') return { data: [row({ id: 'p-move', candidateName: 'Kareem Fathy', scorecardStatus: 'missing' })] };
      return [];
    });
    api.postApi.mockResolvedValue({
      id: 's-move',
      interviewId: 'p-move',
      interviewerId: 'me',
      overallRating: 4,
      recommendation: 'Hire',
      notes: 'Strong troubleshooting',
      status: 'Submitted',
      submittedAt: '2026-10-13T09:00:00Z',
    });
    renderPage();
    const dueList = await screen.findByRole('list', { name: 'Ended interviews needing my scorecard' });
    expect(within(dueList).getByText(/Kareem Fathy/)).toBeInTheDocument();

    await u.click(within(dueList).getByRole('button', { name: 'Fill scorecard' }));
    const dialog = await screen.findByRole('dialog');
    await u.click(within(dialog).getByRole('radio', { name: '4' }));
    await u.type(within(dialog).getByRole('textbox', { name: /Written evidence/ }), 'Strong troubleshooting');
    await u.click(within(dialog).getByRole('button', { name: 'Submit scorecard' }));

    await waitFor(() => {
      expect(screen.queryByRole('list', { name: 'Ended interviews needing my scorecard' })).toBeNull();
    });
    const doneList = await screen.findByRole('list', { name: 'Ended interviews with my submitted scorecard' });
    expect(within(doneList).getByText(/Kareem Fathy/)).toBeInTheDocument();
  });

  it('P2: handles subsequent deep-link navigation to a different interview on the same mounted page', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) =>
      p.endsWith('/scorecard')
        ? []
        : p === '/me/interviews?scope=upcoming'
          ? {
              data: [
                row({ id: 'iv1', candidateName: 'Ahmed Embaby' }),
                row({ id: 'iv2', candidateName: 'Nourhan Sami' }),
              ],
            }
          : { data: [] },
    );
    render(
      <MemoryRouter initialEntries={['/my-interviews?interview=iv1&scorecard=1']}>
        <Link to="/my-interviews?interview=iv2&scorecard=1">Open second deep link</Link>
        <MyInterviewsPage />
      </MemoryRouter>,
    );
    const firstDialog = await screen.findByRole('dialog');
    expect(within(firstDialog).getByRole('heading', { name: /Scorecard — Ahmed Embaby/ })).toBeInTheDocument();

    await u.click(within(firstDialog).getByRole('button', { name: 'Cancel' }));
    await u.click(screen.getByRole('link', { name: 'Open second deep link' }));

    const secondDialog = await screen.findByRole('dialog');
    expect(within(secondDialog).getByRole('heading', { name: /Scorecard — Nourhan Sami/ })).toBeInTheDocument();
  });

  it('P2: prompts before discarding unsaved scorecard edits', async () => {
    const u = userEvent.setup();
    api.getApi.mockImplementation(async (p: string) =>
      p.endsWith('/scorecard')
        ? []
        : p === '/me/interviews?scope=upcoming'
          ? { data: [row({ id: 'iv-dirty' })] }
          : { data: [] },
    );
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Fill scorecard' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('button', { name: 'Submit scorecard' });
    await u.type(within(dialog).getByRole('textbox', { name: /Written evidence/ }), 'Half-written evaluation');
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(await within(dialog).findByText(/You have unsaved scorecard edits/i)).toBeInTheDocument();
    await u.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await u.click(within(dialog).getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
