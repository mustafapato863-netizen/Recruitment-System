import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { TalentPoolDetailRoute, TalentPoolsListRoute } from '../TalentPoolsRoute';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), deleteApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));

const emptyPage = { data: [], total: 0, page: 1, pageSize: 100 };
const detail = {
  pool: {
    id: 'pool-1',
    name: 'ICU nurses',
    description: 'People who can cover ICU',
    tags: ['nursing'],
    status: 'Active',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
  candidates: [],
  total: 0,
  page: 1,
  pageSize: 100,
};

function renderAt(path: string) {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/talent-pools" element={<TalentPoolsListRoute />} />
    <Route path="/talent-pools/:id" element={<TalentPoolDetailRoute />} />
  </Routes></MemoryRouter>);
}

function calledPaths() {
  return [...api.getApi.mock.calls, ...api.postApi.mock.calls, ...api.patchApi.mock.calls, ...api.deleteApi.mock.calls]
    .map((call) => String(call[0]));
}

beforeEach(() => {
  api.getApi.mockReset();
  api.postApi.mockReset();
  api.patchApi.mockReset();
  api.deleteApi.mockReset();
  api.getApi.mockResolvedValue(emptyPage);
});

describe('Talent pools page', () => {
  it('shows an empty list', async () => {
    renderAt('/talent-pools');
    expect(await screen.findByRole('heading', { name: 'No talent pools' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Talent pools' })).not.toBeInTheDocument();
  });

  it('shows a failed load', async () => {
    api.getApi.mockRejectedValue(new ApiError(500, 'Pools are unavailable.'));
    renderAt('/talent-pools');
    expect(await screen.findByRole('alert')).toHaveTextContent('Pools are unavailable.');
    expect(screen.queryByRole('heading', { name: 'No talent pools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Talent pools' })).not.toBeInTheDocument();
  });

  it('shows a forbidden response', async () => {
    api.getApi.mockRejectedValue(new ApiError(403, 'no'));
    renderAt('/talent-pools');
    expect(await screen.findByText('You do not have access to this')).toBeInTheDocument();
    expect(screen.getByText('Your role does not include talent pools.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No talent pools' })).not.toBeInTheDocument();
  });

  it('adds a member without calling an application stage API', async () => {
    const user = userEvent.setup();
    api.getApi.mockImplementation(async (path: string) => {
      const resource = path.split('?')[0];
      if (resource === '/talent-pools/pool-1') return structuredClone(detail);
      if (resource === '/candidates') {
        return { data: [{ id: 'c1', candidateCode: 'C-1', firstName: 'Heba', lastName: 'Mansour', status: 'Active', email: 'heba@x.test', phone: '+20 100' }], total: 1 };
      }
      throw new ApiError(404, 'not found');
    });
    api.postApi.mockResolvedValue({ id: 'membership-1' });
    renderAt('/talent-pools/pool-1');
    expect(await screen.findByRole('heading', { name: 'ICU nurses' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Person'), 'Heba');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('radio', { name: 'Choose Heba Mansour' }));
    expect(screen.queryByText('heba@x.test')).not.toBeInTheDocument();
    expect(screen.queryByText('+20 100')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to this pool' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/talent-pools/pool-1/candidates', { candidateId: 'c1' }));
    expect(calledPaths().some((path) => path.includes('/applications') || path.includes('stage'))).toBe(false);
  });
});
