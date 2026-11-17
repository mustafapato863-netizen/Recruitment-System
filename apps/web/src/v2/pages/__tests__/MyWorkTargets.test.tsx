import { useState } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeTargetItem, TargetPeriodType } from '../../api/myResult';
import { MyWorkTargets } from '../MyWorkTargets';

const api = vi.hoisted(() => ({ getApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const target = (extra: Partial<EmployeeTargetItem> = {}): EmployeeTargetItem => ({
  id: 'target-screening', employeeId: 'employee-1', employeeName: 'Sample Recruiter',
  metric: 'screenings_completed', metricLabel: 'Screenings completed', periodType: 'monthly',
  periodKey: '2026-11', periodLabel: 'November 2026', vacancyId: null, jobTitle: null,
  target: 20, achieved: 8, remaining: 12, progressPercent: 40,
  records: [{ id: 'event-1', applicationId: 'app-1', candidateName: 'Sample Candidate', jobTitle: 'Registered Nurse', date: '2026-11-02', dateLabel: 'Completed', status: 'Completed', counted: true }],
  ...extra,
});
function renderTargets(canOpenFile = true) {
  function Host() {
    const [period, setPeriod] = useState<TargetPeriodType>('monthly');
    return <MyWorkTargets today="2026-11-02" employeeId="employee-1" period={period} onPeriod={setPeriod} returnTo="/my-work" canOpenFile={canOpenFile} refreshKey={0} />;
  }
  return render(<MemoryRouter><Host /></MemoryRouter>);
}
beforeEach(() => { api.getApi.mockReset(); api.getApi.mockResolvedValue({ targets: [target()] }); });

describe('Personal target cards in My Work', () => {
  it('loads the server-defined month and displays the real goal, achievement, remainder and progress', async () => {
    renderTargets();
    const list = await screen.findByRole('list', { name: 'Monthly targets' });
    expect(api.getApi).toHaveBeenCalledExactlyOnceWith('/results/targets?scope=me&periodType=monthly&periodKey=2026-11');
    expect(within(list).getByRole('heading', { name: 'Screenings completed' })).toBeInTheDocument();
    expect(list).toHaveTextContent('8 / 20');
    expect(list).toHaveTextContent('12 remaining');
    expect(within(list).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('switches to the correct ISO week and opens only the supporting records for that target', async () => {
    const user = userEvent.setup();
    api.getApi.mockImplementation(async (path: string) => ({ targets: [target(path.includes('weekly') ? { achieved: 3, target: 5, remaining: 2, progressPercent: 60, periodType: 'weekly', periodKey: '2026-W45', periodLabel: 'Week of 2 Nov 2026' } : {})] }));
    renderTargets();
    await screen.findByRole('list', { name: 'Monthly targets' });
    await user.click(screen.getByRole('button', { name: 'Weekly' }));
    const list = await screen.findByRole('list', { name: 'Weekly targets' });
    expect(list).toHaveTextContent('3 / 5');
    expect(api.getApi).toHaveBeenLastCalledWith('/results/targets?scope=me&periodType=weekly&periodKey=2026-W45');
    await user.click(within(list).getByRole('button', { name: 'View records for Screenings completed' }));
    const dialog = screen.getByRole('dialog', { name: 'Screenings completed' });
    expect(dialog).toHaveTextContent('Sample Candidate');
    expect(within(dialog).getByRole('link', { name: 'Open file for Sample Candidate' })).toHaveAttribute('href', '/applications/app-1?returnTo=%2Fmy-work');
  });

  it('ignores an old weekly response after switching back to monthly', async () => {
    const user = userEvent.setup();
    let finishWeek: ((result: { targets: EmployeeTargetItem[] }) => void) | undefined;
    const weekly = new Promise<{ targets: EmployeeTargetItem[] }>((resolve) => { finishWeek = resolve; });
    api.getApi.mockImplementation((path: string) => path.includes('weekly') ? weekly : Promise.resolve({ targets: [target()] }));
    renderTargets();
    await screen.findByRole('list', { name: 'Monthly targets' });
    await user.click(screen.getByRole('button', { name: 'Weekly' }));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Monthly' }));
    await screen.findByRole('list', { name: 'Monthly targets' });
    await act(async () => { finishWeek?.({ targets: [target({ achieved: 99 })] }); });
    expect(screen.getByRole('list', { name: 'Monthly targets' })).toHaveTextContent('8 / 20');
    expect(screen.queryByText('99')).not.toBeInTheDocument();
  });

  it('shows an explicit empty period rather than inventing zero-valued target cards', async () => {
    api.getApi.mockResolvedValue({ targets: [] });
    renderTargets();
    expect(await screen.findByText('No targets assigned for this month.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('treats malformed target data as unavailable and allows retry', async () => {
    const user = userEvent.setup();
    api.getApi.mockResolvedValueOnce({}).mockResolvedValue({ targets: [target()] });
    renderTargets();
    expect(await screen.findByRole('alert')).toHaveTextContent('Target data is unavailable.');
    expect(screen.queryByText('No targets assigned for this month.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry targets' }));
    expect(await screen.findByRole('list', { name: 'Monthly targets' })).toHaveTextContent('8 / 20');
  });

  it('does not request targets or expose application links without the permission required by the API', () => {
    renderTargets(false);
    expect(api.getApi).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'My targets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('preserves achievement above target while keeping the visual progress within its bounds', async () => {
    api.getApi.mockResolvedValue({ targets: [target({ achieved: 24, target: 20, remaining: 0, progressPercent: 120 })] });
    renderTargets();
    const progress = await screen.findByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '100');
    expect(progress).toHaveAttribute('aria-valuetext', '24 of 20, 120% complete');
    expect(screen.getByRole('list', { name: 'Monthly targets' })).toHaveTextContent('24 / 20');
  });
});
