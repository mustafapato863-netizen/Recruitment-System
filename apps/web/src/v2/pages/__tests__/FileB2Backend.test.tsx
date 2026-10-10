import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { fileResponses, type Scenario } from '../../api/__fixtures__/applicationFile';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), putApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-mariam', displayName: 'Mariam Farag' } }) }));
import { ApplicationFileV2 } from '../ApplicationFileV2';

let responses: Record<string, unknown> = {};
function serve(scenario: Scenario, stage?: string) {
  responses = { ...fileResponses(scenario), '/users/interviewers': [] };
  if (stage) (responses['/applications/a1/workspace'] as { application: { stage: string } }).application.stage = stage;
  api.getApi.mockImplementation(async (path: string) => {
    const p = path.split('?')[0];
    if (p in responses) return structuredClone(responses[p]);
    throw new ApiError(404, 'not found');
  });
}
const renderFile = (path = '/applications/a1') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/applications/:id" element={<ApplicationFileV2 />} /></Routes></MemoryRouter>);
const bad = (body: Record<string, unknown>) => new ApiError(400, String(body.message), { statusCode: 400, ...body }, { code: body.code as string, fields: body.fields as Record<string, string[]> | undefined });

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.patchApi.mockResolvedValue({ version: 8 }); api.postApi.mockResolvedValue({}); });
afterEach(() => document.documentElement.removeAttribute('data-ui'));

describe('#21 B2-4 FILE_CLOSED', () => {
  it('a Joined file shows no move or reject actions and no moving drawer, even by URL', async () => {
    serve('prehire-done', 'Joined');
    renderFile('/applications/a1?drawer=reject');
    expect(await screen.findByTestId('file-closed')).toHaveTextContent('Joined: this file is closed and does not move.');
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('409 FILE_CLOSED from the server is shown in the drawer', async () => {
    const u = userEvent.setup();
    serve('screened');
    api.patchApi.mockRejectedValue(new ApiError(409, 'This file is Joined (closed); it cannot move to Rejected.', { statusCode: 409, code: 'FILE_CLOSED', message: 'This file is Joined (closed); it cannot move to Rejected.' }, { code: 'FILE_CLOSED' }));
    renderFile('/applications/a1?drawer=reject');
    const d = await screen.findByRole('dialog');
    await within(d).findByRole('option', { name: 'Not enough experience' });
    await u.selectOptions(within(d).getByLabelText(/Reason/), 'Not enough experience');
    await u.click(within(d).getByRole('button', { name: 'Reject' }));
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('This file is Joined (closed); it cannot move to Rejected.');
  });
});

describe('#21 "Other" rejection reason needs a note', () => {
  it('client: blocks without a 3-character note; then sends {reason:"Other", note}', async () => {
    const u = userEvent.setup();
    serve('screened');
    renderFile('/applications/a1?drawer=reject');
    const d = await screen.findByRole('dialog');
    await within(d).findByRole('option', { name: 'Other' });
    await u.selectOptions(within(d).getByLabelText(/Reason/), 'Other');
    await u.click(within(d).getByRole('button', { name: 'Reject' }));
    expect(within(d).getByText(/"Other" needs it/)).toBeInTheDocument();
    expect(api.patchApi).not.toHaveBeenCalled();
    await u.type(within(d).getByLabelText(/^Note/), 'Relocating abroad');
    await u.click(within(d).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', { stage: 'Rejected', expectedStage: 'Screening', expectedVersion: 7, reason: 'Other', note: 'Relocating abroad' }));
    expect(api.postApi).not.toHaveBeenCalled();
  });
  it('server: 400 REASON_REQUIRED {field:"note"} lands on the note input', async () => {
    const u = userEvent.setup();
    serve('screened');
    api.patchApi.mockRejectedValue(bad({ code: 'REASON_REQUIRED', field: 'note', message: 'Rejection reason "Other" needs a short note.' }));
    renderFile('/applications/a1?drawer=reject');
    const d = await screen.findByRole('dialog');
    await within(d).findByRole('option', { name: 'Other' });
    await u.selectOptions(within(d).getByLabelText(/Reason/), 'Other');
    await u.type(within(d).getByLabelText(/^Note/), 'abc');
    await u.click(within(d).getByRole('button', { name: 'Reject' }));
    expect(await within(d).findByText('Rejection reason "Other" needs a short note.')).toBeInTheDocument();
    expect(within(d).getByLabelText(/^Note/)).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('#23 400 fields inline', () => {
  it('screen drawer: fields.notes and fields.noticePeriodDays go on their inputs', async () => {
    const u = userEvent.setup();
    serve('applied');
    api.postApi.mockRejectedValue(bad({ code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', field: 'notes', fields: { notes: ['notes must be shorter than or equal to 4000 characters'], noticePeriodDays: ['noticePeriodDays must not be greater than 3650'] } }));
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Screen note/), 'Long note');
    await u.click(within(d).getByRole('button', { name: /Save/ }));
    expect(await within(d).findByText('notes must be shorter than or equal to 4000 characters')).toBeInTheDocument();
    expect(within(d).getByText('noticePeriodDays must not be greater than 3650')).toBeInTheDocument();
    expect(within(d).queryByTestId('drawer-error')).toBeNull();
  });
});
