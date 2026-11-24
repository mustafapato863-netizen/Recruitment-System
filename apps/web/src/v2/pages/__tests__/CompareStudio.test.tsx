import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { CompareV2 } from '../CompareV2';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), postFormDataApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', displayName: 'Mariam Farag' } }),
}));
const shell = vi.hoisted(() => ({ value: null as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));

function Loc() {
  const l = useLocation();
  return <output data-testid="loc" hidden>{l.pathname + l.search}</output>;
}

function renderCompare() {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(
    <MemoryRouter initialEntries={['/candidates/compare']}>
      <Routes>
        <Route path="/candidates/compare" element={<><CompareV2 /><Loc /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const JOB_ID = 'job-rn-001';
const NABIL_ID = 'cand-nabil-ahmed';
const SARA_ID = 'cand-sara-ahmed';

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.postApi.mockResolvedValue({ id: 'app-new' });
  api.getApi.mockImplementation(async (path: string) => {
    if (path === '/candidates?pageSize=100&page=1&status=Active') return { data: [], total: 0 };
    throw new ApiError(404, 'not found');
  });
});

describe('Compare studio shortlist selection', () => {
  it('clicking a recommendation card selects it with a visible selected state and no fake checkbox', async () => {
    renderCompare();

    // No control that claims to toggle a selection remains.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    // The first candidate is selected by default and shown as text in the header.
    expect(screen.getByText('Selected:')).toBeInTheDocument();
    expect(within(screen.getByText('Selected:').closest('p')!).getByText('Nabil Ahmed')).toBeInTheDocument();
    const nabilCard = screen.getByRole('button', { name: 'Select Nabil Ahmed for shortlist' });
    const saraCard = screen.getByRole('button', { name: 'Select Sara Ahmed for shortlist' });
    expect(nabilCard).toHaveAttribute('aria-pressed', 'true');
    expect(nabilCard).toHaveClass('rf2-cstudio__rec-item--selected');
    expect(saraCard).toHaveAttribute('aria-pressed', 'false');
    expect(saraCard).not.toHaveClass('rf2-cstudio__rec-item--selected');

    fireEvent.click(saraCard);

    expect(saraCard).toHaveAttribute('aria-pressed', 'true');
    expect(saraCard).toHaveClass('rf2-cstudio__rec-item--selected');
    expect(nabilCard).toHaveAttribute('aria-pressed', 'false');
    expect(nabilCard).not.toHaveClass('rf2-cstudio__rec-item--selected');
    expect(within(screen.getByText('Selected:').closest('p')!).getByText('Sara Ahmed')).toBeInTheDocument();
    // Exactly one "Selected" badge, on the selected card.
    expect(screen.getAllByText('Selected')).toHaveLength(1);
    expect(within(saraCard).getByText('Selected')).toBeInTheDocument();
  });

  it('shortlist calls addToJob with (job id, candidate id) and shows success only after the call resolves', async () => {
    renderCompare();
    fireEvent.click(await screen.findByRole('button', { name: 'Shortlist selected candidate' }));

    expect(api.postApi).toHaveBeenCalledWith('/applications', {
      vacancyId: JOB_ID,
      candidateId: NABIL_ID,
      source: 'Suggested from bank',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Nabil Ahmed shortlisted for Registered Nurse (CND-SGH-001).',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The shortlisted candidate is now shown as moved in the matrix.
    expect(screen.getByRole('button', { name: 'In pipeline' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Move to pipeline' })).toHaveLength(2);
  });

  it('a failed shortlist shows an error and does not mark the candidate moved', async () => {
    api.postApi.mockRejectedValueOnce(new Error('boom'));
    renderCompare();
    fireEvent.click(await screen.findByRole('button', { name: 'Shortlist selected candidate' }));

    expect(api.postApi).toHaveBeenCalledWith('/applications', {
      vacancyId: JOB_ID,
      candidateId: NABIL_ID,
      source: 'Suggested from bank',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not shortlist Nabil Ahmed');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Move to pipeline' })).toHaveLength(3);
  });

  it('move to pipeline calls addToJob with (job id, candidate id) in that order', async () => {
    renderCompare();
    const moveButtons = await screen.findAllByRole('button', { name: 'Move to pipeline' });
    fireEvent.click(moveButtons[0]);

    // The old code passed (candidate id, job id) — swapped.
    expect(api.postApi).toHaveBeenCalledWith('/applications', {
      vacancyId: JOB_ID,
      candidateId: NABIL_ID,
      source: 'Suggested from bank',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Nabil Ahmed moved to pipeline for Registered Nurse (CND-SGH-001).',
    );
    expect(screen.getByRole('button', { name: 'In pipeline' })).toBeInTheDocument();
  });

  it('a failed move to pipeline shows an error and does not mark the candidate moved', async () => {
    api.postApi.mockRejectedValueOnce(new Error('boom'));
    renderCompare();
    const moveButtons = await screen.findAllByRole('button', { name: 'Move to pipeline' });
    fireEvent.click(moveButtons[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not move Nabil Ahmed to pipeline');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'In pipeline' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Move to pipeline' })).toHaveLength(3);
  });

  it('shortlisting a different selected candidate uses that candidate id', async () => {
    renderCompare();
    fireEvent.click(await screen.findByRole('button', { name: 'Select Sara Ahmed for shortlist' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shortlist selected candidate' }));

    expect(api.postApi).toHaveBeenCalledWith('/applications', {
      vacancyId: JOB_ID,
      candidateId: SARA_ID,
      source: 'Suggested from bank',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Sara Ahmed shortlisted for Registered Nurse');
  });
});
