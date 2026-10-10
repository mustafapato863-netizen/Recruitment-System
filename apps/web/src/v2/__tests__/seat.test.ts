import { describe, expect, it } from 'vitest';
import { resolveSeat } from '../seat';
import { parseSeats, resolveV2Seats, serverV2Enabled, serverV2Seats, shouldUseV2Shell, V2_SEATS_STORAGE_KEY } from '../seatSwitch';

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

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, data };
}

describe('seat-by-seat switch', () => {
  it('parses seat lists', () => {
    expect(parseSeats('employee, manager')).toEqual(['employee', 'manager']);
    expect(parseSeats('all')).toEqual(['employee', 'manager', 'admin']);
    expect(parseSeats('none')).toEqual([]);
    expect(parseSeats('bogus')).toEqual([]);
    expect(parseSeats(undefined)).toBeNull();
  });

  it('defaults to Employee only', () => {
    expect([...resolveV2Seats()]).toEqual(['employee']);
  });

  it('query > storage > env, and the query is persisted', () => {
    const storage = memoryStorage({ [V2_SEATS_STORAGE_KEY]: 'manager' });
    expect([...resolveV2Seats({ storage, envSeats: 'admin' })]).toEqual(['manager']);
    expect([...resolveV2Seats({ envSeats: 'admin' })]).toEqual(['admin']);
    expect([...resolveV2Seats({ search: '?v2seats=admin,employee', storage, envSeats: 'manager' })]).toEqual(['admin', 'employee']);
    expect(storage.data[V2_SEATS_STORAGE_KEY]).toBe('admin,employee');
  });

  it.each([
    [false, 'employee', 'employee', false],
    [true, 'employee', 'employee', true],
    [true, 'manager', 'employee', false],
    [true, 'manager', 'employee,manager', true],
    [true, 'admin', 'all', true],
    [true, 'employee', 'none', false],
  ] as const)('flag=%s seat=%s seats=%s → v2=%s', (flag, seat, seats, expected) => {
    expect(shouldUseV2Shell(seat, { envFlag: flag, envSeats: seats })).toBe(expected);
  });
});

describe('server-side seats from /auth/me', () => {
  it('reads me.v2Seats (array or string), else flags.v2Seats, else null', () => {
    expect(serverV2Seats({ v2Seats: ['EMPLOYEE', 'manager'] })).toEqual(['employee', 'manager']);
    expect(serverV2Seats({ v2Seats: 'admin' })).toEqual(['admin']);
    expect(serverV2Seats({ flags: { v2Seats: ['admin'] } })).toEqual(['admin']);
    expect(serverV2Seats({ v2Seats: ['employee'], flags: { v2Seats: ['admin'] } })).toEqual(['employee']);
    expect(serverV2Seats({ v2Seats: [] })).toEqual([]);
    expect(serverV2Seats({})).toBeNull();
    expect(serverV2Seats(null)).toBeNull();
  });

  it('takes precedence over query, storage and env', () => {
    const storage = { getItem: () => 'admin', setItem: () => {} };
    expect([...resolveV2Seats({ me: { v2Seats: ['manager'] }, search: '?v2seats=employee', storage, envSeats: 'admin' })]).toEqual(['manager']);
    expect(shouldUseV2Shell('employee', { envFlag: true, envSeats: 'employee', me: { v2Seats: [] } })).toBe(false);
  });

  it('v2Enabled decides outright when present (B10), even against the UI flag and seat lists', () => {
    const me = { seat: 'manager', v2Seats: ['employee'], v2Enabled: true };
    expect(serverV2Enabled(me)).toBe(true);
    expect(shouldUseV2Shell('manager', { envFlag: false, me })).toBe(true);
    expect(shouldUseV2Shell('employee', { envFlag: true, search: '?ui=v2&v2seats=employee', me: { v2Seats: ['employee'], v2Enabled: false } })).toBe(false);
    expect(serverV2Enabled({ v2Enabled: 'yes' })).toBeNull();
  });
  it('B10 seat wins over the provisional role table', () => {
    expect(resolveSeat(me(['ROLE_001'], [], { seat: 'manager' }))).toBe('manager');
  });
  it('falls back to client sources when absent', () => {
    expect([...resolveV2Seats({ me: { id: 'x' }, envSeats: 'admin' })]).toEqual(['admin']);
  });
});
