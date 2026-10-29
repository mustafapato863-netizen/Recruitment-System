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
      ['Ahmed Fathy', '/candidates/c-x'],
      ['HRIS Developer', '/vacancies/v1'],
      ['Pharmacist', '/vacancies/r1'],
      ['Lab Technician', '/vacancies/r9'],
      ['Call Ahmed Embaby', '/my-work'],
    ]);
    expect(flat[0].meta).toBe('HRIS Developer · Interview · Owner: Mariam Farag');
    expect(flat[1].meta).toBe('Staff Nurse · In the bank');
    expect(flat[3]).toMatchObject({ kind: 'redacted-job', note: 'Owned by another recruiter' });
    expect(flat[4]).toMatchObject({ kind: 'redacted-job', meta: 'SGH Riyadh · 1 of 2 seats' });
    expect(flat[5].meta).toBe('High · Due 12 Oct');
    expect(r.hidden).toBe(3);
    const kept = await scopedSearch('Ahmed', undefined, '/my-work?filter=waiting');
    const keptFlat = kept.groups.flatMap((g) => g.items);
    expect(keptFlat.find((i) => i.title === 'Ahmed Embaby')?.href).toBe(`/applications/a7?returnTo=${encodeURIComponent('/my-work?filter=waiting')}`);
    expect(keptFlat.find((i) => i.title === 'Ahmed Fathy')?.href).toBe(`/candidates/c-x?returnTo=${encodeURIComponent('/my-work?filter=waiting')}`);
    expect(keptFlat.find((i) => i.title === 'HRIS Developer')?.href).toBe('/vacancies/v1');
    const fromSearch = await scopedSearch('Ahmed', undefined, '/search?q=Ahmed');
    expect(fromSearch.groups.flatMap((g) => g.items).find((i) => i.title === 'Ahmed Embaby')?.href).toBe(`/applications/a7?returnTo=${encodeURIComponent('/search?q=Ahmed')}`);
    expect(JSON.stringify(r)).not.toMatch(/@mail\.test|EGP|APP-2026-0200|NICU|VAC-2026-0099/);
  });
  it('notificationHref: the file by applicationId first, else safe entity pages', () => {
    const [a, i, v, o] = sfx.notifications().data;
    expect([a, i, v, o].map((item) => notificationHref(item))).toEqual(['/applications/a10', '/applications/a7', '/vacancies/v1', '/applications/a10']);
    expect(notificationHref({ ...o, applicationId: null })).toBe('/offers/o1');
    expect(notificationHref({ ...o, applicationId: null, entityType: 'VacancyRequest', entityId: 'r1' })).toBe('/vacancy-requests?req=r1');
    expect(notificationHref({ ...o, applicationId: null, entityType: 'Interview', entityId: 'i9' })).toBe('/my-interviews?interview=i9');
    expect(notificationHref({ ...o, applicationId: null, entityType: 'HiringCase', entityId: 'h1' })).toBe('/hires/h1');
    expect(notificationHref({ ...o, applicationId: null, entityType: 'Candidate', entityId: 'c1' })).toBe('/candidates/c1');
    const kept = '/my-work?day=tomorrow&tab=interviews';
    expect(notificationHref(a, kept)).toBe(`/applications/a10?returnTo=${encodeURIComponent(kept)}`);
    expect(notificationHref({ ...o, applicationId: null }, kept)).toBe(`/offers/o1?returnTo=${encodeURIComponent(kept)}`);
    expect(notificationHref({ ...o, applicationId: null, entityType: 'HiringCase', entityId: 'h1' }, kept)).toBe(`/hires/h1?returnTo=${encodeURIComponent(kept)}`);
    expect(notificationHref(v, kept)).toBe('/vacancies/v1');
    expect(notificationHref({ ...o, applicationId: null, entityType: 'Candidate', entityId: 'c1' }, kept)).toBe(`/candidates/c1?returnTo=${encodeURIComponent(kept)}`);
    expect(notificationHref(a, '/search?q=Ahmed')).toBe(`/applications/a10?returnTo=${encodeURIComponent('/search?q=Ahmed')}`);
    expect(notificationHref(a, 'https://evil.example/my-work')).toBe('/applications/a10');
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
    expect(screen.getByText(/6 results · items outside your scope are not shown/)).toBeInTheDocument();
    expect(within(lb).getByRole('group', { name: 'Candidates' })).toBeInTheDocument();
    expect(lb.textContent).not.toMatch(LEAK_IN_RESULTS);
    expect(await axeViolations(container)).toEqual([]);
    await u.keyboard('{ArrowDown}');
    expect(box).toHaveAttribute('aria-activedescendant', expect.stringMatching(/o0$/));
    await u.keyboard('{Enter}');
    expect(screen.getByTestId('loc')).toHaveTextContent(`/applications/a7?returnTo=${encodeURIComponent('/my-work')}`);
  });
  it('keeps the My Work query on a file opened from the header', async () => {
    const u = userEvent.setup();
    renderUI('/my-work?day=tomorrow&tab=interviews');
    await u.type(screen.getByRole('combobox', { name: 'Search candidates and jobs' }), 'Ahmed');
    await screen.findAllByRole('option');
    await u.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('loc')).toHaveTextContent(`/applications/a7?returnTo=${encodeURIComponent('/my-work?day=tomorrow&tab=interviews')}`);
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
    expect(screen.getByRole('link', { name: 'Ahmed Embaby' })).toHaveAttribute('href', `/applications/a7?returnTo=${encodeURIComponent('/search?q=Ahmed')}`);
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
    expect(within(d).getByRole('link', { name: 'See all notifications' })).toHaveAttribute('href', '/notifications'); // v1 page (CoS)
    expect(await axeViolations(container)).toEqual([]);
    await u.click(within(items[0]).getByRole('button'));
    expect(api.patchApi).toHaveBeenCalledWith('/notifications/n1/read', {});
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(`/applications/a10?returnTo=${encodeURIComponent('/my-work')}`));
    expect(changed).toHaveBeenCalled();
    window.removeEventListener(NOTIFICATIONS_CHANGED, changed);
  });
  it('keeps the My Work day and tab on a notification opened from that page', async () => {
    const u = userEvent.setup();
    api.patchApi.mockResolvedValue({});
    renderUI('/my-work?day=tomorrow&tab=interviews');
    await u.click(screen.getByRole('button', { name: 'Notifications, 2 unread' }));
    const d = await screen.findByRole('dialog', { name: 'Notifications' });
    const items = await within(d).findAllByRole('listitem');
    await u.click(within(items[0]).getByRole('button'));
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(`/applications/a10?returnTo=${encodeURIComponent('/my-work?day=tomorrow&tab=interviews')}`));
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
