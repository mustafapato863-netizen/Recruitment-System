import { describe, expect, it } from 'vitest';
import { waitingOnName } from '../myWork';

describe('B2-13: waitingOnName', () => {
  const base = { id: 'o', type: 'offer', title: 'Offer', dueAt: null, reason: '', nextAction: { code: '', label: '' }, entity: { type: 'offer', id: 'o' }, actions: [] } as never;
  it('names the approver', () => expect(waitingOnName({ ...(base as object), approver: { id: 'k', name: 'Karim Hassan' } } as never)).toBe('Karim Hassan'));
  it('joins approvers[] and skips role codes', () => expect(waitingOnName({ ...(base as object), approvers: [{ id: null, name: 'OFFER_APPROVER' }, { id: 'm', name: 'Mona Adel' }] } as never)).toBe('Mona Adel'));
  it('null when only a role code', () => expect(waitingOnName({ ...(base as object), approvers: [{ id: null, name: 'OFFER_APPROVER' }] } as never)).toBeNull());
});
