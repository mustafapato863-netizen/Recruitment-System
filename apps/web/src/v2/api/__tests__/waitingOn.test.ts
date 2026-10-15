import { describe, expect, it } from 'vitest';
import { waitingOnName } from '../myWork';

describe('B2-13: waitingOnName', () => {
  const base = { id: 'o', type: 'offer', title: 'Offer', dueAt: null, reason: '', nextAction: { code: '', label: '' }, entity: { type: 'offer', id: 'o' }, actions: [] } as never;
  it('names the approver', () => expect(waitingOnName({ ...(base as object), approver: { id: 'k', name: 'Karim Hassan' } } as never)).toBe('Karim Hassan'));
  it('joins approvers[] and skips role codes', () => expect(waitingOnName({ ...(base as object), approvers: [{ id: null, name: 'OFFER_APPROVER' }, { id: 'm', name: 'Mona Adel' }] } as never)).toBe('Mona Adel'));
  it('null when only a role code', () => expect(waitingOnName({ ...(base as object), approvers: [{ id: null, name: 'OFFER_APPROVER' }] } as never)).toBeNull());
  it('names the candidate for a sent offer and ignores an approver', () => expect(waitingOnName({ ...(base as object), waitingOn: 'candidate', candidate: { id: 'c', name: 'Lina Hassan' }, approver: { id: 'k', name: 'Karim Hassan' } } as never)).toBe('Lina Hassan'));
  it('names the interviewer when that is the blocker', () => expect(waitingOnName({ ...(base as object), waitingOn: 'interviewer', interviewer: { id: 'i', name: 'Mona Adel' }, approver: { id: 'k', name: 'Karim Hassan' } } as never)).toBe('Mona Adel'));
});
