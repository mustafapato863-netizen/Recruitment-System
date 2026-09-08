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
});
