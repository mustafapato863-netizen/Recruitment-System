import { describe, expect, it } from 'vitest';
import { buildCancellationImpact, capacityReductionImpact, isUnresolvedInterview } from '../commitment-impact';

describe('cancellation impact', () => {
  it('blocks while an interview, a sent offer, or awaiting joining is unresolved', () => {
    const impact = buildCancellationImpact({
      interviews: [
        { id: 'i1', title: 'Screen', status: 'Scheduled', applicationId: 'a1' },
        { id: 'i2', title: 'Done', status: 'Completed', applicationId: 'a2' },
        { id: 'i3', title: 'Dropped', status: 'Cancelled', applicationId: 'a3' },
      ],
      offers: [
        { id: 'o1', code: 'OFF-1', status: 'Sent', applicationId: 'a1' },
        { id: 'o2', code: 'OFF-2', status: 'Declined', applicationId: 'a4' },
      ],
      joining: [{ id: 'h1', status: 'Awaiting Joining', applicationId: 'a5', candidateName: 'Nour Ali' }],
      activeApplications: 4,
      joinedApplications: 1,
    });
    expect(impact.canClose).toBe(false);
    expect(impact.commitments.map((c) => c.id)).toEqual(['i1', 'o1', 'h1']);
    expect(impact.message).toMatch(/Resolve 1 interview, 1 offer, 1 joining commitment/);
    expect(impact.message).toMatch(/1 joined hire stays/);
    expect(isUnresolvedInterview('No-show')).toBe(false);
  });

  it('allows close when commitments are resolved and keeps the joined count in the message', () => {
    const impact = buildCancellationImpact({
      interviews: [{ id: 'i2', title: 'Done', status: 'Completed', applicationId: 'a2' }],
      offers: [{ id: 'o2', code: 'OFF-2', status: 'Withdrawn', applicationId: 'a4' }],
      joining: [{ id: 'h2', status: 'Joined', applicationId: 'a5', candidateName: 'Nour Ali' }],
      activeApplications: 2,
      joinedApplications: 1,
    });
    expect(impact.canClose).toBe(true);
    expect(impact.commitments).toEqual([]);
    expect(impact.message).toMatch(/rejects 2 open applications/);
    expect(impact.joinedApplications).toBe(1);
  });
});

describe('capacity impact', () => {
  it('blocks a target below joined seats and explains both counts', () => {
    const impact = capacityReductionImpact({ current: 4, next: 1, joined: 2, openApplications: 3 });
    expect(impact.blocked).toBe(true);
    expect(impact.message).toMatch(/cannot drop below 2 already joined/);
    expect(impact.message).toMatch(/3 open applications stay/);
  });

  it('allows a reduction that still covers joined seats', () => {
    const impact = capacityReductionImpact({ current: 4, next: 2, joined: 2, openApplications: 1 });
    expect(impact.blocked).toBe(false);
    expect(impact.message).toMatch(/from 4 to 2/);
  });
});
