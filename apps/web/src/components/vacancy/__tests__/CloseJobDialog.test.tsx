import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';

const api = vi.hoisted(() => ({ getApi: vi.fn(), deleteApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
import { CloseJobDialog, closeJobError } from '../CloseJobDialog';

describe('#23 603d44d DELETE /vacancies/:id {reason, note?}', () => {
  it('sends a close-list reason, and a note for Other', async () => {
    const u = userEvent.setup();
    api.getApi.mockResolvedValue([{ name: 'Filled elsewhere', status: 'Active' }, { name: 'Other', status: 'Active' }, { name: 'Old', status: 'Archived' }]);
    api.deleteApi.mockResolvedValue({});
    const onClosed = vi.fn();
    render(<CloseJobDialog isOpen jobId="v1" onClose={() => {}} onClosed={onClosed} />);
    const sel = await screen.findByRole('combobox');
    expect(screen.queryByRole('option', { name: 'Old' })).toBeNull();
    await u.selectOptions(sel, 'Other');
    await u.click(screen.getByRole('button', { name: 'Close job' }));
    expect(screen.getByText('"Other" needs a short note (at least 3 characters).')).toBeInTheDocument();
    await u.type(screen.getByLabelText('Say why'), 'Budget cut');
    await u.click(screen.getByRole('button', { name: 'Close job' }));
    await waitFor(() => expect(api.deleteApi).toHaveBeenCalledWith('/vacancies/v1', { reason: 'Other', note: 'Budget cut' }));
    expect(onClosed).toHaveBeenCalled();
  });
  it('maps JOB_NOT_OWNED, JOB_HAS_OPEN_APPLICATIONS and REASON_REQUIRED', () => {
    expect(closeJobError(new ApiError(403, 'x', { code: 'JOB_NOT_OWNED' }, { code: 'JOB_NOT_OWNED' })).text).toMatch(/owner or their manager/);
    expect(closeJobError(Object.assign(new ApiError(409, 'x', {}, { code: 'JOB_HAS_OPEN_APPLICATIONS' }), { counts: { openApplications: 2 } })).text).toBe('This job still has 2 open files. Close or move them first.');
    expect(closeJobError(new ApiError(400, 'need', { code: 'REASON_REQUIRED', field: 'reason' }, { code: 'REASON_REQUIRED' })).field).toBe('reason');
  });
});
