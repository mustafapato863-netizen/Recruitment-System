import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { axeViolations } from '../../../components/v2/__tests__/axe';
import * as jfx from '../../api/__fixtures__/jobs';
import * as mfx from '../../api/__fixtures__/matching';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), postFormDataApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: jfx.ME, displayName: 'Mariam Farag' } }) }));
const shell = vi.hoisted(() => ({ value: null as null | { seat: string } }));
vi.mock('../../../components/v2/shell/AppShellV2', () => ({ useV2Shell: () => shell.value }));
vi.mock('../../../pages/CandidatesPage', () => ({ CandidatesPage: () => <p>v1 candidates</p> }));
vi.mock('../../../pages/CandidateComparisonPage', () => ({ CandidateComparisonPage: () => <p>v1 compare</p> }));
import { JobPipelineV2 } from '../JobPipelineV2';
import { CandidatesV2 } from '../CandidatesV2';
import { CompareV2 } from '../CompareV2';
import { CandidatesCompareRoute, CandidatesListRoute } from '../CandidatesRoute';
import { fetchCompare, fetchSuggestions, matchErrorFromError, stripScores } from '../../api/matching';

let responses: Record<string, unknown> = {};
function serve(extra: Record<string, unknown> = {}) {
  responses = { '/vacancies/v1': jfx.jobDetail(), '/applications': mfx.myApplications, '/vacancies/v1/suggestions': mfx.suggestions, '/vacancies/v1/compare': mfx.compare, '/candidates': mfx.bank, ...extra };
  api.getApi.mockImplementation(async (path: string) => {
    const [p, qs] = path.split('?');
    if (p === '/applications' && qs?.includes('vacancyId=v1') && responses['/applications@v1']) return structuredClone(responses['/applications@v1']);
    if (p in responses) { const v = responses[p]; if (v instanceof Error) throw v; return structuredClone(v); }
    throw new ApiError(404, 'not found');
  });
}
function Loc() { const l = useLocation(); return <output data-testid="loc" hidden>{l.pathname + l.search}</output>; }
const renderAt = (path: string) => {
  document.documentElement.setAttribute('data-ui', 'v2');
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/vacancies/:id" element={<><JobPipelineV2 /><Loc /></>} />
    <Route path="/candidates" element={<><CandidatesV2 /><Loc /></>} />
    <Route path="/candidates/compare" element={<><CompareV2 /><Loc /></>} />
    <Route path="/applications/:id" element={<><p>E13</p><Loc /></>} />
  </Routes></MemoryRouter>);
};
const NO_SCORE = /\d\s?%|\b0\.93\b|\b93\b|\b77\b/i;
const NO_PAY = /42000|42,000|50000|salary|EGP|AED|compensation/i;
const NO_PII = /@x\.test|\+20 1|29001010101010/;

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); serve(); });
afterEach(() => document.documentElement.removeAttribute('data-ui'));

describe('E4 adapters (B6 #13)', () => {
  it('suggestions / compare paths; scores and pay stripped from the payload', async () => {
    const s = await fetchSuggestions('v1');
    expect(api.getApi).toHaveBeenCalledWith('/vacancies/v1/suggestions');
    expect(JSON.stringify(s)).not.toMatch(/score|percent|salary|42000/i);
    const c = await fetchCompare('v1', ['c-a7', 'c-a4']);
    expect(api.getApi).toHaveBeenCalledWith('/vacancies/v1/compare?candidateIds=c-a7,c-a4');
    expect(JSON.stringify(c)).not.toMatch(/overallScore|77/);
    expect(stripScores({ a: 1, rank: 2, nested: [{ confidence: 0.4, b: 'x' }] })).toEqual({ a: 1, nested: [{ b: 'x' }] });
  });
  it.each([
    [400, 'Compare 2 to 4 candidates.', 'COMPARE_COUNT'],
    [404, 'One or more candidates were not found or are not active.', 'COMPARE_CANDIDATE_NOT_FOUND'],
    [403, 'Only the job owner, their manager or a full-access user can suggest or compare for this job.', 'NOT_JOB_OWNER'],
    [409, 'Candidate Heba Mansour has already applied to vacancy VAC-1.', 'APPLICATION_EXISTS'],
  ])('error codes: %s "%s" → %s (read from the code, not the message)', (status, msg, code) => {
    expect(matchErrorFromError(new ApiError(status, msg, { code, message: msg }, { code }))).toEqual({ code, message: msg });
    expect(matchErrorFromError(new ApiError(status, msg, undefined, { code: 'VALIDATION_ERROR' }))).toBeNull();
  });
});

describe('E23 bank adapter', () => {
  it('pages through everyone Active (100 a page) and keeps no contact fields', async () => {
    const row = (i: number) => ({ id: `c${i}`, candidateCode: `C${i}`, firstName: 'P', lastName: String(i), status: 'Active', email: 'x@y.z', phone: '1' });
    api.getApi.mockImplementation(async (p: string) => (p.includes('page=1&') ? { data: Array.from({ length: 100 }, (_, i) => row(i)), total: 130 } : { data: Array.from({ length: 30 }, (_, i) => row(100 + i)), total: 130 }));
    const { fetchBank } = await import('../../api/matching');
    const rows = await fetchBank('');
    expect(rows).toHaveLength(130);
    expect(api.getApi).toHaveBeenCalledWith('/candidates?pageSize=100&page=2&status=Active');
    expect(JSON.stringify(rows)).not.toMatch(/email|phone|x@y/);
  });
});

describe('E10 Suggest from bank', () => {
  it('drawer from the board: required skills, ordering note, evidence lines, no %/score/pay/contact; axe', async () => {
    const u = userEvent.setup();
    const { baseElement } = renderAt('/vacancies/v1');
    await u.click(await screen.findByRole('button', { name: 'Suggest from bank' }));
    const d = await screen.findByRole('dialog', { name: 'People in the bank who match this job' });
    expect(screen.getByTestId('loc')).toHaveTextContent('drawer=suggest');
    const cards = await within(d).findAllByRole('listitem', {}, { timeout: 2000 }).then(() => within(d).getByRole('list', { name: 'Suggestions' }).children);
    expect(cards).toHaveLength(4);
    expect(cards[3]).toHaveTextContent(/Nourhan Sami.*On this job · Screening/);
    expect(within(cards[3] as HTMLElement).queryByRole('button', { name: /Add Nourhan Sami/ })).toBeNull();
    expect(cards[3]).toHaveTextContent('Already on this job in Screening; cannot be added again.');
    expect(cards[0]).toHaveTextContent(/Heba Mansour.*CAN-2026-0031 · Payroll Specialist · Cairo/);
    expect(cards[0]).toHaveTextContent('“Owned HRIS master data for 2,000 staff.” — screening note');
    expect(cards[1]).toHaveTextContent('Payroll — no evidence');
    expect(cards[2]).toHaveTextContent('Oracle — missing');
    expect(d).toHaveTextContent('Not in the skill library, so not matched: Arabic payroll law.');
    expect(d).toHaveTextContent(/Ordered by: required skills with at least one piece of evidence/);
    expect(d.textContent).not.toMatch(NO_SCORE);
    expect(d.textContent).not.toMatch(NO_PAY);
    expect(d.textContent).not.toMatch(NO_PII);
    expect(await axeViolations(baseElement)).toEqual([]);
  });
  it('Add to this job → POST /applications; already applied shows the server message', async () => {
    const u = userEvent.setup();
    api.postApi.mockResolvedValueOnce({ id: 'new' }).mockRejectedValueOnce(new ApiError(409, 'Candidate Youssef Nabil has already applied to vacancy VAC-2026-0041.', undefined, { code: 'CONFLICT' }));
    renderAt('/vacancies/v1?drawer=suggest');
    const d = await screen.findByRole('dialog');
    await u.click(await within(d).findByRole('button', { name: 'Add Heba Mansour to this job' }));
    await waitFor(() => expect(api.postApi).toHaveBeenCalledWith('/applications', { vacancyId: 'v1', candidateId: 'c-heba', source: 'Suggested from bank' }));
    expect(await within(d).findByText('Added to Applied')).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Add Youssef Nabil to this job' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('has already applied');
  });
  it('select 2–4 → Compare link to E24; held job disables Add', async () => {
    const u = userEvent.setup();
    serve({ '/vacancies/v1': jfx.jobDetail('On Hold') });
    renderAt('/vacancies/v1?drawer=suggest');
    const d = await screen.findByRole('dialog');
    expect(await within(d).findByRole('button', { name: 'Add Heba Mansour to this job' })).toBeDisabled();
    expect(within(d).getByRole('button', { name: 'Compare on skills' })).toBeDisabled();
    await u.click(within(d).getByRole('checkbox', { name: 'Select Heba Mansour to compare' }));
    await u.click(within(d).getByRole('checkbox', { name: 'Select Youssef Nabil to compare' }));
    expect(within(d).getByRole('link', { name: 'Compare 2 on skills' })).toHaveAttribute('href', '/candidates/compare?job=v1&ids=c-heba,c-youssef');
  });
  it('403 NOT_JOB_OWNER → clear message', async () => {
    serve({ '/vacancies/v1/suggestions': new ApiError(403, 'Only the job owner, their manager or a full-access user can suggest or compare for this job.', undefined, { code: 'FORBIDDEN' }) });
    renderAt('/vacancies/v1?drawer=suggest');
    expect(await screen.findByText('Only the job owner can see suggestions')).toBeInTheDocument();
  });
});

describe('E23 Candidates', () => {
  it('active applications only (no Joined), allowlisted columns, no contact/pay; axe', async () => {
    const { container } = renderAt('/candidates');
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent(/Ahmed Embaby.*6 yrs · Laravel, HRIS.*HRIS Developer.*Interview.*LinkedIn.*Mariam Farag.*Scorecard missing/);
    expect(rows[3]).toHaveTextContent('Follow-up due 7 Oct 2026');
    expect(within(rows[0]).getByRole('link', { name: 'Ahmed Embaby' })).toHaveAttribute('href', '/applications/a7');
    expect(container.textContent).not.toMatch(NO_PAY);
    expect(container.textContent).not.toMatch(NO_PII);
    expect(await axeViolations(container)).toEqual([]);
  });
  it('compare needs 2–4 on the same job', async () => {
    const u = userEvent.setup();
    renderAt('/candidates');
    await screen.findByRole('table');
    const btn = () => screen.queryByRole('link', { name: /^Compare \d on skills/ });
    await u.click(screen.getByRole('checkbox', { name: 'Select Ahmed Embaby (HRIS Developer)' }));
    expect(btn()).toBeNull();
    await u.click(screen.getByRole('checkbox', { name: 'Select Ahmed Saleh (Laravel Backend Engineer)' }));
    expect(btn()).toBeNull();
    expect(screen.getByRole('button', { name: 'Compare on skills' })).toHaveAccessibleDescription('Compare works within one job; select people on the same job.');
    await u.click(screen.getByRole('checkbox', { name: 'Select Ahmed Saleh (Laravel Backend Engineer)' }));
    await u.click(screen.getByRole('checkbox', { name: 'Select Nourhan Sami (HRIS Developer)' }));
    expect(btn()).toHaveAttribute('href', '/candidates/compare?job=v1&ids=c-a7,c-a4');
    expect(screen.getByText('5 people · 2 selected')).toBeInTheDocument();
  });
  it('filters + Bank tab (search to /candidates, no contact/pay)', async () => {
    const u = userEvent.setup();
    const { container } = renderAt('/candidates');
    await screen.findByRole('table');
    await u.selectOptions(screen.getByLabelText('Job'), 'v2');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await u.click(screen.getByRole('tab', { name: 'Bank' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/candidates?tab=bank');
    expect(await screen.findByText('Heba Mansour')).toBeInTheDocument();
    expect(api.getApi).toHaveBeenCalledWith('/candidates?pageSize=100&page=1&status=Active');
    await u.type(screen.getByLabelText('Search people'), 'heba');
    await waitFor(() => expect(api.getApi).toHaveBeenCalledWith('/candidates?pageSize=100&page=1&status=Active&search=heba'));
    expect(container.textContent).not.toMatch(NO_PAY);
    expect(container.textContent).not.toMatch(NO_PII);
  });
});

describe('E24 Compare on skills', () => {
  it('evidence or written gap per cell; Open file + Reject (danger-outline) links; no %/score; axe', async () => {
    serve({ '/applications@v1': mfx.myApplications });
    const { container } = renderAt('/candidates/compare?job=v1&ids=c-a7,c-a4');
    expect(await screen.findByRole('heading', { name: 'Compare on skills — HRIS Developer' })).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent(/HRIS.*Maintained in-house HRIS modules.*CV · 30 Sept 2026|HRIS.*Maintained in-house HRIS modules.*CV · 30 Sep 2026/);
    expect(rows[2]).toHaveTextContent('Has Payroll on the profile — no evidence yet.');
    expect(rows[3]).toHaveTextContent('No Oracle on the profile.');
    expect(rows[4]).toHaveTextContent(/Notice period.*30 days.*screening.*Immediately.*profile/);
    expect(rows[5]).toHaveTextContent(/Fit note.*“Strong Laravel; HRIS from leave\/attendance only\.”.*Mariam Farag.*Not recorded\./);
    expect(screen.getAllByRole('link', { name: 'Open file' })[0]).toHaveAttribute('href', '/applications/a7');
    const rej = screen.getAllByRole('link', { name: 'Reject for HRIS Developer' })[0];
    expect(rej).toHaveAttribute('href', '/applications/a7?drawer=reject');
    expect(rej.className).toMatch(/danger-outline/);
    expect(container.textContent).not.toMatch(NO_SCORE);
    expect(await axeViolations(container)).toEqual([]);
  });
  it('bad count → COMPARE_COUNT message without calling the API; 403 → forbidden', async () => {
    const { unmount } = renderAt('/candidates/compare?job=v1&ids=c-a7');
    expect(await screen.findByText('Compare 2 to 4 candidates on one job.')).toBeInTheDocument();
    expect(api.getApi).not.toHaveBeenCalled();
    unmount();
    serve({ '/vacancies/v1/compare': new ApiError(403, 'Only the job owner, their manager or a full-access user can suggest or compare for this job.', undefined, { code: 'FORBIDDEN' }) });
    renderAt('/candidates/compare?job=v1&ids=c-a7,c-a4');
    expect(await screen.findByText(/Only the job owner, their manager/)).toBeInTheDocument();
  });
});

describe('/candidates routes', () => {
  const r = (el: React.ReactElement) => render(<MemoryRouter><Suspense fallback="…">{el}</Suspense></MemoryRouter>);
  it('v1 outside the Employee v2 seat', async () => {
    shell.value = null; r(<><CandidatesListRoute /><CandidatesCompareRoute /></>);
    expect(await screen.findByText('v1 candidates')).toBeInTheDocument();
    expect(await screen.findByText('v1 compare')).toBeInTheDocument();
  });
  it('E23/E24 for the Employee seat', async () => {
    shell.value = { seat: 'employee' }; r(<CandidatesListRoute />);
    expect(await screen.findByRole('heading', { name: 'Candidates' })).toBeInTheDocument();
    shell.value = null;
  });
});
