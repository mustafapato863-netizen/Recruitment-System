import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApi, postApi } from '../../../api/client';
import { FinalApprovalInboxV2 } from '../FinalApprovalInboxV2';

vi.mock('../../../api/client', () => ({ getApi: vi.fn(), postApi: vi.fn() }));
const fetchApprovals = vi.mocked(getApi);
const saveApproval = vi.mocked(postApi);
const record = {
  id: 'case-1', applicationId: 'app-1', candidateName: 'Nora Ali',
  positionTitle: 'Registered Nurse', branchName: 'Main Hospital', status: 'Pending Final Approval',
};
function show() {
  return render(<MemoryRouter><FinalApprovalInboxV2 /></MemoryRouter>);
}

describe('FinalApprovalInboxV2', () => {
  beforeEach(() => {
    fetchApprovals.mockReset();
    saveApproval.mockReset();
    saveApproval.mockResolvedValue({} as never);
  });

  it('loads pending records with the restricted application file link and confirms authorization', async () => {
    const user = userEvent.setup();
    fetchApprovals.mockResolvedValueOnce([record]).mockResolvedValueOnce([]);
    show();
    expect(await screen.findByRole('link', { name: 'Review case' })).toHaveAttribute('href', '/applications/app-1');
    expect(saveApproval).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Authorize hire' }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(/Check the candidate file/)).toBeInTheDocument();
    expect(saveApproval).not.toHaveBeenCalled();
    await user.click(within(modal).getByRole('button', { name: 'Confirm authorization' }));
    await waitFor(() => expect(saveApproval).toHaveBeenCalledWith('/hiring/case-1/final-approval', {
      decision: 'Approve', comment: 'Final hiring decision authorized from the approval inbox.',
    }));
    expect(await screen.findByText('Final approval inbox is clear')).toBeInTheDocument();
  });

  it('requires a rejection reason and keeps the modal open on API error', async () => {
    const user = userEvent.setup();
    fetchApprovals.mockResolvedValue([record]);
    saveApproval.mockRejectedValueOnce(new Error('Approval conflict')).mockResolvedValueOnce({} as never);
    show();
    await screen.findByRole('link', { name: 'Review case' });
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const modal = screen.getByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: 'Confirm rejection' }));
    expect(within(modal).getByRole('alert')).toHaveTextContent('A rejection reason is required.');
    expect(saveApproval).not.toHaveBeenCalled();
    await user.type(within(modal).getByRole('textbox', { name: 'Reason (required)' }), 'The required license is missing.');
    await user.click(within(modal).getByRole('button', { name: 'Confirm rejection' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Approval conflict');
    expect(saveApproval).toHaveBeenCalledWith('/hiring/case-1/final-approval', {
      decision: 'Reject', comment: 'The required license is missing.',
    });
  });

  it('shows a retry when the inbox cannot load instead of displaying false zero pending', async () => {
    const user = userEvent.setup();
    fetchApprovals.mockRejectedValueOnce(new Error('Database unavailable')).mockResolvedValueOnce([record]);
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    expect(screen.queryByText('Final approval inbox is clear')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Review case' })).toBeInTheDocument();
  });

  // Meeting notes 2026-11-25 (item 4): approvers see the expected joining date.
  it('shows the expected joining date in the inbox, or Not set when there is none', async () => {
    fetchApprovals.mockResolvedValue([
      { ...record, plannedJoiningDate: '2026-12-15T00:00:00.000Z' },
      { ...record, id: 'case-2', candidateName: 'Omar Hassan', plannedJoiningDate: null },
    ]);
    show();
    const table = await screen.findByRole('table', { name: 'Pending final hiring approvals' });
    expect(within(table).getByText('15/12/2026')).toBeInTheDocument();
    expect(within(table).getByText('Not set')).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Expected joining' })).toBeInTheDocument();
  });
});
