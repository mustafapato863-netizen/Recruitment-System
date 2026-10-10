import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import { myWorkFixture } from '../../api/myWork.fixtures';
import type { MyWorkResult, WorkDay } from '../../api/myWork';
import { MyWorkV2 } from '../MyWorkV2';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { displayName: 'Mariam Farag' } }) }));

function Loc() { const l = useLocation(); return <span data-testid="loc">{l.pathname}{l.search}</span>; }
const ok = (opts: Parameters<typeof myWorkFixture>[1] = {}, source: MyWorkResult['source'] = 'api') =>
  vi.fn(async (day: WorkDay): Promise<MyWorkResult> => ({ data: myWorkFixture(day, opts), source }));

function renderPage(load: (day: WorkDay) => Promise<MyWorkResult>, path = '/my-work') {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/my-work" element={<><MyWorkV2 load={load} /><Loc /></>} /></Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => document.documentElement.removeAttribute('data-ui'));

describe('My Work (E02)', () => {
  it('renders the job strip, three sections with one action each, and counts', async () => {
    renderPage(ok());
    expect(await screen.findByRole('heading', { name: 'My Work', level: 2 })).toBeInTheDocument();
    const strip = screen.getByRole('region', { name: 'Job: HRIS Developer' });
    expect(within(strip).getByText('1 of 3 filled')).toBeInTheDocument();
    expect(within(strip).getByText('19 Oct 2026')).toBeInTheDocument();
    expect(within(strip).getByText('IT · Offshore Cairo · Owner: Mariam Farag')).toBeInTheDocument();

    const overdue = screen.getByRole('region', { name: 'Overdue' });
    expect(within(overdue).getByText('Scorecard missing — Ahmed Embaby')).toBeInTheDocument();
    expect(within(overdue).getByTestId('sla')).toHaveTextContent('Due 7 Oct');
    expect(within(overdue).getByRole('link', { name: 'Open file: Ahmed Embaby' })).toHaveAttribute('href', '/applications/app-ahmed');

    const today = screen.getByRole('region', { name: 'Today' });
    expect(within(today).getByRole('link', { name: 'Log screening: Nourhan Sami' })).toHaveClass('rf2-btn--primary');

    const waiting = screen.getByRole('region', { name: 'Waiting on others' });
    expect(within(waiting).getByText('Waiting on Karim Hassan')).toBeInTheDocument();
    expect(within(waiting).getByRole('link', { name: 'View file: Lina Hassan' })).toBeInTheDocument();

    for (const region of [overdue, today, waiting]) expect(within(region).getAllByRole('link')).toHaveLength(1);
    const counts = screen.getByLabelText('Counts');
    expect(Array.from(counts.querySelectorAll('[data-count-value]')).map((d) => d.textContent)).toEqual(['3', '1', '1', '1']);
    expect(screen.queryByTestId('sample-data-note')).not.toBeInTheDocument();
  });

  it('hides the SLA indicator when the reminder worker is stale (and says so)', async () => {
    renderPage(ok({ workerHealthy: false }));
    await screen.findByRole('region', { name: 'Overdue' });
    expect(screen.queryAllByTestId('sla')).toHaveLength(0);
    expect(screen.getByTestId('worker-stale-note')).toHaveTextContent('Reminders are paused');
    expect(screen.getByText('Scorecard missing — Ahmed Embaby')).toBeInTheDocument();
  });

  it('shows a sample-data notice when the source is fixtures (dev only)', async () => {
    renderPage(ok({}, 'fixture'));
    expect(await screen.findByTestId('sample-data-note')).toHaveTextContent('Sample data');
  });

  it('never shows pay', async () => {
    const { container } = renderPage(ok());
    await screen.findByRole('region', { name: 'Overdue' });
    expect(container.textContent).not.toMatch(/salary|pay\b|AED|EGP|SAR|compensation/i);
  });
});

describe('Empty (E03), loading, error, forbidden', () => {
  it('empty: job strip + "No open work assigned to you" + View open jobs', async () => {
    renderPage(ok({ empty: true }));
    expect(await screen.findByRole('heading', { name: 'No open work assigned to you' })).toBeInTheDocument();
    expect(screen.getByText('Open files on your jobs that need you appear here.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveAttribute('href', '/vacancies');
    expect(screen.getByRole('region', { name: 'Job: HRIS Developer' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Overdue' })).not.toBeInTheDocument();
  });

  it('loading shows a skeleton with a status', async () => {
    renderPage(() => new Promise(() => {}));
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading your work…');
  });

  it('error shows an alert with retry that reloads', async () => {
    const u = userEvent.setup();
    const load = vi.fn().mockRejectedValueOnce(new ApiError(500, 'Server exploded')).mockImplementation(async (d: WorkDay) => ({ data: myWorkFixture(d), source: 'api' }));
    renderPage(load);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load your work');
    await u.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Overdue' })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('403 shows the forbidden state', async () => {
    renderPage(vi.fn().mockRejectedValue(new ApiError(403, 'nope')));
    expect(await screen.findByText('You do not have access to My Work')).toBeInTheDocument();
  });
});

describe('Today | Tomorrow (E05)', () => {
  it('syncs the day with the URL and loads the right day', async () => {
    const u = userEvent.setup();
    const load = ok();
    renderPage(load);
    const toggle = await screen.findByRole('group', { name: 'Show work for' });
    expect(within(toggle).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    await u.click(within(toggle).getByRole('button', { name: 'Tomorrow' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/my-work?day=tomorrow');
    expect(await screen.findByRole('heading', { level: 2, name: /^Tomorrow · Tue 13 Oct 2026/ })).toBeInTheDocument();
    expect(load).toHaveBeenLastCalledWith('tomorrow');
    await u.click(within(toggle).getByRole('button', { name: 'Today' }));
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/my-work$/);
  });

  it('deep link ?day=tomorrow shows the interview with room + room link only (no Google Meet)', async () => {
    renderPage(ok(), '/my-work?day=tomorrow');
    const list = await screen.findByRole('list', { name: "Tomorrow's interviews" });
    expect(within(list).getByText('Room SG-4 — HQ Riyadh')).toBeInTheDocument();
    expect(within(list).getByText('Karim Hassan')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'rooms.example.test/sg-4' })).toHaveAttribute('href', 'https://rooms.example.test/sg-4');
    expect(list.textContent).not.toMatch(/google|meet\.|self-schedul/i);
    expect(screen.getByText('1 interview on HRIS Developer.')).toBeInTheDocument();
  });

  it('tomorrow empty', async () => {
    renderPage(ok({ empty: true }), '/my-work?day=tomorrow');
    expect(await screen.findByRole('heading', { name: 'Nothing booked for tomorrow' })).toBeInTheDocument();
  });

  it('keyboard: the toggle is reachable and operable', async () => {
    const u = userEvent.setup();
    renderPage(ok());
    await screen.findByRole('region', { name: 'Overdue' });
    const tomorrow = screen.getByRole('button', { name: 'Tomorrow' });
    tomorrow.focus();
    await u.keyboard('{Enter}');
    expect(screen.getByTestId('loc')).toHaveTextContent('?day=tomorrow');
    await waitFor(() => expect(tomorrow).toHaveAttribute('aria-pressed', 'true'));
  });
});

describe('a11y (axe)', () => {
  it.each([
    ['today', ok(), '/my-work'],
    ['empty', ok({ empty: true }), '/my-work'],
    ['tomorrow', ok(), '/my-work?day=tomorrow'],
    ['stale', ok({ workerHealthy: false }), '/my-work'],
  ] as const)('%s has no violations', async (_n, load, path) => {
    const { container } = renderPage(load, path);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(await axeViolations(container)).toEqual([]);
  });
});
