import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@recruitflow/database';
import { monthlyTargetWeeks } from '@recruitflow/contracts';
import type {
  AuthUser,
  ResultDetailItem,
  ResultsCapacity,
  ResultsResponse,
  ResultsVacancyOption,
  ResultTileKey,
  TargetJobOption,
  TargetMetricCode,
  TargetPeriodType,
  TargetProgressItem,
  TargetRecordItem,
  TargetRevisionItem,
} from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { MANAGER_TREE_DEPTH } from '../common/access/file-access';
import {
  bucketJoinedBySite,
  buildTeamFunnel,
  cairoDateLabel,
  cairoToday,
  countFeedback,
  countInterviews,
  countJoinings,
  countScreenings,
  monthRange,
  resolveTargetPeriod,
  TARGET_METRIC_LABEL,
  TARGET_METRICS,
  targetProgress,
  tile,
  type CountedWork,
  type JoinedSiteCount,
  type TargetMetric,
  type TeamFunnelStep,
} from './results.calc';
import { HAS_VACANCY_OWNER } from '../common/schema-features';

export type ResultsScope = 'me' | 'team' | 'org';
export interface ResultsQuery { month?: string; vacancyId?: string; managerId?: string; branchId?: string; periodType?: string; periodKey?: string }

const CLOSED_STAGES = ['Joined', 'Rejected', 'Withdrawn'];
const REACHED_INTERVIEW = ['Interview', 'Offer', 'Pre-Hire', 'Joined'];
const ADMIN = 'ADMINISTRATOR';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUPLICATE_TARGET = 'A target for this employee, metric, period, and job scope already exists. Edit the existing target instead.';
const STALE_TARGET = 'This target was updated by someone else. Refresh and try again.';
const REASON_REQUIRED = 'A reason is required when changing an existing target.';

export interface TargetListQuery {
  scope?: 'me' | 'team' | 'org';
  periodType?: TargetPeriodType;
  periodKey?: string;
  vacancyId?: string;
  branchId?: string;
  employeeId?: string;
}

export interface CreateTargetInput {
  employeeId?: string;
  metric?: string;
  periodType?: string;
  periodKey?: string;
  targetQuantity?: number;
  vacancyId?: string | null;
  notes?: string;
}

export interface UpdateTargetInput {
  targetQuantity?: number;
  reason?: string;
  version?: number;
}

export interface MonthlyPlanInput {
  employeeId?: string;
  month?: string;
  vacancyId?: string | null;
  reason?: string;
  targets?: Array<{ metric?: string; targetQuantity?: number; version?: number | null }>;
}

const DATE_LABEL: Record<TargetMetric, string> = {
  screenings_completed: 'Screened',
  interviews_conducted: 'Completed',
  feedback_submitted: 'Submitted',
  seats_joined: 'Joined',
};

function safeLabel(value: string | null | undefined, fallback: string): string {
  const raw = (value ?? '').trim() || fallback;
  return raw
    .replace(/changes\s+requested/gi, 'Revision requested')
    .replace(/change/gi, 'update')
    .replace(/previous/gi, 'prior')
    .replace(/activity/gi, 'record');
}

function candidateNameOf(candidate?: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!candidate) return 'Candidate';
  const full = `${candidate.firstName ?? ''} ${candidate.lastName ?? ''}`.trim();
  return safeLabel(full, 'Candidate');
}

function vacancyTitleOf(vacancy?: { vacancyCode?: string | null; position?: { title?: string | null } | null } | null): string {
  const title = vacancy?.position?.title?.trim() || vacancy?.vacancyCode?.trim() || 'Job';
  return safeLabel(title, 'Job');
}

@Injectable()
export class ResultsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
  ) {}

  async results(user: AuthUser, scope: ResultsScope, query: ResultsQuery, now = new Date()): Promise<ResultsResponse> {
    const periodType = query.periodType === undefined ? 'monthly' : this.requirePeriodType(query.periodType);
    if (periodType === 'weekly' && scope !== 'team') throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Weekly analytics apply to team results only.' });
    if (query.month && query.periodKey && periodType === 'monthly' && query.month !== query.periodKey) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'month and periodKey must identify the same month.' });
    const period = this.periodOrThrow(periodType, query.periodKey ?? query.month, now);
    const range = periodType === 'weekly'
      ? { month: cairoToday(period.from).slice(0, 7), firstDay: cairoToday(period.from), nextMonthFirstDay: cairoToday(period.to), from: period.from, to: period.to }
      : monthRange(query.periodKey ?? query.month, now);
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
    const people = await this.prisma.user.findMany({ where: { id: { in: subjects }, organizationId: org }, select: { id: true, displayName: true, jobTitle: true }, orderBy: { displayName: 'asc' } });
    const personOf = (p: { id: string; displayName: string; jobTitle: string | null }) => {
      const role = p.jobTitle?.trim() || '';
      return { id: p.id, name: p.displayName, ...(role ? { role } : {}) };
    };

    // 2) Access scope of the caller, ANDed with every filter (never replaced).
    const appScope = await this.access.getApplicationVisibilityWhere(user);
    // Jobs in the caller's scope. With B1 (#4) under this branch, other owners' jobs are in scope (just redacted),
    // so use B1's scope predicate; without B1, the visibility predicate is the scope. Files keep their own visibility.
    const access = this.access as AccessControlService & { getVacancyScopeWhere?: (u: AuthUser) => Promise<Prisma.VacancyWhereInput> };
    // B2-11: for non-admins the job scope is ownership + reporting tree (getVacancyVisibilityWhere, B2-8), not the
    // role's data scope, which hid a Manager's reports' jobs and zeroed Team results.
    const jobScope = isAdmin && access.getVacancyScopeWhere ? await access.getVacancyScopeWhere(user) : await this.access.getVacancyVisibilityWhere(user);
    const baseJobFilter: Prisma.VacancyWhereInput[] = [jobScope, { organizationId: org }];
    const jobFilter: Prisma.VacancyWhereInput[] = [...baseJobFilter];
    if (query.vacancyId) jobFilter.push({ id: query.vacancyId });
    if (query.branchId) jobFilter.push({ branchId: query.branchId });
    const fileWhere = (extra: Prisma.ApplicationWhereInput): Prisma.ApplicationWhereInput => ({
      // B2-11: non-admin file scope is appScope (ownership + tree); a file the person owns on another owner's job still counts.
      AND: [appScope, { organizationId: org }, ...(query.vacancyId ? [{ vacancyId: query.vacancyId }] : []), ...(query.branchId ? [{ vacancy: { branchId: query.branchId } }] : []), ...(isAdmin ? [{ vacancy: { AND: jobFilter } }] : []), extra],
    });

    const { from, to } = range;
    const today = cairoToday(now);
    const monthName = period.label;

    const ownerFilterFor = (subjectIds: string[]): Prisma.VacancyWhereInput =>
      HAS_VACANCY_OWNER
        ? ({ primaryRecruiterId: { in: subjectIds } } as Prisma.VacancyWhereInput)
        : { assignments: { some: { userId: { in: subjectIds }, isActive: true, assignmentKind: 'PRIMARY' } } };

    // Tiles + capacity + optional detail lists for a set of people.
    const computeFor = async (
      subjectIds: string[],
      includeDetails: boolean,
    ): Promise<{
      tiles: ResultsResponse['tiles'];
      capacity: ResultsCapacity;
      details?: Record<ResultTileKey, ResultDetailItem[]>;
      joinedBySite: JoinedSiteCount[];
    }> => {
      const jobs = await this.prisma.vacancy.findMany({
        where: {
          AND: [
            ...jobFilter,
            ownerFilterFor(subjectIds),
            { OR: [{ openedAt: null }, { openedAt: { lt: to } }] },
            { OR: [{ status: { not: 'Closed' } }, { updatedAt: { gte: from } }] },
          ],
        },
        select: {
          id: true,
          vacancyCode: true,
          approvedHeadcount: true,
          joinedHeadcount: true,
          position: { select: { title: true } },
        },
      });

      const jobIds = jobs.map((j) => j.id);
      const hasHiringCaseModel = typeof (this.prisma as { hiringCase?: { findMany?: unknown } }).hiringCase?.findMany === 'function';

      // R02: Define "Joined in month" by HiringCase.actualJoiningDate in Cairo [from, to).
      // Count each valid joined application once; treat missing actualJoiningDate explicitly (never substitute recording time).
      const joinedCasesRaw = jobs.length && hasHiringCaseModel
        ? await this.prisma.hiringCase.findMany({
            where: {
              organizationId: org,
              status: 'Joined',
              actualJoiningDate: { gte: from, lt: to },
              application: fileWhere({ vacancyId: { in: jobIds } }),
            },
            select: {
              id: true,
              applicationId: true,
              actualJoiningDate: true,
              application: {
                select: {
                  id: true,
                  stage: true,
                  candidate: { select: { firstName: true, lastName: true } },
                  vacancy: { select: { id: true, vacancyCode: true, branch: { select: { id: true, name: true } }, position: { select: { title: true } } } },
                },
              },
            },
            orderBy: { actualJoiningDate: 'desc' },
          })
        : [];

      const uniqueJoinedByApp = new Map<string, (typeof joinedCasesRaw)[number]>();
      for (const hc of joinedCasesRaw) {
        if (!uniqueJoinedByApp.has(hc.applicationId)) {
          uniqueJoinedByApp.set(hc.applicationId, hc);
        }
      }
      const joinedCases = [...uniqueJoinedByApp.values()];
      const joined = joinedCases.length;

      const missingActualDateCases = jobs.length && hasHiringCaseModel
        ? await this.prisma.hiringCase.findMany({
            where: {
              organizationId: org,
              status: 'Joined',
              actualJoiningDate: null,
              application: fileWhere({ vacancyId: { in: jobIds } }),
            },
            select: { applicationId: true },
          })
        : [];
      const missingActualDateCount = new Set(missingActualDateCases.map((c) => c.applicationId)).size;

      const target = jobs.reduce((t, j) => t + Math.max(0, j.approvedHeadcount), 0);
      const joinedCapacity = jobs.reduce((t, j) => t + Math.max(0, j.joinedHeadcount ?? 0), 0);
      const remainingCapacity = jobs.reduce((t, j) => t + Math.max(0, j.approvedHeadcount - (j.joinedHeadcount ?? 0)), 0);
      const capacity: ResultsCapacity = {
        approved: target,
        joined: joinedCapacity,
        remaining: remainingCapacity,
      };

      // Overdue follow-ups: files the people own whose follow-up date fell in this month (up to yesterday),
      // still open, and with no note, task completion, or stage transition since that date.
      const lastDay = today < range.nextMonthFirstDay ? today : range.nextMonthFirstDay;
      const due = await this.prisma.application.findMany({
        where: fileWhere({
          primaryRecruiterId: { in: subjectIds },
          followUpDate: { gte: new Date(`${range.firstDay}T00:00:00Z`), lt: new Date(`${lastDay}T00:00:00Z`) },
        }),
        select: {
          id: true,
          stage: true,
          followUpDate: true,
          candidate: { select: { firstName: true, lastName: true } },
          vacancy: { select: { id: true, vacancyCode: true, position: { select: { title: true } } } },
          notes: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          statusHistory: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { followUpDate: 'asc' },
      });

      const followUpTasks = due.length && typeof (this.prisma as { task?: { findMany?: unknown } }).task?.findMany === 'function'
        ? await this.prisma.task.findMany({
            where: {
              organizationId: org,
              entityType: 'Application',
              entityId: { in: due.map((a) => a.id) },
              type: 'ApplicationFollowUp',
            },
            select: { entityId: true, status: true, dueAt: true, completedAt: true, updatedAt: true, createdAt: true },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          })
        : [];
      const tasksByApp = new Map<string, typeof followUpTasks>();
      for (const t of followUpTasks) {
        if (!t.entityId) continue;
        const list = tasksByApp.get(t.entityId) ?? [];
        list.push(t);
        tasksByApp.set(t.entityId, list);
      }

      const isAppOverdue = (a: (typeof due)[number]): boolean => {
        if (CLOSED_STAGES.includes(a.stage)) return false;
        const since = a.followUpDate!.getTime();
        const stageMoved = Boolean(a.statusHistory[0]?.createdAt && a.statusHistory[0].createdAt.getTime() >= since);
        const appTasks = tasksByApp.get(a.id);
        if (appTasks && appTasks.length > 0) {
          const hasOpen = appTasks.some((t) => t.status === 'Open' || t.status === 'In Progress');
          if (hasOpen) return !stageMoved;
          const hasCompleted = appTasks.some((t) => t.status === 'Completed');
          return !(hasCompleted || stageMoved);
        }
        const touched = [a.notes[0]?.createdAt, a.statusHistory[0]?.createdAt].some((d) => d && d.getTime() >= since);
        return !touched;
      };

      const overdueItems = due.filter(isAppOverdue);
      const overdue = overdueItems.length;

      // Screens with a note (by the people) this month, and how many of those screening sessions reached Interview.
      const screens = await this.prisma.screeningLog.findMany({
        where: { screenerId: { in: subjectIds }, screenedAt: { gte: from, lt: to }, notes: { not: null }, application: fileWhere({}) },
        select: {
          id: true,
          applicationId: true,
          screenedAt: true,
          notes: true,
          application: {
            select: {
              id: true,
              stage: true,
              candidate: { select: { firstName: true, lastName: true } },
              vacancy: { select: { id: true, vacancyCode: true, position: { select: { title: true } } } },
              statusHistory: { where: { toStage: { in: REACHED_INTERVIEW } }, select: { id: true }, take: 1 },
            },
          },
        },
        orderBy: { screenedAt: 'desc' },
      });
      const noted = screens.filter((s) => s.notes?.trim());
      const didReachInterview = (s: (typeof noted)[number]) =>
        REACHED_INTERVIEW.includes(s.application.stage) || s.application.statusHistory.length > 0;
      const reached = noted.filter(didReachInterview).length;

      // Offers sent this month on files the people own, and how many were accepted.
      const sent = await this.prisma.offerVersion.findMany({
        where: { sentAt: { gte: from, lt: to }, offer: { application: fileWhere({ primaryRecruiterId: { in: subjectIds } }) } },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          sentAt: true,
          offer: {
            select: {
              id: true,
              applicationId: true,
              application: {
                select: {
                  id: true,
                  candidate: { select: { firstName: true, lastName: true } },
                  vacancy: { select: { id: true, vacancyCode: true, position: { select: { title: true } } } },
                },
              },
            },
          },
        },
        orderBy: { sentAt: 'desc' },
      });
      const accepted = sent.filter((v) => v.status === 'Accepted').length;

      const missingSuffix = missingActualDateCount > 0
        ? ` (${missingActualDateCount} joined without actual date excluded)`
        : '';

      const tiles: ResultsResponse['tiles'] = {
        seats: tile(
          joined,
          target,
          jobs.length,
          `${joined} joined in ${monthName} against ${target} seats on ${jobs.length} job${jobs.length === 1 ? '' : 's'}${missingSuffix}.`,
          true,
        ),
        overdueFollowUps: tile(
          overdue,
          due.length,
          due.length,
          `${overdue} of ${due.length} follow-ups due in ${monthName} were not acted on by their date.`,
        ),
        screensReachedInterview: tile(
          reached,
          noted.length,
          noted.length,
          `${reached} of ${noted.length} screens with a note in ${monthName} reached Interview.`,
        ),
        offersAccepted: tile(
          accepted,
          sent.length,
          sent.length,
          `${accepted} of ${sent.length} offers sent in ${monthName} were accepted.`,
        ),
      };

      const siteCounts = new Map<string, JoinedSiteCount>();
      for (const hc of joinedCases) {
        const branch = hc.application?.vacancy?.branch;
        const siteId = branch?.id ?? null;
        const site = branch?.name?.trim() || 'Unassigned site';
        const key = siteId ?? `name:${site}`;
        const current = siteCounts.get(key) ?? { siteId, site, joined: 0 };
        current.joined += 1;
        siteCounts.set(key, current);
      }
      const joinedBySite = bucketJoinedBySite([...siteCounts.values()]);

      if (!includeDetails) {
        return { tiles, capacity, joinedBySite };
      }

      const details: Record<ResultTileKey, ResultDetailItem[]> = {
        seats: joinedCases.map((hc) => ({
          id: hc.id,
          applicationId: hc.applicationId,
          candidateName: candidateNameOf(hc.application?.candidate),
          vacancyId: hc.application?.vacancy?.id ?? null,
          jobTitle: vacancyTitleOf(hc.application?.vacancy),
          date: hc.actualJoiningDate ? hc.actualJoiningDate.toISOString() : null,
          dateLabel: 'Actual joining date',
          status: 'Joined',
          counted: true,
        })),
        overdueFollowUps: due.map((a) => {
          const isOverdue = isAppOverdue(a);
          return {
            id: a.id,
            applicationId: a.id,
            candidateName: candidateNameOf(a.candidate),
            vacancyId: a.vacancy?.id ?? null,
            jobTitle: vacancyTitleOf(a.vacancy),
            date: a.followUpDate ? a.followUpDate.toISOString().slice(0, 10) : null,
            dateLabel: 'Follow-up due',
            status: isOverdue ? 'Overdue' : 'Acted on',
            counted: isOverdue,
          };
        }),
        screensReachedInterview: noted.map((s, idx) => {
          const isReached = didReachInterview(s);
          return {
            id: s.id ?? `screen-${idx}`,
            applicationId: s.applicationId ?? s.application?.id ?? '',
            candidateName: candidateNameOf(s.application?.candidate),
            vacancyId: s.application?.vacancy?.id ?? null,
            jobTitle: vacancyTitleOf(s.application?.vacancy),
            date: s.screenedAt ? s.screenedAt.toISOString() : null,
            dateLabel: 'Screened',
            status: isReached ? 'Reached interview' : safeLabel(s.application?.stage, 'Screened'),
            counted: isReached,
          };
        }),
        offersAccepted: sent.map((v, idx) => ({
          id: v.id ?? `offer-v-${idx}`,
          applicationId: v.offer?.applicationId ?? v.offer?.application?.id ?? '',
          candidateName: candidateNameOf(v.offer?.application?.candidate),
          vacancyId: v.offer?.application?.vacancy?.id ?? null,
          jobTitle: vacancyTitleOf(v.offer?.application?.vacancy),
          date: v.sentAt ? v.sentAt.toISOString() : null,
          dateLabel: `Offer v${v.versionNumber ?? 1} sent`,
          status: safeLabel(v.status, 'Sent'),
          counted: v.status === 'Accepted',
        })),
      };

      return { tiles, capacity, details, joinedBySite };
    };

    const funnelPromise: Promise<TeamFunnelStep[] | undefined> = scope === 'team'
      ? (async () => {
          if (!subjects.length) return buildTeamFunnel([]);
          const apps = await this.prisma.application.findMany({
            where: fileWhere({
              primaryRecruiterId: { in: subjects },
              appliedAt: { gte: from, lt: to },
            }),
            select: {
              stage: true,
              statusHistory: { select: { toStage: true } },
              screeningLogs: { select: { notes: true } },
              offers: { select: { status: true, versions: { select: { sentAt: true } } } },
              hiringCase: { select: { status: true } },
            },
          });
          return buildTeamFunnel(apps.map((app) => ({
            stage: app.stage,
            history: app.statusHistory.map((row) => row.toStage),
            screenNote: app.screeningLogs.some((log) => Boolean(log.notes?.trim())),
            offerSent: app.offers.some((offer) => offer.status !== 'Draft' || offer.versions.some((version) => version.sentAt != null)),
            joined: app.stage === 'Joined' || app.hiringCase?.status === 'Joined',
          })));
        })()
      : Promise.resolve(undefined);
    const sitesPromise: Promise<Array<{ id: string; name: string }> | undefined> = scope === 'team'
      ? (async () => {
          if (!subjects.length) return [];
          const jobs = await this.prisma.vacancy.findMany({
            where: {
              AND: [
                ...baseJobFilter,
                ...(query.vacancyId ? [{ id: query.vacancyId }] : []),
                ownerFilterFor(subjects),
                { OR: [{ openedAt: null }, { openedAt: { lt: to } }] },
                { OR: [{ status: { not: 'Closed' } }, { updatedAt: { gte: from } }] },
              ],
            },
            select: { branch: { select: { id: true, name: true } } },
          });
          const byId = new Map<string, string>();
          for (const job of jobs) {
            const name = job.branch?.name?.trim();
            if (job.branch?.id && name) byId.set(job.branch.id, name);
          }
          return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
        })()
      : Promise.resolve(undefined);

    const main = await computeFor(subjects, scope === 'me');

    let vacancies: ResultsVacancyOption[] | undefined;
    if (scope === 'me') {
      const ownedJobs = await this.prisma.vacancy.findMany({
        where: {
          AND: [
            ...baseJobFilter,
            ownerFilterFor(subjects),
            { OR: [{ openedAt: null }, { openedAt: { lt: to } }] },
            { OR: [{ status: { not: 'Closed' } }, { updatedAt: { gte: from } }] },
          ],
        },
        select: {
          id: true,
          vacancyCode: true,
          approvedHeadcount: true,
          joinedHeadcount: true,
          position: { select: { title: true } },
        },
      });
      vacancies = ownedJobs
        .map((j) => {
          const approved = Math.max(0, j.approvedHeadcount);
          const joinedCount = Math.max(0, j.joinedHeadcount ?? 0);
          return {
            id: j.id,
            title: vacancyTitleOf(j),
            approvedHeadcount: approved,
            joinedHeadcount: joinedCount,
            remainingHeadcount: Math.max(0, approved - joinedCount),
          };
        })
        .sort((a, b) => a.title.localeCompare(b.title));
    }

    // M2-M4 / M12: team results break down per direct report, including the same detail lists as My result.
    const rows = scope === 'team'
      ? await Promise.all(
          people.map(async (p) => {
            const sub = await computeFor([p.id], true);
            const workCounts = query.periodType ? Object.fromEntries(await Promise.all(TARGET_METRICS.map(async (metric) => [
              metric,
              (await this.countMetric(metric, org, p.id, from, to, query.vacancyId ?? null, query.branchId, appScope)).length,
            ]))) as Record<TargetMetricCode, number> : undefined;
            return {
              person: personOf(p),
              tiles: sub.tiles,
              capacity: sub.capacity,
              ...(sub.details ? { details: sub.details } : {}),
              ...(workCounts ? { workCounts } : {}),
            };
          }),
        )
      : undefined;
    const [funnel, sites] = await Promise.all([funnelPromise, sitesPromise]);
    const targetBlock = await this.targetsForResults(user, scope, subjects, { from, to, month: range.month }, query, now);

    return {
      scope,
      month: range.month,
      periodType: period.periodType,
      periodKey: period.periodKey,
      periodLabel: period.label,
      range: { from: from.toISOString(), to: to.toISOString() },
      asOf: now.toISOString(),
      filters: { vacancyId: query.vacancyId ?? null, managerId: query.managerId ?? null, branchId: query.branchId ?? null },
      people: people.map(personOf),
      tiles: main.tiles,
      capacity: main.capacity,
      ...(vacancies ? { vacancies } : {}),
      ...(main.details ? { details: main.details } : {}),
      ...(rows ? { rows } : {}),
      ...(scope === 'team'
        ? {
            joinedBySite: main.joinedBySite,
            ...(funnel ? { funnel } : {}),
            ...(sites ? { sites } : {}),
          }
        : {}),
      ...(targetBlock ? { targets: targetBlock.targets } : {}),
      ...(targetBlock && scope === 'team' ? { jobOptions: targetBlock.jobOptions } : {}),
    };
  }

  async listTargets(user: AuthUser, query: TargetListQuery, now = new Date()) {
    this.requireTargets();
    const periodType: TargetPeriodType = query.periodType ?? 'monthly';
    const period = this.periodOrThrow(periodType, query.periodKey, now);
    const audience = await this.audience(user, query.scope, query.employeeId);
    const vacancyId = this.optionalUuid(query.vacancyId, 'vacancyId');
    const branchId = this.optionalUuid(query.branchId, 'branchId');
    const loaded = await this.prisma.employeeActivityTarget.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        employeeId: { in: audience.employeeIds },
        periodType: period.periodType,
        periodKey: period.periodKey,
        ...(vacancyId ? { OR: [{ vacancyId }, { vacancyId: null }] } : {}),
      },
      orderBy: [{ employeeId: 'asc' }, { metric: 'asc' }],
    });
    const rows = loaded.filter((row) => row.organizationId === user.organizationId
      && row.isActive
      && audience.employeeIds.includes(row.employeeId)
      && row.periodType === period.periodType
      && row.periodKey === period.periodKey
      && (!vacancyId || row.vacancyId === vacancyId || row.vacancyId == null));
    const seen = new Set<string>();
    const unique = rows.filter((row) => {
      const key = `${row.employeeId}:${row.metric}:${row.periodType}:${row.periodKey}:${row.vacancyId ?? 'ALL'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const targets = period.periodType === 'weekly'
      ? await this.weeklyTargets(user.organizationId, audience.employeeIds, unique, period, branchId, vacancyId ?? null)
      : await this.hydrate(user.organizationId, unique, period, branchId, vacancyId ?? null);
    const people = await this.peopleIn(user.organizationId, audience.employeeIds);
    const jobOptions = audience.scope === 'me' ? undefined : await this.jobOptionsFor(user);
    return {
      scope: audience.scope,
      periodType: period.periodType,
      periodKey: period.periodKey,
      label: period.label,
      range: { from: period.from.toISOString(), to: period.to.toISOString() },
      targets,
      people,
      ...(jobOptions ? { jobOptions } : {}),
    };
  }

  async createTarget(user: AuthUser, dto: CreateTargetInput, now = new Date()): Promise<TargetProgressItem> {
    this.requireTargets();
    const employeeId = this.requireUuid(dto.employeeId, 'employeeId');
    const metric = this.requireMetric(dto.metric);
    const periodType = this.requirePeriodType(dto.periodType);
    const period = this.periodOrThrow(periodType, dto.periodKey, now);
    const targetQuantity = this.requireQuantity(dto.targetQuantity);
    const vacancyId = dto.vacancyId ? this.requireUuid(dto.vacancyId, 'vacancyId') : null;
    await this.assertAssignableEmployee(user, employeeId);
    if (vacancyId) await this.assertOpenVacancy(user.organizationId, vacancyId);
    const scopeKey = vacancyId ?? 'ALL';
    const duplicate = await this.prisma.employeeActivityTarget.findFirst({
      where: { organizationId: user.organizationId, employeeId, metric, periodType: period.periodType, periodKey: period.periodKey, scopeKey, isActive: true },
    });
    if (duplicate) throw new ConflictException(DUPLICATE_TARGET);
    const notes = dto.notes?.trim() || 'Initial target assigned';
    let createdId: string;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.employeeActivityTarget.create({
          data: {
            organizationId: user.organizationId,
            employeeId,
            setById: user.userId,
            metric,
            periodType: period.periodType,
            periodKey: period.periodKey,
            vacancyId,
            scopeKey,
            targetQuantity,
            version: 1,
            isActive: true,
          },
        });
        await tx.employeeActivityTargetRevision.create({
          data: {
            targetId: row.id,
            organizationId: user.organizationId,
            actorId: user.userId,
            priorQuantity: null,
            newQuantity: targetQuantity,
            reason: notes,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: 'TARGET_CREATED',
            entityType: 'EmployeeActivityTarget',
            entityId: row.id,
            result: 'Success',
            reason: notes,
            afterData: { metric, periodType: period.periodType, periodKey: period.periodKey, targetQuantity, vacancyId, employeeId },
          },
        });
        return row;
      });
      createdId = created.id;
    } catch (error) {
      if (this.isUniqueConflict(error)) throw new ConflictException(DUPLICATE_TARGET);
      throw error;
    }
    const saved = await this.prisma.employeeActivityTarget.findFirst({ where: { id: createdId, organizationId: user.organizationId } });
    if (!saved) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Target was not found.' });
    const [item] = await this.hydrate(user.organizationId, [saved], period, undefined, vacancyId);
    return item!;
  }

  async saveMonthlyPlan(user: AuthUser, dto: MonthlyPlanInput, now = new Date()): Promise<{ targets: TargetProgressItem[] }> {
    this.requireTargets();
    if (!dto || typeof dto !== 'object' || typeof dto.month !== 'string' || (dto.reason !== undefined && typeof dto.reason !== 'string')) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A monthly plan needs a valid month and reason.' });
    const employeeId = this.requireUuid(dto.employeeId, 'employeeId');
    const period = this.periodOrThrow('monthly', dto.month, now);
    const vacancyId = dto.vacancyId ? this.requireUuid(dto.vacancyId, 'vacancyId') : null;
    await this.assertAssignableEmployee(user, employeeId);
    if (vacancyId) {
      await this.assertOpenVacancy(user.organizationId, vacancyId);
      const allowedJobs = await this.jobOptionsFor(user);
      if (!allowedJobs.some((job) => job.id === vacancyId)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This job is outside your target scope.' });
    }
    if (!Array.isArray(dto.targets) || dto.targets.length < 1 || dto.targets.length > TARGET_METRICS.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Set at least one monthly target.' });
    const entries = dto.targets.map((item) => {
      if (!item || typeof item !== 'object') throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Each target needs a metric and quantity.' });
      return { metric: this.requireMetric(item.metric), quantity: this.requireQuantity(item.targetQuantity), version: item.version };
    });
    if (new Set(entries.map((item) => item.metric)).size !== entries.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Each monthly metric can be set only once.' });
    if (entries.some((item) => item.version !== null && (!Number.isInteger(item.version) || (item.version ?? 0) < 1))) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Each target needs its current version, or null for a new target.' });
    const reason = dto.reason?.trim() ?? '';
    const scopeKey = vacancyId ?? 'ALL';
    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.employeeActivityTarget.findMany({ where: { organizationId: user.organizationId, employeeId, periodType: 'monthly', periodKey: period.periodKey, scopeKey, isActive: true } });
        for (const entry of entries) {
          const current = existing.find((row) => row.organizationId === user.organizationId && row.employeeId === employeeId && row.periodType === 'monthly' && row.periodKey === period.periodKey && row.scopeKey === scopeKey && row.isActive && row.metric === entry.metric);
          if (current ? entry.version !== current.version : entry.version !== null) throw new ConflictException(STALE_TARGET);
          if (current && current.targetQuantity === entry.quantity) continue;
          if (current && reason.length < 3) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: REASON_REQUIRED });
          const note = reason || 'Monthly plan assigned';
          const priorQuantity = current?.targetQuantity ?? null;
          const priorVersion = current?.version;
          let targetId: string;
          if (current) {
            const written = await tx.employeeActivityTarget.updateMany({ where: { id: current.id, organizationId: user.organizationId, version: current.version, isActive: true }, data: { targetQuantity: entry.quantity, version: { increment: 1 } } });
            if (written.count !== 1) throw new ConflictException(STALE_TARGET);
            targetId = current.id;
          } else {
            const created = await tx.employeeActivityTarget.create({ data: { organizationId: user.organizationId, employeeId, setById: user.userId, metric: entry.metric, periodType: 'monthly', periodKey: period.periodKey, vacancyId, scopeKey, targetQuantity: entry.quantity, version: 1, isActive: true } });
            targetId = created.id;
          }
          await tx.employeeActivityTargetRevision.create({ data: { targetId, organizationId: user.organizationId, actorId: user.userId, priorQuantity, newQuantity: entry.quantity, reason: note } });
          await tx.auditLog.create({ data: { organizationId: user.organizationId, actorUserId: user.userId, action: current ? 'TARGET_UPDATED' : 'TARGET_CREATED', entityType: 'EmployeeActivityTarget', entityId: targetId, result: 'Success', reason: note, ...(current ? { beforeData: { targetQuantity: priorQuantity, version: priorVersion } } : {}), afterData: { metric: entry.metric, periodType: 'monthly', periodKey: period.periodKey, targetQuantity: entry.quantity, vacancyId, employeeId } } });
        }
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) throw new ConflictException(STALE_TARGET);
      throw error;
    }
    const loaded = await this.prisma.employeeActivityTarget.findMany({ where: { organizationId: user.organizationId, employeeId, periodType: 'monthly', periodKey: period.periodKey, scopeKey, isActive: true } });
    const saved = loaded.filter((row) => row.organizationId === user.organizationId && row.employeeId === employeeId && row.periodType === 'monthly' && row.periodKey === period.periodKey && row.scopeKey === scopeKey && row.isActive);
    return { targets: await this.hydrate(user.organizationId, saved, period, undefined, vacancyId) };
  }

  async updateTarget(user: AuthUser, id: string, dto: UpdateTargetInput): Promise<TargetProgressItem> {
    this.requireTargets();
    const targetId = this.requireUuid(id, 'id');
    const targetQuantity = this.requireQuantity(dto.targetQuantity);
    const reason = dto.reason?.trim() ?? '';
    if (reason.length < 3) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: REASON_REQUIRED });
    const existing = await this.prisma.employeeActivityTarget.findFirst({ where: { id: targetId, organizationId: user.organizationId } });
    if (!existing || !existing.isActive) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Target was not found.' });
    await this.assertCanManage(user, existing.employeeId);
    if (dto.version !== undefined && dto.version !== existing.version) throw new ConflictException(STALE_TARGET);
    const priorQuantity = existing.targetQuantity;
    const priorVersion = existing.version;
    try {
      await this.prisma.$transaction(async (tx) => {
        const written = await tx.employeeActivityTarget.updateMany({
          where: { id: existing.id, organizationId: user.organizationId, version: priorVersion },
          data: { targetQuantity, version: { increment: 1 } },
        });
        if (written.count !== 1) throw new ConflictException(STALE_TARGET);
        await tx.employeeActivityTargetRevision.create({
          data: {
            targetId: existing.id,
            organizationId: user.organizationId,
            actorId: user.userId,
            priorQuantity,
            newQuantity: targetQuantity,
            reason,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.userId,
            action: 'TARGET_UPDATED',
            entityType: 'EmployeeActivityTarget',
            entityId: existing.id,
            result: 'Success',
            reason,
            beforeData: { targetQuantity: priorQuantity, version: priorVersion },
            afterData: { targetQuantity, version: priorVersion + 1 },
          },
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw error;
    }
    const saved = await this.prisma.employeeActivityTarget.findFirst({ where: { id: existing.id, organizationId: user.organizationId } });
    if (!saved) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Target was not found.' });
    const period = this.periodOrThrow(saved.periodType as TargetPeriodType, saved.periodKey);
    const [item] = await this.hydrate(user.organizationId, [saved], period, undefined, saved.vacancyId);
    return item!;
  }

  async targetRecords(user: AuthUser, id: string): Promise<{ records: TargetRecordItem[]; revisions: TargetRevisionItem[] }> {
    this.requireTargets();
    const targetId = this.requireUuid(id, 'id');
    const existing = await this.prisma.employeeActivityTarget.findFirst({ where: { id: targetId, organizationId: user.organizationId, isActive: true } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Target was not found.' });
    const allowed = existing.employeeId === user.userId || user.roleCodes.includes(ADMIN) || (await this.reportingIds(user.organizationId, user.userId)).includes(existing.employeeId);
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You cannot view supporting records for this target.' });
    const period = this.periodOrThrow(existing.periodType as TargetPeriodType, existing.periodKey);
    const [item] = await this.hydrate(user.organizationId, [existing], period, undefined, existing.vacancyId);
    return { records: item?.records ?? [], revisions: item?.revisions ?? [] };
  }

  private requireTargets(): void {
    if (!this.activityTargetDelegate()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Targets are not available.' });
    }
  }

  private activityTargetDelegate(): { findMany: (...args: never[]) => Promise<unknown> } | null {
    const delegate = (this.prisma as PrismaService & { employeeActivityTarget?: { findMany?: unknown } }).employeeActivityTarget;
    if (!delegate || typeof delegate.findMany !== 'function') return null;
    return delegate as { findMany: (...args: never[]) => Promise<unknown> };
  }

  private async targetsForResults(
    user: AuthUser,
    scope: ResultsScope,
    subjects: string[],
    range: { from: Date; to: Date; month: string },
    query: ResultsQuery,
    now: Date,
  ): Promise<{ targets: TargetProgressItem[]; jobOptions: TargetJobOption[] } | null> {
    if (!this.activityTargetDelegate()) return null;
    const jobOptions = scope === 'team' ? await this.jobOptionsFor(user) : [];
    const reporting = scope === 'team' && !query.managerId ? await this.reportingIds(user.organizationId, user.userId) : [];
    const targetSubjects = [...new Set([...subjects, ...reporting])];
    if (!targetSubjects.length) return { targets: [], jobOptions };
    const period = resolveTargetPeriod(query.periodType === 'weekly' ? 'weekly' : 'monthly', query.periodKey ?? range.month, now);
    if (!period) return { targets: [], jobOptions };
    const loaded = await this.prisma.employeeActivityTarget.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        employeeId: { in: targetSubjects },
        periodType: period.periodType,
        periodKey: period.periodKey,
        ...(query.vacancyId ? { OR: [{ vacancyId: query.vacancyId }, { vacancyId: null }] } : {}),
      },
    });
    const matched = loaded.filter((row) => row.organizationId === user.organizationId
      && row.isActive
      && targetSubjects.includes(row.employeeId)
      && (!row.periodType || row.periodType === period.periodType)
      && (!row.periodKey || row.periodKey === period.periodKey)
      && (!query.vacancyId || !row.vacancyId || row.vacancyId === query.vacancyId));
    const seen = new Set<string>();
    const selected = matched.filter((row) => {
      const key = `${row.employeeId}:${row.metric}:${row.periodType ?? period.periodType}:${row.periodKey ?? period.periodKey}:${row.vacancyId ?? 'ALL'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const targets = period.periodType === 'weekly'
      ? await this.weeklyTargets(user.organizationId, targetSubjects, selected, period, query.branchId, query.vacancyId ?? null)
      : await this.hydrate(user.organizationId, selected, period, query.branchId, query.vacancyId ?? null);
    targets.sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.metric.localeCompare(b.metric));
    return { targets, jobOptions };
  }

  private async weeklyTargets(
    organizationId: string,
    employeeIds: string[],
    legacyRows: Parameters<ResultsService['hydrate']>[1],
    period: Parameters<ResultsService['hydrate']>[2],
    branchId: string | undefined,
    vacancyId: string | null,
  ): Promise<TargetProgressItem[]> {
    const firstDay = cairoToday(period.from);
    const lastDay = cairoToday(new Date(period.to.getTime() - 1));
    const months = [...new Set([firstDay.slice(0, 7), lastDay.slice(0, 7)])];
    const loaded = await this.prisma.employeeActivityTarget.findMany({ where: { organizationId, employeeId: { in: employeeIds }, isActive: true, periodType: 'monthly', periodKey: { in: months }, ...(vacancyId ? { OR: [{ vacancyId }, { vacancyId: null }] } : {}) } });
    const monthly = loaded.filter((row) => row.organizationId === organizationId && row.isActive && employeeIds.includes(row.employeeId) && row.periodType === 'monthly' && months.includes(row.periodKey) && (!vacancyId || row.vacancyId === vacancyId || row.vacancyId == null));
    const hydrated = await this.hydrate(organizationId, monthly, period, branchId, vacancyId);
    const groups = new Map<string, { item: TargetProgressItem; sources: NonNullable<TargetProgressItem['monthlySources']>; revisions: TargetRevisionItem[] }>();
    for (let index = 0; index < monthly.length; index++) {
      const row = monthly[index]!;
      const item = hydrated.find((value) => value.id === row.id);
      if (!item) continue;
      const quantity = monthlyTargetWeeks(row.periodKey, row.targetQuantity).find((week) => week.weekStart === firstDay)?.quantity ?? 0;
      const key = `${row.employeeId}:${row.metric}:${row.vacancyId ?? 'ALL'}`;
      const group = groups.get(key) ?? { item, sources: [], revisions: [] };
      if (!group.sources.some((source) => source.id === row.id)) group.sources.push({ id: row.id, month: row.periodKey, monthlyQuantity: row.targetQuantity, weeklyQuantity: quantity, version: row.version });
      for (const revision of item.revisions) if (!group.revisions.some((value) => value.id === revision.id)) group.revisions.push(revision);
      groups.set(key, group);
    }
    const derived = [...groups.entries()].map(([key, group]): TargetProgressItem => ({ ...group.item, id: `auto:${period.periodKey}:${key}`, ...targetProgress(group.sources.reduce((sum, source) => sum + source.weeklyQuantity, 0), group.item.achieved), source: 'monthly', monthlySources: group.sources.sort((a, b) => a.month.localeCompare(b.month)), revisions: group.revisions.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }));
    const legacy = (await this.hydrate(organizationId, legacyRows, period, branchId, vacancyId)).filter((item) => !groups.has(`${item.employeeId}:${item.metric}:${item.vacancyId ?? 'ALL'}`)).map((item): TargetProgressItem => ({ ...item, source: 'legacy-weekly' }));
    return [...derived, ...legacy];
  }

  private async hydrate(
    organizationId: string,
    rows: Array<{
      id: string;
      employeeId: string;
      metric: string;
      periodType: string;
      periodKey: string;
      vacancyId: string | null;
      targetQuantity: number;
      version: number;
    }>,
    period: { periodType: TargetPeriodType; periodKey: string; from: Date; to: Date; label: string },
    branchId: string | undefined,
    listVacancyId: string | null,
  ): Promise<TargetProgressItem[]> {
    if (!rows.length) return [];
    const revisions = await this.prisma.employeeActivityTargetRevision.findMany({
      where: { targetId: { in: rows.map((row) => row.id) } },
      orderBy: { createdAt: 'asc' },
    });
    const userIds = [...new Set([...rows.map((row) => row.employeeId), ...revisions.map((row) => row.actorId)])];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds }, organizationId }, select: { id: true, displayName: true, jobTitle: true } })
      : [];
    const vacancyIds = [...new Set(rows.map((row) => row.vacancyId).filter((id): id is string => Boolean(id)))];
    const vacancies = vacancyIds.length
      ? await this.prisma.vacancy.findMany({
          where: { id: { in: vacancyIds }, organizationId },
          select: { id: true, vacancyCode: true, position: { select: { title: true } } },
        })
      : [];
    const userOf = new Map(users.map((row) => [row.id, row]));
    const vacancyOf = new Map(vacancies.map((row) => [row.id, row]));
    const revisionsOf = new Map<string, typeof revisions>();
    for (const revision of revisions) {
      const list = revisionsOf.get(revision.targetId) ?? [];
      list.push(revision);
      revisionsOf.set(revision.targetId, list);
    }
    const counted = await Promise.all(rows.map(async (row) => {
      if (!this.isMetric(row.metric)) return null;
      const metric = row.metric;
      const jobScope = row.vacancyId ?? listVacancyId;
      const records = await this.countMetric(metric, organizationId, row.employeeId, period.from, period.to, jobScope, branchId);
      return { row, metric, records };
    }));
    const items: TargetProgressItem[] = [];
    for (const entry of counted) {
      if (!entry) continue;
      const { row, metric, records } = entry;
      const progress = targetProgress(row.targetQuantity, records.length);
      const employee = userOf.get(row.employeeId);
      const vacancy = row.vacancyId ? vacancyOf.get(row.vacancyId) : undefined;
      items.push({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: safeLabel(employee?.displayName, 'Employee'),
        metric,
        metricLabel: TARGET_METRIC_LABEL[metric],
        periodType: period.periodType,
        periodKey: period.periodKey,
        periodLabel: period.label,
        vacancyId: row.vacancyId,
        jobTitle: vacancy ? vacancyTitleOf(vacancy) : null,
        ...progress,
        version: row.version,
        records: this.toRecords(metric, records),
        revisions: (revisionsOf.get(row.id) ?? []).map((revision) => ({
          id: revision.id,
          priorTarget: revision.priorQuantity,
          newTarget: revision.newQuantity,
          reason: revision.reason ? safeLabel(revision.reason, '') || null : null,
          actorName: safeLabel(userOf.get(revision.actorId)?.displayName, 'Manager'),
          createdAt: revision.createdAt.toISOString(),
        })),
      });
    }
    return items;
  }

  private toRecords(metric: TargetMetric, rows: CountedWork[]): TargetRecordItem[] {
    return rows.map((row) => ({
      id: row.id,
      applicationId: row.applicationId,
      candidateName: safeLabel(row.candidateName, 'Candidate'),
      vacancyId: row.vacancyId,
      jobTitle: safeLabel(row.jobTitle, 'Job'),
      date: row.at.toISOString(),
      dateLabel: `${DATE_LABEL[metric]} ${cairoDateLabel(row.at)}`.trim(),
      status: safeLabel(row.status, 'Recorded'),
      counted: true,
    }));
  }

  private async countMetric(
    metric: TargetMetric,
    organizationId: string,
    employeeId: string,
    from: Date,
    to: Date,
    vacancyId: string | null,
    branchId?: string,
    visibility?: Prisma.ApplicationWhereInput,
  ): Promise<CountedWork[]> {
    const application = vacancyId || branchId || visibility
      ? { ...(visibility ? { AND: [visibility] } : {}), ...(vacancyId ? { vacancyId } : {}), ...(branchId ? { vacancy: { branchId } } : {}) }
      : undefined;
    if (metric === 'screenings_completed') {
      const rows = await this.prisma.screeningLog.findMany({
        where: {
          organizationId,
          screenerId: employeeId,
          outcome: { not: '__discarded__' },
          screenedAt: { gte: from, lt: to },
          ...(application ? { application } : {}),
        },
        select: {
          id: true,
          applicationId: true,
          screenerId: true,
          outcome: true,
          screenedAt: true,
          application: {
            select: {
              id: true,
              vacancyId: true,
              candidate: { select: { firstName: true, lastName: true } },
              vacancy: { select: { id: true, vacancyCode: true, branchId: true, position: { select: { title: true } } } },
            },
          },
        },
        orderBy: { screenedAt: 'asc' },
      });
      return countScreenings(rows, employeeId, from, to, vacancyId, branchId);
    }
    if (metric === 'interviews_conducted') {
      const rows = await this.prisma.interview.findMany({
        where: {
          organizationId,
          status: 'Completed',
          attendees: { some: { userId: employeeId, response: { not: 'Declined' } } },
          ...(application ? { application } : {}),
        },
        select: {
          id: true,
          status: true,
          interviewType: true,
          applicationId: true,
          completedAt: true,
          scheduledEnd: true,
          attendees: { where: { userId: employeeId }, select: { userId: true, response: true } },
          scorecards: {
            where: { interviewerId: employeeId, status: 'Submitted' },
            orderBy: { revision: 'asc' },
            select: { interviewerId: true, status: true, submittedAt: true, revision: true },
          },
          application: {
            select: {
              id: true,
              vacancyId: true,
              candidate: { select: { firstName: true, lastName: true } },
              vacancy: { select: { id: true, vacancyCode: true, branchId: true, position: { select: { title: true } } } },
            },
          },
        },
      });
      return countInterviews(rows, employeeId, from, to, vacancyId, branchId);
    }
    if (metric === 'feedback_submitted') {
      const rows = await this.prisma.interviewScorecard.findMany({
        where: {
          interviewerId: employeeId,
          status: 'Submitted',
          interview: {
            organizationId,
            status: { notIn: ['Cancelled', 'No-show'] },
            ...(application ? { application } : {}),
          },
        },
        orderBy: [{ revision: 'asc' }, { submittedAt: 'asc' }],
        select: {
          id: true,
          interviewId: true,
          interviewerId: true,
          status: true,
          revision: true,
          submittedAt: true,
          interview: {
            select: {
              id: true,
              status: true,
              application: {
                select: {
                  id: true,
                  vacancyId: true,
                  candidate: { select: { firstName: true, lastName: true } },
                  vacancy: { select: { id: true, vacancyCode: true, branchId: true, position: { select: { title: true } } } },
                },
              },
            },
          },
        },
      });
      return countFeedback(rows, employeeId, from, to, vacancyId, branchId);
    }
    if (typeof this.prisma.hiringCase?.findMany !== 'function') return [];
    const rows = await this.prisma.hiringCase.findMany({
      where: {
        organizationId,
        status: 'Joined',
        actualJoiningDate: { gte: from, lt: to },
        application: {
          AND: [
            { organizationId },
            ...(visibility ? [visibility] : []),
            ...(vacancyId ? [{ vacancyId }] : []),
            ...(branchId ? [{ vacancy: { branchId } }] : []),
            { OR: [{ primaryRecruiterId: employeeId }, { vacancy: { primaryRecruiterId: employeeId } }] },
          ],
        },
      },
      select: {
        id: true,
        applicationId: true,
        status: true,
        actualJoiningDate: true,
        application: {
          select: {
            id: true,
            vacancyId: true,
            primaryRecruiterId: true,
            candidate: { select: { firstName: true, lastName: true } },
            vacancy: { select: { id: true, vacancyCode: true, branchId: true, primaryRecruiterId: true, position: { select: { title: true } } } },
          },
        },
      },
      orderBy: { actualJoiningDate: 'asc' },
    });
    return countJoinings(rows, employeeId, from, to, vacancyId, branchId);
  }

  private async audience(user: AuthUser, requested: TargetListQuery['scope'], employeeId?: string): Promise<{ scope: ResultsScope; employeeIds: string[] }> {
    const isAdmin = user.roleCodes.includes(ADMIN);
    const line = await this.reportingIds(user.organizationId, user.userId);
    const hasTeam = line.length > 0 || isAdmin;
    let scope = requested;
    if (!scope) scope = isAdmin ? 'org' : hasTeam ? 'team' : 'me';
    if (scope !== 'me' && scope !== 'team' && scope !== 'org') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'scope must be me, team, or org.' });
    }
    if (scope === 'org' && !isAdmin) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Organization results are for administrators.' });
    if (scope === 'team' && !hasTeam) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Team results are for managers (you have no direct reports).' });
    let employeeIds: string[];
    if (scope === 'me') employeeIds = [user.userId];
    else if (scope === 'team') employeeIds = isAdmin && !line.length ? await this.activeEmployeeIds(user.organizationId) : line;
    else employeeIds = await this.activeEmployeeIds(user.organizationId);
    const focus = employeeId ? this.requireUuid(employeeId, 'employeeId') : undefined;
    if (focus) {
      if (!employeeIds.includes(focus) && !(scope === 'me' && focus === user.userId)) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only a manager of this employee, or an administrator, can view that target.' });
      }
      employeeIds = [focus];
    }
    return { scope, employeeIds };
  }

  private async reportingIds(organizationId: string, managerId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId, status: 'Active' },
      select: { id: true, managerId: true, status: true, organizationId: true },
    });
    const active = users.filter((row) => row.organizationId === organizationId && row.status === 'Active');
    const byManager = new Map<string, string[]>();
    for (const row of active) {
      if (!row.managerId) continue;
      const list = byManager.get(row.managerId) ?? [];
      list.push(row.id);
      byManager.set(row.managerId, list);
    }
    const out: string[] = [];
    let frontier = [managerId];
    for (let depth = 0; depth < MANAGER_TREE_DEPTH && frontier.length; depth += 1) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const child of byManager.get(id) ?? []) {
          out.push(child);
          next.push(child);
        }
      }
      frontier = next;
    }
    return out;
  }

  private async activeEmployeeIds(organizationId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId, status: 'Active' },
      select: {
        id: true,
        organizationId: true,
        status: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    return users
      .filter((row) => row.organizationId === organizationId && row.status === 'Active')
      .filter((row) => !row.userRoles?.some((link) => link.role.code === ADMIN))
      .map((row) => row.id);
  }

  private async peopleIn(organizationId: string, ids: string[]) {
    if (!ids.length) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true, displayName: true, jobTitle: true, organizationId: true },
      orderBy: { displayName: 'asc' },
    });
    return users
      .filter((row) => ids.includes(row.id) && row.organizationId === organizationId)
      .map((row) => {
        const role = row.jobTitle?.trim() || '';
        return { id: row.id, name: safeLabel(row.displayName, 'Employee'), ...(role ? { role: safeLabel(role, '') } : {}) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private async jobOptionsFor(user: AuthUser): Promise<TargetJobOption[]> {
    const isAdmin = user.roleCodes.includes(ADMIN);
    const access = this.access as AccessControlService & { getVacancyScopeWhere?: (u: AuthUser) => Promise<Prisma.VacancyWhereInput> };
    const jobScope = isAdmin && access.getVacancyScopeWhere ? await access.getVacancyScopeWhere(user) : await this.access.getVacancyVisibilityWhere(user);
    const jobs = await this.prisma.vacancy.findMany({
      where: { AND: [jobScope, { organizationId: user.organizationId }, { status: { not: 'Closed' } }] },
      select: { id: true, vacancyCode: true, position: { select: { title: true } }, status: true, organizationId: true },
      orderBy: { vacancyCode: 'asc' },
    });
    return jobs
      .filter((job) => job.organizationId === user.organizationId && job.status !== 'Closed')
      .map((job) => ({ id: job.id, title: vacancyTitleOf(job) }));
  }

  private async assertAssignableEmployee(user: AuthUser, employeeId: string): Promise<void> {
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, organizationId: user.organizationId },
      select: {
        id: true,
        status: true,
        organizationId: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    if (!employee || employee.organizationId !== user.organizationId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Employee was not found.' });
    }
    if (employee.status !== 'Active' || employee.userRoles.some((link) => link.role.code === ADMIN)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Targets can be set only for an active employee.' });
    }
    await this.assertCanManage(user, employeeId);
  }

  private async assertCanManage(user: AuthUser, employeeId: string): Promise<void> {
    if (user.roleCodes.includes(ADMIN)) return;
    const line = await this.reportingIds(user.organizationId, user.userId);
    if (!line.includes(employeeId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only a manager of this employee, or an administrator, can set targets.' });
    }
  }

  private async assertOpenVacancy(organizationId: string, vacancyId: string): Promise<void> {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, organizationId },
      select: { id: true, status: true, organizationId: true },
    });
    if (!vacancy || vacancy.organizationId !== organizationId) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job was not found.' });
    if (vacancy.status === 'Closed') throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'A closed job cannot receive a new target.' });
  }

  private periodOrThrow(periodType: string, periodKey: string | undefined, now = new Date()) {
    if (periodType !== 'weekly' && periodType !== 'monthly') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'periodType must be weekly or monthly.' });
    }
    const period = resolveTargetPeriod(periodType, periodKey, now);
    if (!period) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'periodKey is not a valid period.' });
    return period;
  }

  private requirePeriodType(value: string | undefined): TargetPeriodType {
    if (value !== 'weekly' && value !== 'monthly') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'periodType must be weekly or monthly.' });
    }
    return value;
  }

  private requireMetric(value: string | undefined): TargetMetric {
    if (!value || !this.isMetric(value)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'metric is not one of the supported target metrics.' });
    }
    return value;
  }

  private isMetric(value: string): value is TargetMetric {
    return (TARGET_METRICS as readonly string[]).includes(value);
  }

  private requireQuantity(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 2147483647) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'targetQuantity must be a positive whole number.' });
    }
    return value;
  }

  private requireUuid(value: string | undefined, field: string): string {
    const id = typeof value === 'string' ? value.trim() : '';
    if (!UUID_RE.test(id)) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `${field} must be a valid id.` });
    return id;
  }

  private optionalUuid(value: string | undefined, field: string): string | undefined {
    if (!value) return undefined;
    return this.requireUuid(value, field);
  }

  private isUniqueConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
