import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import { myWorkFixture } from '../../api/myWork.fixtures';
import type { MyWorkResult } from '../../api/myWork';
import { MyWorkV2 } from '../MyWorkV2';
import { useLocation } from 'react-router-dom';

function LocationProbe() { const l = useLocation(); return <output data-testid="loc" hidden>{l.pathname + l.search}</output>; }

vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { displayName: 'Mariam Farag' } }) }));

type Variant = NonNullable<Parameters<typeof myWorkFixture>[0]>['variant'];
const ok = (variant?: Variant, source: MyWorkResult['source'] = 'api') => vi.fn(async (day: 'today' | 'tomorrow' = 'today'): Promise<MyWorkResult> => ({ data: myWorkFixture({ variant, day }), source }));

function renderPage(load: (day?: 'today' | 'tomorrow') => Promise<MyWorkResult>, path = '/my-work') {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/my-work" element={<><MyWorkV2 load={load as never} /><LocationProbe /></>} /></Routes></MemoryRouter>);
}
afterEach(() => document.documentElement.removeAttribute('data-ui'));

describe('My Work (E02) from the #9 contract', () => {
  it('renders the target chip, the three buckets with one action each, and counts', async () => {
    renderPage(ok());
    expect(await screen.findByRole('heading', { name: 'My Work', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Today · 19 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText(/^Good (morning|afternoon|evening), Mariam\. 5 open tasks on your job HRIS Developer\.$/)).toBeInTheDocument();
    const strip = screen.getByRole('region', { name: 'Job: HRIS Developer' });
    expect(within(strip).getByText('Hire target')).toBeInTheDocument();
    expect(within(strip).getByText('1 of 3 joined')).toBeInTheDocument();
    expect(within(strip).getByRole('link', { name: 'Open pipeline: HRIS Developer' })).toHaveAttribute('href', '/vacancies/j1');
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveAttribute('href', '/vacancies');
    expect(within(strip).getByText('25 Oct 2026')).toBeInTheDocument();
    expect(within(strip).getByText('VAC-1 · Information Technology · Cairo HQ · Owner: Mariam Adel')).toBeInTheDocument();
    expect(within(strip).getByRole('link', { name: 'HRIS Developer' })).toHaveAttribute('href', '/vacancies/j1');

    const overdue = screen.getByRole('region', { name: 'Overdue' });
    expect(within(overdue).getByText('Interview: Ahmed Embaby')).toBeInTheDocument();
    expect(within(overdue).getByText('Your scorecard is missing')).toBeInTheDocument();
    expect(within(overdue).getByTestId('candidate')).toHaveTextContent('Ahmed Embaby · Interview');
    expect(within(overdue).getByTestId('sla')).toHaveTextContent('Overdue');
    expect(within(overdue).getByTestId('due')).toHaveTextContent('Due 18 Oct');
    expect(within(overdue).getByRole('link', { name: 'Submit scorecard: Interview: Ahmed Embaby' })).toHaveAttribute('href', '/interviews/i1');

    const today = screen.getByRole('region', { name: 'Today' });
    expect(within(today).getByRole('link', { name: 'Review applicants: HRIS Developer (VAC-1)' })).toHaveAttribute('href', '/vacancies/j1');
    expect(within(today).getByRole('link', { name: 'Open interview: Screening: Nourhan Sami' })).toHaveAttribute('href', '/interviews/iv2');
    expect(within(today).getByText('19 Oct, 11:30–12:00')).toBeInTheDocument(); // 08:30Z in Cairo
    expect(within(today).getByRole('link', { name: 'Room 2A' })).toHaveAttribute('href', 'https://rooms.sgh.test/2a');
    const disabled = within(today).getByRole('button', { name: 'Submit scorecard' });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAccessibleDescription('Interview has not ended');
    expect(disabled).toHaveAttribute('title', 'Interview has not ended');
    expect(within(today).getByRole('link', { name: 'Put on hold: HRIS Developer (VAC-1)' })).toHaveClass('rf2-btn--secondary');
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
    expect(within(today).getByRole('link', { name: /^Review applicants/ })).toHaveClass('rf2-btn--primary');

    const waiting = screen.getByRole('region', { name: 'Waiting on others' });
    // B2-23 / E02: a waiting offer names the approver, is read-only, and offers no Send.
    expect(within(waiting).getByText('Salma Farouk — offer waiting on Karim Hassan')).toBeInTheDocument();
    expect(within(waiting).getByText('Waiting on approval')).toBeInTheDocument();
    expect(within(waiting).getByText('Waiting on interviewer')).toBeInTheDocument();
    expect(within(waiting).queryByRole('button', { name: 'Send offer' })).not.toBeInTheDocument();
    expect(within(waiting).queryByRole('link')).toBeNull();
    expect(within(waiting).getAllByText('Read-only')).toHaveLength(2);
    expect(within(waiting).getAllByText('No action for you')).toHaveLength(2);
    const counts = screen.getByLabelText('Counts');
    expect(Array.from(counts.querySelectorAll('[data-count-value]')).map((d) => d.textContent)).toEqual(['5', '1', '2', '2']);
    // E02: tiles sit above the sections and name the first item.
    expect(counts.compareDocumentPosition(overdue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(counts).toHaveTextContent('Ahmed Embaby — scorecard');
    expect(counts).toHaveTextContent('Salma Farouk — with Karim Hassan');
    expect(screen.queryByTestId('sample-data-note')).not.toBeInTheDocument();
  });

  it('renders one strip per target when there are several', async () => {
    renderPage(ok('multi-target'));
    const list = await screen.findByRole('list', { name: 'Your targets' });
    expect(within(list).getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Job: HRIS Developer', 'Job: Data Analyst']);
    expect(within(list).getByText('No due date')).toBeInTheDocument();
    expect(screen.getByText(/across 2 jobs\./)).toBeInTheDocument();
  });

  it('worker stale: SLA chips hidden with a note; due facts still shown', async () => {
    const { container } = renderPage(ok('stale-worker'));
    expect(await screen.findByTestId('sla-hidden')).toHaveTextContent('SLA flags are hidden');
    expect(screen.queryAllByTestId('sla')).toHaveLength(0);
    expect(screen.getAllByTestId('due').length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/Google|Meet|self-schedule/i);
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

  it('Tomorrow (E05): switch syncs the URL, loads day=tomorrow, lists booked interviews with time, room URL and interviewers', async () => {
    const u = userEvent.setup();
    const load = ok();
    renderPage(load);
    await screen.findByRole('region', { name: 'Today' });
    const tomorrowBtn = screen.getByRole('button', { name: 'Tomorrow' });
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    await u.click(tomorrowBtn);
    expect(screen.getByTestId('loc')).toHaveTextContent('/my-work?day=tomorrow');
    expect(load).toHaveBeenLastCalledWith('tomorrow');
    const tomorrow = await screen.findByRole('region', { name: 'Tomorrow' });
    expect(screen.getByText('Tomorrow · 20 Oct 2026')).toBeInTheDocument();
    expect(within(tomorrow).getByText('Tomorrow, 10:00–11:00')).toBeInTheDocument();
    expect(within(tomorrow).getByRole('link', { name: 'Room 4B' })).toHaveAttribute('href', 'https://rooms.sgh.test/4b');
    expect(within(tomorrow).getAllByTestId('interviewers')[0]).toHaveTextContent('With Dr. Hana Saleh, Kareem Fathy');
    expect(within(tomorrow).getByText('No room yet')).toBeInTheDocument();
    expect(within(tomorrow).getAllByTestId('sla')[0]).toHaveTextContent('Due tomorrow');
    expect(screen.getByLabelText('Counts')).toHaveTextContent('Due tomorrow');
    await u.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/my-work$/);
  });

  it('deep link ?day=tomorrow loads tomorrow', async () => {
    const load = ok();
    renderPage(load, '/my-work?day=tomorrow');
    expect(await screen.findByRole('region', { name: 'Tomorrow' })).toBeInTheDocument();
    expect(load).toHaveBeenCalledWith('tomorrow');
  });
});

describe('Empty (E03), loading, error, forbidden', () => {
  it('server empty: emptyMessage, no strip', async () => {
    renderPage(ok('empty'));
    expect(await screen.findByRole('heading', { name: 'No open work assigned to you' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Your targets' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveAttribute('href', '/vacancies');
  });
  it('targets but no work items (#9 empty=true ignores targets): target strip + empty state (E03)', async () => {
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
    expect(screen.getByRole('link', { name: 'View open jobs' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('button', { name: 'Today' })).toHaveFocus();
    await u.tab();
    await u.tab();
    expect(screen.getByRole('link', { name: 'HRIS Developer' })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('link', { name: /^Open pipeline/ })).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('link', { name: /^Submit scorecard/ })).toHaveFocus();
  });
  it.each(['mariam', 'empty', 'targets-only', 'multi-target', 'stale-worker'] as const)('%s has no axe violations', async (variant) => {
    const { container } = renderPage(ok(variant));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(await axeViolations(container)).toEqual([]);
  });
});
