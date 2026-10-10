import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NextActionGuidanceBanner, getNextActionPlan } from '../NextActionGuidanceBanner';
import { aggregateInterviewScorecards } from '../ScorecardSummary';
import { isAdministratorUser } from '../../../utils/isAdministrator';

const noop = () => {};
const banner = (isAdmin: boolean) => render(
  <NextActionGuidanceBanner stage="Applied" candidateName="Ahmed" unassigned isAdmin={isAdmin} onAssign={vi.fn()}
    onAdvanceStage={noop} onScheduleInterview={noop} onCreateOffer={noop} onViewCandidate360={noop} />,
);

describe('NEW-4: admins are not offered "Assign to me"', () => {
  it('plan skips assign for admins but keeps it for others', () => {
    expect(getNextActionPlan('Applied', true).kind).toBe('assign');
    expect(getNextActionPlan('Applied', true, true)).toMatchObject({ kind: 'advance', label: 'Move to screening' });
  });
  it('banner hides the button for admins', () => {
    banner(true);
    expect(screen.queryByRole('button', { name: /Assign to me/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move to screening/ })).toBeInTheDocument();
  });
  it('banner keeps it for recruiters', () => {
    banner(false);
    expect(screen.getByRole('button', { name: /Assign to me/ })).toBeInTheDocument();
  });
  it('detects administrators by role code or name', () => {
    expect(isAdministratorUser({ roles: [{ code: 'ADMINISTRATOR', name: 'Administrator' }] } as never)).toBe(true);
    expect(isAdministratorUser({ roles: [{ code: 'X', name: 'administrator' }] } as never)).toBe(true);
    expect(isAdministratorUser({ roles: [{ code: 'RECRUITER', name: 'Recruiter' }] } as never)).toBe(false);
    expect(isAdministratorUser(null)).toBe(false);
  });
});

describe('R3-1: ScorecardSummary aggregate reads isLocked when status is absent', () => {
  it('locked #4 card counts as submitted', () => {
    expect(aggregateInterviewScorecards([{ id: 'a', overallRating: 4, isLocked: true } as never]).submitted).toBe(true);
    expect(aggregateInterviewScorecards([{ id: 'a', overallRating: 4, isLocked: false } as never]).submitted).toBe(false);
  });
});
