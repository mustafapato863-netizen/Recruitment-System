import { describe, expect, it } from 'vitest';
import { buildMyWork, type MyWorkInput } from '../my-work.buckets';

const NOW = new Date('2026-10-10T06:00:00Z');
const base: MyWorkInput = { jobs: [], requisitions: [], tasks: [], interviews: [], myMissingScorecards: [], othersMissingScorecards: [], offers: [] };
const req = (id: string, status: string, activateBlocked?: string) => ({ id, code: id, title: 'Nurse', status, dueDate: '2026-10-10', ...(activateBlocked ? { activateBlocked } : {}) });
const actions = (id: string) => {
  const w = buildMyWork({ ...base, requisitions: [req('d-ok', 'Draft'), req('d-no', 'Draft', 'Assign an employee first'), req('cr', 'Changes Requested', 'Changes requested: resubmit and get it approved before activating'), req('ap', 'Approved')] }, NOW);
  const item = [...w.dueToday, ...w.overdue].find((i) => i.id === id)!;
  return { item, activate: item.actions.find((a) => a.key === 'activate-requisition') };
};

describe('My Work: M1 Activate on requisitions', () => {
  it('activatable Draft offers Activate (enabled) as the next action', () => {
    const { item, activate } = actions('d-ok');
    expect(item.nextAction).toEqual({ code: 'activate-requisition', label: 'Activate' });
    expect(activate).toEqual({ key: 'activate-requisition', label: 'Activate', disabled: false });
  });
  it('non-activatable Draft shows Activate disabled with the reason; next action stays Submit', () => {
    const { item, activate } = actions('d-no');
    expect(item.nextAction.code).toBe('submit-requisition');
    expect(activate).toEqual({ key: 'activate-requisition', label: 'Activate', disabled: true, reason: 'Assign an employee first' });
  });
  it('Changes Requested: Activate disabled until resubmitted and approved', () => {
    expect(actions('cr').activate).toMatchObject({ disabled: true, reason: 'Changes requested: resubmit and get it approved before activating' });
  });
  it('Approved stays Activate', () => {
    expect(actions('ap').activate).toMatchObject({ disabled: false });
  });
});
