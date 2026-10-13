import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import { fileResponses, type Scenario } from '../../api/__fixtures__/applicationFile';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), putApi: vi.fn() }));
const authState = vi.hoisted(() => ({ user: { id: 'u-mariam', displayName: 'Mariam Farag', permissions: [] as string[] } }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: authState.user }) }));
import { loadApplicationFile } from '../../api/applicationFile';
import { ApplicationFileV2 } from '../ApplicationFileV2';
import { cairoIso } from '../../drawers/FileDrawers';

let responses: Record<string, unknown> = {};
function serve(scenario: Scenario, extra: Record<string, unknown> = {}) {
  responses = { ...fileResponses(scenario), '/users/interviewers': [{ id: 'u-karim', displayName: 'Karim Hassan', email: 'k@x', jobTitle: 'Hiring manager', roles: [] }], ...extra };
  api.getApi.mockImplementation(async (path: string) => {
    const p = path.split('?')[0];
    if (p in responses) { const v = responses[p]; if (v instanceof Error) throw v; return structuredClone(v); }
    throw new ApiError(404, 'not found');
  });
}
function Loc() { const l = useLocation(); return <output data-testid="loc" hidden>{l.pathname + l.search}</output>; }
function renderFile(path = '/applications/a1') {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/applications/:id" element={<><ApplicationFileV2 /><Loc /></>} /></Routes></MemoryRouter>);
}
const PAY = /42000|42,000|504000|504,000|30000|EGP|AED|salary|package|compensation/i;

beforeEach(() => { authState.user.permissions = []; Object.values(api).forEach((f) => f.mockReset()); api.postApi.mockImplementation(async (p: string) => (p === '/offers' ? 'o1' : { id: 'h1', alreadyJoined: false })); api.patchApi.mockImplementation(async () => ({ version: 8 })); });
afterEach(() => document.documentElement.removeAttribute('data-ui'));

describe('pay safety', () => {
  it('loadApplicationFile strips every pay field the API sends', async () => {
    serve('prehire');
    const file = await loadApplicationFile('a1');
    expect(JSON.stringify(file)).not.toMatch(/salary|monthlyPackage|annualFixed|components|currency|packageTotal|"amount"/i);
    expect(file.offer?.offerCode).toBe('OFF-2026-0012');
    expect(file.joiningChecks.map((c) => [c.type, c.verified])).toEqual([['ID', true], ['CONTRACT', false], ['SCFHS_LICENCE', false]]);
    expect(file.documents.map((d) => d.name)).toEqual(['Ahmed_Embaby_CV.pdf', 'Laravel_cert.pdf']);
    expect(api.getApi).toHaveBeenCalledWith('/offers?applicationId=a1');
    expect(api.getApi).toHaveBeenCalledWith('/hiring?applicationId=a1');
  });
  it.each(['offer-pending', 'offer-sent', 'prehire'] as const)('%s: no pay anywhere on the page or in drawers', async (sc) => {
    serve(sc);
    const { container } = renderFile('/applications/a1?drawer=waiting');
    await screen.findByRole('dialog');
    expect(document.body.textContent).not.toMatch(PAY);
    expect(container.textContent).not.toMatch(PAY);
  });
  it('writes never carry pay: offer draft sends components: []; screening sends no salary', async () => {
    const u = userEvent.setup();
    serve('scored');
    renderFile('/applications/a1?drawer=offer');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Start date/), '2026-11-01');
    await u.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers', expect.objectContaining({ applicationId: 'a1', components: [], proposedJoiningDate: '2026-11-01T00:00:00.000Z' })));
    const body = api.postApi.mock.calls.find(([p]) => p === '/offers')![1];
    expect(JSON.stringify(body)).not.toMatch(/salary|amount|currency|package|grade/i);
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/submit', {}));
  });
});

describe('E13 application file', () => {
  it('renders header, stepper, gate, timeline, notes, details', async () => {
    serve('interview');
    renderFile();
    expect(await screen.findByRole('heading', { name: /Ahmed Embaby/, level: 2 })).toBeInTheDocument();
    expect(screen.getByText('HRIS Developer · Offshore Cairo · Owner: Mariam Farag · Source: LinkedIn')).toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Stages' })).getAllByRole('listitem');
    expect(steps.map((s) => s.dataset.state)).toEqual(['done', 'done', 'current', 'todo', 'todo', 'todo']);
    expect(steps[2]).toHaveAttribute('aria-current', 'step');
    expect(within(screen.getByRole('list', { name: 'Gate to Offer' })).getByText('Scorecard submitted').closest('li')).toHaveAttribute('data-ok', 'false');
    expect(screen.getByText(/Technical interview: Ahmed Embaby — 6 Oct 2026, 10:00/)).toBeInTheDocument();
    expect(screen.getByText(/Fit note/)).toBeInTheDocument();
    expect(screen.getByText('ahmed.embaby@example.com')).toBeInTheDocument();
    expect(screen.getByText('Follow-up date').parentElement).toHaveTextContent('12 Oct 2026');
    const docs = screen.getByRole('region', { name: 'Documents' });
    expect(docs).toHaveTextContent('Ahmed_Embaby_CV.pdf');
    expect(docs).toHaveTextContent('CV · 1 Oct 2026 · by Mariam Farag');
    expect(document.querySelectorAll('.rf2-btn--primary')).toHaveLength(1);
  });

  it.each([
    ['applied', 'Log screen'], ['screened', 'Schedule interview'], ['interview', 'Open scorecard'], ['scored', 'Draft offer'],
    ['offer-pending', 'View approval'], ['offer-approved', 'Send offer'], ['offer-sent', 'Record answer'], ['offer-accepted', 'Move to Pre-hire'], ['prehire', 'Pre-hire checklist'],
  ] as const)('%s → one primary "%s"', async (sc, label) => {
    serve(sc);
    renderFile();
    const btn = await screen.findByRole('button', { name: label });
    expect(btn).toHaveClass('rf2-btn--primary');
  });

  it('rejected file: closed note, no actions', async () => {
    serve('rejected');
    renderFile();
    expect(await screen.findByText('Closed as Rejected — Not enough experience.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });

  it('403 FILE_NOT_OWNED → Forbidden; 404 → not found', async () => {
    serve('applied', { '/applications/a1/workspace': new ApiError(403, 'Access denied: this file belongs to another owner.', {}, { code: 'FORBIDDEN' }) });
    renderFile();
    expect(await screen.findByText('This file belongs to another owner')).toBeInTheDocument();
  });

  it('primary opens its drawer via ?drawer= and closing clears it', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile();
    await u.click(await screen.findByRole('button', { name: 'Log screen' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/applications/a1?drawer=screen');
    expect(screen.getByRole('dialog', { name: /Log screen — Ahmed Embaby/ })).toBeInTheDocument();
    await u.keyboard('{Escape}');
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/applications\/a1$/);
  });

  it.each([
    ['screen', /Log screen/], ['schedule', /Schedule interview/], ['scorecard', /Scorecard/], ['offer', /Draft offer/], ['waiting', /Waiting on approval/],
    ['send', /Send offer/], ['answer', /Record answer/], ['prehire', /Pre-hire checklist/], ['reject', /Reject/],
  ])('deep link ?drawer=%s opens the drawer, with no axe violations', async (key, title) => {
    serve('offer-sent');
    renderFile(`/applications/a1?drawer=${key}`);
    const d = await screen.findByRole('dialog', { name: title });
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it('page has no axe violations', async () => {
    serve('interview');
    const { container } = renderFile();
    await screen.findByRole('heading', { name: /Ahmed Embaby/ });
    expect(await axeViolations(container)).toEqual([]);
  });

  it('follow-up date: owner edits it (PATCH /applications/:id/follow-up), clears it, and sees FOLLOW_UP_NOT_OWNER by code', async () => {
    const u = userEvent.setup();
    serve('screened');
    api.patchApi.mockResolvedValueOnce({ id: 'a1', followUpDate: '2026-10-20' });
    renderFile();
    await u.click(await screen.findByRole('button', { name: 'Change' }));
    const input = screen.getByLabelText('Follow-up date');
    expect(input).toHaveValue('2026-10-12');
    await u.clear(input); await u.type(input, '2026-10-20');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/follow-up', { followUpDate: '2026-10-20' }));
    await u.click(await screen.findByRole('button', { name: 'Change' }));
    api.patchApi.mockRejectedValueOnce(new ApiError(403, 'Only the owner of this file can change its follow-up date.', { code: 'FOLLOW_UP_NOT_OWNER', message: 'Only the owner of this file can change its follow-up date.' }, { code: 'FOLLOW_UP_NOT_OWNER' }));
    await u.click(screen.getByRole('button', { name: 'Clear' }));
    expect(api.patchApi).toHaveBeenLastCalledWith('/applications/a1/follow-up', { followUpDate: null });
    expect(await screen.findByText('Only the owner of this file can change its follow-up date.')).toBeInTheDocument();
  });
  it('adds a note', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile();
    await u.type(await screen.findByLabelText('Add a note'), 'Called, interested.');
    await u.click(screen.getByRole('button', { name: 'Save note' }));
    expect(api.postApi).toHaveBeenCalledWith('/applications/a1/notes', { content: 'Called, interested.' });
  });
});

describe('E14 Screen', () => {
  it('requires the note, then logs screening and moves Applied → Screening → Interview', async () => {
    const u = userEvent.setup();
    serve('applied');
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Save and move to Interview' }));
    expect(within(d).getByText(/Write the screen note/)).toBeInTheDocument();
    expect(api.postApi).not.toHaveBeenCalled();
    await u.type(within(d).getByLabelText(/Screen note/), 'Pass. Laravel + HRIS.');
    await u.type(within(d).getByLabelText(/Notice period/), '30');
    await u.click(within(d).getByRole('button', { name: 'Save and move to Interview' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledTimes(2));
    expect(api.postApi).toHaveBeenCalledWith('/screening', { applicationId: 'a1', outcome: 'Passed', notes: 'Pass. Laravel + HRIS.', noticePeriodDays: 30 });
    expect(api.patchApi).toHaveBeenNthCalledWith(1, '/applications/a1/stage', { stage: 'Screening', expectedStage: 'Applied', expectedVersion: 7 });
    expect(api.patchApi).toHaveBeenNthCalledWith(2, '/applications/a1/stage', { stage: 'Interview', expectedStage: 'Screening', expectedVersion: 8 });
  });
  it('shows the gate message inline on a 409', async () => {
    const u = userEvent.setup();
    serve('screened');
    api.patchApi.mockRejectedValue(new ApiError(409, 'Server text', { statusCode: 409, code: 'GATE_SCREEN_NOTE_MISSING', gate: 'screen-note', missing: ['screen note'], message: 'Server text' }, { code: 'GATE_SCREEN_NOTE_MISSING' }));
    renderFile('/applications/a1?drawer=screen');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Screen note/), 'x');
    await u.click(within(d).getByRole('button', { name: 'Save and move to Interview' }));
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('Interview needs a saved screen note. Missing: screen note. Log the screen with a note first.');
  });
});

describe('E15 Schedule', () => {
  it('cairoIso converts Cairo wall time to UTC', () => {
    expect(cairoIso('2026-10-13', '10:00')).toBe('2026-10-13T07:00:00.000Z');
  });
  it('validates and posts CreateInterviewDto with room URL and interviewer user ids (no Meet, no self-schedule)', async () => {
    const u = userEvent.setup();
    serve('interview');
    renderFile('/applications/a1?drawer=schedule');
    const d = await screen.findByRole('dialog');
    expect(d.textContent).not.toMatch(/Google Meet|self-schedule/i);
    await u.click(within(d).getByRole('button', { name: 'Schedule interview' }));
    expect(within(d).getByText('Pick a date.')).toBeInTheDocument();
    expect(within(d).getByText('Paste the meeting room URL (https://…).')).toBeInTheDocument();
    expect(within(d).getByText('Add at least one interviewer.')).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/^Date/), '2026-10-13');
    await u.type(within(d).getByLabelText(/Room URL/), 'https://teams.microsoft.com/l/x');
    await u.click(within(d).getByRole('combobox', { name: /Interviewers/ }));
    await u.click(await within(d).findByRole('option', { name: /Karim Hassan/ }));
    await u.click(within(d).getByRole('button', { name: 'Schedule interview' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/interviews', {
      applicationId: 'a1', title: 'Technical interview: Ahmed Embaby', interviewType: 'Technical', scheduledStart: '2026-10-13T07:00:00.000Z', scheduledEnd: '2026-10-13T08:00:00.000Z',
      timezone: 'Africa/Cairo', locationUrl: 'https://teams.microsoft.com/l/x', attendeeUserIds: ['u-karim'],
    }));
    expect(api.getApi).toHaveBeenCalledWith('/users/interviewers');
  });
  it('maps ROOM_URL_HOST_NOT_ALLOWED from the server', async () => {
    const u = userEvent.setup();
    serve('interview');
    const msg = 'The meeting link must be on an approved meeting host (teams.microsoft.com, zoom.us).';
    api.postApi.mockRejectedValue(new ApiError(400, msg, { code: 'ROOM_URL_HOST_NOT_ALLOWED', message: msg }, { code: 'ROOM_URL_HOST_NOT_ALLOWED' }));
    renderFile('/applications/a1?drawer=schedule');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/^Date/), '2026-10-13');
    await u.type(within(d).getByLabelText(/Room URL/), 'https://example.com/r');
    await u.click(within(d).getByRole('combobox', { name: /Interviewers/ }));
    await u.click(await within(d).findByRole('option', { name: /Karim Hassan/ }));
    await u.click(within(d).getByRole('button', { name: 'Schedule interview' }));
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent(msg);
  });
  it('from Screening without a screen note the primary is disabled by the gate', async () => {
    serve('applied');
    renderFile('/applications/a1?drawer=schedule');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('button', { name: 'Schedule interview' })).toBeDisabled();
    expect(within(d).getByRole('list', { name: 'Gate to Interview' })).toHaveTextContent('Screen note saved');
  });
});

describe('E16 Scorecard', () => {
  it('submits my scorecard (POST /interviews/:id/scorecard, status Submitted)', async () => {
    const u = userEvent.setup();
    serve('interview');
    renderFile('/applications/a1?drawer=scorecard&interview=iv1');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Submit scorecard' }));
    expect(within(d).getByText('Choose a rating from 1 to 5.')).toBeInTheDocument();
    await u.click(within(d).getByRole('radio', { name: '4' }));
    await u.type(within(d).getByLabelText(/Evidence/), 'Clear payroll export design.');
    await u.click(within(d).getByRole('button', { name: 'Submit scorecard' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/scorecard', { overallRating: 4, recommendation: 'Hire', notes: 'Clear payroll export design.', status: 'Submitted' }));
  });
  it('saves a draft', async () => {
    const u = userEvent.setup();
    serve('interview');
    renderFile('/applications/a1?drawer=scorecard');
    const d = await screen.findByRole('dialog');
    await u.type(within(d).getByLabelText(/Evidence/), 'WIP');
    await u.click(within(d).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/scorecard', expect.objectContaining({ status: 'Draft', notes: 'WIP' })));
  });
  it('revises my submitted scorecard with a reason (POST …/scorecard/revisions)', async () => {
    const u = userEvent.setup();
    const r = fileResponses('scored');
    serve('scored', { '/interviews/iv1/scorecard': [{ ...(r['/interviews/iv1/scorecard'] as object[])[0], interviewerId: 'u-mariam', interviewerName: 'Mariam Farag' }] });
    renderFile('/applications/a1?drawer=scorecard');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('region', { name: 'Scorecard by you' })).toHaveTextContent('Submitted');
    await u.click(within(d).getByRole('button', { name: 'Revise with a reason' }));
    await u.click(within(d).getByRole('button', { name: 'Submit revision' }));
    expect(within(d).getByText(/Say why you are revising/)).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/Reason for revising/), 'Typo in rating');
    await u.click(within(d).getByRole('button', { name: 'Submit revision' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/interviews/iv1/scorecard/revisions', expect.objectContaining({ reason: 'Typo in rating', overallRating: 4 })));
  });
});

describe('E17–E20 offer', () => {
  it('E17 is gated on a submitted scorecard and moves Interview → Offer before creating the offer', async () => {
    serve('interview');
    renderFile('/applications/a1?drawer=offer');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
    expect(within(d).getByTestId('pay-note')).toHaveTextContent('Pay is not shown to you');
  });
  it('E18 shows the approver and nothing to do', async () => {
    serve('offer-pending');
    renderFile('/applications/a1?drawer=waiting');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('list', { name: 'Approvals' })).toHaveTextContent('Karim Hassan · Pending');
  });
  it('E18 sent back by the manager: offer Draft, file stays in Offer, comment shown, primary "Revise and resubmit"', async () => {
    const u = userEvent.setup();
    serve('offer-sentback');
    renderFile();
    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent('Offer');
    await u.click(screen.getByRole('button', { name: 'Revise and resubmit' }));
    const d = await screen.findByRole('dialog', { name: /Revise and resubmit/ });
    expect(d).toHaveTextContent('The manager sent v1 back: “Start date clashes with Ramadan rota; move to 15 Nov.”');
    expect(within(d).getByLabelText(/Start date/)).toHaveValue('2026-11-01');
    await u.clear(within(d).getByLabelText(/Start date/));
    await u.type(within(d).getByLabelText(/Start date/), '2026-11-15');
    await u.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/submit', {}));
    expect(api.postApi).toHaveBeenCalledWith('/offers/o1/revisions', expect.objectContaining({ components: [], proposedJoiningDate: '2026-11-15T00:00:00.000Z' }));
    expect(api.patchApi).not.toHaveBeenCalled();
  });
  it('E18 sent-back view explains Draft + Offer and links to revise', async () => {
    serve('offer-sentback');
    renderFile('/applications/a1?drawer=waiting');
    const d = await screen.findByRole('dialog', { name: /Sent back/ });
    expect(d).toHaveTextContent('Sent back by the manager');
    expect(d).toHaveTextContent('The offer is back in Draft and the file stays in Offer.');
    expect(within(d).getByRole('list', { name: 'Approvals' })).toHaveTextContent('Karim Hassan · Rejected · “Start date clashes');
    expect(within(d).getByRole('link', { name: 'Revise and resubmit' })).toHaveAttribute('href', expect.stringContaining('drawer=offer'));
  });
  it('E18 unsubmitted Draft → "Submit for approval" posts /submit; OFFER_NOT_DRAFT is shown by code', async () => {
    const u = userEvent.setup();
    serve('offer-draft');
    api.postApi.mockRejectedValueOnce(new ApiError(409, 'Only a Draft (or Changes Requested) version can be submitted; this one is Pending Approval.', { code: 'OFFER_NOT_DRAFT', message: 'Only a Draft (or Changes Requested) version can be submitted; this one is Pending Approval.' }, { code: 'OFFER_NOT_DRAFT' }));
    renderFile();
    await u.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    expect(api.postApi).toHaveBeenCalledWith('/offers/o1/submit', {});
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('this one is Pending Approval');
  });
  it('E19 email: picks an active template (offer first), POST /send {channel, templateId}, shows Queued; no PATCH Sent', async () => {
    const u = userEvent.setup();
    serve('offer-approved');
    api.postApi.mockResolvedValueOnce({ id: 'o1', status: 'Sent', channel: 'email', templateId: 't-mail-offer', queued: true });
    renderFile('/applications/a1?drawer=send');
    const d = await screen.findByRole('dialog');
    const sel = within(d).getByLabelText(/Template/);
    await waitFor(() => expect(sel).toHaveValue('t-mail-offer'));
    expect(within(sel).queryByRole('option', { name: 'Old offer' })).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'Send offer' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/send', { channel: 'email', templateId: 't-mail-offer' }));
    expect(await screen.findByRole('dialog', { name: /Offer sent/ })).toHaveTextContent('Queued');
    expect(api.patchApi).not.toHaveBeenCalled();
  });
  it('E19 WhatsApp: shows the filled text, copy + open-link, and says it was recorded (no mark-as-sent call)', async () => {
    const u = userEvent.setup();
    serve('offer-approved');
    const waLink = 'https://wa.me/201112048890?text=Hi%20Ahmed';
    api.postApi.mockResolvedValueOnce({ id: 'o1', status: 'Sent', channel: 'whatsapp', templateId: 't-wa-offer', message: 'Hi Ahmed, your offer OFF-2026-0012 is ready.', waLink });
    renderFile('/applications/a1?drawer=send');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: /WhatsApp/ }));
    await waitFor(() => expect(within(d).getByLabelText(/Template/)).toHaveValue('t-wa-offer'));
    await u.click(within(d).getByRole('button', { name: 'Send offer' }));
    expect(api.postApi).toHaveBeenCalledWith('/offers/o1/send', { channel: 'whatsapp', templateId: 't-wa-offer' });
    const r = await screen.findByRole('dialog', { name: /Offer sent/ });
    expect(within(r).getByLabelText('Message to send')).toHaveValue('Hi Ahmed, your offer OFF-2026-0012 is ready.');
    expect(within(r).getByRole('link', { name: /Open WhatsApp/ })).toHaveAttribute('href', waLink);
    expect(within(r).getByRole('button', { name: 'Copy text' })).toBeInTheDocument();
    expect(r).toHaveTextContent('recorded the offer as Sent by WhatsApp');
    expect(within(r).queryByRole('button', { name: /Mark as sent/ })).toBeNull();
  });
  it('E19 template errors come through by code', async () => {
    const u = userEvent.setup();
    serve('offer-approved');
    api.postApi.mockRejectedValueOnce(new ApiError(400, 'The template does not exist or is not active.', { code: 'OFFER_TEMPLATE_INVALID', message: 'The template does not exist or is not active.' }, { code: 'OFFER_TEMPLATE_INVALID' }));
    renderFile('/applications/a1?drawer=send');
    const d = await screen.findByRole('dialog');
    await waitFor(() => expect(within(d).getByLabelText(/Template/)).toHaveValue('t-mail-offer'));
    await u.click(within(d).getByRole('button', { name: 'Send offer' }));
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('The template does not exist or is not active.');
  });
  it('E19 is disabled before approval', async () => {
    serve('offer-pending');
    renderFile('/applications/a1?drawer=send');
    expect(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send offer' })).toBeDisabled();
  });
  it('E20 Accepted → PATCH status Accepted', async () => {
    const u = userEvent.setup();
    serve('offer-sent');
    renderFile('/applications/a1?drawer=answer');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: /^Accepted/ }));
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/offers/o1/status', { status: 'Accepted' }));
  });
  it('E20 Declined → PATCH status Declined (#11 closes the file as Rejected "Declined offer"); no revision', async () => {
    const u = userEvent.setup();
    serve('offer-sent');
    renderFile('/applications/a1?drawer=answer');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: /^Declined/ }));
    expect(within(d).getByText(/closes as Rejected — "Declined offer"/)).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    expect(within(d).getByText('Say what the candidate told you.')).toBeInTheDocument();
    await u.type(within(d).getByLabelText(/Why they declined/), 'Took another offer');
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/offers/o1/status', { status: 'Declined' }));
    expect(api.postApi).toHaveBeenCalledWith('/applications/a1/notes', { content: 'Candidate declined offer v1: Took another offer' });
    expect(api.postApi).not.toHaveBeenCalledWith('/offers/o1/revisions', expect.anything());
    expect(api.patchApi).not.toHaveBeenCalledWith('/applications/a1/stage', expect.anything());
  });
  it('E20 Expired → PATCH status Expired; the file stays in Offer', async () => {
    const u = userEvent.setup();
    serve('offer-sent');
    renderFile('/applications/a1?drawer=answer');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: /expired/ }));
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/offers/o1/status', { status: 'Expired' }));
    expect(api.patchApi).not.toHaveBeenCalledWith('/applications/a1/stage', expect.anything());
  });
  it('Expired offer: primary "New offer version" → POST revisions (components [], no pay)', async () => {
    const u = userEvent.setup();
    const r = fileResponses('offer-sent');
    const offer = { ...(r['/offers/o1'] as Record<string, unknown>), status: 'Expired' };
    serve('offer-sent', { '/offers': [offer], '/offers/o1': offer });
    renderFile();
    await u.click(await screen.findByRole('button', { name: 'New offer version' }));
    const d = await screen.findByRole('dialog', { name: /New offer version/ });
    await u.clear(within(d).getByLabelText(/Start date/));
    await u.type(within(d).getByLabelText(/Start date/), '2026-11-15');
    await u.click(within(d).getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/revisions', expect.objectContaining({ components: [], proposedJoiningDate: '2026-11-15T00:00:00.000Z' })));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/offers/o1/submit', {}));
    expect(api.postApi).not.toHaveBeenCalledWith('/offers', expect.anything());
  });
  it('E20 Withdrawn → offer Withdrawn + file Rejected with "Withdrawn by candidate"', async () => {
    const u = userEvent.setup();
    serve('offer-sent');
    renderFile('/applications/a1?drawer=answer');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('radio', { name: /Withdrawn/ }));
    await u.type(within(d).getByLabelText(/Why they withdrew/), 'Took another job');
    await u.click(within(d).getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', { stage: 'Rejected', expectedStage: 'Offer', expectedVersion: 7, reason: 'Withdrawn by candidate' }));
    expect(api.patchApi).toHaveBeenCalledWith('/offers/o1/status', { status: 'Withdrawn' });
  });
});

describe('E21 Pre-hire / E22 Reject', () => {
  it('E21: required checks only — PUT joining-checks; submit stays disabled until every required check is verified', async () => {
    const u = userEvent.setup();
    serve('prehire');
    const after = (fileResponses('prehire')['/applications/a1/joining-checks'] as Array<Record<string, unknown>>).map((c) => (c.type === 'CONTRACT' ? { ...c, verified: true, verifiedBy: { id: 'u-mariam', name: 'Mariam Farag' }, verifiedAt: '2026-10-10T08:00:00.000Z' } : c));
    api.putApi.mockResolvedValue(after);
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('list', { name: 'Joining checks' })).toHaveTextContent('ID · verified by Mariam Farag, 9 Oct');
    expect(within(d).getByRole('button', { name: 'Submit for final approval' })).toBeDisabled();
    expect(within(d).queryByRole('button', { name: 'Move to Joined' })).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'Mark Contract verified' }));
    await waitFor(() => expect(api.putApi).toHaveBeenCalledWith('/applications/a1/joining-checks/CONTRACT', { verified: true }));
    expect(await within(d).findByRole('button', { name: 'Undo Contract verified' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Submit for final approval' })).toBeDisabled();
    expect(api.patchApi).not.toHaveBeenCalledWith(expect.stringMatching(/compliance/), expect.anything());
  });
  it('E21: a technical file lists only the checks it was given', async () => {
    const checks = (fileResponses('prehire-done')['/applications/a1/joining-checks'] as Array<Record<string, unknown>>).filter((c) => c.type !== 'SCFHS_LICENCE');
    serve('prehire-done', { '/applications/a1/joining-checks': checks });
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    const list = within(d).getByRole('list', { name: 'Joining checks' });
    expect(list).toHaveTextContent('ID');
    expect(list).toHaveTextContent('Contract');
    expect(list).not.toHaveTextContent('SCFHS');
    expect(within(d).getByRole('button', { name: 'Submit for final approval' })).toBeEnabled();
  });
  it('E21: all required checks verified submits for final approval and does not mark Joined', async () => {
    const u = userEvent.setup();
    serve('prehire-done');
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Submit for final approval' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/hiring/h1/submit', {}));
    expect(api.patchApi).not.toHaveBeenCalledWith('/applications/a1/stage', expect.anything());
    expect(api.postApi).not.toHaveBeenCalledWith('/hiring/h1/joining', expect.anything());
  });
  it('E21: the responsible recruiter records joining once; a 409 still names the missing check', async () => {
    const u = userEvent.setup();
    authState.user.permissions = ['RECORD_ACTUAL_JOINING'];
    const hiring = (fileResponses('prehire-done')['/hiring'] as Array<Record<string, unknown>>).map((h) => ({ ...h, status: 'Awaiting Joining' }));
    serve('prehire-done', { '/hiring': hiring });
    api.postApi.mockRejectedValueOnce(new ApiError(409, 'x', { statusCode: 409, code: 'GATE_JOINING_CHECKS_INCOMPLETE', gate: 'joining-checks', missing: ['SCFHS_LICENCE'], message: 'x' }, { code: 'GATE_JOINING_CHECKS_INCOMPLETE' }));
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Record actual joining' }));
    expect(api.postApi).toHaveBeenCalledWith('/hiring/h1/joining', expect.objectContaining({ status: 'Joined' }));
    expect(api.patchApi).not.toHaveBeenCalledWith('/applications/a1/stage', expect.anything());
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('Missing: SCFHS licence.');
  });
  it('E21: a second record does not claim another hire', async () => {
    const u = userEvent.setup();
    authState.user.permissions = ['RECORD_ACTUAL_JOINING'];
    const hiring = (fileResponses('prehire-done')['/hiring'] as Array<Record<string, unknown>>).map((h) => ({ ...h, status: 'Awaiting Joining' }));
    serve('prehire-done', { '/hiring': hiring });
    api.postApi.mockResolvedValueOnce({ success: true, alreadyJoined: true });
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Record actual joining' }));
    expect(await within(d).findByRole('status')).toHaveTextContent('The completed-hire count did not change.');
  });
  it('E21: a licence check sends its expiry date', async () => {
    const u = userEvent.setup();
    serve('prehire');
    api.putApi.mockResolvedValue(fileResponses('prehire')['/applications/a1/joining-checks']);
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    expect(within(d).getByRole('button', { name: 'Mark SCFHS licence verified' })).toBeDisabled();
    await u.type(within(d).getByLabelText(/SCFHS licence expiry/), '2027-06-01');
    await u.click(within(d).getByRole('button', { name: 'Mark SCFHS licence verified' }));
    await waitFor(() => expect(api.putApi).toHaveBeenCalledWith('/applications/a1/joining-checks/SCFHS_LICENCE', { verified: true, expiryDate: '2027-06-01T00:00:00.000Z' }));
  });
  it('E21 from Offer: gated on acceptance, then moves to Pre-hire and opens the hiring case', async () => {
    const u = userEvent.setup();
    serve('offer-accepted');
    renderFile('/applications/a1?drawer=prehire');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Move to Pre-hire' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/hiring', { offerId: 'o1' }));
    expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', { stage: 'Pre-Hire', expectedStage: 'Offer', expectedVersion: 7 });
  });
  it('E22: reason required, list from master data + system reasons, PATCH stage Rejected with reason', async () => {
    const u = userEvent.setup();
    serve('screened');
    renderFile('/applications/a1?drawer=reject');
    const d = await screen.findByRole('dialog');
    await u.click(within(d).getByRole('button', { name: 'Reject' }));
    expect(within(d).getByText(/Pick a reason/)).toBeInTheDocument();
    await within(d).findByRole('option', { name: 'Not enough experience' });
    expect(within(d).getByRole('option', { name: 'Withdrawn by candidate' })).toBeInTheDocument();
    await u.selectOptions(within(d).getByLabelText(/Reason/), 'Not enough experience');
    await u.click(within(d).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(api.patchApi).toHaveBeenCalledWith('/applications/a1/stage', { stage: 'Rejected', expectedStage: 'Screening', expectedVersion: 7, reason: 'Not enough experience' }));
  });
  it('E22: GATE_REJECT_REASON_REQUIRED from the server is shown inline', async () => {
    const u = userEvent.setup();
    serve('screened');
    const msg = '"Too far" is not in the rejection reasons list.';
    api.patchApi.mockRejectedValue(new ApiError(409, msg, { statusCode: 409, code: 'GATE_REJECT_REASON_REQUIRED', gate: 'reject-reason', missing: ['reason'], message: msg }, { code: 'GATE_REJECT_REASON_REQUIRED' }));
    renderFile('/applications/a1?drawer=reject');
    const d = await screen.findByRole('dialog');
    await within(d).findByRole('option', { name: 'Not enough experience' });
    await u.selectOptions(within(d).getByLabelText(/Reason/), 'Not enough experience');
    await u.click(within(d).getByRole('button', { name: 'Reject' }));
    expect(await within(d).findByTestId('drawer-error')).toHaveTextContent('Rejected needs a reason from the rejection reasons list.');
  });
});
