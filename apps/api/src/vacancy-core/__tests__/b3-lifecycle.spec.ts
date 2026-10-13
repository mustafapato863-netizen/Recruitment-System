import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { vacancyRequestStatusLabel, vacancyRequestStatuses, vacancyStatuses } from '@recruitflow/contracts';
import {
  ACCEPTING_JOB_STATUSES,
  JOB_STATUSES,
  JOB_TRANSITIONS,
  assertJobAcceptsApplications,
  assertJobTransition,
  canTransitionJob,
  claimApplicationJoin,
  recordJoin,
  requireReason,
  seatStatus,
} from '../vacancy-lifecycle';
import { JobStatusReasonDto, UpdateVacancyStatusDto } from '../vacancy-core.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const ALLOWED: Array<[string, string]> = [
  ['Open', 'On Hold'], ['Open', 'Partially Filled'], ['Open', 'Filled'], ['Open', 'Closed'],
  ['On Hold', 'Open'], ['On Hold', 'Partially Filled'], ['On Hold', 'Filled'], ['On Hold', 'Closed'],
  ['Partially Filled', 'On Hold'], ['Partially Filled', 'Filled'], ['Partially Filled', 'Closed'],
  ['Filled', 'Closed'],
];

describe('B3 job status set', () => {
  it('is exactly Open, On Hold, Partially Filled, Filled, Closed (no Cancelled, no Pending Activation)', () => {
    expect([...JOB_STATUSES]).toEqual(['Open', 'On Hold', 'Partially Filled', 'Filled', 'Closed']);
    expect([...vacancyStatuses]).toEqual([...JOB_STATUSES]);
  });
});

describe('B3 transition table: every pair', () => {
  const from = [...JOB_STATUSES, 'Cancelled', 'Pending Activation'];
  const to = [...JOB_STATUSES, 'Cancelled', 'Pending Activation'];
  for (const f of from) {
    for (const t of to) {
      const allowed = ALLOWED.some(([a, b]) => a === f && b === t);
      it(`${f} -> ${t} is ${allowed ? 'allowed' : 'blocked'}`, () => {
        expect(canTransitionJob(f, t)).toBe(allowed);
        if (allowed) expect(() => assertJobTransition(f, t)).not.toThrow();
        else expect(() => assertJobTransition(f, t)).toThrow(ConflictException);
      });
    }
  }
  it('Closed is terminal', () => expect(JOB_TRANSITIONS.Closed).toEqual([]));
});

describe('B3 requisition label and public statuses', () => {
  it('labels Converted to Vacancy as Active without changing the value', () => {
    expect(vacancyRequestStatusLabel('Converted to Vacancy')).toBe('Active');
    expect(vacancyRequestStatusLabel('Approved')).toBe('Approved');
    expect(vacancyRequestStatuses).toContain('Converted to Vacancy');
  });
  it('public careers query Open and Partially Filled jobs everywhere', () => {
    const src = readFileSync(path.resolve(__dirname, '../../public-jobs/public-jobs.service.ts'), 'utf8');
    expect(src).not.toMatch(/status: 'Open'|status" = 'Open'|status !== 'Open'/);
    expect(src).toContain(`IN ('Open', 'Partially Filled')`);
  });
});

describe('B3 helpers', () => {
  it('derives seat status', () => {
    expect(seatStatus(0, 3)).toBe('Open');
    expect(seatStatus(1, 3)).toBe('Partially Filled');
    expect(seatStatus(3, 3)).toBe('Filled');
  });
  it('a held job (and filled/closed) accepts no new applications', () => {
    expect([...ACCEPTING_JOB_STATUSES]).toEqual(['Open', 'Partially Filled']);
    for (const status of ['On Hold', 'Filled', 'Closed']) {
      expect(() => assertJobAcceptsApplications({ status, vacancyCode: 'VAC-1' })).toThrow(ConflictException);
    }
    expect(() => assertJobAcceptsApplications({ status: 'Open' })).not.toThrow();
  });
  it('requires a reason', () => {
    expect(() => requireReason('  ', 'hold')).toThrow(BadRequestException);
    expect(requireReason(' budget freeze ', 'hold')).toBe('budget freeze');
  });
  it('reason DTO and status DTO reject missing reason / Cancelled', async () => {
    expect(await validate(plainToInstance(JobStatusReasonDto, {}))).not.toHaveLength(0);
    expect(await validate(plainToInstance(UpdateVacancyStatusDto, { status: 'Cancelled', reason: 'x' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(UpdateVacancyStatusDto, { status: 'Closed', reason: 'done' }))).toHaveLength(0);
  });
  it('a join fills seats with history; a held job stays held until its last seat', async () => {
    const tx = {
      vacancy: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: 'v', status: 'Open', joinedHeadcount: 1, approvedHeadcount: 2 })
          .mockResolvedValueOnce({ id: 'v', status: 'On Hold', joinedHeadcount: 1, approvedHeadcount: 2 })
          .mockResolvedValueOnce({ id: 'v', status: 'On Hold', joinedHeadcount: 2, approvedHeadcount: 2 }),
        update: vi.fn(),
      },
      vacancyStatusHistory: { create: vi.fn() },
    };
    await recordJoin(tx as never, { id: 'v', status: 'Open', joinedHeadcount: 0, approvedHeadcount: 2 }, 'u');
    expect(tx.vacancy.updateMany).toHaveBeenLastCalledWith({ where: { id: 'v', joinedHeadcount: { lt: 2 } }, data: { joinedHeadcount: { increment: 1 } } });
    expect(tx.vacancy.update).toHaveBeenLastCalledWith({ where: { id: 'v' }, data: { status: 'Partially Filled' } });
    expect(tx.vacancyStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ fromStatus: 'Open', toStatus: 'Partially Filled', reason: 'Seat filled (Joined)' }) });
    await recordJoin(tx as never, { id: 'v', status: 'On Hold', joinedHeadcount: 0, approvedHeadcount: 2 }, 'u');
    expect(tx.vacancy.update).toHaveBeenCalledTimes(1);
    await recordJoin(tx as never, { id: 'v', status: 'On Hold', joinedHeadcount: 1, approvedHeadcount: 2 }, 'u');
    expect(tx.vacancy.update).toHaveBeenLastCalledWith({ where: { id: 'v' }, data: { status: 'Filled' } });
  });
  it('a full job refuses another join', async () => {
    const tx = { vacancy: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findUnique: vi.fn(), update: vi.fn() }, vacancyStatusHistory: { create: vi.fn() } };
    await expect(recordJoin(tx as never, { id: 'v', status: 'Filled', joinedHeadcount: 1, approvedHeadcount: 1 }, 'u')).rejects.toBeInstanceOf(ConflictException);
    try {
      await recordJoin(tx as never, { id: 'v', status: 'Filled', joinedHeadcount: 1, approvedHeadcount: 1 }, 'u');
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({ code: 'CAPACITY_FULL' });
    }
    expect(tx.vacancy.update).not.toHaveBeenCalled();
  });
  it('claims a file for joining once', async () => {
    const tx = { application: { updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }) } };
    expect(await claimApplicationJoin(tx as never, 'a')).toBe(true);
    expect(tx.application.updateMany).toHaveBeenCalledWith({ where: { id: 'a', stage: { not: 'Joined' } }, data: { stage: 'Joined', version: { increment: 1 } } });
    expect(await claimApplicationJoin(tx as never, 'a')).toBe(false);
  });
  it('no service writes Cancelled or Pending Activation onto a job, and joins no longer write Closed', () => {
    const root = path.resolve(__dirname, '../..');
    for (const file of ['vacancy-core/vacancy-core.service.ts', 'applications/applications.service.ts', 'hiring/hiring.service.ts']) {
      const src = readFileSync(path.join(root, file), 'utf8');
      expect(src).not.toMatch(/vacancy\.(update|create)\([^)]*status: '(Cancelled|Pending Activation)'/s);
      expect(src).not.toMatch(/shouldClose \? \{ status: 'Closed' \}/);
    }
  });
});
