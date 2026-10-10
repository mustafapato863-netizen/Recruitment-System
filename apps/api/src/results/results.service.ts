import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { AuthUser, ResultsResponse } from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { cairoToday, monthRange, tile } from './results.calc';

export type ResultsScope = 'me' | 'team' | 'org';
export interface ResultsQuery { month?: string; vacancyId?: string; managerId?: string }

const CLOSED_STAGES = ['Joined', 'Rejected', 'Withdrawn'];
const REACHED_INTERVIEW = ['Interview', 'Offer', 'Pre-Hire', 'Joined'];
const ADMIN = 'ADMINISTRATOR';

@Injectable()
export class ResultsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
  ) {}

  async results(user: AuthUser, scope: ResultsScope, query: ResultsQuery, now = new Date()): Promise<ResultsResponse> {
    const range = monthRange(query.month, now);
    if (!range) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'month must be YYYY-MM.' });
    const isAdmin = user.roleCodes.includes(ADMIN);
    const org = user.organizationId;

    // 1) Who is counted. Filters only ever narrow the scope.
    const reportsOf = async (managerId: string) => (await this.prisma.user.findMany({ where: { organizationId: org, managerId }, select: { id: true } })).map((u) => u.id);
    let subjects: string[];
    if (scope === 'me') {
      if (query.managerId) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'managerId applies to team and org results only.' });
      subjects = [user.userId];
    } else if (scope === 'team') {
      const mine = await reportsOf(user.userId);
      if (!mine.length && !isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Team results are for managers (you have no direct reports).' });
      subjects = mine;
      if (query.managerId) {
        const theirs = new Set(await reportsOf(query.managerId));
        subjects = subjects.filter((id) => theirs.has(id) || query.managerId === user.userId);
      }
    } else {
      if (!isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Organization results are for administrators.' });
      subjects = query.managerId
        ? await reportsOf(query.managerId)
        : (await this.prisma.user.findMany({ where: { organizationId: org }, select: { id: true } })).map((u) => u.id);
    }
    const people = await this.prisma.user.findMany({ where: { id: { in: subjects }, organizationId: org }, select: { id: true, displayName: true }, orderBy: { displayName: 'asc' } });

    // 2) Access scope of the caller, ANDed with every filter (never replaced).
    const appScope = await this.access.getApplicationVisibilityWhere(user);
    const jobScope = await this.access.getVacancyVisibilityWhere(user);
    const jobFilter: Prisma.VacancyWhereInput[] = [jobScope, { organizationId: org }];
    if (query.vacancyId) jobFilter.push({ id: query.vacancyId });
    const fileWhere = (extra: Prisma.ApplicationWhereInput): Prisma.ApplicationWhereInput => ({
      AND: [appScope, { organizationId: org }, ...(query.vacancyId ? [{ vacancyId: query.vacancyId }] : []), { vacancy: { AND: jobFilter } }, extra],
    });

    const { from, to } = range;
    const today = cairoToday(now);
    const monthName = new Date(`${range.month}-15T12:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    // Seats: joins this month on jobs the people own, against those jobs' targets. TODO(B1): Vacancy.primaryRecruiterId.
    const jobs = await this.prisma.vacancy.findMany({
      where: { AND: [...jobFilter, { assignments: { some: { userId: { in: subjects }, isActive: true, assignmentKind: 'PRIMARY' } } }, { OR: [{ openedAt: null }, { openedAt: { lt: to } }] }, { OR: [{ status: { not: 'Closed' } }, { updatedAt: { gte: from } }] }] },
      select: { id: true, approvedHeadcount: true },
    });
    const joined = jobs.length ? await this.prisma.applicationStatusHistory.count({
      where: { toStage: 'Joined', createdAt: { gte: from, lt: to }, application: fileWhere({ vacancyId: { in: jobs.map((j) => j.id) } }) },
    }) : 0;
    const target = jobs.reduce((t, j) => t + Math.max(0, j.approvedHeadcount), 0);

    // Overdue follow-ups: files the people own whose follow-up date fell in this month (up to yesterday),
    // still open, and with no note or stage change since that date.
    const lastDay = today < range.nextMonthFirstDay ? today : range.nextMonthFirstDay;
    const due = await this.prisma.application.findMany({
      where: fileWhere({ primaryRecruiterId: { in: subjects }, followUpDate: { gte: new Date(`${range.firstDay}T00:00:00Z`), lt: new Date(`${lastDay}T00:00:00Z`) } }),
      select: { id: true, stage: true, followUpDate: true, notes: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 }, statusHistory: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const overdue = due.filter((a) => {
      if (CLOSED_STAGES.includes(a.stage)) return false;
      const since = a.followUpDate!.getTime();
      const touched = [a.notes[0]?.createdAt, a.statusHistory[0]?.createdAt].some((d) => d && d.getTime() >= since);
      return !touched;
    }).length;

    // Screens with a note (by the people) this month, and how many of those files reached Interview.
    const screens = await this.prisma.screeningLog.findMany({
      where: { screenerId: { in: subjects }, screenedAt: { gte: from, lt: to }, notes: { not: null }, application: fileWhere({}) },
      select: { notes: true, application: { select: { stage: true, statusHistory: { where: { toStage: { in: REACHED_INTERVIEW } }, select: { id: true }, take: 1 } } } },
    });
    const noted = screens.filter((s) => s.notes?.trim());
    const reached = noted.filter((s) => REACHED_INTERVIEW.includes(s.application.stage) || s.application.statusHistory.length > 0).length;

    // Offers sent this month on files the people own, and how many were accepted.
    const sent = await this.prisma.offerVersion.findMany({
      where: { sentAt: { gte: from, lt: to }, offer: { application: fileWhere({ primaryRecruiterId: { in: subjects } }) } },
      select: { status: true },
    });
    const accepted = sent.filter((v) => v.status === 'Accepted').length;

    return {
      scope,
      month: range.month,
      range: { from: from.toISOString(), to: to.toISOString() },
      filters: { vacancyId: query.vacancyId ?? null, managerId: query.managerId ?? null },
      people: people.map((p) => ({ id: p.id, name: p.displayName })),
      tiles: {
        seats: tile(joined, target, jobs.length, `${joined} joined in ${monthName} against ${target} seats on ${jobs.length} job${jobs.length === 1 ? '' : 's'}.`, true),
        overdueFollowUps: tile(overdue, due.length, due.length, `${overdue} of ${due.length} follow-ups due in ${monthName} were not acted on by their date.`),
        screensReachedInterview: tile(reached, noted.length, noted.length, `${reached} of ${noted.length} screens with a note in ${monthName} reached Interview.`),
        offersAccepted: tile(accepted, sent.length, sent.length, `${accepted} of ${sent.length} offers sent in ${monthName} were accepted.`),
      },
    };
  }
}
