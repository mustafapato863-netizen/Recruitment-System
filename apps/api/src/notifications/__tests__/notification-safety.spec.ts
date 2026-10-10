import { describe, expect, it } from 'vitest';
import { isFileNotification, stripPay } from '../notification-safety';

describe('notification pay stripping', () => {
  it('hides amounts but keeps codes, versions and dates', () => {
    expect(stripPay('OFF-2026-0012 v2: Reject (base AED 16,000 above band)')).toBe('OFF-2026-0012 v2: Reject (base [pay hidden] above band)');
    expect(stripPay('Package 12000 monthly, 3,500 housing; 15000AED total')).toBe('Package [pay hidden] monthly, [pay hidden] housing; [pay hidden] total');
    expect(stripPay('Interview on 2026-10-12 at 10:30 for VR-2026-001')).toBe('Interview on 2026-10-12 at 10:30 for VR-2026-001');
  });
  it('knows which notifications are about a file', () => {
    expect(isFileNotification('OfferManagerDecision', 'Offer')).toBe(true);
    expect(isFileNotification('InterviewScheduled', null)).toBe(true);
    expect(isFileNotification('TaskAssigned', 'Task')).toBe(false);
  });
});
