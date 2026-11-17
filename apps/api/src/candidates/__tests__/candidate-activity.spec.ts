import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AuthUser, CandidateActivityEntry } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import type { AccessControlService } from '../../access-control/access-control.service';
import type { UserPermissionsService } from '../../common/user-permissions.service';
import { CandidateActivityService, summarizeCandidateActivity } from '../candidate-activity.service';
import { CandidatesService } from '../candidates.service';
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
    expect(prisma.interviewScorecard.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'Submitted', interview: { organizationId: 'org', applicationId: { in: ['app'] } } } }));
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

  it('finds a bank person with no applications when the scope is ALL, and keeps them out of an assigned-only scope', async () => {
    const allowsEmptyBank = (where: { OR?: Array<Record<string, unknown>> }) =>
      (where.OR ?? []).some((clause) => {
        const applications = clause.applications as { none?: unknown } | undefined;
        return Boolean(applications && 'none' in applications);
      });

    const all = setup('ALL', []);
    all.prisma.candidate.findFirst.mockImplementation(async (args: { where: { OR?: Array<Record<string, unknown>> } }) => (
      allowsEmptyBank(args.where) ? { id: 'bank-person', createdById: 'other' } : null
    ));
    await expect(all.service.list(user, 'bank-person', {})).resolves.toMatchObject({ completed: 0, totalEntries: 0 });
    expect(all.prisma.candidate.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'bank-person',
        organizationId: 'org',
        OR: expect.arrayContaining([{ applications: { none: {} } }]),
      }),
      select: { id: true, createdById: true },
    }));
    expect(all.prisma.application.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org', candidateId: 'bank-person' },
      select: { id: true },
    });

    const assigned = setup('ASSIGNED_ONLY', []);
    assigned.prisma.candidate.findFirst.mockImplementation(async (args: { where: { OR?: Array<Record<string, unknown>> } }) => (
      allowsEmptyBank(args.where) ? { id: 'bank-person', createdById: 'other' } : null
    ));
    await expect(assigned.service.list(user, 'bank-person', {})).rejects.toThrow('Candidate not found');
    expect(assigned.prisma.candidate.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'bank-person', organizationId: 'org', OR: expect.any(Array) }),
    }));
    const assignedWhere = assigned.prisma.candidate.findFirst.mock.calls[0]?.[0] as { where: { OR?: unknown[] } };
    expect(assignedWhere.where.OR).not.toEqual(expect.arrayContaining([{ applications: { none: {} } }]));
    expect(assigned.prisma.application.findMany).not.toHaveBeenCalled();
  });

  it('saves a completed call and the next follow-up together without counting the scheduled follow-up as completed', async () => {
    const { service, prisma } = setup('ALL', [{ id: 'app-1' }, { id: 'app-2' }]);
    const tx = { task: { create: vi.fn().mockResolvedValueOnce({ id: 'task-1' }).mockResolvedValueOnce({ id: 'task-2' }) } };
    (prisma as unknown as { $transaction: (fn: (db: typeof tx) => Promise<unknown>) => Promise<unknown> }).$transaction = vi.fn(async (fn) => fn(tx));
    const result = await service.create(user, 'candidate', {
      kind: 'Call', summary: 'Reached candidate', followUpDueAt: '2099-01-01T12:00:00.000Z', followUpSummary: 'Call again about offer',
    });
    expect(result).toEqual({ id: 'task-1', followUpId: 'task-2' });
    expect(prisma.task.create).not.toHaveBeenCalled();
    expect(tx.task.create).toHaveBeenCalledTimes(2);
    expect(tx.task.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ entityType: 'Candidate', entityId: 'candidate', type: 'CandidateActivity:Call', title: 'Reached candidate', status: 'Completed', completedById: 'me', completedAt: expect.any(Date) }) });
    expect(tx.task.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ entityType: 'Candidate', entityId: 'candidate', type: 'CandidateActivity:FollowUp', title: 'FollowUp activity', description: 'Call again about offer', status: 'Open', completedAt: null, completedById: null, dueAt: new Date('2099-01-01T12:00:00.000Z') }) });
    prisma.task.findMany.mockResolvedValue([
      { id: 'task-1', type: 'CandidateActivity:Call', title: 'Reached candidate', description: null, assigneeUserId: 'me', assignee: { displayName: 'Recruiter' }, completedById: 'me', completedBy: { displayName: 'Recruiter' }, status: 'Completed', completedAt: now, createdAt: now, dueAt: now, entityType: 'Candidate', entityId: 'candidate' },
      { id: 'task-2', type: 'CandidateActivity:FollowUp', title: 'FollowUp activity', description: 'Call again about offer', assigneeUserId: 'me', assignee: { displayName: 'Recruiter' }, completedById: null, completedBy: null, status: 'Open', completedAt: null, createdAt: now, dueAt: new Date('2099-01-01T12:00:00.000Z'), entityType: 'Candidate', entityId: 'candidate' },
      { id: 'auto', type: 'Automation:Email', title: 'Queued reminder', description: null, assigneeUserId: 'me', assignee: { displayName: 'System' }, completedById: null, completedBy: null, status: 'Open', completedAt: null, createdAt: now, dueAt: new Date('2099-03-01T12:00:00.000Z'), entityType: 'Candidate', entityId: 'candidate' },
    ]);
    const summary = await service.list(user, 'candidate', {});
    expect(summary).toMatchObject({ completed: 1, completedByMe: 1, pending: 2, byKind: { Call: 1 } });
    expect(summary.entries.filter((entry) => entry.kind === 'Call' && entry.status === 'Completed')).toHaveLength(1);
  });

  it('returns the same activity when a timed follow-up save is retried with the same idempotency key', async () => {
    const { service, prisma } = setup();
    const tx = { task: { create: vi.fn().mockResolvedValueOnce({ id: 'task-1' }).mockResolvedValueOnce({ id: 'task-2' }) } };
    (prisma as unknown as { $transaction: (fn: (db: typeof tx) => Promise<unknown>) => Promise<unknown> }).$transaction = vi.fn(async (fn) => fn(tx));
    const dto = { kind: 'Call' as const, summary: 'Reached candidate', followUpDueAt: '2099-01-01T12:00:00.000Z', followUpSummary: 'Call again about offer', idempotencyKey: 'retry-1' };
    await expect(service.create(user, 'candidate', dto)).resolves.toEqual({ id: 'task-1', followUpId: 'task-2' });
    await expect(service.create(user, 'candidate', dto)).resolves.toEqual({ id: 'task-1', followUpId: 'task-2', deduplicated: true });
    expect(tx.task.create).toHaveBeenCalledTimes(2);
  });

  it('rejects a request that both schedules a single follow-up and logs a completed activity with a next one', async () => {
    const { service, prisma } = setup();
    await expect(service.create(user, 'candidate', {
      kind: 'Call', summary: 'Reached candidate', dueAt: '2099-01-01T12:00:00.000Z', followUpDueAt: '2099-01-02T12:00:00.000Z',
    })).rejects.toThrow('followUpDueAt');
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('stores one person activity for a candidate who has two applications', async () => {
    const { service, prisma } = setup('ALL', [{ id: 'app-1' }, { id: 'app-2' }]);
    await service.create(user, 'candidate', { kind: 'Call', summary: 'One call for the person' });
    expect(prisma.application.findMany).toHaveBeenCalled();
    expect(prisma.task.create).toHaveBeenCalledTimes(1);
    expect(prisma.task.create).toHaveBeenCalledWith({ data: expect.objectContaining({ entityType: 'Candidate', entityId: 'candidate', type: 'CandidateActivity:Call' }) });
    const created = prisma.task.create.mock.calls[0]?.[0] as { data: { entityId: string; entityType: string } };
    expect(created.data.entityType).not.toBe('Application');
    expect(created.data.entityId).not.toBe('app-1');
    expect(created.data.entityId).not.toBe('app-2');
  });

  it('does not count a duplicated activity projection twice', () => {
    const call = entry('call', 'Completed');
    const screening = { ...entry('screening', 'Completed', 'other'), kind: 'Screening', at: '2026-09-05T12:00:00.000Z' };
    const planned = { ...entry('planned', 'Open'), dueAt: '2026-09-08T12:00:00.000Z', at: '2026-09-07T12:00:00.000Z' };
    const result = summarizeCandidateActivity([
      call,
      { ...call, title: 'Ignored duplicate', at: '2026-09-01T00:00:00.000Z' },
      screening,
      { ...screening, title: 'Ignored screening duplicate' },
      planned,
      { ...planned, title: 'Ignored follow-up duplicate' },
      { ...entry('a-event', 'Event', null), at: '2026-09-06T12:00:00.000Z' },
      { ...entry('b-event', 'Event', null), at: '2026-09-06T12:00:00.000Z' },
    ], 'me', now);
    expect(result).toMatchObject({ completed: 2, completedByMe: 1, pending: 1, totalEntries: 5, byKind: { Call: 1, Screening: 1 } });
    expect(result.entries.map((row) => row.id)).toEqual(['planned', 'a-event', 'b-event', 'call', 'screening']);
    expect(result.entries.find((row) => row.id === 'call')?.title).toBe('Confirmed availability');
    expect(result.byRecruiter).toEqual(expect.arrayContaining([
      { userId: 'me', name: 'me', completed: 1 },
      { userId: 'other', name: 'other', completed: 1 },
    ]));
    expect(result.byRecruiter).toHaveLength(2);
  });

  it('classifies an automated stale alert as a system event and leaves it out of completed work', async () => {
    const { service, prisma } = setup();
    prisma.applicationNote.findMany.mockResolvedValue([
      { id: 'stale', applicationId: 'app', authorId: null, author: null, content: '[Automation] Stale applicant alert: no action for 14 days', createdAt: now },
      { id: 'blank', applicationId: 'app', authorId: null, author: { displayName: 'Ignored' }, content: 'Generated without an author', createdAt: now },
      { id: 'tagged', applicationId: 'app', authorId: 'me', author: { displayName: 'Recruiter' }, content: '[System] nightly digest', createdAt: now },
      { id: 'human', applicationId: 'app', authorId: 'me', author: { displayName: 'Recruiter' }, content: 'Called the candidate', createdAt: now },
    ]);
    const result = await service.list(user, 'candidate', {});
    expect(prisma.applicationNote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ content: true }),
    }));
    expect(result.entries.find((row) => row.id === 'note:stale')).toMatchObject({
      status: 'Event', actorId: null, actorName: 'System', title: 'System activity: automated stale alert',
    });
    expect(result.entries.find((row) => row.id === 'note:blank')).toMatchObject({
      status: 'Event', actorId: null, actorName: 'System', title: 'System activity recorded',
    });
    expect(result.entries.find((row) => row.id === 'note:tagged')).toMatchObject({
      status: 'Event', actorId: null, actorName: 'System', title: 'Application note recorded',
    });
    expect(result.entries.find((row) => row.id === 'note:human')).toMatchObject({
      status: 'Completed', actorId: 'me', actorName: 'Recruiter', title: 'Application note recorded',
    });
    expect(result).toMatchObject({ completed: 1, completedByMe: 1, totalEntries: 4 });
  });

  it('keeps the previous due time when a follow-up is rescheduled', async () => {
    const { service, prisma } = setup();
    prisma.task.findFirst.mockResolvedValue({ id: 'task', dueAt: new Date('2099-01-01T12:00:00.000Z'), description: 'Call again about offer' });
    await service.reschedule(user, 'candidate', 'task', '2099-02-01T12:00:00.000Z');
    expect(prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        dueAt: new Date('2099-02-01T12:00:00.000Z'),
        description: 'Call again about offer\n[Rescheduled 2099-01-01T12:00:00.000Z -> 2099-02-01T12:00:00.000Z]',
      }),
    }));
  });
});

function bankPerson(organizationId = 'org') {
  const stamp = new Date('2026-07-01T00:00:00.000Z');
  return {
    id: 'bank-1',
    organizationId,
    candidateCode: 'CND-2026-031',
    firstName: 'Heba',
    lastName: 'Mansour',
    email: 'heba@example.com',
    phone: null,
    currentTitle: 'Payroll Specialist',
    currentCompany: null,
    summary: null,
    source: 'Bank',
    status: 'Active',
    consentStatus: null,
    consentCapturedAt: null,
    consentSource: null,
    skills: ['Payroll'],
    experienceYears: 7,
    location: 'Cairo',
    certifications: [],
    languages: [],
    availability: null,
    metadata: null,
    createdAt: stamp,
    updatedAt: stamp,
    createdById: 'other',
  };
}

describe('Bank person with no application', () => {
  it('lists and opens the person for an ALL scope, and keeps another organization hidden', async () => {
    const prisma = {
      candidate: {
        findFirst: vi.fn().mockResolvedValue(bankPerson()),
        findMany: vi.fn().mockResolvedValue([bankPerson()]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const access = {
      getUserEffectiveScope: vi.fn().mockResolvedValue({ dataScope: 'ALL' }),
      getApplicationVisibilityWhere: vi.fn(),
    };
    const service = new CandidatesService(prisma as never, undefined, access as never);
    await expect(service.getCandidate('org', 'bank-1', { viewPii: true }, user)).resolves.toMatchObject({
      id: 'bank-1',
      firstName: 'Heba',
      organizationId: 'org',
    });
    expect(prisma.candidate.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ organizationId: 'org' }, { id: 'bank-1' }] },
    });
    expect(access.getApplicationVisibilityWhere).not.toHaveBeenCalled();

    const listed = await service.listCandidates('org', { page: 1, pageSize: 20 }, { viewPii: true }, user);
    expect(listed.data.map((row) => row.id)).toEqual(['bank-1']);
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org', status: { not: 'Archived' } },
    }));

    prisma.candidate.findFirst.mockResolvedValue(bankPerson('other-org'));
    await expect(service.getCandidate('org', 'bank-1', { viewPii: true }, user)).rejects.toThrow('was not found');
  });

  it('keeps a zero-application bank person visible to the creator under ASSIGNED_ONLY, and hidden from everyone else', async () => {
    const visibility = { organizationId: 'org', OR: [{ primaryRecruiterId: 'me' }] };
    const prisma = {
      candidate: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const access = {
      getUserEffectiveScope: vi.fn().mockResolvedValue({ dataScope: 'ASSIGNED_ONLY' }),
      getApplicationVisibilityWhere: vi.fn().mockResolvedValue(visibility),
    };
    const service = new CandidatesService(prisma as never, undefined, access as never);
    await expect(service.getCandidate('org', 'bank-1', { viewPii: true }, user)).rejects.toThrow('was not found');
    expect(prisma.candidate.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            organizationId: 'org',
            OR: [
              { createdById: 'me' },
              { applications: { some: visibility } },
            ],
          },
          { id: 'bank-1' },
        ],
      },
    });

    prisma.candidate.findFirst.mockResolvedValue({ ...bankPerson(), createdById: 'me' });
    await expect(service.getCandidate('org', 'bank-1', { viewPii: true }, user)).resolves.toMatchObject({ id: 'bank-1' });
  });

  it('falls back to application visibility when effective scope is not available', async () => {
    const prisma = { candidate: { findFirst: vi.fn().mockResolvedValue(null) } };
    const access = { getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: 'org' }) };
    const service = new CandidatesService(prisma as never, undefined, access as never);
    await expect(service.getCandidate('org', 'bank-1', { viewPii: true }, user)).rejects.toThrow('was not found');
    expect(access.getApplicationVisibilityWhere).toHaveBeenCalledWith(user);
    expect(prisma.candidate.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            OR: [
              { createdById: 'me' },
              { applications: { some: { organizationId: 'org' } } },
            ],
          }),
        ]),
      }),
    }));
  });
});
