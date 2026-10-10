import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import type { MyResult } from '../../api/myResult';

const api = vi.hoisted(() => ({ getApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'employee' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
import { MyResultV2 } from '../MyResultV2';
import { cairoMonth, fetchMyResult } from '../../api/myResult';

const result = (over: Partial<MyResult> = {}): MyResult & Record<string, unknown> => ({
  scope: 'me', month: '2026-10', period: 'monthly', timezone: 'Africa/Cairo', vacancy: { id: 'v1', title: 'HRIS Developer' },
  seats: { value: 1, of: 3, sampleSize: 6, detail: null, dueDate: '2026-10-19T00:00:00Z' },
  overdueFollowUps: { value: 1, of: null, sampleSize: 9, detail: 'Salma Adel · follow-up date was 7 Oct' },
  screensReachedInterview: { value: 1, of: 2, sampleSize: 2, detail: 'Ahmed Embaby → Interview · Khaled Mahmoud still in Screening' },
  offersAccepted: { value: 0, of: 0, sampleSize: 0, detail: null },
  monthlySalary: 42000, ...over,
});
const renderAt = (path = '/my-result?job=v1&month=2026-10') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/my-result" element={<MyResultV2 />} /><Route path="/my-work" element={<p>my work</p>} /></Routes></MemoryRouter>);
};
beforeEach(() => { api.getApi.mockReset(); shell.value = { seat: 'employee' }; });

describe('E04 My result', () => {
  it('calls the provisional contract; four tiles; sample counts; "Too few to judge" under 5; no pay; axe', async () => {
    api.getApi.mockResolvedValue(result());
    const { container } = renderAt();
    expect(await screen.findByRole('region', { name: 'Seats' })).toHaveTextContent(/1 of 3 filled.*Due 19 Oct 2026.*Based on 6 records.*Open seats: 2/);
    expect(api.getApi).toHaveBeenCalledWith('/results/me?month=2026-10&vacancyId=v1');
    expect(screen.getByText('October 2026 · monthly · HRIS Developer only.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Overdue follow-ups' })).toHaveTextContent(/^Overdue follow-ups1past their follow-up dateSalma Adel · follow-up date was 7 OctBased on 9 records/);
    const screens = screen.getByRole('region', { name: 'Screens with a note' });
    expect(within(screens).getByText('Too few to judge')).toBeInTheDocument();
    expect(screens).toHaveTextContent('2 so far');
    expect(screens).toHaveTextContent('Based on 2 records · needs 5');
    expect(screen.getByRole('region', { name: 'Offers accepted against sent' })).toHaveTextContent(/Too few to judge.*0 of 0 so far.*Based on 0 records · needs 5/);
    expect(container.textContent).not.toMatch(/42000|salary|%/i);
    expect(await axeViolations(container)).toEqual([]);
  });
  it('exactly 5 samples is judged', async () => {
    api.getApi.mockResolvedValue(result({ offersAccepted: { value: 3, of: 5, sampleSize: 5, detail: null } }));
    renderAt();
    expect(await screen.findByRole('region', { name: 'Offers accepted against sent' })).toHaveTextContent(/3 of 5accepted of sentBased on 5 records$/);
  });
  it('404 (B8 not built) → honest unavailable state, no fixtures', async () => {
    api.getApi.mockRejectedValue(new ApiError(404, 'Cannot GET /api/v1/results/me'));
    renderAt('/my-result');
    expect(await screen.findByText('My result is not available yet')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Seats' })).not.toBeInTheDocument();
    expect(api.getApi).toHaveBeenCalledWith(`/results/me?month=${cairoMonth()}`);
  });
  it('malformed body → unavailable; 403 → forbidden; 500 → retry', async () => {
    api.getApi.mockResolvedValueOnce({ hello: 1 });
    expect(await fetchMyResult('2026-10')).toEqual({ kind: 'unavailable' });
    api.getApi.mockRejectedValueOnce(new ApiError(403, 'no'));
    const { unmount } = renderAt();
    expect(await screen.findByText(/does not include results/)).toBeInTheDocument();
    unmount();
    const u = userEvent.setup();
    api.getApi.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(result());
    renderAt();
    await u.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Seats' })).toBeInTheDocument();
  });
  it('v2 Employee only: other seats go to My Work without calling the API', async () => {
    shell.value = null;
    renderAt();
    expect(await screen.findByText('my work')).toBeInTheDocument();
    expect(api.getApi).not.toHaveBeenCalled();
  });
});
