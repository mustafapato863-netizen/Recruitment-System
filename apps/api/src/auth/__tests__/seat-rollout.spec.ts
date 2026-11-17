import { describe, expect, it } from 'vitest';
import { resolveV2Seats, seatOf } from '../seat-rollout';

describe('B10 seat rollout switch', () => {
  it('defaults to 100% full organization cutover (all seats on v2)', () => {
    expect(resolveV2Seats(null, undefined)).toEqual({ v2Seats: ['employee', 'manager', 'admin'], source: 'default' });
    expect(resolveV2Seats({}, '')).toEqual({ v2Seats: ['employee', 'manager', 'admin'], source: 'default' });
  });
  it('env RF_V2_SEATS: list, none, junk falls back', () => {
    expect(resolveV2Seats(null, 'Manager, employee')).toEqual({ v2Seats: ['employee', 'manager'], source: 'env' });
    expect(resolveV2Seats(null, 'none')).toEqual({ v2Seats: [], source: 'env' });
    expect(resolveV2Seats(null, 'everyone')).toEqual({ v2Seats: ['employee', 'manager', 'admin'], source: 'default' });
  });
  it('org config wins over env; [] means nobody; invalid org config falls through to env', () => {
    expect(resolveV2Seats({ v2Seats: ['admin', 'employee', 'x'] }, 'manager')).toEqual({ v2Seats: ['employee', 'admin'], source: 'org' });
    expect(resolveV2Seats({ v2Seats: [] }, 'manager')).toEqual({ v2Seats: [], source: 'org' });
    expect(resolveV2Seats({ v2Seats: ['x'] }, 'manager')).toEqual({ v2Seats: ['manager'], source: 'env' });
    expect(resolveV2Seats({ v2Seats: 'employee' }, undefined).source).toBe('default');
  });
  it('seat of a user', () => {
    expect(seatOf(['ADMINISTRATOR', 'RECRUITER'], true)).toBe('admin');
    expect(seatOf(['HIRING_MANAGER'], false)).toBe('manager');
    expect(seatOf(['RECRUITER'], true)).toBe('manager');
    expect(seatOf(['RECRUITER'], false)).toBe('employee');
  });
});
