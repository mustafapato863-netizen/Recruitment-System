import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CandidateActivityPanel } from './CandidateActivityPanel';
import { getApi, postApi } from '../../api/client';

const auth = vi.hoisted(() => ({ user: { permissions: ['CANDIDATE_VIEW', 'CANDIDATE_EDIT'] } }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/client', () => ({ getApi: vi.fn(), postApi: vi.fn() }));
const empty = { completed: 0, completedByMe: 0, pending: 0, overdue: 0, lastActivityAt: null, nextFollowUpAt: null, byKind: {}, byRecruiter: [], entries: [], totalEntries: 0, page: 1, pageSize: 20 };

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = ['CANDIDATE_VIEW', 'CANDIDATE_EDIT'];
  vi.mocked(getApi).mockResolvedValue(empty);
  vi.mocked(postApi).mockResolvedValue({ id: 'saved' });
});
describe('Candidate activity interaction', () => {
  it('retains the entered outcome when saving fails and never shows success', async () => {
    vi.mocked(postApi).mockRejectedValue(new Error('Unable to save'));
    render(<CandidateActivityPanel candidateId="candidate" />);
    await screen.findByText('No activities recorded yet.');
    fireEvent.change(screen.getByLabelText('Call outcome / summary'), { target: { value: 'Reached candidate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log completed activity' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
    expect(screen.getByLabelText('Call outcome / summary')).toHaveValue('Reached candidate');
    expect(screen.queryByText('Activity saved.')).not.toBeInTheDocument();
  });
  it('does not expose mutation controls to a read-only user', async () => {
    auth.user.permissions = ['CANDIDATE_VIEW'];
    render(<CandidateActivityPanel candidateId="candidate" />);
    await screen.findByText('No activities recorded yet.');
    expect(screen.queryByLabelText('Call outcome / summary')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log completed activity' })).not.toBeInTheDocument();
  });
  it('shows failed loading as an error rather than zero activities', async () => {
    vi.mocked(getApi).mockRejectedValue(new Error('Access denied'));
    render(<CandidateActivityPanel candidateId="candidate" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
    expect(screen.queryByText('No activities recorded yet.')).not.toBeInTheDocument();
  });
  it('clears a saved summary and reloads server totals', async () => {
    render(<CandidateActivityPanel candidateId="candidate" />);
    await screen.findByText('No activities recorded yet.');
    fireEvent.change(screen.getByLabelText('Call outcome / summary'), { target: { value: '  Reached candidate  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log completed activity' }));
    await waitFor(() => expect(postApi).toHaveBeenCalledWith('/candidates/candidate/activities', { kind: 'Call', summary: 'Reached candidate' }));
    expect(await screen.findByText('Activity saved.')).toBeVisible();
    expect(screen.getByLabelText('Call outcome / summary')).toHaveValue('');
    expect(getApi).toHaveBeenCalledTimes(2);
  });

  it('saves a completed call and the next follow-up in one request, and retries with the same idempotency key', async () => {
    const local = '2026-11-02T09:30';
    const iso = new Date(local).toISOString();
    vi.mocked(postApi).mockRejectedValueOnce(new Error('Unable to save')).mockResolvedValue({ id: 'saved', followUpId: 'follow' });
    render(<CandidateActivityPanel candidateId="candidate" />);
    await screen.findByText('No activities recorded yet.');
    fireEvent.change(screen.getByLabelText('Call outcome / summary'), { target: { value: 'Reached candidate' } });
    fireEvent.change(screen.getByLabelText('Next follow-up date & time (after completed call)'), { target: { value: local } });
    fireEvent.change(screen.getByLabelText('Next follow-up note'), { target: { value: 'Call about the offer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log completed activity' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
    expect(screen.getByLabelText('Call outcome / summary')).toHaveValue('Reached candidate');
    expect(screen.getByLabelText('Next follow-up date & time (after completed call)')).toHaveValue(local);
    expect(screen.getByLabelText('Next follow-up note')).toHaveValue('Call about the offer');
    expect(screen.queryByText('Activity and follow-up saved.')).not.toBeInTheDocument();
    const first = vi.mocked(postApi).mock.calls[0]?.[1] as { idempotencyKey: string };
    expect(first).toEqual({ kind: 'Call', summary: 'Reached candidate', followUpDueAt: iso, followUpSummary: 'Call about the offer', idempotencyKey: first.idempotencyKey });
    expect(first.idempotencyKey).toEqual(expect.any(String));
    fireEvent.click(screen.getByRole('button', { name: 'Log completed activity' }));
    await waitFor(() => expect(postApi).toHaveBeenCalledTimes(2));
    expect(vi.mocked(postApi).mock.calls[1]?.[1]).toEqual(first);
    expect(await screen.findByText('Activity and follow-up saved.')).toBeVisible();
    expect(screen.getByLabelText('Call outcome / summary')).toHaveValue('');
    expect(screen.getByLabelText('Next follow-up date & time (after completed call)')).toHaveValue('');
    expect(screen.getByLabelText('Next follow-up note')).toHaveValue('');
  });

  it('names the person context, the UTC storage zone, completion, and reschedule history', async () => {
    vi.mocked(getApi).mockResolvedValue({
      ...empty,
      completed: 1,
      entries: [{
        id: 'task:1', kind: 'FollowUp', title: 'FollowUp activity', actorId: 'me', actorName: 'Mariam Farag',
        at: '2026-10-01T08:00:00.000Z', dueAt: '2026-10-03T08:00:00.000Z', status: 'Completed', applicationId: null, canComplete: false,
        detail: 'Call again\n[Rescheduled 2026-10-02T08:00:00.000Z -> 2026-10-03T08:00:00.000Z]',
      }],
      totalEntries: 1,
    });
    render(<CandidateActivityPanel candidateId="candidate" contextLabel="Person contact & timed follow-up — shared across this person's applications (distinct from application follow-up date)" />);
    expect(await screen.findByText(/Person contact & timed follow-up — shared across this person's applications/)).toBeInTheDocument();
    expect(screen.getByText(/Timezone: local browser time/)).toBeInTheDocument();
    expect(screen.getByText(/saved as UTC ISO-8601/)).toBeInTheDocument();
    expect(screen.getByText(/Africa\/Cairo/)).toBeInTheDocument();
    expect(screen.getByText(/Completed by Mariam Farag/)).toBeInTheDocument();
    expect(screen.getByText(/\[Rescheduled 2026-10-02T08:00:00.000Z -> 2026-10-03T08:00:00.000Z\]/)).toBeInTheDocument();
  });

  it('shows only the first 5 activities with a Show more control, and expands/collapses', async () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({
      id: `e${i + 1}`,
      kind: 'Call',
      title: `Activity ${i + 1}`,
      actorId: 'me',
      actorName: 'Mariam Farag',
      at: '2026-10-01T08:00:00.000Z',
      dueAt: null,
      status: 'Completed',
      applicationId: null,
      canComplete: false,
      detail: null,
    }));
    vi.mocked(getApi).mockResolvedValue({ ...empty, completed: 7, entries, totalEntries: 7 });
    render(<CandidateActivityPanel candidateId="candidate" />);

    await screen.findByText('Activity 1');
    expect(screen.getByText('Activity 5')).toBeInTheDocument();
    expect(screen.queryByText('Activity 6')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity 7')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show 2 more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByText('Activity 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByText('Activity 6')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show 2 more' })).toBeInTheDocument();
  });

  it('does not show a Show more control when there are 5 or fewer activities', async () => {
    const entries = Array.from({ length: 3 }, (_, i) => ({
      id: `e${i + 1}`,
      kind: 'Call',
      title: `Activity ${i + 1}`,
      actorId: 'me',
      actorName: 'Mariam Farag',
      at: '2026-10-01T08:00:00.000Z',
      dueAt: null,
      status: 'Completed',
      applicationId: null,
      canComplete: false,
      detail: null,
    }));
    vi.mocked(getApi).mockResolvedValue({ ...empty, completed: 3, entries, totalEntries: 3 });
    render(<CandidateActivityPanel candidateId="candidate" />);

    await screen.findByText('Activity 1');
    expect(screen.getByText('Activity 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show \d+ more/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show less' })).not.toBeInTheDocument();
  });

  it('keeps the four activity stats in a 2-column grid so labels never squeeze mid-word', async () => {
    vi.mocked(getApi).mockResolvedValue({ ...empty, completed: 2, completedByMe: 1, pending: 1, overdue: 0 });
    render(<CandidateActivityPanel candidateId="candidate" />);

    await screen.findByText('Completed');
    expect(screen.getByText('By me')).toBeInTheDocument();
    expect(screen.getByText('Follow-ups')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    // Regression pin: the rail is ~360px wide, so the old sm:grid-cols-4 layout
    // squeezed each stat chip until labels broke mid-word ("Complet ed").
    const statsGrid = screen.getByText('Completed').parentElement?.parentElement;
    expect(statsGrid).toHaveClass('grid-cols-2');
    expect(statsGrid).not.toHaveClass('sm:grid-cols-4');
  });
});
