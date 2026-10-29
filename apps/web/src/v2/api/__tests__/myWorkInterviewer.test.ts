import { describe, expect, it } from 'vitest';
import { fileActionHref, type WorkItem } from '../myWork';

const item = {
  id: 'w1', type: 'interview', title: 'Nourhan Sami — interview', dueAt: null, reason: '', nextAction: { code: 'open-interview', label: 'Open interview' },
  entity: { type: 'interview', id: 'iv9' }, applicationId: 'app-1', interviewer: { id: 'u-ivan', name: 'Ivan Interviewer' }, interviewers: [{ id: 'u-ivan', name: 'Ivan Interviewer' }],
  actions: [],
} as unknown as WorkItem;
const open = { key: 'open-interview', label: 'Open interview', disabled: false } as const;
const score = { key: 'submit-scorecard', label: 'Submit scorecard', disabled: false } as const;

describe('B2F-3: an interviewer’s interview opens /my-interviews, not the file', () => {
  it('attendee interviewer → my-interviews (scorecard opens the drawer there)', () => {
    const ctx = { meId: 'u-ivan', canOpenFile: true, interviewer: true };
    expect(fileActionHref(item, open, ctx)).toBe('/my-interviews?interview=iv9');
    expect(fileActionHref(item, score, ctx)).toBe('/my-interviews?interview=iv9&scorecard=1');
  });
  it('an interviewer without file access goes there too; the file owner (not attending) still opens the file', () => {
    expect(fileActionHref(item, open, { meId: 'u-x', canOpenFile: false, interviewer: true })).toBe('/my-interviews?interview=iv9');
    expect(fileActionHref(item, open, { meId: 'u-mariam', canOpenFile: true, interviewer: false })).toBe('/applications/app-1');
    const blocked = fileActionHref(item, open, { meId: 'u-x', canOpenFile: false, interviewer: true, returnTo: '/my-work?tab=interviews' });
    expect(blocked).toBe('/my-interviews?interview=iv9');
    expect(blocked).not.toContain('/applications/');
  });
});
