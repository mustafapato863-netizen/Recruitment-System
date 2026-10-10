import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import * as fx from '../../api/__fixtures__/teamWork';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
const auth = vi.hoisted(() => ({ perms: ['APPLICATION_VIEW', 'OFFER_PAY_VIEW'] }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-karim', displayName: 'Karim Hassan', permissions: auth.perms, roles: [{ code: 'HIRING_MANAGER' }] } }) }));
import { TeamWorkV2 } from '../TeamWorkV2';
import { OfferDecisionDrawer } from '../../drawers/OfferDecisionDrawer';
import { bandPosition, canSeePay, decisionError, payOf } from '../../api/offerDecision';

let responses: Record<string, unknown> = {};
const serve = (extra: Record<string, unknown> = {}) => {
  responses = { ...fx.teamPaths(), ...fx.decisionPaths(), ...extra };
  api.getApi.mockImplementation(async (p: string) => {
    if (p in responses) { const v = responses[p]; if (v instanceof Error) throw v; return structuredClone(v); }
    throw new ApiError(404, `nf ${p}`);
  });
};
function Loc() { const l = useLocation(); return <div data-testid="loc">{l.pathname + l.search}</div>; }
const renderAt = (path = '/my-work?offer=o1') => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/my-work" element={<><TeamWorkV2 /><Loc /></>} /></Routes></MemoryRouter>);
};
const err = (status: number, code: string, extra: Record<string, unknown> = {}) => new ApiError(status, 'm', { code, message: 'server text', ...extra }, { code });
beforeEach(() => { vi.clearAllMocks(); serve(); auth.perms = ['APPLICATION_VIEW', 'OFFER_PAY_VIEW']; });

describe('M3 offer decision (B7)', () => {
  it('opens from Team work; Manager sees base pay, allowances apart, the Grade 8 band (inside); approve → toast; axe', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({ id: 'd1', decision: 'Approve', toStatus: 'Approved' });
    const { baseElement } = renderAt('/my-work');
    await u.click(await screen.findByRole('button', { name: 'Review offer: Lina Hassan' }));
    const d = await screen.findByRole('dialog', { name: 'Offer for Lina Hassan' });
    expect(await within(d).findByText('Submitted by Mariam Farag')).toBeInTheDocument();
    expect(within(d).getByTestId('base-pay')).toHaveTextContent('62,000');
    expect(d).toHaveTextContent('Allowances (EGP)9,500Not counted in the band');
    const band = within(d).getByRole('region', { name: 'Pay band' });
    expect(band).toHaveTextContent('Grade 8 band · monthly basic, EGP');
    expect(band).toHaveTextContent('Inside band');
    expect(band).toHaveTextContent('Min 48,000Mid 60,000Max 72,000');
    expect(within(band).getByTestId('band-text')).toHaveTextContent('Offer 62,000 sits inside the band, 2,000 above the midpoint.');
    expect(d).toHaveTextContent(/Grade 8.*Sun 1 Nov 2026.*Full-time · 2 years.*3 months/);
    expect(await axeViolations(baseElement)).toEqual([]);
    await u.click(within(d).getByRole('button', { name: 'Approve offer' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/versions/ov1/decision', { decision: 'Approve' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Offer for Lina Hassan approved. Mariam can send it now.');
    expect(screen.getByTestId('loc')).toHaveTextContent('/my-work');
  });
  it('request changes and reject need a comment; reject is two-step and withdraws only this version', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({});
    renderAt();
    const d = await screen.findByRole('dialog', { name: 'Offer for Lina Hassan' });
    await within(d).findByText('Submitted by Mariam Farag');
    await u.click(within(d).getByRole('button', { name: 'Request changes' }));
    expect(within(d).getByText('Write a comment to request changes (at least 3 characters).')).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.type(within(d).getByLabelText(/^Comment to Mariam/), 'Move start to 15 Nov');
    await u.click(within(d).getByRole('button', { name: 'Request changes' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/versions/ov1/decision', { decision: 'RequestChanges', reason: 'Move start to 15 Nov' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Changes requested on Lina Hassan’s offer. It is back with Mariam as a draft.');
  });
  it('reject: confirm step, then Reject with the reason', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValue({});
    renderAt();
    const d = await screen.findByRole('dialog', { name: 'Offer for Lina Hassan' });
    await within(d).findByText('Submitted by Mariam Farag');
    await u.type(within(d).getByLabelText(/^Comment to Mariam/), 'Over budget for this role');
    await u.click(within(d).getByRole('button', { name: 'Reject this version' }));
    expect(api.postApi).not.toHaveBeenCalled();
    await u.click(within(d).getByRole('button', { name: 'Confirm reject v1' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/versions/ov1/decision', { decision: 'Reject', reason: 'Over budget for this role' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Offer v1 for Lina Hassan rejected. The file stays in Offer; Mariam drafts a new version or closes the file.');
  });
  it('409 OFFER_PAY_OUTSIDE_BAND shows the server band + offered pay; 409 GRADE_BAND_MISSING; 403 co-owner', async () => {
    const u = userEvent.setup();
    serve({ '/master-data/grade-bands': [] });
    api.postApi
      .mockRejectedValueOnce(err(409, 'OFFER_PAY_OUTSIDE_BAND', { band: { id: 'gb8', grade: 'Grade 8', site: 'Offshore Cairo', currency: 'EGP', minMonthlyBase: 48000, maxMonthlyBase: 60000 }, offeredMonthlyBase: 62000 }))
      .mockRejectedValueOnce(err(409, 'GRADE_BAND_MISSING', { band: { grade: 'Grade 8', site: 'Offshore Cairo', currency: 'EGP' } }))
      .mockRejectedValueOnce(err(403, 'OFFER_DECISION_NOT_MANAGER'));
    renderAt();
    const d = await screen.findByRole('dialog', { name: 'Offer for Lina Hassan' });
    await within(d).findByText('Submitted by Mariam Farag');
    expect(within(d).getByRole('region', { name: 'Pay band' })).toHaveTextContent('No active band for Grade 8');
    await u.click(within(d).getByRole('button', { name: 'Approve offer' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Base pay is outside the band.');
    const band = within(d).getByRole('region', { name: 'Pay band' });
    expect(band).toHaveTextContent('Above band');
    expect(within(band).getByTestId('band-text')).toHaveTextContent('Offer 62,000 is 2,000 above the maximum. Approve is refused (OFFER_PAY_OUTSIDE_BAND).');
    await u.click(within(d).getByRole('button', { name: 'Approve offer' }));
    expect(await within(d).findByText(/No active pay band for this grade, site and currency/)).toBeInTheDocument();
    expect(within(d).getByRole('region', { name: 'Pay band' })).toHaveTextContent('No active band for Grade 8 at Offshore Cairo in EGP. Approve is refused until an admin adds it (GRADE_BAND_MISSING).');
    await u.click(within(d).getByRole('button', { name: 'Approve offer' }));
    expect(await within(d).findByText('Only the manager of this file’s owner can decide. If you co-own the file, your own manager decides it.')).toBeInTheDocument();
  });
  it('no OFFER_PAY_VIEW → no pay, no band amounts, ever (even if the API sent them)', async () => {
    auth.perms = ['APPLICATION_VIEW'];
    const { container } = renderAt();
    const d = await screen.findByRole('dialog', { name: 'Offer for Lina Hassan' });
    await within(d).findByText('Submitted by Mariam Farag');
    expect(d).toHaveTextContent('Pay and the band are visible to the Manager only.');
    expect(within(d).queryByRole('region', { name: 'Pay band' })).toBeNull();
    expect(container.ownerDocument.body.textContent).not.toMatch(/62,?000|9,?500|48,?000|72,?000|71,?500/);
  });
  it('a decided version: nothing to decide, Close only', async () => {
    serve({ '/offers/o1': { ...fx.pendingOffers[0], status: 'Approved', versions: [{ ...(fx.pendingOffers[0].versions as Array<Record<string, unknown>>)[0], status: 'Approved' }] } });
    render(<MemoryRouter><OfferDecisionDrawer offerId="o1" ownerName="Mariam Farag" showPay onClose={() => {}} onDone={() => {}} /></MemoryRouter>);
    const d = await screen.findByRole('dialog');
    expect(await within(d).findByText('This version is Approved; there is nothing to decide.')).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Approve offer' })).toBeNull();
  });
  it('helpers: base pay from Salary only (annual/12), band position, pay gate, codes', () => {
    expect(payOf({ id: 'v', versionNumber: 1, createdAt: '', components: [{ type: 'Salary', name: 'B', amount: 120000, currency: 'EGP', frequency: 'Annual' }, { type: 'Salary', name: 'T', amount: 1000, currency: 'EGP' }, { type: 'Allowance', name: 'H', amount: 500, currency: 'EGP' }] }))
      .toEqual({ base: { amount: 11000, currency: 'EGP' }, allowances: { amount: 500, currency: 'EGP' }, mixed: false });
    expect(payOf({ id: 'v', versionNumber: 1, createdAt: '', components: [{ type: 'Salary', name: 'B', amount: 1, currency: 'EGP' }, { type: 'Salary', name: 'B', amount: 1, currency: 'AED' }] }).mixed).toBe(true);
    expect(bandPosition({ minMonthlyBase: 10, maxMonthlyBase: 20 }, 10)).toBe('inside');
    expect(bandPosition({ minMonthlyBase: 10, maxMonthlyBase: 20 }, 21)).toBe('above');
    expect(bandPosition({}, 21)).toBeNull();
    expect(canSeePay('manager', ['OFFER_PAY_VIEW'])).toBe(true);
    expect(canSeePay('employee', ['OFFER_PAY_VIEW'])).toBe(false);
    expect(canSeePay('admin', ['OFFER_PAY_VIEW'])).toBe(false);
    expect(decisionError(err(409, 'OFFER_NOT_PENDING_APPROVAL')).text).toMatch(/Reload/);
    expect(decisionError(err(400, 'DECISION_REASON_REQUIRED')).field).toBe('reason');
    expect(decisionError(err(409, 'OFFER_BASE_PAY_MISSING')).text).toMatch(/no base pay/);
    expect(decisionError(new ApiError(500, 'Boom')).text).toBe('Boom');
  });
});
