import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { fetchMyWorkActivity } = vi.hoisted(() => ({ fetchMyWorkActivity: vi.fn() }));
vi.mock('../../api/myWorkActivity', () => ({ fetchMyWorkActivity }));
import { MyWorkActivity } from '../MyWorkActivity';
const sample = { id: 'a1', name: 'Sample Candidate', job: 'Registered Nurse', stage: 'Interview', updatedAt: '2026-11-02T10:00:00Z' };
const props = { employeeId: 'me', canView: true, refreshKey: 0, returnTo: '/my-work?targetPeriod=weekly', timezone: 'Africa/Cairo' };
const element = (patch: Partial<typeof props> = {}) => <MemoryRouter><MyWorkActivity {...props} {...patch} /></MemoryRouter>;
beforeEach(() => fetchMyWorkActivity.mockReset());
describe('Last activity', () => {
  it('shows saved application context, update time, and a return-aware file link', async () => {
    fetchMyWorkActivity.mockResolvedValue([sample]);
    render(element());
    const link = await screen.findByRole('link', { name: 'Open activity for Sample Candidate' });
    expect(link).toHaveAttribute('href', '/applications/a1?returnTo=%2Fmy-work%3FtargetPeriod%3Dweekly');
    expect(link).toHaveTextContent('Registered Nurse');
    expect(link).toHaveTextContent('Interview');
    expect(link.querySelector('time')).toHaveAttribute('dateTime', sample.updatedAt);
    expect(fetchMyWorkActivity).toHaveBeenCalledWith('me');
  });
  it('distinguishes an unavailable read from an empty list and retries independently', async () => {
    fetchMyWorkActivity.mockRejectedValueOnce(new Error('Server down')).mockResolvedValueOnce([]);
    render(element());
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load recent activity.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry activity' }));
    expect(await screen.findByText('No recent updates on your assigned applications.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('does not request or expose application activity without permission', () => {
    render(element({ canView: false }));
    expect(screen.queryByRole('region', { name: 'Last activity' })).not.toBeInTheDocument();
    expect(fetchMyWorkActivity).not.toHaveBeenCalled();
  });
  it('ignores an old account response after the active account changes', async () => {
    let release: (items: typeof sample[]) => void = () => {};
    fetchMyWorkActivity.mockImplementation((id: string) => id === 'me' ? new Promise(resolve => { release = resolve; }) : Promise.resolve([{ ...sample, name: 'New Account Candidate' }]));
    const view = render(element());
    view.rerender(element({ employeeId: 'new-account' }));
    await screen.findByText('New Account Candidate');
    await act(async () => release([sample]));
    expect(screen.queryByText('Sample Candidate')).not.toBeInTheDocument();
    expect(screen.getByText('New Account Candidate')).toBeInTheDocument();
  });
  it('refreshes after the parent workflow reloads', async () => {
    fetchMyWorkActivity.mockResolvedValue([sample]);
    const view = render(element());
    await screen.findByText('Sample Candidate');
    view.rerender(element({ refreshKey: 1 }));
    await waitFor(() => expect(fetchMyWorkActivity).toHaveBeenCalledTimes(2));
  });
});
