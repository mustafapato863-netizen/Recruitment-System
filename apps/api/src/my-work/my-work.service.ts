import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { buildMyWork, type MyWorkResponse } from './my-work.buckets';

const CLOSED_STAGES = ['Joined', 'Rejected', 'Withdrawn'];
const WORKING_JOB = ['Open', 'Partially Filled'];

/**
 * B4: GET /me/work for the signed-in user.
 *
 * Ownership (B1 is not on this base): a job is owned via an active PRIMARY
 * VacancyAssignment; a file via Application.primaryRecruiterId / taskOwnerId,
 * or by owning its job. A requisition via requesterId.
 * TODO(B1): switch to Vacancy.primaryRecruiterId and file-access.ts
 * applicationOwnershipWhere once #4 merges; add manager "team work" there.
 */
@Injectable()
export class MyWorkService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMyWork(user: AuthUser, now: Date = new Date()): Promise<MyWorkResponse> {
    const org = user.organizationId;
    const me = user.userId;
    const ownedJobWhere = { organizationId: org, assignments: { some: { userId: me, isActive: true, assignmentKind: 'PRIMARY' } } };
    const myFileWhere = {
      organizationId: org,
      stage: { notIn: CLOSED_STAGES },
      vacancy: { status: { in: WORKING_JOB } },
      OR: [{ primaryRecruiterId: me }, { taskOwnerId: me }, { vacancy: ownedJobWhere }],
    };

    const [jobs, requisitions, tasks, interviews, offers] = await Promise.all([
      this.prisma.vacancy.findMany({
        where: { ...ownedJobWhere, status: { in: WORKING_JOB } },
        select: {
          id: true, vacancyCode: true, status: true, joinedHeadcount: true, approvedHeadcount: true,
          position: { select: { title: true } },
          vacancyRequest: { select: { requestedHeadcount: true, targetFillDate: true } },
        },
      }),
      this.prisma.vacancyRequest.findMany({
        where: {
          organizationId: org,
          OR: [
            { requesterId: me, status: { in: ['Draft', 'Changes Requested', 'Pending Approval', 'Approved'] } },
            // Approved, not yet activated: also the requester's manager's work (next action Activate).
            { requester: { managerId: me }, status: 'Approved' },
          ],
        },
        select: { id: true, requestCode: true, status: true, targetFillDate: true, position: { select: { title: true } } },
      }),
      this.prisma.task.findMany({
        where: { organizationId: org, assigneeUserId: me, status: { in: ['Open', 'In Progress'] }, dueAt: { not: null } },
        select: { id: true, title: true, dueAt: true, entityType: true, entityId: true },
        take: 200,
      }),
      // Interviews on my files, or where I am an attendee.
      this.prisma.interview.findMany({
        where: {
          organizationId: org,
          status: { notIn: ['Cancelled'] },
          scheduledStart: { gte: new Date(now.getTime() - 14 * 86_400_000), lte: new Date(now.getTime() + 2 * 86_400_000) },
          OR: [{ application: myFileWhere }, { attendees: { some: { userId: me } } }],
        },
        select: {
          id: true, title: true, scheduledStart: true, scheduledEnd: true, applicationId: true,
          application: { select: { primaryRecruiterId: true, taskOwnerId: true, vacancy: { select: { status: true, assignments: { where: { userId: me, isActive: true, assignmentKind: 'PRIMARY' }, select: { id: true } } } } } },
          attendees: { select: { userId: true, role: true } },
          scorecards: { select: { interviewerId: true } },
        },
        take: 200,
      }),
      this.prisma.offer.findMany({
        where: { organizationId: org, status: { in: ['Pending Approval', 'Sent'] }, application: myFileWhere },
        select: { id: true, offerCode: true, status: true, applicationId: true, updatedAt: true },
        take: 200,
      }),
    ]);

    const ownsFile = (i: (typeof interviews)[number]) =>
      WORKING_JOB.includes(i.application.vacancy.status) &&
      (i.application.primaryRecruiterId === me || i.application.taskOwnerId === me || i.application.vacancy.assignments.length > 0);
    const submitted = (i: (typeof interviews)[number], userId: string) => i.scorecards.some((s) => s.interviewerId === userId);

    return buildMyWork({
      jobs: jobs.map((j) => ({
        id: j.id, code: j.vacancyCode, title: j.position?.title ?? j.vacancyCode, status: j.status, joined: j.joinedHeadcount,
        target: j.vacancyRequest?.requestedHeadcount ?? j.approvedHeadcount,
        dueDate: j.vacancyRequest?.targetFillDate ? j.vacancyRequest.targetFillDate.toISOString().slice(0, 10) : null,
      })),
      requisitions: requisitions.map((r) => ({
        id: r.id, code: r.requestCode, title: r.position?.title ?? r.requestCode, status: r.status,
        dueDate: r.targetFillDate ? r.targetFillDate.toISOString().slice(0, 10) : null,
      })),
      tasks,
      interviews: interviews.filter(ownsFile).map((i) => ({ id: i.id, title: i.title, start: i.scheduledStart, end: i.scheduledEnd, applicationId: i.applicationId })),
      myMissingScorecards: interviews
        .filter((i) => i.attendees.some((a) => a.userId === me) && !submitted(i, me))
        .map((i) => ({ interviewId: i.id, title: i.title, end: i.scheduledEnd })),
      othersMissingScorecards: interviews.filter(ownsFile).map((i) => ({
        interviewId: i.id, title: i.title, end: i.scheduledEnd,
        missing: i.attendees.filter((a) => a.userId !== me && !submitted(i, a.userId)).length,
      })),
      offers: offers.map((o) => ({ id: o.id, code: o.offerCode, status: o.status, applicationId: o.applicationId, updatedAt: o.updatedAt })),
    }, now);
  }
}
