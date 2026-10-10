import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import { myWorkFixture } from '../../api/myWork.fixtures';
import type { MyWorkResult } from '../../api/myWork';
import { MyWorkV2 } from '../MyWorkV2';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { displayName: 'Mariam Farag' } }) }));

type Variant = NonNullable<Parameters<typeof myWorkFixture>[0]>['variant'];
const ok = (variant?: Variant, source: MyWorkResult['source'] = 'api') => vi.fn(async (): Promise<MyWorkResult> => ({ data: myWorkFixture({ variant }), source }));

function renderPage(load: () => Promise<MyWorkResult>, path = '/my-work') {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/my-work" element={<MyWorkV2 load={load} />} /></Routes></MemoryRouter>);
}
afterEach(() => document.documentElement.removeAttribute('data-ui'));

describe('My Work (E02) from the #9 contract', () => {
  it('renders the target chip, the three buckets with one action each, and counts', async () => {
    renderPage(ok());
    expect(await screen.findByRole('heading', { name: 'My Work', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Today · 19 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText(/^Good (morning|afternoon|evening), Mariam\. 5 open tasks on your job HRIS Developer\.$/)).toBeInTheDocument();
    const strip = screen.getByRole('region', { name: 'Job: HRIS Developer' });
    expect(within(strip).getByText('1 of 3 filled')).toBeInTheDocument();
    expect(within(strip).getByText('19 Oct 2026')).toBeInTheDocument();
    expect(within(strip).getByRole('link', { name: 'HRIS Developer' })).toHaveAttribute('href', '/vacancies/j1');

    const overdue = screen.getByRole('region', { name: 'Overdue' });
    expect(within(overdue).getByText('Interview: Ahmed Embaby')).toBeInTheDocument();
    expect(within(overdue).getByText('Your scorecard is missing')).toBeInTheDocument();
    expect(within(overdue).getByTestId('due')).toHaveTextContent('Due 18 Oct');
    expect(within(overdue).getByRole('link', { name: 'Submit scorecard: Interview: Ahmed Embaby' })).toHaveAttribute('href', '/interviews/i1');

    const today = screen.getByRole('region', { name: 'Today' });
    expect(within(today).getByRole('link', { name: 'Review applicants: HRIS Developer (VAC-1)' })).toHaveAttribute('href', '/vacancies/j1');
    expect(within(today).getByRole('link', { name: 'Open interview: Screening: Nourhan Sami' })).toHaveAttribute('href', '/applications/a2');
    expect(within(today).getByText('Today, 11:30')).toBeInTheDocument(); // 08:30Z in Cairo
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
    expect(within(today).getByRole('link', { name: /^Review applicants/ })).toHaveClass('rf2-btn--primary');

    const waiting = screen.getByRole('region', { name: 'Waiting on others' });
    expect(within(waiting).getByText('Waiting on approver')).toBeInTheDocument();
    expect(within(waiting).getByText('Waiting on interviewer')).toBeInTheDocument();

    for (const [region, n] of [[overdue, 1], [today, 2], [waiting, 2]] as const) expect(within(region).getAllByRole('link')).toHaveLength(n);
    const counts = screen.getByLabelText('Counts');
    expect(Array.from(counts.querySelectorAll('[data-count-value]')).map((d) => d.textContent)).toEqual(['5', '1', '2', '2']);
    expect(screen.queryByTestId('sample-data-note')).not.toBeInTheDocument();
  });

  it('renders one strip per target when there are several', async () => {
    renderPage(ok('multi-target'));
    const list = await screen.findByRole('list', { name: 'Your targets' });
    expect(within(list).getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Job: HRIS Developer', 'Job: Data Analyst']);
    expect(within(list).getByText('No due date')).toBeInTheDocument();
    expect(screen.getByText(/across 2 jobs\./)).toBeInTheDocument();
  });

  it('shows nothing #9 does not provide (no SLA/worker note, no tomorrow list, no room, no invented names)', async () => {
    const { container } = renderPage(ok());
    await screen.findByRole('region', { name: 'Overdue' });
    expect(container.textContent).not.toMatch(/Reminders are paused|Room|Google|Meet|Tomorrow ·|Karim/);
    expect(screen.queryByRole('group', { name: 'Show work for' })).not.toBeInTheDocument();
  });

  it('never shows pay', async () => {
    const { container } = renderPage(ok());
    await screen.findByRole('region', { name: 'Overdue' });
    expect(container.textContent).not.toMatch(/salary|pay\b|AED|EGP|SAR|compensation/i);
  });

  it('sample-data notice in dev fixture mode', async () => {
    renderPage(ok(undefined, 'fixture'));
    expect(await screen.findByTestId('sample-data-note')).toBeInTheDocument();
  });

  it('?day=tomorrow is not supported by #9: says so and shows today', async () => {
    renderPage(ok(), '/my-work?day=tomorrow');
    expect(await screen.findByTestId('tomorrow-unavailable')).toHaveTextContent("The Tomorrow view isn't available yet");
    expect(screen.getByRole('region', { name: 'Overdue' })).toBeInTheDocument();
  });
});

describe('Empty (E03), loading, error, forbidden', () => {
  it('server empty: emptyMessage, no strip', async () => {
    renderPage(ok('empty'));
    expect(await screen.findByRole('heading', { name: 'No open work assigned to you' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Your targets' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveAttribute('href', '/vacancies');
  });
  it('targets but no work items (#9 empty=false): target strip + empty state (E03)', async () => {
    renderPage(ok('targets-only'));
    expect(await screen.findByRole('heading', { name: 'No open work assigned to you' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Job: HRIS Developer' })).toBeInTheDocument();
    expect(screen.getByText('Open files on your jobs that need you appear here.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Overdue' })).not.toBeInTheDocument();
  });
  it('loading skeleton', () => {
    renderPage(() => new Promise(() => {}));
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading your work…');
  });
  it('error with retry', async () => {
    const u = userEvent.setup();
    const load = vi.fn().mockRejectedValueOnce(new ApiError(500, 'Server exploded')).mockImplementation(async () => ({ data: myWorkFixture(), source: 'api' }));
    renderPage(load);
    const alert = await screen.findByRole('alert');
    await u.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Overdue' })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('403 forbidden', async () => {
    renderPage(vi.fn().mockRejectedValue(new ApiError(403, 'nope')));
    expect(await screen.findByText('You do not have access to My Work')).toBeInTheDocument();
  });
});

describe('keyboard + a11y', () => {
  it('tab order reaches the strip link and each action', async () => {
    const u = userEvent.setup();
    renderPage(ok());
    await screen.findByRole('region', { name: 'Overdue' });
    await u.tab();
    expect(screen.getByRole('link', { name: 'HRIS Developer' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('link', { name: /^Submit scorecard/ })).toHaveFocus();
  });
  it.each(['mariam', 'empty', 'targets-only', 'multi-target'] as const)('%s has no axe violations', async (variant) => {
    const { container } = renderPage(ok(variant));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(await axeViolations(container)).toEqual([]);
  });
});
