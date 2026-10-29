import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isoDate } from '../../api/applicationFile';

const api = vi.hoisted(() => ({ getApi: vi.fn() }));
vi.mock('../../../api/client', () => api);
const shell = vi.hoisted(() => ({ value: { seat: 'employee' } as { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
const auth = vi.hoisted(() => ({ user: null as null | { roles?: Array<{ code: string }>; permissions?: string[] } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
import { EntityLinkRoute } from '../EntityLinkRoute';

function Where() { const l = useLocation(); return <output aria-label="where">{l.pathname + l.search}</output>; }
const at = (url: string) => render(<MemoryRouter initialEntries={[url]}><Routes>
  <Route path="/offers/:id" element={<EntityLinkRoute kind="offer" />} /><Route path="/hires/:id" element={<EntityLinkRoute kind="hire" />} /><Route path="*" element={<Where />} />
</Routes></MemoryRouter>);

const where = async () => (await screen.findByLabelText('where')).textContent;
describe('PR33-1 offer/hire deep links open the file', () => {
  beforeEach(() => {
    auth.user = null;
    shell.value = { seat: 'employee' };
    api.getApi.mockReset();
  });
  it('Employee: /offers/:id → the offer’s file', async () => {
    shell.value = { seat: 'employee' }; api.getApi.mockResolvedValue({ id: 'o1', applicationId: 'a1' });
    at('/offers/o1');
    expect(await screen.findByLabelText('where')).toHaveTextContent('/applications/a1');
    expect(api.getApi).toHaveBeenCalledWith('/offers/o1');
  });
  it('Manager: /offers/:id → the file with the offer decision open (?decide=)', async () => {
    shell.value = { seat: 'manager' }; api.getApi.mockResolvedValue({ id: 'o1', applicationId: 'a1' });
    at('/offers/o1');
    expect(await screen.findByLabelText('where')).toHaveTextContent('/applications/a1?decide=o1');
  });
  it('/hires/:id → the hiring case’s file; an unknown id → My Work', async () => {
    shell.value = { seat: 'employee' }; api.getApi.mockResolvedValueOnce({ id: 'h1', application: { id: 'a7' } });
    at('/hires/h1');
    expect(await screen.findByLabelText('where')).toHaveTextContent('/applications/a7');
    expect(api.getApi).toHaveBeenCalledWith('/hiring/h1');
  });
  it('a failing lookup falls back to My Work', async () => {
    api.getApi.mockRejectedValueOnce(new Error('404'));
    at('/offers/zz');
    expect(await screen.findByLabelText('where')).toHaveTextContent('/my-work');
  });
  it('keeps an allowed return on the file, including the manager decision', async () => {
    auth.user = { roles: [{ code: 'RECRUITER' }], permissions: ['APPLICATION_VIEW', 'CANDIDATE_VIEW', 'VACANCY_VIEW'] };
    api.getApi.mockResolvedValue({ applicationId: 'a1' });
    at(`/offers/o1?returnTo=${encodeURIComponent('/candidates?stage=Interview&q=laravel')}`);
    expect(await where()).toBe(`/applications/a1?returnTo=${encodeURIComponent('/candidates?stage=Interview&q=laravel')}`);
  });
  it('manager offer links keep decide= and an allowed My Work return', async () => {
    shell.value = { seat: 'manager' };
    auth.user = { roles: [{ code: 'HIRING_MANAGER' }], permissions: ['APPLICATION_VIEW'] };
    api.getApi.mockResolvedValue({ applicationId: 'a1' });
    at(`/offers/o1?returnTo=${encodeURIComponent('/my-work?filter=waiting')}`);
    expect(await where()).toBe(`/applications/a1?decide=o1&returnTo=${encodeURIComponent('/my-work?filter=waiting')}`);
  });
  it('drops an external, malformed, or unauthorized return and still opens the file', async () => {
    auth.user = { roles: [{ code: 'RECRUITER' }], permissions: ['APPLICATION_VIEW', 'CANDIDATE_VIEW', 'VACANCY_VIEW'] };
    api.getApi.mockResolvedValue({ applicationId: 'a1' });
    const { unmount } = at(`/offers/o1?returnTo=${encodeURIComponent('https://evil.example/candidates')}`);
    expect(await where()).toBe('/applications/a1');
    unmount();
    at(`/offers/o1?returnTo=${encodeURIComponent('//evil.example/candidates')}`);
    expect(await where()).toBe('/applications/a1');
  });
  it('drops a candidates return the employee cannot open', async () => {
    auth.user = { roles: [{ code: 'RECRUITER' }], permissions: ['APPLICATION_VIEW'] };
    api.getApi.mockResolvedValue({ applicationId: 'a1' });
    at(`/offers/o1?returnTo=${encodeURIComponent('/candidates')}`);
    expect(await where()).toBe('/applications/a1');
    expect(api.getApi).toHaveBeenCalledWith('/offers/o1');
  });
  it('drops a candidates return for a manager, whose shell would leave that page', async () => {
    shell.value = { seat: 'manager' };
    auth.user = { roles: [{ code: 'HIRING_MANAGER' }], permissions: ['APPLICATION_VIEW', 'CANDIDATE_VIEW'] };
    api.getApi.mockResolvedValue({ applicationId: 'a1' });
    at(`/offers/o1?returnTo=${encodeURIComponent('/candidates?stage=Interview')}`);
    expect(await where()).toBe('/applications/a1?decide=o1');
  });
  it('a failed lookup uses the specialist or admin home', async () => {
    auth.user = { roles: [{ code: 'LICENSE_SPECIALIST' }], permissions: ['LICENSE_CHECK'] };
    api.getApi.mockRejectedValue(new Error('404'));
    const { unmount } = at('/offers/missing');
    expect(await where()).toBe('/licenses');
    unmount();
    auth.user = { roles: [{ code: 'FINAL_HIRING_APPROVER' }], permissions: ['FINAL_HIRING_APPROVAL'] };
    api.getApi.mockRejectedValue(new Error('404'));
    const again = at('/offers/missing');
    expect(await where()).toBe('/hires/approvals/inbox');
    again.unmount();
    shell.value = { seat: 'admin' };
    auth.user = { roles: [{ code: 'ADMINISTRATOR' }], permissions: [] };
    api.getApi.mockRejectedValue(new Error('404'));
    at('/offers/missing');
    expect(await where()).toBe('/users');
  });
  it('an interviewer-only visit does not look up the offer and lands on My interviews', async () => {
    auth.user = { roles: [{ code: 'INTERVIEWER' }], permissions: ['VACANCY_VIEW', 'INTERVIEW_PARTICIPATE'] };
    at(`/offers/o1?returnTo=${encodeURIComponent('/candidates')}`);
    expect(await where()).toBe('/my-interviews');
    expect(api.getApi).not.toHaveBeenCalled();
  });
});

describe('PRE-1 offer dates', () => {
  it('date-only input goes out as a full ISO timestamp; ISO and empty pass through', () => {
    expect(isoDate('2026-12-01')).toBe('2026-12-01T00:00:00.000Z');
    expect(isoDate('2026-12-01T00:00:00.000Z')).toBe('2026-12-01T00:00:00.000Z');
    expect(isoDate(undefined)).toBeUndefined();
  });
});
