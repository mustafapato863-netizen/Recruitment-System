import { describe, expect, it } from 'vitest';
import { roundScorecardState, scorecardState } from '../scorecardStatus';

describe('scorecard state from B5 status', () => {
  it('maps a card', () => {
    expect(scorecardState(null)).toBe('missing');
    expect(scorecardState({ status: 'Draft' })).toBe('draft');
    expect(scorecardState({ status: 'Submitted' })).toBe('submitted');
    expect(scorecardState({ status: 'submitted' })).toBe('submitted');
  });
  it('maps a round', () => {
    expect(roundScorecardState([])).toBe('missing');
    expect(roundScorecardState([{ status: 'Draft' }])).toBe('draft');
    expect(roundScorecardState([{ status: 'Draft' }, { status: 'Submitted' }])).toBe('submitted');
  });
});

describe('R3-1: falls back to isLocked when status is absent (#4 before B5)', () => {
  it('maps a card', () => {
    expect(scorecardState({ isLocked: true })).toBe('submitted');
    expect(scorecardState({ isLocked: false })).toBe('draft');
    expect(scorecardState({})).toBe('draft');
  });
  it('status wins over isLocked when both are present', () => {
    expect(scorecardState({ status: 'Draft', isLocked: true })).toBe('draft');
    expect(scorecardState({ status: 'Submitted', isLocked: false })).toBe('submitted');
  });
  it('maps a round (InterviewDetail, ScorecardSummary, ApplicantStageWorkspace)', () => {
    expect(roundScorecardState([{ isLocked: false }, { isLocked: true }])).toBe('submitted');
    expect(roundScorecardState([{ isLocked: false }])).toBe('draft');
  });
});
