/** B2-23 (Figma 09 "Approval on the same file") + B2-15 (decision body = B7 ManagerDecisionDto; API errors shown). */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { fileResponses } from '../../api/__fixtures__/applicationFile';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), putApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const auth = vi.hoisted(() => ({ perms: ['APPLICATION_VIEW', 'OFFER_PAY_VIEW'] }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-karim', displayName: 'Karim Hassan', permissions: auth.perms } }) }));
import { ApplicationFileV2 } from '../ApplicationFileV2';
import { decisionBody, decisionError, defaultCurrency } from '../../api/offerDecision';

const bands = [{ id: 'b1', grade: { id: 'g8', name: 'Grade 8' }, site: { id: 'br1', name: 'Offshore Cairo' }, currency: 'AED', status: 'Active', minMonthlyBase: 12000, maxMonthlyBase: 18000 }];
function serve(extra: Record<string, unknown> = {}) {
  const r: Record<string, unknown> = { ...fileResponses('offer-pending'), '/master-data/grade-bands': bands, ...extra };
  const o = r['/offers/o1'] as Record<string, unknown>;
  r['/offers/o1'] = { ...o, candidateName: 'Ahmed Embaby', grade: { id: 'g8', name: 'Grade 8' }, branchId: 'br1', location: 'Offshore Cairo', currentVersion: { ...(o.currentVersion as object), components: [] }, versions: [] };
  api.getApi.mockImplementation(async (path: string) => {
    const p = path.split('?')[0];
    if (p in r) { const v = r[p]; if (v instanceof Error) throw v; return structuredClone(v); }
    throw new ApiError(404, 'not found');
  });
}
const renderFile = (path = '/applications/a1') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/applications/:id" element={<ApplicationFileV2 mode="manager" />} /></Routes></MemoryRouter>);
};
beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); auth.perms = ['APPLICATION_VIEW', 'OFFER_PAY_VIEW']; serve(); });
afterEach(() => document.documentElement.removeAttribute('data-ui'));

describe('B2-23: the Manager decides on the same file', () => {
  it('file is read-only for the Manager: no Reject / owner actions / notes form; shows scorecards and salary', async () => {
    renderFile();
    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent('Ahmed Embaby');
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Team work/ })).toHaveAttribute('href', '/my-work');
    expect(screen.getByRole('region', { name: 'Scorecards and fit' })).toHaveTextContent('1 submitted · average 4 / 5');
    const salary = screen.getByRole('region', { name: 'Salary' });
    expect(salary).toHaveTextContent('35,000 EGP');
    expect(salary).toHaveTextContent('42,000 EGP');
    expect(screen.getByRole('button', { name: 'Review offer' })).toBeInTheDocument();
  });
  it('without OFFER_PAY_VIEW there is no salary on the file', async () => {
    auth.perms = ['APPLICATION_VIEW'];
    renderFile();
    await screen.findByRole('heading', { level: 2 });
    expect(screen.queryByRole('region', { name: 'Salary' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/42,000|35,000/);
  });
  it('?decide opens the decision drawer over the file; currency defaults to the band (AED), band range shown', async () => {
    renderFile('/applications/a1?decide=o1');
    const d = await screen.findByRole('dialog', { name: 'Offer for Ahmed Embaby' });
    expect(await within(d).findByLabelText(/^Monthly basic pay \(AED\)/)).toBeInTheDocument();
    const band = within(d).getByRole('region', { name: 'Pay band' });
    expect(band).toHaveTextContent('Min 12,000Mid 15,000Max 18,000');
    expect(screen.getByRole('region', { name: 'Timeline' })).toBeInTheDocument(); // the file stays behind the drawer
  });
  it('Approve sends the flat B7 body; a 400 shows the API message in the drawer', async () => {
    const u = userEvent.setup();
    api.postApi.mockRejectedValue(new ApiError(400, 'Please correct the highlighted fields.', { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields: ['basePay'] }, { code: 'VALIDATION_ERROR' }));
    renderFile('/applications/a1?decide=o1');
    const d = await screen.findByRole('dialog', { name: 'Offer for Ahmed Embaby' });
    await u.type(await within(d).findByLabelText(/^Monthly basic pay/), '15000');
    await u.click(within(d).getByRole('button', { name: 'Approve offer' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/versions/ov1/decision', { decision: 'Approve', basePay: 15000, currency: 'AED', allowances: [] }));
    expect(await within(d).findByTestId('decision-error')).toHaveTextContent('Please correct the highlighted fields.');
  });
});

describe('#23 (f64406b) 400 field/fields inline in the decision drawer', () => {
  it('basePay and allowances.0.amount messages sit on their inputs; no banner when every message landed', async () => {
    const u = userEvent.setup();
    const fields = { basePay: ['basePay must be a positive number'], 'allowances.0.amount': ['amount must not be less than 0'] };
    api.postApi.mockRejectedValue(new ApiError(400, 'x', { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', field: 'basePay', fields }, { code: 'VALIDATION_ERROR', fields }));
    renderFile('/applications/a1?decide=o1');
    const d = await screen.findByRole('dialog', { name: 'Offer for Ahmed Embaby' });
    await u.type(await within(d).findByLabelText(/^Monthly basic pay/), '15000');
    await u.click(within(d).getByRole('button', { name: 'Add allowance' }));
    await u.type(within(d).getByLabelText(/^Allowance 1 name/), 'Housing');
    await u.type(within(d).getByLabelText(/^Allowance 1 \(/), '2000');
    await u.click(within(d).getByRole('button', { name: 'Approve offer' }));
    expect(await within(d).findByText('basePay must be a positive number')).toBeInTheDocument();
    expect(within(d).getByText('amount must not be less than 0')).toBeInTheDocument();
    expect(within(d).getByLabelText(/^Monthly basic pay/)).toHaveAttribute('aria-invalid', 'true');
    expect(within(d).queryByTestId('decision-error')).toBeNull();
  });
});

describe('B2-15 helpers', () => {
  it('decisionBody is the B7 DTO: top-level pay, never nested', () => {
    expect(decisionBody('Approve', undefined, { basePay: 15000, currency: 'AED', allowances: [{ name: 'Housing', amount: 2000 }] }))
      .toEqual({ decision: 'Approve', basePay: 15000, currency: 'AED', allowances: [{ name: 'Housing', amount: 2000, frequency: 'Monthly' }] });
    expect(decisionBody('Reject', 'Too high', { basePay: 1, currency: 'AED', allowances: [] })).toEqual({ decision: 'Reject', reason: 'Too high' });
    expect(decisionBody('Approve')).not.toHaveProperty('pay');
  });
  it('unknown codes show the server message and the named fields', () => {
    const e = decisionError(new ApiError(400, 'Please correct the highlighted fields.', { code: 'VALIDATION_ERROR', fields: { currency: 'bad' } }, { code: 'VALIDATION_ERROR' }));
    expect(e).toMatchObject({ field: 'pay', text: 'Please correct the highlighted fields. (currency)' });
  });
  it('defaultCurrency picks the band for grade + site', () => {
    expect(defaultCurrency(bands, { id: 'o', applicationId: 'a', offerCode: 'x', status: 'Pending Approval', grade: { id: 'g8', name: 'Grade 8' }, branchId: 'br1' })).toBe('AED');
    expect(defaultCurrency(bands, { id: 'o', applicationId: 'a', offerCode: 'x', status: 'Pending Approval', grade: { id: 'g9', name: 'Grade 9' } })).toBeNull();
  });
});
