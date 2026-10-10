import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';

const api = vi.hoisted(() => ({ getApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const shell = vi.hoisted(() => ({ value: { seat: 'employee' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
import { MyResultV2 } from '../MyResultV2';
import { cairoMonth, fetchMyResult } from '../../api/myResult';

type Tile = { value: number; of: number; sampleSize: number; detail: string; tooFewToJudge?: boolean };
const result = (tiles: Partial<Record<string, Tile>> = {}) => ({
  scope: 'me', month: '2026-10', range: { from: '2026-09-30T21:00:00.000Z', to: '2026-10-31T22:00:00.000Z' },
  filters: { vacancyId: 'v1', managerId: null }, people: [{ id: 'u-mariam', name: 'Mariam Farag' }],
  tiles: {
    seats: { value: 1, of: 3, sampleSize: 1, detail: '1 joined in October 2026 against 3 seats on 1 job.', tooFewToJudge: false },
    overdueFollowUps: { value: 1, of: 9, sampleSize: 9, detail: '1 of 9 follow-ups due in October 2026 were not acted on by their date.', tooFewToJudge: false },
    screensReachedInterview: { value: 1, of: 2, sampleSize: 2, detail: '1 of 2 screens with a note in October 2026 reached Interview.', tooFewToJudge: true },
    offersAccepted: { value: 0, of: 0, sampleSize: 0, detail: '0 of 0 offers sent in October 2026 were accepted.', tooFewToJudge: true },
    ...tiles,
  },
  monthlySalary: 42000,
});
const serve = (body: unknown) => api.getApi.mockImplementation(async (p: string) => (p.startsWith('/vacancies/') ? { id: 'v1', title: null, position: { title: 'HRIS Developer' } } : body));
const renderAt = (path = '/my-result?job=v1&month=2026-10') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/my-result" element={<MyResultV2 />} /><Route path="/my-work" element={<p>my work</p>} /></Routes></MemoryRouter>);
};
beforeEach(() => { api.getApi.mockReset(); shell.value = { seat: 'employee' }; });

describe('E04 My result', () => {
  it('B8 /results/me; four tiles; server tooFewToJudge; seats exempt; no pay; axe', async () => {
    serve(result());
    const { container } = renderAt();
    expect(await screen.findByRole('region', { name: 'Seats' })).toHaveTextContent(/1 of 3 filled2 open1 joined in October 2026 against 3 seats on 1 job\.Based on 1 record · seats are always shown/);
    expect(within(screen.getByRole('region', { name: 'Seats' })).queryByText('Too few to judge')).toBeNull();
    expect(api.getApi).toHaveBeenCalledWith('/results/me?month=2026-10&vacancyId=v1');
    expect(screen.getByText('October 2026 · monthly · HRIS Developer only.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Overdue follow-ups' })).toHaveTextContent(/^Overdue follow-ups1 of 9past their follow-up date1 of 9 follow-ups due in October 2026 were not acted on by their date\.Based on 9 records/);
    const screens = screen.getByRole('region', { name: 'Screens with a note' });
    expect(within(screens).getByText('Too few to judge')).toBeInTheDocument();
    expect(screens).toHaveTextContent('1 of 2 so far');
    expect(screens).toHaveTextContent('Based on 2 records · needs 5');
    expect(screen.getByRole('region', { name: 'Offers accepted against sent' })).toHaveTextContent(/Too few to judge.*0 of 0 so far.*Based on 0 records · needs 5/);
    expect(container.textContent).not.toMatch(/42000|salary|%/i);
    expect(await axeViolations(container)).toEqual([]);
  });
  it('server flag wins over the count; the under-5 rule only when the flag is missing', async () => {
    serve(result({ offersAccepted: { value: 3, of: 5, sampleSize: 5, detail: 'd', tooFewToJudge: true }, screensReachedInterview: { value: 2, of: 3, sampleSize: 3, detail: 'd', tooFewToJudge: false }, overdueFollowUps: { value: 0, of: 2, sampleSize: 2, detail: 'd' }, seats: { value: 0, of: 4, sampleSize: 0, detail: 'd' } }));
    renderAt();
    expect(await screen.findByRole('region', { name: 'Offers accepted against sent' })).toHaveTextContent('Too few to judge');
    expect(screen.getByRole('region', { name: 'Screens with a note' })).toHaveTextContent(/2 of 3reached interview/);
    expect(screen.getByRole('region', { name: 'Overdue follow-ups' })).toHaveTextContent('Too few to judge');
    expect(screen.getByRole('region', { name: 'Seats' })).toHaveTextContent('0 of 4 filled');
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
    serve(result()); api.getApi.mockRejectedValueOnce(new ApiError(500, 'boom'));
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
