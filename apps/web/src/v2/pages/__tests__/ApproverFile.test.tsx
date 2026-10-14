import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getApi: vi.fn(), postApi: vi.fn(), patchApi: vi.fn(), putApi: vi.fn(), downloadFileApi: vi.fn() }));
vi.mock('../../../api/client', async () => ({ ...(await vi.importActual<object>('../../../api/client')), ...api }));
// Aya (seed): FINAL_HIRING_APPROVER.
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-aya', displayName: 'Aya', roles: [{ code: 'FINAL_HIRING_APPROVER' }], permissions: ['VACANCY_VIEW', 'FINAL_HIRING_APPROVAL', 'VIEW_CANDIDATE_PII', 'DOWNLOAD_DOCUMENTS', 'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS'] } }) }));
import { loadApproverFile } from '../../api/applicationFile';
import { ApplicationFileV2 } from '../ApplicationFileV2';

const app = { id: 'a1', applicationCode: 'APP-1', vacancyId: 'v1', candidateId: 'c1', stage: 'Pre-hire', allowedTransitions: ['Joined'], version: 3, positionTitle: 'Nurse', candidate: { id: 'c1', fullName: 'Rania Otaibi' }, primaryRecruiterName: 'Mariam Farag' };
beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.getApi.mockImplementation(async (p: string) => {
    if (p === '/applications/a1') return app;
    if (p === '/documents/candidate/c1') return [{ id: 'd1', documentType: 'CV', fileName: 'rania-cv.pdf', createdAt: '2026-10-01T00:00:00Z' }, { id: 'd2', documentType: 'Passport', fileName: 'passport.pdf', createdAt: '2026-10-01T00:00:00Z' }];
    throw new Error(`unexpected ${p}`);
  });
  api.downloadFileApi.mockResolvedValue({ blob: new Blob(['x']), filename: 'rania-cv.pdf' });
  URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
});

describe('#34 final approver: read-only file', () => {
  it('reads only GET /applications/:id and the candidate documents; no actions or drawers; CV download only', async () => {
    const u = userEvent.setup();
    render(<MemoryRouter initialEntries={[`/applications/a1?drawer=reject&returnTo=${encodeURIComponent('/candidates?stage=Interview')}`]}><Routes><Route path="/applications/:id" element={<ApplicationFileV2 mode="approver" load={loadApproverFile} />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Rania Otaibi' })).toBeInTheDocument();
    expect(api.getApi.mock.calls.map(([p]) => p).sort()).toEqual(['/applications/a1', '/documents/candidate/c1']);
    expect(screen.queryByRole('dialog')).toBeNull();
    for (const name of [/Reject/, /Review offer/, /Add note/i, /Follow-up/i]) expect(screen.queryByRole('button', { name })).toBeNull();
    await u.click(screen.getByRole('tab', { name: 'Activity' }));
    for (const name of [/Reject/, /Review offer/, /Add note/i, /Follow-up/i]) expect(screen.queryByRole('button', { name })).toBeNull();
    const approvals = screen.getAllByRole('link', { name: /Final approvals/ });
    expect(approvals.length).toBeGreaterThan(0);
    for (const link of approvals) expect(link).toHaveAttribute('href', '/hires/approvals/inbox');
    expect(screen.queryByRole('link', { name: 'Back to Candidates' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: 'Documents' }));
    const dl = screen.getAllByRole('button', { name: 'Download CV' });
    expect(dl).toHaveLength(1);
    await u.click(dl[0]);
    expect(api.downloadFileApi).toHaveBeenCalledWith('/documents/d1/download', 'rania-cv.pdf');
    expect(api.postApi).not.toHaveBeenCalled(); expect(api.patchApi).not.toHaveBeenCalled();
  });
});
