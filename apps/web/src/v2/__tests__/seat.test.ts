import { describe, expect, it } from 'vitest';
import { resolveSeat } from '../seat';

const me = (codes: string[], permissions: string[] = [], extra: Record<string, unknown> = {}) => ({
  roles: codes.map((code, i) => ({ id: `r${i}`, code, name: code })), permissions, ...extra,
});

describe('resolveSeat (provisional role → seat)', () => {
  it.each([
    [['ROLE_001'], 'employee'],
    [['RECRUITER'], 'employee'],
    [['EMPLOYEE'], 'employee'],
    [['VIEWER'], 'employee'],
    [['HR_OPERATIONS'], 'employee'],
    [['INTERVIEWER'], 'employee'],
    [['LICENSE_SPECIALIST'], 'employee'],
    [['RECRUITER', 'INTERVIEWER'], 'employee'],
    [['HIRING_MANAGER'], 'manager'],
    [['HR_MANAGER'], 'manager'],
    [['TEAM_LEADER'], 'manager'],
    [['OFFER_APPROVER'], 'manager'],
    [['FINAL_HIRING_APPROVER'], 'manager'],
    [['RECRUITER', 'TEAM_LEAD'], 'manager'],
    [['ADMINISTRATOR'], 'admin'],
    [['SYSADMINISTRATOR'], 'admin'],
    [['HIRING_MANAGER', 'ADMINISTRATOR'], 'admin'],
  ])('%j → %s', (codes, seat) => {
    expect(resolveSeat(me(codes))).toBe(seat);
  });

  it('is case/whitespace tolerant on role codes', () => {
    expect(resolveSeat(me([' hiring_manager ']))).toBe('manager');
  });

  it('interviewer/licence permissions never create a seat', () => {
    expect(resolveSeat(me(['RECRUITER'], ['INTERVIEW_VIEW', 'LICENSE_VERIFY', 'SCORECARD_SUBMIT']))).toBe('employee');
  });

  it('unknown custom roles fall back to permissions', () => {
    expect(resolveSeat(me(['CUSTOM_X'], ['USERS_MANAGE']))).toBe('admin');
    expect(resolveSeat(me(['CUSTOM_X'], ['APPROVE_OFFERS']))).toBe('manager');
    expect(resolveSeat(me(['CUSTOM_X'], ['VACANCY_VIEW']))).toBe('employee');
  });

  it('known role codes are not upgraded by stray permissions', () => {
    expect(resolveSeat(me(['RECRUITER'], ['APPROVE_OFFERS']))).toBe('employee');
  });

  it('prefers me.seat when the backend sends it (B0b)', () => {
    expect(resolveSeat(me(['ADMINISTRATOR'], [], { seat: 'EMPLOYEE' }))).toBe('employee');
    expect(resolveSeat(me(['RECRUITER'], [], { seat: 'manager' }))).toBe('manager');
    expect(resolveSeat(me(['RECRUITER'], [], { seat: 'bogus' }))).toBe('employee');
  });

  it('handles null and empty users', () => {
    expect(resolveSeat(null)).toBe('employee');
    expect(resolveSeat({ roles: [], permissions: [] } as never)).toBe('employee');
  });
});
