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
  timezone: 'Africa/Cairo', candidateName: 'Ahmed Embaby', positionTitle: 'HRIS Developer', locationUrl: 'https://rooms.example.test/sg-4',
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
    expect(r.available && Object.keys(r.items[0]).sort()).toEqual(['candidateName', 'id', 'interviewType', 'locationUrl', 'myResponse', 'positionTitle', 'scheduledEnd', 'scheduledStart', 'scorecardStatus', 'status', 'timezone', 'title']);
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
    api.postApi.mockResolvedValue({ id: 's1', interviewId: 'iv1', interviewerId: 'me', overallRating: 4, recommendation: 'Hire', notes: 'Built payroll exports', isLocked: false, submittedAt: '2026-10-13T09:00:00Z' });
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
      ? [{ id: 's1', interviewId: 'iv1', interviewerId: 'me', overallRating: 5, recommendation: 'Strong Hire', notes: 'Great', isLocked: true, submittedAt: '2026-10-13T09:00:00Z' }]
      : { data: [row({ scorecardStatus: 'submitted' })] }));
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'View my scorecard' }));
    expect(await screen.findByTestId('my-scorecard')).toHaveTextContent('Strong Hire');
    expect(api.getApi).toHaveBeenCalledWith('/interviews/iv1/scorecard');
    expect(screen.queryByRole('button', { name: 'Submit scorecard' })).not.toBeInTheDocument();
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
