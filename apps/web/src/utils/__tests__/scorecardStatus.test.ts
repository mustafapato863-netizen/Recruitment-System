import { describe, expect, it } from 'vitest';
import { roundScorecardState, scorecardState } from '../scorecardStatus';

describe('scorecard state from status only (B5; isLocked is never read)', () => {
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
