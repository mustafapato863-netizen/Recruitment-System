import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';

const api = vi.hoisted(() => ({ getApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'manager' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../../../pages/ReportsPage', () => ({ ReportsPage: () => <p>v1 reports</p> }));
import { ReportsRoute } from '../ReportsRoute';
import { cairoMonth } from '../../api/myResult';

const tile = (value: number, of: number, sampleSize: number, detail: string, tooFewToJudge: boolean) => ({ value, of, sampleSize, detail, tooFewToJudge });
/** Exact B8 #20 /results/team shape (plus pay a bad screen might show). */
const team = (extra: Record<string, unknown> = {}) => ({
  scope: 'team', month: '2026-10', range: { from: '2026-10-01', to: '2026-10-31' }, filters: { vacancyId: null, managerId: null },
  people: [{ id: 'u-y', name: 'Youssef Ibrahim' }, { id: 'u-m', name: 'Mariam Farag' }, { id: 'u-n', name: 'Noura Al-Dosari' }],
  tiles: {
    seats: tile(4, 8, 3, '3 jobs', false), overdueFollowUps: tile(3, 24, 24, '3 of 24 follow-ups due', false),
    screensReachedInterview: tile(5, 10, 10, '5 of 10 screens', false), offersAccepted: tile(3, 4, 4, '3 of 4 sent', true),
  },
  salaryBudget: 999999, ...extra,
});
const renderAt = (path = '/reports') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Suspense fallback="…"><Routes><Route path="/reports" element={<ReportsRoute />} /></Routes></Suspense></MemoryRouter>);
};
beforeEach(() => { vi.clearAllMocks(); shell.value = { seat: 'manager' }; api.getApi.mockResolvedValue(team()); });

describe('M4 Team result (B8 /results/team)', () => {
  it('team row from server tiles, people A–Z, tooFewToJudge from the server, no ranking, no pay; axe', async () => {
    const { container } = renderAt();
    expect(await screen.findByText(/Your 3 direct reports, alphabetical, not ranked\./)).toBeInTheDocument();
    expect(api.getApi).toHaveBeenCalledWith(`/results/team?month=${cairoMonth()}`);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[0]).toHaveTextContent('RecruiterSeatsOverdue follow-upsScreen → interviewOffers acceptedSample');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent('Your teamMariam Farag, Noura Al-Dosari, Youssef Ibrahim');
    expect(rows[1]).toHaveTextContent(/4 of 8.*3 jobs.*3.*3 of 24 follow-ups due.*5 of 10.*3 of 4.*24 follow-ups · 10 screens · 4 offers.*Too few to judge/);
    expect(screen.getByText(/One row for the whole team/)).toBeInTheDocument();
    expect(screen.getByText(/no previous-period comparison/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/999|#\d|vs previous/i);
    expect(await axeViolations(container)).toEqual([]);
  });
  it('seats are exempt even if the server flags them; the under-5 fallback only when the flag is missing', async () => {
    const t = team();
    t.tiles.seats.tooFewToJudge = true;
    t.tiles.offersAccepted = { value: 1, of: 2, sampleSize: 2, detail: '' } as never;
    t.tiles.overdueFollowUps.tooFewToJudge = false;
    api.getApi.mockResolvedValue(t);
    renderAt();
    const row = within(await screen.findByRole('table')).getAllByRole('row')[1];
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]).not.toHaveAttribute('data-too-few');
    expect(cells[3]).toHaveAttribute('data-too-few', 'true');
    expect(row).toHaveTextContent('Too few to judge');
  });
  it('per-recruiter rows when the API provides rows[] (optional, A–Z)', async () => {
    const tiles = team().tiles;
    api.getApi.mockResolvedValue(team({ rows: [{ person: { id: 'u-y', name: 'Youssef Ibrahim' }, tiles }, { person: { id: 'u-m', name: 'Mariam Farag' }, tiles }, { person: { id: 'bad' } }] }));
    renderAt();
    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['MFMariam Farag', 'YIYoussef Ibrahim']);
    expect(screen.queryByText(/One row for the whole team/)).toBeNull();
  });
  it('month nav: previous month; next disabled on the current month', async () => {
    const u = userEvent.setup();
    renderAt();
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Previous month' }));
    await waitFor(() => expect(api.getApi).toHaveBeenLastCalledWith(expect.stringMatching(/^\/results\/team\?month=\d{4}-\d{2}$/)));
    expect(api.getApi.mock.calls.at(-1)![0]).not.toBe(`/results/team?month=${cairoMonth()}`);
  });
  it('403 (no direct reports) → explained; 404 → not available; 500 → retry', async () => {
    const u = userEvent.setup();
    api.getApi.mockRejectedValueOnce(new ApiError(403, 'no reports'));
    const { unmount } = renderAt();
    expect(await screen.findByText(/Nobody reports to you yet/)).toBeInTheDocument();
    unmount();
    api.getApi.mockRejectedValueOnce(new ApiError(404, 'nf'));
    const r2 = renderAt();
    expect(await screen.findByText('Team result is not available yet')).toBeInTheDocument();
    r2.unmount();
    api.getApi.mockRejectedValueOnce(new ApiError(500, 'Down'));
    renderAt();
    expect(await screen.findByRole('alert')).toHaveTextContent('Down');
    await u.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
  it('route: v1 Reports outside the Manager and Admin seats', async () => {
    shell.value = { seat: 'employee' };
    renderAt();
    expect(await screen.findByText('v1 reports')).toBeInTheDocument();
  });
});
