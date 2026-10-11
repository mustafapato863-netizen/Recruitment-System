import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { isoDate } from '../../api/applicationFile';

const api = vi.hoisted(() => ({ getApi: vi.fn() }));
vi.mock('../../../api/client', () => api);
const shell = vi.hoisted(() => ({ value: { seat: 'employee' } as { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
import { EntityLinkRoute } from '../EntityLinkRoute';

function Where() { const l = useLocation(); return <output aria-label="where">{l.pathname + l.search}</output>; }
const at = (url: string) => render(<MemoryRouter initialEntries={[url]}><Routes>
  <Route path="/offers/:id" element={<EntityLinkRoute kind="offer" />} /><Route path="/hires/:id" element={<EntityLinkRoute kind="hire" />} /><Route path="*" element={<Where />} />
</Routes></MemoryRouter>);

describe('PR33-1 offer/hire deep links open the file', () => {
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
});

describe('PRE-1 offer dates', () => {
  it('date-only input goes out as a full ISO timestamp; ISO and empty pass through', () => {
    expect(isoDate('2026-12-01')).toBe('2026-12-01T00:00:00.000Z');
    expect(isoDate('2026-12-01T00:00:00.000Z')).toBe('2026-12-01T00:00:00.000Z');
    expect(isoDate(undefined)).toBeUndefined();
  });
});
