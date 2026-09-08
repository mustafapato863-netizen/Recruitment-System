import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AuthUser, CandidateActivityEntry } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import type { AccessControlService } from '../../access-control/access-control.service';
import type { UserPermissionsService } from '../../common/user-permissions.service';
import { CandidateActivityService, summarizeCandidateActivity } from '../candidate-activity.service';
import { CreateCandidateActivityDto } from '../candidate-activity.dto';

const now = new Date('2026-09-07T12:00:00Z');
const entry = (id: string, status: CandidateActivityEntry['status'], actorId: string | null = 'me'): CandidateActivityEntry => ({ id, status, actorId, actorName: actorId ?? 'System', kind: 'Call', title: 'Confirmed availability', at: '2026-09-06T12:00:00.000Z', dueAt: null, applicationId: null, canComplete: false });
const user: AuthUser = { userId: 'me', organizationId: 'org', roleCodes: ['RECRUITER'] };

function setup(scope = 'ALL', applications: { id: string }[] = [{ id: 'app' }]) {
  const prisma = {
    candidate: { findFirst: vi.fn().mockResolvedValue({ id: 'candidate' }) },
    application: { findMany: vi.fn().mockResolvedValue(applications) },
    integration: { findFirst: vi.fn().mockResolvedValue(null) },
    task: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'task' }), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findFirst: vi.fn().mockResolvedValue(null) },
    applicationNote: { findMany: vi.fn().mockResolvedValue([]) }, screeningLog: { findMany: vi.fn().mockResolvedValue([]) },
    applicationStatusHistory: { findMany: vi.fn().mockResolvedValue([]) }, interview: { findMany: vi.fn().mockResolvedValue([]) },
    interviewScorecard: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const access = { getUserEffectiveScope: vi.fn().mockResolvedValue({ dataScope: scope, canViewPii: true }) };
  const permissions = { getPermissionSet: vi.fn().mockResolvedValue(new Set(['APPLICATION_VIEW', 'VIEW_CANDIDATE_PII', 'TASK_VIEW'])) };
  const service = new CandidateActivityService(prisma as unknown as PrismaService, access as unknown as AccessControlService, permissions as unknown as UserPermissionsService);
  return { service, prisma, access, permissions };
}

describe('Candidate activity measurement', () => {
  it('counts a submitted scorecard as completed assessment work', async () => {
    const { service, prisma } = setup();
    prisma.interviewScorecard.findMany.mockResolvedValue([{ id: 'score', interviewerId: 'me', interviewer: { displayName: 'Recruiter' }, submittedAt: now, interview: { applicationId: 'app' } }]);
    const result = await service.list(user, 'candidate', {});
    expect(result).toMatchObject({ completed: 1, completedByMe: 1, byKind: { 'Interview assessment': 1 } });
    expect(prisma.interviewScorecard.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isLocked: true, interview: { organizationId: 'org', applicationId: { in: ['app'] } } } }));
  });
  it('counts completed work separately from scheduled and system events, across applications', () => {
    const result = summarizeCandidateActivity([
      entry('call', 'Completed'), { ...entry('screening', 'Completed', 'other'), kind: 'Screening', applicationId: 'another-app' },
      { ...entry('planned', 'Open'), dueAt: '2026-09-08T12:00:00.000Z' },
      { ...entry('late', 'Open'), dueAt: '2026-09-06T12:00:00.000Z' }, entry('stage', 'Event', null),
    ], 'me', now, 1, 1);
    expect(result).toMatchObject({ completed: 2, completedByMe: 1, pending: 2, overdue: 1, totalEntries: 5, byKind: { Call: 1, Screening: 1 } });
    expect(result.entries).toHaveLength(1);
    expect(result.byRecruiter).toHaveLength(2);
    expect(result.nextFollowUpAt).toBe('2026-09-06T12:00:00.000Z');
  });
  it('returns an honest empty state', () => {
    expect(summarizeCandidateActivity([], 'me', now)).toMatchObject({ completed: 0, pending: 0, lastActivityAt: null, nextFollowUpAt: null });
  });
  it('rejects whitespace notes and invalid dates', async () => {
    const dto = plainToInstance(CreateCandidateActivityDto, { kind: 'Call', summary: '   ', dueAt: 'tomorrow' });
    expect((await validate(dto)).map((error) => error.property)).toEqual(expect.arrayContaining(['summary', 'dueAt']));
  });
  it('creates completed work atomically with the authenticated recruiter as actor', async () => {
    const { service, prisma } = setup();
    await service.create(user, 'candidate', { kind: 'Call', summary: 'No answer; retry tomorrow' });
    expect(prisma.task.create).toHaveBeenCalledWith({ data: expect.objectContaining({ organizationId: 'org', entityId: 'candidate', type: 'CandidateActivity:Call', assigneeUserId: 'me', createdById: 'me', status: 'Completed', completedAt: expect.any(Date) }) });
  });
  it('schedules without incrementing completed work', async () => {
    const { service, prisma } = setup();
    await service.create(user, 'candidate', { kind: 'Call', summary: 'Follow up', dueAt: '2099-01-01T12:00:00Z' });
    expect(prisma.task.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'Open', completedAt: null }) });
  });
  it('rejects past scheduling before writing', async () => {
    const { service, prisma } = setup();
    await expect(service.create(user, 'candidate', { kind: 'Call', summary: 'Follow up', dueAt: '2000-01-01T12:00:00Z' })).rejects.toThrow('future');
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
  it('rejects a candidate outside the tenant before reading activity', async () => {
    const { service, prisma } = setup();
    prisma.candidate.findFirst.mockResolvedValue(null);
    await expect(service.list(user, 'foreign', {})).rejects.toThrow('Candidate not found');
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(prisma.candidate.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'foreign', organizationId: 'org', OR: expect.any(Array) }), select: { id: true, createdById: true } }));
  });
  it('requires active assignment and fails closed when no application is visible', async () => {
    const { service, prisma } = setup('ASSIGNED_ONLY', []);
    await expect(service.list(user, 'candidate', {})).rejects.toThrow('assigned scope');
    expect(prisma.application.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([{ vacancy: { assignments: { some: { userId: 'me', isActive: true } } } }]) }) }));
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });
  it('fails closed on missing branch assignments', async () => {
    const { service, prisma } = setup('BRANCH', []);
    await expect(service.list(user, 'candidate', {})).rejects.toThrow();
    expect(prisma.application.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ vacancy: { branch: { OR: [{ id: { in: [] } }, { code: { in: [] } }] } } }) }));
  });
  it('does not disclose notes or salary through the summary and masks activity text without PII permission', async () => {
    const { service, prisma, permissions } = setup();
    permissions.getPermissionSet.mockResolvedValue(new Set());
    prisma.task.findMany.mockResolvedValue([{ id: 'task', type: 'CandidateActivity:Call', title: 'Sensitive details', assigneeUserId: 'me', assignee: { displayName: 'Recruiter' }, status: 'Completed', completedAt: now, createdAt: now, dueAt: null, entityType: 'Candidate' }]);
    const result = await service.list(user, 'candidate', {});
    expect(result.entries[0]?.title).toBe('Activity details restricted');
    expect(prisma.screeningLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org', applicationId: { in: [] } } }));
  });
  it('completes only the caller’s matching candidate follow-up and keeps retry timestamps stable', async () => {
    const { service, prisma } = setup();
    await service.complete(user, 'candidate', 'task');
    expect(prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'task', assigneeUserId: 'me', organizationId: 'org', entityId: 'candidate', status: { in: ['Open', 'In Progress'] } }) }));
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    prisma.task.findFirst.mockResolvedValue({ id: 'task' });
    await expect(service.complete(user, 'candidate', 'task')).resolves.toEqual({ id: 'task' });
    prisma.task.findFirst.mockResolvedValue(null);
    await expect(service.complete(user, 'candidate', 'foreign')).rejects.toThrow('not found');
  });
});
