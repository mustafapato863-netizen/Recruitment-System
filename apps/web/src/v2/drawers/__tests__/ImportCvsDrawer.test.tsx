import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { jobDetail, noDup } from '../../api/__fixtures__/jobs';

const api = vi.hoisted(() => ({ postFormDataApi: vi.fn(), postApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
import { ImportCvsDrawer } from '../ImportCvsDrawer';

beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); api.postApi.mockResolvedValue(noDup); });

it.each([500, 503])('reports HTTP %s as a processing failure and retries the same file successfully', async (status) => {
  const u = userEvent.setup();
  api.postFormDataApi.mockRejectedValueOnce(new ApiError(status, 'Processing is temporarily unavailable.', undefined,
    { code: status === 503 ? 'INTEGRATION_UNAVAILABLE' : 'INTERNAL_ERROR', retryable: true }))
    .mockResolvedValueOnce({ firstName: 'Test', lastName: 'Applicant', email: 'test@example.com' });
  render(<MemoryRouter><ImportCvsDrawer job={{ ...jobDetail(), status: 'Open', assignments: [] }} onClose={vi.fn()} onDone={vi.fn()} /></MemoryRouter>);
  const d = screen.getByRole('dialog');
  await u.upload(within(d).getByLabelText(/Drop CVs or/), new File(['synthetic'], 'synthetic.pdf', { type: 'application/pdf' }));
  const row = await within(d).findByRole('listitem');
  await waitFor(() => expect(row).toHaveTextContent('Failed'));
  expect(row).not.toHaveTextContent('Unreadable');
  expect(within(row).getByRole('alert')).toHaveTextContent('Processing is temporarily unavailable.');
  await u.click(within(row).getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(row).toHaveTextContent('Parsed'));
  expect(within(d).getByRole('button', { name: 'Import 1 to Applied' })).toBeEnabled();
  expect(api.postFormDataApi).toHaveBeenCalledTimes(2);
  expect(api.postApi.mock.calls.every(([path]) => path === '/candidates/duplicate-check')).toBe(true);
});

it('keeps a real invalid-file response distinct from a processing outage', async () => {
  const u = userEvent.setup();
  api.postFormDataApi.mockRejectedValueOnce(new ApiError(400, 'No readable text. Upload a text PDF.', undefined, { code: 'FILE_INVALID' }));
  render(<MemoryRouter><ImportCvsDrawer job={{ ...jobDetail(), status: 'Open', assignments: [] }} onClose={vi.fn()} onDone={vi.fn()} /></MemoryRouter>);
  const d = screen.getByRole('dialog');
  await u.upload(within(d).getByLabelText(/Drop CVs or/), new File(['synthetic'], 'scan.pdf', { type: 'application/pdf' }));
  await waitFor(() => expect(within(d).getByRole('listitem')).toHaveTextContent('Unreadable'));
  expect(within(d).getByRole('button', { name: 'Import 0 to Applied' })).toBeDisabled();
});
