import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
    await u.click(screen.getByRole('button', { name: 'Submit scorecard' }));
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
    expect(screen.queryByText(/Done Person|Cancelled Person/)).toBeNull();
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
