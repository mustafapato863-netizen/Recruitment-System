import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import * as jfx from '../../api/__fixtures__/jobs';
import * as sfx from '../../api/__fixtures__/searchNotify';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: jfx.ME, displayName: 'Mariam Farag' } }) }));
const shell = vi.hoisted(() => ({ value: { seat: 'employee' } as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
import { HeaderSearch } from '../HeaderSearch';
import { NotificationsBell, NOTIFICATIONS_CHANGED } from '../NotificationsBell';
import { SearchV2 } from '../SearchV2';
import { notificationHref, scopedSearch } from '../../api/searchNotify';

let responses: Record<string, unknown> = {};
const serve = (extra: Record<string, unknown> = {}) => {
  responses = { '/search': sfx.search, '/applications': sfx.myApps, '/vacancies/work-queue': jfx.workQueue, mine: jfx.workQueueMine, '/vacancies': jfx.vacancyList, '/notifications': sfx.notifications(), ...extra };
  api.getApi.mockImplementation(async (path: string) => {
    const p = path.startsWith('/vacancies/work-queue?mine=true') ? 'mine' : path.split('?')[0];
    if (p in responses) { const v = responses[p]; if (v instanceof Error) throw v; return structuredClone(v); }
    throw new ApiError(404, 'nf');
  });
};
function Loc() { const l = useLocation(); return <output data-testid="loc">{l.pathname + l.search}</output>; }
const renderUI = (path = '/my-work', unread = 2) => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><HeaderSearch placeholder="Search candidates and jobs" meId={jfx.ME} /><NotificationsBell unread={unread} />
    <Routes><Route path="/search" element={<SearchV2 />} /><Route path="*" element={null} /></Routes><Loc /></MemoryRouter>);
};
const LEAK_IN_RESULTS = /@mail\.test|Staff Nurse NICU|APP-2026-0200|42,000|EGP/;
beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); serve(); shell.value = { seat: 'employee' }; });

describe('scopedSearch (client mitigation of an unscoped /search)', () => {
  it('keeps my files/jobs, redacts team jobs, drops out-of-scope jobs/files/offers, strips candidate email', async () => {
    const r = await scopedSearch('Ahmed');
    expect(api.getApi).toHaveBeenCalledWith('/search?q=Ahmed&limit=10');
    expect(api.getApi).toHaveBeenCalledWith('/applications?search=Ahmed&pageSize=50');
    const flat = r.groups.flatMap((g) => g.items);
    expect(flat.map((i) => [i.title, i.href])).toEqual([
      ['Ahmed Embaby', '/applications/a7'],
      ['Ahmed Fathy', '/candidates?tab=bank'],
      ['HRIS Developer', '/vacancies/v1'],
      ['Pharmacist', '/vacancies/r1'],
      ['Call Ahmed Embaby', '/my-work'],
    ]);
    expect(flat[0].meta).toBe('HRIS Developer · Interview · Owner: Mariam Farag');
    expect(flat[1].meta).toBe('Staff Nurse · In the bank');
    expect(flat[3]).toMatchObject({ kind: 'redacted-job', note: 'Owned by another recruiter' });
    expect(flat[4].meta).toBe('High · Due 12 Oct');
    expect(r.hidden).toBe(3);
    expect(JSON.stringify(r)).not.toMatch(/@mail\.test|EGP|APP-2026-0200|NICU/);
  });
  it('notificationHref: only Employee-safe pages', () => {
    const [a, i, v, o] = sfx.notifications().data;
    expect([a, i, v, o].map(notificationHref)).toEqual(['/applications/a10', null, '/vacancies/v1', null]);
  });
});

describe('E07 header search', () => {
  it('combobox: debounced, grouped, keyboard Enter opens the file; scope note; no leaks; axe', async () => {
    const u = userEvent.setup();
    const { container } = renderUI();
    const box = screen.getByRole('combobox', { name: 'Search candidates and jobs' });
    await u.type(box, 'Ahmed');
    const lb = await screen.findByRole('listbox', { name: 'Search results' });
    await within(lb).findAllByRole('option');
    expect(api.getApi.mock.calls.filter(([p]) => String(p).startsWith('/search')).length).toBe(1);
    expect(screen.getByText(/5 results · items outside your scope are not shown/)).toBeInTheDocument();
    expect(within(lb).getByRole('group', { name: 'Candidates' })).toBeInTheDocument();
    expect(lb.textContent).not.toMatch(LEAK_IN_RESULTS);
    expect(await axeViolations(container)).toEqual([]);
    await u.keyboard('{ArrowDown}');
    expect(box).toHaveAttribute('aria-activedescendant', expect.stringMatching(/o0$/));
    await u.keyboard('{Enter}');
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a7');
  });
  it('Enter with no option → results page; Escape closes', async () => {
    const u = userEvent.setup();
    renderUI();
    const box = screen.getByRole('combobox');
    await u.type(box, 'Ahmed');
    await screen.findAllByRole('option');
    await u.keyboard('{Escape}');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    await u.click(box);
    await u.keyboard('{Enter}');
    expect(screen.getByTestId('loc')).toHaveTextContent('/search?q=Ahmed');
    expect(await screen.findByRole('heading', { name: 'Search results' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Pharmacist' })).toBeInTheDocument();
    expect(screen.getByText(/3 matches are outside your scope/)).toBeInTheDocument();
  });
  it('403 from /search → clear message', async () => {
    const u = userEvent.setup();
    serve({ '/search': new ApiError(403, 'Access denied') });
    renderUI();
    await u.type(screen.getByRole('combobox'), 'Ahmed');
    expect(await screen.findByRole('alert')).toHaveTextContent('Your role does not include search.');
  });
});

describe('E06 notifications panel', () => {
  it('lists, marks one read and routes to E13; unread refresh event; pay text hidden; axe', async () => {
    const u = userEvent.setup();
    const changed = vi.fn(); window.addEventListener(NOTIFICATIONS_CHANGED, changed);
    api.patchApi.mockResolvedValue({});
    const { container } = renderUI('/my-work', 2);
    await u.click(screen.getByRole('button', { name: 'Notifications, 2 unread' }));
    const d = await screen.findByRole('dialog', { name: 'Notifications' });
    const items = await within(d).findAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent(/Karim Hassan commented.*12 min ago.*New/);
    expect(items[3]).toHaveTextContent('Details are on the file.');
    expect(d.textContent).not.toMatch(/42,000|EGP/);
    expect(await axeViolations(container)).toEqual([]);
    await u.click(within(items[0]).getByRole('button'));
    expect(api.patchApi).toHaveBeenCalledWith('/notifications/n1/read', {});
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a10'));
    expect(changed).toHaveBeenCalled();
    window.removeEventListener(NOTIFICATIONS_CHANGED, changed);
  });
  it('Mark all read → POST /notifications/read-all; Escape closes and returns focus', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ count: 2 });
    renderUI();
    const bell = screen.getByRole('button', { name: 'Notifications, 2 unread' });
    await u.click(bell);
    const d = await screen.findByRole('dialog');
    await u.click(await within(d).findByRole('button', { name: 'Mark all read' }));
    expect(api.postApi).toHaveBeenCalledWith('/notifications/read-all', {});
    await waitFor(() => expect(within(d).queryByText('New')).not.toBeInTheDocument());
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });
  it('empty and 403 states', async () => {
    const u = userEvent.setup();
    serve({ '/notifications': { data: [], total: 0 } });
    const { unmount } = renderUI('/', 0);
    await u.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
    unmount();
    serve({ '/notifications': new ApiError(403, 'no') });
    renderUI('/', 0);
    await u.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your role does not include notifications.');
  });
});
